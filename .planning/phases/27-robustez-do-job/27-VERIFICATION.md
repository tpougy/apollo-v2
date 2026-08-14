---
phase: 27-robustez-do-job
verified: 2026-08-14T23:15:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 27: Robustez do job Verification Report

**Phase Goal:** O job de geração para de depender de comparações frágeis (grafia exata de "concluida") e para de recusar entradas reais do calendário (offset negativo em du_fixo); diagnosticar um skipped em lote deixa de exigir cruzar ids manualmente.
**Verified:** 2026-08-14T23:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An `encadeado` successor whose antecessor's persisted instance has `status` = `"Concluída"`/`"CONCLUIDA"`/`"concluído"` (any casing/accent/whitespace variant) is treated as concluded for `dataPrevistaEstimada` purposes, identically in both runtimes (JOB-01) | ✓ VERIFIED | Live-executed `_is_concluida("Concluída"/"CONCLUIDA"/"concluído "/"concluida") == True`, `_is_concluida("concluidas"/"pendente") == False` directly against `cli/apollo_cli/routine_job.py`. Wired at `routine_job.py:518` (`estimada = (not record.persisted) or not _is_concluida(record.status)`) and TS twin `routineJob.ts:560`. Live pytest `test_gerar_instancias_recognizes_normalized_concluida_status` (`pytest.mark.live` against production InstantDB) **executed by verifier, PASSED**. |
| 2 | `du_fixo --offset-dias -2` is accepted and `gerar-instancias` produces 2026-08-27 for August 2026 (real onboarding "Prévia DU-2" case) (JOB-02) | ✓ VERIFIED | Live-executed `nth_business_day_from_month_end(2026,8,-2) == "2026-08-27"`. Live-executed real CLI command `apollo rotina template criar --tipo-geracao du_fixo --offset-dias -2 ...` → exit 0 (created + cleaned up by verifier). Live pytest `test_gerar_instancias_du_fixo_offset_le_zero_real_previa_du2_case` **executed by verifier, PASSED** against production InstantDB, proving `2026-08-27`/`2026-09-28`. |
| 3 | `du_fixo --offset-dias 0` produces the month's last business day (JOB-02) | ✓ VERIFIED | Live-executed `nth_business_day_from_month_end(2026,8,0) == "2026-08-31"` and `nth_business_day_from_month_end(2026,1,0) == "2026-01-30"` (Saturday month-end rollback case). Covered by the same live pytest above (offset=0 branch asserts `2026-08-31`/`2026-09-30`). |
| 4 | Every `skipped` entry includes `nome` alongside `templateId`/`reason`, in both runtimes (JOB-03) | ✓ VERIFIED | `grep` confirms all 8 `skipped.append(...)` sites in `routine_job.py` and all 8 `skipped.push(...)` sites in `routineJob.ts` include `nome`. Live pytest `test_gerar_instancias_skipped_entries_include_template_nome` **executed by verifier, PASSED** against production InstantDB. |
| 5 | `shared/routine-job.testcases.json`/`shared/bizdays.testcases.json` gain fixture coverage for both requirements, consumed identically by CLI/web test suites | ✓ VERIFIED | 5 new `nthBusinessDayFromMonthEnd` cases in `shared/bizdays.testcases.json`; `tpl-d`/`tpl-n1`/`tpl-b4b`-`tpl-b4e` scenarios present in `shared/routine-job.testcases.json` (programmatically confirmed, 30 total scenarios, zero missing `nome` on any `templates[]`/`expectedSkipped[]` entry). Full offline suites **executed by verifier**: `cli` 363 passed/2 skipped; `web` (`bun run test` = `bun test src`) 187 passed/0 failed. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| JOB-01 | 27-02-PLAN.md | Normalize `encadeado` "concluída" status comparison | ✓ SATISFIED | `_is_concluida`/`isConcluida` wired and live-proven; `--status` remains free text (no `click.Choice`, confirmed via grep) |
| JOB-02 | 27-01-PLAN.md | `du_fixo` accepts `offsetDias <= 0` | ✓ SATISFIED | `nth_business_day_from_month_end`/`nthBusinessDayFromMonthEnd` wired and live-proven; `corrido_fixo` confirmed untouched (`min_value=1`, `nth_calendar_day_of_month`) |
| JOB-03 | 27-02-PLAN.md | `nome` in every `skipped` entry | ✓ SATISFIED | All 8 sites in both runtimes confirmed via grep; live-proven |

No orphaned requirements — REQUIREMENTS.md's traceability table maps exactly JOB-01/02/03 to Phase 27, and both plans jointly declare and close all three.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `cli/apollo_cli/bizdays.py` | `nth_business_day_from_month_end(year, month, n)` | ✓ VERIFIED | Present at line 127, built on `add_business_days`/`is_business_day`; live-executed and matches expected dates |
| `web/src/lib/bizdays.ts` | twin `nthBusinessDayFromMonthEnd` + private `lastDayOfMonth` | ✓ VERIFIED | Present, imported into `routineJob.ts` |
| `cli/apollo_cli/routine_job.py` | `_DU_FIXO_MIN_OFFSET_DIAS`, `_du_fixo_nth_day`, `_is_concluida`, `_CONCLUIDA_FORMS`, `nome` in `_normalize_template` and all `skipped` sites | ✓ VERIFIED | All present and wired at call sites (verified via grep + line reads) |
| `web/src/lib/routineJob.ts` | twin symbols | ✓ VERIFIED | All present (`DU_FIXO_MIN_OFFSET_DIAS`, `duFixoNthDay`, `isConcluida`, `CONCLUIDA_FORMS`, `nome: string` on `TemplateRow`/`SkippedTemplate`) |
| `cli/apollo_cli/entities/rotina.py` | `--offset-dias`/`--status` help text updated | ✓ VERIFIED | `--help` output contains "last business day" (criar and editar) and `_is_concluida` (instancia status), live-executed |
| `cli/tests/test_routine_job.py` | 3 new live tests | ✓ VERIFIED | All 3 executed by verifier and PASSED against production InstantDB |
| `shared/bizdays.testcases.json` | 5 new fixture cases | ✓ VERIFIED | All 5 present with correct `year`/`month`/`n`/`expected` |
| `shared/routine-job.testcases.json` | `tpl-d` corrected, `tpl-n1`/`tpl-b4b`-`tpl-b4e` added, full `nome` retrofit | ✓ VERIFIED | Programmatically confirmed — 30 scenarios, zero missing `nome` |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `routine_job.py`'s `du_fixo` branch | `_du_fixo_nth_day` → `nth_business_day_of_month`/`nth_business_day_from_month_end` | sign-based dispatch | ✓ WIRED | `_compute_fixed_instances(..., _DU_FIXO_MIN_OFFSET_DIAS, _du_fixo_nth_day)` at line 416-417; `corrido_fixo` call site 2 lines below unchanged (`1, nth_calendar_day_of_month`) |
| `compute_expected_instances`'s encadeado sweep | `_is_concluida(record.status)` → `estimada` | direct call | ✓ WIRED | Line 518, TS twin line 560 |
| `_query_active_templates`/`_normalize_template` | `skipped` entries | `template["nome"]` | ✓ WIRED | All 8 sites in both runtimes confirmed via grep |

### Behavioral Spot-Checks / Live Proofs (executed by verifier, not trusted from SUMMARY)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Real Prévia DU-2 case | `nth_business_day_from_month_end(2026,8,-2)` | `2026-08-27` | ✓ PASS |
| Offset 0 = month-end | `nth_business_day_from_month_end(2026,8,0)` | `2026-08-31` | ✓ PASS |
| Weekend rollback | `nth_business_day_from_month_end(2026,1,0)` | `2026-01-30` | ✓ PASS |
| Status normalization round-trip | `_is_concluida("Concluída"/"CONCLUIDA"/"concluído "/"concluida"/"concluidas"/"pendente")` | `True,True,True,True,False,False` | ✓ PASS |
| CLI accepts negative offset (live write, cleaned up after) | `apollo rotina template criar --tipo-geracao du_fixo --offset-dias -2 ...` then `template deletar` | exit 0 both | ✓ PASS |
| Live test: JOB-02 real case | `uv run pytest tests/test_routine_job.py -m live -k offset_le_zero` | 1 passed | ✓ PASS |
| Live test: JOB-01 real case | `uv run pytest tests/test_routine_job.py -m live -k normalized_concluida` | 1 passed | ✓ PASS |
| Live test: JOB-03 real case | `uv run pytest tests/test_routine_job.py -m live -k skipped_entries_include_template_nome` | 1 passed | ✓ PASS |
| Full offline `cli/` suite | `uv run pytest -m "not live and not packaging"` | 363 passed, 2 skipped | ✓ PASS |
| Full offline `web/` suite | `bun run test` (= `bun test src`) | 187 passed, 0 failed | ✓ PASS |
| Lint/type gates | `ruff check`/`ruff format --check`/`ty check` (cli); `bun run check` (web) | all clean, 0 errors | ✓ PASS |
| `--help` documents new semantics | `apollo rotina template criar/editar --help`, `apollo rotina instancia status --help` | contains "last business day" / "_is_concluida" | ✓ PASS |

### Anti-Patterns Found

None. `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across all files modified by this phase returned zero matches.

### Deferred / Accepted Residual Risk (documented, not a gap)

`deferred-items.md` documents a residual Unicode Mark-category cross-runtime divergence in `_is_concluida`/`isConcluida`: Python 3.12 (UCD 15.0.0) and Node/V8's `\p{M}` (newer UCD) disagree on ~93 code points outside the Latin/Portuguese script. Independently re-verified by the verifier: `_is_concluida("concluida" + U+0897) == False` (Python) vs. the equivalent TS predicate `== true` for the same input — the divergence is real, exactly as documented, and confined to code points (Arabic/Devanagari/Garay marks) implausible in Brazilian-Portuguese fund-controladoria status text. The two originally-reported repro cases (U+20D0, U+0E31) are fixed and fixture-covered. This is a deliberate, cost/benefit-justified, honestly-documented trade-off (3-iteration code-review fix cap reached, WR-01 downgraded to accepted risk) — not re-flagged as a blocking gap per the verification brief.

### Human Verification Required

None. All must-haves are verified via live execution against the real onboarding calendar case, real InstantDB round-trips, and the full offline test suites — all run directly by the verifier, not inferred from SUMMARY.md.

### Gaps Summary

No gaps. All 5 ROADMAP Success Criteria and all 3 requirement IDs (JOB-01, JOB-02, JOB-03) are verified with live evidence collected directly by the verifier: the real onboarding case (`du_fixo` offset -2 → 2026-08-27, offset 0 → 2026-08-31), a real "Concluída" status round-trip through `_is_concluida`, `nome` present in every `skipped` entry in both runtimes, and zero regressions across both languages' full offline test suites (363 + 187 tests). `corrido_fixo` and `du_fixo`'s `offsetDias >= 1` path are confirmed unaffected by direct code reading and the passing regression suite. The one residual known limitation (Unicode Mark-category cross-runtime edge case) is honestly and accurately documented in `deferred-items.md` as an accepted, out-of-scope trade-off, independently re-confirmed by the verifier.

---

_Verified: 2026-08-14T23:15:00Z_
_Verifier: Claude (gsd-verifier)_
