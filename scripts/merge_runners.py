#!/usr/bin/env python3
"""
Merge a duplicate runner profile into another (same person, two rows).

Moves every result from --drop to --keep, then deletes the --drop runner.
Dry run unless --apply is given.

Refuses when:
  - --drop is claimed by a different user than --keep
  - both runners have a result in the same event and distance (true clash)

Usage:
    python scripts/merge_runners.py --keep 26194 --drop 233970          # dry run
    python scripts/merge_runners.py --keep 26194 --drop 233970 --apply

After --apply the site cache is purged (needs REVALIDATE_SECRET in .env);
recalculate ELO with scripts/calculate_elo.py.
"""

import argparse
import os
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from scraper.db import get_client  # noqa: E402


def _runner(client, runner_id: int) -> dict:
    rows = client.table("runners").select("*").eq("id", runner_id).execute().data
    if not rows:
        sys.exit(f"Runner {runner_id} not found")
    return rows[0]


def _results(client, runner_id: int) -> list[dict]:
    return (
        client.table("results")
        .select("id, event_id, distance_category, chip_time, events(slug)")
        .eq("runner_id", runner_id)
        .execute()
    ).data or []


def purge_site_cache() -> None:
    """POST /api/revalidate so the merged profile shows immediately."""
    secret = os.getenv("REVALIDATE_SECRET")
    if not secret:
        print("REVALIDATE_SECRET not set: site shows the change within an hour.")
        return
    req = urllib.request.Request(
        "https://www.steppe.run/api/revalidate", method="POST",
        headers={"Authorization": f"Bearer {secret}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print("Site cache purged:", resp.status)
    except OSError as exc:
        print(f"Cache purge failed ({exc}); site shows the change within an hour.")


def main() -> int:
    ap = argparse.ArgumentParser(description="Merge a duplicate runner into another")
    ap.add_argument("--keep", type=int, required=True, help="runner id to keep")
    ap.add_argument("--drop", type=int, required=True, help="duplicate runner id to merge and delete")
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = ap.parse_args()
    if args.keep == args.drop:
        sys.exit("--keep and --drop must differ")

    client = get_client()
    keep, drop = _runner(client, args.keep), _runner(client, args.drop)
    print(f"keep {keep['id']}: {keep['full_name']} | {keep['country']} | {keep['city']} | claimed_by={keep['claimed_by']}")
    print(f"drop {drop['id']}: {drop['full_name']} | {drop['country']} | {drop['city']} | claimed_by={drop['claimed_by']}")

    if drop["claimed_by"] and drop["claimed_by"] != keep["claimed_by"]:
        sys.exit("Refusing: --drop is claimed by a different user")

    keep_slots = {(r["event_id"], r["distance_category"]) for r in _results(client, keep["id"])}
    moving = _results(client, drop["id"])
    clashes = [r for r in moving if (r["event_id"], r["distance_category"]) in keep_slots]
    if clashes:
        for r in clashes:
            print(f"  clash: {r['events']['slug']} {r['distance_category']}")
        sys.exit("Refusing: both runners have a result in the same event and distance")

    for r in moving:
        print(f"  move result {r['id']}: {r['events']['slug']} {r['distance_category']} {r['chip_time']}")

    if not args.apply:
        print("Dry run. Re-run with --apply to merge.")
        return 0

    if moving:
        client.table("results").update({"runner_id": keep["id"]}).eq("runner_id", drop["id"]).execute()
    left = _results(client, drop["id"])
    if left:
        sys.exit(f"{len(left)} results still on {drop['id']}; runner not deleted")
    client.table("runners").delete().eq("id", drop["id"]).execute()
    print(f"Merged {len(moving)} result(s) into {keep['id']} and deleted runner {drop['id']}.")
    purge_site_cache()
    return 0


if __name__ == "__main__":
    sys.exit(main())
