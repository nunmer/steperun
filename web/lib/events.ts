import type { EventRow } from "./queries";

/** Events grouped by year, newest first; events without a year go last under "Other". */
export function groupByYear(events: EventRow[]): { label: string; events: EventRow[] }[] {
  const byYear = new Map<number | null, EventRow[]>();
  for (const e of events) {
    const list = byYear.get(e.year) ?? [];
    list.push(e);
    byYear.set(e.year, list);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => (b ?? -Infinity) - (a ?? -Infinity))
    .map(([year, list]) => ({ label: year === null ? "Other" : String(year), events: list }));
}
