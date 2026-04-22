import type { StravaActivity } from "./strava";

// ---------------------------------------------------------------------------
// Running-only filter
// ---------------------------------------------------------------------------

export function isRun(a: StravaActivity): boolean {
  return a.type === "Run" || a.type === "TrailRun";
}

// ---------------------------------------------------------------------------
// Training load model (CTL / ATL / TSB — intervals.icu style)
//
//   load(today) = suffer_score if present, else duration-based fallback
//   CTL(today)  = CTL(yesterday) + (load - CTL(yesterday)) / 42       (Fitness)
//   ATL(today)  = ATL(yesterday) + (load - ATL(yesterday)) /  7       (Fatigue)
//   TSB(today)  = CTL(yesterday) - ATL(yesterday)                     (Form)
// ---------------------------------------------------------------------------

const CTL_TC = 42;
const ATL_TC = 7;

function activityLoad(a: StravaActivity): number {
  if (typeof a.suffer_score === "number" && a.suffer_score > 0) return a.suffer_score;
  // Fallback: minutes × intensity(heuristic).
  // Lacking HR/power, assume moderate intensity: 1 min = 0.8 load units.
  return (a.moving_time / 60) * 0.8;
}

function dateKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD in local date (Strava gives local ISO)
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface TrainingLoadPoint {
  date:    string;   // YYYY-MM-DD
  load:    number;
  ctl:     number;
  atl:     number;
  tsb:     number;
}

export interface TrainingLoadSummary {
  ctl:     number;   // Fitness today
  atl:     number;   // Fatigue today
  tsb:     number;   // Form today (= yesterday CTL - yesterday ATL)
  ramp7:   number;   // CTL delta over last 7 days
  daily:   TrainingLoadPoint[];
}

export function computeTrainingLoad(
  activities: StravaActivity[],
  days: number = 90,
): TrainingLoadSummary {
  const runs = activities.filter(isRun);

  // Sum loads per day
  const loadByDay = new Map<string, number>();
  for (const a of runs) {
    const key = dateKey(a.start_date_local);
    loadByDay.set(key, (loadByDay.get(key) ?? 0) + activityLoad(a));
  }

  // Build contiguous daily series ending today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = addDays(today, -(days - 1));

  const daily: TrainingLoadPoint[] = [];
  let ctl = 0;
  let atl = 0;
  let prevCtl = 0;
  let prevAtl = 0;

  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const key = toDateKey(d);
    const load = loadByDay.get(key) ?? 0;

    prevCtl = ctl;
    prevAtl = atl;
    ctl = prevCtl + (load - prevCtl) / CTL_TC;
    atl = prevAtl + (load - prevAtl) / ATL_TC;
    const tsb = prevCtl - prevAtl;

    daily.push({ date: key, load, ctl, atl, tsb });
  }

  const last = daily[daily.length - 1];
  const weekAgo = daily[Math.max(0, daily.length - 8)];

  return {
    ctl:   last.ctl,
    atl:   last.atl,
    tsb:   last.ctl - last.atl,
    ramp7: last.ctl - (weekAgo?.ctl ?? 0),
    daily,
  };
}

export function formInterpretation(tsb: number): {
  label: string;
  tone:  "fresh" | "neutral" | "tired" | "overreaching" | "detrained";
  hint:  string;
} {
  if (tsb >  25) return { label: "Detraining risk",  tone: "detrained",    hint: "Too much rest — load up before fitness drops" };
  if (tsb >  10) return { label: "Fresh",            tone: "fresh",        hint: "Good day for intervals or a race" };
  if (tsb >  -5) return { label: "Neutral",          tone: "neutral",      hint: "Balanced — steady training recommended" };
  if (tsb > -20) return { label: "Fatigued",         tone: "tired",        hint: "Easy runs and recovery" };
  return            { label: "Very fatigued",     tone: "overreaching", hint: "Take 1–2 rest days" };
}

// ---------------------------------------------------------------------------
// Weekly summary — last N weeks ending this Monday
// ---------------------------------------------------------------------------

export interface WeeklyBucket {
  weekStart:  string;       // YYYY-MM-DD (Monday)
  count:      number;
  distance:   number;       // km
  time:       number;       // seconds
  elevation:  number;       // metres
  load:       number;       // sum of per-activity load
  avgPace:    number | null;// seconds per km
}

function mondayOf(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1 - day);
  out.setDate(out.getDate() + diff);
  return out;
}

export function computeWeekly(activities: StravaActivity[], weeks: number = 12): WeeklyBucket[] {
  const runs = activities.filter(isRun);
  const thisMonday = mondayOf(new Date());

  const buckets: WeeklyBucket[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(thisMonday, -w * 7);
    buckets.push({
      weekStart: toDateKey(start),
      count: 0, distance: 0, time: 0, elevation: 0, load: 0, avgPace: null,
    });
  }
  const idxByKey = new Map(buckets.map((b, i) => [b.weekStart, i]));

  for (const a of runs) {
    const d = new Date(a.start_date_local);
    const wStart = mondayOf(d);
    const key = toDateKey(wStart);
    const idx = idxByKey.get(key);
    if (idx === undefined) continue;
    const b = buckets[idx];
    b.count     += 1;
    b.distance  += a.distance / 1000;
    b.time      += a.moving_time;
    b.elevation += a.total_elevation_gain ?? 0;
    b.load      += activityLoad(a);
  }

  for (const b of buckets) {
    b.avgPace = b.distance > 0 ? b.time / b.distance : null;
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// HR zones (5-zone model, % of max HR)
//   Z1: 50-60% (recovery)
//   Z2: 60-70% (endurance)
//   Z3: 70-80% (tempo)
//   Z4: 80-90% (threshold)
//   Z5: 90-100% (VO2max)
//
// maxHr: user-provided, else max seen in activities, else age-assumed 190.
// Allocated per activity by avg_heartrate bucket (we don't have streams).
// ---------------------------------------------------------------------------

export interface HrZone {
  zone: 1 | 2 | 3 | 4 | 5;
  seconds: number;
  pct: number;
}

export function computeHrZones(activities: StravaActivity[], maxHr?: number): HrZone[] | null {
  const withHr = activities.filter((a) => isRun(a) && a.has_heartrate && a.average_heartrate);
  if (withHr.length === 0) return null;

  const hrMax = maxHr
    ?? Math.max(...withHr.map((a) => a.max_heartrate ?? a.average_heartrate ?? 0))
    ?? 190;

  const zones: HrZone[] = [1, 2, 3, 4, 5].map((z) => ({
    zone: z as HrZone["zone"],
    seconds: 0,
    pct: 0,
  }));

  for (const a of withHr) {
    const pctMax = (a.average_heartrate! / hrMax) * 100;
    let z: HrZone["zone"];
    if (pctMax < 60)       z = 1;
    else if (pctMax < 70)  z = 2;
    else if (pctMax < 80)  z = 3;
    else if (pctMax < 90)  z = 4;
    else                   z = 5;
    zones[z - 1].seconds += a.moving_time;
  }

  const total = zones.reduce((s, z) => s + z.seconds, 0);
  if (total === 0) return null;
  for (const z of zones) z.pct = (z.seconds / total) * 100;
  return zones;
}

// ---------------------------------------------------------------------------
// Best efforts by standard distance
// (Naive: picks activity whose total distance is close to target and reports
//  pace. Real PBs need stream data — this is a good-enough first pass.)
// ---------------------------------------------------------------------------

export interface BestEffort {
  label:    string;      // "5K", "10K", "Half", "Marathon"
  distance: number;      // metres target
  pace:     number | null; // s/km of best
  activityId: number | null;
  date:     string | null;
  totalTime: number | null; // seconds at that pace × distance
}

const PB_TARGETS: { label: string; distance: number; tolerance: number }[] = [
  { label: "5K",       distance: 5_000,  tolerance: 300  },
  { label: "10K",      distance: 10_000, tolerance: 600  },
  { label: "Half",     distance: 21_097, tolerance: 800  },
  { label: "Marathon", distance: 42_195, tolerance: 1500 },
];

export function computeBestEfforts(activities: StravaActivity[]): BestEffort[] {
  const runs = activities.filter(isRun);
  return PB_TARGETS.map(({ label, distance, tolerance }) => {
    const candidates = runs.filter(
      (a) => Math.abs(a.distance - distance) <= tolerance && a.moving_time > 0,
    );
    if (candidates.length === 0) {
      return { label, distance, pace: null, activityId: null, date: null, totalTime: null };
    }
    let best = candidates[0];
    let bestPace = best.moving_time / (best.distance / 1000);
    for (const c of candidates) {
      const pace = c.moving_time / (c.distance / 1000);
      if (pace < bestPace) { best = c; bestPace = pace; }
    }
    return {
      label,
      distance,
      pace: bestPace,
      activityId: best.id,
      date: best.start_date_local.slice(0, 10),
      totalTime: bestPace * (distance / 1000),
    };
  });
}

// ---------------------------------------------------------------------------
// Training rhythm — days active per week (last 4 weeks)
// ---------------------------------------------------------------------------

export function computeConsistency(activities: StravaActivity[], weeks: number = 4): {
  daysActive: number;
  possibleDays: number;
  streakDays: number;
} {
  const runs = activities.filter(isRun);
  const days = new Set<string>();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const cutoff = addDays(now, -weeks * 7);

  for (const a of runs) {
    const d = new Date(a.start_date_local);
    if (d >= cutoff) days.add(dateKey(a.start_date_local));
  }

  // Current streak (consecutive days ending today or yesterday)
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const d = addDays(now, -i);
    if (days.has(toDateKey(d))) streak += 1;
    else if (i > 0) break;
  }

  return {
    daysActive:   days.size,
    possibleDays: weeks * 7,
    streakDays:   streak,
  };
}

// ---------------------------------------------------------------------------
// Monthly summary — last N calendar months
// ---------------------------------------------------------------------------

export interface MonthlyBucket {
  key:       string;   // YYYY-MM
  label:     string;   // "Apr"
  year:      number;
  count:     number;
  distance:  number;   // km
  time:      number;   // seconds
  elevation: number;   // metres
  load:      number;
  avgPace:   number | null; // s/km
}

export function computeMonthly(activities: StravaActivity[], months: number = 6): MonthlyBucket[] {
  const runs = activities.filter(isRun);
  const now = new Date();
  const buckets: MonthlyBucket[] = [];
  for (let m = months - 1; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    buckets.push({
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString(undefined, { month: "short" }),
      year:  d.getFullYear(),
      count: 0, distance: 0, time: 0, elevation: 0, load: 0, avgPace: null,
    });
  }
  const idxByKey = new Map(buckets.map((b, i) => [b.key, i]));

  for (const a of runs) {
    const key = a.start_date_local.slice(0, 7); // YYYY-MM
    const idx = idxByKey.get(key);
    if (idx === undefined) continue;
    const b = buckets[idx];
    b.count     += 1;
    b.distance  += a.distance / 1000;
    b.time      += a.moving_time;
    b.elevation += a.total_elevation_gain ?? 0;
    b.load      += activityLoad(a);
  }
  for (const b of buckets) {
    b.avgPace = b.distance > 0 ? b.time / b.distance : null;
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Day-of-week distribution — total km & avg load per weekday (last N weeks)
// ---------------------------------------------------------------------------

export interface DowBucket {
  dow:       number;   // 0=Mon .. 6=Sun
  label:     string;
  count:     number;
  distance:  number;   // km
  load:      number;
}

export function computeDayOfWeek(activities: StravaActivity[], weeks: number = 12): DowBucket[] {
  const runs = activities.filter(isRun);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const cutoff = addDays(now, -weeks * 7);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const buckets: DowBucket[] = labels.map((label, dow) => ({
    dow, label, count: 0, distance: 0, load: 0,
  }));

  for (const a of runs) {
    const d = new Date(a.start_date_local);
    if (d < cutoff) continue;
    const js = d.getDay();         // 0=Sun..6=Sat
    const idx = js === 0 ? 6 : js - 1;
    buckets[idx].count    += 1;
    buckets[idx].distance += a.distance / 1000;
    buckets[idx].load     += activityLoad(a);
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Distance histogram — count runs in short / medium / long / very-long bands
// ---------------------------------------------------------------------------

export interface DistanceBand {
  label:    string;
  minKm:    number;
  maxKm:    number;  // exclusive, Infinity allowed
  count:    number;
  distance: number;  // total km in band
}

const DISTANCE_BANDS_TPL: Pick<DistanceBand, "label" | "minKm" | "maxKm">[] = [
  { label: "<5 km",    minKm: 0,  maxKm: 5 },
  { label: "5–10",     minKm: 5,  maxKm: 10 },
  { label: "10–15",    minKm: 10, maxKm: 15 },
  { label: "15–21",    minKm: 15, maxKm: 21 },
  { label: "21+",      minKm: 21, maxKm: Infinity },
];

export function computeDistanceHistogram(activities: StravaActivity[]): DistanceBand[] {
  const runs = activities.filter(isRun);
  const bands: DistanceBand[] = DISTANCE_BANDS_TPL.map((b) => ({ ...b, count: 0, distance: 0 }));
  for (const a of runs) {
    const km = a.distance / 1000;
    const band = bands.find((b) => km >= b.minKm && km < b.maxKm);
    if (!band) continue;
    band.count    += 1;
    band.distance += km;
  }
  return bands;
}

// ---------------------------------------------------------------------------
// Pace trend — weekly avg pace over last N weeks (mirrors computeWeekly)
// Returns array aligned with computeWeekly buckets.
// ---------------------------------------------------------------------------

export interface PaceTrendPoint {
  weekStart: string;
  avgPace:   number | null; // s/km
}

export function computePaceTrend(buckets: WeeklyBucket[]): PaceTrendPoint[] {
  return buckets.map((b) => ({ weekStart: b.weekStart, avgPace: b.avgPace }));
}

// ---------------------------------------------------------------------------
// Predicted race times — Riegel formula T2 = T1 * (D2/D1)^1.06
// Uses the user's best-available effort as the reference.
// ---------------------------------------------------------------------------

export interface PredictedRace {
  label:    string;
  distance: number;   // metres
  seconds:  number | null;
  sourceLabel: string | null; // e.g. "projected from your 10K PR"
}

const RACE_TARGETS: { label: string; distance: number }[] = [
  { label: "5K",       distance: 5_000 },
  { label: "10K",      distance: 10_000 },
  { label: "Half",     distance: 21_097 },
  { label: "Marathon", distance: 42_195 },
];

export function computePredictedRaces(bests: BestEffort[]): PredictedRace[] {
  const available = bests.filter((b) => b.pace !== null && b.totalTime !== null);
  if (available.length === 0) {
    return RACE_TARGETS.map((r) => ({ ...r, seconds: null, sourceLabel: null }));
  }
  // Prefer longer references (more reliable for predictions) but within reason.
  const ref = available.reduce((best, cur) => (cur.distance > best.distance ? cur : best), available[0]);

  return RACE_TARGETS.map(({ label, distance }) => {
    if (ref.distance === distance) {
      return { label, distance, seconds: ref.totalTime, sourceLabel: "your best" };
    }
    const t1 = ref.totalTime!;
    const d1 = ref.distance / 1000;
    const d2 = distance / 1000;
    const t2 = t1 * Math.pow(d2 / d1, 1.06);
    return { label, distance, seconds: t2, sourceLabel: `projected from ${ref.label}` };
  });
}

// ---------------------------------------------------------------------------
// Elevation totals — last N days
// ---------------------------------------------------------------------------

export interface ElevationSummary {
  total:     number;   // metres gained
  biggest:   number;   // biggest single-run gain
  biggestDate: string | null;
  days:      number;
}

export function computeElevation(activities: StravaActivity[], days: number = 28): ElevationSummary {
  const runs = activities.filter(isRun);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const cutoff = addDays(now, -days);

  let total = 0;
  let biggest = 0;
  let biggestDate: string | null = null;
  for (const a of runs) {
    const d = new Date(a.start_date_local);
    if (d < cutoff) continue;
    const gain = a.total_elevation_gain ?? 0;
    total += gain;
    if (gain > biggest) {
      biggest = gain;
      biggestDate = a.start_date_local.slice(0, 10);
    }
  }
  return { total, biggest, biggestDate, days };
}

// ---------------------------------------------------------------------------
// Run-type mix — classify runs by pace relative to the user's median pace
//   Easy:      slower than median + 30s/km
//   Steady:    median ± 30s/km
//   Tempo:     faster than median − 30s/km but slower than − 60s/km
//   Workout:   faster than median − 60s/km
// ---------------------------------------------------------------------------

export interface RunTypeMix {
  easy:     number;
  steady:   number;
  tempo:    number;
  workout:  number;
  total:    number;
}

export function computeRunTypeMix(activities: StravaActivity[], days: number = 28): RunTypeMix {
  const runs = activities.filter(isRun);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const cutoff = addDays(now, -days);
  const recent = runs.filter(
    (a) => new Date(a.start_date_local) >= cutoff && a.moving_time > 0 && a.distance > 500,
  );
  if (recent.length === 0) return { easy: 0, steady: 0, tempo: 0, workout: 0, total: 0 };

  const paces = recent.map((a) => a.moving_time / (a.distance / 1000)).sort((a, b) => a - b);
  const median = paces[Math.floor(paces.length / 2)];

  const mix: RunTypeMix = { easy: 0, steady: 0, tempo: 0, workout: 0, total: recent.length };
  for (const a of recent) {
    const pace = a.moving_time / (a.distance / 1000);
    if (pace >= median + 30)      mix.easy += 1;
    else if (pace <= median - 60) mix.workout += 1;
    else if (pace <= median - 30) mix.tempo += 1;
    else                          mix.steady += 1;
  }
  return mix;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm)) return "—";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatRaceTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
