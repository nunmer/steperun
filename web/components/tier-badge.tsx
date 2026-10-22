import { cn } from "@/lib/utils";
import { eloLevel, MAX_LEVEL, TIER_COLOR } from "@/lib/elo-levels";

/*
 * Tier insignia, styled like a race bib tag. The treatment escalates with
 * the tier so climbing one is visible at a glance:
 *   Bronze, Silver            outline in the tier colour
 *   Gold, Platinum            solid tag
 *   Diamond                   solid + ◆
 *   Master                    solid bib orange + ★
 *   Grandmaster               split tag: bib-orange ★★ tab + ink name block
 */

interface TierBadgeProps {
  level: number | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

const MARK: Record<number, string> = { 8: "◆", 9: "★", 10: "★★" };

function tagStyle(level: number): React.CSSProperties {
  const color = TIER_COLOR[eloLevel(level).tone];
  if (level === MAX_LEVEL) {
    return { background: "var(--foreground)", borderColor: "var(--foreground)", color: "var(--background)" };
  }
  if (level >= 5) {
    // Ochre is light, so Gold takes ink letters; the darker tags take paper.
    const ink = eloLevel(level).tone === "gold";
    return { background: color, borderColor: color, color: ink ? "oklch(0.21 0.012 60)" : "var(--background)" };
  }
  return { borderColor: color, color };
}

export function TierBadge({ level, size = "sm", className }: TierBadgeProps) {
  const lvl = level ?? 1;
  const mark = MARK[lvl];
  const top = lvl === MAX_LEVEL;
  const pad = size === "sm" ? "px-1.5 py-[3px]" : "px-2 py-1";

  return (
    <span
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-[var(--radius)] border align-middle whitespace-nowrap",
        "headline leading-none tracking-wide",
        size === "sm" ? "text-[13px]" : "text-base",
        className,
      )}
      style={tagStyle(lvl)}
    >
      {top ? (
        <span aria-hidden className={cn("flex items-center bg-primary text-primary-foreground text-[0.8em]", pad)}>
          {mark}
        </span>
      ) : null}
      <span className={cn("flex items-center gap-1", pad)}>
        {mark && !top && <span aria-hidden className="text-[0.8em]">{mark}</span>}
        <span className="trim-caps">{eloLevel(lvl).name}</span>
      </span>
    </span>
  );
}
