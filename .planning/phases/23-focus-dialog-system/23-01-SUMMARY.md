---
phase: 23-focus-dialog-system
plan: 01
subsystem: ui
tags: [svelte5, bits-ui, dialog, entityscreen, dashboard, playwright]

# Dependency graph
requires:
  - phase: 19-22 (nested sections + dashboard)
    provides: EntityScreen.svelte's generic hidden-EntityScreen + driven row-edit-click pattern, Dashboard.svelte's dashboardQuery/TicketQueue/goToTickets nav-click idiom
provides:
  - "FocusDialog.svelte: shared S/M/L chrome wrapper (width/title/context-line/breadcrumb/footer/busy-aware escape-close) every one of the phase's 7 dialogs reuses unmodified"
  - "TicketDialog.svelte: dialog #1 of 7, self-contained (own hidden EntityScreen(tickets) edit host, own ver-pagina nav-click), reusable from any future host"
  - "Dashboard.svelte's dialogStack mechanism: DialogKind union, openDialog/popToFirst/closeAllDialogs, depth-2-capable, one if/else-if router branch"
affects: [23-03, 23-04, 23-05, 23-06, 23-07]

# Actuals (#2632)
actuals:
  tokens: 6464
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "FocusDialog chrome wrapper: S/M/L width lookup + Svelte 5 snippet body + busy-aware escapeKeydownBehavior, copied verbatim from EntityScreen.svelte's own Dialog.Content"
    - "Self-contained per-dialog-kind component: owns its own hidden-EntityScreen edit host (bounded-poll driven row-edit click) and its own ver-pagina nav-click-simulation, needing nothing from its host but the row + open/onOpenChange"
    - "Host-owned dialogStack $state (length capped at 2), swap-in-place render via a single if/else-if chain keyed on dialogStack's top entry -- never two simultaneous Dialog.Root instances"

key-files:
  created:
    - web/src/lib/dashboard/dialogs/FocusDialog.svelte
    - web/src/lib/dashboard/dialogs/TicketDialog.svelte
    - web/e2e/focus-dialog-ticket.spec.ts
  modified:
    - web/src/lib/dashboard/Dashboard.svelte
    - web/src/lib/dashboard/TicketQueue.svelte

key-decisions:
  - "Built the shared FocusDialog.svelte wrapper (per CONTEXT.md/23-RESEARCH.md's own recommendation) rather than 7 independent components repeating the same chrome"
  - "dialogStack lives in Dashboard.svelte as local $state, never a global store (spec §0.9); DialogKind union pre-declares all 7 kinds so later plans only add render branches, never touch the stack mechanism itself"
  - "breadcrumbLabelFor's 'dia' branch returns the raw ISO placeholder (documented, not a bug) -- unreachable until Plan 23-04 makes Dia a first-level launch point"
  - "Widened Dashboard.svelte's local SubtarefaRow type to add titulo (beyond the plan's explicitly-called-out TicketRow widening) -- TicketDialog's read-only subtarefas list needs it and it's already fetched at runtime via the unchanged subtarefas:{} query branch; same 'widen too-narrow local TS type, zero new query' precedent the plan itself applies to TicketRow"

patterns-established:
  - "Every later dialog in this phase (23-03..23-06) wraps FocusDialog, is self-contained with its own hidden edit host, and gets exactly one new {:else if activeDialogRef?.kind === \"X\"} branch in Dashboard.svelte's render chain -- never restructured into a lookup table"

requirements-completed: [DLG-01, DLG-02, DLG-03]

coverage:
  - id: D1
    description: "Clicking a ticket card opens a real, keyboard-accessible FocusDialog at M width (sm:max-w-3xl) showing that ticket's titulo/corpo/remetente/dataRecebimento"
    requirement: "DLG-01"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-ticket.spec.ts#opens a real Dialog.Root at M width showing the ticket's corpo/remetente/dataRecebimento; Esc closes it"
        status: pass
    human_judgment: false
  - id: D2
    description: "Context line reads exactly `${fundo} · ${TIPOPRAZO} · ${data}`"
    requirement: "DLG-01"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-ticket.spec.ts#context line reads `${fundo} · HARD · ${data}` exactly"
        status: pass
    human_judgment: false
  - id: D3
    description: "'editar' opens the real EntityScreen(tickets) edit form pre-filled, with zero duplicated form markup, and the focus dialog stays mounted underneath (not unmounted) while the edit dialog is open; entity-cancel returns to it"
    requirement: "DLG-01"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-ticket.spec.ts#focus-dialog-editar reveals the real EntityScreen(tickets) edit form pre-filled, keeps the focus dialog mounted underneath, and entity-cancel returns to it"
        status: pass
    human_judgment: false
  - id: D4
    description: "'ver na página completa →' navigates to the Tickets section (nav-tickets gets aria-current) and closes the dialog"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-ticket.spec.ts#focus-dialog-ver-pagina navigates to Tickets and closes the focus dialog"
        status: pass
    human_judgment: false
  - id: D5
    description: "Esc, click-outside, and the explicit 'fechar' footer button all close the dialog when idle; Esc is ignored on the inner edit dialog while its own submit write is in flight (busy)"
    requirement: "DLG-03"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-ticket.spec.ts#focus-dialog-fechar closes the dialog"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-ticket.spec.ts#clicking outside the dialog closes it when no edit is in progress"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-ticket.spec.ts#while the edit form's own submit is in flight (busy), Escape does not close the inner edit dialog"
        status: pass
    human_judgment: false
  - id: D6
    description: "Dashboard.svelte's dialogStack mechanism is generic, depth-2-ready, and exercised end-to-end at depth 1 with zero regression to the pre-existing dashboard.spec.ts/dashboard-kanbans.spec.ts suites"
    requirement: "DLG-03"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts (22 tests, all pass)"
        status: pass
      - kind: e2e
        ref: "web/e2e/dashboard-kanbans.spec.ts (7 tests, all pass)"
        status: pass
      - kind: other
        ref: "cd web && bun run check (0 errors)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-12
status: complete
---

# Phase 23 Plan 1: Focus Dialog System Tracer -- FocusDialog Chrome + TicketDialog Summary

**Shared `FocusDialog.svelte` chrome wrapper (S/M/L widths, breadcrumb, busy-aware close, editar/ver-pagina/fechar footer) plus `TicketDialog.svelte` (dialog #1 of 7) wired end-to-end through a new depth-2-capable `dialogStack` mechanism in `Dashboard.svelte`, proven by a 7-test standalone Playwright spec.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-12T01:10:00Z (approx.)
- **Completed:** 2026-08-12T02:00:20Z
- **Tasks:** 2
- **Files modified:** 5 (2 created components, 1 created e2e spec, 2 modified)

## Accomplishments
- `FocusDialog.svelte`: the one chrome wrapper every one of the phase's 7 dialogs will wrap -- S/M/L width lookup (`sm:max-w-md`/`sm:max-w-3xl`/`sm:max-w-[90vw]`, all `max-h-[85vh] overflow-y-auto`), optional breadcrumb button, title + optional context-line description, a body snippet slot, and a footer with optional editar/ver-pagina/footerExtra buttons plus an always-present "fechar" button -- all `disabled` and escape/outside-close-`ignore`d while `busy`.
- `TicketDialog.svelte`: fully self-contained -- resolves `ticketsConfig` via the registry (never a direct `defs/tickets.ts` import), renders the ticket's corpo/remetente/dataRecebimento/subtarefas read-only, drives its own hidden `EntityScreen(tickets)` host for "editar" (bounded-poll for `[data-testid="row"][data-eid=ID] [data-testid="row-edit"]`, mirroring `ProjetosSection.svelte`'s proven pattern), and owns its own "ver na página completa" nav-tickets click simulation.
- `Dashboard.svelte`: new generic `dialogStack` mechanism -- `DialogKind` union pre-declaring all 7 future kinds, `openDialog`/`popToFirst`/`closeAllDialogs`, `activeDialogRef`/`breadcrumbRef` derived state, and the ONE `{#if activeDialogRef?.kind === "X"}` router branch every later plan appends to. Widened local `TicketRow` (added `corpo`/`remetente`/`status`) and `SubtarefaRow` (added `titulo`) TS types to match data already fetched at runtime -- zero new query anywhere in this plan.
- `TicketQueue.svelte`: `dash-ticket-card`'s previously-inert button now calls `onOpenTicket(ticket.id)`.
- `web/e2e/focus-dialog-ticket.spec.ts`: 7 tests, all green, proving DLG-01/02/03 end-to-end for the Ticket dialog specifically (open/width/content, context-line format, editar-reuse-with-mounted-underneath, ver-pagina-nav, fechar, click-outside, busy-ignore-Escape).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end Ticket focus dialog -- FocusDialog chrome, TicketDialog, dialogStack, TicketQueue wiring** - `7fa08a3` (feat)
2. **Task 2: Full DLG-01/02/03 e2e coverage for the Ticket dialog** - `72bd44c` (test)

**Plan metadata:** (pending -- this SUMMARY's own commit)

## Files Created/Modified
- `web/src/lib/dashboard/dialogs/FocusDialog.svelte` - shared chrome wrapper (new)
- `web/src/lib/dashboard/dialogs/TicketDialog.svelte` - dialog #1 of 7, self-contained (new)
- `web/src/lib/dashboard/Dashboard.svelte` - dialogStack mechanism, widened TicketRow/SubtarefaRow types, TicketDialog mount, onOpenTicket wiring
- `web/src/lib/dashboard/TicketQueue.svelte` - `onOpenTicket` prop, `dash-ticket-card` onclick
- `web/e2e/focus-dialog-ticket.spec.ts` - new standalone e2e spec (new)

## Decisions Made
- Built the shared `FocusDialog.svelte` wrapper rather than 7 independent components, per CONTEXT.md's and 23-RESEARCH.md's own explicit recommendation -- the S/M/L width + footer chrome is byte-identical across all 7 dialogs.
- `dialogStack` lives entirely in `Dashboard.svelte` as local `$state`, matching spec §0.9's "sem store global." The `DialogKind` union already lists all 7 kinds so every later plan only adds a render branch, never touches `openDialog`/`popToFirst`/`closeAllDialogs`.
- `breadcrumbLabelFor`'s `"dia"` branch intentionally returns the raw ISO string as a documented placeholder -- structurally unreachable until Plan 23-04 makes Dia a first-level dialog kind, exactly as 23-RESEARCH.md anticipated.
- Ambiguity resolution (per this task's "resolve using plan text/CONTEXT/RESEARCH/spec-ui.md" instruction): spec-ui.md §4 "Regras comuns" explicitly requires a "fechar" footer button distinct from the ×; `FocusDialog.svelte` renders both (bits-ui's own `Dialog.Content` `showCloseButton` for the ×, plus an explicit `focus-dialog-fechar` ghost button), matching the plan's own explicit instruction verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Too-narrow local TS type] Widened Dashboard.svelte's `SubtarefaRow` to add `titulo`**
- **Found during:** Task 1 (writing `TicketDialog.svelte`'s read-only subtarefas list)
- **Issue:** The plan explicitly calls out widening `TicketRow` (adding `corpo`/`remetente`/`status`) but does not mention `SubtarefaRow`, which Dashboard.svelte declared as `{ id: string; concluida: boolean }` -- missing `titulo`, needed to render each subtarefa's label in the dialog body. The field is already fetched at runtime via the unchanged `subtarefas: {}` query branch (`defs/subtarefas.ts`'s own `titulo` field), exactly the same "widen too-narrow local TS type, add zero new query" situation the plan itself documents for `TicketRow`.
- **Fix:** Added `titulo: string` to Dashboard.svelte's local `SubtarefaRow` type (shared across `ProjetoRow`/`TarefaRow`/`TicketRow`'s nested subtarefas) -- no query change, no runtime behavior change for any other consumer of that type.
- **Files modified:** `web/src/lib/dashboard/Dashboard.svelte`
- **Verification:** `bun run check` reports 0 new TypeScript errors; `ticket-dialog-subtarefas` renders each subtarefa's `titulo` correctly in manual review of `TicketDialog.svelte`'s snippet.
- **Committed in:** `7fa08a3` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1/2 -- too-narrow type, matching the plan's own precedent for a sibling field)
**Impact on plan:** Pure type-widening, zero behavior change to any other consumer. No scope creep.

## Issues Encountered
None -- both tasks' `<verify>` commands passed on the first run; the tracer feedback gate (auto mode active) re-ran Task 1's own `<verify>` before proceeding to Task 2's expansion, and it passed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `FocusDialog.svelte` and the self-contained-dialog-component pattern (own hidden edit host, own nav-click "ver na página completa") are proven end-to-end and ready for Plans 23-03 through 23-06 to reuse verbatim for the remaining 6 dialog kinds.
- `Dashboard.svelte`'s `dialogStack`/`DialogKind`/`openDialog`/`popToFirst`/`closeAllDialogs`/`activeDialogRef`/`breadcrumbRef` mechanism is generic and depth-2-ready; every later plan needs only to add its own `openXDialog` function, its own `activeX` derived lookup, and one new `{:else if activeDialogRef?.kind === "X"}` render branch -- never restructure the mechanism itself.
- No blockers. Plan 23-02 (derive.ts `rotinasDoFundo`) landed concurrently on `main` (commits `157e970`/`19f5e26`/`954b2ff`) and is confirmed disjoint from every file this plan touched.

---
*Phase: 23-focus-dialog-system*
*Completed: 2026-08-12*
