import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import { formatDate, type DateStyle } from "@/lib/format";
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

/** "Apr 12" in the visitor's language. */
function shortDate(date: string, locale: Locale, style: DateStyle = { day: true, month: "short" }): string {
  return formatDate(date, locale, style) ?? "";
}

/** "5K", "Half", "Marathon" (codes from training-analytics) in the visitor's language. */
function useDistanceName(): (label: string) => string {
  const t = useTranslations("profile.training.distances");
  return (label) => (label === "Half" ? t("half") : label === "Marathon" ? t("marathon") : label);
}

export function TrainingTab({ stravaToken, stravaStatus, activities }: Props) {
  const t = useTranslations("profile.training");
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
            {t("noRuns")}
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
          <SectionHeading label={t("sections.performance")} pro />
          <PerformanceChart daily={load.daily} />
          <PerformanceLegend />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-4">
          <SectionHeading label={t("sections.weekly")} pro />
          <WeeklyChart buckets={weekly} />
          <WeeklyDelta current={thisWeek} previous={lastWeek} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label={t("sections.monthly")} pro />
            <MonthlyTable buckets={monthly} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label={t("sections.days")} pro />
            <DayOfWeekChart dow={dow} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label={t("sections.paceTrend")} pro />
            <PaceTrendChart points={paceTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label={t("sections.runMix")} pro />
            <RunTypeMixBar mix={typeMix} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label={t("sections.distances")} pro />
            <DistanceHistogram bands={histogram} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label={t("sections.elevation")} pro />
            <ElevationCard elev={elevation} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label={t("sections.hrZones")} pro />
            {hrZones
              ? <HrZonesBar zones={hrZones} />
              : <p className="text-xs text-muted-foreground">{t("noHr")}</p>
            }
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 pb-6 space-y-4">
            <SectionHeading label={t("sections.bests")} pro />
            <BestsTable bests={bests} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-4">
          <SectionHeading label={t("sections.predictor")} pro />
          <PredictedRaces races={predicted} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-4">
          <SectionHeading label={t("sections.rhythm")} />
          <RhythmRow rhythm={rhythm} totalRuns={runs.length} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-3">
          <SectionHeading label={t("sections.recent")} />
          <RunsList runs={runs.slice(0, 15)} />
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center pt-2">
        {t("footer")}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Common sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ label }: { label: string; pro?: boolean }) {
  return (
    <div className="border-b-2 border-rule pb-1.5">
      <h3 className="headline text-2xl">{label}</h3>
    </div>
  );
}

function StravaHeader({
  token, stravaStatus,
}: {
  token: { athlete_id: number; connected_at: string };
  stravaStatus?: string;
}) {
  const t = useTranslations("profile.training.strava");
  return (
    <>
      {stravaStatus === "connected" && (
        <div className="border-l-4 border-positive bg-card px-3 py-2 text-sm">
          {t("justConnected")}
        </div>
      )}
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 24 24" className="w-8 h-8 shrink-0" fill="#FC4C02">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{t("connected")}</div>
          <p className="text-xs text-muted-foreground">{t("athlete", { id: String(token.athlete_id) })}</p>
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">{t("synced")}</Badge>
      </div>
    </>
  );
}

function ConnectPrompt({ stravaStatus }: { stravaStatus?: string }) {
  const t = useTranslations("profile.training.strava");
  return (
    <Card>
      <CardContent className="pt-8 pb-8 text-center space-y-4">
        {stravaStatus === "denied" && (
          <div className="border-l-4 border-destructive bg-card px-3 py-2 text-sm text-destructive">
            {t("denied")}
          </div>
        )}
        <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto" fill="#FC4C02">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
        <div>
          <h3 className="font-semibold text-base">{t("promptTitle")}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {t("promptBody")}
          </p>
        </div>
        <Link
          href="/api/auth/strava/connect"
          className="inline-block h-10 leading-10 px-4 rounded-sm text-sm font-semibold text-white bg-[#FC4C02] hover:bg-[#e04400] transition-colors"
        >
          {t("connect")}
        </Link>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Form cards
// ---------------------------------------------------------------------------

function FormCards({ load }: { load: TrainingLoadSummary }) {
  const t = useTranslations("profile.training.form");
  const form = formInterpretation(load.tsb);
  const formColor =
    form.tone === "fresh"        ? "text-positive" :
    form.tone === "detrained"    ? "text-chart-4" :
    form.tone === "tired"        ? "text-caution" :
    form.tone === "overreaching" ? "text-destructive" :
                                    "text-foreground";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat
          big={load.ctl.toFixed(1)}
          label={t("fitness")}
          sub={t("ramp7", { delta: `${load.ramp7 >= 0 ? "+" : ""}${load.ramp7.toFixed(1)}` })}
          subColor={load.ramp7 > 3 ? "text-destructive" : load.ramp7 >= 0 ? "text-positive" : "text-caution"}
        />
        <Stat
          big={load.atl.toFixed(1)}
          label={t("fatigue")}
          sub={t("load7")}
        />
        <Stat
          big={load.tsb >= 0 ? `+${load.tsb.toFixed(1)}` : load.tsb.toFixed(1)}
          label={t("form")}
          bigColor={formColor}
          sub={t(`tone.${form.tone}.label`)}
          subColor={formColor}
        />
      </div>
      <div className="border-l-2 border-rule pl-3 py-1 text-xs text-muted-foreground flex items-start gap-2">
        <span className={`size-1.5 mt-1.5 shrink-0 ${
          form.tone === "fresh" ? "bg-positive" :
          form.tone === "tired" ? "bg-caution" :
          form.tone === "overreaching" ? "bg-destructive" :
          form.tone === "detrained" ? "bg-chart-4" : "bg-muted-foreground"
        }`} />
        <span>{t(`tone.${form.tone}.hint`)}</span>
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
    <div className="border-t border-rule pt-2">
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
  const locale = useLocale();
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
        <path d={areaAbove} className="fill-chart-3/20" />

        {/* ATL line (fatigue — red) */}
        <path d={pathAtl} fill="none" className="stroke-primary" strokeWidth="1.5" />

        {/* CTL line (fitness — blue) */}
        <path d={pathCtl} fill="none" className="stroke-chart-4" strokeWidth="2" />

        {/* X-axis date labels */}
        <text x={padL} y={H - 6} fontSize="9" className="fill-muted-foreground font-mono">
          {firstDate && shortDate(firstDate, locale)}
        </text>
        <text x={W / 2} y={H - 6} fontSize="9" textAnchor="middle" className="fill-muted-foreground font-mono">
          {midDate && shortDate(midDate, locale)}
        </text>
        <text x={W - padR} y={H - 6} fontSize="9" textAnchor="end" className="fill-muted-foreground font-mono">
          {lastDate && shortDate(lastDate, locale)}
        </text>
      </svg>
    </div>
  );
}

function PerformanceLegend() {
  const t = useTranslations("profile.training.form");
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <LegendDot color="var(--chart-4)" label={t("fitness")} />
      <LegendDot color="var(--primary)" label={t("fatigue")} />
      <LegendDot color="color-mix(in oklch, var(--chart-3) 30%, transparent)" label={t("formArea")} />
      <LegendDot color="currentColor" className="opacity-25" label={t("dailyLoad")} />
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
  const t = useTranslations("profile.training.weekly");
  const locale = useLocale();
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
                  isCurrent ? "bg-primary" : "bg-foreground/60 group-hover:bg-foreground"
                }`}
                style={{ height: `${Math.max(2, h)}%` }}
              />
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border rounded px-2 py-1 text-[10px] font-mono whitespace-nowrap z-10 shadow-sm text-left">
                <div>{shortDate(b.weekStart, locale)}</div>
                <div>{b.distance.toFixed(1)} km · {t("runs", { count: b.count })}</div>
                <div>{t("load", { load: b.load.toFixed(0) })}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-mono">
        <span>{shortDate(buckets[0].weekStart, locale)}</span>
        <span>{useLoad ? t("loadPeak", { value: max.toFixed(0) }) : t("kmPeak", { value: max.toFixed(0) })}</span>
        <span>{t("thisWeek")}</span>
      </div>
    </div>
  );
}

function WeeklyDelta({ current, previous }: { current: WeeklyBucket; previous?: WeeklyBucket }) {
  const t = useTranslations("profile.training.weekly");
  const prev = previous ?? { distance: 0, count: 0, time: 0, load: 0 } as WeeklyBucket;
  const deltaKm = current.distance - prev.distance;
  const deltaRuns = current.count - prev.count;

  return (
    <div className="grid grid-cols-4 gap-3">
      <MiniStat value={current.distance.toFixed(1)} unit="km" label={t("thisWeek")}
        delta={deltaKm !== 0 ? `${deltaKm >= 0 ? "+" : ""}${deltaKm.toFixed(1)}` : undefined} />
      <MiniStat value={String(current.count)} unit={t("runsUnit", { count: current.count })} label={t("workouts")}
        delta={deltaRuns !== 0 ? `${deltaRuns >= 0 ? "+" : ""}${deltaRuns}` : undefined} />
      <MiniStat value={current.time > 0 ? formatDuration(current.time) : "—"} label={t("movingTime")} />
      <MiniStat
        value={current.avgPace ? formatPace(current.avgPace).replace(" /km", "") : "—"}
        label={t("avgPace")}
        unit={current.avgPace ? "/km" : undefined}
      />
    </div>
  );
}

function MiniStat({
  value, unit, label, delta,
}: { value: string; unit?: string; label: string; delta?: string }) {
  const t = useTranslations("profile.training");
  return (
    <div className="border-t pt-2">
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {delta && (
        <div className={`text-[10px] tabular-nums mt-0.5 ${
          delta.startsWith("+") ? "text-positive" : "text-destructive"
        }`}>
          {t("vsLast", { delta })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly totals table
// ---------------------------------------------------------------------------

function MonthlyTable({ buckets }: { buckets: MonthlyBucket[] }) {
  const t = useTranslations("profile.training.weekly");
  const locale = useLocale();
  const max = Math.max(1, ...buckets.map((b) => b.distance));
  return (
    <div className="space-y-1">
      {buckets.map((b) => {
        const pct = (b.distance / max) * 100;
        return (
          <div key={b.key} className="flex items-center gap-3 py-1">
            <div className="w-10 text-xs font-medium tabular-nums">{shortDate(`${b.key}-01T00:00:00Z`, locale, { month: "short" })}</div>
            <div className="flex-1 relative h-5 bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-foreground/70"
                style={{ width: `${Math.max(1, pct)}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-[11px] font-mono tabular-nums text-foreground/90">
                {b.distance.toFixed(0)} km
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono tabular-nums w-14 text-right">
              {t("runs", { count: b.count })}
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
  const t = useTranslations("profile.training");
  const locale = useLocale();
  // dow 0 = Monday; 2024-01-01 was a Monday.
  const weekday = (i: number) => shortDate(`2024-01-0${i + 1}T00:00:00Z`, locale, { weekday: true });
  const max = Math.max(1, ...dow.map((d) => d.distance));
  return (
    <div className="space-y-1.5">
      {dow.map((d) => {
        const pct = (d.distance / max) * 100;
        return (
          <div key={d.dow} className="flex items-center gap-3">
            <div className="w-9 text-xs font-medium">{weekday(d.dow)}</div>
            <div className="flex-1 h-3 bg-muted overflow-hidden">
              <div
                className="h-full bg-chart-4"
                style={{ width: `${Math.max(1, pct)}%` }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground font-mono tabular-nums w-20 text-right">
              {d.distance.toFixed(1)} km · {d.count}
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground pt-1">{t("dowNote")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pace trend chart (SVG line)
// ---------------------------------------------------------------------------

function PaceTrendChart({ points }: { points: PaceTrendPoint[] }) {
  const t = useTranslations("profile.training.pace");
  const withPace = points.filter((p) => p.avgPace !== null);
  if (withPace.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("notEnough")}
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
          <path d={path} fill="none" className="stroke-foreground" strokeWidth="2" />
          {points.map((p, i) =>
            p.avgPace !== null ? (
              <circle key={i} cx={x(i)} cy={y(p.avgPace)} r="2.5" className="fill-violet-500" />
            ) : null,
          )}
        </svg>
      </div>
      <div className="flex justify-between text-[11px] mt-1">
        <span className="text-muted-foreground font-mono">{t("weeksAgo")}</span>
        <span className={`font-mono tabular-nums ${delta < 0 ? "text-positive" : delta > 0 ? "text-caution" : "text-muted-foreground"}`}>
          {t("overall", { delta: `${delta < 0 ? "−" : "+"}${Math.abs(delta).toFixed(0)}` })}
        </span>
        <span className="text-muted-foreground font-mono">{t("best", { pace: formatPace(best).replace(" /km", "") })}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run-type mix bar
// ---------------------------------------------------------------------------

function RunTypeMixBar({ mix }: { mix: RunTypeMix }) {
  const t = useTranslations("profile.training.mix");
  const tw = useTranslations("profile.training.weekly");
  if (mix.total === 0) {
    return <p className="text-xs text-muted-foreground">{t("none")}</p>;
  }
  const cats = [
    { key: "easy",    label: t("easy"),    value: mix.easy,    color: "bg-chart-4" },
    { key: "steady",  label: t("steady"),  value: mix.steady,  color: "bg-chart-3" },
    { key: "tempo",   label: t("tempo"),   value: mix.tempo,   color: "bg-chart-2" },
    { key: "workout", label: t("workout"), value: mix.workout, color: "bg-primary" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex h-6 overflow-hidden">
        {cats.map((c) =>
          c.value > 0 ? (
            <div
              key={c.key}
              className={c.color}
              style={{ width: `${(c.value / mix.total) * 100}%` }}
              title={`${c.label} · ${tw("runs", { count: c.value })}`}
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
            <span className="text-muted-foreground">{tw("runs", { count: c.value })}</span>
            <span className="font-mono tabular-nums mt-0.5">
              {mix.total > 0 ? Math.round((c.value / mix.total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {t("note")}
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
                  className="w-full bg-foreground/60 group-hover:bg-primary transition-colors"
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
  const t = useTranslations("profile.training.elevation");
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          big={`${Math.round(elev.total)}`}
          label={t("total")}
          sub={t("overDays", { count: elev.days })}
        />
        <Stat
          big={`${Math.round(elev.biggest)}`}
          label={t("biggest")}
          sub={elev.biggestDate ? shortDate(elev.biggestDate, locale) : "—"}
        />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-block">{"\u26F0\uFE0F"}</span>
        <span>
          {elev.total > 500
            ? t("hintHigh")
            : elev.total > 100
              ? t("hintMid")
              : t("hintLow")}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HR zones, Best efforts, Race predictor
// ---------------------------------------------------------------------------

function HrZonesBar({ zones }: { zones: HrZone[] }) {
  const t = useTranslations("profile.training.zones");
  const colors = ["bg-chart-4", "bg-chart-3", "bg-chart-2", "bg-chart-5", "bg-primary"];
  const labels = [t("recovery"), t("endurance"), t("tempo"), t("threshold"), "VO\u2082max"];
  return (
    <div className="space-y-3">
      <div className="flex h-6 overflow-hidden">
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
  const t = useTranslations("profile.training");
  const distanceName = useDistanceName();
  const available = bests.filter((b) => b.pace !== null);
  if (available.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("noBests")}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {bests.map((b) => (
        <div key={b.label} className="flex items-center justify-between py-1.5 border-b last:border-b-0">
          <span className="text-sm font-semibold">{distanceName(b.label)}</span>
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
  const t = useTranslations("profile.training");
  const distanceName = useDistanceName();
  const anyData = races.some((r) => r.seconds !== null);
  if (!anyData) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("noPredictions")}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {races.map((r) => (
        <div key={r.label} className="border-t border-rule pt-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{distanceName(r.label)}</div>
          <div className="text-xl font-bold tabular-nums mt-1 font-mono">
            {formatRaceTime(r.seconds)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {r.source === null ? "—" : r.source.kind === "best" ? t("yourBest") : t("projectedFrom", { race: distanceName(r.source.from) })}
          </div>
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
  const t = useTranslations("profile.training.rhythm");
  const pct = Math.round((rhythm.daysActive / rhythm.possibleDays) * 100);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MiniStat value={`${rhythm.daysActive}/${rhythm.possibleDays}`} label={t("activeDays")} />
      <MiniStat value={`${pct}%`} label={t("consistency")} />
      <MiniStat value={String(rhythm.streakDays)} unit={t("daysUnit", { count: rhythm.streakDays })} label={t("streak")} />
      <MiniStat value={String(totalRuns)} unit={t("runsUnit", { count: totalRuns })} label={t("loaded")} />
    </div>
  );
}

function RunsList({ runs }: { runs: StravaActivity[] }) {
  const t = useTranslations("profile.training");
  const locale = useLocale();
  return (
    <div className="space-y-1 max-h-[420px] overflow-y-auto">
      {runs.map((a) => {
        const pace = a.moving_time > 0 ? a.moving_time / (a.distance / 1000) : null;
        const isTrail = a.type === "TrailRun";
        return (
          <div key={a.id} className="flex items-center gap-3 py-2 border-b hover:bg-muted/50 transition-colors">
            <span className="text-lg shrink-0">{isTrail ? "\u26F0\uFE0F" : "\uD83C\uDFC3"}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{a.name ?? (isTrail ? t("trailRun") : t("run"))}</div>
              <div className="text-xs text-muted-foreground">
                {shortDate(a.start_date_local, locale, { day: true, month: "short", year: "2-digit" })}
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
