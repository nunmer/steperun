"use client";

import { useRouter } from "next/navigation";

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
  const router = useRouter();
  return (
    <select
      aria-label="All distances"
      className="h-8 rounded-full border border-border bg-background px-3 text-sm max-w-[16rem]"
      value={value && options.some((o) => o.label === value) ? value : ""}
      onChange={(e) => {
        const params = new URLSearchParams();
        if (e.target.value) params.set("distance", e.target.value);
        if (year) params.set("year", String(year));
        const qs = params.toString();
        router.push(qs ? `/rankings?${qs}` : "/rankings");
      }}
    >
      <option value="">More distances…</option>
      {options.map((o) => (
        <option key={o.label} value={o.label}>
          {o.label}
          {o.finishers ? ` (${o.finishers.toLocaleString()})` : ""}
        </option>
      ))}
    </select>
  );
}
