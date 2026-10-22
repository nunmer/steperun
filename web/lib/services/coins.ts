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
  | "event_participation"
  | "purchase"
  | "analysis_spent"
  | "analysis_refund"
  | "admin_adjustment";

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

/** Count of successfully completed analyses (counts against free quota). */
export async function getCompletedAnalysisCount(userId: string): Promise<number> {
  const db = adminClient();
  const { count } = await db
    .from("run_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "done");
  return count ?? 0;
}

/**
 * Analyses that use up free quota: completed ones plus any other session
 * currently analyzing. Counting in-flight sessions stops a user from running
 * several "free" analyses in parallel.
 */
export async function getQuotaUsedCount(userId: string, excludeSessionId: string): Promise<number> {
  const db = adminClient();
  const { count } = await db
    .from("run_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["done", "analyzing"])
    .neq("id", excludeSessionId);
  return count ?? 0;
}

type CoinTxStatus = "ok" | "insufficient" | "duplicate" | "no_profile";

interface CoinTxResult {
  status: CoinTxStatus;
  balance: number;
}

/**
 * Atomic ledger write + balance change via the apply_coin_tx RPC
 * (migrations/fn_apply_coin_tx.sql). Throws on transport/DB errors.
 */
export async function applyCoinTx(params: {
  userId: string;
  amount: number;
  reason: CoinReason;
  refId?: number;
  paddleTransactionId?: string;
}): Promise<CoinTxResult> {
  const db = adminClient();
  const { data, error } = await db.rpc("apply_coin_tx", {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_reason: params.reason,
    p_ref_id: params.refId ?? null,
    p_paddle_tx_id: params.paddleTransactionId ?? null,
  });
  if (error) {
    throw new Error(`apply_coin_tx failed: ${error.message}`);
  }
  const result = data as Partial<CoinTxResult> | null;
  if (!result?.status) {
    throw new Error("apply_coin_tx returned an unexpected response");
  }
  return { status: result.status, balance: result.balance ?? 0 };
}

export type SpendResult =
  | { ok: true; newBalance: number }
  | { ok: false; reason: "insufficient"; balance: number }
  | { ok: false; reason: "error"; message: string };

/** Atomically debit coins. Never lets the balance go negative. */
export async function spendCoins(
  userId: string,
  amount: number,
  reason: CoinReason,
): Promise<SpendResult> {
  try {
    const result = await applyCoinTx({ userId, amount: -amount, reason });
    if (result.status === "ok") return { ok: true, newBalance: result.balance };
    if (result.status === "insufficient" || result.status === "no_profile") {
      return { ok: false, reason: "insufficient", balance: result.balance };
    }
    return { ok: false, reason: "error", message: `Unexpected spend status: ${result.status}` };
  } catch (e) {
    console.error("[coins] spend failed", { userId, amount, reason, error: e });
    return { ok: false, reason: "error", message: "Could not process coin payment. Please try again." };
  }
}

/** Atomically return coins after a failed paid analysis. Logs instead of throwing. */
export async function refundCoins(userId: string, amount: number): Promise<boolean> {
  try {
    const result = await applyCoinTx({ userId, amount, reason: "analysis_refund" });
    if (result.status !== "ok") {
      console.error("[coins] refund not applied", { userId, amount, status: result.status });
    }
    return result.status === "ok";
  } catch (e) {
    console.error("[coins] refund failed — needs manual credit", { userId, amount, error: e });
    return false;
  }
}

export type CreditResult = "credited" | "already_credited" | "no_profile";

/**
 * Credit a Paddle purchase atomically. Idempotent on paddle_transaction_id,
 * so Paddle webhook retries never double-credit. Throws on DB errors so the
 * webhook returns 5xx and Paddle retries.
 */
export async function creditPurchase(
  userId: string,
  coins: number,
  paddleTransactionId: string,
): Promise<CreditResult> {
  const result = await applyCoinTx({
    userId,
    amount: coins,
    reason: "purchase",
    paddleTransactionId,
  });
  if (result.status === "ok") return "credited";
  if (result.status === "duplicate") return "already_credited";
  if (result.status === "no_profile") return "no_profile";
  throw new Error(`Unexpected credit status: ${result.status}`);
}
