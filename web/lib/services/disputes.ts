import { createClient } from "@supabase/supabase-js";
import { decideDispute } from "./trust-scoring";
import { logAudit } from "./audit";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export interface CreateDisputeResult {
  disputeId: number;
  outcome: "demote_owner" | "flag_admin" | "admin_required";
}

export async function createDispute(
  claimantUserId: string,
  claimId: number,
  reason: string,
  evidence: Record<string, unknown> | null,
  ipAddress: string
): Promise<CreateDisputeResult> {
  const db = adminClient();

  // Fetch the claim being disputed
  const { data: claim } = await db
    .from("runner_claims")
    .select("id, runner_id, user_id, trust_score_at_claim, status")
    .eq("id", claimId)
    .single();

  if (!claim) throw new Error("Claim not found");
  if (claim.status !== "approved") throw new Error("Can only dispute approved claims");
  if (claim.user_id === claimantUserId) throw new Error("Cannot dispute your own claim");

  // Fetch owner + claimant trust scores
  const [ownerProfile, claimantProfile] = await Promise.all([
    db.from("user_profiles").select("trust_score").eq("id", claim.user_id).single(),
    db.from("user_profiles").select("trust_score").eq("id", claimantUserId).single(),
  ]);

  const ownerScore = ownerProfile.data?.trust_score ?? claim.trust_score_at_claim;
  const claimantScore = claimantProfile.data?.trust_score ?? 0;

  const outcome = decideDispute(ownerScore, claimantScore);

  // Insert dispute record
  const { data: dispute, error } = await db
    .from("disputes")
    .insert({
      original_claim_id: claimId,
      disputing_user_id: claimantUserId,
      reason,
      evidence: evidence ?? null,
      status: "open",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create dispute: ${error.message}`);

  // Act on outcome
  if (outcome === "demote_owner") {
    // Demote existing claim → approved claimant gets the profile
    await db.from("runner_claims").update({
      status: "superseded",
      updated_at: new Date().toISOString(),
    }).eq("id", claimId);

    await db.from("disputes").update({
      status: "resolved_demoted",
      resolved_at: new Date().toISOString(),
      resolution_notes: "Auto-resolved: claimant trust score significantly higher",
    }).eq("id", dispute.id);

    await db.from("runners").update({ claimed_by: claimantUserId }).eq("id", claim.runner_id);
  }

  await logAudit({
    event_type: `dispute_${outcome}`,
    user_id:    claimantUserId,
    runner_id:  claim.runner_id,
    claim_id:   claimId,
    ip_address: ipAddress,
    payload:    { dispute_id: dispute.id, owner_score: ownerScore, claimant_score: claimantScore },
  });

  return { disputeId: dispute.id, outcome };
}

export async function getDispute(disputeId: number, userId: string) {
  const db = adminClient();
  const { data } = await db
    .from("disputes")
    .select("*")
    .eq("id", disputeId)
    .eq("disputing_user_id", userId)
    .single();
  return data ?? null;
}
