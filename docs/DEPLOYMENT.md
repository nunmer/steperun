# Deployment Guide

This guide covers setting up Steperun from scratch: database, web frontend, and scraper.

---

## Prerequisites

- **Node.js** 20+ and **npm**
- **Python** 3.11+
- A **Supabase** account (free tier is sufficient)
- A **Vercel** account (free tier is sufficient)

---

## 1. Database Setup (Supabase)

### Create a project
1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region close to your users
3. Save the database password

### Run the schema
1. Open the **SQL Editor** in the Supabase dashboard
2. Paste and run the contents of `schema.sql` from the root of this repo
3. Verify three tables appear: `events`, `runners`, `results`

### Get credentials
From **Project Settings → API**:
- `SUPABASE_URL` — the Project URL (e.g., `https://abcdefgh.supabase.co`)
- `SUPABASE_SERVICE_KEY` — the `service_role` secret key (not the `anon` key)

> The service role key bypasses Row Level Security. Keep it secret and only use it server-side.

### Optional: Create the RPC function for distance options
Run this in the SQL Editor for faster distance filtering on the rankings page:

```sql
CREATE OR REPLACE FUNCTION get_distance_options()
RETURNS TABLE(distance_category TEXT) AS $$
  SELECT distance_category, COUNT(*) as cnt
  FROM results
  WHERE distance_category IS NOT NULL
    AND chip_time IS NOT NULL
    AND chip_time != '--:--:--'
  GROUP BY distance_category
  ORDER BY cnt DESC;
$$ LANGUAGE SQL STABLE;
```

Without this function the app falls back to a paginated scan — slower but still works.

---

## 2. Running the Scraper

### Install dependencies
```bash
pip install -r requirements.txt
```

### Configure environment
Copy the example file and fill in your credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-role-key...
SCRAPER_DELAY=0.6
SCRAPER_BATCH_SIZE=50
```

### Run the scraper
```bash
# First run — scrapes all events
python run.py

# Resume after interruption — skips already-completed events
python run.py

# Force re-scrape everything
python run.py --force
```

The scraper logs progress to stdout. A full scrape of all events takes 20-60 minutes depending on network speed and the configured delay.

### Post-scrape cleanup
After the initial scrape, run these utilities once:

```bash
# Hide relay teams and delete junk entries (numeric-only names, etc.)
python clean_runners.py

# Normalize event names (converts slugs to human-readable names)
python fix_event_names.py
```

### Re-scraping new events
Run `python run.py` again at any time — it skips events already marked as scraped. New events published on almaty-marathon.kz will be picked up automatically.

---

## 3. Web Frontend (Local Development)

### Install dependencies
```bash
cd web
npm install
```

### Configure environment
Create `web/.env.local`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-role-key...
```

### Start dev server
```bash
cd web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for production
```bash
cd web
npm run build
npm start
```

---

## 4. Deploying to Vercel

### First-time setup via Vercel CLI
```bash
npm i -g vercel
cd web
vercel
```

Follow the prompts. When asked for the root directory, enter `web/`.

### Or deploy via GitHub integration
1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Set the **Root Directory** to `web`
4. Vercel auto-detects Next.js — no build command changes needed

### Set environment variables on Vercel
In the Vercel dashboard → your project → **Settings → Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJ...` (service role key) |

Set these for **Production**, **Preview**, and **Development** environments.

### Redeploy after adding env vars
Trigger a redeployment from the Vercel dashboard or push a new commit.

### Verify deployment
- Homepage should show live runner/event counts from Supabase
- Check `/rankings` — if it loads distances, the DB connection is working

---

## 5. Ongoing Operations

### Scraping new events
Run `python run.py` locally whenever new events are published on almaty-marathon.kz. The site typically publishes results 1-3 days after each race.

### Automating scrapes (optional)
Set up a GitHub Actions workflow or a cron job on any server:

```yaml
# .github/workflows/scrape.yml (example)
on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 06:00 UTC
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - run: python run.py
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

### Hiding bad data
If junk entries appear in the UI:
```bash
python clean_runners.py
```

Or manually in the Supabase SQL editor:
```sql
-- Hide a specific runner
UPDATE runners SET is_hidden = true WHERE full_name ILIKE '%some junk%';

-- Delete a result
DELETE FROM results WHERE id = 12345;
```

---

## Architecture Diagram

```
almaty-marathon.kz
       │
       │ HTTP (requests + BeautifulSoup)
       ▼
  scraper/ (Python)
       │
       │ Supabase Python SDK (upsert)
       ▼
  Supabase (PostgreSQL)
       │
       │ Supabase JS SDK (server-side queries)
       ▼
  web/ (Next.js on Vercel)
       │
       │ HTTP
       ▼
     Browser
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Rankings page loads no distances | The RPC function is missing; create it (step 1) or wait for the fallback scan to complete |
| Scraper fails with 403 | The source site may have changed; check `scraper/parser.py` |
| Runner names show as numbers | Run `clean_runners.py` to hide junk entries |
| Event names look like raw slugs | Run `fix_event_names.py` |
| Vercel build fails | Check that `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set in Vercel env vars |
| `next: command not found` | Run `npm install` inside the `web/` directory |
