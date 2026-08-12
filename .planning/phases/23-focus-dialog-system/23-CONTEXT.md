# Phase 23: Focus Dialog System - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Users can drill from any clickable Dashboard or nested-section surface into a consistent,
keyboard-accessible read-first dialog for that item, edit it via the existing entity form
without duplicating any markup, and never get lost more than one level deep.

</domain>

<decisions>
## Implementation Decisions

Binding spec: `/home/thomaz/pessoal/apollo-v2/spec-ui.md` §4 (the full dialog table + common
rules) is the exact spec for this phase — read it in full, plus §0 throughout. This is the final
functional phase of the milestone; every dialog *target* already exists (Phases 19-22), this
phase only builds the 7 dialog components and wires every previously-inert `<button>` to open
the correct one.

- **7 dialogs, exactly 3 widths** (spec §4 table + "Regras comuns"): S = `sm:max-w-md` (Tarefa,
  Rotina), M = `sm:max-w-3xl` (Ticket, Dia, Fundo, Etapa), L = `sm:max-w-[90vw]` (Projeto). All
  `max-h-[85vh] overflow-y-auto`, matching the existing form-dialog pattern already used by
  `EntityScreen`'s create/edit dialog.
- **Every dialog has**: title, context line (`fundo · projeto · prazo` as applicable), read-only
  body (per spec §4's "conteúdo mínimo" column for that dialog number), footer with "editar",
  "ver na página completa →", and close. No data exists only inside a dialog — everything shown
  must be traceable to already-fetched `dashboardQuery`/section data or a light dedicated query.
- **"editar" reuses the existing form, never duplicates it**: same hidden-`EntityScreen`-instance
  + driven-click pattern already proven in Phases 19-20 (`ProjetosSection.svelte`,
  `SubtarefasPanel.svelte`) — open the dialog's own hidden `EntityScreen(config)` instance and
  drive its `row-edit`/`entity-edit-start` (or equivalent) button for the target row. Do not add
  a third prop to `EntityScreen.svelte` or any `if (etype===...)` branch anywhere — this is purely
  composition from the outside, exactly as prior phases did it.
- **"ver na página completa →"**: navigates `rota` to the real section (e.g.
  `{section:"entity", etype:"tickets"}` for the Ticket dialog, or into `ProjetosSection`'s
  existing master-detail for Projeto/Etapa/Tarefa) and closes the dialog — reuses Phase
  18-22's existing route/section machinery, no new navigation concept.
- **Wiring existing inert buttons (DLG-02)**: every button phases 19-22 already built as
  `<button>` with no `onclick` (ticket card, day header, weekend-chip items, heatmap cell,
  routine row, fundo badge, kanban column header, task/kanban card, plus §2.2's etapa/tarefa rows
  inside `ProjetosSection` where dialogs also apply per spec §4's "alvos" column) now gets its
  real handler: open the matching dialog with the right item's data. Nested targets (e.g. a
  routine row inside a fundo card, a fundo badge inside a project-strip header) call
  `stopPropagation` so clicking the child never also fires the parent's handler — this pattern is
  already established (`SubtarefasPanel.svelte`'s chip click, `ProjetosSection.svelte`'s row
  delegation) and should be reused, not reinvented.
- **Depth cap = 2 (DLG-03)**: from a Projeto dialog you may open a Tarefa dialog (or Etapa); from
  that second-level dialog, no further dialog opens — the breadcrumb/context line at the top of a
  second-level dialog is text only (spec: "o breadcrumb no topo do dialog volta um nível" — the
  breadcrumb is a `<button>` back to the first dialog, not a new destination). Concretely: only
  Projeto (dialog 4) and Dia (dialog 2) are ever "first-level" launch points that can themselves
  open a second dialog (Projeto→Etapa/Tarefa per spec's kanban card/column-header targets inside
  its own body; Dia→ any item in that day's full agenda). Ticket/Fundo/Etapa/Tarefa/Rotina dialogs
  never open another dialog from inside themselves.
- **Close behavior**: reuse `EntityScreen`'s existing `escapeKeydownBehavior={busy ? "ignore" :
  "close"}` idiom verbatim for Esc/click-outside/×. Destructive actions (only reachable via
  "editar"'s underlying `EntityScreen` form, never directly in read-only dialog body) still show
  their own `AlertDialog` on top, unchanged from existing behavior.
- **Rotina dialog (nº 7) special case**: per spec §4's table, "só `status` editável" — its
  "editar" affordance should route into `instanciasRotina`'s existing update-only form (already
  correctly restricted by `capabilities.create/delete: false`, `updatableFields: ["status"]"`),
  not imply any new create/delete capability.

### Claude's Discretion

Exact component file layout (spec §8 anticipates
`dashboard/dialogs/{TicketDialog,DayDialog,TaskDialog,ProjectDialog,FundoDialog,EtapaDialog,
RotinaDialog}.svelte` — follow that, it's spec-anticipated) and whether a shared base
`FocusDialog.svelte` wrapper factors out the common title/context-line/footer chrome (spec §4's
"Regras comuns") versus 7 independent components each repeating that chrome — planner's
discretion, but a shared wrapper is likely the more maintainable/spec-consistent choice since the
rules are identical across all 7.

</decisions>

<code_context>
## Existing Code Insights

Read `web/src/lib/dashboard/{Dashboard,WeekCalendar,TicketQueue,ProjectStrips,RoutinesByFundo,
MonthHeatmap}.svelte` (every currently-inert click target this phase wires up), `web/src/lib/
sections/{ProjetosSection,RotinasSection,TicketsSection,SubtarefasPanel}.svelte` (existing
hidden-EntityScreen-instance + driven-click pattern to reuse for "editar"; existing etapa/tarefa
click targets inside ProjetosSection that also need dialog wiring per spec §4), `web/src/lib/
entities/EntityScreen.svelte` (existing dialog width/`escapeKeydownBehavior`/`Dialog.Description`/
`Footer` pattern to mirror for the new read-only dialogs), `web/src/lib/dashboard/derive.ts`
(already has everything needed: `vencido`, `progressoEtapa`, etc. — no new pure function should
be needed, but confirm during research), and `web/src/lib/dashboard/dashboardQuery.ts` (confirm
whether the existing single query already carries every field each of the 7 dialogs' "conteúdo
mínimo" needs, or whether a light dedicated per-dialog query is needed for anything the dashboard
query doesn't fetch, e.g. a ticket's full `corpo`/`remetente`) directly during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No additional specifics beyond spec-ui.md §0/§4 and REQUIREMENTS.md DLG-01, DLG-02, DLG-03.

</specifics>

<deferred>
## Deferred Ideas

None — this is the final functional phase of the milestone. After this phase: milestone audit →
complete → tag v1.3.

</deferred>
