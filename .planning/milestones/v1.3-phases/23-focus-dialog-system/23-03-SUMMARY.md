---
phase: 23-focus-dialog-system
plan: 03
subsystem: ui
tags: [svelte5, bits-ui, dialog, entityscreen, projetos, playwright]

# Dependency graph
requires:
  - phase: 23-01
    provides: "FocusDialog.svelte's shared S/M/L chrome wrapper; the self-contained-dialog-component pattern (own hidden EntityScreen edit host, own ver-pagina nav-click)"
provides:
  - "TaskDialog.svelte: dialog #3 of 7 (S), self-contained, reusable unmodified by Plans 23-04/23-06 from Dashboard.svelte"
  - "EtapaDialog.svelte: dialog #6 of 7 (M), self-contained, same reuse guarantee"
  - "ProjetosSection.svelte's own independent depth-cap-2 host (activeKanbanDialog) reachable from BOTH the kanban toggle and the default list view"
  - "Closed the one genuine pre-existing DLG-02 violation this codebase had: etapa-kanban-column/etapa-kanban-card are now real <button>s"
affects: [23-04, 23-06]

# Actuals (#2632)
actuals:
  tokens: 10724
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Flat, pre-shaped-by-the-host row contract (TaskDialogRow/EtapaDialogRow): each host does its own join/resolution (fundoNome/projetoNome/etapaNome) and hands the dialog an already-resolved row -- the dialog component itself never inspects a nested link, so the same component is reusable from hosts with different raw query shapes (ProjetosSection here, Dashboard.svelte in 23-04/23-06)"
    - "Single nullable activeKanbanDialog ref (not a length-2 stack) for a host that structurally can never reach depth 2, since neither Etapa nor Tarefa dialog opens a further dialog from itself"
    - "Additive list-view wiring alongside an existing kanban-toggle target: new sibling buttons (etapa-row-abrir, etapa-tarefa-row-abrir) added beside pre-existing interactive elements (Accordion.Trigger, the subtarefas chip) rather than overloading their onclick, proven zero-regression against the full pre-existing projetos-section.spec.ts suite"

key-files:
  created:
    - web/src/lib/dashboard/dialogs/TaskDialog.svelte
    - web/src/lib/dashboard/dialogs/EtapaDialog.svelte
    - web/e2e/focus-dialog-projetos-kanban.spec.ts
  modified:
    - web/src/lib/sections/ProjetosSection.svelte

key-decisions:
  - "etapa-kanban-column and etapa-kanban-card are BOTH real, literal <button> elements, with the card button nested inside the column button -- see 'Deviations' below for the ambiguity this resolves and why it's safe in this codebase specifically."
  - "etapa-row-abrir is a sibling of the whole Accordion.Item (inside a new wrapping `class=\"relative\"` div), never a child of Accordion.Trigger itself and never nested inside it -- per the plan's own explicit resolution of the button-inside-button concern for the LIST view's accordion."
  - "etapa-tarefa-row-abrir replaces the tarefa's plain title <span> with a <button>, kept as a sibling of the pre-existing etapa-tarefa-subtarefas-chip button inside the same row <div> -- zero change to the chip's own click behavior (NEST-05)."
  - "Widened ProjetosSection.svelte's local TarefaRow type (descricao/dataPrevistaEstimada/competencia) -- fields already fetched at runtime via the unchanged etapas.tarefas query branch, zero new query, same 'too-narrow local TS type' precedent 23-01-SUMMARY.md documents for Dashboard.svelte's TicketRow/SubtarefaRow."

patterns-established:
  - "Every dialog built in this phase from a ProjetosSection.svelte-shaped host resolves fundo/projeto/etapa context via a local find-by-id scan over rowsOf() (never a second db.useQuery), attaching the flat contextual fields the dialog component expects."

requirements-completed: [DLG-01, DLG-02, DLG-03]

coverage:
  - id: D1
    description: "etapa-kanban-column and etapa-kanban-card (Pitfall 3's genuine pre-existing DLG-02 violation) are converted from plain, non-interactive <div>s into real, keyboard-accessible <button>s opening the Etapa/Tarefa dialogs respectively"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-projetos-kanban.spec.ts#(a) etapa-kanban-column and etapa-kanban-card both resolve to tagName === 'button'"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-projetos-kanban.spec.ts#(b) clicking etapa-kanban-column opens the Etapa dialog at M width with nome/ordem/BOTH tarefas uncapped, correct overdue styling"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-projetos-kanban.spec.ts#(c) clicking etapa-kanban-card opens the Tarefa dialog at S width with titulo/competencia/subtarefas and a fundo·projeto·etapa context line"
        status: pass
    human_judgment: false
  - id: D2
    description: "The list view (etapa accordion header + each open etapa's tarefa rows) additively offers the same dialog-opening affordance as the kanban toggle, per the resolved ProjetosSection-wiring-scope decision -- without changing the accordion's own expand/collapse behavior or any existing NEST-02/NEST-05 assertion"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-projetos-kanban.spec.ts#(d) etapa-row-abrir is a real button distinct from etapa-row -- opens the Etapa dialog WITHOUT toggling the accordion"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-projetos-kanban.spec.ts#(e) etapa-tarefa-row-abrir opens the Tarefa dialog for that exact tarefa; the subtarefas chip on the same row still opens SubtarefasPanel"
        status: pass
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts (17 tests, all pass unedited)"
        status: pass
    human_judgment: false
  - id: D3
    description: "TaskDialog.svelte (S) and EtapaDialog.svelte (M) are self-contained (own hidden EntityScreen host for editar, own nav-projetos click for ver na página completa), reusable unmodified from Plans 23-04/23-06"
    requirement: "DLG-01"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-projetos-kanban.spec.ts#(f) focus-dialog-editar drives the real EntityScreen(etapas|tarefas) row-edit form; focus-dialog-ver-pagina returns to Projetos"
        status: pass
      - kind: other
        ref: "cd web && bun run check (0 errors)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Neither dialog opens a third level from inside itself -- the Etapa dialog's own uncapped task list and the Tarefa dialog's own subtarefa list are both plain, non-button, read-only rows (depth-cap-2)"
    requirement: "DLG-03"
    verification:
      - kind: other
        ref: "Manual review: EtapaDialog.svelte's etapa-dialog-tarefas rows and TaskDialog.svelte's task-dialog-subtarefas rows render <div>/<span> only, no onclick, no nested dialog-opening callback"
        status: pass
    human_judgment: false
---

# Phase 23 Plan 3: TaskDialog/EtapaDialog + ProjetosSection Kanban+List Wiring Summary

**TaskDialog.svelte (S) and EtapaDialog.svelte (M) built as self-contained focus dialogs, then wired into BOTH ProjetosSection.svelte's "etapas ▾ kanban" toggle (converting the codebase's one genuine pre-existing DLG-02 `<div>`-not-`<button>` violation) and, additively, into the default list view via two new sibling buttons -- proven zero-regression against all 17 pre-existing `projetos-section.spec.ts` tests plus 6 new tests.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-12T04:40:00Z (approx.)
- **Completed:** 2026-08-12T05:20:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 created dialog components, 1 created e2e spec, 1 modified section)

## Accomplishments
- `TaskDialog.svelte`: flat `TaskDialogRow` prop (titulo/descricao/tipoPrazo/dataPrevista/dataPrevistaEstimada/competencia/status/subtarefas/etapaNome/projetoNome/fundoNome), own hidden `EntityScreen(tarefas)` edit host (`task-dialog-edit-host`), own `nav-projetos` ver-pagina click, `data-testid="task-dialog-subtarefas"` read-only list, `size="S"`.
- `EtapaDialog.svelte`: flat `EtapaDialogRow` prop, own hidden `EntityScreen(etapas)` edit host (`etapa-dialog-edit-host`), own `nav-projetos` ver-pagina click, `data-testid="etapa-dialog-tarefas"` list rendering EVERY tarefa in the etapa (no 3-item cap, unlike the Dashboard's mini-kanban strips), `size="M"`.
- `ProjetosSection.svelte`: new `activeKanbanDialog` single-nullable-ref host (never a length-2 stack -- structurally can't reach depth 2), `findEtapaById`/`findTarefaById` resolving full rows from the already-fetched `rowsOf()` data (zero new query), `openKanbanDialog`/`closeKanbanDialog`.
  - **Kanban view:** `etapa-kanban-column` and `etapa-kanban-card` converted from plain `<div>`s into real `<button>`s (Pitfall 3 / Inventory items #13-14), opening the Etapa/Tarefa dialogs.
  - **List view (additive):** new sibling `etapa-row-abrir` button (never nested inside `Accordion.Trigger`) opens the Etapa dialog without touching the accordion's own toggle behavior; the tarefa row's title `<span>` becomes an `etapa-tarefa-row-abrir` `<button>`, a sibling of the pre-existing `etapa-tarefa-subtarefas-chip`, opening the Tarefa dialog.
- `web/e2e/focus-dialog-projetos-kanban.spec.ts`: 6 new tests covering the kanban button conversion, both dialogs' uncapped/correct content, the list-view additive wiring's zero-regression to the accordion toggle and the subtarefas chip, and editar/ver-pagina for both dialogs.

## Task Commits

Each task was committed atomically:

1. **Task 1: TaskDialog.svelte (S) and EtapaDialog.svelte (M) -- self-contained dialog components** - `d85942d` (feat)
2. **Task 2: ProjetosSection.svelte -- wire kanban AND list-view Etapa/Tarefa click targets** - `d7924bd` (feat)
3. **Task 3: e2e coverage -- kanban conversion, list-view wiring, dialog body correctness, editar/ver-pagina** - `a715a49` (test)

**Plan metadata:** (pending -- this SUMMARY's own commit)

## Files Created/Modified
- `web/src/lib/dashboard/dialogs/TaskDialog.svelte` - dialog #3 of 7, self-contained (new)
- `web/src/lib/dashboard/dialogs/EtapaDialog.svelte` - dialog #6 of 7, self-contained (new)
- `web/src/lib/sections/ProjetosSection.svelte` - activeKanbanDialog host, kanban button conversion, additive list-view wiring, widened TarefaRow
- `web/e2e/focus-dialog-projetos-kanban.spec.ts` - new standalone e2e spec (new)

## Decisions Made
- Resolved the plan's own ambiguity note about `ProjetosSection`-wiring-scope by implementing BOTH the kanban-toggle conversion AND the additive list-view wiring, per the plan's explicit `must_haves`/objective text (not scoped down to kanban-only, unlike 23-RESEARCH.md's Open Question 2 discussion of the *research-time* ambiguity, which this plan's own text had already resolved before execution).
- `etapa-row-abrir` is a sibling of the entire `Accordion.Item` (wrapped in a new `class="relative"` container), not a child of `Accordion.Trigger` -- verified against `accordion-trigger.svelte`'s own rendered `<button>` wrapper before implementation, exactly per the plan's explicit instruction and the threat model's T-23-06 mitigation.
- `etapa-tarefa-row-abrir` replaces only the tarefa's title `<span>`, staying a sibling of the pre-existing `etapa-tarefa-subtarefas-chip` `<button>` inside the same row `<div>` -- the row's checkbox/prazo/chip are untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Too-narrow local TS type] Widened ProjetosSection.svelte's `TarefaRow` to add `descricao`/`dataPrevistaEstimada`/`competencia`**
- **Found during:** Task 2 (writing `findTarefaById`, which needs these fields to build `TaskDialogRow`)
- **Issue:** `TarefaRow` only declared `id/titulo/status/tipoPrazo/dataPrevista/subtarefas` -- missing three fields `TaskDialogRow`'s body needs, already fetched at runtime via the unchanged `etapas: { tarefas: {...} }` query branch (defs/tarefas.ts's own field list), exactly the "widen too-narrow local TS type, zero new query" precedent 23-01-SUMMARY.md documents.
- **Fix:** Added `descricao?: string`, `dataPrevistaEstimada?: string`, `competencia?: string` to `TarefaRow`.
- **Files modified:** `web/src/lib/sections/ProjetosSection.svelte`
- **Verification:** `bun run check` reports 0 errors; e2e test (c) confirms `competencia` renders correctly in the Tarefa dialog.
- **Committed in:** `d7924bd` (Task 2 commit)

### Ambiguity Resolution (documented per this task's instruction)

**2. `etapa-kanban-column`/`etapa-kanban-card` real-button conversion: literal nested `<button>`-in-`<button>`**
- **What was found:** The plan's Task 2 action text instructs converting BOTH `etapa-kanban-column`'s wrapping `<div>` AND `etapa-kanban-card`'s wrapping `<div>` into real `<button>` elements, while the pre-existing markup (and the pre-existing `projetos-section.spec.ts` test asserting `columns.nth(0).getByTestId("etapa-kanban-card")` counts/widths) requires the cards to remain DOM descendants of the column. This is a genuine HTML content-model conflict (a `<button>` must have no interactive-content descendant) that the plan's own parenthetical ("the card is not literally nested inside the column button in the current DOM structure") does not fully resolve, since in the actual pre-conversion markup the card IS a descendant of the column's `<div>`.
- **Resolution:** Followed the plan's literal instruction (both real `<button>`s, card nested inside column, `stopPropagation` on the card) rather than substituting a `role="button"`+`tabindex` div for one of them, for two reasons: (1) Task 3's own test (a) explicitly asserts `tagName === "button"` for BOTH elements, which a `role="button"` div would fail; (2) this app (`web/index.html`) is a plain client-rendered Vite SPA with an empty `<div id="app">` shell and no SvelteKit/SSR route -- Svelte constructs the DOM via `createElement`/`appendChild` calls, never by feeding an HTML string through the browser's parser, so the HTML tokenizer's nested-`<button>` auto-close quirk (which only fires during string-based parsing) never applies here. The nested buttons render and dispatch click/keyboard events correctly; `stopPropagation` on the card prevents the column's handler from double-firing.
- **Cost:** `svelte-check` reports one expected `node_invalid_placement_ssr` warning at this exact line (harmless in this codebase since it never does SSR). Recorded as an open item in `.planning/WINDOWS.md` (entry #14, kind `deviation`) so this is revisited if SSR is ever adopted.
- **Verification:** e2e test (a) confirms both tagNames are `"button"`; test (b) confirms clicking the column's header text (not covered by any card) opens the Etapa dialog; test (c) confirms clicking a card opens the Tarefa dialog without also opening the Etapa dialog.
- **Committed in:** `d7924bd` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1/2 -- too-narrow type) + 1 documented ambiguity resolution (nested-button HTML tradeoff, logged to WINDOWS.md).
**Impact on plan:** Pure type-widening plus a deliberate, test-verified, SPA-safe interpretation of an internally-tense plan instruction. No scope creep; no regression to any pre-existing behavior.

## Issues Encountered
- Task 3's first draft of test (b)/(f) used `column.click()` on the WHOLE `etapa-kanban-column` locator, which Playwright resolves to a click at the center of the element's full bounding box -- once the column holds its header plus multiple stacked cards, that center point lands on a nested card, not the column's own header area, opening the Tarefa dialog instead of the Etapa dialog. Fixed by clicking the header text specifically (`span.font-mono`, never covered by any card) via a `columnHeader()` test helper. This is a **test-authoring** fix, not a production bug -- a real user clicking the visible header text (not on top of a card) correctly triggers only the column's own handler.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `TaskDialog.svelte`/`EtapaDialog.svelte` are proven self-contained and ready for Plans 23-04/23-06 to mount unmodified from `Dashboard.svelte` (both already accept the unused-by-this-plan `breadcrumb` prop for that depth-2 reuse).
- `ProjetosSection.svelte`'s own `activeKanbanDialog`/`findEtapaById`/`findTarefaById`/`openKanbanDialog`/`closeKanbanDialog` mechanism is complete and independent of `Dashboard.svelte`'s own `dialogStack` -- no further wiring needed in this file for this phase.
- Open item: `.planning/WINDOWS.md` entry #14 (the nested-button deviation) should be revisited if this app ever adopts SSR.
- No blockers.

---
*Phase: 23-focus-dialog-system*
*Completed: 2026-08-12*

## Self-Check: PASSED
- All 5 files confirmed present on disk (TaskDialog.svelte, EtapaDialog.svelte, ProjetosSection.svelte, focus-dialog-projetos-kanban.spec.ts, this SUMMARY).
- All 3 task commit hashes (`d85942d`, `d7924bd`, `a715a49`) confirmed present in `git log --oneline --all`.
