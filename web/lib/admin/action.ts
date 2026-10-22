import type { User } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/services/admin";
import type { ActionResult } from "./types";

/**
 * Wraps an admin server action: checks the caller is an admin, runs `fn`, and
 * turns a thrown error into a message the form shows. `fn` returns the
 * success message.
 */
export async function runAdminAction(fn: (admin: User) => Promise<string>): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    return { ok: true, message: await fn(admin) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong.";
    console.error("[admin] action failed:", message);
    return { ok: false, message };
  }
}

/** Fails an action with a message shown to the admin. */
export class AdminInputError extends Error {}

export function fieldText(fd: FormData, name: string, max = 500): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function fieldInt(fd: FormData, name: string): number {
  const raw = fieldText(fd, name, 20);
  if (!/^-?\d+$/.test(raw)) throw new AdminInputError(`${name} must be a whole number.`);
  return Number(raw);
}
