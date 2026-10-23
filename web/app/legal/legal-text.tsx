import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format";
import { LEGAL_CONFIG } from "@/lib/legal-config";

/** Values the legal messages interpolate; all come from LEGAL_CONFIG. */
export const legalValues = {
  company: LEGAL_CONFIG.company,
  country: LEGAL_CONFIG.country,
  email: LEGAL_CONFIG.contactEmail,
};

/** Inline markup the legal messages use via t.rich. */
export const legalTags = {
  b: (chunks: ReactNode) => <strong>{chunks}</strong>,
  mail: (chunks: ReactNode) => <a href={`mailto:${LEGAL_CONFIG.contactEmail}`}>{chunks}</a>,
  terms: (chunks: ReactNode) => <a href="/legal/terms">{chunks}</a>,
  refund: (chunks: ReactNode) => <a href="/legal/refund">{chunks}</a>,
};

/** LEGAL_CONFIG.effectiveDate ("1 May 2026") in the visitor's language. */
function effectiveDate(locale: Locale): string {
  // Parsed as local midnight ("1 May 2026"), so read it back in the server's zone.
  const d = new Date(LEGAL_CONFIG.effectiveDate);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return formatDate(d, locale, { day: true, month: "long", year: "numeric", timeZone: tz }) ?? LEGAL_CONFIG.effectiveDate;
}

/** Page title, effective date and, in ru/kk, a note that the English text prevails. */
export async function LegalHeader({ title }: { title: string }) {
  const [t, locale] = await Promise.all([getTranslations("legal.common"), getLocale()]);
  return (
    <>
      <h1>{title}</h1>
      <p className="text-sm text-muted-foreground">{t("effective", { date: effectiveDate(locale) })}</p>
      {locale !== "en" && <p className="text-sm text-muted-foreground italic">{t("discrepancy")}</p>}
    </>
  );
}
