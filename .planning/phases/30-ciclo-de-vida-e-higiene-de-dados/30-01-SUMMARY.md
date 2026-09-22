---
phase: 30-ciclo-de-vida-e-higiene-de-dados
plan: 01
subsystem: cli
tags: [instantdb, click, cli, data-hygiene, orphan-cleanup]

# Dependency graph
requires:
  - phase: 03-cli-auth-crud
    provides: crud_helpers.py's client_for_session/delete_entity/get_entity plumbing
  - phase: 05-job-geracao
    provides: routine_job.py's InstaQL link-expansion query pattern (_query_active_templates/_normalize_antecessor)
provides:
  - "apollo rotina template deletar --force/--no-force (D-01, LIFE-01): blocks by default on linked instanciasRotina with exact count and zero writes, --force proceeds without cascading"
  - "apollo rotina instancia limpar-orfas --confirmar/--no-confirmar (D-02, LIFE-02): lists/deletes exactly the instanciasRotina rows whose template link is absent"
  - "_EXIT_INSTANCES_LINKED = 2 exit-code constant"
  - "Live-verified exact orphan shape: 'template' key entirely absent under link expansion, not [] or null"
  - "Real production account cleaned of all 22 orphaned instanciasRotina rows (Success Criterion 3)"
affects: [30-02 (Wave 2, e2e sweep must add --force to every rotina template deletar call site + direct instanciasRotina dedupeKey-prefix sweep)]

# Actuals (#2632)
actuals:
  tokens: 7036
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reverse-link InstaQL count query (templatesRotina.instancias expansion) mirroring routine_job._query_active_templates's antecessor expansion"
    - "Forward-link InstaQL orphan-filter query (instanciasRotina.template expansion, falsy-or-absent check) mirroring _normalize_antecessor's normalization convention"
    - "Business-rule guard exit code (_EXIT_INSTANCES_LINKED=2) kept distinct from crud_helpers.EXIT_API_ERROR=3"

key-files:
  created: []
  modified:
    - cli/apollo_cli/entities/rotina.py
    - cli/tests/test_crud_rotina_template.py
    - cli/tests/test_rotina_instancia.py
    - cli/tests/test_cli_surface.py
    - cli/tests/test_routine_job.py
    - .planning/phases/30-ciclo-de-vida-e-higiene-de-dados/deferred-items.md

key-decisions:
  - "D-01: deletar blocks by default (exit 2, exact count, zero writes); --force bypasses without cascading; --force with zero linked instances is a silent no-op"
  - "D-02: limpar-orfas is list-by-default/--confirmar-to-execute; orphan = template link expansion returns falsy-or-absent (live-confirmed: key entirely ABSENT, never [])"
  - "D-03: production account's orphan residue (22 rows found, not the originally estimated 4 — legitimate accumulated residue from Phases 26-29's live tests run before this plan's guard existed) removed as part of this plan's own live verification, not a separate manual step"

patterns-established:
  - "Pattern 1: paired --force/--no-force and --confirmar/--no-confirmar boolean flags following this module's established --x/--no-x convention (no bare is_flag=True anywhere in this codebase)"
  - "Pattern 2: guard-before-write query-then-conditionally-fail-then-proceed shape, mirroring crud_helpers.delete_entity's own not-found guard"

requirements-completed: [LIFE-01, LIFE-02]

coverage:
  - id: D1
    description: "apollo rotina template deletar blocks by default on a template with linked instanciasRotina, reports the exact count, performs zero writes"
    requirement: "LIFE-01"
    verification:
      - kind: integration
        ref: "cli/tests/test_crud_rotina_template.py::test_deletar_with_linked_instances_blocks_by_default_with_exact_count"
        status: pass
    human_judgment: false
  - id: D2
    description: "deletar --force deletes the template without cascading; the orphaned instance's template link comes back with the key entirely absent under link expansion (live-proven exact shape)"
    requirement: "LIFE-01"
    verification:
      - kind: integration
        ref: "cli/tests/test_crud_rotina_template.py::test_deletar_with_force_deletes_template_and_orphans_linked_instance"
        status: pass
    human_judgment: false
  - id: D3
    description: "deletar --force with zero linked instances is a documented no-op, not an error"
    requirement: "LIFE-01"
    verification:
      - kind: integration
        ref: "cli/tests/test_crud_rotina_template.py::test_deletar_force_with_zero_linked_instances_is_noop_and_still_succeeds"
        status: pass
    human_judgment: false
  - id: D4
    description: "apollo rotina instancia limpar-orfas lists orphans by default (zero writes)"
    requirement: "LIFE-02"
    verification:
      - kind: integration
        ref: "cli/tests/test_rotina_instancia.py::test_limpar_orfas_lists_orphan_without_confirmar_writes_nothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "limpar-orfas --confirmar deletes exactly the listed orphans and leaves a simultaneously-existing, validly-linked instance untouched"
    requirement: "LIFE-02"
    verification:
      - kind: integration
        ref: "cli/tests/test_rotina_instancia.py::test_limpar_orfas_confirmar_deletes_only_orphans_leaves_valid_linked_instance_untouched"
        status: pass
    human_judgment: false
  - id: D6
    description: "instancia command set is exactly {listar, status, limpar-orfas} — never a bare criar/deletar"
    requirement: "LIFE-02"
    verification:
      - kind: unit
        ref: "cli/tests/test_rotina_instancia.py::test_instancia_command_set_is_exactly_listar_status_and_limpar_orfas"
        status: pass
      - kind: unit
        ref: "cli/tests/test_routine_job.py::test_instancia_command_set_is_exactly_listar_status_and_limpar_orfas"
        status: pass
      - kind: unit
        ref: "cli/tests/test_cli_surface.py::test_schema_entity_coverage[instanciasRotina]"
        status: pass
    human_judgment: false
  - id: D7
    description: "Running limpar-orfas --confirmar against the real production account removes every currently-orphaned row, including the named phase23-e2e-dedupe-weekday/-weekend residue, with an exact-delta proof that no other row was affected"
    requirement: "LIFE-02"
    verification:
      - kind: integration
        ref: "cli/tests/test_rotina_instancia.py::test_limpar_orfas_confirmar_removes_real_production_residue_success_criterion_3"
        status: pass
    human_judgment: false

# Metrics
duration: ~50min
completed: 2026-09-22
status: complete
---

# Phase 30 Plan 01: Guarded Template Delete + Orphan Cleanup Summary

**`apollo rotina template deletar --force/--no-force` blocks silent instance-orphaning by default (exit 2, exact count), and `apollo rotina instancia limpar-orfas --confirmar` cleans exactly the resulting orphans — proven live against production, including the actual one-time removal of 22 pre-existing orphaned rows.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-22T20:56:17Z
- **Tasks:** 2/2
- **Files modified:** 6 (5 source/test files + 1 new deferred-items.md)

## Accomplishments

- `deletar` now counts linked `instanciasRotina` via a reverse-link InstaQL query (`templatesRotina.instancias`) before every delete; with linked instances and no `--force`, it exits 2 with the exact count and performs zero writes.
- `--force` bypasses the block without ever cascading onto the linked instances — they become orphans, and the resulting orphan's `template` link is live-proven to come back with the key **entirely absent** under link expansion (not `[]`, not `null`), matching 30-PATTERNS.md's live experiment exactly. This proof is now a permanent regression test.
- New `apollo rotina instancia limpar-orfas --confirmar/--no-confirmar` command: lists orphans by default (zero writes), deletes exactly the listed orphans with `--confirmar`, live-proven to never touch a validly-linked instance in the same run (a second template/instance pair created in the same test, deliberately left linked).
- Ran the phase's one deliberate real-production-data cleanup step (ROADMAP Success Criterion 3): `limpar-orfas --confirmar` against the real `tp@rbrasset.com.br` account found and removed **22 orphaned `instanciasRotina` rows** — more than the originally known 4 (3 real orphans + the `phase23-e2e-dedupe-weekday-...` residual), because the account had accumulated additional legitimate orphan residue from Phases 26-29's live test runs executed before this plan's `deletar` guard existed. The named `phase23-e2e-dedupe-weekday`/`-weekend` residue is confirmed gone by dedupeKey-prefix assertion. An exact-delta proof (`total_before - total_after == orphan_count`) confirms no other row was touched. Production now holds **0 orphans**.
- Repaired all three pre-existing structural tests broken by `limpar-orfas`'s exact-match command-set assertions: `test_cli_surface.py`'s `EXPECTED_SURFACE["instanciasRotina"]`, `test_rotina_instancia.py`'s renamed `test_instancia_command_set_is_exactly_listar_status_and_limpar_orfas`, and `test_routine_job.py`'s byte-identical twin of the same test.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end guarded template delete — count query, --force flag, live proof of block + force-orphan (LIFE-01, D-01)** - `c629acb` (feat)
2. **Task 2: instancia limpar-orfas (LIFE-02, D-02) + Success Criterion 3 real-production cleanup + repair of three pre-existing structural tests** - `8bc5e62` (feat)

_Note: this plan was `tdd="true"` on both tasks, but every assertion is a live round-trip against the real InstantDB app (no unit-mockable RED phase existed for the guard's InstaQL query behavior) — each task landed as a single commit containing both the implementation and its live tests, matching this codebase's established live-test-only TDD pattern from prior CLI phases._

## Files Created/Modified

- `cli/apollo_cli/entities/rotina.py` - `_EXIT_INSTANCES_LINKED` constant, `_count_linked_instances` helper, guarded `deletar` with `--force/--no-force`, new `limpar_orfas` command under `instancia`, updated module/group docstrings documenting both narrow exceptions to the "no criar/deletar for instances" rule
- `cli/tests/test_crud_rotina_template.py` - `_seed_linked_instancia` helper + 4 new live tests proving the block/force/no-cascade/orphan-shape/no-op behaviors
- `cli/tests/test_rotina_instancia.py` - module docstring amendment, renamed command-set test, 3 new live tests + the Success Criterion 3 real-production-cleanup test
- `cli/tests/test_cli_surface.py` - `EXPECTED_SURFACE["instanciasRotina"]` extended to `{"listar", "status", "limpar-orfas"}`
- `cli/tests/test_routine_job.py` - byte-identical command-set test renamed/extended to match
- `.planning/phases/30-ciclo-de-vida-e-higiene-de-dados/deferred-items.md` - new file, logs one pre-existing unrelated live-test flake (see Deviations)

## Decisions Made

- D-01/D-02/D-03 from `30-CONTEXT.md` implemented exactly as locked, no re-litigation needed.
- Exit code `_EXIT_INSTANCES_LINKED = 2` kept as a distinct, named constant (not reused from `crud_helpers.EXIT_API_ERROR = 3`), per the plan's explicit rationale: this is a business-rule guard discovered after a query, not a Click argument-parsing failure.
- The 22-orphan real count (vs. the originally documented 4) was treated as in-scope, not a deviation requiring a new decision: Success Criterion 3's wording is "removes every currently-orphaned row," and `limpar-orfas`'s orphan definition makes cleanup safe by construction regardless of how many rows match — no new decision was needed, just execution of the locked one.

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1/2/3 auto-fixes were needed; both tasks' implementations matched the plan's `<action>` sections directly.

### Deferred (out of scope, logged not fixed)

**1. [Scope boundary] Pre-existing unrelated live-test flake: `test_criar_without_offset_dias_omits_key_entirely`**
- **Found during:** Task 1's and Task 2's `<verify>` runs (both required the full `test_crud_rotina_template.py -m live` suite)
- **Issue:** `listar --limit 50` no longer reliably returns a just-created `templatesRotina` record now that the live production table holds 84+ rows with no guaranteed insertion order — `next(r for r in listed if r["id"] == eid)` raises `StopIteration`.
- **Root cause:** identical to already-documented deferred items in `.planning/phases/26-valida-o-na-escrita/deferred-items.md` #1 and `.planning/phases/29-controle-de-geracao/deferred-items.md` #1 — this is the third occurrence of the exact same pre-existing issue, unrelated to this plan's `deletar`/`limpar-orfas` changes (confirmed via `git diff --stat` showing zero changes to `criar`/`listar`).
- **Status:** Not fixed — out of scope for LIFE-01/LIFE-02. Logged to `.planning/phases/30-ciclo-de-vida-e-higiene-de-dados/deferred-items.md`. Consistent with the established project precedent of proceeding past this exact flake in Phases 26 and 29.
- **Impact on plan:** None on this plan's own deliverables — all 33 tests this plan itself touches or adds (4 in Task 1, 4 non-live/9 live in Task 2, plus the 3 repaired structural tests) pass cleanly; only this one pre-existing, unrelated, already-triaged test fails.

---

**Total deviations:** 0 auto-fixed, 1 deferred (pre-existing, unrelated, third occurrence of a documented issue class)
**Impact on plan:** No scope creep. All of this plan's own acceptance criteria and `<verify>` commands pass.

## Issues Encountered

- The worktree this executor was spawned into (`agent-a401312d546e964a3`) was stale — locked at commit `08dcd3d` (78 commits behind `main`'s `de0f4e9`, which carries this very plan file). Verified `08dcd3d` was a strict ancestor of `de0f4e9` with zero unique worktree-branch commits, then fast-forwarded (`git merge --ff-only main`) before starting work. No destructive git operation was used.
- Production held 22 orphans at execution time, not the 4 originally documented in `30-CONTEXT.md`/ROADMAP Success Criterion 3. This was expected in substance (accumulated residue from live tests across Phases 26-29, run before this plan's guard existed) and is exactly the kind of debris `limpar-orfas` is designed to remove — handled as normal execution of the locked decision, not a deviation requiring a new choice.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 30-02 (Wave 2) depends on the exact flag names landed here: `--force`/`--no-force` on `deletar`, `--confirmar`/`--no-confirmar` on `limpar-orfas`, and `_EXIT_INSTANCES_LINKED = 2`. All three are locked and live-verified.
- Every `web/e2e/*.spec.ts` call site invoking `rotina template deletar` (8 files, ~21 call sites per 30-PATTERNS.md's grep sweep) will now hit the new blocking guard and MUST add `--force` — this is Plan 30-02's D-05a, not addressed by this plan (CLI-only, Wave 1).
- Real production account is now orphan-free (`limpar-orfas` reports `count: 0`); a re-run of any future orphan-producing test immediately becomes cleanable by this same command.

---
*Phase: 30-ciclo-de-vida-e-higiene-de-dados*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: `cli/apollo_cli/entities/rotina.py`
- FOUND: `cli/tests/test_crud_rotina_template.py`
- FOUND: `cli/tests/test_rotina_instancia.py`
- FOUND: `cli/tests/test_cli_surface.py`
- FOUND: `cli/tests/test_routine_job.py`
- FOUND: `.planning/phases/30-ciclo-de-vida-e-higiene-de-dados/deferred-items.md`
- FOUND commit: `c629acb` (Task 1)
- FOUND commit: `8bc5e62` (Task 2)
