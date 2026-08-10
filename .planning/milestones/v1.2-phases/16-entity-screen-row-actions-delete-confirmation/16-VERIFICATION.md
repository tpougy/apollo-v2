---
phase: 16-entity-screen-row-actions-delete-confirmation
verified: 2026-08-10T20:05:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 16: Entity Screen — Row Actions & Delete Confirmation Verification Report

**Phase Goal:** Row-level edit/delete actions read as deliberate, aligned controls, and delete requires a
proper `AlertDialog` confirmation instead of the native browser confirm.
**Verified:** 2026-08-10T20:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

This is the flagged highest-risk phase in the v1.2 milestone. Per PROJECT.md C-12 (zero human UAT), this
verification re-derives every claim from the live codebase and re-runs the full automated suite itself —
SUMMARY.md's own PASS claims were treated as unverified narrative until independently reproduced below.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Row-action buttons (`row-edit`/`row-delete`) render inside a `flex items-center justify-end gap-2` wrapper; `ações` column header and cell both right-aligned; testids stay on the `Button` elements, never moved to the wrapper `<div>` (ENTTBL-08) | ✓ VERIFIED | `EntityScreen.svelte` lines 508-551: `<TableHead class="text-right">ações</TableHead>` (511), `<TableCell class="text-right">` (528) wrapping `<div class="flex items-center justify-end gap-2">` (529) around the two `Button`s, each still carrying its own `data-testid`. Independently re-proven live by `entities-delete-confirmation.spec.ts` Test A, which asserts real computed CSS (`column-gap: 8px`, `justify-content: flex-end`, `text-align: right`) and a genuine non-overlapping bounding-box gap — re-run by this verification, passed. |
| 2 | Every pre-existing row-scoped testid (`row`, `row-edit`, `row-delete`) resolves to exactly one element per row; no portal-based dropdown/kebab menu introduced | ✓ VERIFIED | `grep -c 'data-testid="row-edit"'`/`'data-testid="row-delete"'`/`'data-testid="row"'` each return exactly 1 in `EntityScreen.svelte`. `grep -n 'DropdownMenu\|kebab\|MoreHorizontal\|MoreVertical'` returns zero matches. Full-suite regression (60/60) confirms every pre-existing locator still resolves correctly across all 9 entities. |
| 3 | Clicking `row-delete` opens a shadcn `AlertDialog` (`role="alertdialog"`); `window.confirm` no longer appears anywhere in `EntityScreen.svelte` (DELCONF-01) | ✓ VERIFIED | `grep -c 'window.confirm' EntityScreen.svelte` returns 0. `<AlertDialog.Root open={pendingDelete !== null} ...>` at line 811, wired from `row-delete`'s `onclick={() => requestDelete(row)}` (line 545). Live-proven by 7 tests (`entities-fundos.spec.ts` WEB-02 + all 6 `entities-delete-confirmation.spec.ts` tests) each registering a page-wide `page.on("dialog", ...)` listener that throws on any native dialog — none fired in this verification's own run. |
| 4 | The AlertDialog's Cancel receives deliberate focus on open (explicit `onOpenAutoFocus` override, not bits-ui's un-configured default); canceling returns focus to the still-mounted `row-delete` trigger; confirming moves focus to `entity-create-start` once the deleted row's own trigger has unmounted — proven empirically via `toBeFocused()` | ✓ VERIFIED | Traced independently through `node_modules/bits-ui` source (see "Focus Management Deep-Dive" below), not just SUMMARY narrative. Live-proven by `entities-fundos.spec.ts` WEB-02 (cancel + confirm paths against `fundos`) and independently by `entities-delete-confirmation.spec.ts` Tests B/C/D (against `tarefas`, a different entity) — all re-run by this verification, all passed. |
| 5 | The AlertDialog cannot be dismissed (Cancel click, Escape, outside click) while its own `db.transact` delete call is in flight | ✓ VERIFIED | `escapeKeydownBehavior`/`interactOutsideBehavior` both keyed on `deleteBusy` (lines 818-819); both `AlertDialog.Cancel`/`AlertDialog.Action` carry `disabled={deleteBusy}` (lines 832, 838); `confirmDelete` itself re-entrancy-guarded (`if (!pendingDelete \|\| deleteBusy) return;`, line 418). A real bug (bits-ui's `AlertDialogCancelState.props` never emits a `disabled` HTML attribute) was found and fixed in `alert-dialog-cancel.svelte` — verified correct and non-breaking below. Live-proven under a genuine in-flight write (CDP network-latency throttle) by `entities-delete-confirmation.spec.ts` Test E — re-run by this verification, passed. |
| 6 | Restricted (`instanciasRotina`) and read-only (`logInferenciaClaude`) capability-class entities gain zero new delete affordance | ✓ VERIFIED | `instanciasRotina.ts` line 43: `capabilities: { create: false, update: true, delete: false }`. `logInferenciaClaude.ts` line 27: `capabilities: { create: false, update: false, delete: false }`. `EntityScreen.svelte`'s `{#if config.capabilities.delete}` gate (line 540) is unchanged — the same condition that gated `row-delete` before this phase. Live-proven against genuinely-seeded rows (not empty tables) by `entities-delete-confirmation.spec.ts` Test F — re-run by this verification, passed. |
| 7 | Dedicated Playwright coverage proves both the confirm path (record deleted) and the cancel path (record retained) through the `AlertDialog`, including keyboard-only paths (Escape to cancel, Tab+Enter to confirm) | ✓ VERIFIED | `entities-delete-confirmation.spec.ts` (6 tests, `tarefas`-based, independent of the `fundos` tracer) — Test C (Escape cancels, row retained, focus returns to `row-delete`) and Test D (Tab+Enter confirms, row deleted, focus lands on `entity-create-start`) both keyboard-driven per `page.keyboard.press(...)`, checked against real `document.activeElement`. Re-run by this verification, both passed. |
| 8 | The full pre-existing-plus-new Playwright suite passes with zero regression; `svelte-check`/`tsc` and Biome remain clean; zero raw color literal or duplicate load-bearing testid in any file this phase touched | ✓ VERIFIED | This verification independently re-ran `bun run test:e2e` (all 3 projects) → **60 passed, 0 failed, 0 skipped**. `bun run check` → 0 errors (1 pre-existing, unrelated Svelte warning on `configProp`, documented in-file, not introduced by this phase). `bun run lint` → exit 0 (11 warnings, all pre-existing in `calendar-caption.svelte`/`shell-chrome.spec.ts` from Phases 12/13, none in any Phase 16-touched file). `grep -nE 'oklch\(\|#[0-9a-fA-F]{3,8}\b\|rgba?\('` across `EntityScreen.svelte`/`delete-confirmation.ts`/`entities-delete-confirmation.spec.ts` → zero matches. |

**Score:** 8/8 truths verified (0 present, behavior-unverified)

### Focus Management Deep-Dive (traced against actual bits-ui source, not SUMMARY narrative)

This verification independently read `node_modules/bits-ui/dist/bits/alert-dialog/components/alert-dialog-content.svelte`,
`node_modules/bits-ui/dist/bits/dialog/dialog.svelte.js`, `node_modules/bits-ui/dist/bits/utilities/focus-scope/focus-scope.svelte.js`,
and `focus-scope-manager.js` to confirm the claimed behavior, rather than trusting the SUMMARY's description of it.

**Open-focus (onOpenAutoFocus):** `alert-dialog-content.svelte`'s `FocusScope` wrapper calls the consumer's
`onOpenAutoFocus` first; if not `e.preventDefault()`-ed, its own default runs `contentState.opts.ref.current?.focus()`
— i.e. focuses the Content container itself, never `AlertDialog.Cancel`. `EntityScreen.svelte`'s override
(`onOpenAutoFocus={(e) => { e.preventDefault(); deleteCancelRef?.focus(); }}`, line 820) correctly short-circuits
this default. Confirmed load-bearing, not redundant.

**Pre-focus capture:** `FocusScopeManager.register(scope)` captures `document.activeElement` at the moment the
`AlertDialog.Content`'s `FocusScope` mounts (i.e. when `pendingDelete` flips non-null and the dialog opens) as
`preFocusHistory` for that scope — this is the just-clicked `row-delete` button, since a native click leaves the
clicked element focused before any state update remounts the dialog.

**Cancel path:** `AlertDialogCancelState.onclick`/`onkeydown` (`dialog.svelte.js` lines 336-350) call
`root.handleClose()` when not disabled, which flips the root's `open` state to `false`. `EntityScreen.svelte`'s
`onOpenChange` sets `pendingDelete = null`, unmounting the `FocusScope`. `unmount()` → `#handleCloseAutoFocus()`
runs (not overridden by `EntityScreen.svelte`, so bits-ui's default applies): `document.contains(preFocusedElement)`
is `true` since the row was never deleted — the row's own `row-delete` button is still in the DOM — so bits-ui
auto-focuses it. **This confirms canceling correctly returns focus to `row-delete` without any explicit code in
`EntityScreen.svelte` — it relies on (and is protected by) bits-ui's own default close-auto-focus, verified against
its real source.**

**Confirm path:** `confirmDelete()` awaits `db.transact(...)`, then sets `pendingDelete = null` immediately after
success — closing the dialog and unmounting its `FocusScope`. By this point the deleted row's own `TableRow`
(and its `row-delete` button, the captured `preFocusedElement`) has been removed from the DOM by Svelte's
reactive re-render of `rowsOf()` (InstantDB's local optimistic update reflects the delete before/around when the
transact promise resolves). `#handleCloseAutoFocus()`'s `document.contains(preFocusedElement)` check is `false`
— bits-ui's default correctly does nothing — so `EntityScreen.svelte`'s explicit `tick()` + `alive`-guarded
`document.querySelector('[data-testid="entity-create-start"]')?.focus()` (lines 431-434) is the only thing that
prevents focus from being silently dropped. This is genuinely necessary, not defensive-but-unneeded code.

**Empirical confirmation:** both outcomes are independently re-proven, not merely reasoned about — this
verification re-ran `entities-fundos.spec.ts` WEB-02 (fundos) and all of `entities-delete-confirmation.spec.ts`
(tarefas, Tests B/C/D), all asserting real `document.activeElement` via `toBeFocused()`, all passing.

### `alert-dialog-cancel.svelte`'s `disabled`-attribute fix — correctness check

**Claim under scrutiny:** does explicitly re-adding a native `disabled` HTML attribute on `AlertDialog.Cancel`'s
rendered `<button>` interfere with bits-ui's own click/keydown gating?

**Verified independently, not accepted from SUMMARY:**
- `AlertDialogCancelState.props` (`dialog.svelte.js` lines 351-359) never includes a `disabled` key — it only
  reads `this.opts.disabled.current` internally inside `onclick`/`onkeydown` to decide whether to call
  `root.handleClose()`. This internal gate is driven by the `disabled` box created from the `disabled` prop the
  consuming component passes (`AlertDialogCancelState.create({ disabled: boxWith(() => Boolean(disabled)) })`,
  `alert-dialog-cancel.svelte` upstream, line ~24) — i.e. the *same* `disabled` prop `EntityScreen.svelte` passes
  as `disabled={deleteBusy}`. This means the click/keydown gate was already functionally correct **before** this
  fix — the fix only adds the missing visual/attribute representation.
- The vendored wrapper (`web/src/lib/components/ui/alert-dialog/alert-dialog-cancel.svelte`) uses a `child`
  snippet to render `<button type="button" {...props} disabled={disabled}>`. `props` here is bits-ui's own
  `mergedProps` (restProps + `cancelState.props`), which — confirmed above — contains no `disabled` key at all.
  Adding `disabled={disabled}` after the spread therefore cannot shadow or conflict with anything bits-ui itself
  emits; it purely fills a gap.
- Net effect: once `disabled=true` is a genuine DOM attribute, the browser itself refuses to dispatch `click`/
  `keydown` events to the element at all — a **second, independent** layer of protection stacked on top of (not
  replacing) bits-ui's own internal `opts.disabled.current` check. No regression path exists: the fix cannot
  cause the button to become clickable when it shouldn't be, and cannot block clicks when `deleteBusy` is false
  (native `disabled` correctly toggles off).
- Cross-checked against `AlertDialog.Action`'s primitive (`alert-dialog-action.svelte`, `DialogActionState.props`
  has no special-casing either) — `disabled`/`onclick` flow straight through `restProps` untouched, confirming
  `delete-confirm` already rendered a real `disabled` attribute even before this fix, exactly as the SUMMARY
  claims, and exactly why only `Cancel` needed the targeted fix.

**Conclusion: the fix is correct and additive — it does not alter bits-ui's own gating logic in any way.**

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/lib/components/ui/alert-dialog/` | Vendored shadcn AlertDialog primitive family | ✓ VERIFIED | 12 files present, `alert-dialog-cancel.svelte` carries the `disabled`-attribute fix (verified correct above); `index.ts` exports `Root`/`Content`/`Header`/`Footer`/`Title`/`Description`/`Action`/`Cancel`/`Trigger`/`Overlay`/`Portal`/`Media`. |
| `web/src/lib/entities/EntityScreen.svelte` | Row-action alignment + AlertDialog delete flow | ✓ VERIFIED | `requestDelete`/`confirmDelete`, `pendingDelete`/`deleteBusy`/`deleteCancelRef` state, `AlertDialog.Root` block, right-aligned wrapper — all present and wired (see Truths 1, 3-6). |
| `web/e2e/helpers/delete-confirmation.ts` | `confirmRowDelete`/`cancelRowDelete` shared helper | ✓ VERIFIED | Both functions present; reused across `entities-fundos.spec.ts` (3 uses), `entities-form-restyle.spec.ts` (4), `entities-projeto-etapa-tarefa.spec.ts` (5), `entities-ticket-subtarefa.spec.ts` (7), `entities-rotina-log.spec.ts` (3), `entities-delete-confirmation.spec.ts` (6). |
| `web/e2e/entities-delete-confirmation.spec.ts` | 6 dedicated tests for ENTTBL-08/DELCONF-01 | ✓ VERIFIED | All 6 present and passing in this verification's own run. |
| `web/e2e/entities-{fundos,form-restyle,projeto-etapa-tarefa,ticket-subtarefa,rotina-log}.spec.ts` | Migrated off native `page.on/once("dialog", ...)` | ✓ VERIFIED | Zero `page.once("dialog"` remain; the sole surviving `page.on("dialog"` (in `entities-form-restyle.spec.ts`) is the unrelated `ENTFRM-04` throw-listener, confirmed by line inspection. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `row-delete` Button `onclick` | `requestDelete(row)` | direct call | ✓ WIRED | Line 545: `onclick={() => requestDelete(row)}`. |
| `requestDelete` | `AlertDialog.Root open` | `pendingDelete` state | ✓ WIRED | `open={pendingDelete !== null}` (line 812). |
| `AlertDialog.Action onclick` | `confirmDelete()` | direct call | ✓ WIRED | Line 839: `onclick={confirmDelete}`; bits-ui's `DialogActionState` has no auto-close handler, confirmed the dialog only closes via app code. |
| `AlertDialog.Content onOpenAutoFocus` | `deleteCancelRef.focus()` | explicit override | ✓ WIRED | Confirmed load-bearing against bits-ui's real default (see Focus Management Deep-Dive). |
| `confirmDelete` success path | `entity-create-start` focus | `tick()` + `alive`-guarded `querySelector` | ✓ WIRED | Confirmed necessary (bits-ui's own close-auto-focus is a no-op on this path since the trigger has unmounted). |
| `escapeKeydownBehavior`/`interactOutsideBehavior` | busy-gated dismissal | `deleteBusy` conditional | ✓ WIRED | Mirrors the identical Phase 15 `Dialog.Content` pattern; live-proven under CDP network throttle (Test E). |

### Behavioral Spot-Checks / Re-run Automated Suite

This verification re-ran the entire automated suite itself rather than trusting SUMMARY.md's reported results.

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Full Playwright suite (3 projects) | `cd web && bun run test:e2e` | **60 passed, 0 failed, 0 skipped** (5.1m) | ✓ PASS |
| `entities-delete-confirmation.spec.ts` (all 6 tests) | included in full run above | 6/6 passed | ✓ PASS |
| `entities-fundos.spec.ts` WEB-02 (cancel + confirm + focus) | included in full run above | passed | ✓ PASS |
| Type-check | `cd web && bun run check` | 0 errors, 1 pre-existing unrelated warning | ✓ PASS |
| Lint | `cd web && bun run lint` | exit 0, 11 pre-existing warnings (Phase 12/13 files only) | ✓ PASS |
| Raw color literal gate | `grep -nE 'oklch\(\|#[0-9a-fA-F]{3,8}\b\|rgba?\('` on 3 phase-touched files | zero matches | ✓ PASS |
| Testid uniqueness gate | `grep -c` for 5 load-bearing testids | each exactly 1 | ✓ PASS |
| `window.confirm` removal | `grep -c 'window.confirm' EntityScreen.svelte` | 0 | ✓ PASS |
| Native dialog leakage | `page.on("dialog", ...)` throw-listeners across 7 tests | zero fired | ✓ PASS |
| Commit existence | `git log --oneline \| grep` for `1f600b4`/`2e3920d`/`bb870e0`/`eea9a6c` | all 4 present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ENTTBL-08 | 16-01, 16-02 | Row action buttons aligned/spaced, no portal menu, locators preserved | ✓ SATISFIED | Truths 1-2; Test A (live CSS proof); full-suite regression. |
| DELCONF-01 | 16-01, 16-02 | `window.confirm()` replaced by shadcn `AlertDialog`, dedicated keyboard/focus coverage | ✓ SATISFIED | Truths 3-7; Tests B-F; full-suite regression. |

Both requirements are marked `Complete` in `.planning/REQUIREMENTS.md` (lines 110, 115) and `ROADMAP.md`'s Phase
16 success criteria (all 4) are independently confirmed true above. No orphaned requirements found for this
phase.

### Anti-Patterns Found

Scanned every file this phase's two plans touched (`EntityScreen.svelte`, `alert-dialog/*.svelte`,
`delete-confirmation.ts`, all 6 migrated/new e2e spec files) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/
`PLACEHOLDER`/stub patterns/empty implementations.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | none found | — | No debt markers, no stub returns, no hardcoded-empty props flowing to render. |

No blockers. The one deviation self-reported in 16-02-SUMMARY.md (a real bits-ui-adjacent bug in
`alert-dialog-cancel.svelte`, fixed in-phase) was independently re-verified above as correctly fixed, not
papered over.

### Human Verification Required

None. Every must-have truth above is either directly demonstrable from source (structural/wiring checks) or
independently re-proven via a live, this-verification-run Playwright execution against the real InstantDB app —
consistent with PROJECT.md C-12 (zero human UAT). No behavior-dependent truth was left unexercised: both the
cancel-path and confirm-path focus invariants have passing, empirically-checked (`toBeFocused()`) tests re-run
in this session, and the busy-gating invariant has a passing, live-network-throttled test re-run in this
session.

### Gaps Summary

None. All 8 must-have truths (merging ROADMAP Phase 16's 4 success criteria with both plans' frontmatter
must-haves) are VERIFIED against the live codebase and a freshly re-run 60/60 automated suite, not against
SUMMARY.md's narrative. The one real bug this phase's own execution surfaced and fixed (bits-ui's
`AlertDialogCancelState` never emitting a `disabled` HTML attribute) was independently traced through the
actual `node_modules/bits-ui` source in this verification and confirmed both correct and non-conflicting with
bits-ui's internal click/keydown gating.

---

_Verified: 2026-08-10T20:05:00Z_
_Verifier: Claude (gsd-verifier)_
