import Link from "next/link";

const edge = "time text-sm py-2";

/**
 * Previous / Next pager. Links are omitted (not just styled) at the edges, so
 * there is never a link to page 0 or past the last page.
 */
export function Pagination({
  page,
  totalPages,
  href,
  label,
}: {
  page: number;
  totalPages: number;
  href: (page: number) => string;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-2 border-t border-rule pt-1" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${edge} hover:text-primary`}>← Prev</Link>
      ) : (
        <span className={`${edge} text-muted-foreground/50`} aria-hidden>← Prev</span>
      )}
      <span className="time text-xs text-muted-foreground text-center">
        {page.toLocaleString()} / {totalPages.toLocaleString()}
        {label ? <span className="hidden sm:inline"> · {label}</span> : null}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className={`${edge} hover:text-primary`}>Next →</Link>
      ) : (
        <span className={`${edge} text-muted-foreground/50`} aria-hidden>Next →</span>
      )}
    </nav>
  );
}

/** Build "/path?a=1&b=2" from a params object, dropping empty values and page=1. */
export function buildHref(path: string, params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || (k === "page" && Number(v) === 1)) continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}
