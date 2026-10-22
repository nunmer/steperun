import { adminClient } from "@/lib/services/admin";
import { logAudit } from "@/lib/services/audit";
import { awardCoins, awardEventParticipationCoins, COIN_REWARDS } from "@/lib/services/coins";
import { notifyClaimDecision } from "@/lib/services/email";
import { invalidateRunner } from "@/lib/cache";
import { AdminInputError } from "./action";

interface ClaimRow {
  id: number;
  runner_id: number;
  user_id: string;
  status: string;
}

async function getClaim(claimId: number): Promise<ClaimRow> {
  const { data, error } = await adminClient()
    .from("runner_claims").select("id, runner_id, user_id, status").eq("id", claimId).maybeSingle();
  if (error) throw new Error(`Claim lookup failed: ${error.message}`);
  if (!data) throw new AdminInputError("Claim not found.");
  return data as ClaimRow;
}

/**
 * Move a claim from one status to another. Conditional on the current status,
 * so a double click or two admins at once can never apply a decision twice.
 */
async function transitionClaim(claimId: number, from: string, to: string, adminId: string, notes: string | null) {
  const now = new Date().toISOString();
  const { data, error } = await adminClient()
    .from("runner_claims")
    .update({ status: to, reviewed_by: adminId, reviewed_at: now, review_notes: notes, updated_at: now })
    .eq("id", claimId)
    .eq("status", from)
    .select("id");
  if (error) throw new Error(`Claim update failed: ${error.message}`);
  if (!data?.length) throw new AdminInputError(`Claim is no longer ${from}.`);
}

/** Put a claim back to `to` after a later step failed, so the admin can retry. */
async function rollbackClaim(claimId: number, from: string, to: string): Promise<void> {
  const { error } = await adminClient().from("runner_claims")
    .update({ status: to, updated_at: new Date().toISOString() }).eq("id", claimId).eq("status", from);
  if (error) console.error(`[admin] rollback of claim ${claimId} failed:`, error.message);
}

export async function approveClaim(claimId: number, adminId: string, notes: string | null): Promise<string> {
  const claim = await getClaim(claimId);
  await transitionClaim(claimId, "pending", "approved", adminId, notes);

  const { error } = await adminClient().from("runners").update({ claimed_by: claim.user_id }).eq("id", claim.runner_id);
  if (error) {
    await rollbackClaim(claimId, "approved", "pending");
    throw new Error(`Linking the runner failed, claim left pending: ${error.message}`);
  }
  invalidateRunner(claim.runner_id);
  await logAudit({ event_type: "admin_claim_approved", user_id: adminId, runner_id: claim.runner_id, claim_id: claimId });

  // Rewards are idempotent per (user, reason, ref), so a failure here is
  // reported, not rolled back: the profile link already stands.
  let coins = 0;
  let coinError: string | null = null;
  try {
    const claimBonus = await awardCoins(claim.user_id, COIN_REWARDS.CLAIM_APPROVED, "claim_approved", claimId);
    const races = await awardEventParticipationCoins(claim.user_id, claim.runner_id);
    coins = (claimBonus ? COIN_REWARDS.CLAIM_APPROVED : 0) + races * COIN_REWARDS.EVENT_PARTICIPATION;
  } catch (e) {
    console.error(`[admin] coin award for claim ${claimId} failed:`, e);
    coinError = e instanceof Error ? e.message : "error";
  }
  await notifyClaimDecision(claimId, { kind: "approved", coins });
  return coinError
    ? `Approved, but awarding coins failed (${coinError}). Credit them on the user page.`
    : `Approved. ${coins} coins awarded.`;
}

export async function rejectClaim(claimId: number, adminId: string, notes: string | null): Promise<string> {
  const claim = await getClaim(claimId);
  await transitionClaim(claimId, "pending", "rejected", adminId, notes);
  await logAudit({
    event_type: "admin_claim_rejected", user_id: adminId, runner_id: claim.runner_id, claim_id: claimId,
    payload: notes ? { notes } : undefined,
  });
  await notifyClaimDecision(claimId, { kind: "rejected", notes });
  return "Rejected.";
}

/**
 * Take an approved profile away again (wrong person, fraud). The runner is
 * unlinked; coins already awarded stay with the user (adjust them on the user
 * page if needed). No email is sent.
 */
export async function revokeClaim(claimId: number, adminId: string, notes: string | null): Promise<string> {
  const claim = await getClaim(claimId);
  await transitionClaim(claimId, "approved", "rejected", adminId, notes ? `Revoked: ${notes}` : "Revoked by admin");

  const { error } = await adminClient()
    .from("runners").update({ claimed_by: null }).eq("id", claim.runner_id).eq("claimed_by", claim.user_id);
  if (error) {
    await rollbackClaim(claimId, "rejected", "approved");
    throw new Error(`Unlinking the runner failed, claim left approved: ${error.message}`);
  }
  invalidateRunner(claim.runner_id);

  await logAudit({
    event_type: "admin_claim_revoked", user_id: adminId, runner_id: claim.runner_id, claim_id: claimId,
    payload: { owner: claim.user_id, notes },
  });
  return "Revoked. The profile is unclaimed; awarded coins were kept.";
}
