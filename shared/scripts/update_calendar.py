"""Manual, human-invoked, offline regeneration of `shared/anbima-calendar.json`.

This script is run roughly yearly, by a human, from the repo root:

    uv run --project cli python shared/scripts/update_calendar.py

It is NEVER imported or invoked by `cli/apollo_cli/**` or `web/src/**` at
runtime — both runtimes only ever read the already-committed
`shared/anbima-calendar.json`, never this script. It performs no network
access whatsoever: it extracts the official ANBIMA holiday table from the
`ANBIMA.cal` file bundled as package data inside the locally installed,
MIT-licensed `bizdays` PyPI package (`wilsonfreitas/python-bizdays`). To
widen the vendored range beyond 2078 in the future, change the single
`DEFAULT_END` constant below.

Usage:
    uv run --project cli python shared/scripts/update_calendar.py
    uv run --project cli python shared/scripts/update_calendar.py --check
"""

from __future__ import annotations

import argparse
import importlib.metadata
import importlib.resources
import json
import re
from pathlib import Path
from typing import Final

DEFAULT_START: Final[str] = "2000-01-01"
DEFAULT_END: Final[str] = "2078-12-31"
MIN_EXPECTED: Final[int] = 900
MAX_EXPECTED: Final[int] = 1200
WEEKDAY_NAMES: Final[frozenset[str]] = frozenset(
    {
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    }
)
ISO_DATE_RE: Final[re.Pattern[str]] = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def read_anbima_cal() -> list[str]:
    """Locate and read the `bizdays` package's bundled `ANBIMA.cal` file.

    Raises `FileNotFoundError` if the resource is not present in the locally
    installed `bizdays` package. Performs no network access and has no
    fallback to any other source.
    """
    resource = importlib.resources.files("bizdays").joinpath("ANBIMA.cal")
    if not resource.is_file():
        msg = f"Expected bundled calendar resource not found: {resource}"
        raise FileNotFoundError(msg)
    return resource.read_text(encoding="utf-8").splitlines()


def extract_holidays(lines: list[str], start: str, end: str) -> list[str]:
    """Parse `ANBIMA.cal` lines into a sorted, deduplicated list of ISO dates
    within `[start, end]` (inclusive).

    Drops empty lines and weekday-exclusion names (`WEEKDAY_NAMES`). Raises
    `ValueError` naming the offending line for anything else that does not
    match `ISO_DATE_RE`.
    """
    kept: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped in WEEKDAY_NAMES:
            continue
        if not ISO_DATE_RE.match(stripped):
            msg = f"Unexpected line in ANBIMA.cal, not a weekday name or ISO date: {stripped!r}"
            raise ValueError(msg)
        if start <= stripped <= end:
            kept.append(stripped)
    return sorted(set(kept))


def build_payload(holidays: list[str]) -> dict[str, object]:
    """Build the JSON payload dict, in the exact declared key order.

    Raises `ValueError` if `holidays` is empty.
    """
    if not holidays:
        msg = "Cannot build payload from an empty holiday list"
        raise ValueError(msg)
    return {
        "source": "bizdays PyPI package (MIT, wilsonfreitas/python-bizdays) bundled ANBIMA.cal",
        "sourceVersion": importlib.metadata.version("bizdays"),
        "generatedBy": "shared/scripts/update_calendar.py",
        "note": (
            "Vendored static data, never computed at runtime; regenerate with "
            "`uv run --project cli python shared/scripts/update_calendar.py`."
        ),
        "start": holidays[0],
        "end": holidays[-1],
        "count": len(holidays),
        "holidays": holidays,
    }


def serialize(payload: dict[str, object]) -> str:
    """Serialize `payload` deterministically, with a single trailing newline.

    This exact serialization is the byte-idempotence contract for
    `shared/anbima-calendar.json` — nothing else may write this file.
    """
    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint. See module docstring for usage."""
    default_out = Path(__file__).resolve().parents[1] / "anbima-calendar.json"

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=default_out)
    parser.add_argument("--start", type=str, default=DEFAULT_START)
    parser.add_argument("--end", type=str, default=DEFAULT_END)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Regenerate in memory and compare to the on-disk file; write nothing.",
    )
    args = parser.parse_args(argv)

    lines = read_anbima_cal()
    holidays = extract_holidays(lines, args.start, args.end)
    count = len(holidays)

    if not MIN_EXPECTED <= count <= MAX_EXPECTED:
        print(
            f"ERROR: holiday count {count} is outside the sanity band "
            f"[{MIN_EXPECTED}, {MAX_EXPECTED}]; refusing to write {args.out}"
        )
        return 1

    payload = build_payload(holidays)
    serialized = serialize(payload)

    if args.check:
        if not args.out.is_file():
            print(f"CHECK FAILED: {args.out} does not exist")
            return 1
        existing = args.out.read_text(encoding="utf-8")
        if existing != serialized:
            print(f"CHECK FAILED: {args.out} differs from a fresh regeneration")
            return 1
        print(f"CHECK OK: {args.out} matches a fresh regeneration ({count} holidays)")
        return 0

    args.out.write_text(serialized, encoding="utf-8")
    print(f"Wrote {args.out}: count={count} start={payload['start']} end={payload['end']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
