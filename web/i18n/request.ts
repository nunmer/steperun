import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, NAMESPACES, negotiateLocale, type Locale } from "./config";

/*
 * No locale in the URL: the language comes from the NEXT_LOCALE cookie (set
 * by the switcher in the nav), else the browser's Accept-Language, else Russian.
 */

async function requestLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return negotiateLocale((await headers()).get("accept-language"));
}

type Messages = { [key: string]: string | Messages };

async function loadMessages(locale: Locale): Promise<Messages> {
  const files = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../messages/${locale}/${ns}.json`)).default as Messages] as const),
  );
  return Object.fromEntries(files);
}

/** `over` on top of `base`, recursively; returns a new object. */
function withFallback(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    out[k] = typeof v === "object" && typeof b === "object" ? withFallback(b, v) : v;
  }
  return out;
}

export default getRequestConfig(async () => {
  const locale = await requestLocale();
  return {
    locale,
    // A key missing in kk/en shows the Russian text rather than the key path.
    messages: locale === DEFAULT_LOCALE
      ? await loadMessages(locale)
      : withFallback(await loadMessages(DEFAULT_LOCALE), await loadMessages(locale)),
    timeZone: "Asia/Almaty",
  };
});
