# Scraper

Two sources feed `events`, `runners` and `results`. Both run daily in GitHub
Actions (`.github/workflows/scrape-results.yml`, 03:00 UTC = 08:00 Almaty).

| Source | Organizer value | Format | Code | Entry point |
|---|---|---|---|---|
| almaty-marathon.kz | `Almaty Marathon` | HTML result tables | `scraper/scraper.py`, `parser.py` | `scripts/scrape_almaty_marathon.py` |
| athletex.kz (Экстремальная атлетика) | `Athletex` | Wiclax `.clax` XML on live.myrace.info | `scraper/athletex.py`, `clax.py` | `scripts/scrape_athletex.py` |

Coverage on 2026-10-21: 75 events, 172k results, 86k runners. That is 33
almaty-marathon.kz events and 42 athletex events (2023–2026, 25k results).

## Workflow

1. **Unit tests:** `python -m pytest tests -q`. No network or DB.
2. **almaty-marathon.kz:** `--min-year <last year>` by default.
3. **athletex.kz:** current listings, or past seasons with `--backfill`.
4. **Post-processing**, only if step 2 or 3 reported new rows
   (`GITHUB_OUTPUT new_results`):
   - `scripts/fix_event_names.py`
   - `scripts/clean_runners.py`
   - `scripts/scrape_dates.py`
   - `scripts/calculate_elo.py`
5. **Summary:** new rows per source in the job summary.

Manual inputs (Actions → Run workflow):

| Input | Effect |
|---|---|
| `min_year` | almaty-marathon.kz: empty = last year onward, `0` = full history, `2024` = from 2024 |
| `athletex_backfill_from` | e.g. `2023`: also probe earlier seasons of every athletex competition |

The concurrency group `scrape-results` means runs queue and never overlap.

## almaty-marathon.kz

- `/ru/results/` lists the events. Slugs with cycling/swim keywords are skipped
  (`SKIP_KEYWORDS`).
- Each event offers distance categories (`?d=`), which are paginated
  (`Results_page=N`).
- **Resume:** an event counts as done when `scraped_at` is set and
  `total_results > 0`. Empty events are retried.
- CLI flags: `--min-year YEAR`, `--event SLUG` (one event), `--full` (ignore
  resume).
- Pagination: the page count comes only from `Results_page` links in the pager.
  Past the last page the site serves the last page again, so the scraper stops
  when a page repeats. `events.total_results` is the stored row count.
- Older history (about 79 events from 2016–2023) is only scraped with
  `min_year=0`.

## athletex.kz

- **Discovery:** competition slugs come from `/competitions/calendar` and
  `/competitions`, skipping bike/ski/XCO. With `--backfill`, the year in each
  slug is swapped (`IrbisRace2026` → `IrbisRace2025`, `rrautumn26` →
  `rrautumn25`).
- Each competition page links its `.clax` file:
  `live.myrace.info/?f=bases/kz/<year>/<folder>/<file>.clax`. The event slug is
  `athletex_<folder>`.
- **`.clax` parsing** (`scraper/clax.py`):
  - Courses are mapped to distance labels. Road distances reuse the
    almaty-marathon.kz labels (`21 км 97,5 м`, `42 км 195 м`, `Скандинавская
    ходьба: …`) so rankings line up.
  - Bike, relay, kids, ski and virtual courses are skipped (`_SKIP_COURSE`).
  - DNF/DNS rows are dropped. Places are recomputed per category from time.
  - City comes from the custom field labelled "Город"/"City". Country comes
    from ISO-2 mapped to English names.
- Races dated today or later are skipped until they're over (Almaty time).
- **Not imported:** birth year and sex are in the files but there are no columns
  for them yet.
- **Missed by slug guessing**, which needs the competition page links:
  Amangeldy 2023–24, Salomon 2023, Oskemen 2024–25, astanatrail25,
  rrspring2025, rrautumn24.

## Runner matching across sources

almaty-marathon.kz rows use exact `(full_name, country, city)` identity.
athletex rows go through `scraper/runner_matcher.py`:

- **Name key:** the first two name tokens, sorted (so order doesn't matter),
  after transliteration folding (`scraper/names.py`: Cyrillic/Kazakh → Latin,
  `kh/x`, `zh/j`, `yu/u`, `ya/a`, doubled letters, …).
- **When an existing runner is reused:** exactly one candidate has an agreeing
  country and city (blank on either side counts as agreeing), or, among
  several, exactly one has the same non-blank city.
- **Otherwise** a new runner is created. A duplicate profile is recoverable;
  a wrong merge mixes two people's results.

In the dry run, about 47% of athletex results matched an existing runner, and
all 30 sampled matches were correct.

## Keeping Supabase Disk IO low

Rules every script follows, and new code must follow too:

- **Batched writes:** runner get-or-create runs in batches of 50 (one SELECT +
  one INSERT per batch), never one row at a time.
- **Keyset pagination** (`id > last_id ORDER BY id LIMIT 1000`), never offset
  scans.
- **Write only what changed:** ELO updates only runners whose score or level
  changed; cleanup skips runners that are already hidden; name and date fixes
  touch only rows that need them.
- **No-op days stay cheap:** a daily run with no new races costs a couple of
  reads.

## Adding a source

1. Write a pure parser module (no network/DB) with tests in `tests/`.
2. Add a module in `scraper/` that discovers events and calls `upsert_event(…,
   organizer)`. Use `get_or_create_runners` or `RunnerIndex` for runners and
   `upsert_results_batch` for results. Use a slug prefix (`<source>_…`) so slugs
   don't collide.
3. Add an entry script in `scripts/` that writes `new_results=N` to
   `$GITHUB_OUTPUT`, add a workflow step with an `id`, and include it in the
   post-processing `if:` conditions.
4. Add a dot colour for the organizer in `web/components/organizer-pin.tsx`.
