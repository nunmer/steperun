/** `base?k=v&…` dropping empty values, for admin filter and pagination links. */
export function adminHref(base: string, params: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && !(k === "page" && v === 1)) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

/** Escape LIKE wildcards in admin search input. */
export function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export const ADMIN_PAGE_SIZE = 30;

/** [from, to] for Supabase .range() on a 1-based page. */
export function pageRange(page: number, size = ADMIN_PAGE_SIZE): [number, number] {
  return [(page - 1) * size, page * size - 1];
}
