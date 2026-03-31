import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export const COIN_REWARDS = {
  CLAIM_APPROVED:       10,
  STRAVA_CONNECTED:     20,
  EVENT_PARTICIPATION:  20,
} as const;

export type CoinReason =
  | "claim_approved"
  | "strava_connected"
  | "event_participation";

/**
 * Award coins to a user. Idempotent when ref_id is provided —
 * the unique index on (user_id, reason, ref_id) prevents duplicates.
 */
export async function awardCoins(
  userId: string,
  amount: number,
  reason: CoinReason,
  refId?: number
): Promise<boolean> {
  const db = adminClient();

  const { error: txError } = await db.from("coin_transactions").insert({
    user_id: userId,
    amount,
    reason,
    ref_id: refId ?? null,
  });

  if (txError) {
    // Duplicate reward (unique constraint violation) — not an error
    if (txError.code === "23505") return false;
    throw new Error(`Failed to record coin transaction: ${txError.message}`);
  }

  // Update balance
  const { data: profile } = await db
    .from("user_profiles")
    .select("coins")
    .eq("id", userId)
    .single();

  const currentCoins = (profile as { coins?: number } | null)?.coins ?? 0;
  await db
    .from("user_profiles")
    .update({ coins: currentCoins + amount })
    .eq("id", userId);

  return true;
}

/**
 * Award coins for each event the runner participated in.
 * Called when a claim is approved — awards 20 coins per distinct event.
 */
export async function awardEventParticipationCoins(
  userId: string,
  runnerId: number
): Promise<number> {
  const db = adminClient();

  const { data: results } = await db
    .from("results")
    .select("event_id")
    .eq("runner_id", runnerId)
    .not("chip_time", "is", null)
    .neq("chip_time", "--:--:--");

  if (!results || results.length === 0) return 0;

  // Deduplicate by event_id
  const eventIds = [...new Set(results.map((r) => r.event_id))];

  let awarded = 0;
  for (const eventId of eventIds) {
    const ok = await awardCoins(
      userId,
      COIN_REWARDS.EVENT_PARTICIPATION,
      "event_participation",
      eventId
    );
    if (ok) awarded++;
  }

  return awarded;
}

export async function getBalance(userId: string): Promise<number> {
  const db = adminClient();
  const { data } = await db
    .from("user_profiles")
    .select("coins")
    .eq("id", userId)
    .single();

  return (data as { coins?: number } | null)?.coins ?? 0;
}

export async function getCoinHistory(
  userId: string,
  limit = 20
): Promise<{ amount: number; reason: string; ref_id: number | null; created_at: string }[]> {
  const db = adminClient();
  const { data } = await db
    .from("coin_transactions")
    .select("amount, reason, ref_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as { amount: number; reason: string; ref_id: number | null; created_at: string }[]) ?? [];
}
