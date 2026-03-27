import Link from "next/link";
import { getPowerRankings, getEloStats, PAGE_SIZE } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Power Rankings" };
export const revalidate = 3600;

// Level config: name, color, min ELO
const LEVELS: Record<number, { name: string; color: string; bg: string }> = {
  1:  { name: "Bronze I",     color: "text-amber-700",   bg: "bg-amber-700/10 border-amber-700/30" },
  2:  { name: "Bronze II",    color: "text-amber-600",   bg: "bg-amber-600/10 border-amber-600/30" },
  3:  { name: "Silver I",     color: "text-gray-400",    bg: "bg-gray-400/10 border-gray-400/30" },
  4:  { name: "Silver II",    color: "text-gray-300",    bg: "bg-gray-300/10 border-gray-300/30" },
  5:  { name: "Gold I",       color: "text-yellow-500",  bg: "bg-yellow-500/10 border-yellow-500/30" },
  6:  { name: "Gold II",      color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/30" },
  7:  { name: "Platinum",     color: "text-cyan-400",    bg: "bg-cyan-400/10 border-cyan-400/30" },
  8:  { name: "Diamond",      color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/30" },
  9:  { name: "Master",       color: "text-purple-400",  bg: "bg-purple-400/10 border-purple-400/30" },
  10: { name: "Grandmaster",  color: "text-red-400",     bg: "bg-red-400/10 border-red-400/30" },
};

const ELO_RANGES: Record<number, string> = {
  1: "100–500", 2: "501–750", 3: "751–900", 4: "901–1050", 5: "1051–1200",
  6: "1201–1350", 7: "1351–1530", 8: "1531–1750", 9: "1751–2000", 10: "2001+",
};

function getLevelInfo(level: number | null) {
  return LEVELS[level ?? 1] ?? LEVELS[1];
}

export default async function PowerRankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; page?: string }>;
}) {
  const { level: levelParam, page: pageParam } = await searchParams;
  const level = levelParam ? Number(levelParam) : undefined;
  const page = pageParam ? Number(pageParam) : 1;

  const [{ runners, total }, eloStats] = await Promise.all([
    getPowerRankings({ level, page }),
    getEloStats(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const globalRankOffset = (page - 1) * PAGE_SIZE;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold">Power Rankings</h1>
        <p className="text-muted-foreground text-sm">ELO-based runner ratings</p>
      </div>

      {/* Level distribution cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
        {eloStats.map(({ level: lvl, count }) => {
          const info = getLevelInfo(lvl);
          const isActive = level === lvl;
          return (
            <Link
              key={lvl}
              href={level === lvl ? "/power-rankings" : `/power-rankings?level=${lvl}`}
            >
              <Card className={`transition-colors hover:border-primary/50 ${isActive ? "border-primary ring-1 ring-primary" : ""}`}>
                <CardContent className="p-3 text-center">
                  <p className={`text-xs font-bold ${info.color}`}>{info.name}</p>
                  <p className="text-lg font-bold">{count.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{ELO_RANGES[lvl]}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Filters */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Filter by Level
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/power-rankings"
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              !level
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            All Levels
          </Link>
          {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((lvl) => {
            const info = getLevelInfo(lvl);
            return (
              <Link
                key={lvl}
                href={`/power-rankings?level=${lvl}`}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  level === lvl
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span className={info.color}>{info.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {runners.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No runners found.</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Runner</TableHead>
                <TableHead className="hidden sm:table-cell">Country</TableHead>
                <TableHead className="hidden md:table-cell">City</TableHead>
                <TableHead className="text-right">ELO</TableHead>
                <TableHead className="hidden sm:table-cell">Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runners.map((runner, i) => {
                const rank = globalRankOffset + i + 1;
                const info = getLevelInfo(runner.elo_level);
                const isChallenger = !level && rank <= 1000;
                return (
                  <TableRow key={runner.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-muted-foreground text-sm">
                      {rank}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/runners/${runner.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {runner.full_name}
                      </Link>
                      {isChallenger && (
                        <Badge variant="outline" className="ml-2 text-[10px] text-red-400 border-red-400/30 hidden sm:inline-flex">
                          Challenger
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">{runner.country}</TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">{runner.city}</TableCell>
                    <TableCell className="text-right font-mono font-bold tabular-nums text-[#22c55e]">
                      {runner.elo_score ?? "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={`text-xs ${info.bg} ${info.color}`}>
                        Lvl {runner.elo_level} — {info.name}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/power-rankings?${level ? `level=${level}&` : ""}page=${page - 1}`}
              className="px-4 py-2 rounded-md border text-sm hover:bg-muted"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total.toLocaleString()} runners)
          </span>
          {page < totalPages && (
            <Link
              href={`/power-rankings?${level ? `level=${level}&` : ""}page=${page + 1}`}
              className="px-4 py-2 rounded-md border text-sm hover:bg-muted"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
