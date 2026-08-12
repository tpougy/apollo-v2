---
phase: 23-focus-dialog-system
plan: 06
subsystem: ui
tags: [svelte5, bits-ui, dialog, entityscreen, dashboard, playwright]

# Dependency graph
requires:
  - phase: 23-01
    provides: "FocusDialog.svelte's shared S/M/L chrome wrapper; Dashboard.svelte's dialogStack/DialogKind/openDialog/popToFirst/closeAllDialogs/activeDialogRef mechanism (DialogKind already pre-declared \"projeto\"/\"etapa\")"
  - phase: 23-03
    provides: "EtapaDialog.svelte/TaskDialog.svelte (dialogs #6/#3 of 7) -- self-contained, reused unmodified from Dashboard.svelte's new depth-2 branches"
  - phase: 23-05
    provides: "Dashboard.svelte's established derived-lookup/wiring precedent (openXDialog functions, activeX $derived.by patterns) extended here for projeto/etapa"
provides:
  - "ProjectDialog.svelte: dialog #4 of 7 (L), the second depth-2 launch point (with Dia) -- unbounded etapa/tarefa kanban, per-column \"+ tarefa\", own hidden edit host"
  - "Dashboard.svelte's dialogStack chain now covers all 7 dialog kinds"
  - "ProjectStrips.svelte's remaining 3 buttons (project-strip-nome/-column-header/-card) fully wired, closing the Exhaustive Inert-Button Inventory"
  - "dashboardQuery.ts's projetos.etapas.tarefas branch now fetches subtarefas -- fixes a Phase-22-documented gap affecting BOTH this new dialog and the pre-existing ProjectStrips.svelte column-header progress display"
affects: [23-07]

# Actuals (#2632)
actuals:
  tokens: 9468
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Second depth-2 launch point (with Dia): ProjectDialog has no `breadcrumb` prop of its own (always depth-1) but its own kanban body's column-header/card buttons call onOpenEtapa/onOpenTarefa, which Dashboard.svelte wires to the SAME openDialog mechanism every other dialog kind uses -- pushing a genuine second dialogStack entry, swapped in place, never two simultaneous Dialog.Root instances."
    - "Third independent hidden-EntityScreen host inside one dialog component: ProjectDialog owns both an add-tarefa host (presetLinks={etapa: <live $state>}) and a separate edit host, neither sharing the other's DOM subtree -- mirrors ProjetosSection.svelte's own three-independent-hosts precedent exactly."
    - "One-line query-depth widening (subtarefas: {}) fixes a display bug on TWO unrelated surfaces (a brand-new dialog and a pre-existing dashboard strip) simultaneously, without adding a second db.useQuery call site -- proven live, before/after, on both surfaces in the same e2e spec."

key-files:
  created:
    - web/src/lib/dashboard/dialogs/ProjectDialog.svelte
    - web/e2e/focus-dialog-projeto.spec.ts
  modified:
    - web/src/lib/dashboard/dashboardQuery.ts
    - web/src/lib/dashboard/Dashboard.svelte
    - web/src/lib/dashboard/ProjectStrips.svelte

key-decisions:
  - "dashboardQuery.ts's DASHBOARD_QUERY.projetos branch widened from `{ fundo: {}, etapas: { tarefas: {} } }` to `{ fundo: {}, etapas: { tarefas: { subtarefas: {} } } }` -- still exactly one query (DASH-07 unaffected), deepens the SAME query object by one nesting level. This closes the Phase-22-documented gap (STATE.md) where tarefaConcluida()/progressoEtapa() on a nested strip card always evaluated 0/N regardless of reality. Proven live in focus-dialog-projeto.spec.ts test (b): both ProjectDialog's own project-dialog-column-header AND ProjectStrips.svelte's pre-existing project-strip-column-header now read \"1/5\" (not \"0/5\") for the identical etapa, from the one query change."
  - "ProjectDialog.svelte's kanban column wrapper `<div>` was given `data-testid=\"project-dialog-column\"`/`data-eid={etapa.id}` -- NOT called out by the plan's action text (which only names the header/card testids), added at Claude's discretion purely for e2e scoping symmetry with ProjectStrips.svelte's own `project-strip-column` container. Documented per this task's 'resolve ambiguity, document the call' instruction; zero behavior change, purely an additional attribute on an already-planned element."
  - "Kanban column fixed width chosen as `w-48` (vs. ProjectStrips.svelte's `w-36`) -- the plan's action text describes 'a fixed-width column <div>' without mandating an exact Tailwind class for this dialog's own kanban (distinct from the dashboard-strip-specific `w-36`/overflow-indicator discipline of spec §3.5, which the plan explicitly says NOT to port here). `w-48` gives a card's titulo/prazo line slightly more breathing room inside the L-width dialog without materially changing any tested assertion (all assertions target testids/content, never absolute width values here)."
  - "Ambiguity resolution (per this task's 'resolve using plan text/CONTEXT/RESEARCH/spec-ui.md' instruction): Dashboard.svelte's activeProjetoForDialog is shaped into ProjectDialog's ProjectDialogRow contract with an explicit nested etapas/tarefas re-map (id/nome/ordem/tarefas fields individually) rather than a bare `etapas: activeProjetoForDialog.etapas ?? []` pass-through the plan's prose literally suggests ('pass etapas through as-is') -- Dashboard.svelte's own EtapaRow.tarefas is typed optional (`TarefaRow[] | undefined`) while ProjectDialogRow.etapas[].tarefas is required, so a literal as-is pass-through fails svelte-check. The explicit re-map (with `e.tarefas ?? []`) is the minimal type-correct realization of the same intent, verified via `bun run check` (0 errors)."

patterns-established: []

requirements-completed: [DLG-01, DLG-02, DLG-03]

coverage:
  - id: D1
    description: "Clicking a project strip's name (project-strip-nome) opens the Projeto dialog at L width (sm:max-w-[90vw]) showing the FULL, unbounded kanban of every etapa/tarefa (no 3-card cap), horizontally scrollable, with a working '+ tarefa' per column that creates a real tarefa correctly linked to the clicked column's etapa"
    requirement: "DLG-01"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-projeto.spec.ts#(a) project-strip-nome opens the Projeto dialog (L) with an unbounded kanban -- 5 cards, no cap, unlike the Dashboard strip's own 3-card+\"+2\" rendering"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-projeto.spec.ts#(c) project-dialog-add-tarefa creates a real tarefa immediately linked to the clicked column's exact etapa (verified via the CLI)"
        status: pass
    human_judgment: false
  - id: D2
    description: "From inside the Projeto dialog, clicking a column header opens the Etapa dialog and clicking a card opens the Tarefa dialog -- both as depth-2, with a breadcrumb back to the Projeto dialog (still open, same kanban visible) and no third level reachable from either"
    requirement: "DLG-03"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-projeto.spec.ts#(d) project-dialog-column-header opens the Etapa dialog as depth 2 -- exactly one Dialog.Content, breadcrumb reads the projeto's nome, no third level reachable"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-projeto.spec.ts#(e) project-dialog-card opens the Tarefa dialog as depth 2 with identical breadcrumb behavior"
        status: pass
    human_judgment: false
  - id: D3
    description: "project-strip-column-header and project-strip-card on the Dashboard's own mini-kanban strips (outside any dialog) also open Etapa/Tarefa respectively, completing DLG-02's full button inventory -- all three (nome/column-header/card) resolve to real <button>s"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-projeto.spec.ts#(f) on the page, outside any dialog, project-strip-nome/-column-header/-card are all real <button>s and each opens its correct dialog kind directly at depth 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "DASHBOARD_QUERY's projetos.etapas.tarefas branch now also fetches subtarefas, fixing the pre-existing (documented, Phase-22-deferred) gap where every nested tarefa's completion count silently evaluated to 0/N regardless of reality -- benefits both the new ProjectDialog kanban and the pre-existing ProjectStrips/RoutinesByFundo-adjacent rendering that reads the same nested path"
    requirement: "DLG-01"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-projeto.spec.ts#(b) the query-completeness fix: project-dialog-column-header shows 1/5 (not 0/5), and ProjectStrips' own project-strip-column-header ALSO now shows 1/5 for the same etapa"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dashboard.svelte's dialog-stack chain now covers all 7 kinds; zero regression to every other focus-dialog spec plus both pre-existing dashboard specs, which all touch the same 3 files this plan edits for the last time this phase"
    requirement: "DLG-01, DLG-02, DLG-03"
    verification:
      - kind: e2e
        ref: "focus-dialog-projeto.spec.ts + dashboard.spec.ts + dashboard-kanbans.spec.ts + focus-dialog-fundo.spec.ts + focus-dialog-dia-rotina.spec.ts + focus-dialog-ticket.spec.ts + focus-dialog-projetos-kanban.spec.ts (61 tests, all pass; one transient SSL-handshake network flake on first run, confirmed passing on retry)"
        status: pass
      - kind: other
        ref: "cd web && bun run check (0 errors, 2 pre-existing warnings unrelated to this plan)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-12
status: complete
---

# Phase 23 Plan 6: ProjectDialog (L, Second Depth-2 Launch Point) + Remaining ProjectStrips Wiring + Subtarefas Query Fix Summary

**`ProjectDialog.svelte` (L, dialog #4 of 7) built as the second depth-2 launch point alongside Dia -- an unbounded etapa/tarefa kanban with per-column "+ tarefa" -- wired into `Dashboard.svelte`'s dialog-stack chain (now covering all 7 kinds), together with the last 3 `ProjectStrips.svelte` buttons and a one-line `dashboardQuery.ts` fix that corrects a pre-existing "always 0/N" progress-display bug on two independent surfaces at once.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-12T03:05:00Z (approx.)
- **Completed:** 2026-08-12T03:45:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `ProjectDialog.svelte` (L): flat `ProjectDialogRow` prop; title = `projeto.nome`; contexto = `${fundoNome} · ${N} etapas · ${N} tarefas`. Body is a plain `overflow-x-auto` flex row of fixed-width (`w-48`) columns, one per etapa (sorted by `ordem`), each showing the column header (`project-dialog-column-header`, opens the Etapa dialog via `onOpenEtapa`), every one of that etapa's tarefas with NO 3-card cap (`project-dialog-card`, opens the Tarefa dialog via `onOpenTarefa` with `stopPropagation`), and a `project-dialog-add-tarefa` button. "+ tarefa" drives a THIRD independent hidden `EntityScreen(tarefas)` host (`project-dialog-add-tarefa-host`) with `presetLinks` reading the live `addTarefaEtapaId` `$state` at click time -- mirrors `ProjetosSection.svelte`'s own `startCreateTarefa`/`tarefaHostEl` pattern exactly. A SEPARATE second hidden host (`project-dialog-edit-host`) drives `projetosConfig`'s own `row-edit` for "editar". "ver na página completa" clicks `nav-projetos` then closes. No `breadcrumb` prop -- like Dia, Projeto is always depth-1.
- `dashboardQuery.ts`: widened `DASHBOARD_QUERY.projetos.etapas.tarefas` to also fetch `subtarefas` -- still exactly one query, deepened by one nesting level. This closes the Phase-22-documented gap where `progressoEtapa`/`tarefaConcluida` on any nested-branch tarefa always evaluated `false` (no `subtarefas` data present at all), which silently made every `{feitas}/{total}` reading on `ProjectStrips.svelte`'s own `project-strip-column-header` (and now this plan's `ProjectDialog.svelte` column headers) show `0/N` regardless of reality.
- `Dashboard.svelte`: `openProjetoDialog`/`openEtapaDialog` functions (mirroring `openTarefaDialog`'s existing shape); `activeProjetoForDialog` (a straight `projetoRows().find()`, now correctly carrying `subtarefas` through `etapas.tarefas` per the query fix) and `activeEtapaForDialog` (same find-by-id-across-projetos-then-etapas idiom as `ProjetosSection.svelte`'s own `findEtapaById`); two new `{:else if}` branches completing the dialog-stack chain -- `"projeto"` mounts `ProjectDialog` with `onOpenEtapa`/`onOpenTarefa` wired to the same functions every other dialog kind uses, `"etapa"` mounts `EtapaDialog.svelte` (Plan 23-03, reused unmodified) with the same breadcrumb-wiring shape as the existing `"tarefa"` branch.
- `ProjectStrips.svelte`: `onOpenProjeto`/`onOpenEtapa`/`onOpenTarefa` props added alongside the already-wired `onOpenFundo`. `project-strip-nome` now calls `onOpenProjeto(projeto.id)`; `project-strip-column-header` now calls `onOpenEtapa(etapa.id)`; `project-strip-card` now calls `onOpenTarefa(tarefa.id)` with a defensive `stopPropagation` (consistent with every other nested-card click target in this phase, even though column-header and card are DOM siblings, not nested, in the current markup).
- `web/e2e/focus-dialog-projeto.spec.ts`: 6 new tests (a-f) proving: the unbounded kanban vs. the Dashboard strip's own 3-card+"+2" cap (visible simultaneously beneath the open dialog); the query-completeness fix live on BOTH surfaces (`1/5`, not `0/5`); "+ tarefa" creating a real tarefa CLI-verified to link to the exact clicked column's etapa; depth-cap-2 for both Etapa and Tarefa reached via Projeto (exactly one `Dialog.Content` at every step, breadcrumb pops back to the still-open Projeto dialog, no button exists inside the Etapa dialog's own task rows); and direct depth-1 wiring for all 3 remaining `ProjectStrips` buttons on the page, outside any dialog.

## Task Commits

Each task was committed atomically:

1. **Task 1: dashboardQuery.ts completeness fix + ProjectDialog.svelte** - `cf8b157` (feat)
2. **Task 2: Dashboard.svelte projeto/etapa branches + ProjectStrips.svelte remaining wiring** - `c9ea040` (feat)
3. **Task 3: e2e coverage** - `9b26938` (test)

**Plan metadata:** (pending -- this SUMMARY's own commit)

## Files Created/Modified

- `web/src/lib/dashboard/dialogs/ProjectDialog.svelte` - dialog #4 of 7, second depth-2 launch point (new)
- `web/src/lib/dashboard/dashboardQuery.ts` - widened `projetos.etapas.tarefas` to fetch `subtarefas`
- `web/src/lib/dashboard/Dashboard.svelte` - `openProjetoDialog`/`openEtapaDialog`, `activeProjetoForDialog`/`activeEtapaForDialog`, `projeto`/`etapa` render branches
- `web/src/lib/dashboard/ProjectStrips.svelte` - `onOpenProjeto`/`onOpenEtapa`/`onOpenTarefa` props, wired to the last 3 previously-inert buttons
- `web/e2e/focus-dialog-projeto.spec.ts` - new standalone e2e spec (new)

## Decisions Made

- **dashboardQuery.ts fix documented explicitly, per this task's instruction:** this is a deliberate, in-scope bugfix riding along with this plan's own new column-header UI (not a silent, unrelated change). It is exactly one line deeper on the existing single query object -- DASH-07's "uma query, não sete" invariant is unaffected. Proven live, before/after, on both `ProjectDialog.svelte` (new) and `ProjectStrips.svelte` (pre-existing) in the same e2e test.
- `project-dialog-column`'s `data-testid`/`data-eid` (not named by the plan's action text) added at Claude's discretion for e2e scoping parity with `ProjectStrips.svelte`'s own `project-strip-column` container -- see key-decisions above.
- Kanban column width `w-48` (discretionary, distinct from `ProjectStrips.svelte`'s `w-36`) -- see key-decisions above.
- `activeProjetoForDialog`'s `etapas`/`tarefas` re-mapped explicitly (rather than a literal as-is pass-through) to satisfy TypeScript's stricter `ProjectDialogRow` contract (`tarefas` required, not optional) -- see key-decisions above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type mismatch] `activeProjetoForDialog`'s inline shaping needed an explicit nested re-map, not a bare pass-through**

- **Found during:** Task 2's own `<verify>` (`bun run check`), immediately after wiring the `"projeto"` render branch
- **Issue:** The plan's action text says to "pass `etapas` through as-is" when shaping `activeProjetoForDialog` into `ProjectDialog`'s `ProjectDialogRow` prop. Dashboard.svelte's own `EtapaRow.tarefas` is typed `TarefaRow[] | undefined` (optional), while `ProjectDialogRow.etapas[].tarefas` is required (non-optional) per Task 1's own declared type -- a literal `etapas: activeProjetoForDialog.etapas ?? []` pass-through therefore fails `svelte-check` with an "undefined is not assignable" error on the nested `tarefas` field.
- **Fix:** Explicit nested re-map: `(activeProjetoForDialog.etapas ?? []).map((e) => ({ id, nome, ordem, tarefas: (e.tarefas ?? []).map((t) => ({...})) }))` -- the minimal type-correct realization of the plan's own intent (pass the same data through, add zero new query), same "widen/normalize at the boundary" precedent this phase has used repeatedly for optional-vs-required local TS type mismatches.
- **Files modified:** `web/src/lib/dashboard/Dashboard.svelte`
- **Verification:** `bun run check` reports 0 errors (down from 1); e2e tests (a)-(f) all pass, confirming the re-mapped data renders identically to what an as-is pass-through would have produced.
- **Committed in:** `c9ea040` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 -- type mismatch, minimal type-correct fix with zero behavior change).
**Impact on plan:** No scope creep. The re-map produces byte-identical runtime data to the plan's own literal "as-is" intent; it exists purely to satisfy TypeScript's stricter nested-optional-vs-required check.

## Issues Encountered

One transient, non-reproducible network handshake timeout (`_ssl.c:993: The handshake operation timed out`) occurred during the full 7-spec/61-test cross-plan verification gate's `dashboard.spec.ts` CLI fixture setup -- not caused by any code in this plan (same class of transient live-InstantDB-admin-API flake 23-05-SUMMARY.md already documented). Re-running that single test in isolation passed cleanly; the full gate is otherwise green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 dialog kinds (Ticket, Dia, Tarefa, Projeto, Fundo, Etapa, Rotina) now exist and are reachable from `Dashboard.svelte`'s dialog-stack chain.
- Depth-cap-2 is proven live for both of the phase's two first-level launch points that support it: Projeto (this plan, Etapa/Tarefa) and Dia (Plan 23-04, any agenda item).
- Every `ProjectStrips.svelte` button from the Exhaustive Inert-Button Inventory (23-RESEARCH.md) is now wired: `project-strip-nome`, `project-strip-fundo-badge` (Plan 23-05), `project-strip-column-header`, `project-strip-card` (this plan).
- The pre-existing `progressoEtapa` "always 0/N" display gap is fixed at the query layer, benefiting every current and future reader of `dashboardQuery.ts`'s `projetos.etapas.tarefas` branch.
- Remaining phase work (per ROADMAP.md/STATE.md): Plan 23-07, if any, plus the milestone-level audit → complete → tag v1.3 sequence CONTEXT.md's `<deferred>` section anticipates.
- No blockers.

---
*Phase: 23-focus-dialog-system*
*Completed: 2026-08-12*

## Self-Check: PASSED
- All 6 files confirmed present on disk (ProjectDialog.svelte, dashboardQuery.ts, Dashboard.svelte, ProjectStrips.svelte, focus-dialog-projeto.spec.ts, this SUMMARY).
- All 3 task commit hashes (`cf8b157`, `c9ea040`, `9b26938`) confirmed present in `git log --oneline --all`.
