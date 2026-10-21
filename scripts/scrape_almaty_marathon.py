#!/usr/bin/env python3
"""
Entry point for the Almaty Marathon scraper.

Usage:
    python scripts/scrape_almaty_marathon.py              # scrape all events (skipping already-done)
    python scripts/scrape_almaty_marathon.py --full       # re-scrape everything from scratch
    python scripts/scrape_almaty_marathon.py --event winter_run_2026   # scrape one specific event
    python scripts/scrape_almaty_marathon.py --min-year 2025           # only events from 2025 onward (daily cron)
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Scripts live in scripts/; the .env and the scraper package are at the repo root.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

# Validate env vars before importing anything that uses them
_missing = [v for v in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY") if not os.getenv(v)]
if _missing:
    print(f"ERROR: Missing environment variables: {', '.join(_missing)}")
    print("Copy .env.example to .env and fill in your Supabase credentials.")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Scrape Almaty Marathon results into Supabase")
    parser.add_argument("--full",  action="store_true", help="Re-scrape all events, ignoring resume state")
    parser.add_argument("--event", metavar="SLUG",      help="Scrape only this one event slug")
    parser.add_argument("--min-year", type=int, metavar="YEAR",
                        help="Only scrape events from this year onward (skips events with unknown year)")
    args = parser.parse_args()

    from scraper.scraper import run, scrape_event, fetch_event_list
    from scraper.db import get_client, upsert_event

    if args.event:
        # Single-event mode
        client = get_client()
        events = fetch_event_list()
        match = next((e for e in events if e["slug"] == args.event), None)
        if match is None:
            # Build a minimal event dict from the slug
            slug = args.event
            match = {
                "slug": slug,
                "name": slug.replace("_", " ").title(),
                "year": None,
                "url": f"https://almaty-marathon.kz/ru/results/{slug}",
            }
        total = scrape_event(match, client)
    else:
        total = run(resume=not args.full, min_year=args.min_year)

    _write_github_output(total)


def _write_github_output(total: int) -> None:
    """Expose row count to GitHub Actions so later steps can skip when nothing is new."""
    output_path = os.getenv("GITHUB_OUTPUT")
    if not output_path:
        return
    with open(output_path, "a", encoding="utf-8") as f:
        f.write(f"new_results={total}\n")


if __name__ == "__main__":
    main()
