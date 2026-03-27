import { createClient } from "@supabase/supabase-js";
import {
  buildTrustBreakdown,
  computeTrustScore,
  decideUnclaimedProfile,
  decideClaimedProfile,
} from "./trust-scoring";
import {
  matchActivity,
  hasTrainingHistory,
  hasStravaMismatch,
} from "./strava-matcher";
import type { StravaActivity } from "./strava";
import { fetchAthleteActivities, refreshAccessToken } from "./strava";
import { logAudit } from "./audit";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export async function checkRateLimit(
  userId: string,
  ipAddress: string,
  action: string,
  maxCount: number,
  windowMs: number
): Promise<boolean> {
  const db = adminClient();
  const since = new Date(Date.now() - windowMs).toISOString();

  const { count: userCount } = await db
    .from("rate_limit_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", since);

  if ((userCount ?? 0) >= maxCount) return false;

  await db.from("rate_limit_log").insert({ user_id: userId, ip_address: ipAddress, action });
  return true;
}

// ---------------------------------------------------------------------------
// Core claim creation
// ---------------------------------------------------------------------------

export interface CreateClaimResult {
  claimId: number;
  status: string;
  trustScore: number;
  autoApproved: boolean;
}

export async function createClaim(
  userId: string,
  runnerId: number,
  ipAddress: string
): Promise<CreateClaimResult> {
  const db = adminClient();

  // Fetch runner + any active claim
  const { data: runner } = await db
    .from("runners")
    .select("id, full_name, claimed_by")
    .eq("id", runnerId)
    .single();

  if (!runner) throw new Error("Runner not found");

  // Check for existing active claim
  const { data: existingClaim } = await db
    .from("runner_claims")
    .select("id, user_id, status")
    .eq("runner_id", runnerId)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existingClaim?.user_id === userId) {
    throw new Error("You already have an active claim on this profile");
  }

  // Ensure user_profile exists (handles cases where trigger didn't fire)
  await db.from("user_profiles").upsert(
    { id: userId },
    { onConflict: "id", ignoreDuplicates: true }
  );

  // Fetch user profile + trust score
  const { data: userProfile } = await db
    .from("user_profiles")
    .select("trust_score, verification_level")
    .eq("id", userId)
    .single();

  // Fetch Strava token if available
  const { data: stravaToken } = await db
    .from("strava_tokens")
    .select("access_token, refresh_token, expires_at, athlete_id")
    .eq("user_id", userId)
    .maybeSingle();

  let activities: StravaActivity[] = [];
  let accessToken = stravaToken?.access_token ?? null;

  if (stravaToken) {
    // Refresh token if expired
    if (new Date(stravaToken.expires_at) <= new Date()) {
      try {
        const refreshed = await refreshAccessToken(stravaToken.refresh_token);
        accessToken = refreshed.access_token;
        await db.from("strava_tokens").update({
          access_token:  refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at:    new Date(refreshed.expires_at * 1000).toISOString(),
        }).eq("user_id", userId);
      } catch {
        accessToken = null;
      }
    }

    if (accessToken) {
      try {
        activities = await fetchAthleteActivities(accessToken, { perPage: 200 });
        await db.from("strava_tokens").update({ last_synced_at: new Date().toISOString() })
          .eq("user_id", userId);
      } catch {
        activities = [];
      }
    }
  }

  // Fetch runner's race results
  const { data: results } = await db
    .from("results")
    .select("chip_time, distance_category, events!inner(date_of_event)")
    .eq("runner_id", runnerId)
    .not("chip_time", "is", null)
    .neq("chip_time", "--:--:--");

  // Run Strava matching
  let matchedCount = 0;
  let hasDateMatch = false;
  let hasTraining = false;
  let hasMismatch = false;
  let bestMatchScore = 0;
  const matchDetails: unknown[] = [];

  for (const result of results ?? []) {
    const eventDate = (result.events as any)?.date_of_event ?? null;
    const runnerResult = {
      event_date: eventDate,
      distance_category: result.distance_category!,
      chip_time: result.chip_time!,
    };

    if (activities.length > 0) {
      const match = matchActivity(runnerResult, activities);
      if (match) {
        matchedCount++;
        bestMatchScore = Math.max(bestMatchScore, match.points);
        if (match.points >= 50) hasDateMatch = true; // 30 race + 20 date
        matchDetails.push({ activity_id: match.activity_id, confidence: match.confidence });
      } else if (hasStravaMismatch(runnerResult, activities)) {
        hasMismatch = true;
      }

      if (!hasTraining && eventDate) {
        hasTraining = hasTrainingHistory(eventDate, activities);
      }
    }
  }

  // Build trust score
  const breakdown = buildTrustBreakdown({
    hasGoogle: true,  // user is authenticated via Google OAuth
    hasStrava: !!stravaToken,
    stravaMatchScore: matchedCount > 0 ? bestMatchScore : null,
    hasDateMatch,
    hasTrainingHistory: hasTraining,
    matchedEventsCount: matchedCount,
    hasGpx: false,
    hasScreenshot: false,
    hasManualResult: false,
    stravaActivityMismatch: hasMismatch,
  });
  const trustScore = computeTrustScore(breakdown);

  // Decision
  const isUnclaimed = !existingClaim;
  const decision = isUnclaimed
    ? decideUnclaimedProfile(trustScore)
    : decideClaimedProfile(trustScore);

  const autoApproved = decision === "auto_approved";
  const claimStatus = autoApproved ? "approved" : "pending";

  // Insert claim
  const { data: claim, error: insertError } = await db
    .from("runner_claims")
    .insert({
      runner_id:            runnerId,
      user_id:              userId,
      status:               claimStatus,
      trust_score_at_claim: trustScore,
      auto_approved:        autoApproved,
      strava_match_score:   matchedCount > 0 ? bestMatchScore : null,
      strava_match_detail:  matchDetails.length > 0 ? matchDetails : null,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error("This profile already has an active claim");
    }
    throw new Error(`Failed to create claim: ${insertError.message}`);
  }

  // If auto-approved, update runner.claimed_by
  if (autoApproved) {
    await db.from("runners").update({ claimed_by: userId }).eq("id", runnerId);

    // Update user trust_score
    await db.from("user_profiles")
      .update({ trust_score: Math.min(100, (userProfile?.trust_score ?? 0) + trustScore) })
      .eq("id", userId);
  }

  await logAudit({
    event_type: autoApproved ? "claim_auto_approved" : "claim_created",
    user_id:    userId,
    runner_id:  runnerId,
    claim_id:   claim.id,
    ip_address: ipAddress,
    payload:    { trust_score: trustScore, decision, strava_matched: matchedCount > 0 },
  });

  return {
    claimId:      claim.id,
    status:       claimStatus,
    trustScore,
    autoApproved,
  };
}

// ---------------------------------------------------------------------------
// Get user's claims
// ---------------------------------------------------------------------------

export async function getMyClaims(userId: string) {
  const db = adminClient();
  const { data, error } = await db
    .from("runner_claims")
    .select("id, runner_id, status, trust_score_at_claim, auto_approved, created_at, runners(full_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Get single claim
// ---------------------------------------------------------------------------

export async function getClaim(claimId: number, userId: string) {
  const db = adminClient();
  const { data, error } = await db
    .from("runner_claims")
    .select("*, runners(full_name), runner_claim_evidence(*)")
    .eq("id", claimId)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data;
}

// ---------------------------------------------------------------------------
// Attach evidence
// ---------------------------------------------------------------------------

export async function attachEvidence(
  claimId: number,
  userId: string,
  evidence: { kind: string; url: string; notes?: string }
): Promise<void> {
  const db = adminClient();

  // Verify claim belongs to user
  const { data: claim } = await db
    .from("runner_claims")
    .select("id, status, runner_id, trust_score_at_claim")
    .eq("id", claimId)
    .eq("user_id", userId)
    .single();

  if (!claim) throw new Error("Claim not found");
  if (claim.status === "approved") throw new Error("Claim already approved");

  await db.from("runner_claim_evidence").insert({
    claim_id: claimId,
    kind:     evidence.kind,
    url:      evidence.url,
    notes:    evidence.notes ?? null,
  });

  // Bump trust score based on evidence kind
  let bonus = 0;
  if (evidence.kind === "gpx") bonus = 20;
  else if (evidence.kind === "screenshot") bonus = 10;
  else if (evidence.kind === "manual_result") bonus = 15;

  if (bonus > 0) {
    const newScore = Math.min(100, claim.trust_score_at_claim + bonus);
    await db.from("runner_claims").update({
      trust_score_at_claim: newScore,
      updated_at: new Date().toISOString(),
    }).eq("id", claimId);

    // Re-evaluate claim decision
    const { data: runner } = await db
      .from("runners")
      .select("claimed_by")
      .eq("id", claim.runner_id)
      .single();

    const decision = runner?.claimed_by
      ? decideClaimedProfile(newScore)
      : decideUnclaimedProfile(newScore);

    if (decision === "auto_approved") {
      await db.from("runner_claims").update({ status: "approved", auto_approved: true }).eq("id", claimId);
      await db.from("runners").update({ claimed_by: userId }).eq("id", claim.runner_id);
    }
  }

  await logAudit({
    event_type: "evidence_attached",
    user_id:    userId,
    claim_id:   claimId,
    payload:    { kind: evidence.kind },
  });
}
