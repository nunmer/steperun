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

def upsert_event(client: Client, slug: str, name: str, year: int, url: str, organizer: str) -> int:
    """Insert or update an event. Returns the event id."""
    resp = (
        client.table("events")
        .upsert({"slug": slug, "name": name, "year": year, "url": url, "organizer": organizer},
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
    """
    Return slugs of events already scraped *with results*.

    Events scraped while their results page was still empty (total_results
    0/NULL) are left out, so the next run picks them up once results appear.
    """
    resp = (
        client.table("events")
        .select("slug")
        .not_.is_("scraped_at", "null")
        .gt("total_results", 0)
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


RunnerKey = tuple[str, str, str]  # (full_name, country, city) — matches the unique index


def get_or_create_runners(client: Client, keys: list[RunnerKey]) -> dict[RunnerKey, int]:
    """
    Resolve many runners in two requests: one SELECT for existing rows, one
    INSERT for the missing ones. Avoids a write per result row — existing
    runners are never rewritten.
    """
    unique_keys = list(dict.fromkeys(keys))
    if not unique_keys:
        return {}

    # postgrest-py does not escape quotes/backslashes inside in_() values,
    # so resolve those (rare) names one at a time via the single-row upsert.
    ids: dict[RunnerKey, int] = {}
    simple_keys: list[RunnerKey] = []
    for key in unique_keys:
        if '"' in key[0] or "\\" in key[0]:
            ids[key] = upsert_runner(client, *key)
        else:
            simple_keys.append(key)
    if not simple_keys:
        return ids

    names = list({k[0] for k in simple_keys})
    resp = (
        client.table("runners")
        .select("id, full_name, country, city")
        .in_("full_name", names)
        .execute()
    )
    for r in resp.data:
        ids[(r["full_name"], r["country"] or "", r["city"] or "")] = r["id"]

    missing = [k for k in simple_keys if k not in ids]
    if missing:
        created = (
            client.table("runners")
            .upsert(
                [{"full_name": n, "country": c, "city": ci} for n, c, ci in missing],
                on_conflict="full_name,country,city",
            )
            .execute()
        )
        for r in created.data:
            ids[(r["full_name"], r["country"] or "", r["city"] or "")] = r["id"]

    return ids


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
