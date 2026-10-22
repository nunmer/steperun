/**
 * ELO tiers shared by Power Rankings and runner profiles.
 * `min` mirrors get_level() in scripts/calculate_elo.py.
 * `tone` is the tier's colour token; the badge treatment escalates with the
 * tier (outline → solid → solid + mark → ink tag framed in bib orange).
 */
export type TierTone = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "grandmaster";

export interface EloLevelInfo {
  name: string;
  range: string;
  min: number;
  tone: TierTone;
}

export const ELO_LEVELS: Record<number, EloLevelInfo> = {
  1:  { name: "Bronze I",    range: "100–500",   min: 100,  tone: "bronze"   },
  2:  { name: "Bronze II",   range: "501–750",   min: 501,  tone: "bronze"   },
  3:  { name: "Silver I",    range: "751–900",   min: 751,  tone: "silver"   },
  4:  { name: "Silver II",   range: "901–1050",  min: 901,  tone: "silver"   },
  5:  { name: "Gold I",      range: "1051–1200", min: 1051, tone: "gold"     },
  6:  { name: "Gold II",     range: "1201–1350", min: 1201, tone: "gold"     },
  7:  { name: "Platinum",    range: "1351–1530", min: 1351, tone: "platinum" },
  8:  { name: "Diamond",     range: "1531–1750", min: 1531, tone: "diamond"  },
  9:  { name: "Master",      range: "1751–2000", min: 1751, tone: "master"   },
  10: { name: "Grandmaster", range: "2001+",     min: 2001, tone: "grandmaster" },
};

export const MAX_LEVEL = 10;

/** CSS colour per tone, from the chart palette (see docs/DESIGN.md). */
export const TIER_COLOR: Record<TierTone, string> = {
  bronze: "var(--chart-5)",
  silver: "var(--chart-4)",
  gold: "var(--chart-2)",
  // a deeper steel than Silver, so the two never read as one tier
  platinum: "color-mix(in oklch, var(--chart-4), var(--foreground) 35%)",
  diamond: "var(--chart-3)",
  master: "var(--primary)",
  grandmaster: "var(--foreground)",
};

export function eloLevel(level: number | null | undefined) {
  return ELO_LEVELS[level ?? 1] ?? ELO_LEVELS[1];
}

/** The next tier and how many points are missing, or null at the top. */
export function nextLevel(score: number, level: number) {
  if (level >= MAX_LEVEL) return null;
  const next = eloLevel(level + 1);
  return { level: level + 1, ...next, missing: Math.max(1, next.min - score) };
}
