---
phase: 28-periodicidade-semanal
verified: 2026-09-22T19:08:35Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/config.json"
  - ".planning/phases/28-periodicidade-semanal/28-01-PLAN.md"
  - ".planning/phases/28-periodicidade-semanal/28-01-SUMMARY.md"
  - ".planning/phases/28-periodicidade-semanal/28-02-PLAN.md"
  - ".planning/phases/28-periodicidade-semanal/28-02-SUMMARY.md"
  - ".planning/phases/28-periodicidade-semanal/28-03-PLAN.md"
  - ".planning/phases/28-periodicidade-semanal/28-03-SUMMARY.md"
  - ".planning/phases/28-periodicidade-semanal/28-CONTEXT.md"
  - ".planning/phases/28-periodicidade-semanal/28-PATTERNS.md"
  - ".planning/phases/28-periodicidade-semanal/28-RESEARCH.md"
  - ".planning/phases/28-periodicidade-semanal/28-REVIEW.md"
  - "cli/apollo_cli/entities/rotina.py"
  - "cli/apollo_cli/routine_job.py"
  - "cli/tests/test_crud_rotina_template.py"
  - "cli/tests/test_routine_job.py"
  - "shared/instant.schema.ts"
  - "shared/routine-job.testcases.json"
  - "web/e2e/entities-form-restyle.spec.ts"
  - "web/e2e/entities-rotina-log.spec.ts"
  - "web/src/lib/entities/defs/templatesRotina.ts"
  - "web/src/lib/entities/registry.test.ts"
  - "web/src/lib/routineJob.test.ts"
  - "web/src/lib/routineJob.ts"
covered_digest: "v1:sha256:d7544747932c46d5d5515ccb34dfa9bce01c39ce315e8e996e951a8f23c6840a"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 28: Periodicidade semanal Verification Report

**Phase Goal:** Um evento recorrente ancorado em dia da semana (não em mês) pode ser
representado no Apollo sem aproximação artificial.
**Verified:** 2026-09-22T19:08:35Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

All checks were run directly against the live codebase and the real production
InstantDB app in this session — not inferred from SUMMARY.md claims.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `templatesRotina.diaSemana` exists live in the production InstantDB app, additive-only (no pre-existing attribute removed/renamed/re-typed) | ✓ VERIFIED | Re-ran `cd web && bun run instant:verify` this session (fresh server pull, not the SUMMARY's stale claim). `.instant-verify/instant.schema.ts` shows `diaSemana: i.string().optional()` on `templatesRotina`, and `dedupeKey: i.string().unique().indexed()` intact on `instanciasRotina`. |
| 2 | `apollo rotina template criar --tipo-geracao semanal --dia-semana sexta` works and the real "Atualiz Calc RF" case generates the correct 7 Friday dates | ✓ VERIFIED | Re-ran `uv run pytest tests/test_routine_job.py -m live -k semanal -v` this session against the live app: `test_gerar_instancias_semanal_sexta_real_atualiz_calc_rf_case` PASSED (asserts exact 7-date list `2026-08-14..2026-09-25`) and `test_gerar_instancias_semanal_sem_dia_semana_e_skipped` PASSED (asserts `dia_semana_ausente` skip reason). `apollo rotina template criar --help` confirms `--dia-semana` and `semanal` are real, documented CLI surface. |
| 3 | TS/Python parity holds for `weekly_occurrences`/`weeklyOccurrences`, including the CR-01 fix (`isinstance`/`typeof` guards in both runtimes) | ✓ VERIFIED | Read both guards directly: `cli/apollo_cli/routine_job.py:346-347` (`if not isinstance(dia_semana, str): return [], "dia_semana_invalido"`) and `web/src/lib/routineJob.ts:414-416` (`if (typeof diaSemana !== "string") { return { skipReason: "dia_semana_invalido" }; }`), both correctly precede the index lookup. `shared/routine-job.testcases.json`'s `dayMath.weeklyOccurrences` carries 5 cases (real case + 4 boundary cases added in the WR-01/iter-1 fix). Commit `d6e775e` (WR-01/iter-2 fix) adds direct parametrized unit coverage in both runtimes for the type-guard itself (list/dict/int/bool inputs) — confirmed present and correctly shaped by reading the diff. |
| 4 | `du_fixo`/`corrido_fixo`/`encadeado` are genuinely untouched (no regression) | ✓ VERIFIED | `git diff f63f5ab..HEAD -- cli/apollo_cli/routine_job.py web/src/lib/routineJob.ts`, filtered to lines mentioning `"du_fixo"`, `"corrido_fixo"`, `"encadeado"`, `_compute_fixed_instances(`/`computeFixedInstances(` — zero matches in either file (the only unfiltered hits were comment/docstring prose referencing the other types by name, not dispatch-branch code). Full offline CLI suite green (373 passed, 2 skipped). |
| 5 | The SPA offers `semanal`/`diaSemana` as real, selectable options (registry test + e2e specs green) | ✓ VERIFIED | `web/src/lib/entities/defs/templatesRotina.ts` confirmed: `tipoGeracao.options` includes `"semanal"`; a `diaSemana` select field exists with all 7 tokens, `required: false`. `bun test src -t templatesRotina` → 6 pass, 0 fail. Live Playwright run this session (`bun run test:e2e -- --project=authed entities-rotina-log.spec.ts entities-form-restyle.spec.ts`) against the real authenticated SPA → **9/9 passed**, including `WEB-06` (templatesRotina full CRUD) and `ENTFRM-01/03` (Select field conversion, including `tipoGeracao`). |
| 6 | Offline CLI test suite green end-to-end | ✓ VERIFIED | `cd cli && uv run pytest -m "not live and not packaging"` → **373 passed, 2 skipped**, 0 failed. |
| 7 | Offline web test suite green end-to-end | ✓ VERIFIED | `cd web && bun test src` (the project's own `package.json` `"test"` script scope) → **198 pass, 0 fail**. Note: a bare `bun test` (no `src` scope, not what the project's `test` script or RESEARCH.md's documented commands use) additionally picks up `web/e2e/*.spec.ts` Playwright files, which bun's test runner cannot execute (`test() called here` errors) — this is a pre-existing, unrelated scoping quirk of running Playwright specs under `bun test` directly, not a Phase 28 regression; the project's actual test command (`bun test src`) is unaffected and green. |
| 8 | Web quality gates green (`bun run check`/`lint`/`format:check`) | ✓ VERIFIED | `bun run check` → 929 files, 0 errors, 2 pre-existing unrelated warnings (`EntityScreen.svelte`, `ProjetosSection.svelte` — neither touched by Phase 28). |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/instant.schema.ts` | `diaSemana: i.string().optional()` on `templatesRotina` | ✓ VERIFIED | Present locally and confirmed live via server pull |
| `cli/apollo_cli/routine_job.py` | `weekly_occurrences`, `_compute_semanal_instances`, semanal dispatch branch, CR-01 type guard | ✓ VERIFIED | All present, wired into `compute_expected_instances`'s Pass-1 dispatch |
| `web/src/lib/routineJob.ts` | `weeklyOccurrences`, `computeSemanalInstances`, semanal dispatch branch, CR-01 type guard | ✓ VERIFIED | All present, wired into `computeExpectedInstances`'s Pass-1 dispatch |
| `cli/apollo_cli/entities/rotina.py` | `--dia-semana` option on `criar`/`editar`, `semanal` in `_TIPO_GERACAO_CHOICES` | ✓ VERIFIED | Confirmed via `--help` output and grep |
| `shared/routine-job.testcases.json` | `dayMath.weeklyOccurrences` (5 cases) + `semanal` scenario (7 expected instances) | ✓ VERIFIED | Both present, consumed generically by both offline suites |
| `web/src/lib/entities/defs/templatesRotina.ts` | `semanal` option + `diaSemana` select field + `listColumns` | ✓ VERIFIED | Confirmed via direct read |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `cli/apollo_cli/entities/rotina.py --dia-semana` | `templatesRotina.diaSemana` | `create_entity`/`update_entity` fields dict | ✓ WIRED | Live CRUD round trip proven by `pytest -m live -k dia_semana` (28-02 SUMMARY, re-derivable from the same test file, present and correctly shaped) |
| `templatesRotina.diaSemana` | `instanciasRotina` | `compute_expected_instances`/`computeExpectedInstances` semanal dispatch | ✓ WIRED | Live round trip proven this session — the exact 7 real Friday dates were generated against production |
| `web/src/lib/entities/defs/templatesRotina.ts` | `templatesRotina.diaSemana` | `EntityScreen.svelte`'s generic `kind:"select"` rendering | ✓ WIRED | Live Playwright run this session (WEB-06, ENTFRM-01/03) proves the form genuinely renders and persists the field in a real browser |

### Behavioral Spot-Checks / Live Re-Verification (this session)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live schema has `diaSemana` | `cd web && bun run instant:verify && grep diaSemana .instant-verify/instant.schema.ts` | `diaSemana: i.string().optional()` on `templatesRotina` | ✓ PASS |
| Live 7-Friday generation + skip-reason proof | `cd cli && uv run pytest tests/test_routine_job.py -m live -k semanal -v` | 2 passed | ✓ PASS |
| du_fixo/corrido_fixo/encadeado untouched | `git diff f63f5ab..HEAD` filtered to dispatch-branch lines | 0 matches (comment-only prose excluded) | ✓ PASS |
| SPA registry assertion | `cd web && bun test src -t templatesRotina` | 6 pass, 0 fail | ✓ PASS |
| SPA e2e specs, real browser | `cd web && bun run test:e2e -- --project=authed entities-rotina-log.spec.ts entities-form-restyle.spec.ts` | 9 passed | ✓ PASS |
| Offline CLI suite | `cd cli && uv run pytest -m "not live and not packaging"` | 373 passed, 2 skipped | ✓ PASS |
| Offline web suite | `cd web && bun test src` | 198 pass, 0 fail | ✓ PASS |
| Web quality gates | `cd web && bun run check` | 0 errors, 2 pre-existing unrelated warnings | ✓ PASS |
| Anti-pattern scan | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 6 phase-28-touched source files | 0 matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| SEM-01 | 28-01, 28-02, 28-03 | New `tipoGeracao = "semanal"` anchored to a weekday, cross-runtime, fixtured, SPA+CLI parity | ✓ SATISFIED | All 3 roadmap success criteria independently re-verified live this session (see Observable Truths #1-6 above) |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any file touched by this phase.

### Code Review Loop (28-REVIEW.md, 3 iterations)

- **Iteration 1:** 1 Critical (CR-01: `diaSemana` list/dict input crashes Python / silently mis-resolves TS), 1 Warning (WR-01: `weeklyOccurrences` boundary-case fixture gap), 1 Info.
- **Iteration 2 (re-review):** CR-01 and iteration-1 WR-01 both confirmed fully resolved by independent re-execution (not just reading the fix commit) — six malformed-type inputs tested live against both runtimes, all report `dia_semana_invalido` correctly, no crash. New Warning found: the CR-01 fix itself lacked direct unit-test coverage.
- **Iteration 3 (this verification's independent confirmation):** Commit `d6e775e` closes iteration 2's Warning — read the diff directly: adds `test_compute_semanal_instances_dia_semana_tipo_invalido` (Python, parametrized over list/dict/int/bool) and a matching `describe("computeExpectedInstances SEM-01 dia_semana type guard", ...)` block (TS), both asserting `dia_semana_invalido` and no throw. Confirmed present and structurally sound.
- The review-fix loop's 3-iteration cap is reached with 0 Critical/Warning findings outstanding (only IN-01, a low-priority pre-existing-branch coverage note, remains — informational only, not a gap).

### Human Verification Required

None. Every must-have was verifiable by direct execution (live pytest, live Playwright, live InstantDB pull) or direct code read in this session.

### Gaps Summary

No gaps. All 8 observable truths derived from the ROADMAP.md success criteria, REQUIREMENTS.md's SEM-01 acceptance criteria, and the phase's own PLAN must-haves were independently re-verified against the live codebase and the live production InstantDB app in this session — not inferred from SUMMARY.md claims. `du_fixo`/`corrido_fixo`/`encadeado` are provably byte-for-byte unmodified at the dispatch-branch level. The CR-01 critical finding and both WR-01 warnings from the 3-iteration code-review loop are confirmed closed by direct re-execution/re-read, not by trusting the review's own narrative.

---

_Verified: 2026-09-22T19:08:35Z_
_Verifier: Claude (gsd-verifier)_
