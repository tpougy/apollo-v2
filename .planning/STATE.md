---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Navegação reorganizada + Dashboard de acompanhamento
current_phase: 21
current_phase_name: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue
status: planning
stopped_at: Completed 21-01-PLAN.md
last_updated: "2026-08-12T01:13:50.591Z"
last_activity: 2026-08-11
last_activity_desc: 20-01-PLAN.md executed - SubtarefasPanel.svelte + TicketsSection.svelte with driven xor-parent create pre-resolution, live-verified against hosted InstantDB (NEST-05 complete)
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 15
  completed_plans: 14
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-10)

**Core value:** The user can execute every piece of controladoria data-entry work from either the Svelte SPA or the Python CLI, both authenticated as the same real user under the same InstantDB permission rules. Validated in v1.0. v1.1 made the SPA visually coherent on shadcn-svelte defaults; v1.2 refined composition/spacing/hierarchy on the same four screens; v1.3 reorganizes navigation into a 6-section topbar and ships the Dashboard landing screen (calendar, tickets, rotinas, heatmap, mini-kanbans, 7 focus dialogs) — UI and organization only, no schema/CLI/routineJob change.
**Current focus:** v1.3 milestone (Phases 18-23) — roadmap created, ready to plan Phase 18

## Current Position

Phase: 21 of 23 (Dashboard Data Layer, Shell, Week Calendar & Ticket Queue)
Plan: 3 of 3
Status: Plan 21-02 complete (wave 1, parallel with 21-01)
Last activity: 2026-08-11 — 21-02-PLAN.md executed (dashboardQuery.ts, Dashboard.svelte grid shell, TicketQueue.svelte, live e2e proof)

Progress: [█████████░] 93%

## Performance Metrics

**Velocity:**

- Total plans completed: 12 (v1.3, in progress; 41 lifetime across v1.0+v1.1+v1.2+v1.3)
- Average duration: ~49min (v1.3 plans so far: 40, 95, 75, 25, 22, 35 min)
- Total execution time: ~4.9 hours (v1.3)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 19 | 4 | - | - |
| 20 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: 18-02 (95min), 18-03 (75min), 19-01 (25min), 19-02 (22min), 19-03 (35min)
- Trend: Lower duration than Phase 18 as Phase 19's hidden-instance/bespoke-query patterns get reused across plans; 19-03's small uptick over 19-02 reflects the two-file Tabs+kanban scope, still well below Phase 18's 70min average.

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 18 P01 | 40min | 2 tasks | 16 files |
| Phase 18 P02 | 95min | 1 tasks | 1 files |
| Phase 18 P03 | 75min | 3 tasks | 9 files |
| Phase 19 P01 | 25min | 2 tasks | 16 files |
| Phase 19 P02 | 22min | 2 tasks | 4 files |
| Phase 19 P03 | 35min | 2 tasks | 2 files |
| Phase 19 P04 | 55min | 3 tasks | 5 files |
| Phase 20-rotinas-tickets-sections P01 | 35min | 2 tasks | 4 files |
| Phase 20-rotinas-tickets-sections P02 | 8min | 2 tasks | 4 files |
| Phase 20-rotinas-tickets-sections P03 | 33min | 3 tasks | 2 files |
| Phase 20 P04 | 40min | 2 tasks | 3 files |
| Phase 20 P05 | 45min | 3 tasks | 5 files |
| Phase 21 P02 | 35min | 2 tasks | 5 files |
| Phase 21 P01 | 40min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (all sourced from the locked SPEC, see PROJECT.md Constraints).

- v1.3 roadmap derivation: 21 requirements (NAV-01..05, NEST-01..06, DASH-01..07, DLG-01..03) grouped into 6 phases (18-23), following `spec-ui.md` §9's dependency-ordered execution sequence — nav/`EntityScreen` plumbing first, then the Projetos and Rotinas/Tickets nested sections, then the Dashboard's data layer + shell + week calendar + ticket queue, then mini-kanbans + fundo-grouped rotinas + heatmap, then the 7-dialog focus system last (deliberately sequenced after every dialog target already exists, since dialogs only wrap already-built surfaces).
- v1.3 roadmap: NAV-03 ("rota inicial é Dashboard") is owned by Phase 18 alongside the rest of NAV-*, satisfied via the `Route` state defaulting to `{ section: "dashboard" }` plus a minimal `Dashboard.svelte` mount point — the full 3-column grid content (DASH-01) is a separate requirement delivered later in Phase 21 once `derive.ts`/`dashboardQuery.ts` exist to feed it. Phase 18 must not claim DASH-01.
- v1.3 roadmap: NEST-05 (shared inline subtarefas panel) is owned entirely by Phase 20, even though the panel is also used from the task view built in Phase 19's Projetos section — Phase 19 builds the etapa/task list without the panel wired in yet; Phase 20 builds `SubtarefasPanel.svelte` once and retroactively wires it to both Tickets and the Phase 19 task surface, matching `spec-ui.md` §9's own step ordering (step 3 ProjetosSection before step 4 Rotinas/Tickets + SubtarefasPanel).
- v1.3 roadmap: DASH-05 (mini-kanbans) and DASH-04 (rotinas-by-fundo + heatmap) were merged into one phase (22) rather than split per `spec-ui.md` §9's steps 7/8 — each would otherwise be a single-requirement phase, and both are adjacent, purely additive Dashboard-content slices with no independent user-facing milestone value on their own.
- v1.2/v1.3 kickoff: No human UAT gate anywhere — every phase's success criteria must be Playwright-provable against the live InstantDB app (C-12).
- [Phase ?]: Verified NEST-01's byte-identical acceptance criterion via a controlled A/B full-suite comparison (diff/no-diff, same post-18-01 baseline) rather than a single unedited-suite run, because 18-01 landed its topbar restructuring in the shared working tree (no worktree isolation) before this plan's verification ran, and 18-03's e2e migration (NAV-05) had not yet landed.
- [Phase ?]: Fixed 3 pre-existing e2e regressions exposed by Plan 18-01 landing first (no worktree isolation): stale fundos-default-mount assumption, instanciasRotina Tab-count formula, an uncatalogued nav-tarefas call site -- all within this plan's declared scope
- [Phase ?]: [Phase 19 P01] Bespoke db.useQuery pattern for ProjetosSection: any section screen needing more than one level of link nesting writes its own query, never extends EntityScreen.buildQuery.
- [Phase ?]: [Phase 19 P01] Hidden-EntityScreen-instance + bounded-poll selector-click pattern reuses the generic create/edit dialog from outside its own mount, without a new EntityScreen prop; openProjetoDialog polls up to 5s since row-scoped targets (e.g. row-edit) only exist after the hidden instance's own db.useQuery resolves.
- [Phase ?]: [Phase 19 P01] Pruned etapas/tarefas from Shell.svelte's interim nested-goto dropdown via a HANDLED_BY_SECTION allowlist now that ProjetosSection gives them a real home; templatesRotina/subtarefas stay until Phase 20 (19-CONTEXT.md Open Question 2).
- [Phase ?]: [Phase 19 P02] projetosDerive.ts is a phase-local pure module (tarefaConcluida/progressoEtapa/vencido) mirroring bizdays.ts's style, matching REQUIREMENTS.md §5.3/§5.4 verbatim -- ahead of Phase 21's canonical dashboard/derive.ts, per 19-CONTEXT.md's explicit allowance for Phase 21 to consolidate/dedupe later.
- [Phase ?]: [Phase 19 P02] bits-ui's installed Accordion.Content stays mounted for every item regardless of open/closed state (never display:none) -- every Accordion.Content usage in this codebase must gate its children behind `{#if <open-check>}` or every per-item testid exists once per item simultaneously, breaking strict-mode Playwright queries the moment there is more than one item.
- [Phase ?]: [Phase 19 P02] openEtapaId uses "" (not null) as the "closed" sentinel -- the installed bits-ui Accordion.Root (type="single") types value as `string` (default ""), not `string | null`, and this bits-ui version has no `collapsible` prop.
- [Phase ?]: [Phase 19 P03] scopeWhere's $isNull operator ("Sem etapa" filter) was live-verified against the hosted InstantDB app — behaves exactly as documented, so the client-side-filter fallback CONTEXT.md/RESEARCH.md pre-authorized was never needed.
- [Phase ?]: [Phase 19 P03] bits-ui's installed Tabs.Content always mounts its children (hidden attribute, never unmount) — every EntityScreen mounted inside a Tabs.Content must be additionally guarded with an {#if <active-tab>} check, mirroring Plan 19-02's identical Accordion.Content guard.
- [Phase ?]: [Phase 19 P03] Kanban's horizontal scroll strip uses a plain overflow-x-auto div, not the installed ScrollArea component -- ScrollArea's custom-scrollbar viewport has no prior usage/e2e precedent in this codebase and this phase only needs the overflow/non-compression discipline.
- [Phase ?]: 19-04: WEB-03's dataInicioPrevista persistence proven via CLI read path (ProjetosSection's project-header does not render that field); T-04-04's visible-error assertion moved to the sonner error toast (entity-error is invisible inside ProjetosSection's hidden-host EntityScreen instances) -- logged to WINDOWS.md as a future-phase UX gap.
- [Phase ?]: TicketsSection renders no separate h2; relies on EntityScreen's own heading to avoid a duplicate-h2 regression in shell-nav.spec.ts
- [Phase ?]: SubtarefasPanel drives bits-ui Select via paired pointerdown/pointerup PointerEvents, not .click() -- verified .click() is a no-op against bits-ui Select triggers/items
- [Phase ?]: tickets-section.spec.ts's edit test adds a waitForSettle buffer before page.reload() to avoid aborting an in-flight db.transact()
- [Phase ?]: No RotinasSection-level <h2> -- EntityScreen(instanciasRotinaConfig)'s own header already satisfies shell-nav.spec.ts's single-<h2> assertion
- [Phase ?]: Both Tabs.Content blocks in RotinasSection are guarded behind {#if activeTab === ...}, since both tabs mount an EntityScreen directly (unlike ProjetosSection's default tab)
- [Phase ?]: Templates context paragraph reads 'Configuração que gera as instâncias.' -- e2e assertion is case-insensitive against the binding spec phrase
- [Phase ?]: Task 1 and Task 2 committed as two separate atomic commits despite sharing one file (ProjetosSection.svelte), reconstructed via targeted Edit reverts/reapplies to keep each commit's diff scoped to one plan task.
- [Phase ?]: Orphan-reachability e2e test reuses the existing tarefaOrfaId/tarefaOrfaTitulo fixture instead of minting a second redundant orphan tarefa.
- [Phase ?]: [Phase 20 P04] Row lookups for a subtarefa just created/edited through SubtarefasPanel must scope to the visible subtarefas-panel testid -- the hidden driven-create host mounts an unscoped copy of every row once subtarefa-add-start is first clicked in a session.
- [Phase ?]: [Phase 20 P04] When a test's final xor choice differs from the parent SubtarefasPanel was opened with, re-open a fresh panel scoped to the actual resulting parent before asserting/deleting -- the record leaves the originally-opened panel's scopeWhere-filtered list.
- [Phase ?]: [Phase 20 P05] gotoNested.ts's hardened fallback throws a descriptive Error naming the unhandled etype and the correct replacement helper, not a bare assertion.
- [Phase ?]: [Phase 20 P05] DEF-01 root cause was TWO added Tab stops inside RotinasSection's Tabs.Root (active Tabs.Trigger's roving-tabindex stop + bits-ui's own Tabs.Content tabpanel div, a real separate tabindex=0 stop), not the one originally suspected -- fixed via explicit per-stop assertions instead of a corrected fixed count.
- [Phase ?]: [Phase 20 P05] Phase 20 phase-gate: full bun run test:e2e run twice, both green except two documented pre-existing/out-of-scope flakes (login-flow.spec.ts magic-code timing predating Phase 20 since Phase 10; entities-form-restyle.spec.ts's SubtarefasPanel pollFor timeout, a Plan 20-01 resource-contention timing issue) -- both reproduced passing in isolation.
- [Phase ?]: dashboardQuery.ts takes db as a parameter instead of importing it, so DASHBOARD_QUERY stays importable standalone by the e2e Node/Playwright process (importing db.ts transitively pulls in @instantdb/svelte's .svelte component graph, which Playwright's Node-based TS transform cannot parse).
- [Phase ?]: InstantDB's admin API returns has:"one" links as single-element arrays (not bare objects), unlike the client SDK's db.useQuery -- dashboard.spec.ts's DASH-07 proof normalizes this the same way routineJob.ts:622 already does.
- [Phase ?]: derive.ts: migrated projetosDerive.ts verbatim, tarefaConcluida stays exported (ProjetosSection.svelte calls it directly)
- [Phase ?]: semanaUtil uses plain UTC calendar-day arithmetic, never bizdays.ts's business-day steppers, so ANBIMA holidays inside the week never shift Friday
- [Phase ?]: agendaPorDia adds explicit hoje: Date parameter (purity rule forbids internal clock read); rotina/ticket vencido hard-codes concluido=false

### Pending Todos

None yet.

### Blockers/Concerns

None — v1.3 roadmap coverage is 21/21 requirements mapped with no orphans.

**v1.2 milestone non-blocking tech debt** (carried forward, not addressed in v1.3 unless it intersects — see PROJECT.md Context for full detail):

- No type-level invariant enforces that any entity with `capabilities.delete: true` also has `capabilities.create: true` (all 9 current entities satisfy it; not a live bug).
- A hung `db.transact` during delete leaves the AlertDialog permanently undismissable (no timeout/abort path).
- Shell's nav uses `flex-wrap` with no explicit single-row assertion at desktop width (functionally fine today, minor coverage gap) — worth re-checking once the topbar drops from 9 items to 6 in Phase 18, since fewer items only makes wrapping less likely, not impossible.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| UI | 5-panel dashboard (Hoje/calendários/Projetos/Backlog, `.eml` drag-and-drop) — superseded by v1.3's own Dashboard design (different shape: week calendar + tickets + rotinas + heatmap + mini-kanbans + dialogs, no `.eml` drag-and-drop) | Superseded by v1.3 scope | v1.0 close |
| Rules | Automatic soft-deadline reallocation, chained delay propagation | Deferred v2 rules | v1.0 close |
| UI | Occasional live-email-timing test flake (magic-code round trip) | Deferred — non-blocking, pre-existing | v1.1 close |
| Nav | Router/URL/deep link for Dashboard and sections | Deferred — explicit v1.3 out-of-scope (spec §10) | v1.3 kickoff |
| UI | Drag-and-drop on the Projetos kanban | Deferred — explicit v1.3 out-of-scope (spec §10) | v1.3 kickoff |
| UI | Inline status edit outside the Rotina dialog (nº 7) | Deferred — explicit v1.3 out-of-scope (spec §10) | v1.3 kickoff |
| UI | Fundo detail read-only block (rotinas/projetos/tickets vinculados) outside the Dashboard's Fundo dialog | Deferred — Fundo dialog (nº 5) already covers this in v1.3; the standalone Fundos-page block stays deferred | v1.3 kickoff |

## Session Continuity

Last session: 2026-08-12T01:13:50.578Z
Stopped at: Completed 21-01-PLAN.md
Resume file: None

## Operator Next Steps

- Run `/gsd-plan-phase 18` to plan "Navigation Foundation & EntityScreen Extension", the first phase of v1.3.
