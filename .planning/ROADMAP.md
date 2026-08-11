# Roadmap: Apollo v2

## Milestones

- 🚧 **v1.3 Navegação reorganizada + Dashboard de acompanhamento** — Phases 18-23 (in progress)
- ✅ **v1.2 Lapidação de UI (SaaS-grade polish)** — Phases 12-17 (shipped 2026-08-10)
- ✅ **v1.1 UI bonita com Tailwind + shadcn-svelte** — Phases 7-11 (shipped 2026-08-10)
- ✅ **v1.0 Apollo v2 MVP** — Phases 1-6 (shipped 2026-08-09)

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order. Phase numbering is
continuous across milestones — v1.1 continued from v1.0's Phase 6, starting at Phase 7; v1.2
continued from v1.1's Phase 11, starting at Phase 12; v1.3 continues from v1.2's Phase 17,
starting at Phase 18.

<details>
<summary>✅ v1.0 Apollo v2 MVP (Phases 1-6) — SHIPPED 2026-08-09</summary>

- [x] Phase 1: Repo Scaffold & Live Schema (3/3 plans) — completed 2026-08-09
- [x] Phase 2: Shared ANBIMA Calendar (3/3 plans) — completed 2026-08-09
- [x] Phase 3: CLI Auth & CRUD (6/6 plans) — completed 2026-08-09
- [x] Phase 4: Web SPA Auth & CRUD Smoke UI (6/6 plans) — completed 2026-08-09
- [x] Phase 5: Idempotent Routine-Instance Job (6/6 plans) — completed 2026-08-09
- [x] Phase 6: End-to-End Verification (3/3 plans) — completed 2026-08-09

Full detail archived at `.planning/milestones/v1.0-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.1 UI bonita com Tailwind + shadcn-svelte (Phases 7-11) — SHIPPED 2026-08-10</summary>

- [x] Phase 7: Design System Setup (1/1 plans) — completed 2026-08-09
- [x] Phase 8: Auth & Shell Restyle (1/1 plans) — completed 2026-08-09
- [x] Phase 9: Entity Table Restyle (1/1 plans) — completed 2026-08-09
- [x] Phase 10: Entity Form Restyle & Feedback (4/4 plans) — completed 2026-08-10
- [x] Phase 11: Full Verification & Quality Gates (1/1 plans) — completed 2026-08-10

Full detail archived at `.planning/milestones/v1.1-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.2 Lapidação de UI (SaaS-grade polish) (Phases 12-17) — SHIPPED 2026-08-10</summary>

- [x] Phase 12: Login Screen Polish (1/1 plans) — completed 2026-08-10
- [x] Phase 13: Shell Chrome — Header, Nav & Content Frame (1/1 plans) — completed 2026-08-10
- [x] Phase 14: Entity Screen — Header, Loading & Empty States (2/2 plans) — completed 2026-08-10
- [x] Phase 15: Entity Screen — Form & Dialog Composition (1/1 plans) — completed 2026-08-10
- [x] Phase 16: Entity Screen — Row Actions & Delete Confirmation (2/2 plans) — completed 2026-08-10
- [x] Phase 17: Cross-Phase Verification & Quality Gates (2/2 plans) — completed 2026-08-10

Full detail archived at `.planning/milestones/v1.2-ROADMAP.md`.

</details>

### 🚧 v1.3 Navegação reorganizada + Dashboard de acompanhamento (Phases 18-23)

**Milestone goal:** Reorganize the SPA's navigation into a 6-section topbar (Dashboard, Rotinas,
Tickets, Projetos, Fundos, Log) that removes `etapas`, `templatesRotina`, `subtarefas`, and
`tarefas` as first-level destinations (nested-only), and ship a new Dashboard landing screen —
weekly business-day calendar, ticket queue, fundo-grouped routines, monthly workload heatmap,
per-project mini-kanbans, and a 7-dialog focus system. UI and organization only: zero schema,
`instant.perms.ts`, CLI, or `routineJob.ts` changes; zero human UAT anywhere in the milestone
(per PROJECT.md Context — this project runs fully autonomously).

- [x] **Phase 18: Navigation Foundation & EntityScreen Extension** - 6-section topbar with nested entities hidden from first level, `EntityScreen` gains additive `scopeWhere`/`presetLinks` with proven zero-regression behavior (completed 2026-08-11)
- [x] **Phase 19: Projetos Section (Master-Detail)** - Projects grouped by fundo with etapas/tasks inline in the detail column, plus a "Todas as tarefas" escape hatch for orphaned tasks (completed 2026-08-11)
- [ ] **Phase 20: Rotinas & Tickets Sections** - Instâncias/Templates tabs for Rotinas; Tickets and Tarefas share one inline subtarefas panel with the parent pre-resolved
- [ ] **Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue** - Pure unit-tested `derive.ts`, single-query `dashboardQuery.ts`, the Dashboard's 3-column grid shell, weekly business-day calendar, and pending-ticket queue
- [ ] **Phase 22: Dashboard Kanbans, Rotinas & Heatmap** - Per-project mini-kanban strips with non-compressing columns, fundo-grouped weekly routines, and the 5-band monthly workload heatmap
- [ ] **Phase 23: Focus Dialog System** - All 7 read-first focus dialogs, every Dashboard/section surface wired as a real keyboard-accessible `<button>`, max navigation depth of 2

## Phase Details

### Phase 18: Navigation Foundation & EntityScreen Extension

**Goal**: Users see a reorganized 6-section topbar that hides internal-detail entities from
first-level navigation and land on the Dashboard route by default, while `EntityScreen` and
`registry.ts` gain fully additive, zero-regression nested-scoping support that later phases will
build on.
**Depends on**: Phase 17 (previous milestone baseline; first phase of v1.3)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NEST-01, NEST-06
**Success Criteria** (what must be TRUE):

  1. The topbar shows exactly 6 items, in order: Dashboard, Rotinas, Tickets, Projetos, Fundos, Log (NAV-01; spec §10 Navegação #1).
  2. No first-level nav control exists for Etapas, Templates de rotina, Subtarefas, or Tarefas — only the 6 primary items are reachable from the topbar (NAV-02; spec §10 Navegação #2).
  3. On authenticated app load, the active route is the Dashboard section, never an entity screen (NAV-03; spec §10 Navegação #4).
  4. `registry.ts`'s `navConfigs` selector is derived from `entityConfigs` filtering on the new `EntityConfig.nav`/`navTitulo` fields, with no hand-maintained entity list anywhere in the file (NAV-04; spec §10 Navegação #3).
  5. The pre-existing Playwright suite passes for Fundos and Log completely unmodified (NEST-06), every spec that used the 4 removed nav testids now passes via a new `gotoNested` helper with zero remaining reference to `nav-etapas`/`nav-templatesRotina`/`nav-subtarefas`/`nav-tarefas` (NAV-05), and `EntityScreen.svelte` with `scopeWhere`/`presetLinks` both `null` behaves byte-identically to before — proven by the full pre-existing e2e suite passing without edits and zero `if (config.etype === ...)` branches introduced (NEST-01; spec §10 Aninhamento #6, Disciplina visual #4).

**Plans**: 3/3 plans executed

Plans:

- [x] 18-01-PLAN.md — Navigation data model (types/registry/defs), Shell topbar Route + Dashboard mount, interim nested-entity affordance + gotoNested helper (NAV-01, NAV-02, NAV-03, NAV-04, NEST-06)
- [x] 18-02-PLAN.md — EntityScreen additive scopeWhere/presetLinks extension, zero-regression proof (NEST-01)
- [x] 18-03-PLAN.md — e2e regression migration: wildcard nav-count fixes + 27-call-site gotoNested migration (NAV-05, NEST-06)

**UI hint**: yes

### Phase 19: Projetos Section (Master-Detail)

**Goal**: Users can browse every project grouped by fundo, drill into a selected project's
etapas and tasks without leaving the Projetos section, and still reach tasks that have no etapa.
**Depends on**: Phase 18
**Requirements**: NEST-02, NEST-03
**Success Criteria** (what must be TRUE):

  1. The Projetos section's left column lists all projects grouped by fundo, with a name search and a group-by display control, and the "Sem fundo vinculado" group always sorted last (NEST-02; spec §10 Aninhamento #5).
  2. Selecting a project shows its etapas as collapsible rows ordered by `etapas.ordem` ascending, one etapa open at a time (accordion single), each showing that etapa's own tasks inline (NEST-02; spec §10 Aninhamento #1).
  3. An "etapas ▾" toggle switches the same etapa data between a list layout and a kanban layout (NEST-03).
  4. A "Todas as tarefas" tab (no `scopeWhere`) lists every task across all projects, with a "Sem etapa" convenience filter that makes orphaned tasks (no etapa link) reachable and editable (NEST-03; spec §10 Aninhamento #4).

**Plans**: 4/4 plans executed

Plans:

- [x] 19-01-PLAN.md — Master column (browse/group/search/create) + Shell mount point (NEST-02)
- [x] 19-02-PLAN.md — Etapas accordion + inline tarefas + projetosDerive.ts (NEST-02)
- [x] 19-03-PLAN.md — "etapas ▾" list/kanban toggle + "Todas as tarefas"/"Sem etapa" (NEST-03)
- [x] 19-04-PLAN.md — e2e regression fixes (gotoNested, shell-nav, header-states, cross-phase-verification, projeto-etapa-tarefa) (NEST-02, NEST-03)

**UI hint**: yes

### Phase 20: Rotinas & Tickets Sections

**Goal**: Users manage recurring-routine instances and their templates from one section with
clear tab separation, and inspect any ticket's or task's subtarefas from a shared inline panel
without ever touching the raw parent-type selector.
**Depends on**: Phase 19
**Requirements**: NEST-04, NEST-05
**Success Criteria** (what must be TRUE):

  1. The Rotinas section has an Instâncias tab (default) and a Templates tab; Instâncias keeps `capabilities.create`/`.delete` at `false` with no create/delete affordance visible anywhere, and Templates shows its context paragraph (NEST-04; spec §10 Aninhamento #2).
  2. Selecting a ticket row opens an inline side panel inside the Shell frame (not a new Sheet) showing that ticket's subtarefas via `EntityScreen` with `scopeWhere`/`presetLinks` pre-resolved to the open ticket (NEST-05).
  3. The same shared panel opens from a task's subtarefa affordance — wherever tasks are shown, including inside Projetos' etapa detail from Phase 19 — pre-resolved to that task, and the `xor-parent-type` selector in the generic form is never touched by the user in this flow (NEST-05; spec §10 Aninhamento #3).

**Plans**: 5 plans

Plans:

- [ ] 20-01-PLAN.md — SubtarefasPanel + TicketsSection: driven-create xor pre-resolution for the ticket-parented path (NEST-05)
- [ ] 20-02-PLAN.md — RotinasSection (Instâncias/Templates tabs) + gotoNested templatesRotina branch (NEST-04)
- [ ] 20-03-PLAN.md — ProjetosSection wiring: etapa-detail chip + "Todas as tarefas" orphan reachability (NEST-05)
- [ ] 20-04-PLAN.md — e2e helper + migration of all remaining gotoNested(subtarefas) call sites (NEST-05)
- [ ] 20-05-PLAN.md — Retire Shell.svelte's interim dropdown; NAV-02 regression fix (NEST-04, NEST-05)

**UI hint**: yes

### Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue

**Goal**: Users land on a real Dashboard screen driven by one aggregate query and a set of pure,
unit-tested derivation functions, seeing this week's 5-day business calendar and their pending
ticket queue — the first visible slice of the new landing experience.
**Depends on**: Phase 18 (route/Shell plumbing); independent of Phases 19-20
**Requirements**: DASH-06, DASH-07, DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):

  1. `web/src/lib/dashboard/derive.ts` is a pure module (no `db` import, `hoje` passed as a parameter) exporting `semanaUtil`, `agendaPorDia`, `rotinasPorFundo`, `cargaDoMes`, `faixaHeatmap`, `progressoEtapa`, and `vencido`, each covered by passing unit tests in `derive.test.ts` (DASH-06).
  2. `dashboardQuery.ts` issues exactly one `db.useQuery` (not per-section queries) covering `projetos`, `tarefas`, `instanciasRotina` (including `template.fundo`, without adding those links to `defs/instanciasRotina.ts`), `tickets`, and `fundos`, with no global store or cache layer (DASH-07).
  3. `Dashboard.svelte` mounts at the dashboard route (not registered in `registry.ts`) with a 3-column grid at `lg:` (tickets | week+kanbans | rotinas+heatmap) collapsing to 1 column below `lg` (DASH-01).
  4. The central band shows exactly 5 weekday cards (Monday-Friday, up to 3 items + `+N`, left border by item type, today highlighted via `bg-muted`); Saturday/Sunday items appear only through a chip rendered only when there are items, opening a popover (DASH-03; spec §10 Dashboard #1).
  5. The left column lists pending tickets ordered hard-deadline-first then by date, each card clickable, with an empty state and a "ver todos" link to the Tickets section (DASH-02).

**Plans**: TBD
**UI hint**: yes

### Phase 22: Dashboard Kanbans, Rotinas & Heatmap

**Goal**: Users see every in-progress project as a mini-kanban strip that never compresses,
this week's routines grouped by fundo with working display controls, and a full month's workload
heatmap using only the project's existing grayscale tokens — completing the Dashboard's content.
**Depends on**: Phase 21
**Requirements**: DASH-05, DASH-04
**Success Criteria** (what must be TRUE):

  1. Each in-progress project renders as its own strip with columns = etapas ordered by `ordem` ascending and cards = that etapa's tasks, capped at 3 cards per column with a `+N` overflow indicator (DASH-05; spec §10 Dashboard #2).
  2. Kanban columns keep a fixed width and never compress regardless of column count; a strip with more columns than fit scrolls horizontally, and the `›` continuation indicator sits outside the layout flow, appearing only when a strip's `scrollWidth` measurably exceeds its `clientWidth` (never for a project whose columns already fit) (DASH-05; spec §10 Dashboard #3-4).
  3. A project strip's collapse state persists across reload via the `localStorage` key `apollo.dash.collapsed.<projetoId>` only, touching no other key (DASH-05).
  4. Routine instances are grouped into light/transparent cards by fundo (up to 4 routines per card + `+N`), with "Sem fundo vinculado" always last and functional (client-side) agrupar/ordenar/status controls visible and operative (DASH-04; spec §10 Dashboard #5).
  5. The monthly heatmap renders a 7-column grid with exactly 5 fixed intensity bands (0 / 1-2 / 3-4 / 5-7 / 8+) using only the tokens specified in spec §6 (no new color), weekend cells at `bg-muted/40`, with a visible legend (DASH-04; spec §10 Dashboard #6).

**Plans**: TBD
**UI hint**: yes

### Phase 23: Focus Dialog System

**Goal**: Users can drill from any clickable Dashboard or nested-section surface into a
consistent, keyboard-accessible read-first dialog for that item, edit it via the existing entity
form without duplicating any markup, and never get lost more than one level deep.
**Depends on**: Phase 19, Phase 20, Phase 21, Phase 22 (needs every dialog target already built)
**Requirements**: DLG-01, DLG-02, DLG-03
**Success Criteria** (what must be TRUE):

  1. All 7 focus dialogs (Ticket, Dia, Tarefa, Projeto, Fundo, Etapa, Rotina) exist at exactly one of 3 widths (S/M/L), each with a title, a context line, a read-only body, and a footer offering "editar", "ver na página completa →", and close; "editar" opens the corresponding `EntityScreen` form with no duplicate form markup (DLG-01).
  2. Every clickable Dashboard/section surface named in spec §4 (ticket card, day header, weekend chip, heatmap cell, routine row, fundo badge, kanban column header, task card) is a real `<button>`, reachable and activatable via keyboard (`focus-visible`, Enter/Space), and opens the correct dialog per spec §4's table; nested clickable targets call `stopPropagation` so they never also trigger their container (DLG-02; spec §10 Dashboard #7).
  3. From any dialog, opening a related item never creates a third navigation level (e.g. projeto → tarefa is allowed; nothing opens a third level from there) (DLG-03; spec §10 Dashboard #8).
  4. Esc, click-outside, and the × control close every dialog except while a write is in progress (matching `EntityScreen`'s `escapeKeydownBehavior` pattern), and any destructive action still surfaces its own `AlertDialog` on top (DLG-03).

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Repo Scaffold & Live Schema | v1.0 | 3/3 | Complete | 2026-08-09 |
| 2. Shared ANBIMA Calendar | v1.0 | 3/3 | Complete | 2026-08-09 |
| 3. CLI Auth & CRUD | v1.0 | 6/6 | Complete | 2026-08-09 |
| 4. Web SPA Auth & CRUD Smoke UI | v1.0 | 6/6 | Complete | 2026-08-09 |
| 5. Idempotent Routine-Instance Job | v1.0 | 6/6 | Complete | 2026-08-09 |
| 6. End-to-End Verification | v1.0 | 3/3 | Complete | 2026-08-09 |
| 7. Design System Setup | v1.1 | 1/1 | Complete    | 2026-08-09 |
| 8. Auth & Shell Restyle | v1.1 | 1/1 | Complete    | 2026-08-09 |
| 9. Entity Table Restyle | v1.1 | 1/1 | Complete    | 2026-08-09 |
| 10. Entity Form Restyle & Feedback | v1.1 | 4/4 | Complete    | 2026-08-10 |
| 11. Full Verification & Quality Gates | v1.1 | 1/1 | Complete    | 2026-08-10 |
| 12. Login Screen Polish | v1.2 | 1/1 | Complete    | 2026-08-10 |
| 13. Shell Chrome — Header, Nav & Content Frame | v1.2 | 1/1 | Complete    | 2026-08-10 |
| 14. Entity Screen — Header, Loading & Empty States | v1.2 | 2/2 | Complete    | 2026-08-10 |
| 15. Entity Screen — Form & Dialog Composition | v1.2 | 1/1 | Complete    | 2026-08-10 |
| 16. Entity Screen — Row Actions & Delete Confirmation | v1.2 | 2/2 | Complete    | 2026-08-10 |
| 17. Cross-Phase Verification & Quality Gates | v1.2 | 2/2 | Complete    | 2026-08-10 |
| 18. Navigation Foundation & EntityScreen Extension | v1.3 | 3/3 | Complete    | 2026-08-11 |
| 19. Projetos Section (Master-Detail) | v1.3 | 4/4 | Complete    | 2026-08-11 |
| 20. Rotinas & Tickets Sections | v1.3 | 0/5 | Planned | - |
| 21. Dashboard Data Layer, Shell, Week Calendar & Ticket Queue | v1.3 | 0/? | Not started | - |
| 22. Dashboard Kanbans, Rotinas & Heatmap | v1.3 | 0/? | Not started | - |
| 23. Focus Dialog System | v1.3 | 0/? | Not started | - |
