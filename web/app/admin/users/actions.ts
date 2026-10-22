"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/services/admin";
import { logAudit } from "@/lib/services/audit";
import { applyCoinTx } from "@/lib/services/coins";
import { AdminInputError, fieldInt, fieldText, runAdminAction } from "@/lib/admin/action";
import type { ActionResult } from "@/lib/admin/types";

const MAX_ADJUSTMENT = 10_000;
const UUID = /^[0-9a-f-]{36}$/i;

function userId(fd: FormData): string {
  const id = fieldText(fd, "user_id", 36);
  if (!UUID.test(id)) throw new AdminInputError("Bad user id.");
  return id;
}

/** Credit or debit coins through the atomic ledger (never below zero). */
export async function adjustCoinsAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const target = userId(fd);
    const amount = fieldInt(fd, "amount");
    const note = fieldText(fd, "note", 200);
    if (amount === 0 || Math.abs(amount) > MAX_ADJUSTMENT) {
      throw new AdminInputError(`Amount must be between -${MAX_ADJUSTMENT} and ${MAX_ADJUSTMENT}, not 0.`);
    }
    if (!note) throw new AdminInputError("Add a note saying why.");

    const result = await applyCoinTx({ userId: target, amount, reason: "admin_adjustment" });
    if (result.status === "insufficient") throw new AdminInputError(`Balance is ${result.balance}; can't go below zero.`);
    if (result.status !== "ok") throw new AdminInputError(`Not applied (${result.status}).`);

    await logAudit({ event_type: "admin_coins_adjusted", user_id: admin.id, payload: { target, amount, note, balance: result.balance } });
    revalidatePath(`/admin/users/${target}`);
    return `${amount > 0 ? "Credited" : "Debited"} ${Math.abs(amount)}. New balance ${result.balance}.`;
  });
}

/** Grant or remove admin rights. An admin can't change their own role. */
export async function setAdminAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const target = userId(fd);
    const makeAdmin = fieldText(fd, "make_admin") === "true";
    if (target === admin.id) throw new AdminInputError("You can't change your own admin role.");

    const { data, error } = await adminClient()
      .from("user_profiles").update({ is_admin: makeAdmin, updated_at: new Date().toISOString() }).eq("id", target).select("id");
    if (error) throw new Error(`Role update failed: ${error.message}`);
    if (!data?.length) throw new AdminInputError("User not found.");

    await logAudit({ event_type: "admin_role_changed", user_id: admin.id, payload: { target, is_admin: makeAdmin } });
    revalidatePath(`/admin/users/${target}`);
    return makeAdmin ? "Now an admin." : "Admin rights removed.";
  });
}

/** Set the trust score used to auto-approve claims and settle disputes. */
export async function setTrustAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const target = userId(fd);
    const score = fieldInt(fd, "trust_score");
    if (score < 0 || score > 100) throw new AdminInputError("Trust score is 0–100.");

    const { data, error } = await adminClient()
      .from("user_profiles").update({ trust_score: score, updated_at: new Date().toISOString() }).eq("id", target).select("id");
    if (error) throw new Error(`Trust update failed: ${error.message}`);
    if (!data?.length) throw new AdminInputError("User not found.");

    await logAudit({ event_type: "admin_trust_changed", user_id: admin.id, payload: { target, trust_score: score } });
    revalidatePath(`/admin/users/${target}`);
    return `Trust score set to ${score}.`;
  });
}
