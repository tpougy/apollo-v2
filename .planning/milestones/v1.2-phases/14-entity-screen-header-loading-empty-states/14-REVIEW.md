---
phase: 14-entity-screen-header-loading-empty-states
reviewed: 2026-08-10T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - web/src/lib/entities/EntityScreen.svelte
  - web/src/lib/components/ui/empty/empty-title.svelte
  - web/src/lib/components/ui/empty/empty-description.svelte
  - web/src/lib/components/ui/empty/empty-header.svelte
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 14: Code Review Report (Re-review of WR-01/WR-02/WR-03 fixes)

**Reviewed:** 2026-08-10
**Depth:** standard
**Files Reviewed:** 4 (EntityScreen.svelte + the three vendored Empty primitives touched or implicated by the fix commits)
**Status:** issues_found

## Summary

Re-reviewed commits `93d5809` (WR-01), `0c32d46` (WR-02), and `d3a9122` (WR-03) against the prior round's
`14-REVIEW.md` findings, plus re-checked the two carried-forward Info items (IN-01/IN-02 from the prior
round) for drift.

**WR-02 is genuinely resolved.** Verified the exact leading-whitespace of every structural boundary line in
the relocated `Dialog.Root` block (517–730): `Dialog.Root` at 2 spaces, `Dialog.Content` at 4,
`Dialog.Header`/`form` at 6, their children at 8, with every closing tag re-aligned to its opener. `git diff
-w` for `0c32d46` is empty per the commit message, and `bun run check`/`bun run lint` both still pass with
zero new errors. No further action needed.

**WR-03 is genuinely resolved** for its stated purpose: `empty-title.svelte` now renders `<h3>` instead of
`<div>`, giving "Nenhum resultado encontrado" real heading semantics one level below `EntityScreen`'s own
`<h2>`. Confirmed only one call site (`EntityScreen.svelte:428`) exists project-wide, so no other consumer
depends on the old `<div>` markup or its box model. Tailwind v4's preflight (active in this project —
`@import "tailwindcss"` in `app.css`, not overridden) zeroes heading margin and inherits font-size/weight, so
no visual regression is introduced by the tag swap. One minor type-accuracy nit is newly visible as a result
(see IN-01 below) but it doesn't affect runtime behavior.

**WR-01 is NOT resolved.** The fix changes which function ends up calling `startCreate()`, but it does not
change which DOM element is `document.activeElement` when bits-ui's `FocusScope.register()` runs — and that
is the value the original bug depends on. I verified this empirically (not just from reading the bits-ui
source) with an isolated two-button reproduction: a real click on button A, whose handler calls
`document.getElementById('b').click()`, does invoke B's click handler, but `document.activeElement` remains
`"a"` afterward — `.click()` does not transfer focus. See the full finding below for why this reproduces the
exact original bug in `EntityScreen.svelte`.

## Warnings

### WR-01 (re-opened, unresolved): `empty-state-create` still loses focus to `<body>` after a successful create — the delegation fix does not do what its own comment claims

**File:** `web/src/lib/entities/EntityScreen.svelte:442-455` (fix commit `93d5809`)

**Issue:** The fix's own comment (lines 448-451) asserts: *"Delegating makes it the element that's
`document.activeElement` when the Dialog's FocusScope registers."* This is factually incorrect, and the
error is load-bearing for whether the fix works at all.

`FocusScopeManager.register()` (`node_modules/bits-ui/dist/bits/utilities/focus-scope/focus-scope-manager.js:14-26`)
captures `document.activeElement` synchronously at the moment a `FocusScope` mounts — it does not know or
care which JavaScript function eventually ran `startCreate()`. `HTMLElement.prototype.click()` fires a
synthetic click event and runs the target's click handlers, but — unlike a real, browser-dispatched pointer
click — it does **not** move keyboard focus to the target element. I confirmed this directly rather than
relying on spec-reading:

```
button A's real-click handler calls document.getElementById('b').click()
→ B's click listener does run
→ but document.activeElement is still "a", not "b"
```
(verified with Playwright's Chromium: a real trusted `page.click("#a")` followed by a plain synthetic
`element.click()` call on `#b` inside `#a`'s handler.)

Mapped onto `EntityScreen.svelte`: when a user clicks `empty-state-create`, the browser's real pointer-click
focuses `empty-state-create` (this is genuine browser default behavior, unrelated to `.click()`). The
`onclick` handler then calls `entity-create-start.click()`, which does run `startCreate()` (so the dialog
opens correctly, and there's no double-invocation or duplicate-state-reset risk — that part is fine) — but
`document.activeElement` is left unchanged at `empty-state-create`. By the time the newly-opened `Dialog`'s
`FocusScope.register()` runs (on the next reactive tick, once `Dialog.Content`'s `ref` becomes available),
it still captures `empty-state-create` — the exact same element as before the fix — as `preFocusedElement`.

The rest of the original bug then plays out identically to the prior round's report: on a successful
submit, `mode = null` closes the dialog while `rowsOf()` flips from `0` to `1+`, unmounting
`empty-state-create`. `#handleCloseAutoFocus()` (`focus-scope.svelte.js:72-91`) finds
`document.contains(preFocusedElement)` false and makes no `.focus()` call, dropping keyboard focus to
`<body>`. The delegation adds an extra indirection (and a fragile runtime dependency on the
`data-testid="entity-create-start"` attribute — a value whose only other consumers today are Playwright
selectors, so a future rename of that testid for test-tooling reasons would silently break this production
code path with no type error) without changing the outcome it was written to fix.

`entities-header-states.spec.ts`'s Test 4 (ENTTBL-06) still only opens-then-cancels `empty-state-create`'s
dialog, never submits, so this remains unexercised by the phase's own suite — same gap noted in the prior
round.

**Fix:** Actually move focus to `entity-create-start` before/instead of relying on `.click()` to do it, and
call the shared logic directly rather than through a synthetic click indirection:
```svelte
<Button
  type="button"
  data-testid="empty-state-create"
  onclick={() => {
    // .click() does not transfer keyboard focus — call .focus() explicitly so
    // FocusScope.register() captures the header button (which never unmounts)
    // as the pre-focused element, then invoke the shared open logic directly.
    document
      .querySelector<HTMLButtonElement>('[data-testid="entity-create-start"]')
      ?.focus();
    startCreate();
  }}
>
  novo
</Button>
```
Verify with a new e2e assertion that actually completes a create through `empty-state-create` (not just
open-then-cancel) and checks `document.activeElement`'s `data-testid` afterward equals
`entity-create-start` — the missing case that let this ship unverified twice.

## Info

### IN-01 (new): `empty-title.svelte`'s prop type still declares `HTMLDivElement` after WR-03 changed the bound tag to `<h3>`

**File:** `web/src/lib/components/ui/empty/empty-title.svelte:5-10`
**Issue:** `ref = $bindable(null)` is typed via `WithElementRef<HTMLAttributes<HTMLDivElement>>`, but
`bind:this={ref}` (line 14) now binds to the `<h3>` element the WR-03 fix introduced. This doesn't currently
produce a `bun run check` error only because `lib.dom.d.ts`'s `HTMLDivElement` and `HTMLHeadingElement`
interfaces are both structurally empty extensions of `HTMLElement`, so TypeScript's structural typing treats
them as interchangeable today — but the annotation is inaccurate and would silently stop being safe if either
interface ever gains distinguishing members in a future TS lib update.
**Fix:** `WithElementRef<HTMLAttributes<HTMLHeadingElement>>` to match the actual bound element.

### IN-02 (carried forward, still unresolved): `empty-description.svelte` still has a duplicated Tailwind class

**File:** `web/src/lib/components/ui/empty/empty-description.svelte:17`
**Issue:** Unchanged since the prior round — `class={cn("text-sm/relaxed text-sm/relaxed text-muted-foreground ...", className)}` still repeats `text-sm/relaxed`. Not in scope of the WR-01/02/03 fix commits, so its persistence isn't a new defect, but it remains unaddressed.
**Fix:** `class={cn("text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary", className)}`.

### IN-03 (carried forward, still unresolved): Stale/inaccurate comment about the `state_referenced_locally` warning on `EntityScreen.svelte:34`

**File:** `web/src/lib/entities/EntityScreen.svelte:30-34`
**Issue:** Re-ran `bun run check`: it still emits exactly the same warning the prior round reported —
`"This reference only captures the initial value of \`configProp\`... (state_referenced_locally)"` at
`34:18` — contradicting the adjacent comment's claim that snapshotting `config` "avoids" this warning. Lines
28-34 are untouched by any of the three fix commits in this round, so this is unchanged, not regressed.
**Fix:** As before — either correct the comment to acknowledge the warning still fires, or resolve it via a
`$derived` read of `configProp` where a genuinely non-reactive snapshot isn't required. Out of this round's
scope; still worth a follow-up ticket.

---

_Reviewed: 2026-08-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
