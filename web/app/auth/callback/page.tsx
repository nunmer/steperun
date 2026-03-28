"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function CallbackPage() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let redirected = false;

    function goToWelcome() {
      if (!redirected) {
        redirected = true;
        window.location.href = "/auth/welcome";
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only SIGNED_IN fires after a fresh code exchange — INITIAL_SESSION
      // fires immediately on mount with any existing (possibly stale) session.
      if (event === "SIGNED_IN" && session) {
        goToWelcome();
      }
    });

    // Fallback: if SIGNED_IN doesn't fire within 5s, check for a fresh session.
    // We only redirect if the session was issued recently (not a stale leftover).
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const issuedAt = session?.user?.last_sign_in_at
        ? new Date(session.user.last_sign_in_at).getTime()
        : 0;
      const isFresh = Date.now() - issuedAt < 5 * 60 * 1000; // within 5 minutes
      if (session && isFresh) goToWelcome();
    }, 5000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground text-sm">
      Signing you in…
    </div>
  );
}
