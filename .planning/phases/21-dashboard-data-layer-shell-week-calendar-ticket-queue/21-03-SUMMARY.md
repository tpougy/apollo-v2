---
phase: 21-dashboard-data-layer-shell-week-calendar-ticket-queue
plan: 03
subsystem: ui
tags: [svelte5, instantdb, playwright, dashboard, popover, e2e]

requires:
  - phase: 21-01
    provides: "web/src/lib/dashboard/derive.ts's semanaUtil/agendaPorDia (canonical, pure) — this plan's only consumer of both"
  - phase: 21-02
    provides: "Dashboard.svelte's real grid shell with the dash-week-slot wrapper contract, dashboardQuery.ts's single db.useQuery, TicketQueue.svelte"
provides:
  - "web/src/lib/dashboard/WeekCalendar.svelte — DASH-03's 5-weekday-card band: per-type 3px left borders, bg-muted today highlight, count-gated weekend Popover chip, text-xs legend"
  - "Dashboard.svelte's finished grid: dash-header row (title/summary + prev/next/Hoje week-nav) wired to hojeIso/semanaBase local state, real WeekCalendar mounted in dash-week-slot"
  - "web/e2e/dashboard.spec.ts's full DASH-01/02/03/07 coverage (11 tests total across Plans 21-02+21-03), including the live instanciasRotina.template.fundo two-hop rotina-rendering proof through the real, shipped UI"
affects: [22-dashboard-rotinas-heatmap-kanban, 23-dashboard-focus-dialogs]

actuals:
  tokens: 6239
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "WeekCalendar.svelte receives all data as props (dias/agenda/hojeIso/sabado/domingo) computed once by Dashboard.svelte from derive.ts's pure functions — never calls db.useQuery or any dashboardQuery.ts/derive.ts export itself, preserving DASH-07's single-query invariant"
    - "Popover.Trigger renders a plain <button> by default (no snippet-child needed) when passed only restProps/children — used directly for the weekend chip instead of EntityScreen.svelte's snippet-child pattern (which exists only because that call site wraps a styled Button component)"
    - "e2e specs import derive.ts's pure exports directly (zero runtime imports, same reasoning already established for dashboardQuery.ts's DASHBOARD_QUERY) to compute 'this week' identically to the app at test-run time, never a hardcoded calendar date"

key-files:
  created:
    - web/src/lib/dashboard/WeekCalendar.svelte
  modified:
    - web/src/lib/dashboard/Dashboard.svelte
    - web/e2e/dashboard.spec.ts

key-decisions:
  - "hojeIso computed once (never reassigned) and semanaBase as the only $state week navigation touches — agendaPorDia always receives hojeIso as its 'hoje' parameter regardless of semanaBase, so paging through weeks can never change vencido/today-highlight math (T-21-06)."
  - "dadosNormalizados bridges DashboardData's optional link fields (etapa?: ..., fundo?: ...) to agendaPorDia's local *Like shapes, which declare the same links as required-but-nullable (etapa: ... | null) — an explicit per-row .map() rather than a boundary cast, since the two type shapes are genuinely incompatible under strict null checks (Rule 1 fix, not a plan deviation, but the concrete mechanism the plan's own 'dadosNormalizados' name only implied)."
  - "Fixed a pre-existing type-hole in Plan 21-02's InstanciaRotinaRow: it declared status but not tipoPrazo, and dadosNormalizados's first draft substituted i.status where tipoPrazo belonged for rotina items. Caught before commit; added tipoPrazo: string to the row type and wired it correctly (Rule 1 — bug, would have silently misclassified every rotina item's hard/soft flag)."
  - "Task 1's tdd=\"true\" attribute is interpreted pragmatically: this codebase has no unit-test infrastructure for Svelte component behavior (all UI behavior is Playwright-verified, and Task 2's own <action> explicitly owns writing dashboard.spec.ts's DASH-03 coverage). Task 1 was implemented as a standard auto task; its own <verify> command (`playwright test -g \"DASH-03\"`) correctly finds zero matching tests until Task 2 lands (confirmed: 'No tests found' when run immediately after Task 1, then 6/6 passing once Task 2's tests exist) — documented here per the executor's ambiguity-resolution instruction rather than silently reinterpreting the plan."
  - "Popover.Content is rendered via bits-ui's portal (appended outside the component's own DOM subtree) — Playwright's getByTestId still finds it since it is a live DOM node, no special handling needed."

patterns-established:
  - "Pattern: a Playwright spec computing 'this week' imports derive.ts's own semanaUtil directly rather than reimplementing the Monday-anchor algorithm — derive.ts has zero runtime imports, so it is safe for the Node/Playwright process (same import-safety reasoning already established for dashboardQuery.ts's DASHBOARD_QUERY in Plan 21-02)."

requirements-completed: [DASH-03, DASH-01]

coverage:
  - id: D1
    description: "WeekCalendar.svelte renders 5 Monday-Friday cards (up to 3 items + overflow row), each item's 3px left border keyed by tipo (tarefa border-foreground, rotina border-muted-foreground, ticket border-destructive)"
    requirement: "DASH-03"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-03: tarefa item rendering"
        status: pass
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-03: hard-vs-soft ticket week-band filtering"
        status: pass
    human_judgment: false
  - id: D2
    description: "Today's day-card header carries bg-muted; no other day's header does"
    requirement: "DASH-03"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-03: today highlight"
        status: pass
    human_judgment: false
  - id: D3
    description: "Weekend chip renders only when sabado+domingo combined item count > 0, opens a Popover listing both days' items"
    requirement: "DASH-03"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-03: weekend chip"
        status: pass
    human_judgment: false
  - id: D4
    description: "instanciasRotina.template.fundo two-hop query path renders live as a rotina-typed dash-week-item through the real, shipped UI (not only the admin-API-level proof from Plan 21-02)"
    requirement: "DASH-03"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-03: live two-hop rotina rendering"
        status: pass
    human_judgment: false
  - id: D5
    description: "Week navigation (prev/next/Hoje) changes only the local semanaBase state; vencido/today-highlight math stays anchored to the real current date"
    requirement: "DASH-03"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts#DASH-03: week navigation"
        status: pass
    human_judgment: false
  - id: D6
    description: "Dashboard.svelte's dash-header row (title, summary, prev/semana/next/Hoje) and the finished 3-col/1-col grid, completing DASH-01's full acceptance bar"
    requirement: "DASH-01"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts (full 11-test file, all DASH-01/02/03/07 tests)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-12
status: complete
---

# Phase 21 Plan 03: Week Calendar, Header/Week-Nav & Full DASH-03 Coverage Summary

**WeekCalendar.svelte's 5-weekday-card band (3px type borders, bg-muted today highlight, count-gated weekend Popover, legend) wired into Dashboard.svelte's finished header/week-nav, live-proven end-to-end including the instanciasRotina.template.fundo two-hop rotina render through the real shipped UI.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-12T01:05:00Z (approx.)
- **Completed:** 2026-08-12T01:48:00Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `WeekCalendar.svelte` renders `dias`/`agenda`/`hojeIso`/`sabado`/`domingo` as pure props (no `db.useQuery`, no `dashboardQuery.ts`/`derive.ts` calls of its own): 5 weekday cards each with up to 3 items + a `+N` overflow row, per-type 3px left borders (`border-foreground`/`border-muted-foreground`/`border-destructive`), `bg-muted` on today's header, a weekend chip rendered only when `sabado`+`domingo`'s combined count is `> 0` (opening a `Popover.Root`/`Trigger`/`Content` block), and a `text-xs` legend.
- `Dashboard.svelte` gained `hojeIso` (computed once, real today, never reassigned) and `semanaBase` (the only `$state` week navigation touches), `todayUtcIso`/`shiftIso` UTC-safe local helpers, a `dadosNormalizados` bridge from `DashboardData`'s optional-link row types to `agendaPorDia`'s required-but-nullable `*Like` shapes, a `dash-header` row (title `"Semana de DD–DD de <mês>"` + `"{total} afazeres · {atrasados} atrasados"` summary + `‹ semana`/`semana ›`/`Hoje` buttons), and mounts the real `WeekCalendar` in `dash-week-slot`.
- `web/e2e/dashboard.spec.ts` extended with 6 new `DASH-03` describes (tarefa rendering, hard-vs-soft ticket filtering, live two-hop rotina rendering, weekend chip, today highlight, week navigation) — all computing "this week" at run time via `derive.ts`'s own `semanaUtil`, never a hardcoded calendar date. Full file: 11 tests, all green, twice in a row plus once more embedded in the full `bun run test:e2e` suite.
- Live proof that `instanciasRotina.template.fundo` resolves through the real, rendered UI (not only Plan 21-02's admin-API-level check): a real `templatesRotina` linked to a real `fundo`, one seeded `instanciasRotina` instance, renders as a `dash-week-item` with `data-tipo="rotina"`/`border-muted-foreground` under the correct weekday.

## Task Commits

Each task was committed atomically:

1. **Task 1: WeekCalendar.svelte + Dashboard.svelte header/week-nav** - `0f7f9e8` (feat)
2. **Task 2: Extend dashboard.spec.ts — full DASH-03 coverage + live two-hop proof** - `898e3ef` (test)

_Note: this SUMMARY.md and STATE.md/ROADMAP.md/REQUIREMENTS.md updates are committed separately as a docs commit per the executor's own protocol._

## Files Created/Modified

- `web/src/lib/dashboard/WeekCalendar.svelte` - real week-band component: 5 day cards, type-bordered items, today highlight, weekend Popover chip, legend (new)
- `web/src/lib/dashboard/Dashboard.svelte` - `hojeIso`/`semanaBase` state, `dadosNormalizados`/`agenda`/`semana` derivations, `dash-header` row with week-nav, real `WeekCalendar` mount
- `web/e2e/dashboard.spec.ts` - 6 new `DASH-03` tests (11 total in the file)

## Decisions Made

- **`hojeIso` computed once, `semanaBase` the only `$state` week-nav touches** — `agendaPorDia` always receives `hojeIso`, so navigating weeks can never change what counts as overdue or "today" (T-21-06, mitigated exactly as the plan's threat register specified).
- **`dadosNormalizados` as an explicit per-field `.map()`, not a boundary cast** — `agendaPorDia`'s local `*Like` interfaces require `etapa`/`fundo`/`template` as present-but-nullable (`{...} | null`), while `DashboardData`'s row types (Plan 21-02) declare the same links as merely optional (`etapa?: ...`). These are genuinely incompatible under strict null checks (`undefined` is not assignable where only `null` is expected), so the normalization builds new plain objects per row rather than attempting a cast.
- **Popover.Trigger used directly as a `<button>`** (no snippet-child) for the weekend chip — verified against `bits-ui`'s own `popover-trigger.svelte` source: when no `child` snippet is passed, `Trigger` renders a plain `<button>{...mergedProps}>{children}</button>`, so `data-testid`/`class` pass straight through. `EntityScreen.svelte`'s snippet-child usage exists only because that call site wraps a styled `Button` component, not because it's required by the primitive.
- **Task 1's `tdd="true"` interpreted pragmatically** — no unit-test infrastructure exists for Svelte component behavior in this codebase (all UI behavior is Playwright-verified, and Task 2's own `<action>` explicitly owns writing the `DASH-03` test coverage the plan's Task 1 `<verify>` command greps for). Confirmed both states directly: running `playwright test -g "DASH-03"` immediately after Task 1 correctly reports "No tests found" (zero matching tests, as expected since Task 2 hadn't run yet); re-running the identical command after Task 2 shows 6/6 passing. Documented here as this plan's own ambiguity-resolution call rather than silently reinterpreting the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `InstanciaRotinaRow` was missing `tipoPrazo`, which `dadosNormalizados`'s first draft masked by substituting `status` in its place**
- **Found during:** Task 1, while writing `dadosNormalizados`'s `instanciasRotina` mapping
- **Issue:** Plan 21-02's `InstanciaRotinaRow` type (in `Dashboard.svelte`) declared `status` but not `tipoPrazo`, even though the entity has both fields (confirmed via `defs/instanciasRotina.ts`'s field list) and `agendaPorDia`'s rotina-item branch needs `tipoPrazo` (used for within-day hard/soft sort priority — see `derive.ts`'s `_hard` sort key). Writing `tipoPrazo: i.status` would have silently fed the wrong field into every rotina item's sort priority.
- **Fix:** Added `tipoPrazo: string;` to `InstanciaRotinaRow` and wired `tipoPrazo: i.tipoPrazo` correctly in `dadosNormalizados`.
- **Files modified:** `web/src/lib/dashboard/Dashboard.svelte`
- **Verification:** `bun run check` (0 errors); the live two-hop rotina test (Task 2) seeds a real `tipoPrazo: "hard"` instance and asserts it renders correctly, which would have failed under the original `i.status` substitution had that value differed structurally from a valid `tipoPrazo`.
- **Committed in:** `0f7f9e8` (Task 1 commit, caught and fixed before commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug, caught and fixed before any commit)
**Impact on plan:** No scope creep — the fix stayed entirely within `Dashboard.svelte`'s own row-type declarations, which this plan already owns per its `files_modified` list. No behavior visible to a user changed relative to the plan's intent; the bug would only have surfaced once Phase 22 or a future rotina-sort-order-sensitive test exercised it.

## Issues Encountered

- **Pre-existing lint baseline (out of scope, confirmed via `git stash` A/B):** `bun run lint` reports 3 errors in `web/src/lib/dashboard/derive.ts`, `web/src/lib/dashboard/derive.test.ts`, and `web/src/lib/sections/ProjetosSection.svelte` — all pre-existing from Plans 21-01/19, confirmed present before this plan's changes via `git stash`/re-run. This plan's own files (`WeekCalendar.svelte`, `Dashboard.svelte`, `dashboard.spec.ts`) lint clean. Per the executor's scope-boundary rule, these are left untouched and not fixed by this plan.
- **Two isolated, pre-existing e2e flakes during the full `bun run test:e2e` run (unrelated to this plan's diff):** `login-flow.spec.ts`'s magic-code polling test and `entities-ticket-subtarefa.spec.ts`'s parent-relink test each failed once during a ~9-minute full-suite run, then passed cleanly when re-run in isolation immediately after. Neither test touches `web/src/lib/dashboard/*` or `web/e2e/dashboard.spec.ts`; both are pre-existing timing-sensitive patterns (email-polling and InstantDB reactive-sync-under-load) already flagged in STATE.md's Decisions log for Phase 20. Not caused by, or related to, this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 22 (rotinas-by-fundo, heatmap, mini-kanbans) can now build directly on top of the finished `dash-week-slot`/`dash-header` contract — no further changes needed to `WeekCalendar.svelte`'s prop shape or `Dashboard.svelte`'s `semana`/`agenda` derivations.
- Phase 23's dialog system has explicit, already-inert click targets to wire up: `dash-week-day-header`, `dash-week-item`, `dash-weekend-popover-item` all render as real `<button>`s with no `onclick` yet (by this phase's explicit scope note, matching `dash-ticket-card`'s identical Plan 21-02 precedent).
- `rotina` `Item.titulo` still uses `instancia.id` as its placeholder label (21-01's documented decision, carried through unchanged) — Phase 22/23 will need to resolve a human-readable rotina label when they build the actual rotina-detail rendering.
- No blockers.

## Self-Check: PASSED

All 3 files (`WeekCalendar.svelte` created, `Dashboard.svelte`/`dashboard.spec.ts` modified) confirmed present on disk with expected content; both task commit hashes (`0f7f9e8`, `898e3ef`) confirmed present in `git log`.

---
*Phase: 21-dashboard-data-layer-shell-week-calendar-ticket-queue*
*Completed: 2026-08-12*
