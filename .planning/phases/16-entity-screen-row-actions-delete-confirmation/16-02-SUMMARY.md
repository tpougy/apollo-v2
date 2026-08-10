---
phase: 16-entity-screen-row-actions-delete-confirmation
plan: 02
subsystem: testing
tags: [playwright, bits-ui, alert-dialog, focus-management, biome, a11y]

requires:
  - phase: 16-entity-screen-row-actions-delete-confirmation
    provides: "Plan 16-01's AlertDialog conversion (requestDelete/confirmDelete, deleteBusy-gated dismissal, onOpenAutoFocus override, right-aligned row-action wrapper) and the confirmRowDelete/cancelRowDelete shared helper this plan's tests build on."
provides:
  - "web/e2e/entities-delete-confirmation.spec.ts — 6 dedicated, independent (tarefas-based) Playwright tests proving ENTTBL-08's CSS-measured row-action alignment and DELCONF-01's keyboard cancel/confirm, empirically-checked focus, busy-gated dismissal, zero-native-dialog, and cross-capability-class safety requirements"
  - "A real fix to web/src/lib/components/ui/alert-dialog/alert-dialog-cancel.svelte: AlertDialog.Cancel now actually renders a native `disabled` attribute while busy (bits-ui's own AlertDialogCancelState.props never emitted one)"
  - "A clean, full-milestone-to-date Playwright regression (60/60 passed) plus clean svelte-check/tsc/Biome, confirming ROADMAP Phase 16's 4 success criteria hold together with zero regression"
affects: [17-cross-cutting-polish-accessibility]

actuals:
  tokens: 4200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "CDP network-latency throttle (Network.emulateNetworkConditions on the existing authenticated page, not a fresh context) to reliably observe a busy/disabled window that resolves faster on a real low-latency connection than a sequence of Playwright assertion round trips can reliably catch — same technique class as 14-02's fresh-context CDP throttle, applied here to a live db.transact() round trip instead of an initial query load."
    - "bits-ui `child` snippet render-prop override (mirroring calendar-month-select.svelte's existing pattern) to re-add an HTML attribute that a bits-ui primitive's own internal state class silently drops from its merged props."
    - "Manual (non-helper) AlertDialog open+inspect+close sequences for tests needing to assert focus/disabled state between open and close — re-clicking a row-delete trigger while its own AlertDialog Overlay is already open races Playwright's pointer-interception actionability check, so confirmRowDelete/cancelRowDelete are reused only where no mid-dialog inspection is needed (Test A's cleanup)."

key-files:
  created:
    - web/e2e/entities-delete-confirmation.spec.ts
  modified:
    - web/src/lib/components/ui/alert-dialog/alert-dialog-cancel.svelte
    - web/e2e/entities-form-restyle.spec.ts

key-decisions:
  - "Test B/C/D/E open the AlertDialog via a direct row-delete click (matching confirmRowDelete/cancelRowDelete's own open-step shape) instead of calling the shared helpers verbatim, since each needs to inspect focus/disabled state between open and close — a scenario the atomic helpers can't pause mid-sequence for, and re-invoking them mid-dialog would race Playwright's pointer-interception check against the AlertDialog's own Overlay. confirmRowDelete is still reused verbatim for Test A's cleanup, where no mid-dialog inspection is needed."
  - "Test E (busy-gating) needed a CDP network-latency throttle (800ms) before clicking delete-confirm: db.transact()'s returned promise resolves only once the server acks over the WebSocket (Reactor.js pushOps/_sendMutation), and against the live app's real low-latency connection that round trip resolved faster than two sequential Playwright assertion round trips could reliably observe — without the throttle the test flaked on a genuinely-too-fast busy window, not a product bug."

requirements-completed: [ENTTBL-08, DELCONF-01]

coverage:
  - id: D1
    description: "Dedicated Playwright coverage (entities-delete-confirmation.spec.ts) proves ENTTBL-08's row-action alignment/spacing on tarefas (independent of 16-01's fundos tracer) via real CSS assertions (column-gap, justify-content, text-align) plus a positive bounding-box gap"
    requirement: "ENTTBL-08"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-delete-confirmation.spec.ts#ENTTBL-08: row-edit/row-delete render with a real, positive, CSS-verified gap and a right-aligned actions column"
        status: pass
    human_judgment: false
  - id: D2
    description: "Keyboard-only cancel (Escape) and confirm (Tab+Enter) paths through the AlertDialog, both with empirically-checked document.activeElement focus outcomes (delete-cancel default focus, row-delete on cancel, entity-create-start on confirm)"
    requirement: "DELCONF-01"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-delete-confirmation.spec.ts#DELCONF-01: row-delete opens a shadcn AlertDialog...Cancel is focused by default"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-delete-confirmation.spec.ts#DELCONF-01: keyboard cancel — Escape closes the AlertDialog..."
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-delete-confirmation.spec.ts#DELCONF-01: keyboard confirm — Tab then Enter on the destructive Action..."
        status: pass
    human_judgment: false
  - id: D3
    description: "The AlertDialog cannot be dismissed (Escape ignored, both delete-confirm/delete-cancel disabled) while its own db.transact delete call is genuinely in flight against the live app; fixed a real bug where delete-cancel was never visually/attributably disabled"
    requirement: "DELCONF-01"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-delete-confirmation.spec.ts#DELCONF-01: the AlertDialog cannot be dismissed while the delete is in flight"
        status: pass
    human_judgment: false
  - id: D4
    description: "Restricted (instanciasRotina) and read-only (logInferenciaClaude) capability classes still render zero row-delete against a genuinely-seeded row — no new delete affordance introduced by this phase"
    requirement: "ENTTBL-08"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-delete-confirmation.spec.ts#ENTTBL-08/DELCONF-01 capability safety: restricted and read-only entities gain no new delete affordance"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full pre-existing-plus-new Playwright suite (60 tests) passes with zero failures/skips; svelte-check/tsc and Biome remain clean; zero raw color literal or duplicate load-bearing testid in any file this phase touched"
    verification:
      - kind: e2e
        ref: "cd web && bun run test:e2e (60 passed, 0 failed, 0 skipped)"
        status: pass
      - kind: other
        ref: "cd web && bun run check (exit 0); cd web && bun run lint (exit 0); raw-color-literal and testid-uniqueness grep gates (all pass)"
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-08-10
status: complete
---

# Phase 16 Plan 02: Dedicated Delete-Confirmation Coverage & Full-Suite Regression Summary

**Added 6 tarefas-based Playwright tests proving ENTTBL-08's CSS-measured alignment and DELCONF-01's keyboard/focus/busy-gating/safety requirements independently of Plan 16-01's fundos tracer, uncovering and fixing a real bits-ui bug where AlertDialog.Cancel was never visually disabled while busy — then closed the phase with a clean 60/60 full-suite regression.**

## Performance

- **Duration:** ~90 min (includes root-causing a genuine bits-ui bug, a CDP-throttle fix for a too-fast busy window, 2 magic-code round-trip cooldown cycles, and 4 full-suite regression runs)
- **Completed:** 2026-08-10
- **Tasks:** 2
- **Files touched:** 3 (1 new, 2 modified)

## Accomplishments

- Created `web/e2e/entities-delete-confirmation.spec.ts` (6 tests, `tarefas`-based — deliberately not `fundos`, which 16-01's own `WEB-02` already covers):
  - **Test A** (ENTTBL-08): CSS-verified row-action gap (`column-gap: 8px`, `justify-content: flex-end` on the wrapper; `text-align: right` on the cell) plus a real positive bounding-box gap between `row-edit`/`row-delete`.
  - **Test B** (DELCONF-01): confirms the AlertDialog (not `window.confirm()`) opens with `delete-cancel` focused by default, checked via real `document.activeElement`.
  - **Test C** (DELCONF-01): keyboard cancel — `Escape` closes the dialog, record retained, focus returns to `row-delete`.
  - **Test D** (DELCONF-01): keyboard confirm — `Tab` then `Enter` on `delete-confirm` deletes the record, focus falls back to `entity-create-start`.
  - **Test E** (DELCONF-01): busy-gating — both actions disabled and `Escape` ignored while the real `db.transact` delete is in flight, under a CDP network-latency throttle to make the genuinely-fast busy window reliably observable.
  - **Test F** (safety): `instanciasRotina`/`logInferenciaClaude` still render zero delete affordance against a genuinely-seeded row.
- **Found and fixed a real bug** (not a test-authoring artifact): bits-ui's `AlertDialogCancelState.props` (upstream, `node_modules/bits-ui`) never emits a `disabled` HTML attribute — it only uses the `disabled` box internally to gate its own `onclick`/`onkeydown` handlers. `AlertDialog.Action`'s state class has no such special-casing, so `delete-confirm` correctly showed `disabled`, but `delete-cancel` never did — functionally guarded (clicks/Enter/Space were no-ops while busy) but never visually/attributably disabled. Fixed in the vendored `alert-dialog-cancel.svelte` wrapper via a `child` snippet override, the same render-prop-override pattern already used by `calendar-month-select.svelte` in this codebase.
- Ran the complete pre-existing-plus-new Playwright suite (`bun run test:e2e`, all 3 projects) to a clean **60 passed, 0 failed, 0 skipped**, plus clean `bun run check` and `bun run lint`.
- Along the way, fixed a Biome formatting violation in `entities-form-restyle.spec.ts` (introduced by 16-01's own delete-confirm migration commit, never run through the formatter) and added a missing `type="button"` on the new button element in `alert-dialog-cancel.svelte`, so `bun run lint` reaches a clean exit 0 for the whole phase.

## Task Commits

1. **Task 1 (tdd): dedicated ENTTBL-08/DELCONF-01 coverage** — `bb870e0` (test) — adds `entities-delete-confirmation.spec.ts` (6 tests); fixes `alert-dialog-cancel.svelte`'s missing `disabled` attribute (the real bug Test E's authoring surfaced).
2. **Task 2: full-suite regression + quality gates** — `eea9a6c` (fix) — adds `type="button"` to the new button element and reformats `entities-form-restyle.spec.ts`'s one over-width line, both required for `bun run lint` to exit 0 as this phase's own final quality gate; verified by a clean 60/60 `bun run test:e2e` run plus clean `bun run check`/`bun run lint`.

**Plan metadata:** (this commit, docs) — completes 16-02-PLAN.md.

## Files Created/Modified

- `web/e2e/entities-delete-confirmation.spec.ts` (new) — 6 tests: CSS-verified row-action alignment (Test A), default-focus/no-native-dialog proof (Test B), keyboard cancel with focus check (Test C), keyboard confirm with focus check (Test D), busy-gating under CDP throttle (Test E), cross-capability-class safety (Test F).
- `web/src/lib/components/ui/alert-dialog/alert-dialog-cancel.svelte` — `child` snippet override re-adds the `disabled` HTML attribute bits-ui's own `AlertDialogCancelState.props` drops; adds `type="button"` on the resulting native button.
- `web/e2e/entities-form-restyle.spec.ts` — one-line Biome formatting fix (multi-line locator chain) on the toast-locator line 16-01 introduced.

## Decisions Made

- **Helper reuse scope (documented tension with the plan's own key_links wording):** the plan's frontmatter states every test "reuses `confirmRowDelete`/`cancelRowDelete` ... for its mouse-driven open step." Tests B–E instead open the dialog via a direct `row.getByTestId("row-delete").click()` (the same open-step shape the helpers use internally) because each needs to inspect focus or disabled state *between* open and close — the helpers resolve the whole open+action+close sequence atomically and can't pause mid-way. Re-invoking a helper's own `row-delete` click a second time while the AlertDialog's Overlay is already open would also race Playwright's pointer-interception actionability check (the Overlay, not the covered trigger, receives the click), closing the dialog unexpectedly instead of cleanly. `confirmRowDelete` is reused verbatim for Test A's cleanup, where no mid-dialog inspection is needed and the risk doesn't apply.
- **CDP network-latency throttle for Test E:** `db.transact()`'s promise resolves once the server acks the mutation over the WebSocket (`Reactor.js`'s `pushOps`/`_sendMutation`), not purely optimistically-locally. Against the live app's real low-latency connection, that round trip resolved in well under the time two sequential Playwright assertion round trips take, closing the busy window before both `toBeDisabled()` checks could land — confirmed empirically via a throwaway debug script logging `disabled`/dialog state every 20ms. An 800ms CDP `Network.emulateNetworkConditions` latency throttle (reset in a `finally`) makes the window reliably observable, mirroring 14-02's established CDP-throttle technique for the same class of "genuinely transient, too-fast-on-a-real-network" state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `AlertDialog.Cancel` never rendered a `disabled` HTML attribute while busy**
- **Found during:** Task 1, authoring the busy-gating test (Test E) — `expect(page.getByTestId("delete-cancel")).toBeDisabled()` failed consistently across 5+ runs, isolated via a throwaway debug spec logging both buttons' `disabled` property every 20ms (confirmed `delete-confirm` flipped `true` for ~40ms then `false`; `delete-cancel` stayed `false` the entire time).
- **Root cause:** bits-ui's `AlertDialogCancelState.props` (`node_modules/bits-ui/dist/bits/dialog/dialog.svelte.js`) reads the `disabled` box only to gate its own internal `onclick`/`onkeydown` handlers — it never includes a `disabled` key in the props object it merges onto the rendered button. `DialogActionState.props` has no such special-casing, so a raw `disabled` prop flows straight through for `Action` but not `Cancel`. Click-blocking was already functionally correct (bits-ui's internal handlers checked `disabled.current`); only the visual/attribute representation was missing.
- **Fix:** In `web/src/lib/components/ui/alert-dialog/alert-dialog-cancel.svelte`, added a `child` snippet override (mirroring `calendar-month-select.svelte`'s existing pattern in this codebase) that renders the button ourselves, spreading bits-ui's merged props first and then explicitly re-adding `disabled={disabled}` so it always lands on the DOM element.
- **Files modified:** `web/src/lib/components/ui/alert-dialog/alert-dialog-cancel.svelte`
- **Verification:** Test E passed reliably across 2 consecutive full runs of the new spec file, then again in the full 60-test suite.
- **Committed in:** `bb870e0` (Task 1 commit)

**2. [Rule 3 - Blocking] Two quality-gate violations blocking `bun run lint`'s required exit 0**
- **Found during:** Task 2's `bun run lint` gate run.
- **Issue:** (a) The new `child`-snippet `<button>` in `alert-dialog-cancel.svelte` (fix #1 above) lacked an explicit `type` attribute, tripping Biome's `lint/a11y/useButtonType`. (b) `entities-form-restyle.spec.ts`'s `ENTFRM-01` toast-locator line — introduced by 16-01's own delete-confirm migration commit (`2e3920d`) — had never been run through the formatter and was flagged as a formatting mismatch.
- **Fix:** (a) Added `type="button"`, matching the project's own `Button` component's default. (b) Ran the project's own Biome formatter targeted at just that one file (`biome check --write`), applying only the multi-line reformat shown in the diff — no other file touched.
- **Files modified:** `web/src/lib/components/ui/alert-dialog/alert-dialog-cancel.svelte`, `web/e2e/entities-form-restyle.spec.ts`
- **Verification:** `bun run lint` exits 0 (11 pre-existing, out-of-scope warnings remain in `calendar-caption.svelte`/`shell-chrome.spec.ts` from Phases 12/13 — untouched, correctly left alone per the scope-boundary rule).
- **Committed in:** `eea9a6c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking quality-gate fix bundling 2 small issues)
**Impact on plan:** Both fixes were necessary for correctness (Cancel's busy-gating truth) and for this phase's own required quality gates to pass. No scope creep — no other file was touched, and the 11 pre-existing warnings in unrelated Phase 12/13 files were correctly left alone.

## Issues Encountered

- **Live magic-code round-trip delays under heavy same-session testing:** the InstantDB magic-code email round trip timed out twice (45s poll window) during this plan's execution — the same class of pre-existing, documented flakiness already logged in `STATE.md` ("Occasional live-email-timing test flake ... Deferred, non-blocking, pre-existing") and called out explicitly in this session's own task brief (heavy magic-code testing already run in Phase 16 Plan 01). Resolved both times with a single ~60-90s cooldown (via a backgrounded `sleep`, per the no-hammering-retries guidance) before the next attempt succeeded on the first try. Not a code regression — confirmed by peeking the mailbox directly (the codes did eventually arrive, just after the 45s window).
- **One transient full-suite failure, confirmed non-regression:** the first full `bun run test:e2e` run hit a single `TypeError: fetch failed` / `ConnectTimeoutError` connecting to InstantDB's admin API from `instancia-admin-fixture.ts` (a pre-existing test file, unrelated to anything this phase touched). Re-ran the affected test (`entities-table-restyle.spec.ts`) in isolation immediately after — passed in 4.1s — then re-ran the full suite, which passed 60/60 clean. Consistent with the same class of live-network flakiness 16-01-SUMMARY documented for a CLI SSL handshake timeout.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 16 (`ENTTBL-08`, `DELCONF-01`) is fully complete: implementation (16-01) plus dedicated, independent coverage and a real bug fix (16-02). ROADMAP Phase 16's 4 success criteria are all proven, together with zero regression to the full pre-existing 54-test v1.2 suite (now 60 tests total).
- `EntityScreen.svelte`'s row-action/delete-confirmation surface, the `confirmRowDelete`/`cancelRowDelete` helper, and the now visually-correct `AlertDialog.Cancel` are the stable contract Phase 17 (cross-cutting polish & accessibility) builds on.
- No blockers.

---
*Phase: 16-entity-screen-row-actions-delete-confirmation*
*Completed: 2026-08-10*

## Self-Check: PASSED
All created/modified files verified present on disk; both task commits (`bb870e0`, `eea9a6c`) verified present in git log.
