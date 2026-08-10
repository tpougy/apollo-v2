---
phase: 13-shell-chrome-header-nav-content-frame
reviewed: 2026-08-10T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - web/src/lib/Shell.svelte
  - web/src/App.svelte
  - web/e2e/shell-chrome.spec.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-08-10
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

This is a re-review after two targeted fix commits addressing the prior round's WR-01 and WR-02
findings. Both are confirmed genuinely resolved, with no new defects introduced by either fix.

**WR-01 (skipped heading level) — RESOLVED.** Commit `51db9d5` changes `Shell.svelte:55`'s
`shell-app-name` element from `<span>` to `<h1>` (classes unchanged, so no visual regression). The
authenticated document outline is now `h1` (`Shell.svelte:55`, "Apollo v2") → `h2`
(`EntityScreen.svelte:383`, `{config.titulo}`) — a valid, unbroken heading chain, verified directly by
reading `EntityScreen.svelte:383` (still `<h2>`, untouched by this fix). No skipped level remains.
`shell-chrome.spec.ts`'s test 4 was updated in the same commit to assert `h1[hasText="Apollo v2"]`
count is exactly `1` (previously asserted `0`), correctly flipping the assertion to prove the fix
rather than merely tolerating it.

Checked specifically for the "two `<h1>` at once" risk called out in this task: `App.svelte` still
renders its own unconditional-looking `<h1>Apollo v2</h1>` at line 12, but it's scoped inside
`<SignedOut>` (line 11), which is mutually exclusive with `<SignedIn>` (line 16, wrapping `Shell`).
Verified this exclusivity holds at the library level, not just by convention: read
`node_modules/@instantdb/svelte/dist/SignedIn.svelte` and `SignedOut.svelte` directly — their guard
conditions are `!auth.isLoading && !auth.error && auth.user` and
`!auth.isLoading && !auth.error && !auth.user` respectively, derived from the same `auth` state and
logically disjoint. Both render nothing during the shared `auth.isLoading` window, so the two `<h1>`s
can never coexist in the DOM (worst case is a transient zero-`<h1>` state while auth resolves, which
is pre-existing app-boot behavior, not something this phase's diff touches or regresses). Also
confirmed `design-system.spec.ts`'s own `<h1>` assertions (`fontSize`/`fontWeight` check against
Tailwind preflight) run under the `anon` Playwright project per its own file-header comment and
`playwright.config.ts`'s `testMatch: /auth\.setup\.ts/` / `dependencies` wiring — i.e. against the
signed-out `App.svelte` heading only, never against `Shell.svelte`'s new `<h1>`, so there is no
cross-file `<h1>` locator collision between the two specs.

**WR-02 (no `<main>` landmark) — RESOLVED.** Commit `431d58e` changes the `shell-content-frame`
wrapper from `<div>` to `<main>` (`Shell.svelte:80`, `data-testid` and classes unchanged). Verified via
`grep -rn "<main\|<nav\|<header"` across `web/src/` that the shell now has exactly one `<header>`
(banner), one top-level `<nav>`, and one `<main>` — a clean, non-duplicated landmark set. The `<nav>`
sits inside `<main>` rather than as a sibling; this is a legitimate landmark-nesting pattern (a
`navigation` landmark nested in a `main` landmark is valid per the ARIA landmark spec, and here the
nav is in-page entity-switching, not global site navigation, so nesting it under the primary content
region is defensible) — not a new defect. `data-testid="shell-content-frame"` locator in
`shell-chrome.spec.ts` (tests 1 and 2, using `getByTestId`) is tag-agnostic and unaffected by the
`div`→`main` change, confirmed by re-reading the test file: no test asserts the element's tag name.

Both fixes are minimal (2 and 4 line diffs respectively), match the prior review's suggested fix
snippets almost verbatim, and touch nothing outside the two flagged lines. No new Critical or Warning
issues were introduced by either change.

The three Info-level items from the prior round are unaffected by these fixes (neither commit touches
their referenced lines) and are carried forward unchanged below for completeness; they remain
non-blocking.

## Info

### IN-01: `Separator` renders with default (likely decorative) semantics — not verified against actual accessibility intent

**File:** `web/src/lib/Shell.svelte:78`
**Issue:** `<Separator />` is used with no `orientation`/`decorative` props. This is purely
presentational chrome (a horizontal rule between header and content), which is the correct semantic
use, but was never explicitly confirmed/documented. Low-risk, unchanged by this round's fixes.
**Fix:** No action required; optionally add a comment confirming `decorative` default behavior if a
future accessibility pass audits landmark/separator roles explicitly.

### IN-02: `shell-header`'s right-side wrapper mixes transient (`auth.isLoading`) and always-present (`logout` Button) elements without a loading placeholder

**File:** `web/src/lib/Shell.svelte:56-76`
**Issue:** While `auth.isLoading` is true, the auth-status `<p>` doesn't render and the header briefly
shows only the `Sair` button. Pre-existing behavior, unchanged by this round's fixes, out of scope for
WR-01/WR-02.
**Fix:** No action required this phase; consider a fixed-width skeleton/placeholder in a later polish
phase if the visual jump is noticeable.

### IN-03: `web/e2e/shell-chrome.spec.ts` Test 2 clicks the already-active nav button (index 0) as its first assertion point

**File:** `web/e2e/shell-chrome.spec.ts:64-76`
**Issue:** `ativo` defaults to `entityConfigs[0].etype` on mount, so `indexesToCheck[0] === 0`
re-clicks the entity that's already active. Not wrong, but adds no coverage beyond the initial
reading; real cross-entity proof comes from the middle/last indices. Unchanged by this round's fixes.
**Fix:** Optional readability improvement:
```ts
const indexesToCheck = [1, Math.floor(count / 2), count - 1];
```
(or add a comment noting index 0 is intentionally a same-entity re-click sanity check).

---

_Reviewed: 2026-08-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
