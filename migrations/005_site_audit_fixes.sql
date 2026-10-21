-- ============================================================================
-- 005: site audit fixes (docs/AUDIT-2026-10-21.md)
--
--   * get_event_categories_by_id: missing in prod although defined in 001,
--     so event pages fell back to a 1000-row sample and lost distances
--   * get_distance_options: formalized (existed only as a hand-made function)
--   * get_rankings_page: paginated "best time per runner" with exact total
--   * fold_name / search_runners: Latin <-> Cyrillic tolerant runner search
--     (mirrors scraper/names.py fold()), wildcard-safe, word-order-free
--   * indexes: composite for event results; drop redundant write-only ones
--   * data: Tour Of World Class Almaty had year = NULL
--
-- Safe to re-run. Apply in the Supabase SQL Editor BEFORE deploying the web
-- changes that call these functions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Event distances (one event)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_event_categories_by_id(p_event_id int)
RETURNS TABLE (distance_category text)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT r.distance_category
    FROM results r
   WHERE r.event_id = p_event_id
     AND r.distance_category IS NOT NULL
   ORDER BY r.distance_category;
$$;

-- ---------------------------------------------------------------------------
-- All distances with finisher counts (rankings distance picker)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_distance_options();
CREATE FUNCTION get_distance_options()
RETURNS TABLE (distance_category text, finishers bigint)
LANGUAGE sql STABLE AS $$
  SELECT r.distance_category, COUNT(*)::bigint AS finishers
    FROM results r
   WHERE r.distance_category IS NOT NULL
     AND r.chip_time IS NOT NULL
     AND r.chip_time <> '--:--:--'
     AND r.place IS NOT NULL
   GROUP BY r.distance_category
   ORDER BY finishers DESC, r.distance_category;
$$;

-- ---------------------------------------------------------------------------
-- Rankings: best chip time per runner for one distance, paginated.
-- Returns {"total": <runners ranked>, "rows": [...]} ordered by time, then
-- runner id (unique sort key, so pages never overlap).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_rankings_page(
  p_distance text,
  p_year     int DEFAULT NULL,
  p_limit    int DEFAULT 30,
  p_offset   int DEFAULT 0
)
RETURNS json
LANGUAGE sql STABLE AS $$
  WITH best AS (
    SELECT DISTINCT ON (r.runner_id)
           r.runner_id, r.chip_time, r.finish_time, r.place, r.event_id, r.distance_category
      FROM results r
      JOIN runners ru ON ru.id = r.runner_id AND ru.is_hidden = false
      JOIN events  e  ON e.id = r.event_id
     WHERE r.distance_category = p_distance
       AND r.chip_time IS NOT NULL
       AND r.chip_time <> '--:--:--'
       AND r.place IS NOT NULL
       AND (p_year IS NULL OR e.year = p_year)
     ORDER BY r.runner_id, r.chip_time, r.id
  ),
  page AS (
    SELECT b.*
      FROM best b
     ORDER BY b.chip_time, b.runner_id
     LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
  )
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM best),
    'rows', COALESCE((
      SELECT json_agg(json_build_object(
               'chip_time', p.chip_time, 'finish_time', p.finish_time, 'place', p.place,
               'distance_category', p.distance_category,
               'runners', json_build_object('id', ru.id, 'full_name', ru.full_name,
                                            'country', ru.country, 'city', ru.city),
               'events',  json_build_object('name', e.name, 'slug', e.slug, 'year', e.year)
             ) ORDER BY p.chip_time, p.runner_id)
        FROM page p
        JOIN runners ru ON ru.id = p.runner_id
        JOIN events  e  ON e.id = p.event_id
    ), '[]'::json)
  );
$$;

-- ---------------------------------------------------------------------------
-- Name folding (keep in sync with scraper/names.py fold())
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fold_name(t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT regexp_replace(
    replace(replace(replace(replace(replace(replace(replace(replace(
    replace(replace(replace(replace(replace(replace(replace(
      translate(translate(
        replace(replace(replace(replace(replace(replace(replace(
          lower(t),
          'ж', 'zh'), 'ц', 'ts'), 'ч', 'ch'), 'щ', 'sh'), 'ш', 'sh'), 'ю', 'yu'), 'я', 'ya'),
        'абвгдеёзийклмнопрстуфхыэәғқңөұүһіъь',
        'abvgdeeziiklmnoprstufhyeagknouuhi'),
        -- Latin diacritics (Python's NFKD + drop combining marks)
        'áàâäãåāéèêëēíìîïīóòôöõōúùûüūñńçćšśžźżčřýÿğ',
        'aaaaaaaeeeeeiiiiioooooouuuuunnccsszzzcryyg'),
      'shch', 'sh'), 'kh', 'h'), 'x', 'ks'),
      'yu', 'u'), 'iu', 'u'), 'ya', 'a'), 'ia', 'a'), 'yo', 'o'), 'ye', 'e'),
      'zh', 'j'), 'dj', 'j'),
      'y', 'i'), 'w', 'v'), 'q', 'k'), 'ck', 'k'),
    '(.)\1+', '\1', 'g');
$$;

CREATE INDEX IF NOT EXISTS idx_runners_name_fold_trgm
  ON runners USING gin (fold_name(full_name) gin_trgm_ops)
  WHERE is_hidden = false;

-- Runner search: every word of the query must appear in the folded name, in
-- any order. LIKE wildcards in the query are escaped. Returns
-- {"total": n, "rows": [{id, full_name, country, city, elo_score, elo_level}]}.
CREATE OR REPLACE FUNCTION search_runners(
  p_q      text,
  p_limit  int DEFAULT 30,
  p_offset int DEFAULT 0
)
RETURNS json
LANGUAGE sql STABLE AS $$
  WITH words AS (
    SELECT array_agg('%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'
                     ORDER BY length(w) DESC) AS pats
      FROM regexp_split_to_table(fold_name(trim(p_q)), '\s+') AS w
     WHERE w <> ''
  ),
  hits AS (
    SELECT ru.id, ru.full_name, ru.country, ru.city, ru.elo_score, ru.elo_level
      FROM runners ru, words
     WHERE ru.is_hidden = false
       AND words.pats IS NOT NULL
       AND fold_name(ru.full_name) LIKE words.pats[1]      -- longest word: uses the trigram index
       AND fold_name(ru.full_name) LIKE ALL (words.pats)
  )
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM hits),
    'rows', COALESCE((
      SELECT json_agg(h ORDER BY h.full_name, h.id)
        FROM (SELECT * FROM hits ORDER BY full_name, id
               LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)) h
    ), '[]'::json)
  );
$$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Event results page: WHERE event_id = ? [AND distance_category = ?]
-- ORDER BY distance_category, place, id
CREATE INDEX IF NOT EXISTS idx_results_event_cat_place
  ON results (event_id, distance_category, place, id);

-- Redundant: every query filters is_hidden = false and is served by the
-- partial idx_runners_elo_score_desc / idx_runners_elo_level / city / country.
DROP INDEX IF EXISTS idx_runners_elo;
-- Boolean with ~99% false: never selective enough to be used.
DROP INDEX IF EXISTS idx_runners_hidden;
-- Place is only ever filtered together with event or distance.
DROP INDEX IF EXISTS idx_results_place;
-- Superseded by idx_results_event_cat_place (same leading column).
DROP INDEX IF EXISTS idx_results_event;

-- ---------------------------------------------------------------------------
-- Data fixes
-- ---------------------------------------------------------------------------
UPDATE events SET year = EXTRACT(YEAR FROM date_of_event)::int
 WHERE year IS NULL AND date_of_event IS NOT NULL;

ANALYZE runners;
ANALYZE results;
ANALYZE events;

-- Check: should list the new functions
SELECT proname FROM pg_proc
 WHERE proname IN ('get_event_categories_by_id', 'get_distance_options',
                   'get_rankings_page', 'fold_name', 'search_runners')
 ORDER BY proname;
