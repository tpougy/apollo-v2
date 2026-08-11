---
phase: 20-rotinas-tickets-sections
plan: 02
subsystem: ui
tags: [svelte5, playwright, bits-ui, tabs]

# Dependency graph
requires:
  - phase: 19-projetos-hierarchy
    provides: Tabs.Root/Tabs.List/Tabs.Trigger/Tabs.Content conventions (ProjetosSection.svelte's "Projeto"/"Todas as tarefas" tabs), the {#if activeTab===...} guard needed because bits-ui's Tabs.Content mounts every tab's children immediately
provides:
  - "RotinasSection.svelte -- Tabs.Root wrapper with Instâncias (default, unchanged EntityScreen(instanciasRotinaConfig)) and Templates (unchanged EntityScreen(templatesRotinaConfig) + static context paragraph) tabs, wired into Shell.svelte's router"
  - "gotoNested.ts's templatesRotina branch -- lands on RotinasSection's Templates tab with zero call-site edits in entities-rotina-log.spec.ts"
affects: [20-03, 20-04, 20-05]

# Actuals (#2632)
actuals:
  tokens: 2135
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RotinasSection.svelte reuses ProjetosSection.svelte's exact Tabs.Root/onValueChange/{#if activeTab===...} shape verbatim -- the same guard is now needed by BOTH of its tabs (not just one, as in ProjetosSection), since both mount an EntityScreen directly."

key-files:
  created:
    - web/src/lib/sections/RotinasSection.svelte
    - web/e2e/rotinas-section.spec.ts
  modified:
    - web/src/lib/Shell.svelte
    - web/e2e/helpers/gotoNested.ts

key-decisions:
  - "No RotinasSection-level <h2> -- EntityScreen(instanciasRotinaConfig)'s own unconditional <h2>{config.titulo}</h2> ('Instâncias de rotina') already satisfies shell-nav.spec.ts's EXPECTED_H2_BY_TESTID['nav-instanciasRotina'] strict single-<h2> assertion, exactly as the plan's action text specified up front (not a deviation -- this plan learned from 20-01-SUMMARY.md's identical finding for TicketsSection and got it right on the first pass)."
  - "Both Tabs.Content blocks (Instâncias AND Templates) are guarded behind {#if activeTab === ...}, unlike ProjetosSection.svelte where only the second tab needs the guard (its default 'detalhe' tab is a bespoke master/detail UI, not a direct EntityScreen mount) -- both of RotinasSection's tabs mount an EntityScreen directly, so both need it to avoid two simultaneous <h2> elements on first load."
  - "Templates tab's context paragraph text: 'Configuração que gera as instâncias.' (capitalized, punctuated) -- CONTEXT.md/RESEARCH.md/spec-ui.md §2.3 all quote the phrase in lowercase mid-sentence ('...com um parágrafo de contexto (\"configuração que gera as instâncias\")'), which is a description of the required substring, not a verbatim UI string mandate. The e2e assertion matches case-insensitively (/configuração que gera as instâncias/i) so this stylistic choice cannot regress against the source of truth."

patterns-established: []

requirements-completed: [NEST-04]

coverage:
  - id: D1
    description: "Rotinas section shows an Instâncias tab (default) and a Templates tab, with Instâncias keeping zero create/delete affordance"
    requirement: "NEST-04"
    verification:
      - kind: e2e
        ref: "web/e2e/rotinas-section.spec.ts#NEST-04: Rotinas shows Instâncias by default (no create/delete affordance) and Templates (with context paragraph) as two tabs"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-rotina-log.spec.ts#WEB-07: instanciasRotina offers no create, no delete, and status-only edit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Templates tab shows the static context paragraph ('configuração que gera as instâncias') above the unmodified templatesRotina table"
    requirement: "NEST-04"
    verification:
      - kind: e2e
        ref: "web/e2e/rotinas-section.spec.ts#NEST-04: Rotinas shows Instâncias by default (no create/delete affordance) and Templates (with context paragraph) as two tabs"
        status: pass
    human_judgment: false
  - id: D3
    description: "gotoNested(page, 'templatesRotina') lands on the Templates tab with zero call-site changes required in entities-rotina-log.spec.ts's WEB-06 test"
    requirement: "NEST-04"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-rotina-log.spec.ts#WEB-06: templatesRotina full CRUD, including the self-referential antecessor link"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shell.svelte routes rota.etype === 'instanciasRotina' to RotinasSection instead of the generic EntityScreen fallback, with zero regression to the other 5 nav destinations"
    verification:
      - kind: e2e
        ref: "web/e2e/shell-nav.spec.ts (all 5 tests, including 'each nav Button renders its corresponding EntityScreen' and 'NAV-02: no first-level nav path for etapas/tarefas/templatesRotina/subtarefas...')"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-11
status: complete
---

# Phase 20 Plan 02: RotinasSection Instâncias/Templates Tabs Summary

**`RotinasSection.svelte` -- a `Tabs.Root` wrapper reusing `ProjetosSection.svelte`'s proven tab-guard pattern, wired into `Shell.svelte`'s router, with a zero-call-site-edit `gotoNested.ts` extension for the existing `templatesRotina` CRUD test.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-11T19:14:51-03:00 (Task 1 commit)
- **Completed:** 2026-08-11T19:17:25-03:00 (Task 2 commit)
- **Tasks:** 2/2
- **Files modified:** 4 (1 created component, 1 created e2e spec, 2 router/helper edits)

## Accomplishments

- `RotinasSection.svelte`: a `Tabs.Root` wrapper with two tabs -- Instâncias (default, unchanged `EntityScreen(instanciasRotinaConfig)`, `capabilities.create`/`.delete` still `false`) and Templates (unchanged `EntityScreen(templatesRotinaConfig)` plus a static "Configuração que gera as instâncias." context paragraph). Both `Tabs.Content` blocks are guarded behind `{#if activeTab === ...}` since bits-ui's installed `Tabs.Content` mounts both tabs' children immediately (setting `hidden` on the inactive one, never unmounting) -- without the guard both `EntityScreen` instances would render their own `<h2>` simultaneously, breaking `shell-nav.spec.ts`'s strict single-`<h2>` assertion.
- `Shell.svelte` gained one router branch (`rota.etype === "instanciasRotina"` -> `RotinasSection`), mirroring the existing `"projetos"`/`"tickets"` branches, ahead of the generic fallback.
- `gotoNested.ts` gained a `templatesRotina` branch (click `nav-instanciasRotina`, then `rotinas-tab-templates`) mirroring the `etapas`/`tarefas` precedent -- `entities-rotina-log.spec.ts`'s WEB-06 test now lands through `RotinasSection`'s Templates tab with zero edits to that spec file.
- `web/e2e/rotinas-section.spec.ts`: 1 new test covering NEST-04 -- default tab, zero create/delete affordance on Instâncias, tab switch to Templates showing the context paragraph.
- Full regression sweep (below) confirms zero breakage of `shell-nav.spec.ts`, `entities-rotina-log.spec.ts` (all 3 tests, including WEB-06/WEB-07), and `tickets-section.spec.ts` (all 4 tests from the concurrently-executing 20-01 plan).

## Task Commits

1. **Task 1: RotinasSection.svelte -- Instâncias/Templates tabs, wired into Shell** -- `eb75e74` (feat)
2. **Task 2: gotoNested.ts templatesRotina branch -- zero call-site changes in entities-rotina-log.spec.ts** -- `1c7d1bc` (feat)

**Plan metadata:** committed together with this SUMMARY (see Final Commit below).

## Files Created/Modified

- `web/src/lib/sections/RotinasSection.svelte` -- Tabs.Root wrapper: Instâncias (default) + Templates tabs, each guarding its `EntityScreen` mount behind `{#if activeTab === ...}`.
- `web/src/lib/Shell.svelte` -- added `rota.etype === "instanciasRotina"` branch mounting `RotinasSection`, mirroring the `"projetos"`/`"tickets"` branches.
- `web/e2e/helpers/gotoNested.ts` -- added `templatesRotina` branch; updated the file's own header comment to reflect that `templatesRotina` (like `etapas`/`tarefas` before it) no longer falls through to the interim `nested-goto` dropdown, leaving only `subtarefas` unmigrated (per 20-RESEARCH.md Pitfall 3, deferred to a later plan).
- `web/e2e/rotinas-section.spec.ts` -- new spec, 1 test, covering NEST-04's default-tab/no-affordance/context-paragraph assertions.

## Decisions Made

1. **No `RotinasSection`-level `<h2>`.** Per the plan's own action text (informed by 20-01-SUMMARY.md's identical finding for `TicketsSection`), `EntityScreen(instanciasRotinaConfig)`'s own unconditional `<h2>{config.titulo}</h2>` ("Instâncias de rotina") already satisfies `shell-nav.spec.ts`'s `EXPECTED_H2_BY_TESTID["nav-instanciasRotina"]` assertion -- adding a second heading would break it the instant both tabs mount. Followed as specified; not a deviation.
2. **Guarded BOTH `Tabs.Content` blocks, not just one.** Unlike `ProjetosSection.svelte` (only its "todas" tab needs the `{#if}` guard, since its default "detalhe" tab is a bespoke master/detail UI, not a direct `EntityScreen` mount), both of `RotinasSection`'s tabs mount an `EntityScreen` directly -- both needed the guard, exactly as the plan's action text called for.
3. **Context paragraph text: "Configuração que gera as instâncias."** CONTEXT.md/RESEARCH.md/spec-ui.md §2.3 all quote the required phrase in lowercase as part of a descriptive sentence ("...com um parágrafo de contexto (\"configuração que gera as instâncias\")"), not as a verbatim UI string. Chose a capitalized, punctuated sentence for the actual rendered `<p>`, and wrote the e2e assertion as a case-insensitive regex (`/configuração que gera as instâncias/i`) so this stylistic choice can never regress against the binding source text.

## Deviations from Plan

None -- plan executed exactly as written. Both 20-01-SUMMARY.md's prior finding (no separate `<h2>`) and 20-RESEARCH.md's own characterization of this half of the phase as having "no open technical gap" held true: every task action in the plan worked on the first attempt with zero auto-fixes needed.

## Issues Encountered

None. This plan ran concurrently with 20-03 in the same working tree (20-03 modifies `web/src/lib/sections/ProjetosSection.svelte`, disjoint from this plan's `files_modified`). Staged and committed files individually and by exact path at every commit (never `git add -A`/`git add .`) to avoid picking up 20-03's uncommitted, in-progress edits to that file -- confirmed via `git diff --stat 3d876c5..HEAD` (the commit immediately preceding this plan's Task 1) that only the 4 files in this plan's `files_modified` frontmatter changed across both of this plan's commits.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `RotinasSection.svelte` is a self-contained, complete deliverable -- no follow-up work from this plan is needed by 20-04/20-05.
- `gotoNested.ts`'s `subtarefas` branch remains unmigrated, as flagged by 20-RESEARCH.md Pitfall 3 -- its 6+ call sites in `entities-ticket-subtarefa.spec.ts` need individual, parent-id-aware rewrites in a later plan of this phase, not a `gotoNested.ts` body extension (out of scope here, confirmed correctly deferred).
- No blockers for any other plan in this phase.

## Self-Check: PASSED

All claimed files exist on disk and both task commit hashes resolve in `git log --oneline --all`:
- FOUND: `web/src/lib/sections/RotinasSection.svelte`
- FOUND: `web/src/lib/Shell.svelte`
- FOUND: `web/e2e/helpers/gotoNested.ts`
- FOUND: `web/e2e/rotinas-section.spec.ts`
- FOUND: `.planning/phases/20-rotinas-tickets-sections/20-02-SUMMARY.md`
- FOUND: `eb75e74` (Task 1 commit)
- FOUND: `1c7d1bc` (Task 2 commit)

---
*Phase: 20-rotinas-tickets-sections*
*Completed: 2026-08-11*
