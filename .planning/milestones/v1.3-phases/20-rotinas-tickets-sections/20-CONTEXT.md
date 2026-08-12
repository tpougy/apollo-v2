# Phase 20: Rotinas & Tickets Sections - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Users manage recurring-routine instances and their templates from one section with
clear tab separation, and inspect any ticket's or task's subtarefas from a shared inline panel
without ever touching the raw parent-type selector.

</domain>

<decisions>
## Implementation Decisions

Binding spec: `/home/thomaz/pessoal/apollo-v2/spec-ui.md` §2.3 ("Rotinas") and §2.4 ("Tickets e
subtarefas, base: 1d") — read in full before planning, plus §0. Locked decisions:

- **RotinasSection**: `Tabs.Root` with two tabs — "Instâncias" (default) and "Templates".
  Instâncias tab = `EntityScreen` of `instanciasRotina` exactly as today (`capabilities.create`/
  `.delete` stay `false`, `updatableFields: ["status"]` only — zero new affordance). Templates
  tab = `EntityScreen` of `templatesRotina` exactly as today, plus a static context paragraph
  ("configuração que gera as instâncias").
- **TicketsSection**: `EntityScreen` of `tickets`; selecting a row opens an inline side panel
  (`w-56`, `border`, inside the Shell content frame — explicitly NOT a new `Sheet` component per
  spec §7's "não adicionar: sheet") showing that ticket's subtarefas.
- **Shared `SubtarefasPanel.svelte`**: one component, used from both TicketsSection (opened from
  a selected ticket) and from wherever a task is shown (Phase 19's `ProjetosSection` etapa-detail
  task rows — their subtarefa count chip becomes a real trigger for this same panel, replacing
  the "passive count only" placeholder Phase 19 CONTEXT.md explicitly deferred to this phase).
  The panel is `EntityScreen` of `subtarefas` with `scopeWhere: {"ticket.id": <id>}` or
  `{"tarefa.id": <id>}` and `presetLinks: { ticket: <id> }` or `{ tarefa: <id> }` — both using
  Phase 18's additive props, no new prop, no `if (etype===...)` anywhere.
- **`xor-parent-type` never touched by the user in this flow**: because the panel always opens
  already scoped/pre-resolved to one concrete parent (ticket or tarefa), the generic form's
  existing `xor-parent-type` selector (unchanged, still exists in the generic engine) is
  pre-filled and the user's normal path never needs to interact with it.
- Fundos and Log sections are untouched (NEST-06, already satisfied by Phase 18 — not this
  phase's concern, no regression expected).

### Claude's Discretion

Exact panel layout/trigger UI (icon button vs. text link vs. clicking the whole subtarefa chip),
whether `SubtarefasPanel` is a fully standalone component or a thin wrapper that composes
`EntityScreen` directly — guided by spec §0/§2.3/§2.4 and existing Phase 18/19 conventions
(hidden-EntityScreen-instance pattern is available if useful, but a panel is more naturally a
directly-visible mounted `EntityScreen` with `scopeWhere`/`presetLinks`, not hidden).

</decisions>

<code_context>
## Existing Code Insights

Read `web/src/lib/Shell.svelte` (post-Phase-19: Route union, ProjetosSection mount, interim
nestedGroups dropdown — now pruned of etapas/tarefas per Phase 19, still has templatesRotina/
subtarefas entries pending this phase's removal), `web/src/lib/entities/EntityScreen.svelte`
(scopeWhere/presetLinks from Phase 18), `web/src/lib/sections/ProjetosSection.svelte` (Phase 19's
subtarefa count chip — currently passive/inert, to be wired to the new panel here), `web/src/lib/
entities/defs/{instanciasRotina,templatesRotina,tickets,subtarefas,tarefas}.ts`, and `web/e2e/
helpers/gotoNested.ts` (still has templatesRotina/subtarefas entries — this phase should retire
them once RotinasSection/TicketsSection make the interim dropdown unnecessary for those two)
directly during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No additional specifics beyond spec-ui.md §0/§2.3/§2.4 and REQUIREMENTS.md NEST-04, NEST-05.

</specifics>

<deferred>
## Deferred Ideas

- Dashboard real content — Phase 21-22
- Dialog system — Phase 23

</deferred>
