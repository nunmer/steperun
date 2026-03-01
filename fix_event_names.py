"""
Fix event names by deriving them from slugs.
e.g. "winter_run_2026" → "Winter Run 2026"
"""

import re
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# Word substitutions for transliterated / concatenated slugs
SUBS = {
    "halfmarathon":   "Half Marathon",
    "halfmarafon":    "Half Marathon",
    "polumarafon":    "Half Marathon",
    "marafon":        "Marathon",
    "zabeg":          "Run",
    "zabegi":         "Run",
    "zimniy":         "Winter",
    "vesenniy":       "Spring",
    "letniy":         "Summer",
    "jenskiy":        "Women's",
    "detskiy":        "Kids",
    "kidsrace":       "Kids Race",
    "velogonka":      "Bike Race",
    "zaplyiv":        "Swim Race",
    "almatynskiy":    "Almaty",
    "almatyi":        "Almaty",
    "almatinskiy":    "Almaty",
    "nur":            "Nur",
    "sultan":        "Sultan",
    "ekiden":         "Ekiden",
    "tour":           "Tour",
    "virtual":        "Virtual",
    "online":         "Online",
    "swim":           "Swim",
    "race":           "Race",
    "run":            "Run",
    "relay":          "Relay",
    "week":           "Week",
}


def slug_to_name(slug: str) -> str:
    # Insert space before a 4-digit year if no underscore separates them
    slug = re.sub(r"([a-z])(\d{4})$", r"\1_\2", slug)

    # Split on underscores
    words = slug.split("_")

    result = []
    for word in words:
        lower = word.lower()
        if lower in SUBS:
            result.append(SUBS[lower])
        elif word.isdigit():
            result.append(word)
        else:
            result.append(word.capitalize())

    return " ".join(result)


# Fetch all events
resp = client.table("events").select("id, slug, name").execute()
events = resp.data

updates = []
for e in events:
    new_name = slug_to_name(e["slug"])
    updates.append((e["id"], e["slug"], new_name))
    print(f"  {e['slug']:<45s} -> {new_name}")

print(f"\nApplying {len(updates)} updates...")
for event_id, slug, new_name in updates:
    client.table("events").update({"name": new_name}).eq("id", event_id).execute()

print(f"Done. Updated {len(updates)} events.")
