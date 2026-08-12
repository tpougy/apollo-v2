---
phase: 23-focus-dialog-system
plan: 04
subsystem: ui
tags: [svelte5, bits-ui, dialog, entityscreen, dashboard, calendar, playwright]

# Dependency graph
requires:
  - phase: 23-01
    provides: "FocusDialog.svelte's shared S/M/L chrome wrapper; Dashboard.svelte's dialogStack/DialogKind/openDialog/popToFirst/closeAllDialogs/activeDialogRef/breadcrumbRef mechanism; the self-contained-dialog-component pattern"
  - phase: 23-03
    provides: "TaskDialog.svelte (S), reused unmodified from Dashboard.svelte in this plan"
provides:
  - "DayDialog.svelte: dialog #2 of 7 (M), the one dialog with no underlying entity -- footer offers only 'ir para esta semana' + fechar, no editar/ver-pagina"
  - "RotinaDialog.svelte: dialog #7 of 7 (S), status-only editar inherited for free from EntityScreen's existing editableFields() narrowing"
  - "Every remaining inert Dashboard calendar-family button now wired: dash-week-day-header, dash-week-item (3-way tipo dispatch), dash-weekend-day-header (new), dash-weekend-popover-item, dash-heatmap-cell"
  - "The pre-existing rotina-UUID-as-titulo display bug fixed at its source (WeekCalendar.svelte's labelFor()) and in DayDialog, which shares the same agenda data"
affects: []

# Actuals (#2632)
actuals:
  tokens: 10163
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "DayDialog is the phase's one dialog kind with no `onEditar`/`onVerPagina` -- both simply left undefined on FocusDialog, whose footer already renders those buttons conditionally; footerExtra carries 'ir para esta semana' instead. No FocusDialog.svelte change needed to support a dialog with fewer footer actions than the other six."
    - "RotinaDialog's status-only editar required zero new restriction code: EntityScreen.svelte's existing editableFields() (EntityScreen.svelte:123-128) already narrows the edit form to updatableFields when driven against a config whose updatableFields is already ['status'] -- the same hidden-EntityScreen-host + driven-row-edit-click pattern every dialog in this phase reuses simply inherits the narrowing for free."
    - "Weekend popover restructure: two separate $derived arrays (sabadoItems/domingoItems) instead of one combined weekendItems, each preceded by its own dash-weekend-day-header button -- the existing dash-weekend-popover-item testid and text-content contract stayed byte-identical, so dashboard.spec.ts's pre-existing weekend-chip test needed zero changes."

key-files:
  created:
    - web/src/lib/dashboard/dialogs/DayDialog.svelte
    - web/src/lib/dashboard/dialogs/RotinaDialog.svelte
    - web/e2e/focus-dialog-dia-rotina.spec.ts
  modified:
    - web/src/lib/dashboard/Dashboard.svelte
    - web/src/lib/dashboard/WeekCalendar.svelte
    - web/src/lib/dashboard/MonthHeatmap.svelte

key-decisions:
  - "Task 2 (Dashboard.svelte) and Task 3 (WeekCalendar.svelte/MonthHeatmap.svelte) have a genuine compile-time interdependency: Dashboard.svelte's Task-2 edit passes rotinaNomeById/onOpenDia/onOpenItem props to WeekCalendar/MonthHeatmap before those components declare them, so Task 2's own `bun run check` only passes once Task 3's prop additions also exist. Implemented both tasks' code together, verified `bun run check` once across both, then split the diff into two atomic commits along the plan's own file boundaries (Dashboard.svelte alone for Task 2; WeekCalendar.svelte/MonthHeatmap.svelte/the e2e spec for Task 3) -- each commit is a coherent, reviewable unit even though the intermediate Task-2-only working tree would not itself have type-checked in isolation. Documented here per this task's 'resolve using plan text/CONTEXT/RESEARCH/spec-ui.md, document the call' instruction."
  - "openRotinaDialog/openTarefaDialog (added per Task 2's explicit text) end up unused by any wiring in this plan -- every actual dispatch site (WeekCalendar's onOpenItem, DayDialog's onOpenItem) uses the generic inline `(tipo, id) => openDialog({ kind: tipo, id })` the plan's own Task 2/3 text specifies verbatim instead. Kept both functions as written (harmless, `tsconfig.app.json` has no noUnusedLocals) rather than second-guessing the plan's literal instruction; they mirror openDiaDialog/openTicketDialog's naming symmetry for any future direct-open caller."
  - "e2e test (a) seeds TWO rotina instances (one weekday-dated, one weekend-dated) against the same template, rather than relying on one ambiguously-landing instance, so both the weekday-card and weekend-popover label-fix surfaces get an unconditional, deterministic assertion instead of a runtime-dependent conditional."

patterns-established: []

requirements-completed: [DLG-01, DLG-02, DLG-03]

coverage:
  - id: D1
    description: "Every WeekCalendar day-header, week-calendar item (tarefa/rotina/ticket), weekend-popover item, and month-heatmap cell is a real, wired <button> opening the correct dialog"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-dia-rotina.spec.ts#(b) clicking dash-week-day-header opens the Dia dialog showing the day's full, uncapped item list"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-dia-rotina.spec.ts#(c) clicking dash-week-item of each of the 3 data-tipo values opens the matching dialog kind"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-dia-rotina.spec.ts#(d) dash-weekend-day-header opens the Dia dialog for that exact Saturday, distinct from clicking a dash-weekend-popover-item"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-dia-rotina.spec.ts#(e) dash-heatmap-cell opens the Dia dialog for that exact date"
        status: pass
    human_judgment: false
  - id: D2
    description: "The weekend Popover has a distinct per-day clickable header (sábado / domingo) opening the Dia dialog for that date, separate from clicking an item inside it"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-dia-rotina.spec.ts#(d) dash-weekend-day-header opens the Dia dialog for that exact Saturday, distinct from clicking a dash-weekend-popover-item"
        status: pass
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-03: weekend chip -- chip is absent with zero weekend items, then appears and opens a popover once one exists (zero regression to dash-weekend-popover-item's pre-existing testid/content contract)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A rotina item's displayed label is always the linked template's nome, never the raw instancia UUID, in both weekday cards and the weekend popover"
    requirement: "DLG-01"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-dia-rotina.spec.ts#(a) rotina items show the template's nome, never the instancia id, in both the weekday card and the weekend popover"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Dia dialog shows that day's FULL, uncapped agenda and offers only 'ir para esta semana' + fechar -- no editar, no ver na página completa"
    requirement: "DLG-01, DLG-03"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-dia-rotina.spec.ts#(b) clicking dash-week-day-header opens the Dia dialog showing the day's full, uncapped item list"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-dia-rotina.spec.ts#(f) the Dia dialog's footer offers only ir-para-semana + fechar, never editar/ver-pagina; ir-para-semana changes the displayed week"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Rotina dialog's editar affordance is restricted to the status field only, inherited automatically from EntityScreen's existing editableFields() narrowing, with zero new restriction logic written in this plan"
    requirement: "DLG-01"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-dia-rotina.spec.ts#(g) the Rotina dialog's focus-dialog-editar reveals a status-only form"
        status: pass
      - kind: other
        ref: "Manual review: RotinaDialog.svelte's startEditar() drives EntityScreen(instanciasRotinaConfig) via the exact same hidden-host + row-edit-click pattern TicketDialog/TaskDialog already use, adding zero new field-restriction code -- the narrowing comes entirely from EntityScreen.svelte:123-128's pre-existing editableFields() plus instanciasRotinaConfig's own already-shipped updatableFields: [\"status\"]"
        status: pass
    human_judgment: false
  - id: D6
    description: "Dashboard.svelte's dialogStack chain now covers 4 of 7 kinds (ticket, dia, rotina, tarefa); the tarefa lookup provably uses the flat, subtarefa-carrying query.data.tarefas array; zero regression to the pre-existing dashboard.spec.ts/focus-dialog-ticket.spec.ts/focus-dialog-projetos-kanban.spec.ts suites"
    requirement: "DLG-03"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts (22 tests, all pass)"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-ticket.spec.ts (7 tests, all pass)"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-projetos-kanban.spec.ts (6 tests, all pass)"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-dia-rotina.spec.ts (7 tests, all pass)"
        status: pass
      - kind: other
        ref: "cd web && bun run check (0 errors, 2 pre-existing warnings unrelated to this plan)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-12
status: complete
---

# Phase 23 Plan 4: Dia/Rotina Dialogs + Full Calendar-Family Wiring Summary

**`DayDialog.svelte` (the one focus dialog with no underlying entity, footer-restricted to "ir para esta semana" + fechar) and `RotinaDialog.svelte` (status-only editar, inherited for free from `EntityScreen`'s existing narrowing) built and wired end-to-end alongside a full `WeekCalendar.svelte`/`MonthHeatmap.svelte` rewiring -- day headers, the 3-way item-type dispatch, a restructured weekend popover with distinct per-day header buttons, and a fix for the pre-existing rotina-UUID-as-titulo display bug -- closing every remaining inert button in the Dashboard's calendar family.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-12T05:25:00Z (approx.)
- **Completed:** 2026-08-12T06:05:00Z
- **Tasks:** 3
- **Files modified:** 6 (2 created dialog components, 1 created e2e spec, 3 modified)

## Accomplishments

- `DayDialog.svelte` (M): renders `agenda.get(iso)`'s full, uncapped item list (never sliced), each item a real button dispatching by `item.tipo`; title formats the full weekday name + DD/MM; contexto reads `${count} afazeres · ${vencidos} atrasados`; footer carries only `day-dialog-ir-semana` via `footerExtra` -- `onEditar`/`onVerPagina` both simply omitted, needing zero `FocusDialog.svelte` change.
- `RotinaDialog.svelte` (S): flat `RotinaDialogRow` prop; renders dataPrevista/dataPrevistaEstimada/dedupeKey/tipoPrazo/status/template-origin read-only; drives its own hidden `EntityScreen(instanciasRotina)` host for "editar," which automatically renders `field-status` only (never `field-dedupeKey`/`field-competencia`) via `EntityScreen.svelte`'s pre-existing `editableFields()` + `instanciasRotinaConfig`'s already-shipped `updatableFields: ["status"]` -- zero new restriction code written.
- `Dashboard.svelte`: widened `TarefaRow` (descricao/dataPrevistaEstimada/competencia/status, `etapa.nome`) and `InstanciaRotinaRow` (dedupeKey/dataPrevistaEstimada/competencia) local TS types (all already fetched at runtime, zero new query); added `openDiaDialog`/`openRotinaDialog`/`openTarefaDialog`/`irParaEstaSemana`; added `fundoByProjetoId` join, `activeDiaItems`/`activeRotina`/`activeTarefaForDialog` derived lookups (the tarefa lookup provably reads `data.tarefas`, never the nested subtarefa-less `etapas[].tarefas[]` branch -- T-23-08's mitigation); refined `breadcrumbLabelFor`'s "dia" branch from Plan 23-01's raw-ISO placeholder into a formatted weekday label; extended the dialogStack router chain with `dia`/`rotina`/`tarefa` branches (`TaskDialog` reused unmodified from Plan 23-03).
- `WeekCalendar.svelte`: new `rotinaNomeById`/`onOpenDia`/`onOpenItem` props; `labelFor()` fixes the rotina-UUID display bug in both the weekday-card and weekend-popover item loops; `dash-week-day-header` now opens Dia, `dash-week-item` dispatches to Tarefa/Rotina/Ticket; weekend section restructured into `sabadoItems`/`domingoItems` with a `dash-weekend-day-header` button per day preceding that day's `dash-weekend-popover-item` buttons -- the pre-existing testid/text-content contract stayed byte-identical for `dashboard.spec.ts`.
- `MonthHeatmap.svelte`: new `onOpenDia` prop wired to `dash-heatmap-cell`.
- `web/e2e/focus-dialog-dia-rotina.spec.ts`: 7 new tests (a-g) covering the rotina-label fix on both surfaces, day-header/item/weekend-header/heatmap-cell dispatch, the Dia dialog's editar/ver-pagina-less footer plus its `ir para esta semana` navigation effect, and the Rotina dialog's status-only editar form.

## Task Commits

Each task was committed atomically:

1. **Task 1: DayDialog.svelte and RotinaDialog.svelte** - `afc1130` (feat)
2. **Task 2: Dashboard.svelte -- dia/rotina/tarefa dialogStack branches, type widening, tarefa-fundo join** - `d23e42b` (feat)
3. **Task 3: WeekCalendar.svelte/MonthHeatmap.svelte full wiring + rotina-label bugfix + e2e coverage** - `a658b6f` (feat)

**Plan metadata:** (pending -- this SUMMARY's own commit)

## Files Created/Modified

- `web/src/lib/dashboard/dialogs/DayDialog.svelte` - dialog #2 of 7, no editar/ver-pagina (new)
- `web/src/lib/dashboard/dialogs/RotinaDialog.svelte` - dialog #7 of 7, status-only editar (new)
- `web/src/lib/dashboard/Dashboard.svelte` - type widening, new open*/irParaEstaSemana functions, fundoByProjetoId/activeDiaItems/activeRotina/activeTarefaForDialog derived state, dia/rotina/tarefa render branches
- `web/src/lib/dashboard/WeekCalendar.svelte` - rotinaNomeById/onOpenDia/onOpenItem props, labelFor() bugfix, day-header + item + weekend-restructure wiring
- `web/src/lib/dashboard/MonthHeatmap.svelte` - onOpenDia prop, dash-heatmap-cell wiring
- `web/e2e/focus-dialog-dia-rotina.spec.ts` - new standalone e2e spec (new)

## Decisions Made

- Ambiguity resolution (per this task's "resolve using plan text/CONTEXT/RESEARCH/spec-ui.md" instruction): Task 2's own `<verify>` command (`bun run check`) only type-checks cleanly once Task 3's `WeekCalendar.svelte`/`MonthHeatmap.svelte` prop additions also exist, because Task 2's edit to `Dashboard.svelte` passes `rotinaNomeById`/`onOpenDia`/`onOpenItem` to those components before they declare the props. Implemented both tasks' code together, ran `bun run check` once across the combined change (0 errors), then split the diff into two atomic, per-file commits matching the plan's own `files_modified` boundaries -- Task 2's commit message documents this interdependency explicitly rather than silently committing a temporarily-non-typechecking intermediate state.
- Followed the plan's literal instruction to add `openRotinaDialog`/`openTarefaDialog` functions in Task 2 even though every actual dispatch call site (per the plan's own Task 2/3 text) uses the generic inline `(tipo, id) => openDialog({ kind: tipo, id })` instead -- these two functions end up unused by any wiring in this plan. Kept them as written rather than omitting them, since `tsconfig.app.json` sets no `noUnusedLocals` (verified: `bun run check` reports 0 errors) and second-guessing an explicit, literal plan instruction risked diverging further from the plan than following it exactly.
- The weekend popover's two `dash-weekend-day-header` buttons (one for sábado, one for domingo) share the same `data-testid` with different `data-eid` values, mirroring the existing `dash-week-day-header`/`dash-heatmap-cell` convention of one testid disambiguated by `data-eid` -- no new testid-naming pattern introduced.
- e2e test (a) deliberately seeds two rotina instances against one template (one weekday-dated, one weekend-dated) rather than relying on the plan text's conditional "if it lands on a weekday" framing, so the test suite exercises both surfaces unconditionally on every run regardless of which weekday `hoje` happens to be.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test flake] `(d)`'s second click target (`dash-weekend-popover-item`) intermittently detached mid-click after the Dia dialog's exit animation**
- **Found during:** Task 3's first `bunx playwright test` run (28/29 passed; test (d) timed out at 60s with "element was detached from the DOM, retrying")
- **Issue:** After opening and closing the Day dialog from inside the weekend popover (test (d)'s first half), re-clicking the weekend chip and immediately clicking a `dash-weekend-popover-item` button raced against the popover's floating-ui re-positioning following the prior dialog's close animation, repeatedly detaching the target element mid-click for the full 60s test timeout.
- **Fix:** Inserted a `page.reload()` before the test's second half (re-opening the popover from a clean page load) instead of reusing the same in-page popover state across both halves of the test. This is a **test-authoring** fix, not a production bug -- a real user re-opening the popover fresh (e.g. after navigating back) would never hit this race; the underlying app behavior (both click targets correctly dispatching to their own dialog kind) was never in question.
- **Files modified:** `web/e2e/focus-dialog-dia-rotina.spec.ts`
- **Verification:** Re-ran `bunx playwright test focus-dialog-dia-rotina.spec.ts -g "(d)"` in isolation (passed, 2.4s) and the full cross-plan regression suite (42/42 passed).
- **Committed in:** `a658b6f` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 -- test-only flake fix, zero production code change) + 1 documented ambiguity resolution (Task 2/Task 3 compile-time interdependency, resolved by implementing both before verifying, then splitting commits along the plan's own file boundaries).
**Impact on plan:** Zero scope creep. No production behavior changed beyond what the plan specified.

## Issues Encountered

None beyond the test-authoring flake documented above. Every task's `<done>` criterion was verified to genuinely pass before committing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- This is the final execution plan of Phase 23 per `23-CONTEXT.md`'s Deferred Ideas section ("this is the final functional phase of the milestone... After this phase: milestone audit → complete → tag v1.3") -- but per `phase_dir`'s own plan manifest, plans 23-05/23-06/23-07 remain incomplete and should be checked before assuming the phase itself is done.
- Every WeekCalendar/MonthHeatmap inert button from the Exhaustive Inert-Button Inventory items #1-4 and #12 is now wired; `Dashboard.svelte`'s dialogStack chain covers 4 of 7 kinds (ticket, dia, rotina, tarefa) -- projeto/fundo/etapa remain for whichever later plan builds those dialog kinds.
- No blockers.

---
*Phase: 23-focus-dialog-system*
*Completed: 2026-08-12*

## Self-Check: PASSED
- All 6 source/spec files confirmed present on disk (DayDialog.svelte, RotinaDialog.svelte, Dashboard.svelte, WeekCalendar.svelte, MonthHeatmap.svelte, focus-dialog-dia-rotina.spec.ts).
- All 3 task commit hashes (`afc1130`, `d23e42b`, `a658b6f`) confirmed present in `git log --oneline --all`.
