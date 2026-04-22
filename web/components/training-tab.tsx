import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StravaActivity } from "@/lib/services/strava";
import {
  isRun,
  computeTrainingLoad,
  computeWeekly,
  computeHrZones,
  computeBestEfforts,
  computeConsistency,
  computeMonthly,
  computeDayOfWeek,
  computeDistanceHistogram,
  computePaceTrend,
  computePredictedRaces,
  computeElevation,
  computeRunTypeMix,
  formInterpretation,
  formatPace,
  formatDuration,
  formatRaceTime,
  type WeeklyBucket,
  type HrZone,
  type TrainingLoadSummary,
  type MonthlyBucket,
  type DowBucket,
  type DistanceBand,
  type PaceTrendPoint,
  type PredictedRace,
  type ElevationSummary,
  type RunTypeMix,
} from "@/lib/services/training-analytics";

interface Props {
  stravaToken: { athlete_id: number; connected_at: string } | null;
  stravaStatus?: string;
  activities: StravaActivity[];
}

export function TrainingTab({ stravaToken, stravaStatus, activities }: Props) {
  const connected = !!stravaToken;

  if (!connected) {
    return <ConnectPrompt stravaStatus={stravaStatus} />;
  }

  const runs = activities.filter(isRun);

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6">
          <StravaHeader token={stravaToken} stravaStatus={stravaStatus} />
          <p className="text-sm text-muted-foreground mt-4">
            No running activities found in your Strava feed yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const load      = computeTrainingLoad(activities, 84);
  const weekly    = computeWeekly(activities, 12);
  const hrZones   = computeHrZones(activities);
  const bests     = computeBestEfforts(activities);
  const rhythm    = computeConsistency(activities, 4);
  const monthly   = computeMonthly(activities, 6);
  const dow       = computeDayOfWeek(activities, 12);
  const histogram = computeDistanceHistogram(activities);
  const paceTrend = computePaceTrend(weekly);
  const predicted = computePredictedRaces(bests);
  const elevation = computeElevation(activities, 28);
  const typeMix   = computeRunTypeMix(activities, 28);
  const thisWeek  = weekly[weekly.length - 1];
  const lastWeek  = weekly[weekly.length - 2];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 pb-6 space-y-6">
          <StravaHeader token={stravaToken} stravaStatus={stravaStatus} />
          <FormCards load={load} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-4">
          <SectionHeading label="Performance Management · 84 Days" pro />
          <PerformanceChart daily={load.daily} />
          <PerformanceLegend />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-4">
          <SectionHeading label="Weekly Load · Last 12 Weeks" pro />
          <WeeklyChart buckets={weekly} />
          <WeeklyDelta current={thisWeek} previous={lastWeek} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label="Monthly Totals · 6 Months" pro />
            <MonthlyTable buckets={monthly} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label="Training Days · When You Run" pro />
            <DayOfWeekChart dow={dow} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label="Pace Trend · Weekly Avg" pro />
            <PaceTrendChart points={paceTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label="Run Mix · Last 4 Weeks" pro />
            <RunTypeMixBar mix={typeMix} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label="Distance Distribution" pro />
            <DistanceHistogram bands={histogram} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label="Elevation · Last 4 Weeks" pro />
            <ElevationCard elev={elevation} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label="Heart Rate Zones" pro />
            {hrZones
              ? <HrZonesBar zones={hrZones} />
              : <p className="text-xs text-muted-foreground">Connect a device that records HR to unlock zone analysis.</p>
            }
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label="Best Efforts" pro />
            <BestsTable bests={bests} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-4">
          <SectionHeading label="Race Predictor" pro />
          <PredictedRaces races={predicted} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-4">
          <SectionHeading label="Training Rhythm" />
          <RhythmRow rhythm={rhythm} totalRuns={runs.length} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-3">
          <SectionHeading label="Recent Runs" />
          <RunsList runs={runs.slice(0, 15)} />
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center pt-2">
        Advanced analytics powered by Strava. Premium tier coming soon — free during beta.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Common sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ label, pro }: { label: string; pro?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
      {pro && (
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono tracking-widest bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 text-amber-600">
          PRO
        </Badge>
      )}
    </div>
  );
}

function StravaHeader({
  token, stravaStatus,
}: {
  token: { athlete_id: number; connected_at: string };
  stravaStatus?: string;
}) {
  return (
    <>
      {stravaStatus === "connected" && (
        <div className="rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-600">
          Strava connected! +20 coins earned.
        </div>
      )}
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 24 24" className="w-8 h-8 shrink-0" fill="#FC4C02">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Connected to Strava</div>
          <p className="text-xs text-muted-foreground">Athlete #{token.athlete_id}</p>
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">Synced</Badge>
      </div>
    </>
  );
}

function ConnectPrompt({ stravaStatus }: { stravaStatus?: string }) {
  return (
    <Card>
      <CardContent className="pt-8 pb-8 text-center space-y-4">
        {stravaStatus === "denied" && (
          <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-500">
            Strava connection was denied.
          </div>
        )}
        <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto" fill="#FC4C02">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
        <div>
          <h3 className="font-semibold text-base">Connect Strava to unlock training analytics</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Track fitness, form, weekly load, heart-rate zones, pace trends, race predictions and more — automatically synced from your runs.
          </p>
        </div>
        <Link
          href="/api/auth/strava/connect"
          className="inline-block px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[#FC4C02] hover:bg-[#e04400] transition-colors"
        >
          Connect Strava
        </Link>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Form cards
// ---------------------------------------------------------------------------

function FormCards({ load }: { load: TrainingLoadSummary }) {
  const form = formInterpretation(load.tsb);
  const formColor =
    form.tone === "fresh"        ? "text-green-500" :
    form.tone === "detrained"    ? "text-blue-400" :
    form.tone === "tired"        ? "text-amber-500" :
    form.tone === "overreaching" ? "text-red-500" :
                                    "text-foreground";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat
          big={load.ctl.toFixed(1)}
          label="Fitness (CTL)"
          sub={`${load.ramp7 >= 0 ? "+" : ""}${load.ramp7.toFixed(1)} 7d`}
          subColor={load.ramp7 > 3 ? "text-red-500" : load.ramp7 >= 0 ? "text-green-500" : "text-amber-500"}
        />
        <Stat
          big={load.atl.toFixed(1)}
          label="Fatigue (ATL)"
          sub="7-day load"
        />
        <Stat
          big={load.tsb >= 0 ? `+${load.tsb.toFixed(1)}` : load.tsb.toFixed(1)}
          label="Form (TSB)"
          bigColor={formColor}
          sub={form.label}
          subColor={formColor}
        />
      </div>
      <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
          form.tone === "fresh" ? "bg-green-500" :
          form.tone === "tired" ? "bg-amber-500" :
          form.tone === "overreaching" ? "bg-red-500" :
          form.tone === "detrained" ? "bg-blue-400" : "bg-muted-foreground"
        }`} />
        <span>{form.hint}</span>
      </div>
    </div>
  );
}

function Stat({
  big, label, sub, bigColor, subColor,
}: {
  big:   string;
  label: string;
  sub?:  string;
  bigColor?: string;
  subColor?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className={`text-2xl font-bold tabular-nums ${bigColor ?? ""}`}>{big}</div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
      {sub && <div className={`text-[11px] tabular-nums mt-1 ${subColor ?? "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Performance Management Chart (CTL / ATL / TSB line chart, SVG)
// ---------------------------------------------------------------------------

function PerformanceChart({ daily }: { daily: TrainingLoadSummary["daily"] }) {
  if (daily.length === 0) return null;

  const W = 640;
  const H = 180;
  const padL = 32;
  const padR = 8;
  const padT = 8;
  const padB = 24;

  const ctlMax = Math.max(1, ...daily.map((d) => d.ctl));
  const atlMax = Math.max(1, ...daily.map((d) => d.atl));
  const loadMax = Math.max(1, ...daily.map((d) => d.load));
  const yTopMax = Math.max(ctlMax, atlMax) * 1.1;

  const x = (i: number) => padL + (i / Math.max(1, daily.length - 1)) * (W - padL - padR);
  const yTop = (v: number) => padT + (1 - v / yTopMax) * (H - padT - padB);

  const pathCtl = daily.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yTop(d.ctl).toFixed(1)}`).join(" ");
  const pathAtl = daily.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yTop(d.atl).toFixed(1)}`).join(" ");

  // Area between CTL (above) and ATL (below) — shaded green (fresh form)
  const areaAbove = [
    ...daily.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yTop(d.ctl).toFixed(1)}`),
    ...daily.slice().reverse().map((d, i) => `L ${x(daily.length - 1 - i).toFixed(1)} ${yTop(d.atl).toFixed(1)}`),
    "Z",
  ].join(" ");

  // Load bars (thin, faint, behind lines)
  const barW = Math.max(1, (W - padL - padR) / daily.length - 1);
  const loadScale = (v: number) => (v / loadMax) * (H - padT - padB) * 0.35;

  // Axis ticks
  const ticks = [0, Math.round(yTopMax / 2), Math.round(yTopMax)];
  const firstDate = daily[0]?.date;
  const lastDate = daily[daily.length - 1]?.date;
  const midIdx = Math.floor(daily.length / 2);
  const midDate = daily[midIdx]?.date;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px] h-[180px]">
        {/* Grid lines */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={yTop(t)} x2={W - padR} y2={yTop(t)} stroke="currentColor" strokeOpacity="0.08" />
            <text x={padL - 4} y={yTop(t) + 3} fontSize="9" textAnchor="end" className="fill-muted-foreground font-mono">{t}</text>
          </g>
        ))}

        {/* Daily load bars */}
        {daily.map((d, i) => d.load > 0 && (
          <rect
            key={i}
            x={x(i) - barW / 2}
            y={H - padB - loadScale(d.load)}
            width={barW}
            height={loadScale(d.load)}
            className="fill-muted-foreground/25"
          />
        ))}

        {/* Fitness vs Fatigue area (form proxy) */}
        <path d={areaAbove} className="fill-green-500/10" />

        {/* ATL line (fatigue — red) */}
        <path d={pathAtl} fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.9" />

        {/* CTL line (fitness — blue) */}
        <path d={pathCtl} fill="none" stroke="#3b82f6" strokeWidth="2" />

        {/* X-axis date labels */}
        <text x={padL} y={H - 6} fontSize="9" className="fill-muted-foreground font-mono">
          {firstDate && new Date(firstDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
        <text x={W / 2} y={H - 6} fontSize="9" textAnchor="middle" className="fill-muted-foreground font-mono">
          {midDate && new Date(midDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
        <text x={W - padR} y={H - 6} fontSize="9" textAnchor="end" className="fill-muted-foreground font-mono">
          {lastDate && new Date(lastDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
      </svg>
    </div>
  );
}

function PerformanceLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <LegendDot color="#3b82f6" label="Fitness (CTL)" />
      <LegendDot color="#ef4444" label="Fatigue (ATL)" />
      <LegendDot color="#22c55e33" label="Form (area = fitness − fatigue)" />
      <LegendDot color="currentColor" className="opacity-25" label="Daily load" />
    </div>
  );
}

function LegendDot({ color, label, className }: { color: string; label: string; className?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block w-3 h-1.5 rounded-sm ${className ?? ""}`}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Weekly chart — now plots LOAD (falls back to distance if all load = 0)
// ---------------------------------------------------------------------------

function WeeklyChart({ buckets }: { buckets: WeeklyBucket[] }) {
  const loadMax = Math.max(0, ...buckets.map((b) => b.load));
  const useLoad = loadMax > 0;
  const distMax = Math.max(1, ...buckets.map((b) => b.distance));
  const max = useLoad ? loadMax : distMax;
  const metricOf = (b: WeeklyBucket) => useLoad ? b.load : b.distance;

  return (
    <div>
      <div className="flex items-end gap-1.5 h-32">
        {buckets.map((b, i) => {
          const h = (metricOf(b) / Math.max(1, max)) * 100;
          const isCurrent = i === buckets.length - 1;
          return (
            <div key={b.weekStart} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
              <div
                className={`w-full rounded-t-sm transition-all ${
                  isCurrent ? "bg-[#FC4C02]" : "bg-[#22c55e]/70 group-hover:bg-[#22c55e]"
                }`}
                style={{ height: `${Math.max(2, h)}%` }}
              />
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border rounded px-2 py-1 text-[10px] font-mono whitespace-nowrap z-10 shadow-sm text-left">
                <div>{new Date(b.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                <div>{b.distance.toFixed(1)} km · {b.count} runs</div>
                <div>load {b.load.toFixed(0)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-mono">
        <span>{new Date(buckets[0].weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <span>{useLoad ? `${max.toFixed(0)} load peak` : `${max.toFixed(0)} km peak`}</span>
        <span>This week</span>
      </div>
    </div>
  );
}

function WeeklyDelta({ current, previous }: { current: WeeklyBucket; previous?: WeeklyBucket }) {
  const prev = previous ?? { distance: 0, count: 0, time: 0, load: 0 } as WeeklyBucket;
  const deltaKm = current.distance - prev.distance;
  const deltaRuns = current.count - prev.count;

  return (
    <div className="grid grid-cols-4 gap-3">
      <MiniStat value={current.distance.toFixed(1)} unit="km" label="This week"
        delta={deltaKm !== 0 ? `${deltaKm >= 0 ? "+" : ""}${deltaKm.toFixed(1)}` : undefined} />
      <MiniStat value={String(current.count)} unit="runs" label="Workouts"
        delta={deltaRuns !== 0 ? `${deltaRuns >= 0 ? "+" : ""}${deltaRuns}` : undefined} />
      <MiniStat value={current.time > 0 ? formatDuration(current.time) : "—"} label="Moving time" />
      <MiniStat
        value={current.avgPace ? formatPace(current.avgPace).replace(" /km", "") : "—"}
        label="Avg pace"
        unit={current.avgPace ? "/km" : undefined}
      />
    </div>
  );
}

function MiniStat({
  value, unit, label, delta,
}: { value: string; unit?: string; label: string; delta?: string }) {
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {delta && (
        <div className={`text-[10px] tabular-nums mt-0.5 ${
          delta.startsWith("+") ? "text-green-500" : "text-red-500"
        }`}>
          {delta} vs last
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly totals table
// ---------------------------------------------------------------------------

function MonthlyTable({ buckets }: { buckets: MonthlyBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.distance));
  return (
    <div className="space-y-1">
      {buckets.map((b) => {
        const pct = (b.distance / max) * 100;
        return (
          <div key={b.key} className="flex items-center gap-3 py-1">
            <div className="w-10 text-xs font-medium tabular-nums">{b.label}</div>
            <div className="flex-1 relative h-5 rounded bg-muted/40 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#22c55e]/70 to-[#22c55e] rounded"
                style={{ width: `${Math.max(1, pct)}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-[11px] font-mono tabular-nums text-foreground/90">
                {b.distance.toFixed(0)} km
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono tabular-nums w-14 text-right">
              {b.count} runs
            </div>
            <div className="text-[11px] text-muted-foreground font-mono tabular-nums w-16 text-right hidden sm:block">
              {b.avgPace ? formatPace(b.avgPace).replace(" /km", "") : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day-of-week chart (horizontal bars)
// ---------------------------------------------------------------------------

function DayOfWeekChart({ dow }: { dow: DowBucket[] }) {
  const max = Math.max(1, ...dow.map((d) => d.distance));
  return (
    <div className="space-y-1.5">
      {dow.map((d) => {
        const pct = (d.distance / max) * 100;
        return (
          <div key={d.dow} className="flex items-center gap-3">
            <div className="w-9 text-xs font-medium">{d.label}</div>
            <div className="flex-1 h-3 rounded bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded bg-sky-500/80"
                style={{ width: `${Math.max(1, pct)}%` }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground font-mono tabular-nums w-20 text-right">
              {d.distance.toFixed(1)} km · {d.count}
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground pt-1">Totals over last 12 weeks.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pace trend chart (SVG line)
// ---------------------------------------------------------------------------

function PaceTrendChart({ points }: { points: PaceTrendPoint[] }) {
  const withPace = points.filter((p) => p.avgPace !== null);
  if (withPace.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Not enough data yet. Log a few weeks of runs to see your pace trend.
      </p>
    );
  }

  const W = 400;
  const H = 140;
  const padL = 32;
  const padR = 8;
  const padT = 8;
  const padB = 20;

  const paces = withPace.map((p) => p.avgPace!);
  const pMin = Math.min(...paces);
  const pMax = Math.max(...paces);
  const range = Math.max(30, pMax - pMin);
  // Pace is "lower is better" — so flip Y: faster on top
  const x = (i: number) => padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + ((v - pMin) / range) * (H - padT - padB);

  const path = points
    .map((p, i) => {
      if (p.avgPace === null) return "";
      return `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.avgPace).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  const best = Math.min(...paces);
  const latest = withPace[withPace.length - 1].avgPace!;
  const delta = latest - withPace[0].avgPace!; // positive = getting slower

  return (
    <div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[280px] h-[140px]">
          <line x1={padL} y1={y(pMin)} x2={W - padR} y2={y(pMin)} stroke="currentColor" strokeOpacity="0.08" />
          <line x1={padL} y1={y(pMax)} x2={W - padR} y2={y(pMax)} stroke="currentColor" strokeOpacity="0.08" />
          <text x={padL - 4} y={y(pMin) + 3} fontSize="9" textAnchor="end" className="fill-muted-foreground font-mono">
            {formatPace(pMin).replace(" /km", "")}
          </text>
          <text x={padL - 4} y={y(pMax) + 3} fontSize="9" textAnchor="end" className="fill-muted-foreground font-mono">
            {formatPace(pMax).replace(" /km", "")}
          </text>
          <path d={path} fill="none" stroke="#8b5cf6" strokeWidth="2" />
          {points.map((p, i) =>
            p.avgPace !== null ? (
              <circle key={i} cx={x(i)} cy={y(p.avgPace)} r="2.5" className="fill-violet-500" />
            ) : null,
          )}
        </svg>
      </div>
      <div className="flex justify-between text-[11px] mt-1">
        <span className="text-muted-foreground font-mono">12 wk ago</span>
        <span className={`font-mono tabular-nums ${delta < 0 ? "text-green-500" : delta > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
          {delta < 0 ? "−" : "+"}{Math.abs(delta).toFixed(0)}s/km overall
        </span>
        <span className="text-muted-foreground font-mono">best {formatPace(best).replace(" /km", "")}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run-type mix bar
// ---------------------------------------------------------------------------

function RunTypeMixBar({ mix }: { mix: RunTypeMix }) {
  if (mix.total === 0) {
    return <p className="text-xs text-muted-foreground">No runs in the last 4 weeks.</p>;
  }
  const cats = [
    { key: "easy",    label: "Easy",    value: mix.easy,    color: "bg-sky-400" },
    { key: "steady",  label: "Steady",  value: mix.steady,  color: "bg-green-500" },
    { key: "tempo",   label: "Tempo",   value: mix.tempo,   color: "bg-amber-500" },
    { key: "workout", label: "Workout", value: mix.workout, color: "bg-red-500" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex h-6 rounded-md overflow-hidden border">
        {cats.map((c) =>
          c.value > 0 ? (
            <div
              key={c.key}
              className={c.color}
              style={{ width: `${(c.value / mix.total) * 100}%` }}
              title={`${c.label} · ${c.value} runs`}
            />
          ) : null,
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 text-[10px]">
        {cats.map((c) => (
          <div key={c.key} className="flex flex-col items-start">
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-sm ${c.color}`} />
              <span className="font-mono">{c.label}</span>
            </div>
            <span className="text-muted-foreground">{c.value} runs</span>
            <span className="font-mono tabular-nums mt-0.5">
              {mix.total > 0 ? Math.round((c.value / mix.total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Classified by pace relative to your median. 80/20 rule: most runs should be easy.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distance histogram
// ---------------------------------------------------------------------------

function DistanceHistogram({ bands }: { bands: DistanceBand[] }) {
  const max = Math.max(1, ...bands.map((b) => b.count));
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 h-28">
        {bands.map((b) => {
          const h = (b.count / max) * 100;
          return (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full h-full flex flex-col justify-end">
                <div
                  className="w-full rounded-t-sm bg-indigo-500/70 group-hover:bg-indigo-500 transition-colors"
                  style={{ height: `${Math.max(2, h)}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">{b.count}</div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        {bands.map((b) => (
          <div key={b.label} className="flex-1 text-center text-[10px] text-muted-foreground font-mono">
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Elevation card
// ---------------------------------------------------------------------------

function ElevationCard({ elev }: { elev: ElevationSummary }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          big={`${Math.round(elev.total)}`}
          label="Total elevation (m)"
          sub={`over ${elev.days} days`}
        />
        <Stat
          big={`${Math.round(elev.biggest)}`}
          label="Biggest climb (m)"
          sub={elev.biggestDate ? new Date(elev.biggestDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
        />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-block">{"\u26F0\uFE0F"}</span>
        <span>
          {elev.total > 500
            ? "Solid vertical — hill strength pays off on race day."
            : elev.total > 100
              ? "Some hills this month. Consider a hilly long run."
              : "Mostly flat. Add one hilly run per week to boost strength."}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HR zones, Best efforts, Race predictor
// ---------------------------------------------------------------------------

function HrZonesBar({ zones }: { zones: HrZone[] }) {
  const colors = ["bg-sky-400", "bg-green-400", "bg-amber-400", "bg-orange-500", "bg-red-500"];
  const labels = ["Recovery", "Endurance", "Tempo", "Threshold", "VO\u2082max"];
  return (
    <div className="space-y-3">
      <div className="flex h-6 rounded-md overflow-hidden border">
        {zones.map((z, i) => (
          <div
            key={z.zone}
            className={colors[i]}
            style={{ width: `${Math.max(z.pct, 0.5)}%` }}
            title={`Z${z.zone} · ${labels[i]} · ${z.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2 text-[10px]">
        {zones.map((z, i) => (
          <div key={z.zone} className="flex flex-col items-start">
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-sm ${colors[i]}`} />
              <span className="font-mono">Z{z.zone}</span>
            </div>
            <span className="text-muted-foreground">{labels[i]}</span>
            <span className="font-mono tabular-nums mt-0.5">{z.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BestsTable({ bests }: { bests: ReturnType<typeof computeBestEfforts> }) {
  const available = bests.filter((b) => b.pace !== null);
  if (available.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No qualifying runs at standard distances yet. Run 5K+ to unlock best efforts.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {bests.map((b) => (
        <div key={b.label} className="flex items-center justify-between py-1.5 border-b last:border-b-0">
          <span className="text-sm font-semibold">{b.label}</span>
          <div className="text-right">
            {b.pace !== null ? (
              <>
                <div className="text-sm font-mono tabular-nums">{formatDuration(b.totalTime!)}</div>
                <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
                  {formatPace(b.pace)}
                </div>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PredictedRaces({ races }: { races: PredictedRace[] }) {
  const anyData = races.some((r) => r.seconds !== null);
  if (!anyData) {
    return (
      <p className="text-xs text-muted-foreground">
        Complete a 5K+ run to unlock Riegel-formula race predictions.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {races.map((r) => (
        <div key={r.label} className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{r.label}</div>
          <div className="text-xl font-bold tabular-nums mt-1 font-mono">
            {formatRaceTime(r.seconds)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{r.sourceLabel ?? "—"}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rhythm + Recent runs
// ---------------------------------------------------------------------------

function RhythmRow({
  rhythm, totalRuns,
}: {
  rhythm: ReturnType<typeof computeConsistency>;
  totalRuns: number;
}) {
  const pct = Math.round((rhythm.daysActive / rhythm.possibleDays) * 100);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MiniStat value={`${rhythm.daysActive}/${rhythm.possibleDays}`} label="Active days (4 wk)" />
      <MiniStat value={`${pct}%`} label="Consistency" />
      <MiniStat value={String(rhythm.streakDays)} unit="days" label="Current streak" />
      <MiniStat value={String(totalRuns)} unit="runs" label="Loaded in feed" />
    </div>
  );
}

function RunsList({ runs }: { runs: StravaActivity[] }) {
  return (
    <div className="space-y-1 max-h-[420px] overflow-y-auto">
      {runs.map((a) => {
        const pace = a.moving_time > 0 ? a.moving_time / (a.distance / 1000) : null;
        const isTrail = a.type === "TrailRun";
        return (
          <div key={a.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
            <span className="text-lg shrink-0">{isTrail ? "\u26F0\uFE0F" : "\uD83C\uDFC3"}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{a.name ?? (isTrail ? "Trail Run" : "Run")}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(a.start_date_local).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
                {a.average_heartrate && ` \u00B7 ${Math.round(a.average_heartrate)} bpm`}
                {a.total_elevation_gain && a.total_elevation_gain > 30 && ` \u00B7 \u2191${Math.round(a.total_elevation_gain)}m`}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-mono tabular-nums">{(a.distance / 1000).toFixed(2)} km</div>
              <div className="text-xs text-muted-foreground font-mono tabular-nums">
                {pace ? formatPace(pace).replace(" /km", "") : "—"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
