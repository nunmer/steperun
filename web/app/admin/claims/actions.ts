"use server";

import { revalidatePath } from "next/cache";
import { adminClient, assertAdmin } from "@/lib/services/admin";
import { logAudit } from "@/lib/services/audit";
import { awardCoins, awardEventParticipationCoins, COIN_REWARDS } from "@/lib/services/coins";
import { invalidateRunner } from "@/lib/cache";
import { notifyClaimDecision } from "@/lib/services/email";

export async function approveClaimAction(claimId: number, notes?: string) {
  const admin = await assertAdmin();
  const db = adminClient();

  const { data: claim } = await db
    .from("runner_claims")
    .select("runner_id, user_id")
    .eq("id", claimId)
    .single();

  if (!claim) throw new Error("Claim not found");
  const { runner_id: runnerId, user_id: userId } = claim as { runner_id: number; user_id: string };

  await db.from("runner_claims").update({
    status: "approved",
    reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
    review_notes: notes ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", claimId);

  await db.from("runners").update({ claimed_by: userId }).eq("id", runnerId);
  invalidateRunner(runnerId);

  // Award coins: +10 for claim, +20 per event participation
  const claimBonus = await awardCoins(userId, COIN_REWARDS.CLAIM_APPROVED, "claim_approved", claimId);
  const racesRewarded = await awardEventParticipationCoins(userId, runnerId);

  await logAudit({ event_type: "admin_claim_approved", user_id: admin.id, claim_id: claimId });

  // Tell the claimant (gated by EMAIL_DELIVERY; never throws).
  const coins = (claimBonus ? COIN_REWARDS.CLAIM_APPROVED : 0) + racesRewarded * COIN_REWARDS.EVENT_PARTICIPATION;
  await notifyClaimDecision(claimId, { kind: "approved", coins });

  revalidatePath("/admin/claims");
}

export async function rejectClaimAction(claimId: number, notes?: string) {
  const admin = await assertAdmin();
  const db = adminClient();

  await db.from("runner_claims").update({
    status: "rejected",
    reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
    review_notes: notes ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", claimId);

  await logAudit({ event_type: "admin_claim_rejected", user_id: admin.id, claim_id: claimId });
  await notifyClaimDecision(claimId, { kind: "rejected", notes: notes ?? null });
  revalidatePath("/admin/claims");
}
