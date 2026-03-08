"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RunnerSearch } from "@/components/runner-search";

type Runner = {
  id: number;
  full_name: string;
  country: string | null;
  city: string | null;
};

type Result = {
  place: number | null;
  finish_time: string | null;
  chip_time: string | null;
  distance_category: string | null;
  events: { id: number; slug: string; name: string; year: number | null };
};

type ComparisonData = {
  runner: Runner;
  results: Result[];
  totalRaces: number;
  bestTimes: Record<string, { time: string; event: string; slug: string }>;
};

function toSeconds(t: string): number {
  const clean = t.split(".")[0]; // strip fractional seconds
  const parts = clean.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Infinity;
}

function computeData(runner: Runner, results: Result[]): ComparisonData {
  const bestTimes: ComparisonData["bestTimes"] = {};
  for (const r of results) {
    const cat = r.distance_category ?? "Unknown";
    const time = r.chip_time;
    if (!time || time === "--:--:--") continue;
    if (!bestTimes[cat] || toSeconds(time) < toSeconds(bestTimes[cat].time)) {
      bestTimes[cat] = {
        time,
        event: (r.events as any)?.name ?? "",
        slug: (r.events as any)?.slug ?? "",
      };
    }
  }
  return { runner, results, totalRaces: results.length, bestTimes };
}

export function HeadToHead() {
  const [runnerA, setRunnerA] = useState<Runner | null>(null);
  const [runnerB, setRunnerB] = useState<Runner | null>(null);
  const [dataA, setDataA] = useState<ComparisonData | null>(null);
  const [dataB, setDataB] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch runner results when selected
  useEffect(() => {
    if (!runnerA) { setDataA(null); return; }
    fetchRunner(runnerA).then(setDataA);
  }, [runnerA]);

  useEffect(() => {
    if (!runnerB) { setDataB(null); return; }
    fetchRunner(runnerB).then(setDataB);
  }, [runnerB]);

  async function fetchRunner(runner: Runner): Promise<ComparisonData> {
    setLoading(true);
    try {
      const res = await fetch(`/api/runners/${runner.id}`);
      const data = await res.json();
      return computeData(runner, data.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  // Find shared events
  const sharedEvents: {
    eventName: string;
    eventSlug: string;
    year: number | null;
    distance: string;
    a: { chip_time: string | null; place: number | null };
    b: { chip_time: string | null; place: number | null };
    winner: "a" | "b" | "tie" | null;
  }[] = [];

  if (dataA && dataB) {
    // Build a map of runner B's results by event+distance
    const bMap = new Map<string, Result>();
    for (const r of dataB.results) {
      const key = `${(r.events as any)?.slug}:${r.distance_category}`;
      bMap.set(key, r);
    }

    for (const rA of dataA.results) {
      const key = `${(rA.events as any)?.slug}:${rA.distance_category}`;
      const rB = bMap.get(key);
      if (!rB) continue;

      const timeA = rA.chip_time && rA.chip_time !== "--:--:--" ? toSeconds(rA.chip_time) : Infinity;
      const timeB = rB.chip_time && rB.chip_time !== "--:--:--" ? toSeconds(rB.chip_time) : Infinity;

      let winner: "a" | "b" | "tie" | null = null;
      if (timeA < Infinity || timeB < Infinity) {
        if (timeA < timeB) winner = "a";
        else if (timeB < timeA) winner = "b";
        else winner = "tie";
      }

      sharedEvents.push({
        eventName: (rA.events as any)?.name ?? "",
        eventSlug: (rA.events as any)?.slug ?? "",
        year: (rA.events as any)?.year,
        distance: rA.distance_category ?? "",
        a: { chip_time: rA.chip_time, place: rA.place },
        b: { chip_time: rB.chip_time, place: rB.place },
        winner,
      });
    }

    // Sort by year desc
    sharedEvents.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }

  const winsA = sharedEvents.filter((e) => e.winner === "a").length;
  const winsB = sharedEvents.filter((e) => e.winner === "b").length;
  const ties = sharedEvents.filter((e) => e.winner === "tie").length;

  // All distances both runners have PBs for
  const allDistances = dataA && dataB
    ? [...new Set([...Object.keys(dataA.bestTimes), ...Object.keys(dataB.bestTimes)])].sort()
    : [];

  return (
    <div className="space-y-8">
      {/* Runner selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <RunnerSearch label="Runner 1" selectedRunner={runnerA} onSelect={setRunnerA} />
        <RunnerSearch label="Runner 2" selectedRunner={runnerB} onSelect={setRunnerB} />
      </div>

      {/* Comparison content */}
      {dataA && dataB && (
        <>
          {/* Head-to-head record */}
          <div className="rounded-lg border p-6">
            <div className="grid grid-cols-3 text-center">
              <div>
                <p className={`text-4xl font-bold ${winsA > winsB ? "text-emerald-500" : ""}`}>
                  {winsA}
                </p>
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  {dataA.runner.full_name}
                </p>
              </div>
              <div>
                <p className="text-4xl font-bold text-muted-foreground">{ties}</p>
                <p className="text-sm text-muted-foreground mt-1">Ties</p>
              </div>
              <div>
                <p className={`text-4xl font-bold ${winsB > winsA ? "text-emerald-500" : ""}`}>
                  {winsB}
                </p>
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  {dataB.runner.full_name}
                </p>
              </div>
            </div>
            {sharedEvents.length === 0 && (
              <p className="text-center text-muted-foreground text-sm mt-4">
                No shared races found
              </p>
            )}
          </div>

          {/* Stats comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total races"
              a={String(dataA.totalRaces)}
              b={String(dataB.totalRaces)}
              highlightHigher
            />
            <StatCard
              label="Shared races"
              a={String(sharedEvents.length)}
              b={String(sharedEvents.length)}
            />
            <StatCard
              label="Distances"
              a={String(Object.keys(dataA.bestTimes).length)}
              b={String(Object.keys(dataB.bestTimes).length)}
              highlightHigher
            />
          </div>

          {/* Personal bests comparison */}
          {allDistances.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Personal Bests</h2>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Distance</th>
                      <th className="text-center p-3 font-medium truncate max-w-[120px]">
                        {dataA.runner.full_name.split(" ")[0]}
                      </th>
                      <th className="text-center p-3 font-medium truncate max-w-[120px]">
                        {dataB.runner.full_name.split(" ")[0]}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDistances.map((dist) => {
                      const pbA = dataA.bestTimes[dist];
                      const pbB = dataB.bestTimes[dist];
                      const secA = pbA ? toSeconds(pbA.time) : Infinity;
                      const secB = pbB ? toSeconds(pbB.time) : Infinity;
                      const betterA = secA < secB;
                      const betterB = secB < secA;

                      return (
                        <tr key={dist} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{dist}</Badge>
                          </td>
                          <td className={`p-3 text-center font-mono tabular-nums ${betterA ? "text-emerald-500 font-semibold" : "text-muted-foreground"}`}>
                            {pbA?.time ?? "—"}
                          </td>
                          <td className={`p-3 text-center font-mono tabular-nums ${betterB ? "text-emerald-500 font-semibold" : "text-muted-foreground"}`}>
                            {pbB?.time ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Shared race history */}
          {sharedEvents.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">
                Race History ({sharedEvents.length} shared)
              </h2>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Event</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Distance</th>
                      <th className="text-center p-3 font-medium truncate max-w-[100px]">
                        {dataA.runner.full_name.split(" ")[0]}
                      </th>
                      <th className="text-center p-3 font-medium truncate max-w-[100px]">
                        {dataB.runner.full_name.split(" ")[0]}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sharedEvents.map((ev, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3">
                          <Link
                            href={`/events/${ev.eventSlug}`}
                            className="hover:text-primary hover:underline"
                          >
                            {ev.eventName}
                          </Link>
                          {ev.year && (
                            <Badge variant="outline" className="ml-1 text-xs">{ev.year}</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className="text-xs">{ev.distance}</Badge>
                        </td>
                        <td className={`p-3 text-center font-mono tabular-nums ${ev.winner === "a" ? "text-emerald-500 font-semibold" : "text-muted-foreground"}`}>
                          <div>{ev.a.chip_time ?? "—"}</div>
                          {ev.a.place && (
                            <div className="text-xs text-muted-foreground">#{ev.a.place}</div>
                          )}
                        </td>
                        <td className={`p-3 text-center font-mono tabular-nums ${ev.winner === "b" ? "text-emerald-500 font-semibold" : "text-muted-foreground"}`}>
                          <div>{ev.b.chip_time ?? "—"}</div>
                          {ev.b.place && (
                            <div className="text-xs text-muted-foreground">#{ev.b.place}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {/* Loading / prompt state */}
      {(!runnerA || !runnerB) && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Select two runners to compare</p>
          <p className="text-sm mt-1">Search by name to get started</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  a,
  b,
  highlightHigher,
}: {
  label: string;
  a: string;
  b: string;
  highlightHigher?: boolean;
}) {
  const numA = Number(a);
  const numB = Number(b);
  const aWins = highlightHigher && numA > numB;
  const bWins = highlightHigher && numB > numA;

  return (
    <div className="rounded-lg border p-4 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center justify-center gap-6">
        <span className={`text-2xl font-bold ${aWins ? "text-emerald-500" : ""}`}>{a}</span>
        <span className="text-muted-foreground text-sm">vs</span>
        <span className={`text-2xl font-bold ${bWins ? "text-emerald-500" : ""}`}>{b}</span>
      </div>
    </div>
  );
}
