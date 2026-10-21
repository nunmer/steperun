#!/usr/bin/env python3
"""
Import athletex.kz race results (Wiclax .clax files on live.myrace.info).

Usage:
    python run_athletex.py                         # current season, new events only
    python run_athletex.py --min-year 2025         # skip events before 2025
    python run_athletex.py --backfill --min-year 2023   # also look for past seasons
"""

import argparse
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

_missing = [v for v in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY") if not os.getenv(v)]
if _missing:
    print(f"ERROR: Missing environment variables: {', '.join(_missing)}")
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import athletex.kz results into Supabase")
    parser.add_argument("--min-year", type=int, default=datetime.now().year - 1,
                        help="Only import events from this year onward (default: last year)")
    parser.add_argument("--backfill", action="store_true",
                        help="Also check past seasons of each listed competition")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%H:%M:%S",
    )

    from scraper.athletex import run
    from scraper.db import get_client

    total = run(get_client(), min_year=args.min_year, backfill=args.backfill)

    output_path = os.getenv("GITHUB_OUTPUT")
    if output_path:
        with open(output_path, "a", encoding="utf-8") as f:
            f.write(f"new_results={total}\n")


if __name__ == "__main__":
    main()
