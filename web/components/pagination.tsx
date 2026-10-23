import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";

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
  const t = useTranslations("common.pagination");
  const locale = useLocale();
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-2 border-t border-rule pt-1" aria-label={t("label")}>
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${edge} hover:text-primary`}>{t("prev")}</Link>
      ) : (
        <span className={`${edge} text-muted-foreground/50`} aria-hidden>{t("prev")}</span>
      )}
      <span className="time text-xs text-muted-foreground text-center">
        {formatNumber(page, locale)} / {formatNumber(totalPages, locale)}
        {label ? <span className="hidden sm:inline"> · {label}</span> : null}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className={`${edge} hover:text-primary`}>{t("next")}</Link>
      ) : (
        <span className={`${edge} text-muted-foreground/50`} aria-hidden>{t("next")}</span>
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
