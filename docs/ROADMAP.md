# Steperun — Product Roadmap

Goal: build a running results portal for Almaty comparable to worldathletics.org — with runner profiles, all-time rankings, age/gender splits, and progress tracking.

---

## Phase 1 — Data Foundation
> Everything downstream depends on having complete data. Do this first.

### 1.1 Add gender to the pipeline
- [ ] Scraper: fetch each distance category through `?g=1` (male) and `?g=2` (female) URL params (already exposed by almaty-marathon.kz but never captured)
- [ ] DB: add `gender CHAR(1)` column (`'M'`, `'F'`, `NULL`) to `results` table
- [ ] Frontend: gender filter (All / Men / Women) on rankings page and event results

### 1.2 Add age groups
- [ ] Scraper: detect `?ac=` options from the category page — same `<select>` pattern already used for distances
- [ ] DB: add `age_group TEXT` column (e.g. `'M40'`, `'W18'`) to `results` table
- [ ] Frontend: age group filter dropdown on rankings page

### 1.3 Fix `get_distance_options` RPC
- [ ] Create the SQL function in Supabase (one-liner — see `docs/DEPLOYMENT.md`)
- [ ] Current fallback scans the whole results table on every rankings page load — slow and wasteful

### 1.4 Auto-scraping via GitHub Actions
- [ ] Weekly cron job (e.g. every Monday 06:00 UTC) running `python run.py`
- [ ] Secrets: `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in repo settings
- [ ] New events picked up automatically without manual intervention

---

## Phase 2 — Rankings & Statistics
> Core product value. Makes the site useful for the running community.

### 2.1 Gender-split rankings
- [ ] Filter buttons on `/rankings`: All / Men / Women
- [ ] Requires Phase 1.1

### 2.2 Age group rankings
- [ ] Filter dropdown on `/rankings`: All ages / M18 / M30 / M40 / M50 / W18 / W30 / W40 / W50
- [ ] Requires Phase 1.2

### 2.3 Course records
- [ ] Per event + distance: all-time fastest, fastest man, fastest woman
- [ ] Show as highlighted header row on event detail page

### 2.4 Podium stats on runner profile
- [ ] Count of 1st / 2nd / 3rd place finishes per runner
- [ ] Trophy icons in the profile stats row

### 2.5 Percentile ranking per result
- [ ] "Faster than 84% of runners at this distance" — shown per result row on runner profile
- [ ] Requires an aggregate query per event + distance category

### 2.6 Country / city leaderboards
- [ ] Filter rankings by country or city
- [ ] Leaderboard by city (Almaty vs Astana vs other)

---

## Phase 3 — Richer Runner Profiles
> What makes someone come back to the site.

### 3.1 Progress chart
- [ ] Line chart: chip time over years for each distance
- [ ] Library: Recharts (lightweight, works with Next.js client components)
- [ ] Most impactful visualization — shows improvement over time

### 3.2 Pace per km
- [ ] Calculate and display pace (min/km) alongside chip time everywhere
- [ ] Requires mapping `distance_category` strings to numeric km values (e.g. `"42 км"` → `42.195`)

### 3.3 Field comparison per result
- [ ] Average and median time for that distance at that event
- [ ] Runner's percentile shown inline on race history table
- [ ] Requires aggregate query per event + distance

### 3.4 Career summary stats
- [ ] Total km run across all races
- [ ] Total hours on course
- [ ] Fastest race / slowest race / most recent race

---

## Phase 4 — Search & Discovery
> Bring more users in. Let people find themselves and others.

### 4.1 Better runner search
- [ ] Filter runner list by country and/or city (dropdown chips)
- [ ] Search by bib number within a specific event

### 4.2 Runner vs runner comparison
- [ ] Route: `/compare?a=123&b=456`
- [ ] Side-by-side profiles: same distances, who ran faster, who improved more

### 4.3 Event filtering
- [ ] Filter events by distance type (marathon / half / 10k / 5k / trail)
- [ ] Sort events by finisher count or year

---

## Phase 5 — Infrastructure & Data Quality
> Make the site maintainable and scalable.

### 5.1 Admin dashboard
- [ ] Password-protected page at `/admin`
- [ ] Trigger a scrape, view scrape logs, hide/unhide runners, fix event names
- [ ] Implemented as Next.js server actions — no separate backend needed

### 5.2 Duplicate runner detection and merge
- [ ] Detect likely duplicates: same name with slight city variation (e.g. `"Almaty"` vs `"Алматы"`)
- [ ] Admin tool to merge two `runner_id` records into one

### 5.3 CSV import for external events
- [ ] Manual upload for events not on almaty-marathon.kz
- [ ] Standardized CSV format → same upsert pipeline as the scraper

### 5.4 Additional data sources
- [ ] Other Almaty race organizers with online results
- [ ] Requires per-source parser modules (same DB schema)

---

## Phase 6 — Community Layer
> Optional. Adds engagement but significantly increases complexity.

### 6.1 Runner profile claiming
- [ ] Auth via email or Google OAuth (Supabase Auth)
- [ ] Runner searches for themselves, claims their `runner_id`
- [ ] Claimed profiles get a verified badge

### 6.2 Following runners
- [ ] Anonymous bookmark (localStorage) or auth-based watchlist
- [ ] Email notification when new results are posted for followed runners

### 6.3 Social sharing
- [ ] Open Graph image generation per runner profile (`/api/og/runner/[id]`)
- [ ] Shareable PB card (e.g. "I ran 42 km in 3:45:00 at Almaty Marathon 2024")

---

## Priority Matrix

| # | Feature | Impact | Effort | Phase |
|---|---------|--------|--------|-------|
| 1 | Gender in scraper + DB + rankings | High | Low | 1.1 |
| 2 | Age groups in scraper + DB + rankings | High | Low | 1.2 |
| 3 | GitHub Actions auto-scrape | High | Low | 1.4 |
| 4 | `get_distance_options` RPC fix | Medium | Very low | 1.3 |
| 5 | Progress chart on runner profile | High | Medium | 3.1 |
| 6 | Course records on event page | Medium | Low | 2.3 |
| 7 | Pace per km display | Medium | Low | 3.2 |
| 8 | Gender-split rankings | High | Low | 2.1 |
| 9 | Age group rankings | High | Low | 2.2 |
| 10 | Percentile per result | Medium | Medium | 2.5 |
| 11 | Country/city filter in rankings | Medium | Low | 2.6 |
| 12 | Runner vs runner comparison | Medium | Medium | 4.2 |
| 13 | Admin dashboard | Medium | Medium | 5.1 |
| 14 | Runner profile claiming (auth) | Medium | High | 6.1 |
| 15 | CSV import / more data sources | Low | High | 5.3 |

---

## Current Status

- [x] Python scraper (events, results, runner deduplication)
- [x] Supabase database (events, runners, results + v_results view)
- [x] Homepage with live stats and event timeline
- [x] Rankings page (by distance, by year)
- [x] Events list + event detail with paginated results
- [x] Runner directory with search
- [x] Runner profile with personal bests and race history
- [x] Deployed on Vercel
