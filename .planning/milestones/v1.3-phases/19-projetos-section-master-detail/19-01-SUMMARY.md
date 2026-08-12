---
phase: 19-projetos-section-master-detail
plan: 01
subsystem: ui
tags: [svelte5, instantdb, shadcn-svelte, playwright, master-detail, runes]

# Dependency graph
requires:
  - phase: 18-nav-reorg-entityscreen-extension
    provides: EntityScreen.svelte's own create/edit dialog engine (donoId injection, xor/link validation, dangling-parent guard) reused unmodified via a hidden mounted instance
provides:
  - ProjetosSection.svelte — master-detail screen mounted for nav-projetos, replacing the generic EntityScreen for this one etype
  - One bespoke db.useQuery({projetos:{fundo:{},etapas:{tarefas:{subtarefas:{}}}}}) feeding both the master column's grouping and the detail column's counts
  - The hidden-EntityScreen-instance + polled-selector-click pattern for reusing the generic create/edit dialog from outside its own mount (no new EntityScreen prop)
  - accordion/tabs/scroll-area shadcn-svelte components installed for Plan 19-02/19-03 to consume
affects: [19-02-etapas-accordion, 19-03-kanban-todas-tarefas, 19-04-regression-fixes]

# Actuals (#2632)
actuals:
  tokens: 8475
  tasks: 2
  commits: 3

tech-stack:
  added: [shadcn-svelte accordion, shadcn-svelte tabs, shadcn-svelte scroll-area]
  patterns:
    - "Bespoke multi-level db.useQuery in a section component, bypassing EntityScreen.buildQuery's one-level-deep link nesting"
    - "Hidden EntityScreen instance + bounded-poll selector-click to drive its own real create/edit dialog from outside its own mount"
    - "Router-level HANDLED_BY_SECTION allowlist in Shell.svelte to shrink the interim nested-goto dropdown as each etype gets a real section"

key-files:
  created:
    - web/src/lib/sections/ProjetosSection.svelte
    - web/e2e/projetos-section.spec.ts
    - web/src/lib/components/ui/accordion/*
    - web/src/lib/components/ui/tabs/*
    - web/src/lib/components/ui/scroll-area/*
  modified:
    - web/src/lib/Shell.svelte

key-decisions:
  - "Resolved projetosConfig via configByEtype (registry.ts), never a direct defs/projetos.ts import — keeps registry validation authoritative."
  - "openProjetoDialog polls (bounded 5s) for its target selector instead of a single tick() — the hidden host's own db.useQuery must resolve over the network before a row-scoped selector like row-edit exists, unlike the always-present entity-create-start button."
  - "Shell.svelte's etype === \"projetos\" branch is the one permitted per-route mount-point branch (spec-ui.md §0.6) — EntityScreen.svelte/registry.ts remain untouched (grep for 'if (config.etype' still returns 0)."
  - "Pruned etapas/tarefas from the interim nested-goto dropdown via a HANDLED_BY_SECTION allowlist, matching 19-CONTEXT.md's Open Question 2 recommendation; templatesRotina/subtarefas stay until Phase 20."

patterns-established:
  - "Bespoke db.useQuery pattern: any section screen needing more than one level of link nesting writes its own query object (cast `as never` at the InstaQL boundary, same precedent as EntityScreen.svelte:82), never extends the generic buildQuery."
  - "Hidden-instance dialog reuse: every '+ X'/'editar X' affordance outside EntityScreen's own mount drives a real, unmodified EntityScreen instance's own DOM button via a lazily-mounted, scoped-querySelector, polled-until-found click — never a new EntityScreen prop or mode branch."

requirements-completed: [NEST-02]

coverage:
  - id: D1
    description: "Master column groups every projeto by fundo (\"Sem fundo vinculado\" group always last), with a working client-side name search"
    requirement: "NEST-02"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: master column groups projetos by fundo, 'Sem fundo vinculado' last"
        status: pass
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: name search filters client-side over already-loaded rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "\"+ novo projeto\" opens EntityScreen's own real create dialog via a hidden EntityScreen(projetosConfig) instance; the new projeto appears in the master list, correctly grouped, with no page reload"
    requirement: "NEST-02"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: '+ novo projeto' opens EntityScreen's own create dialog, new projeto appears with no reload"
        status: pass
    human_judgment: false
  - id: D3
    description: "Selecting a project-item highlights it (variant=\"secondary\") and shows that projeto's own breadcrumb, name, fundo, and etapa/tarefa counts, reading from the same bespoke query — no second fetch"
    requirement: "NEST-02"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: selecting a project-item highlights it and shows its breadcrumb/header with correct counts"
        status: pass
    human_judgment: false
  - id: D4
    description: "\"editar projeto\" opens the same hidden EntityScreen(projetosConfig) instance's pre-filled real edit form; submitting updates the projeto in place (same data-eid) in both the master list and the detail header"
    requirement: "NEST-02"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: 'editar projeto' opens the same hidden EntityScreen(projetosConfig) instance's edit form, pre-filled, and updates in place"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-11
status: complete
---

# Phase 19 Plan 01: ProjetosSection Master-Detail Screen Summary

**New `ProjetosSection.svelte` master-detail screen mounted for `nav-projetos`, driven by one bespoke `projetos→fundo/etapas→tarefas→subtarefas` `db.useQuery`, reusing `EntityScreen`'s unmodified create/edit dialog through a hidden mounted instance.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-11T18:24Z (approx.)
- **Completed:** 2026-08-11T18:29Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 16 (1 modified, 15 created — 13 of which are vendor shadcn-svelte source files)

## Accomplishments
- `ProjetosSection.svelte` replaces the generic `EntityScreen` for `nav-projetos`, with a `w-56` master column (grouped by fundo, "Sem fundo vinculado" always last, client-side name search, display-only `agrupar: fundo | nenhum | status` control) and a detail column (breadcrumb + header with live etapa/tarefa counts).
- "+ novo projeto" and "editar projeto" both drive the *exact same* hidden `EntityScreen(projetosConfig)` instance's own real create/edit dialog — no duplicated form logic, no new `EntityScreen` prop.
- `accordion`, `tabs`, and `scroll-area` installed via the shadcn-svelte registry (confirmed zero `package.json`/`bun.lock` diff) for Plan 19-02/19-03 to build on.
- `Shell.svelte` gains the one permitted per-route mount-point branch for `etype === "projetos"`, and the interim `nested-goto` dropdown shrinks (etapas/tarefas removed) now that they have a real first-class home.
- New `web/e2e/projetos-section.spec.ts` (5 tests, all green) proves grouping, search, create, selection, and edit end-to-end against the live hosted InstantDB backend. Zero pre-existing spec file edited.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install accordion/tabs/scroll-area, create ProjetosSection's master column + bespoke query, mount it in Shell** - `3f17502` (feat)
2. **Task 2: "editar projeto" via the same hidden EntityScreen(projetosConfig) instance** - `d43e789` (test, RED), `7e35aa8` (feat, GREEN)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

_Note: Task 2 is TDD — RED (`d43e789`, failing test asserting `project-edit-start` behavior) then GREEN (`7e35aa8`, implementation + a bugfix surfaced by the first GREEN run). No REFACTOR commit was needed; the implementation was already clean after the bugfix._

## Files Created/Modified
- `web/src/lib/sections/ProjetosSection.svelte` - New master-detail screen: bespoke nested query, grouping/search state, master column, detail column, hidden create/edit host.
- `web/src/lib/Shell.svelte` - Mounts `ProjetosSection` for `rota.etype === "projetos"`; prunes `etapas`/`tarefas` from the interim `nestedGroups` dropdown via a `HANDLED_BY_SECTION` allowlist.
- `web/e2e/projetos-section.spec.ts` - New: 5 Playwright tests (grouping, search, create, selection, edit) against the live authed session.
- `web/src/lib/components/ui/{accordion,tabs,scroll-area}/*` - New shadcn-svelte registry source-copies (no new npm dependency).

## Decisions Made
- Resolved `projetosConfig` via `configByEtype("projetos")` (the registry), never a direct `defs/projetos.ts` import, per spec §0.7/RESEARCH.md's own instruction — keeps the registry's default-export validation authoritative.
- `groupProjetos` sorts entries alphabetically by label in every mode, except `"fundo"` mode where `"Sem fundo vinculado"` is force-sorted last regardless of alphabetical order; `"status"` mode has no such special case (matches the plan's literal spec).
- Loading/error states reuse `Skeleton`/`Alert` exactly as `EntityScreen.svelte` does, keeping the two screens visually consistent.
- Did not test the `agrupar` control's `"nenhum"`/`"status"` modes in the new e2e spec beyond the default `"fundo"` mode — the plan's action item 9 only lists grouping/search/create/selection/edit as required coverage; switching modes is exercised visually by the display-only control but not asserted in Playwright. This is a light gap, not a stub (the feature is implemented and works), and can be covered incidentally by Plan 19-02/19-03's own e2e work if they touch the same control.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `openProjetoDialog` didn't wait for the hidden host's own query to resolve before querying for a row-scoped selector**
- **Found during:** Task 2 GREEN implementation (first real e2e run of the new "editar projeto" test failed: `field-nome` never appeared after clicking `project-edit-start`)
- **Issue:** The original implementation (`await tick(); querySelector(...)`) only flushed pending Svelte reactive updates, not the hidden `EntityScreen(projetosConfig)` instance's own in-flight `db.useQuery` network fetch. `"+ novo projeto"`'s target (`entity-create-start`) always exists regardless of query state, so this bug was invisible in Task 1; `"editar projeto"`'s target (a specific row's `row-edit` button) only exists once that query resolves and the table renders.
- **Fix:** `openProjetoDialog` now polls (50ms interval, bounded at 5s) for the selector after the initial `tick()`, clicking as soon as it appears. Both callers (`startCreateProjeto`, `startEditProjeto`) share this one code path.
- **Files modified:** `web/src/lib/sections/ProjetosSection.svelte`
- **Verification:** `web/e2e/projetos-section.spec.ts`'s "editar projeto" test passes; full 5-test suite re-run green.
- **Committed in:** `7e35aa8` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness of the "editar projeto" flow specifically; no scope creep — the fix only touches the shared dialog-opening helper both tasks already depend on.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `query`/`rowsOf()` (the one bespoke `db.useQuery`) and the hidden-instance dialog-reuse pattern are ready for Plan 19-02 (etapas accordion, "+ etapa" via a second hidden `etapasConfig` instance) and Plan 19-03 (kanban toggle, "Todas as tarefas" tab) to build on directly — no second top-level fetch needed.
- The detail column deliberately does not yet render an etapas accordion or a "+ etapa" action — that is explicitly Plan 19-02's scope per this plan's own `<action>` text (code comment left in place at the relevant spot in `ProjetosSection.svelte`).
- `entities-projeto-etapa-tarefa.spec.ts`'s `WEB-03` test still assumes the old flat `EntityScreen` table for `nav-projetos` and will now fail — this is the documented, deferred regression (T-19-01-03) that Plan 19-04 is scoped to fix, per this plan's own threat register. Do not run the full e2e suite as a gate for this plan; the targeted `projetos-section.spec.ts` run is this plan's own gate.
- `shell-nav.spec.ts`'s `NAV-02` loop (which calls `gotoNested(page, "etapas")`) is also expected to fail now that `etapas` is no longer in the `nested-goto` dropdown — same deferred-to-19-04 bucket.

## Self-Check: PASSED

All created files confirmed present on disk (`ProjetosSection.svelte`, `projetos-section.spec.ts`, `Shell.svelte`, `accordion/tabs/scroll-area` barrels, this SUMMARY). All three task commit hashes (`3f17502`, `d43e789`, `7e35aa8`) confirmed present in `git log --oneline --all`.

---
*Phase: 19-projetos-section-master-detail*
*Completed: 2026-08-11*
