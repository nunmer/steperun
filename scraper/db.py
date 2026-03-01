"""
Supabase database operations for the Almaty Marathon scraper.
Handles upserts for events, runners, and results with batching.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional
from supabase import create_client, Client

log = logging.getLogger(__name__)


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

def upsert_event(client: Client, slug: str, name: str, year: int, url: str) -> int:
    """Insert or update an event. Returns the event id."""
    resp = (
        client.table("events")
        .upsert({"slug": slug, "name": name, "year": year, "url": url},
                on_conflict="slug")
        .execute()
    )
    return resp.data[0]["id"]


def mark_event_scraped(client: Client, event_id: int, total: int):
    client.table("events").update({
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "total_results": total,
    }).eq("id", event_id).execute()


def get_scraped_slugs(client: Client) -> set[str]:
    """Return slugs of events that have already been scraped."""
    resp = (
        client.table("events")
        .select("slug")
        .not_.is_("scraped_at", "null")
        .execute()
    )
    return {row["slug"] for row in resp.data}


# ---------------------------------------------------------------------------
# Runners
# ---------------------------------------------------------------------------

def upsert_runner(client: Client, full_name: str, country: Optional[str], city: Optional[str]) -> int:
    """Get or create a runner. Returns runner id."""
    resp = (
        client.table("runners")
        .upsert(
            {"full_name": full_name, "country": country or "", "city": city or ""},
            on_conflict="full_name,country,city",
        )
        .execute()
    )
    return resp.data[0]["id"]


# ---------------------------------------------------------------------------
# Results (bulk)
# ---------------------------------------------------------------------------

def upsert_results_batch(client: Client, rows: list[dict]):
    """
    Upsert a batch of result rows.

    Each dict must have keys:
        runner_id, event_id, bib_number, distance_category,
        place, checkpoint_times, finish_time, chip_time
    """
    if not rows:
        return
    client.table("results").upsert(
        rows,
        on_conflict="event_id,bib_number,distance_category",
    ).execute()
    log.debug("Upserted %d result rows", len(rows))
