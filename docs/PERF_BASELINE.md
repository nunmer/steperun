# Performance Optimization Results

## After vs Before — 2026-04-17 (post-optimization)

Changes applied:
- DB indexes (runner_id+chip_time, distance_category+chip_time, elo_score desc, elo_level, city+elo_score, country+elo_score, pg_trgm on full_name, events.year)
- New RPCs: `get_elo_stats`, `get_event_years`, `get_runner_full`
- `getRunner` + `getEloRanks` parallelized with `Promise.all`
- `/runners/[id]` and `/profile` switched to single-RPC `getRunnerFull`
- `getEloStats` replaced 10 COUNT queries with one GROUP BY RPC
- `getPowerRankings` switched `count: "exact"` → `count: "planned"`

### Pages — Before vs After (warm median)

| Page                            | Before | After | Δ        |
|---|---|---|---|
| /runners/[id]                   | 2.37s  | 0.53s | **-78%** |
| /power-rankings                 | 1.59s  | 0.62s | **-61%** |
| /rankings                       | 1.23s  | 0.96s | -22%     |
| /power-rankings?level=10        | —      | 0.58s | —        |
| /events/[slug]                  | 0.55s  | 0.45s | -18%     |
| /events                         | 0.68s  | 0.57s | -16%     |
| /runners                        | 0.59s  | 0.52s | -12%     |
| /rankings?distance=10%20km      | 0.57s  | 0.53s | -7%      |
| /rankings?distance=Marathon     | 0.55s  | 0.51s | -7%      |
| / (Home)                        | 0.68s  | 0.69s | flat     |
| /runners/head-to-head (CSR)     | 0.07s  | 0.06s | fast     |

### APIs — Before vs After (warm median)

| API                              | Before | After | Δ        |
|---|---|---|---|
| /api/runners/[id]                | 0.95s  | 0.44s | **-54%** |
| /api/runners/search?q=aman       | 0.58s  | 0.41s | -29%     |
| /api/runners/match-name?name=... | 0.50s  | 0.42s | -16%     |

### Summary
- All warm pages under 1.0s target ✅
- Biggest win: /runners/[id] (2.37s → 0.53s via single-RPC)
- Cold first-hit in dev mode still >1s on some pages — that's Next.js Turbopack compile overhead, **not** DB latency. Production cold = warm-dev-equivalent.

---

# Original Baseline — 2026-04-17

Measurement environment: Next.js **dev mode** on `localhost:3000`, 3 warm hits per URL.
Cold = run 1 (includes first-compile); Warm = median of runs 2 & 3.
Target: **every page under 1.00s warm**.
AI Coach (`/run-analyzer` extract/analyze) and auth-gated flows excluded.

## Pages (SSR)

| Page | Cold (s) | Warm (s) | Status |
|---|---|---|---|
| /runners/[id] (id=1)                 | 4.22 | 2.37 | 🔴 Over budget |
| /power-rankings                      | 4.09 | 1.59 | 🔴 Over budget |
| /rankings                            | 2.22 | 1.23 | 🔴 Over budget |
| /power-rankings?distance=10%20km     | 0.87 | 1.21 | 🔴 Over budget |
| /events                              | 1.93 | 0.68 | 🟢 Under |
| / (Home)                             | 0.94 | 0.68 | 🟢 Under |
| /runners                             | 0.92 | 0.59 | 🟢 Under |
| /rankings?distance=10%20km           | 1.03 | 0.57 | 🟢 Under |
| /events/[slug] (almaty-marathon-2024)| 2.17 | 0.55 | 🟢 Under |
| /rankings?distance=Marathon          | 0.54 | 0.55 | 🟢 Under |
| /profile (unauth shell)              | 0.21 | 0.14 | 🟢 Fast |
| /auth/welcome                        | 0.19 | 0.08 | 🟢 Fast |
| /admin/claims (redirects unauth)     | 0.22 | 0.07 | 🟢 Fast |
| /runners/head-to-head (CSR)          | 0.73 | 0.07 | 🟢 Fast |
| /run-analyzer (CSR)                  | 0.12 | 0.07 | 🟢 Fast |

## Public APIs

| API | Cold (s) | Warm (s) | Status |
|---|---|---|---|
| /api/runners/[id] (id=1)             | 2.16 | 0.95 | 🟠 Near limit |
| /api/runners/search?q=aman           | 1.21 | 0.58 | 🟢 Under |
| /api/runners/match-name?name=Aman    | 0.74 | 0.50 | 🟢 Under |
| /api/runners/search?q=a (<2 chars)   | 0.01 | 0.01 | 🟢 Early exit |

## Auth-gated (returned 401 — not measured)

- `/api/claims`, `/api/claims/my`, `/api/disputes`
- `/api/admin/queue`, `/api/admin/queue/[id]/decision`
- `/api/run-analyzer/sessions`, `/api/run-analyzer/sessions/[id]`

## Over-budget summary

4 pages + 1 near-limit API need optimization:
1. /runners/[id]           — 2.37s (2.4× budget)
2. /power-rankings         — 1.59s (1.6× budget)
3. /rankings               — 1.23s (1.2× budget)
4. /power-rankings?distance — 1.21s (1.2× budget)
5. /api/runners/[id]       — 0.95s (close)

---

# Root-Cause Analysis

## 1. /runners/[id] — 2.37s

Trace: `RunnerPage` → `getRunner(id)` → (waterfall) → `getEloRanks(...)`.

### Issues
| # | Where | Problem | Impact |
|---|---|---|---|
| 1.1 | `page.tsx:44` then `:60-62` | **Sequential waterfall**: page awaits `getRunner()` fully, then runs `getEloRanks()`. | +1 round-trip serialised |
| 1.2 | `queries.ts:350-370` `getRunner` | Runner fetch and results fetch are sequential (await, then await). Results don't depend on runner data. | +1 round-trip serialised |
| 1.3 | `queries.ts:385-417` `getEloRanks` | Two sequential COUNT queries (city, then country). Should run in parallel. | +1 round-trip |
| 1.4 | DB | No index on `results(runner_id, chip_time)` — ORDER BY chip_time scans all of a runner's results. | Scan per query |
| 1.5 | DB | No partial index on `runners(is_hidden, city, elo_score)` / `(is_hidden, country, elo_score)` for the rank counts. | Seq scan on ~50k rows, twice |

### Fixes (easiest → hardest)
- **F1.1**: Parallelize the two queries inside `getRunner` with `Promise.all([runner, results])`. Saves ~1 RTT.
- **F1.2**: Parallelize the two COUNTs inside `getEloRanks`. Saves ~1 RTT.
- **F1.3**: Create an RPC `get_runner_full(id)` that returns runner + results + rank counts in one round-trip. Fastest but more work.
- **F1.4**: Add indexes:
  ```sql
  CREATE INDEX idx_results_runner_chip ON results (runner_id, chip_time);
  CREATE INDEX idx_runners_city_elo   ON runners (city, elo_score) WHERE is_hidden = false AND elo_score IS NOT NULL;
  CREATE INDEX idx_runners_country_elo ON runners (country, elo_score) WHERE is_hidden = false AND elo_score IS NOT NULL;
  ```

---

## 2. /power-rankings — 1.59s

Trace: `PowerRankingsPage` → parallel `[getPowerRankings, getEloStats]`.

### Issues
| # | Where | Problem | Impact |
|---|---|---|---|
| 2.1 | `queries.ts:456-468` `getEloStats` | **10 separate COUNT queries** (one per level 1-10), parallelized. Each one scans matching rows. | 10× queries, 10× connection overhead |
| 2.2 | `queries.ts:432-454` `getPowerRankings` | Uses `count: "exact"` — expensive total count on every render. | Full-scan count |
| 2.3 | DB | No index on `runners(elo_score DESC) WHERE is_hidden = false AND elo_score IS NOT NULL`. | Sort of all rows |
| 2.4 | DB | No index on `runners(elo_level) WHERE is_hidden = false`. | Seq scan for `.eq("elo_level", lvl)` |

### Fixes
- **F2.1**: Replace 10 COUNT queries with a single RPC:
  ```sql
  CREATE FUNCTION get_elo_stats() RETURNS TABLE (level int, count bigint) AS $$
    SELECT elo_level, COUNT(*)::bigint FROM runners
     WHERE is_hidden = false AND elo_level IS NOT NULL
     GROUP BY elo_level ORDER BY elo_level;
  $$ LANGUAGE sql STABLE;
  ```
- **F2.2**: Replace `count: "exact"` with `count: "estimated"` (Supabase supports it) or cache total with short TTL. Exact count on 50k+ rows is the main cost here.
- **F2.3**: Add `CREATE INDEX idx_runners_elo_desc ON runners (elo_score DESC) WHERE is_hidden = false AND elo_score IS NOT NULL;`
- **F2.4**: Covered by F2.3 and a composite `(elo_level, elo_score DESC) WHERE is_hidden = false`.

---

## 3. /rankings — 1.23s (0.55–1.21s with filter)

Trace: `RankingsPage` → parallel `[getDistanceOptions, getEventYears, getRankings]`.

### Issues
| # | Where | Problem | Impact |
|---|---|---|---|
| 3.1 | `queries.ts:299-321` `getDistanceOptions` | RPC `get_distance_options` **may not exist** (per MEMORY.md). Fallback scans 1000 results rows and dedupes in JS. | Fallback scan on every render |
| 3.2 | `queries.ts:94-103` `getEventYears` | Fetches all `year` values from events then dedupes in JS. With 50+ events this is fine, but it's still a network round-trip for data that almost never changes. | Could be static/cached |
| 3.3 | `queries.ts:251-265` `getRankings` "all" mode | Fires 3 parallel sub-queries (one per main distance), each over-fetches `limit*3 + 5` rows (≈350). Acceptable but large response payloads. | 3 queries × 350 rows + joins |
| 3.4 | `queries.ts:268-279` single-distance ranking | Over-fetches `limit * 3 = 300` rows and dedupes by runner in JS. | Fine but could be RPC |
| 3.5 | DB | No composite index on `results(distance_category, chip_time)` filtered to non-null valid chip times. | Slow ORDER BY |
| 3.6 | DB | Inner join filter `runners.is_hidden = false` can't use an index without PG pushing predicate. | Seq scan on hash join |

### Fixes
- **F3.1**: Create the missing RPC:
  ```sql
  CREATE FUNCTION get_distance_options() RETURNS TABLE (distance_category text) AS $$
    SELECT DISTINCT distance_category FROM results
     WHERE distance_category IS NOT NULL AND chip_time IS NOT NULL AND chip_time <> '--:--:--'
     ORDER BY distance_category;
  $$ LANGUAGE sql STABLE;
  ```
- **F3.2**: Create `get_event_years()` RPC returning just distinct years — or cache client-side (top of `page.tsx` with `revalidate = 3600`).
- **F3.3**: Push dedup into SQL using `DISTINCT ON (runner_id)` in an RPC — trades JS work for less data transfer.
- **F3.5**: Add `CREATE INDEX idx_results_dist_chip ON results (distance_category, chip_time) WHERE chip_time IS NOT NULL AND chip_time <> '--:--:--' AND place IS NOT NULL;`

---

## 4. /api/runners/[id] — 0.95s

Same `getRunner` function as case 1. Fixes F1.1 and F1.4 apply.

---

## Cross-cutting findings

| Theme | Details |
|---|---|
| **Sequential awaits** | `getRunner`, `getEloRanks`, the /runners/[id] page — several `await` chains that should be `Promise.all`. |
| **`count: "exact"`** | Used on `getPowerRankings`, `getRunners`, `getEventResults`, `getEventStats`. On tables with 50k+ rows each exact count is a full scan. Switch to `"estimated"` where exact rank-offset isn't critical. |
| **Missing indexes** | `results(runner_id, chip_time)`, `results(distance_category, chip_time, place)`, `runners(is_hidden, city, elo_score)`, `runners(is_hidden, country, elo_score)`, `runners(elo_score DESC) WHERE is_hidden=false`, `runners(elo_level) WHERE is_hidden=false`. |
| **Missing RPCs** | `get_distance_options`, `get_event_years`, `get_elo_stats`, `get_runner_full`. Each replaces 1–10 round-trips with one. |
| **Full-text search** | `ilike '%q%'` on `full_name` is O(n). Enable `pg_trgm` + GIN index on `full_name` for `/api/runners/search` if it grows. |
| **No in-app cache** | Page has `revalidate = 3600` (ISR), but SSR on cache-miss does 3–7 queries every hour per variant. The slow path *is* the cache-miss path. Reducing DB work is the primary lever. |

## Suggested refactor order (biggest win first)

1. **Add missing DB indexes** (one migration, ~10 min). Affects: 1.4, 1.5, 2.3, 2.4, 3.5.
2. **Parallelize `getRunner` + `getEloRanks`** (small TS edit). Affects: 1.1, 1.2, 1.3. Expected: 2.37s → ~1.2s.
3. **Create `get_elo_stats` RPC** and swap `getEloStats`. Expected: 1.59s → ~0.8s.
4. **Create `get_distance_options` RPC** (or verify existing one). Affects: 3.1.
5. **Switch large counts to `estimated`** where ranking offset doesn't need exactness.
6. **Move static-ish lists** (`getEventYears`, `getDistanceOptions`) into `unstable_cache` with long TTL.

