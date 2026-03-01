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

  const [allDistances, years] = await Promise.all([
    getDistanceOptions(),
    getEventYears(),
  ]);

  // Default to most popular distance (first in list, sorted by result count)
  const defaultDist = allDistances[0] ?? "";
  const distance = distParam ?? defaultDist;
  const year = yearParam ? Number(yearParam) : undefined;

  const rows = await getRankings({ distance, year, limit: 100 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Rankings</h1>
        <p className="text-muted-foreground text-sm">Best chip time per runner</p>
      </div>

      {/* Distance filter */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Distance
        </p>
        <div className="flex flex-wrap gap-2">
          {allDistances.slice(0, 12).map((d) => (
            <Link
              key={d}
              href={`/rankings?distance=${encodeURIComponent(d)}${year ? `&year=${year}` : ""}`}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                d === distance
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
            href={`/rankings?distance=${encodeURIComponent(distance)}`}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              !year ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
            }`}
          >
            All-time
          </Link>
          {years.map((y) => (
            <Link
              key={y}
              href={`/rankings?distance=${encodeURIComponent(distance)}&year=${y}`}
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
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No results found.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Runner</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Best time</TableHead>
                <TableHead>Event</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => {
                const runner = row.runners as any;
                const event = row.events as any;
                const rank = i + 1;
                return (
                  <TableRow key={`${runner?.id}-${i}`} className="hover:bg-muted/50">
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
                    <TableCell className="text-muted-foreground">{runner?.country}</TableCell>
                    <TableCell className="text-muted-foreground">{runner?.city}</TableCell>
                    <TableCell className="font-mono font-semibold tabular-nums">
                      {row.chip_time && row.chip_time !== "--:--:--" ? row.chip_time : "—"}
                    </TableCell>
                    <TableCell>
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
