"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import WelcomeClient from "./welcome-client";
import type { User } from "@supabase/supabase-js";

type RunnerMatch = { id: number; full_name: string; country: string | null; city: string | null };

async function runWelcomeFlow(
  user: User,
  router: ReturnType<typeof useRouter>,
  setMatches: (m: RunnerMatch[]) => void,
) {
  // Already has a claim — go straight to profile
  const claimsRes = await fetch("/api/claims/my");
  if (claimsRes.ok) {
    const claims: { status: string }[] = await claimsRes.json();
    if (claims.some((c) => c.status === "approved" || c.status === "pending")) {
      window.location.href = "/profile";
      return;
    }
  }

  const fullName = user.user_metadata?.full_name as string | undefined;
  if (!fullName) { window.location.href = "/profile"; return; }

  const res = await fetch(`/api/runners/match-name?name=${encodeURIComponent(fullName)}`);
  const runners: RunnerMatch[] = await res.json();

  if (!runners.length) { window.location.href = "/profile"; return; }
  setMatches(runners);
}

export default function WelcomePage() {
  const router = useRouter();
  const [matches, setMatches] = useState<RunnerMatch[] | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Use onAuthStateChange instead of getUser() so we wait for any
    // in-progress token refresh to complete before acting.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
        router.replace("/");
        return;
      }
      if (session) {
        subscription.unsubscribe();
        runWelcomeFlow(session.user, router, setMatches);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (!matches) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return <WelcomeClient matches={matches} />;
}
