import Link from "next/link";
import { cn } from "@/lib/utils";
import { eloLevel, nextLevel, MAX_LEVEL, TIER_COLOR } from "@/lib/elo-levels";
import { TierBadge } from "@/components/tier-badge";

/**
 * Ten ticks, filled up to the runner's level in each tier's colour, and
 * growing taller up the ladder — the climb at a glance.
 */
export function LevelMeter({ level }: { level: number }) {
  return (
    <span className="flex items-end gap-[3px]" role="img" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span
          key={i}
          className={cn("w-1.5", i >= level && "bg-muted")}
          style={{
            height: `${8 + i * 0.75}px`,
            background: i < level ? TIER_COLOR[eloLevel(i + 1).tone] : undefined,
          }}
        />
      ))}
    </span>
  );
}

/** "142 to Gold II" with a thin bar through the current tier. */
function NextTier({ score, level }: { score: number; level: number }) {
  const next = nextLevel(score, level);
  if (!next) return <p className="eyebrow !text-primary mt-1.5">Top tier reached</p>;
  const from = eloLevel(level).min;
  const pct = Math.min(100, Math.max(0, ((score - from) / (next.min - from)) * 100));
  return (
    <Link href={`/power-rankings?level=${next.level}`} className="group mt-2 block max-w-64">
      <span className="block h-1 bg-muted">
        <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="mt-1 block text-xs text-muted-foreground group-hover:text-foreground">
        <span className="time font-semibold text-foreground">{next.missing.toLocaleString()}</span> to {next.name}
      </span>
    </Link>
  );
}

function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("py-3 sm:px-5 sm:first:pl-0 sm:border-l sm:first:border-l-0", className)}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

interface RunnerStatLineProps {
  elo?: { score: number; level: number; cityRank?: number | null; countryRank?: number | null } | null;
  city?: string | null;
  country?: string | null;
  races: number;
  seasons: number;
  distances: number;
}

/** One ruled strip of numbers under a runner's name. No cards, no glow. */
export function RunnerStatLine({ elo, city, country, races, seasons, distances }: RunnerStatLineProps) {
  return (
    <dl className="grid grid-cols-3 sm:flex sm:flex-wrap border-b gap-x-4">
      {elo && (
        <Stat label="Power score" className="col-span-3 border-b sm:border-b-0 sm:pr-8">
          <div className="flex items-center gap-3">
            <Link href={`/power-rankings?level=${elo.level}`} className="headline text-5xl tabular-nums hover:text-primary">
              {elo.score.toLocaleString()}
            </Link>
            <div className="space-y-1">
              <LevelMeter level={elo.level} />
              <p className="text-xs flex items-center gap-1.5">
                <TierBadge level={elo.level} />
                <span className="time text-muted-foreground">L{elo.level}</span>
              </p>
            </div>
          </div>
          <NextTier score={elo.score} level={elo.level} />
          {(elo.cityRank || elo.countryRank) && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {elo.cityRank && city && <>#{elo.cityRank.toLocaleString()} in {city}</>}
              {elo.cityRank && city && elo.countryRank && country && " · "}
              {elo.countryRank && country && <>#{elo.countryRank.toLocaleString()} in {country}</>}
            </p>
          )}
        </Stat>
      )}
      <Stat label="Finishes"><span className="headline text-4xl tabular-nums">{races}</span></Stat>
      <Stat label="Seasons"><span className="headline text-4xl tabular-nums">{seasons}</span></Stat>
      <Stat label="Distances"><span className="headline text-4xl tabular-nums">{distances}</span></Stat>
    </dl>
  );
}

/** Initial in a square — used where a runner has no photo. */
export function Monogram({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn("size-14 object-cover shrink-0", className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn("size-14 shrink-0 bg-foreground text-background headline text-3xl flex items-center justify-center", className)}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
