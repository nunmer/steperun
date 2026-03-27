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
  uniqueSeasons: number;
  avgPlace: number | null;
};

function toSeconds(t: string): number {
  const clean = t.split(".")[0];
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
  const uniqueSeasons = new Set(results.map((r) => (r.events as any)?.year)).size;
  const places = results.map((r) => r.place).filter((p): p is number => p !== null && p > 0);
  const avgPlace = places.length > 0 ? Math.round(places.reduce((a, b) => a + b, 0) / places.length) : null;

  return { runner, results, totalRaces: results.length, bestTimes, uniqueSeasons, avgPlace };
}

// Colors for runner A (orange/warm) and runner B (cyan/cool)
const COLOR_A = "#E8520F";
const COLOR_B = "#06B6D4";

// ─── Radar Chart ─────────────────────────────────────────────────────────────

function RadarChart({
  dataA,
  dataB,
}: {
  dataA: ComparisonData;
  dataB: ComparisonData;
}) {
  // 5 axes: Races, Seasons, Distances, Avg Place (inverted — lower is better), Wins
  const labels = ["Races", "Seasons", "Distances", "Consistency", "Experience"];

  const maxRaces = Math.max(dataA.totalRaces, dataB.totalRaces, 1);
  const maxSeasons = Math.max(dataA.uniqueSeasons, dataB.uniqueSeasons, 1);
  const maxDists = Math.max(Object.keys(dataA.bestTimes).length, Object.keys(dataB.bestTimes).length, 1);
  const maxPlace = Math.max(dataA.avgPlace ?? 100, dataB.avgPlace ?? 100, 1);

  // Normalize to 0-1
  const valsA = [
    dataA.totalRaces / maxRaces,
    dataA.uniqueSeasons / maxSeasons,
    Object.keys(dataA.bestTimes).length / maxDists,
    dataA.avgPlace ? 1 - (dataA.avgPlace / (maxPlace + 10)) : 0,
    Math.min(dataA.totalRaces / 20, 1),
  ];
  const valsB = [
    dataB.totalRaces / maxRaces,
    dataB.uniqueSeasons / maxSeasons,
    Object.keys(dataB.bestTimes).length / maxDists,
    dataB.avgPlace ? 1 - (dataB.avgPlace / (maxPlace + 10)) : 0,
    Math.min(dataB.totalRaces / 20, 1),
  ];

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const n = 5;

  function pointOnAxis(axis: number, value: number): [number, number] {
    const angle = (Math.PI * 2 * axis) / n - Math.PI / 2;
    return [cx + r * value * Math.cos(angle), cy + r * value * Math.sin(angle)];
  }

  function polygon(vals: number[]): string {
    return vals.map((v, i) => pointOnAxis(i, Math.max(v, 0.05)).join(",")).join(" ");
  }

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="overflow-visible w-full max-w-[200px]">
      {/* Grid */}
      {rings.map((rv) => (
        <polygon
          key={rv}
          points={Array.from({ length: n }, (_, i) => pointOnAxis(i, rv).join(",")).join(" ")}
          fill="none"
          stroke="var(--border)"
          strokeWidth="0.5"
          opacity="0.5"
        />
      ))}
      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const [ex, ey] = pointOnAxis(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--border)" strokeWidth="0.5" opacity="0.4" />;
      })}
      {/* Runner A polygon */}
      <polygon
        points={polygon(valsA)}
        fill={COLOR_A}
        fillOpacity="0.15"
        stroke={COLOR_A}
        strokeWidth="1.5"
      />
      {/* Runner B polygon */}
      <polygon
        points={polygon(valsB)}
        fill={COLOR_B}
        fillOpacity="0.15"
        stroke={COLOR_B}
        strokeWidth="1.5"
      />
      {/* Dots */}
      {valsA.map((v, i) => {
        const [px, py] = pointOnAxis(i, Math.max(v, 0.05));
        return <circle key={`a${i}`} cx={px} cy={py} r="3" fill={COLOR_A} />;
      })}
      {valsB.map((v, i) => {
        const [px, py] = pointOnAxis(i, Math.max(v, 0.05));
        return <circle key={`b${i}`} cx={px} cy={py} r="3" fill={COLOR_B} />;
      })}
      {/* Labels */}
      {labels.map((label, i) => {
        const [lx, ly] = pointOnAxis(i, 1.25);
        return (
          <text
            key={label}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground"
            style={{ fontSize: "9px" }}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Comparison Bar ──────────────────────────────────────────────────────────

function ComparisonBar({
  label,
  valueA,
  valueB,
  formatA,
  formatB,
  lowerIsBetter,
}: {
  label: string;
  valueA: number;
  valueB: number;
  formatA?: string;
  formatB?: string;
  lowerIsBetter?: boolean;
}) {
  const max = Math.max(valueA, valueB, 1);
  const pctA = (valueA / max) * 100;
  const pctB = (valueB / max) * 100;

  const aWins = lowerIsBetter ? valueA < valueB : valueA > valueB;
  const bWins = lowerIsBetter ? valueB < valueA : valueB > valueA;

  return (
    <div className="space-y-1.5">
      <div className="text-center text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-mono tabular-nums w-16 text-right ${aWins ? "text-[#E8520F] font-semibold" : "text-muted-foreground"}`}>
          {formatA ?? String(valueA)}
        </span>
        <div className="flex-1 flex h-2 gap-0.5">
          {/* A bar — grows from right */}
          <div className="flex-1 flex justify-end">
            <div
              className="h-full rounded-l-full transition-all duration-500"
              style={{ width: `${pctA}%`, background: `linear-gradient(to right, transparent, ${COLOR_A})` }}
            />
          </div>
          {/* B bar — grows from left */}
          <div className="flex-1">
            <div
              className="h-full rounded-r-full transition-all duration-500"
              style={{ width: `${pctB}%`, background: `linear-gradient(to left, transparent, ${COLOR_B})` }}
            />
          </div>
        </div>
        <span className={`text-sm font-mono tabular-nums w-16 ${bWins ? "text-[#06B6D4] font-semibold" : "text-muted-foreground"}`}>
          {formatB ?? String(valueB)}
        </span>
      </div>
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function RunnerAvatar({
  runner,
  color,
  side,
}: {
  runner: Runner;
  color: string;
  side: "left" | "right";
}) {
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <div
        className="w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-bold shrink-0"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${color}30, ${color}10)`,
          border: `2px solid ${color}40`,
          color: color,
        }}
      >
        {runner.full_name[0]?.toUpperCase()}
      </div>
      <div className="text-center">
        <Link
          href={`/runners/${runner.id}`}
          className="font-semibold hover:text-primary hover:underline text-sm"
        >
          {runner.full_name}
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5">
          {[runner.country, runner.city].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <Link
        href={`/runners/${runner.id}`}
        className="text-xs px-3 py-1 rounded-full border transition-colors hover:bg-muted"
        style={{ borderColor: `${color}60`, color }}
      >
        View profile
      </Link>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function HeadToHead() {
  const [runnerA, setRunnerA] = useState<Runner | null>(null);
  const [runnerB, setRunnerB] = useState<Runner | null>(null);
  const [dataA, setDataA] = useState<ComparisonData | null>(null);
  const [dataB, setDataB] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);

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
    sharedEvents.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }

  const winsA = sharedEvents.filter((e) => e.winner === "a").length;
  const winsB = sharedEvents.filter((e) => e.winner === "b").length;
  const ties = sharedEvents.filter((e) => e.winner === "tie").length;

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

      {/* Comparison card */}
      {dataA && dataB && (
        <>
          <div className="rounded-xl border border-border/50 p-4 sm:p-8 space-y-6 sm:space-y-8"
            style={{ background: "linear-gradient(180deg, var(--card) 0%, var(--background) 100%)" }}
          >
            {/* Top section: Avatar — Radar — Avatar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
              <RunnerAvatar runner={dataA.runner} color={COLOR_A} side="left" />
              <RadarChart dataA={dataA} dataB={dataB} />
              <RunnerAvatar runner={dataB.runner} color={COLOR_B} side="right" />
            </div>

            {/* Win record */}
            <div className="flex items-center justify-center gap-8 text-center">
              <div>
                <p className="text-3xl font-bold" style={{ color: COLOR_A }}>{winsA}</p>
                <p className="text-xs text-muted-foreground uppercase">Wins</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-muted-foreground">{ties}</p>
                <p className="text-xs text-muted-foreground uppercase">Ties</p>
              </div>
              <div>
                <p className="text-3xl font-bold" style={{ color: COLOR_B }}>{winsB}</p>
                <p className="text-xs text-muted-foreground uppercase">Wins</p>
              </div>
            </div>

            {/* Comparison bars */}
            <div className="space-y-4 max-w-lg mx-auto">
              <ComparisonBar
                label="Total Races"
                valueA={dataA.totalRaces}
                valueB={dataB.totalRaces}
              />
              <ComparisonBar
                label="Active Seasons"
                valueA={dataA.uniqueSeasons}
                valueB={dataB.uniqueSeasons}
              />
              <ComparisonBar
                label="Distances"
                valueA={Object.keys(dataA.bestTimes).length}
                valueB={Object.keys(dataB.bestTimes).length}
              />
              {dataA.avgPlace && dataB.avgPlace && (
                <ComparisonBar
                  label="Avg Place"
                  valueA={dataA.avgPlace}
                  valueB={dataB.avgPlace}
                  formatA={`#${dataA.avgPlace}`}
                  formatB={`#${dataB.avgPlace}`}
                  lowerIsBetter
                />
              )}
              <ComparisonBar
                label="Shared Races"
                valueA={sharedEvents.length}
                valueB={sharedEvents.length}
              />
            </div>

            {sharedEvents.length === 0 && (
              <p className="text-center text-muted-foreground text-sm">
                No shared races found
              </p>
            )}
          </div>

          {/* Personal bests comparison */}
          {allDistances.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Personal Bests</h2>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Distance</th>
                      <th className="text-center p-3 font-medium" style={{ color: COLOR_A }}>
                        {dataA.runner.full_name.split(" ")[0]}
                      </th>
                      <th className="text-center p-3 font-medium" style={{ color: COLOR_B }}>
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
                          <td className={`p-3 text-center font-mono tabular-nums ${betterA ? "font-semibold" : "text-muted-foreground"}`}
                            style={betterA ? { color: COLOR_A } : undefined}
                          >
                            {pbA?.time ?? "—"}
                          </td>
                          <td className={`p-3 text-center font-mono tabular-nums ${betterB ? "font-semibold" : "text-muted-foreground"}`}
                            style={betterB ? { color: COLOR_B } : undefined}
                          >
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
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Event</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Distance</th>
                      <th className="text-center p-3 font-medium" style={{ color: COLOR_A }}>
                        {dataA.runner.full_name.split(" ")[0]}
                      </th>
                      <th className="text-center p-3 font-medium" style={{ color: COLOR_B }}>
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
                        <td className={`p-3 text-center font-mono tabular-nums ${ev.winner === "a" ? "font-semibold" : "text-muted-foreground"}`}
                          style={ev.winner === "a" ? { color: COLOR_A } : undefined}
                        >
                          <div>{ev.a.chip_time ?? "—"}</div>
                          {ev.a.place && <div className="text-xs text-muted-foreground">#{ev.a.place}</div>}
                        </td>
                        <td className={`p-3 text-center font-mono tabular-nums ${ev.winner === "b" ? "font-semibold" : "text-muted-foreground"}`}
                          style={ev.winner === "b" ? { color: COLOR_B } : undefined}
                        >
                          <div>{ev.b.chip_time ?? "—"}</div>
                          {ev.b.place && <div className="text-xs text-muted-foreground">#{ev.b.place}</div>}
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

      {/* Empty state */}
      {(!runnerA || !runnerB) && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Select two runners to compare</p>
          <p className="text-sm mt-1">Search by name to get started</p>
        </div>
      )}
    </div>
  );
}
