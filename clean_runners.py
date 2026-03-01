"""
Clean up bad runner entries:
  - HIDE: relay team blobs (long names, colons, commas, quoted team names)
  - DELETE: pure-number entries like "1098 1098"
"""

import os, re
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

print("Fetching runners...")
PAGE = 1000
offset = 0
all_runners = []
while True:
    resp = client.table("runners").select("id, full_name").range(offset, offset + PAGE - 1).execute()
    batch = resp.data or []
    all_runners.extend(batch)
    if len(batch) < PAGE:
        break
    offset += PAGE

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
to_hide   = [r for r in all_runners if not is_number_junk(r["full_name"]) and is_relay_team(r["full_name"])]

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

print("\nDone.")
