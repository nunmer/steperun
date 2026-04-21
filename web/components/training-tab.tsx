import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { StravaActivity } from "@/lib/services/strava";
import {
  isRun,
  computeTrainingLoad,
  computeWeekly,
  computeHrZones,
  computeBestEfforts,
  computeConsistency,
  formInterpretation,
  formatPace,
  formatDuration,
  type WeeklyBucket,
  type HrZone,
  type TrainingLoadSummary,
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
          <SectionHeading label="Weekly Load · Last 12 Weeks" pro />
          <WeeklyChart buckets={weekly} />
          <WeeklyDelta current={thisWeek} previous={lastWeek} />
        </CardContent>
      </Card>

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
// Sub-components
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
            Track fitness, form, weekly load, heart-rate zones, and personal bests — automatically synced from your runs.
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

function WeeklyChart({ buckets }: { buckets: WeeklyBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.distance));
  return (
    <div>
      <div className="flex items-end gap-1.5 h-28">
        {buckets.map((b, i) => {
          const h = (b.distance / max) * 100;
          const isCurrent = i === buckets.length - 1;
          return (
            <div key={b.weekStart} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
              <div
                className={`w-full rounded-t-sm transition-all ${
                  isCurrent ? "bg-[#FC4C02]" : "bg-[#22c55e]/70 group-hover:bg-[#22c55e]"
                }`}
                style={{ height: `${Math.max(2, h)}%` }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border rounded px-2 py-1 text-[10px] font-mono whitespace-nowrap z-10 shadow-sm">
                {b.distance.toFixed(1)} km · {b.count} runs
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-mono">
        <span>{new Date(buckets[0].weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <span>{max.toFixed(0)} km peak</span>
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

function HrZonesBar({ zones }: { zones: HrZone[] }) {
  const colors = ["bg-sky-400", "bg-green-400", "bg-amber-400", "bg-orange-500", "bg-red-500"];
  const labels = ["Recovery", "Endurance", "Tempo", "Threshold", "VO₂max"];
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
                {a.average_heartrate && ` · ${Math.round(a.average_heartrate)} bpm`}
                {a.total_elevation_gain && a.total_elevation_gain > 30 && ` · ↑${Math.round(a.total_elevation_gain)}m`}
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
