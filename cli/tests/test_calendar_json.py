"""Structural gate proving CAL-01's shape, range, and federal-only claims.

This file only tests the vendored *data* in `shared/anbima-calendar.json` —
business-day math itself belongs to plan 02-02's `test_bizdays.py`.
"""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Final, cast

import pytest

from apollo_cli.config import find_repo_root

_ISO_DATE_RE: Final[re.Pattern[str]] = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_CALENDAR_PATH = find_repo_root() / "shared" / "anbima-calendar.json"
_RAW_PAYLOAD: Final[dict[str, object]] = json.loads(_CALENDAR_PATH.read_text(encoding="utf-8"))
PAYLOAD: Final[dict[str, object]] = _RAW_PAYLOAD
HOLIDAYS_LIST: Final[list[str]] = cast("list[str]", _RAW_PAYLOAD["holidays"])
HOLIDAYS: Final[frozenset[str]] = frozenset(HOLIDAYS_LIST)
START: Final[str] = cast("str", _RAW_PAYLOAD["start"])
END: Final[str] = cast("str", _RAW_PAYLOAD["end"])
COUNT: Final[int] = cast("int", _RAW_PAYLOAD["count"])

_FIXED_FEDERAL_MONTH_DAYS: Final[tuple[str, ...]] = (
    "01-01",
    "04-21",
    "05-01",
    "09-07",
    "10-12",
    "11-02",
    "11-15",
    "12-25",
)
_FIXED_FEDERAL_YEARS: Final[tuple[int, ...]] = (2000, 2024, 2050)
_FIXED_FEDERAL_CASES: Final[tuple[str, ...]] = tuple(
    f"{year}-{month_day}"
    for year in _FIXED_FEDERAL_YEARS
    for month_day in _FIXED_FEDERAL_MONTH_DAYS
)


def test_shape() -> None:
    expected_keys = {
        "source",
        "sourceVersion",
        "generatedBy",
        "note",
        "start",
        "end",
        "count",
        "holidays",
    }
    assert expected_keys <= PAYLOAD.keys()
    holidays = PAYLOAD["holidays"]
    assert isinstance(holidays, list)
    assert all(isinstance(item, str) for item in holidays)


def test_count_matches_length() -> None:
    assert COUNT == len(HOLIDAYS_LIST)


def test_all_iso_format() -> None:
    for holiday in HOLIDAYS_LIST:
        assert _ISO_DATE_RE.match(holiday), holiday
        assert date.fromisoformat(holiday).isoformat() == holiday


def test_sorted_and_unique() -> None:
    assert HOLIDAYS_LIST == sorted(HOLIDAYS_LIST)
    assert len(set(HOLIDAYS_LIST)) == len(HOLIDAYS_LIST)


def test_range_boundaries() -> None:
    assert START == HOLIDAYS_LIST[0] == "2000-01-01"
    assert END == HOLIDAYS_LIST[-1] == "2078-12-25"
    assert all(START <= h <= END for h in HOLIDAYS_LIST)


def test_count_sanity_band() -> None:
    assert 900 <= COUNT <= 1200, f"actual count is {COUNT}"


@pytest.mark.parametrize("expected_date", _FIXED_FEDERAL_CASES, ids=_FIXED_FEDERAL_CASES)
def test_fixed_federal_holidays_present(expected_date: str) -> None:
    assert expected_date in HOLIDAYS


def test_moveable_holiday_present() -> None:
    assert "2024-03-29" in HOLIDAYS


def test_municipal_holiday_absent() -> None:
    assert "2024-01-25" not in HOLIDAYS
