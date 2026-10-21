import Link from "next/link";
import {
  getDistanceOptions, getEventYears, getRankingsOverview, getRankingsPage,
  MAIN_DISTANCES, PAGE_SIZE, type RankingRow,
} from "@/lib/queries";
import { parseIntInRange, parsePage } from "@/lib/params";
import { Pagination, buildHref } from "@/components/pagination";
import { DistanceSelect } from "@/components/distance-select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Rankings" };
export const revalidate = 86400;

const OVERVIEW_SIZE = 10;
const CHIP_COUNT = 8;
const medal: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function chipClass(active: boolean) {
  return `px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
    active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
  }`;
}

function RankingTable({ rows, offset = 0 }: { rows: RankingRow[]; offset?: number }) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Runner</TableHead>
            <TableHead className="hidden sm:table-cell">Country</TableHead>
            <TableHead className="hidden md:table-cell">City</TableHead>
            <TableHead>Best time</TableHead>
            <TableHead className="hidden sm:table-cell">Event</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const rank = offset + i + 1;
            return (
              <TableRow key={`${row.runners.id}-${row.distance_category}`} className="hover:bg-muted/50">
                <TableCell className="font-mono text-muted-foreground text-sm">{medal[rank] ?? rank}</TableCell>
                <TableCell className="font-medium">
                  <Link href={`/runners/${row.runners.id}`} className="hover:text-primary hover:underline">
                    {row.runners.full_name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{row.runners.country}</TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">{row.runners.city}</TableCell>
                <TableCell className="font-mono font-semibold tabular-nums text-[#22c55e]">{row.chip_time ?? "—"}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Link
                    href={`/events/${row.events.slug}`}
                    className="text-muted-foreground hover:text-primary hover:underline text-sm"
                  >
                    {row.events.name}
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
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
  if (!distance) {
    const groups = await getRankingsOverview(OVERVIEW_SIZE, year);
    body = (
      <div className="space-y-8">
        {groups.filter((g) => g.rows.length > 0).map((g) => (
          <section key={g.distance} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{g.distance}</h2>
              <Link
                href={buildHref("/rankings", { distance: g.distance, year })}
                className="text-sm text-primary hover:underline"
              >
                Full ranking →
              </Link>
            </div>
            <RankingTable rows={g.rows} />
          </section>
        ))}
        {groups.every((g) => g.rows.length === 0) && (
          <p className="text-muted-foreground py-12 text-center">No results found.</p>
        )}
      </div>
    );
  } else {
    const requested = parsePage(pageParam);
    let { rows, total } = await getRankingsPage(distance, year, requested);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(requested, totalPages);
    if (page !== requested) ({ rows, total } = await getRankingsPage(distance, year, page));
    body = (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} runners ranked by their best chip time{year ? ` in ${year}` : ""}.
        </p>
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center">No results found.</p>
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold">Rankings</h1>
        <p className="text-muted-foreground text-sm">Best chip time per runner</p>
      </div>

      {/* Distance filter */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Distance</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={buildHref("/rankings", { year })} className={chipClass(!distance)}>All</Link>
          {chips.map((d) => (
            <Link key={d} href={buildHref("/rankings", { distance: d, year })} className={chipClass(distance === d)}>
              {d}
            </Link>
          ))}
          {options.length > chips.length && (
            <DistanceSelect
              options={options}
              value={distance && !chips.includes(distance) ? distance : undefined}
              year={year}
            />
          )}
        </div>
      </div>

      {/* Year filter */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Season</p>
        <div className="flex flex-wrap gap-2">
          <Link href={buildHref("/rankings", { distance })} className={chipClass(!year)}>All-time</Link>
          {years.map((y) => (
            <Link key={y} href={buildHref("/rankings", { distance, year: y })} className={chipClass(year === y)}>
              {y}
            </Link>
          ))}
        </div>
      </div>

      {body}
    </div>
  );
}
