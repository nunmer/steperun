import { cache } from "react";
import { supabase } from "./supabase";

export const PAGE_SIZE = 30;

// Remember which RPCs are missing (404 from PostgREST) so we stop probing them.
// Applies per server process; a restart clears it (so newly applied migrations pick up).
const missingRpcs = new Set<string>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMissingFunctionError(error: any): boolean {
  if (!error) return false;
  // PostgREST returns PGRST202 when a function is not found
  const code = error.code ?? "";
  const msg = (error.message ?? "").toString();
  return code === "PGRST202" || /Could not find the function/i.test(msg);
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
  checkpoint_times: string[] | null;
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

// ---------------------------------------------------------------------------
// Homepage stats
// ---------------------------------------------------------------------------

export async function getStats() {
  // "planned" uses pg_class.reltuples — an estimate, but homepage stats don't need exactness.
  // Exact counts on 60k+ rows force a full scan (~300-500ms each).
  const [runnersRes, eventsRes, resultsRes] = await Promise.all([
    supabase.from("runners").select("id", { count: "planned", head: true }),
    supabase.from("events").select("id", { count: "planned", head: true }).not("scraped_at", "is", null),
    supabase.from("results").select("id", { count: "planned", head: true }),
  ]);
  return {
    runners: runnersRes.count ?? 0,
    events: eventsRes.count ?? 0,
    results: resultsRes.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function getEvents(year?: number): Promise<EventRow[]> {
  let q = supabase
    .from("events")
    .select("id, slug, name, year, date_of_event, total_results, scraped_at")
    .not("scraped_at", "is", null)
    .order("year", { ascending: false })
    .order("name");

  if (year) q = q.eq("year", year);
  const { data } = await q;
  return (data ?? []) as EventRow[];
}

export const getEventYears = cache(async (): Promise<number[]> => {
  // Prefer RPC (one round-trip, no JS dedup).
  const { data: rpcData, error } = await supabase.rpc("get_event_years");
  if (!error && rpcData) {
    return (rpcData as { year: number }[]).map((r) => r.year);
  }
  // Fallback
  const { data } = await supabase
    .from("events")
    .select("year")
    .not("scraped_at", "is", null)
    .not("year", "is", null)
    .order("year", { ascending: false });
  return [...new Set(((data ?? []) as { year: number }[]).map((e) => e.year))];
});

export const getEvent = cache(async (slug: string): Promise<EventRow | null> => {
  const { data } = await supabase
    .from("events")
    .select("id, slug, name, year, total_results, scraped_at, url")
    .eq("slug", slug)
    .single();
  return data as EventRow | null;
});

export const getEventCategories = cache(async (eventSlugOrId: string | number): Promise<string[]> => {
  // Resolve event ID (cheap when already a number; uses cached getEvent for slug)
  const eventId = typeof eventSlugOrId === "number"
    ? eventSlugOrId
    : (await getEvent(eventSlugOrId))?.id;
  if (!eventId) return [];

  // Prefer RPC — single query returning DISTINCT distance_category
  if (!missingRpcs.has("get_event_categories_by_id")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("get_event_categories_by_id", { p_event_id: eventId });
    if (!error && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as any[]).map((r) => r.distance_category as string).filter(Boolean);
    }
    if (isMissingFunctionError(error)) missingRpcs.add("get_event_categories_by_id");
  }

  // Fallback: sample up to 1000 rows and dedupe in JS
  const { data: rows } = await supabase
    .from("results")
    .select("distance_category")
    .eq("event_id", eventId)
    .not("distance_category", "is", null)
    .limit(1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cats = [...new Set(((rows ?? []) as any[]).map((r) => r.distance_category as string))];
  return cats.sort();
});

export type EventStats = {
  countries: { label: string; count: number }[];
  cities: { label: string; count: number }[];
  distances: { label: string; count: number }[];
};

export const getEventStats = cache(async (eventId: number): Promise<EventStats> => {
  // Prefer RPC: single round-trip, aggregation done in Postgres
  if (!missingRpcs.has("get_event_stats")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
      "get_event_stats",
      { p_event_id: eventId }
    );
    if (!rpcError && rpcData) return rpcData as EventStats;
    if (isMissingFunctionError(rpcError)) missingRpcs.add("get_event_stats");
  }

  // Fallback: batched client-side aggregation (only when RPC missing)
  const batchSize = 1000;
  const first = await supabase
    .from("results")
    .select("distance_category, runners!inner(country, city)", { count: "exact" })
    .eq("event_id", eventId)
    .eq("runners.is_hidden", false)
    .not("chip_time", "is", null)
    .neq("chip_time", "--:--:--")
    .range(0, batchSize - 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRows: any[] = (first.data ?? []) as any[];
  const totalRows = first.count ?? allRows.length;

  if (totalRows > batchSize) {
    const remaining = await Promise.all(
      Array.from(
        { length: Math.ceil((totalRows - batchSize) / batchSize) },
        (_, i) => {
          const offset = (i + 1) * batchSize;
          return supabase
            .from("results")
            .select("distance_category, runners!inner(country, city)")
            .eq("event_id", eventId)
            .eq("runners.is_hidden", false)
            .not("chip_time", "is", null)
            .neq("chip_time", "--:--:--")
            .range(offset, offset + batchSize - 1);
        }
      )
    );
    for (const res of remaining) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allRows.push(...((res.data ?? []) as any[]));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countMap = (extractor: (r: any) => string | null) => {
    const counts = new Map<string, number>();
    for (const r of allRows) {
      const val = extractor(r);
      if (!val) continue;
      counts.set(val, (counts.get(val) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
  };

  return {
    countries: countMap((r) => r.runners?.country),
    cities: countMap((r) => r.runners?.city),
    distances: countMap((r) => r.distance_category),
  };
});

export async function getEventResults(
  eventId: number,
  opts: { category?: string; page?: number } = {}
): Promise<{ rows: ResultWithRunner[]; total: number }> {
  const page = opts.page ?? 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // "planned" avoids counting the full filtered set on every page render.
  let q = supabase
    .from("results")
    .select(
      "place, bib_number, finish_time, chip_time, checkpoint_times, distance_category, runners!inner(id, full_name, country, city)",
      { count: "planned" }
    )
    .eq("event_id", eventId)
    .eq("runners.is_hidden", false)
    .not("chip_time", "is", null)
    .neq("chip_time", "--:--:--")
    .range(from, to);

  if (opts.category) {
    q = q.eq("distance_category", opts.category).order("place", { nullsFirst: false });
  } else {
    q = q.order("distance_category").order("place", { nullsFirst: false });
  }

  const { data, count } = await q;
  return { rows: (data ?? []) as unknown as ResultWithRunner[], total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

// Main distances for "All" mode (longest first)
const MAIN_DISTANCES = ["42 км 195 м", "21 км 97,5 м", "10 км"];

export async function getRankings(opts: {
  distance?: string;
  year?: number;
  limit?: number;
}): Promise<RankingRow[]> {
  const limit = opts.limit ?? 100;
  const isAll = !opts.distance;

  if (isAll) {
    const perDistLimit = Math.ceil(limit / MAIN_DISTANCES.length) + 5;

    // Prefer combined RPC: best-per-runner per distance in ONE round-trip
    if (!missingRpcs.has("get_rankings_all")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
        "get_rankings_all",
        { p_per_distance: perDistLimit, p_year: opts.year ?? null }
      );
      if (!rpcError && rpcData) {
        const byDist = new Map<string, RankingRow[]>();
        for (const row of rpcData as RankingRow[]) {
          const d = row.distance_category ?? "";
          const arr = byDist.get(d) ?? [];
          arr.push(row);
          byDist.set(d, arr);
        }
        const interleaved: RankingRow[] = [];
        for (let i = 0; i < perDistLimit; i++) {
          for (const d of MAIN_DISTANCES) {
            const group = byDist.get(d);
            if (group && i < group.length) interleaved.push(group[i]);
          }
        }
        return interleaved.slice(0, limit);
      }
      if (isMissingFunctionError(rpcError)) missingRpcs.add("get_rankings_all");
    }

    // Fallback: 3 parallel per-distance queries
    const perDist = await Promise.all(
      MAIN_DISTANCES.map((d) => getRankings({ distance: d, year: opts.year, limit: perDistLimit }))
    );
    const result: RankingRow[] = [];
    for (let i = 0; i < perDistLimit; i++) {
      for (const group of perDist) {
        if (i < group.length) result.push(group[i]);
      }
    }
    return result.slice(0, limit);
  }

  // Single distance: prefer RPC with DISTINCT ON (best chip_time per runner in SQL)
  if (!missingRpcs.has("get_rankings_by_distance")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
      "get_rankings_by_distance",
      { p_distance: opts.distance!, p_limit: limit, p_year: opts.year ?? null }
    );
    if (!rpcError && rpcData) return rpcData as RankingRow[];
    if (isMissingFunctionError(rpcError)) missingRpcs.add("get_rankings_by_distance");
  }

  // Fallback: over-fetch and dedup in JS
  let q = supabase
    .from("results")
    .select(
      "chip_time, finish_time, place, distance_category, runners!inner(id, full_name, country, city), events!inner(name, slug, year)"
    )
    .eq("runners.is_hidden", false)
    .eq("distance_category", opts.distance!)
    .not("chip_time", "is", null)
    .neq("chip_time", "--:--:--")
    .not("place", "is", null)
    .order("chip_time", { ascending: true })
    .limit(limit * 3);

  if (opts.year) {
    q = q.eq("events.year", opts.year);
  }

  const { data } = await q;
  const rows = (data ?? []) as unknown as RankingRow[];
  const best = new Map<number, RankingRow>();
  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runnerId = (row.runners as any)?.id as number;
    if (!runnerId) continue;
    if (!best.has(runnerId)) best.set(runnerId, row);
  }

  return [...best.values()].slice(0, limit);
}

export const getDistanceOptions = cache(async (): Promise<string[]> => {
  // Try the RPC (requires get_distance_options() function in Supabase)
  const { data: rpcData, error } = await supabase.rpc("get_distance_options");
  if (!error && rpcData && (rpcData as any[]).length > 0) {
    return (rpcData as any[]).map((r) => r.distance_category as string).filter(Boolean);
  }

  // Fallback: sample enough rows to capture all distance categories
  const { data } = await supabase
    .from("results")
    .select("distance_category")
    .not("distance_category", "is", null)
    .not("chip_time", "is", null)
    .neq("chip_time", "--:--:--")
    .limit(1000);

  const counts = new Map<string, number>();
  for (const r of (data ?? []) as any[]) {
    const d = r.distance_category as string;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
});

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------

export async function getRunners(
  opts: { search?: string; page?: number } = {}
): Promise<{ runners: RunnerRow[]; total: number }> {
  const page = opts.page ?? 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // "planned" uses pg_class.reltuples — avoids a full-scan count on 60k+ rows.
  // For the /runners directory, an approximate total is fine.
  let q = supabase
    .from("runners")
    .select("id, full_name, country, city, elo_score, elo_level", {
      count: opts.search ? "exact" : "planned",
    })
    .eq("is_hidden", false)
    .order("full_name")
    .range(from, to);

  if (opts.search) q = q.ilike("full_name", `%${opts.search}%`);

  const { data, count } = await q;
  return { runners: (data ?? []) as RunnerRow[], total: count ?? 0 };
}

export async function getRunner(
  id: number
): Promise<{ runner: RunnerRow; results: ResultWithEvent[] } | null> {
  const runnerPromise = supabase
    .from("runners")
    .select("id, full_name, country, city, elo_score, elo_level, claimed_by, created_at")
    .eq("id", id)
    .single();
  const resultsPromise = supabase
    .from("results")
    .select(
      "place, bib_number, finish_time, chip_time, distance_category, checkpoint_times, events!inner(id, slug, name, year)"
    )
    .eq("runner_id", id)
    .order("chip_time", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [runnerRes, resultsRes] = (await Promise.all([runnerPromise, resultsPromise])) as [any, any];

  if (!runnerRes.data) return null;

  return {
    runner: runnerRes.data as RunnerRow,
    results: (resultsRes.data ?? []) as unknown as ResultWithEvent[],
  };
}

// Full runner payload in ONE round-trip via RPC (runner + results + rank counts)
export type RunnerFull = {
  runner: RunnerRow;
  results: ResultWithEvent[];
  cityRank: number | null;
  countryRank: number | null;
};

export const getRunnerFull = cache(async (id: number): Promise<RunnerFull | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_runner_full", { p_id: id });
  if (error || !data) return null;
  const payload = data as {
    runner: RunnerRow;
    results: ResultWithEvent[];
    city_rank: number | null;
    country_rank: number | null;
  };
  return {
    runner: payload.runner,
    results: payload.results ?? [],
    cityRank: payload.city_rank,
    countryRank: payload.country_rank,
  };
});

export async function isRunnerClaimed(runnerId: number): Promise<boolean> {
  const { data } = await supabase
    .from("runners")
    .select("id, claimed_by")
    .eq("id", runnerId)
    .single();
  return !!(data as { claimed_by?: string | null } | null)?.claimed_by;
}

// ---------------------------------------------------------------------------
// ELO regional rankings for a specific runner
// ---------------------------------------------------------------------------

export async function getEloRanks(
  runnerId: number,
  city: string | null,
  country: string | null,
  eloScore: number
): Promise<{ cityRank: number | null; countryRank: number | null }> {
  const cityQuery = city
    ? supabase
        .from("runners")
        .select("id", { count: "exact", head: true })
        .eq("is_hidden", false)
        .eq("city", city)
        .not("elo_score", "is", null)
        .gt("elo_score", eloScore)
    : Promise.resolve({ count: null });

  const countryQuery = country
    ? supabase
        .from("runners")
        .select("id", { count: "exact", head: true })
        .eq("is_hidden", false)
        .eq("country", country)
        .not("elo_score", "is", null)
        .gt("elo_score", eloScore)
    : Promise.resolve({ count: null });

  const [cityRes, countryRes] = await Promise.all([cityQuery, countryQuery]);

  return {
    cityRank: city ? (cityRes.count ?? 0) + 1 : null,
    countryRank: country ? (countryRes.count ?? 0) + 1 : null,
  };
}

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

export async function getPowerRankings(opts: {
  level?: number;
  page?: number;
}): Promise<{ runners: PowerRankingRow[]; total: number }> {
  const page = opts.page ?? 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // "planned" uses pg_class.reltuples — avoids a full-scan count on 60k+ rows.
  // Exact rank offsets aren't critical for paginated leaderboards.
  let q = supabase
    .from("runners")
    .select("id, full_name, country, city, elo_score, elo_level", { count: "planned" })
    .eq("is_hidden", false)
    .not("elo_score", "is", null)
    .order("elo_score", { ascending: false })
    .range(from, to);

  if (opts.level) {
    q = q.eq("elo_level", opts.level);
  }

  const { data, count } = await q;
  return { runners: (data ?? []) as PowerRankingRow[], total: count ?? 0 };
}

export async function getEloStats(): Promise<{ level: number; count: number }[]> {
  const { data, error } = await supabase.rpc("get_elo_stats");
  if (error || !data) {
    // Fallback: zeros for all 10 levels
    return Array.from({ length: 10 }, (_, i) => ({ level: i + 1, count: 0 }));
  }
  const rows = data as { level: number; count: number }[];
  // Ensure all 10 levels appear even if some have zero runners
  const byLevel = new Map(rows.map((r) => [r.level, Number(r.count)]));
  return Array.from({ length: 10 }, (_, i) => ({
    level: i + 1,
    count: byLevel.get(i + 1) ?? 0,
  }));
}
