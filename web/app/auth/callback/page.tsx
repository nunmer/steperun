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
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        goToWelcome();
      }
    });

    // Fallback: if auth events don't fire within 3s, check manually.
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) goToWelcome();
    }, 3000);

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
