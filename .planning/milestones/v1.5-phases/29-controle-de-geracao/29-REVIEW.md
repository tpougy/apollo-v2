---
phase: 29-controle-de-geracao
reviewed: 2026-09-22T00:00:00Z
depth: quick
files_reviewed: 6
files_reviewed_list:
  - cli/apollo_cli/routine_job.py
  - cli/apollo_cli/entities/rotina.py
  - cli/tests/test_routine_job.py
  - web/src/lib/routineJob.ts
  - web/src/lib/routineJob.test.ts
  - shared/routine-job.testcases.json
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 29: Code Review Report (iteration 2 — final)

**Reviewed:** 2026-09-22T00:00:00Z
**Depth:** quick (targeted independent re-verification of CR-01's fix, plus a fresh quick pattern-matching pass)
**Files Reviewed:** 6
**Status:** issues_found (info only — no blockers remain)

## Summary

This is iteration 2 (final, loop cap lowered from 3 to 2) of the review-fix loop for Phase 29. Iteration 1 found CR-01 (Critical) and IN-01 (Info); CR-01 was fixed in commit `89b5edf` and is verified below. IN-01 was deliberately left unfixed per the fixer's note (dead TS-side code, no fixture coverage) and is carried forward unchanged.

### CR-01 — CONFIRMED FIXED

Re-read `cli/apollo_cli/entities/rotina.py:97-127` (`_validate_competencia_format`) directly from the working tree (not from the commit message) and independently re-derived its logic in an isolated interpreter before running the real function. Verified via `uv run python3` importing the actual `apollo_cli.entities.rotina` module and calling `_validate_competencia_format` directly:

```
'0000-08' -> REJECTED (BadParameter): '0000-08' tem ano invalido
'2026-08' -> ACCEPTED: 2026-08
'9999-12' -> ACCEPTED: 9999-12
'10000-01' -> REJECTED (BadParameter): '10000-01' nao esta no formato AAAA-MM
'0001-01' -> ACCEPTED: 0001-01
'garbage' -> REJECTED (BadParameter): 'garbage' nao esta no formato AAAA-MM
```

`--competencia 0000-08` is rejected with `click.BadParameter` (exit code 2) purely from the `date(year, month, 1)` bounds-check added at line 122-126 — this fires as a Click **option callback**, confirmed wired at `cli/apollo_cli/entities/rotina.py:494` (`callback=_validate_competencia_format`), which Click invokes during argument parsing, strictly before the `gerar_instancias` command body runs. This is before `_resolve_range_override`, `compute_expected_instances`, and any network call — the exact "before touching the compute core" bar iteration 1 required. `--competencia 2026-08` (and other in-range years, including `MINYEAR`/`MAXYEAR` boundary values `0001`/`9999`) still validate and pass through unchanged, so no regression on the happy path. The fix correctly mirrors `--de`/`--ate`'s `date`-construction-based bound (full `MINYEAR..MAXYEAR`) rather than inventing a narrower ANBIMA-specific bound, exactly as the fixer's commit message states.

No further action needed on CR-01.

### IN-01 — carried forward, unchanged (not re-fixed by design)

**File:** `web/src/lib/routineJob.ts:432-450` (`weeklyOccurrences`), `web/src/lib/routineJob.ts:315-339` (`monthsInRange`)

Same unguarded-year gap as CR-01's Python side, but on the TS mirror: `parseUtcDateJob`'s `new Date(...)` construction never bounds-checks the year, so an out-of-range year silently produces `Invalid Date`/`NaN` propagation rather than a Python-style crash. Still dead code — no SPA caller supplies `rangeOverride` yet (D-07/D-08). No user-facing impact currently. Left unfixed this iteration per explicit scope decision (no fixture coverage to safely land a same-session fix). Re-flagging only for traceability; not re-graded as a new finding.

### New quick-pattern scan (all 6 files)

Grepped all 6 phase files for hardcoded secrets, dangerous functions (`eval`, `innerHTML`, `exec`, `system`, `shell_exec`), debug artifacts (`console.log`, `debugger;`, `TODO`/`FIXME`/`XXX`/`HACK`), empty catch blocks, and bare `except:`. No hits in any file — nothing new introduced by the CR-01 fix commit or since iteration 1.

### Observation (not a finding against this diff): pre-existing live-test failure

Running `cli/tests/test_routine_job.py`'s live suite (`pytest.mark.live`, real InstantDB) surfaced one failing test unrelated to this iteration's change: `test_gerar_instancias_double_run_idempotent_and_preserves_status` fails its `report1["existing"] == []` assertion (90 unexpected pre-existing rows) on a fresh double-run. `git log` confirms neither `cli/apollo_cli/routine_job.py` nor `cli/tests/test_routine_job.py` were touched by the CR-01 fix commit (`89b5edf`) or anything since iteration 1's review — this looks like live-database test-isolation pollution (leftover instances from a prior/interrupted live run sharing the default date-range query window) rather than a code defect introduced by the reviewed diff. Flagging for awareness only; out of scope for this phase's CR-01/IN-01 re-review and not graded as a finding.

## Info

### IN-01: Same unguarded-year gap exists in the TS mirror, currently unreachable but latent (carried forward from iteration 1, unfixed by design)

**File:** `web/src/lib/routineJob.ts:432-450` (`weeklyOccurrences`), `web/src/lib/routineJob.ts:315-339` (`monthsInRange`)

**Issue:** `weeklyOccurrences`'s `parseUtcDateJob` builds a `Date` via `new Date(\`${iso}T00:00:00.000Z\`)` with no bounds validation — passing a year like `"0000"` produces an `Invalid Date` (JS `Date` doesn't throw, it silently becomes `NaN`), which is a *different* failure mode than Python's `ValueError` (no crash, but every downstream comparison against `Invalid Date` behaves unpredictably — e.g. `cursor <= end` involving `NaN` is always `false`). Today this is dead code from the CLI's perspective since `web/`'s `computeExpectedInstances` has no caller that ever supplies `rangeOverride` (D-07/D-08 — no SPA surface for `gerar-instancias` yet). No user-facing impact currently.

**Fix:** When (D-07/D-08's noted future milestone) a SPA surface is wired to supply `rangeOverride` directly, apply the equivalent bounds validation on the TS side before this becomes reachable — e.g. validate the parsed year in `parseUtcDateJob` (or upstream, wherever the range is first accepted from user input) and reject/throw for `NaN`/out-of-range years, so the eventual TS caller doesn't inherit CR-01's Python-side gap in a silently-different (NaN-propagation rather than crash) form.

---

_Reviewed: 2026-09-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
_Iteration: 2 of 2 (final — loop cap lowered from 3 to 2)_
