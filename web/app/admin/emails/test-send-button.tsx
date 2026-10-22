"use client";

import { useState, useTransition } from "react";
import { sendTestEmailAction } from "./actions";
import type { SampleKind } from "@/lib/email/samples";

/** Sends one sample to the signed-in admin only; asks first, shows the result. */
export function TestSendButton({ kind, email }: { kind: SampleKind; email: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="text-right">
      <button
        disabled={pending || !email}
        onClick={() => start(async () => setResult(await sendTestEmailAction(kind)))}
        className="h-9 px-3 rounded-sm border border-foreground text-sm font-medium whitespace-nowrap hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send a test to me"}
      </button>
      <p className="time text-[11px] text-muted-foreground mt-1">to {email || "—"}</p>
      {result && (
        <p className={`text-xs mt-1 ${result.ok ? "text-positive" : "text-destructive"}`}>{result.message}</p>
      )}
    </div>
  );
}
