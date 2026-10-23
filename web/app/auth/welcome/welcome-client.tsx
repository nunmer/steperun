"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type RunnerMatch = {
  id: number;
  full_name: string;
  country: string | null;
  city: string | null;
};

type ClaimState = "idle" | "loading" | "done" | "error";

export default function WelcomeClient({ matches }: { matches: RunnerMatch[] }) {
  const t = useTranslations("profile.welcome");
  const router = useRouter();
  const [claimStates, setClaimStates] = useState<Record<number, ClaimState>>({});
  const [claimMessages, setClaimMessages] = useState<Record<number, string>>({});

  async function handleClaim(runnerId: number) {
    setClaimStates((s) => ({ ...s, [runnerId]: "loading" }));
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runner_id: runnerId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setClaimStates((s) => ({ ...s, [runnerId]: "error" }));
        setClaimMessages((s) => ({ ...s, [runnerId]: json.error ?? t("failed") }));
        return;
      }
      setClaimStates((s) => ({ ...s, [runnerId]: "done" }));
    } catch {
      setClaimStates((s) => ({ ...s, [runnerId]: "error" }));
      setClaimMessages((s) => ({ ...s, [runnerId]: t("networkError") }));
    }
  }

  return (
    <div className="max-w-lg space-y-6 py-4">
      <div>
        <h1 className="headline text-5xl">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("intro", { count: matches.length })}
        </p>
      </div>

      <div className="space-y-3">
        {matches.map((runner) => {
          const state = claimStates[runner.id] ?? "idle";
          const msg = claimMessages[runner.id];
          const claimed = state === "done";

          return (
            <Card key={runner.id}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/runners/${runner.id}`} className="font-semibold hover:underline truncate block">
                    {runner.full_name}
                  </Link>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {runner.country && <Badge variant="secondary">{runner.country}</Badge>}
                    {runner.city && <Badge variant="outline">{runner.city}</Badge>}
                  </div>
                  {msg && (
                    <p className={`text-xs mt-1 ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                      {msg}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {claimed ? (
                    <>
                      <Badge variant="secondary">{t("claimed")}</Badge>
                      <Link href="/profile">
                        <Button size="sm" variant="outline">{t("viewProfile")}</Button>
                      </Link>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => handleClaim(runner.id)} disabled={state === "loading"}>
                      {state === "loading" ? t("claiming") : t("claim")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <button onClick={() => router.replace("/profile")} className="text-sm text-muted-foreground hover:text-foreground">
        {t("noneMe")}
      </button>
    </div>
  );
}
