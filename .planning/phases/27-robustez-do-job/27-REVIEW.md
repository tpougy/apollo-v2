---
phase: 27-robustez-do-job
reviewed: 2026-08-14T21:09:27Z
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
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-08-14T21:09:27Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This phase adds three fixes to the routine-instance job: (JOB-01/D-27-A) a
normalized `"concluída"/"concluído"` status recognizer replacing an
exact-literal comparison, (JOB-02/D-27-B) backward-counting business-day
support for `du_fixo` when `offsetDias <= 0`, and (JOB-03/D-27-C) a `nome`
field on every `skipped` entry. Both runtimes (`cli/apollo_cli/*.py` and
`web/src/lib/*.ts`) were checked side by side against the shared JSON
fixtures (`shared/bizdays.testcases.json`, `shared/routine-job.testcases.json`)
that are supposed to be the single source of truth proving TS/Python parity.

Verified as sound, matching the review's specific focus areas:
- `corrido_fixo`'s `offsetDias >= 1` validation is untouched in both
  `_compute_fixed_instances`/`computeFixedInstances` call sites (min bound
  still `1` in both languages) — confirmed via `nth_calendar_day_of_month`
  callers and the `corrido_fixo` fixture scenarios.
- `du_fixo` templates with `offsetDias >= 1` are dispatched to the exact
  same, unmodified `nth_business_day_of_month`/`nthBusinessDayOfMonth`
  function in both languages (`_du_fixo_nth_day`/`duFixoNthDay` only route
  `n <= 0` to the new backward-counting path), so pre-existing
  `dedupeKey`/`dataPrevista` output for those templates is unchanged.
- The sign-based `du_fixo` dispatch and the new
  `nth_business_day_from_month_end`/`nthBusinessDayFromMonthEnd` primitive
  are structurally identical between the two runtimes and are exercised by
  a comprehensive, genuinely shared fixture (`shared/bizdays.testcases.json`,
  `shared/routine-job.testcases.json`) covering weekend/holiday roll-back,
  cross-month, and Previa-DU-2-style real cases.

However, one genuine TS/Python behavioral divergence was found in the new
`_is_concluida`/`isConcluida` normalization — see CR-01. Given this project's
explicit C-06 parity constraint (and this phase's own stated purpose of
eliminating exactly this class of silent-divergence bug), this is flagged as
Critical even though the trigger condition is a narrow one not covered by
the current fixture data.

## Critical Issues

### CR-01: `isConcluida` (TS) and `_is_concluida` (Python) strip different sets of Unicode combining marks — a provable cross-runtime divergence

**File:** `web/src/lib/routineJob.ts:382-385`, `cli/apollo_cli/routine_job.py:326-334`

**Issue:**

Python strips combining marks by Unicode **canonical combining class**
(`unicodedata.combining(ch)` — nonzero for essentially any combining mark in
any Unicode block):

```python
decomposed = unicodedata.normalize("NFKD", status.strip())
stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
```

TS strips combining marks by a **fixed codepoint range**, `U+0300`–`U+036F`
(the "Combining Diacritical Marks" block only):

```ts
const stripped = status.trim().normalize("NFKD").replace(/[̀-ͯ]/g, "");
```

These two are equivalent only for the specific combining marks that
Portuguese-accented Latin letters (á, ã, ç, í, ó, ...) decompose into under
NFKD — which is exactly what the current shared fixture exercises (verified:
`"Concluída"`/`"concluído "` in `shared/routine-job.testcases.json` decompose
to base-letter + U+0301/U+0303, both inside the TS regex's range). For any
`status` value containing a combining mark **outside** `U+0300`–`U+036F`
(e.g. `U+20D0` COMBINING LEFT HARPOON ABOVE, or any mark from the
"Combining Diacritical Marks Supplement"/"...Extended"/"...for Symbols"
blocks), Python strips it and TS does not — producing a different match
result for the identical input string:

```
status = "concluida⃐"
Python: _is_concluida(status) -> True   (mark stripped by unicodedata.combining)
TS:     isConcluida(status)   -> False  (mark outside U+0300-036F, left in string)
```

There is also a narrower, in-range inconsistency: `U+034F` COMBINING
GRAPHEME JOINER falls inside `U+0300`–`U+036F` but has canonical combining
class `0`, so Python's `unicodedata.combining()` does **not** treat it as a
mark to strip, while the TS regex strips it unconditionally regardless of
combining class. Same input, different normalized output, in both directions.

This is exactly the class of bug D-27-A was written to eliminate (a status
spelling silently treated differently across contexts) — it has just moved
from "same runtime, different literal" to "same status string, different
runtime." The current cross-runtime fixture (`shared/
routine-job.testcases.json`) does not exercise it because every accented
test case in it happens to decompose into the `U+0300`–`U+036F` range, so
CI is green while the implementations are not actually identical.

**Fix:**

Make the TS implementation strip by Unicode general category (`Mark`)
instead of a fixed codepoint range, which covers all combining-mark blocks
and matches Python's intent far more closely:

```ts
function isConcluida(status: string): boolean {
  const stripped = status.trim().normalize("NFKD").replace(/\p{M}/gu, "");
  return CONCLUIDA_FORMS.has(stripped.toLowerCase());
}
```

(`\p{M}` requires the `u` flag; it strips `Mn`/`Mc`/`Me` categories, which is
a much closer analogue to `unicodedata.combining() != 0` than a single
32-codepoint range. Note it still won't be byte-for-byte identical to
`unicodedata.combining` in the `U+034F` edge case — if perfect parity is
required, add a dedicated fixture case for that codepoint and assert both
runtimes agree, or special-case it explicitly in both implementations.)

## Warnings

### WR-01: `nthBusinessDayFromMonthEnd`/`nth_business_day_from_month_end` silently produce a nonsensical result if ever called with `n > 0`, in both runtimes

**File:** `web/src/lib/bizdays.ts:141-156`, `cli/apollo_cli/bizdays.py:127-142`

**Issue:** Both docstrings explicitly state `n > 0` "is not a supported
input here — callers dispatch on sign", and today the only caller
(`duFixoNthDay`/`_du_fixo_nth_day`) does correctly restrict calls to `n <= 0`.
But neither function actually enforces that invariant — a future caller (or
a refactor that flips a comparison operator) passing `n > 0` would silently
walk business days *forward* from the month's last business day, past the
end of the month, and return a plausible-looking but wrong ISO date rather
than raising. This is inconsistent with the project's own stated philosophy
elsewhere in this same module ("a system that silently answers from a
different calendar ... is worse than one that refuses to answer",
`bizdays.py:10-12`) — the same "fail loudly" bar isn't applied here.

**Fix:** Add a defensive guard in both implementations:

```python
def nth_business_day_from_month_end(year: int, month: int, n: int) -> str:
    if n > 0:
        raise ValueError(f"nth_business_day_from_month_end: n must be <= 0, got {n}")
    ...
```

```ts
export function nthBusinessDayFromMonthEnd(year: number, month: number, n: number): string {
  if (n > 0) {
    throw new RangeError(`nthBusinessDayFromMonthEnd: n must be <= 0, got ${n}`);
  }
  ...
}
```

### WR-02: Python test suite lacks the purity/conservation-law tests the TS suite added for `computeExpectedInstances`

**File:** `cli/tests/test_routine_job.py` (whole file), compare `web/src/lib/routineJob.test.ts:113-169`

**Issue:** `routineJob.test.ts` has two test blocks with no Python
equivalent:
- `"routineJob dropAudit — conservation law over every scenario"` (lines
  113-144): asserts every `ativo` template appears in exactly one of
  `expected`/`skipped` and every inactive template appears in neither, over
  **every** scenario in the shared fixture.
- `"routineJob purity"` (lines 146-169): asserts `computeExpectedInstances`
  does not mutate its `templates`/`existing` inputs and produces identical
  output across repeated calls.

`test_routine_job.py` runs the same fixture scenarios (`test_scenario`,
line 72-78) but never asserts the conservation-law invariant or input
immutability. Since this module is explicitly a "twin" implementation whose
whole value proposition is behavioral parity, a defensive property proven on
one side and silently unproven on the other is a real coverage gap — a
future edit to `compute_expected_instances` that mutates `existing` in place,
or drops a template from both `expected` and `skipped`, would be caught by
CI on the TS side and not on the Python side.

**Fix:** Port both test blocks to `test_routine_job.py`, e.g.:

```python
def test_dropaudit_conservation_law_over_every_scenario() -> None:
    assert FIXTURE["scenarios"]
    for scenario in FIXTURE["scenarios"]:
        result = compute_expected_instances(
            scenario["templates"], scenario["today"], scenario["existing"]
        )
        with_instances = {i["templateId"] for i in result.expected}
        skipped_ids = {s["templateId"] for s in result.skipped}
        for tpl in scenario["templates"]:
            if tpl.get("ativo") is False:
                assert tpl["id"] not in with_instances
                assert tpl["id"] not in skipped_ids
            else:
                assert (tpl["id"] in with_instances) != (tpl["id"] in skipped_ids)


def test_compute_expected_instances_does_not_mutate_inputs() -> None:
    import copy
    scenario = FIXTURE["scenarios"][0]
    templates_copy = copy.deepcopy(scenario["templates"])
    existing_copy = copy.deepcopy(scenario["existing"])
    compute_expected_instances(templates_copy, scenario["today"], existing_copy)
    assert templates_copy == scenario["templates"]
    assert existing_copy == scenario["existing"]
```

## Info

### IN-01: `isConcluida`'s TS docstring overstates the equivalence to Python's normalization

**File:** `web/src/lib/routineJob.ts:58-59`

**Issue:** The module docstring says `isConcluida(status)` implements
"`status.trim().normalize(\"NFKD\")` with combining marks stripped (accent
removal)" as if this is a faithful description of what the code below does
relative to Python's `unicodedata.combining()`-based approach. As shown in
CR-01, the actual regex only covers one Unicode block. Once CR-01 is fixed,
update this comment to describe the actual stripping mechanism (`\p{M}`
Unicode-category strip) rather than leaving the reader to assume full
parity with the Python implementation.

**Fix:** Update the docstring alongside the CR-01 fix to name the actual
mechanism (`\p{M}` general-category strip) and note any known residual gap
(e.g. `U+034F`) rather than implying byte-for-byte equivalence.

### IN-02: `lastDayOfMonth` is hand-duplicated between `bizdays.ts` and `routineJob.ts`

**File:** `web/src/lib/bizdays.ts:131-139`, `web/src/lib/routineJob.ts:162-170`

**Issue:** Both files define an identical private `lastDayOfMonth(year,
month)` helper. The duplication is explicitly justified in `bizdays.ts`'s
comment (avoiding a `bizdays.ts` -> `routineJob.ts` circular import), and the
two copies are currently byte-identical, so this is not a functional bug —
but it is a maintenance hazard: nothing enforces that a future edit to one
copy (e.g. a leap-year fix) is mirrored to the other. The Python side has no
equivalent duplication (`routine_job.py` and `bizdays.py` share
`pycalendar.monthrange`), so this is also a minor TS/Python structural
asymmetry, though not a behavioral one.

**Fix:** Consider extracting both `lastDayOfMonth` copies into a small
shared, dependency-free module (e.g. `web/src/lib/dateMath.ts`) that both
`bizdays.ts` and `routineJob.ts` import from, eliminating the circular-import
concern without duplicating the implementation.

### IN-03: Unchecked `as string` cast on `template.antecessor?.id` relies on an invariant the type system doesn't express

**File:** `web/src/lib/routineJob.ts:518`

**Issue:** `const antecessorId = template.antecessor?.id as string;` casts
away the `string | undefined` that `template.antecessor?.id` actually
produces. It's safe today only because every entry reaching this line was
already filtered by the `!template.antecessor?.id` check earlier in the
same function (line 429) before being pushed into `pendingEncadeado` — but
that invariant lives in the reviewer's head, not in the type checker. A
future refactor that reorders these two loops or takes a different path
into the sweep would produce `antecessorId === undefined` at runtime with no
type error to catch it, and `pendingIds.has(undefined)` would silently
evaluate to `false`, misrouting the template instead of failing loudly.

**Fix:** Narrow `PendingEncadeado.template.antecessor` to a required
`{ id: string }` at the point where it's pushed (e.g. destructure and store
`antecessorId: string` directly in `PendingEncadeado` instead of storing the
whole `TemplateRow` and re-deriving `id` later), removing the need for the
cast entirely.

---

_Reviewed: 2026-08-14T21:09:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
