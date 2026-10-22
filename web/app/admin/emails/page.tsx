export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/services/admin";
import { deliveryMode } from "@/lib/services/email";
import { sampleEmail } from "@/lib/email/samples";
import { PageHeader } from "@/components/sheet";
import { TestSendButton } from "./test-send-button";

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
  const allow = (process.env.EMAIL_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const samples = (["approved", "rejected"] as const).map((kind) => ({
    kind,
    email: sampleEmail(kind, admin.user_metadata?.full_name as string | undefined),
  }));

  return (
    <div>
      <PageHeader kicker="Admin" title="Claim emails" aside={`Sent from claims@${process.env.RESEND_EMAIL_DOMAIN ?? "—"}`} />

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

      <div className="grid gap-10 lg:grid-cols-2">
        {samples.map(({ kind, email }) => (
          <section key={kind}>
            <div className="flex items-end justify-between gap-4 border-b-2 border-rule pb-2">
              <div>
                <p className="eyebrow">{kind === "approved" ? "On approve" : "On reject"}</p>
                <h2 className="headline text-3xl">{kind === "approved" ? "Approved" : "Not approved"}</h2>
              </div>
              <TestSendButton kind={kind} email={admin.email ?? ""} />
            </div>
            <p className="text-sm mt-3"><span className="eyebrow mr-2">Subject</span>{email.subject}</p>
            <iframe
              title={`${kind} email preview`}
              srcDoc={email.html}
              sandbox=""
              className="mt-3 w-full h-[640px] border bg-white"
            />
          </section>
        ))}
      </div>
    </div>
  );
}
