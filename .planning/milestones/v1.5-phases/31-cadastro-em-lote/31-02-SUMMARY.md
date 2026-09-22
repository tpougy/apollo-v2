---
phase: 31-cadastro-em-lote
plan: 02
subsystem: cli
tags: [click, instantdb, batch-import, transact, cli-python, live-tests]

# Dependency graph
requires:
  - phase: 31-cadastro-em-lote
    plan: 01
    provides: "apollo import --from-json/--dry-run (run_batch_import) — reused unchanged at literal onboarding scale and for the partial-resume scenario"
provides:
  - "Live proof of ROADMAP Phase 31 Success Criterion 3 at literal scale: 18 fundos + 84 templatesRotina (all 4 tipoGeracao values, every regraCompetencia value, round-robin fundoId, 2 disjoint encadeado chains) land in exactly ONE apollo import invocation"
  - "Live proof of ROADMAP Phase 31 Success Criterion 2 at the same literal scale (identical-file re-run) AND via a genuinely simulated partial-prior-landing resume scenario (~1/3 of natural keys pre-seeded directly, zero duplication on convergence)"
  - "A second, independent (runtime module-attribute-scan, not text-grep) structural proof that batch_import.py can never reference instanciasRotina (D-10/C-06)"
affects: [31-cadastro-em-lote-phase-closure, any-future-batch-entity-extension]

# Actuals (#2632)
actuals:
  tokens: 4450
  tasks: 2
  commits: 2
plan_head_before: 1a874196deb07aaa5236328829d2d48710e59e3a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Programmatic (looped, never hand-typed) batch-fixture construction: a single _build_scale_batch(suffix, n_fundos, n_templates, *, build_chains=True) helper generates an N-fundo/M-template batch cycling every choice-set value and carving disjoint encadeado chains out of whichever templates the cycling already typed 'encadeado' — reused at both 18/84 (full onboarding scale) and 6/15 (partial-resume scenario) without duplicating fixture logic."
    - "Direct client.transact() seeding (bypassing the CLI) to simulate 'a prior partial run already landed some records' — the closest honest simulation available, since a genuinely torn apollo import mid-run is unreachable to engineer directly (RESEARCH.md Q3's live-confirmed transact atomicity)."
    - "Batched Counter-based duplicate detection (_assert_no_duplicate_rows_by_key): a single $in query over the full natural-key set, counting occurrences per key via collections.Counter, replacing what would otherwise require either N individual per-key queries or a dict-collapsing helper that silently hides duplicates behind its last-write-wins key."
    - "Runtime module-attribute structural proof (dir()/vars() scan over the loaded module object, excluding dunders like __doc__ which legitimately discuss the excluded entity in prose) as a second, independent angle on a structural guarantee already covered by a text-grep-style adversarial test."

key-files:
  created: []
  modified:
    - cli/tests/test_batch_import.py

key-decisions:
  - "_build_scale_batch's 2 encadeado chains are carved OUT OF the templates the cyclic tipoGeracao assignment already typed 'encadeado' (not built as separate special-cased records) — this keeps 'cycles through all 4 tipoGeracao values' literally true for every one of the 84 templates, with chain construction as a pure post-processing step over the naturally-occurring encadeado subset."
  - "Pre-seeding for the partial-resume test seeds the ASSOCIATED FUNDO first (fixing its real id), then seeds dependent templates with a fundo link to that exact real id — this guarantees the batch's own $-reference resolution (which looks up the fundo by codigo and finds the SAME pre-seeded row) computes an identical (donoId, resolvedFundoId, nome) natural key, so the pre-seeded template is correctly recognized as existing rather than accidentally landing on a mismatched key."
  - "The partial-resume test's ~1/3 split (2 of 6 fundos, 5 of 15 templates, 7 of 21 total natural keys) includes one no-fundoId template (t10) to exercise the (donoId, None, nome) key variant, not just the fundo-linked case."
  - "The two Task 1 tests (single-invocation proof, re-run idempotency proof) are self-contained with their own unique_suffix() and full 18/84 fixture each, mirroring Plan 31-01's own re-run test pattern rather than sharing state across test functions — costs an extra live 18/84 creation but keeps tests independent of execution order."

patterns-established: []

requirements-completed: [BATCH-01]

coverage:
  - id: D6
    description: "An 18-fundo/84-template batch (real onboarding shape: all 4 tipoGeracao values, every regraCompetencia value, round-robin fundoId with a handful absent, 2 disjoint encadeado chains of 2-3 templates) completes in exactly ONE apollo import invocation, not 102 separate CLI calls, live-proven against the real InstantDB app (ROADMAP Success Criterion 3)"
    requirement: BATCH-01
    verification:
      - kind: e2e
        ref: "cli/tests/test_batch_import.py#test_full_onboarding_scale_single_invocation_success_criterion_3"
        status: pass
    human_judgment: false
  - id: D7
    description: "Re-running the identical 18+84-scale file reports every record existing for both entities, zero created, zero duplicate rows by natural key (ROADMAP Success Criterion 2, at literal onboarding scale)"
    requirement: BATCH-01
    verification:
      - kind: e2e
        ref: "cli/tests/test_batch_import.py#test_full_onboarding_scale_rerun_is_fully_existing_success_criterion_2"
        status: pass
    human_judgment: false
  - id: D8
    description: "A batch where ~1/3 of its natural keys already exist (simulating a prior partial run having already landed those, seeded directly via live_client before apollo import runs) converges correctly on one full-file run: the pre-seeded third reported existing, the rest created, zero duplicate rows by natural key (SC2's resumability guarantee, D-05/D-06/D-07)"
    requirement: BATCH-01
    verification:
      - kind: e2e
        ref: "cli/tests/test_batch_import.py#test_partial_batch_already_landed_resumes_without_duplication"
        status: pass
    human_judgment: false
  - id: D9
    description: "batch_import.py structurally cannot reference the instanciasRotina entity, proven a second, independent way (runtime module-attribute scan of the LOADED module object, not a text grep) beyond Plan 31-01's own adversarial top-level-key test (D-10/C-06)"
    requirement: BATCH-01
    verification:
      - kind: unit
        ref: "cli/tests/test_batch_import.py#test_batch_import_module_defines_no_instance_entity_reference"
        status: pass
    human_judgment: false
  - id: D10
    description: "Every quality gate the phase's own code touches (ruff, ty, the full offline suite, test_cli_surface.py) stays green across the whole cli/ package, not just this plan's own files, with both plans' changes combined"
    requirement: BATCH-01
    verification:
      - kind: static
        ref: "cli/apollo_cli, cli/tests via ruff check / ruff format --check / ty check"
        status: pass
      - kind: unit
        ref: "cli/tests -m 'not live' (405 passed, 2 skipped)"
        status: pass
      - kind: unit
        ref: "cli/tests/test_cli_surface.py (14 passed)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-22
status: complete
---

# Phase 31 Plan 2: Cadastro em lote — literal-scale + resumability proofs Summary

**The phase's own literal acceptance bar proven live against the real production InstantDB app: an 18-fundo/84-template batch (the exact onboarding shape ROADMAP Success Criterion 3 names) completes in exactly ONE `apollo import` invocation, re-runs converge idempotently at that same scale, and a genuinely simulated partial-prior-landing (~1/3 of natural keys pre-seeded) resumes without duplicating a single record — plus a second, independent structural proof that `batch_import.py` can never create an `instanciasRotina` row.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-22
- **Tasks:** 2
- **Files modified:** 1 (`cli/tests/test_batch_import.py` only — no production code changed, as the plan specified)

## Accomplishments

- **Success Criterion 3, literal scale:** a new `_build_scale_batch(suffix, n_fundos, n_templates, *, build_chains=True)` helper programmatically (looped, never hand-typed) builds an N-fundo/M-template batch cycling all 4 `tipoGeracao` values and every `regraCompetencia` value, round-robin `fundoId` distribution (a handful left with none), and 2 disjoint `encadeado` chains of 2-3 templates each carved out of whichever templates the cycling already typed `encadeado`. `test_full_onboarding_scale_single_invocation_success_criterion_3` proves the full 18-fundo/84-template batch lands in exactly ONE `apollo import --from-json` call — not 102 separate CLI calls — with both chains' `antecessor` links live-confirmed resolving to the correct real sibling ids.
- **Success Criterion 2, literal scale:** `test_full_onboarding_scale_rerun_is_fully_existing_success_criterion_2` re-runs an identical 18+84 file and confirms 100% `existing` for both entities, zero `created`, and zero duplicate rows via a new `_assert_no_duplicate_rows_by_key` helper (a single batched `$in` query + `collections.Counter`, which correctly catches duplicates a dict-collapsing helper would silently hide).
- **Success Criterion 2's resumability guarantee, genuinely simulated:** `test_partial_batch_already_landed_resumes_without_duplication` pre-seeds ~1/3 (7 of 21) of a smaller 6-fundo/15-template batch's natural keys directly via `live_client.transact` — bypassing the CLI entirely, the closest honest simulation of "a prior partial run already landed these" since a genuinely torn `apollo import` mid-run is unreachable to engineer directly (RESEARCH.md Q3). The full, unmodified batch file then converges correctly in ONE `apollo import` call: the pre-seeded third reports `existing`, the rest `created`, zero duplicates confirmed.
- **D-10/C-06 closed a second, independent way:** `test_batch_import_module_defines_no_instance_entity_reference` scans the LOADED `apollo_cli.batch_import` module object's own attributes (`dir()`/`vars()`) at runtime — not a text search — confirming no attribute name or value equals/contains `instanciasRotina`, correctly excluding the module's own `__doc__` (which legitimately discusses the exclusion in prose).
- **Whole-`cli/`-package gate sweep, both plans combined:** `ruff check`/`ruff format --check`/`ty check` across `apollo_cli` + `tests`, the full offline suite (`405 passed, 2 skipped`), `test_cli_surface.py` (`14 passed`), and the complete `test_batch_import.py -m live` file (`10 passed`, both plans' tests in one run) all green.

## Task Commits

1. **Task 1: Full onboarding-scale proof (SC3) + same-scale re-run idempotency (SC2)** - `542dd4c` (test)
2. **Task 2: Partial-batch-already-landed resume proof + module-attribute structural check + whole-package gate sweep (D-05/D-06/D-07, D-10)** - `e801a97` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

## Files Created/Modified

- `cli/tests/test_batch_import.py` - added `_build_scale_batch`, `_seed_fundo`, `_seed_template`, `_assert_no_duplicate_rows_by_key` helpers, plus 4 new live tests: the 18/84 single-invocation proof, the 18/84 re-run idempotency proof, the partial-resume proof, and the module-attribute structural check. No production code (`batch_import.py`, `cli.py`, `routine_job.py`, `entities/rotina.py`) was touched — exactly as the plan specified.

## Decisions Made

None beyond the plan's own scope — followed as specified. One implementation-level choice made within the plan's latitude (not a deviation): the 2 `encadeado` chains are carved OUT OF the templates the cyclic `tipoGeracao` assignment already typed `encadeado`, rather than built as separate hand-picked records — this keeps "cycling through all 4 `tipoGeracao` values" literally true for every one of the 84 templates, with chain construction as a pure post-processing step.

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed a false positive in the module-attribute structural check**
- **Found during:** Task 2, first live run of `test_batch_import_module_defines_no_instance_entity_reference`
- **Issue:** The initial scan checked every value in `vars(module)`, including the module's own `__doc__` string — which legitimately explains, in prose, that the module never creates `instanciasRotina`. The naive substring scan flagged `__doc__` itself as "offending," a false positive from the very docstring documenting the guarantee being proven.
- **Fix:** Excluded module-level dunder attributes (`name.startswith("__")`) from the scan — `__doc__`/`__name__`/`__file__`/etc. are Python/import-machinery metadata, not the module's own defined constants/logic.
- **Files modified:** `cli/tests/test_batch_import.py`
- **Commit:** `e801a97`

## Issues Encountered

None beyond the one auto-fixed false positive above. `ruff check`/`ruff format --check`/`ty check` passed on every file on the first attempt after that fix (only a redundant-`cast` warning cleaned up, no logic fixes), and the full offline regression sweep (405 passed, 2 skipped) plus `test_cli_surface.py` (14 passed) stayed green throughout.

## User Setup Required

None - the plan's `<precondition>` (a persisted `apollo auth login` session for the real InstantDB production account) was already satisfied at execution start (verified via `load_session()` before any work began).

## Next Phase Readiness

- Phase 31 (BATCH-01) is now fully live-proven end-to-end at BOTH meaningful scale (Plan 31-01) and literal onboarding acceptance scale (this plan): `apollo import --from-json/--dry-run` is production-ready with no known gaps against ROADMAP Success Criteria 1-3.
- Live-verified: every test in `test_batch_import.py` (10 across both plans) passed against the real production InstantDB app, with `cleanup_records`/`unique_suffix()` ensuring zero residue left behind.
- No blockers.

---
*Phase: 31-cadastro-em-lote*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: cli/tests/test_batch_import.py
- FOUND: commit 542dd4c (Task 1)
- FOUND: commit e801a97 (Task 2)
