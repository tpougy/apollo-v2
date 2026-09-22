---
phase: 27-robustez-do-job
reviewed: 2026-08-14T22:30:00Z
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
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 27: Code Review Report (final re-review, iteration 3)

**Reviewed:** 2026-08-14T22:30:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Third and final re-review, verifying commits `b73cad5` (WR-01 fix: unify
Python's `_is_concluida` strip predicate to Unicode general-category,
matching TS's `\p{M}`) and `33c72a2` (WR-02 fix: add direct unit-test
coverage for the `n > 0` guard on `nthBusinessDayFromMonthEnd` in both
runtimes) against the prior `27-REVIEW.md`. Both claims were independently
exercised — not just read — against the project's actual runtimes (`uv run
python3` → Python 3.12.12 / Unicode 15.0.0; `node` v20.20.2 / Unicode 17.0;
`bun test` v1.3.12).

**WR-02 — CONFIRMED FULLY RESOLVED.** `test_nth_business_day_from_month_end_
rejects_positive_n` (`cli/tests/test_bizdays.py:78-86`) and
`"nthBusinessDayFromMonthEnd rejects n > 0"` (`web/src/lib/bizdays.test.ts:
91-93`) both exist, are real assertions (not stubs/no-ops), and pass:
`uv run pytest tests/test_bizdays.py` → 198 passed; `bun test
src/lib/bizdays.test.ts` → 48 pass, 0 fail. This finding is closed and is
not carried forward.

**WR-01 — PARTIALLY RESOLVED, NOT CLOSED.** The claim under test was: "is
`unicodedata.category(ch)[0] != 'M'` (Python) now genuinely equivalent to
`\p{M}` (TS), not just equivalent on the one U+0E31 repro case?" Verified
empirically, not just read: both predicates are defined as "Unicode
General_Category = Mark (Mn/Mc/Me)", which is the same *definition* in the
abstract — but each runtime evaluates that definition against its own
bundled Unicode Character Database snapshot, and those snapshots are
different versions. Exhaustively enumerating every Unicode code point
(`U+0000`-`U+10FFFF`, excluding surrogates) through the project's actual
runtimes:

```
Python 3.12.12 (uv run), unicodedata.unidata_version = 15.0.0: 2450 code points with category[0] == "M"
Node 20.20.2, process.versions.unicode = 17.0:                2543 code points matching /\p{M}/u
Code points where JS matches and Python does NOT: 93 (e.g. U+0897, U+1ACF-U+1AEB, U+10D69-U+10D6A)
Code points where Python matches and JS does NOT: 0
```

Concrete reproduction of a genuinely divergent input, run against the real
implementations in this codebase:

```
$ uv run python3 -c "
from apollo_cli.routine_job import _is_concluida
s = 'concluida' + chr(0x0897)
print(_is_concluida(s))"
False

$ node -e "
function isConcluida(status) {
  const CONCLUIDA_FORMS = new Set(['concluida', 'concluido']);
  const stripped = status.trim().normalize('NFKD').replace(/\p{M}/gu, '');
  return CONCLUIDA_FORMS.has(stripped.toLowerCase());
}
console.log(isConcluida('concluida' + String.fromCodePoint(0x0897)));"
true
```

Same input string, opposite boolean result — the identical failure mode
CR-01/WR-01 were meant to close, on a narrower (and now version-drift-driven,
rather than predicate-design-driven) trigger set. The two originally-reported
repro cases (`U+20D0`, `U+0E31`) are correctly fixed and covered by dedicated
fixture cases in `shared/routine-job.testcases.json` (lines 728-798) — the
fix pass's stated scope is genuinely satisfied for those two inputs. The
residual gap is a new, previously-undetected root cause: Python's
`unicodedata` module version is pinned to the interpreter version
(`Unicode 15.0.0` on the project's current Python 3.12), while V8/Node's
`\p{M}` reflects whichever ICU/Unicode version ships with that Node build
(`Unicode 17.0` on Node 20.20.2) — these will keep drifting apart on any
future Python or Node upgrade, independently of this codebase. See full
finding below for severity rationale and fix options.

Three pre-existing Info items from the prior review remain unaddressed
(explicitly out of scope for this fix pass, but still live in the reviewed
files, verified still present at their previously-reported locations).

## Warnings

### WR-01: `isConcluida`/`_is_concluida` are not provably equivalent across the full Unicode range — the two runtimes' bundled Unicode Character Database versions disagree on ~93 marks

**File:** `web/src/lib/routineJob.ts:382-385`, `cli/apollo_cli/routine_job.py:326-344`

**Issue:** Commit `b73cad5` correctly changed Python's strip predicate from
`unicodedata.combining(ch) != 0` (canonical combining class) to
`unicodedata.category(ch)[0] != "M"` (general category), which is the same
*abstract* definition as TS's `\p{M}` (`General_Category=Mark`, i.e.
Mn+Mc+Me). The code comment added in this fix states "TS's `isConcluida`
strips via `\p{M}` (the same category-based definition), so this MUST stay
category-based too" — true as a matching-*definition* statement, but this
does not make the two implementations byte-for-byte equivalent, because
`unicodedata.category()` and JS's `\p{M}` regex property each consult a
*specific version* of the Unicode Character Database baked into their
respective runtime, and those versions are not the same:

- Python 3.12 (the interpreter `uv run` resolves for this project):
  `unicodedata.unidata_version == "15.0.0"`.
- Node 20.20.2 (`bun`'s runtime is a separate V8-based engine, but Node's
  own regex behavior is representative of what any JS engine on the
  project's CI/deploy targets would use): `process.versions.unicode ==
  "17.0"`.

A code point assigned a combining-mark category in Unicode 16 or 17 (after
Python 3.12's Unicode 15.0.0 snapshot was frozen) is stripped by TS but not
by Python — reproducing exactly the "same string, opposite boolean result"
failure mode this whole fix chain (CR-01 → WR-01) exists to eliminate, just
against a much narrower and now environment-dependent codepoint set (93 out
of ~1.1M, verified by exhaustive enumeration above) instead of the
originally-reported ~2200-codepoint gap between "combining class" and
"category". No test in either fixture or test file exercises any of these
93 code points — the dedicated fixture cases added by `b73cad5`
(`shared/routine-job.testcases.json` lines 728-798) only prove the two
*originally reported* repro inputs (`U+20D0`, `U+0E31`) now agree; they do
not, and structurally cannot, prove agreement for marks that don't yet
exist in Python's bundled Unicode table.

Practical risk for this specific field is low: the divergent code points
(e.g. `U+0897` Arabic mark, `U+1ACF`-`U+1AEB` Devanagari-extended vowel
signs, `U+10D69`-`U+10D6A` Garay diacritics) are not plausible characters in
a Brazilian financial back-office's `status` free-text field. This is why
the finding remains a Warning rather than a Critical/Blocker, consistent
with the prior review's downgrade rationale for the same class of gap. It
is nonetheless a genuine, reproducible violation of this project's own
explicitly stated invariant (module docstring, both files: "the two
implementations must never be allowed to disagree silently") and will
silently widen or shift on the next independent Python or Node upgrade,
with no test anywhere positioned to catch it.

**Fix:** This is not fixable by picking a "more correct" predicate in either
language — both already implement the same correct definition
(`General_Category=Mark`). The actual fix options are:
1. **Accept and document** the residual, version-driven gap explicitly in
   both docstrings (the current comment overstates the guarantee — it should
   say "equivalent for any code point whose Mark category is recognized by
   both runtimes' current Unicode Character Database versions" rather than
   implying unconditional equivalence), and treat it as a known, accepted,
   near-zero-practical-risk limitation — the pragmatic choice given how
   implausible the trigger set is for this field's real data.
2. **Pin/vendor the Unicode Mark set** used by both `_is_concluida` and
   `isConcluida` to a single, explicitly-versioned, checked-in code-point
   table (mirroring how `bizdays.py`/`bizdays.ts` already vendor ANBIMA
   holiday data instead of trusting each runtime's own bundled calendar) —
   the only approach that achieves true byte-for-byte parity independent of
   future runtime upgrades, at the cost of meaningfully more implementation
   complexity for a field that will almost certainly never see one of these
   code points in production.

Given the cost/benefit, option 1 (explicit documentation of the residual
limitation, no further code change) is the reasonable choice unless this
project's parity bar is meant to be unconditional even for
practically-unreachable inputs.

## Info

### IN-01: `isConcluida`'s TS module docstring still does not name the actual `\p{M}` mechanism or its residual-gap caveat

**File:** `web/src/lib/routineJob.ts:54-69`

**Issue:** Carried over from the prior two reviews, still unaddressed (out
of scope for the `b73cad5`/`33c72a2` fix pass). The docstring still reads
generically ("`status.trim().normalize(\"NFKD\")` with combining marks
stripped (accent removal)") rather than naming the `\p{M}` general-category
mechanism the code actually uses, and does not mention the residual
runtime-Unicode-version gap documented in WR-01 above — the Python side's
docstring (`cli/apollo_cli/routine_job.py:326-344`) was updated with much
more mechanism detail during the WR-01 fix pass; the TS side was not
brought to parity.

**Fix:** Update the TS docstring to name `\p{M}` explicitly and cross-
reference the residual-gap caveat, mirroring the level of detail the Python
docstring now has.

### IN-02: `lastDayOfMonth` remains hand-duplicated between `bizdays.ts` and `routineJob.ts`

**File:** `web/src/lib/bizdays.ts:137-139`, `web/src/lib/routineJob.ts:168-170`

**Issue:** Carried over from the prior two reviews, still unaddressed and
still present at the same locations (verified). Both files independently
define an identical private `lastDayOfMonth(year, month)` helper, each
justified in its own comment by avoiding a `bizdays.ts` <-> `routineJob.ts`
circular import. Still byte-identical; nothing enforces they stay that way
if one is ever edited without the other.

**Fix:** Unchanged from the prior reviews — extract to a small,
dependency-free shared module both files import from (it needs no imports
of its own, so it cannot introduce a cycle).

### IN-03: Unchecked `as string` cast on `template.antecessor?.id` still relies on an unexpressed invariant

**File:** `web/src/lib/routineJob.ts:518`

**Issue:** Carried over from the prior two reviews, still unaddressed and
still present at the same location (verified: `const antecessorId =
template.antecessor?.id as string;`). The cast discards `string |
undefined`, safe today only because `pendingEncadeado` is only ever
populated for templates that already passed the `!template.antecessor?.id`
guard earlier in `computeExpectedInstances` — an invariant enforced by
control flow, not by the type checker, so a future refactor that reorders
or removes that earlier guard would silently reintroduce `undefined` here
without any compiler error.

**Fix:** Unchanged from the prior reviews — store `antecessorId: string`
directly on `PendingEncadeado` (derived once, at the point the guard is
known to hold) instead of re-deriving and re-casting it later.

---

_Reviewed: 2026-08-14T22:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
