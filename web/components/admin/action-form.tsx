"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormAction } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

type Tone = "primary" | "outline" | "danger" | "positive";

const TONES: Record<Tone, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  positive: "bg-positive text-white hover:opacity-90",
  outline: "border border-foreground hover:bg-foreground hover:text-background",
  danger: "border border-destructive/40 text-destructive hover:bg-destructive hover:text-white",
};

const ARM_MS = 4000;

interface ActionFormProps {
  action: FormAction;
  label: string;
  tone?: Tone;
  /** Ask for a second click before submitting (no browser dialog). */
  confirm?: string;
  /** Hidden inputs and fields rendered before the button. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * A form bound to an admin server action: shows pending state and the
 * action's message, and optionally arms on the first click and submits on
 * the second (for destructive actions).
 */
export function ActionForm({ action, label, tone = "outline", confirm, children, className }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm || armed) {
      setArmed(false);
      return;
    }
    e.preventDefault();
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), ARM_MS);
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className={cn("flex flex-wrap items-end gap-2", className)}>
      {children}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "h-9 px-3 rounded-sm text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50",
          armed ? TONES.danger + " bg-destructive text-white" : TONES[tone],
        )}
      >
        {pending ? "Working…" : armed ? confirm : label}
      </button>
      {state && (
        <p role="status" className={cn("basis-full text-xs", state.ok ? "text-positive" : "text-destructive")}>
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Labelled form field for admin forms. */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-9 rounded-sm border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-foreground";
