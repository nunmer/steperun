/**
 * Strava activity ↔ race result matching — pure functions, no I/O.
 */

export interface RunnerResult {
  event_date: string | null;   // ISO date string from events.date_of_event
  distance_category: string;   // e.g. "42 км 195 м", "10 км", "полумарафон"
  chip_time: string;           // "HH:MM:SS"
}

export interface StravaActivity {
  id: number;
  start_date_local: string;    // ISO date-time
  distance: number;            // metres
  moving_time: number;         // seconds
  type: string;                // "Run", "Ride", etc.
}

export interface MatchResult {
  activity_id: number;
  confidence: number;          // 0–1
  dist_deviation: number;      // fractional, e.g. 0.01 = 1%
  time_deviation: number;      // fractional
  points: number;              // trust points earned from this match
}

// Canonical distances in metres
const DISTANCE_MAP: Record<string, number> = {
  "42 км 195 м":   42_195,
  "42 км":         42_195,
  "марафон":       42_195,
  "21 км 97,5 м":  21_097.5,
  "21 км":         21_097.5,
  "полумарафон":   21_097.5,
  "10 км":         10_000,
  "10 км 680 м":   10_680,
  "5 км":           5_000,
  "3 км":           3_000,
};

export function canonicalDistance(category: string): number | null {
  const lower = category.toLowerCase().trim();
  for (const [key, metres] of Object.entries(DISTANCE_MAP)) {
    if (lower.includes(key.toLowerCase())) return metres;
  }
  // Generic numeric extraction: "15 км" → 15000
  const m = lower.match(/(\d+(?:[.,]\d+)?)\s*км/);
  if (m) return parseFloat(m[1].replace(",", ".")) * 1000;
  return null;
}

function chipTimeToSeconds(chipTime: string): number {
  const parts = chipTime.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/**
 * Find the best-matching Strava activity for a single race result.
 * Returns null if no activity meets the confidence threshold.
 */
export function matchActivity(
  result: RunnerResult,
  activities: StravaActivity[]
): MatchResult | null {
  const canonical = canonicalDistance(result.distance_category);
  if (!canonical) return null;

  const chipSeconds = chipTimeToSeconds(result.chip_time);
  if (!chipSeconds) return null;

  const eventDate = result.event_date ? new Date(result.event_date) : null;

  let best: MatchResult | null = null;

  for (const act of activities) {
    if (act.type !== "Run" && act.type !== "VirtualRun") continue;

    // Date filter: within ±3 days of event
    if (eventDate) {
      const actDate = new Date(act.start_date_local);
      const diffDays = Math.abs((actDate.getTime() - eventDate.getTime()) / 86_400_000);
      if (diffDays > 3) continue;
    }

    const distDeviation = Math.abs(act.distance - canonical) / canonical;
    if (distDeviation > 0.02) continue;  // must be within 2%

    const timeDeviation = Math.abs(act.moving_time - chipSeconds) / chipSeconds;
    if (timeDeviation > 0.10) continue;  // skip if >10% apart

    const confidence = 1.0 - 10 * (distDeviation + timeDeviation);
    if (confidence < 0.8) continue;

    if (!best || confidence > best.confidence) {
      best = {
        activity_id: act.id,
        confidence,
        dist_deviation: distDeviation,
        time_deviation: timeDeviation,
        points: 0, // calculated below
      };
    }
  }

  if (!best || !eventDate) return best;

  // Score points
  let points = 30; // race_match baseline
  const actDate = new Date(
    activities.find((a) => a.id === best!.activity_id)!.start_date_local
  );
  const diffDays = Math.abs((actDate.getTime() - eventDate.getTime()) / 86_400_000);
  if (diffDays <= 2) points += 20; // date_match

  best.points = points;
  return best;
}

/**
 * Check if the athlete has ≥3 running activities in the 6 weeks before the event.
 */
export function hasTrainingHistory(
  eventDate: string | null,
  activities: StravaActivity[]
): boolean {
  if (!eventDate) return false;
  const event = new Date(eventDate);
  const sixWeeksBeforeMs = 6 * 7 * 86_400_000;
  const threshold = new Date(event.getTime() - sixWeeksBeforeMs);

  const trainingRuns = activities.filter((a) => {
    if (a.type !== "Run" && a.type !== "VirtualRun") return false;
    const d = new Date(a.start_date_local);
    return d >= threshold && d < event;
  });

  return trainingRuns.length >= 3;
}

/**
 * Returns true if a Strava activity was found but confidence was too low (mismatch signal).
 */
export function hasStravaMismatch(
  result: RunnerResult,
  activities: StravaActivity[]
): boolean {
  const canonical = canonicalDistance(result.distance_category);
  if (!canonical) return false;

  const chipSeconds = chipTimeToSeconds(result.chip_time);
  if (!chipSeconds) return false;

  const eventDate = result.event_date ? new Date(result.event_date) : null;

  for (const act of activities) {
    if (act.type !== "Run" && act.type !== "VirtualRun") continue;
    if (eventDate) {
      const actDate = new Date(act.start_date_local);
      const diffDays = Math.abs((actDate.getTime() - eventDate.getTime()) / 86_400_000);
      if (diffDays > 3) continue;
    }
    const distDeviation = Math.abs(act.distance - canonical) / canonical;
    if (distDeviation > 0.02) continue;
    const timeDeviation = Math.abs(act.moving_time - chipSeconds) / chipSeconds;
    if (timeDeviation > 0.10) return true; // found but too far off
  }

  return false;
}
