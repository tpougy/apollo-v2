---
phase: 08-auth-shell-restyle
plan: 01
subsystem: ui
tags: [svelte5, shadcn-svelte, bits-ui, tailwindcss, playwright, instantdb, magic-code-auth]

# Dependency graph
requires:
  - phase: 07-design-system-setup
    provides: "Tailwind v4 + shadcn-svelte foundation (components.json, $lib/utils.ts cn(), CSS tokens, dark mode via prefers-color-scheme) with zero components installed yet"
provides:
  - "5 shadcn-svelte component groups (button, input, label, card, alert) installed under web/src/lib/components/ui/"
  - "LoginScreen.svelte restyled on Card/Input/Label/Button/Alert, magic-code flow behavior unchanged"
  - "Shell.svelte restyled: logout Button + flex nav of Button (secondary/ghost active-state toggle), business logic unchanged"
  - "web/e2e/login-flow.spec.ts (anon project) — live loading/error-state proof"
  - "web/e2e/shell-nav.spec.ts (authed project) — live nav/active-state/logout proof"
affects: ["09-entity-table-restyle", "10-entity-form-feedback-restyle", "11-full-verification"]

# Actuals (#2632)
actuals:
  tokens: 11469
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: ["bits-ui@^2.16.3 (transitive, via shadcn-svelte Label)", "@internationalized/date@^3.12.0 (transitive, bits-ui's declared peerDependency — required by bits-ui@2.18.1 per its package.json even though no Phase 8 component imports it directly; not dead weight)"]
  patterns:
    - "shadcn-svelte Button defaults type=\"button\" — every restyled submit Button needs explicit type=\"submit\""
    - "Loading state = disabled Button + LoaderCircle icon child (animate-spin), no dedicated Spinner component"
    - "Error state = Alert variant=\"destructive\" + CircleAlert icon + AlertDescription carrying the existing testid"
    - "Active-nav-state = Button variant toggle (secondary active / ghost inactive), not a hand-rolled class"
    - "Induce a live auth error deterministically by submitting a real-but-wrong 6-digit code (last digit +1 mod 10) instead of waiting for natural ~60-90s expiry"

key-files:
  created:
    - web/src/lib/components/ui/button/
    - web/src/lib/components/ui/input/
    - web/src/lib/components/ui/label/
    - web/src/lib/components/ui/card/
    - web/src/lib/components/ui/alert/
    - web/e2e/login-flow.spec.ts
    - web/e2e/shell-nav.spec.ts
  modified:
    - web/src/lib/auth/LoginScreen.svelte
    - web/src/lib/Shell.svelte
    - web/playwright.config.ts
    - web/package.json
    - web/bun.lock

key-decisions:
  - "Card/CardContent wraps the whole two-step login form (not only the error branch), per ROADMAP Phase 8 success criterion 1's literal requirement that Card be present at each step"
  - "secondary/ghost variant pair chosen for nav active-state (not default/ghost) — gives a resting-state background-color difference assertable via getComputedStyle without hover/focus interaction"
  - "Shell.svelte's {#key ativo} EntityScreen mount area left unwrapped (no Card) — SHELLUI-01 names only Button + flex/grid, Phase 9/10 own entity-screen visual design"
  - "Deliberately-wrong-code (not natural expiry) used to prove the live error path in login-flow.spec.ts — avoids a ~60-90s flaky wait while still being a genuine live InstantDB rejection"

patterns-established:
  - "New live e2e specs are added to playwright.config.ts's anon/authed testMatch/testIgnore regexes additively (Phase 7's design-system.spec.ts precedent), never by editing existing spec files' scope"
  - "Newly shadcn-svelte-generated files must be run through `bun run lint:fix` before committing — the CLI's own output is not Biome-import-order-clean by default"

requirements-completed: [AUTHUI-01, AUTHUI-02, SHELLUI-01, SHELLUI-02]

coverage:
  - id: D1
    description: "Real magic-code login (email step, then code step) completes end-to-end through shadcn Input/Label/Button/Card markup, live against InstantDB"
    requirement: AUTHUI-01
    verification:
      - kind: e2e
        ref: "web/e2e/auth.setup.ts#real magic-code round trip authenticates the SPA (--project=setup)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loading state (disabled + spinner Button) and error state (Alert variant=destructive with login-error) are each visually distinguishable via real live round trips"
    requirement: AUTHUI-02
    verification:
      - kind: e2e
        ref: "web/e2e/login-flow.spec.ts#submit Button shows disabled + spinner while the send request is in flight (--project=anon)"
        status: pass
      - kind: e2e
        ref: "web/e2e/login-flow.spec.ts#submitting a deliberately wrong code renders the destructive Alert (--project=anon)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shell.svelte renders the 9-entity nav using shadcn Button in a flex layout; each entry navigates to its EntityScreen"
    requirement: SHELLUI-01
    verification:
      - kind: e2e
        ref: "web/e2e/shell-nav.spec.ts#each nav Button renders its corresponding EntityScreen (--project=authed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Exactly one nav Button shows the active-state indicator (aria-current + shadcn variant) at all times, and Logout ends the live session back to LoginScreen"
    requirement: SHELLUI-02
    verification:
      - kind: e2e
        ref: "web/e2e/shell-nav.spec.ts#exactly one nav Button shows the active-state indicator at a time (--project=authed)"
        status: pass
      - kind: e2e
        ref: "web/e2e/shell-nav.spec.ts#clicking Logout ends the session and returns to the restyled LoginScreen (--project=authed)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-09
status: complete
---

# Phase 8 Plan 1: Auth & Shell Restyle Summary

**LoginScreen and Shell rebuilt on shadcn-svelte (Button/Input/Label/Card/Alert), all four requirements proven by 6 new/existing live Playwright tests against the real InstantDB app, including two real magic-code round trips and a real wrong-code rejection.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-09T22:40:00Z (approx, first tool call)
- **Completed:** 2026-08-09T22:51:00Z
- **Tasks:** 3/3
- **Files modified:** 26 (5 new component groups × ~3 files each, 2 restyled screens, 2 new spec files, 1 config edit, package.json/bun.lock)

## Accomplishments

- Installed shadcn-svelte's `button`, `input`, `label`, `card`, `alert` component groups via `bunx shadcn-svelte@latest add ... -y` (pulled `bits-ui` fresh, confirmed in `web/package.json`)
- Restyled `LoginScreen.svelte`: `Card`/`CardContent` wraps the whole two-step form, `Label`+`Input` pairs replace raw HTML, both submit `Button`s carry explicit `type="submit"` and the shared `login-submit` testid, `LoaderCircle` spinner renders inside each submit `Button` while `ocupado`, error paragraph replaced by `Alert variant="destructive"` + `CircleAlert` + `AlertDescription` carrying `login-error` verbatim — script block byte-identical
- Added `web/e2e/login-flow.spec.ts` (new, `anon` project): one test catches the real in-flight disabled+spinner state on `db.auth.sendMagicCode`, one test submits a deliberately wrong (but real-derived) 6-digit code and asserts the live rejection renders inside `Alert[data-slot="alert"]` with the `destructive` variant class
- Restyled `Shell.svelte`: logout `<button>` → `Button variant="outline"`, nav wrapped in `class="flex gap-2"`, each nav entry → `Button` toggling `variant={ativo === cfg.etype ? "secondary" : "ghost"}` — `onMount` job-tracking script, `routine-job-state` sentinel, and `{#key ativo}` `EntityScreen` mount left byte-identical
- Added `web/e2e/shell-nav.spec.ts` (new, `authed` project, auto-runs `setup`): all 9 nav `Button`s render their `EntityScreen` (h2 match), exactly one `aria-current="true"` element at every step with a distinct resting-state `backgroundColor` vs an inactive entry, and Logout ends the live session and returns to `login-screen`
- Full regression suite (`bun run test:e2e`, all three Playwright projects, 31 tests) green live against InstantDB; `bun run check` (svelte-check + tsc) and `bun run lint` (Biome) both exit 0 with zero new suppressions

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Install shadcn primitives and restyle LoginScreen.svelte** - `8cbf148` (feat)
2. **Task 2: Prove AUTHUI-02's loading and error states with login-flow.spec.ts** - `5b90cd1` (test)
3. **Task 3: Restyle Shell.svelte's nav/logout and prove SHELLUI-01/02 with shell-nav.spec.ts** - `68b41da` (feat)

**Plan metadata:** (this commit, made immediately after this SUMMARY)

## Files Created/Modified

- `web/src/lib/components/ui/button/{button.svelte,index.ts}` - shadcn Button (variants: default/outline/secondary/ghost/destructive/link)
- `web/src/lib/components/ui/input/{input.svelte,index.ts}` - shadcn Input
- `web/src/lib/components/ui/label/{label.svelte,index.ts}` - shadcn Label (wraps bits-ui `LabelPrimitive.Root`)
- `web/src/lib/components/ui/card/{card.svelte,card-content.svelte,...,index.ts}` - shadcn Card component group
- `web/src/lib/components/ui/alert/{alert.svelte,alert-description.svelte,alert-title.svelte,alert-action.svelte,index.ts}` - shadcn Alert component group
- `web/src/lib/auth/LoginScreen.svelte` - restyled markup, script block unchanged
- `web/src/lib/Shell.svelte` - restyled nav/logout markup, script block unchanged
- `web/e2e/login-flow.spec.ts` - new, live loading/error-state proof (anon project)
- `web/e2e/shell-nav.spec.ts` - new, live nav/active-state/logout proof (authed project)
- `web/playwright.config.ts` - additive edit broadening `anon` testMatch / `authed` testIgnore to include `login-flow.spec.ts`
- `web/package.json`, `web/bun.lock` - `bits-ui` added as a new dependency, plus `@internationalized/date` (bits-ui's declared peerDependency, pulled in by the same `shadcn-svelte add` run)

## Decisions Made

- Card wraps the entire two-step form (both steps), not only the error branch — matches ROADMAP Phase 8 success criterion 1's literal text that Card markup must be locatable at each auth step
- `secondary`/`ghost` chosen as the active/inactive nav variant pair (verified against the live `nova` `button.json` registry source) — gives a resting-state background-color difference assertable via `getComputedStyle` without any hover/focus simulation
- Shell's main content area (`{#key ativo}` block) left unwrapped by any new component — SHELLUI-01 names only `Button` + flex/grid; Card there is out of this phase's scope (Phase 9/10 own entity-screen visual design)
- login-flow.spec.ts induces the error state via a deliberately-wrong-but-real-derived code rather than waiting for natural ~60-90s expiry — a genuine live rejection with a deterministic, fast round trip

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Biome import-order/formatting violations in shadcn-svelte-generated files and hand-edited files**
- **Found during:** Task 1 (`bun run lint` after installing components and restyling LoginScreen.svelte)
- **Issue:** The `shadcn-svelte add` CLI's generated `input.svelte`, `alert.svelte`, `button.svelte`, `label/index.ts`, `card/index.ts` (and hand-written import order in `LoginScreen.svelte`/`Shell.svelte`) did not match this repo's Biome config (import sorting, tab-vs-space formatting on generated `export { Root, // Root as X }` re-export idiom) — exactly the class of issue Phase 7's own `07-01-SUMMARY.md` precedent already anticipated for shadcn-svelte-generated output.
- **Fix:** Ran `bun run lint:fix` (project-wide `biome check --write`) after each file-touching task, then re-ran `bun run lint` to confirm zero remaining errors before moving on.
- **Files modified:** `web/src/lib/components/ui/{input,alert,button}/*.svelte`, `web/src/lib/components/ui/{label,card}/index.ts`, `web/src/lib/auth/LoginScreen.svelte` (import order only), `web/src/lib/Shell.svelte` (import order only)
- **Verification:** `bun run lint` exits 0 with zero fixes remaining; `bun run check` (svelte-check + tsc) still 0 errors after the autofix
- **Committed in:** `8cbf148` (Task 1), `68b41da` (Task 3 — Shell.svelte's own import-order fix, applied before its commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — Biome formatting on generated/edited files)
**Impact on plan:** Purely mechanical formatting fix required to satisfy the plan's own `<verification>` gate (`bun run check && bun run lint` must both exit 0, zero new suppressions). No behavior change, no scope creep.

## Issues Encountered

None beyond the deviation above. The precondition (`powershell.exe` resolving the Outlook Classic COM bridge) was confirmed met before Task 1 began (`command -v powershell.exe` resolved successfully), and every live magic-code round trip across all three tasks' verify commands plus the full-suite regression completed within its allotted timeout on the first attempt — no resend/retry needed in any run.

## User Setup Required

None - no external service configuration required.

## Verification Evidence (real, live runs — no mocks)

- Task 1 verify: `cd web && bunx playwright test e2e/auth.setup.ts --project=setup` → **1 passed** (22.8s) — real magic-code round trip through the restyled Card/Input/Label/Button markup
- Task 2 verify: `cd web && bunx playwright test e2e/login-flow.spec.ts --project=anon` → **2 passed** (14.9s) — real in-flight loading state + real wrong-code rejection rendered via `Alert[variant=destructive]`
- Task 3 verify: `cd web && bunx playwright test e2e/shell-nav.spec.ts --project=authed` → **4 passed** (24.9s, includes the `setup` project's own auth run as a dependency) — 9/9 nav entries render their `EntityScreen`, exactly-one-active-indicator held at every step, Logout ends the session
- Plan-level full regression: `cd web && bun run test:e2e` → **31 passed** (3.2m), all three Playwright projects (`setup` → `authed` → `anon`) green live against InstantDB, including every pre-existing entity/routine-job/no-leakage/design-system spec alongside this plan's two new specs
- `cd web && bun run check` → 0 errors, 1 pre-existing unrelated warning (`EntityScreen.svelte` state-referenced-locally, not touched by this plan)
- `cd web && bun run lint` → 0 errors (Biome clean across `shared`, `web/src`, `web/e2e`, `web/vite.config.ts`, `web/playwright.config.ts`)
- Every `data-testid` from `08-PATTERNS.md` (`login-screen`, `login-email`, `login-submit`, `login-code`, `login-error`, `login-resend`, `app-shell` [untouched, in `App.svelte`], `logout`, `nav-${etype}`, `routine-job-state`) resolved to the same semantics as before the restyle — confirmed by every passing test above, none of which needed a testid change.

## Next Phase Readiness

- Both authenticated-shell-adjacent screens are now shadcn-svelte-styled and fully proven live; Phase 9 (entity table restyle) can proceed without any further auth/shell rework.
- No blockers or concerns carried forward.

## Self-Check: PASSED

All created files confirmed present on disk (5 component groups, 2 restyled screens, 2 new spec files). All 3 task commit hashes (`8cbf148`, `5b90cd1`, `68b41da`) confirmed present in `git log --all`.

---
*Phase: 08-auth-shell-restyle*
*Completed: 2026-08-09*
