import Link from "next/link";
import { getPowerRankings, getEloStats, PAGE_SIZE } from "@/lib/queries";
import { parseIntInRange, parsePage } from "@/lib/params";
import { eloLevel, MAX_LEVEL } from "@/lib/elo-levels";
import { Pagination, buildHref } from "@/components/pagination";
import { EmptyState, PageHeader, Place, Rank } from "@/components/sheet";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Power Rankings" };
export const revalidate = 86400;

const CHALLENGER_CUTOFF = 1000;

/**
 * How runners spread across the ten tiers. Each bar is also the filter for
 * its tier, so the chart replaces a separate row of level chips.
 * Columns on wide screens, rows on phones.
 */
function LevelDistribution({ stats, active }: { stats: { level: number; count: number }[]; active?: number }) {
  const largest = Math.max(...stats.map((s) => s.count), 1);
  const ordered = [...stats].sort((a, b) => a.level - b.level);
  const href = (lvl: number) => (active === lvl ? "/power-rankings" : `/power-rankings?level=${lvl}`);
  const tone = (lvl: number) =>
    active === lvl ? "bg-primary" : active ? "bg-foreground/20" : lvl >= MAX_LEVEL - 1 ? "bg-primary" : "bg-foreground/70";

  return (
    <nav aria-label="Filter by level" className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <span className="eyebrow">Runners per level — select a bar to filter</span>
        {active && (
          <Link href="/power-rankings" className="text-xs text-muted-foreground hover:text-foreground">
            Clear ×
          </Link>
        )}
      </div>

      {/* sm+: histogram */}
      <ol className="hidden sm:grid grid-cols-10 gap-2 items-end border-b border-rule">
        {ordered.map(({ level, count }) => {
          return (
            <li key={level}>
              <Link href={href(level)} aria-current={active === level ? "true" : undefined} className="group block">
                <span className="time block text-xs text-center mb-1">{count.toLocaleString()}</span>
                <span className="flex h-28 items-end">
                  <span
                    className={cn("w-full transition-colors group-hover:bg-primary", tone(level))}
                    style={{ height: `${Math.max(3, (count / largest) * 100)}%` }}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <ol className="hidden sm:grid grid-cols-10 gap-2 pt-2">
        {ordered.map(({ level }) => {
          const info = eloLevel(level);
          return (
            <li key={level} className="text-center">
              <Link
                href={href(level)}
                className={cn(
                  "block text-xs font-medium leading-tight hover:text-primary",
                  active === level && "text-primary",
                )}
              >
                {info.name}
              </Link>
              <span className="time block text-[10px] text-muted-foreground mt-0.5">{info.range}</span>
            </li>
          );
        })}
      </ol>

      {/* phones: ranked rows, highest tier first */}
      <ol className="sm:hidden border-t border-rule">
        {[...ordered].reverse().map(({ level, count }) => {
          const info = eloLevel(level);
          return (
            <li key={level}>
              <Link
                href={href(level)}
                className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 border-b py-2"
              >
                <span className={cn("text-sm", active === level && "text-primary font-semibold")}>{info.name}</span>
                <span className="h-2 bg-muted">
                  <span className={cn("block h-full", tone(level))} style={{ width: `${(count / largest) * 100}%` }} />
                </span>
                <span className="time text-xs text-right">{count.toLocaleString()}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default async function PowerRankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; page?: string }>;
}) {
  const { level: levelParam, page: pageParam } = await searchParams;
  const level = parseIntInRange(levelParam, 1, MAX_LEVEL);

  // Exact totals from the per-level counts (same numbers as the distribution).
  const eloStats = await getEloStats();
  const total = level
    ? eloStats.find((s) => s.level === level)?.count ?? 0
    : eloStats.reduce((sum, s) => sum + s.count, 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(pageParam), totalPages);
  const runners = await getPowerRankings(level, page);
  const globalRankOffset = (page - 1) * PAGE_SIZE;

  return (
    <div>
      <PageHeader
        title={level ? eloLevel(level).name : "Power rankings"}
        kicker={level ? `Power rankings · Level ${level} · ELO ${eloLevel(level).range}` : undefined}
        aside={
          <span className="max-w-xs inline-block">
            Power score from best times, podiums, consistency, range and seasons.
            {!level && ` The top ${CHALLENGER_CUTOFF.toLocaleString()} are Challengers.`}
          </span>
        }
      />

      <LevelDistribution stats={eloStats} active={level} />

      {runners.length === 0 ? (
        <EmptyState>No runners at this level.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Runner</TableHead>
              <TableHead className="hidden md:table-cell">From</TableHead>
              <TableHead className="hidden sm:table-cell">Level</TableHead>
              <TableHead className="text-right">ELO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runners.map((runner, i) => {
              const rank = globalRankOffset + i + 1;
              const isChallenger = !level && rank <= CHALLENGER_CUTOFF;
              return (
                <TableRow key={runner.id}>
                  <TableCell><Rank n={rank} /></TableCell>
                  <TableCell className="whitespace-normal">
                    <Link href={`/runners/${runner.id}`} className="font-medium hover:text-primary">
                      {runner.full_name}
                    </Link>
                    {isChallenger && (
                      <span className="eyebrow !text-primary ml-2 hidden sm:inline">Challenger</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    <Place city={runner.city} country={runner.country} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    <span className="time text-xs mr-1.5">L{runner.elo_level}</span>
                    {eloLevel(runner.elo_level).name}
                  </TableCell>
                  <TableCell className="time text-right font-semibold">{runner.elo_score ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <div className="mt-6">
        <Pagination
          page={page}
          totalPages={totalPages}
          label={`${total.toLocaleString()} runners`}
          href={(p) => buildHref("/power-rankings", { level, page: p })}
        />
      </div>
    </div>
  );
}
