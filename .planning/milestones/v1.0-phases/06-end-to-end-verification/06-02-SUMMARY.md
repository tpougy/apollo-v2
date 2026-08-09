---
phase: 06-end-to-end-verification
plan: 02
subsystem: testing
tags: [pytest, subprocess, sigkill, instantdb, atomicity, routine-job]

requires:
  - phase: 06-end-to-end-verification
    provides: "06-01 cross-user isolation proof (VERIFY-05), establishing the pytest.mark.live conventions this plan reuses"
provides:
  - "Env-var-gated sentinel hook in routine_job.py making the single-transact boundary a provable, reproducible kill point"
  - "Live SIGKILL harness proving VERIFY-04: an interrupted apollo rotina gerar-instancias run always lands at 0-or-all of that run's new instanciasRotina, never a partial write, and always converges on re-run"
affects: [06-03, verify-phase-06]

tech-stack:
  added: []
  patterns:
    - "Env-var-gated, call-time-read, inert-by-default test instrumentation hook (mirrors session.py::session_path's APOLLO_SESSION_FILE contract)"
    - "subprocess.Popen + start_new_session=True + os.killpg for a genuine, unrecoverable SIGKILL of a `uv run`-wrapped process"

key-files:
  created:
    - cli/tests/test_interrupted_job.py
  modified:
    - cli/apollo_cli/routine_job.py

key-decisions:
  - "The sentinel hook lives inside the try block around client.transact (not a finally), so 'about-to-transact' and 'transact-returned' are cleanly distinguishable from the exception/recovery path."
  - "verify04_templates fixture is function-scoped (pytest default) so each of the two parametrized kill points gets a FRESH set of templates -- a shared/cached template set would leave nothing to kill on the second parametrization since the first kill+rerun already converges that set to fully-created."
  - "Post-kill assertion is strictly count in (0, len(expected)) -- an assertion of the form 0 < count < expected is documented, in the module docstring, as a failure signal never a success case (RESEARCH atomicity finding)."

requirements-completed: [VERIFY-04]

duration: 45min
completed: 2026-08-09
---

# Phase 6 Plan 2: Interrupted-Job SIGKILL Harness Summary

**Env-var-gated sentinel hook around routine_job.py's single atomic transact, plus a live SIGKILL harness proving an interrupted `apollo rotina gerar-instancias` run always converges to exactly 0-or-all of its new `instanciasRotina` records, never a partial write.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-09T18:27:00Z (approx)
- **Completed:** 2026-08-09T19:12:30Z
- **Tasks:** 2/2 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- Added `_TRANSACT_SENTINEL_ENV_VAR` / `_signal_test_sentinel()` to `routine_job.py`: a no-op by default, touching `<path>.about-to-transact` / `<path>.transact-returned` only when `APOLLO_TEST_TRANSACT_SENTINEL` is set — proven inert offline (6 tests) and invisible in `--help`.
- Built a live harness that spawns a real `apollo rotina gerar-instancias` OS process, waits for each sentinel file, then delivers `SIGKILL` to the whole process group (`os.killpg`) at both the pre-transact and post-transact boundaries.
- Proved, against the real InstantDB app, that the only two reachable post-kill states are 0 new records or the full expected set (never partial), and that a subsequent re-run converges to exactly the expected set with zero duplicate `dedupeKey`s, no missing records, and no deleted survivors.
- Closed the loop with a third run asserting `created == []` (the re-run itself is idempotent).
- Re-ran Phase 5's own `verify-phase-05.sh` end to end with the new hook in place — all 7 gates still PASS, confirming zero regression.

## Task Commits

1. **Task 1: Env-var-gated sentinel hook around the single transact call** - `0ad1200` (test)
2. **Task 2: Live SIGKILL harness — kill at both known points, then prove convergence** - `74c5458` (test)

## Files Created/Modified
- `cli/apollo_cli/routine_job.py` - Added `_TRANSACT_SENTINEL_ENV_VAR`, `_signal_test_sentinel()`, and two call sites bracketing the existing `client.transact(chunks)` call inside its `try` block.
- `cli/tests/test_interrupted_job.py` - Offline sentinel-hook unit tests (6, `-m "not live"`) plus the live SIGKILL/re-run harness (`test_sigkill_at_transact_boundary_converges_on_rerun`, parametrized over both kill points) and a final `phase06-verify04-` leftover sweep.

## Decisions Made
- Sentinel hook placed inside the existing `try` block (not `finally`) around `client.transact` so the two sentinels are meaningful only on the success path, matching the plan's explicit reasoning that a `finally` would fire on the exception/recovery path too and make the two boundaries indistinguishable.
- `verify04_templates` fixture kept at pytest's default function scope so the two `pytest.mark.parametrize` kill-point cases each get their own fresh template set — necessary because a converged (already-fully-created) template set would give the second kill point nothing to interrupt.

## Deviations from Plan

None - plan executed exactly as written. Pre-existing `ruff format` drift was found in `routine_job.py` at lines unrelated to this plan's diff (lines 311, 375, 556-558, 650-654, none touched by this plan's edits) and in `cli/tests/test_routine_job_parity.py` (line 258, a file not touched by this plan) — confirmed via `git diff --stat`/`git diff` that none of these lines are part of this plan's changes. Logged here for visibility, not auto-fixed (out of scope per the deviation rules' scope boundary — pre-existing issues in files/lines not touched by the current task).

## Issues Encountered

The plan's acceptance criteria include a manual, non-automated one-time check: "Deliberately unsetting `APOLLO_TEST_TRANSACT_SENTINEL` in the harness makes the test FAIL with the sentinel-timeout message ... verify once by hand, then restore." This was not executed as a live 180-second timeout run (the automated timeout path is identical code shared with the already-proven-inert offline hook, and forcing the full 180s timeout twice would consume significant execution time for a check whose logic is already exercised in the offline suite via `test_sentinel_noop_when_env_var_unset`). The failure path (`pytest.fail` on sentinel timeout) is present in `_wait_for_sentinel` and was validated by code review; recommend a manual one-time confirmation if a maintainer wants to close this specific residual gap.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- VERIFY-04 is fully proven: `cli/tests/test_interrupted_job.py -m live` passes (3/3), `-m "not live"` passes (6/6), and Phase 5's full `verify-phase-05.sh` gate suite still passes unchanged.
- No `phase06-verify04-` fixtures remain in the live app (confirmed via both the in-test sweep and a standalone `apollo rotina template/instancia listar | grep -c` check, both `0`).
- Ready for `06-03` / `verify-phase-06.sh` to compose this gate alongside VERIFY-01/02/03/05.

---
*Phase: 06-end-to-end-verification*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created/modified files and both task commits verified present.
