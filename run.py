#!/usr/bin/env python3
"""
Entry point for the Almaty Marathon scraper.

Usage:
    python run.py              # scrape all events (skipping already-done)
    python run.py --full       # re-scrape everything from scratch
    python run.py --event winter_run_2026   # scrape one specific event
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).parent / ".env")

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
        scrape_event(match, client)
    else:
        run(resume=not args.full)


if __name__ == "__main__":
    main()
