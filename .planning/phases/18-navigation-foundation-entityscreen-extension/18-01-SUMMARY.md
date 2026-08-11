---
phase: 18-navigation-foundation-entityscreen-extension
plan: 01
subsystem: ui
tags: [svelte5, navigation, registry, playwright, shell]

requires: []
provides:
  - "EntityConfig.nav?/navTitulo? fields on the EntityConfig contract (types.ts)"
  - "registry.ts's navConfigs derived export (entityConfigs.filter on nav)"
  - "Shell.svelte's Route discriminated union ($state, dashboard-default) replacing the old ativo/entityConfigs[0] pattern"
  - "web/src/lib/dashboard/Dashboard.svelte placeholder mount point"
  - "web/e2e/helpers/gotoNested.ts — stable-signature e2e helper for reaching nav:\"nested\" entities"
  - "Shell.svelte's generic nested-goto Select (interim NAV-02 affordance), grouped by entityConfigs.filter(c => c.nav === \"nested\")"
affects: ["18-02", "18-03"]

actuals:
  tokens: 4706
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Route discriminated union ($state<Route>) as the sole nav-state mechanism in Shell.svelte — no router/URL, mirrors spec-ui.md §1.3"
    - "navConfigs = entityConfigs.filter((c) => (c.nav ?? \"primary\") === \"primary\") as the single source of primary-topbar membership — no hand-maintained entity list"
    - "gotoNested(page, etype) e2e helper with a signature stable across phases; only its body changes when Phase 19/20 ship real nested UI"

key-files:
  created:
    - web/src/lib/dashboard/Dashboard.svelte
    - web/e2e/helpers/gotoNested.ts
  modified:
    - web/src/lib/entities/types.ts
    - web/src/lib/entities/registry.ts
    - web/src/lib/entities/registry.test.ts
    - web/src/lib/entities/defs/etapas.ts
    - web/src/lib/entities/defs/tarefas.ts
    - web/src/lib/entities/defs/subtarefas.ts
    - web/src/lib/entities/defs/templatesRotina.ts
    - web/src/lib/entities/defs/instanciasRotina.ts
    - web/src/lib/entities/defs/tickets.ts
    - web/src/lib/entities/defs/projetos.ts
    - web/src/lib/entities/defs/fundos.ts
    - web/src/lib/entities/defs/logInferenciaClaude.ts
    - web/src/lib/Shell.svelte
    - web/e2e/shell-nav.spec.ts

key-decisions:
  - "Nested-entity grouping in the interim gotoNested affordance is derived purely from each nested config's `links` array (first link whose targetEtype resolves to a primary config), never a hand-written per-etype map — verified result: 'Projetos' groups etapas, 'Fundos' groups templatesRotina, 'Outros' groups tarefas and subtarefas (tarefas.links only targets the now-nested etapas; subtarefas has no links, only xorLink)."
  - "Ambiguity resolution per RESEARCH.md Assumption A1: implemented gotoNested's Phase-18 body against a minimal, fully-generic, non-'nav-'-prefixed Select control (data-testid='nested-goto'/'nested-goto-<etype>') rather than blocking on Phase 19/20's real nested UI — the helper's public signature (gotoNested(page, etype)) is what stays stable; only its body will change later."
  - "Nested defs' new ordem values assigned 10/11/12/13 (etapas/tarefas/templatesRotina/subtarefas) per RESEARCH.md Assumption A3 — registry.test.ts only asserts ordem uniqueness, not specific values, so any pairwise-distinct set >=10 was valid."

patterns-established:
  - "Any future EntityConfig field meant to control topbar visibility should extend `nav`'s union type, not add a parallel boolean/array."
  - "Playwright specs that need to reach a `nav: \"nested\"` entity's standalone EntityScreen must import gotoNested from web/e2e/helpers/gotoNested.ts, never click a nav-<etype> testid directly (removed for nested entities)."

requirements-completed: [NAV-01, NAV-02, NAV-03, NAV-04, NEST-06]

coverage:
  - id: D1
    description: "Topbar shows exactly 6 items, in order Dashboard, Rotinas, Tickets, Projetos, Fundos, Log (NAV-01)"
    requirement: "NAV-01"
    verification:
      - kind: e2e
        ref: "web/e2e/shell-nav.spec.ts#NAV-01/NAV-03: fresh load shows exactly the 6-item topbar in order, defaulting to the Dashboard route"
        status: pass
    human_judgment: false
  - id: D2
    description: "No nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas button exists anywhere in the DOM; those 4 entities remain reachable only via the interim gotoNested-backed affordance (NAV-02)"
    requirement: "NAV-02"
    verification:
      - kind: e2e
        ref: "web/e2e/shell-nav.spec.ts#NAV-02: no first-level nav path for etapas/tarefas/templatesRotina/subtarefas, but each remains reachable via gotoNested"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fresh authenticated load lands on the Dashboard route (nav-dashboard sole aria-current=true, <h2>Dashboard</h2> visible, no entity table) (NAV-03)"
    requirement: "NAV-03"
    verification:
      - kind: e2e
        ref: "web/e2e/shell-nav.spec.ts#NAV-01/NAV-03: fresh load shows exactly the 6-item topbar in order, defaulting to the Dashboard route"
        status: pass
    human_judgment: false
  - id: D4
    description: "registry.ts's navConfigs is a derived .filter() over entityConfigs with zero hand-maintained entity list (NAV-04)"
    requirement: "NAV-04"
    verification:
      - kind: unit
        ref: "web/src/lib/entities/registry.test.ts#registry coverage: navConfigs derivation (NAV-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Fundos and Log render exactly as before this phase — only their topbar order/label changed (NEST-06)"
    requirement: "NEST-06"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-fundos.spec.ts (both tests, run this session — SC-3 and WEB-02 both pass unedited)"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-rotina-log.spec.ts#WEB-09: logInferenciaClaude is a pure read-only table showing CLI-written entries"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-08-11
status: complete
---

# Phase 18 Plan 01: Navigation Foundation — nav metadata, 6-item topbar, Dashboard mount, interim nested affordance Summary

**Declared `nav`/`navTitulo` metadata on `EntityConfig`, derived `navConfigs` in `registry.ts` with zero manual entity list, rewrote `Shell.svelte`'s topbar around a `Route` discriminated union defaulting to a new `Dashboard.svelte` placeholder, and gave the 4 now-hidden nested entities (etapas/tarefas/templatesRotina/subtarefas) a generic, data-driven interim access path plus the `gotoNested(page, etype)` e2e helper Plan 18-03 will consume.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-11
- **Tasks:** 2/2 completed
- **Files modified:** 14 modified, 2 created

## Accomplishments
- `EntityConfig` gained exactly two optional fields (`nav?: "primary" | "nested"`, `navTitulo?: string`); `registry.ts` gained the single derived `navConfigs` export with zero hand-maintained entity list.
- Reassigned `ordem` across all 9 `defs/*.ts` files per spec-ui.md §1.2 (Rotinas 1, Tickets 2, Projetos 3, Fundos 4, Log 5 as primaries; Etapas 10, Tarefas 11, TemplatesRotina 12, Subtarefas 13 as nested), with `navTitulo: "Rotinas"`/`"Log"` on the two entities whose short label differs from `titulo`.
- Rewrote `Shell.svelte`'s topbar and content area around a `Route` discriminated union (`$state<Route>({ section: "dashboard" })`), replacing the old `ativo = entityConfigs[0].etype` pattern — the topbar now renders one literal Dashboard button plus `navConfigs`, defaulting to the new `Dashboard.svelte` placeholder on every fresh load.
- Built a fully generic, data-driven interim secondary-access control for the 4 `nav: "nested"` entities (a shadcn `Select` grouped by the first primary entity each links to, falling back to "Outros"), with zero `if (cfg.etype === ...)` branching anywhere in `Shell.svelte`.
- Added `web/e2e/helpers/gotoNested.ts`, a stable-signature helper (`gotoNested(page, etype)`) that Plan 18-03's 27-call-site migration and future Phase 19/20 real-nested-UI work will both consume without changing call sites.
- Extended `registry.test.ts` and `shell-nav.spec.ts` with the NAV-01/02/03/04 structural and e2e proofs required by this plan's `must_haves`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare nav metadata across the registry; wire the 6-item topbar + Dashboard mount, end to end** - `5c97ba7` (feat)
2. **Task 2: Interim nested-entity access affordance + gotoNested e2e helper (NAV-02)** - `029a3c0` (feat)

_Task 2's commit also folds in a `registry.test.ts` biome-formatting fix discovered while confirming `bun run lint` was clean — see Deviations below._

## Files Created/Modified
- `web/src/lib/entities/types.ts` - added `nav?`/`navTitulo?` to `EntityConfig`
- `web/src/lib/entities/registry.ts` - added `navConfigs` derived export
- `web/src/lib/entities/registry.test.ts` - added local `navConfigs` mirror + NAV-04 describe block
- `web/src/lib/entities/defs/{etapas,tarefas,subtarefas,templatesRotina}.ts` - `nav: "nested"`, reassigned `ordem` (10/11/13/12 respectively)
- `web/src/lib/entities/defs/instanciasRotina.ts` - `ordem: 1`, `navTitulo: "Rotinas"`
- `web/src/lib/entities/defs/tickets.ts` - `ordem: 2`
- `web/src/lib/entities/defs/projetos.ts` - `ordem: 3`
- `web/src/lib/entities/defs/fundos.ts` - `ordem: 4`
- `web/src/lib/entities/defs/logInferenciaClaude.ts` - `ordem: 5`, `navTitulo: "Log"`
- `web/src/lib/Shell.svelte` - `Route` union, 6-item topbar, Dashboard mount, nested-goto Select
- `web/src/lib/dashboard/Dashboard.svelte` - new minimal placeholder (`<h2>Dashboard</h2>` only)
- `web/e2e/helpers/gotoNested.ts` - new stable-signature e2e helper
- `web/e2e/shell-nav.spec.ts` - 9→6 count fix, per-button `h2` lookup table, new NAV-01/03 and NAV-02 tests, stale-comment update

## Decisions Made
- Interim `gotoNested` affordance grouping is entirely derived from `links`/`nav`/`configByEtype` (RESEARCH.md Assumption A1) — no per-etype conditional. See `key-decisions` in frontmatter for the exact resulting groups and rationale.
- Nested `ordem` values 10/11/12/13 chosen per RESEARCH.md Assumption A3 (only uniqueness is asserted by tests).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `bun run lint` flagged import-order and formatting in files this plan touches**
- **Found during:** Task 2's plan-level verification step (`bun run lint`)
- **Issue:** Biome's `organizeImports` assist flagged `Shell.svelte`'s import order (added `Select`/`Dashboard` imports not alphabetically sorted per Biome's convention), and its formatter flagged a line-length/quote-style issue in `registry.test.ts`'s new `navTitulo` test.
- **Fix:** Reordered `Shell.svelte`'s imports to Biome's expected order; reformatted the flagged `registry.test.ts` test (single-quoted the string containing embedded double quotes, wrapped the long `expect(...)` call).
- **Files modified:** `web/src/lib/Shell.svelte`, `web/src/lib/entities/registry.test.ts`
- **Verification:** Re-ran `bun run lint` — 0 errors on every file this plan touches (one pre-existing, out-of-scope `useParseIntRadix` info-level hit remains in `calendar-caption.svelte`, untouched by this plan).
- **Committed in:** `029a3c0` (part of Task 2's commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, lint-blocking)
**Impact on plan:** Cosmetic only — no behavior change, no scope creep. Necessary to satisfy the plan's own `<verification>` requirement that touched files be lint-clean (C-08).

## Issues Encountered
None beyond the deviation above.

## Out-of-Scope Verification Note (informational, not a deviation)

Per this plan's explicit scope boundary, `shell-chrome.spec.ts`, `entities-header-states.spec.ts`, `cross-phase-verification.spec.ts`, and the 6 dead-testid-migration files are expected to fail until Plan 18-03 lands. As a sanity check beyond this plan's own gate, `entities-fundos.spec.ts` and `entities-rotina-log.spec.ts` were run:
- `entities-fundos.spec.ts` — both tests pass unedited, confirming NEST-06 for Fundos.
- `entities-rotina-log.spec.ts` — the `logInferenciaClaude`/`instanciasRotina` tests pass, but `WEB-06` (templatesRotina CRUD) fails on `page.getByTestId("nav-templatesRotina")` timing out — exactly the documented, intentional NAV-05 migration gap this plan explicitly defers to Plan 18-03 (this file is in 18-03's `files_modified` list). No action taken here per the plan's own instruction not to touch these files.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 18-02 (`EntityScreen.svelte`'s additive `scopeWhere`/`presetLinks` props, NEST-01) has no dependency on this plan's changes and can proceed independently (its own `depends_on: []`).
- Plan 18-03 (`depends_on: ["18-01"]`) can now consume `navConfigs`, `gotoNested`, and the new `nav`/`navTitulo` metadata to migrate the 27 e2e call sites and fix the 3 wildcard-count files — this plan's `Shell.svelte`/`registry.ts`/`gotoNested.ts` surface is stable for that work.
- Phase 18's own full-suite gate (`bun run test:e2e`) is intentionally NOT green yet — that is expected until Plan 18-03 lands, per this plan's `<verification>` section.

## Self-Check: PASSED

All created/modified files verified present on disk; both task commit hashes (`5c97ba7`, `029a3c0`) verified present in `git log`.

---
*Phase: 18-navigation-foundation-entityscreen-extension*
*Completed: 2026-08-11*
