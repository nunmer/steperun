"""
Main scraper for almaty-marathon.kz results.

Flow:
  1. Fetch /ru/results/ → list of all event slugs
  2. For each event (skip already-scraped and cycling):
     a. Fetch event page → detect distance categories via <select ?d=VALUE>
     b. For each category, scrape all pages using ?d=VALUE&Results_page=N
     c. Upsert runners + results into Supabase in batches
"""

import os
import re
import time
import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from .db import (
    get_client,
    upsert_event,
    mark_event_scraped,
    get_scraped_slugs,
    upsert_runner,
    upsert_results_batch,
)
from .parser import (
    detect_categories,
    count_pages,
    parse_results_table,
    CategoryInfo,
    ResultRow,
)

log = logging.getLogger(__name__)

BASE_URL   = "https://almaty-marathon.kz"
INDEX_URL  = f"{BASE_URL}/ru/results/"
DELAY      = float(os.getenv("SCRAPER_DELAY", "0.6"))
BATCH_SIZE = int(os.getenv("SCRAPER_BATCH_SIZE", "50"))

# Slugs containing these keywords are skipped (cycling, standalone swim)
SKIP_KEYWORDS = [
    "velo", "velogonka", "bike", "cycling",
    "zaplyiv", "swim_race", "swim_2",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
}


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _get(url: str, params: Optional[dict] = None) -> str:
    for attempt in range(3):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            # Let requests auto-detect encoding from the response;
            # fall back to UTF-8 if detection fails
            if resp.encoding is None or resp.encoding.lower() in ("iso-8859-1", "latin-1"):
                resp.encoding = resp.apparent_encoding or "utf-8"
            return resp.text
        except requests.RequestException as exc:
            wait = 2 ** attempt * 2
            log.warning("Request failed (%s) – retrying in %ss", exc, wait)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {url} after 3 attempts")


# ---------------------------------------------------------------------------
# Event list
# ---------------------------------------------------------------------------

def fetch_event_list() -> list[dict]:
    """
    Returns list of dicts: {slug, name, year, url}
    Parses the main /ru/results/ index page.
    """
    html = _get(INDEX_URL)
    soup = BeautifulSoup(html, "lxml")
    events: list[dict] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        m = re.match(r"^/ru/results/([^/?#]+)/?$", href)
        if not m:
            continue
        slug = m.group(1)
        if slug in seen or not slug:
            continue
        seen.add(slug)

        if any(kw in slug.lower() for kw in SKIP_KEYWORDS):
            log.info("Skipping (cycling/swim): %s", slug)
            continue

        name = a.get_text(strip=True) or slug
        events.append({
            "slug": slug,
            "name": name,
            "year": _extract_year(slug, name),
            "url":  BASE_URL + href.rstrip("/"),
        })

    log.info("Found %d scrapable events on index page", len(events))
    return events


def _extract_year(slug: str, name: str) -> Optional[int]:
    for text in (slug, name):
        m = re.search(r"(20\d{2})", text)
        if m:
            return int(m.group(1))
    return None


# ---------------------------------------------------------------------------
# Per-event scraping
# ---------------------------------------------------------------------------

def scrape_event(event: dict, client) -> int:
    """Scrape all results for one event. Returns total rows upserted."""
    slug = event["slug"]
    url  = event["url"]
    log.info("── Scraping: %s", slug)

    event_id = upsert_event(client, slug, event["name"], event["year"], url)

    # Fetch landing page
    html = _get(url)

    # Detect distance categories
    categories = detect_categories(html)

    if not categories:
        # Single-category event (e.g. winter_run_2026 with only one distance)
        categories = [CategoryInfo(value="", label="General")]
        log.info("  Single-category event")
    else:
        log.info("  %d categories: %s", len(categories),
                 [c.label for c in categories])

    total = 0
    for cat in categories:
        total += _scrape_category(url, cat, event_id, client, first_page_html=html if not cat.value else None)

    mark_event_scraped(client, event_id, total)
    log.info("  Done: %d rows for %s", total, slug)
    return total


def _scrape_category(
    event_url: str,
    cat: CategoryInfo,
    event_id: int,
    client,
    first_page_html: Optional[str] = None,
) -> int:
    """Scrape all pages of one distance category. Returns rows upserted."""
    base_params = {"d": cat.value} if cat.value else {}

    # Page 1 — reuse already-fetched HTML when possible
    if first_page_html is not None:
        html = first_page_html
    else:
        html = _get(event_url, params=base_params)
        time.sleep(DELAY)

    total_pages = count_pages(html)
    log.info("    %-30s  pages: %d", cat.label, total_pages)

    rows = parse_results_table(html, cat.label)
    inserted = _flush(rows, event_id, client)

    # Pages 2..N
    for page in range(2, total_pages + 1):
        params = {**base_params, "Results_page": page}
        page_html = _get(event_url, params=params)
        rows = parse_results_table(page_html, cat.label)
        if not rows:
            log.debug("    No rows on page %d – stopping early", page)
            break
        inserted += _flush(rows, event_id, client)
        log.debug("    page %d/%d → %d rows", page, total_pages, len(rows))
        time.sleep(DELAY)

    return inserted


# ---------------------------------------------------------------------------
# DB flush
# ---------------------------------------------------------------------------

def _flush(rows: list[ResultRow], event_id: int, client) -> int:
    """Upsert runners + results. Returns count of result rows inserted."""
    batch: list[dict] = []
    inserted = 0

    for row in rows:
        name = row.full_name.strip()
        if not name or name.lower() in ("фио", "name", "участник", "runner"):
            continue
        try:
            runner_id = upsert_runner(client, name, row.country, row.city)
        except Exception as exc:
            log.warning("Runner upsert failed for %r: %s", name, exc)
            continue

        batch.append({
            "runner_id":         runner_id,
            "event_id":          event_id,
            "bib_number":        row.bib_number or None,
            "distance_category": row.distance_category or None,
            "place":             row.place,
            "checkpoint_times":  row.checkpoint_times or None,
            "finish_time":       row.finish_time or None,
            "chip_time":         row.chip_time or None,
        })

        if len(batch) >= BATCH_SIZE:
            upsert_results_batch(client, batch)
            inserted += len(batch)
            batch = []

    if batch:
        upsert_results_batch(client, batch)
        inserted += len(batch)

    return inserted


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run(resume: bool = True):
    """
    Scrape all events.

    Args:
        resume: Skip events already marked scraped_at IS NOT NULL.
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%H:%M:%S",
    )

    client = get_client()

    done = get_scraped_slugs(client) if resume else set()
    if done:
        log.info("Resuming – %d events already scraped", len(done))

    events = fetch_event_list()
    grand_total = 0

    for i, event in enumerate(events, 1):
        slug = event["slug"]
        if slug in done:
            log.info("[%d/%d] Already done: %s", i, len(events), slug)
            continue
        log.info("[%d/%d] %s", i, len(events), slug)
        try:
            grand_total += scrape_event(event, client)
        except Exception as exc:
            log.error("Failed on %s: %s", slug, exc, exc_info=True)

    log.info("═══ Grand total rows: %d ═══", grand_total)
