"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface ReplayRunner {
  id: number;
  name: string;
  time: string;
  seconds: number;
  race: string;
}

export interface ReplayDistance {
  key: string;
  label: string;
  href: string;
  runners: ReplayRunner[];
}

// Animation timeline: the winner crosses at WINNER_MS, the last runner
// SPREAD_MS later. Real gaps are seconds in a two-hour race, so they are
// stretched to be visible; the real gap is printed at the finish.
const WINNER_MS = 3400;
const SPREAD_MS = 2600;

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `00:${mm}:${ss}`;
}

/** "+1:05", or under a minute just the seconds ("+42s" via `seconds`). */
function gap(sec: number, seconds: (s: number) => string): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  return m > 0 ? `+${m}:${String(s % 60).padStart(2, "0")}` : seconds(s);
}

/** Map real finish seconds to animation ms (piecewise linear, monotonic). */
function timeline(runners: ReplayRunner[]) {
  const tMin = runners[0]?.seconds ?? 1;
  const tMax = runners[runners.length - 1]?.seconds ?? tMin;
  const span = Math.max(tMax - tMin, 1);
  const toMs = (t: number) => WINNER_MS + ((t - tMin) / span) * SPREAD_MS;
  const toReal = (ms: number) =>
    ms <= WINNER_MS ? (ms / WINNER_MS) * tMin : tMin + ((ms - WINNER_MS) / SPREAD_MS) * span;
  return { toMs, toReal, endMs: toMs(tMax), tMin };
}

/**
 * The fastest runners of a distance, raced again: lanes run to the finish
 * line in their real order while a race clock counts up; each runner's chip
 * time and gap to the winner lock in as they cross. Starts when scrolled into
 * view; tabs switch distance; reduced motion shows the finished result.
 */
export function RaceReplay({ distances }: { distances: ReplayDistance[] }) {
  const t = useTranslations("home.replay");
  const [active, setActive] = useState(0);
  const [run, setRun] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  const dist = distances[active];
  const { toMs, toReal, endMs, tMin } = timeline(dist?.runners ?? []);

  // Start the first race only once the section is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Race clock. Each (distance, run) pair is a fresh race.
  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setElapsed(endMs));
      return () => cancelAnimationFrame(id);
    }
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const ms = Math.min(now - start, endMs);
      setElapsed(ms);
      if (ms < endMs) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame((now) => {
      setElapsed(0);
      frame = requestAnimationFrame(tick);
      start = now;
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, active, run, endMs]);

  if (!dist || dist.runners.length === 0) return null;

  const finished = elapsed >= endMs;
  const clock = finished ? dist.runners[dist.runners.length - 1].seconds : toReal(elapsed);

  return (
    <section ref={rootRef} aria-label={t("label")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b-2 border-rule pb-3">
        <div>
          <p className="eyebrow mb-1">{t("kicker", { count: dist.runners.length })}</p>
          <h2 className="headline text-5xl sm:text-6xl">{t("title")}</h2>
        </div>
        <div className="flex items-end gap-6">
          <div className="text-right">
            <p className="eyebrow">{t("clock")}</p>
            <p className="time text-4xl sm:text-5xl font-medium tracking-tight" aria-live="off">
              {fmt(clock)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-b py-2">
        <div role="tablist" aria-label={t("distance")} className="flex gap-5 overflow-x-auto">
          {distances.map((d, i) => (
            <button
              key={d.key}
              role="tab"
              aria-selected={i === active}
              onClick={() => { setElapsed(0); setActive(i); setRun((r) => r + 1); }}
              className={cn(
                "whitespace-nowrap text-sm underline-offset-[6px] decoration-2 transition-colors",
                i === active ? "font-semibold underline decoration-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setElapsed(0); setRun((r) => r + 1); }}
          className="time text-xs uppercase text-muted-foreground hover:text-primary whitespace-nowrap"
        >
          {t("replay")}
        </button>
      </div>

      <ol>
        {dist.runners.map((r, i) => {
          const crossAt = toMs(r.seconds);
          const done = elapsed >= crossAt;
          const progress = Math.min(1, elapsed / crossAt);
          return (
            <li
              key={`${dist.key}-${r.id}`}
              className="relative grid grid-cols-[1.5rem_1fr_auto] sm:grid-cols-[1.5rem_12.5rem_1fr_8.5rem] items-center gap-x-3 gap-y-1.5 border-b py-2.5"
            >
              <span className={cn("time text-sm", done ? (i < 3 ? "text-primary font-semibold" : "text-foreground") : "text-muted-foreground/40")}>
                {i + 1}
              </span>
              <span className="min-w-0">
                <Link href={`/runners/${r.id}`} className="block truncate text-sm font-medium hover:text-primary">
                  {r.name}
                </Link>
                <span className="block truncate text-xs text-muted-foreground sm:hidden">{r.race}</span>
              </span>

              {/* Lane */}
              <span className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto relative h-2.5 sm:h-3 bg-muted border-r-[3px] border-foreground">
                <span
                  className={cn("absolute inset-y-0 left-0", i === 0 ? "bg-primary" : "bg-foreground/75")}
                  style={{ width: `${progress * 100}%` }}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 size-3.5 sm:size-4 -translate-x-1/2 -translate-y-1/2 border-2 border-background",
                    i === 0 ? "bg-primary" : "bg-foreground",
                  )}
                  style={{ left: `${progress * 100}%` }}
                />
              </span>

              <span className="text-right sm:pl-3 row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto">
                <span className={cn("time block text-sm transition-opacity duration-300", done ? "opacity-100" : "opacity-0")}>
                  {r.time}
                </span>
                <span className={cn("time block text-[11px] text-muted-foreground transition-opacity duration-300", done ? "opacity-100" : "opacity-0")}>
                  {i === 0 ? t("winner") : gap(r.seconds - tMin, (s) => t("gapSeconds", { s }))}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>{t("note")}</span>
        <Link href={dist.href} className="hover:text-foreground whitespace-nowrap">{t("full")}</Link>
      </div>
    </section>
  );
}
