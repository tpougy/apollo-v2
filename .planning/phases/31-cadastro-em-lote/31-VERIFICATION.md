---
phase: 31-cadastro-em-lote
verified: 2026-09-22T00:00:00Z
status: passed
score: 8/8 must-haves verified
covered_files: [".planning/REQUIREMENTS.md", ".planning/ROADMAP.md", ".planning/phases/31-cadastro-em-lote/31-01-PLAN.md", ".planning/phases/31-cadastro-em-lote/31-01-SUMMARY.md", ".planning/phases/31-cadastro-em-lote/31-02-PLAN.md", ".planning/phases/31-cadastro-em-lote/31-02-SUMMARY.md", ".planning/phases/31-cadastro-em-lote/31-CONTEXT.md", ".planning/phases/31-cadastro-em-lote/31-PATTERNS.md", ".planning/phases/31-cadastro-em-lote/31-RESEARCH.md", ".planning/phases/31-cadastro-em-lote/31-REVIEW.md", "cli/apollo_cli/batch_import.py", "cli/apollo_cli/cli.py", "cli/apollo_cli/entities/rotina.py", "cli/apollo_cli/routine_job.py", "cli/tests/test_batch_import.py", "cli/tests/test_batch_import_file_errors.py"]
covered_digest: "v1:sha256:a82ce9e32fbee5486337812409b1fc0bb37c42d90ba199f69ff0d830c630742d"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 31: Cadastro em lote Verification Report

**Phase Goal:** Cadastrar um calendário inteiro de rotinas não exige uma chamada de CLI por
registro nem perde progresso parcial num erro no meio do lote.
**Verified:** 2026-09-22
**Status:** passed
**Re-verification:** No — initial verification

This is the final phase of milestone v1.5. All verification below was performed by directly
reading the current source and by re-running the live test suite and quality gates myself in
this session — not by trusting SUMMARY.md or REVIEW.md narration.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `apollo import --from-json <arquivo>` exists, validates the whole batch before any write (collect-all-errors, not fail-fast), and supports cross-entity `$local_id` references including `encadeado` antecessor chains | ✓ VERIFIED | `cli/apollo_cli/cli.py:73-123` wires the command; `batch_import.py:583-646` runs two zero-write passes (`_check_*_form`, `_check_local_id_uniqueness`, `_check_fundo_codigo_uniqueness`, `_check_template_natural_key_uniqueness`, `_check_references`, `_check_antecessor_cycles`) collecting into one `errors` list before the single `if errors: _emit_validation_errors(errors)` gate at line 645 — resolution/write code (line 648+) is unreachable until that gate passes. Live-confirmed: `test_import_creates_fundos_and_templates_end_to_end_at_meaningful_scale` and the 18/84-scale test both pass, including 3-hop `encadeado` chains resolved via `antecessorId` DFS (`_check_antecessor_cycles`) and `_resolve_templates`'s two-pass link-building (lines 528-573). |
| 2 | CR-01 fix (in-batch natural-key duplicate detection for fundos-by-codigo and templates-by-fundo+nome) is genuinely wired into the validation path before any write | ✓ VERIFIED | Re-read `batch_import.py:243-300` directly (not taken from REVIEW.md's claim): `_check_fundo_codigo_uniqueness` and `_check_template_natural_key_uniqueness` are called at lines 633-634, their output appended to the same `errors` list gated at line 645-646, strictly before `_resolve_fundos`/`_resolve_templates`/`client.transact` at lines 648+/682. Live-confirmed by re-running `test_import_rejects_duplicate_fundo_codigo_within_same_batch` and `test_import_rejects_duplicate_template_natural_key_within_same_batch` myself — both pass, exit 2, zero writes. |
| 3 | ROADMAP SC3 — 18 fundos + 84 templates in ONE invocation, not 102 | ✓ VERIFIED | `test_full_onboarding_scale_single_invocation_success_criterion_3` (`test_batch_import.py:691-745`) asserts the literal `len(report["fundos"]["created"]) == 18` and `len(report["templatesRotina"]["created"]) == 84` from exactly one `run_cli(["import", "--from-json", ...])` call — not an approximation. Re-ran this test live myself: PASSED (58s runtime confirms it actually hit the real InstantDB backend, not a mock). |
| 4 | ROADMAP SC2 — resumability without duplication (both identical-file re-run AND partial-batch-already-landed) | ✓ VERIFIED | Re-ran both `test_full_onboarding_scale_rerun_is_fully_existing_success_criterion_2` and `test_partial_batch_already_landed_resumes_without_duplication` live myself — both PASSED. Both use `_assert_no_duplicate_rows_by_key` (`test_batch_import.py:177-191`), which queries the RAW row list via `$in` and counts occurrences per key with `collections.Counter` — a real duplicate-detection mechanism, not a dict-collapsing check that would silently hide a second row behind a last-write-wins key. The partial-resume test pre-seeds 7/21 natural keys directly via `live_client.transact` (bypassing the CLI) before running the full batch once, and confirms `existing`/`created` buckets are exactly the pre-seeded/non-pre-seeded split with zero duplicate rows. |
| 5 | C-06 — `instanciasRotina` can never be created via this command, proven both adversarially (top-level-key injection) and structurally (module-attribute scan) | ✓ VERIFIED | `test_top_level_instanciasrotina_key_rejected_wholesale_c06` (re-run live, PASSED) submits a batch with valid fundos/templates PLUS a crafted top-level `instanciasRotina` key; asserts exit 2, the error names `chave_nivel_superior_nao_reconhecida` for that key, zero fundo/template rows created, and unchanged `apollo rotina instancia listar` count. `test_batch_import_module_defines_no_instance_entity_reference` (re-run, PASSED) does a runtime `dir()`/`vars()` scan of the loaded module object (excluding dunders) confirming no attribute name or value references `instanciasRotina`. Both are real, independent tests — not narration. |
| 6 | Offline suites and whole-package gates are green | ✓ VERIFIED | Ran myself: `uv run pytest -m "not live and not packaging"` → 406 passed, 2 skipped. `uv run ruff check` → All checks passed. `uv run ruff format --check .` → 50 files already formatted. `uv run ty check` → All checks passed. |
| 7 | Full live batch-import suite passes | ✓ VERIFIED | Ran the entire `test_batch_import.py` + `test_batch_import_file_errors.py` live suite myself (15 tests): 14 passed on the combined run, 1 (`test_import_creates_fundos_and_templates_end_to_end_at_meaningful_scale`) failed with a transient `[Errno -3] Temporary failure in name resolution` (DNS blip, not a code defect) and passed cleanly when re-run in isolation immediately after. All 15 tests pass; no genuine failures. |
| 8 | No earlier-phase (26/28/29/30) regression introduced by Phase 31 specifically | ✓ VERIFIED | `git diff --stat 24dd78f..34a5743 -- cli/ shared/` shows Phase 31 touched exactly: `batch_import.py` (new, +707), `cli.py` (+56, new command only), `entities/rotina.py` (+12/-6, a pure constant-promotion import-site rename with byte-identical choice-set values, no logic change), `routine_job.py` (+20, two new constants only), `test_batch_import.py`/`test_batch_import_file_errors.py` (new). No file belonging to Phases 26/28/29/30's actual logic was touched beyond this import-site rename, and the full offline suite (406 tests, including all of Phases 26-30's own tests) passes green — the two pre-existing skips are unrelated (confirmed by direct inspection, not new to this phase). |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cli/apollo_cli/batch_import.py` | `run_batch_import` — parse/validate/resolve/write/report | ✓ VERIFIED | 707 lines, substantive, contains `def run_batch_import` (line 583), all validation/resolution helpers present and non-stub |
| `cli/apollo_cli/cli.py` | `apollo import --from-json/--dry-run` wired | ✓ VERIFIED | `@apollo.command(name="import")` at line 73, calls `run_batch_import` then `emit(report)` at lines 121-123 |
| `cli/apollo_cli/routine_job.py` | `TIPO_GERACAO_CHOICES`/`DIA_SEMANA_CHOICES` promoted public | ✓ VERIFIED | Confirmed via diff; imported by both `entities/rotina.py` and `batch_import.py` |
| `cli/apollo_cli/entities/rotina.py` | Imports promoted constants, zero behavior change | ✓ VERIFIED | Diff shows pure rename, `click.Choice(...)` call sites updated, values byte-identical |
| `cli/tests/test_batch_import.py` | Live end-to-end + scale + resume + adversarial tests | ✓ VERIFIED | 1028 lines, 13 live tests, all re-run and passing |
| `cli/tests/test_batch_import_file_errors.py` | Offline WR-02 (OSError/UnicodeDecodeError) coverage | ✓ VERIFIED | 71 lines, 2 tests, both passing |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `cli.py`'s `import_batch` | `batch_import.py`'s `run_batch_import` | `run_batch_import(client, session.user_id, from_json_path, dry_run=dry_run)` | ✓ WIRED |
| `batch_import.py` validation | `routine_job.py`'s promoted choice constants | `from apollo_cli.routine_job import (DIA_SEMANA_CHOICES, REGRAS_COMPETENCIA_SUPORTADAS, TIPO_GERACAO_CHOICES)` | ✓ WIRED |
| CR-01 uniqueness checks | the single validation-error gate | `_check_fundo_codigo_uniqueness`/`_check_template_natural_key_uniqueness` results appended to `errors` before line 645's gate | ✓ WIRED |
| `templatesRotina` existence query | InstantDB `fundoTemplatesRotina` link | `{"fundo.id": fundo_id, "nome": {"$in": nomes}, "donoId": dono_id}` | ✓ WIRED (live-confirmed) |

### Behavioral Spot-Checks / Live Test Runs (performed by this verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full offline suite | `uv run pytest -m "not live and not packaging"` | 406 passed, 2 skipped | ✓ PASS |
| Lint | `uv run ruff check` | All checks passed | ✓ PASS |
| Format | `uv run ruff format --check .` | 50 files already formatted | ✓ PASS |
| Types | `uv run ty check` | All checks passed | ✓ PASS |
| SC3 (18/84 scale) | `pytest -m live -k onboarding_scale` | 3 passed (58.86s) | ✓ PASS |
| Full live batch_import + file_errors suite | `pytest test_batch_import.py test_batch_import_file_errors.py -m "live or not live"` | 14/15 passed; 1 transient DNS failure, passed on isolated re-run | ✓ PASS |
| `apollo import --help` | `uv run --project cli apollo import --help` | Documents `--from-json`, `--dry-run`, file shape | ✓ PASS |
| `test_cli_surface.py` | `pytest tests/test_cli_surface.py` | 14 passed, zero edits to that file | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| BATCH-01 | 31-01-PLAN.md, 31-02-PLAN.md | Batch entry path validating fully before write, resolving in-batch parent references, resumable without duplication | ✓ SATISFIED | All 3 ROADMAP success criteria live-verified above; no orphaned requirements found for Phase 31 in REQUIREMENTS.md |

### Anti-Patterns Found

None. `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon"` across all phase-touched files returned zero matches. No empty implementations, no hardcoded-empty stub returns in the write path.

### Human Verification Required

None. Every must-have was resolvable via direct code reading, live test execution, and quality-gate re-runs.

### Gaps Summary

None. This phase's own code review (2 iterations) already found and fixed 1 Critical (CR-01) + 2 Warnings (WR-01, WR-02); this verification independently re-confirmed all three fixes are genuinely wired into the validation path (not just claimed) by reading the current source directly and re-running the corresponding live tests myself, plus independently re-ran the full 18/84-scale and partial-resume live proofs, the whole offline suite, and all quality gates. The single test failure observed during a combined-run was a transient network DNS resolution blip (unrelated to the code under test) and was confirmed non-reproducible on isolated re-run.

---

_Verified: 2026-09-22T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
