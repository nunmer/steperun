export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { getRunnerFull } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getBalance } from "@/lib/services/coins";
import { EloCard, StatCard } from "@/components/elo-badge";
import { CoinBalance } from "@/components/coin-balance";
import {
  getValidAccessToken,
  fetchAthleteActivities,
  type StravaActivity,
} from "@/lib/services/strava";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ strava?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/");

  const { strava: stravaStatus } = await searchParams;


  const [{ data: claim }, { data: stravaToken }] = await Promise.all([
    supabase
      .from("runner_claims")
      .select("runner_id, status")
      .eq("user_id", user.id)
      .in("status", ["approved", "pending"])
      .order("created_at", { ascending: false })
      .maybeSingle(),
    supabase
      .from("strava_tokens")
      .select("athlete_id, connected_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const coins = await getBalance(user.id);

  // Fetch Strava activities if connected
  let stravaActivities: StravaActivity[] = [];
  if (stravaToken) {
    try {
      const accessToken = await getValidAccessToken(user.id);
      if (accessToken) {
        stravaActivities = await fetchAthleteActivities(accessToken, { perPage: 30 });
      }
    } catch {
      // Strava API error — show connect card without activities
    }
  }

  // Has a claimed runner — show full runner profile
  if (claim) {
    const { runner_id, status: claimStatus } = claim as { runner_id: number; status: string };
    const data = await getRunnerFull(runner_id);
    if (data) {
      const { runner, results, cityRank, countryRank } = data;

      const history = [...results].sort((a, b) => {
        const yearA = (a.events as any)?.year ?? 0;
        const yearB = (b.events as any)?.year ?? 0;
        return (yearB - yearA) || ((a.events as any)?.name?.localeCompare((b.events as any)?.name) ?? 0);
      });

      const eloRanks = { cityRank, countryRank };

      return (
        <div className="space-y-8">
          {/* Header: avatar, name, badges, coins */}
          <div className="flex items-start gap-4 sm:gap-6">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={runner.full_name}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center text-xl sm:text-2xl font-bold text-muted-foreground shrink-0">
                {runner.full_name[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">{runner.full_name}</h1>
                <CoinBalance amount={coins} />
              </div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {runner.country && <Badge variant="secondary">{runner.country}</Badge>}
                {runner.city && <Badge variant="outline">{runner.city}</Badge>}
                {claimStatus === "approved"
                  ? <Badge variant="secondary" className="text-xs">Claimed</Badge>
                  : <Badge variant="outline" className="text-xs text-muted-foreground">Pending review</Badge>
                }
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {runner.elo_score && runner.elo_level && (
              <EloCard
                score={runner.elo_score}
                level={runner.elo_level}
                cityRank={eloRanks.cityRank}
                countryRank={eloRanks.countryRank}
                city={runner.city}
                country={runner.country}
              />
            )}
            <StatCard value={results.length} label="Races completed" />
            <StatCard
              value={new Set(results.map((r) => (r.events as any)?.year)).size}
              label="Active seasons"
            />
            <StatCard
              value={new Set(results.map((r) => r.distance_category)).size}
              label="Distances run"
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Race history */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                Race History
                <Badge variant="outline" className="ml-auto text-xs font-mono">{results.length} races</Badge>
              </h2>
              <div className="rounded-lg border overflow-hidden">
                <div className="max-h-[480px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Distance</TableHead>
                        <TableHead>Place</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((r, i) => {
                        const event = r.events as any;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              <Link href={`/events/${event?.slug}`} className="hover:underline">
                                {event?.name}
                              </Link>
                              <div className="text-xs text-muted-foreground">{event?.year}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{r.distance_category}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{r.place ? `#${r.place}` : "—"}</TableCell>
                            <TableCell className="font-mono tabular-nums text-sm">{r.chip_time ?? r.finish_time ?? "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </section>

            {/* Strava */}
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="#FC4C02">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Strava
              </h2>
              <StravaCard stravaToken={stravaToken} stravaStatus={stravaStatus} activities={stravaActivities} />
            </section>
          </div>
        </div>
      );
    }
  }

  // No claimed runner — show basic account info
  const name = user.user_metadata?.full_name as string | undefined;
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4 sm:gap-6">
        {avatar ? (
          <img
            src={avatar}
            alt={name ?? "Profile"}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center text-xl sm:text-2xl font-bold text-muted-foreground shrink-0">
            {name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold">{name ?? "Runner"}</h1>
            {coins > 0 && <CoinBalance amount={coins} />}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
        </div>
      </div>

      <StravaCard stravaToken={stravaToken} stravaStatus={stravaStatus} activities={stravaActivities} />

      <Card>
        <CardContent className="pt-6 pb-6 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t claimed a runner profile yet. Find your name in our database and claim your race history.
          </p>
          <Link href="/runners" className="text-sm font-medium underline hover:text-foreground w-fit">
            Find your profile →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(2) + " km";
}

function formatPace(meters: number, seconds: number): string {
  if (meters === 0) return "--";
  const paceSeconds = seconds / (meters / 1000);
  const m = Math.floor(paceSeconds / 60);
  const s = Math.round(paceSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

function activityIcon(type: string): string {
  switch (type) {
    case "Run": return "\uD83C\uDFC3";
    case "TrailRun": return "\u26F0\uFE0F";
    case "Ride": case "VirtualRide": return "\uD83D\uDEB4";
    case "Swim": return "\uD83C\uDFCA";
    case "Walk": case "Hike": return "\uD83D\uDEB6";
    default: return "\uD83C\uDFCB\uFE0F";
  }
}

function StravaCard({
  stravaToken,
  stravaStatus,
  activities,
}: {
  stravaToken: { athlete_id: number; connected_at: string } | null;
  stravaStatus?: string;
  activities: StravaActivity[];
}) {
  const connected = !!stravaToken;
  const runActivities = activities.filter((a) => a.type === "Run" || a.type === "TrailRun");
  const allActivities = activities.slice(0, 20);

  // Weekly summary from running activities
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = runActivities.filter((a) => new Date(a.start_date_local).getTime() > weekAgo);
  const weeklyKm = thisWeek.reduce((sum, a) => sum + a.distance, 0) / 1000;
  const weeklyTime = thisWeek.reduce((sum, a) => sum + a.moving_time, 0);

  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        {stravaStatus === "connected" && (
          <div className="mb-3 rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-600">
            Strava connected successfully! +20 coins earned.
          </div>
        )}
        {stravaStatus === "denied" && (
          <div className="mb-3 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-500">
            Strava connection was denied.
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <svg viewBox="0 0 24 24" className="w-8 h-8 shrink-0" fill="#FC4C02">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Strava</div>
            {connected ? (
              <p className="text-xs text-muted-foreground">
                Connected · Athlete #{stravaToken.athlete_id}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Connect to verify your race results and earn trust score
              </p>
            )}
          </div>
          {connected ? (
            <Badge variant="secondary" className="text-xs shrink-0">Connected</Badge>
          ) : (
            <Link
              href="/api/auth/strava/connect"
              className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#FC4C02] hover:bg-[#e04400] transition-colors"
            >
              Connect
            </Link>
          )}
        </div>

        {/* Weekly summary */}
        {connected && runActivities.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-lg font-bold tabular-nums">{thisWeek.length}</div>
                <div className="text-[11px] text-muted-foreground">Runs this week</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-lg font-bold tabular-nums">{weeklyKm.toFixed(1)}</div>
                <div className="text-[11px] text-muted-foreground">km this week</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-lg font-bold tabular-nums">{weeklyTime > 0 ? formatDuration(weeklyTime) : "0m"}</div>
                <div className="text-[11px] text-muted-foreground">Time this week</div>
              </div>
            </div>

            <Separator className="mb-4" />

            {/* Recent activities */}
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Recent Activities
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {allActivities.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-lg shrink-0">{activityIcon(a.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{a.type === "TrailRun" ? "Trail Run" : a.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.start_date_local).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono tabular-nums">{formatDistance(a.distance)}</div>
                    <div className="text-xs text-muted-foreground font-mono tabular-nums">
                      {(a.type === "Run" || a.type === "TrailRun") ? formatPace(a.distance, a.moving_time) : formatDuration(a.moving_time)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {connected && allActivities.length === 0 && (
          <p className="text-sm text-muted-foreground">No recent activities found.</p>
        )}
      </CardContent>
    </Card>
  );
}
