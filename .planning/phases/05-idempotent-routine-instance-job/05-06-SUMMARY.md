---
phase: 05-idempotent-routine-instance-job
plan: 06
subsystem: routine-generation
tags: [instantdb, routine-job, cli, playwright-e2e, idempotency, concurrency, verification]

# Dependency graph
requires:
  - phase: 05-idempotent-routine-instance-job
    plan: 01
    provides: "templatesRotina.offsetDias live in schema"
  - phase: 05-idempotent-routine-instance-job
    plan: 02
    provides: "web/src/lib/routineJob.ts pure compute core"
  - phase: 05-idempotent-routine-instance-job
    plan: 03
    provides: "runRoutineInstanceJob live orchestration + Shell.svelte onMount trigger"
  - phase: 05-idempotent-routine-instance-job
    plan: 04
    provides: "corrido_fixo + encadeado generation types"
  - phase: 05-idempotent-routine-instance-job
    plan: 05
    provides: "cli/apollo_cli/routine_job.py Python twin + apollo rotina gerar-instancias"
provides:
  - "cli/tests/test_routine_job_parity.py: Direction A cross-channel proof (CLI generates, CLI-side re-run recognizes) + genuine-subprocess-concurrency non-duplication proof"
  - "web/e2e/routine-job-cross-channel.spec.ts: both crossings end to end (CLI-then-SPA, SPA-then-CLI), with the load-bearing 'existing' recognition assertion"
  - ".planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh: one-command re-proof of every JOB-01/JOB-02 gate, ending 'PHASE 05 VERIFIED'"
  - "Operator documentation in README.md, cli/README.md, web/README.md tying every documented guarantee to its proving test"
affects: [06-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real subprocess concurrency proof: concurrent.futures.ThreadPoolExecutor(max_workers=2) over subprocess.run (never CliRunner, which serializes on one interpreter) submitting both futures before collecting either result"
    - "Lookup-keyed upsert (`lookup('dedupeKey', ...)`) is safe under overlapping writers by construction: two processes racing on the same not-yet-existing key both converge on the SAME row without either seeing an API error -- the load-bearing guarantee is the live row count (Counter over dedupeKey), not the created/existing report-shape split"
    - "One-command phase verification script structure (verify-phase-0N.sh): repo-root resolution from BASH_SOURCE, opt-in magic-code flag, comment-filtered prohibition greps, leftover sweep, single VERIFIED line on success"

key-files:
  created:
    - cli/tests/test_routine_job_parity.py
    - web/e2e/routine-job-cross-channel.spec.ts
    - .planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh
  modified:
    - README.md
    - cli/README.md
    - web/README.md

key-decisions:
  - "Removed an initially-written assertion that no dedupeKey may be reported `created` by both concurrent processes. Live testing showed both processes legitimately report the SAME key under `created` in the common case: the write path is a lookup-keyed UPSERT, so two overlapping writers racing on a not-yet-existing key both succeed without an API error, converging on the same row rather than erroring. The plan's own <behavior> block only requires 'either split is acceptable' for created/existing, not mutual exclusion -- the load-bearing guarantee is the live row count (a Counter over dedupeKey), not the report-shape split. Re-added as a comment explaining why, not removed silently."
  - "Test 2 of routine-job-cross-channel.spec.ts asserts the SPA's dedupeKeys are a SUBSET of the CLI's `existing` report, not an exact set. Test 1's templates are still active when Test 2 runs (afterAll runs once, after both tests, matching routine-job.spec.ts's own describe.serial pattern) and legitimately contribute their own already-existing keys to the same gerar-instancias report."
  - "Scoped the web/src/lib/routineJob.ts '.delete(' prohibition grep to exclude `pendingIds.delete(` by name, rather than requiring a literal zero count. 05-04 added two legitimate in-memory Set.delete() calls (the encadeado topological sweep's bookkeeping set) that are unrelated to any InstantDB write; a blind grep inherited verbatim from 05-03's plan text would false-fail on code that has been live and correct since 05-04. Documented inline in verify-phase-05.sh so the gate stays a true negative control for an ACTUAL InstantDB delete path."

requirements-completed: [JOB-01, JOB-02]

# Metrics
duration: 90min
completed: 2026-08-09
---

# Phase 5 Plan 6: Cross-channel interoperability, genuine-concurrency proof, and phase verification Summary

**Proved ROADMAP SC-4 (records one channel writes are recognized, not duplicated, by the other) in both directions, proved the non-duplication guarantee holds under two genuinely overlapping real OS processes racing on `instanciasRotina.dedupeKey.unique()`, and packaged every JOB-01/JOB-02 gate into `verify-phase-05.sh`, a single command that re-proves the whole phase and ends `PHASE 05 VERIFIED`.**

## Performance

- **Duration:** ~90 min
- **Completed:** 2026-08-09
- **Tasks:** 3 (cross-channel interop, concurrency proof, verification script + docs)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- `cli/tests/test_routine_job_parity.py` proves Direction A live: the CLI generates instances for a fresh `du_fixo`/`corrido_fixo`/`encadeado` template set, `apollo rotina instancia listar --template-id` returns exactly those ids with every `dedupeKey` recomputing correctly from the row's own fields, and a second `gerar-instancias` run reports `existing` as exactly the first run's `created` set (the recognition proof, not merely an unchanged count).
- `web/e2e/routine-job-cross-channel.spec.ts` proves both crossings end to end against the real InstantDB app: Test 1 (CLI generates three template types, then an SPA load leaves the id set and dedupeKey set byte-identical) and Test 2 (an SPA load generates instances, then `apollo rotina gerar-instancias` reports `created: []` and every one of the SPA's dedupeKeys under `existing` — the load-bearing assertion that the CLI *recognized* the SPA's records rather than merely failing to write for some unrelated reason).
- `cli/tests/test_routine_job_parity.py::test_concurrent_double_run_leaves_no_duplicate_dedupe_keys` launches two REAL `apollo rotina gerar-instancias` OS processes via `ThreadPoolExecutor`/`subprocess.run` (never `CliRunner`), submitting both futures before collecting either result so their query→diff→transact windows genuinely overlap, with no stagger/lock/retry. Re-ran 3 consecutive times, all green, zero live duplicates each time, plus a companion assertion that re-pulls the LIVE schema and greps for `dedupeKey` carrying `unique` — pinning the actual guarantee under test, not merely the report shape.
- `.planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh` re-runs 7 gates in order (C-08 quality gates; live schema pin; offline TS/Python parity; live CLI idempotency+interop+concurrency; live SPA routine-job+cross-channel specs; delete/admin-token/admin-SDK prohibition greps; leftover sweep) and printed `PHASE 05 VERIFIED` on a full run from `/tmp` (unrelated cwd). Negative control confirmed: renaming `cli/apollo_cli/routine_job.py` made the script fail at Gate 1 (`ty check`, unresolved import) with no `VERIFIED` line, then the file was restored.
- `README.md`, `cli/README.md`, `web/README.md` document the job's what/when/why, the D-05-A/B/D/E/F semantics, the `dedupeKey.unique()` guarantee, the `gerar-instancias` skip-reason table, the `Shell.svelte onMount` trigger rationale, and a guarantee → proving-test traceability table — every documented claim names the test that proves it.

## Task Commits

1. **Task 1: cross-channel interoperability in both directions** — `867b321` (test)
2. **Task 2: non-duplication under genuine subprocess concurrency** — `7791b54` (test)
3. **Task 3: verify-phase-05.sh + operator documentation** — `c7cc4e7` (docs)

## Files Created/Modified

- `cli/tests/test_routine_job_parity.py` (new) — Direction A cross-channel proof + genuine-concurrency non-duplication proof
- `web/e2e/routine-job-cross-channel.spec.ts` (new) — both crossings end to end (CLI-then-SPA, SPA-then-CLI)
- `.planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh` (new) — one-command phase re-proof
- `README.md` — "Routine-instance generation job" section + "Re-verifying Phase 5"
- `cli/README.md` — `apollo rotina gerar-instancias` docs + skip-reason table + Phase 5 verification pointer
- `web/README.md` — `Shell.svelte` onMount trigger rationale, `data-job-state` hook, "no job UI by design", Phase 5 verification pointer

## Decisions Made

See `key-decisions` in frontmatter. The most consequential: the concurrency test's "no key double-created" assertion was found to be WRONG by live testing (both processes legitimately succeed on the same key via lookup-upsert) and was corrected to the actually-load-bearing assertion — a live `Counter` over persisted `dedupeKey`s showing zero duplicates.

## Concurrent-Run Evidence (real reports from a manual live run, captured for documentation, cleaned up afterward)

Two REAL `apollo rotina gerar-instancias` OS processes launched via `ThreadPoolExecutor` against a fresh two-template set (`du_fixo` offset 4, `corrido_fixo` offset 13), submitted before either result was collected:

```json
// report A
{
  "created": [
    "529209c3-cbe6-42cc-942a-f7b7824b46a0:2026-09:2026-09-04",
    "fe77ace2-cfe2-486a-b4f4-dcb3211eff51:2026-08:2026-08-13",
    "fe77ace2-cfe2-486a-b4f4-dcb3211eff51:2026-09:2026-09-13"
  ],
  "existing": [],
  "skipped": []
}
// report B (identical -- both processes' diffs ran before either had written,
// so both legitimately computed the same "to create" set; the lookup-upsert
// write path means both succeed without an API error, converging on the
// same three rows)
{
  "created": [
    "529209c3-cbe6-42cc-942a-f7b7824b46a0:2026-09:2026-09-04",
    "fe77ace2-cfe2-486a-b4f4-dcb3211eff51:2026-08:2026-08-13",
    "fe77ace2-cfe2-486a-b4f4-dcb3211eff51:2026-09:2026-09-13"
  ],
  "existing": [],
  "skipped": []
}
```

A live query immediately afterward confirmed exactly 3 rows exist (one per `dedupeKey`, `Counter` over the live rows showed no key with count > 1) — the actual, load-bearing proof that `instanciasRotina.dedupeKey.unique()` held under genuine overlap. An earlier run (during test development, before the report-shape assertion was corrected) additionally observed a run where `created_a` and `created_b` were non-empty and IDENTICAL sets across both processes, confirming this is the expected steady-state outcome under overlap, not a rare edge case.

## Negative-Control Failure Output (verify-phase-05.sh, `cli/apollo_cli/routine_job.py` renamed away and restored afterward)

```
error[unresolved-import]: Cannot resolve imported module `apollo_cli.routine_job`
 --> cli/tests/test_routine_job_parity.py:37:6
  |
37 | from apollo_cli.routine_job import (
  |      ^^^^^^^^^^^^^^^^^^^^^^
info: Searched in the following paths during module resolution:
  ...
Found 3 diagnostics
```

Exit code: `1`. Final line of output: `Found 3 diagnostics` (NOT `PHASE 05 VERIFIED`) — the script fails loudly at Gate 1 (`uv run --project cli ty check cli`) the moment the module it depends on disappears, before ever reaching a live gate. The file was restored immediately (`git status --short cli/apollo_cli/` confirmed a clean diff afterward) and the full script was re-run to a clean `PHASE 05 VERIFIED` pass.

## JOB-01 / JOB-02 → Proving-Test Traceability (for Phase 6 to inherit)

| Requirement | Guarantee | Proving test(s) |
|---|---|---|
| JOB-01 | SPA-side generation produces correct instances for all three types, in range, never duplicates on a second load | `web/e2e/routine-job.spec.ts` |
| JOB-01 | A manually-set `concluida` status survives a second SPA load unchanged | `web/e2e/routine-job.spec.ts` |
| JOB-01 | An encadeado successor's dedupeKey/date/competencia never re-key when its antecessor's status changes (D-05-F) | `web/e2e/routine-job.spec.ts` |
| JOB-02 | CLI-side generation produces correct instances for all three types via `apollo rotina gerar-instancias`, never duplicates on a second run | `cli/tests/test_routine_job.py` |
| JOB-02 | TS and Python compute cores are byte-identical across all fixture scenarios | `web/src/lib/routineJob.test.ts` + `cli/tests/test_routine_job.py` against `shared/routine-job.testcases.json` |
| SC-4 (cross-channel) | CLI-generated records are recognized by a subsequent CLI-side re-run | `cli/tests/test_routine_job_parity.py::test_direction_a_cli_generates_then_cli_recognizes_own_records` |
| SC-4 (cross-channel) | CLI-generated records are recognized by a subsequent SPA load | `web/e2e/routine-job-cross-channel.spec.ts` Test 1 |
| SC-4 (cross-channel) | SPA-generated records are recognized (`existing`, not re-created) by a subsequent CLI run | `web/e2e/routine-job-cross-channel.spec.ts` Test 2 |
| T-05-02 (genuine concurrency) | Two real overlapping processes never leave two rows for one dedupeKey; the live schema still declares `dedupeKey.unique()` | `cli/tests/test_routine_job_parity.py::test_concurrent_double_run_leaves_no_duplicate_dedupe_keys` |
| One-command re-proof | Every gate above, plus C-08 quality gates and prohibition greps, in one command | `.planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `_linked_template_id` did not handle the CLI's bare-string `template` link shape**
- **Found during:** Task 1, first live run of `test_direction_a_cli_generates_then_cli_recognizes_own_records`
- **Issue:** `apollo rotina instancia listar --template-id` returns the `template` link field as a bare id string (observed live: `"template": "8750ff94-..."`), not a nested dict or list of dicts as the other query shapes in this phase's SUMMARYs use. The helper assumed dict/list shapes only and raised `TypeError: string indices must be integers, not 'str'`.
- **Fix:** Added a string-shape branch to `_linked_template_id`, checked first.
- **Files modified:** `cli/tests/test_routine_job_parity.py`
- **Verification:** Re-ran the test to a pass; the dedupeKey-recomputation cross-anchor assertion now succeeds for all three template types.
- **Committed in:** `867b321`

**2. [Rule 1 - Bug] Overly strict "no key created by both processes" assertion in the concurrency test**
- **Found during:** Task 2, first live run of the concurrency test
- **Issue:** An initial assertion required `created_a & created_b` to be empty. The very first live run failed it: both processes reported the identical 3-key set under `created`. This is CORRECT behavior, not a bug — the write path is a lookup-keyed upsert, so two processes racing on a not-yet-existing key both succeed (converging on the same row) rather than one erroring. The plan's own `<behavior>` block only requires the union of created+existing to equal the full expected set, not mutual exclusion between the two processes' `created` lists.
- **Fix:** Removed the incorrect assertion, replaced with an explanatory comment; kept (and rely on) the live `Counter`-over-dedupeKey assertion as the actual, load-bearing proof.
- **Files modified:** `cli/tests/test_routine_job_parity.py`
- **Verification:** Re-ran 3 consecutive times, all green, zero live duplicates each time.
- **Committed in:** `7791b54`

**3. [Rule 1 - Bug] Test 2 of the cross-channel e2e spec asserted an exact `existing` set instead of a superset**
- **Found during:** Task 1 (Task 3 in file order — the e2e spec was iterated after the CLI test), first live run of `routine-job-cross-channel.spec.ts`
- **Issue:** Test 2 asserted `new Set(cliReport.existing)` equaled exactly the SPA's own dedupeKey set. It failed because Test 1's templates are still active (both tests share one `describe.serial` block; `afterAll` cleans up once, after both tests) and legitimately contribute their own already-existing keys to the same `gerar-instancias` report.
- **Fix:** Changed the assertion to "every SPA dedupeKey appears in the CLI's `existing` set" (subset check) rather than exact set equality — this is exactly what the plan's own load-bearing claim requires (recognition of the SPA's keys), without over-constraining on unrelated templates from the sibling test.
- **Files modified:** `web/e2e/routine-job-cross-channel.spec.ts`
- **Verification:** Re-ran both tests together to a pass; zero `phase05-x-` leftovers afterward.
- **Committed in:** `867b321`

**4. [Rule 1 - Bug] `verify-phase-05.sh`'s `.delete(` prohibition gate on `routineJob.ts` needed scoping**
- **Found during:** Task 3, while writing the prohibition gate (before running the script)
- **Issue:** A literal `grep -c '\.delete('` on `web/src/lib/routineJob.ts` (the exact gate text 05-03's own plan specified as "zero occurrences") now returns 2, from `pendingIds.delete(template.id)` — two legitimate in-memory `Set.delete()` calls added by 05-04's encadeado topological sweep, unrelated to any InstantDB write. A blind carry-forward of the old gate would false-fail on code that has been live and correct since 05-04.
- **Fix:** Scoped the grep to exclude lines matching `pendingIds\.delete(` by name, documented inline in the script with the rationale, so the gate remains a true negative control for an actual InstantDB delete path.
- **Files modified:** `.planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh`
- **Verification:** Full script run to `PHASE 05 VERIFIED`; manually confirmed the scoped grep still catches an injected fake `client.tx.instanciasRotina[x].delete()` line (tested by temporarily adding one, confirming Gate 6 failed, then removing it).
- **Committed in:** `c7cc4e7`

---

**Total deviations:** 4 auto-fixed (3 test-logic corrections found via live execution, 1 verification-script scoping fix). No scope creep — all four are mechanical corrections discovered by this plan's own live-verification step, exactly as the plan's design intends; none change the job's actual behavior.

## Issues Encountered

None beyond the four deviations above, all caught and resolved within this plan's own live-verification and script-negative-control steps before the final phase-wide run.

## User Setup Required

None. `.env.instantdb`, the persisted CLI session (`~/.config/apollo-cli/session`), and the persisted Playwright `storageState` (`web/e2e/.auth/user.json`) were already configured from prior phases/plans.

## Next Phase Readiness

- Every JOB-01/JOB-02 gate is re-runnable in one command (`verify-phase-05.sh`), which Phase 6's VERIFY-01..VERIFY-04 can invoke directly rather than re-deriving.
- The JOB-01/JOB-02 → proving-test traceability table above is ready for Phase 6 to inherit verbatim.
- ROADMAP SC-4 is fully closed in both directions with an explicit recognition assertion (not merely a count comparison), and the non-duplication guarantee is demonstrated under genuine process-level concurrency, traced to the live `dedupeKey.unique()` constraint.
- No blockers identified. Phase 5 is complete.

---
*Phase: 05-idempotent-routine-instance-job*
*Completed: 2026-08-09*

## Self-Check: PASSED

Confirmed on disk: `cli/tests/test_routine_job_parity.py`,
`web/e2e/routine-job-cross-channel.spec.ts`,
`.planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh`,
`README.md`, `cli/README.md`, `web/README.md`.
Confirmed in `git log --oneline --all`: `867b321`, `7791b54`, `c7cc4e7`.
Confirmed live: `bash .planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh`
exits 0 and prints `PHASE 05 VERIFIED` as its final line, run from an
unrelated cwd (`/tmp`); zero `phase05-` leftovers in the live app afterward.
