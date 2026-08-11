---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Navegação reorganizada + Dashboard de acompanhamento
current_phase: 18
current_phase_name: Navigation Foundation & EntityScreen Extension
status: verifying
stopped_at: Completed 18-03-PLAN.md
last_updated: "2026-08-11T17:20:33.560Z"
last_activity: 2026-08-11
last_activity_desc: ROADMAP.md created for v1.3 (Phases 18-23), 21/21 requirements mapped
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-10)

**Core value:** The user can execute every piece of controladoria data-entry work from either the Svelte SPA or the Python CLI, both authenticated as the same real user under the same InstantDB permission rules. Validated in v1.0. v1.1 made the SPA visually coherent on shadcn-svelte defaults; v1.2 refined composition/spacing/hierarchy on the same four screens; v1.3 reorganizes navigation into a 6-section topbar and ships the Dashboard landing screen (calendar, tickets, rotinas, heatmap, mini-kanbans, 7 focus dialogs) — UI and organization only, no schema/CLI/routineJob change.
**Current focus:** v1.3 milestone (Phases 18-23) — roadmap created, ready to plan Phase 18

## Current Position

Phase: 18 of 23 (Navigation Foundation & EntityScreen Extension)
Plan: 3 of 3
Status: Phase complete — ready for verification
Last activity: 2026-08-11 — ROADMAP.md created for v1.3 (Phases 18-23), 21/21 requirements mapped

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.3 not yet started; 35 lifetime across v1.0+v1.1+v1.2)
- Average duration: N/A (no v1.3 plans yet)
- Total execution time: 0 hours (v1.3)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: N/A (v1.2 closed; v1.3 not yet started)
- Trend: N/A

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 18 P01 | 40min | 2 tasks | 16 files |
| Phase 18 P02 | 95min | 1 tasks | 1 files |
| Phase 18 P03 | 75min | 3 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (all sourced from the locked SPEC, see PROJECT.md Constraints).

- v1.3 roadmap derivation: 21 requirements (NAV-01..05, NEST-01..06, DASH-01..07, DLG-01..03) grouped into 6 phases (18-23), following `spec-ui.md` §9's dependency-ordered execution sequence — nav/`EntityScreen` plumbing first, then the Projetos and Rotinas/Tickets nested sections, then the Dashboard's data layer + shell + week calendar + ticket queue, then mini-kanbans + fundo-grouped rotinas + heatmap, then the 7-dialog focus system last (deliberately sequenced after every dialog target already exists, since dialogs only wrap already-built surfaces).
- v1.3 roadmap: NAV-03 ("rota inicial é Dashboard") is owned by Phase 18 alongside the rest of NAV-*, satisfied via the `Route` state defaulting to `{ section: "dashboard" }` plus a minimal `Dashboard.svelte` mount point — the full 3-column grid content (DASH-01) is a separate requirement delivered later in Phase 21 once `derive.ts`/`dashboardQuery.ts` exist to feed it. Phase 18 must not claim DASH-01.
- v1.3 roadmap: NEST-05 (shared inline subtarefas panel) is owned entirely by Phase 20, even though the panel is also used from the task view built in Phase 19's Projetos section — Phase 19 builds the etapa/task list without the panel wired in yet; Phase 20 builds `SubtarefasPanel.svelte` once and retroactively wires it to both Tickets and the Phase 19 task surface, matching `spec-ui.md` §9's own step ordering (step 3 ProjetosSection before step 4 Rotinas/Tickets + SubtarefasPanel).
- v1.3 roadmap: DASH-05 (mini-kanbans) and DASH-04 (rotinas-by-fundo + heatmap) were merged into one phase (22) rather than split per `spec-ui.md` §9's steps 7/8 — each would otherwise be a single-requirement phase, and both are adjacent, purely additive Dashboard-content slices with no independent user-facing milestone value on their own.
- v1.2/v1.3 kickoff: No human UAT gate anywhere — every phase's success criteria must be Playwright-provable against the live InstantDB app (C-12).
- [Phase 15]: Fixed a busy-guard double-submit race in EntityScreen.svelte's handleSubmit (plan-checker-flagged deviation) — busy=true now set immediately after the re-entrancy guard, wrapping the entire validation+queryOnce+transact flow in try/finally, not just the transact try/catch.
- [Phase 16 P02]: Fixed bits-ui's AlertDialogCancelState never emitting a disabled HTML attribute (only gating its own onclick/onkeydown internally) via a child-snippet override in the vendored alert-dialog-cancel.svelte, discovered by the new busy-gating test.
- [Phase 17]: Fixed EntityScreen.svelte's page-header sitting flush (0px gap) against table/loading/empty content via `space-y-6`, locked in with a permanent Playwright assertion — the closing v1.2 cross-phase audit's one genuine finding.
- [Phase 18 P01]: gotoNested's interim (Phase 18) affordance groups the 4 nested entities by the first primary entity each links to (via links, never xorLink), falling back to 'Outros' -- data-driven, zero per-etype branching; only the helper body changes when Phase 19/20 ship real nested UI.
- [Phase ?]: Verified NEST-01's byte-identical acceptance criterion via a controlled A/B full-suite comparison (diff/no-diff, same post-18-01 baseline) rather than a single unedited-suite run, because 18-01 landed its topbar restructuring in the shared working tree (no worktree isolation) before this plan's verification ran, and 18-03's e2e migration (NAV-05) had not yet landed.
- [Phase ?]: Fixed 3 pre-existing e2e regressions exposed by Plan 18-01 landing first (no worktree isolation): stale fundos-default-mount assumption, instanciasRotina Tab-count formula, an uncatalogued nav-tarefas call site -- all within this plan's declared scope

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

Last session: 2026-08-11T17:20:33.553Z
Stopped at: Completed 18-03-PLAN.md
Resume file: None

## Operator Next Steps

- Run `/gsd-plan-phase 18` to plan "Navigation Foundation & EntityScreen Extension", the first phase of v1.3.
