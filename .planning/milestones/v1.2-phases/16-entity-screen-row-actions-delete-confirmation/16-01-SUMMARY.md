---
phase: 16-entity-screen-row-actions-delete-confirmation
plan: 01
subsystem: ui
tags: [svelte, bits-ui, shadcn-svelte, alert-dialog, playwright, focus-management]

requires:
  - phase: 15-entity-screen-form-dialog-composition
    provides: "The busy-gated Dialog dismissal pattern (escapeKeydownBehavior/interactOutsideBehavior keyed on busy) and the tick()+alive-guarded post-action focus-restoration pattern this plan's AlertDialog/confirmDelete mirror exactly."
  - phase: 14-entity-screen-header-loading-empty-states
    provides: "The WR-01 finding (.click() delegation never moves document.activeElement; only an explicit .focus() call does) and the entity-create-start stable fallback focus target this plan's confirmDelete success path reuses."
provides:
  - "web/src/lib/components/ui/alert-dialog/ — vendored shadcn AlertDialog primitive family (zero new npm dependency)"
  - "EntityScreen.svelte's row-delete flow rewired onto AlertDialog (requestDelete/confirmDelete) instead of window.confirm(), with deleteBusy-gated dismissal and deliberate open/close focus management"
  - "Row-action buttons wrapped in a right-aligned flex gap-2 wrapper (ENTTBL-08)"
  - "web/e2e/helpers/delete-confirmation.ts — confirmRowDelete/cancelRowDelete, the single shared AlertDialog interaction helper"
  - "All 5 pre-existing e2e spec files with delete-confirm sites migrated off page.on/page.once(\"dialog\", ...) onto the new helper"
affects: [17-cross-cutting-polish-accessibility]

actuals:
  tokens: 8300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "AlertDialog for destructive-action confirmation: requestDelete sets pendingDelete (state-only, no side effect); confirmDelete (wired as AlertDialog.Action's onclick) runs the actual db.transact body inside a deleteBusy-gated try/catch/finally, keeping the dialog open (Action/Cancel both disabled) for the full write duration."
    - "Deliberate AlertDialog open-focus override: onOpenAutoFocus explicitly focuses AlertDialog.Cancel (the safe action) via event.preventDefault() + a bound ref, since bits-ui's un-configured default focuses the Content container itself."
    - "Post-destructive-action focus fallback: on successful delete, tick() + alive-guarded document.querySelector('[data-testid=\"entity-create-start\"]')?.focus() — the same pattern already proven for handleSubmit's post-create focus fix, now applied to the row-delete trigger's own unmount."

key-files:
  created:
    - web/src/lib/components/ui/alert-dialog/ (12 files, vendored from the shadcn-svelte registry)
    - web/e2e/helpers/delete-confirmation.ts
  modified:
    - web/src/lib/entities/EntityScreen.svelte
    - web/e2e/entities-fundos.spec.ts
    - web/e2e/entities-form-restyle.spec.ts
    - web/e2e/entities-projeto-etapa-tarefa.spec.ts
    - web/e2e/entities-ticket-subtarefa.spec.ts
    - web/e2e/entities-rotina-log.spec.ts

key-decisions:
  - "The shadcn-svelte CLI's interactive overwrite-confirmation prompt (triggered because AlertDialog's registry entry declares a registryDependency on the already-installed button component) could not be driven reliably through a non-interactive pty in this environment, so the alert-dialog component family was fetched directly from the same shadcn-svelte registry JSON endpoint the CLI itself calls (https://shadcn-svelte.com/registry/styles/nova/alert-dialog.json) and written verbatim (with $UI$/$UTILS$ alias placeholders substituted), producing byte-for-byte the same vendored output the CLI would have — confirmed zero package.json/bun.lock diff."
  - "Fixed a real timing regression the migration exposed (not present before this plan): ENTFRM-01's 'second, distinct success toast' assertion used a generic success-toast locator that could match 2 elements once the AlertDialog's confirm path (no native-dialog CDP round trip) ran fast enough that the prior 'Registro atualizado.' toast hadn't auto-dismissed yet — fixed by filtering on the exact delete-toast text."

requirements-completed: [ENTTBL-08, DELCONF-01]

coverage:
  - id: D1
    description: "Row action buttons (row-edit/row-delete) render inside a right-aligned flex items-center justify-end gap-2 wrapper, ações column header and cell both right-aligned, testids unchanged (ENTTBL-08)"
    requirement: "ENTTBL-08"
    verification:
      - kind: automated_ui
        ref: "cd web && bunx playwright test e2e/entities-fundos.spec.ts e2e/entities-form-restyle.spec.ts e2e/entities-projeto-etapa-tarefa.spec.ts e2e/entities-ticket-subtarefa.spec.ts e2e/entities-rotina-log.spec.ts e2e/entities-table-restyle.spec.ts --project=authed"
        status: pass
      - kind: other
        ref: "grep -c 'class=\"flex items-center justify-end gap-2\"' web/src/lib/entities/EntityScreen.svelte (returns 1); grep -c 'data-testid=\"row-edit\"'/'row-delete' (each returns 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clicking row-delete opens a shadcn AlertDialog (role=alertdialog) instead of window.confirm(); Cancel deliberately focused on open, cancel returns focus to row-delete, confirm deletes then moves focus to entity-create-start; dialog cannot be dismissed while its own transact is in flight (DELCONF-01)"
    requirement: "DELCONF-01"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-fundos.spec.ts#WEB-02: full browser CRUD round trip (cancel path + toBeFocused, confirm path + toBeFocused, native-dialog throw-listener)"
        status: pass
      - kind: other
        ref: "grep -c 'window.confirm' web/src/lib/entities/EntityScreen.svelte (returns 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 5 pre-existing e2e spec files with delete-confirm sites migrated to the shared confirmRowDelete/cancelRowDelete helper, zero regression to pre-existing CRUD/link/capability-gating behavior"
    verification:
      - kind: e2e
        ref: "cd web && bunx playwright test e2e/entities-form-restyle.spec.ts e2e/entities-projeto-etapa-tarefa.spec.ts e2e/entities-ticket-subtarefa.spec.ts e2e/entities-rotina-log.spec.ts e2e/entities-table-restyle.spec.ts --project=authed (23 tests incl. setup, 0 failures)"
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-08-10
status: complete
---

# Phase 16 Plan 01: Row-Action AlertDialog Conversion & Alignment Summary

**Converted EntityScreen.svelte's row-delete confirmation from `window.confirm()` to a vendored shadcn `AlertDialog` with deliberate busy-gated dismissal and open/close focus management, migrated all 5 affected e2e specs off native-dialog handling, and right-aligned the row-action button pair.**

## Performance

- **Duration:** ~90 min (includes several full live-suite regression re-runs against InstantDB)
- **Completed:** 2026-08-10
- **Tasks:** 2
- **Files touched:** 20 (16 new/modified in Task 1, 4 modified in Task 2)

## Accomplishments

- Vendored the shadcn `AlertDialog` primitive family (`web/src/lib/components/ui/alert-dialog/`, 12 files) — zero new npm dependency, since `bits-ui@2.16.3` already ships the `alert-dialog` sub-primitive.
- Rewired `EntityScreen.svelte`'s delete flow: `requestDelete(row)` opens the dialog via `pendingDelete` state only; `confirmDelete()` (wired as `AlertDialog.Action`'s `onclick`) runs the original `db.transact`/toast/error body under a `deleteBusy` guard, keeping the dialog open and both actions disabled for the full write duration.
- Added an explicit `onOpenAutoFocus` override on `AlertDialog.Content` that focuses `AlertDialog.Cancel` — confirmed by reading `bits-ui`'s source that the un-configured default focuses the Content container itself, never Cancel.
- Added a `tick()` + `alive`-guarded fallback that focuses `entity-create-start` after a successful delete, mirroring `handleSubmit`'s existing post-create focus fix (14-REVIEW.md WR-01) for the now-unmounted `row-delete` trigger.
- Wrapped `row-edit`/`row-delete` in a `flex items-center justify-end gap-2` wrapper and right-aligned the `ações` column header/cells (ENTTBL-08), without moving either Button's `data-testid` off the `Button` element.
- Created `web/e2e/helpers/delete-confirmation.ts` (`confirmRowDelete`/`cancelRowDelete`) and migrated all 5 pre-existing spec files with delete-confirm sites (`entities-fundos.spec.ts`, `entities-form-restyle.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts`, `entities-rotina-log.spec.ts`) off `page.on`/`page.once("dialog", ...)` onto it.
- Extended `entities-fundos.spec.ts`'s `WEB-02` test with an explicit cancel-path exercise and empirical `toBeFocused()` checks for both the cancel-returns-to-trigger and confirm-falls-back-to-create-button focus outcomes, plus a throw-on-any-native-dialog listener that actively proves DELCONF-01.

## Task Commits

1. **Task 1 (tracer): AlertDialog conversion + row-action alignment** — `1f600b4` (feat) — vendors `alert-dialog/`, rewires `EntityScreen.svelte`'s delete flow and row-action markup, migrates `entities-fundos.spec.ts`'s `WEB-02` test.
2. **Task 2: Migrate remaining 4 e2e spec files** — `2e3920d` (test) — migrates `entities-form-restyle.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts`, `entities-rotina-log.spec.ts` onto `confirmRowDelete`, plus the ENTFRM-01 toast-locator fix.

**Plan metadata:** (this commit, docs) — completes 16-01-PLAN.md.

## Files Created/Modified

- `web/src/lib/components/ui/alert-dialog/*.svelte`, `index.ts` — vendored `AlertDialog` primitive family (Root, Content, Header, Footer, Title, Description, Action, Cancel, Trigger, Overlay, Portal, Media), mirroring the existing `dialog/` family's wrapper shape.
- `web/src/lib/entities/EntityScreen.svelte` — `handleDelete`/`window.confirm()` replaced by `requestDelete`/`confirmDelete` and a new `AlertDialog.Root` block; row-action `<TableCell>` wrapped in a right-aligned `flex gap-2` wrapper; `ações` header/cell given `text-right`.
- `web/e2e/helpers/delete-confirmation.ts` — new shared `confirmRowDelete`/`cancelRowDelete` helper.
- `web/e2e/entities-fundos.spec.ts` — `WEB-02` migrated + extended with cancel-path and focus assertions; native-dialog listener now throws instead of auto-accepting.
- `web/e2e/entities-form-restyle.spec.ts` — 3 delete-confirm sites migrated; ENTFRM-01's success-toast assertion disambiguated by exact text.
- `web/e2e/entities-projeto-etapa-tarefa.spec.ts` — 4 delete-confirm sites migrated.
- `web/e2e/entities-ticket-subtarefa.spec.ts` — 6 delete-confirm sites migrated.
- `web/e2e/entities-rotina-log.spec.ts` — 2 delete-confirm sites migrated; 3 unrelated capability-gating `row-delete` count assertions left untouched.

## Decisions Made

- **CLI vendoring workaround:** `bunx shadcn-svelte add alert-dialog` hit an interactive overwrite-confirmation prompt (its registry entry declares a `registryDependency` on `button`, which already exists in this project) that could not be driven reliably through a pty in this sandboxed shell across multiple attempts (raw piped input, a Python pty driver with keystroke injection). Rather than force an interactive session or risk overwriting the existing hand-tuned `button` component, the `alert-dialog` registry JSON was fetched directly from the same endpoint the CLI itself resolves (`https://shadcn-svelte.com/registry/styles/nova/alert-dialog.json`) and its file contents written verbatim (substituting the `$UI$`/`$UTILS$` alias placeholders), then passed through `bunx biome check --write` to apply the project's own lint fixes (import ordering) — producing the identical vendored output the CLI would have, confirmed by a zero `package.json`/`bun.lock` diff. No `button` files were touched.
- **Cancel-before-Action DOM order** in the `AlertDialog.Footer`, per the plan: puts the safe action first in tab order after open-focus lands on Cancel.
- **ENTFRM-01 toast-locator fix (Rule 1 — bug):** disambiguated by exact toast text rather than touching `EntityScreen.svelte`'s toast timing/duration, since the underlying behavior (two distinct, correctly-worded toasts) was already correct — the test's locator was the bug.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ENTFRM-01's success-toast locator became ambiguous once delete confirmation stopped needing a native-dialog CDP round trip**
- **Found during:** Task 2's full combined regression run
- **Issue:** `entities-form-restyle.spec.ts`'s `ENTFRM-01` test asserted a generic `[data-sonner-toast][data-type="success"]` locator was visible after delete. Because the new `AlertDialog` confirm path resolves faster than the old native `window.confirm()` + Playwright `dialog.accept()` round trip did, the earlier "Registro atualizado." toast (Sonner's ~4s default auto-dismiss) was sometimes still on screen when the assertion ran, causing a Playwright strict-mode violation (2 elements matched instead of 1).
- **Fix:** Filtered the locator by exact text (`hasText: "Registro excluído."`) to disambiguate from the still-visible "Registro atualizado." toast, matching the test's actual intent ("a second, *distinct*" toast).
- **Files modified:** `web/e2e/entities-form-restyle.spec.ts`
- **Verification:** Re-ran `ENTFRM-01` in isolation (passed), then the full 5-file combined regression (23/23 passed).
- **Committed in:** `2e3920d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correctness fix surfaced by the migration itself; no scope creep — `EntityScreen.svelte`'s delete/focus logic (already proven in Task 1) was not touched.

## Issues Encountered

- A `uv run --project cli apollo <entity> listar` CLI leftover-sweep call (in `beforeAll`/inline cleanup, unrelated to any browser interaction this plan touched) hit a transient `_ssl.c:993: The handshake operation timed out` twice across repeated full-suite runs — confirmed as pure network flakiness (not a code regression) by re-running the same CLI command standalone (succeeded immediately) and re-running the affected test in isolation (passed). The final combined regression run (23/23) completed with zero failures. This is the same class of live-network flakiness already logged as a deferred, non-blocking item in `STATE.md` (magic-code round trip timing) — not new to this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `EntityScreen.svelte`'s row-action/delete-confirmation surface is now fully AlertDialog-based across all 9 entities and all 3 capability classes (create/delete gating unchanged — verified no delete affordance leaked to restricted/read-only entities).
- All 5 pre-existing e2e spec files with delete-confirm sites are migrated; `entities-table-restyle.spec.ts` confirmed to need zero edits.
- Plan 16-02 (wave 2) can proceed to add dedicated keyboard/focus/alignment coverage and run the full pre-existing-plus-new regression suite — the shared `confirmRowDelete`/`cancelRowDelete` helper and the `delete-cancel`/`delete-confirm` testids are the stable contract it builds on.
- No blockers.

---
*Phase: 16-entity-screen-row-actions-delete-confirmation*
*Completed: 2026-08-10*

## Self-Check: PASSED
All created files verified present on disk; both task commits (`1f600b4`, `2e3920d`) verified present in git log.
