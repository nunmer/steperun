import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getStats, getEvents, getRankingsOverview } from "@/lib/queries";
import { EventLine } from "@/components/event-list";
import { Odometer } from "@/components/home/odometer";
import { HomeSearch } from "@/components/home/home-search";
import { HeroVideo } from "@/components/home/hero-video";
import { PhotoSpread } from "@/components/home/photo-spread";
import { ResultsTicker, type TickerItem } from "@/components/home/results-ticker";
import { RaceReplay, type ReplayDistance } from "@/components/home/race-replay";
import { timeToSeconds } from "@/lib/params";
import { buildHref } from "@/components/pagination";
import { formatNumber } from "@/lib/utils";

const LATEST_COUNT = 8;
const REPLAY_SIZE = 8;
const TICKER_PER_DISTANCE = 3;

/** "42 км 195 м" → "Marathon" etc.; anything else keeps its own label. */
const DISTANCE_KEYS: Record<string, "marathon" | "half" | "tenK"> = {
  "42 км 195 м": "marathon",
  "21 км 97,5 м": "half",
  "10 км": "tenK",
};

function Figure({ value, label, delay }: { value: number; label: string; delay: number }) {
  return (
    <div className="border-t border-rule/60 pt-2">
      <dd className="headline text-[2rem] sm:text-5xl"><Odometer value={value} delay={delay} /></dd>
      <dt className="eyebrow mt-1">{label}</dt>
    </div>
  );
}

export default async function HomePage() {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const distanceName = (d: string) => (DISTANCE_KEYS[d] ? t(`distances.${DISTANCE_KEYS[d]}`) : d);
  const headline = [t("hero.line1"), t("hero.line2")];
  const [stats, events, overview] = await Promise.all([
    getStats(),
    getEvents(),
    getRankingsOverview(REPLAY_SIZE),
  ]);

  const latest = events.slice(0, LATEST_COUNT);
  const firstYear = events.reduce((min, e) => (e.year && e.year < min ? e.year : min), Infinity);

  const groups = overview.filter((g) => g.rows.length > 0);

  const replay: ReplayDistance[] = groups.map((g) => ({
    key: g.distance,
    label: distanceName(g.distance),
    href: buildHref("/rankings", { distance: g.distance }),
    runners: g.rows
      .map((row) => ({
        id: row.runners.id,
        name: row.runners.full_name,
        time: row.chip_time ?? "",
        seconds: timeToSeconds(row.chip_time),
        race: row.events.name,
      }))
      .filter((r) => Number.isFinite(r.seconds)),
  }));

  // Ticker: podium finishes per distance, interleaved with the latest races.
  const podiumItems: TickerItem[] = groups.flatMap((g) =>
    g.rows.slice(0, TICKER_PER_DISTANCE).map((row, i) => ({
      href: `/runners/${row.runners.id}`,
      label: row.runners.full_name,
      value: row.chip_time ?? "",
      note: `${distanceName(g.distance)} #${i + 1}`,
    })),
  );
  const raceItems: TickerItem[] = latest.map((e) => ({
    href: `/events/${e.slug}`,
    label: e.name,
    value: formatNumber(e.total_results, locale),
    note: t("ticker.finishers"),
  }));
  const ticker = podiumItems.flatMap((p, i) => (raceItems[i] ? [p, raceItems[i]] : [p]));

  // Names for the search hint: real leaderboard names, Latin and Cyrillic mixed.
  const hintNames = [...new Set(groups.flatMap((g) => g.rows.slice(0, 4).map((r) => r.runners.full_name)))].slice(0, 8);

  return (
    <div className="space-y-20 sm:space-y-28">
      {/*
        Hero: full-bleed night scene over the running loop. It always uses the
        dark palette (class "dark") whatever the site theme, slides up under the
        transparent nav, and ends on the results ticker.
      */}
      <section
        id="hero"
        className="dark relative w-screen ml-[calc(50%-50vw)] -mt-[5.5rem] sm:-mt-[6.5rem] min-h-[100svh] flex flex-col bg-background text-foreground overflow-hidden"
      >
        <HeroVideo src="/media/hero.mp4" poster="/media/hero-poster.jpg" />
        {/* Scrim: heavier on the left where the type sits. */}
        <div aria-hidden className="absolute inset-0 bg-background/55" />
        <div aria-hidden className="absolute inset-y-0 left-0 w-full lg:w-[62%] bg-background/35" />

        <div className="relative flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12 items-end">
          <div>
            <p className="eyebrow mb-5">
              {t("hero.kicker")}{Number.isFinite(firstYear) ? t("hero.since", { year: firstYear }) : ""}
            </p>
            <h1 className="headline text-[3.6rem] leading-[0.86] sm:text-8xl">
              {headline.map((line, i) => (
                <span key={line} className="reveal-line sm:whitespace-nowrap" style={{ ["--i" as string]: i }}>
                  <span>{line}</span>
                </span>
              ))}
              <span className="reveal-line tape text-primary sm:whitespace-nowrap" style={{ ["--i" as string]: headline.length }}>
                <span>{t("hero.line3")}</span>
              </span>
            </h1>
            <dl className="mt-10 grid grid-cols-3 gap-4 sm:gap-8 max-w-xl">
              <Figure value={stats.results} label={t("hero.finishes")} delay={500} />
              <Figure value={stats.runners} label={t("hero.runners")} delay={650} />
              <Figure value={stats.events} label={t("hero.races")} delay={800} />
            </dl>
          </div>

          <div className="lg:pb-1">
            <HomeSearch names={hintNames} />
            <ul className="mt-4 text-sm divide-y divide-foreground/15 border-b border-foreground/15">
              {[
                { href: "/rankings", label: t("links.rankings") },
                { href: "/power-rankings", label: t("links.power") },
                { href: "/runners/head-to-head", label: t("links.h2h") },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="group flex justify-between py-2.5 hover:text-primary transition-colors">
                    {label}
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative">
          <ResultsTicker items={ticker} />
        </div>
      </section>

      <RaceReplay distances={replay} />

      <PhotoSpread />

      <section>
        <div className="flex items-end justify-between border-b-2 border-rule pb-2">
          <h2 className="headline text-5xl sm:text-6xl">{t("latest.title")}</h2>
          <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground">
            {t("latest.all", { count: stats.events })}
          </Link>
        </div>
        <ul className="grid lg:grid-cols-2 lg:gap-x-12">
          {latest.map((event) => (
            <EventLine key={event.slug} event={event} />
          ))}
        </ul>
      </section>
    </div>
  );
}
