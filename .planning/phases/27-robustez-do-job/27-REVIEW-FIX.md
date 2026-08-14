---
phase: 27-robustez-do-job
fixed_at: 2026-08-14T22:00:00Z
review_path: .planning/phases/27-robustez-do-job/27-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 27: Code Review Fix Report

**Fixed at:** 2026-08-14T22:00:00Z
**Source review:** .planning/phases/27-robustez-do-job/27-REVIEW.md
**Iteration:** 2

**Verification environment:** All fixes were applied and verified directly
in the main checkout (`workflow.use_worktrees: false` in
`.planning/config.json` — no isolated worktree was created for this run;
edits and commits below land on `main` directly and are reproducible from
the current working tree).

**Summary:**
- Findings in scope: 2 (fix_scope=critical_warning: 0 Critical, 2 Warning)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `isConcluida`/`_is_concluida` still diverge for combining marks with canonical combining class 0

**Files modified:** `cli/apollo_cli/routine_job.py`, `shared/routine-job.testcases.json`
**Commit:** `b73cad5`
**Applied fix:** Changed Python's `_is_concluida` strip predicate from
`unicodedata.combining(ch) != 0` (canonical combining class) to
`unicodedata.category(ch)[0] != "M"` (Unicode general category `Mark`:
Mn/Mc/Me) — the same category-based definition already used by TS's
`\p{M}` regex, per the review's recommended fix. Both runtimes now use the
identical predicate, closing the residual parity gap for marks whose
canonical combining class is 0 (e.g. Thai/Tamil vowel signs) that CR-01's
prior fix (range → category migration on the TS side only) left open.

Added a dedicated shared fixture case (`shared/routine-job.testcases.json`,
`tpl-b4g`/`tpl-ext-1g`) using the review's exact reported divergent input —
`"concluida" + U+0E31 THAI MAI HAN-AKAT` (category `Mn`, canonical combining
class `0`) — asserting `dataPrevistaEstimada` is ABSENT in both runtimes
(i.e. both now agree the status counts as "concluída"). Confirmed the fix
directly:
```
$ uv run python -c "from apollo_cli.routine_job import _is_concluida; print(_is_concluida('concluida' + chr(0x0E31)))"
True
```
(previously `False`, per the review's repro). Both fixture-driven test
suites, which loop generically over `FIXTURE["scenarios"]`/`scenarios`,
pick up the new case automatically and pass:
- `uv run pytest cli/tests/test_routine_job.py -k "not live"` → 62 passed,
  4 deselected (up from 61; net +1 for the new scenario).
- `bun test web/src/lib/routineJob.test.ts` → 60 pass (up from 59), 0 fail.

Also verified the previously-passing CR-01 fixture case
(`"concluida" + U+20D0`) still passes in both runtimes — the fix did not
regress the earlier repro.

### WR-02: New `n > 0` guard on `nthBusinessDayFromMonthEnd`/`nth_business_day_from_month_end` has zero test coverage

**Files modified:** `cli/tests/test_bizdays.py`, `web/src/lib/bizdays.test.ts`
**Commit:** `33c72a2`
**Applied fix:** Added a dedicated direct unit test in each runtime (the
review's "more simply" alternative, chosen over extending the shared JSON
fixture's `error` variant to a new class name, since Python's `ValueError`
and TS's `RangeError` are different names for the same guard and the
existing fixture mechanism assumes one shared error-class name across both
languages — see `_ERROR_CLASSES`/`ERROR_CLASSES` maps in both test files):
- `cli/tests/test_bizdays.py::test_nth_business_day_from_month_end_rejects_positive_n`
  — `pytest.raises(ValueError, match="n must be <= 0")` calling
  `nth_business_day_from_month_end(2026, 9, 1)`.
- `web/src/lib/bizdays.test.ts` — `test("nthBusinessDayFromMonthEnd rejects
  n > 0", ...)` — `expect(() => nthBusinessDayFromMonthEnd(2026, 9,
  1)).toThrow(RangeError)`.

Verified: `python3 -c "import ast; ast.parse(...)"` confirms Python syntax
validity; `uv run pytest cli/tests/test_bizdays.py -q` → 198 passed (up
from 197); `bun test web/src/lib/bizdays.test.ts` → 48 pass (up from 47),
0 fail. The new tests would now catch a future regression (e.g. `if n > 0`
silently changed to `if n > 1`) that no other existing test exercises,
since the guard is unreachable from the function's only production caller.

## Skipped Issues

None — both in-scope findings (WR-01, WR-02) were fixed.

Info findings (IN-01, IN-02, IN-03) remain out of scope for this fix pass
(`fix_scope: critical_warning`) and were not addressed.

---

_Fixed: 2026-08-14T22:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
