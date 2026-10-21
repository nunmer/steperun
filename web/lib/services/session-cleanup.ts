/**
 * Lazy cleanup of run sessions stuck in "extracting" / "analyzing"
 * (server restart, crash or timeout mid-request). Runs per user when they
 * load their sessions or start an analysis — no scheduler needed, and it
 * never wakes idle Fly machines.
 */

import { getStaleSessions, transitionSessionStatus } from "@/lib/run-analyzer-db";
import { refundCoins } from "@/lib/services/coins";

/** A session idle this long in a working state is considered dead. */
export const STALE_SESSION_MINUTES = 15;

interface StaleSessionRow {
  id: string;
  status: "extracting" | "analyzing";
  coins_charged?: number | null;
}

/**
 * Mark the user's stale sessions as failed and refund any coins they cost.
 * Each session is expired with a conditional update, so concurrent cleanups
 * (or a late-finishing request) can never refund the same session twice.
 * Never throws — cleanup must not block the request it piggybacks on.
 */
export async function expireStaleSessions(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_SESSION_MINUTES * 60_000).toISOString();

  try {
    const { data, error } = await getStaleSessions(userId, cutoff);
    if (error) {
      console.error("[session-cleanup] lookup failed", { userId, error: error.message });
      return 0;
    }

    let expired = 0;
    for (const session of (data ?? []) as StaleSessionRow[]) {
      const message =
        session.status === "analyzing"
          ? "Analysis timed out. Any coins spent were refunded."
          : "Frame extraction timed out. Please upload the video again.";

      const won = await transitionSessionStatus(session.id, userId, session.status, "error", {
        error: message,
        olderThan: cutoff,
      });
      if (!won) continue;
      expired++;

      const charged = session.coins_charged ?? 0;
      if (session.status === "analyzing" && charged > 0) {
        await refundCoins(userId, charged);
      }
    }
    return expired;
  } catch (e) {
    console.error("[session-cleanup] failed", { userId, error: e });
    return 0;
  }
}
