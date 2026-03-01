"""
HTML parsing utilities for almaty-marathon.kz results pages.

Key findings from reverse-engineering:
  - Every event page has exactly ONE yiiGridView (#data-grid).
  - Distance categories are selected via URL param ?d=VALUE
    (driven by <select onchange="window.location='?d='+this.value">)
  - Gender filter: ?d=D&g=G  (g=1 male, g=2 female, empty=all)
  - Age group:     ?d=D&g=G&ac=AC
  - Pagination:    ?d=D&Results_page=N  (pageVar always "Results_page")
  - Pager links look like: /ru/results/slug?Results_page=2
"""

import re
import logging
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse, parse_qs

from bs4 import BeautifulSoup, Tag

log = logging.getLogger(__name__)


@dataclass
class CategoryInfo:
    """One distance category selectable on an event page."""
    value: str    # the ?d= param value, e.g. "10", "21", "42"; "" = no filter
    label: str    # human-readable, e.g. "10 км"


@dataclass
class ResultRow:
    full_name: str
    country: str
    city: str
    bib_number: str
    place: Optional[int]
    checkpoint_times: list[str]
    finish_time: str
    chip_time: str
    distance_category: str


# ---------------------------------------------------------------------------
# Category detection
# ---------------------------------------------------------------------------

def detect_categories(html: str) -> list[CategoryInfo]:
    """
    Parse the distance <select> from the page.
    Returns one CategoryInfo per option.  If no select is found, returns an
    empty list (caller should treat the event as single-category).
    """
    soup = BeautifulSoup(html, "lxml")
    categories: list[CategoryInfo] = []

    for sel in soup.find_all("select"):
        onchange = sel.get("onchange", "")
        # The distance select has: onchange="window.location='?d='+this.value"
        if "?d=" not in onchange:
            continue
        for opt in sel.find_all("option"):
            val   = opt.get("value", "").strip()
            label = opt.get_text(strip=True)
            if val:
                categories.append(CategoryInfo(value=val, label=label))
        break  # only the first matching select is the distance selector

    return categories


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

def count_pages(html: str) -> int:
    """Return the highest page number found in the pager, or 1."""
    soup = BeautifulSoup(html, "lxml")
    pager = soup.find(class_="pager")
    if pager is None:
        return 1

    nums: list[int] = []
    for a in pager.find_all("a"):
        # Only look at the query-string portion of the href to avoid
        # matching years in the path (e.g. winter_run_2026 → 2026)
        href = a.get("href", "")
        if "?" in href:
            qs = href[href.index("?") + 1:]
            for val in parse_qs(qs).values():
                for v in val:
                    if v.isdigit():
                        nums.append(int(v))
        # Also trust plain digit link text (page number buttons)
        txt = a.get_text(strip=True)
        if txt.isdigit():
            nums.append(int(txt))

    return max(nums) if nums else 1


# ---------------------------------------------------------------------------
# Table parsing
# ---------------------------------------------------------------------------

def parse_results_table(html: str, category_label: str = "") -> list[ResultRow]:
    """
    Parse runner rows from one page of results HTML.
    Works on full page HTML or an AJAX fragment.
    """
    soup = BeautifulSoup(html, "lxml")

    # Find the results table
    table = soup.find("table", class_="items")
    if table is None:
        grid = soup.find("div", id=re.compile(r"data-grid"))
        if grid:
            table = grid.find("table")
    if table is None:
        return []

    headers = _parse_headers(table)
    rows: list[ResultRow] = []

    tbody = table.find("tbody") or table
    for tr in tbody.find_all("tr"):
        row = _parse_row(tr, headers, category_label)
        if row:
            rows.append(row)

    return rows


def _parse_headers(table: Tag) -> dict:
    thead = table.find("thead")
    if not thead:
        return {}
    mapping: dict = {}
    for i, th in enumerate(thead.find_all("th")):
        text = th.get_text(strip=True).lower()
        if any(k in text for k in ("место", "place", "#")):
            mapping["place"] = i
        elif any(k in text for k in ("участник", "фио", "name", "имя", "fio", "runner")):
            mapping["name"] = i
        elif any(k in text for k in ("страна", "country")):
            mapping["country"] = i
        elif any(k in text for k in ("город", "city", "населён")):
            mapping["city"] = i
        elif any(k in text for k in ("номер", "bib", "нагрудн", "start")):
            mapping["bib"] = i
        elif "chip" in text or "чип" in text:
            mapping["chip_time"] = i
        elif any(k in text for k in ("финиш", "finish", "результ", "время")):
            # first match = finish_time, leave chip_time for explicit chip col
            if "finish_time" not in mapping:
                mapping["finish_time"] = i
        elif re.search(r"\d[\.,]\d*\s*(км|km)", text):
            mapping.setdefault("checkpoints", []).append(i)

    return mapping


def _parse_row(tr: Tag, headers: dict, category: str) -> Optional[ResultRow]:
    tds = tr.find_all("td")
    if not tds:
        return None

    first_text = tds[0].get_text(strip=True)
    if not first_text or first_text.lower() in ("место", "place", "#"):
        return None

    def cell(key: str, default: str = "") -> str:
        idx = headers.get(key)
        if idx is None or idx >= len(tds):
            return default
        return tds[idx].get_text(separator=" ", strip=True)

    # Country: prefer image alt text (flag icon); strip .png/.jpg suffix
    country = ""
    c_idx = headers.get("country")
    if c_idx is not None and c_idx < len(tds):
        img = tds[c_idx].find("img")
        raw = img.get("alt", "") if img else tds[c_idx].get_text(strip=True)
        country = re.sub(r"\.(png|jpg|svg|webp)$", "", raw, flags=re.I)

    # Checkpoint times
    cp_indices: list[int] = headers.get("checkpoints", [])
    checkpoints = [
        tds[i].get_text(strip=True)
        for i in cp_indices
        if i < len(tds) and tds[i].get_text(strip=True) not in ("", "-")
    ]

    # Fallback column detection when headers are absent
    if not headers:
        return _parse_row_positional(tds, category)

    name = cell("name")
    if not name or name.lower() in ("фио", "name", "участник", "runner"):
        return None

    return ResultRow(
        full_name=name,
        country=country,
        city=cell("city"),
        bib_number=cell("bib"),
        place=_parse_int(cell("place")),
        checkpoint_times=checkpoints,
        finish_time=cell("finish_time"),
        chip_time=cell("chip_time"),
        distance_category=category,
    )


def _parse_row_positional(tds, category: str) -> Optional[ResultRow]:
    """Positional fallback: place | name | country | city | bib | [CPs...] | finish | chip | cert"""
    n = len(tds)
    if n < 3:
        return None
    name = tds[1].get_text(strip=True) if n > 1 else ""
    if not name:
        return None

    img   = tds[2].find("img") if n > 2 else None
    raw   = img.get("alt", "") if img else (tds[2].get_text(strip=True) if n > 2 else "")
    country = re.sub(r"\.(png|jpg|svg|webp)$", "", raw, flags=re.I)
    city  = tds[3].get_text(strip=True) if n > 3 else ""
    bib   = tds[4].get_text(strip=True) if n > 4 else ""

    times = [
        td.get_text(strip=True)
        for td in tds[5:]
        if re.match(r"\d{1,2}:\d{2}", td.get_text(strip=True))
    ]
    chip_time   = times[-1] if times else ""
    finish_time = times[-2] if len(times) >= 2 else chip_time
    cp_times    = times[:-2] if len(times) > 2 else []

    return ResultRow(
        full_name=name, country=country, city=city, bib_number=bib,
        place=_parse_int(tds[0].get_text(strip=True)),
        checkpoint_times=cp_times,
        finish_time=finish_time, chip_time=chip_time,
        distance_category=category,
    )


def _parse_int(text: str) -> Optional[int]:
    m = re.search(r"\d+", text)
    return int(m.group()) if m else None
