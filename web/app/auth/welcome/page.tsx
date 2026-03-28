"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import WelcomeClient from "./welcome-client";

type RunnerMatch = { id: number; full_name: string; country: string | null; city: string | null };

export default function WelcomePage() {
  const router = useRouter();
  const [matches, setMatches] = useState<RunnerMatch[] | null>(null);

  useEffect(() => {
    async function run() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      // Already has a claim — go straight to profile
      const claimsRes = await fetch("/api/claims/my");
      if (claimsRes.ok) {
        const claims: { status: string }[] = await claimsRes.json();
        if (claims.some((c) => c.status === "approved" || c.status === "pending")) {
          router.replace("/profile");
          return;
        }
      }

      const fullName = user.user_metadata?.full_name as string | undefined;
      if (!fullName) { router.replace("/profile"); return; }

      const res = await fetch(`/api/runners/match-name?name=${encodeURIComponent(fullName)}`);
      const runners: RunnerMatch[] = await res.json();

      if (!runners.length) { router.replace("/profile"); return; }
      setMatches(runners);
    }
    run();
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
