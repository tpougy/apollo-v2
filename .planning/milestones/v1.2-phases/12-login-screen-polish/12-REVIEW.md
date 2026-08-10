---
phase: 12-login-screen-polish
reviewed: 2026-08-10T13:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - web/src/lib/auth/LoginScreen.svelte
  - web/e2e/login-composition.spec.ts
  - web/playwright.config.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 12: Code Review Report (Re-Review)

**Reviewed:** 2026-08-10T13:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

This is a re-review after fixes for WR-01, WR-02, and WR-03 from the prior review round
(`.planning/phases/12-login-screen-polish/12-REVIEW.md`, git commits `82c18a1` and `7361fa2`). All
three prior findings were verified against the actual committed code and confirmed genuinely
resolved — not just claimed resolved:

- **WR-01 (duplicate "code sent" message) — CONFIRMED FIXED.** `git show 82c18a1` deletes the
  redundant `<p class="text-sm text-muted-foreground">Código enviado para {email}</p>` from the
  code-step branch. Direct read of the current file (`LoginScreen.svelte:104-136`) confirms the
  paragraph no longer exists; the code step now surfaces the "code sent to {email}" message exactly
  once, via `CardDescription` (line 79).

- **WR-02 (full-viewport centering broken by `App.svelte`'s sibling `<h1>`) — CONFIRMED FIXED for
  the originally reported defect.** The outer wrapper (`LoginScreen.svelte:71`) switched from
  `flex min-h-screen items-center justify-center p-4` to `fixed inset-0 flex items-center
  justify-center p-4`, taking the login screen out of document flow entirely so `App.svelte`'s
  `<h1>Apollo v2</h1>` can no longer push it down or add height to the document. The spec's
  centering assertions were also correctly strengthened (`login-composition.spec.ts:49-57`) to check
  `screenBox.y ≈ 0` and both axes' Card-center-to-viewport-center proximity, not just
  `height >= viewport.height` (the old, trivially-true check the prior review called out). I
  independently re-ran `bunx playwright test e2e/login-composition.spec.ts --project=anon` — **1
  passed, 0 failed** — and confirmed via a throwaway probe spec that at a normal desktop viewport
  (1280×800) `screenBox = {x:0,y:0}` and the Card is genuinely centered on both axes.
  **However, this fix introduces a new, verified regression on short viewports — see WR-04 below.**

- **WR-03 (avoidable live magic-code send in a pure-CSS spec) — CONFIRMED FIXED.** The spec now
  calls `page.route("**/runtime/auth/send_magic_code", ...)` (`login-composition.spec.ts:23-25`) to
  fulfill the send instantly with a mocked `200 {}` response, matching the exact endpoint path the
  real SDK calls (verified against `@instantdb/core/src/authAPI.ts:19`,
  `${apiURI}/runtime/auth/send_magic_code`). I confirmed empirically that this mock is not silently
  broken by the cross-origin nature of the real API host (`https://api.instantdb.com` vs the app's
  `http://localhost:5174` origin — a plausible CORS-rejection risk for `route.fulfill()` responses
  lacking CORS headers): the spec passes cleanly (`1 passed, 0 failed`), and `jsonFetch` in
  `@instantdb/core` resolves any `status === 200` body without schema validation, so the empty-object
  mock body is accepted without error. The removed `test.setTimeout(90_000)` is correctly no longer
  needed since the send is now synchronous-fast; no live network dependency remains in this spec.

One **new WARNING** was found, introduced by the WR-02 fix itself, plus three pre-existing/unchanged
Info items carried forward from the prior round (not re-litigated in detail; still not blocking).

## Warnings

### WR-04: `fixed inset-0` (the WR-02 fix) has no scroll escape hatch — content becomes unreachable and visually collides with `App.svelte`'s `<h1>` on short viewports

**File:** `web/src/lib/auth/LoginScreen.svelte:71` (`class="fixed inset-0 flex items-center
justify-center p-4"`)

**Issue:** Swapping `min-h-screen` (in-flow, grows the document, always scrollable) for
`fixed inset-0` (out-of-flow, always exactly viewport-sized) fixes the reported centering/scrollbar
defect, but trades away the previous overflow safety net. A `position: fixed` container with the
default `overflow: visible` cannot be scrolled into by the user at all — content that overflows its
bounds (above `y=0` or below `y=viewport.height`) is rendered off-canvas with **no scrollbar, no
scroll-into-view path, and no way for a real user to reveal it**, unlike the previous `min-h-screen`
version where the whole document would simply grow taller and the user could scroll the page.

I verified this empirically (throwaway Playwright probe, not committed):
- At viewport `400×220`, `getComputedStyle(loginScreen).backgroundColor` is `rgba(0, 0, 0, 0)`
  (fully transparent) and `App.svelte`'s `<h1>Apollo v2</h1>` remains `visible` and painted at
  `(0,0)–(400,24)`, directly underneath/overlapping the Card's top edge (which lands at `y≈2` on
  this viewport) — confirmed visually via screenshot: "Apollo v2" is clipped to "Ap" and visually
  fused into the top-left corner of the Card, reading as a rendering glitch rather than a deliberate
  composition.
- At viewport `400×140`, the Card's own bounding box top is `y = -38` (i.e. the `CardHeader`/title
  region is rendered **above** the visible viewport) and
  `{ scrollHeight: 140, clientHeight: 140, overflowY: 'visible' }` on the `login-screen` element
  confirms there is no scroll mechanism whatsoever to reach it — the title/header content is
  permanently invisible to the user at that viewport height, with zero recovery path.

This is a realistic scenario, not a contrived edge case: a mobile browser in landscape orientation
with the on-screen keyboard open — precisely the moment a user is actively typing their email or
magic code into this form — routinely reduces the visible viewport to well under 300px of height on
common devices. The previous `min-h-screen` layout degraded gracefully in that situation (page grows,
user scrolls); `fixed inset-0` degrades by permanently hiding part of the login form with no way to
recover it. `login-composition.spec.ts` only exercises the default desktop viewport
(`devices["Desktop Chrome"]`), so this regression is invisible to the current test suite.

**Fix:** Add a scroll escape hatch to the fixed container so overflow becomes reachable instead of
silently discarded, and give the container an opaque background so it fully occludes
`App.svelte`'s `<h1>` instead of letting it bleed through the transparent margins:

```svelte
<div
  data-testid="login-screen"
  class="fixed inset-0 flex items-center justify-center overflow-y-auto bg-background p-4"
>
```

Optionally strengthen `login-composition.spec.ts` with a second assertion at a short viewport (e.g.
`page.setViewportSize({ width: 400, height: 220 })`) checking that `CardHeader`'s bounding box has
`y >= 0`, so a future regression here is caught by the suite rather than requiring manual/visual
inspection.

## Info

### IN-01 (carried forward, unchanged): `data-testid="login-submit"` still exists twice, relying on `{#if}/{:else}` mutual exclusivity

**File:** `web/src/lib/auth/LoginScreen.svelte:97,119`

Pre-existing, not touched by the WR-01/02/03 fixes. Still safe today (mutually exclusive branches),
still worth a one-line comment before any future step-transition/cross-fade work. No action required
this round.

### IN-02 (carried forward, unchanged): shadcn's `CardTitle` renders a `<div>`, not a semantic heading

**File:** `web/src/lib/auth/LoginScreen.svelte:74`

Pre-existing shadcn-svelte convention, unaffected by this round's fixes. Deferred to Phase 17's
accessibility pass as previously noted.

### IN-03 (resolved as a side effect, noting for completeness): pixel-tolerance magic numbers now named

**File:** `web/e2e/login-composition.spec.ts:14-15`

The prior review's IN-03 asked for `CENTER_TOLERANCE_PX`/`GAP_PARITY_TOLERANCE_PX` named constants
with comments — the WR-02 fix commit incidentally introduced exactly this while strengthening the
centering assertions. No further action needed.

---

_Reviewed: 2026-08-10T13:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
