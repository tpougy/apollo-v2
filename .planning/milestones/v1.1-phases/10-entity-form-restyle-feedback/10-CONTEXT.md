# Phase 10: Entity Form Restyle & Feedback - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Create/edit forms for all 9 entities are rebuilt inside a shadcn Dialog/Sheet using per-field-type shadcn inputs (including a real date-picker for date fields and Select/Combobox for relationship fields), validation errors render via shadcn conventions instead of `window.alert`, and every write anywhere in the app — entity CRUD and auth alike — surfaces a Sonner toast.

**Explicitly NOT in this phase's scope:**
- Delete confirmation (`window.confirm` in `handleDelete`) is NOT covered by any REQUIREMENTS.md item (ENTFRM-04 only covers form *validation* errors, not the delete-confirm dialog) and ROADMAP Phase 10 SC4's "no native `window.alert`/`confirm`" check is scoped to the *submission* flow with an invalid field, not delete. Leave `window.confirm` on delete as-is unless converting it is trivial and doesn't risk the phase — Claude's discretion, not required.
- Table/list-view markup (already done, Phase 9) and the login/shell screens (Phase 8) — do not touch.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

### Locked constraints from PROJECT.md (do not reopen)
- C-11: shadcn-svelte preset b0. Table/Badge added (Phase 9); Button/Input/Label/Card/Alert added (Phase 8). This phase adds: Dialog or Sheet (planner's choice, justify), Select (native-select-replacement for enum + relationship fields), Checkbox (for boolean fields), Calendar + Popover (date-picker pattern), Sonner (toast).
- C-12: zero human UAT anywhere — every `<verify>` must be `<verify><automated>`.
- C-08: `bun`/`bunx` only.

### Full field-kind inventory across all 9 entities (from `web/src/lib/entities/defs/*.ts` — read directly, this is a summary for orientation, verify against source)
- `kind: "text"` — plain Input (most entities)
- `kind: "textarea"` — Textarea (need to add via `shadcn-svelte add textarea` if not covered by existing components)
- `kind: "number"` — Input type=number
- `kind: "boolean"` — currently native checkbox → becomes shadcn `Checkbox` (fields: `ativo`, `concluida`, `propagarAtrasoSoft`)
- `kind: "date"` — currently native `<input type="date">` → becomes shadcn Calendar/date-picker popover (fields across `projetos`, `tarefas`, `tickets`, `instanciasRotina`, `fundos.createdAt`, `logInferenciaClaude.createdAt` — note some date fields are on read-only/restricted entities where the field is display-only in practice, still convert consistently)
- `kind: "select"` — currently native `<select>` with static string `options` (fields: `tarefas.tipoPrazo`, `templatesRotina.tipoGeracao`, `tickets.tipoPrazo`) → becomes shadcn `Select`
- Relationship `links` (plain, single-target, e.g. `projetos.fundo`, `etapas.projeto`, `tarefas.etapa`, `templatesRotina.fundo`/`antecessor`, `tickets.fundo`) — currently native `<select>` populated from a live query → becomes shadcn `Select` (Combobox only if the planner judges a plain Select insufficient for usability at this app's scale — REQUIREMENTS.md ENTFRM-03 says "Select/Combobox primitives", either is acceptable)
- `xorLink` (only on `subtarefas`: choose `tarefa` OR `ticket` parent) — two-step native `<select>` (parent-type chooser + target picker) → becomes shadcn `Select`s, same two-step structure preserved

### Capability-restricted entities — form never shows or is narrowed
- `logInferenciaClaude`: capabilities all false — the create/edit form NEVER renders for this entity (no `entity-create-start` button exists, per Phase 9). This phase's Dialog/Sheet work is simply inapplicable here — do not force a form to exist.
- `instanciasRotina`: capabilities.create=false, capabilities.update=true with `updatableFields: ["status"]` — only an EDIT dialog exists, containing only the `status` field. No create dialog.

### All other entities (`fundos`, `projetos`, `etapas`, `tarefas`, `templatesRotina`, `tickets`, `subtarefas`) are full CRUD — both create and edit dialogs apply.

</decisions>

<code_context>
## Existing Code Insights

Current `EntityScreen.svelte` form section (lines 391-529, already restyled table section above it in Phase 9 — do not re-touch the table):
- `{#if mode !== null}<form onsubmit={handleSubmit}>` wraps everything — becomes the Dialog/Sheet body, `mode` state (`"create"|"edit"|null`) already controls visibility, reuse it as the Dialog's `open` binding.
- Per-field rendering is a big `{#each editableFields() as f}{#if f.kind === "text"}...{:else if f.kind === "textarea"}...` chain (5 branches: text/textarea/number/boolean/date, plus a 6th for `select`) — each branch has its own `data-testid={`field-${f.name}`}` — PRESERVE THIS EXACT TESTID PATTERN, only swap the underlying element.
- Links section: `{#each config.links ?? [] as link}` renders a `<select data-testid={`link-${link.label}`}>` populated via `linkOptionsFor(link)`.
- xorLink section: two selects, `data-testid="xor-parent-type"` (parent-type chooser) and `data-testid={`link-${xorParentType}`}` (dynamic, target picker) — same testid convention as plain links, reused dynamically.
- Submit/cancel: `data-testid="entity-submit"` (type=submit) and `data-testid="entity-cancel"` (type=button).
- `formError` state renders as `<p data-testid="entity-error">{formError}</p>` at the top of the section (line 335) — this becomes an `Alert` per ENTFRM-04, but the testid stays `entity-error` (already used by Phase 9-untouched error paths too — same testid serves both list-load errors and form-submit errors, do not split it).
- ALL business logic (`handleSubmit`, `startCreate`, `startEdit`, `cancelForm`, the XOR-unlink-on-parent-switch handling, the `parent_not_found` pre-check before transact) must stay functionally identical — this phase is markup + Dialog wrapping + toast calls only, never a logic rewrite.
- `LoginScreen.svelte` (Phase 8) and any entity CRUD write paths both need Sonner toast calls added for FDBK-01 — success on `handleSubmit`'s successful transact and on `handleDelete`'s successful transact; error on any caught exception (currently only sets `formError`, should now also/instead surface via toast per FDBK-01 — planner's call whether toast supplements or replaces the inline `entity-error` Alert, but the Alert must stay since ENTFRM-04 requires it for validation errors specifically).

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond REQUIREMENTS.md ENTFRM-01/02/03/04 + FDBK-01 and ROADMAP.md Phase 10's 5 success criteria.

</specifics>

<deferred>
## Deferred Ideas

Delete-confirmation dialog conversion (window.confirm → shadcn AlertDialog) — not required by REQUIREMENTS.md, left to Claude's discretion, not a blocking gap if skipped.

</deferred>
