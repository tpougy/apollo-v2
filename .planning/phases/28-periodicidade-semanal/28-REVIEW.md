---
phase: 28-periodicidade-semanal
reviewed: 2026-09-22T19:20:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - shared/instant.schema.ts
  - cli/apollo_cli/routine_job.py
  - cli/apollo_cli/entities/rotina.py
  - cli/tests/test_routine_job.py
  - cli/tests/test_crud_rotina_template.py
  - web/src/lib/routineJob.ts
  - web/src/lib/routineJob.test.ts
  - shared/routine-job.testcases.json
  - web/src/lib/entities/defs/templatesRotina.ts
  - web/src/lib/entities/registry.test.ts
  - web/e2e/entities-rotina-log.spec.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 28: Code Review Report (re-review, iteration 2)

**Reviewed:** 2026-09-22T19:20:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Second-pass review, verifying commits `8dc05ac` (CR-01 fix: guard `diaSemana`'s
type before the dict/index lookup in both runtimes) and `6e8b58e` (WR-01 fix:
add 4 boundary-case fixtures to `shared/routine-job.testcases.json`'s
`dayMath.weeklyOccurrences` array) against the prior `28-REVIEW.md`. Both
claims were independently exercised — not just read — against the project's
actual runtimes (`uv run python3`, `bun run`), not trusted from the fixer's
commit messages or from reading the JSON fixture alone.

**CR-01 — CONFIRMED FULLY RESOLVED, PARITY VERIFIED ACROSS A WIDER INPUT
CLASS THAN THE FIX COMMIT CLAIMS.** Read the current guards at
`cli/apollo_cli/routine_job.py:346-347` (`if not isinstance(dia_semana, str):
return [], "dia_semana_invalido"`) and `web/src/lib/routineJob.ts:414-416`
(`if (typeof diaSemana !== "string") { return { skipReason:
"dia_semana_invalido" }; }`) — both correctly precede the dict/index lookup.
Independently drove `_compute_semanal_instances` directly in Python and
`computeExpectedInstances` (the public TS entry point, since
`computeSemanalInstances` itself is not exported) in TypeScript with six
distinct malformed-type classes: `list` (`["sexta"]`, the exact input that
crashed Python and silently mis-resolved in TS before the fix), `dict`,
`int`, `bool`, empty string `""`, and case/whitespace variants (`"Sexta"`,
`" sexta"`). All six report `dia_semana_invalido` in both runtimes, none
crash, none silently compute a wrong result:

```
$ uv run python3 -c "... _compute_semanal_instances(t, ...)"  # diaSemana=['sexta']
([], 'dia_semana_invalido')
$ bun run ...  # computeExpectedInstances([{...diaSemana: ['sexta']}], ...)
[{"templateId":"t1","nome":"n","reason":"dia_semana_invalido"}]
```

This closes the original crash (per-template isolation restored — the caller
never sees a `TypeError`) and the cross-runtime divergence (the `["sexta"]`
property-key-coercion case, which previously computed a plausible-but-wrong
index of 4 in TS while doing nothing wrong in Python's `.get()`, now reports
`dia_semana_invalido` identically in both). The full offline suites remain
green after the fix (`uv run pytest -m "not live and not packaging"` → 369
passed, 2 skipped; `bun test src` → 194 pass, 0 fail).

One residual gap noted below (WR-01, new number, unrelated to the closed
WR-01 from iteration 1): the fix itself has zero direct unit-test coverage in
either runtime — see the new Warning below.

**WR-01 (iteration 1) — CONFIRMED FULLY RESOLVED.** Read the current
`shared/routine-job.testcases.json` `dayMath.weeklyOccurrences` array: it now
carries 5 cases (1 original + 4 new), covering `lead == 0`
(`rangeStart`-is-target-weekday), `rangeEnd`-is-target-weekday
(inclusive-upper-bound), a reversed/empty range, and a non-`sexta` weekday
(`domingo`, index 6). Both `cli/tests/test_routine_job.py:71-78`
(`@pytest.mark.parametrize("case", FIXTURE["dayMath"]["weeklyOccurrences"],
...)`) and `web/src/lib/routineJob.test.ts:113-121` (`for (const c of
dayMath.weeklyOccurrences) { test(c.nome, ...) }`) consume the fixture
generically — no test-file code changes were needed, and none were made — so
all 5 cases run automatically in CI. Independently re-derived all 4 new
cases from scratch (not by reading the JSON's `expected` field) by calling
`weekly_occurrences`/`weeklyOccurrences` directly against the real project
code with the same inputs:

```
Python: lead0=['2026-08-14'] rangeEndTarget=['2026-08-14'] reversed=[] domingo=[8 dates...]
TS:     lead0=["2026-08-14"] rangeEndTarget=["2026-08-14"] reversed=[] domingo=[8 dates...]
```

Both runtimes agree byte-for-byte with each other and with the fixture JSON's
`expected` arrays at all four boundaries. Confirmed `2026-08-14` is in fact a
Friday (`date.weekday() == 4`) and `2026-08-09` is in fact a Sunday
(`date.weekday() == 6`), so the fixture's `nome` labels accurately describe
what each case actually exercises. `shared/routine-job.testcases.json` was
also validated as syntactically well-formed JSON. This finding is closed and
is not carried forward.

Fresh pass for anything new (per this iteration's explicit scope) turned up
one Warning (test-coverage gap on the CR-01 fix itself) and one Info item;
no new Critical issues found.

## Warnings

### WR-01: The CR-01 fix (`isinstance`/`typeof` guard on `diaSemana`) has no direct unit-test coverage in either runtime — nothing in CI would catch a regression if the guard is later removed or reordered

**File:** `cli/apollo_cli/routine_job.py:346-347`, `web/src/lib/routineJob.ts:414-416`,
`cli/tests/test_routine_job.py` (no matching test), `web/src/lib/routineJob.test.ts` (no matching test)

**Issue:** The fix that closes CR-01 is a two-line guard in each runtime, but
neither offline test suite exercises it. Searched both test files for any
case that passes a non-string, non-null `diaSemana` (malformed type) into
`_compute_semanal_instances`/`computeSemanalInstances`/
`computeExpectedInstances`: none exists. The only existing `semanal`-adjacent
coverage is:
- `dia_semana_ausente` (the `None`/`undefined` case — a different, already-guarded
  branch), tested at `cli/tests/test_routine_job.py:598-635`
  (`test_gerar_instancias_semanal_sem_dia_semana_e_skipped`, a `@pytest.mark.live`
  test), and
- `dia_semana_invalido` for an out-of-range but well-typed *string* (e.g. a
  typo'd weekday name) — not found anywhere in either test file either, so
  even the pre-existing branch of this same `if idx is None` check has no
  direct test.

Neither the new `isinstance(dia_semana, str)` (Python) nor `typeof diaSemana
!== "string"` (TS) branch is exercised by any fixture, unit test, or `@pytest.mark.live`
integration test. I confirmed by direct execution (see Summary above) that
the current code is correct for six distinct malformed-type inputs across
both runtimes — this is a coverage gap, not a live bug, consistent with how
WR-01 (iteration 1) was scoped. But it is the same class of gap that
iteration 1's WR-01 flagged for `weeklyOccurrences`, and this project's own
established convention (sibling guards like `_validate_offset_dias`, which
DOES have dedicated fixture/unit coverage for its `isinstance` check) is to
directly test defensive type guards, not rely on them being exercised
incidentally by an unrelated integration test. A future refactor of
`_compute_semanal_instances`/`computeSemanalInstances` (e.g. someone
reordering the `None`-check and the `isinstance`-check, or "simplifying" the
lookup back to a bare `.get()`/`[...]` because "the type is already
`TemplateRow.diaSemana: string`, so this can't happen") would silently
reintroduce the original crash-and-divergence bug with no test failing to
catch it.

**Fix:** Add a small parametrized case set (mirroring
`test_validate_offset_dias`-style coverage, if one exists, or a plain
`@pytest.mark.parametrize` list) exercising `_compute_semanal_instances`/
`computeSemanalInstances` directly (not through the `@pytest.mark.live` CLI
round-trip) with at least: a `list`, a `dict`/plain object, an `int`, and a
`bool` value for `diaSemana`, asserting `skip_reason ==
"dia_semana_invalido"` in both runtimes. This can live as plain unit tests
(no InstantDB round-trip needed, since these functions are pure) and would
run in the fast offline suite alongside the `weeklyOccurrences` fixture
tests.

## Info

### IN-01: `dia_semana_invalido` (out-of-range but correctly-typed string, e.g. a typo'd weekday name) also has no direct test coverage in either runtime

**File:** `cli/apollo_cli/routine_job.py:348-350`, `web/src/lib/routineJob.ts:417-419`

**Issue:** Distinct from WR-01 above (which is about the new type-guard
branch): the pre-existing `if idx is None: return [], "dia_semana_invalido"`
/ `if (idx === undefined) { return { skipReason: "dia_semana_invalido" }; }`
branch — reached when `diaSemana` is a syntactically valid string but not one
of the 7 recognized weekday tokens (e.g. `"sextaa"` or `"Monday"`) — was
already untested before this phase's changes and remains untested now. Low
priority (this branch predates phase 28's own changes and was not part of
either fixed finding), noted here only because a fresh pass surfaced it
adjacent to WR-01's gap and closing both together would be more efficient
than a separate follow-up.

**Fix:** Can be folded into the same test addition suggested in WR-01 — add
one more case with a well-typed but unrecognized string (e.g. `"invalido"`)
to the same parametrized set.

---

_Reviewed: 2026-09-22T19:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
