import { cache } from "react";
import { supabase } from "./supabase";
import { cachedQuery, runnerTag } from "./cache";

export const PAGE_SIZE = 30;

// Remember which RPCs are missing (404 from PostgREST) so we don't probe them on
// every request, but re-check after a while so a newly applied migration is
// picked up without a redeploy.
const MISSING_RPC_RECHECK_MS = 10 * 60 * 1000;
const missingRpcs = new Map<string, number>(); // name -> when it was found missing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMissingFunctionError(error: any): boolean {
  if (!error) return false;
  // PostgREST returns PGRST202 when a function is not found
  const code = error.code ?? "";
  const msg = (error.message ?? "").toString();
  return code === "PGRST202" || /Could not find the function/i.test(msg);
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
  const missingSince = missingRpcs.get(name);
  if (missingSince !== undefined && Date.now() - missingSince < MISSING_RPC_RECHECK_MS) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (!error && data !== null && data !== undefined) {
    missingRpcs.delete(name);
    return data as T;
  }
  if (isMissingFunctionError(error)) missingRpcs.set(name, Date.now());
  else if (error) console.error(`[queries] rpc ${name} failed`, error.message);
  return null;
}

/** Escape LIKE wildcards in user input. */
function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type EventRow = {
  id: number;
  slug: string;
  name: string;
  year: number | null;
  url?: string;
  date_of_event: string | null;
  scraped_at: string | null;
  total_results: number;
  organizer: string | null;
};

export type RunnerRow = {
  id: number;
  full_name: string;
  country: string | null;
  city: string | null;
  elo_score: number | null;
  elo_level: number | null;
  claimed_by: string | null;
  created_at?: string;
};

export type ResultWithRunner = {
  place: number | null;
  bib_number: string | null;
  finish_time: string | null;
  chip_time: string | null;
  distance_category: string | null;
  runners: { id: number; full_name: string; country: string | null; city: string | null };
};

export type ResultWithEvent = {
  place: number | null;
  bib_number: string | null;
  finish_time: string | null;
  chip_time: string | null;
  checkpoint_times: string[] | null;
  distance_category: string | null;
  events: { id: number; slug: string; name: string; year: number | null };
};

export type RankingRow = {
  chip_time: string | null;
  finish_time: string | null;
  place: number | null;
  distance_category: string | null;
  runners: { id: number; full_name: string; country: string | null; city: string | null };
  events: { name: string; slug: string; year: number | null };
};

export type Paged<T> = { rows: T[]; total: number };

// ---------------------------------------------------------------------------
// Homepage stats
// ---------------------------------------------------------------------------

export const getStats = cachedQuery(async () => {
  const [runnersRes, eventsRes, resultsRes] = await Promise.all([
    supabase.from("runners").select("id", { count: "exact", head: true }).eq("is_hidden", false),
    supabase.from("events").select("id", { count: "exact", head: true }).not("scraped_at", "is", null),
    supabase.from("results").select("id", { count: "exact", head: true }),
  ]);
  return {
    runners: runnersRes.count ?? 0,
    events: eventsRes.count ?? 0,
    results: resultsRes.count ?? 0,
  };
}, "stats");

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const getEvents = cachedQuery(async (year?: number): Promise<EventRow[]> => {
  let q = supabase
    .from("events")
    .select("id, slug, name, year, date_of_event, total_results, scraped_at, organizer")
    .not("scraped_at", "is", null)
    .order("year", { ascending: false, nullsFirst: false })
    .order("date_of_event", { ascending: false, nullsFirst: false })
    .order("name");

  if (year) q = q.eq("year", year);
  const { data } = await q;
  return (data ?? []) as EventRow[];
}, "events");

export const getEventYears = cachedQuery(async (): Promise<number[]> => {
  const rows = await rpc<{ year: number }[]>("get_event_years", {});
  if (rows) return rows.map((r) => r.year);
  const { data } = await supabase
    .from("events")
    .select("year")
    .not("scraped_at", "is", null)
    .not("year", "is", null)
    .order("year", { ascending: false });
  return [...new Set(((data ?? []) as { year: number }[]).map((e) => e.year))];
}, "event-years");

export const getEvent = cache(
  cachedQuery(async (slug: string): Promise<EventRow | null> => {
    const { data } = await supabase
      .from("events")
      .select("id, slug, name, year, date_of_event, total_results, scraped_at, url, organizer")
      .eq("slug", slug)
      .maybeSingle();
    return data as EventRow | null;
  }, "event"),
);

export type EventStats = {
  countries: { label: string; count: number }[];
  cities: { label: string; count: number }[];
  /** Finishers per distance, most popular first. Also drives the distance filter and totals. */
  distances: { label: string; count: number }[];
};

export const getEventStats = cache(
  cachedQuery(async (eventId: number): Promise<EventStats> => {
    const stats = await rpc<EventStats>("get_event_stats", { p_event_id: eventId });
    if (stats) return stats;
    // Fallback (RPC missing): distances only, via the categories RPC.
    const cats = (await rpc<{ distance_category: string }[]>("get_event_categories_by_id", { p_event_id: eventId })) ?? [];
    return { countries: [], cities: [], distances: cats.map((c) => ({ label: c.distance_category, count: 0 })) };
  }, "event-stats"),
);

/**
 * One page of finishers. The total comes from getEventStats (same filter:
 * visible runners with a real chip time), so no count query is needed.
 */
export const getEventResults = cachedQuery(
  async (eventId: number, category: string | undefined, page: number): Promise<ResultWithRunner[]> => {
    const from = (page - 1) * PAGE_SIZE;
    let q = supabase
      .from("results")
      .select(
        "place, bib_number, finish_time, chip_time, distance_category, runners!inner(id, full_name, country, city)",
      )
      .eq("event_id", eventId)
      .eq("runners.is_hidden", false)
      .not("chip_time", "is", null)
      .neq("chip_time", "--:--:--");

    q = category ? q.eq("distance_category", category) : q.order("distance_category");
    const { data } = await q
      .order("place", { nullsFirst: false })
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    return (data ?? []) as unknown as ResultWithRunner[];
  },
  "event-results",
);

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

// Main distances for the "All" overview (longest first)
export const MAIN_DISTANCES = ["42 км 195 м", "21 км 97,5 м", "10 км"];

/** Top N per main distance, grouped by distance in MAIN_DISTANCES order. */
export const getRankingsOverview = cachedQuery(
  async (perDistance: number, year?: number): Promise<{ distance: string; rows: RankingRow[] }[]> => {
    let rows = await rpc<RankingRow[]>("get_rankings_all", { p_per_distance: perDistance, p_year: year ?? null });
    if (!rows) {
      const perDist = await Promise.all(
        MAIN_DISTANCES.map((d) => getRankingsPage(d, year, 1, perDistance)),
      );
      rows = perDist.flatMap((p) => p.rows);
    }
    return MAIN_DISTANCES.map((distance) => ({
      distance,
      rows: rows!.filter((r) => r.distance_category === distance).slice(0, perDistance),
    }));
  },
  "rankings-overview",
);

/** Best chip time per runner for one distance, paginated, with the exact number of ranked runners. */
export const getRankingsPage = cachedQuery(
  async (distance: string, year: number | undefined, page: number, pageSize: number = PAGE_SIZE): Promise<Paged<RankingRow>> => {
    const res = await rpc<Paged<RankingRow>>("get_rankings_page", {
      p_distance: distance,
      p_year: year ?? null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });
    if (res) return res;
    // Fallback (migration 005 not applied): top 100 only.
    const top = (await rpc<RankingRow[]>("get_rankings_by_distance", {
      p_distance: distance, p_limit: 100, p_year: year ?? null,
    })) ?? [];
    return { rows: top.slice((page - 1) * pageSize, page * pageSize), total: top.length };
  },
  "rankings-page",
);

export type DistanceOption = { label: string; finishers: number | null };

export const getDistanceOptions = cachedQuery(async (): Promise<DistanceOption[]> => {
  const rows = await rpc<{ distance_category: string; finishers?: number; cnt?: number }[]>("get_distance_options", {});
  return (rows ?? [])
    .filter((r) => r.distance_category)
    .map((r) => ({ label: r.distance_category, finishers: r.finishers ?? r.cnt ?? null }));
}, "distance-options");

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------

type RunnerListRow = Pick<RunnerRow, "id" | "full_name" | "country" | "city" | "elo_score" | "elo_level">;

export const getRunners = cachedQuery(
  async (search: string | undefined, page: number, pageSize: number = PAGE_SIZE): Promise<Paged<RunnerListRow>> => {
    const from = (page - 1) * pageSize;
    const q = search?.trim();
    if (q) {
      const res = await rpc<Paged<RunnerListRow>>("search_runners", { p_q: q, p_limit: pageSize, p_offset: from });
      if (res) return res;
      // Fallback (migration 005 not applied): plain substring match.
      const { data, count } = await supabase
        .from("runners")
        .select("id, full_name, country, city, elo_score, elo_level", { count: "exact" })
        .eq("is_hidden", false)
        .ilike("full_name", `%${likeEscape(q)}%`)
        .order("full_name")
        .order("id")
        .range(from, from + pageSize - 1);
      return { rows: (data ?? []) as RunnerListRow[], total: count ?? 0 };
    }
    const { data, count } = await supabase
      .from("runners")
      .select("id, full_name, country, city, elo_score, elo_level", { count: "exact" })
      .eq("is_hidden", false)
      .order("full_name")
      .order("id")
      .range(from, from + pageSize - 1);
    return { rows: (data ?? []) as RunnerListRow[], total: count ?? 0 };
  },
  "runners",
);

export const getRunner = cache(
  cachedQuery(
    async (id: number): Promise<{ runner: RunnerRow; results: ResultWithEvent[] } | null> => {
      const [runnerRes, resultsRes] = await Promise.all([
        supabase
          .from("runners")
          .select("id, full_name, country, city, elo_score, elo_level, claimed_by, created_at")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("results")
          .select(
            "place, bib_number, finish_time, chip_time, distance_category, checkpoint_times, events!inner(id, slug, name, year)",
          )
          .eq("runner_id", id)
          .order("chip_time", { ascending: true }),
      ]);
      if (!runnerRes.data) return null;
      return {
        runner: runnerRes.data as RunnerRow,
        results: (resultsRes.data ?? []) as unknown as ResultWithEvent[],
      };
    },
    "runner",
    (id) => [runnerTag(id)],
  ),
);

// Full runner payload in ONE round-trip via RPC (runner + results + rank counts)
export type RunnerFull = {
  runner: RunnerRow;
  results: ResultWithEvent[];
  cityRank: number | null;
  countryRank: number | null;
};

export const getRunnerFull = cache(
  cachedQuery(
    async (id: number): Promise<RunnerFull | null> => {
      if (!Number.isInteger(id) || id <= 0) return null;
      const payload = await rpc<{
        runner: RunnerRow;
        results: ResultWithEvent[];
        city_rank: number | null;
        country_rank: number | null;
      }>("get_runner_full", { p_id: id });
      if (!payload?.runner) return null;
      return {
        runner: payload.runner,
        results: payload.results ?? [],
        cityRank: payload.city_rank,
        countryRank: payload.country_rank,
      };
    },
    "runner-full",
    (id) => [runnerTag(id)],
  ),
);

/** Up to 10 runners for the nav search box. */
export const searchRunnersQuick = cachedQuery(async (q: string) => {
  const { rows } = await getRunners(q, 1, 10);
  return rows.map(({ id, full_name, country, city }) => ({ id, full_name, country, city }));
}, "search-quick");

// ---------------------------------------------------------------------------
// Power Rankings (ELO)
// ---------------------------------------------------------------------------

export type PowerRankingRow = {
  id: number;
  full_name: string;
  country: string | null;
  city: string | null;
  elo_score: number | null;
  elo_level: number | null;
};

/** One page of the ELO leaderboard. Totals come from getEloStats (exact per level). */
export const getPowerRankings = cachedQuery(
  async (level: number | undefined, page: number): Promise<PowerRankingRow[]> => {
    const from = (page - 1) * PAGE_SIZE;
    let q = supabase
      .from("runners")
      .select("id, full_name, country, city, elo_score, elo_level")
      .eq("is_hidden", false)
      .not("elo_score", "is", null);
    if (level) q = q.eq("elo_level", level);
    const { data } = await q
      .order("elo_score", { ascending: false })
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    return (data ?? []) as PowerRankingRow[];
  },
  "power-rankings",
);

export const getEloStats = cachedQuery(async (): Promise<{ level: number; count: number }[]> => {
  const rows = await rpc<{ level: number; count: number }[]>("get_elo_stats", {});
  const byLevel = new Map((rows ?? []).map((r) => [r.level, Number(r.count)]));
  // Ensure all 10 levels appear even if some have zero runners
  return Array.from({ length: 10 }, (_, i) => ({ level: i + 1, count: byLevel.get(i + 1) ?? 0 }));
}, "elo-stats");
