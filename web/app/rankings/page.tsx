import Link from "next/link";
import {
  getDistanceOptions, getEventYears, getRankingsOverview, getRankingsPage,
  MAIN_DISTANCES, PAGE_SIZE, type RankingRow,
} from "@/lib/queries";
import { parseIntInRange, parsePage } from "@/lib/params";
import { Pagination, buildHref } from "@/components/pagination";
import { DistanceSelect } from "@/components/distance-select";
import { EmptyState, FilterLink, FilterRow, PageHeader, Place, Rank } from "@/components/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Rankings" };
export const revalidate = 86400;

const OVERVIEW_SIZE = 10;
const CHIP_COUNT = 8;

/** Compact leaderboard for the overview: rank, name, time. Event on hover/title. */
function Board({ distance, rows, year }: { distance: string; rows: RankingRow[]; year?: number }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-2 border-b-2 border-rule pb-1.5">
        <h2 className="headline text-3xl">{distance}</h2>
        <Link
          href={buildHref("/rankings", { distance, year })}
          className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
        >
          Full list →
        </Link>
      </div>
      <ol>
        {rows.map((row, i) => (
          <li
            key={`${row.runners.id}-${row.distance_category}`}
            className="grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-3 border-b py-2"
          >
            <Rank n={i + 1} />
            <span className="min-w-0">
              <Link href={`/runners/${row.runners.id}`} className="block truncate text-sm font-medium hover:text-primary">
                {row.runners.full_name}
              </Link>
              <Link
                href={`/events/${row.events.slug}`}
                className="block truncate text-xs text-muted-foreground hover:text-foreground"
              >
                {row.events.name}
              </Link>
            </span>
            <span className="time text-sm font-medium">{row.chip_time ?? "—"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RankingTable({ rows, offset }: { rows: RankingRow[]; offset: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Runner</TableHead>
          <TableHead className="hidden md:table-cell">From</TableHead>
          <TableHead className="hidden sm:table-cell">Race</TableHead>
          <TableHead className="text-right">Chip</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={`${row.runners.id}-${row.distance_category}`}>
            <TableCell><Rank n={offset + i + 1} /></TableCell>
            <TableCell className="whitespace-normal">
              <Link href={`/runners/${row.runners.id}`} className="font-medium hover:text-primary">
                {row.runners.full_name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground hidden md:table-cell">
              <Place city={row.runners.city} country={row.runners.country} />
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Link href={`/events/${row.events.slug}`} className="text-muted-foreground hover:text-foreground">
                {row.events.name}
              </Link>
            </TableCell>
            <TableCell className="time text-right font-medium">{row.chip_time ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ distance?: string; year?: string; page?: string }>;
}) {
  const { distance: distParam, year: yearParam, page: pageParam } = await searchParams;
  const [options, years] = await Promise.all([getDistanceOptions(), getEventYears()]);
  const year = parseIntInRange(yearParam, 2000, 2100);
  const known = new Set(options.map((o) => o.label));
  const distance = distParam && (known.has(distParam) || options.length === 0) ? distParam : undefined;

  // Main road distances first, then the most popular others.
  const chips = [...new Set([...MAIN_DISTANCES.filter((d) => known.has(d)), ...options.map((o) => o.label)])]
    .slice(0, CHIP_COUNT);

  let body: React.ReactNode;
  let aside: React.ReactNode = "Best chip time per runner";
  if (!distance) {
    const groups = (await getRankingsOverview(OVERVIEW_SIZE, year)).filter((g) => g.rows.length > 0);
    body = groups.length === 0 ? (
      <EmptyState>No results for this season.</EmptyState>
    ) : (
      <div className="grid gap-10 lg:grid-cols-3 lg:gap-8">
        {groups.map((g) => <Board key={g.distance} distance={g.distance} rows={g.rows} year={year} />)}
      </div>
    );
  } else {
    const requested = parsePage(pageParam);
    let { rows, total } = await getRankingsPage(distance, year, requested);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(requested, totalPages);
    if (page !== requested) ({ rows, total } = await getRankingsPage(distance, year, page));
    aside = (
      <span>
        <span className="time text-foreground">{total.toLocaleString()}</span> runners
        {year ? ` · ${year}` : " · all-time"}
      </span>
    );
    body = (
      <div className="space-y-6">
        {rows.length === 0 ? (
          <EmptyState>No results for this distance.</EmptyState>
        ) : (
          <RankingTable rows={rows} offset={(page - 1) * PAGE_SIZE} />
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          href={(p) => buildHref("/rankings", { distance, year, page: p })}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={distance ?? "Rankings"} kicker={distance ? "Rankings" : undefined} aside={aside} />

      <div className="mb-8">
        <FilterRow label="Distance">
          <FilterLink href={buildHref("/rankings", { year })} active={!distance}>Overview</FilterLink>
          {chips.map((d) => (
            <FilterLink key={d} href={buildHref("/rankings", { distance: d, year })} active={distance === d}>
              {d}
            </FilterLink>
          ))}
          {options.length > chips.length && (
            <DistanceSelect
              options={options}
              value={distance && !chips.includes(distance) ? distance : undefined}
              year={year}
            />
          )}
        </FilterRow>
        <FilterRow label="Season">
          <FilterLink href={buildHref("/rankings", { distance })} active={!year}>All-time</FilterLink>
          {years.map((y) => (
            <FilterLink key={y} href={buildHref("/rankings", { distance, year: y })} active={year === y}>
              {y}
            </FilterLink>
          ))}
        </FilterRow>
      </div>

      {body}
    </div>
  );
}
