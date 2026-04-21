# Steppe RUN

Running results portal for Almaty, Kazakhstan. Think **worldathletics.org**, but local — covering every marathon, half-marathon, and fun run in the region since 2015.

**Live:** deployed on Vercel | **Data:** ~60,000 runners across 100+ events

---

## What It Does

Steppe RUN scrapes race results from almaty-marathon.kz, deduplicates runners across events, and presents the data through a modern web interface with profiles, rankings, and head-to-head comparisons.

### For Runners
- **Find yourself** — search by name, see your full race history and personal bests
- **Claim your profile** — sign in with Google, prove ownership via Strava activity matching, and get a verified badge
- **ELO power ranking** — every runner gets a skill rating (1-2500) with level badges and regional leaderboard position
- **Head-to-head** — compare any two runners side by side across shared events

### For the Community
- **All-time rankings** by distance (42km, 21km, 10km, 5km)
- **Event archive** — every race with full paginated results
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
| Database | Supabase (PostgreSQL) |
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | TailwindCSS 4 + shadcn/ui |
| Auth | Supabase Auth (Google OAuth) + Strava OAuth |
| Icons | lucide-react |
| Scraper | Python 3.11 + requests + BeautifulSoup4 |
| Deployment | Vercel |

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Homepage — live stats, event timeline, photo carousel |
| `/rankings` | All-time leaderboard by distance and year |
| `/power-rankings` | ELO-based competitive rankings |
| `/events` | All events, filterable by year |
| `/events/[slug]` | Event detail with paginated results |
| `/runners` | Runner directory with full-text search |
| `/runners/[id]` | Runner profile — PBs, race history, ELO badge |
| `/runners/head-to-head` | Side-by-side runner comparison |
| `/profile` | Authenticated user's claimed profile + coins |
| `/auth/welcome` | Post-login runner matching flow |
| `/admin/claims` | Admin dashboard for claim review |

---

## Project Structure

```
steperun/
├── scraper/                 # Python data pipeline
│   ├── scraper.py           # Event discovery + pagination
│   ├── parser.py            # HTML → structured data
│   └── db.py                # Supabase upsert helpers
├── web/                     # Next.js frontend
│   ├── app/                 # App Router pages
│   ├── components/          # UI components
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── elo-badge.tsx    # ELO medal + stat cards
│   │   ├── coin-balance.tsx # Currency pill display
│   │   ├── claim-button.tsx # Profile claim CTA
│   │   └── nav.tsx          # Site navigation + theme toggle
│   └── lib/
│       ├── supabase.ts      # DB client + TypeScript types
│       ├── queries.ts       # All server-side queries
│       └── services/        # Business logic
│           ├── claims.ts    # Claim creation + trust scoring
│           ├── coins.ts     # Coin rewards engine
│           ├── strava.ts    # Strava OAuth + API
│           ├── strava-matcher.ts  # Activity matching
│           ├── trust-scoring.ts   # Trust point calculation
│           ├── disputes.ts  # Claim dispute resolution
│           └── audit.ts     # Append-only audit log
├── migrations/              # SQL migrations (run in Supabase)
│   ├── add_claims.sql       # Auth tables, RLS, triggers
│   ├── add_elo.sql          # ELO columns + indexes
│   ├── add_coins.sql        # Coin ledger + balance
│   ├── fn_delete_user.sql   # Admin: full user deletion
│   └── fn_award_coins.sql   # Admin: idempotent coin awards
├── schema.sql               # Core DB schema
├── run.py                   # Scraper entry point
├── clean_runners.py         # Post-scrape cleanup
└── fix_event_names.py       # Event name normalization
```

---

## Quick Start

### Database
1. Create a Supabase project
2. Run `schema.sql` in SQL Editor
3. Run migrations in order: `add_claims.sql` → `add_elo.sql` → `add_coins.sql`

### Scraper
```bash
pip install -r requirements.txt
cp .env.example .env  # fill in SUPABASE_URL + SUPABASE_SERVICE_KEY
python run.py
python clean_runners.py
python fix_event_names.py
```

### Frontend
```bash
cd web
npm install
cp .env.example .env.local  # fill in Supabase credentials
npm run dev
```

### Deploy
Push to GitHub → connect to Vercel → set env vars → done.

See `docs/DEPLOYMENT.md` for the full guide.

---

## Database Schema

Three core tables + auth/rewards layer:

**Core:**
- `events` — race events with slug, name, year, date
- `runners` — deduplicated by (full_name, country, city), with ELO score and claimed_by
- `results` — one row per runner per distance per event

**Auth & Rewards:**
- `user_profiles` — trust score, verification level, coin balance
- `runner_claims` — claim requests with trust scoring and Strava matching
- `strava_tokens` — OAuth tokens for activity verification
- `coin_transactions` — append-only ledger of all coin rewards
- `disputes` — claim dispute resolution
- `claim_audit_log` — full audit trail

---

## Team

Built by **BTS Team** in Almaty, Kazakhstan.

---

## License

Private repository. All rights reserved.
