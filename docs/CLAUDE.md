# CLAUDE.md — Steperun Project Context

## What This Project Is

Steperun is a running results portal for Almaty, Kazakhstan — think a local version of worldathletics.org. It scrapes race data from **almaty-marathon.kz** and presents it through a web interface with runner profiles, event results, and all-time rankings.

**Current data:** ~60k runners, events from 2015 onwards, results from Almaty Marathon, Winter Run, and other local races.

---

## Repository Structure

```
steperun/
├── scraper/           # Python scraper (data ingestion)
│   ├── scraper.py     # Orchestrator: fetches event list, loops categories/pages
│   ├── parser.py      # HTML parsing: categories, pagination, results table
│   └── db.py          # Supabase upsert helpers
├── web/               # Next.js frontend (deployed on Vercel)
│   ├── app/           # Next.js App Router pages
│   │   ├── page.tsx              # Homepage
│   │   ├── rankings/page.tsx     # All-time leaderboard
│   │   ├── events/page.tsx       # Events list
│   │   ├── events/[slug]/page.tsx # Event detail + results
│   │   ├── runners/page.tsx      # Runner directory
│   │   └── runners/[id]/page.tsx # Runner profile
│   ├── components/
│   │   ├── nav.tsx               # Site navigation
│   │   └── ui/                   # shadcn/ui components
│   └── lib/
│       ├── supabase.ts           # Supabase client + TypeScript types
│       ├── queries.ts            # All DB query functions
│       └── utils.ts              # cn() and other helpers
├── run.py             # Entry point: python run.py [--force]
├── clean_runners.py   # Post-scrape: hides relay teams, deletes junk rows
├── fix_event_names.py # Normalizes event names (slug → human-readable)
├── schema.sql         # Full DB schema (run in Supabase SQL Editor)
├── requirements.txt   # Python deps
└── vercel.json        # Vercel config (framework: nextjs)
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Database | Supabase (PostgreSQL) |
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | TailwindCSS 4 + shadcn/ui |
| Icons | lucide-react |
| Scraper | Python 3.11 + requests + BeautifulSoup4 + lxml |
| Deployment | Vercel (web only) |

---

## Database Schema

Three core tables in Supabase:

```sql
events (id, slug, name, year, url, scraped_at, total_results)
runners (id, full_name, country, city, is_hidden, created_at)
results (id, runner_id, event_id, bib_number, distance_category,
         place, checkpoint_times JSONB, finish_time, chip_time, created_at)
```

Plus a flat view `v_results` joining all three — useful for ad-hoc queries.

**Key constraints:**
- `runners` deduplicated by `UNIQUE(full_name, country, city)`
- `results` deduplicated by `UNIQUE(event_id, bib_number, distance_category)`
- `runners.is_hidden = true` suppresses relay teams and junk from all frontend queries

**Indexes:** `idx_results_runner`, `idx_results_event`, `idx_results_place`, `idx_results_category`, `idx_runners_name`, `idx_events_year`, `idx_events_slug`

---

## Frontend Patterns

### All pages are Next.js Server Components
- No client-side data fetching — all queries run server-side via `lib/queries.ts`
- Pages use `export const revalidate = 3600` (1-hour ISR cache)
- Supabase is initialized server-side only (`lib/supabase.ts`) — the service key is never in the browser bundle

### Query conventions (`lib/queries.ts`)
- All queries filter `is_hidden = false` for runners
- Results filter out null/invalid chip times: `.not("chip_time", "is", null).neq("chip_time", "--:--:--")`
- Pagination: `PAGE_SIZE = 30`, uses Supabase `.range(from, to)`
- Rankings deduplicate by keeping each runner's best chip time (client-side Map after over-fetching)

### URL structure
- Events use `slug` as URL key: `/events/almaty_marathon_2024`
- Runners use numeric `id`: `/runners/1234`

### Component library
shadcn/ui components are in `web/components/ui/`. Add new components with:
```bash
cd web && npx shadcn@latest add <component-name>
```

---

## Scraper Patterns

### Running the scraper
```bash
python run.py           # Resume mode — skips already-scraped events
python run.py --force   # Re-scrape everything
```

### How it works
1. Fetches `/ru/results/` index → extracts event slugs
2. Skips events with cycling/swim keywords in slug
3. For each event: detects distance categories from `<select ?d=VALUE>` dropdown
4. Paginates each category: `?d=VALUE&Results_page=N`
5. Upserts runners (deduplicated), then results in batches of 50

### Environment variables
```
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=<service-role-jwt>
SCRAPER_DELAY=0.6        # seconds between requests
SCRAPER_BATCH_SIZE=50    # rows per DB batch
```

### Post-scrape cleanup
After a fresh scrape run:
```bash
python clean_runners.py    # Hides relay teams, deletes pure-numeric junk
python fix_event_names.py  # Normalizes event names from slugs
```

---

## Known Issues / Gotchas

- `getDistanceOptions()` in `lib/queries.ts` calls an RPC `get_distance_options()` that may not exist in Supabase yet. It has a working fallback that paginates through results — slow but functional.
- Rankings use client-side dedup (best time per runner): over-fetches `limit * 5` rows and deduplicates in JS. For large limits this is fine; for very large datasets consider a DB-side approach.
- The scraper uses the `almaty-marathon.kz` site structure — if they redesign, `parser.py` column detection may break. Parser has positional fallback logic for when headers are missing.
- `events.total_results` is set from total upserted rows, not the site's displayed count.

---

## What's NOT Implemented Yet

- No user authentication / runner claims
- No admin dashboard or manual data upload
- No REST/GraphQL API layer (frontend queries Supabase directly)
- No analytics or event-level insights
- No runner-to-runner comparison
- No notifications or new-event alerts
- No export (CSV/PDF)
