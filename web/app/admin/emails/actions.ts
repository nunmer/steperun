"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/services/admin";
import { logAudit } from "@/lib/services/audit";
import { sendEmail } from "@/lib/services/email";
import { sampleEmail, type SampleKind } from "@/lib/email/samples";
import { AdminInputError, fieldText, runAdminAction } from "@/lib/admin/action";
import type { ActionResult } from "@/lib/admin/types";
import { emailSenderError, getEmailCopy, getEmailSender, saveEmailCopy, saveEmailSender, SENDER_NAME_MAX } from "@/lib/services/settings";
import { COPY_FIELDS, copyError, EMAIL_KINDS, type EmailCopy, type EmailKind } from "@/lib/email/copy";

/**
 * Send one sample email to the signed-in admin's own address. The only send
 * path that bypasses EMAIL_DELIVERY, and it can never target anyone else.
 */
export async function sendTestEmailAction(kind: SampleKind): Promise<{ ok: boolean; message: string }> {
  const admin = await assertAdmin();
  if (!admin.email) return { ok: false, message: "Your account has no email address." };
  if (kind !== "approved" && kind !== "rejected") return { ok: false, message: "Unknown template." };

  const email = sampleEmail(kind, admin.user_metadata?.full_name as string | undefined, await getEmailCopy(kind));
  const result = await sendEmail({
    to: admin.email,
    email: { ...email, subject: `[TEST] ${email.subject}` },
    // Unique per click, so repeated tests are not deduplicated.
    idempotencyKey: `test-${kind}/${admin.id}/${Date.now()}`,
    tag: `test_${kind}`,
    force: true,
  });

  await logAudit({
    event_type: `email_test_${kind}_${result.status}`,
    user_id: admin.id,
    payload: result.status === "sent" ? { resend_id: result.id } : { reason: result.reason },
  });

  if (result.status === "sent") return { ok: true, message: `Sent to ${admin.email}.` };
  return { ok: false, message: result.status === "failed" ? result.reason : "Not sent." };
}

/** Change the From name/mailbox and Reply-To of every outgoing email. */
export async function updateEmailSenderAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const sender = {
      name: fieldText(fd, "name", SENDER_NAME_MAX + 1),
      localPart: fieldText(fd, "local_part", 64).toLowerCase(),
      replyTo: fieldText(fd, "reply_to", 254),
    };
    const invalid = emailSenderError(sender);
    if (invalid) throw new AdminInputError(invalid);

    const before = await getEmailSender();
    await saveEmailSender(sender, admin.id);
    await logAudit({ event_type: "admin_email_sender_changed", user_id: admin.id, payload: { before: { ...before }, after: { ...sender } } });
    revalidatePath("/admin/emails");
    return "Sender saved. Send a test to check it.";
  });
}

/** Save the wording of one claim email (form fields named after COPY_FIELDS keys). */
export async function updateEmailCopyAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdminAction(async (admin) => {
    const kind = fieldText(fd, "kind", 20) as EmailKind;
    if (!EMAIL_KINDS.includes(kind)) throw new AdminInputError("Unknown email.");

    const copy: EmailCopy = {};
    for (const f of COPY_FIELDS[kind]) {
      const raw = fd.get(f.key);
      // Keep line breaks; normalise Windows ones. Length is checked by copyError.
      copy[f.key] = typeof raw === "string" ? raw.replace(/\r\n/g, "\n").trim() : "";
    }
    const invalid = copyError(kind, copy);
    if (invalid) throw new AdminInputError(invalid);

    await saveEmailCopy(kind, copy, admin.id);
    await logAudit({ event_type: "admin_email_copy_changed", user_id: admin.id, payload: { kind, copy } });
    revalidatePath("/admin/emails");
    return "Saved. New emails use this text.";
  });
}
