"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Rendered when the server couldn't read the session (e.g. cookies were still
 * being written mid-refresh). Checks auth client-side and either reloads the
 * page (so the server gets fresh cookies) or redirects to / if truly logged out.
 */
export function ProfileAuthGate() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Session found client-side — hard reload so the server can read it.
        window.location.reload();
      } else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        router.replace("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground text-sm">
      Loading…
    </div>
  );
}
