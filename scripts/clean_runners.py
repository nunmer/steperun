"""
Clean up bad runner entries:
  - HIDE: relay team blobs (long names, colons, commas, quoted team names)
  - DELETE: pure-number entries like "1098 1098"
"""

import os, re
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parent.parent / ".env")  # repo-root .env
client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

print("Fetching runners...")
PAGE = 1000
all_runners = []
last_id = 0
while True:
    # Keyset pagination: OFFSET would rescan all earlier rows on every page.
    resp = (
        client.table("runners")
        .select("id, full_name, is_hidden")
        .gt("id", last_id)
        .order("id")
        .limit(PAGE)
        .execute()
    )
    batch = resp.data or []
    all_runners.extend(batch)
    if len(batch) < PAGE:
        break
    last_id = batch[-1]["id"]

print(f"Total runners: {len(all_runners)}")


def is_number_junk(name: str) -> bool:
    """Pure numeric entries — safe to delete. e.g. '1098 1098', '1301 1301'"""
    n = name.strip()
    return bool(re.match(r'^\d[\d\s]+$', n))


def is_relay_team(name: str) -> bool:
    """Relay/staffeta team blobs — hide, not delete."""
    n = name.strip()
    if len(n) > 80:                            return True  # team + member list
    if ':' in n:                               return True  # "Team: Name1, Name2"
    if ',' in n:                               return True  # multiple people
    if n and n[0] in ('«', '"', "'", '»', '„'): return True  # quoted team name
    return False


to_delete = [r for r in all_runners if is_number_junk(r["full_name"])]
to_hide   = [
    r for r in all_runners
    if not r.get("is_hidden")  # already hidden — skip the write
    and not is_number_junk(r["full_name"])
    and is_relay_team(r["full_name"])
]

print(f"\nTo DELETE (numbers):    {len(to_delete)}")
print(f"To HIDE  (relay teams): {len(to_hide)}")

CHUNK = 200

# --- DELETE number junk ---
delete_ids = [r["id"] for r in to_delete]
print(f"\nDeleting {len(delete_ids)} number entries...")
deleted = 0
for i in range(0, len(delete_ids), CHUNK):
    chunk = delete_ids[i : i + CHUNK]
    client.table("runners").delete().in_("id", chunk).execute()
    deleted += len(chunk)
print(f"  Deleted {deleted}")

# --- HIDE relay teams ---
hide_ids = [r["id"] for r in to_hide]
print(f"Hiding {len(hide_ids)} relay team entries...")
hidden = 0
for i in range(0, len(hide_ids), CHUNK):
    chunk = hide_ids[i : i + CHUNK]
    client.table("runners").update({"is_hidden": True}).in_("id", chunk).execute()
    hidden += len(chunk)
print(f"  Hidden {hidden}")

# --- REMOVE team / relay results ---
# A team result is not one runner's result: "Open Team 5" entries are team
# names ("Siemens", "101 АЛМАТИНЕЦ") or a captain's name, and relays are team
# blobs. Delete those results, then delete runners left with no results
# (a captain keeps their profile and individual races). Claimed runners are
# never deleted.
TEAM_CATEGORY = re.compile(r"\bteam\b|команд|эстафет|relay", re.IGNORECASE)
cats = client.rpc("get_distance_options").execute().data or []
team_cats = [c["distance_category"] for c in cats if TEAM_CATEGORY.search(c["distance_category"] or "")]
# get_distance_options only counts finishers; include DNF-only relay categories too
team_cats += [c for c in ("21 км 97,5 м Эстафета", "Эстафета Copa Run") if c not in team_cats]
print(f"\nTeam/relay categories: {team_cats}")

affected: set[int] = set()
removed = 0
for cat in team_cats:
    while True:
        rows = (
            client.table("results").select("id, runner_id")
            .eq("distance_category", cat).limit(CHUNK).execute()
        ).data or []
        if not rows:
            break
        affected.update(r["runner_id"] for r in rows)
        client.table("results").delete().in_("id", [r["id"] for r in rows]).execute()
        removed += len(rows)
print(f"  Removed {removed} team/relay results")

orphans = []
ids = sorted(affected)
for i in range(0, len(ids), CHUNK):
    chunk = ids[i : i + CHUNK]
    still = {
        r["runner_id"] for r in
        (client.table("results").select("runner_id").in_("runner_id", chunk).execute().data or [])
    }
    unclaimed = {
        r["id"] for r in
        (client.table("runners").select("id, claimed_by").in_("id", chunk).execute().data or [])
        if not r["claimed_by"]
    }
    orphans += [rid for rid in chunk if rid not in still and rid in unclaimed]
for i in range(0, len(orphans), CHUNK):
    client.table("runners").delete().in_("id", orphans[i : i + CHUNK]).execute()
print(f"  Deleted {len(orphans)} team runners with no other results")

print("\nDone.")
