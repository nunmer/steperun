"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/services/audit";
import { expireStaleSessions } from "@/lib/services/session-cleanup";
import { AdminInputError, fieldText, runAdminAction } from "@/lib/admin/action";
import type { ActionResult } from "@/lib/admin/types";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Expire a user's stuck sessions now (the same cleanup that runs lazily when
 * they next open the AI Coach): marks them failed and refunds coins.
 */
export async function expireStuckAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const userId = fieldText(fd, "user_id", 36);
    if (!UUID.test(userId)) throw new AdminInputError("Bad user id.");
    const expired = await expireStaleSessions(userId);
    await logAudit({ event_type: "admin_sessions_expired", user_id: admin.id, payload: { target: userId, expired } });
    revalidatePath("/admin", "layout");
    return expired ? `Expired ${expired} session(s); paid ones refunded.` : "Nothing to expire (not stuck for 15 min yet?).";
  });
}
