# Steperun — Implemented Features

Steppe RUN (steppe.run) is a running results portal for Kazakhstan. This document describes what is currently built and working.

---

## Data Pipeline

Runs daily on GitHub Actions. Details in `docs/SCRAPER.md`.

### Sources
- **almaty-marathon.kz** (`scraper/scraper.py`, `parser.py`): event index,
  distance categories, paginated result tables. Cycling/swim events are skipped.
- **athletex.kz** (`scraper/athletex.py`, `clax.py`): competition pages → Wiclax
  `.clax` XML on live.myrace.info. Running courses only; places are recomputed
  per category. Past seasons are found by swapping the year in the slug.
- Every event is tagged with its **organizer** ("Almaty Marathon" / "Athletex").

### Runner identity
- Within almaty-marathon.kz: exact `(full_name, country, city)`.
- Across sources: transliteration-tolerant name matching with city and country
  agreement (`scraper/runner_matcher.py`). Ambiguous cases create a new runner
  instead of merging.
- Relay teams and junk entries are hidden (`is_hidden`) by
  `scripts/clean_runners.py`.

### Post-processing (only when new results arrive)
- Event name normalization, event dates, and ELO recalculation (changed runners
  only).

---

## Database (Supabase PostgreSQL)

| Table | Purpose |
|-------|---------|
| `events` | One row per race event: slug, name, year, date, organizer, source URL, scrape timestamp |
| `runners` | Deduplicated runner registry with name, country, city, hidden flag |
| `results` | One result per runner per distance per event: place, bib, chip time, finish time, checkpoint splits (JSONB) |

- `v_results` view: flat join of all three tables for easy ad-hoc queries
- All tables indexed for common query patterns (by runner, by event, by category, by year)

---

## Web Frontend (Next.js)

All pages are **server-rendered** (Next.js Server Components) with 1-hour ISR cache. No client-side data fetching.

### Homepage `/`
- Hero section with call-to-action buttons (Rankings, Find a Runner)
- Live stats: total unique runners, race events, finishes logged
- Event timeline grouped by year (most recent 4 years shown, cards link to event detail)

### Rankings `/rankings`
- All-time leaderboard per distance (e.g., 42 km, 21 km, 10 km)
- Distance selector shows up to 12 most-populated categories
- Year filter: All time + individual years
- Shows: rank (with medal icons for top 3), runner name, country, city, best chip time, event achieved at
- Deduplicates to one best result per runner

### Events `/events`
- Complete list of all scraped events
- Filterable by year (tab navigation)
- Season-themed cards show organizer pin, event name, date and finisher count

### Event Detail `/events/[slug]`
- Header: organizer pin, date, finishers, number of distances, link to official results
- Distance / country / city pie charts
- Distance category filter buttons
- Paginated results table (30 per page): place, runner name, country, city, bib number, distance, gun time, chip time

### Runner Directory `/runners`
- Full-text search by name (case-insensitive, partial match)
- Paginated list (30 per page): name, country, city
- Each row links to the runner's profile

### Runner Profile `/runners/[id]`
- Basic info: name, country, city
- Stats: total races, active seasons (years raced), distinct distances
- Personal Bests table: best chip time per distance
- Full race history sorted by year descending: event, year, distance, place, finish time, chip time

---

### Run Analyzer `/run-analyzer`
- Upload a running video (≤50 MB). Key frames per gait phase (foot strike, mid
  stance, toe off) are extracted with MediaPipe pose detection.
- GPT-4o technique report: sections, recommendations, overall score.
- 2 free analyses, then 10 coins each. Failed or stuck analyses are refunded.

### Accounts, claims and coins
- Google sign-in, runner profile claiming with Strava verification and trust
  scoring, admin review queue (`/admin/claims`), disputes.
- Coins: +10 for a claimed profile, +20 for connecting Strava, +20 per event.
  Paddle coin packs exist but are off unless configured (earn-only mode).

---

## UI / Design

- **Component library:** shadcn/ui (Badge, Button, Card, Input, Select, Separator, Skeleton, Table, Tabs)
- **Styling:** TailwindCSS 4, responsive grid layouts (mobile-first)
- **Navigation:** Sticky top nav with links to all main sections, active route highlighting
- **Times:** Monospace tabular-nums font for consistent time column alignment
- **Loading states:** Skeleton components used on paginated pages

---

## Deployment

- Web and run analyzer: two **Vercel** projects, auto-deployed from `main`
- Scraper: **GitHub Actions**, daily at 03:00 UTC
- Database, auth and storage: **Supabase** (free tier)
- See `docs/DEPLOYMENT.md`
