/** Site languages. The UI says "KZ"; the ISO 639-1 code for Kazakh is kk. */
export const LOCALES = ["ru", "kk", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_LABELS: Record<Locale, string> = { ru: "RU", kk: "KZ", en: "EN" };
export const LOCALE_NAMES: Record<Locale, string> = { ru: "Русский", kk: "Қазақша", en: "English" };

/**
 * Message files per language: messages/<locale>/<namespace>.json. One file
 * per site area keeps them reviewable; add a namespace here and in all three folders.
 */
export const NAMESPACES = [
  "common", "home", "events", "rankings", "runners", "profile", "coins", "analyzer", "legal",
] as const;

/**
 * Namespaces sent to the browser (NextIntlClientProvider in app/layout.tsx).
 * Server components read every namespace; only add one here when a
 * "use client" component calls useTranslations on it, or it renders keys.
 */
export const CLIENT_NAMESPACES = ["common", "home", "runners", "profile", "coins", "analyzer"] as const;

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Best supported language from an Accept-Language header, else the default. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.split(";");
      const q = params.map((p) => /^\s*q\s*=\s*([\d.]+)\s*$/.exec(p)?.[1]).find(Boolean);
      return { lang: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((x) => x.lang).find(isLocale) ?? DEFAULT_LOCALE;
}
