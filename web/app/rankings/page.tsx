import Link from "next/link";
import { getRankings, getDistanceOptions, getEventYears } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Rankings" };
export const revalidate = 3600;

// Medal colours for top 3
const medal: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ distance?: string; year?: string }>;
}) {
  const { distance: distParam, year: yearParam } = await searchParams;

  // "all" is the default (no distance param = all distances)
  const isAll = !distParam;
  const distance = distParam; // undefined means "All"
  const year = yearParam ? Number(yearParam) : undefined;

  // Run all three queries in parallel — no waterfall
  const [allDistances, years, rows] = await Promise.all([
    getDistanceOptions(),
    getEventYears(),
    getRankings({ distance, year, limit: 100 }),
  ]);

  // For "All" mode, assign ranks per distance group
  type RankedRow = (typeof rows)[number] & { rank: number };
  const rankedRows: RankedRow[] = [];

  if (isAll) {
    // Rows are interleaved (1st 42km, 1st 21km, 1st 10km, 2nd 42km, ...)
    // Track rank per distance
    const distRank = new Map<string, number>();
    for (const row of rows) {
      const dist = row.distance_category ?? "";
      const rank = (distRank.get(dist) ?? 0) + 1;
      distRank.set(dist, rank);
      rankedRows.push({ ...row, rank });
    }
  } else {
    rows.forEach((row, i) => rankedRows.push({ ...row, rank: i + 1 }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold">Rankings</h1>
        <p className="text-muted-foreground text-sm">Best chip time per runner</p>
      </div>

      {/* Distance filter */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Distance
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/rankings${year ? `?year=${year}` : ""}`}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              isAll
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            All
          </Link>
          {allDistances.slice(0, 12).map((d) => (
            <Link
              key={d}
              href={`/rankings?distance=${encodeURIComponent(d)}${year ? `&year=${year}` : ""}`}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                distParam === d
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {d}
            </Link>
          ))}
        </div>
      </div>

      {/* Year filter */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Season
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/rankings${distParam ? `?distance=${encodeURIComponent(distParam)}` : ""}`}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              !year ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
            }`}
          >
            All-time
          </Link>
          {years.map((y) => (
            <Link
              key={y}
              href={`/rankings?${distParam ? `distance=${encodeURIComponent(distParam)}&` : ""}year=${y}`}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                year === y
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      {rankedRows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No results found.</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Runner</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead className="hidden sm:table-cell">Country</TableHead>
                <TableHead className="hidden md:table-cell">City</TableHead>
                <TableHead>Best time</TableHead>
                <TableHead className="hidden sm:table-cell">Event</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedRows.map((row, i) => {
                  const runner = row.runners as any;
                  const event = row.events as any;
                  const rank = row.rank;
                  const dist = row.distance_category ?? "";

                  return (
                      <TableRow key={`${runner?.id}-${dist}-${i}`} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-muted-foreground text-sm">
                          {medal[rank] ?? rank}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/runners/${runner?.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {runner?.full_name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {dist}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{runner?.country}</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{runner?.city}</TableCell>
                        <TableCell className="font-mono font-semibold tabular-nums text-[#22c55e]">
                          {row.chip_time && row.chip_time !== "--:--:--" ? row.chip_time : "—"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Link
                            href={`/events/${event?.slug}`}
                            className="text-muted-foreground hover:text-primary hover:underline text-sm"
                          >
                            {event?.name}
                            {event?.year && (
                              <Badge variant="outline" className="ml-1 text-xs">
                                {event.year}
                              </Badge>
                            )}
                          </Link>
                        </TableCell>
                      </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
