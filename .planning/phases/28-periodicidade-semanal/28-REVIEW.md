---
phase: 28-periodicidade-semanal
reviewed: 2026-09-22T18:55:33Z
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
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-09-22T18:55:33Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the union of `key-files` from `28-01-SUMMARY.md`/`28-02-SUMMARY.md`/`28-03-SUMMARY.md`
(schema push, Python compute engine + CLI, TypeScript mirror + shared fixture, SPA form + e2e
repair) plus `web/e2e/entities-form-restyle.spec.ts` (grep-checked, no separate read needed — its
one `semanal`-related change is a single-line `sort()` assertion, verified via grep). All 9 files
that carry executable phase-28 logic were read in full; `.planning/config.json` (a planning
artifact, excluded from scope by policy) was not reviewed.

The additive-only constraint holds: a targeted `git diff` of `cli/apollo_cli/routine_job.py` and
`web/src/lib/routineJob.ts` against the pre-phase-28 commit (`146642b~1`), filtered to lines that
do NOT mention `semanal`/`diaSemana`/`weekly`, shows only expected import-list and docstring
churn — the `du_fixo`, `corrido_fixo`, and `encadeado` dispatch branches and their compute
functions are byte-for-byte untouched. The full offline suite (`uv run pytest -m "not live and
not packaging"` — 365 passed, 2 skipped; `bun test src/lib/routineJob.test.ts
src/lib/entities/registry.test.ts` — 107 pass) is green.

The weekly-enumeration date-cursor logic (`weekly_occurrences`/`weeklyOccurrences`) was directly
exercised (not just read) against both runtimes at the range boundaries the task called out:
`range_start` itself equal to the target weekday (lead = 0), `range_end` itself equal to the last
occurrence, a reversed/empty range, and a non-`sexta` weekday index (`domingo` = 6). All four cases
produced byte-identical output in Python and TypeScript. **The implementation itself is correct at
every boundary tested** — but see WR-01 below: the shared fixture that is supposed to prove this
in CI carries only a single, non-boundary case.

The one finding that matters here is a genuine crash bug (CR-01): the new
`_compute_semanal_instances` performs an unguarded `dict.get()` keyed directly by the raw,
DB-sourced `diaSemana` value, unlike the pre-existing `_validate_offset_dias`, which always
type-checks before using untrusted input. A malformed `diaSemana` (any unhashable value — a list
or dict, which InstantDB's JS/Python client SDKs can both round-trip for a JSON-typed link/array
field, or which a raw admin-token write could produce, or which a future upstream migration bug
could introduce) raises an uncaught `TypeError` that is NOT one of the two exception types this
same function's caller already catches — crashing the ENTIRE `gerar-instancias` run for that
`donoId`, not just skipping the one malformed template, directly contradicting this module's own
explicitly documented "per-template isolation" guarantee. The TypeScript twin does not share this
bug (property-key coercion means `DIA_SEMANA_INDEX[diaSemana]` never throws for any object type),
which makes this simultaneously a robustness bug AND a genuine Python/TypeScript behavioral
divergence for the same malformed input — exactly the parity-bug class this project has hit
before (Phase 27's Unicode-normalization gap).

## Critical Issues

### CR-01: `_compute_semanal_instances` crashes the entire job run (not just the one template) on a malformed, unhashable `diaSemana` value — and diverges from the TypeScript twin's behavior on the same input

**File:** `cli/apollo_cli/routine_job.py:343-348`

**Issue:** `_compute_semanal_instances` reads `diaSemana` straight off the live-queried template
row and keys a dict lookup with it directly:

```python
dia_semana = template.get("diaSemana")
if dia_semana is None:
    return [], "dia_semana_ausente"
idx = _DIA_SEMANA_INDEX.get(dia_semana)   # <-- unguarded dict.get(key=dia_semana)
if idx is None:
    return [], "dia_semana_invalido"
```

`dict.get()` requires its key argument to be hashable. If `dia_semana` is anything unhashable
(a `list` or `dict` — plausible for a corrupted row, a raw admin-token write that bypasses the
CLI's `click.Choice`/the SPA's `select` field, or any future write path that doesn't go through
either of today's two validated entry points), this raises `TypeError: unhashable type: 'list'`
— reproduced directly against the real function:

```
$ uv run python3 -c "
from apollo_cli.routine_job import _compute_semanal_instances
t = {'id':'x','nome':'n','regraCompetencia':'M0','diaSemana': ['sexta']}
_compute_semanal_instances(t, '2026-08-09', '2026-09-30')"
TypeError: unhashable type: 'list'
```

The caller, `compute_expected_instances` (`cli/apollo_cli/routine_job.py:495-535`), wraps the
`semanal` dispatch call in the SAME `try/except (CalendarRangeError, InvalidDateError):` block
used for `du_fixo`/`corrido_fixo` — a `TypeError` is not one of those two types, so it is NOT
caught. It propagates out of `compute_expected_instances`, out of `run_routine_instance_job`, and
— since `cli/apollo_cli/cli.py` installs no top-level exception handler around the Click command
tree — out of the `apollo rotina gerar-instancias` CLI command itself, printing a raw Python
traceback and exiting non-zero. Because `compute_expected_instances` raises before it ever
`return`s, **zero instances are computed or written for ANY template belonging to that owner in
that run** — not just the one with the bad `diaSemana`. This directly contradicts the function's
own module docstring and inline comment, which state the per-template `try/except` exists
specifically so "one misconfigured/out-of-range template never aborts the others" (RESEARCH
Pitfall 4) — a guarantee that already holds correctly for `offsetDias` via
`_validate_offset_dias`'s defensive `isinstance()` check, but was not extended to the new
`diaSemana` lookup.

Confirmed this is Python-only: the TypeScript twin's equivalent lookup,
`DIA_SEMANA_INDEX[diaSemana]` (`web/src/lib/routineJob.ts:414`), is a JS property access, which
silently coerces any object key to a string via `String(...)` rather than throwing — verified
directly against the real function with the same malformed shape (a plain object in place of a
string): it returns `{ skipReason: "dia_semana_invalido" }` cleanly, no crash. So the same
malformed input produces a full job-run crash in Python and a clean, isolated per-template skip
in TypeScript — a genuine cross-runtime behavioral divergence for this new field, the exact bug
class (subtle TS/Python mismatch on the new `semanal` code path) this review was specifically
asked to check for.

**Fix:** Type-check before using `diaSemana` as a dict key, mirroring `_validate_offset_dias`'s
existing defensive pattern:

```python
dia_semana = template.get("diaSemana")
if dia_semana is None:
    return [], "dia_semana_ausente"
if not isinstance(dia_semana, str):
    return [], "dia_semana_invalido"
idx = _DIA_SEMANA_INDEX.get(dia_semana)
if idx is None:
    return [], "dia_semana_invalido"
```

This closes both problems at once: it restores per-template isolation (a malformed row is now
skipped, not job-fatal) and restores TS/Python parity (both runtimes now report
`dia_semana_invalido` for the same non-string input instead of one crashing).

## Warnings

### WR-01: `shared/routine-job.testcases.json`'s `dayMath.weeklyOccurrences` fixture carries only one, non-boundary case — the cross-runtime parity fixture does not actually exercise the boundary conditions this feature's own docstrings call "the one parity-critical conversion in this whole feature"

**File:** `shared/routine-job.testcases.json` (the `dayMath.weeklyOccurrences` array),
`cli/tests/test_routine_job.py:71-78`, `web/src/lib/routineJob.test.ts:113-118`

**Issue:** The single shared fixture case (`"sexta-feira, range agosto-setembro 2026 (caso real
Atualiz Calc RF)"`, `rangeStart: "2026-08-09"` which is a Sunday, `rangeEnd: "2026-09-30"` which is
a Wednesday) is the only input both `test_weekly_occurrences` (Python) and the `weeklyOccurrences`
describe block (TypeScript) exercise — both test files consume the fixture directly and add no
independent cases of their own. Neither `rangeStart` nor `rangeEnd` in that one case coincides
with the target weekday (`sexta`), so the fixture never proves:
- `rangeStart` itself IS the target weekday (the `lead == 0` branch of the cursor arithmetic),
- `rangeEnd` itself IS the last occurrence date (the inclusive-upper-bound branch of `cursor <=
  end` / `cursor <= rangeEnd`),
- a reversed/empty range (`rangeStart > rangeEnd`),
- any weekday index other than `sexta` (index 4) — in particular `domingo` (index 6), the value
  that would surface an off-by-one in the `(idx - weekday) % 7` vs. `(idx - weekday + 7) % 7`
  Python/TS modulo-sign handling this module's own docstring calls out as "the one
  parity-critical conversion in this whole feature."

I directly verified the implementation is correct at all four of these boundaries (Python and
TypeScript agree byte-for-byte on `lead == 0`, `rangeEnd`-inclusive, reversed-range, and
`domingo`-index cases) — this is a test-coverage gap, not a live bug. But it is a real gap
relative to this project's own established convention: sibling date-math fixtures
(`nthBusinessDayOfMonth`, `nthCalendarDayOfMonth`, `shiftCompetencia`) each carry multiple cases
specifically targeting boundary/edge behavior, and `27-REVIEW.md`'s WR-01/WR-02 history in this
same codebase shows boundary-condition test gaps in this exact function family have previously
hidden real parity bugs. A future refactor of the cursor arithmetic has nothing in CI to catch a
regression at exactly the boundaries this feature's own docstring flags as the risky part.

**Fix:** Add 3-4 more cases to `shared/routine-job.testcases.json`'s `dayMath.weeklyOccurrences`
array (consumed automatically by both offline suites, no test-file code change needed): a
`rangeStart`-is-target-weekday case, a `rangeEnd`-is-target-weekday case, a reversed/empty-range
case (`expected: []`), and at least one non-`sexta` weekday (e.g. `domingo`, to exercise index 6
specifically).

## Info

### IN-01: The shared `except (CalendarRangeError, InvalidDateError):` block mislabels a hypothetical `semanal` failure as `"offset_dias_invalido"`, an offset-specific reason that is meaningless for a type with no offset

**File:** `cli/apollo_cli/routine_job.py:495-535` (and the mirrored `try`/`catch` in
`web/src/lib/routineJob.ts:575-625`)

**Issue:** `du_fixo`, `corrido_fixo`, and now `semanal` all dispatch inside the same
`try: ... except (CalendarRangeError, InvalidDateError): ... skipped.append({..., "reason":
"offset_dias_invalido"})` block. For `du_fixo`/`corrido_fixo` this reason is accurate — those
exceptions can only originate from an out-of-range offset pushing a date past the vendored
calendar's bounds. For `semanal`, `_compute_semanal_instances` never reads `offsetDias` at all
(documented explicitly in this function's own docstring), and neither `weekly_occurrences` nor
`shift_competencia` raises `CalendarRangeError`/`InvalidDateError` for any input this codebase can
currently produce (both operate on internally-generated, always-valid `range_start`/`range_end`
ISO strings) — so this path is presently unreachable dead code for `semanal`, but if it ever did
fire (e.g. a future change makes `weekly_occurrences` calendar-bounds-aware), the emitted
`"offset_dias_invalido"` skip reason would misdirect anyone debugging a `semanal` template that
has no `offsetDias` concept at all.

**Fix:** Either give `semanal` its own dedicated `except` clause with a more accurate reason (e.g.
a new `"dia_semana_fora_do_calendario"`-style `SkipReason`), or add a one-line comment at the
`except` block noting the reason label is offset-specific and technically inaccurate for the
`semanal` branch, which is presently unreachable there. Low priority — no live impact today.

---

_Reviewed: 2026-09-22T18:55:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
