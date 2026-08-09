---
phase: 02-shared-anbima-calendar
verified: 2026-08-09T00:00:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
---

# Phase 2: Shared ANBIMA Calendar Verification Report

**Phase Goal:** Business-day math is correct and identical on both client and CLI, powered by one vendored data file.
**Verified:** 2026-08-09
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `shared/anbima-calendar.json` exists, ascending/unique/ISO-formatted holidays, `start=2000-01-01`, `end=2078-12-25`, `count==len(holidays)` (CAL-01) | ✓ VERIFIED | Re-parsed file directly: `count 1003 len 1003`, `start 2000-01-01 end 2078-12-25`, `sorted True`. `cli/tests/test_calendar_json.py` (32 assertions) passes independently: `uv run pytest tests/test_calendar_json.py -q` → 32 passed. |
| 2 | The vendored table is federal-only and contains the fixed + moveable holiday spot-checks (CAL-01) | ✓ VERIFIED | `test_fixed_federal_holidays_present` (24 cases), `test_moveable_holiday_present` (2024-03-29), `test_municipal_holiday_absent` (2024-01-25) all pass. Independently confirmed by prior code review's own programmatic spot check (02-REVIEW.md). |
| 3 | `shared/scripts/update_calendar.py` regenerates the file byte-idempotently, offline, with a sanity band, and is never invoked from shipped runtime code (CAL-05) | ✓ VERIFIED | Ran `uv run --project cli python shared/scripts/update_calendar.py --check` myself → `CHECK OK ... (1003 holidays)`, exit 0. `grep -rn "update_calendar" cli/apollo_cli/ web/src/` → zero matches (no runtime import path). No `requests`/`urllib`/`http`/`socket` import in the script (grep zero matches). |
| 4 | `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py` both export `isBusinessDay`/`is_business_day`, `addBusinessDays`/`add_business_days`, `nextBusinessDay`/`next_business_day` over `YYYY-MM-DD` strings (CAL-02, CAL-03) | ✓ VERIFIED | Read both files in full: exports match the `<interfaces>` contract exactly (`CALENDAR_START`/`END`, `InvalidDateError`, `CalendarRangeError`, the three functions), non-stub, real parse/range/business-day logic implemented in both. |
| 5 | Neither runtime uses `Calendar.load` or any algorithmic/third-party holiday package; both read exclusively from the vendored JSON (CAL-02, CAL-03) | ✓ VERIFIED | `grep -nE '^[^#/]*Calendar\.load' cli/apollo_cli/bizdays.py web/src/lib/bizdays.ts` → zero matches. Python constructs `Calendar(holidays=_PAYLOAD["holidays"], weekdays=[...])` from the JSON; TS builds `HOLIDAYS` `Set` from `calendar.holidays` imported from the JSON. `grep` for `date-holidays`/`febraban`/`workalendar` in `web/package.json`/`cli/pyproject.toml` → zero matches. |
| 6 | A shared fixture drives both `bun test` and `uv run pytest` to identical, green results including matching error classes (CAL-04) | ✓ VERIFIED | Ran independently: `cd web && bun test` → `42 pass, 0 fail`. `cd cli && uv run pytest -q` → `224 passed` (includes 42 fixture-driven `test_bizdays.py` cases + 32 `test_calendar_json.py` + 150 `test_offset_agrees_with_walk` assertions + other test functions). Fixture file `shared/bizdays.testcases.json` has 42 cases, 13 error cases, confirmed by direct JSON parse. |
| 7 | Boundary dates (`2000-01-01`, `2078-12-25`) accepted; one day outside on each side raises `CalendarRangeError`; malformed/non-existent dates raise `InvalidDateError`; format-before-range ordering holds | ✓ VERIFIED | Confirmed by reading the fixture-driven test dispatch and the implementation code (`assertInRange`/`_assert_in_range` called after `parseIsoDate`/`_parse_iso_date`); `bun test`/`pytest` both green including these fixture cases (`walk-off-end-raises`, `walk-off-start-raises`, boundary-accepted cases). |
| 8 | `addBusinessDays(date, 0)` returns the date unchanged, including on weekends/holidays; negative `n` walks backward with the same exclusion; round-trip holds | ✓ VERIFIED | Code review of both implementations confirms the `n === 0` / `n == 0` early return occurs after range-assertion, before any adjustment; fixture includes `n=0`-on-Saturday case and round-trip case; both suites green. |
| 9 | `nextBusinessDay`/`next_business_day` is exactly `addBusinessDays(date, 1)` (strictly-after) on both sides | ✓ VERIFIED | Both files implement `nextBusinessDay`/`next_business_day` as a direct delegation to `addBusinessDays(date, 1)`/`add_business_days(value, 1)` — read directly in source, structurally guarantees agreement. |
| 10 | If the vendored JSON is missing/unparseable, both runtimes fail loudly with no fallback calendar | ✓ VERIFIED | Python: `_PAYLOAD = json.loads(_CALENDAR_PATH.read_text(...))` at module import with no try/except — propagates `FileNotFoundError`/`JSONDecodeError`. TS: `import calendar from "../../../shared/anbima-calendar.json"` is a static import that fails the build/bundle if missing — no runtime fallback logic present in either file. (02-02-SUMMARY and 02-REVIEW both record a live test of this via temporarily moving the file; source code confirms no catch/fallback exists.) |
| 11 | Fixture expectations were derived from an independent oracle, not the implementation under test | ✓ VERIFIED | `.planning/phases/02-shared-anbima-calendar/oracle-check.py` exists, uses `Calendar.load("ANBIMA")` (forbidden-in-production primitive) restricted to `.planning/` only — confirmed via `grep -rn 'Calendar\.load' cli/ shared/ web/src/` finding zero matches outside `.planning/`. |
| 12 | `verify-phase-02.sh` re-proves CAL-01..CAL-05 in one command, from any cwd, repeatably, without leaving the repo dirty | ✓ VERIFIED | Ran myself: `cd /tmp && bash <path>/verify-phase-02.sh` → all five CAL sections + quality gates print PASS, final line `PHASE 02 VERIFIED`, exit 0. `git status --porcelain` after run shows only pre-existing untracked `.gsd/` (unrelated tooling dir, not part of this phase). |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/anbima-calendar.json` | Vendored ANBIMA holiday table, 2000-01-01..2078-12-25 | ✓ VERIFIED | Exists, 1003 holidays, all fields consistent, re-parsed independently. |
| `shared/scripts/update_calendar.py` | Offline, idempotent regenerator | ✓ VERIFIED | Exists, `--check` mode confirmed working live, no network imports. |
| `web/src/lib/bizdays.ts` | Browser-side business-day math | ✓ VERIFIED | 139 lines, all three ops + both error classes + constants implemented, non-stub. |
| `cli/apollo_cli/bizdays.py` | CLI-side business-day math | ✓ VERIFIED | 122 lines, mirrors TS exactly, `bizdays.Calendar` built from vendored JSON only. |
| `shared/bizdays.testcases.json` | Cross-runtime parity fixture | ✓ VERIFIED | 42 cases, 13 error cases, confirmed by direct parse. |
| `cli/tests/test_calendar_json.py` | CAL-01 structural gate | ✓ VERIFIED | 32 assertions pass independently. |
| `cli/tests/test_bizdays.py` | CAL-04 parity gate + offset cross-check | ✓ VERIFIED | Part of 224 passing tests in `cli/`. |
| `web/src/lib/bizdays.test.ts` | CAL-04 parity gate (web) | ✓ VERIFIED | `bun test` → 42 pass, 0 fail. |
| `.planning/phases/02-shared-anbima-calendar/verify-phase-02.sh` | Single re-runnable phase-closeout proof | ✓ VERIFIED | Executed independently from `/tmp`, ends with `PHASE 02 VERIFIED`, exit 0. |
| `cli/README.md`, root `README.md` | Documented calendar workflow + gate commands | ✓ VERIFIED | `grep -c update_calendar.py cli/README.md` and root README contains `anbima-calendar.json`, `bizdays.testcases.json`, `bun test`, `uv run pytest` (per 02-03-SUMMARY, re-confirmed present via script run which greps these). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `web/src/lib/bizdays.ts` | `shared/anbima-calendar.json` | static JSON import | ✓ WIRED | `import calendar from "../../../shared/anbima-calendar.json"`, `HOLIDAYS`/`CALENDAR_START`/`CALENDAR_END` all derived from it. |
| `cli/apollo_cli/bizdays.py` | `shared/anbima-calendar.json` | `find_repo_root()` + `json.loads` | ✓ WIRED | `_CALENDAR_PATH = find_repo_root() / "shared" / "anbima-calendar.json"`, loaded at import time, feeds `_CALENDAR = Calendar(holidays=_PAYLOAD["holidays"], ...)`. |
| `web/src/lib/bizdays.test.ts` | `shared/bizdays.testcases.json` | static JSON import | ✓ WIRED | `bun test` reports 42 pass matching fixture length. |
| `cli/tests/test_bizdays.py` | `shared/bizdays.testcases.json` | `find_repo_root()` + `json.loads` | ✓ WIRED | pytest parametrized over the same fixture; `uv run pytest -q` → 224 passed (includes all fixture cases). |
| `shared/scripts/update_calendar.py` | bizdays package `ANBIMA.cal` | `importlib.resources.files("bizdays")` | ✓ WIRED | `--check` run reproduces the committed file exactly; grep for network imports finds none. |
| `verify-phase-02.sh` | `update_calendar.py --check`, both test suites | shell invocation | ✓ WIRED | Ran independently — all sections execute real commands and gate on exit codes. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `web/src/lib/bizdays.ts` | `HOLIDAYS` (Set) | `calendar.holidays` from `shared/anbima-calendar.json` | Yes — 1003 real ANBIMA holidays, not a static empty/mock array | ✓ FLOWING |
| `cli/apollo_cli/bizdays.py` | `_CALENDAR` (bizdays.Calendar) | `_PAYLOAD["holidays"]` from the same JSON | Yes — identical source, `bizdays.Calendar` built from real vendored list | ✓ FLOWING |
| `shared/bizdays.testcases.json` expected values | N/A (data file) | Independent oracle script (`Calendar.load("ANBIMA")`, `.planning/`-only) | Yes — derived from a source other than the implementation under test | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vendored calendar structurally valid | `uv run --project cli python -c "...parse json..."` | `count 1003 len 1003`, `start/end` correct, sorted True | ✓ PASS |
| Generator is byte-idempotent | `uv run --project cli python shared/scripts/update_calendar.py --check` | `CHECK OK ... (1003 holidays)`, exit 0 | ✓ PASS |
| Web test suite | `cd web && bun test` | `42 pass, 0 fail, 55 expect() calls` | ✓ PASS |
| CLI test suite | `cd cli && uv run pytest -q` | `224 passed` | ✓ PASS |
| No forbidden `Calendar.load` in shipped code | `grep -nE '^[^#/]*Calendar\.load' cli/apollo_cli/bizdays.py web/src/lib/bizdays.ts` | zero matches | ✓ PASS |
| No holiday-computing package added | `grep -nE 'date-holidays|febraban|workalendar' web/package.json cli/pyproject.toml` | zero matches | ✓ PASS |
| `update_calendar.py` never called from shipped runtime code | `grep -rn "update_calendar" cli/apollo_cli/ web/src/` | zero matches | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `.planning/phases/02-shared-anbima-calendar/verify-phase-02.sh` | `cd /tmp && bash <abs-path>/verify-phase-02.sh` | All 5 CAL sections + quality gates PASS, final line `PHASE 02 VERIFIED`, exit 0 | PASS |

### Quality Gates (run independently by this verifier)

| Gate | Command | Result |
|------|---------|--------|
| ruff check (cli + shared/scripts) | `cd cli && uv run ruff check --config pyproject.toml . ../shared/scripts` | exit 0, "All checks passed!" |
| ruff format check | `cd cli && uv run ruff format --check --config pyproject.toml . ../shared/scripts` | exit 0, "9 files already formatted" |
| ty check | `cd cli && uv run ty check . ../shared/scripts` | exit 0, "All checks passed!" |
| svelte-check + tsc | `cd web && bun run check` | exit 0, "280 FILES 0 ERRORS 0 WARNINGS" |
| biome lint | `cd web && bun run lint` | exit 0, "Checked 9 files ... No fixes applied" |
| biome format check | `cd web && bun run format:check` | exit 0, "Checked 8 files ... No fixes applied" |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| CAL-01 | 02-01 | Vendored ANBIMA holiday table, 2000-2078, federal-only | ✓ SATISFIED (with documented deviation) | Table is real, federal-only, correct range, structurally proven. **Deviation note:** REQUIREMENTS.md's literal text says "sourced from `github.com/ianliu/feriados-anbima`"; the implementation instead sources the same official ANBIMA data from the MIT-licensed `bizdays` package's bundled `ANBIMA.cal`. This is explicitly documented in 02-01-SUMMARY.md as a Rule-1 correction inherited from research: `feriados-anbima` is a GPLv3 script that fetches live over the network, which would violate C-03's "never at runtime" constraint and complicate licensing. The `bizdays` package ships the same official ANBIMA data, statically, MIT-licensed. The intent of CAL-01/C-03 (a static, vendored, federal ANBIMA table) is met; only the literal named upstream source differs, for a well-justified reason recorded at execution time. Not treated as a blocking gap. |
| CAL-02 | 02-02 | `web/src/lib/bizdays.ts` implements the three ops from the vendored JSON only | ✓ SATISFIED | Verified directly in source + passing `bun test`. |
| CAL-03 | 02-02 | `cli/apollo_cli/bizdays.py` implements equivalent math via `bizdays.Calendar` pointed at the vendored JSON, not the built-in ANBIMA calendar | ✓ SATISFIED | Verified directly in source (`Calendar(holidays=_PAYLOAD["holidays"], ...)`) + passing `pytest`. |
| CAL-04 | 02-02 | Identical results across a shared fixture on both runtimes | ✓ SATISFIED | 42/42 cases pass on both `bun test` and `uv run pytest`, independently re-run. |
| CAL-05 | 02-01, 02-03 | `shared/scripts/update_calendar.py` is the sole manual/non-runtime regeneration path | ✓ SATISFIED | `--check` idempotence verified live; zero references from shipped `cli/apollo_cli/**` or `web/src/**`. |

No orphaned requirements — `.planning/REQUIREMENTS.md`'s Phase 2 row set (CAL-01..CAL-05) exactly matches the union of `requirements:` fields across all three plan frontmatters.

**Note (non-blocking, documentation lag):** `.planning/REQUIREMENTS.md`'s checkboxes for CAL-01..CAL-05 are still unchecked (`- [ ]`) and its Traceability table still marks them "Pending" — this is a tracking-document sync gap, not a code gap. All five requirements are functionally satisfied per the evidence above; the checkboxes/traceability table should be updated by the orchestrator as part of closing this phase, but their staleness does not affect whether the phase goal was achieved in the codebase.

### Anti-Patterns Found

None. Scanned `web/src/lib/bizdays.ts`, `cli/apollo_cli/bizdays.py`, `shared/scripts/update_calendar.py`, both test files, and the vendored JSON files for `TODO`/`FIXME`/`XXX`/`TBD`/`placeholder`/empty-return stubs — zero matches. No `# noqa` or `# type: ignore` suppressions found in shipped code (one `# type: ignore[arg-type]` exists in `cli/apollo_cli/bizdays.py` line 44 for a JSON-derived `dict[str, object]` → `Calendar(holidays=...)` type narrowing, which `ty check` passes clean around — this is a legitimate, narrow type-narrowing suppression, not a logic stub, and `ty check` still reports zero errors).

### Human Verification Required

None. All must-haves for this phase are structural/computational (business-day math correctness, file shape, gate scope) and were fully verifiable by direct command execution and source reading — no visual, real-time, or external-service behavior is in scope for this phase.

### Gaps Summary

No gaps found. All 12 derived observable truths (covering CAL-01 through CAL-05, plus the roadmap's stated goal of correctness/identity/single-source-of-truth) are independently verified against the running codebase, not just against SUMMARY.md claims:

- Re-ran `verify-phase-02.sh` from a clean shell in `/tmp` — passed end to end.
- Re-ran `bun test` in `web/` and `uv run pytest` in `cli/` independently — both green, matching the documented case counts.
- Re-ran `ruff check`/`ruff format --check`/`ty check` over `cli/` + `shared/scripts/`, and `bun run check`/`lint`/`format:check` in `web/` — all clean.
- Read both `bizdays.ts` and `bizdays.py` in full — confirmed non-stub, functionally identical algorithms, correct parity structure (`nextBusinessDay` delegating to `addBusinessDays(date, 1)`), no `Calendar.load`, no fallback-on-missing-file behavior.
- Independently re-parsed `shared/anbima-calendar.json` and `shared/bizdays.testcases.json` to confirm shape/count claims rather than trusting the SUMMARY's numbers.

One documentation-lag item is noted (REQUIREMENTS.md checkboxes/traceability table not yet flipped to Complete) but does not block phase-goal achievement since it is a tracking artifact, not a functional requirement.

---

*Verified: 2026-08-09*
*Verifier: Claude (gsd-verifier)*
