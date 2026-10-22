"use server";

import { revalidatePath } from "next/cache";
import { fieldInt, fieldText, runAdminAction } from "@/lib/admin/action";
import { approveClaim, rejectClaim, revokeClaim } from "@/lib/admin/claims";
import type { ActionResult } from "@/lib/admin/types";

type Decide = (claimId: number, adminId: string, notes: string | null) => Promise<string>;

function decide(fn: Decide) {
  return async (fd: FormData): Promise<ActionResult> =>
    runAdminAction(async (admin) => {
      const message = await fn(fieldInt(fd, "claim_id"), admin.id, fieldText(fd, "notes") || null);
      revalidatePath("/admin", "layout");
      return message;
    });
}

export async function approveClaimAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return decide(approveClaim)(fd);
}

export async function rejectClaimAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return decide(rejectClaim)(fd);
}

export async function revokeClaimAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return decide(revokeClaim)(fd);
}
