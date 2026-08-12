---
phase: 23-focus-dialog-system
plan: 07
subsystem: testing
tags: [svelte5, bits-ui, dialog, playwright, biome, accessibility, e2e]

# Dependency graph
requires:
  - phase: 23-01
    provides: "FocusDialog.svelte chrome wrapper, Dashboard.svelte's dialogStack mechanism -- this plan asserts against it, introduces zero new code"
  - phase: 23-02
    provides: "derive.ts's rotinasDoFundo -- indirectly exercised via the Fundo dialog surfaces this plan sweeps"
  - phase: 23-03
    provides: "TaskDialog.svelte/EtapaDialog.svelte, ProjetosSection.svelte's etapa-kanban-column/-card <button>-in-<button> conversion -- this plan's own re-verification target"
  - phase: 23-04
    provides: "DayDialog.svelte/RotinaDialog.svelte, full WeekCalendar/MonthHeatmap wiring"
  - phase: 23-05
    provides: "FundoDialog.svelte, RoutinesByFundo.svelte/ProjectStrips.svelte fundo-targeting wiring"
  - phase: 23-06
    provides: "ProjectDialog.svelte (second depth-2 launch point), ProjectStrips.svelte's remaining 3 buttons, dashboardQuery.ts subtarefas fix"
provides:
  - "web/e2e/focus-dialog-button-inventory.spec.ts: consolidated proof that all 16 inventoried DLG-02 click targets are real, keyboard-accessible <button>s"
  - "Live-browser proof (via real Tab-key traversal, not just .focus()) that ProjetosSection.svelte's etapa-kanban-column/etapa-kanban-card nested <button>-in-<button> structure is genuinely keyboard-reachable, independently activatable, and stopPropagation-correct -- confirming 23-03-SUMMARY.md's no-SSR reasoning holds in this exact codebase"
  - "Depth-cap-2 swap-in-place invariant proven live for BOTH first-level launch points (Projeto->Etapa/Tarefa, Dia->item)"
  - "bun run lint closed to green (was never gated by any of Plans 23-01/23-03/23-06's own <verify> blocks) -- import-order/formatting fixes only, zero behavior change"
  - "Phase 23's final consolidated regression gate: 3 full Playwright suite runs (all `authed` project, 150 tests each) plus the `anon`/`setup` projects, bun test src (174 tests), bun run check (0 errors), bun run lint (0 errors) -- all green"
affects: []

# Actuals (#2632)
actuals:
  tokens: 8700
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Consolidated cross-plan completeness sweep: one INVENTORY table + 5 tests asserting against testids every prior plan already wired, never re-deriving each plan's own narrower content proofs -- the phase's dedicated closure of RESEARCH.md's own stated completeness risk"
    - "Live Tab-key-traversal proof (document.activeElement inspection across successive page.keyboard.press('Tab') calls) as the rigorous alternative to .focus()-based keyboard tests, used specifically to re-verify a documented, deliberate HTML content-model exception (nested <button>-in-<button>)"

key-files:
  created:
    - web/e2e/focus-dialog-button-inventory.spec.ts
  modified:
    - web/src/lib/dashboard/dialogs/EtapaDialog.svelte
    - web/src/lib/dashboard/dialogs/ProjectDialog.svelte
    - web/src/lib/dashboard/dialogs/TaskDialog.svelte
    - web/e2e/focus-dialog-projeto.spec.ts
    - web/e2e/focus-dialog-projetos-kanban.spec.ts

key-decisions:
  - "Re-examined 23-03's documented literal nested <button>-in-<button> choice (etapa-kanban-column/etapa-kanban-card) live, in a real browser via Playwright, per this session's explicit instruction: confirmed the no-SSR reasoning (web/index.html is a plain Vite SPA, web/src/main.ts calls Svelte 5's mount() against an empty div, never any string-based render/hydration path) genuinely holds -- both nested buttons are real DOM descendants, independently Tab-reachable in natural source order, and independently keyboard-activatable (Enter on the focused inner card opens the Tarefa dialog, never the Etapa dialog, with stopPropagation correctly suppressing the outer handler for a keyboard-synthesized click exactly as it does for a mouse click). No fix was needed -- confirmed genuinely fine, not just structurally plausible."
  - "bun run lint (not part of this plan's own Task 2 <verify>, but explicitly requested for this session) failed with 5 blocking errors, none in this plan's own new file -- all 5 were accumulated import-order/formatting debt in Plans 23-01/23-03/23-06's own files, never gated by any of those plans' own <verify> blocks (each used bun run check + Playwright only). Treated as this plan's own responsibility to close since it is the phase's final consolidated gate before milestone completion: fixed via biome's safe --write fixer (pure import-order/formatting, zero behavior change, verified via bun run check staying at 0 errors and re-running every touched spec file green) plus one manual fix to this plan's own useOptionalChain warning (biome flagged it unsafe, though behavior-equivalent here). Left the 2 already-documented, deliberate non-null-assertion warnings in ProjectStrips.svelte/RoutinesByFundo.svelte (23-05-SUMMARY.md) and the 1 unrelated vendored shadcn-svelte info-level warning in calendar-caption.svelte untouched."
  - "4 distinct pre-existing tests flaked exactly once each across 3 full-suite runs, in 4 different files, none touched by this phase (dashboard-kanbans.spec.ts's collapse-persistence localStorage-key-count test; projetos-section.spec.ts's 'editar projeto' hidden-EntityScreen-host test; routine-job-cross-channel.spec.ts's second CLI call, with an explicit SSL handshake timeout error identical to 23-05/23-06-SUMMARY.md's already-documented transient network flake; tickets-section.spec.ts's xor-link Select value). Every one reproduced passing in isolation and in the third, fully clean 150/150 full-suite run -- confirmed as live-backend/resource-contention timing races under sequential single-worker execution against the real hosted InstantDB app, not regressions from this phase's edits. login-flow.spec.ts's magic-code timing test (the `anon` project) also flaked once, exactly matching STATE.md's own already-documented pre-existing flake (predating Phase 10) -- reproduced passing in isolation."

patterns-established: []

requirements-completed: [DLG-02, DLG-03]

coverage:
  - id: D1
    description: "All 16 inventoried DLG-02 click targets (14 from 23-RESEARCH.md's original inventory + 2 additive ProjetosSection.svelte list-view targets) are real <button> elements"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-button-inventory.spec.ts#(a) all 16 inventoried targets resolve to a real <button> element"
        status: pass
    human_judgment: false
  - id: D2
    description: "Keyboard reachability (Tab/.focus()) and activation (Enter/Space) work correctly across a representative target from each of the 5 host files, opening the identical dialog a mouse click would"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-button-inventory.spec.ts#(b) keyboard reachability and activation across all 5 host files"
        status: pass
    human_judgment: false
  - id: D3
    description: "Depth-cap-2 swap-in-place invariant (never two simultaneously visible Dialog.Content) holds for both first-level launch points, Projeto->Etapa/Tarefa and Dia->item"
    requirement: "DLG-03"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-button-inventory.spec.ts#(c) never two simultaneously visible Dialog.Content, across both depth-2 launch points"
        status: pass
    human_judgment: false
  - id: D4
    description: "The original div-based etapa-kanban-column/etapa-kanban-card selectors (pre-23-03 markup) now match zero elements -- the <div>-to-<button> conversion is total, not partial/duplicated"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-button-inventory.spec.ts#(d) the original div-based etapa-kanban-column/etapa-kanban-card selectors now match zero elements"
        status: pass
    human_judgment: false
  - id: D5
    description: "23-03's nested <button>-in-<button> design choice is genuinely Tab-reachable (real Tab-key traversal, not just .focus()) and independently keyboard-activatable with correct stopPropagation, confirming the no-SSR reasoning holds live"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-button-inventory.spec.ts#(e) etapa-kanban-column/etapa-kanban-card nested-button structure is genuinely Tab-reachable and independently keyboard-activatable (no-SSR reasoning verification)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The entire pre-existing Playwright suite (all `authed`-project spec files) plus every focus-dialog-*.spec.ts file this phase added passes together, with zero regression attributable to this phase's edits"
    requirement: "DLG-02, DLG-03"
    verification:
      - kind: e2e
        ref: "3 full `bunx playwright test --project=authed --no-deps` runs (150 tests each); run 3 fully green (150/150); runs 1-2's 4 distinct flakes each confirmed passing in isolation, all in files untouched by this phase"
        status: pass
      - kind: e2e
        ref: "bunx playwright test --project=setup --project=anon (9 tests); 1 documented pre-existing flake (login-flow.spec.ts magic-code timing, STATE.md-logged since Phase 10) confirmed passing in isolation"
        status: pass
      - kind: unit
        ref: "cd web && bun test src (174 tests, 0 fail)"
        status: pass
      - kind: other
        ref: "cd web && bun run check (0 errors, 2 pre-existing documented warnings)"
        status: pass
      - kind: other
        ref: "cd web && bun run lint (0 errors after closing accumulated Plans 23-01/23-03/23-06 import-order/formatting debt; 3 pre-existing documented warnings + 1 unrelated vendored-file info remain)"
        status: pass
    human_judgment: false

duration: 65min
completed: 2026-08-12
status: complete
---

# Phase 23 Plan 7: Consolidated Completeness Sweep + Final Milestone Gate Summary

**Consolidated 5-test Playwright spec (`focus-dialog-button-inventory.spec.ts`) proving all 16 inventoried DLG-02 click targets are real keyboard-accessible buttons, depth-cap-2 holds live at both launch points, and Plan 23-03's nested-button design choice is genuinely Tab-reachable/keyboard-activatable in a live browser -- closing out Phase 23 and the entire v1.3 milestone's functional scope with 3 full green Playwright suite runs, `bun test src`, `bun run check`, and a newly-closed `bun run lint`.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-08-12T03:22:00-03:00 (approx.)
- **Completed:** 2026-08-12T04:27:00-03:00
- **Tasks:** 2
- **Files modified:** 6 (1 created spec, 5 modified for lint cleanup)

## Accomplishments

- `web/e2e/focus-dialog-button-inventory.spec.ts`: 5 new tests. (a) all 16 inventoried testids resolve to `tagName === "button"` across all 4 navigation contexts (dashboard-direct, weekend popover, projetos-kanban, projetos-lista). (b) keyboard reachability/activation verified for a representative target from each of the 5 host files (`dash-ticket-card` via Space, `dash-week-day-header`/`project-strip-nome`/`rotinas-fundo-titulo`/`etapa-kanban-column` via Enter), each opening the identical dialog a mouse click would. (c) the depth-cap-2 swap-in-place invariant (`page.locator('[role="dialog"]')` count exactly 1 at every step) proven live for both Projeto->Etapa->back->Tarefa->back and Dia->item->back. (d) the original pre-23-03 `div[data-testid="etapa-kanban-column"/"etapa-kanban-card"]` selectors now resolve to zero elements. (e) a dedicated live re-verification of 23-03's documented nested `<button>`-in-`<button>` choice: structural DOM containment confirmed via `closest()`, genuine Tab-key traversal confirmed reaching the column then the nested card in natural source order (not just `.focus()`), and keyboard Enter activation confirmed independently correct on both the outer column (opens Etapa) and inner card (opens Tarefa, never Etapa, exactly one dialog) -- proving `stopPropagation` works identically for keyboard-synthesized and mouse-triggered clicks.
- Closed `bun run lint`'s accumulated debt from Plans 23-01/23-03/23-06 (never previously gated) via safe, zero-behavior-change biome fixes (import ordering, string-quote/line-wrap formatting).
- Ran the full pre-existing + all-6-prior-plans' Playwright suite 3 times (`authed` project, 150 tests each) -- the third run (post-lint-fix) is fully clean, 150/150. Also ran the `setup`+`anon` projects (9 tests), 1 documented pre-existing flake reproduced passing in isolation. `bun test src` (174/174) and `bun run check` (0 errors) both green throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Consolidated button-inventory + keyboard-accessibility + depth-cap-2 sweep** - `5eb31bb` (test)
2. **Task 2 fix-forward: close bun run lint debt accumulated across Plans 23-01/23-03/23-06** - `62d7f8c` (chore)

Task 2 itself (full-suite regression run) produced no additional code changes beyond the lint-debt commit above -- it is a verification task; its `<done>` criterion is satisfied by the 3 full-suite runs, `bun test src`, and `bun run check` documented below, all passing, with zero further source changes needed.

**Plan metadata:** (pending -- this SUMMARY's own commit)

## Files Created/Modified

- `web/e2e/focus-dialog-button-inventory.spec.ts` - new consolidated completeness/regression spec (new)
- `web/src/lib/dashboard/dialogs/EtapaDialog.svelte` - import order only (lint fix, Plan 23-03's file)
- `web/src/lib/dashboard/dialogs/ProjectDialog.svelte` - import order only (lint fix, Plan 23-06's file)
- `web/src/lib/dashboard/dialogs/TaskDialog.svelte` - import order only (lint fix, Plan 23-03's file)
- `web/e2e/focus-dialog-projeto.spec.ts` - formatting only (lint fix, Plan 23-06's file)
- `web/e2e/focus-dialog-projetos-kanban.spec.ts` - formatting only (lint fix, Plan 23-03's file)

## Decisions Made

- Built the INVENTORY table and Test A/B/C/D/E structure exactly per the plan's own explicit action text, adding one extra test (E) beyond the plan's literal 4-test description (A/B/C/D) to satisfy this session's explicit additional instruction to re-examine and live-verify 23-03's nested-button reasoning.
- Fixture design: one fundo, one projeto with 2 etapas (one with 2 tarefas, one with 0 -- matching the plan's literal fixture description), one ticket dated the current week's Monday (covers both `dash-ticket-card`, date-agnostic, and `dash-week-item`), and two rotina instances (one Tuesday for `rotinas-fundo-titulo`/`rotinas-row`/`dash-week-item` tipo=rotina, one Saturday for the weekend-popover testids) -- the plan's own text names only "a rotina instance dated this week" but its own annotation instruction ("annotate ... which ones require the weekend popover ... to be opened first") makes a weekend-dated item structurally necessary to reach 2 of the 16 testids, so a second instance was added to satisfy that same paragraph's own requirement.
- Ambiguity resolution (`bun run lint`, not named in this plan's own `<verify>` block but explicitly requested this session): see key-decisions above -- resolved in favor of closing the debt now, at the phase's own final consolidated gate, rather than deferring it past milestone completion, since every fix was safe/mechanical/zero-behavior and re-verified via `bun run check` + re-running every touched spec.
- The nested-button re-verification (Test E) is additive proof, not a correction -- 23-03-SUMMARY.md's original reasoning was confirmed correct live, so no source-code fix was applied to `ProjetosSection.svelte` itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing correctness/hygiene requirement, milestone-closing gate] Closed accumulated `bun run lint` debt from Plans 23-01/23-03/23-06**
- **Found during:** Task 2 (running `bun run lint` per this session's explicit final-gate instruction, beyond the plan's own `<verify>` text)
- **Issue:** `bun run lint` failed with 5 blocking errors (import-order in `EtapaDialog.svelte`/`ProjectDialog.svelte`/`TaskDialog.svelte`, formatting in `focus-dialog-projeto.spec.ts`/`focus-dialog-projetos-kanban.spec.ts`) plus this plan's own 2 new warnings (`useConst`/`useOptionalChain` in the new spec file) -- none of Plans 23-01 through 23-06 ever ran `bun run lint` as part of their own verification gate.
- **Fix:** `bun run lint:fix` (biome's safe `--write`) applied all import-order/formatting fixes automatically; the one remaining `useOptionalChain` warning in this plan's own file (flagged "unsafe" by biome, though behavior-equivalent in this specific context) was applied manually. Left the 2 documented, deliberate non-null-assertion warnings (23-05-SUMMARY.md) and 1 unrelated vendored shadcn-svelte info-level warning untouched.
- **Files modified:** `web/src/lib/dashboard/dialogs/{EtapaDialog,ProjectDialog,TaskDialog}.svelte`, `web/e2e/{focus-dialog-projeto,focus-dialog-projetos-kanban,focus-dialog-button-inventory}.spec.ts`
- **Verification:** `bun run lint` exit code 0; `bun run check` unchanged (0 errors, same 2 pre-existing warnings); every touched spec file re-run individually, all green; the affected new spec's own 5-test file re-run twice, all green.
- **Committed in:** `62d7f8c` (chore commit, separate from Task 1's own commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 -- milestone-closing lint-debt cleanup, zero behavior change, fully re-verified).
**Impact on plan:** No scope creep to this plan's own new code; the fix touches 5 files from earlier plans but only their import order/formatting, with zero logic change and full re-verification. This plan's own new spec file needed 2 of its own trivial fixes (in scope, mandatory).

## Issues Encountered

- 4 distinct pre-existing tests flaked exactly once each, across 2 full `authed`-project suite runs (run 1: `dashboard-kanbans.spec.ts`'s collapse-persistence test, `projetos-section.spec.ts`'s "editar projeto" test; run 2: `routine-job-cross-channel.spec.ts`'s second CLI-generation test with an explicit `_ssl.c:993` handshake timeout, `tickets-section.spec.ts`'s xor-link Select test). None of the 4 files were touched by this phase's edits (Dashboard.svelte, WeekCalendar.svelte, TicketQueue.svelte, ProjectStrips.svelte, RoutinesByFundo.svelte, MonthHeatmap.svelte, ProjetosSection.svelte, dashboardQuery.ts). All 4 reproduced passing in isolation, and the third full-suite run (post-lint-fix) was fully clean, 150/150 -- confirming these are live-backend resource-contention timing races under 150-test sequential single-worker execution, the same class of flake 23-05-SUMMARY.md and 23-06-SUMMARY.md both independently documented (`_ssl.c:993` handshake timeout).
- `login-flow.spec.ts`'s magic-code round-trip test (the `anon` project) also flaked once -- this is STATE.md's own already-documented pre-existing flake ("Occasional live-email-timing test flake (magic-code round trip) | Deferred — non-blocking, pre-existing | v1.1 close", predating Phase 10 per Phase 20's own phase-gate note). Reproduced passing in isolation.
- Every one of Task 1's own `<verify>` runs passed on the first attempt (twice in a row, confirming zero flakiness in the new spec itself).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 23 is the last functional phase of milestone v1.3. This plan closes it. No further phases are planned; next step is the milestone-level audit -> complete -> tag v1.3 sequence per `23-CONTEXT.md`'s own `<deferred>` section.

**Overall assessment of Phase 23's 4 ROADMAP success criteria (all 7 plans, end-to-end):**

1. **All 7 dialogs at 3 widths (S/M/L) with correct chrome** -- MET. `FocusDialog.svelte` (23-01) is the single shared chrome wrapper every one of the 7 dialogs (Ticket M, Dia M, Tarefa S, Projeto L, Fundo M, Etapa M, Rotina S) wraps unmodified; each width class asserted directly in this plan's own tests (b)/(c) and in every prior plan's own spec.
2. **Every Dashboard/section surface named in spec §4 is a real, keyboard-accessible button opening the correct dialog** -- MET. This plan's consolidated Test A/B prove all 16 inventoried targets (the original 14 plus the 2 additive ProjetosSection.svelte list-view targets) are real `<button>`s, keyboard-reachable and activatable, opening the correct dialog kind -- in one run, independent of each prior plan's own narrower coverage.
3. **No dialog ever opens a third level** -- MET. Depth-cap-2's swap-in-place invariant (never two simultaneous `Dialog.Content`s) is proven live for both structural launch points (Projeto->Etapa/Tarefa, Dia->item) in this plan's Test C; every other dialog kind (Ticket/Fundo/Etapa/Tarefa/Rotina) has no dialog-opening affordance in its own body by construction (verified across Plans 23-01/23-03/23-04/23-05).
4. **Esc/click-outside/×/fechar close except while busy; destructive actions stay in AlertDialog** -- MET (via the phase's earlier plans; not re-derived here per this plan's own stated scope). `FocusDialog.svelte`'s `escapeKeydownBehavior={busy ? "ignore" : "close"}` is the one shared idiom every dialog inherits (23-01), individually proven per-dialog in `focus-dialog-ticket.spec.ts`; destructive actions only ever occur inside the driven `EntityScreen` edit form, whose own unmodified `AlertDialog` behavior was never touched by this phase.

All 4 criteria are provable by the combination of this plan's own consolidated spec plus the 6 prior plans' own specs, all passing together in the same suite run (this plan's own Task 2 gate).

**Is the entire v1.3 milestone's functional scope (Phases 18-23) now complete?**

Based on this phase's own gate (green across 3 full Playwright runs, `bun test src`, `bun run check`, and a newly-closed `bun run lint`) and the fact that Phase 23 was the last of 6 phases (18-23) in v1.3's ROADMAP with zero remaining plans in any phase's manifest, the functional scope of v1.3 (6-section topbar navigation, `EntityScreen` extension, nested Projetos/Rotinas/Tickets sections, the Dashboard landing screen with week calendar/ticket queue/rotinas-by-fundo/heatmap/mini-kanbans, and the 7-dialog Focus Dialog System) is functionally complete. This SUMMARY does not itself constitute the milestone audit (`/gsd-audit-milestone` or equivalent) -- that is the explicit next step per `23-CONTEXT.md`'s own deferred-ideas note, and is out of this plan's own scope.

---
*Phase: 23-focus-dialog-system*
*Completed: 2026-08-12*

## Self-Check: PASSED
- FOUND: web/e2e/focus-dialog-button-inventory.spec.ts
- FOUND: .planning/phases/23-focus-dialog-system/23-07-SUMMARY.md
- FOUND: 5eb31bb (Task 1 commit)
- FOUND: 62d7f8c (lint-debt fix-forward commit)
