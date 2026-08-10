---
phase: 14-entity-screen-header-loading-empty-states
plan: 02
subsystem: testing
tags: [playwright, e2e, svelte, entity-screen, skeleton, empty-state, cdp-network-throttle]

# Dependency graph
requires:
  - phase: 14-01
    provides: "EntityScreen.svelte's entity-header/entity-description/entity-create-start/entity-loading/entity-table-frame/empty-state/empty-state-create structure this plan's spec asserts against"
provides:
  - "web/e2e/entities-header-states.spec.ts — 6 dedicated live Playwright tests proving ENTTBL-04/05/06/07"
  - "Established pattern: clearing InstantDB's persisted querySubs/syncSubs IndexedDB stores (while keeping the kv store's auth session) in a manually-built browser context, so a CDP network throttle can genuinely surface query.isLoading instead of resolving instantly from a restored cache"
  - "Full 50-test Playwright suite (44 pre-existing + 6 new) green, svelte-check/tsc clean, Biome clean, zero raw color literal in any file this phase touched"
affects: [15-entity-screen-form-dialog, 16-row-actions-delete-confirmation, 17-cross-cutting-polish]

# Actuals (#2632)
actuals:
  tokens: 3900
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CDP Network.emulateNetworkConditions loading-state proof: build a fresh browser context from the authed storageState with querySubs/syncSubs IndexedDB records cleared (keeping the kv store's auth session intact), so query.isLoading is forced to resolve over a real (throttled) network round trip instead of an instantly-served local cache"
    - "page.goto({ waitUntil: 'commit' }) instead of the default 'load' wait when CDP latency throttling is active against a Vite dev server — 'load' can chain across Vite's unbundled ESM per-module fetch graph and blow past any reasonable navigation timeout even at modest latency"

key-files:
  created:
    - web/e2e/entities-header-states.spec.ts
  modified:
    - web/src/lib/components/ui/empty/empty-content.svelte
    - web/src/lib/components/ui/empty/empty-description.svelte
    - web/src/lib/components/ui/empty/empty-header.svelte
    - web/src/lib/components/ui/empty/empty-media.svelte
    - web/src/lib/components/ui/empty/empty-title.svelte
    - web/src/lib/components/ui/empty/empty.svelte
    - web/src/lib/components/ui/empty/index.ts
    - web/src/lib/components/ui/skeleton/index.ts
    - web/src/lib/components/ui/skeleton/skeleton.svelte
    - web/src/lib/entities/defs/instanciasRotina.ts
    - web/src/lib/entities/defs/logInferenciaClaude.ts

key-decisions:
  - "Test 1's dual-color-scheme assertion is a single test with an internal for-loop over light/dark (re-navigating and re-asserting each iteration), per the plan's explicit instruction to avoid two near-duplicate test blocks — counted as 1 of the plan's 6 tests."
  - "Test 5 (loading state) cannot use the default authed-project page/context fixtures: the persisted storageState restores InstantDB's IndexedDB-backed querySubs/syncSubs caches, which resolve query.isLoading from cache almost instantly regardless of any CDP network throttle. Built a dedicated browser context per-test instead, cloning the storageState with only querySubs/syncSubs records cleared (kv store — which holds the auth session — left intact), so the query has no choice but to genuinely round-trip over the throttled network."
  - "Used latency-only CDP throttling (500ms, no bandwidth cap) rather than also capping downloadThroughput: empirically, capping bandwidth alongside latency caused the Vite dev server's deep unbundled ESM import graph to take 80+ seconds to even mount the app, blowing past any reasonable test timeout for a concern (module loading) unrelated to what this test is proving (InstantDB query resolution timing)."
  - "page.goto for Test 5 waits only for 'commit' (navigation start), not the default 'load' event, for the same reason above — checked empirically that the app mounts and matters (entity-loading becomes visible ~14s after commit under this throttle) well before 'load' would ever fire."

patterns-established:
  - "Fresh-context-with-cleared-query-cache technique for reliably observing InstantDB's transient loading branch in Playwright, reusable by any future spec needing to prove a genuine (not cache-served) first-load loading state against the live app."

requirements-completed: [ENTTBL-04, ENTTBL-05, ENTTBL-06, ENTTBL-07]

coverage:
  - id: D1
    description: "Dedicated Playwright coverage proves ENTTBL-04 (page-header title+description+capability-gated create action) for one entity per capability class (fundos full-CRUD, instanciasRotina restricted, logInferenciaClaude read-only), plus a dual-color-scheme check on fundos"
    requirement: "ENTTBL-04"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-header-states.spec.ts: 'ENTTBL-04: fundos (full-CRUD) page-header structure, light + dark'"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-header-states.spec.ts: 'ENTTBL-04: instanciasRotina (restricted) header renders, create action capability-gated off'"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-header-states.spec.ts: 'ENTTBL-04: logInferenciaClaude (read-only) header renders, create action capability-gated off'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dedicated coverage proves ENTTBL-05: entity-loading Skeleton grid is genuinely observable before the live query resolves (CDP-throttled first load, no pre-populated query cache), and the old plain-text loading indicator never appears"
    requirement: "ENTTBL-05"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-header-states.spec.ts: 'ENTTBL-05: fundos loading state shows the Skeleton grid, never the old plain-text indicator'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dedicated coverage proves ENTTBL-06: Empty composition is a true sibling of <Table> (zero <table> element while shown), and its CTA opens/cancels the same create Dialog entity-create-start opens, with zero writes"
    requirement: "ENTTBL-06"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-header-states.spec.ts: 'ENTTBL-06: fundos empty state is a sibling of <Table>, CTA reuses the create Dialog'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dedicated coverage proves ENTTBL-07: every one of the 9 entities' content (table or empty state) renders inside the bounded entity-table-frame Card"
    requirement: "ENTTBL-07"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-header-states.spec.ts: 'ENTTBL-07: every one of the 9 entities' content renders inside entity-table-frame'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full pre-existing-plus-new Playwright suite (50 tests: 44 pre-existing + 6 new) passes with zero failures/skips; svelte-check/tsc and Biome remain clean; zero raw color literal or duplicate load-bearing testid in any touched file"
    verification:
      - kind: e2e
        ref: "cd web && bun run test:e2e — 50 passed, 0 failed, 0 skipped"
        status: pass
      - kind: unit
        ref: "cd web && bun run check — 0 errors; cd web && bun run lint — 0 errors, exit 0"
        status: pass
      - kind: unit
        ref: "grep -nE 'oklch\\(|#[0-9a-fA-F]{3,8}\\b|rgba?\\(' across EntityScreen.svelte/defs/*.ts/types.ts/entities-header-states.spec.ts — zero matches"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-08-10
status: complete
---

# Phase 14 Plan 02: Entity Screen Header, Loading & Empty States — Dedicated Verification Summary

**Added `entities-header-states.spec.ts` (6 live tests) proving ENTTBL-04/05/06/07 explicitly against Plan 14-01's restructured `EntityScreen.svelte` — including a genuinely CDP-throttled Skeleton-loading observation that required clearing InstantDB's persisted query cache to defeat storageState's instant-resolve-from-cache behavior — then closed the phase out with a clean 50-test full-suite regression, clean `svelte-check`/Biome, and a fix for two Biome violations Plan 14-01 had left behind.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-10T14:58:00Z (approx.)
- **Completed:** 2026-08-10T15:19:19Z
- **Tasks:** 2 completed
- **Files modified:** 12 (1 new, 11 modified)

## Accomplishments
- Created `web/e2e/entities-header-states.spec.ts` with 6 tests: dual-color-scheme page-header structure on fundos (full-CRUD), header/no-create-action checks on instanciasRotina (restricted) and logInferenciaClaude (read-only), the Empty-composition sibling-of-`<Table>`-plus-CTA behavior on fundos' empty baseline, a CDP-throttled genuine Skeleton-loading observation, and an all-9-entities Card-bounding sweep.
- Discovered and worked around a real proof-mechanism gap: the `authed` project's persisted `storageState` restores InstantDB's IndexedDB-backed query-result cache (`querySubs`/`syncSubs`), which resolves `query.isLoading` from cache almost instantly regardless of network throttle. Built a dedicated browser context per-test with only those two stores cleared (the `kv` store, holding the auth session, kept intact) so the Skeleton test's first query genuinely blocks on the throttled network — the mechanism this plan's own `key_links` metadata anticipated needing but had underspecified for the `authed` project's actual caching behavior.
- Ran the complete pre-existing-plus-new Playwright suite (`bun run test:e2e`): 50 passed, 0 failed, 0 skipped — meeting the plan's ≥50 target exactly (44 pre-existing + 6 new, no `setup`-project double-count this time since the target already accounted for it).
- Fixed 2 Biome violations (import-order in 9 vendored Skeleton/Empty component files, plus line-width wrapping in 2 entity def files) that Plan 14-01 had left behind — required for Task 2's `bun run lint` acceptance gate to exit 0; zero behavior change, confirmed via re-running the full suite after the fix.
- Confirmed zero raw color literal in any file this phase's two plans touched, and confirmed `entity-create-start`/`empty-state` each resolve to exactly one source occurrence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Dedicated Playwright coverage for ENTTBL-04/05/06/07** - `b895ac1` (feat)
2. **Task 2 (deviation): Fix Biome violations blocking the lint acceptance gate** - `1262665` (style) — Task 2 itself required no new files/commits per its own `<files>` spec, but its `bun run lint` acceptance criterion surfaced a pre-existing blocking issue (Rule 3) that had to be fixed before the task could be considered done.

**Plan metadata:** committed separately per `<final_commit>` step below.

## Files Created/Modified
- `web/e2e/entities-header-states.spec.ts` (new) - 6 live tests: page-header dual-color-scheme (fundos), header/no-create-action (instanciasRotina, logInferenciaClaude), Empty-as-Table-sibling + CTA (fundos empty baseline), CDP-throttled Skeleton loading observation, all-9-entities Card-bounding sweep
- `web/src/lib/components/ui/empty/*.svelte`, `web/src/lib/components/ui/empty/index.ts`, `web/src/lib/components/ui/skeleton/index.ts`, `web/src/lib/components/ui/skeleton/skeleton.svelte` - Biome import-order/formatting fixes only (no behavior change)
- `web/src/lib/entities/defs/instanciasRotina.ts`, `web/src/lib/entities/defs/logInferenciaClaude.ts` - Biome line-width re-wrap of the `descricao` string literal only (no behavior change)

## Decisions Made
- Test 1 (dual-color-scheme) is a single test with an internal loop over `light`/`dark`, per the plan's explicit instruction, rather than two near-duplicate test blocks — counted as 1 of the 6 tests, matching the plan's own count.
- Built a dedicated, manually-constructed browser context for the Skeleton-loading test (Test 5) instead of using the `authed` project's default `page`/`context` fixtures, because the project's persisted `storageState` bakes in InstantDB's own query-result cache. Cloned the storageState JSON, cleared only the `querySubs`/`syncSubs` IndexedDB store records (kept `kv`, which holds the session), and used that as the new context's `storageState` — the first query then has to round-trip over the network for real.
- Used CDP latency-only throttling (500ms, unlimited bandwidth) rather than also capping throughput, and `waitUntil: "commit"` instead of the default `"load"` for the throttled `page.goto` call — both decisions made after empirically observing that bandwidth-capping (or waiting for `"load"`) under throttle caused Vite dev's unbundled ESM import graph to take 80+ seconds to mount, an unrelated failure mode this test isn't meant to probe.

## Deviations from Plan

**1. [Rule 3 - Blocking issue] Fixed 2 pre-existing Biome violations left by Plan 14-01, blocking Task 2's `bun run lint` acceptance gate**
- **Found during:** Task 2, running the quality-gate step (`bun run lint`)
- **Issue:** Plan 14-01's vendored `Skeleton`/`Empty` shadcn-svelte primitives had import-order violations (Biome's `organizeImports` assist), and two entity defs' `descricao` string literals exceeded Biome's configured line width. `bun run lint` exited 1, failing Task 2's own explicit acceptance criterion.
- **Fix:** Ran `bun run lint:fix` (safe, auto-applied fixes only — import reordering and line re-wrap; zero exported-binding or logic change), confirmed via `git diff` that every change was formatting-only, then re-ran the full 50-test Playwright suite to confirm zero regression.
- **Files modified:** `web/src/lib/components/ui/empty/*.svelte`, `web/src/lib/components/ui/empty/index.ts`, `web/src/lib/components/ui/skeleton/index.ts`, `web/src/lib/components/ui/skeleton/skeleton.svelte`, `web/src/lib/entities/defs/instanciasRotina.ts`, `web/src/lib/entities/defs/logInferenciaClaude.ts`
- **Commit:** `1262665`

**2. [Not a deviation, a plan-mechanism refinement] The Skeleton test's throttle mechanism needed a fresh-*query-cache* context, not merely a fresh *browser* context**
- The plan's own `key_links` metadata anticipated "a fresh Playwright browser context has no pre-populated InstantDB IndexedDB cache" as the reason the throttle would work. In practice, the `authed` project's `page`/`context` fixtures restore a `storageState` that itself contains a populated IndexedDB query cache (`querySubs`/`syncSubs`), so a "fresh context" in the fixture sense is not fresh with respect to InstantDB's cache. Resolved by manually building a context from a storageState clone with only those two stores cleared — documented above as the `key-decisions`/`patterns-established` for this plan, not logged as a Rule 1-4 deviation since it's a test-infrastructure discovery within Task 1's own scope, not a bug in shipped application code.

Two auto-fix attempts were needed to land Test 5 correctly (an initial 3000ms latency + bandwidth cap chained the Vite dev ESM graph past 45-90s test timeouts twice before landing on the latency-only + `waitUntil: "commit"` + cache-cleared-context combination) — within the 3-attempt fix-attempt limit.

## Issues Encountered

None beyond the two items documented above.

## User Setup Required

None - no external service configuration required. (The magic-code auth round trip used during verification reads the pre-existing, already-authorized `tp@rbrasset.com.br` inbox per PROJECT.md C-10 — no new setup.)

## Next Phase Readiness

- Phase 14 (ENTTBL-04/05/06/07) is fully complete and independently verified: `EntityScreen.svelte`'s header/loading/empty/Card structure is proven live across all 9 entities and all 3 capability classes, with zero regression to the full 50-test Playwright suite.
- Phase 15 (Entity Screen — Form & Dialog) can build directly on top of this screen's markup: the `Dialog.Root` mount point, `entity-create-start`/`empty-state-create` CTAs, and `entity-table-frame` structure are stable and unlikely to require further restructuring for form/dialog spacing work.
- The fresh-context-with-cleared-query-cache Playwright pattern established here (see `patterns-established`) is reusable by any future phase needing to prove a genuine (not cache-served) InstantDB loading state.
- No blockers or concerns carried forward.

---
*Phase: 14-entity-screen-header-loading-empty-states*
*Completed: 2026-08-10*

## Self-Check: PASSED

All created/modified files and both task commit hashes were verified present on disk / in git history (see Self-Check section below for details).
