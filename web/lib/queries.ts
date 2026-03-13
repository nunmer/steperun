import { supabase } from "./supabase";

export const PAGE_SIZE = 30;

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
  const [runnersRes, eventsRes, resultsRes] = await Promise.all([
    supabase.from("runners").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }).not("scraped_at", "is", null),
    supabase.from("results").select("id", { count: "exact", head: true }),
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

export async function getEventYears(): Promise<number[]> {
  const { data } = await supabase
    .from("events")
    .select("year")
    .not("scraped_at", "is", null)
    .not("year", "is", null)
    .order("year", { ascending: false });
  const years = [...new Set(((data ?? []) as any[]).map((e) => e.year as number))];
  return years;
}

export async function getEvent(slug: string): Promise<EventRow | null> {
  const { data } = await supabase
    .from("events")
    .select("id, slug, name, year, total_results, scraped_at, url")
    .eq("slug", slug)
    .single();
  return data as EventRow | null;
}

export async function getEventCategories(eventSlugOrId: string | number): Promise<string[]> {
  if (typeof eventSlugOrId === "string") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("get_event_categories", { p_slug: eventSlugOrId });
    if (!error && data && (data as any[]).length > 0) {
      return (data as any[]).map((r) => r.distance_category as string).filter(Boolean);
    }
  }

  // Resolve event ID
  const eventId = typeof eventSlugOrId === "number"
    ? eventSlugOrId
    : (await getEvent(eventSlugOrId))?.id;
  if (!eventId) return [];

  const { data: rows } = await supabase
    .from("results")
    .select("distance_category")
    .eq("event_id", eventId)
    .not("distance_category", "is", null)
    .limit(1000);
  const cats = [...new Set(((rows ?? []) as any[]).map((r) => r.distance_category as string))];
  return cats.sort();
}

export type EventStats = {
  countries: { label: string; count: number }[];
  cities: { label: string; count: number }[];
  distances: { label: string; count: number }[];
};

export async function getEventStats(eventId: number): Promise<EventStats> {
  // Fetch all results — paginate past Supabase's 1000-row default, in parallel
  const batchSize = 1000;

  // First batch to determine total size
  const first = await supabase
    .from("results")
    .select("distance_category, runners!inner(country, city)", { count: "exact" })
    .eq("event_id", eventId)
    .eq("runners.is_hidden", false)
    .not("chip_time", "is", null)
    .neq("chip_time", "--:--:--")
    .range(0, batchSize - 1);

  const allRows: any[] = (first.data ?? []) as any[];
  const totalRows = first.count ?? allRows.length;

  // Fetch remaining batches in parallel
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
      allRows.push(...((res.data ?? []) as any[]));
    }
  }

  const rows = allRows;

  const countMap = (extractor: (r: any) => string | null) => {
    const counts = new Map<string, number>();
    for (const r of rows) {
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
}

export async function getEventResults(
  eventId: number,
  opts: { category?: string; page?: number } = {}
): Promise<{ rows: ResultWithRunner[]; total: number }> {
  const page = opts.page ?? 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from("results")
    .select(
      "place, bib_number, finish_time, chip_time, checkpoint_times, distance_category, runners!inner(id, full_name, country, city)",
      { count: "exact" }
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
    // Fetch each main distance separately — only need limit/MAIN_DISTANCES.length each
    const perDistLimit = Math.ceil(limit / MAIN_DISTANCES.length) + 5;
    const perDist = await Promise.all(
      MAIN_DISTANCES.map((d) => getRankings({ distance: d, year: opts.year, limit: perDistLimit }))
    );

    // Interleave: 1st of each, 2nd of each, 3rd of each, ...
    const result: RankingRow[] = [];
    for (let i = 0; i < perDistLimit; i++) {
      for (const group of perDist) {
        if (i < group.length) result.push(group[i]);
      }
    }
    return result.slice(0, limit);
  }

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
    .limit(limit * 3); // over-fetch for dedup

  if (opts.year) {
    q = q.eq("events.year", opts.year);
  }

  const { data } = await q;
  const rows = (data ?? []) as unknown as RankingRow[];

  // Single distance: keep best time per runner
  const best = new Map<number, RankingRow>();
  for (const row of rows) {
    const runnerId = (row.runners as any)?.id as number;
    if (!runnerId) continue;
    if (!best.has(runnerId)) best.set(runnerId, row);
  }

  return [...best.values()].slice(0, limit);
}

export async function getDistanceOptions(): Promise<string[]> {
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
}

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------

export async function getRunners(
  opts: { search?: string; page?: number } = {}
): Promise<{ runners: RunnerRow[]; total: number }> {
  const page = opts.page ?? 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from("runners")
    .select("id, full_name, country, city, elo_score, elo_level", { count: "exact" })
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
  const { data: runner } = await supabase
    .from("runners")
    .select("id, full_name, country, city, elo_score, elo_level, created_at")
    .eq("id", id)
    .single();

  if (!runner) return null;

  const { data: results } = await supabase
    .from("results")
    .select(
      "place, bib_number, finish_time, chip_time, distance_category, checkpoint_times, events!inner(id, slug, name, year)"
    )
    .eq("runner_id", id)
    .order("chip_time", { ascending: true });

  return {
    runner: runner as RunnerRow,
    results: (results ?? []) as unknown as ResultWithEvent[],
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

  let q = supabase
    .from("runners")
    .select("id, full_name, country, city, elo_score, elo_level", { count: "exact" })
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

export async function getEloStats() {
  const levels = await Promise.all(
    Array.from({ length: 10 }, (_, i) => i + 1).map(async (lvl) => {
      const { count } = await supabase
        .from("runners")
        .select("id", { count: "exact", head: true })
        .eq("is_hidden", false)
        .eq("elo_level", lvl);
      return { level: lvl, count: count ?? 0 };
    })
  );
  return levels;
}
