"use server";

import { revalidatePath } from "next/cache";
import { fieldInt, fieldText, runAdminAction } from "@/lib/admin/action";
import { resolveDispute, type DisputeOutcome } from "@/lib/admin/disputes";
import type { ActionResult } from "@/lib/admin/types";

function settle(outcome: DisputeOutcome, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const message = await resolveDispute(fieldInt(fd, "dispute_id"), outcome, admin.id, fieldText(fd, "notes") || null);
    revalidatePath("/admin", "layout");
    return message;
  });
}

export async function upholdDisputeAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return settle("uphold", fd);
}

export async function transferDisputeAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return settle("transfer", fd);
}
