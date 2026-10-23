import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Locale } from "@/i18n/config"
import { formatDate, formatNumber } from "@/lib/format"

export { formatNumber }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "2026-09-27" -> "27 Sep 2026" / "27 сен 2026" / "27 қыр 2026". */
export function formatEventDate(date: string | null | undefined, locale: Locale): string | null {
  return formatDate(date?.slice(0, 10), locale, { day: true, month: "short", year: "numeric" })
}

