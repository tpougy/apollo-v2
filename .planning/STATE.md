---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: CLI instalável via uv tool, login sem admin token
current_phase: 25
current_phase_name: Public Auth Login
status: in_progress
stopped_at: Completed 25-01-PLAN.md
last_updated: "2026-08-12T20:45:29.359Z"
last_activity: 2026-08-12
last_activity_desc: "Completed 25-01-PLAN.md: apollo auth login rewritten to call InstantDB's public /runtime/auth/* endpoints directly via httpx, zero login_client()/admin-token usage, proven live with the admin token entirely absent; AST-walk gate tightened, new offline network-error test, full quality gate green"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 4
  completed_plans: 3
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-12)

**Core value:** The user can execute every piece of controladoria data-entry work from either the Svelte SPA or the Python CLI, both authenticated as the same real user under the same InstantDB permission rules. Validated in v1.0. v1.1 made the SPA visually coherent on shadcn-svelte defaults; v1.2 refined composition/spacing/hierarchy on the same four screens; v1.3 reorganized navigation into a 6-section topbar and shipped the Dashboard landing screen; v1.4 makes the CLI itself installable outside the monorepo and drops its login flow's admin-token dependency — `cli/`-only, no schema/perms/web change.
**Current focus:** v1.4 Phase 25 in progress — Plan 25-01 complete (`apollo auth login` rewritten to InstantDB's public `/runtime/auth/*` endpoints via `httpx`, zero admin-token dependency, proven live). Plan 25-02 (real send+verify magic-code round trip, admin-token-absent) remains.

## Current Position

Phase: 25 of 25 (Public Auth Login)
Plan: 25-01 complete (1/2 plans done this phase so far)
Status: In progress
Last activity: 2026-08-12 — Completed 25-01-PLAN.md (public runtime endpoints transport rewrite, live invalid-code + network-error proofs, docstrings/README corrected, AST-walk gate tightened)

Progress: [████████░░] 75%

## Performance Metrics

**Velocity:**

- Total plans completed: 2 (v1.4, Phase 24 fully done; 43 lifetime across v1.0+v1.1+v1.2+v1.3+v1.4)
- Average duration: ~27min (v1.4 plans so far: 25, ~30 min)
- Total execution time: ~55 min (v1.4)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 24 | 2 | - | - |
| 25 | - | - | - |

**Recent Trend:**

- Last 5 plans: (v1.3 closing plans + v1.4 start) 23-06 (40min), 23-07 (65min), 24-01 (25min), 24-02 (~30min)
- Trend: Stable — packaging-focused plans (24-01, 24-02) running faster than the v1.3 UI-wiring average

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 24 P01 | 25min | 2 tasks | 7 files |
| Phase 24 P02 | ~30min | 2 tasks | 3 files |
| Phase 25 P01 | ~12min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (all sourced from the locked SPEC, see PROJECT.md Constraints).

- v1.4 requirements (PKG-01..05, AUTH-01..05) originated from a live-code discussion, not a research phase: `find_repo_root()`-based lookups in `bizdays.py`/`config.py` break outside the monorepo checkout, and `apollo auth login` unnecessarily depends on `INSTANT_APP_ADMIN_TOKEN` because the `instantdb` Python Admin SDK only wraps the `/admin/*` magic-code endpoints, not the public `/runtime/auth/*` ones the JS SDK already uses.
- v1.4 roadmap derivation: 10 requirements grouped into 2 phases (24-25) along the natural PKG/AUTH category boundary — no further split, per this milestone's explicit small/surgical scope (`cli/`-only, 3 related fixes). Phase 24 (packaging: vendored calendar + embedded default `app_id` + real `uv build`/`uv tool install` proof) sequenced before Phase 25 (auth: public `/runtime/auth/*` login) because AUTH-04 explicitly requires `apollo doctor`/`admin_token_present` to reflect PKG-03/PKG-04's new `app_id` resolution order — Phase 25 cannot be verified as "unaltered beyond what PKG-03/04 required" until Phase 24 lands.
- v1.4 explicit non-goal, reaffirmed in REQUIREMENTS.md Context: `admin_token_present`/`apollo doctor` are kept exactly as-is (dev/ops support only), not removed even though the real login path no longer needs an admin token after this milestone.
- v1.4 verification approach unchanged from v1.0-v1.3: no human UAT — every phase proven via real `uv build`/`uv tool install` runs in an isolated environment, real `pytest`/`ruff`/`ty` runs, and (for AUTH-01) a real magic-code email round trip against the live InstantDB app.
- [Phase 24, Plan 01]: Reconfirmed the embedded `_DEFAULT_APP_ID` value live by rebuilding `web/` fresh and re-extracting from the bundle, rather than trusting RESEARCH.md's `[ASSUMED]` tag blindly.
- [Phase 24, Plan 01]: Ran a live RED reproduction of the pre-fix `find_repo_root()` crash (real `uv build`/`venv`/install from outside the repo) before implementing, then reran the identical round trip post-fix for GREEN.
- [Phase 24, Plan 02]: Isolated `APOLLO_SESSION_FILE` (nonexistent path) for every `fundo listar` invocation in both the new `test_packaging_live.py` and the manual acceptance round trip — this dev machine's real persisted session would otherwise mask the `no_session`/exit-1 contract being proven.
- [Phase 24, Plan 02]: Phase 24 (Packaging & Installability) is now fully complete — PKG-01 through PKG-05 all live-verified; `test_packaging_live.py` is the permanent standing regression gate for PKG-05, and the real `uv tool install --force`/`uv tool uninstall apollo-cli` round trip was executed once, live, with output captured verbatim in `24-02-SUMMARY.md`.
- [Phase 25, Plan 01]: apollo auth login rewritten to call InstantDB's public /runtime/auth/send_magic_code and verify_magic_code endpoints directly via httpx, reusing instantdb's own api_error_from_response()/DEFAULT_API_URI/DEFAULT_TIMEOUT internals -- zero login_client()/admin-token usage remains in login(); proven live with INSTANT_APP_ADMIN_TOKEN entirely absent.
- [Phase 25, Plan 01]: httpx package-legitimacy resolved autonomously (Task 0, no blocking human checkpoint) -- already a pinned, installed transitive dependency of instantdb; promoted to an explicit cli/pyproject.toml dependency with zero new install surface.

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

Last session: 2026-08-12T20:45:29.349Z
Stopped at: Completed 25-01-PLAN.md
Resume file: None

## Operator Next Steps

- Phase 24 (Packaging & Installability) is complete — all 5 requirements (PKG-01..05) live-verified. Next: run `/gsd-plan-phase 25` to plan Phase 25 (Public Auth Login), the final phase of v1.4.
