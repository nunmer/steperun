/** Positive integer page number from a search param; anything invalid → 1. */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Integer within [min, max] from a search param, else undefined. */
export function parseIntInRange(raw: string | undefined, min: number, max: number): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

/** "--:--:--", "", null → not a real finish time. */
export function isFinishTime(t: string | null | undefined): t is string {
  return !!t && /^\d{1,3}:\d{2}(:\d{2})?(\.\d+)?$/.test(t);
}

/** "HH:MM:SS[.f]" or "MM:SS" → seconds; Infinity when not a finish time. */
export function timeToSeconds(t: string | null | undefined): number {
  if (!isFinishTime(t)) return Infinity;
  const parts = t.split(":").map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}
