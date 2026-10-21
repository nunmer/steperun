"""
Parser for Wiclax .clax result files (served by live.myrace.info, used by
athletex.kz). A .clax file is XML:

  <Epreuve nom=".." dates="воскресенье, 6 сентября 2026 г.">
    <IP><I id="0" nm="Город." /></IP>          custom-field labels
    <Pays><p n="KAZ" i="KZ" l="Казахстан" /></Pays>
    <Parcours><Pcs nom="Irbis Race" distance="39900" /></Parcours>
    <Etapes><Etape ...>
      <Engages><E d="bib" n="Surname Name" x="M" a="1985" p="course" na="KAZ" ip0="Almaty" /></Engages>
      <Resultats><R d="bib" t="01h39'16" p0="00h47'43" ... /></Resultats>
    </Etape></Etapes>
  </Epreuve>

Pure parsing only — no network or DB access.
"""

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

# Courses that are not running results (cycling, relays, kids, sweepers, ...).
_SKIP_COURSE = re.compile(
    r"bike|mtb|itt\b|road|gravel|velo|вело|duo|relay|эстафет|\bteam\b|команд|zamyk|замык|"
    r"canicross|kids|детск|дети|teen|swim|плав|ski\b|skimo|skitour|splitboard|"
    r"snowshoe|лыж|virtual|виртуал|^test$",
    re.IGNORECASE,
)
_RUN_PREFIX = re.compile(r"^(?:run|забег)\s+", re.IGNORECASE)
_NORDIC = re.compile(r"nordic|скандинав", re.IGNORECASE)
_PURE_DISTANCE = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*(?:km|км|k)\s*$", re.IGNORECASE)
_TIME = re.compile(r"^(\d+)h(\d{2})'(\d{2})(?:,(\d+))?$")
_RU_MONTHS = {
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4, "мая": 5, "июня": 6,
    "июля": 7, "августа": 8, "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12,
}

# ISO-2 → English country names, matching the spellings already in `runners`.
_COUNTRY_EN = {
    "KZ": "Kazakhstan", "RU": "Russia", "KG": "Kyrgyzstan", "UZ": "Uzbekistan",
    "TJ": "Tajikistan", "TM": "Turkmenistan", "CN": "China", "AE": "UAE",
    "US": "United States", "PH": "Philippines", "UA": "Ukraine", "DE": "Germany",
    "GB": "United Kingdom", "KR": "South Korea", "IN": "India", "MY": "Malaysia",
    "FR": "France", "IT": "Italy", "BY": "Belarus", "DK": "Denmark", "MN": "Mongolia",
    "CA": "Canada", "ES": "Spain", "SE": "Sweden", "AU": "Australia", "TR": "Turkey",
    "PL": "Poland", "CZ": "Czech Republic", "NL": "Netherlands", "CH": "Switzerland",
    "AT": "Austria", "IL": "Israel", "ZA": "South Africa", "JP": "Japan", "GE": "Georgia",
    "AZ": "Azerbaijan", "AM": "Armenia", "HU": "Hungary", "FI": "Finland", "NO": "Norway",
    "BE": "Belgium", "PT": "Portugal", "LT": "Lithuania", "LV": "Latvia", "EE": "Estonia",
    "IR": "Iran", "PK": "Pakistan", "SG": "Singapore", "TH": "Thailand", "VN": "Vietnam",
    "ID": "Indonesia", "KE": "Kenya", "ET": "Ethiopia", "BR": "Brazil", "MX": "Mexico",
    "NZ": "New Zealand", "IE": "Ireland", "SK": "Slovakia", "RS": "Serbia", "MD": "Moldova",
}


@dataclass(frozen=True)
class ClaxResult:
    bib: str
    full_name: str
    country: str            # English name, "" if unknown
    city: str               # raw city as entered, "" if unknown
    distance_category: str
    place: int
    chip_time: str          # "HH:MM:SS[.f]"
    checkpoint_times: tuple[str, ...]


@dataclass(frozen=True)
class ClaxEvent:
    name: str
    event_date: Optional[date]
    results: tuple[ClaxResult, ...]


def parse_time(raw: Optional[str]) -> Optional[str]:
    """ "01h39'16" -> "01:39:16", "00h04'03,7" -> "00:04:03.7"; DNF/blank -> None."""
    if not raw:
        return None
    m = _TIME.match(raw.strip())
    if not m:
        return None
    h, mi, s, frac = m.groups()
    out = f"{int(h):02d}:{mi}:{s}"
    return f"{out}.{frac}" if frac else out


def _seconds(hms: str) -> float:
    h, m, s = hms.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def parse_event_date(raw: Optional[str]) -> Optional[date]:
    """ "воскресенье, 6 сентября 2026 г." -> date(2026, 9, 6)."""
    if not raw:
        return None
    m = re.search(r"(\d{1,2})\s+([а-я]+)\s+(\d{4})", raw.lower())
    if not m or m.group(2) not in _RU_MONTHS:
        return None
    try:
        return date(int(m.group(3)), _RU_MONTHS[m.group(2)], int(m.group(1)))
    except ValueError:
        return None


_SERIAL_EPOCH = date(1899, 12, 30)  # spreadsheet/OLE day 0


def parse_serial_date(raw: Optional[str]) -> Optional[date]:
    """Wiclax `date="45346"` (days since 1899-12-30) -> date(2024, 2, 24)."""
    if not raw or not raw.strip().isdigit():
        return None
    days = int(raw)
    if not 36526 <= days <= 73051:  # 2000-01-01 .. 2099-12-31
        return None
    return _SERIAL_EPOCH + timedelta(days=days)


def parse_page_date(text: Optional[str]) -> Optional[date]:
    """First race date on an event web page: "12 октября 2025" or "12.10.2025"."""
    if not text:
        return None
    found = parse_event_date(text)
    if found:
        return found
    m = re.search(r"\b(\d{2})\.(\d{2})\.(20\d{2})\b", text)
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None


def category_label(course: str, distance_m: int) -> Optional[str]:
    """
    Map a course to a distance_category label, or None to skip it.
    Plain road distances reuse almaty-marathon.kz labels so rankings line up.
    """
    name = course.strip()
    if not name or _SKIP_COURSE.search(name):
        return None

    nordic = bool(_NORDIC.search(name))
    bare = _RUN_PREFIX.sub("", _NORDIC.sub("", name).strip())  # "Run 10 km" -> "10 km"
    m = _PURE_DISTANCE.match(bare)
    km = float(m.group(1).replace(",", ".")) if m else None
    if km is not None:
        if 21.0 <= km <= 21.2:
            label = "21 км 97,5 м"
        elif 42.0 <= km <= 42.3:
            label = "42 км 195 м"
        else:
            label = f"{km:g} км"
        return f"Скандинавская ходьба: {label}" if nordic else label

    if distance_m > 0 and not re.search(r"\d", name):
        return f"{name} {distance_m / 1000:g} км"
    return name


def _city_attr(root: ET.Element) -> Optional[str]:
    """Custom fields are numbered per file; find the one labelled city."""
    for field in root.iterfind("./IP/I"):
        label = (field.get("nm") or "").lower()
        if label.startswith("город") or label.startswith("city"):
            return f"ip{field.get('id')}"
    return None


def _checkpoints(r: ET.Element) -> tuple[str, ...]:
    splits = sorted(
        (int(k[1:]), v) for k, v in r.attrib.items() if re.fullmatch(r"p\d+", k)
    )
    times = (parse_time(v) for _, v in splits)
    return tuple(t for t in times if t)


def parse_clax(xml_bytes: bytes) -> ClaxEvent:
    root = ET.fromstring(xml_bytes)
    countries = {
        p.get("n"): _COUNTRY_EN.get(p.get("i") or "", p.get("l") or p.get("n") or "")
        for p in root.iterfind("./Pays/p")
    }
    course_dist = {
        p.get("nom"): int(p.get("distance") or 0) for p in root.iterfind("./Parcours/Pcs")
    }
    city_attr = _city_attr(root)

    finishers: dict[str, list[tuple[float, ClaxResult]]] = {}
    for etape in root.iter("Etape"):
        entries = {e.get("d"): e for e in etape.iterfind("./Engages/E")}
        for r in etape.iterfind("./Resultats/R"):
            entry = entries.get(r.get("d"))
            chip = parse_time(r.get("t"))
            if entry is None or not chip:
                continue  # unknown bib, DNF, DNS
            course = entry.get("p") or ""
            label = category_label(course, course_dist.get(course, 0))
            name = (entry.get("n") or "").strip()
            if not label or not name:
                continue
            result = ClaxResult(
                bib=r.get("d") or "",
                full_name=name,
                country=countries.get(entry.get("na"), entry.get("na") or ""),
                city=(entry.get(city_attr) or "").strip() if city_attr else "",
                distance_category=label,
                place=0,
                chip_time=chip,
                checkpoint_times=_checkpoints(r),
            )
            finishers.setdefault(label, []).append((_seconds(chip), result))

    ranked: list[ClaxResult] = []
    for rows in finishers.values():
        rows.sort(key=lambda x: x[0])
        seen_bibs: set[str] = set()
        place = 0
        for _, res in rows:
            if res.bib in seen_bibs:
                continue  # same bib in two stages of one course: keep the best
            seen_bibs.add(res.bib)
            place += 1
            ranked.append(ClaxResult(**{**res.__dict__, "place": place}))

    name = (root.get("nom") or "").strip()
    if name.isupper():
        name = name.title()
    event_date = parse_event_date(root.get("dates")) or parse_serial_date(root.get("date"))
    return ClaxEvent(name=name, event_date=event_date, results=tuple(ranked))
