export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/services/admin";
import { deliveryMode } from "@/lib/services/email";
import { EMAIL_KINDS } from "@/lib/email/copy";
import { PageHeader } from "@/components/sheet";
import { ActionForm, Field, inputClass } from "@/components/admin/action-form";
import { formatFrom, getEmailCopy, getEmailSender, SENDER_NAME_MAX } from "@/lib/services/settings";
import { CopyEditor } from "./copy-editor";
import { updateEmailSenderAction } from "./actions";

export const metadata = { title: "Emails" };

const MODE_COPY = {
  off: "Nothing is sent. Decisions are only recorded in the audit log.",
  allowlist: "Only addresses in EMAIL_ALLOWLIST receive email.",
  on: "Every claimant receives an email when you approve or reject their claim.",
} as const;

export default async function AdminEmailsPage() {
  const admin = await assertAdmin().catch(() => null);
  if (!admin) redirect("/");

  const mode = deliveryMode();
  const sender = await getEmailSender();
  const domain = process.env.RESEND_EMAIL_DOMAIN?.trim();
  const allow = (process.env.EMAIL_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const copies = await Promise.all(EMAIL_KINDS.map(async (kind) => ({ kind, copy: await getEmailCopy(kind) })));

  return (
    <div>
      <PageHeader kicker="Admin" title="Claim emails" aside={`Sent from ${formatFrom(sender) ?? "— (RESEND_EMAIL_DOMAIN not set)"}`} />

      <section className="mb-10 grid gap-6 sm:grid-cols-[12rem_1fr] border-b pb-6">
        <div>
          <p className="eyebrow">Delivery</p>
          <p className="headline text-4xl mt-1">{mode}</p>
        </div>
        <div className="text-sm space-y-2">
          <p>{MODE_COPY[mode]}</p>
          {mode === "allowlist" && (
            <p className="time text-xs text-muted-foreground">{allow.length ? allow.join(", ") : "Allowlist is empty."}</p>
          )}
          <p className="text-muted-foreground">
            Set <code className="time text-xs">EMAIL_DELIVERY</code> (off / allowlist / on) and{" "}
            <code className="time text-xs">EMAIL_ALLOWLIST</code> in the Vercel project, then redeploy.
          </p>
        </div>
      </section>

      <section className="mb-10 grid gap-6 sm:grid-cols-[12rem_1fr] border-b pb-6">
        <div>
          <p className="eyebrow">Sender</p>
          <p className="text-sm mt-1 text-muted-foreground">Used for every claim email and test send.</p>
        </div>
        <ActionForm action={updateEmailSenderAction} label="Save sender" tone="primary" className="flex-col items-stretch sm:items-start">
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <Field label="From name">
              <input name="name" defaultValue={sender.name} required maxLength={SENDER_NAME_MAX} className={inputClass} />
            </Field>
            <Field label="From address">
              <span className="flex items-center gap-1">
                <input name="local_part" defaultValue={sender.localPart} required maxLength={64} className={`${inputClass} flex-1 min-w-0`} />
                <span className="time text-xs text-muted-foreground whitespace-nowrap">@{domain ?? "—"}</span>
              </span>
            </Field>
            <Field label="Reply-to" className="sm:col-span-2">
              <input type="email" name="reply_to" defaultValue={sender.replyTo} required maxLength={254} className={inputClass} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            The domain is fixed by <code className="time">RESEND_EMAIL_DOMAIN</code>: Resend only sends from verified domains.
          </p>
        </ActionForm>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        {copies.map(({ kind, copy }) => (
          <CopyEditor
            key={kind}
            kind={kind}
            saved={copy}
            adminName={admin.user_metadata?.full_name as string | undefined}
            adminEmail={admin.email ?? ""}
          />
        ))}
      </div>
    </div>
  );
}
