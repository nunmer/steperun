export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { getRunnerFull } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getBalance } from "@/lib/services/coins";
import { RunnerStatLine, Monogram } from "@/components/runner-stats";
import { PageHeader, Place } from "@/components/sheet";
import { CoinBalance } from "@/components/coin-balance";
import {
  getValidAccessToken,
  fetchAthleteActivities,
  type StravaActivity,
} from "@/lib/services/strava";
import { TrainingTab } from "@/components/training-tab";
import { isRun } from "@/lib/services/training-analytics";

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
        stravaActivities = await fetchAthleteActivities(accessToken, { perPage: 200 });
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
        const yearA = a.events?.year ?? 0;
        const yearB = b.events?.year ?? 0;
        return (yearB - yearA) || (a.events?.name?.localeCompare(b.events?.name) ?? 0);
      });

      const eloRanks = { cityRank, countryRank };

      return (
        <div className="space-y-8">
          <PageHeader
            kicker="My profile"
            title={
              <span className="flex items-center gap-4">
                <Monogram name={runner.full_name} src={user.user_metadata?.avatar_url} className="hidden sm:flex size-16" />
                <span className="min-w-0">{runner.full_name}</span>
              </span>
            }
            aside={
              <div className="flex flex-col sm:items-end gap-2">
                <span className="text-foreground"><Place city={runner.city} country={runner.country} /></span>
                <div className="flex items-center gap-3">
                  {claimStatus === "approved"
                    ? <Link href={`/runners/${runner.id}`} className="text-xs underline underline-offset-4">Public page</Link>
                    : <Badge variant="outline" className="text-xs text-muted-foreground">Claim pending review</Badge>
                  }
                  <CoinBalance amount={coins} />
                </div>
              </div>
            }
          />

          <RunnerStatLine
            elo={runner.elo_score && runner.elo_level
              ? { score: runner.elo_score, level: runner.elo_level, cityRank: eloRanks.cityRank, countryRank: eloRanks.countryRank }
              : null}
            city={runner.city}
            country={runner.country}
            races={results.length}
            seasons={new Set(results.map((r) => r.events?.year)).size}
            distances={new Set(results.map((r) => r.distance_category)).size}
          />


          <Tabs className="mt-10" defaultValue={stravaStatus === "connected" ? "trainings" : "races"}>
            <TabsList>
              <TabsTrigger value="races">
                Official races
                <span className="time text-xs text-muted-foreground">{results.length}</span>
              </TabsTrigger>
              <TabsTrigger value="trainings" className="gap-2">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="#FC4C02">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Trainings
                {stravaToken && (
                  <span className="time text-xs text-muted-foreground">{stravaActivities.filter(isRun).length}</span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="races" className="mt-4">
              <div>
                <div>
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
                        const event = r.events;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium whitespace-normal">
                              <Link href={`/events/${event?.slug}`} className="hover:text-primary">
                                {event?.name}
                              </Link>
                              <div className="text-xs text-muted-foreground">{event?.year}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{r.distance_category}</TableCell>
                            <TableCell className="time text-sm text-muted-foreground">{r.place ? r.place.toLocaleString() : "—"}</TableCell>
                            <TableCell className="time text-sm">{r.chip_time ?? r.finish_time ?? "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="trainings" className="mt-4">
              <TrainingTab stravaToken={stravaToken} stravaStatus={stravaStatus} activities={stravaActivities} />
            </TabsContent>
          </Tabs>
        </div>
      );
    }
  }

  // No claimed runner — show basic account info
  const name = user.user_metadata?.full_name as string | undefined;
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="My profile"
        title={
          <span className="flex items-center gap-4">
            <Monogram name={name ?? "Runner"} src={avatar} className="hidden sm:flex size-16" />
            <span className="min-w-0">{name ?? "Runner"}</span>
          </span>
        }
        aside={
          <div className="flex flex-col sm:items-end gap-2">
            <span>{user.email}</span>
            {coins > 0 && <CoinBalance amount={coins} />}
          </div>
        }
      />

      <div className="border-2 border-rule p-4 sm:p-5 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="headline text-2xl">Claim your race history</p>
          <p className="text-sm text-muted-foreground mt-1">
            Find your name among the results and claim it. Your finishes, PBs and power score then live here.
          </p>
        </div>
        <Link href="/runners" className="h-10 px-4 shrink-0 inline-flex items-center rounded-sm bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
          Find my name →
        </Link>
      </div>

      <TrainingTab stravaToken={stravaToken} stravaStatus={stravaStatus} activities={stravaActivities} />

    </div>
  );
}

