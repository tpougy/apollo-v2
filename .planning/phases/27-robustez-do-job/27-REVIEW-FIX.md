---
phase: 27-robustez-do-job
fixed_at: 2026-08-14T21:30:00Z
review_path: .planning/phases/27-robustez-do-job/27-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 27: Code Review Fix Report

**Fixed at:** 2026-08-14T21:30:00Z
**Source review:** .planning/phases/27-robustez-do-job/27-REVIEW.md
**Iteration:** 1

**Verification environment:** All fixes were applied and verified directly
in the main checkout (`workflow.use_worktrees: false` in
`.planning/config.json` — no isolated worktree was created for this run;
edits and commits above land on `main` directly and are reproducible from
the current working tree).

**Summary:**
- Findings in scope: 3 (fix_scope=critical_warning: 1 Critical, 2 Warning)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: `isConcluida` (TS) and `_is_concluida` (Python) strip different sets of Unicode combining marks

**Files modified:** `web/src/lib/routineJob.ts`, `shared/routine-job.testcases.json`
**Commit:** `9e05b91`
**Applied fix:** Replaced TS's fixed-codepoint-range strip
(`replace(/[̀-ͯ]/g, "")`, limited to U+0300–036F) with a Unicode
general-category strip (`replace(/\p{M}/gu, "")`), matching Python's
`unicodedata.combining(ch) != 0` intent far more closely than a single
32-codepoint range does. Added a new shared fixture scenario
(`shared/routine-job.testcases.json`, `tpl-b4f`/`tpl-ext-1f`) using a status
string `"concluida" + U+20D0 COMBINING LEFT HARPOON ABOVE` — a combining
mark from the "Combining Diacritical Marks for Symbols" block, well outside
the old TS regex's U+0300–036F range — and confirmed both runtimes now
strip it and recognize the status as concluded:
- Verified independently with a throwaway script: Python's
  `unicodedata.combining`-based strip and TS's new `\p{M}`-based strip both
  produce `"concluida"` for this input.
- Both test suites already loop generically over
  `FIXTURE["scenarios"]`/`scenarios` (`cli/tests/test_routine_job.py::test_scenario`,
  `web/src/lib/routineJob.test.ts`'s "scenario fixture parity" describe
  block), so the new fixture entry automatically produced a new assertion
  in both languages with no additional test-file code required. Ran both:
  `bun test src/lib/routineJob.test.ts` (59 pass, including the new case)
  and `uv run pytest tests/test_routine_job.py -k test_scenario` (29 pass,
  including `test_scenario[...U+20D0 COMBINING LEFT HARPOON ABOVE...]`).

Note: the review's own caveat about `U+034F` COMBINING GRAPHEME JOINER
(inside U+0300–036F but combining class 0, so Python does NOT strip it while
`\p{M}` still would) remains a known, documented residual gap — the review
explicitly flagged this as "won't be byte-for-byte identical" without a
dedicated special-case, and building that special-case was not requested
by this fix's scope (a mark outside the range, proving general-category
agreement, was the chosen fixture case per the task instructions).

### WR-01: `nthBusinessDayFromMonthEnd`/`nth_business_day_from_month_end` silently mishandle `n > 0`

**Files modified:** `web/src/lib/bizdays.ts`, `cli/apollo_cli/bizdays.py`
**Commit:** `10e50ce`
**Applied fix:** Added a defensive guard at the top of both functions per
the review's suggested fix: TS throws `RangeError` and Python raises
`ValueError` when `n > 0`, converting a previously silent
walk-past-month-end into a loud, immediate failure. Updated both docstrings
to state the invariant is now enforced (raises), not just documented as
unsupported. Verified: `node_modules/.bin/tsc -p tsconfig.app.json --noEmit`
reports zero errors for `bizdays.ts`; `python3 -c "import ast; ast.parse(...)"`
confirms Python syntax validity; full non-live suites still pass —
`bun test src/lib/bizdays.test.ts src/lib/routineJob.test.ts` (106 pass) and
`uv run pytest tests/test_bizdays.py tests/test_routine_job.py -m "not live"`
(256 pass) — confirming the only existing caller (`duFixoNthDay`/
`_du_fixo_nth_day`) never triggers the new guard.

### WR-02: Python test suite lacked the purity/conservation-law tests present in TS

**Files modified:** `cli/tests/test_routine_job.py`
**Commit:** `2c867dd`
**Applied fix:** Ported both TS test blocks (`web/src/lib/routineJob.test.ts:113-169`)
to Python as `test_dropaudit_conservation_law_over_every_scenario` (matching
the TS version's full behavior, including the "no template skipped more
than once" duplicate-occurrence check, not just the review's simplified
suggested snippet) and `test_compute_expected_instances_does_not_mutate_inputs`
(using `json.loads(json.dumps(...))` for the deep-copy, matching the TS
`JSON.parse(JSON.stringify(...))` idiom). Verified:
`python3 -c "import ast; ast.parse(...)"` confirms syntax validity;
`uv run pytest tests/test_routine_job.py -k "dropaudit or does_not_mutate"`
(2 pass); full non-live suite `uv run pytest tests/test_routine_job.py -m "not live"`
went from 59 to 61 passing tests with no regressions.

## Skipped Issues

None — all in-scope findings (CR-01, WR-01, WR-02) were fixed.

Info findings (IN-01, IN-02, IN-03) were out of scope for this fix pass
(`fix_scope: critical_warning`) and were not addressed.

---

_Fixed: 2026-08-14T21:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
