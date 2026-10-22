import { cache } from "react";
import { redirect } from "next/navigation";
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

/**
 * Page guard for /admin/*: the admin, or a redirect home. Every admin page calls
 * it (not only the layout), because a layout and its page render in parallel.
 * Cached per request, so the layout and page share one lookup.
 */
export const requireAdminPage = cache(async (): Promise<User> => {
  const admin = await assertAdmin().catch(() => null);
  if (!admin) redirect("/");
  return admin;
});

const AUTH_PAGE_SIZE = 1000;
const AUTH_MAX_PAGES = 20;

/**
 * Every auth user (id → email, last sign-in, provider). Supabase's admin API
 * pages at 1000; the site has far fewer users, so a few pages at most.
 */
export const getAuthUsers = cache(async (): Promise<Map<string, User>> => {
  const db = adminClient();
  const users = new Map<string, User>();
  for (let page = 1; page <= AUTH_MAX_PAGES; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE });
    if (error) throw new Error(`[admin] listUsers failed: ${error.message}`);
    for (const u of data.users) users.set(u.id, u);
    if (data.users.length < AUTH_PAGE_SIZE) break;
  }
  return users;
});
