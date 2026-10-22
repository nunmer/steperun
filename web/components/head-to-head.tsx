"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

// Runner A wears the signal colour, runner B the steel chart colour.
const COLOR_A = "var(--primary)";
const COLOR_B = "var(--chart-4)";

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
        style={{ fill: COLOR_A, stroke: COLOR_A }}
        fillOpacity="0.15"
        strokeWidth="1.5"
      />
      {/* Runner B polygon */}
      <polygon
        points={polygon(valsB)}
        style={{ fill: COLOR_B, stroke: COLOR_B }}
        fillOpacity="0.15"
        strokeWidth="1.5"
      />
      {/* Dots */}
      {valsA.map((v, i) => {
        const [px, py] = pointOnAxis(i, Math.max(v, 0.05));
        return <circle key={`a${i}`} cx={px} cy={py} r="3" style={{ fill: COLOR_A }} />;
      })}
      {valsB.map((v, i) => {
        const [px, py] = pointOnAxis(i, Math.max(v, 0.05));
        return <circle key={`b${i}`} cx={px} cy={py} r="3" style={{ fill: COLOR_B }} />;
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
      <div className="text-center eyebrow">{label}</div>
      <div className="flex items-center gap-3">
        <span className={`time text-sm w-16 text-right ${aWins ? "font-semibold" : "text-muted-foreground"}`} style={aWins ? { color: COLOR_A } : undefined}>
          {formatA ?? String(valueA)}
        </span>
        <div className="flex-1 flex h-2 gap-0.5">
          {/* A bar — grows from right */}
          <div className="flex-1 flex justify-end">
            <div
              className="h-full"
              style={{ width: `${pctA}%`, background: COLOR_A, opacity: aWins ? 1 : 0.45 }}
            />
          </div>
          {/* B bar — grows from left */}
          <div className="flex-1">
            <div
              className="h-full"
              style={{ width: `${pctB}%`, background: COLOR_B, opacity: bWins ? 1 : 0.45 }}
            />
          </div>
        </div>
        <span className={`time text-sm w-16 ${bWins ? "font-semibold" : "text-muted-foreground"}`} style={bWins ? { color: COLOR_B } : undefined}>
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
    <div className={`flex flex-col gap-1 min-w-0 ${side === "right" ? "sm:items-end sm:text-right" : ""}`}>
      <span aria-hidden className="h-1.5 w-12" style={{ background: color }} />
      <Link href={`/runners/${runner.id}`} className="headline text-3xl sm:text-4xl hover:underline underline-offset-4 break-words">
        {runner.full_name}
      </Link>
      <p className="text-xs text-muted-foreground">
        {[runner.city, runner.country].filter(Boolean).join(", ") || "—"}
      </p>
    </div>
  );
}

// ─── Share Button ────────────────────────────────────────────────────────────

function buildTeaseText(
  dataA: ComparisonData,
  dataB: ComparisonData,
  winsA: number,
  winsB: number,
): string {
  const a = dataA.runner.full_name.split(" ")[0];
  const b = dataB.runner.full_name.split(" ")[0];
  if (winsA + winsB === 0) {
    return `${a} vs ${b} — who's the real runner?`;
  }
  if (winsA > winsB) {
    return `${a} just smoked ${b} ${winsA}–${winsB} head-to-head. Think you can do better?`;
  }
  if (winsB > winsA) {
    return `${b} crushed ${a} ${winsB}–${winsA}. Don't believe it? See for yourself.`;
  }
  return `${a} and ${b} are dead even at ${winsA}–${winsB}. Who breaks the tie?`;
}

function ShareButton({
  dataA,
  dataB,
  winsA,
  winsB,
}: {
  dataA: ComparisonData;
  dataB: ComparisonData;
  winsA: number;
  winsB: number;
}) {
  const [status, setStatus] = useState<"idle" | "copied">("idle");

  async function handleShare() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/runners/head-to-head?a=${dataA.runner.id}&b=${dataB.runner.id}`;
    const text = buildTeaseText(dataA, dataB, winsA, winsB);

    // WhatsApp / Telegram drop the `text` field when `url` is also passed,
    // so we pack everything into `text` and let messengers auto-linkify the URL.
    const payload = `${text}\n\n${url}`;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Head to Head — steperun", text: payload });
        return;
      } catch {
        // User canceled or share failed — fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(payload);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      window.prompt("Copy this link:", payload);
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 h-10 px-4 rounded-sm bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
      aria-label="Share comparison"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {status === "copied" ? "Link copied!" : "Share this matchup"}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function HeadToHead() {
  const searchParams = useSearchParams();
  const [runnerA, setRunnerA] = useState<Runner | null>(null);
  const [runnerB, setRunnerB] = useState<Runner | null>(null);
  const [dataA, setDataA] = useState<ComparisonData | null>(null);
  const [dataB, setDataB] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const initLoadedRef = useRef(false);

  // Load runners from URL params on first mount
  useEffect(() => {
    if (initLoadedRef.current) return;
    initLoadedRef.current = true;

    const aId = searchParams.get("a");
    const bId = searchParams.get("b");
    if (!aId && !bId) return;

    async function loadRunner(id: string): Promise<Runner | null> {
      try {
        const res = await fetch(`/api/runners/${id}`);
        if (!res.ok) return null;
        const data = await res.json();
        return (data?.runner as Runner) ?? null;
      } catch {
        return null;
      }
    }

    if (aId) loadRunner(aId).then((r) => r && setRunnerA(r));
    if (bId) loadRunner(bId).then((r) => r && setRunnerB(r));
  }, [searchParams]);

  // Keep URL in sync with selected runners (no Next.js navigation)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (runnerA) params.set("a", String(runnerA.id));
    if (runnerB) params.set("b", String(runnerB.id));
    const qs = params.toString();
    const newUrl = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [runnerA?.id, runnerB?.id]);

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
          <div className="border-y-2 border-rule py-6 sm:py-8 space-y-8">
            {/* Tease headline */}
            <p className="text-center text-base sm:text-lg font-medium leading-snug">
              {buildTeaseText(dataA, dataB, winsA, winsB)}
            </p>

            {/* Top section: Avatar — Radar — Avatar */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-6">
              <RunnerAvatar runner={dataA.runner} color={COLOR_A} side="left" />
              <div className="order-last sm:order-none flex justify-center"><RadarChart dataA={dataA} dataB={dataB} /></div>
              <RunnerAvatar runner={dataB.runner} color={COLOR_B} side="right" />
            </div>

            {/* Win record */}
            {/* Scoreboard: wins in shared races. */}
            <div className="flex items-end justify-center gap-6 sm:gap-10 text-center">
              <div>
                <p className="headline text-7xl sm:text-8xl tabular-nums" style={{ color: COLOR_A }}>{winsA}</p>
                <p className="eyebrow mt-1">Wins</p>
              </div>
              <div className="pb-6">
                <p className="headline text-3xl text-muted-foreground tabular-nums">{ties}</p>
                <p className="eyebrow mt-1">Ties</p>
              </div>
              <div>
                <p className="headline text-7xl sm:text-8xl tabular-nums" style={{ color: COLOR_B }}>{winsB}</p>
                <p className="eyebrow mt-1">Wins</p>
              </div>
            </div>

            {/* Share CTA */}
            <div className="flex justify-center">
              <ShareButton dataA={dataA} dataB={dataB} winsA={winsA} winsB={winsB} />
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
              <h2 className="headline text-3xl border-b-2 border-rule pb-2">Personal Bests</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 eyebrow font-normal">Distance</th>
                      <th className="text-right py-2 px-3 font-semibold text-sm" style={{ color: COLOR_A }}>
                        {dataA.runner.full_name.split(" ")[0]}
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-sm" style={{ color: COLOR_B }}>
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
                        <tr key={dist} className="border-b last:border-0 hover:bg-muted/60">
                          <td className="py-2.5 pr-3">
                            {dist}
                          </td>
                          <td className={`py-2.5 px-3 text-right time ${betterA ? "font-semibold" : "text-muted-foreground"}`}
                            style={betterA ? { color: COLOR_A } : undefined}
                          >
                            {pbA?.time ?? "—"}
                          </td>
                          <td className={`py-2.5 px-3 text-right time ${betterB ? "font-semibold" : "text-muted-foreground"}`}
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
              <h2 className="headline text-3xl border-b-2 border-rule pb-2">
                Race History ({sharedEvents.length} shared)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 eyebrow font-normal">Event</th>
                      <th className="text-left py-2 pr-3 eyebrow font-normal">Distance</th>
                      <th className="text-right py-2 px-3 font-semibold text-sm" style={{ color: COLOR_A }}>
                        {dataA.runner.full_name.split(" ")[0]}
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-sm" style={{ color: COLOR_B }}>
                        {dataB.runner.full_name.split(" ")[0]}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sharedEvents.map((ev, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/60">
                        <td className="py-2.5 pr-3">
                          <Link
                            href={`/events/${ev.eventSlug}`}
                            className="font-medium hover:text-primary"
                          >
                            {ev.eventName}
                          </Link>
                          {ev.year && (
                            <span className="ml-2 time text-xs text-muted-foreground">{ev.year}</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="text-muted-foreground">{ev.distance}</span>
                        </td>
                        <td className={`py-2.5 px-3 text-right time ${ev.winner === "a" ? "font-semibold" : "text-muted-foreground"}`}
                          style={ev.winner === "a" ? { color: COLOR_A } : undefined}
                        >
                          <div>{ev.a.chip_time ?? "—"}</div>
                          {ev.a.place && <div className="text-xs text-muted-foreground">#{ev.a.place}</div>}
                        </td>
                        <td className={`py-2.5 px-3 text-right time ${ev.winner === "b" ? "font-semibold" : "text-muted-foreground"}`}
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
        <p className="py-12 text-muted-foreground border-b">
          Pick two runners to see who won the races they both ran, and their personal bests side by side.
        </p>
      )}
    </div>
  );
}
