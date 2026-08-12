"""Business-day math over the vendored ANBIMA calendar.

Holidays come exclusively from the vendored `apollo_cli/data/anbima-calendar.json`
copy — a committed, reviewed snapshot of the ANBIMA calendar (see plan 02-01),
read via `importlib.resources` so it works identically whether this package is
an editable dev install or a real installed wheel with no monorepo checkout
anywhere on disk (see plan 24-01). `cli/tests/test_calendar_vendored_parity.py`
proves this vendored copy stays byte-identical to `shared/anbima-calendar.json`,
the original the `web/` app also reads. No algorithmic or third-party
holiday-computing package may ever be introduced here (C-03): a system that
silently answers from a different calendar than the one that was reviewed and
committed is worse than one that refuses to answer.

FORBIDDEN/PROHIBITED: `Calendar.load("ANBIMA")` anywhere in this module (and in
any shipped code). It sources holidays from the `bizdays` library's own bundled
table instead of the vendored JSON, violating CAL-03 and guaranteeing silent
drift on any future `bizdays` upgrade. The only correct calendar construction
is `Calendar(holidays=<vendored holidays>, weekdays=["Saturday", "Sunday"])`.

This module implements the exact same reference algorithm as
`web/src/lib/bizdays.ts` — see plan 02-02's <interfaces> block for the shared
specification. The two implementations must never be allowed to disagree
silently; `shared/bizdays.testcases.json` is the single source of test data
proving they don't.
"""

from __future__ import annotations

import json
import re
from datetime import date, timedelta
from importlib import resources
from typing import Final

from bizdays import Calendar

_ISO_DATE_RE: Final[re.Pattern[str]] = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_CALENDAR_RESOURCE: Final = resources.files("apollo_cli.data").joinpath("anbima-calendar.json")
# Let a missing/unparseable file raise loudly at import time — never fall
# back to a bundled or algorithmic calendar.
_PAYLOAD: Final[dict[str, object]] = json.loads(_CALENDAR_RESOURCE.read_text(encoding="utf-8"))

CALENDAR_START: Final[str] = str(_PAYLOAD["start"])
CALENDAR_END: Final[str] = str(_PAYLOAD["end"])

_holidays_raw: object = _PAYLOAD["holidays"]
if not isinstance(_holidays_raw, list):
    msg = f"{_CALENDAR_RESOURCE}: 'holidays' is not a list"
    raise TypeError(msg)
_HOLIDAYS: Final[list[str]] = _holidays_raw

_CALENDAR: Final[Calendar] = Calendar(
    holidays=_HOLIDAYS,
    weekdays=["Saturday", "Sunday"],
)


class InvalidDateError(ValueError):
    """Raised for malformed or non-existent `YYYY-MM-DD` date strings."""


class CalendarRangeError(ValueError):
    """Raised for a date outside `[CALENDAR_START, CALENDAR_END]`."""


def _parse_iso_date(value: str) -> date:
    """Parse and validate an ISO `YYYY-MM-DD` date string, rejecting malformed
    or non-existent calendar dates. Does NOT check the vendored calendar
    range — see `_assert_in_range`.
    """
    if not isinstance(value, str) or not _ISO_DATE_RE.match(value):
        msg = f"Invalid date format: {value!r}"
        raise InvalidDateError(msg)

    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        msg = f"Invalid calendar date: {value!r}"
        raise InvalidDateError(msg) from exc


def _assert_in_range(iso: str) -> None:
    """Assert that an ISO date string falls within
    `[CALENDAR_START, CALENDAR_END]` (inclusive on both ends). Plain
    lexicographic string comparison is correct here because all dates are
    zero-padded ISO strings.
    """
    if iso < CALENDAR_START or iso > CALENDAR_END:
        msg = (
            f"Date {iso} is outside the vendored calendar range [{CALENDAR_START}, {CALENDAR_END}]"
        )
        raise CalendarRangeError(msg)


def is_business_day(value: str) -> bool:
    parsed = _parse_iso_date(value)
    iso = parsed.isoformat()
    _assert_in_range(iso)
    return bool(_CALENDAR.isbizday(iso))


def add_business_days(value: str, n: int) -> str:
    parsed = _parse_iso_date(value)
    iso = parsed.isoformat()
    _assert_in_range(iso)

    if n == 0:
        return iso

    step = 1 if n > 0 else -1
    remaining = abs(n)
    cursor = parsed

    while remaining > 0:
        cursor = cursor + timedelta(days=step)
        cursor_iso = cursor.isoformat()
        _assert_in_range(cursor_iso)

        if is_business_day(cursor_iso):
            remaining -= 1

    return cursor.isoformat()


def next_business_day(value: str) -> str:
    """Strictly-after semantics: a date that is already a business day still
    advances. Deliberately NOT `bizdays`' `Calendar.following()`
    same-day-passthrough behavior — see plan 02-02's backstop truth.
    """
    return add_business_days(value, 1)
