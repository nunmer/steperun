"""
athletex.kz source.

athletex.kz organises trail/road races across Kazakhstan; results are timed
with Wiclax and published as .clax files on live.myrace.info. Each
competition page links its file as
    https://live.myrace.info/?f=bases/kz/<year>/<folder>/<file>.clax

Discovery:
  - the athletex calendar lists the current season's competitions
  - with backfill, earlier seasons are found by swapping the year in each
    slug (IrbisRace2026 -> IrbisRace2025, rrautumn26 -> rrautumn25)

Events are stored with slug "athletex_<folder>" so they never collide with
almaty-marathon.kz slugs.
"""

import logging
import os
import re
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Optional

import requests

from .clax import ClaxEvent, ClaxResult, parse_clax
from .db import (
    get_or_create_runners,
    get_scraped_slugs,
    mark_event_scraped,
    upsert_event,
    upsert_results_batch,
)
from .names import display_city
from .runner_matcher import RunnerIndex

log = logging.getLogger(__name__)

SITE = "https://athletex.kz"
LIVE = "https://live.myrace.info"
DELAY = float(os.getenv("SCRAPER_DELAY", "0.6"))
BATCH_SIZE = int(os.getenv("SCRAPER_BATCH_SIZE", "50"))
SLUG_PREFIX = "athletex_"
ORGANIZER = "Athletex"  # Экстремальная атлетика (ИП ATHLETEX EVENTS)
ALMATY_TZ = timezone(timedelta(hours=5))

# Competition slugs that are never running events (XCO = cross-country MTB).
_SKIP_SLUG = re.compile(r"bike|velo|ski|xco|calendar", re.IGNORECASE)
_SLUG_LINK = re.compile(r"athletex\.kz/competitions/([A-Za-z0-9_-]+)")
_CLAX_LINK = re.compile(r"live\.myrace\.info/\?f=(bases/kz/(\d{4})/([A-Za-z0-9_-]+)/[A-Za-z0-9_.-]+\.clax)")
_YEAR_SUFFIX = re.compile(r"^(.*?)(20\d{2}|\d{2})$")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
}


@dataclass(frozen=True)
class ClaxSource:
    slug: str        # events.slug, e.g. "athletex_irbis2026"
    path: str        # "bases/kz/2026/irbis2026/air2026.clax"
    year: int
    page_url: str    # athletex competition page (stored as events.url)


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def _get(session: requests.Session, url: str) -> Optional[requests.Response]:
    """GET with retries; None on 4xx/5xx after retries (missing pages are normal)."""
    for attempt in range(3):
        try:
            resp = session.get(url, headers=HEADERS, timeout=40)
            time.sleep(DELAY)
            if resp.status_code == 200:
                return resp
            if resp.status_code in (404, 410) or 400 <= resp.status_code < 500:
                return None
        except requests.RequestException as exc:
            log.warning("GET %s failed (%s), attempt %d", url, exc, attempt + 1)
        time.sleep(2 * (attempt + 1))
    return None


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

def year_variants(slug: str, years: Iterable[int]) -> list[str]:
    """IrbisRace2026 -> [IrbisRace2025, ...]; rrautumn26 -> [rrautumn25, ...]."""
    m = _YEAR_SUFFIX.match(slug)
    if not m:
        return []
    base, suffix = m.groups()
    out = []
    for y in years:
        token = str(y) if len(suffix) == 4 else f"{y % 100:02d}"
        if token != suffix:
            out.append(base + token)
    return out


def clax_links(html: str) -> list[tuple[str, int, str]]:
    """All (path, year, folder) .clax references on a page, de-duplicated."""
    seen: dict[str, tuple[str, int, str]] = {}
    for path, year, folder in _CLAX_LINK.findall(html):
        seen.setdefault(path, (path, int(year), folder))
    return list(seen.values())


def discover(session: requests.Session, min_year: int, backfill: bool) -> list[ClaxSource]:
    slugs: set[str] = set()
    for listing in (f"{SITE}/competitions/calendar", f"{SITE}/competitions"):
        resp = _get(session, listing)
        if resp is not None:
            slugs.update(s for s in _SLUG_LINK.findall(resp.text) if not _SKIP_SLUG.search(s))
    log.info("athletex: %d competitions listed", len(slugs))

    if backfill:
        this_year = datetime.now(ALMATY_TZ).year
        years = range(min_year, this_year + 1)
        slugs |= {v for s in list(slugs) for v in year_variants(s, years)}
        log.info("athletex: %d competition pages to check (with backfill)", len(slugs))

    sources: dict[str, ClaxSource] = {}
    for slug in sorted(slugs):
        page_url = f"{SITE}/competitions/{slug}"
        resp = _get(session, page_url)
        if resp is None:
            continue
        for path, year, folder in clax_links(resp.text):
            if year < min_year:
                continue
            event_slug = SLUG_PREFIX + folder.lower()
            sources.setdefault(event_slug, ClaxSource(event_slug, path, year, page_url))
    log.info("athletex: %d result files from %d onward", len(sources), min_year)
    return sorted(sources.values(), key=lambda s: (s.year, s.slug))


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------

def _resolve_runners(client, index: RunnerIndex, results: tuple[ClaxResult, ...]) -> dict[int, int]:
    """Map result position -> runner_id, reusing matched runners, creating the rest."""
    resolved: dict[int, int] = {}
    to_create: dict[int, tuple[str, str, str]] = {}
    for i, r in enumerate(results):
        runner_id = index.match(r.full_name, r.country, r.city)
        if runner_id is not None:
            resolved[i] = runner_id
        else:
            to_create[i] = (r.full_name, r.country, display_city(r.city))

    unique_keys = list(dict.fromkeys(to_create.values()))
    created: dict[tuple[str, str, str], int] = {}
    for start in range(0, len(unique_keys), BATCH_SIZE):
        created.update(get_or_create_runners(client, unique_keys[start:start + BATCH_SIZE]))
    for key, runner_id in created.items():
        index.add(runner_id, *key)  # later events in this run can match them
    for i, key in to_create.items():
        if key in created:
            resolved[i] = created[key]

    log.info("  runners: %d matched existing, %d new/exact", len(results) - len(to_create), len(to_create))
    return resolved


def import_event(client, index: RunnerIndex, source: ClaxSource, event: ClaxEvent) -> int:
    event_id = upsert_event(
        client, source.slug, event.name or source.slug, source.year, source.page_url, ORGANIZER
    )
    if event.event_date:
        client.table("events").update(
            {"date_of_event": event.event_date.isoformat()}
        ).eq("id", event_id).execute()

    runner_ids = _resolve_runners(client, index, event.results)
    rows = [
        {
            "runner_id":         runner_ids[i],
            "event_id":          event_id,
            "bib_number":        r.bib or None,
            "distance_category": r.distance_category,
            "place":             r.place,
            "checkpoint_times":  list(r.checkpoint_times) or None,
            "finish_time":       r.chip_time,
            "chip_time":         r.chip_time,
        }
        for i, r in enumerate(event.results)
        if i in runner_ids
    ]
    for start in range(0, len(rows), BATCH_SIZE):
        upsert_results_batch(client, rows[start:start + BATCH_SIZE])

    mark_event_scraped(client, event_id, len(rows))
    return len(rows)


def run(client, min_year: int, backfill: bool = False) -> int:
    """Import new athletex events. Returns total result rows upserted."""
    session = requests.Session()
    done = get_scraped_slugs(client)
    todo = [s for s in discover(session, min_year, backfill) if s.slug not in done]
    log.info("athletex: %d new events to import", len(todo))
    if not todo:
        return 0

    today = datetime.now(ALMATY_TZ).date()
    index: Optional[RunnerIndex] = None
    total = 0
    for source in todo:
        try:
            resp = _get(session, f"{LIVE}/{source.path}")
            if resp is None:
                log.warning("  %s: result file unavailable", source.slug)
                continue
            event = parse_clax(resp.content)
            if event.event_date and event.event_date >= today:
                log.info("  %s: race on %s not finished yet — skipping", source.slug, event.event_date)
                continue
            if not event.results:
                log.info("  %s: no running results — skipping", source.slug)
                continue
            if index is None:
                index = RunnerIndex.load(client)  # only when there is work
            count = import_event(client, index, source, event)
            log.info("  %s: %d results (%s)", source.slug, count, event.name)
            total += count
        except Exception as exc:
            log.error("  %s failed: %s", source.slug, exc, exc_info=True)

    log.info("athletex: %d result rows imported", total)
    return total
