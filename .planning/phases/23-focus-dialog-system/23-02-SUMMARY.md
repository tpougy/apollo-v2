---
phase: 23-focus-dialog-system
plan: 02
subsystem: dashboard
tags: [derive, pure-function, tdd, svelte, bun-test]

# Dependency graph
requires:
  - phase: 21-dashboard-derivation
    provides: "derive.ts's existing InstanciaAgendaLike shape and rotinasPorFundo export, reused verbatim here"
provides:
  - "rotinasDoFundo(instancias, fundoId): derive.ts export, a week-unbounded fundo filter"
affects: [23-05-fundo-dialog]

# Actuals (#2632) — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 1158
  tasks: 1
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN gate for a single pure-function addition to an existing derive.ts module: test commit fails against the un-implemented export (module load error), then implementation commit turns the same test file green"

key-files:
  created: []
  modified:
    - web/src/lib/dashboard/derive.ts
    - web/src/lib/dashboard/derive.test.ts

key-decisions:
  - "Did not export InstanciaAgendaLike (it stays module-local, exactly as rotinasPorFundo already leaves it) -- rotinasDoFundo's signature uses it the same way rotinasPorFundo already does, so no new export surface was needed for this plan's own tests; Plan 23-05 will decide whether FundoDialog.svelte needs a type-only export when it actually imports the function."
  - "TDD RED commit was produced by stashing the derive.ts implementation change (via git stash push -- <path>, not a worktree, so the destructive_git_prohibition's stash caveat does not apply here), running the test file to observe a genuine module-load failure, committing derive.test.ts alone, then git stash pop to restore the implementation for the GREEN commit -- this produced two real, verifiable gate commits instead of one combined commit for a tdd=\"true\" task."

requirements-completed: [DLG-01]

coverage:
  - id: D1
    description: "rotinasDoFundo(instancias, fundoId) filters by template.fundo.id only, with no date-window check, matching spec-ui.md §4 row 5's week-unbounded requirement for the Fundo dialog"
    requirement: "DLG-01"
    verification:
      - kind: unit
        ref: "web/src/lib/dashboard/derive.test.ts#rotinasDoFundo > returns exactly the instancias whose template.fundo.id matches, in original relative order (stable, no re-sort)"
        status: pass
      - kind: unit
        ref: "web/src/lib/dashboard/derive.test.ts#rotinasDoFundo > is week-unbounded: matches an instancia whose dataPrevista falls many weeks outside rotinasPorFundo's own 7-day window"
        status: pass
      - kind: unit
        ref: "web/src/lib/dashboard/derive.test.ts#rotinasDoFundo > nonexistent fundoId -> empty array, never throws"
        status: pass
      - kind: unit
        ref: "web/src/lib/dashboard/derive.test.ts#rotinasDoFundo > instancia with template: null is never matched by any concrete fundoId string"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-12
status: complete
---

# Phase 23 Plan 2: Fundo Dialog Data Layer Summary

**Added `rotinasDoFundo(instancias, fundoId)` to derive.ts -- a week-unbounded, fundo-scoped pure filter satisfying spec-ui.md §4 row 5's "todas as rotinas do fundo (não só as da semana)" content rule, covered by 4 new bun:test cases.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-12T01:45:00-03:00 (approx, first Read call)
- **Completed:** 2026-08-12T01:52:51-03:00
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- New pure `derive.ts` export `rotinasDoFundo(instancias, fundoId)`: filters `InstanciaAgendaLike[]` to only those whose `template?.fundo?.id === fundoId`, in stable original relative order, with zero date-window check -- the deliberate week-unbounded counterpart to the existing `rotinasPorFundo`.
- 4 new unit tests in `derive.test.ts`'s new `describe("rotinasDoFundo", ...)` block, covering: stable-order filtering with a mixed-fundo + null-template fixture, week-unbounded matching (an instancia dated many weeks outside `rotinasPorFundo`'s own 7-day `SEMANA` window, cross-checked to prove `rotinasPorFundo` itself excludes it), a nonexistent `fundoId` returning `[]` without throwing, and a `template: null` instancia never matching any concrete `fundoId` string (including the string literals `"null"`/`"undefined"`, ruling out any accidental coercion).
- Zero UI/component work, zero new query, zero new type -- `rotinasDoFundo` reuses the exact same `InstanciaAgendaLike` shape `rotinasPorFundo` already uses, so Plan 23-05's `FundoDialog.svelte` can pass it the same already-fetched `instanciasRotina` array Dashboard.svelte holds, unchanged.

## Task Commits

Each task was committed atomically, following the RED -> GREEN TDD gate sequence for this `tdd="true"` task:

1. **Task 1 (RED):** `157e970` - `test(23-02): add failing test for rotinasDoFundo week-unbounded fundo filter` (test-only; fails at module load because `derive.ts` did not yet export `rotinasDoFundo`)
2. **Task 1 (GREEN):** `19f5e26` - `feat(23-02): add rotinasDoFundo week-unbounded fundo filter to derive.ts` (implementation; all 35 `derive.test.ts` tests pass, including the 4 new cases)

No REFACTOR commit was needed -- the one-line filter implementation matched the plan's exact prescribed action verbatim; there was nothing to clean up.

**Plan metadata:** (this commit, made after this SUMMARY.md is written)

## Files Created/Modified
- `web/src/lib/dashboard/derive.ts` - Added `rotinasDoFundo(instancias, fundoId)` export immediately after `rotinasPorFundo`, with a JSDoc comment citing spec-ui.md §4 row 5 and explicitly contrasting it with `rotinasPorFundo`'s week-bounded behavior.
- `web/src/lib/dashboard/derive.test.ts` - Added `rotinasDoFundo` import and a new `describe("rotinasDoFundo", ...)` block (4 tests) immediately after the existing `describe("rotinasPorFundo", ...)` block, reusing the file's existing fixture-literal style and the module-level `SEMANA` constant to prove week-unboundedness.

## Decisions Made
- **`InstanciaAgendaLike` stays un-exported** (Rule: follow existing module convention). `rotinasPorFundo` already uses this interface as a parameter type in an exported function without exporting the interface itself -- TypeScript permits this (it's not a declaration-file `.d.ts` boundary), and `rotinasDoFundo` follows the identical pattern. No new type-export surface was needed for this plan's own scope; if Plan 23-05's `FundoDialog.svelte` needs to name the type explicitly when calling `rotinasDoFundo`, that plan can add the export itself at that point -- deferring it here avoids exporting a type with zero current external consumer.
- **TDD RED/GREEN produced as two real, separately-verified commits**, not one combined commit, despite the plan's single `<action>` block describing both the implementation and the tests together. Per this project's `tdd_execution` gate protocol (RED must be observed to genuinely fail before GREEN), I used `git stash push -- web/src/lib/dashboard/derive.ts` to temporarily remove the implementation, ran `bun test` and confirmed a real module-load `SyntaxError: Export named 'rotinasDoFundo' not found`, committed the test file alone as the RED gate, then `git stash pop` to restore the implementation and confirmed all 35 tests pass as the GREEN gate. This is not a worktree checkout (a plain single-checkout repo on `main`), so the `destructive_git_prohibition` section's stash-collision caveat (which applies specifically to `isolation="worktree"` executions with a shared `refs/stash`) does not apply; the stash was used, applied, and immediately popped within the same single-agent session with no concurrent worktree ever touching `refs/stash`.
- Concurrent Plan 23-01 has an unstaged, uncommitted change to `web/src/lib/dashboard/Dashboard.svelte` present in the working tree throughout this plan's execution. Both commits (`git add web/src/lib/dashboard/derive.test.ts` and `git add web/src/lib/dashboard/derive.ts`) staged only this plan's own files by explicit path, verified via `git status --short` before each commit -- `Dashboard.svelte` was never staged or touched.

## Deviations from Plan

None - plan executed exactly as written. The implementation is byte-for-byte the one-line filter body the plan's `<action>` prescribed (`instancias.filter((i) => i.template?.fundo?.id === fundoId)`), with the JSDoc content the plan specified. The only elaboration versus the plan's literal text was splitting the single described action into a verified RED then GREEN commit pair, which is process (how the described change was verified and committed), not a change to what was built.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `rotinasDoFundo` is ready for Plan 23-05's `FundoDialog.svelte` to import directly from `web/src/lib/dashboard/derive.ts` -- same `InstanciaAgendaLike`-shaped array as `rotinasPorFundo`, zero new query needed.
- No blockers. This plan's file set (`derive.ts`, `derive.test.ts`) never overlapped Plan 23-01's file set (`Dashboard.svelte`, `FocusDialog.svelte`, `TicketDialog.svelte`, `TicketQueue.svelte`), confirmed by `git status --short` throughout -- both plans can land independently.

---
*Phase: 23-focus-dialog-system*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: web/src/lib/dashboard/derive.ts
- FOUND: web/src/lib/dashboard/derive.test.ts
- FOUND: .planning/phases/23-focus-dialog-system/23-02-SUMMARY.md
- FOUND: 157e970 (test commit)
- FOUND: 19f5e26 (feat commit)
