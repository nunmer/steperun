"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabase-server";
import { logAudit } from "@/lib/services/audit";
import { awardCoins, awardEventParticipationCoins, COIN_REWARDS } from "@/lib/services/coins";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

async function assertAdmin() {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  const db = adminClient();
  const { data } = await db.from("user_profiles").select("is_admin").eq("id", user.id).single();
  if (!data?.is_admin) throw new Error("Forbidden");
  return user;
}

export async function approveClaimAction(claimId: number, notes?: string) {
  const admin = await assertAdmin();
  const db = adminClient();

  const { data: claim } = await db
    .from("runner_claims")
    .select("runner_id, user_id")
    .eq("id", claimId)
    .single();

  if (!claim) throw new Error("Claim not found");

  await db.from("runner_claims").update({
    status: "approved",
    reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
    review_notes: notes ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", claimId);

  await db.from("runners").update({ claimed_by: (claim as any).user_id }).eq("id", (claim as any).runner_id);

  // Award coins: +10 for claim, +20 per event participation
  await awardCoins((claim as any).user_id, COIN_REWARDS.CLAIM_APPROVED, "claim_approved", claimId);
  await awardEventParticipationCoins((claim as any).user_id, (claim as any).runner_id);

  await logAudit({ event_type: "admin_claim_approved", user_id: admin.id, claim_id: claimId });
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
  revalidatePath("/admin/claims");
}
