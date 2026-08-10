---
phase: 13-shell-chrome-header-nav-content-frame
plan: 01
subsystem: ui
tags: [svelte, shell, layout, playwright, tailwind, shadcn-svelte]

# Dependency graph
requires:
  - phase: 12-login-screen-polish
    provides: space-y-4/space-y-2 Tailwind spacing scale baseline, Card composition idiom
provides:
  - "Shell.svelte shell-header toolbar (app identity + auth status + logout)"
  - "Shell.svelte shell-content-frame outer wrapper (mx-auto max-w-6xl + padding + space-y-6) inherited by all 9 entities"
  - "Vendored Separator component now in active use, between header and content-frame"
  - "App.svelte root <h1> scoped inside <SignedOut> only — no duplicate app-identity text once signed in"
affects: [14-entity-screen-table-states, 15-entity-form-dialog, 16-entity-row-actions-delete, 17-cross-cutting-polish-verification]

actuals:
  tokens: 1944
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shell owns exactly one outer content-frame wrapper (frame-once-in-Shell, ARCHITECTURE.md Pattern 1) — future EntityScreen work must never re-declare page-frame spacing"
    - "Header/toolbar + Separator + content-frame composition order, reusable as the layout skeleton for later phases"

key-files:
  created:
    - web/e2e/shell-chrome.spec.ts
  modified:
    - web/src/lib/Shell.svelte
    - web/src/App.svelte

key-decisions:
  - "App.svelte's root <h1>Apollo v2</h1> relocated inside <SignedOut> (ahead of LoginScreen) rather than deleted, so it renders only on the signed-out path and design-system.spec.ts's anon-project assertions hold unchanged"
  - "Content-frame consistency test compares position (x/y) and width only, not height, across the 9 entities — height legitimately varies with each entity's own row/empty-state content"

patterns-established:
  - "shell-content-frame: mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6, wrapping <nav> and the {#key ativo} EntityScreen mount point"
  - "shell-header: flex items-center justify-between gap-4 px-4 py-3 sm:px-6, app-identity span on the left, auth-status + logout Button on the right"

requirements-completed: [SHELL-01, SHELL-02, SHELL-03]

coverage:
  - id: D1
    description: "Shell.svelte renders a single shell-header toolbar (app identity + logout), replacing the stray root <h1> and floating logout button"
    requirement: "SHELL-01"
    verification:
      - kind: e2e
        ref: "web/e2e/shell-chrome.spec.ts#header/toolbar composition"
        status: pass
      - kind: e2e
        ref: "web/e2e/shell-chrome.spec.ts#single app-identity element when authenticated — no duplicate root h1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Entity nav uses one clear active-state indicator and a single flat-wrapping-row strategy for all 9 items (no Tabs, no scroll container)"
    requirement: "SHELL-02"
    verification:
      - kind: e2e
        ref: "web/e2e/shell-nav.spec.ts#exactly one nav Button shows the active-state indicator at a time"
        status: pass
      - kind: e2e
        ref: "web/e2e/shell-chrome.spec.ts#nav overflow strategy — single flat wrapping row, no Tabs, no scroll container"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shell.svelte owns exactly one outer content-frame wrapper (max-width + padding + vertical rhythm) around nav and the active EntityScreen, identical across all 9 entities"
    requirement: "SHELL-03"
    verification:
      - kind: e2e
        ref: "web/e2e/shell-chrome.spec.ts#single content-frame consistency across entities"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full pre-existing Playwright suite (shell-nav.spec.ts + design-system.spec.ts + all other specs) passes unmodified against the restructured markup"
    verification:
      - kind: e2e
        ref: "cd web && bun run test:e2e (44 tests)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-10
status: complete
---

# Phase 13 Plan 01: Shell Chrome — Header, Nav & Content Frame Summary

**`Shell.svelte` restructured with a `shell-header` toolbar + `Separator` + single `shell-content-frame` wrapper inherited by all 9 entities, and `App.svelte`'s root `<h1>` scoped inside `<SignedOut>` to eliminate the duplicate "Apollo v2" once signed in.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-10T13:36:43Z
- **Completed:** 2026-08-10T13:47:00Z
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- `Shell.svelte` now presents one coherent `shell-header` row (app identity `shell-app-name` + auth-status text + the unchanged `logout` Button), separated by a `Separator` from a single `shell-content-frame` wrapper (`mx-auto max-w-6xl` + padding + `space-y-6`) that owns the nav and the `{#key ativo}` EntityScreen mount point.
- Nav overflow strategy locked in: `flex flex-wrap gap-2` — a single flat wrapping row, no `Tabs` component, no horizontal-scroll container, per CONTEXT.md's already-approved decision.
- `App.svelte`'s root `<h1>Apollo v2</h1>` moved inside the existing `<SignedOut>` block, so it renders only on the signed-out/login path — a signed-in user now sees exactly one "Apollo v2" text (`shell-app-name`), never a duplicate.
- New `web/e2e/shell-chrome.spec.ts` (4 tests) proves header/toolbar composition, content-frame position/width/max-width consistency across the first/middle/last of the 9 entities, the no-Tabs/no-scroll-container nav strategy, and single app-identity ownership — all against the live InstantDB app.
- Full pre-existing Playwright suite (44 tests total, including the new spec) passes with zero failures and zero skips.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Header/toolbar, Separator, and single content-frame wrapper** - `a1a5c87` (feat)
2. **Task 2: Dedicated Playwright coverage for header/toolbar, content-frame, and nav overflow** - `ce92d15` (test)
3. **Task 3: Full-suite regression** - no commit (read-only verification task, modified no files)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified
- `web/src/lib/Shell.svelte` - Added `shell-header` toolbar, `Separator`, `shell-content-frame` wrapper; nav changed to `flex flex-wrap gap-2`
- `web/src/App.svelte` - Root `<h1>Apollo v2</h1>` relocated inside `<SignedOut>`, ahead of `<LoginScreen />`
- `web/e2e/shell-chrome.spec.ts` - New: 4 Playwright tests covering header/toolbar composition, content-frame consistency, nav overflow strategy, and single app-identity ownership

## Decisions Made
- App.svelte's `<h1>` was relocated (not deleted, not duplicated) inside `<SignedOut>` — keeps `design-system.spec.ts`'s signed-out assertions byte-identical while eliminating the signed-in duplicate.
- Content-frame consistency test (`shell-chrome.spec.ts` Test 2) compares bounding-box `x`/`y`/`width` and computed `max-width`, deliberately excluding `height` — height legitimately differs per entity (empty-state vs. populated table rows), so asserting full box equality would be a false constraint unrelated to SHELL-03's actual claim (the wrapper's spacing/width is fixed, not the page's total content height).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed an incorrect assertion in shell-chrome.spec.ts's own first draft**
- **Found during:** Task 2, first `<verify>` run
- **Issue:** The initial Test 2 draft asserted full bounding-box equality (`toEqual`, including `height`) across the 9 entities. Different entities render different content heights (e.g., an empty "Nenhum registro." table vs. a populated one), so the test failed on a legitimate, expected height difference — not a real regression.
- **Fix:** Narrowed the cross-entity comparison to `x`, `y`, `width`, and computed `max-width` only, matching the plan's own `<behavior>` wording ("bounding box (position and width)... byte-identical").
- **Files modified:** web/e2e/shell-chrome.spec.ts
- **Verification:** Re-ran `bunx playwright test e2e/shell-chrome.spec.ts --project=authed` — 4/4 passed.
- **Committed in:** ce92d15 (Task 2 commit; fixed before the task's own first commit, not a separate commit)

---

**Total deviations:** 1 auto-fixed (1 bug, self-contained within Task 2's own initial authoring, before that task's commit)
**Impact on plan:** No scope creep — this was a bug in the test file being authored in this same task, caught and fixed by the task's own verify loop before commit.

## Issues Encountered
- One transient full-suite run (`bun run test:e2e`) failed at the `setup` project step with "Timed out after 45000ms waiting for a new magic code" — this is the pre-existing, previously-logged live-email-timing flake (see STATE.md Deferred Items: "Occasional live-email-timing test flake (magic-code round trip) — Deferred — non-blocking, pre-existing — v1.1 close"), not a regression from this plan's changes. A single immediate re-run of `bun run test:e2e` succeeded cleanly with all 44 tests passing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The outer content-frame and header/nav rhythm are now final and stable; Phase 14 (Entity Screen — Table & States) can build its own page-header/table/empty-state polish against this already-locked outer frame without re-litigating spacing.
- No blockers or concerns carried forward.

---
*Phase: 13-shell-chrome-header-nav-content-frame*
*Completed: 2026-08-10*

## Self-Check: PASSED

All claimed files exist on disk (`web/src/lib/Shell.svelte`, `web/src/App.svelte`, `web/e2e/shell-chrome.spec.ts`, this SUMMARY.md) and both task commit hashes (`a1a5c87`, `ce92d15`) are present in git log.
