---
phase: 29-controle-de-geracao
plan: 01
subsystem: api
tags: [click, cli, cross-runtime-parity, instantdb, date-math]

# Dependency graph
requires:
  - phase: 28-periodicidade-semanal
    provides: "semanal tipoGeracao / diaSemana, weekly_occurrences/weeklyOccurrences already range_start/range_end-native (no today dependency to generalize)"
provides:
  - "months_in_range/monthsInRange: pure date-math generalization of the old today-derived, always-exactly-two-months candidate_months into every month intersecting an arbitrary [range_start, range_end]"
  - "compute_expected_instances/computeExpectedInstances's range_override/rangeOverride param — fully REPLACES (never intersects) the default [today, end_of_next_month(today)] window"
  - "apollo rotina gerar-instancias --competencia/--de/--ate CLI surface with mutex/format validation"
  - "shared/routine-job.testcases.json dayMath.monthsInRange (5 cases) + 3 rangeOverride-bearing scenarios"
affects: [routine-job-cli, routine-job-web-core]

# Actuals (#2632)
actuals:
  tokens: 9935
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Range override fully REPLACES the default window rather than intersecting it — the existing per-candidate range_start/range_end filter already downstream makes a replaced range work with zero other code change"
    - "click.UsageError mutex validation before any network call (mirrors subtarefa.py's _resolve_parent), keeping CLI validation errors at exit code 2 with zero query/write side effects"

key-files:
  created: []
  modified:
    - cli/apollo_cli/routine_job.py
    - cli/apollo_cli/entities/rotina.py
    - cli/tests/test_routine_job.py
    - web/src/lib/routineJob.ts
    - web/src/lib/routineJob.test.ts
    - shared/routine-job.testcases.json

key-decisions:
  - "The recorte fully REPLACES range_start/range_end rather than intersecting the default range — an intersection could never reach a date before today nor exclude the following month (both always inside the default range), so replacement was the only design that could satisfy Success Criteria 1 and 2 (D-01)"
  - "months_in_range/monthsInRange generalizes the old inline today-derived candidate_months computation; proven backward-compatible by construction and by the fixture's explicit equivalence case (D-02)"
  - "--competencia is documented as operating on the dataPrevista candidate range, NOT the resulting competencia field written to each instance (which can diverge via regraCompetencia M-1/M-2/M+1) — this nuance is spelled out in --help text and asserted by a grep for the word 'substitui' in the CLI help test (D-04)"
  - "_validate_competencia_format and _resolve_range_override stay private, rotina.py-local functions rather than moving into crud_helpers.py, per 29-CONTEXT.md's D-07 locked four-file scope (deliberate deviation from 29-PATTERNS.md's Analog B suggestion, documented inline in the plan's <context> block)"

patterns-established:
  - "A new pure date-math helper generalizing an existing inline computation gets placed immediately before its sole caller, is public/exported, and carries a docstring proving backward compatibility by construction — mirrors weekly_occurrences/weeklyOccurrences's own Phase 28 precedent"

requirements-completed: [RANGE-01]

coverage:
  - id: D1
    description: "apollo rotina gerar-instancias --competencia 2026-08 generates instances only within August 2026 for a real semanal+sexta template, with zero September date, proving the recorte never drags the following month (ROADMAP Success Criterion 1)"
    requirement: "RANGE-01"
    verification:
      - kind: integration
        ref: "cli/tests/test_routine_job.py#test_gerar_instancias_range_competencia_narrows_to_single_month_no_drag (live, against production InstantDB)"
        status: pass
    human_judgment: false
  - id: D2
    description: "apollo rotina gerar-instancias --de/--ate recovers an already-passed dataPrevista of the current month when run mid-month via --data-base, without disturbing an already-created next-month instance (ROADMAP Success Criterion 2)"
    requirement: "RANGE-01"
    verification:
      - kind: integration
        ref: "cli/tests/test_routine_job.py#test_gerar_instancias_range_de_ate_recovers_past_date_of_current_month (live, against production InstantDB)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A recorte run followed by a wider default-range run produces byte-identical dedupeKeys AND row ids for the overlapping instances — no duplication, no re-creation (ROADMAP Success Criteria 3/4, D-06)"
    requirement: "RANGE-01"
    verification:
      - kind: integration
        ref: "cli/tests/test_routine_job.py#test_gerar_instancias_range_idempotent_across_recorte_and_default_range (live, against production InstantDB)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every invalid --competencia/--de/--ate combination (mutex violation, one-sided --de/--ate, de > ate, malformed AAAA-MM) exits 2 with zero query/write executed"
    requirement: "RANGE-01"
    verification:
      - kind: unit
        ref: "cli/tests/test_routine_job.py#test_resolve_range_override_invalid_combinations_raise_usage_error"
        status: pass
      - kind: integration
        ref: "cli/tests/test_routine_job.py#test_gerar_instancias_invalid_range_flags_cli_exit_code_2"
        status: pass
      - kind: integration
        ref: "cli/tests/test_routine_job.py#test_gerar_instancias_competencia_malformed_format_exit_code_2"
        status: pass
    human_judgment: false
  - id: D5
    description: "Omitting all three flags preserves the exact pre-existing default range — every pre-existing gerar-instancias invocation and all 31 pre-existing shared fixture scenarios keep passing unmodified"
    requirement: "RANGE-01"
    verification:
      - kind: unit
        ref: "cli/tests/test_routine_job.py#test_scenario (all 31 pre-existing scenarios, no rangeOverride key, unaffected)"
        status: pass
    human_judgment: false
  - id: D6
    description: "web/src/lib/routineJob.ts mirrors the Python engine exactly for the new range-selection logic — dayMath.monthsInRange fixture cases and rangeOverride-bearing scenarios consumed identically by both offline test suites"
    requirement: "RANGE-01"
    verification:
      - kind: unit
        ref: "cli/tests/test_routine_job.py#test_months_in_range"
        status: pass
      - kind: unit
        ref: "web/src/lib/routineJob.test.ts#monthsInRange describe block"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-09-22
status: complete
---

# Phase 29 Plan 01: Controle de geração (RANGE-01) Summary

**`apollo rotina gerar-instancias --competencia`/`--de`/`--ate` replace the default `[today, end_of_next_month(today)]` window entirely, live-proven against production InstantDB for single-competência generation, mid-month recovery of already-passed dates, and byte-identical row/dedupeKey idempotency across recorte and default-range runs.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified:** 6

## Accomplishments

- Added `months_in_range(range_start, range_end)` (Python) / `monthsInRange(rangeStart, rangeEnd)` (TS): a pure, byte-parity generalization of `_compute_fixed_instances`'s old `today`-derived, always-exactly-two-months `candidate_months` into every calendar month intersecting an arbitrary window, proven backward compatible by construction and by a fixture equivalence case (D-02).
- Added `range_override: tuple[str, str] | None` / `rangeOverride?: [string, string]` to `compute_expected_instances`/`computeExpectedInstances`, which fully **REPLACES** (never intersects) the default `[today, end_of_next_month(today)]` window when supplied (D-01).
- Added `--competencia`, `--de`, `--ate` to `apollo rotina gerar-instancias` with `_resolve_range_override`'s XOR/mutex validation (mirrors `subtarefa.py`'s `_resolve_parent`) and `_validate_competencia_format`'s `AAAA-MM` regex callback — both raise `click.UsageError`/`click.BadParameter` (exit 2) strictly BEFORE `client_for_session()` is ever called, so an invalid combination triggers zero query/write.
- Threaded `range_override` through `run_routine_instance_job` unchanged in every other respect (Step 1/2/4/5/6 of the orchestration untouched — only Step 3's compute call gains the parameter).
- Live-proven, against the real production InstantDB app, all three of ROADMAP's Success Criteria (see "Live Proof Results" below).
- Mirrored the entire generalization into `web/src/lib/routineJob.ts` (`monthsInRange`, `computeExpectedInstances`'s `rangeOverride`) for cross-runtime parity (D-07/D-08) — no SPA caller supplies it yet (`gerar-instancias` has no SPA surface), this exists purely so the shared fixture continues proving byte-for-byte agreement between the two runtimes.
- Extended `shared/routine-job.testcases.json` with `dayMath.monthsInRange` (5 cases, values verified this session by direct execution of the real `routine_job.py` functions) and 3 new `rangeOverride`-bearing scenarios, consumed identically by both offline test suites.

## Live Proof Results (real production InstantDB app)

**Success Criterion 1 — single-competência generation, no drag:**
`apollo rotina gerar-instancias --competencia 2026-08` against a fresh `semanal`+`sexta` template produced EXACTLY `["2026-08-07", "2026-08-14", "2026-08-21", "2026-08-28"]` — 4 August Fridays, zero September date.

**Success Criterion 2 — mid-month recovery of an already-passed date:**
A `corrido_fixo` (`offsetDias=3`) template: run 1 (`--data-base 2026-08-15`, default range `[2026-08-15, 2026-09-30]`) created exactly one instance, `2026-09-03` (August's `2026-08-03` filtered out since `< 2026-08-15`). Run 2 (`--data-base 2026-08-15 --de 2026-08-01 --ate 2026-08-31`) created exactly one new dedupeKey, `...:2026-08:2026-08-03` — recovering the already-passed August date without disturbing the pre-existing September instance. Final state: exactly 2 rows, `["2026-08-03", "2026-09-03"]`.

**Success Criteria 3/4 — row-id-identical idempotency across recorte and default range (D-06):**
A fresh `semanal`+`sexta` template: run 1 (`--competencia 2026-08`) created exactly the 4 August Friday dedupeKeys; their row `id`s were captured. Run 2 (`--data-base 2026-08-01`, default range `[2026-08-01, 2026-09-30]`, covering both months) reported the same 4 August dedupeKeys as `existing` (byte-identical, zero re-creation) and created exactly 4 NEW September dedupeKeys. Final state: exactly 8 rows, zero duplicate dedupeKeys, and the 4 August rows' `id`s were IDENTICAL to those captured after run 1 — proving idempotency at the row level, not merely the dedupeKey level.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end range override — Python compute core, CLI flags, real live proof** - `c7d36a5` (feat)
2. **Task 2: TypeScript mirror + shared cross-runtime fixture (D-07/D-08)** - `c7a44e1` (feat)

_Note: no separate plan-metadata commit was made in this run — this SUMMARY/STATE/ROADMAP commit follows immediately after this document is written._

## Files Created/Modified

- `cli/apollo_cli/routine_job.py` - `months_in_range`, `_compute_fixed_instances`'s `today`-drop, `compute_expected_instances`'s/`run_routine_instance_job`'s `range_override` threading, RANGE-01 docstring paragraph
- `cli/apollo_cli/entities/rotina.py` - `_COMPETENCIA_RE`, `_validate_competencia_format`, `_resolve_range_override`, `--competencia`/`--de`/`--ate` options on `gerar-instancias`, extended docstring/help text
- `cli/tests/test_routine_job.py` - `months_in_range` import + `test_months_in_range`, `test_scenario`'s `range_override` passthrough, `_resolve_range_override` unit tests, CLI exit-code-2 validation tests, 3 live Success-Criteria proof tests
- `web/src/lib/routineJob.ts` - `monthsInRange`, `computeFixedInstances`'s `today`-drop, `computeExpectedInstances`'s `rangeOverride` param, RANGE-01 docstring paragraph
- `web/src/lib/routineJob.test.ts` - `monthsInRange` import + `MonthsInRangeCase`/`describe` block, `Scenario.rangeOverride` field + passthrough
- `shared/routine-job.testcases.json` - `dayMath.monthsInRange` (5 cases), 3 `rangeOverride`-bearing scenarios

## Decisions Made

- The recorte fully REPLACES `range_start`/`range_end` rather than intersecting the default range (D-01) — verified inline in the code above by the fact that every downstream branch already consumes `range_start`/`range_end` as plain local variables, so replacing them is a zero-other-change edit.
- `--competencia`'s `--help` text explicitly documents that it recortes the `dataPrevista` candidate range, NOT the resulting `competencia` field (D-04) — asserted by a grep for the literal word "substitui" in the extended help test.
- `_validate_competencia_format`/`_resolve_range_override` stay private and local to `rotina.py` rather than moving to `crud_helpers.py`, honoring 29-CONTEXT.md's D-07 locked four-file scope over 29-PATTERNS.md's Analog B suggestion (documented inline in the plan's own `<context>` block, so this was not a deviation I introduced — it was pre-decided by the plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deferred `months_in_range` import in `test_routine_job.py` from Task 1 to Task 2**
- **Found during:** Task 1, running the plan's own literal `<verify>` command (`ruff check ... tests/test_routine_job.py`)
- **Issue:** The plan's Task 1 action instructed adding `months_in_range` to the test file's import block "needed by Task 2, added now so Task 1's own ruff/ty gates do not need a second pass" — but no Task 1 test actually references `months_in_range` (only `_resolve_range_override`-related tests). This project's `ruff` config selects Pyflakes rules by default, so an unused import (F401) would have failed Task 1's own `ruff check` gate.
- **Fix:** Deferred adding the `months_in_range` import until Task 2, at the same time as `test_months_in_range` (its actual first usage). Task 1's own verify command was run and passed cleanly without it; Task 2 added it alongside its usage exactly as the plan specified for the import's *content*, just one commit later than the plan's literal instruction.
- **Files modified:** `cli/tests/test_routine_job.py`
- **Verification:** `uv run ruff check` passed cleanly in both Task 1 and Task 2 commits; `test_months_in_range` and all import-block tests pass.
- **Committed in:** `c7a44e1` (Task 2 commit)

**2. [Rule 1 - Bug] Filtered live idempotency test assertions to this test's own `template_id` prefix**
- **Found during:** Task 1, first live run of `test_gerar_instancias_range_idempotent_across_recorte_and_default_range`
- **Issue:** The production InstantDB app carries many other active `templatesRotina` from earlier phases' live tests. Run 2's unfiltered `gerar-instancias --data-base 2026-08-01` (no `--competencia`) queries and diffs ALL active templates for the authenticated user, so `report["existing"]`/`report["created"]` contained ~170 dedupeKeys belonging to unrelated templates, not just the 4 August keys from this test's own template — the plan's literal assertion (`sorted(report2["existing"]) == expected_august_keys`) failed with a large diff.
- **Fix:** Filtered every report-list assertion in this test to keys with a `f"{template_id}:"` prefix before comparing — exactly what the test intends to assert (this template's own idempotency), without being sensitive to unrelated concurrent production data. The underlying implementation and all other assertions (row-id equality, total count, zero duplicates) were unaffected.
- **Files modified:** `cli/tests/test_routine_job.py`
- **Verification:** Re-ran the live test after the fix — all 3 live Success-Criteria tests pass.
- **Committed in:** `c7d36a5` (Task 1 commit)

**3. [Rule 3 - Blocking] Created a worktree-local `.env.instantdb` marker to fix nested-worktree fixture-path resolution**
- **Found during:** Task 2, running `uv run pytest tests/test_routine_job.py -k "not live"` after adding `dayMath.monthsInRange`/`rangeOverride` scenarios to the shared fixture
- **Issue:** `apollo_cli.config.find_repo_root()` walks upward from the installed package's `__file__` location looking for `.env.instantdb`. This worktree is nested inside the main checkout at `.claude/worktrees/<agent-id>/` (no `.env.instantdb` at the worktree root), so the walk continued past the worktree root and resolved to the MAIN REPO's root — meaning `_FIXTURE_PATH = find_repo_root() / "shared" / "routine-job.testcases.json"` pointed at the main checkout's (stale, pre-Task-2) copy of the fixture, not this worktree's own edited copy. `test_months_in_range`/the 3 new scenario tests failed to collect (`KeyError: 'monthsInRange'`) purely because of this path-resolution mismatch, not any implementation bug.
- **Fix:** Wrote a worktree-local `.env.instantdb` containing only the single line `NEXT_PUBLIC_INSTANT_APP_ID=7936ca82-5cb4-43c2-811d-788a6ec0d2a8` — the exact same value as `apollo_cli.config._DEFAULT_APP_ID`, a constant already public in source and already shipped in the web bundle (per that module's own docstring). This file is `.gitignore`d (`.env.*` pattern, confirmed via `.gitignore`) and carries zero admin-token/secret content, so it introduces no functional change to live-test authentication (which reads the session file, not this config) — it only makes `find_repo_root()` stop at the worktree root instead of walking into the main checkout, so all `find_repo_root()`-based tests (not just this plan's) correctly read the worktree's own files.
- **Files modified:** `.env.instantdb` (new, gitignored, not committed)
- **Verification:** `find_repo_root()` confirmed to resolve to the worktree root after the fix; the full offline suite (101/101 in `test_routine_job.py`, 402/402 across the whole `cli/` project) and the live proofs re-ran cleanly afterward.
- **Committed in:** not committed (gitignored, left in place in the worktree for any subsequent verification runs in this same worktree; has zero effect on the branch that will be merged)

---

**Total deviations:** 3 auto-fixed (1 blocking/import-ordering, 1 bug/test-assertion-scope, 1 blocking/environment-path-resolution)
**Impact on plan:** All three were necessary to get the plan's own literal `<verify>` commands to actually pass in this execution environment; none touched the plan's design decisions (D-01 through D-09), the two runtimes' compute-core implementations, or the shared fixture's semantic content. No scope creep.

## Issues Encountered

None beyond the three deviations documented above.

## User Setup Required

None - no external service configuration required. (Live tests reused the persisted CLI session already available in this environment; no new credentials were introduced.)

## Next Phase Readiness

- RANGE-01 is fully implemented, live-proven, and cross-runtime-parity-proven. `apollo rotina gerar-instancias --competencia`/`--de`/`--ate` is ready for real operational use.
- No blockers for subsequent phases. `web/src/lib/routineJob.ts`'s `rangeOverride` param has no SPA caller yet (by design, D-07/D-08) — a future milestone adding a SPA surface for `gerar-instancias` can wire it directly without any further core-library change.

---
*Phase: 29-controle-de-geracao*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: `.planning/phases/29-controle-de-geracao/29-01-SUMMARY.md`
- FOUND: `cli/apollo_cli/routine_job.py`
- FOUND: `web/src/lib/routineJob.ts`
- FOUND: commit `c7d36a5` (Task 1)
- FOUND: commit `c7a44e1` (Task 2)
