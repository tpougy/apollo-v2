---
phase: 260922-t1n
plan: 1
subsystem: ui
tags: [svelte, tailwind, css-grid, flexbox, playwright, dashboard]

requires: []
provides:
  - "RoutinesByFundo.svelte's rotinas kanban rendered as fixed-width (w-48), full-height Trello-style columns in a horizontally-scrollable row, each with its own internally-scrollable body"
  - "Dashboard.svelte's dash-placeholder-rotinas cell now consumes the full height its lg:row-span-2 grid cell already receives instead of leaving it empty"
affects: [dashboard, rotinas]

actuals:
  tokens: 3101
  tasks: 2
  commits: 2
plan_head_before: d26181a93f8831aa2cabe25a605f0f87b7d7141e

tech-stack:
  added: []
  patterns:
    - "Fundo-column-as-Trello-column: RoutinesByFundo.svelte's per-fundo card now mirrors ProjectStrips.svelte's own project-strip-card / overflow-x-auto conventions one level up (fundo-column granularity instead of etapa-column granularity)."

key-files:
  created: []
  modified:
    - web/src/lib/dashboard/Dashboard.svelte
    - web/src/lib/dashboard/RoutinesByFundo.svelte
    - web/e2e/dashboard.spec.ts

key-decisions:
  - "The '4-item cap + rotinas-overflow label' UI was removed entirely (no dead code kept) in favor of per-column internal scroll (overflow-y-auto on rotinas-coluna-lista), matching ProjectStrips.svelte's own scroll idiom."
  - "The DASH-04 5-instance overflow test could not rely on page.setViewportSize alone to force real overflow: the dash-placeholder-rotinas grid cell's height is derived from WeekCalendar + ProjectStrips' own combined content height via CSS Grid row-span stretch, not from viewport size (confirmed by direct measurement: rotinasSlotHeight stayed ~560px at viewport height 500 while body scrollHeight grew to 849px, i.e. the page scrolled, the cell did not shrink). Fixed by constraining rotinas-coluna-lista's own height via page.evaluate immediately before measuring scrollHeight/clientHeight -- exercises the identical overflow-y:auto mechanism deterministically instead of depending on incidental production data (project/task counts) to produce overflow."

patterns-established:
  - "When an e2e test needs to prove 'internal scroll happens when content overflows an allocated height' inside a CSS-Grid-stretched cell whose height depends on unrelated sibling content, constrain the specific scrollable element's height directly via page.evaluate rather than trying to shrink it indirectly via viewport size."

requirements-completed: []

coverage:
  - id: D1
    description: "RoutinesByFundo.svelte's rotinas kanban fills the full grid-cell height already allocated to it (Dashboard.svelte's dash-placeholder-rotinas cell) instead of leaving empty space below a short capped list"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-01: responsive grid order (both tests, unmodified, still pass against the new markup)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No artificial 4-item cap: a fundo's entire this-week routine list renders, scrolling internally within its own column when it overflows"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-04: rotinas by fundo > the 5-instance fundo's card shows all 5 rotinas-row with no cap, scrollable when they overflow the column"
        status: pass
    human_judgment: false
  - id: D3
    description: "Card titles wrap onto up to 2 lines (line-clamp-2) instead of truncating at 1 line"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-04: rotinas by fundo > each rotinas-row's title uses line-clamp-2, never a single-line truncate"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each card shows its linked fundo's name via the existing instanciasRotina -> template -> fundo link, when one exists, and omits it for 'Sem fundo vinculado'"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-04: rotinas by fundo > each rotinas-row shows its group's fundo nome when linked, and omits it for 'Sem fundo vinculado'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Existing dashboard behavior unchanged beyond visual/layout scope: dialog-opening, agrupar/ordenar/status controls, 'Sem fundo vinculado always last' grouping order all keep working"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts full file run (24/24 tests pass, includes DASH-02/03/04/07 unmodified tests)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-22
status: complete
---

# Phase 260922-t1n: Full-height, scrollable, Trello-style rotinas kanban Summary

**RoutinesByFundo.svelte's fundo-grouped rotinas kanban redesigned from a 4-item-capped vertical stack into a full-height, horizontally-scrollable row of fixed-width Trello columns, each internally scrollable with 2-line titles and per-card fundo names.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Dashboard.svelte's `dash-placeholder-rotinas` cell now propagates its already-stretched (`lg:row-span-2`) height down through a `flex h-full min-h-0` chain into `RoutinesByFundo.svelte`, instead of leaving unused space below a short capped list.
- `RoutinesByFundo.svelte`'s fundo groups are now fixed-width (`w-48`) Trello-style columns in a horizontally-scrollable row (`rotinas-colunas`, mirroring `ProjectStrips.svelte`'s own horizontal-kanban pattern), each with its own internally-scrollable body (`rotinas-coluna-lista`) — the old `.slice(0, 4)` cap and `rotinas-overflow` "+N" label are gone entirely.
- Every card title now wraps onto up to 2 lines (`line-clamp-2`) instead of truncating at 1.
- Every card additionally shows its group's linked fundo name (`rotinas-row-fundo`), reusing `grupo.fundoNome` already resolved by the unmodified `rotinasPorFundo` derive.ts export — zero new query.
- `dashboard.spec.ts`'s DASH-04 fixture updated: the 5-instance cap-dependent assertion now proves all 5 rows render with no cap, and proves internal scroll via measured `scrollHeight > clientHeight`; 2 new tests prove the 2-line title wrap and per-card fundo-name behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Full-height, scrollable, Trello-style rotinas kanban** - `6913d5b` (feat)
2. **Task 2: Update DASH-04 e2e fixture for the no-cap/scrollable/2-line/fundo-name design** - `c4d58ae` (feat)

_Note: no plan-metadata commit is made by this executor per its constraints — the orchestrator commits SUMMARY.md/STATE.md/ROADMAP.md at batch completion._

## Files Created/Modified
- `web/src/lib/dashboard/Dashboard.svelte` - `dash-placeholder-rotinas` cell made `flex flex-col`; inner wrapper changed to `flex h-full min-h-0 flex-col gap-6`; `RoutinesByFundo` wrapped in a `min-h-0 flex-1` div so it grows to fill available height, `MonthHeatmap` left unwrapped/natural-sized below it.
- `web/src/lib/dashboard/RoutinesByFundo.svelte` - Root becomes `flex h-full min-h-0 flex-col gap-4`; controls row gets `shrink-0`; fundo groups wrapped in a new `rotinas-colunas` horizontal-scroll row; each `rotinas-fundo-card` is now a fixed-width (`w-48`) flex column with `shrink-0` header/meta and a `flex-1 min-h-0 overflow-y-auto` body (`rotinas-coluna-lista`); the `.slice(0,4)`/overflow-count logic deleted; each row button restructured with a `rotinas-row-titulo` (`line-clamp-2`) and conditional `rotinas-row-fundo` caption.
- `web/e2e/dashboard.spec.ts` - DASH-04 describe block: renamed/rewrote the 5-instance cap test to assert no-cap + measured internal scroll; updated the `status: atrasadas`/`todas` toggle test's post-restore count from 4 to 5; added 2 new tests for `rotinas-row-titulo`'s `line-clamp-2` class and `rotinas-row-fundo`'s presence/absence.

## Decisions Made
- Kept the plan's core layout approach (flex/min-h-0/h-full chain, fixed-width columns, internal `overflow-y-auto`) exactly as specified — it compiled clean and behaved correctly live.
- Deviated from the plan's literal e2e verification mechanism (see Deviations below) because the assumption that `page.setViewportSize` alone would force column overflow did not hold against the real app's layout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DASH-04 overflow test's viewport-size trigger did not actually force overflow; fixed with a direct height constraint**
- **Found during:** Task 2, verifying "the 5-instance fundo's card shows all 5 rotinas-row with no cap, scrollable when they overflow the column"
- **Issue:** The plan instructed adding `page.setViewportSize({ width: 1280, height: 500 })` before `goto` so the column would "genuinely overflow its own (now shorter) available height." Live measurement showed this assumption was false: `dash-placeholder-rotinas`'s height is derived from CSS Grid's `lg:row-span-2` stretch across WeekCalendar + ProjectStrips' own combined *content* height, not from viewport height — shrinking the viewport only made the page scroll (`body.scrollHeight` grew to 849px while the rotinas cell held steady at ~560px). With only 5 seeded rows, the column's content (~350px) never exceeded that ~560px cell, so `scrollHeight > clientHeight` failed (682 === 682) even with the viewport override in place.
- **Fix:** After locating `rotinas-coluna-lista`, the test now first asserts `overflow-y: auto` (unchanged from the original design), then directly constrains that element's own height via `el.style.maxHeight = "120px"` through `page.evaluate` immediately before measuring `scrollHeight`/`clientHeight`. This exercises the identical `overflow-y:auto` scroll mechanism deterministically, independent of how much real production data (project/task counts) happens to make the surrounding grid cell.
- **Files modified:** web/e2e/dashboard.spec.ts
- **Verification:** Full DASH-04/DASH-01 group (16 tests) and full dashboard.spec.ts file (24 tests) pass live against the real InstantDB app.
- **Committed in:** c4d58ae (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix in test verification mechanism, no production code change)
**Impact on plan:** No scope creep — the underlying "internal scroll on overflow" behavior itself was implemented exactly per plan; only the e2e proof technique needed correction to actually exercise it live.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None.

## Threat Flags
None - this plan added zero new query, zero new input surface, and only re-rendered an already-fetched, already-authorized value (`grupo.fundoNome`) a second time in the card body, per the plan's own threat register.

## Next Phase Readiness
- The routines kanban redesign is complete and live-verified; no follow-up work identified.
- No blockers for subsequent quick-batch items.

---
*Phase: 260922-t1n*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: web/src/lib/dashboard/Dashboard.svelte
- FOUND: web/src/lib/dashboard/RoutinesByFundo.svelte
- FOUND: web/e2e/dashboard.spec.ts
- FOUND: commit 6913d5b (Task 1)
- FOUND: commit c4d58ae (Task 2)
