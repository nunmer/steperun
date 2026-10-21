# CLAUDE.md — Steppe RUN project context

Running results portal for Kazakhstan (steppe.run): race results from
almaty-marathon.kz and athletex.kz, runner profiles, rankings, ELO, profile
claiming, a coin economy and an AI run-technique analyzer.

Deeper docs: `docs/ARCHITECTURE.md` (how it fits together), `docs/DEPLOYMENT.md`
(hosting + runbooks), `docs/SCRAPER.md`, `docs/DB_MANAGEMENT.md`,
`docs/TODO.md` (open items), `docs/CHANGELOG.md`.

## Layout

```
scraper/        Python package: sources (almaty-marathon.kz HTML, athletex .clax XML),
                runner matching, Supabase helpers
scripts/        Pipeline entry points + maintenance (run from repo root)
tests/          pytest for the scraper (no network/DB)
migrations/     SQL run by hand in the Supabase SQL Editor (order: docs/DB_MANAGEMENT.md)
schema.sql      Core schema (events, runners, results, v_results)
web/            Next.js 16 app (App Router, React 19, Tailwind 4, shadcn/ui) → Vercel project `steperun`
run_analyzer/   FastAPI + OpenCV + MediaPipe + GPT-4o → Vercel project `steperun-analyzer`
samples/        Local test media (gitignored)
.github/workflows/scrape-results.yml   Daily scrape (03:00 UTC)
```

## Commands

```bash
python -m pytest tests -q                                  # scraper tests
python scripts/scrape_almaty_marathon.py --min-year 2025   # almaty-marathon.kz
python scripts/scrape_athletex.py [--backfill --min-year 2023]
python scripts/smoke_test_analyzer.py [--analyze]          # analyzer end to end
python scripts/merge_duplicates.py [--apply]               # bulk-merge duplicate runners (dry run first)
python scripts/merge_runners.py --keep ID --drop ID [--apply]  # merge one confirmed pair
cd web && npm run dev | npm run build | npx tsc --noEmit | npx eslint <files>
cd run_analyzer && uv sync && uv run uvicorn web:app --port 8000
```

Never run `scripts/calculate_elo.py`, `clean_runners.py`, `fix_event_names.py`,
`scrape_dates.py` casually: they write to the production database on start.
After any manual data fix, purge the site cache (`POST /api/revalidate`, bearer
`REVALIDATE_SECRET` from `.env`); the merge scripts do this themselves.

## Conventions and rules that matter

- **DB access:** the web server uses the Supabase **service key** for all
  queries/writes; the anon key is used only for auth in the browser. RLS is
  enabled on every public table; SECURITY DEFINER functions are revoked from
  `anon`/`authenticated`. Views need `security_invoker = true`.
- **Supabase Disk IO budget is tight:** scrapers batch (50 rows), use keyset
  pagination, write only changed rows, and post-processing runs only when new
  results arrived. Keep it that way.
- **Coins:** all balance changes go through the `apply_coin_tx` RPC (atomic,
  idempotent on `paddle_transaction_id`). Paddle is off unless `PADDLE_*` envs
  are set (earn-only mode).
- **Run sessions:** status changes are conditional (`UPDATE … WHERE status = from`)
  to avoid double charge/refund; stuck sessions expire after 15 min with refund.
- **Vercel limits:** function request/response bodies ≤ 4.5 MB → videos go
  browser → Storage (`run-videos`, signed upload URL); the analyzer returns only
  key frames ≤1280 px. Function max duration 300 s.
- **MediaPipe on Vercel** needs `run_analyzer/vendor/gl` + `gl_preload.py` and
  the uv override to headless OpenCV. Don't remove either.
- Event slugs: almaty-marathon.kz uses the site slug; athletex uses
  `athletex_<folder>`. `events.organizer` is set by the scraper per source.
- **Caching:** public reads go through `cachedQuery` (`lib/cache.ts`: 1 h,
  tag `results`; runner data also `runner:<id>`). Pages with `searchParams` are
  dynamic but read cached data; `/runners/[id]` is ISR. The scraper workflow
  calls `/api/revalidate`; claim changes call `invalidateRunner(id)`.
  `PAGE_SIZE = 30`.
- **Lists:** totals are exact (from aggregate RPCs where possible), every
  paginated query ends with `id` as a tiebreaker, and `page` is parsed with
  `parsePage`. Pagination uses `components/pagination.tsx`.
- **Runner identity:** the same person means the same folded name tokens (any
  order or alphabet) and the same non-blank city. Country is ignored, because
  everyone is "Kazakhstan" (`RunnerIndex.match_strict`). Never merge on a name
  alone: same-name different people exist (26194 vs 20451).
- **Teams and relays are not runners.** Team courses are skipped at import, and
  `clean_runners.py` deletes team/relay results.
- **DNF** is `chip_time = '--:--:--'`. Exclude it from PBs, finish counts and
  rankings (`isFinishTime` in `lib/params.ts`).
- Commits: conventional commits (`feat:`, `fix:`, …).
