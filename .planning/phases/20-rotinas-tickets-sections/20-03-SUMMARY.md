---
phase: 20-rotinas-tickets-sections
plan: 03
subsystem: ui
tags: [svelte5, playwright, instantdb, bits-ui, xorlink, e2e]

# Dependency graph
requires:
  - phase: 20-rotinas-tickets-sections
    provides: "SubtarefasPanel.svelte (parent-type-agnostic, DOM-driven xorLink create pre-resolution) built in Plan 20-01, reused verbatim here with zero new prop/branch"
provides:
  - "ProjetosSection.svelte's etapa-tarefa-subtarefas-chip is a real button opening a tarefa-scoped SubtarefasPanel"
  - "ProjetosSection.svelte's 'Todas as tarefas' tab rows open the same panel via click-delegation, giving an orphaned tarefa (no etapa) a reachable path to its subtarefas"
affects: [20-04, 20-05]

# Actuals (#2632)
actuals:
  tokens: 3647
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reused TicketsSection.svelte's click-delegation wrapper technique (Plan 20-01) a second time for a non-EntityScreen-native trigger: a plain <div data-testid=...> + closest('[data-testid=\"row\"]') walk, applied here to the 'Todas as tarefas' tab's EntityScreen(tarefasConfig) mount."

key-files:
  created: []
  modified:
    - web/src/lib/sections/ProjetosSection.svelte
    - web/e2e/projetos-section.spec.ts

key-decisions:
  - "Task 1 and Task 2 landed as two separate atomic commits even though both touch only ProjetosSection.svelte -- reconstructed via targeted Edit reverts/reapplies (not git stash, not hunk-splitting via git apply) so each commit's diff is exactly one task's scope, keeping svelte-check/lint green at each intermediate commit."
  - "The Task 1 <verify> command as literally specified in the plan (`-g \"subtarefa chip\"`) transiently fails when run in isolation immediately after Task 1, because it also matches the pre-existing Phase 19 assertion ('the chip is a passive Badge, never an interactive <button>') that Task 3 is explicitly scoped to remove. This is an inherent sequencing property of the plan's own 3-task split (wire the button, then fix the stale test), not a bug in Task 1's implementation -- confirmed by re-running the full spec file after Task 3 landed: all 17 tests pass, including that exact assertion (now inverted to expect a real button)."
  - "The second new e2e test (orphan-tarefa 'Todas as tarefas' reachability) reuses the existing tarefaOrfaId/tarefaOrfaTitulo fixture already created with no --etapa-id inside the 'Todas as tarefas / Sem etapa (NEST-03)' describe block, rather than creating a second, redundant orphan tarefa via a fresh CLI call as a literal reading of the plan's Task 3 text might suggest. The existing fixture is already exactly 'an orphan tarefa via the CLI, no --etapa-id, same fixture-prefix convention' -- reusing it avoids duplicate setup/teardown for an equivalent fixture and keeps the new test colocated with the fixtures it depends on (projetos-section.spec.ts:761-834's beforeAll)."

patterns-established: []

requirements-completed: [NEST-05]

coverage:
  - id: D1
    description: "Clicking a tarefa's subtarefa chip inside a project's open etapa opens SubtarefasPanel scoped to that tarefa, with a full create/delete round-trip through the panel"
    requirement: "NEST-05"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-05: etapa-detail subtarefa chip opens a SubtarefasPanel scoped to that tarefa, with create/delete round-trip via the panel"
        status: pass
    human_judgment: false
  - id: D2
    description: "The chip is a real, keyboard-activatable <button> (not a passive Badge), keeping data-testid=\"etapa-tarefa-subtarefas-chip\" on the outer button so the four pre-existing text-only assertions from Phase 19 keep passing unedited"
    requirement: "NEST-05"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: subtarefa chip shows the exact concluida/total count from the fixture (updated button-tag assertion)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An orphaned tarefa (no etapa), reachable only via 'Todas as tarefas', can open the same SubtarefasPanel and supports the same create/delete round-trip -- the escape hatch this tab exists for is not a dead end once the interim subtarefas nav route retires"
    requirement: "NEST-05"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-05: clicking an orphan tarefa's row in 'Todas as tarefas' opens SubtarefasPanel scoped to it -- the escape hatch is not a dead end"
        status: pass
    human_judgment: false
  - id: D4
    description: "EntityScreen.svelte and registry.ts remain byte-identical to their pre-Plan-20-03 state (plan-checker hardening requirement)"
    verification:
      - kind: other
        ref: "git diff --stat -- web/src/lib/entities/EntityScreen.svelte web/src/lib/entities/registry.ts (empty)"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-08-11
status: complete
---

# Phase 20 Plan 03: Tarefa-parented SubtarefasPanel wiring (Projetos) Summary

**Turned `ProjetosSection.svelte`'s inert Phase-19 subtarefa count chip into a real button that opens Plan 20-01's shared `SubtarefasPanel` scoped to that tarefa, and gave the "Todas as tarefas" tab's rows the identical affordance so an orphaned tarefa (no etapa) is never a dead end.**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-08-11T19:10:00-03:00 (context load, immediately following Plan 20-02's completion commit `180e86b`)
- **Completed:** 2026-08-11T19:43:19-03:00 (final task commit)
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments

- `ProjetosSection.svelte`'s `etapa-tarefa-subtarefas-chip` is now a real `<button type="button">` wrapping the unchanged `Badge` — `data-testid` stays on the outer button, so the four pre-existing text-only assertions from Phase 19 (`projetos-section.spec.ts:656,661,666,671` at the time of research) kept passing unedited. Clicking it toggles `activeSubtarefaTarefaId`, mounting `SubtarefasPanel(parentType="tarefa", parentId=tarefa.id, parentLabel=tarefa.titulo)` inline directly below that tarefa's row — the exact same component Plan 20-01 built for `TicketsSection`, reused with zero new prop and zero `if (etype === ...)` branch.
- The "Todas as tarefas" tab's `EntityScreen(tarefasConfig)` mount is now wrapped in a `data-testid="todas-tarefas-table"` click-delegation `<div>` (mirroring `TicketsSection.svelte`'s `handleTableClick` technique from Plan 20-01), so clicking any row — orphan or not, no special-casing — toggles `activeOrphanSubtarefaId`/`activeOrphanSubtarefaTitulo` and mounts the same `SubtarefasPanel` below the table. This is the only reachable path to an orphaned tarefa's subtarefas once this phase retires the interim `subtarefas` nav route.
- `projetos-section.spec.ts`: replaced the stale "chip is a passive Badge, never interactive" assertion with a positive `tagName === "button"` check; added two new NEST-05 tests (etapa-detail chip round-trip, and orphan-tarefa "Todas as tarefas" round-trip) proving the create dialog's `xor-parent-type`/`link-tarefa` are driven entirely by `SubtarefasPanel`'s own code, never touched by the test.
- Verified live that `EntityScreen.svelte` and `registry.ts` remain byte-identical to their pre-Plan-20-03 state (plan-checker's additional hardening check — empty `git diff --stat`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the etapa-detail subtarefa chip into a real button opening SubtarefasPanel scoped to that tarefa** — `f4afcf6` (feat)
2. **Task 2: Give the "Todas as tarefas" tab's rows the same panel-opening affordance (orphan-tarefa reachability)** — `bfd309e` (feat)
3. **Task 3: Update projetos-section.spec.ts for the now-interactive chip and the new orphan-reachability path** — `7153a59` (test)

**Plan metadata:** committed together with this SUMMARY (see Final Commit below).

## Files Created/Modified

- `web/src/lib/sections/ProjetosSection.svelte` — chip-to-button wiring (Task 1) + "Todas as tarefas" click-delegation wiring (Task 2), both mounting the shared `SubtarefasPanel` from Plan 20-01.
- `web/e2e/projetos-section.spec.ts` — updated NEST-02 button-tag assertion, plus two new NEST-05 tests.

## Decisions Made

1. **Task 1 and Task 2 committed as two separate atomic commits despite sharing one file.** Both tasks' code was written together during implementation (since they're small and interdependent — both wire into the same `SubtarefasPanel`), then split into two clean, task-scoped commits by targeted `Edit` reverts of Task 2's additions, committing Task 1 alone, then re-applying Task 2's additions via `Edit` and committing separately. This avoided `git stash`/manual hunk-splitting while still producing a git history where each commit's diff maps 1:1 to one plan task. `svelte-check`/`biome check` were re-run and confirmed green at both intermediate states.
2. **Task 1's own `<verify>` command, run in isolation right after Task 1, fails against the plan's literal text** — because `-g "subtarefa chip"` also matches the pre-existing Phase 19 test asserting the chip is "a passive Badge, never an interactive `<button>`," which Task 3 is explicitly scoped to fix. This is not a defect in Task 1's implementation: `svelte-check`, `biome check`, and a manual read of the rendered DOM all confirmed the button/panel wiring worked correctly at that point. The full spec file (all 17 tests, including the now-corrected assertion) was re-run after Task 3 landed and passes completely — the authoritative verification for this plan is the `<verification>` block's full-file run, which the plan's own task decomposition defers until after Task 3.
3. **The orphan-reachability test reuses the existing `tarefaOrfaId`/`tarefaOrfaTitulo` fixture** from the `"Todas as tarefas / Sem etapa (NEST-03)"` describe block's own `beforeAll` (already created via the CLI with no `--etapa-id`) instead of minting a second, redundant orphan tarefa. This is functionally identical to what a literal reading of Task 3's action text describes and avoids duplicate setup/teardown.

## Deviations from Plan

None — plan executed exactly as written, aside from the two documented judgment calls above (both are executor discretion on *how* to sequence commits and *which* fixture to reuse, not changes to behavior, scope, or architecture).

### Out-of-scope discovery (logged, not fixed)

While running the broader regression suite (`cross-phase-verification.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts`, `shell-nav.spec.ts`, `tickets-section.spec.ts`) beyond this plan's own `<verify>`/`<verification>` commands, one pre-existing failure was found:

- `cross-phase-verification.spec.ts`'s `"VERIFY-05: keyboard/focus-visible smoke -- instanciasRotina..."` test fails (`Expected: "row-edit"`, `Received: "rotinas-tab-instancias"`) because Plan 20-02 (already committed as `eb75e74`/`1c7d1bc`/`180e86b` before this plan started) added `RotinasSection.svelte`'s new `Tabs.Root` between the nav bar and the `EntityScreen(instanciasRotina)` table, adding one Tab-stop this test's fixed Tab-press-count math does not account for. Confirmed this is unrelated to Plan 20-03's diff: neither `RotinasSection.svelte` nor `cross-phase-verification.spec.ts` is in Plan 20-03's `files_modified`, and the failing test never navigates to `nav-projetos`/`ProjetosSection` at all.
- Logged to `.planning/phases/20-rotinas-tickets-sections/deferred-items.md` (DEF-01) per the deviation rules' scope-boundary guidance ("Only auto-fix issues DIRECTLY caused by the current task's changes... log out-of-scope discoveries, do NOT fix them"). Flagged for the phase's regression-proof wave or a follow-up plan.

## Issues Encountered

- The very first full-suite run of `projetos-section.spec.ts` (before any code was wrong) returned 17 `net::ERR_CONNECTION_REFUSED` failures — a transient dev-server startup race from an immediately-prior interactive `-g` run against the same port, not a real regression. Confirmed by killing any stray process (none found) and re-running cleanly: all 17 tests passed on the very next attempt, and every subsequent run (3 more full-suite runs across this session) was consistently green.

## Hardening Check (plan-checker requirement)

```
$ git diff --stat -- web/src/lib/entities/EntityScreen.svelte web/src/lib/entities/registry.ts
(empty output)
```

Confirmed empty after all three task commits — neither file was touched at any point in this plan's execution.

## Regression Verification

Beyond the plan's own `<verify>`/`<verification>` commands, also ran (all pass except the one logged, out-of-scope DEF-01 above):
- `bun run check` (svelte-check + tsc) — 0 errors (1 pre-existing, unrelated warning in `EntityScreen.svelte:45`, same as documented in 20-01-SUMMARY.md)
- `bun run lint` (biome check) — 0 errors (1 pre-existing, unrelated info in `calendar-caption.svelte:50`)
- `bunx playwright test projetos-section.spec.ts --project=authed --no-deps` — 17/17 pass (run 2x for confidence, both green)
- `bunx playwright test shell-nav.spec.ts tickets-section.spec.ts --project=authed --no-deps` — 9/9 pass
- `bunx playwright test entities-ticket-subtarefa.spec.ts entities-projeto-etapa-tarefa.spec.ts --project=authed --no-deps` — 10/10 pass
- `bunx playwright test cross-phase-verification.spec.ts --project=authed --no-deps` — 8/9 pass (1 failure, DEF-01, out of scope — see above)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both halves of `NEST-05`'s tarefa-parented path are now live: the etapa-detail chip and the "Todas as tarefas" escape hatch each open the shared `SubtarefasPanel` with zero new prop/branch added to it.
- Plan 20-04/20-05 (retiring the interim `subtarefas` nav route and rewriting `entities-ticket-subtarefa.spec.ts`'s 6 call sites per 20-RESEARCH.md Pitfall 3) can now proceed knowing BOTH concrete-parent panel-opening paths (ticket via Plan 20-01, tarefa via this plan) are proven live, including orphan-tarefa reachability — no dead end is introduced once that interim route is removed.
- DEF-01 (a pre-existing `cross-phase-verification.spec.ts` Tab-count regression from Plan 20-02, unrelated to this plan) remains open in `.planning/phases/20-rotinas-tickets-sections/deferred-items.md` for a future plan or the phase's regression-proof wave to fix.

## Self-Check: PASSED

All claimed files exist on disk and all task commit hashes resolve in `git log --oneline --all`:
- FOUND: `web/src/lib/sections/ProjetosSection.svelte`
- FOUND: `web/e2e/projetos-section.spec.ts`
- FOUND: `.planning/phases/20-rotinas-tickets-sections/deferred-items.md`
- FOUND: `f4afcf6` (Task 1 commit)
- FOUND: `bfd309e` (Task 2 commit)
- FOUND: `7153a59` (Task 3 commit)

---
*Phase: 20-rotinas-tickets-sections*
*Completed: 2026-08-11*
