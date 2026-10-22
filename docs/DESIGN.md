# Design: the "official results sheet"

The site is a results archive, so it borrows from race bibs, timing boards and
printed results lists, not from SaaS landing pages. Every page should read like
a sheet you could pin to a board at the finish.

## Tokens (`web/app/globals.css`)

| Token | Use |
|---|---|
| `--background` / `--foreground` | Warm paper and ink (light is the default theme; dark is "night start line") |
| `--primary` | Bib orange. The **only** signal colour: active nav/filter, podium ranks 1–3, top tier, PB marks, the main CTA |
| `--rule` | Warm grey heavy rules (`border-rule`) under page titles and section heads |
| `--contour` | Colour of the fixed topographic contour texture behind the page (`body::before`) |
| `--border` | Hairlines between rows |
| `--positive` / `--caution` / `--destructive` | Status only (coin gains/losses, training form, errors) |
| `--chart-1..5` | Rust, steppe ochre, sage, steel, clay. Data viz and organizer marks |
| `--radius` | 3px. Corners are nearly square; `rounded-full` only for spinners and the coin dot |

No gradients, glows, blur, large shadows or tinted icon tiles.

**ELO tiers** are the one place the chart palette marks status: Bronze clay
(`chart-5`), Silver steel (`chart-4`), Gold ochre (`chart-2`), Platinum deep steel,
Diamond sage (`chart-3`), Master bib orange, Grandmaster ink with an orange
★★ tab. Treatment escalates with the tier (outline → solid → mark → split
tag); see `TierBadge`.

## Type

- **Fira Sans Extra Condensed** (`headline` utility): uppercase page titles,
  section heads, runner names, big numbers.
- **IBM Plex Sans** (body), **IBM Plex Mono** (`time` utility): every race
  time, rank, bib, count and date.
- `eyebrow` utility: small mono uppercase label above a block of data.
- All three load the Cyrillic subset because most runner names are Cyrillic.

## Building blocks

- `components/sheet.tsx`: `PageHeader` (title + heavy rule + right-hand meta),
  `FilterRow` / `FilterLink` (underlined text filters; they scroll sideways on
  phones), `Rank` (podium in the signal colour), `Place`, `BackLink`, `EmptyState`.
- `components/sheet-skeleton.tsx`: loading state shaped like the page.
- `components/event-list.tsx`: races as index lines (date · race · organizer ·
  finishers), grouped by year with the year in a margin column on desktop.
- `components/breakdown.tsx`: ranked bars (replaces donut charts).
- `components/runner-stats.tsx`: the runner stat strip, the 10-tick `LevelMeter`
  and `Monogram`.
- `components/tier-badge.tsx`: `TierBadge`, the escalating tier insignia.
- `lib/elo-levels.ts`: tier names, ELO ranges, thresholds, tones and
  `nextLevel()` (single source; `min` mirrors `scripts/calculate_elo.py`).

## Rules

- Tables have no outer box: eyebrow headers over an ink rule, hairline rows.
- Sections are separated by rules and space, not cards. `Card` is kept only for
  admin and claim-confirmation lists, where each item is a separate action.
- One composition per page type: home is a front page (search + numbers +
  latest results + podiums), events an almanac, rankings leaderboards, a runner
  page leads with personal bests.
- Mobile is designed, not squeezed: full-screen nav in display type, filters
  scroll sideways, the photo strip scrolls with snap, level distribution turns
  into rows.
- Copy states facts about the data ("171,523 finishes"), never generic marketing.
- Motion carries meaning or pacing: timing-board odometers, the results
  ticker, the race replay, the hero's start. Classes live at the end of
  `globals.css` (`reveal-line`, `odo-digit`, `ticker-track`, `shot`); every
  effect has a `prefers-reduced-motion` fallback. Don't add generic
  fade-in-on-scroll to data sections.

## Media and photography

- Hero video: `web/public/media/hero.mp4` (+ `hero-poster.jpg`), muted loop,
  H.264, keep it under ~1 MB. Always under the dark scrim; the hero section has
  class `dark` so it uses the night palette in either theme.
- Photos: `web/public/photos/`, graded, mostly overhead/long-shadow/motion-blur
  running shots. Used only in the editorial spread, never as card backgrounds
  or decoration behind data. No AI-generated images.

## Navigation

- `components/nav.tsx`: numbered index, transparent over `#hero`, hides on
  scroll down. Labels use `trim-caps` so caps centre optically.
  `components/account-menu.tsx`: signed-in menu (identity, links, theme, sign-out). `components/command-search.tsx`: the runner search palette.
