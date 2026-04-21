-- Performance migration
-- Target: all pages under 1.00s cold.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.
--
-- Apply via Supabase Dashboard > SQL Editor.

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Runner profile page: ORDER BY chip_time on a runner's results
CREATE INDEX IF NOT EXISTS idx_results_runner_chip
  ON results (runner_id, chip_time);

-- Rankings page: ORDER BY chip_time per distance_category
CREATE INDEX IF NOT EXISTS idx_results_dist_chip
  ON results (distance_category, chip_time)
  WHERE chip_time IS NOT NULL
    AND chip_time <> '--:--:--'
    AND place IS NOT NULL;

-- Power rankings: ORDER BY elo_score DESC
CREATE INDEX IF NOT EXISTS idx_runners_elo_score_desc
  ON runners (elo_score DESC)
  WHERE is_hidden = false AND elo_score IS NOT NULL;

-- Power rankings filter by level
CREATE INDEX IF NOT EXISTS idx_runners_elo_level
  ON runners (elo_level, elo_score DESC)
  WHERE is_hidden = false AND elo_level IS NOT NULL;

-- ELO city/country rank counts (runner profile)
CREATE INDEX IF NOT EXISTS idx_runners_city_elo
  ON runners (city, elo_score)
  WHERE is_hidden = false AND elo_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_runners_country_elo
  ON runners (country, elo_score)
  WHERE is_hidden = false AND elo_score IS NOT NULL;

-- Runner search (ilike %q%): enable trigram index for fast substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_runners_full_name_trgm
  ON runners USING gin (full_name gin_trgm_ops)
  WHERE is_hidden = false;

-- Events by year (events list filter)
CREATE INDEX IF NOT EXISTS idx_events_year
  ON events (year DESC)
  WHERE scraped_at IS NOT NULL AND year IS NOT NULL;

-- ============================================================================
-- RPCs
-- ============================================================================

-- ELO level distribution: replaces 10 COUNT queries with one GROUP BY
CREATE OR REPLACE FUNCTION get_elo_stats()
RETURNS TABLE (level int, count bigint)
LANGUAGE sql STABLE AS $$
  SELECT elo_level AS level, COUNT(*)::bigint AS count
    FROM runners
   WHERE is_hidden = false AND elo_level IS NOT NULL
   GROUP BY elo_level
   ORDER BY elo_level;
$$;

-- Distinct event years (already unique, but single round-trip)
CREATE OR REPLACE FUNCTION get_event_years()
RETURNS TABLE (year int)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT year
    FROM events
   WHERE scraped_at IS NOT NULL AND year IS NOT NULL
   ORDER BY year DESC;
$$;

-- Runner profile: runner + results + city rank + country rank in ONE round-trip
CREATE OR REPLACE FUNCTION get_runner_full(p_id int)
RETURNS json
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_runner runners%ROWTYPE;
  v_results json;
  v_city_rank int := NULL;
  v_country_rank int := NULL;
BEGIN
  SELECT * INTO v_runner FROM runners WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Results with event info, sorted by chip_time
  SELECT COALESCE(json_agg(r ORDER BY r.chip_time ASC NULLS LAST), '[]'::json) INTO v_results
  FROM (
    SELECT
      r.place, r.bib_number, r.finish_time, r.chip_time,
      r.distance_category, r.checkpoint_times,
      json_build_object('id', e.id, 'slug', e.slug, 'name', e.name, 'year', e.year) AS events
    FROM results r
    JOIN events e ON e.id = r.event_id
    WHERE r.runner_id = p_id
  ) r;

  -- Rank counts (only if runner has elo_score)
  IF v_runner.elo_score IS NOT NULL THEN
    IF v_runner.city IS NOT NULL THEN
      SELECT COUNT(*) + 1 INTO v_city_rank
        FROM runners
       WHERE is_hidden = false AND city = v_runner.city
         AND elo_score > v_runner.elo_score;
    END IF;
    IF v_runner.country IS NOT NULL THEN
      SELECT COUNT(*) + 1 INTO v_country_rank
        FROM runners
       WHERE is_hidden = false AND country = v_runner.country
         AND elo_score > v_runner.elo_score;
    END IF;
  END IF;

  RETURN json_build_object(
    'runner', row_to_json(v_runner),
    'results', v_results,
    'city_rank', v_city_rank,
    'country_rank', v_country_rank
  );
END;
$$;

-- Event stats: one RPC replaces a paginated scan over all event results + JS aggregation.
-- AS MATERIALIZED forces PG to compute the CTE once (PG12+ inlines CTEs by default,
-- which would cause the JOIN to run 3× — once per sub-aggregate below).
CREATE OR REPLACE FUNCTION get_event_stats(p_event_id int)
RETURNS json
LANGUAGE sql STABLE AS $$
  WITH joined AS MATERIALIZED (
    SELECT r.distance_category, ru.country, ru.city
      FROM results r
      JOIN runners ru ON ru.id = r.runner_id
     WHERE r.event_id = p_event_id
       AND ru.is_hidden = false
       AND r.chip_time IS NOT NULL
       AND r.chip_time <> '--:--:--'
  )
  SELECT json_build_object(
    'countries', COALESCE(
      (SELECT json_agg(row_to_json(t) ORDER BY t.count DESC)
         FROM (SELECT country AS label, COUNT(*)::int AS count
                 FROM joined WHERE country IS NOT NULL GROUP BY country) t),
      '[]'::json
    ),
    'cities', COALESCE(
      (SELECT json_agg(row_to_json(t) ORDER BY t.count DESC)
         FROM (SELECT city AS label, COUNT(*)::int AS count
                 FROM joined WHERE city IS NOT NULL GROUP BY city) t),
      '[]'::json
    ),
    'distances', COALESCE(
      (SELECT json_agg(row_to_json(t) ORDER BY t.count DESC)
         FROM (SELECT distance_category AS label, COUNT(*)::int AS count
                 FROM joined WHERE distance_category IS NOT NULL GROUP BY distance_category) t),
      '[]'::json
    )
  );
$$;

-- Distinct distance categories for one event (by numeric id).
-- Replaces a 1000-row .select("distance_category") fallback in the TS layer.
CREATE OR REPLACE FUNCTION get_event_categories_by_id(p_event_id int)
RETURNS TABLE (distance_category text)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT r.distance_category
    FROM results r
   WHERE r.event_id = p_event_id
     AND r.distance_category IS NOT NULL
   ORDER BY r.distance_category;
$$;

-- Rankings: single distance, best chip_time per runner, top N.
-- Uses idx_results_dist_chip via ORDER BY chip_time + LIMIT p_limit*5 to stay cheap.
CREATE OR REPLACE FUNCTION get_rankings_by_distance(
  p_distance text,
  p_limit int DEFAULT 100,
  p_year int DEFAULT NULL
)
RETURNS json
LANGUAGE sql STABLE AS $$
  WITH candidates AS (
    SELECT r.chip_time, r.finish_time, r.place, r.distance_category,
           r.runner_id, r.event_id
      FROM results r
      JOIN runners ru ON ru.id = r.runner_id AND ru.is_hidden = false
      JOIN events  e  ON e.id = r.event_id
     WHERE r.distance_category = p_distance
       AND r.chip_time IS NOT NULL
       AND r.chip_time <> '--:--:--'
       AND r.place IS NOT NULL
       AND (p_year IS NULL OR e.year = p_year)
     ORDER BY r.chip_time ASC
     LIMIT p_limit * 5
  ),
  deduped AS (
    SELECT DISTINCT ON (runner_id) chip_time, finish_time, place, distance_category, runner_id, event_id
      FROM candidates
     ORDER BY runner_id, chip_time ASC
  )
  SELECT COALESCE(json_agg(x ORDER BY x.chip_time), '[]'::json)
    FROM (
      SELECT d.chip_time, d.finish_time, d.place, d.distance_category,
        json_build_object('id', ru.id, 'full_name', ru.full_name,
          'country', ru.country, 'city', ru.city) AS runners,
        json_build_object('name', e.name, 'slug', e.slug, 'year', e.year) AS events
      FROM deduped d
      JOIN runners ru ON ru.id = d.runner_id
      JOIN events  e  ON e.id = d.event_id
      ORDER BY d.chip_time ASC
      LIMIT p_limit
    ) x;
$$;

-- Rankings: all three main distances in one round-trip.
-- LATERAL + LIMIT per distance forces index use on idx_results_dist_chip.
CREATE OR REPLACE FUNCTION get_rankings_all(
  p_per_distance int DEFAULT 35,
  p_year int DEFAULT NULL
)
RETURNS json
LANGUAGE sql STABLE AS $$
  WITH distances(d) AS (
    VALUES ('42 км 195 м'::text), ('21 км 97,5 м'::text), ('10 км'::text)
  ),
  candidates AS (
    SELECT x.*
      FROM distances dd
      CROSS JOIN LATERAL (
        SELECT r.chip_time, r.finish_time, r.place, r.distance_category,
               r.runner_id, r.event_id
          FROM results r
          JOIN runners ru ON ru.id = r.runner_id AND ru.is_hidden = false
          JOIN events  e  ON e.id = r.event_id
         WHERE r.distance_category = dd.d
           AND r.chip_time IS NOT NULL
           AND r.chip_time <> '--:--:--'
           AND r.place IS NOT NULL
           AND (p_year IS NULL OR e.year = p_year)
         ORDER BY r.chip_time ASC
         LIMIT p_per_distance * 5
      ) x
  ),
  deduped AS (
    SELECT DISTINCT ON (distance_category, runner_id)
           chip_time, finish_time, place, distance_category, runner_id, event_id
      FROM candidates
     ORDER BY distance_category, runner_id, chip_time ASC
  ),
  ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY distance_category ORDER BY chip_time ASC) AS rn
      FROM deduped
  )
  SELECT COALESCE(json_agg(x ORDER BY x.distance_category, x.chip_time), '[]'::json)
    FROM (
      SELECT d.chip_time, d.finish_time, d.place, d.distance_category,
        json_build_object('id', ru.id, 'full_name', ru.full_name,
          'country', ru.country, 'city', ru.city) AS runners,
        json_build_object('name', e.name, 'slug', e.slug, 'year', e.year) AS events
      FROM ranked d
      JOIN runners ru ON ru.id = d.runner_id
      JOIN events  e  ON e.id = d.event_id
      WHERE d.rn <= p_per_distance
    ) x;
$$;

-- ============================================================================
-- ANALYZE — refresh planner statistics after index creation
-- ============================================================================
ANALYZE runners;
ANALYZE results;
ANALYZE events;
