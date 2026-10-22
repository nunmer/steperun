"use client";

import { useEffect, useState } from "react";

const DIGITS = Array.from({ length: 20 }, (_, i) => i % 10);

/**
 * A number that rolls into place digit by digit, like a timing board.
 * Each digit spins through a full extra turn; the leftmost digits settle first.
 * Server render shows zeros; the real value is always in the accessible text.
 */
export function Odometer({ value, delay = 0 }: { value: number; delay?: number }) {
  const [rolled, setRolled] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setRolled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const chars = value.toLocaleString("en-US").split("");
  let digitIndex = 0;

  return (
    <span className="tabular-nums whitespace-nowrap">
      <span className="sr-only">{value.toLocaleString("en-US")}</span>
      <span aria-hidden>
        {chars.map((ch, i) => {
          if (!/\d/.test(ch)) {
            return <span key={i} className="odo-digit">{ch}</span>;
          }
          const d = Number(ch);
          const order = digitIndex++;
          return (
            <span key={i} className="odo-digit">
              <span
                style={{
                  transform: `translateY(-${rolled ? (10 + d) : 0}em)`,
                  transitionDelay: `${delay + order * 90}ms`,
                }}
              >
                {DIGITS.map((n, j) => <span key={j} className="block h-[1em]">{n}</span>)}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
