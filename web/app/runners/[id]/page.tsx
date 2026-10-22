import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRunnerFull } from "@/lib/queries";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClaimButton } from "@/components/claim-button";
import { BackLink, PageHeader, Place } from "@/components/sheet";
import { RunnerStatLine } from "@/components/runner-stats";
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
  const pbKeys = new Set(pbs.map(([, r]) => r));

  // Race history: newest season first, then event name.
  const history = [...results].sort((a, b) => {
    const yearA = a.events?.year ?? 0;
    const yearB = b.events?.year ?? 0;
    return (yearB - yearA) || (a.events?.name?.localeCompare(b.events?.name ?? "") ?? 0);
  });

  const finishes = results.filter((r) => bestTime(r));
  const seasons = new Set(finishes.map((r) => r.events?.year)).size;

  return (
    <div>
      <PageHeader
        kicker={<BackLink href="/runners">Runners</BackLink>}
        title={runner.full_name}
        aside={
          <div className="flex flex-col sm:items-end gap-2">
            <span className="text-foreground"><Place city={runner.city} country={runner.country} /></span>
            <ClaimButton runnerId={runner.id} claimedBy={runner.claimed_by ?? null} />
          </div>
        }
      />

      <RunnerStatLine
        elo={runner.elo_score && runner.elo_level
          ? { score: runner.elo_score, level: runner.elo_level, cityRank, countryRank }
          : null}
        city={runner.city}
        country={runner.country}
        races={finishes.length}
        seasons={seasons}
        distances={pbs.length}
      />

      {/* Personal bests are the headline of a runner's page: big times, one per distance. */}
      {pbs.length > 0 && (
        <section className="mt-12">
          <h2 className="headline text-4xl border-b-2 border-rule pb-2">Personal bests</h2>
          <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {pbs.map(([cat, r]) => (
              <li key={cat} className="border-b py-4 min-[420px]:odd:pr-4 lg:pr-4">
                <p className="eyebrow">{cat}</p>
                <p className="time text-3xl sm:text-4xl font-medium mt-1 tracking-tight">{bestTime(r)}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  <Link href={`/events/${r.events?.slug}`} className="hover:text-foreground underline-offset-2 hover:underline">
                    {r.events?.name}
                  </Link>
                  {r.place ? <> · place {r.place.toLocaleString()}</> : null}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <div className="flex items-end justify-between border-b-2 border-rule pb-2">
          <h2 className="headline text-4xl">Race history</h2>
          <span className="time text-xs text-muted-foreground">{results.length} starts</span>
        </div>
        <Table>
          <TableHeader className="sr-only sm:table-header-group">
            <TableRow>
              <TableHead>Race</TableHead>
              <TableHead className="hidden sm:table-cell">Distance</TableHead>
              <TableHead className="text-right">Pl.</TableHead>
              <TableHead className="text-right">Chip</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Gun</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((r, i) => {
              const event = r.events;
              const newYear = i === 0 || history[i - 1].events?.year !== event?.year;
              const isPb = pbKeys.has(r);
              return (
                <Fragment key={i}>
                  {newYear && (
                    <TableRow className="hover:bg-transparent border-b-rule">
                      <TableCell colSpan={5} className="pt-6 pb-1">
                        <span className="headline text-2xl text-muted-foreground">{event?.year ?? "—"}</span>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell className="whitespace-normal">
                      <Link href={`/events/${event?.slug}`} className="font-medium hover:text-primary">
                        {event?.name}
                      </Link>
                      <span className="block sm:hidden text-xs text-muted-foreground">{r.distance_category}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">{r.distance_category}</TableCell>
                    <TableCell className="time text-right text-muted-foreground text-sm">
                      {r.place ? r.place.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="time text-right">
                      {isPb && <span className="eyebrow !text-primary mr-2">PB</span>}
                      <span className={isPb ? "font-semibold" : undefined}>{showTime(r.chip_time)}</span>
                    </TableCell>
                    <TableCell className="time text-right text-muted-foreground hidden sm:table-cell">
                      {showTime(r.finish_time)}
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
