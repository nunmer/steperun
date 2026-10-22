/** ELO tiers shared by Power Rankings and runner profiles. */
export const ELO_LEVELS: Record<number, { name: string; range: string }> = {
  1:  { name: "Bronze I",    range: "100–500"   },
  2:  { name: "Bronze II",   range: "501–750"   },
  3:  { name: "Silver I",    range: "751–900"   },
  4:  { name: "Silver II",   range: "901–1050"  },
  5:  { name: "Gold I",      range: "1051–1200" },
  6:  { name: "Gold II",     range: "1201–1350" },
  7:  { name: "Platinum",    range: "1351–1530" },
  8:  { name: "Diamond",     range: "1531–1750" },
  9:  { name: "Master",      range: "1751–2000" },
  10: { name: "Grandmaster", range: "2001+"     },
};

export const MAX_LEVEL = 10;

export function eloLevel(level: number | null | undefined) {
  return ELO_LEVELS[level ?? 1] ?? ELO_LEVELS[1];
}
