import { adminClient } from "@/lib/services/admin";

/** user id → display name for the given ids (one query). */
export async function displayNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (!unique.length) return new Map();
  const { data, error } = await adminClient().from("user_profiles").select("id, display_name").in("id", unique);
  if (error) throw new Error(`[admin] display names failed: ${error.message}`);
  return new Map((data ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? ""]));
}
