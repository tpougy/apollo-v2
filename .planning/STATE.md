---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Correções descobertas no onboarding real do calendário de rotinas
current_phase: 26
current_phase_name: Validação na escrita
status: roadmap_complete
stopped_at: REQUIREMENTS.md + ROADMAP.md (Phases 26-31) written from a verified onboarding report -- ready for /gsd-plan-phase 26
last_updated: "2026-08-14T18:48:21.034Z"
last_activity: 2026-08-14
last_activity_desc: 8 achados de um onboarding real (18 fundos/84 templates/168 instâncias cadastrados via apollo CLI) triados e verificados linha-a-linha no código (routine_job.py, routineJob.ts, bizdays.py, entities/rotina.py) antes de virarem requisito; 4 decisões de implementação registradas (normalizar status em vez de fechar vocabulário, reservar propagarAtrasoSoft, estender du_fixo em vez de tipoGeracao novo, implementar periodicidade semanal por decisão explícita do usuário); REQUIREMENTS.md (VAL/JOB/SEM/RANGE/LIFE/BATCH, 12 requisitos) e ROADMAP.md (Phases 26-31) escritos. Nenhum plano de fase criado ainda.
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 1
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-14)

**Core value:** The user can execute every piece of controladoria data-entry work from either the Svelte SPA or the Python CLI, both authenticated as the same real user under the same InstantDB permission rules. Validated in v1.0. v1.1 made the SPA visually coherent on shadcn-svelte defaults; v1.2 refined composition/spacing/hierarchy on the same four screens; v1.3 reorganized navigation into a 6-section topbar and shipped the Dashboard landing screen; v1.4 made the CLI itself installable outside the monorepo and dropped its login flow's admin-token dependency; v1.5 fixes 8 issues a real production-volume onboarding surfaced in the routine-generation engine (`routine_job.py`/`routineJob.ts`) and its CLI surface.
**Current focus:** v1.5 (Phases 26-31) is planned but not yet executed. Requirements and roadmap were derived from a verified onboarding report (RBR fund-controladoria routine calendar: 18 fundos, 84 templatesRotina, 168 instanciasRotina), not from a spec or discussion — each of the 8 reported issues was confirmed against the live code before being accepted as a requirement. Next step: `/gsd-plan-phase 26`.

## Current Position

Phase: 26 of 31 (Validação na escrita)
Plan: Not started
Status: Roadmap complete, no phase planned yet
Last activity: 2026-08-14 — REQUIREMENTS.md/ROADMAP.md written

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 4 (v1.4, both phases fully done; 44 lifetime across v1.0+v1.1+v1.2+v1.3+v1.4)
- Average duration: ~19min (v1.4 plans: 24-01 25min, 24-02 ~30min, 25-01 ~12min, 25-02 8min)
- Total execution time: ~75 min (v1.4)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 24 | 2 | ~55min | ~27min |
| 25 | 2 | - | - |

**Recent Trend:**

- Last 5 plans: (v1.3 close + v1.4) 23-07 (65min), 24-01 (25min), 24-02 (~30min), 25-01 (~12min), 25-02 (8min)
- Trend: Accelerating — auth-transport plans (25-01, 25-02) ran faster than packaging plans, reusing established live-test infrastructure (magic-code helper, `_subprocess_env` isolation idiom) rather than building new patterns from scratch.

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 24 P01 | 25min | 2 tasks | 7 files |
| Phase 24 P02 | ~30min | 2 tasks | 3 files |
| Phase 25 P01 | ~12min | 3 tasks | 7 files |
| Phase 25 P02 | 8min | 2 tasks | 3 files |

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
- [Phase 25, Plan 02]: Ported web/e2e/helpers/magic-code.ts's readLatestMagicCode/readMagicCodeAfter into cli/tests/helpers/magic_code.py verbatim (same orules.ps1 peek command, regex, sender check, block separator) -- zero re-derivation from PROJECT.md C-10's own stale prose. Used a real subprocess.run()-based live test (not CliRunner) to prove INSTANT_APP_ADMIN_TOKEN absence in a genuinely isolated child-process environment, reusing test_packaging_live.py's env-copy-and-override idiom.
- [Phase 25, Plan 02]: Phase 25 (Public Auth Login) is now fully complete -- AUTH-01 through AUTH-05 all live-verified; the real magic-code send+verify round trip completed end-to-end against production InstantDB with the admin token entirely absent, closing the one gap Plan 25-01 could not close on its own. This also completes v1.4 in full (Phases 24-25, PKG-01..05 + AUTH-01..05, 10/10 requirements) -- no further phases remain in this milestone.
- v1.5 requirements originated from a real onboarding report (not a spec/discussion): an agent cadastrou o calendário de rotinas de controladoria da RBR via `apollo` CLI (18 fundos, 84 templatesRotina, 168 instanciasRotina) and hit 8 issues, each verified against `routine_job.py`/`routineJob.ts`/`bizdays.py`/`entities/rotina.py` before being accepted.
- v1.5 roadmap derivation: 12 requirements grouped into 6 phases (26-31), P0 (falhas silenciosas) primeiro, depois P1 (lacunas de cobertura do calendário), depois P2 (atrito operacional) — Phase 26 (validação de escrita, sem tocar o job) antes de Phase 27 (robustez do job) para não colidir edições na mesma janela; Phase 28 (semanal) depende de 27 por estender o mesmo dispatch de `tipoGeracao`; Phase 29 (recorte de range) depende de 28 para cobrir o tipo semanal também; Phases 30-31 (higiene/lote) são tecnicamente independentes, sequenciadas por último por prioridade.
- v1.5 decisões de implementação registradas em REQUIREMENTS.md Context: (1) JOB-01 normaliza a comparação de `status` em vez de fechar o vocabulário — `status` continua livre por decisão de produto já aplicada a outras entidades; (2) VAL-02 marca `propagarAtrasoSoft` como reservado em vez de implementar propagação — implementar reabriria C-09 (travado); (3) JOB-02 estende `du_fixo` para aceitar offset negativo em vez de criar um `tipoGeracao` novo — `add_business_days` já suporta contagem negativa; (4) SEM-01 (periodicidade semanal) será implementado por decisão explícita do usuário, mesmo cobrindo só 1 evento em 87 no calendário de origem.
- v1.5 causa raiz adicional encontrada além do relatado pelo usuário (LIFE-03): o resíduo de teste E2E na base real (achado do usuário em P2-2) não é um incidente pontual — não existe hoje um `app_id` de teste separado do usado para dados reais em nenhum dos dois runtimes, então qualquer rodada futura de teste `live`/Playwright pode reintroduzir o mesmo resíduo até essa separação existir.

### Pending Todos

None yet — Phase 26 not planned.

### Blockers/Concerns

None — v1.5 roadmap coverage is 12/12 requirements mapped with no orphans. No phase plans exist yet; `/gsd-plan-phase 26` has not been run.

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

Last session: 2026-08-14T00:00:00.000Z
Stopped at: REQUIREMENTS.md + ROADMAP.md (Phases 26-31) written for v1.5 from a verified onboarding report; no phase plan created yet
Resume file: None

## Operator Next Steps

- v1.5 is planned (REQUIREMENTS.md + ROADMAP.md, Phases 26-31, 12 requirements) but not yet planned-in-detail or executed. Next: `/gsd-plan-phase 26` to produce the first PLAN.md (Validação na escrita — VAL-01/02/03), then proceed phase by phase.
