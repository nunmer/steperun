#!/usr/bin/env python3
"""
Find and merge duplicate runner profiles (same person, several rows).

Duplicates appear because almaty-marathon.kz identity is the exact
(full_name, country, city) string ("Алматы" vs "Almaty", Cyrillic vs Latin
name, name order), and the athletex matcher refuses ambiguous matches.

A group is the same person when ALL of these hold:
  - same folded name tokens, any order, any alphabet (scraper.names.fold)
  - same non-blank city (city_key, aliases folded)
  - no two profiles in the group finished the same event
  - best times on any shared distance are within 35% of each other
  - claimed by at most one user (that profile is kept; else the oldest id)
Country is ignored: nearly everyone is "Kazakhstan".

Dry run by default. --apply moves results, deletes the duplicates, writes a
log to data/merges/<date>.json (every moved result id and every deleted
runner row, enough to undo), awards claimed users their missing per-event
coins, and purges the site cache. Recalculate ELO afterwards.

Usage:
    python scripts/merge_duplicates.py            # report only
    python scripts/merge_duplicates.py --apply
"""

import argparse
import collections
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from scraper.db import get_client  # noqa: E402
from scraper.names import city_key, fold  # noqa: E402

MAX_PACE_RATIO = 1.35
EVENT_COINS = 20  # COIN_REWARDS.EVENT_PARTICIPATION in web/lib/services/coins.ts


def scan(client, table: str, cols: str, filt=lambda q: q) -> list[dict]:
    out, last = [], 0
    while True:
        rows = filt(client.table(table).select(cols)).gt("id", last).order("id").limit(1000).execute().data
        if not rows:
            return out
        out += rows
        last = rows[-1]["id"]


def seconds(t: str | None) -> float | None:
    if not t or not re.match(r"^\d+:\d\d:\d\d", t):
        return None
    h, m, s = t.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def name_tokens(name: str) -> tuple[str, ...]:
    return tuple(sorted(t for t in re.split(r"[^a-z0-9]+", fold(name)) if t))


def build_plan(runners: list[dict], results: list[dict]) -> tuple[list[dict], collections.Counter]:
    events_of: dict[int, set] = collections.defaultdict(set)
    best: dict[int, dict] = collections.defaultdict(dict)
    for r in results:
        events_of[r["runner_id"]].add(r["event_id"])
        s = seconds(r["chip_time"])
        if s:
            d = best[r["runner_id"]]
            d[r["distance_category"]] = min(d.get(r["distance_category"], float("inf")), s)

    groups: dict[tuple, list[dict]] = collections.defaultdict(list)
    for r in runners:
        tokens, city = name_tokens(r["full_name"]), city_key(r["city"])
        if len(tokens) >= 2 and city:
            groups[(tokens, city)].append(r)

    plan, skipped = [], collections.Counter()
    for members in groups.values():
        if len(members) < 2:
            continue
        ids = [m["id"] for m in members]
        pairs = [(a, b) for i, a in enumerate(ids) for b in ids[i + 1:]]
        if any(events_of[a] & events_of[b] for a, b in pairs):
            skipped["finished the same event (different people)"] += 1
            continue
        if len({m["claimed_by"] for m in members if m["claimed_by"]}) > 1:
            skipped["claimed by different users"] += 1
            continue
        ratios = [
            max(best[a][d], best[b][d]) / min(best[a][d], best[b][d])
            for a, b in pairs for d in set(best[a]) & set(best[b])
        ]
        if ratios and max(ratios) > MAX_PACE_RATIO:
            skipped[f"pace differs >{MAX_PACE_RATIO - 1:.0%} on a shared distance"] += 1
            continue
        keep = next((m for m in members if m["claimed_by"]), min(members, key=lambda m: m["id"]))
        plan.append({"keep": keep, "drop": [m for m in members if m["id"] != keep["id"]]})
    return plan, skipped


def merge_group(client, group: dict, results_of: dict[int, list[int]]) -> dict:
    keep, drop_ids = group["keep"], [d["id"] for d in group["drop"]]
    moved = [rid for d in drop_ids for rid in results_of.get(d, [])]
    entry = {"keep": keep["id"], "dropped": group["drop"], "moved_results": moved, "error": None}
    for attempt in range(4):  # the throttled DB drops connections now and then
        try:
            client.table("results").update({"runner_id": keep["id"]}).in_("runner_id", drop_ids).execute()
            client.table("runners").delete().in_("id", drop_ids).execute()
            entry["error"] = None
            break
        except Exception as exc:  # noqa: BLE001 — logged per group, the rest continue
            entry["error"] = str(exc)[:300]
            time.sleep(2 ** attempt)
    return entry


def award_missing_event_coins(client, log: list[dict], results: list[dict]) -> int:
    """Claimed keepers get +20 per event that arrived with the merged profiles."""
    event_of = {r["id"]: r["event_id"] for r in results}
    awarded = 0
    for e in log:
        uid = e.get("keep_claimed_by") or next(
            (d["claimed_by"] for d in e["dropped"] if d.get("claimed_by")), None)
        if not uid or e["error"]:
            continue
        for event_id in {event_of[r] for r in e["moved_results"] if r in event_of}:
            res = client.rpc("apply_coin_tx", {
                "p_user_id": uid, "p_amount": EVENT_COINS,
                "p_reason": "event_participation", "p_ref_id": event_id,
            }).execute().data
            awarded += (res or {}).get("status") == "ok"
    return awarded


def purge_site_cache() -> None:
    secret = os.getenv("REVALIDATE_SECRET")
    if not secret:
        print("REVALIDATE_SECRET not set: the site shows merges within an hour.")
        return
    req = urllib.request.Request(
        "https://www.steppe.run/api/revalidate", method="POST",
        headers={"Authorization": f"Bearer {secret}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        print("Site cache purged:", resp.status)


def main() -> int:
    ap = argparse.ArgumentParser(description="Find and merge duplicate runner profiles")
    ap.add_argument("--apply", action="store_true", help="merge (default: report only)")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    client = get_client()
    print("Loading runners and results…")
    runners = scan(client, "runners", "id, full_name, country, city, claimed_by, created_at",
                   lambda q: q.eq("is_hidden", False))
    results = scan(client, "results", "id, runner_id, event_id, distance_category, chip_time")
    plan, skipped = build_plan(runners, results)

    print(f"{len(plan)} groups to merge, {sum(len(g['drop']) for g in plan)} duplicate profiles")
    for reason, n in skipped.most_common():
        print(f"  skipped {n} groups: {reason}")
    for g in plan[:10]:
        print(f"  keep {g['keep']['id']} {g['keep']['full_name']!r} ({g['keep']['city']}) <- "
              + ", ".join(f"{d['id']} {d['full_name']!r}" for d in g["drop"]))
    if not args.apply:
        print("Dry run. Re-run with --apply to merge.")
        return 0

    results_of: dict[int, list[int]] = collections.defaultdict(list)
    for r in results:
        results_of[r["runner_id"]].append(r["id"])
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        log = list(pool.map(lambda g: merge_group(client, g, results_of), plan))
    for g, e in zip(plan, log):
        e["keep_claimed_by"] = g["keep"]["claimed_by"]

    out = ROOT / "data" / "merges" / f"{datetime.now(timezone.utc):%Y-%m-%d-%H%M}-runner-merges.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    failed = [e for e in log if e["error"]]
    print(f"Merged {len(log) - len(failed)} groups ({len(failed)} failed). Log: {out.relative_to(ROOT)}")
    for e in failed[:10]:
        print(f"  failed keep {e['keep']}: {e['error']}")
    print(f"Event coins awarded to claimed profiles: {award_missing_event_coins(client, log, results)}")
    purge_site_cache()
    return 0


if __name__ == "__main__":
    sys.exit(main())
