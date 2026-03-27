"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
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

export default function AuthCallbackPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<RunnerMatch[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "no_match">("loading");
  const [claimStates, setClaimStates] = useState<Record<number, ClaimState>>({});
  const [claimMessages, setClaimMessages] = useState<Record<number, string>>({});

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function run() {
      // Wait for session (Supabase sets it from the URL hash/code)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const fullName = user.user_metadata?.full_name as string | undefined;
      if (!fullName) {
        router.replace("/");
        return;
      }

      const res = await fetch(`/api/runners/match-name?name=${encodeURIComponent(fullName)}`);
      const runners: RunnerMatch[] = await res.json();

      if (runners.length === 0) {
        router.replace("/");
        return;
      }

      setMatches(runners);
      setStatus("ready");
    }

    run();
  }, [router]);

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
        setClaimMessages((s) => ({ ...s, [runnerId]: json.error ?? "Failed" }));
        return;
      }
      setClaimStates((s) => ({ ...s, [runnerId]: "done" }));
      setClaimMessages((s) => ({
        ...s,
        [runnerId]: json.autoApproved ? "Claimed!" : "Submitted for review",
      }));
    } catch {
      setClaimStates((s) => ({ ...s, [runnerId]: "error" }));
      setClaimMessages((s) => ({ ...s, [runnerId]: "Network error" }));
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground text-sm">
        Signing you in…
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 py-12 px-4">
      <div>
        <h1 className="text-2xl font-bold">Is this your profile?</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          We found {matches.length === 1 ? "a runner" : "runners"} matching your name. Claim your profile to own your race history.
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
                  <Link
                    href={`/runners/${runner.id}`}
                    className="font-semibold hover:underline truncate block"
                  >
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
                      <Badge variant="secondary">Claimed ✓</Badge>
                      <Link href="/profile">
                        <Button size="sm" variant="outline">View profile →</Button>
                      </Link>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleClaim(runner.id)}
                      disabled={state === "loading"}
                    >
                      {state === "loading" ? "Claiming…" : "Claim"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <button
        onClick={() => router.replace("/")}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        None of these are me →
      </button>
    </div>
  );
}
