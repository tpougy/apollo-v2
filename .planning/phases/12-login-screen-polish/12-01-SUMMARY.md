---
phase: 12-login-screen-polish
plan: 01
subsystem: ui
tags: [svelte, tailwind, shadcn-svelte, playwright, auth]

# Dependency graph
requires: []
provides:
  - "LoginScreen.svelte composed inside Card/CardHeader/CardTitle/CardDescription, full-viewport centered, at both auth steps"
  - "A two-tier space-y-4/space-y-2 Tailwind spacing scale applied identically to both auth steps — first application of this scale in the codebase"
  - "login-composition.spec.ts — live Playwright coverage proving Card composition, centering, and measured spacing-scale parity"
affects: [13-shell-navigation-polish, 17-cross-cutting-polish-verification]

# Actuals (#2632)
actuals:
  tokens: 2476
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "space-y-4 field-group / space-y-2 label-control spacing scale — first codebase application, to be reused by Phases 13-17"
    - "CardHeader/CardTitle/CardDescription composed as a sibling immediately before CardContent, mirroring the existing Dialog.Header/Dialog.Title convention in EntityScreen.svelte"

key-files:
  created:
    - web/e2e/login-composition.spec.ts
  modified:
    - web/src/lib/auth/LoginScreen.svelte
    - web/playwright.config.ts

key-decisions:
  - "App.svelte's root <h1> left completely untouched — CardHeader/CardTitle added as new, additive markup inside the Card rather than replacing or relocating the <h1>, per 12-PATTERNS.md's Critical Constraint (design-system.spec.ts asserts its computed font-size/weight)."
  - "Two new additive data-testids (login-email-field, login-code-field) added for spacing-gap measurement in the new spec — never replacing any of the six pre-existing load-bearing testids, which stay on their original elements."

patterns-established:
  - "Pattern 1: Auth-card composition — CardHeader (CardTitle + step-aware CardDescription) as a sibling immediately before CardContent, both steps sharing one Card instance."
  - "Pattern 2: Spacing scale — space-y-4 on CardContent and each step's <form>, space-y-2 on each label/control field div — identical literal class strings across both steps, no ad hoc per-step values."

requirements-completed: [LOGIN-01, LOGIN-02]

coverage:
  - id: D1
    description: "LoginScreen renders inside a Card with CardHeader/CardTitle/CardDescription, centered full-viewport, at both the email-entry and code-entry steps"
    requirement: "LOGIN-01"
    verification:
      - kind: e2e
        ref: "web/e2e/login-composition.spec.ts#LoginScreen composes a centered Card with a consistent spacing scale at both auth steps"
        status: pass
      - kind: e2e
        ref: "web/e2e/design-system.spec.ts (App.svelte h1 untouched, zero console errors)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both auth steps use the identical space-y-4/space-y-2 spacing scale between field groups, with measured pixel-equal gaps"
    requirement: "LOGIN-02"
    verification:
      - kind: e2e
        ref: "web/e2e/login-composition.spec.ts#LoginScreen composes a centered Card with a consistent spacing scale at both auth steps (gap-measurement assertions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A live magic-code login round trip (email step -> code step -> authenticated session) completes successfully through the restyled markup, and every pre-existing load-bearing data-testid still resolves to exactly one element"
    verification:
      - kind: e2e
        ref: "web/e2e/auth.setup.ts#real magic-code round trip authenticates the SPA (bun run test:e2e:auth)"
        status: pass
      - kind: e2e
        ref: "web/e2e/login-flow.spec.ts (spinner test + wrong-code destructive Alert test)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-10
status: complete
---

# Phase 12 Plan 01: Login Screen Polish Summary

**LoginScreen restyled into a centered, full-viewport Card with CardHeader/CardTitle/step-aware CardDescription and an identical space-y-4/space-y-2 spacing scale on both auth steps, proven live end-to-end against the real InstantDB app.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-10T12:05:00Z (approx.)
- **Completed:** 2026-08-10T12:25:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `LoginScreen.svelte` now composes inside `Card` > `CardHeader` (`CardTitle` + step-aware `CardDescription`) > `CardContent`, wrapped in a `flex min-h-screen items-center justify-center p-4` full-viewport centering container, narrowed to `max-w-sm` — proven structurally and behaviorally (measured bounding-box centering) by the new spec.
- Both auth steps (email entry, code entry) now use byte-identical `space-y-4`/`space-y-2` spacing classes — the first application of this two-tier scale anywhere in the codebase, which Phase 17's POLISH-04 audit will later reuse as the established baseline.
- New `web/e2e/login-composition.spec.ts` proves, against the live InstantDB app, that Card sub-parts render exactly once per step and that the measured `space-y-4` (form) and `space-y-2` (field) gaps are pixel-equal between the email and code steps — the behavioral proof LOGIN-02 requires beyond source-diff inspection.
- Every pre-existing load-bearing `data-testid` (`login-screen`, `login-email`, `login-code`, `login-submit`, `login-error`, `login-resend`) verified to resolve to exactly one element, unchanged in meaning; `App.svelte`'s root `<h1>` stayed byte-identical and `design-system.spec.ts` passed unmodified.
- Full live magic-code round trip (email -> code -> authenticated `app-shell`) verified successfully through the fully restyled markup via `bun run test:e2e:auth`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Card composition + full-viewport centering, proven end-to-end on the email step** - `b49de9a` (feat)
2. **Task 2: Mirror the identical spacing scale onto the code step and prove the full live round trip** - `213d037` (feat)
3. **Task 3: Dedicated Playwright coverage proving Card composition, centering, and spacing-scale parity** - `ad1957d` (test)

_No TDD tasks in this plan; each task is a single commit._

## Files Created/Modified

- `web/src/lib/auth/LoginScreen.svelte` - Restyled in place: added `CardHeader`/`CardTitle`/`CardDescription` composition (step-aware description text), full-viewport centering on the existing `login-screen` div, `space-y-4`/`space-y-2` spacing scale on both steps, a `flex items-center gap-2` button row on the code step, and two new additive testids (`login-email-field`, `login-code-field`).
- `web/e2e/login-composition.spec.ts` - New Playwright spec (real live magic-code send, no code submission) proving Card composition, full-viewport centering, and measured spacing-scale parity between the two auth steps.
- `web/playwright.config.ts` - Extended the `anon` project's `testMatch` and the `authed` project's `testIgnore` regexes to include `login-composition.spec.ts`, routing it correctly (never under `authed`'s already-signed-in storageState).

## Decisions Made

- Left `App.svelte`'s root `<h1>` completely untouched — the new `CardHeader`/`CardTitle` sit as additive markup inside the `Card`, not a replacement for or relocation of the `<h1>`, avoiding any risk to `design-system.spec.ts`'s computed-style assertions (per 12-PATTERNS.md's Critical Constraint).
- Added two new, purely additive `data-testid`s (`login-email-field`, `login-code-field`) solely to give the new spec stable anchors for gap measurement — never replacing the pre-existing testids on the `Input` elements themselves.

## Deviations from Plan

None - plan executed exactly as written. Every task's `<action>` was implemented verbatim, all acceptance-criteria greps and Playwright assertions matched the plan's specified counts (with one immaterial documentation note below), and no Rule 1-4 deviation was triggered.

**Documentation note (not a code deviation):** Task 3's acceptance criteria states `cd web && bunx playwright test e2e/login-flow.spec.ts e2e/design-system.spec.ts --project=anon` reports "3 passed" — the actual, correct count is 6 passed (design-system.spec.ts has 4 tests, login-flow.spec.ts has 2), which is what was observed and is a pass either way (0 failed, zero regression). This is a stale test-count figure in the plan's acceptance-criteria text, not a code or behavior issue — no fix applied since nothing in the codebase needed correcting.

## Issues Encountered

- The real-inbox "wrong code" test (`login-flow.spec.ts`) timed out twice while polling for a new magic code during the full phase-level regression run, due to Outlook Classic COM sync lag after several rapid successive live sends earlier in this same session (each task and the dedicated spec all performed their own real `sendMagicCode` round trip in quick succession). This is the pre-existing, already-documented flake noted in STATE.md's Deferred Items ("Occasional live-email-timing test flake (magic-code round trip) — Deferred, non-blocking, pre-existing"). Confirmed via a direct Outlook peek that the emails were arriving correctly, just delayed; retried once the backlog cleared and the test passed cleanly both in isolation and as part of the full regression suite.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 13 (Shell / Navigation Polish) can now reuse the `space-y-4`/`space-y-2` spacing scale established here as its own baseline, per REQUIREMENTS.md's cross-milestone rhythm intent.
- No blockers. Phase 12 (Login Screen Polish) is fully complete: LOGIN-01 and LOGIN-02 both proven live via Playwright, zero regression on the pre-existing 39-test suite's login/design-system coverage, `svelte-check`/`tsc` clean.

---
*Phase: 12-login-screen-polish*
*Completed: 2026-08-10*
