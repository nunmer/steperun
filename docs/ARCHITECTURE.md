# Architecture

```
 almaty-marathon.kz (HTML)     athletex.kz → live.myrace.info (.clax XML)
            │                              │
            └──────── GitHub Actions: scrape-results.yml (daily 03:00 UTC) ────────┐
                      scripts/scrape_*.py → scraper/ package                       │
                                                                                   ▼
 Browser ──► steppe.run  (Vercel project `steperun`, Next.js 16, root web/) ──► Supabase
   │            │  server components + API routes, service key                 Postgres + Auth
   │            │                                                              + Storage
   │            └─► steperun-analyzer.vercel.app (Vercel project `steperun-analyzer`,
   │                 FastAPI in a Python function, root run_analyzer/) ──► OpenAI GPT-4o
   │                                                                              ▲
   └──── direct video upload (signed URL) ──► Supabase Storage `run-videos` ──────┘
                                              (analyzer downloads it via signed URL)
```

Everything runs on free tiers: Vercel Hobby (two projects), Supabase free,
GitHub Actions. Fly.io was dropped on 2026-10-21 (see `CHANGELOG.md`).

## Components

| Part | Where | Notes |
|---|---|---|
| Web app | `web/` → Vercel `steperun` | Next.js App Router, Server Components, ISR 1 h. Domains: steppe.run → www.steppe.run |
| Run analyzer | `run_analyzer/` → Vercel `steperun-analyzer` | FastAPI, `app.py` entrypoint, 300 s max, 2 GB / 1 vCPU |
| Scraper | `scraper/` + `scripts/` → GitHub Actions | Python 3.11, requests + BeautifulSoup + supabase-py |
| Database | Supabase Postgres | Core: `events`, `runners`, `results`, view `v_results`; plus auth/claims/coins/run-analyzer tables |
| Storage | Supabase Storage | `run-frames` (public, key frames), `run-videos` (private, 50 MB cap, deleted after extraction) |
| Auth | Supabase Auth (Google OAuth) + Strava OAuth | Strava used to verify profile claims |

## Data flows

### 1. Race results (scraper)

1. `scrape-results.yml` runs daily, or on demand with inputs `min_year` and
   `athletex_backfill_from`.
2. `scripts/scrape_almaty_marathon.py` walks almaty-marathon.kz events from last
   year onward and skips events that already have results.
3. `scripts/scrape_athletex.py` discovers athletex competitions and imports their
   Wiclax `.clax` files. Runners are matched to existing profiles across sources
   (`scraper/runner_matcher.py`).
4. If either step added rows: normalize names, hide relay teams, fill dates,
   recalculate ELO (changed runners only).

Details: `docs/SCRAPER.md`.

### 2. Run analyzer (video → technique report)

```
browser  POST /api/run-analyzer/sessions            → session row (status extracting)
browser  POST /api/run-analyzer/upload-url          → signed upload token (size/type checked, ≤50 MB)
browser  storage.uploadToSignedUrl(run-videos/<user>/<session>/video.ext)
browser  POST /api/run-analyzer/extract {video_path}
  web    signed read URL (10 min) → analyzer POST /api/extract-url  (X-Analyzer-Key)
  anlz   download (only from SUPABASE_URL/storage/v1/object/sign/…), MediaPipe pose,
         pick key frames, return ≤1280 px JPEGs (base64)
  web    upload key frames → run-frames, insert run_frames, status extracted, delete video
browser  POST /api/run-analyzer/sessions/:id/analyze
  web    claim extracted→analyzing, quota/coins (2 free, then 10 coins),
         fetch frames → analyzer POST /api/analyze-frames → GPT-4o → status done
         (failure: analyzing→error + refund; stuck >15 min in extracting/analyzing: →error,
         coins refunded — lib/services/session-cleanup.ts)
```

Why it is shaped like this: Vercel caps function request/response bodies at
4.5 MB, so videos never pass through a function, and the analyzer returns only
the compact key frames the site stores.

MediaPipe's native library links `libEGL`/`libGLESv2`, which Vercel's runtime
lacks. `run_analyzer/vendor/gl` holds glvnd builds of those libraries and
`gl_preload.py` loads them before MediaPipe is imported. `pyproject.toml` swaps
MediaPipe's GUI OpenCV for the headless build.

### 3. Profile claims, coins

- A user signs in with Google, claims a runner profile, and optionally connects
  Strava. `trust-scoring.ts` and `strava-matcher.ts` score the claim; admins
  review flagged claims at `/admin/claims`.
- Coins are awarded for claim, Strava connection and events
  (`COIN_REWARDS`). Run analyses are spent from coins after the free quota. All
  balance changes go through `apply_coin_tx` (atomic ledger + balance,
  idempotent on Paddle transaction id).
- Buying coins (Paddle) is disabled unless the `PADDLE_*` env vars are set; the
  `/coins` page then shows earn-only options.

## Security model

- The browser gets only the anon key, used for auth and for the signed video
  upload. All data reads and writes go through server code with the service key.
- RLS is enabled on every public table. Core tables have no anon/authenticated
  policies (the server reads them with the service key). `v_results` uses
  `security_invoker`.
- SECURITY DEFINER functions (`apply_coin_tx`, `award_coins_once`,
  `delete_user_by_email`) are revoked from `anon`/`authenticated`.
- The analyzer is public on the internet but rejects `/api/*` without
  `X-Analyzer-Key`. It only downloads from Supabase signed URLs.
- API routes under `/api/claims`, `/api/disputes`, `/api/admin` and
  `/api/run-analyzer` are auth-gated in `web/proxy.ts`.
