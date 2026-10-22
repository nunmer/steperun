"use client";

import { useEffect, useState } from "react";

const TYPE_MS = 70;
const ERASE_MS = 35;
const HOLD_MS = 1400;

/**
 * Name search whose placeholder types out real runner names (Latin and
 * Cyrillic), showing that both alphabets work. Typing stops the moment the
 * field is focused or has text, and never runs under reduced motion.
 */
export function HomeSearch({ names }: { names: string[] }) {
  const [hint, setHint] = useState("");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || names.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let name = 0;
    let len = 0;
    let erasing = false;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      const target = names[name];
      if (!erasing) {
        len++;
        setHint(target.slice(0, len));
        if (len >= target.length) {
          erasing = true;
          timer = setTimeout(step, HOLD_MS);
          return;
        }
        timer = setTimeout(step, TYPE_MS);
      } else {
        len--;
        setHint(target.slice(0, len));
        if (len <= 0) {
          erasing = false;
          name = (name + 1) % names.length;
        }
        timer = setTimeout(step, ERASE_MS);
      }
    };
    timer = setTimeout(step, 1200);
    return () => clearTimeout(timer);
  }, [paused, names]);

  return (
    <form action="/runners" className="border-2 border-rule p-4 sm:p-5 bg-card">
      <label htmlFor="home-q" className="headline text-3xl block">Find your results</label>
      <p className="text-sm text-muted-foreground mt-1">Latin or Cyrillic, any word order.</p>
      <div className="mt-4 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id="home-q"
            name="q"
            required
            minLength={2}
            placeholder={paused ? "Name and surname" : ""}
            onFocus={() => setPaused(true)}
            className="h-11 w-full rounded-sm border border-input bg-background px-3 text-base outline-none focus:border-foreground"
          />
          {!paused && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center text-base text-muted-foreground truncate"
            >
              {hint || "Name and surname"}
              {hint && <span className="caret ml-px inline-block h-5 w-[2px] bg-primary" />}
            </span>
          )}
        </div>
        <button className="h-11 px-4 rounded-sm bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
          Search
        </button>
      </div>
    </form>
  );
}
