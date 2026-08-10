---
phase: 15-entity-screen-form-dialog-composition
reviewed: 2026-08-10T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - web/src/lib/entities/EntityScreen.svelte
  - web/e2e/entities-form-dialog-composition.spec.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 15: Code Review Report (Re-review after CR-01/WR-01/WR-02/WR-03/WR-04 fixes)

**Reviewed:** 2026-08-10
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Re-reviewed `EntityScreen.svelte` against the four fix commits applied since
the prior round (`ad46895` CR-01, `897de18` WR-01/WR-02, `039d4b2` WR-03,
`19906b1` WR-04). All five previously-reported findings are genuinely
resolved, verified line-by-line against the current file plus the
installed `bits-ui@2.18.1` type definitions (not just plausible-looking —
actually cross-checked against `node_modules/bits-ui/dist/bits/utilities/
escape-layer/types.d.ts` and `dismissible-layer/types.d.ts`):

- **CR-01 (dialog dismissal blocked while busy) — RESOLVED.** `onOpenChange`
  now gates on `!busy` (line 541), `Dialog.Content` sets
  `escapeKeydownBehavior={busy ? "ignore" : "close"}` and
  `interactOutsideBehavior={busy ? "ignore" : "close"}` (lines 546-547) —
  both prop names and both enum values (`"close"`/`"ignore"`) are confirmed
  valid for the installed bits-ui version — and `showCloseButton={!busy}`
  (line 545) removes the close-X from the DOM entirely (it's behind an
  `{#if showCloseButton}` in `dialog-content.svelte`, not just visually
  hidden) while busy. `entity-cancel` gets `disabled={busy}` (line 778). All
  four dismissal vectors (Cancel, Esc, overlay-click, close-X) are now
  genuinely blocked for the duration of the write, closing the
  cancel-then-silently-completes race.
- **WR-01 (outer catch) — RESOLVED.** The outer `try` (line 262) now has a
  matching `catch` (lines 401-404) that sets `formError`/fires
  `toast.error`, in addition to the pre-existing inner `catch` around the
  `db.transact` calls (lines 397-400). Traced both blocks: the inner catch
  does not rethrow, so there's no double-toast for `db.transact` failures;
  the outer catch now correctly covers the `db.queryOnce` parent-existence
  loop and the synchronous payload-construction loop (including
  `dateInputValueToIso`'s `RangeError`-on-invalid-date path) that previously
  escaped as an unhandled rejection with zero user feedback.
- **WR-02 (focus-restoration guarded by `alive`) — RESOLVED.** `let alive =
  true` plus `onDestroy(() => { alive = false; })` (lines 183-186), and the
  post-create `document.querySelector(...).focus()` call is now wrapped in
  `if (alive)` (lines 392-395). Confirmed this doesn't introduce a
  stale-closure or memory-leak issue: `alive` is a plain (non-`$state`)
  closure variable scoped per component instance/mount, `onDestroy`
  registers exactly once per instance, and a later remount of the same
  entity type creates an entirely new closure scope with its own `alive` —
  the old instance's `handleSubmit` closure can never observe or affect the
  new instance's flag.
- **WR-03 (aria-required on all 6 field kinds) — RESOLVED.** `aria-required=
  {f.required}` is now present on `text` (564), `textarea` (576), `number`
  (589), `boolean`/`Checkbox` (601), `date`/`Popover.Trigger` `Button` (622),
  and `select`/`Select.Trigger` (666) — all six branches confirmed by direct
  line inspection.
- **WR-04 (disabled={busy} on all controls) — RESOLVED.** `disabled={busy}`
  confirmed present on all six field-kind controls (565, 577, 590, 602, 623,
  657) plus every `Select.Root` in the links loop (686), the xorLink
  parent-type selector (718), and the xorLink target selector (737).
  Checked that `disabled` genuinely propagates through each wrapper
  (`Checkbox` spreads `restProps` including `disabled` onto
  `CheckboxPrimitive.Root`; `Select.Root`'s `disabled` prop is bits-ui's
  documented mechanism for disabling the whole combobox, including its
  `Trigger`); the date-picker `Popover.Trigger`'s `Button` gets a native
  `disabled` attribute, which natively suppresses the click that would open
  the popover, so no separate `Popover.Root`-level disable is needed.

No new correctness bugs, security issues, or lint/type errors were
introduced by these four fix commits: `npx biome check` and `npx
svelte-check` both come back clean for this file (the only svelte-check
errors present are pre-existing, unrelated `bun-types`/`tsconfig`
environment noise, not attributable to any file touched here). Reviewed the
existing `entities-form-dialog-composition.spec.ts` end to end and confirmed
none of its four tests interact with a control while `busy` is true in a
way `disabled={busy}` could break — every `entity-cancel`/field interaction
in that spec happens before submit or after the dialog has already closed;
only ENTFRM-07 exercises the busy window at all, and it only asserts
`entity-submit` is disabled and spinning, never touches another control
during that window.

Two residual issues remain, discovered while validating this round rather
than introduced by it — both are informational/quality-level, not
regressions of the five items re-reviewed here.

## Warnings

### WR-05: `required: true` on a `boolean` field can never actually fail client-side validation — the new `aria-required` now announces a constraint that isn't enforced

**File:** `web/src/lib/entities/EntityScreen.svelte:283-289, 601`

**Issue:** `handleSubmit`'s payload-construction loop treats a field as
"missing" only when `raw === undefined || raw === ""` (line 283). For a
`boolean` field, `formValues[f.name]` is initialized to `false` in
`startCreate` (line 197: `f.kind === "boolean" ? false : ""`) and is always
either `true` or `false` thereafter — it is never `undefined` or `""`. So
the `if (f.required) { formError = ...; return; }` branch (lines 284-288)
is dead code for every `boolean`-kind field: a required checkbox left
unchecked (`false`) submits successfully every time, with no validation
error and no `formError`/toast surfaced. This is a live, not theoretical,
gap — three current entity configs mark a boolean field `required: true`:
`fundos.ativo`, `subtarefas.concluida`, and `templatesRotina.ativo` (all
confirmed via `grep` across `src/lib/entities/defs/*.ts`). This predates
Phase 15 (the validation loop itself wasn't touched by any of the five
fixes), but WR-03's fix makes it more visible and slightly more misleading:
the `Checkbox` for these three fields now carries `aria-required="true"`,
so a screen-reader user is explicitly told the field is mandatory even
though leaving it at its default, unchecked state is functionally
indistinguishable from filling it in and always passes.

**Fix:** Either (a) treat `required: true` on a `boolean` field as "must be
`true` to submit" and check that explicitly (`if (f.required &&
!formValues[f.name])`), if that's the intended semantic (e.g. a
terms-acceptance-style checkbox), or (b) drop `required: true` from
purely-informational boolean fields like `ativo`/`concluida` where
`false` is a legitimate saved value, since `aria-required` on those is
actively misleading otherwise.

### WR-06: None of the four fix commits (CR-01, WR-01/WR-02, WR-03, WR-04) added or updated a test, so the previously-Critical dismiss-while-busy race and the other three fixes ship with zero regression coverage

**File:** `web/e2e/entities-form-dialog-composition.spec.ts` (unchanged by any fix commit)

**Issue:** `git show --stat` on all four fix commits (`ad46895`, `897de18`,
`039d4b2`, `19906b1`) shows each touches only
`web/src/lib/entities/EntityScreen.svelte` — no spec file, unit test, or
component test was added or modified. The existing `entities-form-dialog-
composition.spec.ts` predates all four fixes (committed as `5f73531`,
before any of them) and doesn't exercise dismissal-while-busy, the
outer-catch error path, cross-entity focus restoration, or
control-disablement during a write. In particular, CR-01 was the Critical
finding from the prior round (a duplicate-record-creation risk); shipping
its fix with no automated check that Esc/overlay-click/close-X/Cancel stay
inert during an in-flight `db.transact` means a future refactor of this
Dialog block could silently reintroduce the exact race this round fixed,
with nothing in CI to catch it.

**Fix:** Add at minimum one e2e assertion that, during ENTFRM-07's existing
busy window (`entity-submit` disabled + spinner visible), `entity-cancel`
is also disabled and pressing `Escape`/clicking the overlay does not close
the dialog or dismiss `getByRole("dialog")`.

## Info

### IN-01: `link-${xorParentType}`/`link-${link.label}` testid namespaces are not guaranteed disjoint (carried over, unchanged)

**File:** `web/src/lib/entities/EntityScreen.svelte:692, 743`

**Issue:** Unchanged from the prior round — still no live collision in any
of the 9 `defs/*.ts` entity configs, still no type-level or runtime
assertion preventing a future config from combining a `links` entry and an
`xorLink` choice with the same `label`.

**Fix:** Not urgent; consider a dev-time assertion if a future entity ever
combines `links` and `xorLink` with overlapping labels.

---

_Reviewed: 2026-08-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
