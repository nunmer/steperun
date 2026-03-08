"""
Scrape event dates from almaty-marathon.kz and update the events table.

Reads event URLs from the database, fetches each page, extracts the date
(e.g. "16 Ноября") from under the event name, converts to YYYY-MM-DD,
and updates the date_of_event column.

Usage:
    python scrape_dates.py
"""

import os
import re
import time
import logging

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
}

DELAY = float(os.getenv("SCRAPER_DELAY", "0.6"))

# Russian month names → month number
MONTHS_RU = {
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4,
    "мая": 5, "июня": 6, "июля": 7, "августа": 8,
    "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12,
}


def fetch(url: str) -> str:
    for attempt in range(3):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            if resp.encoding is None or resp.encoding.lower() in ("iso-8859-1", "latin-1"):
                resp.encoding = resp.apparent_encoding or "utf-8"
            return resp.text
        except requests.RequestException as exc:
            wait = 2 ** attempt * 2
            log.warning("Request failed (%s) – retrying in %ss", exc, wait)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {url} after 3 attempts")


def extract_date(html: str, year: int | None) -> str | None:
    """
    Extract date from the event page.
    Looks for patterns like "15 февраля" or "29 сентября" near the top.
    Returns YYYY-MM-DD or None.
    """
    soup = BeautifulSoup(html, "lxml")

    # Get all text near the top of the page
    text = soup.get_text(separator="\n")

    # Match "DD month" pattern (Russian genitive month names)
    months_pattern = "|".join(MONTHS_RU.keys())
    pattern = rf"(\d{{1,2}})\s+({months_pattern})"
    match = re.search(pattern, text, re.IGNORECASE)

    if not match:
        return None

    day = int(match.group(1))
    month_name = match.group(2).lower()
    month = MONTHS_RU.get(month_name)

    if not month:
        return None

    # Use the event's year, fall back to current year
    y = year or 2025

    return f"{y:04d}-{month:02d}-{day:02d}"


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%H:%M:%S",
    )

    client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )

    # Fetch all events that have URLs
    resp = (
        client.table("events")
        .select("id, slug, url, year")
        .not_.is_("url", "null")
        .not_.is_("scraped_at", "null")
        .order("id")
        .execute()
    )
    events = resp.data
    log.info("Found %d events to process", len(events))

    updated = 0
    failed = 0

    for i, event in enumerate(events, 1):
        slug = event["slug"]
        url = event["url"]
        year = event.get("year")

        log.info("[%d/%d] %s", i, len(events), slug)

        try:
            html = fetch(url)
            date_str = extract_date(html, year)

            if date_str:
                client.table("events").update(
                    {"date_of_event": date_str}
                ).eq("id", event["id"]).execute()
                log.info("  → %s", date_str)
                updated += 1
            else:
                log.warning("  → No date found")
                failed += 1

        except Exception as exc:
            log.error("  → Error: %s", exc)
            failed += 1

        time.sleep(DELAY)

    log.info("Done: %d updated, %d failed", updated, failed)


if __name__ == "__main__":
    main()
