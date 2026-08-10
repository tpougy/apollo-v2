---
phase: 13-shell-chrome-header-nav-content-frame
verified: 2026-08-10T14:05:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 13: Shell Chrome — Header, Nav & Content Frame Verification Report

**Phase Goal:** `Shell.svelte` presents one coherent header/toolbar and nav, and owns the single content-frame wrapper every entity screen inherits.
**Verified:** 2026-08-10T14:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is not a re-statement of SUMMARY.md's claims. Every truth below was checked directly against
the committed code in `web/src/lib/Shell.svelte`, `web/src/App.svelte`, and
`web/src/lib/entities/EntityScreen.svelte`, and every Playwright suite the plan claims green was
**re-run live in this session** (real InstantDB app, real magic-code round trip via the Outlook COM
bridge) — not read from a prior transcript.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A signed-in user sees a single header/toolbar row (`shell-header`) presenting app identity and a user/logout action — not the previous stray unwrapped auth-status paragraph and floating logout Button (SHELL-01) | ✓ VERIFIED | `Shell.svelte:51-77` — a `<header data-testid="shell-header">` wraps `shell-app-name` (left) and the auth-status `<p>` + `logout` Button (right). Live test `shell-chrome.spec.ts › header/toolbar composition` re-run: PASS. `logout` element confirmed to be a real `<button>` via `tagName` evaluate. |
| 2 | The authenticated DOM contains exactly one visible 'Apollo v2' app-identity text — App.svelte's root `<h1>` renders only in the signed-out path, never alongside `shell-header` once signed in (SHELL-01) | ✓ VERIFIED | `App.svelte:11-14` — `<h1>Apollo v2</h1>` is now the first child inside `<SignedOut {db}>`, ahead of `<LoginScreen />`; it is absent from the `<SignedIn>` block (`App.svelte:16-20`). Live test `shell-chrome.spec.ts › single app-identity element when authenticated — no duplicate root h1` re-run: PASS (`getByText("Apollo v2", {exact:true})` count=1, `locator("h1", {hasText:"Apollo v2"})` count=0). This is the direct regression guard for the exact defect plan-checker flagged earlier, and it is confirmed resolved in the committed code, not just claimed. |
| 3 | Exactly one nav active-state indicator is visible at a time across all 9 entities, and all 9 nav items sit in a single flat wrapping row with no scroll container and no Tabs component (SHELL-02) | ✓ VERIFIED | `Shell.svelte:85` — `<nav class="flex flex-wrap gap-2">`, unchanged `variant={ativo === cfg.etype ? "secondary" : "ghost"}` / `aria-current` bindings. Live re-run of `shell-nav.spec.ts › exactly one nav Button shows the active-state indicator at a time`: PASS. Live re-run of `shell-chrome.spec.ts › nav overflow strategy`: PASS (`flex-wrap: wrap`, `overflow-x` not `scroll`/`auto`, `[role="tablist"]` count 0). 9 nav buttons confirmed live in test-run console output (Fundos, Projetos, Etapas, Tarefas, Templates de rotina, Instâncias de rotina, Tickets, Subtarefas, Log de inferências). |
| 4 | Every one of the 9 entity screens renders inside the same single content-frame wrapper (`shell-content-frame`) — none re-declares its own outer page-frame spacing (SHELL-03) | ✓ VERIFIED | `Shell.svelte:80-83` — single `<div data-testid="shell-content-frame" class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">` wraps both `<nav>` and the `{#key ativo}` EntityScreen mount point. Read `EntityScreen.svelte` directly: its root is a bare `<section>` with no width/padding classes of its own — confirms it inherits the frame, does not re-declare one. Live re-run of `shell-chrome.spec.ts › single content-frame consistency across entities`: PASS — bounding box (x/y/width) and computed `max-width` identical before/after clicking nav index 0, 4, and 8 of the 9 entities. |
| 5 | Clicking through all 9 nav items still mounts the correct EntityScreen every time, and Logout still ends the session and returns to the login screen — pre-existing `shell-nav.spec.ts` passes unmodified against restructured markup (ROADMAP SC4) | ✓ VERIFIED | Live re-run of full `shell-nav.spec.ts` (3 tests): PASS, unmodified file (`git diff` shows this file untouched by the phase). Live full-suite re-run (`bun run test:e2e`, all 3 projects): 44/44 passed, 0 failed, 0 skipped, including the live magic-code `setup` round trip and `design-system.spec.ts`'s signed-out h1 assertions. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/lib/Shell.svelte` | `shell-header` toolbar + `Separator` + `shell-content-frame` wrapper, `flex flex-wrap` nav | ✓ VERIFIED | All testids/classes present exactly once (grep-confirmed), wired to live-passing tests |
| `web/src/App.svelte` | Root `<h1>` relocated inside `<SignedOut>`, not duplicated/deleted | ✓ VERIFIED | Single `<h1>` (grep count 1), present in `<SignedOut>` block, absent from `<SignedIn>` block |
| `web/e2e/shell-chrome.spec.ts` | 4 live tests proving header, content-frame consistency, nav strategy, single app-identity | ✓ VERIFIED | File exists, 4 tests present, all 4 pass live against the real app |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `shell-content-frame` | `<nav>` + `{#key ativo}` EntityScreen mount | Both are children of the same wrapper `<div>` | ✓ WIRED | Confirmed by direct code read (`Shell.svelte:80-105`) and by live bounding-box-identity test across 3 of the 9 entities |
| Nav Buttons | `shell-nav.spec.ts`'s `aria-current`/background-color assertions | `variant`/`aria-current` bindings untouched | ✓ WIRED | `shell-nav.spec.ts` re-run unmodified against restructured markup — 3/3 pass |
| `Separator` | Visual divider between `shell-header` and `shell-content-frame` | Plain sibling `<Separator />` after `</header>` | ✓ WIRED | `[data-slot="separator"]` count 1, y-position between header and content-frame confirmed live |
| App.svelte `<h1>` | `<SignedOut>` conditional | Moved inside existing block | ✓ WIRED | Confirmed by code read + live test (0 `<h1>` in authenticated DOM, 1 in signed-out `design-system.spec.ts` path) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SHELL-01 | 13-01 | Header/toolbar row replacing stray h1 + floating logout | ✓ SATISFIED | Truths 1 & 2 above; live tests pass |
| SHELL-02 | 13-01 | Single active-state + flat-wrapping-row nav strategy | ✓ SATISFIED | Truth 3 above; live tests pass |
| SHELL-03 | 13-01 | Exactly one content-frame wrapper inherited by all 9 entities | ✓ SATISFIED | Truth 4 above; live test + code read of `EntityScreen.svelte` |

No orphaned requirements — REQUIREMENTS.md maps only SHELL-01/02/03 to Phase 13, and all three are claimed by the plan and verified above.

### Anti-Patterns Found

Scanned `web/src/lib/Shell.svelte`, `web/src/App.svelte`, `web/e2e/shell-chrome.spec.ts` for
TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers, empty implementations, and hardcoded stub returns.

**None found.** No debt markers, no stub patterns, no console.log-only handlers. The `logout`
onclick handler retains its real `db.auth.signOut()` call; the nav `onclick` retains its real state
mutation.

### Behavioral Spot-Checks / Live Playwright Re-Runs (this session)

All commands below were executed fresh in this verification session, not read from SUMMARY.md's transcript.

| Suite | Command | Result | Status |
|-------|---------|--------|--------|
| Auth setup (live magic-code round trip) | `bunx playwright test --project=setup` | 1 passed | ✓ PASS |
| Shell nav regression (unmodified file) | `bunx playwright test e2e/shell-nav.spec.ts --project=authed` | 4 passed (incl. setup) | ✓ PASS |
| New shell-chrome coverage | `bunx playwright test e2e/shell-chrome.spec.ts --project=authed` | 5 passed (incl. setup) | ✓ PASS |
| Signed-out h1 assertions | `bunx playwright test e2e/design-system.spec.ts --project=anon` | 4 passed | ✓ PASS |
| Type/svelte-check | `bun run check` | 0 errors, 1 pre-existing unrelated warning (`EntityScreen.svelte` state-referenced-locally) | ✓ PASS |
| Full suite, all 3 projects | `bun run test:e2e` | 44 passed, 0 failed, 0 skipped | ✓ PASS |
| Grep hygiene (plan's own acceptance criteria) | `grep -c` on testids, `<h1>` counts, `SignedOut`/`SignedIn` block contents | All exact matches (1, 1, 1, 1, 1, 1, 1, 0) | ✓ PASS |

### Duplicate-Title Fix — Specific Confirmation

The plan's `<objective>` documents this as a defect caught by plan-checker in an earlier revision
(commit `a6399e0`, "fix(13): revise plan to suppress App.svelte root h1 in signed-in view,
preventing duplicate app-identity text"). Confirmed resolved in the **committed, current** code:

- `App.svelte:11-14`: `<h1>Apollo v2</h1>` is textually inside `<SignedOut {db}>`, immediately before `<LoginScreen />`.
- `App.svelte:16-20`: The `<SignedIn {db}>` block contains only `<div data-testid="app-shell"><Shell /></div>` — no `<h1>`, no "Apollo v2" text of its own (Shell's own `shell-app-name` span provides it).
- Live-run proof, not just static grep: `shell-chrome.spec.ts`'s "single app-identity element when authenticated" test navigates to `/` while authenticated and asserts exactly one "Apollo v2" text node and zero `<h1>` containing "Apollo v2" — this test was re-executed in this session against the live app and passed.
- The signed-out path is unaffected: `design-system.spec.ts`'s Tailwind-preflight h1 computed-style test, which only ever runs under the `anon` (signed-out) project, was also re-executed and passed unchanged.

This is a real, structural fix (the element was relocated, not hidden with CSS or conditionally
suppressed by a flag that could regress) — verified against the actual DOM composition, not the
SUMMARY's narrative.

## Deferred Items

None. All 3 requirements (SHELL-01/02/03) are fully in scope for and satisfied by this phase; no
gap was pushed to a later phase.

## Human Verification Required

None. Every observable truth for this phase (header/toolbar composition, nav active-state/overflow
strategy, content-frame consistency, no-duplicate-title, full nav+logout regression) is
Playwright-provable and was proven live in this session, consistent with PROJECT.md C-12 (zero
human UAT this milestone).

## Gaps Summary

No gaps. All 5 derived truths (mapped 1:1 to ROADMAP Phase 13's 4 success criteria and PLAN's 5
must-have truths) verified against the current committed code and a fresh, live Playwright run —
not against SUMMARY.md's claims. The phase goal ("`Shell.svelte` presents one coherent
header/toolbar and nav, and owns the single content-frame wrapper every entity screen inherits") is
achieved. Phase 13 is ready to close; Phase 14 may proceed.

---

*Verified: 2026-08-10T14:05:00Z*
*Verifier: Claude (gsd-verifier)*
