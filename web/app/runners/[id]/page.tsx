import Link from "next/link";
import { notFound } from "next/navigation";
import { getRunnerFull } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EloCard, StatCard } from "@/components/elo-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClaimButton } from "@/components/claim-button";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRunnerFull(Number(id));
  return { title: data?.runner.full_name ?? "Runner" };
}

// Parse "HH:MM:SS" or "MM:SS" into total seconds for comparison
function toSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Infinity;
}

// Derive personal bests: best chip_time per distance_category
function getPersonalBests(results: NonNullable<Awaited<ReturnType<typeof getRunnerFull>>>["results"]) {
  const bests = new Map<string, (typeof results)[0]>();
  for (const r of results) {
    const cat = r.distance_category ?? "Unknown";
    const cur = bests.get(cat);
    if (!cur || (r.chip_time && (!cur.chip_time || toSeconds(r.chip_time) < toSeconds(cur.chip_time)))) {
      bests.set(cat, r);
    }
  }
  return [...bests.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default async function RunnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRunnerFull(Number(id));
  if (!data) notFound();

  const { runner, results, cityRank, countryRank } = data;
  const pbs = getPersonalBests(results);

  // Sort race history by year desc, then event name
  const history = [...results].sort((a, b) => {
    const yearA = (a.events as any)?.year ?? 0;
    const yearB = (b.events as any)?.year ?? 0;
    return (yearB - yearA) || ((a.events as any)?.name?.localeCompare((b.events as any)?.name) ?? 0);
  });

  const totalRaces = results.length;
  const uniqueYears = new Set(results.map((r) => (r.events as any)?.year)).size;
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
                  const event = r.events as any;
                  return (
                    <TableRow key={cat}>
                      <TableCell className="font-medium">{cat}</TableCell>
                      <TableCell className="font-mono font-semibold tabular-nums text-[#22c55e]">
                        {r.chip_time ?? r.finish_time ?? "—"}
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
                const event = r.events as any;
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
                    <TableCell className="font-mono tabular-nums">{r.finish_time ?? "—"}</TableCell>
                    <TableCell className="font-mono tabular-nums text-muted-foreground hidden sm:table-cell">
                      {r.chip_time ?? "—"}
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
