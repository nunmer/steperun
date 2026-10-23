"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/utils";

/** Dropdown with every ranked distance; navigates on change. */
export function DistanceSelect({
  options,
  value,
  year,
}: {
  options: { label: string; finishers: number | null }[];
  value?: string;
  year?: number;
}) {
  const t = useTranslations("common.distances");
  const locale = useLocale();
  const router = useRouter();
  return (
    <select
      aria-label={t("label")}
      className="h-7 rounded-sm border border-input bg-background px-2 text-sm text-muted-foreground max-w-[14rem]"
      value={value && options.some((o) => o.label === value) ? value : ""}
      onChange={(e) => {
        const params = new URLSearchParams();
        if (e.target.value) params.set("distance", e.target.value);
        if (year) params.set("year", String(year));
        const qs = params.toString();
        router.push(qs ? `/rankings?${qs}` : "/rankings");
      }}
    >
      <option value="">{t("more")}</option>
      {options.map((o) => (
        <option key={o.label} value={o.label}>
          {o.label}
          {o.finishers ? ` (${formatNumber(o.finishers, locale)})` : ""}
        </option>
      ))}
    </select>
  );
}
