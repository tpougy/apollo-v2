"""Cross-runtime parity test: consumes `shared/bizdays.testcases.json`, the
single source of test data shared with `web/src/lib/bizdays.test.ts`.

Business-day math itself is implemented in `apollo_cli.bizdays`; this file
must never hardcode fixture data — see plan 02-02's acceptance criteria.
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from typing import Any, Final

import pytest

from apollo_cli import bizdays as bizdays_module
from apollo_cli.bizdays import (
    CALENDAR_END,
    CALENDAR_START,
    CalendarRangeError,
    InvalidDateError,
    add_business_days,
    is_business_day,
    next_business_day,
)
from apollo_cli.config import find_repo_root

_FIXTURE_PATH: Final = find_repo_root() / "shared" / "bizdays.testcases.json"
FIXTURE: Final[list[dict[str, Any]]] = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))

_ERROR_CLASSES: Final[dict[str, type[Exception]]] = {
    "InvalidDateError": InvalidDateError,
    "CalendarRangeError": CalendarRangeError,
}


def _run(case: dict[str, Any]) -> bool | str:
    op = case["op"]
    if op == "isBusinessDay":
        return is_business_day(case["date"])
    if op == "addBusinessDays":
        if "n" not in case:
            pytest.fail(f"Fixture case {case['id']} is addBusinessDays but has no 'n'")
        return add_business_days(case["date"], case["n"])
    if op == "nextBusinessDay":
        return next_business_day(case["date"])
    pytest.fail(f"Fixture case {case['id']} has unrecognized op: {op!r}")
    raise AssertionError  # unreachable, satisfies type checker


@pytest.mark.parametrize("case", FIXTURE, ids=lambda c: c["id"])
def test_fixture_case(case: dict[str, Any]) -> None:
    has_expected = "expected" in case
    has_error = "error" in case

    if has_expected == has_error:
        pytest.fail(
            f"Fixture case {case['id']} must have exactly one of 'expected'/'error', "
            f"got has_expected={has_expected} has_error={has_error}"
        )

    if has_error:
        error_name = case["error"]
        error_class = _ERROR_CLASSES.get(error_name)
        if error_class is None:
            pytest.fail(f"Fixture case {case['id']} has unrecognized error class: {error_name!r}")
        with pytest.raises(error_class) as exc_info:
            _run(case)
        assert type(exc_info.value).__name__ == error_name
    else:
        assert _run(case) == case["expected"]


def _sample_business_days(count: int, seed: int) -> list[str]:
    """Deterministically sample `count` distinct business-day ISO strings
    spread across the vendored calendar range.
    """
    rng = random.Random(seed)
    start_bound = date.fromisoformat(CALENDAR_START)
    end_bound = date.fromisoformat(CALENDAR_END)
    span_days = (end_bound - start_bound).days

    sampled: list[str] = []
    seen: set[str] = set()
    attempts = 0
    while len(sampled) < count and attempts < count * 200:
        attempts += 1
        candidate = start_bound + timedelta(days=rng.randint(0, span_days))
        iso = candidate.isoformat()
        if iso in seen:
            continue
        if not is_business_day(iso):
            continue
        seen.add(iso)
        sampled.append(iso)
    return sampled


_OFFSET_SAMPLE: Final[list[str]] = _sample_business_days(50, seed=20260808)
_OFFSET_N_VALUES: Final[tuple[int, ...]] = (1, 5, 20)


@pytest.mark.parametrize("start_iso", _OFFSET_SAMPLE)
@pytest.mark.parametrize("n", _OFFSET_N_VALUES)
def test_offset_agrees_with_walk(start_iso: str, n: int) -> None:
    """Independent sanity check: our hand-written day-by-day walk
    (`add_business_days`) must agree with `bizdays.Calendar.offset()`, the
    library's own primitive, for unambiguous business-day starting points.

    This is NOT a substitute for the shared fixture (CAL-04 requires
    byte-identical semantics between TS and Python by construction, not by
    trusting a third library primitive) — it is an extra cross-check that our
    hand-rolled walk isn't quietly wrong in a way that happens to match itself
    on both runtimes but diverges from the underlying library's own notion of
    "N business days from here".
    """
    walked = add_business_days(start_iso, n)
    offset_result = bizdays_module._CALENDAR.offset(start_iso, n)
    offset_iso = str(offset_result)[:10]
    assert offset_iso == walked, (
        f"offset({start_iso!r}, {n}) = {offset_iso!r} but add_business_days = {walked!r}"
    )
