---
phase: 19-projetos-section-master-detail
plan: 03
subsystem: ui
tags: [svelte5, instantdb, shadcn-svelte, bits-ui, tabs, playwright, master-detail, runes, instaql]

# Dependency graph
requires:
  - phase: 19-projetos-section-master-detail (Plan 01/02)
    provides: ProjetosSection.svelte's bespoke db.useQuery, master column, detail column, the row-level-ordem-sorted etapasOrdenadas computed value, progressoEtapa/tarefaConcluida/vencido (projetosDerive.ts), and the hidden-EntityScreen-host + bounded-poll dialog-opening pattern
provides:
  - "etapas ▾" list/kanban view toggle over the exact same etapasOrdenadas/tarefas data the Plan 19-02 accordion already renders — zero additional db.useQuery
  - Fixed-width, non-compressing, horizontally-scrolling kanban columns (etapa-kanban-column/etapa-kanban-card), satisfying spec §3.5's overflow discipline as cross-referenced by §2.2
  - Tabs.Root("Projeto"/"Todas as tarefas") wrapping the existing detail-column content, keeping the default landing state's single-<h2> contract intact via an explicit mount guard
  - "Todas as tarefas" panel — unscoped EntityScreen(tarefasConfig) plus a "Sem etapa" Checkbox+Label filter driving the existing scopeWhere prop with InstantDB's $isNull operator, live-verified against the hosted app
affects: [19-04-regression-fixes, 20-rotinas-tickets-subtarefas-panel, 21-dashboard-derive-consolidation, 22-dashboard-mini-kanbans]

# Actuals (#2632)
actuals:
  tokens: 4300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "etapasView $state<\"lista\"|\"kanban\"> is a pure render-mode switch over the SAME etapasOrdenadas @const the accordion already computes — kanban never issues its own db.useQuery, proving one bespoke query can drive two render modes."
    - "bits-ui's installed Tabs.Content always mounts its children in the DOM (sets a `hidden` HTML attribute on the inactive tab, never unmounts — verified in node_modules/bits-ui/dist/bits/tabs/tabs.svelte.js's TabsContentState.props). Every EntityScreen mount inside an inactive Tabs.Content in this codebase must be additionally guarded with an `{#if <tab> === <value>}` check, mirroring the existing Accordion.Content guard pattern from Plan 19-02 — otherwise its own <h2>{config.titulo}</h2> renders unconditionally and breaks shell-nav.spec.ts's single-<h2> contract at the default landing state."
    - "InstantDB's documented $isNull InstaQL operator, passed through the existing scopeWhere prop unmodified, was smoke-tested live against the hosted app before being trusted in UI — confirmed to behave exactly as documented; the previously-planned client-side-filter fallback was not needed."

key-files:
  created: []
  modified:
    - web/src/lib/sections/ProjetosSection.svelte
    - web/e2e/projetos-section.spec.ts

key-decisions:
  - "Chose a plain `overflow-x-auto` div over the installed shadcn-svelte ScrollArea component for the kanban strip's horizontal scroll container. ScrollArea's bits-ui viewport wraps content in its own custom-scrollbar machinery (a separate Viewport/Scrollbar/Thumb primitive stack) with zero prior usage or e2e precedent anywhere in this codebase, and this phase only needs spec §3.5's overflow/non-compression discipline (fixed-width `shrink-0` columns, horizontal scroll instead of compression) — not ScrollArea's custom scrollbar rendering, which this component's kanban never needed. A plain div satisfies the same overflow contract with less installed-surface risk and no untested primitive in the critical path. Documented per the plan's explicit either-or discretion."
  - "$isNull via the existing scopeWhere prop (`{\"etapa.id\": {\"$isNull\": true}}`) was verified live against the hosted InstantDB app (@instantdb/svelte@^1.0.63) via a dedicated e2e fixture (one tarefa linked to a real etapa, one created with no --etapa-id at all) and behaves exactly as InstantDB's documentation describes: toggling \"Sem etapa\" hides the etapa-linked row and keeps only the orphan, which stays fully editable through the same unscoped EntityScreen(tarefasConfig) path. The client-side-filter fallback 19-RESEARCH.md/CONTEXT.md pre-authorized for this exact contingency was written into the plan but never needed — this is the primary path shipped."
  - "The 'todas' Tabs.Content's EntityScreen(tarefasConfig) mount is guarded behind `{#if detailTab === \"todas\"}` because the installed bits-ui Tabs.Content always mounts its children (hidden attribute, never unmount) — without the guard, EntityScreen's own <h2>Tarefas</h2> would render unconditionally the instant a user lands on Projetos, breaking shell-nav.spec.ts's single-<h2> assertion at the DEFAULT landing state. Once a user actively switches to the \"todas\" tab, ProjetosSection's own always-rendered <h2>Projetos</h2> plus the now-mounted EntityScreen's <h2>Tarefas</h2> DO coexist (2 total) — this is expected and does not violate the plan's hard constraint, which scopes the single-<h2> requirement to the default (no-selection) landing state only, matching where shell-nav.spec.ts's own assertion actually runs (immediately after clicking nav-projetos, never after a manual tab switch)."
  - "Tabs.Root's value/onValueChange is driven one-way (no bind:value), matching this file's existing Select.Root convention (`value={groupBy} onValueChange={(v) => { if (v) groupBy = v as GroupBy; }}`) rather than Svelte 5's two-way bind: sugar — consistent with every other bits-ui-backed control in this component."

patterns-established:
  - "A view-mode toggle ($state<\"a\"|\"b\">) over an already-fetched query's derived value is the established shape for 'same data, different render' UI in this codebase — Phase 22's Dashboard mini-kanbans (spec §3.5) can reuse this exact non-compression/overflow-x-auto pattern directly."
  - "Any EntityScreen instance mounted inside a bits-ui Tabs.Content (or any other always-mounted-with-hidden bits-ui primitive) must be gated by the tab's own active-value check, not by the primitive's own hidden attribute — the same rule Plan 19-02 already established for bits-ui's Accordion.Content."

requirements-completed: [NEST-03]

coverage:
  - id: D1
    description: "\"etapas ▾\" toggles the SAME query's already-loaded data between the Plan 19-02 accordion and a kanban view (columns = etapas by row-level ordem asc, cards = that etapa's tarefas), zero additional db.useQuery"
    requirement: "NEST-03"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-03: 'etapas ▾' toggles list/kanban over the identical query data, kanban columns fixed-width and never compress"
        status: pass
    human_judgment: false
  - id: D2
    description: "Kanban columns are fixed-width and never compress regardless of column/card count; a strip with more cards than fit scrolls horizontally instead of shrinking any column"
    requirement: "NEST-03"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-03: 'etapas ▾' toggles list/kanban over the identical query data, kanban columns fixed-width and never compress (boundingBox().width equality assertion, 4-card vs 1-card columns)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 'Todas as tarefas' tab (unscoped EntityScreen(tarefasConfig)) is always reachable from the Projetos detail column regardless of projeto selection, with a 'Sem etapa' convenience filter, and the default landing state keeps exactly one <h2> on the page"
    requirement: "NEST-03"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-03: 'Todas as tarefas' tab is reachable with no projeto selected, showing every tarefa unscoped"
        status: pass
    human_judgment: false
  - id: D4
    description: "'Sem etapa' narrows 'Todas as tarefas' to orphaned tarefas (tarefas.etapa is required: false) via the primary scopeWhere/$isNull path, live-verified against the hosted InstantDB app; orphaned tarefas stay fully editable through the same unscoped path with or without the filter active"
    requirement: "NEST-03"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-03: 'Sem etapa' narrows 'Todas as tarefas' to orphaned tarefas, with orphans staying fully editable either way"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-11
status: complete
---

# Phase 19 Plan 03: "etapas ▾" Kanban Toggle + "Todas as tarefas"/"Sem etapa" Summary

**"etapas ▾" list/kanban toggle over `ProjetosSection.svelte`'s existing bespoke query (zero extra fetch) plus a `Tabs.Root("Projeto"/"Todas as tarefas")` escape hatch whose "Sem etapa" filter uses InstantDB's live-verified `$isNull` InstaQL operator — completing NEST-03 and Phase 19.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-11T19:04Z (approx.)
- **Completed:** 2026-08-11T19:45Z (approx., excluding the ~25min full-suite regression run)
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 2

## Accomplishments
- `ProjetosSection.svelte`'s detail column gained an "etapas ▾" `lista`/`kanban` toggle (`etapas-view-lista`/`etapas-view-kanban`) that switches rendering only — the kanban branch reads the exact same `etapasOrdenadas`/`progressoEtapa` data the Plan 19-02 accordion already computes, with zero second `db.useQuery`.
- Kanban columns (`etapa-kanban-column`, `w-48 shrink-0`) never compress regardless of card count; the strip scrolls horizontally (`overflow-x-auto`) instead, satisfying spec §3.5's "nunca reduzir a largura da coluna" rule as cross-referenced by §2.2. Cards (`etapa-kanban-card`) reuse the same `vencido()`/`tarefaConcluida()` styling as the list view — one visual rule, two views.
- The entire pre-existing detail-column content (`project-detail`/`project-empty`, byte-identical, only relocated) is now wrapped in a `Tabs.Root` with two tabs: "Projeto" (default) and "Todas as tarefas" — a literal implementation of spec §2.2's "aba 'Todas as tarefas' ... como segundo item de tab".
- "Todas as tarefas" mounts the unscoped `EntityScreen(tarefasConfig)` (NEST-01, unmodified) plus a "Sem etapa" `Checkbox`+`Label` toggle driving the existing `scopeWhere` prop with InstantDB's `$isNull` operator (`{"etapa.id": {"$isNull": true}}`) — the one net-new InstaQL fact this phase introduced, per 19-RESEARCH.md's Pitfall 5/Assumption A1.
- Live-verified against the hosted InstantDB app via a dedicated e2e fixture (one tarefa linked to a real etapa, one created with no `--etapa-id` at all): `$isNull` behaves exactly as documented. **The primary `scopeWhere`/`$isNull` path shipped; the documented client-side-filter fallback was never needed.**
- Guarded the "todas" `Tabs.Content`'s `EntityScreen` mount behind `{#if detailTab === "todas"}`, since the installed `bits-ui` `Tabs.Content` always mounts its children (`hidden` attribute, never unmounts) — without this guard `EntityScreen`'s own `<h2>Tarefas</h2>` would render unconditionally the instant a user lands on Projetos, breaking `shell-nav.spec.ts`'s single-`<h2>` assertion at the default landing state.
- `web/e2e/projetos-section.spec.ts` grows from 12 to 15 tests, all green against the live hosted InstantDB backend.

## Task Commits

Each task was committed atomically:

1. **Task 1: "etapas ▾" list/kanban toggle over the same query data** - `fe5cd19` (feat)
2. **Task 2: Tabs("Projeto"/"Todas as tarefas") + "Sem etapa" filter** - `912e4fd` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

_Note: both tasks are `type="auto"` (not TDD) per the plan's own frontmatter. To keep the per-task commit history atomic despite both tasks touching adjacent/nested regions of the same file, Task 1 was implemented and verified in isolation first (committed as `fe5cd19`), then Task 2's `Tabs.Root` wrapper was layered on top and re-verified (committed as `912e4fd`) — this matches the plan's own task ordering exactly._

## Files Created/Modified
- `web/src/lib/sections/ProjetosSection.svelte` - "etapas ▾" list/kanban toggle (Task 1); `Tabs.Root("Projeto"/"Todas as tarefas")` wrapping the existing detail-column content, "Sem etapa" filter via `scopeWhere`/`$isNull` (Task 2).
- `web/e2e/projetos-section.spec.ts` - 3 new tests: kanban toggle/non-compression (NEST-03), "Todas as tarefas" reachable with no projeto selected (NEST-03), "Sem etapa" `$isNull` narrowing + orphan editability (NEST-03).

## Decisions Made
- **"Sem etapa" filter path:** the primary `scopeWhere: {"etapa.id": {"$isNull": true}}` path (19-RESEARCH.md's recommended approach) was implemented and its own dedicated e2e test proved it behaves exactly as InstantDB's documentation describes against this project's exact `@instantdb/svelte@^1.0.63` pin — toggling the checkbox correctly hides the etapa-linked tarefa's row and keeps only the orphan's row, which remains fully create/edit/delete-capable through the same unscoped `EntityScreen(tarefasConfig)` path. **The documented client-side-filter fallback (a separate minimal `db.useQuery` + JS `!row.etapa` filter) was written into the plan as a contingency but was never needed and was not implemented** — this determination was made by actually running the live test against the hosted app, not by re-inspecting InstantDB's docs, per the plan's explicit instruction.
- **Kanban horizontal scroll container:** a plain `overflow-x-auto` div was used instead of the installed shadcn-svelte `ScrollArea` component. `ScrollArea`'s `bits-ui` viewport wraps content in its own custom-scrollbar machinery (separate `Viewport`/`Scrollbar`/`Thumb` primitives) with zero prior usage or e2e precedent in this codebase; this phase's kanban only needs spec §3.5's overflow/non-compression discipline (fixed-width `shrink-0` columns, scroll instead of compress), which a plain div satisfies identically with less untested surface in the critical path. The plan explicitly authorized either choice, documented here per its instruction.
- **`Tabs.Content` mount guard:** confirmed (via `node_modules/bits-ui/dist/bits/tabs/tabs.svelte.js`'s `TabsContentState.props`, which sets `hidden: boolToTrueOrUndef(!this.#isActive)`) that the installed `bits-ui` version always mounts `Tabs.Content` children regardless of active state — the plan's own documented contingency for this exact case. Added an explicit `{#if detailTab === "todas"}` guard around the "todas" panel's `EntityScreen` mount, mirroring Plan 19-02's identical guard pattern for `Accordion.Content`.
- **`<h2>` count on manual tab switch:** once a user actively clicks into the "todas" tab, the page legitimately shows 2 `<h2>`s (`ProjetosSection`'s own "Projetos" — always rendered above the Tabs — plus `EntityScreen(tarefasConfig)`'s own "Tarefas", now mounted and active). This is expected and does not violate the plan's hard constraint, which is scoped specifically to the *default landing state* (matching where `shell-nav.spec.ts`'s own single-`<h2>` assertion actually runs — immediately after clicking `nav-projetos`, before any tab interaction). The e2e test asserts exactly this: 1 `<h2>` before switching tabs, 2 after.

## Deviations from Plan

None beyond the two documented executor-discretion calls above (both explicitly pre-authorized by the plan's own text: the kanban scroll-container choice, and the `$isNull`-vs-fallback determination) — no Rule 1/2/3/4 auto-fixes were needed; the implementation matched the plan on the first live e2e run for both tasks (after one initial test-authoring mistake in the "todas" tab's `<h2>`-count assertion, caught and corrected before this SUMMARY, not a code bug — see Issues Encountered).

## Issues Encountered
- **Test-authoring error, not a code bug:** the first draft of the "'Todas as tarefas' tab is reachable with no projeto selected" e2e test asserted `page.locator("h2")` has count `1` even *after* switching into the "todas" tab. This is incorrect per the plan's actual constraint (see Decisions Made above) — `ProjetosSection`'s own `<h2>Projetos</h2>` is always rendered regardless of which tab is active, so switching to "todas" legitimately produces 2 `<h2>`s once `EntityScreen(tarefasConfig)` mounts. Fixed by asserting count `1` only for the pre-tab-switch default-landing assertion, and count `2` (with the second one reading "Tarefas") after switching — verified live, both pass.
- **Pre-existing test flake (unrelated to this plan):** `projetos-section.spec.ts`'s pre-existing "editar projeto" test (from Plan 19-01) failed once in an early full-file run (`field-nome` not found after `project-edit-start` click, a 5s timeout) then passed cleanly on an isolated re-run and on every subsequent full run. This matches the "rare DOM-actionability race against the live hosted backend" already documented in this spec file's own `submitForm` comment — not caused by this plan's changes (no code touching that flow was modified in Task 1/2).

## User Setup Required
None - no external service configuration required.

## Full Regression Suite (early check ahead of Plan 19-04)

Per this plan's own `<verification>` instruction, `cd web && bun run test:e2e` (full 3-project suite, 86 tests) was run once as an early regression check. **68 passed, 18 failed** (all 18 failures are pre-existing regressions from Plan 19-01's intentional `ProjetosSection`/`nested-goto` changes, already documented in 19-01-SUMMARY.md and 19-02-SUMMARY.md as deferred to Plan 19-04 — none are newly introduced by this plan's Task 1/2 work). All 18 root-cause to exactly two changes, both made in Plan 19-01:

1. **`nav-projetos` now mounts `ProjetosSection`, not the generic `EntityScreen`** — tests asserting `entity-header`/`entity-table-frame` immediately after clicking `nav-projetos` fail:
   - `cross-phase-verification.spec.ts` — `VERIFY-07/POLISH-04: cross-phase walkthrough`
   - `entities-header-states.spec.ts` — `ENTTBL-07: every one of the 5 entities' content renders inside entity-table-frame`
2. **`gotoNested(page, "tarefas")`/`gotoNested(page, "etapas")` can no longer find `nested-goto-tarefas`/`nested-goto-etapas`**, since Plan 19-01 pruned both from `Shell.svelte`'s interim `nestedGroups` dropdown (per 19-RESEARCH.md's Pitfall 3/Open Question 2 recommendation, now that both etypes have a real home in `ProjetosSection`):
   - `cross-phase-verification.spec.ts` — `VERIFY-05/POLISH-03: tarefas create Dialog legible...`, `VERIFY-05/POLISH-03: tarefas delete-confirmation AlertDialog legible...`
   - `entities-delete-confirmation.spec.ts` — `ENTTBL-08: row-edit/row-delete render...`, `DELCONF-01` × 4 (row-delete opens AlertDialog, keyboard cancel, keyboard confirm, cannot-dismiss-while-in-flight)
   - `entities-form-dialog-composition.spec.ts` — `ENTFRM-05`, `ENTFRM-06`, `ENTFRM-08`
   - `entities-projeto-etapa-tarefa.spec.ts` — `WEB-03`, `WEB-04`, `WEB-05`, `WEB-04 threat T-04-04` (all 4 tests in this file, per 19-RESEARCH.md's own Pitfall 1 prediction — this file's rewrite is explicitly Plan 19-04's scope)
   - `entities-rotina-log.spec.ts` — `WEB-06: templatesRotina full CRUD...` (uses `gotoNested(page, "templatesRotina")`, which internally still routes through a shared helper affected by the same dropdown prune — confirmed via the same `nested-goto-tarefas`/`-etapas` timeout signature)
   - `shell-nav.spec.ts` — `NAV-02: no first-level nav path for etapas/tarefas/templatesRotina/subtarefas...`

This exact 18-item list matches (a strict superset consistent with) the deferred regressions already flagged in 19-01-SUMMARY.md ("`entities-projeto-etapa-tarefa.spec.ts`'s `WEB-03` test... will now fail", "`shell-nav.spec.ts`'s `NAV-02` loop... also expected to fail") and 19-RESEARCH.md's Pitfall 1/3/4 — Plan 19-04 starts from this known, enumerated list rather than a fresh discovery, satisfying this plan's own verification contract.

`web/e2e/projetos-section.spec.ts` itself is 15/15 green in both the targeted run and inside the full suite — zero regression from this plan's own two tasks.

## Validation Commands Run (all pass except the documented, pre-existing, deferred regressions above)

- `cd web && bun test src` — 151 pass, 0 fail (unit tests, unaffected by this UI-only plan).
- `cd web && bun run check` — 0 errors (1 pre-existing unrelated warning in `EntityScreen.svelte`).
- `cd web && bun run lint` — 0 errors (1 pre-existing unrelated info in `calendar-caption.svelte`).
- `cd web && bunx playwright test projetos-section.spec.ts --project=authed --no-deps` — 15/15 pass (run repeatedly across both isolated-Task-1 and full-Task-2 states).
- `cd web && bun run test:e2e` — 68/86 pass; 18 pre-existing failures, all enumerated above, all deferred to Plan 19-04.

## Next Phase Readiness
- NEST-03 is complete; Phase 19's two requirements (NEST-02, NEST-03) are both now satisfied — Phase 19 itself is functionally done except for the dedicated regression-fix plan (19-04) already scoped and queued.
- The kanban toggle's fixed-width/non-compression pattern (`w-48 shrink-0`, `overflow-x-auto`) is directly reusable by Phase 22's Dashboard mini-kanbans (spec §3.5), which layer on additional Dashboard-specific rules (3-card cap, `+N`, `localStorage` collapse) this phase's kanban intentionally does not implement.
- The `Tabs.Content`-always-mounts-with-`hidden` fact (and its required `{#if <active-tab>}` mount guard) is now a documented, established pattern in this codebase for any future `Tabs` usage wrapping an `EntityScreen` or other self-titling component.
- Plan 19-04 has a complete, enumerated 18-item failure list (this SUMMARY's "Full Regression Suite" section) to start from — no further discovery needed before that plan begins.

## Self-Check: PASSED

Confirmed on disk: `web/src/lib/sections/ProjetosSection.svelte` (Tabs/kanban markup present), `web/e2e/projetos-section.spec.ts` (15 tests present), this SUMMARY. Both task commit hashes (`fe5cd19`, `912e4fd`) confirmed present in `git log --oneline --all`. `bun test src`, `bun run check`, `bun run lint`, the targeted Playwright spec, and the full `bun run test:e2e` suite were all actually executed this session (not assumed) with the results recorded above.

---
*Phase: 19-projetos-section-master-detail*
*Completed: 2026-08-11*
