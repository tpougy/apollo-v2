"""Independent oracle for authoring `shared/bizdays.testcases.json` expected values.

VERIFICATION ARTIFACT ONLY — lives under `.planning/`, never under `cli/`,
`shared/`, or `web/`. It deliberately uses `bizdays.Calendar.load("ANBIMA")`,
the library's own independently-sourced bundled holiday table, as the oracle
for cross-checking the vendored `shared/anbima-calendar.json` and for
generating expected values for hand-authored fixture cases. Using
`Calendar.load("ANBIMA")` in ANY shipped file (`cli/`, `shared/`, `web/src/`)
is forbidden (C-03 / T-02-08) — it is only acceptable here, in a throwaway
script that is never imported by application code and never committed as
part of the shipped tree's import graph.

Run with:
    uv run --project cli python .planning/phases/02-shared-anbima-calendar/oracle-check.py
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

from bizdays import Calendar

REPO_ROOT = Path(__file__).resolve().parents[3]
VENDORED_PATH = REPO_ROOT / "shared" / "anbima-calendar.json"

VENDORED = json.loads(VENDORED_PATH.read_text(encoding="utf-8"))
VENDORED_START: str = VENDORED["start"]
VENDORED_END: str = VENDORED["end"]
VENDORED_HOLIDAYS: set[str] = set(VENDORED["holidays"])

# The independent oracle: bizdays' own bundled ANBIMA table, NOT our vendored
# JSON. If this disagrees with the vendored JSON inside our range, the
# vendoring in plan 02-01 is wrong and must be re-examined.
ORACLE_CALENDAR = Calendar.load("ANBIMA")


def oracle_is_business_day(iso: str) -> bool:
    """Reference algorithm step 3, using the independent oracle's holiday set."""
    d = date.fromisoformat(iso)
    if d.weekday() >= 5:  # noqa: PLR2004 (5=Saturday, 6=Sunday)
        return False
    return ORACLE_CALENDAR.isbizday(iso)


def oracle_add_business_days(iso: str, n: int) -> str:
    """Reference algorithm step 4, hand-walked against the independent oracle —
    deliberately NOT calling `ORACLE_CALENDAR.offset()`, to stay an independent
    implementation of the same reference algorithm rather than a re-use of the
    library primitive under test elsewhere.
    """
    if n == 0:
        return iso
    step = 1 if n > 0 else -1
    remaining = abs(n)
    cursor = date.fromisoformat(iso)
    while remaining > 0:
        cursor = cursor + timedelta(days=step)
        if oracle_is_business_day(cursor.isoformat()):
            remaining -= 1
    return cursor.isoformat()


def oracle_next_business_day(iso: str) -> str:
    return oracle_add_business_days(iso, 1)


def check_vendored_matches_oracle_in_range() -> list[str]:
    """Confirm every vendored holiday matches the independent oracle's table,
    and that the oracle has no *extra* holiday inside [VENDORED_START,
    VENDORED_END] that the vendored JSON is missing.
    """
    oracle_holidays_in_range = {
        str(h)[:10] for h in ORACLE_CALENDAR.holidays if VENDORED_START <= str(h)[:10] <= VENDORED_END
    }
    only_in_vendored = sorted(VENDORED_HOLIDAYS - oracle_holidays_in_range)
    only_in_oracle = sorted(oracle_holidays_in_range - VENDORED_HOLIDAYS)
    disagreements = []
    if only_in_vendored:
        disagreements.append(f"Vendored has holidays the oracle does not: {only_in_vendored}")
    if only_in_oracle:
        disagreements.append(f"Oracle has holidays the vendored JSON does not: {only_in_oracle}")
    return disagreements


def main() -> None:
    print("=== Vendored vs. independent oracle (Calendar.load('ANBIMA')) ===")
    disagreements = check_vendored_matches_oracle_in_range()
    if disagreements:
        print("DISAGREEMENT FOUND:")
        for d in disagreements:
            print(f"  - {d}")
    else:
        print(
            f"OK: 0 disagreements. Vendored range [{VENDORED_START}, {VENDORED_END}] "
            f"holidays ({len(VENDORED_HOLIDAYS)}) exactly match the oracle's table "
            "restricted to the same range."
        )

    print()
    print("=== Task 2 fixture expected values (addBusinessDays / nextBusinessDay) ===")
    cases = [
        ("addBusinessDays-n0-business-day", "2024-03-06", 0),
        ("addBusinessDays-n0-saturday", "2024-03-09", 0),
        ("addBusinessDays-n1-friday-to-monday", "2024-03-08", 1),
        ("addBusinessDays-n1-saturday", "2024-03-09", 1),
        ("addBusinessDays-n5-full-week", "2024-03-04", 5),
        ("addBusinessDays-n20-spans-holidays", "2024-02-01", 20),
        ("addBusinessDays-n-neg1", "2024-03-11", -1),
        ("addBusinessDays-n-neg5", "2024-03-15", -5),
        ("addBusinessDays-n-neg20", "2024-04-01", -20),
        ("addBusinessDays-roundtrip-forward", "2024-03-06", 7),
    ]
    for case_id, start, n in cases:
        result = oracle_add_business_days(start, n)
        print(f"  {case_id}: addBusinessDays({start!r}, {n}) = {result!r}")

    roundtrip_forward = oracle_add_business_days("2024-03-06", 7)
    roundtrip_back = oracle_add_business_days(roundtrip_forward, -7)
    print(f"  addBusinessDays-roundtrip-backward: addBusinessDays({roundtrip_forward!r}, -7) = {roundtrip_back!r}")
    assert roundtrip_back == "2024-03-06", "round-trip must return to the original date"

    next_cases = [
        ("nextBusinessDay-friday", "2024-03-08"),
        ("nextBusinessDay-saturday", "2024-03-09"),
        ("nextBusinessDay-holiday", "2024-12-25"),
    ]
    for case_id, start in next_cases:
        nxt = oracle_next_business_day(start)
        via_add = oracle_add_business_days(start, 1)
        assert nxt == via_add
        print(f"  {case_id}: nextBusinessDay({start!r}) = {nxt!r}")

    print()
    print("=== Independent random cross-check sample (n in {1,5,20}, 50 business-day starts) ===")
    rng = random.Random(20260808)  # noqa: S311 (deterministic reproducibility, not security)
    start_bound = date.fromisoformat(VENDORED_START)
    end_bound = date.fromisoformat(VENDORED_END)
    span_days = (end_bound - start_bound).days

    sampled = 0
    attempts = 0
    disagreements_found = 0
    while sampled < 50 and attempts < 5000:
        attempts += 1
        candidate = start_bound + timedelta(days=rng.randint(0, span_days))
        iso = candidate.isoformat()
        if not oracle_is_business_day(iso):
            continue
        sampled += 1
        for n in (1, 5, 20):
            try:
                walked = oracle_add_business_days(iso, n)
            except Exception as exc:  # noqa: BLE001
                print(f"  SKIP (range) {iso} n={n}: {exc}")
                continue
            offset_result = ORACLE_CALENDAR.offset(iso, n)
            offset_iso = str(offset_result)[:10]
            if offset_iso != walked:
                disagreements_found += 1
                print(f"  DIVERGENCE at {iso} n={n}: walk={walked!r} offset={offset_iso!r}")

    print(f"Sampled {sampled} business days, {disagreements_found} divergences vs. Calendar.offset().")


if __name__ == "__main__":
    main()
