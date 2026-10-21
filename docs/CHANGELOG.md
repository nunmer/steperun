# Changelog

## 2026-10-21 (later): site audit fixes

Everything in `AUDIT-2026-10-21.md` except item 17; see its status table.
- **Caching:** cached repeat page loads take 20–75 ms (were 1–9 s).
  `/api/revalidate` is called by the scraper workflow.
- **Complete lists:** exact totals, unique sort keys; every event distance in
  the filter; paginated rankings for every distance.
- **Bugs fixed:**
  - DNF no longer shown as PB;
  - page 0 and bad `page` params handled;
  - year "0" group gone;
  - 7 athletex dates recovered.
- **New:** `robots.txt`, `sitemap.xml`. Migration `005` (search, rankings,
  indexes).

## 2026-10-21

### Hosting: everything on free tiers
- **Fly.io dropped.** App `steperun-app` destroyed. It had $60.40 in unpaid
  invoices (May–Sep 2026), and a waiver request to Fly billing is pending (see
  `TODO.md`).
- **steppe.run DNS** moved from Fly to Vercel (Porkbun A/CNAME records). The
  expired Vercel certificate was reissued.
- **Run analyzer** is now its own Vercel Python function (`steperun-analyzer`)
  (`83a542b`):
  - MediaPipe runs on Vercel through vendored glvnd `libEGL`/`libGLESv2` plus
    `gl_preload.py`, and a uv override to headless OpenCV.
  - Videos upload from the browser straight to the private `run-videos` bucket
    (works around Vercel's 4.5 MB body limit) and are deleted after extraction.
  - The new `/api/extract-url` returns only key frames, capped at 1280 px.
  - `X-Analyzer-Key` shared-secret auth on `/api/*`.
- Hugging Face Spaces was evaluated and rejected: Docker Spaces now require PRO.
- Removed `fly.toml`, the Dockerfiles, `start.sh`, the deploy-to-Fly workflow
  and the `FLY_API_TOKEN` secret.

### Events
- `events.organizer` (migration `004`), set by the scraper per source: "Almaty
  Marathon" / "Athletex" (`14e58d0`).
- Shared `EventCard` (home + events list): organizer pin, date, finishers.
- Event page header: organizer pin, date, finishers, number of distances, and a
  link to the official results.

### Scraper
- **Daily GitHub Actions pipeline** `scrape-results.yml` (`953c8eb`):
  - unit tests run before scraping;
  - manual inputs `min_year` and `athletex_backfill_from`;
  - post-processing only runs when new rows arrive.
- **Low-IO writes:** batched runner get-or-create, keyset pagination; ELO and
  cleanup write only changed rows.
- **New source athletex.kz** (`5c06669`): a Wiclax `.clax` parser and
  cross-source runner matching (transliteration-tolerant names, city and country
  agreement).
- **Imported today:**
  - almaty-marathon.kz: 50,429 rows. Almaty Marathon 2026, Summer Relay 2026,
    Tau Jarys 2026, Astana Half Marathon 2026, Turkistan Marathon 2025.
  - athletex.kz backfill from 2023: 42 events, 25,274 rows.
  - Database total: 172k results, 86k runners.

### Security
- RLS enabled on `runners`, `events`, `results`; `v_results` is now
  `security_invoker` (`631411a`, migration `003`).
- Anon-reachable RLS policies and RPC grants closed (`1e4ebd4`, migration
  `002`).

### Coins and run analyzer
- Atomic coin ledger `apply_coin_tx`; Paddle coin packs (`13f89ef`).
  **Earn-only mode** applies when Paddle isn't configured (`e1d3bf1`).
- Stuck sessions (>15 min) expire and their coins are refunded; status changes
  are conditional, so a session can't be charged or refunded twice (`23a8a97`).
- Lite pose model, low-detail images, parallel frame uploads (`2aff586`).

### Repo housekeeping
- The pipeline scripts moved from the repo root to `scripts/`. `run.py` is now
  `scripts/scrape_almaty_marathon.py` and `run_athletex.py` is now
  `scripts/scrape_athletex.py`.
- `CLAUDE.md` moved to the repo root. New docs: `ARCHITECTURE.md`,
  `SCRAPER.md`, `TODO.md`, this changelog. `DEPLOYMENT.md`, `DB_MANAGEMENT.md`
  and `README.md` rewritten.
- `scripts/smoke_test_analyzer.py` and `samples/` added for end-to-end analyzer
  checks.
