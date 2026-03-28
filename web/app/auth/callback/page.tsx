"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

// This page handles both PKCE (code in query params) and implicit flow (tokens in hash).
// The browser Supabase client detects both automatically and fires SIGNED_IN.
export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.replace("/auth/welcome");
      }
    });

    // Also handle already-signed-in case (e.g. session already in cookie)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/auth/welcome");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground text-sm">
      Signing you in…
    </div>
  );
}
