"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/services/admin";
import { logAudit } from "@/lib/services/audit";
import { invalidateAllResults, invalidateRunner } from "@/lib/cache";
import { AdminInputError, fieldInt, fieldText, runAdminAction } from "@/lib/admin/action";
import { getAdminRunner, mergeRunners } from "@/lib/admin/runners";
import { revokeClaim } from "@/lib/admin/claims";
import type { ActionResult } from "@/lib/admin/types";

/** Rename / fix the city or country of a runner. */
export async function updateRunnerAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const id = fieldInt(fd, "runner_id");
    const fullName = fieldText(fd, "full_name", 200);
    const city = fieldText(fd, "city", 100) || null;
    const country = fieldText(fd, "country", 100) || null;
    if (!fullName) throw new AdminInputError("Name can't be empty.");

    const before = await getAdminRunner(id);
    if (!before) throw new AdminInputError("Runner not found.");
    const { error } = await adminClient().from("runners").update({ full_name: fullName, city, country }).eq("id", id);
    if (error?.code === "23505") throw new AdminInputError("Another runner already has this name, country and city. Merge them instead.");
    if (error) throw new Error(`Update failed: ${error.message}`);

    // Names show up in event results and rankings, not only on the profile.
    invalidateAllResults();
    await logAudit({
      event_type: "admin_runner_updated", user_id: admin.id, runner_id: id,
      payload: { before: { full_name: before.full_name, city: before.city, country: before.country }, after: { full_name: fullName, city, country } },
    });
    revalidatePath(`/admin/runners/${id}`);
    return "Saved.";
  });
}

/** Hide a runner from every public list (junk names, teams) or show it again. */
export async function setHiddenAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const id = fieldInt(fd, "runner_id");
    const hidden = fieldText(fd, "hidden") === "true";
    const { error } = await adminClient().from("runners").update({ is_hidden: hidden }).eq("id", id);
    if (error) throw new Error(`Update failed: ${error.message}`);
    invalidateAllResults();
    await logAudit({ event_type: hidden ? "admin_runner_hidden" : "admin_runner_shown", user_id: admin.id, runner_id: id });
    revalidatePath(`/admin/runners/${id}`);
    return hidden ? "Hidden from public pages." : "Visible again.";
  });
}

/** Unlink the owner: revokes the approved claim if there is one. */
export async function unclaimRunnerAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const id = fieldInt(fd, "runner_id");
    const db = adminClient();
    const { data: claim, error: lookupError } = await db
      .from("runner_claims").select("id").eq("runner_id", id).eq("status", "approved").maybeSingle();
    if (lookupError) throw new Error(`Claim lookup failed: ${lookupError.message}`);
    let message: string;
    if (claim) {
      message = await revokeClaim(claim.id as number, admin.id, fieldText(fd, "notes") || null);
    } else {
      const { error } = await db.from("runners").update({ claimed_by: null }).eq("id", id);
      if (error) throw new Error(`Unlink failed: ${error.message}`);
      invalidateRunner(id);
      await logAudit({ event_type: "admin_runner_unclaimed", user_id: admin.id, runner_id: id });
      message = "Owner unlinked.";
    }
    revalidatePath(`/admin/runners/${id}`);
    return message;
  });
}

/** Open the merge preview for a duplicate id. */
export async function previewMergeAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  let target = "";
  const result = await runAdminAction(async () => {
    const id = fieldInt(fd, "runner_id");
    const drop = fieldInt(fd, "drop_id");
    if (drop <= 0) throw new AdminInputError("Enter a runner id.");
    target = `/admin/runners/${id}?merge=${drop}`;
    return "";
  });
  if (result?.ok) redirect(target);
  return result;
}

export async function mergeRunnersAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  let target = "";
  const result = await runAdminAction(async (admin) => {
    const keep = fieldInt(fd, "runner_id");
    const drop = fieldInt(fd, "drop_id");
    const message = await mergeRunners(keep, drop, admin.id);
    revalidatePath(`/admin/runners/${keep}`);
    target = `/admin/runners/${keep}?merged=${drop}`;
    return message;
  });
  if (result?.ok) redirect(target);
  return result;
}
