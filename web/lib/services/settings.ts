import { createClient } from "@supabase/supabase-js";
import { LEGAL_CONFIG } from "@/lib/legal-config";
import { withDefaults, type EmailCopy, type EmailKind } from "@/lib/email/copy";

/*
 * Runtime settings admins edit (app_settings table, migration 006). Reads
 * never throw: a missing table or row falls back to the defaults, so email
 * keeps working before the migration is applied.
 */

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

export interface EmailSender {
  /** Display name, e.g. "Steppe RUN". */
  name: string;
  /** Mailbox before the @; the domain is RESEND_EMAIL_DOMAIN (must be verified in Resend). */
  localPart: string;
  replyTo: string;
}

const EMAIL_SENDER_KEY = "email_sender";

export function defaultEmailSender(): EmailSender {
  return {
    name: "Steppe RUN",
    localPart: "claims",
    replyTo: process.env.EMAIL_REPLY_TO || LEGAL_CONFIG.contactEmail,
  };
}

export const SENDER_NAME_MAX = 60;
const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/i;
const EMAIL = /^[^\s@<>",]+@[^\s@<>",]+\.[^\s@<>",]+$/;

/** Why a sender is invalid, or null if it is fine. */
export function emailSenderError(s: EmailSender): string | null {
  if (!s.name || s.name.length > SENDER_NAME_MAX) return `Sender name is 1–${SENDER_NAME_MAX} characters.`;
  if (/[<>"\r\n]/.test(s.name)) return "Sender name can't contain < > \" or line breaks.";
  if (!LOCAL_PART.test(s.localPart)) return "Mailbox is letters, digits, dot, dash or underscore (e.g. claims).";
  if (!EMAIL.test(s.replyTo)) return "Reply-to must be an email address.";
  return null;
}

export async function getEmailSender(): Promise<EmailSender> {
  const fallback = defaultEmailSender();
  const { data, error } = await adminClient()
    .from("app_settings").select("value").eq("key", EMAIL_SENDER_KEY).maybeSingle();
  if (error) {
    console.error("[settings] email sender read failed:", error.message);
    return fallback;
  }
  const stored = { ...fallback, ...((data?.value ?? {}) as Partial<EmailSender>) };
  const invalid = emailSenderError(stored);
  if (invalid) console.error("[settings] stored email sender is invalid, using default:", invalid);
  return invalid ? fallback : stored;
}

export async function saveEmailSender(sender: EmailSender, adminId: string): Promise<void> {
  const { error } = await adminClient().from("app_settings").upsert({
    key: EMAIL_SENDER_KEY,
    value: sender,
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  });
  if (error) throw new Error(`Saving the sender failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Email wording (lib/email/copy.ts): one row per email, overrides on the defaults
// ---------------------------------------------------------------------------

const copyKey = (kind: EmailKind) => `email_copy_${kind}`;

export async function getEmailCopy(kind: EmailKind): Promise<EmailCopy> {
  const { data, error } = await adminClient()
    .from("app_settings").select("value").eq("key", copyKey(kind)).maybeSingle();
  if (error) console.error(`[settings] ${kind} email copy read failed:`, error.message);
  return withDefaults(kind, data?.value);
}

export async function saveEmailCopy(kind: EmailKind, copy: EmailCopy, adminId: string): Promise<void> {
  const { error } = await adminClient().from("app_settings").upsert({
    key: copyKey(kind),
    value: copy,
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  });
  if (error) throw new Error(`Saving the email text failed: ${error.message}`);
}

/**
 * RFC 5322 `"Name" <box@domain>`, or null when RESEND_EMAIL_DOMAIN is unset.
 * The name is quoted so commas or colons in it aren't read as address syntax.
 */
export function formatFrom(sender: EmailSender): string | null {
  const domain = process.env.RESEND_EMAIL_DOMAIN?.trim();
  const name = sender.name.replace(/\\/g, "\\\\");
  return domain ? `"${name}" <${sender.localPart}@${domain}>` : null;
}
