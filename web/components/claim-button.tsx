"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface ClaimButtonProps {
  runnerId: number;
  claimedBy: string | null;  // UUID of the user who claimed, or null
}

export function ClaimButton({ runnerId, claimedBy }: ClaimButtonProps) {
  const t = useTranslations("runners.claim");
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Owner of this profile
  if (claimedBy && userId && claimedBy === userId) {
    return (
      <Link href="/profile">
        <Badge variant="secondary" className="text-xs cursor-pointer hover:opacity-80">
          {t("yours")}
        </Badge>
      </Link>
    );
  }

  // Claimed by someone else
  if (claimedBy) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        {t("claimed")}
      </Badge>
    );
  }

  // Successfully claimed just now
  if (status === "done") {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">{t("claimedNow")}</Badge>
        <Link href="/profile" className="text-xs text-muted-foreground hover:text-foreground underline">
          {t("viewProfile")}
        </Link>
      </div>
    );
  }

  // Not signed in — no button
  if (userId === null && claimedBy === null) {
    return null;
  }

  async function handleClaim() {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runner_id: runnerId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(json.error ?? t("failed"));
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage(t("network"));
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClaim}
        disabled={status === "loading"}
      >
        {status === "loading" ? t("submitting") : t("claim")}
      </Button>
      {status === "error" && message && (
        <span className="text-xs text-destructive">{message}</span>
      )}
    </div>
  );
}
