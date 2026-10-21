import Link from "next/link";
import { notFound } from "next/navigation";
import { getRunnerFull } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EloCard, StatCard } from "@/components/elo-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClaimButton } from "@/components/claim-button";
import { isFinishTime, timeToSeconds } from "@/lib/params";

export const revalidate = 86400;

// No paths at build time; each profile is rendered on first visit, then
// cached (ISR) until revalidated by the scraper or a claim change.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRunnerFull(Number(id));
  return { title: data?.runner.full_name ?? "Runner" };
}

type Result = NonNullable<Awaited<ReturnType<typeof getRunnerFull>>>["results"][number];

/** Chip time, else gun time; null for DNF / DNS ("--:--:--"). */
function bestTime(r: Result): string | null {
  return isFinishTime(r.chip_time) ? r.chip_time : isFinishTime(r.finish_time) ? r.finish_time : null;
}

// Personal bests: fastest finish per distance. DNFs never count.
function getPersonalBests(results: Result[]) {
  const bests = new Map<string, Result>();
  for (const r of results) {
    if (!bestTime(r)) continue;
    const cat = r.distance_category ?? "Unknown";
    const cur = bests.get(cat);
    if (!cur || timeToSeconds(bestTime(r)) < timeToSeconds(bestTime(cur))) bests.set(cat, r);
  }
  return [...bests.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function showTime(t: string | null): string {
  return isFinishTime(t) ? t : t ? "DNF" : "—";
}

export default async function RunnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getRunnerFull(Number(id)) : null;
  if (!data) notFound();

  const { runner, results, cityRank, countryRank } = data;
  const pbs = getPersonalBests(results);

  // Sort race history by year desc, then event name
  const history = [...results].sort((a, b) => {
    const yearA = a.events?.year ?? 0;
    const yearB = b.events?.year ?? 0;
    return (yearB - yearA) || (a.events?.name?.localeCompare(b.events?.name ?? "") ?? 0);
  });

  const finishes = results.filter((r) => bestTime(r));
  const totalRaces = finishes.length;
  const uniqueYears = new Set(finishes.map((r) => r.events?.year)).size;
  const eloRanks = { cityRank, countryRank };

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link href="/runners" className="text-sm text-muted-foreground hover:text-foreground">
        ← All runners
      </Link>

      {/* Profile header */}
      <div className="flex items-start gap-4 sm:gap-6">
        {/* Avatar placeholder */}
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center text-xl sm:text-2xl font-bold text-muted-foreground shrink-0">
          {runner.full_name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">{runner.full_name}</h1>
          <div className="flex gap-2 mt-1 flex-wrap">
            {runner.country && (
              <Badge variant="secondary">{runner.country}</Badge>
            )}
            {runner.city && (
              <Badge variant="outline">{runner.city}</Badge>
            )}
          </div>
          <div className="mt-3">
            <ClaimButton runnerId={runner.id} claimedBy={runner.claimed_by ?? null} />
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
        <StatCard value={totalRaces} label="Races completed" />
        <StatCard value={uniqueYears} label="Active seasons" />
        <StatCard value={pbs.length} label="Distances run" />
      </div>

      {/* Personal Bests */}
      {pbs.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Personal Bests</h2>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Distance</TableHead>
                  <TableHead>Best time</TableHead>
                  <TableHead className="hidden sm:table-cell">Event</TableHead>
                  <TableHead className="hidden sm:table-cell">Year</TableHead>
                  <TableHead>Place</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pbs.map(([cat, r]) => {
                  const event = r.events;
                  return (
                    <TableRow key={cat}>
                      <TableCell className="font-medium">{cat}</TableCell>
                      <TableCell className="font-mono font-semibold tabular-nums text-[#22c55e]">
                        {bestTime(r)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Link
                          href={`/events/${event?.slug}`}
                          className="hover:text-primary hover:underline text-sm"
                        >
                          {event?.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">{event?.year}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.place ? `#${r.place}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <Separator />

      {/* Full race history */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Race history</h2>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead className="hidden sm:table-cell">Year</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Place</TableHead>
                <TableHead>Finish</TableHead>
                <TableHead className="hidden sm:table-cell">Chip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r, i) => {
                const event = r.events;
                return (
                  <TableRow key={i} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Link
                        href={`/events/${event?.slug}`}
                        className="hover:text-primary hover:underline"
                      >
                        {event?.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">{event?.year}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {r.distance_category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.place ? `#${r.place}` : "—"}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">{showTime(r.finish_time)}</TableCell>
                    <TableCell className="font-mono tabular-nums text-muted-foreground hidden sm:table-cell">
                      {showTime(r.chip_time)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
