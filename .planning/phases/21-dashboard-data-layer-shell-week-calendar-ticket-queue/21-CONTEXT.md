# Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Users land on a real Dashboard screen driven by one aggregate query and a set of pure,
unit-tested derivation functions, seeing this week's 5-day business calendar and their pending
ticket queue — the first visible slice of the new landing experience.

</domain>

<decisions>
## Implementation Decisions

Binding spec: `/home/thomaz/pessoal/apollo-v2/spec-ui.md` §3 ("Dashboard"), specifically §3.1
(grid), §3.2 (tickets column), §3.3 (week band), §5.1 (query shape), §5.2 (derive.ts functions),
§5.3 (task-completion decision), §5.4 (`vencido`), §6 (heatmap tokens — not this phase's UI, but
`faixaHeatmap` the pure function is), §0 throughout. Read in full before planning.

- **Consolidation with Phase 19's `projetosDerive.ts`**: Phase 19 already shipped
  `web/src/lib/sections/projetosDerive.ts` with `tarefaConcluida`/`progressoEtapa`/`vencido`
  (per REQUIREMENTS.md §5.3/§5.4), explicitly flagged in its own CONTEXT.md as provisional —
  "Phase 21 is the module's canonical owner and will consolidate/dedupe if this phase creates it
  first." This phase MUST move/reconcile that logic into the canonical
  `web/src/lib/dashboard/derive.ts` (same exported names per ROADMAP: `progressoEtapa`,
  `vencido`; `tarefaConcluida` may be kept as an internal helper or renamed to match derive.ts's
  final API) and update `ProjetosSection.svelte`'s import to point at the new canonical module —
  no duplicate logic, no drift between the two.
- **`derive.ts`**: pure (no `db` import, `hoje` passed as parameter, no `Date.now()`/`new Date()`
  called internally without a parameter) — exports `semanaUtil`, `agendaPorDia`,
  `rotinasPorFundo`, `cargaDoMes`, `faixaHeatmap`, `progressoEtapa`, `vencido`. `derive.test.ts`
  alongside, following the existing `bizdays.test.ts` pattern already in this codebase.
  `rotinasPorFundo`/`cargaDoMes`/`faixaHeatmap` exist as pure functions in this phase even though
  their *rendering* (fundo-grouped cards, heatmap grid) is Phase 22's job — this phase just needs
  them correct and unit-tested so Phase 22 consumes them directly.
- **`dashboardQuery.ts`**: exactly one `db.useQuery` per spec §5.1, shape
  `{ projetos: { fundo: {}, etapas: { tarefas: {} } }, tarefas: { etapa: { projeto: {} },
  subtarefas: {} }, instanciasRotina: { template: { fundo: {} } }, tickets: { fundo: {},
  subtarefas: {} }, fundos: {} }`. **Never add `template`/`fundo` links to
  `defs/instanciasRotina.ts`** — that link exists in the raw InstantDB schema (same as
  `routineJob.ts` uses) but is deliberately absent from the presentation-layer `EntityConfig` to
  prevent `EntityScreen` from rendering a re-parenting select that would break `dedupeKey`. The
  Dashboard query bypasses `EntityConfig` entirely and queries `db` directly.
- **`Dashboard.svelte`**: not an `EntityScreen`, not in `registry.ts`. Mounts at
  `rota.section === "dashboard"` (already the default route since Phase 18, replacing that
  phase's placeholder). Grid: `grid-cols-[13rem_minmax(0,1fr)_16rem] gap-4` at `lg:`, single
  column below `lg` in order: semana → tickets → rotinas → projetos (spec §3.1's exact stacking
  order — note tickets is visually left at `lg:` but stacks *after* the week band on narrow
  screens, per spec text literally: "abaixo de lg, uma coluna na ordem: semana → tickets →
  rotinas → projetos").
- **This phase's slice of the grid**: left column (tickets, DASH-02) + center-top (week band,
  DASH-03) fully built and real. Center-bottom (mini-kanbans, DASH-05) and right column (rotinas
  by fundo + heatmap, DASH-04) are Phase 22's job — this phase may leave those grid cells empty
  or with a lightweight "carregando..." / structural placeholder, NOT fake data.
- **Week band (§3.3)**: 5 cards Mon-Fri only. Sat/Sun items surface only via a chip
  (`sáb/dom (N)`) rendered *only when N > 0*, opening a `Popover` with those two days' items. Card
  shows up to 3 items + `+N`, left border 3px by type (tarefa `border-foreground`, rotina
  `border-muted-foreground`, ticket-hard `border-destructive`), today's card header `bg-muted`.
  Header navigation to a day-dialog (spec §4 dialog nº 2) is explicitly **out of scope** for this
  phase — Phase 23 builds the dialog system; the day/item headers can be plain non-interactive
  elements or inert buttons for now (do not fake a dialog).
- **Ticket queue (§3.2)**: per REQUIREMENTS.md's §5.3 decision, do NOT filter by completion (no
  non-string signal exists on `tickets`) — list all tickets, `tipoPrazo === "hard"` first, then
  by date. Card = title (2-line clamp) + `fundo · PRAZO · data`, whole card is a `<button>`.
  Clicking it is explicitly **out of scope this phase** (Phase 23's dialog nº 1) — an inert/no-op
  button or a button that does nothing yet is acceptable; do not fake a dialog. "ver todos" link
  navigates to the real Tickets section (`rota = { section: "entity", etype: "tickets" }`).
  Empty state: `Empty.Root` "Nenhum ticket pendente".

### Claude's Discretion

Exact component boundaries (`Dashboard.svelte` monolith vs. splitting `WeekCalendar.svelte`/
`TicketQueue.svelte` now vs. later — spec §8 anticipates separate files
`TicketQueue,WeekCalendar,ProjectStrips,RoutinesByFundo,MonthHeatmap`, but this phase only needs
the first two functionally complete), whether placeholder grid cells for Phase 22's content are
literally empty `<div>`s or a labeled skeleton — guided by spec §0 (one spacing scale, no
over-engineering) and existing codebase conventions.

</decisions>

<code_context>
## Existing Code Insights

Read `web/src/lib/Shell.svelte` (Phase 18's placeholder `Dashboard.svelte` mount — to be
replaced with real content, not a new mount point), `web/src/lib/bizdays.ts` (business-day
calendar this phase's `semanaUtil` needs), `web/src/lib/sections/projetosDerive.ts` (Phase 19's
provisional module to consolidate away), `web/src/lib/entities/defs/{tickets,tarefas,
instanciasRotina,templatesRotina,fundos,projetos,etapas}.ts`, `web/src/lib/db.ts`, and
`shared/instant.schema.ts` (confirms `instanciasRotina.template`/`templatesRotina.fundo` exist at
schema level even though absent from `EntityConfig`) directly during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No additional specifics beyond spec-ui.md §0/§3.1/§3.2/§3.3/§5/§6(pure-fn-only) and
REQUIREMENTS.md DASH-01, DASH-02, DASH-03, DASH-06, DASH-07.

</specifics>

<deferred>
## Deferred Ideas

- Mini-kanbans by project (DASH-05) — Phase 22
- Rotinas-by-fundo column + monthly heatmap rendering (DASH-04) — Phase 22
- All 7 focus dialogs, including day/ticket/routine click targets on this phase's own UI — Phase 23

</deferred>
