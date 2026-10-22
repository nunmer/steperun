import Link from "next/link";
import { cn } from "@/lib/utils";
import { eloLevel, MAX_LEVEL } from "@/lib/elo-levels";

/** Ten ticks, filled up to the runner's level — the tier ladder at a glance. */
export function LevelMeter({ level }: { level: number }) {
  return (
    <span className="flex gap-[3px]" role="img" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span
          key={i}
          className={cn("h-3 w-1.5", i < level ? (level >= MAX_LEVEL - 1 ? "bg-primary" : "bg-foreground") : "bg-muted")}
        />
      ))}
    </span>
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
              <p className="text-xs">
                <span className="font-semibold">{eloLevel(elo.level).name}</span>
                <span className="text-muted-foreground"> · L{elo.level}</span>
              </p>
            </div>
          </div>
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
