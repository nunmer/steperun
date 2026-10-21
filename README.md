# Steppe RUN

Running results portal for Kazakhstan. Think **worldathletics.org**, but local: road races from almaty-marathon.kz and trail/road races from athletex.kz.

**Live:** [steppe.run](https://www.steppe.run) | **Data:** 172k results, 86k runners, 75 events (updated daily)

---

## What It Does

Steppe RUN scrapes race results from almaty-marathon.kz and athletex.kz every day, matches runners across events and sources, and presents the data through a modern web interface with profiles, rankings, and head-to-head comparisons.

### For Runners
- **Find yourself** — search by name, see your full race history and personal bests
- **Claim your profile** — sign in with Google, prove ownership via Strava activity matching, and get a verified badge
- **ELO power ranking** — every runner gets a skill rating (1-2500) with level badges and regional leaderboard position
- **Head-to-head** — compare any two runners side by side across shared events

### For the Community
- **All-time rankings** by distance (42km, 21km, 10km, 5km)
- **Event archive** — every race with full paginated results, organizer, date and distance stats
- **AI run analyzer** — upload a running video, get key frames and a GPT-4o technique report (2 free, then coins)
- **Season-themed event cards** with visual identity per time of year

---

## Killer Feature: Runner Identity Layer

Most race result sites are databases. Steppe RUN is building a **runner identity platform**:

1. **Profile Claiming** — runners authenticate and cryptographically link their real identity to their race history via Google OAuth + Strava activity matching. A trust scoring system (0-100) auto-approves legitimate claims and flags suspicious ones for admin review.

2. **Coins Economy** — claimed runners earn coins:

   | Action | Reward |
   |--------|--------|
   | Claim your profile | +10 coins |
   | Connect Strava | +20 coins |
   | Per event participated | +20 coins each |

   Coins are the foundation for a **runner marketplace** — race entry discounts, merch, coaching sessions, and sponsored rewards from local running brands. Every finisher becomes a potential customer with verifiable race credentials.

3. **ELO Power Rankings** — a competitive rating system with 10 tier levels, city and country rankings with real flags, and a visual medal badge inspired by competitive gaming. This creates engagement loops: runners return to check if their rank changed after each race.

---

## Monetization Path

```
Phase 1 (now)    Free data portal → attract runners → build profiles
Phase 2          Coin rewards → engagement + Strava connections
Phase 3          Marketplace: spend coins on race entries, gear, coaching
Phase 4          Sponsored rewards from brands (Nike, adidas, local shops)
Phase 5          Premium features: training plans, pace analysis, certificates
```

The moat is the **verified runner graph** — once a runner claims their profile and connects Strava, switching costs are high. Race organizers get a distribution channel; brands get verified athletic audiences.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database / Auth / Storage | Supabase (PostgreSQL, Google OAuth) |
| Frontend | Next.js 16 + React 19 + TypeScript, TailwindCSS 4 + shadcn/ui, lucide-react |
| Run analyzer | FastAPI + OpenCV + MediaPipe + OpenAI GPT-4o (Vercel Python function) |
| Scraper | Python 3.11 + requests + BeautifulSoup4, daily on GitHub Actions |
| Hosting | Vercel Hobby (web + analyzer), Supabase free, GitHub Actions |

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Homepage — live stats, event timeline, photo carousel |
| `/rankings` | All-time leaderboard by distance and year |
| `/power-rankings` | ELO-based competitive rankings |
| `/events` | All events by year, with organizer pins |
| `/events/[slug]` | Event detail: organizer, date, distance/country/city charts, paginated results |
| `/runners` | Runner directory with search |
| `/runners/[id]` | Runner profile — PBs, race history, ELO badge, training tab |
| `/runners/head-to-head` | Side-by-side runner comparison |
| `/run-analyzer` | AI running technique analysis |
| `/coins` | Coin balance and ways to earn (packs when Paddle is on) |
| `/profile` | Signed-in user's claimed profile + coins |
| `/auth/welcome` | Post-login runner matching flow |
| `/admin/claims` | Admin dashboard for claim review |

---

## Project Structure

```
steperun/
├── CLAUDE.md                 # Project context for AI assistants (start here)
├── docs/                     # Architecture, deployment, scraper, DB, TODO, changelog
├── scraper/                  # Python package: sources, parsing, runner matching, DB helpers
│   ├── scraper.py, parser.py #   almaty-marathon.kz
│   ├── athletex.py, clax.py  #   athletex.kz (Wiclax .clax XML)
│   ├── runner_matcher.py     #   cross-source runner matching
│   ├── names.py              #   transliteration folding
│   └── db.py                 #   batched Supabase upserts
├── scripts/                  # Entry points + maintenance (run from repo root)
│   ├── scrape_almaty_marathon.py, scrape_athletex.py
│   ├── fix_event_names.py, clean_runners.py, scrape_dates.py, calculate_elo.py
│   └── smoke_test_analyzer.py
├── tests/                    # pytest (scraper, no network/DB)
├── migrations/               # SQL migrations, run in Supabase (order: docs/DB_MANAGEMENT.md)
├── schema.sql                # Core schema
├── web/                      # Next.js app → Vercel project `steperun`
├── run_analyzer/             # FastAPI analyzer → Vercel project `steperun-analyzer`
├── samples/                  # Local test media (gitignored)
└── .github/workflows/scrape-results.yml   # Daily scrape
```

---

## Quick Start

```bash
# Scraper (Python 3.11)
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env                         # SUPABASE_URL + SUPABASE_SERVICE_KEY
python -m pytest tests -q
python scripts/scrape_almaty_marathon.py --min-year 2025
python scripts/scrape_athletex.py

# Web
cd web && npm install
cp .env.example .env.local                   # see docs/DEPLOYMENT.md for every var
npm run dev                                  # http://localhost:3000

# Run analyzer (needs uv)
cd run_analyzer && uv sync && uv run uvicorn web:app --port 8000
```

Deploying = pushing to `main` (Vercel builds both projects). New database
setup, env vars, DNS and runbooks: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

---

## Documentation

| Doc | Contents |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Short project context and rules that matter |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, data flows, security model |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Hosting, env vars, DNS, runbooks, troubleshooting |
| [docs/SCRAPER.md](docs/SCRAPER.md) | Sources, pipeline, runner matching, low-IO rules, adding a source |
| [docs/DB_MANAGEMENT.md](docs/DB_MANAGEMENT.md) | Migration order/status, access model, buckets, admin SQL |
| [docs/TODO.md](docs/TODO.md) | Open items and owner actions |
| [docs/AUDIT-2026-10-21.md](docs/AUDIT-2026-10-21.md) | Site audit: performance, incomplete lists, bugs |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | What changed and when |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Product roadmap |
| [docs/FEATURES.md](docs/FEATURES.md) | Implemented features |
| [docs/DESIGN.md](docs/DESIGN.md) | Visual design system |
| [docs/PERF_BASELINE.md](docs/PERF_BASELINE.md) | Performance baseline |

---

## Team

Built by **BTS Team** in Almaty, Kazakhstan.

---

## License

Private repository. All rights reserved.
