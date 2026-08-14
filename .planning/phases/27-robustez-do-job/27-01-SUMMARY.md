---
phase: 27-robustez-do-job
plan: 01
subsystem: routine-generation-job
tags: [python, typescript, bizdays, calendar-math, cli, instantdb]

requires:
  - phase: 02-shared-calendar
    provides: "add_business_days/addBusinessDays (already supports a negative step count) and is_business_day/isBusinessDay in bizdays.py/.ts"
  - phase: 05-routine-job
    provides: "compute_expected_instances/computeExpectedInstances pure core, _compute_fixed_instances/computeFixedInstances, nth_business_day_of_month/nthBusinessDayOfMonth"
provides:
  - "nth_business_day_from_month_end/nthBusinessDayFromMonthEnd in bizdays.py/.ts — the last business day of a month (n=0), or N business days before it (negative n), built on add_business_days/addBusinessDays"
  - "du_fixo's offsetDias validation/dispatch extended to accept <= 0 via sign-based _du_fixo_nth_day/duFixoNthDay wrapper, corrido_fixo untouched"
  - "--offset-dias --help text on template criar/editar documenting the new du_fixo <= 0 semantics"
  - "Live-proven real onboarding 'Previa DU-2' case (offsetDias=-2, August 2026 -> 2026-08-27) plus fixture-level proof in both runtimes"
affects: [28-periodicidade-semanal, 29-recorte-de-range]

actuals:
  tokens: 4922
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Sign-based dispatch wrapper (_du_fixo_nth_day/duFixoNthDay) passed as the nth_day_fn/nthDayFn parameter to the pre-existing _compute_fixed_instances/computeFixedInstances — no new call site, no duplicated range/dedupeKey/competencia logic"

key-files:
  created: []
  modified:
    - cli/apollo_cli/bizdays.py
    - web/src/lib/bizdays.ts
    - cli/apollo_cli/routine_job.py
    - web/src/lib/routineJob.ts
    - cli/apollo_cli/entities/rotina.py
    - shared/routine-job.testcases.json
    - shared/bizdays.testcases.json
    - cli/tests/test_routine_job.py
    - cli/tests/test_bizdays.py
    - web/src/lib/bizdays.test.ts

key-decisions:
  - "nth_business_day_from_month_end lives in bizdays.py/.ts (not routine_job.py/routineJob.ts, where its siblings nth_business_day_of_month/nth_calendar_day_of_month live) — CONTEXT.md explicitly named bizdays.py/.ts as the target, and it builds directly on add_business_days without needing any of routine_job.py's month-scoped helpers beyond a locally-duplicated lastDayOfMonth (TS) / calendar.monthrange call (Python), avoiding a bizdays.ts -> routineJob.ts circular import."
  - "_DU_FIXO_MIN_OFFSET_DIAS set to a large negative sentinel (-1_000_000) rather than removing the floor entirely — CalendarRangeError (already caught per-template) is the real floor via the vendored calendar's own bounds; the sentinel just satisfies _validate_offset_dias's existing min_value parameter shape with zero signature change."

patterns-established:
  - "Two-runtime date-math extension pattern: add the pure function to bizdays.py/.ts first (with its own low-level fixture in shared/bizdays.testcases.json), then wire it into routine_job.py/routineJob.ts via a small sign-based dispatch wrapper, then add a scenario-level fixture case in shared/routine-job.testcases.json proving the two compose correctly together."

requirements-completed: [JOB-02]

coverage:
  - id: D1
    description: "du_fixo accepts offsetDias <= 0 (0 = last business day of month, negative N = N business days before it); corrido_fixo and du_fixo's offsetDias >= 1 path are unaffected"
    requirement: "JOB-02"
    verification:
      - kind: unit
        ref: "cli/tests/test_bizdays.py::test_fixture_case[nth-business-day-from-month-end-*] (5 cases)"
        status: pass
      - kind: unit
        ref: "web/src/lib/bizdays.test.ts (bizdays fixture parity, 5 nthBusinessDayFromMonthEnd cases)"
        status: pass
      - kind: unit
        ref: "cli/tests/test_routine_job.py::test_scenario[du_fixo offsetDias=-2 (JOB-02)... Previa DU-2] and [...tpl-d... agora e valido]"
        status: pass
      - kind: unit
        ref: "web/src/lib/routineJob.test.ts (routineJob computeExpectedInstances scenario fixture parity, tpl-d + tpl-n1)"
        status: pass
      - kind: integration
        ref: "cli/tests/test_routine_job.py::test_gerar_instancias_du_fixo_offset_le_zero_real_previa_du2_case (pytest.mark.live, run against production InstantDB)"
        status: pass
    human_judgment: false
  - id: D2
    description: "--offset-dias --help text on template criar/editar documents the new du_fixo <= 0 semantics"
    requirement: "JOB-02"
    verification:
      - kind: other
        ref: "apollo rotina template criar --help | grep -q 'last business day'; apollo rotina template editar --help | grep -q 'last business day'"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-14
status: complete
---

# Phase 27 Plan 01: du_fixo accepts offsetDias <= 0 (JOB-02) Summary

**New `nth_business_day_from_month_end`/`nthBusinessDayFromMonthEnd` primitive in `bizdays.py`/`.ts`, wired into `du_fixo` via a sign-based dispatch wrapper, proven live against production InstantDB for the real "Previa DU-2" onboarding case (2026-08-27).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- `apollo rotina template criar/editar --tipo-geracao du_fixo --offset-dias <n>` now accepts any `n <= 0`, previously rejected outright by `_validate_offset_dias`'s hardcoded `min_value=1`.
- New `nth_business_day_from_month_end(year, month, n)` / `nthBusinessDayFromMonthEnd(year, month, n)` in `bizdays.py`/`.ts`: `n=0` is the month's last business day; negative `n` counts that many business days before it — built entirely on the pre-existing `add_business_days`/`addBusinessDays` (already supports a negative step) and `is_business_day`/`isBusinessDay`, with zero new calendar-navigation logic.
- `du_fixo`'s dispatch is a small sign-based wrapper (`_du_fixo_nth_day`/`duFixoNthDay`) passed as the same `nth_day_fn` parameter `_compute_fixed_instances`/`computeFixedInstances` already accepted — `offsetDias >= 1` still routes through the untouched `nth_business_day_of_month`, `offsetDias <= 0` routes through the new function. `corrido_fixo` is completely untouched (still `min_value=1`, still `nth_calendar_day_of_month`).
- The real onboarding "Previa DU-2" case (offset -2 business days from month end) is now proven live, end-to-end, against production InstantDB: `2026-08-27` for August 2026 and `2026-09-28` for September 2026; `offsetDias=0` produces `2026-08-31`/`2026-09-30`.
- `--offset-dias` help text on both `template criar` and `template editar` documents the new two-sided semantics.
- Existing `tpl-d` fixture scenario (previously "offsetDias=0 is invalid") corrected to its new valid behavior; a new `tpl-n1` scenario and 5 new low-level `nthBusinessDayFromMonthEnd` fixture cases (business-day month-end, weekend rollback, holiday-crossing) added — all passing identically in both runtimes.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "du_fixo accepts offsetDias <= 0" — both runtimes, one dispatch path, real live proof** - `f63f5ab` (feat)
2. **Task 2: Dedicated low-level fixture coverage + a second (non-live) scenario proof of the real case** - `483891d` (test)

_Note: Task 1 was a `tracer` task — executed and committed as a full production-quality implementation with its own `<verify>`, then followed immediately by the tracer feedback gate (live-verify re-run of the same `<verify>`) before Task 2's expansion, per the workflow's tracer protocol. No checkpoint was surfaced because the tracer's `<verify>` passed cleanly on first run._

## Files Created/Modified
- `cli/apollo_cli/bizdays.py` - new `import calendar as pycalendar`; new `nth_business_day_from_month_end(year, month, n)`
- `web/src/lib/bizdays.ts` - new private `lastDayOfMonth`; new exported `nthBusinessDayFromMonthEnd(year, month, n)`
- `cli/apollo_cli/routine_job.py` - new `_DU_FIXO_MIN_OFFSET_DIAS` sentinel; new `_du_fixo_nth_day` dispatch wrapper; `du_fixo`'s `_compute_fixed_instances` call site updated; module docstring gains a `du_fixo (JOB-02/D-27-B)` paragraph
- `web/src/lib/routineJob.ts` - twin `DU_FIXO_MIN_OFFSET_DIAS`/`duFixoNthDay`; `du_fixo`'s `computeFixedInstances` call site updated; JSDoc gains the twin paragraph
- `cli/apollo_cli/entities/rotina.py` - `template criar`/`editar`'s `--offset-dias` help text rewritten for the `du_fixo` clause
- `cli/tests/test_routine_job.py` - new live test `test_gerar_instancias_du_fixo_offset_le_zero_real_previa_du2_case`
- `cli/tests/test_bizdays.py` - `_run()` dispatcher extended with `nthBusinessDayFromMonthEnd`
- `web/src/lib/bizdays.test.ts` - `Case` interface widened (`date` optional, `year`/`month` added); `run()` switch extended
- `shared/bizdays.testcases.json` - 5 new `nthBusinessDayFromMonthEnd` fixture cases
- `shared/routine-job.testcases.json` - `tpl-d` scenario corrected; new `tpl-n1` scenario added

## Decisions Made
- `nth_business_day_from_month_end` placed in `bizdays.py`/`.ts` (not alongside its siblings `nth_business_day_of_month`/`nth_calendar_day_of_month` in `routine_job.py`/`routineJob.ts`) per CONTEXT.md's explicit target — required a small private `lastDayOfMonth`/`calendar.monthrange` duplication in `bizdays.ts`/`.py` rather than importing from `routineJob.ts` (would have created a circular import, since `routineJob.ts` already imports FROM `bizdays.ts`).
- `_DU_FIXO_MIN_OFFSET_DIAS` set to a large negative sentinel (`-1_000_000`) rather than restructuring `_validate_offset_dias`'s signature — the real floor is `CalendarRangeError` (pre-existing, already caught per-template), so the sentinel is purely a "no meaningful floor beyond being an int" marker with zero signature change to `_compute_fixed_instances`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<verify>` blocks passed on first run with no auto-fixes needed.

## Issues Encountered
- `ruff format` required one reformat of the new live test's multi-line `run_cli(...)` call (auto-fixed via `uv run ruff format`, no logic change) — not a deviation, just normal formatting-gate friction, folded into Task 1's commit before it landed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- JOB-02 fully closed: `du_fixo` now represents the real onboarding calendar's "Prévia DU-2" templates, proven live against production InstantDB.
- `corrido_fixo` and `encadeado` are provably untouched — zero regression across 354 offline `cli/` tests (`pytest -m "not live and not packaging"`) and 101 `web/` bun tests.
- `git diff --stat` confirms this plan touched exactly the 10 files listed in `files_modified` — no accidental edit to schema, perms, or other generation types.
- Ready for Phase 27's remaining scope (JOB-01 status normalization, JOB-03 template name in `skipped`) in subsequent plans, or for `/gsd-verify-work`/phase transition if this is the phase's only plan.

---
*Phase: 27-robustez-do-job*
*Completed: 2026-08-14*

## Self-Check: PASSED

All 10 `files_modified` paths verified present on disk; both task commits (`f63f5ab`, `483891d`) verified present in `git log`.
