# Phase 16: Entity Screen — Row Actions & Delete Confirmation - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Row action buttons (edit/delete) have consistent alignment and spacing, with no portal-based menu introduced for row actions; the delete action uses a shadcn `AlertDialog` instead of the native `window.confirm()`.

Requirements: ENTTBL-08, DELCONF-01.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

### Design Intent (from REQUIREMENTS.md, applies to every phase this milestone)
The app should feel bonito, elegante e orgânico. This is the last EntityScreen.svelte sub-step and the highest-risk one per research (portal/focus-management pitfalls). Get row-action alignment/spacing right and make the AlertDialog feel like a natural, polished part of the same design language established in Phases 12-15 — not a bolted-on afterthought.

### Row-actions decision (already established, do not re-litigate)
Row action buttons (edit/delete) stay as visible, non-portaled inline `Button`s — explicitly NO `DropdownMenu`/kebab-menu/portal-based menu for row actions. Rationale (from research): only 2 actions per row, and portal-based menus render outside the row's DOM subtree, which would silently break `row.getByTestId("row-edit")`/`row.getByTestId("row-delete")` row-scoped Playwright locators used across all 9 entity specs. Just fix alignment/spacing/gap on the existing inline buttons.

### AlertDialog decision (already established via REQUIREMENTS.md DELCONF-01 — approved, do not re-litigate)
The delete action uses a shadcn `AlertDialog` (new, `bunx shadcn-svelte add alert-dialog`) instead of the native `window.confirm()`. This was already logged as v1.1 tech debt and is explicitly scoped IN for this milestone as its own reviewed sub-scope, with dedicated Playwright coverage (keyboard confirm/cancel, focus handling). No new npm dependency — one-command shadcn-svelte CLI pull from the already-configured registry.

### Focus-management awareness (learned this milestone — Phase 14 needed 2 fix attempts, Phase 15 needed 1 fix attempt for this exact bug class)
This phase is explicitly flagged by research as the highest-risk sub-step in the whole milestone for portal/focus-management regressions. When implementing the AlertDialog, be deliberate about: (1) what element receives focus when the AlertDialog opens (should be a safe default, e.g. the Cancel/destructive action per shadcn's own convention), (2) what element receives focus back after the AlertDialog closes (should return to a stable, still-mounted element — the row's delete button if the row still exists, or a sane fallback like `entity-create-start` if the row was just deleted and no longer exists), (3) verify this focus behavior empirically with a real Playwright test, not just trust it works — do not repeat the mistake of shipping a "fix" that isn't verified against actual `document.activeElement` behavior.

</decisions>

<code_context>
## Existing Code Insights

- `web/src/lib/entities/EntityScreen.svelte` — `handleDelete` currently uses native `window.confirm()`. Row action buttons (`row-edit`, `row-delete`) render inline inside each `row` (data-testid) in the table. This is the last sub-step touching this shared component this milestone.
- Load-bearing `data-testid`s that MUST be preserved verbatim: `row`, `row-edit`, `row-delete`. All row-scoped Playwright locators (`row.getByTestId("row-edit")` etc.) across all 9 entity specs depend on these staying non-portaled and within the row's DOM subtree.
- Restricted capability entities: status-only entities (e.g. `instanciasRotina`) have no delete action at all (or a restricted action set) — the AlertDialog conversion must not add a delete affordance where one doesn't already exist. Read-only entities (`logInferenciaClaude`) have neither edit nor delete.
- Phase 14/15 both hit the same bug class (focus dropped/misdirected around a dynamic mount/unmount) — this phase is explicitly the highest-risk continuation of that pattern, since AlertDialog is itself a portal-based/focus-trapping component layered on top of a row that may disappear after a successful delete.
- `web/e2e/entities-*.spec.ts` files across all 9 entities exercise delete flows via the current `window.confirm()` — these must be updated to interact with the new `AlertDialog` instead (dialog accept/cancel), not just left pointing at a `window.confirm` that no longer exists.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the goal/success-criteria and decisions above — discuss phase was skipped. Refer to ROADMAP phase description, success criteria, and the research guidance above.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
