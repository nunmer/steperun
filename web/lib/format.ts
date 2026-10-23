import type { Locale } from "@/i18n/config";

/*
 * Locale-aware dates and numbers that come out identical on the server and in
 * the browser. Chrome ships no Kazakh locale data, so Intl with "kk-KZ" gives
 * "171,523" and "2026 M09 27" in the browser but "171 523" and "27 қыр." in
 * Node, and every client component that formatted with it failed hydration.
 * Names come from the tables below; Intl is only used (in en-US, which every
 * runtime has) to read numeric date parts in a time zone.
 */

const NBSP = " ";

const MONTHS = {
  en: {
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    long: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
  ru: {
    short: ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
    // Without a day Russian uses the nominative: "май", "январь".
    shortAlone: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
    long: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  },
  kk: {
    short: ["қаң", "ақп", "нау", "сәу", "мам", "мау", "шіл", "там", "қыр", "қаз", "қар", "жел"],
    long: ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"],
  },
} as const;

/** Sunday first, like Date#getDay. */
const WEEKDAYS: Record<Locale, readonly string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ru: ["вс", "пн", "вт", "ср", "чт", "пт", "сб"],
  kk: ["жс", "дс", "сс", "ср", "бс", "жм", "сб"],
};

/** What to show; fields are printed in the language's usual order. */
export interface DateStyle {
  day?: boolean;
  /** Zero-pad the day ("06"), for fixed-width columns. */
  padDay?: boolean;
  month?: "short" | "long";
  year?: "numeric" | "2-digit";
  weekday?: boolean;
  time?: boolean;
  /** Defaults to UTC: race dates are calendar days. */
  timeZone?: string;
}

interface Parts { y: number; m: number; d: number; wd: number; hh: string; mm: string }

function partsOf(date: Date, timeZone: string): Parts {
  const get = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "numeric", day: "numeric", weekday: "short",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get.weekday);
  return { y: +get.year, m: +get.month - 1, d: +get.day, wd, hh: get.hour, mm: get.minute };
}

function toDate(input: string | Date): Date | null {
  // A bare "2026-09-27" is a calendar day: pin it to UTC midnight.
  const d = typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input) ? new Date(`${input}T00:00:00Z`) : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthName(locale: Locale, m: number, style: "short" | "long", withDay: boolean): string {
  if (locale === "ru" && style === "short" && !withDay) return MONTHS.ru.shortAlone[m];
  if (locale === "ru" && style === "long" && !withDay) {
    return ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"][m];
  }
  return MONTHS[locale][style][m];
}

/** "27 Sep 2026" · "27 сен 2026" · "27 қыр 2026", same output in Node and every browser. */
export function formatDate(input: string | Date | null | undefined, locale: Locale, style: DateStyle): string | null {
  if (!input) return null;
  const date = toDate(input);
  if (!date) return null;
  const p = partsOf(date, style.timeZone ?? "UTC");

  const out: string[] = [];
  if (style.weekday) out.push(WEEKDAYS[locale][p.wd] + (style.day || style.month ? "," : ""));
  if (style.day) out.push(style.padDay ? String(p.d).padStart(2, "0") : String(p.d));
  if (style.month) out.push(monthName(locale, p.m, style.month, !!style.day));
  if (style.year) {
    const y = style.year === "2-digit" ? `’${String(p.y).slice(2)}` : String(p.y);
    // Long Russian/Kazakh dates carry the year word: "2026 г." / "2026 ж."
    const suffix = style.month === "long" && style.year === "numeric" ? { ru: `${NBSP}г.`, kk: `${NBSP}ж.`, en: "" }[locale] : "";
    out.push(y + suffix);
  }
  if (style.time) out.push(`${p.hh}:${p.mm}`);
  return out.join(" ");
}

/** 171523 -> "171,523" (en) or "171 523" (ru, kk; no-break space). */
export function formatNumber(n: number, locale: Locale): string {
  const [int, frac] = Math.abs(n).toString().split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, locale === "en" ? "," : NBSP);
  const decimal = frac ? (locale === "en" ? "." : ",") + frac : "";
  return (n < 0 ? "-" : "") + grouped + decimal;
}
