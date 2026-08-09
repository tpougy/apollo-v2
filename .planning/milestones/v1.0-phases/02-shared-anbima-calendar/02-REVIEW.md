---
status: clean
phase: 02-shared-anbima-calendar
reviewed: 2026-08-09
depth: standard
---

# Code Review: Phase 02 — Shared ANBIMA Calendar

## Scope

Files reviewed: `cli/apollo_cli/bizdays.py`, `web/src/lib/bizdays.ts`,
`shared/anbima-calendar.json`, `shared/bizdays.testcases.json`,
`shared/scripts/update_calendar.py`, `cli/tests/test_bizdays.py`,
`cli/tests/test_calendar_json.py`, `web/src/lib/bizdays.test.ts`,
`cli/pyproject.toml`, `web/package.json`, `web/tsconfig.app.json`,
root `README.md`, `cli/README.md`, `cli/apollo_cli/config.py` (read for
context), and `.planning/PROJECT.md` for C-03 compliance.

## Verification performed (not just reading)

- `cd cli && uv run pytest -q` → **224 passed**.
- `cd web && bun test` → **42 pass, 0 fail, 55 expect() calls**.
- `cd cli && uv run ruff check/format --config pyproject.toml . ../shared/scripts` → clean.
- `cd cli && uv run ty check . ../shared/scripts` → clean.
- `cd web && bun run check` (svelte-check + tsc) → 0 errors/warnings.
- `cd web && bun run lint` / `format:check` (Biome over `shared web/src web/vite.config.ts`) → clean.
- `grep -rn "Calendar.load"` across `cli/`, `shared/`, `web/src` → only the docstring comment in `bizdays.py` naming it as forbidden; no actual call anywhere in shipped code.
- Spot-checked `shared/anbima-calendar.json` programmatically: 1003 holidays, sorted, unique, all `YYYY-MM-DD`, range `2000-01-01`..`2078-12-25` matching `start`/`end`/`count` fields; `2024-09-07` and `2024-03-29` present (federal + moveable), `2024-01-25` (São Paulo municipal aniversário) absent — matches the federal-only claim asserted by `test_municipal_holiday_absent`.

## Findings

None. This is a clean implementation with unusually strong self-defense:

**C-03 compliance (the primary risk called out for this review) — verified holds.**
Both `bizdays.py` and `bizdays.ts` read exclusively from `shared/anbima-calendar.json` at
import/module-load time. The Python side constructs `Calendar(holidays=<vendored list>,
weekdays=["Saturday", "Sunday"])` — never `Calendar.load(...)` — and a missing/corrupt JSON
file raises loudly at import time (`json.loads(_CALENDAR_PATH.read_text(...))`, no try/except,
no fallback). `update_calendar.py` (the only place the `bizdays` package's *bundled* algorithmic
table is ever touched) is offline, human-invoked, and never imported by runtime code — confirmed
by grep, not just by the docstring's claim.

**n=0 and non-business-day-start edge cases — TS and Python agree, verified by both the shared
fixture and by direct test execution, not just static reading.** Both implementations:
short-circuit `n === 0` to return the input unchanged *after* the range assertion (so an
out-of-range date with `n=0` still raises `CalendarRangeError` — no separate fixture case covers
this exact combination, but the code path shows it's symmetric on both sides since the order of
operations — parse → assert range → check n==0 — is identical). Starting from a non-business
day with `n=1` (Saturday → next business day skips to Monday, holiday → next weekday) is covered
by fixture cases `add-business-days-n1-from-saturday` and `next-business-day-from-holiday` and
passes identically on both runtimes.

**No hidden algorithmic fallback.** `is_business_day` uses `bizdays.Calendar.isbizday()` — but
that `Calendar` instance is constructed exclusively from the vendored JSON's `holidays` array and
an explicit `weekdays` list, not `Calendar.load("ANBIMA")`. The TS side reimplements the same
weekend+holiday-set check by hand (no `bizdays`-equivalent library dependency exists in the JS
ecosystem here, so there's nothing to accidentally fall back to). `test_offset_agrees_with_walk`
in `test_bizdays.py` additionally cross-checks the hand-rolled day-by-day walk against
`bizdays.Calendar.offset()` — the library's own primitive — across 150 randomized cases (50
sampled business days × 3 n-values), as an extra sanity net beyond the shared fixture.

**Date parsing is string-in/string-out on both sides, with no timezone-shift risk.** Python uses
`date.fromisoformat` and `date.isoformat()` exclusively — no `datetime`, no timezone anywhere in
this module. TypeScript uses `Date.UTC(...)` / `getUTCFullYear/UTCMonth/UTCDate` throughout
(`parseIsoDate`, `addBusinessDays`'s cursor arithmetic, `formatIso`) — never a bare `new
Date(dateString)` constructor call or local-timezone getter (`getFullYear`, `getMonth`, `getDate`
are never used). This is the correct pattern for avoiding the classic JS "date string parsed as
local, formatted back one day off" bug class, and it's applied consistently, not just in the
happy path — the invalid-date rejection logic (`rebuilt.getUTCFullYear() !== year`, etc.) also
uses the UTC accessors.

**Fixture-driven parity is real, not decorative.** Both `test_bizdays.py` and `bizdays.test.ts`
load `shared/bizdays.testcases.json` at runtime (no hardcoded fixture duplication) and both
suites pass against the current implementations. The fixture itself is well-constructed: it
exercises ordinary weekdays, Saturday/Sunday, holiday-on-Saturday (verifies weekend/holiday
overlap doesn't double-subtract), n=0 on both business and non-business days, positive/negative
walks spanning Carnival (a multi-day holiday cluster) and a year boundary, `nextBusinessDay`
strictly-after semantics (holiday date still advances), calendar-boundary rejection in both
directions, and malformed-format / nonexistent-date rejection (including a leap-day-format check
that's outside the calendar range, correctly asserting format validation happens before range
validation on both runtimes).

**Range-boundary walk-off tests are exact, not approximate.** `walk-off-end-raises` (from
2078-12-20, n=10) and `walk-off-start-raises` (from 2000-01-10, n=-10) both correctly raise
`CalendarRangeError` on both runtimes because both implementations assert range on every
intermediate cursor step, not just the input and final result — confirmed by reading the loop
body in both files (`_assert_in_range(cursor_iso)` / `assertInRange(cursorIso)` called inside
the `while remaining > 0` loop before the business-day check).

**`next_business_day`/`nextBusinessDay` correctly deviates from `bizdays`' library default.**
Both docstrings/comments explicitly flag that this is "strictly-after" semantics, not
`Calendar.following()`'s same-day-passthrough — and both implementations achieve this by
delegating to `addBusinessDays(date, 1)`, which always advances at least one day by construction
(the `n===0` short-circuit is never reached for n=1). Verified via
`next-business-day-from-friday` (business day still advances) in the shared fixture.

## Minor observations (non-blocking, not findings)

- `add_business_days`/`addBusinessDays` re-parse and re-validate the range for `cursor_iso` twice
  per loop iteration (once explicitly via `_assert_in_range`/`assertInRange`, once again inside
  the `is_business_day`/`isBusinessDay` call). This is redundant work but not a correctness
  issue — the values are cheap to compute and the loop bound is small in this domain (business
  day counts, not day counts, over realistic ranges). Not worth flagging as a fix.
- `next_business_day` calls `add_business_days(value, 1)` rather than being implemented as its
  own tight loop — this is a plus, not a minus: it structurally guarantees the two functions
  can't drift apart on semantics.

## Conclusion

No bugs, no security issues, no C-03 violations, no TS/Python disagreement found. All quality
gates green, all tests green, spot-checked data file internally consistent. Recommend `status:
clean`.
