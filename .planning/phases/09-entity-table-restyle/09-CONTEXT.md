# Phase 9: Entity Table Restyle - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

`EntityScreen.svelte`'s list view renders every one of the 9 domain entities through shadcn Table/Data Table with Badge-rendered status fields, and every entity's existing capability restriction (full-CRUD, create-only, status-only, read-only) is visually and functionally identical to before the restyle.

**Explicitly NOT in this phase's scope** (deferred to Phase 10): the create/edit `<form>` itself (fields, Dialog/Sheet wrapping, date-picker, Select/Combobox for relationships) — Phase 10 owns wrapping the existing inline form in a Dialog/Sheet. Phase 9 only touches the `<table>`/rows/row-actions/empty-state/badges. The "novo" (create) button and row-edit/row-delete buttons should become shadcn `Button`, but their `onclick` behavior (toggling `mode` to show the still-plain inline form below the table) stays exactly as-is — Phase 10 converts that inline form into a Dialog/Sheet. Do not attempt the Dialog conversion in this phase.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

### Locked constraints from PROJECT.md (do not reopen)
- C-11: shadcn-svelte preset b0 (nova/neutral/lucide), already initialized (Phase 7). Button/Input/Label/Card/Alert already added (Phase 8).
- C-12: zero human UAT anywhere — every `<verify>` must be `<verify><automated>`.
- C-08: `bun`/`bunx` only.

### Entity capability classes (9 entities, from `web/src/lib/entities/defs/*.ts` — verify exact capabilities by reading each config, do not assume from memory)
- Full CRUD: `fundos`, `projetos`, `etapas`, `tarefas`, `templatesRotina`, `tickets`, `subtarefas` (verify each's actual `capabilities` object)
- Restricted: `instanciasRotina` (create-only / status-only update per ROADMAP — no full edit/delete), `logInferenciaClaude` (read-only, zero row actions)
- **This phase's SC #4 is specifically about proving `instanciasRotina` and `logInferenciaClaude`'s restricted capabilities survive the restyle exactly** — read `web/src/lib/entities/defs/instanciasRotina.ts` and `web/src/lib/entities/defs/logInferenciaClaude.ts` directly to confirm current capability shape before planning.

</decisions>

<code_context>
## Existing Code Insights

Current `EntityScreen.svelte` (531 lines) — relevant markup for THIS phase (lines 331-390 approx):
- `<table>` with `<thead><tr>{#each config.listColumns as column}<th>{column}</th>{/each}<th>ações</th></tr></thead>`
- `<tbody>`: `{#if rowsOf().length === 0}` → `<tr data-testid="empty-state">` / else `{#each rowsOf() as row (row.id)}<tr data-testid="row" data-eid={row.id}>` with `<td>{columnValue(row, column)}</td>` per listColumn, then an actions `<td>` with `data-testid="row-edit"` button (gated by `config.capabilities.update`) and `data-testid="row-delete"` button (gated by `config.capabilities.delete`).
- Above the table: `<h2>{config.titulo}</h2>`, an `entity-error` paragraph.
- Below the table: `entity-create-start` button (gated by `mode === null && config.capabilities.create`), then the inline form (out of scope this phase).
- `columnValue()` (lines 102-115) resolves a column's display string for any field/link/xorLink column — status/enum fields currently render via this function as plain text; THIS phase's ENTTBL-02 requires wrapping status-like values in a shadcn `Badge` instead.
- **All these testids (`entity-error`, `row`, `row-edit`, `row-delete`, `empty-state`, `entity-create-start`) are load-bearing** — existing e2e specs (`entities-*.spec.ts`) assert on them. Preserve exactly.
- `config.listColumns: string[]` names the columns to render per entity — read each `defs/*.ts` to know which columns are status-like (candidates: `status`, `tipoGeracao`, `tipoPrazo`, `regraCompetencia`, `concluida`/boolean fields — decide case-by-case whether a boolean fits Badge or stays as-is).

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond REQUIREMENTS.md ENTTBL-01/02/03 and ROADMAP.md Phase 9's 4 success criteria.

</specifics>

<deferred>
## Deferred Ideas

The create/edit form restyle (Dialog/Sheet, per-field-type shadcn inputs, date-picker, relationship Select) is explicitly deferred to Phase 10 — see Phase Boundary above.

</deferred>
