"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionForm, inputClass } from "@/components/admin/action-form";
import { COPY_FIELDS, DEFAULT_COPY, PLACEHOLDERS, type EmailCopy, type EmailKind } from "@/lib/email/copy";
import { sampleEmail, sampleInput } from "@/lib/email/samples";
import { editableEmailHtml } from "@/lib/email/templates";
import { cn } from "@/lib/utils";
import { updateEmailCopyAction } from "./actions";
import { TestSendButton } from "./test-send-button";

interface CopyEditorProps {
  kind: EmailKind;
  saved: EmailCopy;
  adminName?: string;
  adminEmail: string;
}

/**
 * The raw text of an editable field. textContent ignores CSS text-transform
 * (the headline is uppercase on screen); line breaks may arrive as <br>.
 */
function fieldText(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement;
  for (const br of copy.querySelectorAll("br")) br.replaceWith("\n");
  return (copy.textContent ?? "").replace(/\n$/, "");
}

/** Fields that live outside the email body, edited in the strip above it. */
const OUTSIDE = ["subject", "preheader", "greetingNoName"] as const;

/**
 * One claim email as it looks in the inbox, with its words editable in place:
 * click any dashed text and type. "Preview" shows it exactly as sent.
 */
export function CopyEditor({ kind, saved, adminName, adminEmail }: CopyEditorProps) {
  const [copy, setCopy] = useState<EmailCopy>(saved);
  const [preview, setPreview] = useState(false);
  // The editable document is rebuilt only on undo/restore, never while typing (keeps the caret).
  const [base, setBase] = useState<EmailCopy>(saved);
  const frame = useRef<HTMLIFrameElement>(null);

  const sample = useMemo(() => sampleInput(adminName), [adminName]);
  const editHtml = useMemo(() => editableEmailHtml(kind, base, sample), [kind, base, sample]);
  const sent = useMemo(() => sampleEmail(kind, adminName, copy), [kind, adminName, copy]);
  const fields = COPY_FIELDS[kind];
  const multiline = useMemo(() => new Set(fields.filter((f) => f.multiline).map((f) => f.key)), [fields]);

  const dirty = fields.some((f) => copy[f.key] !== saved[f.key]);
  const isDefault = fields.every((f) => copy[f.key] === DEFAULT_COPY[kind][f.key]);

  const set = (key: string, value: string) => setCopy((c) => ({ ...c, [key]: value }));
  const reset = (to: EmailCopy) => {
    setCopy(to);
    setBase(to);
  };

  // Wire the editable document: typing updates the copy, Enter is blocked in
  // one-line fields, and the button/links don't navigate. The frame can finish
  // loading before hydration, so wire it on load and also if already loaded.
  useEffect(() => {
    const iframe = frame.current;
    if (preview || !iframe) return;
    const wire = () => {
      const doc = iframe.contentDocument;
      if (!doc?.querySelector("[data-field]") || doc.body.dataset.wired) return;
      doc.body.dataset.wired = "1";
      doc.addEventListener("input", (e) => {
        const el = (e.target as Element).closest<HTMLElement>("[data-field]");
        if (el?.dataset.field) set(el.dataset.field, fieldText(el));
      });
      doc.addEventListener("keydown", (e) => {
        const el = (e.target as Element).closest<HTMLElement>("[data-field]");
        if (e.key === "Enter" && el?.dataset.field && !multiline.has(el.dataset.field)) e.preventDefault();
      });
      doc.addEventListener("click", (e) => {
        if ((e.target as Element).closest("a")) e.preventDefault();
      });
      for (const el of doc.querySelectorAll<HTMLElement>("[data-field]")) {
        el.title = fields.find((f) => f.key === el.dataset.field)?.label ?? "";
      }
    };
    wire();
    iframe.addEventListener("load", wire);
    return () => iframe.removeEventListener("load", wire);
  }, [editHtml, preview, multiline, fields]);

  return (
    <section>
      <div className="flex items-end justify-between gap-4 border-b-2 border-rule pb-2">
        <div>
          <p className="eyebrow">{kind === "approved" ? "On approve" : "On reject"}</p>
          <h2 className="headline text-3xl">{kind === "approved" ? "Approved" : "Not approved"}</h2>
        </div>
        <TestSendButton kind={kind} email={adminEmail} />
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        {OUTSIDE.map((key) =>
          preview && key === "greetingNoName" ? null : (
            <label key={key} className="flex items-center gap-2">
              <span className="eyebrow w-28 shrink-0">{key === "subject" ? "Subject" : key === "preheader" ? "Inbox preview" : "Hi (no name)"}</span>
              {preview ? (
                <span className="truncate">{key === "subject" ? sent.subject : copy[key]}</span>
              ) : (
                <input
                  value={copy[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  maxLength={fields.find((f) => f.key === key)?.max}
                  className={cn(inputClass, "h-8 flex-1 min-w-0")}
                />
              )}
            </label>
          ),
        )}
      </div>

      <div className="mt-3 flex items-center gap-1 text-xs">
        {(["Edit", "Preview"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              // Back to editing: rebuild the editable email from the current text.
              if (mode === "Edit" && preview) setBase(copy);
              setPreview(mode === "Preview");
            }}
            className={cn(
              "h-7 px-2.5 rounded-sm border",
              preview === (mode === "Preview") ? "border-foreground bg-foreground text-background" : "border-input hover:border-foreground",
            )}
          >
            {mode}
          </button>
        ))}
        <span className="ml-2 text-muted-foreground">
          {preview ? "As the runner sees it." : "Click any dashed text to change it."}
        </span>
      </div>

      {preview ? (
        <iframe title={`${kind} email preview`} srcDoc={sent.html} sandbox="" className="mt-2 w-full h-[640px] border bg-white" />
      ) : (
        // allow-same-origin (no scripts) so this page can listen to edits inside the frame.
        <iframe
          key={editHtml}
          ref={frame}
          title={`${kind} email editor`}
          srcDoc={editHtml}
          sandbox="allow-same-origin"
          className="mt-2 w-full h-[640px] border bg-white"
        />
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        {Object.keys(PLACEHOLDERS[kind]).map((name, i) => (
          <span key={name}>{i > 0 && " "}<code className="time">{`{${name}}`}</code></span>
        ))}{" "}
        are filled in per runner. <code className="time">**bold**</code>, <code className="time">[text](https://…)</code>,
        blank line for a new paragraph. Empty optional text is left out.
      </p>

      <ActionForm action={updateEmailCopyAction} label="Save text" tone="primary" className="mt-3">
        <input type="hidden" name="kind" value={kind} />
        {fields.map((f) => (
          <input key={f.key} type="hidden" name={f.key} value={copy[f.key] ?? ""} />
        ))}
        {dirty && (
          <button type="button" onClick={() => reset(saved)} className="h-9 px-2 text-sm underline text-muted-foreground hover:text-foreground">
            Undo changes
          </button>
        )}
        {!isDefault && (
          <button type="button" onClick={() => reset(DEFAULT_COPY[kind])} className="h-9 px-2 text-sm underline text-muted-foreground hover:text-foreground">
            Restore default
          </button>
        )}
        {dirty && <span className="h-9 inline-flex items-center text-xs text-muted-foreground">Unsaved. Test sends use the saved text.</span>}
      </ActionForm>
    </section>
  );
}
