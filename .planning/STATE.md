---
gsd_state_version: "1.0"
milestone: v1.5
milestone_name: Correções descobertas no onboarding real do calendário de rotinas (RBR)
current_phase: 31
current_plan: Not started
status: completed
stopped_at: Phase 31 complete — all phases complete
last_updated: "2026-09-22T23:04:15.671Z"
last_activity: 2026-09-22
last_activity_desc: Phase 31 complete
state_head: 34a5743a60977c747f3ecfbb236ee71965b7558d
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 11
  completed_plans: 11
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-14)

**Core value:** The user can execute every piece of controladoria data-entry work from either the Svelte SPA or the Python CLI, both authenticated as the same real user under the same InstantDB permission rules. Validated in v1.0. v1.1 made the SPA visually coherent on shadcn-svelte defaults; v1.2 refined composition/spacing/hierarchy on the same four screens; v1.3 reorganized navigation into a 6-section topbar and shipped the Dashboard landing screen; v1.4 made the CLI itself installable outside the monorepo and dropped its login flow's admin-token dependency; v1.5 fixes 8 issues a real production-volume onboarding surfaced in the routine-generation engine (`routine_job.py`/`routineJob.ts`) and its CLI surface.
**Current focus:** v1.5 (Phases 26-31) is in progress — Phase 26 (Validação na escrita, VAL-01/02/03) is complete. Requirements and roadmap were derived from a verified onboarding report (RBR fund-controladoria routine calendar: 18 fundos, 84 templatesRotina, 168 instanciasRotina), not from a spec or discussion — each of the 8 reported issues was confirmed against the live code before being accepted as a requirement. Next step: `/gsd-plan-phase 27`.

## Current Position

Phase: 31
Current Plan: Not started
Total Plans in Phase: 2
Status: All phases complete
Last activity: 2026-09-22 — Phase 31 complete

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**

- Total plans completed: 5 (v1.4, both phases fully done; 44 lifetime across v1.0+v1.1+v1.2+v1.3+v1.4)
- Average duration: ~19min (v1.4 plans: 24-01 25min, 24-02 ~30min, 25-01 ~12min, 25-02 8min)
- Total execution time: ~75 min (v1.4)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 29 | 1 | - | - |
| 30 | 2 | - | - |
| 31 | 2 | - | - |

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
| Phase 26 P01 | ~15min | 3 tasks | 8 files |
| Phase 27 P01 | ~20min | 2 tasks | 10 files |
| Phase 27 P02 | ~25min | 2 tasks | 6 files |
| Phase 28 P01 | 25min | 1 tasks | 1 files |
| Phase 28 P02 | 10min | 2 tasks | 8 files |
| Phase 28-periodicidade-semanal P03 | 4min | 1 tasks | 4 files |
| Phase 29 P01 | ~25min | 2 tasks | 6 files |
| Phase 30 P01 | ~50min | 2 tasks | 6 files |
| Phase 31 P01 | 20min | 2 tasks | 5 files |
| Phase 31 P02 | ~35min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (all sourced from the locked SPEC, see PROJECT.md Constraints).

- v1.4 requirements (PKG-01..05, AUTH-01..05) originated from a live-code discussion, not a research phase: `find_repo_root()`-based lookups in `bizdays.py`/`config.py` break outside the monorepo checkout, and `apollo auth login` unnecessarily depends on `INSTANT_APP_ADMIN_TOKEN` because the `instantdb` Python Admin SDK only wraps the `/admin/*` magic-code endpoints, not the public `/runtime/auth/*` ones the JS SDK already uses.
- v1.4 roadmap derivation: 10 requirements grouped into 2 phases (24-25) along the natural PKG/AUTH category boundary — no further split, per this milestone's explicit small/surgical scope (`cli/`-only, 3 related fixes). Phase 24 (packaging: vendored calendar + embedded default `app_id` + real `uv build`/`uv tool install` proof) sequenced before Phase 25 (auth: public `/runtime/auth/*` login) because AUTH-04 explicitly requires `apollo doctor`/`admin_token_present` to reflect PKG-03/PKG-04's new `app_id` resolution order — Phase 25 cannot be verified as "unaltered beyond what PKG-03/04 required" until Phase 24 lands.
- v1.4 explicit non-goal, reaffirmed in REQUIREMENTS.md Context: `admin_token_present`/`apollo doctor` are kept exactly as-is (dev/ops support only), not removed even though the real login path no longer needs an admin token after this milestone.
- v1.4 verification approach unchanged from v1.0-v1.3: no human UAT — every phase proven via real `uv build`/`uv tool install` runs in an isolated environment, real `pytest`/`ruff`/`ty` runs, and (for AUTH-01) a real magic-code email round trip against the live InstantDB app.
- v1.5 requirements originated from a real onboarding report (not a spec/discussion): an agent cadastrou o calendário de rotinas de controladoria da RBR via `apollo` CLI (18 fundos, 84 templatesRotina, 168 instanciasRotina) and hit 8 issues, each verified against `routine_job.py`/`routineJob.ts`/`bizdays.py`/`entities/rotina.py` before being accepted.
- v1.5 roadmap derivation: 12 requirements grouped into 6 phases (26-31), P0 (falhas silenciosas) primeiro, depois P1 (lacunas de cobertura do calendário), depois P2 (atrito operacional) — Phase 26 (validação de escrita, sem tocar o job) antes de Phase 27 (robustez do job) para não colidir edições na mesma janela; Phase 28 (semanal) depende de 27 por estender o mesmo dispatch de `tipoGeracao`; Phase 29 (recorte de range) depende de 28 para cobrir o tipo semanal também; Phases 30-31 (higiene/lote) são tecnicamente independentes, sequenciadas por último por prioridade.
- v1.5 decisões de implementação registradas em REQUIREMENTS.md Context: (1) JOB-01 normaliza a comparação de `status` em vez de fechar o vocabulário — `status` continua livre por decisão de produto já aplicada a outras entidades; (2) VAL-02 marca `propagarAtrasoSoft` como reservado em vez de implementar propagação — implementar reabriria C-09 (travado); (3) JOB-02 estende `du_fixo` para aceitar offset negativo em vez de criar um `tipoGeracao` novo — `add_business_days` já suporta contagem negativa; (4) SEM-01 (periodicidade semanal) será implementado por decisão explícita do usuário, mesmo cobrindo só 1 evento em 87 no calendário de origem.
- v1.5 causa raiz adicional encontrada além do relatado pelo usuário (LIFE-03): o resíduo de teste E2E na base real (achado do usuário em P2-2) não é um incidente pontual — não existe hoje um `app_id` de teste separado do usado para dados reais em nenhum dos dois runtimes, então qualquer rodada futura de teste `live`/Playwright pode reintroduzir o mesmo resíduo até essa separação existir.
- [Phase ?]: [Phase 27, Plan 02]: _is_concluida/isConcluida normalize the encadeado dataPrevistaEstimada status comparison (NFKD decompose + strip combining marks + casefold, recognizing both concluida/concluido grammatical forms) without closing status's free-text vocabulary at write time; nome threaded through every skipped entry in both runtimes with no InstantDB query change needed (already unrestricted); shared/routine-job.testcases.json mechanically retrofitted across all 28 scenarios. Phase 27 (Robustez do job) now fully complete: JOB-01/02/03.
- [Phase 29]: [Phase 29, Plan 01]: range_override/rangeOverride fully REPLACES (never intersects) the default [today, end_of_next_month(today)] window via months_in_range/monthsInRange's generalization of the old today-derived candidate_months. Live-proven against production InstantDB for all 4 ROADMAP success criteria (single-competencia generation, mid-month recovery of a passed date, and row-id-identical idempotency across recorte and default-range runs).
- [Phase 30]: D-01/D-02 (LIFE-01/LIFE-02) implemented exactly as locked: deletar blocks by default with exact linked-instance count (exit 2, zero writes), --force bypasses without cascading; limpar-orfas lists by default, --confirmar deletes exactly the falsy-or-absent-template-link orphans.
- [Phase 30]: D-03 (Success Criterion 3): real production account had 22 orphaned instanciasRotina at execution time (not the originally documented 4) — all removed live via limpar-orfas --confirmar as part of this plan's own verification; production now holds 0 orphans.
- [Phase 31]: The 2 encadeado chains in the 18/84-scale fixture are carved out of the templates the cyclic tipoGeracao assignment already typed 'encadeado', keeping 'cycles through all 4 tipoGeracao values' literally true for every template
- [Phase 31]: Partial-resume test pre-seeds the associated fundo first (fixing its real id) before seeding dependent templates, so the natural-key match against apollo import's own resolution is guaranteed

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
| Test fragility | `cli/tests/test_crud_rotina_template.py`'s `--limit 50` assumption breaks against the real account's 84+ `templatesRotina` rows (Phases 26/30) | Deferred — pre-existing, unrelated to any single phase's diff, documented in `.planning/phases/26-valida-o-na-escrita/deferred-items.md` and `.planning/phases/30-ciclo-de-vida-e-higiene-de-dados/deferred-items.md` | v1.5 close |
| Test fragility | `cli/tests/test_routine_job.py`'s account-wide `existing == []` assertion breaks against accumulated live data (Phase 29) | Deferred — pre-existing, unrelated, documented in `.planning/phases/29-controle-de-geracao/deferred-items.md` | v1.5 close |
| Test fragility | 3 `web/e2e` tests (2 dashboard heatmap density-band assertions, 1 cross-channel `existing==[]` assertion) fail against the growing real account (Phase 30) | Deferred — pre-existing, unrelated, same root-cause class as the two items above; documented in `.planning/phases/30-ciclo-de-vida-e-higiene-de-dados/deferred-items.md`. Recommend a dedicated future pass scoping every such assertion to its own test's created/seeded rows | v1.5 close |
| UI | Fundo detail read-only block (rotinas/projetos/tickets vinculados) outside the Dashboard's Fundo dialog | Deferred — Fundo dialog (nº 5) already covers this in v1.3; standalone Fundos-page block stays deferred | v1.3 kickoff |
| Config | New config storage mechanism (e.g. `~/.config/apollo-cli/config.toml`) for multiple simultaneous InstantDB apps | Deferred — no real use case today (single-user, single-app) | v1.4 kickoff |
| Release | Real PyPI publication / automated release CI | Deferred — out of scope for v1.4, which resolves only local `uv tool install` installability | v1.4 kickoff |

## Session Continuity

Last session: 2026-09-22T22:36:36.899Z
Stopped at: Phase 31 complete — all phases complete
Resume file: None

## Operator Next Steps

- Phase 26 (Validação na escrita — VAL-01/02/03) is complete, live-verified. Next: `/gsd-plan-phase 27` (Robustez do job — JOB-01/02/03), then proceed phase by phase through 31.
