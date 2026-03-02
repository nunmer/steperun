# Steperun — Implemented Features

Steperun is an Almaty running results portal. This document describes what is currently built and working.

---

## Data Pipeline

### Web Scraper (`scraper/`)
- Scrapes **almaty-marathon.kz** — all running events (marathons, half-marathons, fun runs, trail races)
- Automatically discovers all events from the `/ru/results/` index page
- Skips non-running events (cycling, swimming) by slug keyword detection
- Handles multi-distance events (marathon, half, 10k, 5k within one event) via category detection
- Paginates through all result pages per category
- Retry logic with exponential backoff (3 attempts per request)
- Configurable request delay (default 0.6s) and batch size (default 50)

### Runner Deduplication
- Runners are matched across events by `(full_name, country, city)` — the same person across multiple races gets a single `runner_id`
- Relay teams and junk entries can be flagged `is_hidden = true` via `clean_runners.py`

### Event Name Normalization
- `fix_event_names.py` converts raw slugs (`winter_run_2026`) to human-readable names (`Winter Run 2026`) with Russian-to-English keyword mapping

---

## Database (Supabase PostgreSQL)

| Table | Purpose |
|-------|---------|
| `events` | One row per race event with slug, name, year, source URL, scrape timestamp |
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
- Cards show event name and finisher count

### Event Detail `/events/[slug]`
- Event header with year and total finishers
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

## UI / Design

- **Component library:** shadcn/ui (Badge, Button, Card, Input, Select, Separator, Skeleton, Table, Tabs)
- **Styling:** TailwindCSS 4, responsive grid layouts (mobile-first)
- **Navigation:** Sticky top nav with links to all main sections, active route highlighting
- **Times:** Monospace tabular-nums font for consistent time column alignment
- **Loading states:** Skeleton components used on paginated pages

---

## Deployment

- Frontend deployed on **Vercel** (auto-deploy from `main` branch)
- Scraper runs locally (or can be scheduled via cron/GitHub Actions)
- Database hosted on **Supabase** (free tier)
- See `docs/DEPLOYMENT.md` for full setup instructions
