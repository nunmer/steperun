import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/services/audit";
import { formatFrom, getEmailCopy, getEmailSender } from "@/lib/services/settings";
import { claimApprovedEmail, claimRejectedEmail, type RenderedEmail } from "@/lib/email/templates";

/*
 * Transactional email through Resend (Vercel Marketplace integration; env
 * RESEND_API_KEY + RESEND_EMAIL_DOMAIN). Sender name, mailbox and reply-to
 * are edited on /admin/emails (app_settings).
 *
 * Delivery is gated by EMAIL_DELIVERY so nothing reaches real users by accident:
 *   off        (default) never send; the would-be send is written to the audit log
 *   allowlist  send only to addresses in EMAIL_ALLOWLIST (comma-separated), e.g. the team
 *   on         send to everyone
 * Email failures never throw: an approval must not fail because a mail bounced.
 */

export type DeliveryMode = "off" | "allowlist" | "on";

export type SendResult =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export function deliveryMode(): DeliveryMode {
  const v = process.env.EMAIL_DELIVERY?.trim().toLowerCase();
  return v === "on" || v === "allowlist" ? v : "off";
}

function allowlist(): Set<string> {
  return new Set(
    (process.env.EMAIL_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Why an address would not be emailed under the current mode, or null if it would. */
export function blockedReason(to: string, mode: DeliveryMode = deliveryMode()): string | null {
  if (mode === "off") return "EMAIL_DELIVERY is off";
  if (mode === "allowlist" && !allowlist().has(to.toLowerCase())) return "recipient not in EMAIL_ALLOWLIST";
  return null;
}

interface SendInput {
  to: string;
  email: RenderedEmail;
  /** `<event>/<entity-id>`: Resend drops a repeat with the same key for 24 h. */
  idempotencyKey: string;
  tag: string;
  /** Bypass EMAIL_DELIVERY; only for an admin sending a test to themselves. */
  force?: boolean;
}

export async function sendEmail({ to, email, idempotencyKey, tag, force = false }: SendInput): Promise<SendResult> {
  const blocked = force ? null : blockedReason(to);
  if (blocked) return { status: "skipped", reason: blocked };

  const apiKey = process.env.RESEND_API_KEY;
  const sender = await getEmailSender();
  const from = formatFrom(sender);
  if (!apiKey || !from) return { status: "failed", reason: "RESEND_API_KEY or RESEND_EMAIL_DOMAIN not set" };

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send(
    {
      from,
      to: [to],
      replyTo: sender.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [{ name: "type", value: tag }],
    },
    { idempotencyKey },
  );
  if (error) return { status: "failed", reason: `${error.name}: ${error.message}` };
  return { status: "sent", id: data?.id ?? "" };
}

// ---------------------------------------------------------------------------
// Claim decisions
// ---------------------------------------------------------------------------

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

export type ClaimDecision =
  | { kind: "approved"; coins: number }
  | { kind: "rejected"; notes: string | null };

/**
 * Email the claimant about an admin decision. Looks up their auth email and
 * the runner's name, renders the template, sends (subject to EMAIL_DELIVERY)
 * and records the outcome in the claim audit log. Never throws.
 */
export async function notifyClaimDecision(claimId: number, decision: ClaimDecision): Promise<SendResult> {
  let result: SendResult;
  let userId: string | undefined;
  let runnerId: number | undefined;
  try {
    const db = adminClient();
    const { data: claim, error } = await db
      .from("runner_claims")
      .select("user_id, runner_id, runners(full_name)")
      .eq("id", claimId)
      .single();
    if (error || !claim) throw new Error(error?.message ?? "claim not found");

    userId = claim.user_id as string;
    runnerId = claim.runner_id as number;
    const runnerName = (claim.runners as unknown as { full_name: string } | null)?.full_name ?? "your runner profile";

    const { data: authUser, error: authError } = await db.auth.admin.getUserById(userId);
    const to = authUser?.user?.email;
    if (authError || !to) throw new Error(authError?.message ?? "claimant has no email");
    const fullName = authUser.user.user_metadata?.full_name as string | undefined;
    const firstName = fullName?.split(" ")[0] ?? null;

    const copy = await getEmailCopy(decision.kind);
    const email = decision.kind === "approved"
      ? claimApprovedEmail({ firstName, runnerName, runnerId, coins: decision.coins }, copy)
      : claimRejectedEmail({ firstName, runnerName, runnerId, notes: decision.notes }, copy);

    result = await sendEmail({
      to,
      email,
      idempotencyKey: `claim-${decision.kind}/${claimId}`,
      tag: `claim_${decision.kind}`,
    });
  } catch (e) {
    result = { status: "failed", reason: e instanceof Error ? e.message : String(e) };
  }

  await logAudit({
    event_type: `email_claim_${decision.kind}_${result.status}`,
    user_id: userId,
    runner_id: runnerId,
    claim_id: claimId,
    payload: result.status === "sent" ? { resend_id: result.id } : { reason: result.reason, mode: deliveryMode() },
  });
  return result;
}
