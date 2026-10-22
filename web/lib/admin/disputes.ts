import { adminClient } from "@/lib/services/admin";
import { logAudit } from "@/lib/services/audit";
import { awardCoins, awardEventParticipationCoins, COIN_REWARDS } from "@/lib/services/coins";
import { invalidateRunner } from "@/lib/cache";
import { AdminInputError } from "./action";

export type DisputeOutcome = "uphold" | "transfer";

interface DisputeRow {
  id: number;
  status: string;
  disputing_user_id: string;
  original_claim_id: number;
  runner_claims: { id: number; runner_id: number; user_id: string; status: string } | null;
}

/**
 * Settle an open dispute.
 *   uphold   → the current owner keeps the profile (resolved_upheld)
 *   transfer → the owner's claim is superseded and the disputer gets an
 *              approved claim, the profile link and the usual claim coins
 *              (resolved_demoted)
 * The dispute is closed with a conditional update first, so it can only be
 * settled once.
 */
export async function resolveDispute(
  disputeId: number,
  outcome: DisputeOutcome,
  adminId: string,
  notes: string | null,
): Promise<string> {
  const db = adminClient();
  const { data, error } = await db
    .from("disputes")
    .select("id, status, disputing_user_id, original_claim_id, runner_claims ( id, runner_id, user_id, status )")
    .eq("id", disputeId)
    .maybeSingle();
  if (error) throw new Error(`Dispute lookup failed: ${error.message}`);
  const dispute = data as unknown as DisputeRow | null;
  if (!dispute) throw new AdminInputError("Dispute not found.");
  const claim = dispute.runner_claims;
  if (!claim) throw new AdminInputError("The disputed claim no longer exists.");
  if (outcome === "transfer" && claim.status !== "approved") {
    throw new AdminInputError(`The disputed claim is ${claim.status}, not approved; nothing to transfer.`);
  }

  // Closing the dispute first is the lock: only one admin action can win it.
  const now = new Date().toISOString();
  const { data: closed, error: closeError } = await db
    .from("disputes")
    .update({
      status: outcome === "uphold" ? "resolved_upheld" : "resolved_demoted",
      resolved_by: adminId,
      resolved_at: now,
      resolution_notes: notes,
      updated_at: now,
    })
    .eq("id", disputeId)
    .eq("status", "open")
    .select("id");
  if (closeError) throw new Error(`Dispute update failed: ${closeError.message}`);
  if (!closed?.length) throw new AdminInputError("Dispute is no longer open.");

  if (outcome === "transfer") {
    try {
      await transferProfile(claim, dispute, adminId);
    } catch (e) {
      // Reopen so the admin can retry; transferProfile undid its own steps.
      await db.from("disputes")
        .update({ status: "open", resolved_by: null, resolved_at: null, resolution_notes: null, updated_at: new Date().toISOString() })
        .eq("id", disputeId);
      throw e;
    }
    await closeSiblingDisputes(claim.id, disputeId);
  }

  await logAudit({
    event_type: `admin_dispute_${outcome === "uphold" ? "upheld" : "transferred"}`,
    user_id: adminId,
    runner_id: claim.runner_id,
    claim_id: claim.id,
    payload: { dispute_id: disputeId, owner: claim.user_id, disputer: dispute.disputing_user_id, notes },
  });
  if (outcome === "transfer") return "Transferred to the disputer.";
  return claim.status === "approved"
    ? "Upheld: the owner keeps the profile."
    : `Closed. The disputed claim is already ${claim.status}, so it holds no profile.`;
}

/** Other open disputes against a claim that has just been superseded are moot. */
async function closeSiblingDisputes(claimId: number, settledId: number): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await adminClient()
    .from("disputes")
    .update({ status: "admin_decision", resolved_at: now, resolution_notes: `Settled by dispute #${settledId}`, updated_at: now })
    .eq("original_claim_id", claimId)
    .eq("status", "open");
  if (error) console.error(`[admin] closing sibling disputes of claim ${claimId} failed:`, error.message);
}

/**
 * Supersede the owner's claim, create the disputer's approved claim and relink
 * the runner. Undoes the earlier steps if a later one fails. Coins are awarded
 * last and are idempotent, so their failure is logged, not undone.
 */
async function transferProfile(
  claim: NonNullable<DisputeRow["runner_claims"]>,
  dispute: DisputeRow,
  adminId: string,
): Promise<void> {
  const db = adminClient();
  const now = new Date().toISOString();
  const newOwner = dispute.disputing_user_id;

  const { data: superseded, error: supersedeError } = await db
    .from("runner_claims").update({ status: "superseded", updated_at: now })
    .eq("id", claim.id).eq("status", "approved").select("id");
  if (supersedeError) throw new Error(`Could not supersede claim #${claim.id}: ${supersedeError.message}`);
  if (!superseded?.length) throw new AdminInputError(`Claim #${claim.id} is no longer approved.`);
  const restoreOwner = () =>
    db.from("runner_claims").update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", claim.id).eq("status", "superseded");

  const { data: profile } = await db.from("user_profiles").select("trust_score").eq("id", newOwner).maybeSingle();
  const { data: created, error: insertError } = await db
    .from("runner_claims")
    .insert({
      runner_id: claim.runner_id,
      user_id: newOwner,
      status: "approved",
      trust_score_at_claim: (profile?.trust_score as number | undefined) ?? 0,
      reviewed_by: adminId,
      reviewed_at: now,
      review_notes: `Transferred by dispute #${dispute.id}`,
    })
    .select("id")
    .single();
  if (insertError) {
    await restoreOwner();
    throw new Error(`Could not create the new owner's claim: ${insertError.message}`);
  }

  const { error: linkError } = await db.from("runners").update({ claimed_by: newOwner }).eq("id", claim.runner_id);
  if (linkError) {
    await db.from("runner_claims").delete().eq("id", created.id);
    await restoreOwner();
    throw new Error(`Could not relink the runner: ${linkError.message}`);
  }
  invalidateRunner(claim.runner_id);

  try {
    await awardCoins(newOwner, COIN_REWARDS.CLAIM_APPROVED, "claim_approved", created.id as number);
    await awardEventParticipationCoins(newOwner, claim.runner_id);
  } catch (e) {
    console.error(`[admin] coins for transferred claim ${created.id} failed:`, e);
  }
}
