---
phase: 02-shared-anbima-calendar
plan: 01
subsystem: shared-data
tags: [bizdays, pytest, anbima, calendar, vendored-data, uv]

# Dependency graph
requires: []
provides:
  - "shared/anbima-calendar.json — vendored, static ANBIMA federal holiday table (2000-01-01..2078-12-25, 1003 dates), single source of truth for both runtimes"
  - "shared/scripts/update_calendar.py — offline, network-free, byte-idempotent regenerator with a --check mode and a [900, 1200] sanity band"
  - "cli/tests/ — pytest package, ready to host plan 02-02's test_bizdays.py"
affects: [02-02-shared-anbima-calendar]

# Actuals
actuals:
  tokens: ~9000
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: ["bizdays==1.0.19", "pytest==9.1.1"]
  patterns:
    - "Vendor ANBIMA holidays from the locally-installed, MIT-licensed bizdays package's bundled ANBIMA.cal file (via importlib.resources) rather than the GPLv3, live-fetching feriados-anbima repo named in PROJECT.md C-03 — same official upstream data, zero network dependency, license-safe."
    - "update_calendar.py's exact serialize() contract (json.dumps(indent=2, ensure_ascii=False) + trailing newline) is the byte-idempotence guarantee validated by --check; nothing else may write shared/anbima-calendar.json."
    - "cli/tests/test_calendar_json.py resolves the vendored file via apollo_cli.config.find_repo_root() (Phase 1's established contract) — never a relative path from the test file, never a second repo-root walk."
    - "ty (unlike mypy) does not treat inline # type: ignore comments as suppressions here; JSON-derived values were narrowed once via typing.cast into module-level Final constants instead of repeating # type: ignore on every dict access."

key-files:
  created:
    - shared/anbima-calendar.json
    - shared/scripts/update_calendar.py
    - cli/tests/__init__.py
    - cli/tests/test_calendar_json.py
  modified:
    - cli/pyproject.toml
    - cli/uv.lock

key-decisions:
  - "Vendored range cut at exactly 2000-01-01..2078-12-25 per PROJECT.md C-03's literal date range, even though the currently-installed bizdays package's ANBIMA.cal actually spans through 2099-12-25 (1280 raw lines, 1003 filtered to the locked range). Widening later is a one-line DEFAULT_END change, documented in the script's module docstring."
  - "DEFAULT_END constant is '2078-12-31' (not '2078-12-25') so the date-range filter is inclusive of the whole calendar year; the actual last holiday (2078-12-25) becomes payload['end'] naturally as holidays[-1]."
  - "sourceVersion is resolved at runtime via importlib.metadata.version('bizdays'), never hardcoded, so a future bizdays upgrade can't silently desync the recorded provenance from the installed package."

patterns-established:
  - "Any future shared/ data-vendoring script follows the same shape: stdlib + the one already-adopted library, importlib.resources for package data access, a sanity band before any write, and a --check mode for CI-style idempotence verification."

requirements-completed: [CAL-01, CAL-05]

coverage:
  - id: D1
    description: "shared/anbima-calendar.json exists, holidays strictly ascending/duplicate-free/ISO-formatted, start=2000-01-01, end=2078-12-25, count==len(holidays)"
    requirement: "CAL-01"
    verification:
      - kind: other
        ref: "cd cli && uv run pytest tests/test_calendar_json.py -q -> 32 passed (test_shape, test_count_matches_length, test_all_iso_format, test_sorted_and_unique, test_range_boundaries)"
        status: pass
    human_judgment: false
  - id: D2
    description: "24 fixed federal holidays present for 2000/2024/2050; one moveable holiday (2024-03-29 Good Friday) present; municipal holiday (2024-01-25) absent"
    requirement: "CAL-01"
    verification:
      - kind: other
        ref: "test_fixed_federal_holidays_present (24 parametrized cases), test_moveable_holiday_present, test_municipal_holiday_absent — all pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "update_calendar.py regenerates the JSON offline, byte-idempotently, with zero network imports, refusing to write outside the [900,1200] sanity band"
    requirement: "CAL-05"
    verification:
      - kind: other
        ref: "uv run --project cli python shared/scripts/update_calendar.py --check (CHECK OK, 1003 holidays); git diff --exit-code shared/anbima-calendar.json (clean); --check --end 2010-12-31 exits 1 (count 132 outside band) without touching the file; grep for requests/urllib/http/socket/aiohttp imports finds zero matches"
        status: pass
    human_judgment: false
  - id: D4
    description: "Quality gates (ruff check, ruff format --check, ty check) clean across cli/ and shared/scripts/, zero suppressions"
    requirement: "CAL-01, CAL-05"
    verification:
      - kind: other
        ref: "cd cli && uv run ruff check --config pyproject.toml . ../shared/scripts && uv run ruff format --check ... && uv run ty check . ../shared/scripts — all exit 0; grep noqa in cli/tests/ finds zero matches"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 01: Vendored ANBIMA Calendar + Offline Generator Summary

**Vendored `shared/anbima-calendar.json` (1003 federal ANBIMA holidays, 2000-01-01..2078-12-25) extracted offline from the MIT-licensed `bizdays` package's bundled `ANBIMA.cal`, plus a byte-idempotent, network-free regenerator and a 32-assertion structural pytest gate.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2 completed
- **Files created:** 4 (`shared/anbima-calendar.json`, `shared/scripts/update_calendar.py`, `cli/tests/__init__.py`, `cli/tests/test_calendar_json.py`)
- **Files modified:** 2 (`cli/pyproject.toml`, `cli/uv.lock`)

## Accomplishments

- `shared/anbima-calendar.json` is committed with exactly **1003 holidays**, `start="2000-01-01"`, `end="2078-12-25"`, `count` matching `len(holidays)` exactly, sourced from `bizdays==1.0.19`'s bundled `ANBIMA.cal` (never the GPLv3, live-fetching `feriados-anbima` repo literally named in PROJECT.md C-03 — see Deviations below for why).
- `shared/scripts/update_calendar.py` regenerates that exact file byte-for-byte (`--check` confirms it), performs zero network access (verified by grep for `requests`/`urllib`/`http`/`socket`/`aiohttp` imports), and refuses to write if the extracted count falls outside `[900, 1200]` — verified live by running it with `--end 2010-12-31` (132 holidays, exits 1, file untouched).
- `cli/tests/test_calendar_json.py` gives CAL-01 a 32-assertion structural gate (9 test functions, 24 of which are the parametrized fixed-federal-holiday spot-check). Mutation-tested live: appending a bogus `1999-01-01` date breaks 3 tests (`test_count_matches_length`, `test_sorted_and_unique`, `test_range_boundaries`); reverting restores a clean pass.
- `ruff check`, `ruff format --check`, and `ty check` are all clean (zero findings, zero suppressions) across `cli/` **and** `shared/scripts/`.

## Task Commits

1. **Task 1: Add the bizdays + pytest dependencies and write the offline calendar generator** - `29fe117` (feat)
2. **Task 2: Create the cli/tests pytest package and the CAL-01 structural gate** - `56cb562` (test)

## TDD Gate Compliance

Task 2 was marked `tdd="true"` in the plan, but its subject is a **structural gate over already-correct, already-committed data** (Task 1's `shared/anbima-calendar.json`), not new production behavior requiring a RED→GREEN implementation cycle. There is no separate "implementation" commit to pair with the test commit — the data being tested was already correct when the tests were written, so all 32 assertions passed on the first run (no RED phase was possible or meaningful here; a canonical RED phase would require a genuinely broken implementation to fix, and none existed). The mutation-testing step (documented above and in the plan's acceptance criteria) substitutes for RED by proving the gate fails loudly when the data is deliberately corrupted, then passes again once reverted — this is the closest meaningful equivalent to the RED/GREEN cycle for a pure data-validation test suite. Git log shows a single `test(02-01): ...` commit (`56cb562`) with no paired `feat(02-01): ...` commit after it for Task 2 specifically (Task 1's `feat` commit precedes it and is the data being validated, not code fixed in response to the test).

## Files Created/Modified

- `shared/anbima-calendar.json` - vendored ANBIMA holiday table (`source`, `sourceVersion`, `generatedBy`, `note`, `start`, `end`, `count`, `holidays`)
- `shared/scripts/update_calendar.py` - `DEFAULT_START`, `DEFAULT_END`, `MIN_EXPECTED`, `MAX_EXPECTED`, `WEEKDAY_NAMES`, `ISO_DATE_RE`, `read_anbima_cal()`, `extract_holidays()`, `build_payload()`, `serialize()`, `main()`
- `cli/tests/__init__.py` - empty package marker
- `cli/tests/test_calendar_json.py` - 9 test functions, 32 total assertions (CAL-01 structural gate)
- `cli/pyproject.toml` - added `bizdays` runtime dependency, `pytest` dev dependency
- `cli/uv.lock` - regenerated lockfile (30 packages after `bizdays`, 35 after `pytest`)

## Decisions Made

- **Sourced from `bizdays`'s bundled `ANBIMA.cal`, not `github.com/ianliu/feriados-anbima` (the repo literally named in PROJECT.md C-03).** Per 02-RESEARCH.md's verified finding, `feriados-anbima` is a 25-line GPLv3 script that downloads a live `.xls` from ANBIMA's website at runtime — using it would either violate C-03's "never at runtime" rule or require redistributing GPLv3 code. The `bizdays` package's bundled `ANBIMA.cal` is the same official ANBIMA data, already static, MIT-licensed, and already an adopted Phase 2 dependency. This is documented as a Rule-1-adjacent correction inherited from research, not invented mid-execution — flagged here for the phase verifier per the plan's `<output>` instruction.
- **Actual holiday count (1003) does not match PROJECT.md C-03's "~948" figure.** Confirmed stale per 02-RESEARCH.md Assumptions Log A1: the currently-installed `bizdays==1.0.19` ships a larger `ANBIMA.cal` (1280 raw lines / 1276 dates through 2099) than whatever release the "~948" figure was originally quoted from. C-03's *date range* (2000-2078) was honored literally; its *count* is descriptive/stale and was not "fixed" — this discrepancy is called out here for the phase verifier per the plan's explicit instruction, not silently reconciled.
- **`sourceVersion` resolved at runtime, never hardcoded:** confirmed as `1.0.19` (matches 02-RESEARCH.md's verified PyPI figure) via `importlib.metadata.version("bizdays")` inside `build_payload()`.
- **Carnival and Corpus Christi presence (informational, for plan 02-02's fixture author):** `2024-02-12`, `2024-02-13` (Carnival Mon/Tue), and `2024-05-30` (Corpus Christi) are all present in the vendored table — confirmed by direct query against the generated JSON.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ty check` failed on `object`-typed JSON dict access in the test file**
- **Found during:** Task 2 verification (`ty check . ../shared/scripts`)
- **Issue:** `PAYLOAD["holidays"]` (declared `dict[str, object]`) was assigned to `list[str]`-annotated locals guarded only by `# type: ignore[assignment]` comments; `ty` (unlike `mypy`) does not honor that inline suppression syntax, producing 8 `invalid-assignment`/`unsupported-operator` diagnostics.
- **Fix:** Replaced per-test inline re-typing with a single set of module-level `Final` constants (`HOLIDAYS_LIST`, `START`, `END`, `COUNT`) narrowed once via `typing.cast`, then referenced directly from every test function. No suppression comments remain anywhere in `cli/tests/`.
- **Files modified:** `cli/tests/test_calendar_json.py`
- **Commit:** `56cb562` (folded into the Task 2 commit before it was created — no separate commit needed since verification ran before commit per the required implement→verify→commit order)

**2. [Rule 1 - Bug] `ruff format` reformatted a generator expression**
- **Found during:** Task 2 verification (`ruff format --check`)
- **Issue:** The `_FIXED_FEDERAL_CASES` tuple comprehension was written on one line exceeding ruff's formatting preference for multi-clause generator expressions.
- **Fix:** Ran `ruff format` (not manual edit) to apply the canonical multi-line form; re-verified `ruff format --check` and `pytest` both still pass.
- **Files modified:** `cli/tests/test_calendar_json.py`
- **Commit:** `56cb562` (same pre-commit verification pass as above)

## Issues Encountered

None blocking. Both issues above were caught and fixed during the mandatory implement→verify→commit sequence before any commit was made, so no task required more than one fix-and-reverify cycle.

## User Setup Required

None — this plan is entirely offline, local file generation with no external service configuration.

## Next Phase Readiness

- `shared/anbima-calendar.json` and `shared/scripts/update_calendar.py` are the complete, locked artifacts plan 02-02 needs to build `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py` against.
- `cli/tests/` is now a working pytest package (`__init__.py` + one test module); plan 02-02 adds `test_bizdays.py` alongside `test_calendar_json.py` in the same directory, and can reuse the `find_repo_root()`-based file-resolution pattern established here.
- Carnival (2024-02-12/13) and Corpus Christi (2024-05-30) presence is confirmed and documented above for plan 02-02's shared fixture (`shared/bizdays.testcases.json`) author to draw real test dates from.
- The stale "~948" figure in PROJECT.md C-03 remains as written (LOCKED, not reopened) — the actual count (1003) is documented here and in the generated JSON's own fields for any future auditor.

---
*Phase: 02-shared-anbima-calendar*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 5 claimed files verified present on disk (`shared/anbima-calendar.json`, `shared/scripts/update_calendar.py`, `cli/tests/__init__.py`, `cli/tests/test_calendar_json.py`, `.planning/phases/02-shared-anbima-calendar/02-01-SUMMARY.md`). Both commit hashes (`29fe117`, `56cb562`) verified present in git history.
