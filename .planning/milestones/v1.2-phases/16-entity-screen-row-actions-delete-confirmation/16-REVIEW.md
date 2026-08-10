---
phase: 16-entity-screen-row-actions-delete-confirmation
reviewed: 2026-08-10T21:30:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - web/src/lib/entities/EntityScreen.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-cancel.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-action.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-content.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-overlay.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-header.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-footer.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-title.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-description.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-portal.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-trigger.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog-media.svelte
  - web/src/lib/components/ui/alert-dialog/alert-dialog.svelte
  - web/src/lib/components/ui/alert-dialog/index.ts
  - web/e2e/entities-delete-confirmation.spec.ts
  - web/e2e/helpers/delete-confirmation.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-08-10T21:30:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed `EntityScreen.svelte`'s `window.confirm()` → shadcn `AlertDialog` conversion, the full vendored
`alert-dialog/*` component family, and the new/migrated Playwright delete-confirmation coverage.

I traced the actual bits-ui internals this phase depends on (`DialogActionState`, `AlertDialogCancelState`,
`mergeProps` in `alert-dialog-action.svelte`/`alert-dialog-cancel.svelte`) rather than trusting the in-file
comments' claims, specifically to answer the review brief's questions:

- **Bypass/mis-confirm risk**: no code path reaches `db.transact`'s delete except `confirmDelete`, itself only
  wired to `AlertDialog.Action`'s `onclick`. `AlertDialog.Action` does not auto-close on click (confirmed:
  `DialogActionState.props` has no `onclick`/`onkeydown`), so the dialog's lifecycle is fully controlled by
  `pendingDelete`/`deleteBusy` state, not implicit bits-ui behavior. Re-entrancy is blocked by a synchronous
  `deleteBusy` check that runs before the first `await`, so double-click/double-Enter cannot fire two deletes.
  No bypass found.
- **The `alert-dialog-cancel.svelte` `child`-snippet override** (re-adding a `disabled` attribute bits-ui's
  `AlertDialogCancelState.props` never emits): I independently confirmed, by reading
  `node_modules/bits-ui/dist/bits/dialog/dialog.svelte.js` and
  `node_modules/bits-ui/dist/bits/alert-dialog/components/alert-dialog-cancel.svelte`, that (a) the primitive's
  own `disabled` param is extracted out of `restProps` before `mergeProps` runs, so it is genuinely never part
  of `mergedProps`, and (b) the manual `<button type="button" {...props} disabled={disabled}>` in the override
  snippet forwards every other merged prop (id, aria/data attributes, the `ref` attachment, `onclick`/`onkeydown`,
  `class`) untouched — no prop-forwarding gap versus the unmodified `alert-dialog-action.svelte` sibling, which
  needs no such override because `DialogActionState.props` never strips `disabled` from `restProps` in the first
  place. This is a real, correctly-fixed bug, not a cosmetic one.
- **Accessibility**: `AlertDialog.Action`/`.Cancel` render as real `<button>` elements (no `<div onclick>`);
  focus is deliberately steered (`onOpenAutoFocus` → Cancel) rather than left to bits-ui's un-configured default
  (Content container). No raw color literal found in any file this phase touched — `bg-black/10` in
  `alert-dialog-overlay.svelte` is the exact same construct already present in the sibling `dialog-overlay.svelte`
  (a Tailwind named-color utility, not a hex/rgb/oklch literal), and the destructive button variant is built
  entirely from `--destructive`/`--popover`-family semantic tokens already defined in `app.css` for both color
  schemes — no bespoke color was introduced.

No blocker-level defect was found. The findings below are robustness/quality gaps, not currently-observable
breakage — the live entity data today happens to avoid triggering the two coupling issues (WR-01, WR-03), and
the confirmation-copy gap (IN-02) is carried over unchanged from the pre-existing `window.confirm()` text, not
a regression this phase introduced.

## Warnings

### WR-01: Post-delete focus fallback silently degrades if a future entity pairs `delete: true` with `create: false`

**File:** `web/src/lib/entities/EntityScreen.svelte:432-434`
**Issue:** `confirmDelete`'s success path unconditionally targets
`document.querySelector('[data-testid="entity-create-start"]')` as the focus-restoration fallback. That
element only exists when `{#if mode === null && config.capabilities.create}` renders it (line 451). Nothing in
`EntityConfig` (`web/src/lib/entities/types.ts:33`, `capabilities: { create: boolean; update: boolean; delete:
boolean }`) enforces or documents that `capabilities.create` must be `true` whenever `capabilities.delete` is
`true`. Today every full-CRUD entity happens to set all three flags together, and the two restricted entities
(`instanciasRotina`, `logInferenciaClaude`) have `delete: false`, so the coupling is never exercised — but the
type system permits a future entity with `delete: true, create: false`, at which point a successful delete
would call `.focus()` on `null` (a silent no-op via optional chaining) and leave keyboard focus dropped on
`<body>` with no visible or announced feedback — quietly regressing the exact focus-management guarantee this
phase was built to deliver, with no test able to catch it since no current entity exercises that combination.
**Fix:** Either assert the invariant explicitly (fail loud in dev if `capabilities.delete && !capabilities.create`),
or give `confirmDelete` its own dedicated, always-present fallback target that doesn't depend on another
capability flag (e.g. focus the section heading or the table itself when `entity-create-start` isn't found)
instead of only the create button:
```ts
const fallback =
  document.querySelector<HTMLButtonElement>('[data-testid="entity-create-start"]') ??
  document.querySelector<HTMLElement>('[data-testid="entity-header"]');
fallback?.focus();
```

### WR-02: No accessible signal that the delete is in flight

**File:** `web/src/lib/entities/EntityScreen.svelte:835-843`
**Issue:** While `deleteBusy` is `true`, `AlertDialog.Action`/`AlertDialog.Cancel` are visually disabled and a
spinner icon (`LoaderCircle`) is prepended to the "excluir" label, but nothing announces the state change to
assistive technology — no `aria-busy`, no `aria-live` region, and the `LoaderCircle` icon carries no
`aria-hidden`/label pairing. A screen-reader user who activates the destructive action gets no feedback that
anything happened until the dialog eventually closes (or, per WR-03, potentially never does). This is the exact
surface the review brief flagged for accessibility scrutiny, and it's new code this phase wrote (the disabled
state itself is proven functionally, per `entities-delete-confirmation.spec.ts` Test E, but its assistive-tech
observability was not).
**Fix:** Add `aria-busy={deleteBusy}` to `AlertDialog.Content` (or the Action button) and `aria-hidden="true"`
on the decorative `LoaderCircle`, e.g.:
```svelte
<AlertDialog.Action
  variant="destructive"
  data-testid="delete-confirm"
  disabled={deleteBusy}
  aria-busy={deleteBusy}
  onclick={confirmDelete}
>
  {#if deleteBusy}<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />{/if}
  excluir
</AlertDialog.Action>
```

### WR-03: A hung `db.transact` traps the user in the AlertDialog with no escape

**File:** `web/src/lib/entities/EntityScreen.svelte:417-442, 818-819`
**Issue:** While `deleteBusy` is `true`, `escapeKeydownBehavior`/`interactOutsideBehavior` are both `"ignore"`
and both dialog buttons are `disabled` — by design, to prevent dismissing mid-write (T-16-02, correctly
mitigated for the intended case). But there is no timeout, abort mechanism, or "retry/cancel anyway" affordance
if the `db.transact(...)` promise never settles (e.g., a WebSocket that silently stalls rather than
erroring) — `deleteBusy` only resets in `finally`, which never runs if the awaited promise never
resolves/rejects. The user is left with a destructive-action modal that cannot be dismissed by any input at
all. This mirrors an accepted risk already present in the create/edit `Dialog`'s own `busy` gating (not
introduced fresh here), but it is worth flagging specifically on this phase's surface since it is the
highest-risk phase in the milestone and the one place a stuck modal is guarding an irreversible action.
**Fix:** Consider a client-side timeout that re-enables Cancel (and surfaces an error) if the transact call
hasn't settled within a bounded window, e.g. `Promise.race([db.transact(...), timeout(15000)])`, falling back
to an error toast and `deleteBusy = false` rather than an indefinite lock.

## Info

### IN-01: `alert-dialog-overlay.svelte` omits the `isolate` utility present in the sibling `dialog-overlay.svelte`

**File:** `web/src/lib/components/ui/alert-dialog/alert-dialog-overlay.svelte:15`
**Issue:** `dialog-overlay.svelte` (Phase pre-existing) sets
`"...fixed inset-0 isolate z-50"`, while the freshly-vendored `alert-dialog-overlay.svelte` sets
`"...fixed inset-0 z-50"` — missing `isolate`. Both still resolve their own local stacking correctly given the
explicit `z-50`, so no observed breakage, but the two overlay components (rendered via the identical `Portal` +
`Overlay` pattern) are no longer structurally identical, which will read as an unexplained inconsistency to the
next person diffing them. Most likely explained by the two families being vendored from slightly different
shadcn-svelte registry snapshots rather than a hand-edit.
**Fix:** Add `isolate` to `alert-dialog-overlay.svelte`'s class list for parity with `dialog-overlay.svelte`,
or document why the divergence is intentional.

### IN-02: Delete confirmation copy never identifies the specific record being deleted

**File:** `web/src/lib/entities/EntityScreen.svelte:826-830`
**Issue:** `AlertDialog.Description` reads `Excluir este registro de {config.titulo}? Esta ação não pode ser
desfeita.` — identical wording (only the confirmation *mechanism* changed) to the original
`window.confirm(\`Excluir este registro de ${config.titulo}?\`)` this phase replaced. Neither version names or
displays any identifying value from the row itself (e.g. its label/title column), so once the dialog is open
and the underlying table is obscured by the modal overlay, a user has no way to double-check which specific
record they're about to irreversibly delete beyond having clicked the right button a moment earlier. Not a
regression introduced by this phase (the text is carried over verbatim), but this rewrite was the natural,
already-planned opportunity to close a genuine "mis-confirm" gap the review brief calls out, and it wasn't
taken.
**Fix:** Surface a record-identifying value in the description, e.g. via each entity's existing
`listColumns[0]`/label field:
```svelte
<AlertDialog.Description>
  Excluir "{columnValue(pendingDelete, config.listColumns[0])}" ({config.titulo})? Esta ação não pode ser desfeita.
</AlertDialog.Description>
```

---

_Reviewed: 2026-08-10T21:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
