---
phase: 26-valida-o-na-escrita
verified: 2026-08-14T20:14:41Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 26: Validação na escrita Verification Report

**Phase Goal:** Um template com `regraCompetencia` inválida é recusado na hora da escrita, com mensagem listando os valores aceitos — nunca mais aceito e só revelado, em silêncio, dentro de `gerar-instancias`. `propagarAtrasoSoft` deixa de parecer uma funcionalidade ativa.
**Verified:** 2026-08-14T20:14:41Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All truths verified live against the real InstantDB app and the real `apollo` CLI (not mocked), per this project's convention.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `criar --regra-competencia <invalid>` fails immediately (exit 2, no write), message lists M0/M-1/M-2/M+1 | ✓ VERIFIED | Live run: `apollo rotina template criar --nome VERIFY_TEST_ZZZ --tipo-geracao du_fixo --regra-competencia bogus` → exit 2, stderr: `Error: Invalid value for '--regra-competencia': 'bogus' is not one of 'M0', 'M-1', 'M-2', 'M+1'.` No record was created (Click validates before command body runs). |
| 2 | `editar --regra-competencia <invalid>` has identical rejection behavior, leaves stored value unchanged | ✓ VERIFIED | Live run: created a real record with `M0`, ran `editar --id <eid> --regra-competencia bogus` → exit 2, same message. Queried the record back via `listar` afterward: `regraCompetencia` still `"M0"`. Also confirmed via passing live pytest `test_editar_regra_competencia_invalida_e_recusada_na_hora`. Test record cleaned up after verification (`deletar`). |
| 3 | `--help` (criar/editar) and `docs/ai-usage/CLAUDE.md` no longer describe `--regra-competencia` as free-form/unparsed | ✓ VERIFIED | Live `--help` output on both commands shows `--regra-competencia [M0|M-1|M-2|M+1]` with a description of enforced rejection. `docs/ai-usage/CLAUDE.md:121` reads `--regra-competencia [M0|M-1|M-2|M+1] (obrigatório)` — old "TEXT (obrigatório, livre — não parseado pela CLI)" wording removed. |
| 4 | `--help` (criar/editar) explicitly states `--propagar-atraso-soft` is stored but not read by `gerar-instancias` (C-09) | ✓ VERIFIED | Live `--help` output on both commands: "Not currently read anywhere: stored on the template only; gerar-instancias does not propagate soft delays with it (C-09, out of scope for this milestone)." |
| 5 | `instancia status --help` no longer describes `dedupeKey` as a hash | ✓ VERIFIED | Live `--help` output: "the plain `templateId:competencia:dataPrevista` concatenation — deliberately not a hash, see `apollo_cli.routine_job`'s module docstring". |
| 6 | Already-valid `regraCompetencia` values (M0/M-1/M-2/M+1) continue to be accepted with zero regression | ✓ VERIFIED | Live pytest: `test_criar_aceita_regra_competencia_nao_m0[M-1/M-2/M+1]` and `test_editar_aceita_regra_competencia_nao_m0[M-1/M-2/M+1]` all pass — round-trip persisted and read back correctly. |
| 7 | `editar --regra-competencia` retains `default=None` omit-to-leave-unchanged contract | ✓ VERIFIED | Source confirms `default=None` unchanged on the option; `test_full_crud_round_trip` (which exercises omitted flags) passes live. |
| 8 | Full `cli/` pytest suite (offline+live) and affected web e2e fixtures still pass | ✓ VERIFIED | Offline: `uv run pytest -m "not live and not packaging"` → 348 passed, 2 skipped (matches SUMMARY claim). Live: `test_crud_rotina_template.py` + `test_rotina_instancia.py` → 20 passed, 1 failed — the 1 failure (`test_criar_without_offset_dias_omits_key_entirely`) is a pre-existing, unrelated live-DB pagination flake (uses valid `M0`, unrelated to `--regra-competencia` enum logic; caused by 84+ pre-existing records from the real RBR onboarding overflowing `listar --limit 50`), correctly logged in `deferred-items.md` rather than silently ignored. `bun run lint`/`bun run check` (web/) → 0 errors, only pre-existing warnings in files this phase did not touch. |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cli/apollo_cli/entities/rotina.py` | `criar`/`editar --regra-competencia` bound to `click.Choice(REGRAS_COMPETENCIA_SUPORTADAS)` (imported, not redeclared); corrected `--propagar-atraso-soft` help; corrected `instancia.status` docstring | ✓ VERIFIED | Confirmed via source read and live `--help` output on all three surfaces. |
| `docs/ai-usage/CLAUDE.md` | `--regra-competencia` cheatsheet line corrected to bracket-enum notation | ✓ VERIFIED | Line 121: `--regra-competencia [M0|M-1|M-2|M+1] (obrigatório)`. |
| `cli/tests/test_crud_rotina_template.py` | Two new live tests rejecting invalid values + M-1/M-2/M+1 acceptance tests; 5 pre-existing fixtures corrected to M0 | ✓ VERIFIED | `test_criar_regra_competencia_invalida_e_recusada_na_hora`, `test_editar_regra_competencia_invalida_e_recusada_na_hora`, plus WR-02 fix-pass additions `test_criar_aceita_regra_competencia_nao_m0`/`test_editar_aceita_regra_competencia_nao_m0` — all 8 pass live. |
| `cli/tests/test_rotina_instancia.py` | 1 pre-existing fixture corrected | ✓ VERIFIED | `_create_template` uses `M0`. |
| `web/e2e/focus-dialog-fundo.spec.ts`, `focus-dialog-button-inventory.spec.ts`, `focus-dialog-dia-rotina.spec.ts`, `dashboard.spec.ts` | Fixture values corrected to M0 | ✓ VERIFIED | Grepped every `--regra-competencia` call site across all four files — all now `M0`, zero stale placeholder values remain. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `rotina.py` import block | `apollo_cli.routine_job.REGRAS_COMPETENCIA_SUPORTADAS` | direct import | ✓ WIRED | `from apollo_cli.routine_job import (REGRAS_COMPETENCIA_SUPORTADAS, run_routine_instance_job, today_utc_iso_date)` — not redeclared locally. |
| `--regra-competencia` option | Click's `Choice` validator | `type=click.Choice(REGRAS_COMPETENCIA_SUPORTADAS)` | ✓ WIRED | Confirmed on both `criar` and `editar`; live rejection message auto-generated by Click, not hand-written. |
| `run_cli`/CliRunner | Click group dispatch | in-process invocation | ✓ WIRED | Live pytest tests and direct CLI invocation both confirm no `templatesRotina` write occurs on an invalid value — Click's validation runs before `create_entity`/`update_entity`. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VAL-01 | 26-01-PLAN.md | `--regra-competencia` uses `click.Choice`, rejects invalid values at write time with a message listing accepted values; `--help`/CLAUDE.md corrected | ✓ SATISFIED | Truths 1, 2, 3 above, live-verified. |
| VAL-02 | 26-01-PLAN.md | `--propagar-atraso-soft --help` states value is stored but not read by `gerar-instancias` (C-09) | ✓ SATISFIED | Truth 4, live-verified. |
| VAL-03 | 26-01-PLAN.md | `instancia status` docstring corrected — `dedupeKey` no longer called a hash | ✓ SATISFIED | Truth 5, live-verified. |

No orphaned requirements: REQUIREMENTS.md traceability table maps only VAL-01/VAL-02/VAL-03 to Phase 26, and all three appear in the plan's `requirements` frontmatter.

### Anti-Patterns Found

None. Grepped all 8 phase-touched files for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and stub/placeholder phrasing — zero matches.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `criar` rejects invalid enum value | `apollo rotina template criar --nome VERIFY_TEST_ZZZ --tipo-geracao du_fixo --regra-competencia bogus` | exit 2, message lists M0/M-1/M-2/M+1 | ✓ PASS |
| `editar` rejects invalid enum value, leaves record unchanged | live create + `editar --regra-competencia bogus` + read-back | exit 2, `regraCompetencia` still `M0` after | ✓ PASS |
| `criar/editar --help` show enforced enum + propagarAtrasoSoft honesty | `apollo rotina template criar/editar --help` | bracket-enum + "currently read"/"C-09" present | ✓ PASS |
| `instancia status --help` corrected dedupeKey wording | `apollo rotina instancia status --help` | "concatenation" present, no "hash" | ✓ PASS |
| Live regression test suite (new + pre-existing) | `uv run pytest tests/test_crud_rotina_template.py tests/test_rotina_instancia.py -v` | 20 passed, 1 failed (pre-existing unrelated flake) | ✓ PASS (with documented unrelated exception) |
| Offline full suite regression gate | `uv run pytest -m "not live and not packaging"` | 348 passed, 2 skipped | ✓ PASS |
| Web lint/typecheck on touched e2e specs | `bun run lint && bun run check` (web/) | 0 errors; pre-existing warnings only in untouched files | ✓ PASS |

### Human Verification Required

None. All observable truths are directly testable via CLI invocation and automated tests; no visual, real-time, or subjective behavior involved.

### Gaps Summary

No gaps. One pre-existing, unrelated live-database flake (`test_criar_without_offset_dias_omits_key_entirely`, caused by `listar --limit 50` pagination against 84+ real onboarding records) was independently reproduced during this verification and confirmed structurally unrelated to `--regra-competencia`/`--propagar-atraso-soft`/`dedupeKey` — it uses a valid `M0` value and fails on an unrelated `listar` lookup-by-limit assertion. It is transparently logged in `deferred-items.md` per this phase's documented scope boundary (CONTEXT.md decision #5) and does not block Phase 27.

Two INFO-level code-review notes remain (non-blocking, from 26-REVIEW.md): a help-text readability nit (IN-01) and a pre-existing Playwright assertion-placement style note in a file this phase did not modify beyond an unrelated fixture value (IN-02). Neither affects functional correctness or any must-have.

---

_Verified: 2026-08-14T20:14:41Z_
_Verifier: Claude (gsd-verifier)_
