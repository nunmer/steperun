# Changelog

## 2026-10-23: native RU/KZ copy, editable email text

- **Copy rewritten for native RU and KZ.** Texts were rewritten from literal
  translation into natural phrasing (Kazakh terms checked against Kazakh race
  reports: «мәре», «хаттама», «жүгірушілер»), and every em dash was removed from
  `web/messages`. Hero: «Все финиши. Все бегуны. Один протокол.»
- **Nav fits in every language.** The RU · KZ · EN switcher is now one compact
  language menu on desktop, so longer Kazakh labels no longer push "Sign in"
  off-screen.
- **Same dates and numbers on server and browser.** `lib/format.ts` formats
  from explicit month/weekday tables, because Chrome has no Kazakh locale data
  and `Intl("kk-KZ")` caused hydration mismatches. `INTL_TAGS` is gone.
- **Editable claim email text.** On `/admin/emails` the approved and rejected
  emails stay side by side and their text is edited in place: click any dashed
  text inside the email and type (subject, inbox preview and the no-name
  greeting sit above it); "Preview" shows the email exactly as sent. Supports `{name}`, `{runner}`,
  `{coins}`, `{profile_url}`, `{runner_url}`, `**bold**` and `[text](url)`.
  Stored in `app_settings` (`email_copy_approved`, `email_copy_rejected`);
  defaults live in `lib/email/copy.ts`. Audited as `admin_email_copy_changed`.

## 2026-10-22: languages, email sender, audit log fix

- **RU / KZ / EN.** The site is translated into Russian (default), Kazakh and
  English with `next-intl`. URLs don't change: a RU · KZ · EN switcher in the nav
  stores the choice in the `NEXT_LOCALE` cookie; first visits follow the
  browser's `Accept-Language`. Texts live in `web/messages/<locale>/<area>.json`;
  Russian is the source of truth (keys are type-checked against it, and a key
  missing in kk/en shows the Russian text). Dates and numbers are formatted
  per language. The admin panel stays English.
- **Editable email sender.** `/admin/emails` now edits the From name, mailbox
  (before `@RESEND_EMAIL_DOMAIN`) and Reply-To of every outgoing email. Stored
  in the new `app_settings` table (migration `006_app_settings.sql`); until
  that runs, the old defaults are used. Changes are audited as
  `admin_email_sender_changed`.
- **Fix: audit log and claim rate limit silently stopped writing in
  production** (2026-04-23 → 2026-10-21). `claim_audit_log.ip_address` and
  `rate_limit_log.ip_address` are `INET`, but routes stored the raw
  `x-forwarded-for` header (a `client, proxy` list behind a proxy) or the
  string `"unknown"`, so every insert from a user-facing route failed and the
  error was swallowed. Lost entries include one Strava connection (2026-08-04)
  and `claim_created` for claims #19–22; the claim rate limit never counted
  anything. Routes now store only the first valid address (`lib/client-ip.ts`),
  and a failed rate-limit insert is logged.

## 2026-10-22: admin panel

`/admin` is now a full back office with a section nav (counts for pending
claims, open disputes and stuck AI Coach sessions). Every page and action
checks `user_profiles.is_admin`; every write goes to `claim_audit_log`.

- **Overview**: site and queue numbers, latest import, scrape runs from GitHub
  Actions with a "Run scraper now" form (needs `GITHUB_ACTIONS_TOKEN`), service
  checks (analyzer ping, Strava, email mode, Paddle) and a site cache purge.
- **Claims**: filter by status, reject with a reason (sent in the email),
  revoke an approved claim. Approve/reject are now conditional on the claim
  still being pending, so a double click can't apply a decision twice. Emails
  are looked up for every user (the old page only saw the first 50).
- **Disputes** (new): keep the owner, or transfer the profile to the disputer
  (old claim superseded, new approved claim, coins awarded).
- **Users** (new): search by name or email; user page with claims, coin
  ledger, AI Coach sessions, Strava; adjust coins through `apply_coin_tx`
  (reason `admin_adjustment`), set trust score, grant/remove admin.
- **Runners** (new): search by name or id, edit name/city/country,
  hide/unhide, unclaim, and merge a duplicate with a preview (same guards as
  `scripts/merge_runners.py`, and it also refuses when the duplicate has any
  claim, since deleting it would cascade-delete claims and disputes).
- **Events** (new): find events missing dates, imports or results; edit
  name, date and organizer.
- **AI Coach** (new): sessions by status or user, stuck ones expired and
  refunded on demand.
- **Audit log** (new): paginated, filtered by event group or user.
- The account menu shows an Admin link to admins (`GET /api/admin/whoami`).
- `POST /api/admin/queue/[id]/decision` now uses the same approve/reject code
  as the page (it used to skip coins and emails).

## 2026-10-22: power ranking tiers that escalate

- `TierBadge` (`components/tier-badge.tsx`): a bib-tag insignia per tier that
  gets heavier as it climbs: outlined Bronze/Silver, solid Gold/Platinum,
  Diamond ◆, Master ★, and Grandmaster as a split tag (orange ★★ tab, ink
  name block).
- Power rankings: the level histogram is coloured per tier (a ladder that warms
  toward bib orange; Grandmaster is an ink bar capped in orange); table rows carry the
  badge, Master+ names and scores are set heavier and in the signal colour; a
  filtered tier shows its badge plus links to the tier below and "next up".
- Runner profile: the 10-tick meter uses tier colours and steps up in height;
  a progress bar shows the points to the next tier.
- `lib/elo-levels.ts` gains `min`, `tone`, `TIER_COLOR` and `nextLevel()`.

## 2026-10-22: claim decision emails (Resend)

- Resend added from the Vercel Marketplace (`resend-email-aqua-bucket`,
  domain `steppe.run`, eu-west-1); `resend` SDK added to `web`.
- Approving or rejecting a claim in `/admin/claims` emails the claimant: an
  approval with the coins credited and a profile link, or a rejection with the
  reviewer's note and how to follow up. Idempotent per claim and decision;
  failures never block the admin action; every attempt goes to `claim_audit_log`.
- **Delivery gate** `EMAIL_DELIVERY` = `off` (default) / `allowlist` / `on`,
  so nothing reaches users until switched on.
- `/admin/emails`: live previews and "send a test to me".
- `assertAdmin` moved to `lib/services/admin.ts` (no longer a server action
  module export).
- Privacy policy lists Resend as a sub-processor and claim emails as a purpose.
- `DEPLOYMENT.md`: Resend DNS records, env vars, "claim emails" runbook.

## 2026-10-22: nav polish, account menu, softer paper theme

- **Nav alignment:** index numbers and labels share a baseline, labels are
  trimmed to cap height (`trim-caps`), nothing wraps at `lg`; the runner search
  field has a centred icon, label and `/` key, and collapses to an icon on `lg`.
- **Account menu** (`components/account-menu.tsx`, Radix dropdown): avatar and
  first name open a panel with name and email, numbered links (profile, coins,
  AI Coach), a Paper/Night theme switch and sign-out.
- **Paper theme:** rules and hairlines are warm greys instead of ink; a faint
  topographic contour texture sits behind every page (`public/textures/
  contours.svg`, seamless, generated by `web/scripts/generate-contours.py`,
  coloured per theme through `--contour`).

## 2026-10-22: home motion, video hero, new nav, photo spread

- **Nav:** numbered index links in display type with a sliding underline;
  runner search as a command palette (button, `/` or Ctrl/⌘+K; Latin or
  Cyrillic; arrow keys + Enter); hides while scrolling down, returns on scroll
  up; transparent over the home hero, solid elsewhere. Mobile: numbered
  full-screen index, two-bar burger.
- **Home hero:** full-bleed background video (`public/media/hero.mp4`, 522 KB
  H.264; the burned-in "running." caption was inpainted out) under a dark
  scrim, with a pause control; no autoplay under reduced motion. The results
  ticker closes the hero.
- **Motion:** headline rises line by line and the last line wipes in; totals
  roll like a timing board; search placeholder types real runner names; results
  ticker; race replay of the all-time top 8 per distance with a race clock.
  All off for `prefers-reduced-motion`.
- **Photo spread** ("Between the lines"): eight editorial photos in
  `public/photos/` on an asymmetric 12-column grid with figure captions,
  unmask-on-enter and slight parallax. `lib/carousel-photos.ts` removed (the
  old `public/carousel/` images are no longer used on the home page).

## 2026-10-22: frontend redesign, "official results sheet"

Audit of steppe.run found the generic AI-template look: centered hero with two
CTAs, tilted photo pile, stat cards, seasonal emoji card backgrounds, neon-green
times, glowing ELO cards, rainbow tier colours, gradient text and buttons on
Head to Head, pill shapes and big shadows on AI Coach, donut charts, Geist
everywhere, and Next's unstyled 404. Replaced with one art direction
(`docs/DESIGN.md`):

- **Design system:** warm paper/ink palette with bib orange as the single
  signal colour, near-square corners, rules instead of cards, Fira Sans Extra
  Condensed + IBM Plex Sans/Mono (with Cyrillic). Light is now the default theme.
- **Home:** front page with a name search, real totals, a photo strip, latest
  results and all-time podiums (marathon, half, 10 km).
- **Events:** results-index lines grouped by year. **Event page:** ranked bar
  breakdowns of the field instead of three donuts, chip time as the main column.
- **Rankings:** overview is three side-by-side leaderboards.
  **Power rankings:** a level histogram that doubles as the filter (replaces 10
  cards plus duplicate chips).
- **Runner page:** stat strip with a 10-tick level meter (no external flag
  images), personal bests as the headline, race history grouped by year with
  PB marks. Profile page uses the same parts.
- **Head to head, AI Coach, coins, training tab:** gradients, glows, pills and
  ad-hoc colours removed. AI Coach sign-in page explains the three steps.
  Training charts use the chart tokens.
- New `app/not-found.tsx`, restyled `error.tsx`, loading skeletons and the nav.
  Mobile nav is a full-screen list.
- Removed `event-card`, `season-card`, `photo-carousel`, `pie-chart`, `elo-badge`.

## 2026-10-22: Supabase outage, cache TTL raised to 24 h

- **Incident:** Supabase stopped answering (REST and `/auth/v1/health` time
  out or return 504) after the 2026-10-21 bulk work: two 2-hour backfill
  scrapes, about 13k merge writes, 4.8k ELO updates and the team removal used
  up the Disk IO budget. The public site stayed up from cache.
- **Cache TTL 1 h → 24 h** (`lib/cache.ts` and the `revalidate` of every
  public page). Data only changes on the daily scrape and on claims, which
  already purge on demand, so the hourly expiry only made crawlers trigger
  fresh DB reads (each runner profile once an hour).
- `DEPLOYMENT.md`: "Supabase throttled" runbook and troubleshooting row.
- **Fix: outages were cached as "no data".** Queries swallowed Supabase errors
  and returned empty results, so pages rendered during the outage were cached
  empty (homepage blank, runner profiles "not found") until a manual purge.
  Queries now throw on error (`orThrow` / `rpc` in `lib/queries.ts`), nothing
  gets cached, ISR keeps serving the last good page, and a first render shows
  the new `app/error.tsx` ("temporarily unavailable").

## 2026-10-22: docs brought up to date

- `CLAUDE.md`: caching, exact-totals and tiebreaker rules, the runner identity
  rule, teams/relays, DNF handling, the merge scripts, and the cache purge
  after manual fixes.
- `ARCHITECTURE.md`: runner resolution order in the scraper flow; a new
  Caching section (data cache, ISR, CDN, crawlers).
- `FEATURES.md`: paginated rankings with the distance picker, power rankings,
  cross-alphabet search.
- `README.md`: structure (`data/merges/`, merge scripts), current totals.
- `TODO.md`: duplicates left for a human; removed the robots/caching item
  (done).
- Note: after the 2026-10-21 cleanup (about 13k merge writes, 4.8k ELO updates,
  team removal), Supabase was throttled (uncached queries timed out). The
  cached site kept working. Batch heavy data fixes, or spread them out.

## 2026-10-21 (later): duplicates merged, teams removed

- **Duplicate runners:** `scripts/merge_duplicates.py` merged 5,364 groups and
  removed 6,458 duplicate profiles.
  - **Rule:** same name tokens in any order or alphabet, and the same city.
    Country is ignored.
  - **Skipped:**
    - 300 groups that finished the same event (different people);
    - 252 groups whose paces differ by more than 35% on a shared distance;
    - groups without a city.
  - **Undo data:** every moved result and deleted runner row is logged in
    `data/merges/`.
  - **Coins:** claimed profiles were awarded their missing per-event coins.
- **Root cause fixed:**
  - almaty-marathon.kz imports reused a runner only on an exact
    `(name, country, city)` string ("Almaty" ≠ "Алматы"). Both importers now
    apply the same-person rule (`RunnerIndex.match_strict`) before creating a
    runner.
- **Teams:**
  - Removed 702 team/relay results (athletex Race Nation `Team` /
    `Open Team` / `Elite Team`, almaty relays) and 665 team "runners" left with
    no results.
  - The athletex parser now skips team courses, and `clean_runners.py`
    removes team results after every scrape.

## 2026-10-21 (later): duplicate runner merge

- `scripts/merge_runners.py` merges a duplicate profile (dry run by default).
- Merged 233970 (athletex "Yermek Sanzhar", no city) into 26194 (claimed
  "Sanzhar Yermek", Astana). The name was ambiguous because 20451
  "Санжар Ермек" (Almaty) has the same key. +20 event coins awarded for the
  moved Zerenda result.

## 2026-10-21 (later): scraper page-count bug

- `count_pages()` treated the category id (`?d=105`) as a page number, so the
  scraper fetched 105 pages where the site has 14. The site repeats the last
  page past the end, so every repeat was re-upserted. That meant about 8× the
  requests and DB writes per event, and **inflated `total_results`** (the
  "finishers" on event cards): 31 events corrected, from a sum of 286,593 to
  172,225. No rows were lost.
- Fixed: the page count uses only `Results_page`; the scraper stops when a page
  repeats the previous one; `total_results` is now the stored row count.

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
