# Phase 15: Entity Screen — Form & Dialog Composition - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The create/edit `Dialog` form reads as a properly composed form across all 9 entities, not an unspaced `<div>` stack.

Requirements: ENTFRM-05, ENTFRM-06, ENTFRM-07, ENTFRM-08.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Design Intent (from REQUIREMENTS.md, applies to every phase this milestone)
The app should feel bonito, elegante e orgânico. This is the second sub-step touching the shared `EntityScreen.svelte` component — keep the same spacing scale and visual language established in Phase 14's header/table work, just applied to the form/dialog internals now.

### Component-reuse decision (already established, do not re-litigate)
`EntityScreen.svelte` stays the single generic, config-driven component for all 9 entities. Do NOT create new per-entity form components. This phase is isolated from Phase 14's table/header/empty-state changes — touches the `{#each editableFields()}` render block and the Dialog wrapper specifically, not the table/list-view code.

### Scope boundary (already established, do not re-litigate)
This phase must NOT touch `handleSubmit`/validation logic beyond adding a busy boolean around the existing `await db.transact(...)` call — no new required-field enforcement, only a visual cue driven by existing `config.fields[].required` data. Row actions (edit/delete buttons, `window.confirm` → `AlertDialog`) are explicitly Phase 16's scope, not this phase's.

### Research guidance (from .planning/research/SUMMARY.md, FEATURES.md, STACK.md)
- Use shadcn `Field`/`FieldGroup`/`FieldDescription` (new, `bunx shadcn-svelte add field`) for consistent label/control/helper-text spacing in the generic `{#each editableFields()}` render block — OR a plain-utility fallback (`space-y-2`/`grid gap-4`) if the `Field` swap proves too invasive for the generic multi-field-type render logic; either achieves the same visual outcome.
- Wire in `Dialog.Description` and `Dialog.Footer` (already installed at `web/src/lib/components/ui/dialog`, currently unused) instead of ad hoc footer markup.
- Add a submit busy/spinner state matching the pattern already used on `LoginScreen`'s submit button (Phase 12) — disable the submit button and show a spinner while `await db.transact(...)` is in flight.
- Add a required-field visual indicator (e.g. an asterisk or "obrigatório" hint) driven by existing `config.fields[].required` data — no new validation logic, purely a visual cue.
- No new npm dependency — `Field` (if used) is a one-command shadcn-svelte CLI pull; `Dialog.Description`/`Dialog.Footer` are already vendored.

</decisions>

<code_context>
## Existing Code Insights

- `web/src/lib/entities/EntityScreen.svelte` — the create/edit form renders inside a `Dialog` via a generic `{#each editableFields()}` block handling multiple field kinds (text/textarea/number/boolean/date/select/links/xorLink). This phase touches ONLY the form/dialog internals, not the table/header/loading/empty states (Phase 14, already done) or row actions (Phase 16, not yet done).
- Load-bearing `data-testid`s that MUST be preserved verbatim: `field-${name}` (per field), `link-${label}`, `xor-parent-type`, `entity-submit`, `entity-cancel`.
- Phase 12 established the busy/spinner pattern on `LoginScreen.svelte`'s submit button — reuse that exact pattern here for consistency.
- `entity-error` Alert (validation errors) already exists from v1.1 — do not change its behavior, only ensure it composes well with the new Field spacing.
- `web/e2e/entities-form-restyle.spec.ts` and the various `entities-*.spec.ts` files exercise create/edit dialogs across all 9 entities — must stay green.
- Restricted capability entities (create-only, status-only) have different field subsets in their forms — the generic render block must keep handling this correctly.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the goal/success-criteria and decisions above — discuss phase was skipped. Refer to ROADMAP phase description, success criteria, and the research guidance above.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
