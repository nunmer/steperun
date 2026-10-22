# Deployment & operations

Everything is free tier: **Vercel Hobby** (two projects), **Supabase free**,
**GitHub Actions**. Pushing to `main` deploys both Vercel projects. Nothing
needs a manual deploy step.

> Vercel Hobby is for non-commercial use. If paid coin packs (Paddle) are
> switched on, move to Vercel Pro or another host.

## Hosting map

| What | Host | Source | URL |
|---|---|---|---|
| Web app | Vercel project `steperun` (team `nunmers-projects`) | `web/` | https://www.steppe.run (apex `steppe.run` → 308 to www), steperun.vercel.app |
| Run analyzer | Vercel project `steperun-analyzer` | `run_analyzer/` | https://steperun-analyzer.vercel.app |
| Scraper | GitHub Actions `scrape-results.yml` | `scraper/`, `scripts/` | daily 03:00 UTC |
| DB / Auth / Storage | Supabase project `ddohlplxshswvbittecv` | `schema.sql`, `migrations/` | — |
| DNS | Porkbun (`steppe.run`) | — | — |

`steperun-dqxd` is a second Vercel project that also deploys `main`. Nothing
uses it, so it can be deleted from the Vercel dashboard.

`steperun-analyzer` skips builds when `run_analyzer/` didn't change (ignored
build step `git diff --quiet HEAD^ HEAD -- .`).

### DNS (Porkbun)

| Type | Host | Value |
|---|---|---|
| A | @ | 216.198.79.1 |
| A | @ | 64.29.17.1 |
| CNAME | www | be17cc8e4d6254bd.vercel-dns-017.com |
| TXT | resend._domainkey | DKIM key for Resend (value in the Resend dashboard, domain `steppe.run`) |
| MX | send | `feedback-smtp.eu-west-1.amazonses.com`, priority 10 (Resend bounce handling) |
| TXT | send | `v=spf1 include:amazonses.com ~all` (Resend SPF) |
| TXT | _dmarc | `v=DMARC1; p=quarantine; rua=…dmarc-report.com; ruf=…; fo=1` (MXToolbox reporting). Keep exactly **one** DMARC record |

Vercel issues and auto-renews the certificate (`cert_yS2LLcjKpqAaL0V4nDHwfAeY`
covers `steppe.run` and `www.steppe.run`).

## Environment variables

### Vercel `steperun` (web)

| Var | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Server-side DB access (service role) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser auth + signed uploads |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI` | Strava OAuth for claims |
| `SECRET_KEY` | HMAC for Strava OAuth state |
| `RUN_ANALYZER_API_URL` | `https://steperun-analyzer.vercel.app` |
| `RUN_ANALYZER_API_KEY` | Shared secret, same value as the analyzer's `ANALYZER_API_KEY` |
| `REVALIDATE_SECRET` | Bearer token for `POST /api/revalidate` (same value as the GitHub secret) |
| `PADDLE_CLIENT_TOKEN`, `PADDLE_ENVIRONMENT`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRICE_ID_PACK_10/_50/_200` | *Unset* = earn-only coins. Set all of them to sell coin packs |
| `RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN` | Set by the Resend Marketplace integration (`resend-email-aqua-bucket`, region eu-west-1). Claim emails come from `claims@<domain>` |
| `EMAIL_DELIVERY` | `off` (default when unset: never sends, logs to `claim_audit_log`), `allowlist`, or `on` |
| `EMAIL_ALLOWLIST` | Comma-separated addresses that may receive mail while `EMAIL_DELIVERY=allowlist` |
| `GITHUB_ACTIONS_TOKEN` | *Optional.* Fine-grained token for this repo with **Actions: read & write**; lets `/admin` list scrape runs and start one. `GITHUB_REPO` overrides `nunmer/steperun` |
| `EMAIL_REPLY_TO` | Optional Reply-To for claim emails; defaults to the legal contact address |
| `SCRAPER_DELAY`, `SCRAPER_BATCH_SIZE` | Unused by the web app (leftovers) |

### Vercel `steperun-analyzer`

| Var | Purpose |
|---|---|
| `ANALYZER_API_KEY` | Required header `X-Analyzer-Key` on `/api/*` |
| `OPENAI_API_KEY` | GPT-4o analysis |
| `SUPABASE_URL` | Only signed URLs under `<SUPABASE_URL>/storage/v1/object/sign/` are downloaded |

### GitHub repo secrets (scraper)

`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `REVALIDATE_SECRET` (the workflow purges the site cache after an import).

### Local files (gitignored)

- `.env` (root) holds `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and optionally
  `SCRAPER_DELAY`/`SCRAPER_BATCH_SIZE`. Template: `.env.example`.
- `web/.env.local` holds the web vars above. Template: `web/.env.example`.
- `run_analyzer/.env` holds `OPENAI_API_KEY` (plus `ANALYZER_API_KEY` and
  `SUPABASE_URL` if you test auth locally).

## Supabase setup (from scratch)

1. Run `schema.sql`, then the migrations in the order listed in
   `docs/DB_MANAGEMENT.md`.
2. Storage buckets:
   - `run-frames`: public.
   - `run-videos`: private, 50 MB file limit, `video/*` only.
3. Auth: enable the Google provider. Redirect URL `https://www.steppe.run/auth/callback`.

## Runbooks

### Deploy
Push to `main`. Check deployments in the Vercel dashboard. A failed analyzer
build usually means a dependency change; see `run_analyzer/README.md`.

### Scrape now / backfill
GitHub → Actions → **Scrape race results** → Run workflow:
- Empty inputs: same as the daily run (last year onward, both sources).
- `min_year=0`: full almaty-marathon.kz history (79 older events, slow).
- `athletex_backfill_from=2023`: also probe past athletex seasons.

CLI: `gh workflow run scrape-results.yml -f athletex_backfill_from=2023`.
Or `/admin` → Results import → Run scraper now (when `GITHUB_ACTIONS_TOKEN` is set).
See `docs/SCRAPER.md`.

### Check the analyzer
`python scripts/smoke_test_analyzer.py`, plus `--analyze` for the GPT-4o step
(costs about $0.02). Extraction takes about 60 s on Vercel; the budget is 300 s.

### Rotate the analyzer key
Generate a new value and set it as `ANALYZER_API_KEY` (analyzer) and
`RUN_ANALYZER_API_KEY` (web). Then redeploy both projects: push a commit, or
use Redeploy in the dashboard.

### Caching
Public pages read through `unstable_cache` (24 h, tag `results`; runner data is
also tagged `runner:<id>`). Runner profiles are ISR. New results appear when
the scraper workflow calls `POST /api/revalidate`, or within a day.
Manual purge:
`curl -X POST -H "Authorization: Bearer $REVALIDATE_SECRET" https://www.steppe.run/api/revalidate`.
Claim approvals purge that runner automatically (`invalidateRunner`).

### Hide bad data
`python scripts/clean_runners.py` (production write). Or in SQL:
`UPDATE runners SET is_hidden = true WHERE id = …;`

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Analyzer "Video URL not allowed" | `SUPABASE_URL` missing or wrong on `steperun-analyzer` |
| Analyzer 401 | `RUN_ANALYZER_API_KEY` ≠ `ANALYZER_API_KEY` |
| Analyzer `libGLESv2.so.2: cannot open shared object file` | `vendor/gl` excluded from the bundle or `gl_preload` not imported first |
| Upload fails "must be under 50 MB" | By design (Supabase free per-file limit). Trim the clip |
| Events list empty after a schema change | A query selects a column that the DB doesn't have yet. Run the migration before deploying |
| Scraper job writes nothing for days | Expected when no new races; summary shows `new result rows: 0` |
| Supabase "Disk IO budget" warning | Look for full-table rewrites. Scraper/ELO should only touch changed rows |
| Supabase REST/Auth time out (even `/auth/v1/health` → 504), site still up from cache | Disk IO budget exhausted after bulk writes. Stop all scripts, Dashboard → Settings → General → **Restart project**, then wait for the budget to refill (check Reports → Database → Disk IO). See "Supabase throttled" below |

## Runbook: Supabase throttled (Disk IO budget)

Symptom: every Supabase request hangs or returns 504, including
`/auth/v1/health`. The public site keeps working from the 24 h data cache, but
login, claims and the run analyzer fail.

1. **Stop writers.** No GitHub Actions scrape in progress (`gh run list`), no
   local `scripts/*.py` running. Don't run `calculate_elo.py`, merges or other
   bulk fixes until it recovers.
2. **Check the cause** in the dashboard: Reports → Database → *Disk IO % consumed*
   and *Memory/Swap*. A burst budget at 0% means throttled to baseline IO;
   high swap on a small instance makes every query hit disk.
3. **Recover.** Settings → General → *Restart project* clears a wedged
   instance. The burst budget refills over the following hours. If it must be
   fast, temporarily raise the compute size (Settings → Compute and Disk).
4. **Verify:**
   `curl -s -o /dev/null -w "%{http_code} %{time_total}
" "$SUPABASE_URL/rest/v1/events?select=id&limit=1" -H "apikey: $SUPABASE_SERVICE_KEY"`
   should return 200 in well under 1 s.
   Then purge the site cache (`POST /api/revalidate`) in case anything was
   cached while the database was down.
5. **Prevent:** spread bulk data fixes over several days (or chunk them with
   pauses), and run ELO only once after a batch of fixes.

## Runbook: claim emails

Approving or rejecting a claim in `/admin/claims` emails the claimant
(`lib/services/email.ts`, templates in `lib/email/templates.ts`). Every attempt
is written to `claim_audit_log` as `email_claim_<approved|rejected>_<sent|skipped|failed>`.

1. Preview both emails and send yourself a test at `/admin/emails` (always goes
   only to the signed-in admin).
2. Team test: set `EMAIL_DELIVERY=allowlist` and `EMAIL_ALLOWLIST=you@…,teammate@…`
   in Vercel, redeploy, then approve/reject a test claim made by one of those accounts.
3. Go live: `EMAIL_DELIVERY=on`, redeploy.

Sending needs `steppe.run` verified in Resend (DNS records above; verified 2026-10-22). Resend only re-checks DNS when you press Verify in its dashboard or call `POST /domains/{id}/verify`. Resend
deduplicates on the idempotency key `claim-<decision>/<claimId>` for 24 h.

