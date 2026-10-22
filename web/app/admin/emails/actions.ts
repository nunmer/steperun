"use server";

import { assertAdmin } from "@/lib/services/admin";
import { logAudit } from "@/lib/services/audit";
import { sendEmail } from "@/lib/services/email";
import { sampleEmail, type SampleKind } from "@/lib/email/samples";

/**
 * Send one sample email to the signed-in admin's own address. The only send
 * path that bypasses EMAIL_DELIVERY, and it can never target anyone else.
 */
export async function sendTestEmailAction(kind: SampleKind): Promise<{ ok: boolean; message: string }> {
  const admin = await assertAdmin();
  if (!admin.email) return { ok: false, message: "Your account has no email address." };
  if (kind !== "approved" && kind !== "rejected") return { ok: false, message: "Unknown template." };

  const email = sampleEmail(kind, admin.user_metadata?.full_name as string | undefined);
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
