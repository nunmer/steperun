import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./supabase";

/**
 * Creates a Supabase client that reads the session from cookies.
 * Use in API routes and Server Components.
 * Uses the anon key so RLS policies apply.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently ignore — cookies can't be set in Server Components,
            // only in Route Handlers / Server Actions. Reads still work.
          }
        },
      },
    }
  );
}

/**
 * Returns the authenticated user from the session cookie, or null.
 */
export async function getAuthUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}
