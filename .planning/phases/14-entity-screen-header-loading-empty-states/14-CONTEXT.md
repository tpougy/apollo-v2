# Phase 14: Entity Screen — Header, Loading & Empty States - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Every entity screen presents a proper page header, a content-shaped loading state, and a composed empty state, with the table visually bounded — for all 9 entities across all 3 capability classes.

Requirements: ENTTBL-04, ENTTBL-05, ENTTBL-06, ENTTBL-07.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Design Intent (from REQUIREMENTS.md, applies to every phase this milestone)
The app should feel bonito, elegante e orgânico. This phase touches the single generic `EntityScreen.svelte` component shared by all 9 entities — the fix must read as one coherent, careful design language applied consistently, not 9 mechanically-identical copies. Inherit the spacing rhythm and content-frame established by Phase 13's `Shell.svelte` — do not add a second, competing outer-frame wrapper inside `EntityScreen.svelte` (Phase 13 already owns that).

### Component-reuse decision (already established, do not re-litigate)
`EntityScreen.svelte` stays the single generic, config-driven component for all 9 entities. Do NOT create new per-entity components or a new `PageHeader.svelte`/`EmptyState.svelte` abstraction file — per research (ARCHITECTURE.md), only 3 dissimilar call sites exist across the whole milestone (Login, Shell, EntityScreen), which doesn't justify a shared component; keep this phase's additions inline inside `EntityScreen.svelte`.

### Research guidance (from .planning/research/SUMMARY.md, FEATURES.md, STACK.md, PITFALLS.md)
- Add a page-header row inside `EntityScreen.svelte`: title + short description + right-aligned primary "novo" (create) action — replacing the current below-table create action.
- Loading state: use shadcn `Skeleton` (new, `bunx shadcn-svelte add skeleton`) shaped like the real table rows, replacing the current plain "carregando..." text.
- Empty state: use shadcn `Empty` (new, `bunx shadcn-svelte add empty`) with icon/title/description/CTA, reusing the existing `startCreate` handler — replacing the current single-text-cell message.
- Table: wrap in a bounding `Card`/border container instead of floating directly on the page background.
- **Pitfall to avoid:** do NOT nest the `Empty` composition invalidly inside `<tbody>` — restructure it as a sibling to `<Table>`, not nested table content.
- **Pitfall to avoid:** no over-abstraction — keep everything inline in `EntityScreen.svelte`, no new `PageHeader`/`EmptyState` file (see Component-reuse decision above).
- No new npm dependency — `Skeleton`/`Empty` are one-command shadcn-svelte CLI pulls from the already-configured registry (same mechanism used for every other v1.1 component).

</decisions>

<code_context>
## Existing Code Insights

- `web/src/lib/entities/EntityScreen.svelte` — THE single generic, config-driven table+form component reused by all 9 domain entities (`fundos`, `projetos`, `etapas`, `tarefas`, `templatesRotina`, `instanciasRotina`, `tickets`, `subtarefas`, `logInferenciaClaude`), each with different `capabilities` (full-CRUD, restricted create-only/status-only, or fully read-only). This phase touches its list-view header/loading/empty/table-bounding markup only — form/dialog internals are Phase 15's scope, row actions are Phase 16's scope.
- Load-bearing `data-testid`s that MUST be preserved verbatim: `entity-error`, `row`, `row-edit`, `row-delete`, `empty-state`, `entity-create-start`. ALL of these must keep working across all 9 entities and all 3 capability classes.
- `web/src/lib/Shell.svelte` (Phase 13) already owns the single outer content-frame wrapper (`<main data-testid="shell-content-frame" class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">`) around the `{#key ativo}` EntityScreen mount — EntityScreen must NOT duplicate this framing, only add its own internal header/loading/empty/table composition within it.
- `web/e2e/entities-table-restyle.spec.ts`, `web/e2e/entities-fundos.spec.ts`, `web/e2e/entities-rotina-log.spec.ts`, `web/e2e/entities-projeto-etapa-tarefa.spec.ts`, `web/e2e/entities-ticket-subtarefa.spec.ts` — existing specs covering all capability classes across all 9 entities; must stay green (behavior unchanged, selectors preserved).
- Restricted capability entities (create-only, status-only, read-only) must keep their exact functional restrictions after this visual pass — no capability regression (mirrors ENTTBL-03 from v1.1).

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the goal/success-criteria and decisions above — discuss phase was skipped. Refer to ROADMAP phase description, success criteria, and the research guidance above.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
