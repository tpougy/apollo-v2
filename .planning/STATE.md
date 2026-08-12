---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: CLI instalável via uv tool, login sem admin token
status: planning
last_updated: "2026-08-12T19:05:00.000Z"
last_activity: 2026-08-12
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-12)

**Core value:** The user can execute every piece of controladoria data-entry work from either the Svelte SPA or the Python CLI, both authenticated as the same real user under the same InstantDB permission rules. Validated in v1.0. v1.1 made the SPA visually coherent on shadcn-svelte defaults; v1.2 refined composition/spacing/hierarchy on the same four screens; v1.3 reorganized navigation into a 6-section topbar and shipped the Dashboard landing screen; v1.4 makes the CLI itself installable outside the monorepo and drops its login flow's admin-token dependency — `cli/`-only, no schema/perms/web change.
**Current focus:** Roadmap complete for v1.4 (Phases 24-25). Ready to plan Phase 24.

## Current Position

Phase: 24 of 25 (Packaging & Installability)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-08-12 — Roadmap created for v1.4 (Phases 24-25), REQUIREMENTS.md traceability updated

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.4, just started; 41 lifetime across v1.0+v1.1+v1.2+v1.3)
- Average duration: — (no v1.4 plans yet; historical average ~40min/plan across prior milestones)
- Total execution time: 0 hours (v1.4)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 24 | - | - | - |
| 25 | - | - | - |

**Recent Trend:**

- Last 5 plans: (v1.3 closing plans) 23-05 (35min), 23-06 (40min), 23-07 (65min) — no v1.4 plans executed yet
- Trend: N/A — v1.4 has not started execution

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (all sourced from the locked SPEC, see PROJECT.md Constraints).

- v1.4 requirements (PKG-01..05, AUTH-01..05) originated from a live-code discussion, not a research phase: `find_repo_root()`-based lookups in `bizdays.py`/`config.py` break outside the monorepo checkout, and `apollo auth login` unnecessarily depends on `INSTANT_APP_ADMIN_TOKEN` because the `instantdb` Python Admin SDK only wraps the `/admin/*` magic-code endpoints, not the public `/runtime/auth/*` ones the JS SDK already uses.
- v1.4 roadmap derivation: 10 requirements grouped into 2 phases (24-25) along the natural PKG/AUTH category boundary — no further split, per this milestone's explicit small/surgical scope (`cli/`-only, 3 related fixes). Phase 24 (packaging: vendored calendar + embedded default `app_id` + real `uv build`/`uv tool install` proof) sequenced before Phase 25 (auth: public `/runtime/auth/*` login) because AUTH-04 explicitly requires `apollo doctor`/`admin_token_present` to reflect PKG-03/PKG-04's new `app_id` resolution order — Phase 25 cannot be verified as "unaltered beyond what PKG-03/04 required" until Phase 24 lands.
- v1.4 explicit non-goal, reaffirmed in REQUIREMENTS.md Context: `admin_token_present`/`apollo doctor` are kept exactly as-is (dev/ops support only), not removed even though the real login path no longer needs an admin token after this milestone.
- v1.4 verification approach unchanged from v1.0-v1.3: no human UAT — every phase proven via real `uv build`/`uv tool install` runs in an isolated environment, real `pytest`/`ruff`/`ty` runs, and (for AUTH-01) a real magic-code email round trip against the live InstantDB app.

### Pending Todos

None yet.

### Blockers/Concerns

None — v1.4 roadmap coverage is 10/10 requirements mapped with no orphans.

**v1.2 milestone non-blocking tech debt** (carried forward, not addressed in v1.3 or v1.4 unless it intersects — see PROJECT.md Context for full detail):

- No type-level invariant enforces that any entity with `capabilities.delete: true` also has `capabilities.create: true` (all 9 current entities satisfy it; not a live bug).
- A hung `db.transact` during delete leaves the AlertDialog permanently undismissable (no timeout/abort path).
- `WINDOWS.md` carries ~9 stale ledger entries from the v1.3 Phase 18 era still marked "open" for files that now demonstrably pass (bookkeeping gap, not a code defect).
- `ProjetosSection.svelte`'s `etapa-kanban-column`/`etapa-kanban-card` are literal nested `<button>` elements — fine in this SSR-free Vite SPA, would need revisiting if SSR is ever adopted (WINDOWS.md #14).
- A Fundo detail read-only block (rotinas/projetos/tickets vinculados, spec-ui.md §2.5) outside the Dashboard's own Fundo dialog remains unbuilt — low priority, the dialog already covers the same content.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| UI | 5-panel dashboard (Hoje/calendários/Projetos/Backlog, `.eml` drag-and-drop) — superseded by v1.3's own Dashboard design | Superseded by v1.3 scope | v1.0 close |
| Rules | Automatic soft-deadline reallocation, chained delay propagation | Deferred v2 rules | v1.0 close |
| UI | Occasional live-email-timing test flake (magic-code round trip) | Deferred — non-blocking, pre-existing | v1.1 close |
| Nav | Router/URL/deep link for Dashboard and sections | Deferred — explicit v1.3 out-of-scope (spec §10) | v1.3 kickoff |
| UI | Drag-and-drop on the Projetos kanban | Deferred — explicit v1.3 out-of-scope (spec §10) | v1.3 kickoff |
| UI | Inline status edit outside the Rotina dialog (nº 7) | Deferred — explicit v1.3 out-of-scope (spec §10) | v1.3 kickoff |
| UI | Fundo detail read-only block (rotinas/projetos/tickets vinculados) outside the Dashboard's Fundo dialog | Deferred — Fundo dialog (nº 5) already covers this in v1.3; standalone Fundos-page block stays deferred | v1.3 kickoff |
| Config | New config storage mechanism (e.g. `~/.config/apollo-cli/config.toml`) for multiple simultaneous InstantDB apps | Deferred — no real use case today (single-user, single-app) | v1.4 kickoff |
| Release | Real PyPI publication / automated release CI | Deferred — out of scope for v1.4, which resolves only local `uv tool install` installability | v1.4 kickoff |

## Session Continuity

Last session: 2026-08-12T19:05:00.000Z
Stopped at: ROADMAP.md created for v1.4 (Phases 24-25, 10/10 requirements mapped), REQUIREMENTS.md traceability updated
Resume file: None

## Operator Next Steps

- Plan Phase 24 with `/gsd-plan-phase 24`
