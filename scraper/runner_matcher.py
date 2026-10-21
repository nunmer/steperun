"""
Match runners from a new source to existing `runners` rows.

A runner is reused only when the match is unambiguous:
  - same folded name key (order-insensitive, transliteration-tolerant), and
  - countries agree (or one side is blank), and
  - cities agree (or one side is blank),
  - and exactly one existing runner passes — or, among several, exactly one
    has the same non-blank city.
Anything else creates a new runner: a duplicate profile is recoverable
(the user can claim both), a wrong merge mixes two people's results.
"""

import logging
from dataclasses import dataclass
from typing import Optional

from .names import city_key, name_key

log = logging.getLogger(__name__)

PAGE = 1000


@dataclass(frozen=True)
class _Known:
    runner_id: int
    country: str
    city: str  # city key


def _agree(a: str, b: str) -> bool:
    return not a or not b or a == b


class RunnerIndex:
    def __init__(self) -> None:
        self._by_key: dict[str, list[_Known]] = {}

    @classmethod
    def load(cls, client) -> "RunnerIndex":
        """Read all visible runners once (keyset pagination, read-only)."""
        index = cls()
        last_id = 0
        while True:
            rows = (
                client.table("runners")
                .select("id, full_name, country, city")
                .eq("is_hidden", False)
                .gt("id", last_id)
                .order("id")
                .limit(PAGE)
                .execute()
            ).data or []
            for r in rows:
                index.add(r["id"], r["full_name"], r.get("country") or "", r.get("city") or "")
            if len(rows) < PAGE:
                break
            last_id = rows[-1]["id"]
        log.info("Runner index: %d name keys", len(index._by_key))
        return index

    def add(self, runner_id: int, full_name: str, country: str, city: str) -> None:
        key = name_key(full_name)
        if key:
            self._by_key.setdefault(key, []).append(
                _Known(runner_id, (country or "").strip().lower(), city_key(city))
            )

    def match(self, full_name: str, country: str, city: str) -> Optional[int]:
        key = name_key(full_name)
        if not key:
            return None
        c_country = (country or "").strip().lower()
        c_city = city_key(city)
        candidates = [
            k for k in self._by_key.get(key, [])
            if _agree(k.country, c_country) and _agree(k.city, c_city)
        ]
        ids = {k.runner_id for k in candidates}
        if len(ids) == 1:
            return ids.pop()
        if c_city:
            same_city = {k.runner_id for k in candidates if k.city == c_city}
            if len(same_city) == 1:
                return same_city.pop()
        return None
