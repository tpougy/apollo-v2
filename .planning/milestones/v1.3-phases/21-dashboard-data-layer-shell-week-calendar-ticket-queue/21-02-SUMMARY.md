---
phase: 21-dashboard-data-layer-shell-week-calendar-ticket-queue
plan: 02
subsystem: ui
tags: [svelte5, instantdb, playwright, dashboard, e2e]

# Dependency graph
requires:
  - phase: 21-01
    provides: "web/src/lib/dashboard/derive.ts (canonical, pure derivation module) — not consumed by this plan's code, but the two plans landed concurrently in the same phase"
provides:
  - "dashboardQuery.ts: the ONE db.useQuery for the whole Dashboard feature (DASH-07), 5-key shape including the instanciasRotina.template.fundo two-hop path"
  - "Dashboard.svelte: real 3-col/1-col responsive grid shell with 4 stable slot testids, ready for Plan 21-03 to swap the week slot's inner content"
  - "TicketQueue.svelte: fully real ticket queue (DASH-02) — hard-first-then-date ordering, Empty.Root empty state, working 'ver todos' navigation to the real Tickets section"
  - "web/e2e/dashboard.spec.ts: 5 live Playwright tests covering ordering/nav, empty state, responsive grid order, and a live admin-API proof of the two-hop query path"
affects: [21-03, 22]

# Actuals (#2632)
actuals:
  tokens: 6211
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dashboardQuery.ts exports a zero-runtime-import DASHBOARD_QUERY constant plus a useDashboardQuery(db) function that takes the live db instance as a parameter instead of importing it — keeps the query shape importable standalone by Playwright's Node test process without pulling in @instantdb/svelte's .svelte component graph"
    - "Cast-at-the-InstaQL-boundary idiom applied to the db parameter itself (not just the query object), extending the existing EntityScreen.svelte/ProjetosSection.svelte precedent"
    - "goToTickets() drives Shell.svelte's own already-rendered nav-tickets Button via document.querySelector(...).click() — zero Shell.svelte changes, same idiom as ProjetosSection.svelte's hidden-host dialog openers"

key-files:
  created:
    - web/src/lib/dashboard/dashboardQuery.ts
    - web/src/lib/dashboard/TicketQueue.svelte
    - web/e2e/dashboard.spec.ts
  modified:
    - web/src/lib/dashboard/Dashboard.svelte
    - web/e2e/fixtures/instancia-admin-fixture.ts

key-decisions:
  - "dashboardQuery.ts restructured to take db as a parameter (not import it) — the only way to keep DASHBOARD_QUERY importable by the e2e Node process; documented in full below as a Rule 3 auto-fix."
  - "InstantDB admin API returns has:\"one\" links (template, fundo) as single-element arrays, not bare objects — dashboard.spec.ts's DASH-07 proof test normalizes this the same way routineJob.ts:622 already does for its own admin-queried instanciasRotina.template read."
  - "TicketQueue's card button intentionally wires no onclick (Phase 23 owns opening its dialog) — a native <button> already gives focus/keyboard reachability, per CONTEXT.md's explicit scope note."

patterns-established:
  - "Grid slot wrapper testids (dash-week-slot, dash-tickets-slot, dash-placeholder-rotinas, dash-placeholder-projetos) are the stable contract Plan 21-03/Phase 22 build against — never rename, only swap inner content."

requirements-completed: [DASH-07, DASH-01, DASH-02]

coverage:
  - id: D1
    description: "dashboardQuery.ts issues exactly one db.useQuery for the whole Dashboard feature, with the exact 5-key shape from spec-ui.md §5.1 (including instanciasRotina.template.fundo), and is the ONLY db.useQuery call site — TicketQueue/WeekCalendar receive rows as props"
    requirement: "DASH-07"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-07: live instanciasRotina.template.fundo two-hop proof"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dashboard.svelte renders the real 3-column (lg:) / 1-column (below lg) grid shell, with 4 stable slot testids in the spec-mandated stacking order (semana, tickets, rotinas, projetos)"
    requirement: "DASH-01"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-01: responsive grid order (desktop viewport)"
        status: pass
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-01: responsive grid order (mobile viewport)"
        status: pass
    human_judgment: false
  - id: D3
    description: "TicketQueue.svelte lists every pending ticket (no completion filter, per REQUIREMENTS.md §5.3), ordered hard-then-date, with a real Empty.Root empty state and a working 'ver todos' navigation to the real Tickets section"
    requirement: "DASH-02"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-01/DASH-02/DASH-07: ticket ordering and navigation"
        status: pass
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-02: empty ticket queue"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-11
status: complete
---

# Phase 21 Plan 02: Dashboard Data Layer, Grid Shell & Ticket Queue Summary

**Real 3-col/1-col Dashboard grid shell backed by dashboardQuery.ts's single 5-key db.useQuery — proven live against InstantDB, including the instanciasRotina.template.fundo two-hop path via the admin API, plus a fully real TicketQueue.svelte with hard-first ordering and working "ver todos" navigation.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-11T21:40:00-03:00 (approx.)
- **Completed:** 2026-08-11T21:59:17-03:00
- **Tasks:** 2 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `dashboardQuery.ts` ships the exact spec-ui.md §5.1 5-key query shape (`projetos`, `tarefas`, `instanciasRotina.template.fundo`, `tickets`, `fundos`) as the Dashboard feature's sole `db.useQuery` call site.
- `Dashboard.svelte` rewritten from its 3-line placeholder into the real responsive grid: `grid-cols-1` below `lg:`, `grid-cols-[13rem_minmax(0,1fr)_16rem]` at `lg:`, 4 slots with stable testids in the spec-mandated mobile stacking order (semana, tickets, rotinas, projetos).
- `TicketQueue.svelte` is fully real: lists every ticket (no completion filter, per REQUIREMENTS.md §5.3), sorted hard-then-date-then-id, `Empty.Root` empty state, and a "ver todos" button that drives `Shell.svelte`'s own unmodified `nav-tickets` Button via `.click()`.
- `web/e2e/dashboard.spec.ts` — 5 passing Playwright tests: hard-first ordering + navigation, empty state, desktop 3-column grid track widths, mobile 1-column stacking order, and a live admin-API proof that `instanciasRotina.template.fundo` resolves through the exact `DASHBOARD_QUERY` object the app ships.
- `instancia-admin-fixture.ts` extended additively: `seedInstance` gained an optional `templateId` parameter (chains `.link({ template })`), and a new generic `adminQuery<T>` escape hatch was added — both backward-compatible, verified against `entities-rotina-log.spec.ts`'s existing 2-arg call sites (still green).

## Task Commits

Each task was committed atomically:

1. **Task 1: dashboardQuery.ts + Dashboard.svelte grid shell + TicketQueue.svelte** - `8cecf28` (feat)
2. **Task 2: Extend dashboard.spec.ts — empty state, responsive grid, live DASH-07 two-hop proof** - `93d40f0` (feat)

_Note: this SUMMARY.md and STATE.md/ROADMAP.md updates are committed separately as a docs commit per the executor's own protocol._

## Files Created/Modified
- `web/src/lib/dashboard/dashboardQuery.ts` - the ONE `db.useQuery` for the whole Dashboard feature; zero runtime imports so `DASHBOARD_QUERY` is importable standalone by the e2e Node process
- `web/src/lib/dashboard/Dashboard.svelte` - real 3-col/1-col grid shell, calls `useDashboardQuery(db)`, mounts `TicketQueue`
- `web/src/lib/dashboard/TicketQueue.svelte` - real ticket queue component (new)
- `web/e2e/dashboard.spec.ts` - 5 live Playwright tests (new)
- `web/e2e/fixtures/instancia-admin-fixture.ts` - additive: `seedInstance(fields, ownerEmail, templateId?)`, new `adminQuery<T>()`

## Decisions Made

- **`dashboardQuery.ts` takes `db` as a parameter instead of importing it** (see Deviations below for the full rationale) — `useDashboardQuery(db)` remains the Dashboard feature's only `db.useQuery` call site; `Dashboard.svelte` is the only caller.
- **Admin-API link-cardinality normalization in the DASH-07 test**: InstantDB's admin API (`@instantdb/admin`) returns every linked entity as an array regardless of the schema's `has: "one"` cardinality (confirmed live via a throwaway debug script), unlike the client SDK's `db.useQuery` which flattens `has: "one"` links to a single object. `dashboard.spec.ts`'s live proof test normalizes `template`/`fundo` with `Array.isArray(...) ? [0] : value`, mirroring the exact precedent already established at `routineJob.ts:622` for the identical situation. This is a test-only concern — the app's own `useDashboardQuery()` uses the client SDK and needs no such normalization (confirmed by `Dashboard.svelte`/`TicketQueue.svelte`'s successful rendering in every e2e test).
- **`fundos.codigo` for throwaway e2e fixtures** generated via a short unique-ish helper (`uniqueCodigo`) rather than the `phase21-e2e-` name prefix, since `codigo` has no documented uniqueness requirement beyond "short unique-ish" per the CLI's own help text — kept short to avoid any undocumented length ceiling.
- **Test file structured with per-`describe` local `beforeAll`/`afterAll` fixtures** (rather than one file-wide fixture set) specifically so the empty-state test's assertion is not order-dependent on the ticket-ordering describe's fixtures — Playwright's `workers: 1`/`fullyParallel: false` config runs every test in the file sequentially in declaration order, and each `describe`'s local `beforeAll` fires immediately before that describe's own first test, which is what makes "empty state, declared first" actually hold true at runtime (a file-wide single `beforeAll` would have created Task 1's tickets before ANY test in the file ran, making a true "empty" assertion impossible without deleting Task 1's own fixtures out from under it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `dashboardQuery.ts` restructured to take `db` as a parameter instead of importing it**
- **Found during:** Task 2 (writing the live DASH-07 two-hop proof test, which imports `DASHBOARD_QUERY` directly from `web/src/lib/dashboard/dashboardQuery.ts` per the plan's explicit instruction)
- **Issue:** As originally written (Task 1), `dashboardQuery.ts` had a top-level `import { db } from "../db"`. Playwright's Node-based test-file transform evaluates every top-level import when a spec file loads a module, and `db.ts` imports `@instantdb/svelte`, whose package `dist` includes actual `.svelte` component source files (e.g. `SignedIn.svelte`) in its module graph. Playwright's transform has no Svelte loader (that's Vite's job, for the browser bundle) and threw `TypeError: Unknown file extension ".svelte"` the instant `web/e2e/dashboard.spec.ts` imported anything from `dashboardQuery.ts`, making Task 2's live-proof test — and the plan's own explicit "import DASHBOARD_QUERY... so there is zero drift" instruction — impossible to run at all.
- **Fix:** Removed the top-level `db` import from `dashboardQuery.ts` entirely. `DASHBOARD_QUERY` is now a plain, dependency-free object literal. `useDashboardQuery(db: unknown)` takes the live `db` instance as a parameter and casts it internally to call `.useQuery(...)` — the same "cast at the InstaQL boundary" idiom `EntityScreen.svelte`/`ProjetosSection.svelte` already use for the query object, applied here to `db` itself for the identical underlying reason (a value whose full generic type this file must not statically reference, since referencing it would require importing the type-bearing module). `Dashboard.svelte` was updated to `import { db } from "../db"` and call `useDashboardQuery(db)` explicitly.
- **Files modified:** `web/src/lib/dashboard/dashboardQuery.ts`, `web/src/lib/dashboard/Dashboard.svelte`
- **Verification:** `bun run check` (0 errors), `bun run lint` (clean), all 5 `dashboard.spec.ts` tests pass live against the hosted InstantDB app, confirmed `useDashboardQuery(db)` remains the ONLY `db.useQuery` call site for the feature (grep-verified: no other Dashboard file calls `db.useQuery`/`useDashboardQuery`).
- **Committed in:** `93d40f0` (Task 2 commit)

**2. [Rule 1 - Bug] DASH-07 proof test's initial assertion failed on admin-API array-vs-object link shape**
- **Found during:** Task 2, first live run of the DASH-07 proof test — `seeded?.template?.fundo?.id` was `undefined` despite the seeded record existing.
- **Issue:** A throwaway debug script (run and deleted, never committed) confirmed the InstantDB admin API returns `template`/`fundo` as single-element arrays for a `has: "one"` link, not bare objects — the opposite of the client SDK's `db.useQuery` behavior the rest of this codebase (`ProjetosSection.svelte`, `EntityScreen.svelte`) relies on.
- **Fix:** Normalized both `template` and `fundo` with `Array.isArray(x) ? x[0] : x` before asserting, mirroring the exact precedent `routineJob.ts:622` already established for reading its own admin-queried `instanciasRotina.template`.
- **Files modified:** `web/e2e/dashboard.spec.ts`
- **Verification:** Re-ran `bunx playwright test dashboard.spec.ts --project=authed --no-deps` — all 5 tests pass.
- **Committed in:** `93d40f0` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for the plan's own mandated live-query e2e proof to be runnable at all. No scope creep — the public contract (`DASHBOARD_QUERY`'s exact shape, `useDashboardQuery()` as the sole call site, zero `Shell.svelte`/`EntityScreen.svelte`/`registry.ts`/`defs/instanciasRotina.ts` changes) is unchanged.

## Issues Encountered

- Both this plan (21-02) and the concurrently-running 21-01 execute in the same working directory (no git worktree isolation between the two parallel executors). Mid-execution, a `git commit` without an explicit pathspec would have swept up 21-01's already-staged changes (`derive.ts`/`derive.test.ts` renames, `ProjetosSection.svelte`) into this plan's commit. Caught immediately via `git show --stat HEAD` after the Task 2 commit; resolved with `git reset --soft HEAD~1` (non-destructive — index and working tree unchanged) followed by `git commit -- <this plan's 4 files only>`, leaving 21-01's staged changes untouched in the index for its own commit. Confirmed clean via `git log`: 21-01 subsequently committed its own changes (`77f23f3`) with no files from this plan in that commit, and this plan's two commits (`8cecf28`, `93d40f0`) contain none of 21-01's files. `git diff --stat` across both of this plan's commits confirms zero lines touched in `Shell.svelte`, `EntityScreen.svelte`, `registry.ts`, or `defs/instanciasRotina.ts`, per this plan's own `<verification>` requirement.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 21-03 can now swap `dash-week-slot`'s inner "carregando semana..." text for the real `WeekCalendar` component — the slot's wrapper testid/class contract is stable and untouched by this plan's own scope note.
- `dashboardQuery.ts`'s `DASHBOARD_QUERY` object and `useDashboardQuery(db)` signature are the stable contract for Plan 21-03 and Phase 22 to read `tarefas`/`instanciasRotina`/`fundos` rows from — no second `db.useQuery` should ever be added to the Dashboard feature.
- No blockers. `dash-placeholder-rotinas`/`dash-placeholder-projetos` remain static-text placeholders exactly as scoped (Phase 22's job).

## Self-Check: PASSED

All 5 files verified present on disk; both task commit hashes (`8cecf28`, `93d40f0`) verified present in `git log`.

---
*Phase: 21-dashboard-data-layer-shell-week-calendar-ticket-queue*
*Completed: 2026-08-11*
