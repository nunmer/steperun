"use client";

import { useMemo, useState } from "react";
import { ActionForm, Field, inputClass } from "@/components/admin/action-form";
import { COPY_FIELDS, DEFAULT_COPY, PLACEHOLDERS, type EmailCopy, type EmailKind } from "@/lib/email/copy";
import { sampleEmail } from "@/lib/email/samples";
import { updateEmailCopyAction } from "./actions";
import { TestSendButton } from "./test-send-button";

interface CopyEditorProps {
  kind: EmailKind;
  saved: EmailCopy;
  adminName?: string;
  adminEmail: string;
}

/**
 * Edit the words of one claim email with a live preview. The preview renders
 * the same template the server sends, so what you see is what goes out.
 */
export function CopyEditor({ kind, saved, adminName, adminEmail }: CopyEditorProps) {
  const [copy, setCopy] = useState<EmailCopy>(saved);
  const email = useMemo(() => sampleEmail(kind, adminName, copy), [kind, adminName, copy]);
  const dirty = COPY_FIELDS[kind].some((f) => copy[f.key] !== saved[f.key]);
  const isDefault = COPY_FIELDS[kind].every((f) => copy[f.key] === DEFAULT_COPY[kind][f.key]);

  const set = (key: string, value: string) => setCopy((c) => ({ ...c, [key]: value }));

  return (
    <section className="border-b pb-10">
      <div className="flex items-end justify-between gap-4 border-b-2 border-rule pb-2">
        <div>
          <p className="eyebrow">{kind === "approved" ? "On approve" : "On reject"}</p>
          <h2 className="headline text-3xl">{kind === "approved" ? "Approved" : "Not approved"}</h2>
        </div>
        <TestSendButton kind={kind} email={adminEmail} />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <ActionForm action={updateEmailCopyAction} label="Save text" tone="primary" className="flex-col items-stretch sm:items-start">
          <input type="hidden" name="kind" value={kind} />
          <div className="grid w-full gap-3">
            {COPY_FIELDS[kind].map((f) => (
              <Field key={f.key} label={f.label}>
                {f.multiline ? (
                  <textarea
                    name={f.key}
                    value={copy[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    required={f.required}
                    maxLength={f.max}
                    rows={Math.min(8, Math.max(3, (copy[f.key] ?? "").split("\n").length + 1))}
                    className={`${inputClass} h-auto py-2 leading-relaxed`}
                  />
                ) : (
                  <input
                    name={f.key}
                    value={copy[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    required={f.required}
                    maxLength={f.max}
                    className={inputClass}
                  />
                )}
                {f.help && <span className="text-xs text-muted-foreground">{f.help}</span>}
              </Field>
            ))}
          </div>
          <div className="w-full text-xs text-muted-foreground space-y-1">
            <p>
              Placeholders:{" "}
              {Object.entries(PLACEHOLDERS[kind]).map(([name, what], i) => (
                <span key={name}>
                  {i > 0 && ", "}
                  <code className="time">{`{${name}}`}</code> {what}
                </span>
              ))}
              .
            </p>
            <p>
              <code className="time">**bold**</code>, <code className="time">[text](https://…)</code> for a link, a blank
              line for a new paragraph. Test sends use the saved text{dirty ? ", so save first" : ""}.
            </p>
            <p className="flex gap-3">
              {dirty && (
                <button type="button" onClick={() => setCopy(saved)} className="underline hover:text-foreground">
                  Undo changes
                </button>
              )}
              {!isDefault && (
                <button type="button" onClick={() => setCopy(DEFAULT_COPY[kind])} className="underline hover:text-foreground">
                  Restore default text
                </button>
              )}
            </p>
          </div>
        </ActionForm>

        <div className="lg:sticky lg:top-4 self-start">
          <p className="text-sm"><span className="eyebrow mr-2">Subject</span>{email.subject}</p>
          <iframe
            title={`${kind} email preview`}
            srcDoc={email.html}
            sandbox=""
            className="mt-3 w-full h-[640px] border bg-white"
          />
        </div>
      </div>
    </section>
  );
}
