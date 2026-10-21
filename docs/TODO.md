# Open items

Operational to-dos and known gaps, last updated 2026-10-21. The longer-term
product plan is in `ROADMAP.md`.

## Needs you (owner actions)

- [ ] **Run `migrations/005_site_audit_fixes.sql`** in the Supabase SQL Editor. It
  enables full rankings pagination, Latin/Cyrillic search and the index cleanup.
  The site works without it, using the older, limited behaviour.

- [ ] **Send the Fly waiver email** to billing@fly.io (or the dashboard support
  form). The app is already destroyed, so the draft below is accurate:

  > **Subject:** Request to waive overdue invoices — org sqnzhqr
  >
  > Hi Fly team,
  >
  > My organization (sqnzhqr) has five overdue invoices, ASZI38F6-0002 to -0006
  > (May–September 2026, $60.40 total), for the app steperun-app. This was a
  > small personal side project. I didn't realize it was still running and
  > generating charges, since the site had already moved to another host.
  >
  > I've now destroyed the app and won't be using Fly going forward. Would you
  > be willing to waive these invoices, including the partial October charge?
  > I'd really appreciate it.
  >
  > Thanks,
  > [your name]

- [ ] **Test the run analyzer through the site** while logged in
  (upload → extract → analyze). The analyzer itself is verified with
  `scripts/smoke_test_analyzer.py`.
- [ ] **Send athletex competition page links** for editions that slug guessing
  missed: Amangeldy 2023–24, Salomon 2023, Oskemen 2024–25, astanatrail25,
  rrspring2025, rrautumn24.
- [ ] **Share Supabase → Reports → Query Performance** so the remaining Disk IO
  consumers can be found.
- [ ] **Delete the unused Vercel project `steperun-dqxd`**: Settings → General → Delete
  Project (the API can't delete it). *Optional:* also remove the stale `SCRAPER_*`
  env vars on the `steperun` project.
- [ ] *Optional:* rotate the analyzer shared key and the OpenAI key. Both passed
  through a chat transcript while being set up (runbook in `DEPLOYMENT.md`).

## Engineering follow-ups

- [ ] **Junk runner names** like `] Ivan` (leading punctuation) slip past
  `clean_runners.py`. Extend its junk rules.
- [ ] **Soft 404s** (audit item 17): unknown slugs/ids render the not-found page
  with status 200, because of streaming from `loading.tsx`.

- [ ] **Disk IO:** add `robots.txt` and caching for the dynamic filtered pages
  (rankings, runners search) so crawlers don't hit the DB.
- [ ] **athletex:** store birth year and sex. They're in the `.clax` files but
  there are no columns yet (`runners.birth_year`, `results.sex`?).
- [ ] **almaty-marathon.kz history:** 79 events from 2016–2023 have never been
  imported. Run the workflow with `min_year=0` once; it's slow and uses a lot
  of IO.
- [ ] **Analyzer speed:** extraction takes about 60 s on Vercel's 1 vCPU. Options:
  sample fewer frames, downscale before pose detection.
- [ ] **Paddle:** re-enable coin packs once product verification passes (set the
  `PADDLE_*` env vars). That requires moving off Vercel Hobby, which is
  non-commercial only.
- [ ] **Lint debt:** `@typescript-eslint/no-explicit-any` in
  `web/app/events/[slug]/page.tsx` and `web/lib/queries.ts`.
- [ ] **Local leftover:** the root `venv/` (local scraper env, gitignored) can be
  deleted if you use another Python env. (`pose_landmarker_heavy.task` was
  deleted on 2026-10-21.)
