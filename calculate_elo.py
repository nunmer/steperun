"""
Calculate ELO / Power Score for all runners.

Scoring components (weighted):
  1. Time performance (40%) — best time vs course record per distance
  2. Consistency (20%)     — average races per active year
  3. Versatility (15%)     — unique distances completed
  4. Podium finishes (15%) — top-3 placements
  5. Years active (10%)    — distinct seasons

ELO is mapped to 100–2500+ range.

Levels (Faceit-style):
  Level  1:  100–500
  Level  2:  501–750
  Level  3:  751–900
  Level  4:  901–1050
  Level  5:  1051–1200
  Level  6:  1201–1350
  Level  7:  1351–1530
  Level  8:  1531–1750
  Level  9:  1751–2000
  Level 10:  2001+
  Challenger: Top 1000 runners (special designation, stored separately)

Usage:
  python calculate_elo.py
"""

import os
import math
from datetime import datetime, timezone
from collections import defaultdict
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

PAGE = 1000

# ── Fetch all visible runners ──────────────────────────────────────────

print("Fetching runners...")
offset = 0
all_runners = []
while True:
    resp = (
        client.table("runners")
        .select("id, full_name")
        .eq("is_hidden", False)
        .range(offset, offset + PAGE - 1)
        .execute()
    )
    batch = resp.data or []
    all_runners.extend(batch)
    if len(batch) < PAGE:
        break
    offset += PAGE
print(f"  {len(all_runners)} runners")

# ── Fetch all valid results ────────────────────────────────────────────

print("Fetching results...")
offset = 0
all_results = []
while True:
    resp = (
        client.table("results")
        .select("runner_id, event_id, distance_category, place, chip_time")
        .not_.is_("chip_time", "null")
        .neq("chip_time", "--:--:--")
        .range(offset, offset + PAGE - 1)
        .execute()
    )
    batch = resp.data or []
    all_results.extend(batch)
    if len(batch) < PAGE:
        break
    offset += PAGE
print(f"  {len(all_results)} results")

# ── Fetch events for year info ─────────────────────────────────────────

print("Fetching events...")
offset = 0
all_events = []
while True:
    resp = (
        client.table("events")
        .select("id, year")
        .range(offset, offset + PAGE - 1)
        .execute()
    )
    batch = resp.data or []
    all_events.extend(batch)
    if len(batch) < PAGE:
        break
    offset += PAGE

event_year = {e["id"]: e["year"] for e in all_events}
print(f"  {len(all_events)} events")


# ── Helpers ────────────────────────────────────────────────────────────

def time_to_seconds(t: str) -> float:
    """Parse HH:MM:SS or MM:SS to seconds. Returns inf on failure."""
    try:
        parts = t.strip().split(":")
        parts = [float(p) for p in parts]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
    except (ValueError, AttributeError):
        pass
    return float("inf")


def get_level(elo: int) -> int:
    """Map ELO score to level 1–10."""
    if elo >= 2001:
        return 10
    if elo >= 1751:
        return 9
    if elo >= 1531:
        return 8
    if elo >= 1351:
        return 7
    if elo >= 1201:
        return 6
    if elo >= 1051:
        return 5
    if elo >= 901:
        return 4
    if elo >= 751:
        return 3
    if elo >= 501:
        return 2
    return 1


# ── Group results by runner ────────────────────────────────────────────

runner_ids = {r["id"] for r in all_runners}
results_by_runner = defaultdict(list)
for r in all_results:
    rid = r["runner_id"]
    if rid in runner_ids:
        results_by_runner[rid].append(r)

# ── Compute course records (best time per distance_category) ───────────

print("Computing course records...")
best_per_distance = {}  # distance -> best seconds
total_per_distance = defaultdict(list)  # distance -> list of seconds

for r in all_results:
    cat = r.get("distance_category")
    ct = r.get("chip_time")
    if not cat or not ct:
        continue
    secs = time_to_seconds(ct)
    if secs == float("inf"):
        continue
    total_per_distance[cat].append(secs)
    if cat not in best_per_distance or secs < best_per_distance[cat]:
        best_per_distance[cat] = secs

# Compute median per distance for normalization
median_per_distance = {}
for cat, times in total_per_distance.items():
    times.sort()
    n = len(times)
    if n == 0:
        continue
    median_per_distance[cat] = times[n // 2]

print(f"  {len(best_per_distance)} distance categories with records")

# ── Global stats for normalization ─────────────────────────────────────

# Max podiums any runner has
max_podiums_global = 0
max_races_per_year_global = 0
max_distances_global = 0
max_years_global = 0

runner_stats = {}  # runner_id -> dict of raw stats

for rid, results in results_by_runner.items():
    years = set()
    distances = set()
    podiums = 0
    best_times = {}  # distance -> best seconds

    for r in results:
        cat = r.get("distance_category", "")
        eid = r.get("event_id")
        year = event_year.get(eid)
        if year:
            years.add(year)
        if cat:
            distances.add(cat)
        place = r.get("place")
        if place is not None and place <= 3:
            podiums += 1
        ct = r.get("chip_time")
        if ct and cat:
            secs = time_to_seconds(ct)
            if secs < float("inf"):
                if cat not in best_times or secs < best_times[cat]:
                    best_times[cat] = secs

    n_years = len(years)
    n_distances = len(distances)
    races_per_year = len(results) / max(n_years, 1)

    runner_stats[rid] = {
        "years": n_years,
        "distances": n_distances,
        "podiums": podiums,
        "races_per_year": races_per_year,
        "total_races": len(results),
        "best_times": best_times,
    }

    max_podiums_global = max(max_podiums_global, podiums)
    max_races_per_year_global = max(max_races_per_year_global, races_per_year)
    max_distances_global = max(max_distances_global, n_distances)
    max_years_global = max(max_years_global, n_years)

print(f"\nGlobal maxes:")
print(f"  Max podiums:        {max_podiums_global}")
print(f"  Max races/year:     {max_races_per_year_global:.1f}")
print(f"  Max distances:      {max_distances_global}")
print(f"  Max years active:   {max_years_global}")

# ── Calculate ELO for each runner ──────────────────────────────────────

print("\nCalculating ELO scores...")

elo_results = []  # (runner_id, elo_score, elo_level)

for rid in runner_ids:
    stats = runner_stats.get(rid)
    if not stats or stats["total_races"] == 0:
        elo_results.append((rid, 100, 1))
        continue

    # ── 1. Time performance (40%) ──
    # For each distance the runner has run, compare their best time to the
    # course record. Use the best ratio across all distances.
    time_scores = []
    for cat, runner_secs in stats["best_times"].items():
        record_secs = best_per_distance.get(cat)
        median_secs = median_per_distance.get(cat)
        if not record_secs or not median_secs or record_secs == 0:
            continue
        # Ratio: 1.0 = course record, 0.0 = at or worse than median
        # Use log scale for more granular separation at the top
        if runner_secs <= record_secs:
            score = 1.0
        elif runner_secs >= median_secs:
            # Below median gets a small score based on how far below
            score = max(0.0, 0.3 * (median_secs / runner_secs))
        else:
            # Between record and median — linear interpolation
            score = 0.3 + 0.7 * (median_secs - runner_secs) / (median_secs - record_secs)
        time_scores.append(score)

    # Take the best score across distances (rewarding specialization)
    time_perf = max(time_scores) if time_scores else 0.0

    # ── 2. Consistency (20%) ──
    # Races per active year, capped at 5 races/year = perfect score
    consistency = min(stats["races_per_year"] / 5.0, 1.0)

    # ── 3. Versatility (15%) ──
    # Unique distances, capped at 4 = perfect score
    versatility = min(stats["distances"] / 4.0, 1.0)

    # ── 4. Podium finishes (15%) ──
    # Use sqrt scaling — diminishing returns. Cap at 10 podiums = 1.0
    podium_score = min(math.sqrt(stats["podiums"] / 10.0), 1.0)

    # ── 5. Years active (10%) ──
    # Cap at 5 years = perfect score
    years_score = min(stats["years"] / 5.0, 1.0)

    # ── Composite raw score (0.0 – 1.0) ──
    raw = (
        time_perf * 0.40
        + consistency * 0.20
        + versatility * 0.15
        + podium_score * 0.15
        + years_score * 0.10
    )

    # ── Map to ELO range (100 – 2500) ──
    # Use a curve that spreads out the top end more
    # raw^0.7 gives more separation at higher skill levels
    curved = raw ** 0.7
    elo = int(100 + curved * 2400)
    elo = max(100, min(elo, 2500))

    level = get_level(elo)
    elo_results.append((rid, elo, level))

# ── Sort and identify top 1000 (Challenger) ────────────────────────────

elo_results.sort(key=lambda x: x[1], reverse=True)

print(f"\nELO distribution:")
level_counts = defaultdict(int)
for _, elo, level in elo_results:
    level_counts[level] += 1
for lvl in sorted(level_counts):
    print(f"  Level {lvl:2d}: {level_counts[lvl]:6d} runners")

print(f"\nTop 20 runners:")
for i, (rid, elo, level) in enumerate(elo_results[:20]):
    name = next((r["full_name"] for r in all_runners if r["id"] == rid), "?")
    stats = runner_stats.get(rid, {})
    print(f"  {i+1:3d}. {name:40s}  ELO={elo:4d}  Lvl={level:2d}  "
          f"races={stats.get('total_races', 0)}  podiums={stats.get('podiums', 0)}")

# ── Write back to database ─────────────────────────────────────────────

print(f"\nUpdating {len(elo_results)} runners in database...")
now = datetime.now(timezone.utc).isoformat()

import time

# Build upsert rows — each row needs full required fields for upsert
# Instead, update in batches grouped by level (only 10 groups)
# For each level, update all runners at once using .in_()

# Group by level for fewer API calls
level_groups = defaultdict(list)
for rid, elo, level in elo_results:
    level_groups[level].append((rid, elo))

CHUNK = 300  # IDs per request
updated = 0

for level in sorted(level_groups.keys()):
    runners_in_level = level_groups[level]
    print(f"  Level {level}: {len(runners_in_level)} runners")

    # For each level, we still need per-runner elo_score, so group by elo_score
    elo_groups = defaultdict(list)
    for rid, elo in runners_in_level:
        elo_groups[elo].append(rid)

    for elo, ids in elo_groups.items():
        for i in range(0, len(ids), CHUNK):
            chunk = ids[i : i + CHUNK]
            retries = 3
            for attempt in range(retries):
                try:
                    client.table("runners").update({
                        "elo_score": elo,
                        "elo_level": level,
                        "elo_updated_at": now,
                    }).in_("id", chunk).execute()
                    break
                except Exception as e:
                    if attempt < retries - 1:
                        time.sleep(3 * (attempt + 1))
                    else:
                        print(f"  FAILED after {retries} attempts for elo={elo}: {e}")
            updated += len(chunk)
            time.sleep(0.15)  # Rate limit: ~6 req/s

    print(f"    Updated {updated}/{len(elo_results)} so far")

print(f"  Updated {updated} runners.")
print("\nDone!")
