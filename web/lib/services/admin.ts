import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabase-server";

/** Service-key client for admin-only reads and writes. */
export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

/**
 * The signed-in user if they are an admin (user_profiles.is_admin), else throws.
 * Kept out of "use server" files so it is never exposed as a server action.
 */
export async function assertAdmin(): Promise<User> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  const { data } = await adminClient().from("user_profiles").select("is_admin").eq("id", user.id).single();
  if (!data?.is_admin) throw new Error("Forbidden");
  return user;
}
