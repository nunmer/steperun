import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getPowerRankings, getEloStats, PAGE_SIZE } from "@/lib/queries";
import { parseIntInRange, parsePage } from "@/lib/params";
import { eloLevel, nextLevel, MAX_LEVEL, TIER_COLOR } from "@/lib/elo-levels";
import { TierBadge } from "@/components/tier-badge";
import { Pagination, buildHref } from "@/components/pagination";
import { EmptyState, PageHeader, Place, Rank } from "@/components/sheet";
import { cn, formatNumber } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export async function generateMetadata() {
  const t = await getTranslations("rankings.power");
  return { title: t("title") };
}
const CHALLENGER_CUTOFF = 1000;

/**
 * How runners spread across the ten tiers. Each bar is also the filter for
 * its tier, so the chart replaces a separate row of level chips.
 * Columns on wide screens, rows on phones.
 */
async function LevelDistribution({ stats, active }: { stats: { level: number; count: number }[]; active?: number }) {
  const [t, locale] = await Promise.all([getTranslations("rankings.power"), getLocale()]);
  const largest = Math.max(...stats.map((s) => s.count), 1);
  const ordered = [...stats].sort((a, b) => a.level - b.level);
  const href = (lvl: number) => (active === lvl ? "/power-rankings" : `/power-rankings?level=${lvl}`);
  // Each tier's bar wears its own colour, so the chart reads as a ladder that
  // warms up toward Grandmaster. Filtering dims the other tiers.
  const bar = (lvl: number) => ({
    background: TIER_COLOR[eloLevel(lvl).tone],
    opacity: active && active !== lvl ? 0.2 : 1,
  });

  return (
    <nav aria-label={t("filterAria")} className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <span className="eyebrow">{t("perLevel")}</span>
        {active && (
          <Link href="/power-rankings" className="text-xs text-muted-foreground hover:text-foreground">
            {t("clear")}
          </Link>
        )}
      </div>

      {/* sm+: histogram */}
      <ol className="hidden sm:grid grid-cols-10 gap-2 items-end border-b border-rule">
        {ordered.map(({ level, count }) => {
          return (
            <li key={level}>
              <Link href={href(level)} aria-current={active === level ? "true" : undefined} className="group block">
                <span className="time block text-xs text-center mb-1">{formatNumber(count, locale)}</span>
                <span className="flex h-28 flex-col justify-end">
                  {/* the top tier is an ink bar capped in bib orange, like its badge */}
                  {level === MAX_LEVEL && (
                    <span
                      aria-hidden
                      className="block h-1 w-full shrink-0 bg-primary transition-opacity group-hover:!opacity-100"
                      style={{ opacity: bar(level).opacity }}
                    />
                  )}
                  <span
                    className="block w-full shrink-0 transition-opacity group-hover:!opacity-100"
                    style={{ ...bar(level), height: `${Math.max(3, (count / largest) * 100)}%` }}
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
                  <span className="block h-full" style={{ ...bar(level), width: `${Math.max(1, (count / largest) * 100)}%` }} />
                </span>
                <span className="time text-xs text-right">{formatNumber(count, locale)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Under a tier's title: its badge, and the step below and above it, so the
 * page shows the way up rather than only who is there.
 */
async function TierLadder({ level }: { level: number }) {
  const t = await getTranslations("rankings.power");
  const prev = level > 1 ? eloLevel(level - 1) : null;
  const next = nextLevel(eloLevel(level).min, level);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <TierBadge level={level} size="md" />
      {prev && (
        <Link href={`/power-rankings?level=${level - 1}`} className="text-muted-foreground hover:text-foreground">
          ← {prev.name}
        </Link>
      )}
      {next ? (
        <Link href={`/power-rankings?level=${next.level}`} className="hover:text-primary">
          {t.rich("nextUp", {
            name: next.name,
            min: next.min,
            b: (chunks) => <span className="font-semibold">{chunks}</span>,
            m: (chunks) => <span className="time text-xs text-muted-foreground">{chunks}</span>,
          })}
        </Link>
      ) : (
        <span className="eyebrow !text-primary">{t("topLadder")}</span>
      )}
    </div>
  );
}

export default async function PowerRankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; page?: string }>;
}) {
  const { level: levelParam, page: pageParam } = await searchParams;
  const level = parseIntInRange(levelParam, 1, MAX_LEVEL);
  const t = await getTranslations("rankings.power");

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
        title={level ? eloLevel(level).name : t("title")}
        kicker={level ? t("kicker", { level: String(level), range: eloLevel(level).range }) : undefined}
        aside={
          <span className="max-w-xs inline-block">
            {t("aside")}
            {!level && t("asideTop", { n: CHALLENGER_CUTOFF })}
          </span>
        }
      >
        {level && <TierLadder level={level} />}
      </PageHeader>

      <LevelDistribution stats={eloStats} active={level} />

      {runners.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>{t("colRunner")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("colFrom")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("colLevel")}</TableHead>
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
                    <Link
                      href={`/runners/${runner.id}`}
                      className={cn("hover:text-primary", (runner.elo_level ?? 1) >= MAX_LEVEL - 1 ? "font-semibold" : "font-medium")}
                    >
                      {runner.full_name}
                    </Link>
                    {isChallenger && (
                      <span className="eyebrow !text-primary ml-2 hidden sm:inline">Challenger</span>
                    )}
                    <TierBadge level={runner.elo_level} className="flex w-fit mt-1 sm:hidden" />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    <Place city={runner.city} country={runner.country} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="time text-xs text-muted-foreground mr-2">L{runner.elo_level}</span>
                    <TierBadge level={runner.elo_level} />
                  </TableCell>
                  <TableCell
                    className={cn("time text-right font-semibold", (runner.elo_level ?? 1) >= MAX_LEVEL - 1 && "text-primary")}
                  >
                    {runner.elo_score ?? "—"}
                  </TableCell>
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
          label={t("runners", { count: total })}
          href={(p) => buildHref("/power-rankings", { level, page: p })}
        />
      </div>
    </div>
  );
}
