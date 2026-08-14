---
phase: 27-robustez-do-job
reviewed: 2026-08-14T21:45:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - cli/apollo_cli/bizdays.py
  - cli/apollo_cli/entities/rotina.py
  - cli/apollo_cli/routine_job.py
  - cli/tests/test_bizdays.py
  - cli/tests/test_routine_job.py
  - shared/bizdays.testcases.json
  - shared/routine-job.testcases.json
  - web/src/lib/bizdays.test.ts
  - web/src/lib/bizdays.ts
  - web/src/lib/routineJob.test.ts
  - web/src/lib/routineJob.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 27: Code Review Report (re-review after fix pass)

**Reviewed:** 2026-08-14T21:45:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This is a re-review of the fix pass (commits `9e05b91`, `10e50ce`, `2c867dd`)
addressing CR-01, WR-01, and WR-02 from the prior `27-REVIEW.md`. Each fix
was independently exercised (not just read) against both runtimes.

**CR-01 — RESOLVED for the reported trigger, but parity is still not
complete (see new WR-01 below).** `isConcluida` now strips via `\p{M}`
(Unicode `Mark` general category) instead of the fixed `U+0300`-`U+036F`
range. Verified: `"concluida" + U+20D0` (the reported repro, and the new
fixture case in `shared/routine-job.testcases.json`) now returns `True`
in both `_is_concluida` (Python) and `isConcluida` (TS), confirmed by
running both test suites (`uv run pytest cli/tests/test_routine_job.py -k
"not live"` → 61 passed; `bun test src/lib/routineJob.test.ts` → all
passed). However, `\p{M}` (category-based) and Python's
`unicodedata.combining(ch) != 0` (canonical-combining-class-based) are not
the same predicate, and the original review explicitly flagged this residual
gap in its fix suggestion ("still won't be byte-for-byte identical... if
perfect parity is required, add a dedicated fixture case"). No such fixture
case was added, and a concrete divergent input still exists — see WR-01.

**WR-01 — RESOLVED and verified.** Both `nth_business_day_from_month_end`
(Python) and `nthBusinessDayFromMonthEnd` (TS) now raise
(`ValueError`/`RangeError` respectively) when called with `n > 0`, confirmed
by direct invocation against both runtimes:
```
$ uv run python -c "from apollo_cli.bizdays import nth_business_day_from_month_end as f; f(2026,9,1)"
ValueError: nth_business_day_from_month_end: n must be <= 0, got 1
$ npx tsx -e 'import {nthBusinessDayFromMonthEnd as f} from "./src/lib/bizdays"; f(2026,9,1)'
RangeError: nthBusinessDayFromMonthEnd: n must be <= 0, got 1
```
The only caller of this function in each runtime (`_du_fixo_nth_day`/
`duFixoNthDay`) already dispatches `n > 0` to a different function, so the
guard is unreachable in production and behaves purely as documented
defense-in-depth. It is functionally correct — see the new WR-02 finding
below for a testing gap in this same fix.

**WR-02 — RESOLVED and verified.** `test_dropaudit_conservation_law_over_
every_scenario` and `test_compute_expected_instances_does_not_mutate_inputs`
were ported into `cli/tests/test_routine_job.py`, faithfully mirroring
`web/src/lib/routineJob.test.ts:113-169`'s conservation-law and purity
assertions. Confirmed passing: `uv run pytest cli/tests/test_routine_job.py
-k "not live"` → 61 passed, 4 deselected.

Two new findings surfaced during independent verification, plus three
pre-existing Info items from the prior review that remain unaddressed
(not part of this fix pass's stated scope, but still live in the reviewed
files).

## Warnings

### WR-01: `isConcluida`/`_is_concluida` still diverge for combining marks with canonical combining class 0 — CR-01's fix narrows but does not close the parity gap

**File:** `web/src/lib/routineJob.ts:382-385`, `cli/apollo_cli/routine_job.py:326-334`

**Issue:** The CR-01 fix changed the TS strip predicate from a fixed
codepoint range to `\p{M}` (Unicode general category `Mark`: `Mn`+`Mc`+`Me`).
Python's `_is_concluida` was left unchanged, using `unicodedata.combining(ch)
!= 0` (canonical combining class). These predicates are not equivalent:
several real Unicode marks belong to category `Mark` but carry canonical
combining class `0` (used by scripts that render combining vowel signs
without needing canonical reordering, e.g. Thai, Tamil). For any such
character, `\p{M}` strips it while `unicodedata.combining()` does not,
reproducing the exact same class of divergence CR-01 was meant to close —
just for a different codepoint set. Verified directly:

```
$ python3 -c "
import unicodedata
print(unicodedata.category('ั'), unicodedata.combining('ั'))"
Mn 0
```

```python
>>> from apollo_cli.routine_job import _is_concluida
>>> _is_concluida("concluidaั")   # "concluida" + U+0E31 THAI MAI HAN-AKAT
False
```

```ts
> isConcluida("concluidaั")
true
```

Same input string, opposite boolean result across the two runtimes — the
identical failure mode CR-01 targeted, on a narrower but still real trigger
set. This was explicitly anticipated as a residual risk in the original
review's fix suggestion ("Note it still won't be byte-for-byte identical to
`unicodedata.combining` in the `U+034F` edge case... if perfect parity is
required, add a dedicated fixture case for that codepoint and assert both
runtimes agree, or special-case it explicitly in both implementations") but
was not addressed by the fix commit. Given this project's explicit
cross-runtime parity requirement and this phase's own purpose (eliminating
exactly this class of silent status-matching divergence), this remains a
real defect; it is downgraded from Critical to Warning relative to the
original CR-01 only because the specific, previously-reported trigger
(marks outside `U+0300`-`U+036F`) is now fixed and the remaining trigger set
(marks with `ccc=0`) is far less likely to appear in the Portuguese-language
`status` field this function actually processes in production.

**Fix:** Pick ONE authoritative predicate and use it in both languages, e.g.
change Python to match category instead of combining class:
```python
stripped = "".join(ch for ch in decomposed if unicodedata.category(ch)[0] != "M")
```
or change TS to approximate combining-class semantics. Either way, add a
dedicated fixture case (e.g. `"concluidaั"`) to
`shared/routine-job.testcases.json` asserting the SAME expected result in
both runtimes, closing the loophole the way the shared-fixture mechanism is
designed to.

### WR-02: New `n > 0` guard on `nthBusinessDayFromMonthEnd`/`nth_business_day_from_month_end` has zero test coverage in either runtime

**File:** `web/src/lib/bizdays.ts:154-156`, `cli/apollo_cli/bizdays.py:140-141`, `shared/bizdays.testcases.json`, `cli/tests/test_bizdays.py`, `web/src/lib/bizdays.test.ts`

**Issue:** The WR-01 fix adds a guard that raises on `n > 0` in both
implementations, and it works correctly (verified by direct invocation
above). However, no automated test exercises this behavior in either
runtime:
- `shared/bizdays.testcases.json` has no `nthBusinessDayFromMonthEnd` case
  with `"n"` positive and `"error"` set (the existing `error` cases in this
  fixture are all `InvalidDateError`/`CalendarRangeError`, for a different
  function).
- `cli/tests/test_bizdays.py` and `web/src/lib/bizdays.test.ts` have no
  dedicated unit test (`pytest.raises`/`expect(...).toThrow`) for this
  function's new guard either.

Since the function's only caller in each runtime already avoids passing
`n > 0`, the guard is currently unreachable in production, which means it
is also untested by every other passing test in the suite — a future
refactor that silently breaks or removes the guard (e.g. changing `if n >
0` to `if n > 1`) would not be caught by CI.

**Fix:** Add a fixture case (extending the shared JSON's `error` variant to
support a new error class name, e.g. `"RangeError"`/`"ValueError"`) or, more
simply, a direct unit test in each test file:
```python
def test_nth_business_day_from_month_end_rejects_positive_n() -> None:
    with pytest.raises(ValueError, match="n must be <= 0"):
        nth_business_day_from_month_end(2026, 9, 1)
```
```ts
test("nthBusinessDayFromMonthEnd rejects n > 0", () => {
  expect(() => nthBusinessDayFromMonthEnd(2026, 9, 1)).toThrow(RangeError);
});
```

## Info

### IN-01: `isConcluida`'s TS module docstring still does not describe the actual `\p{M}` mechanism, or note the residual gap

**File:** `web/src/lib/routineJob.ts:54-69`

**Issue:** Carried over from the prior review (unaddressed by this fix
pass). The docstring still reads "`status.trim().normalize(\"NFKD\")` with
combining marks stripped (accent removal)" — generic language that doesn't
name the actual `\p{M}` general-category strip now in use, nor mention that
it is not fully equivalent to Python's canonical-combining-class approach
(see WR-01 above, which is exactly the gap this comment should flag for the
next reader).

**Fix:** Update the docstring to name the actual mechanism (`\p{M}`
Unicode-category strip) and explicitly call out the known residual
divergence with Python's `unicodedata.combining()`-based approach, per the
prior review's IN-01 suggestion.

### IN-02: `lastDayOfMonth` remains hand-duplicated between `bizdays.ts` and `routineJob.ts`

**File:** `web/src/lib/bizdays.ts:137-139`, `web/src/lib/routineJob.ts:168-170`

**Issue:** Carried over from the prior review (unaddressed; out of scope
for this fix pass). Both files still define an identical private
`lastDayOfMonth(year, month)` helper, each justified by avoiding a circular
import. Still byte-identical, still nothing enforces they stay that way.

**Fix:** Unchanged from the prior review — consider extracting to a small
shared, dependency-free module both files import from.

### IN-03: Unchecked `as string` cast on `template.antecessor?.id` still relies on an unexpressed invariant

**File:** `web/src/lib/routineJob.ts:518`

**Issue:** Carried over from the prior review (unaddressed; out of scope
for this fix pass). `const antecessorId = template.antecessor?.id as
string;` still casts away `string | undefined`, safe today only because of
an invariant enforced earlier in the function and not by the type checker.

**Fix:** Unchanged from the prior review — narrow `PendingEncadeado` to
store `antecessorId: string` directly instead of re-deriving it via a cast.

---

_Reviewed: 2026-08-14T21:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
