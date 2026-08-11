# Phase 19: Projetos Section (Master-Detail) - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Users can browse every project grouped by fundo, drill into a selected project's etapas
and tasks without leaving the Projetos section, and still reach tasks that have no etapa.

</domain>

<decisions>
## Implementation Decisions

Full binding spec: `/home/thomaz/pessoal/apollo-v2/spec-ui.md` §2.2 ("Projetos (base: 5a)") is
the exact layout spec for this phase — read it in full before planning, along with §0's
constraints. Key locked decisions:

- Two-column layout inside the Shell content frame. Master column (left, `w-56`, `border-r`):
  name search (client-side filter over already-loaded rows), projects grouped by fundo
  (`text-xs uppercase text-muted-foreground` group header), "Sem fundo vinculado" group always
  last, a display-only "agrupar: fundo | nenhum | status" control (no persistence required),
  "+ novo projeto" reusing `EntityScreen`'s own create dialog for `projetos`, selected item
  `variant="secondary"` with testid `project-item` + `data-eid`.
- Detail column (right): breadcrumb `PROJETOS › <nome> › Etapa N · <nome>`, header with name +
  `fundo · N etapas · N tarefas` + "editar projeto"/"+ etapa" actions, body = etapas as
  collapsible rows ordered by `etapas.ordem` asc (mono `w-8` ordem, name, thin progress bar,
  `N/M` counter), single-open accordion. Opening an etapa lists its tasks: completion checkbox,
  title, prazo (`destructive` if overdue via the shared `vencido()` rule — never a status-string
  comparison), subtarefa count chip `N/M`, "+ tarefa nesta etapa" using `presetLinks: { etapa:
  <id> }` from Phase 18's `EntityScreen` extension.
- Progress bar / `N/M` counts use the already-decided `progressoEtapa` rule from
  REQUIREMENTS.md's §5.3 decision (task counts as done only if it has ≥1 subtarefa and all
  `subtarefas.concluida` are true; never `status` string comparison). This phase may implement
  a phase-local version of this rule inline, or start `derive.ts` early if convenient — Phase 21
  is the module's canonical owner and will consolidate/dedupe if this phase creates it first.
- Subtarefa count chip is a passive count display in this phase — clicking it to open the full
  subtarefas panel is NEST-05 (Phase 20's `SubtarefasPanel.svelte`); do not build that panel here,
  a disabled/inert chip or simple count-only badge is acceptable if the panel doesn't exist yet.
- "etapas ▾" toggle: list (default) or kanban (columns = etapas) view of the same etapa data,
  both reading from the exact same query — no separate data fetch per view.
- "Todas as tarefas": sibling tab/view to the projects list — `EntityScreen` of `tarefas` with
  no `scopeWhere`, plus a convenience "Sem etapa" filter control on top (client-side or a
  `scopeWhere`-driven toggle, executor's choice) so tasks with `etapa` link absent remain
  reachable — this is NOT optional per spec, it's the escape hatch for the `required: false`
  link.
- Uses Phase 18's additive `scopeWhere`/`presetLinks` EntityScreen props throughout (etapas'
  task list = `EntityScreen` of `tarefas` with `scopeWhere: {"etapa.id": <id>}`, or a bespoke
  lighter-weight list — executor's discretion, but reusing `EntityScreen` is the natural fit and
  spec's stated intent).
- All existing shadcn-svelte constraints apply (§0): one spacing scale, no new dependency beyond
  what's already installed (`accordion` may need adding via the shadcn-svelte CLI per spec §7 —
  this is registry-sourced, not a new external dependency).

### Claude's Discretion

Exact component boundaries (single `ProjetosSection.svelte` vs. split into sub-components),
whether etapas' task rows are a full nested `EntityScreen` instance or a lighter custom list
consuming the same query, exact search/group-by implementation details — guided by spec §0/§2.2
and existing codebase conventions from Phase 18.

</decisions>

<code_context>
## Existing Code Insights

Read `web/src/lib/Shell.svelte` (Phase 18 changes: `Route` union, `navConfigs`), `web/src/lib/
entities/EntityScreen.svelte` (Phase 18: `scopeWhere`/`presetLinks`), `web/src/lib/entities/defs/
{projetos,etapas,tarefas,fundos,subtarefas}.ts`, and `web/src/lib/db.ts` directly during
plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No additional specifics beyond spec-ui.md §0/§2.2 and REQUIREMENTS.md NEST-02, NEST-03.

</specifics>

<deferred>
## Deferred Ideas

- Full SubtarefasPanel (clicking the subtarefa count chip) — Phase 20 (NEST-05)
- RotinasSection, TicketsSection — Phase 20
- Dashboard real content — Phase 21-22
- Dialog system (including the Projeto/Etapa/Tarefa focus dialogs that will later wrap this
  same data) — Phase 23

</deferred>
