import Link from "next/link";
import { Button } from "@/components/ui/button";

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
    <nav className="flex items-center justify-between gap-2" aria-label="Pagination">
      {page > 1 ? (
        <Button asChild variant="outline">
          <Link href={href(page - 1)} rel="prev">← Previous</Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>← Previous</Button>
      )}
      <span className="text-sm text-muted-foreground text-center">
        Page {page.toLocaleString()} of {totalPages.toLocaleString()}
        {label ? ` (${label})` : ""}
      </span>
      {page < totalPages ? (
        <Button asChild variant="outline">
          <Link href={href(page + 1)} rel="next">Next →</Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>Next →</Button>
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
