"""Cross-runtime parity test: consumes `shared/bizdays.testcases.json`, the
single source of test data shared with `web/src/lib/bizdays.test.ts`.

Business-day math itself is implemented in `apollo_cli.bizdays`; this file
must never hardcode fixture data — see plan 02-02's acceptance criteria.
"""

from __future__ import annotations

import json
from typing import Any, Final

import pytest

from apollo_cli.bizdays import (
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
