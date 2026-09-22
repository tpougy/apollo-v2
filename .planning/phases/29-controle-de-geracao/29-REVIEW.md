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
  critical: 1
  warning: 0
  info: 1
  total: 2
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-09-22T00:00:00Z
**Depth:** quick (pattern-matching + targeted reproduction of the specific risk classes called out for this pass)
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the RANGE-01 `--competencia`/`--de`/`--ate` range-override feature added to `apollo rotina gerar-instancias`. The core date-math generalization (`months_in_range`/`monthsInRange`) and its TS/Python parity are byte-for-byte identical (diffed both commits directly) and correctly return `[]` for a reversed or degenerate range without looping — no bug there. The CLI's XOR/mutex validation in `_resolve_range_override` was directly exercised for all eight flag combinations (`--competencia` alone, `--de` alone, `--ate` alone, `--competencia`+`--de`, `--competencia`+`--ate`, reversed `--de`/`--ate`, all-omitted, valid `--de`/`--ate`) and every invalid combination correctly raises `click.UsageError` before any network call — no gap there either.

However, targeted reproduction of the "unguarded type/None handling on CLI input flowing into pure compute functions" risk class surfaced one real, reproducible defect: `--competencia`'s format validator accepts a year of `0000` (and generally never bounds-checks the year the way `--de`/`--ate`'s `validate_iso_date` does via `date.fromisoformat`), and that out-of-bounds year flows unguarded into the pure compute core, where it produces two different bad outcomes depending on template type — one silent data-corruption path and one uncaught crash that breaks the job's per-template isolation guarantee. See CR-01.

## Critical Issues

### CR-01: `--competencia` accepts an out-of-range year that either silently writes garbage rows or crashes the whole job, breaking per-template isolation

**File:** `cli/apollo_cli/entities/rotina.py:96-114` (`_validate_competencia_format`)
**File:** `cli/apollo_cli/routine_job.py:369-385` (`weekly_occurrences`), `cli/apollo_cli/routine_job.py:555-609` (per-template try/except that is supposed to isolate exactly this class of failure)

**Issue:**

`_validate_competencia_format` only checks the shape `\d{4}-\d{2}` and that the month is `1..12`. Unlike `--de`/`--ate`/`--data-base`, which are validated via `crud_helpers.validate_iso_date` (which calls `date.fromisoformat` and therefore rejects any year outside Python's `MINYEAR..MAXYEAR` bound, e.g. year `0000`), `--competencia` never constructs a real `date` object, so `--competencia 0000-08` passes CLI validation and `_resolve_range_override` happily returns `("0000-08-01", "0000-08-31")` as the `range_override` tuple. This was verified directly:

```
_validate_competencia_format(None, None, "0000-08") -> "0000-08"
_resolve_range_override("0000-08", None, None) -> ("0000-08-01", "0000-08-31")
```

That malformed range then flows, completely unguarded, into `compute_expected_instances`. Two distinct failure modes were reproduced live against the actual functions:

1. **Silent data corruption (`corrido_fixo` templates).** `nth_calendar_day_of_month` uses only `calendar.monthrange`, which does not validate the year at all (`calendar.monthrange(0, 8)` returns `(5, 31)` without error). The result is a **real, successfully computed instance** — `dataPrevista: "0000-08-10"`, `competencia: "0000-08"` — that sails straight through the diff step and would be written to production InstantDB via the normal `client.transact(chunks)` path on a live `gerar-instancias` run. Reproduced:
   ```
   compute_expected_instances([corrido_fixo template], "2026-08-09", [], range_override=("0000-08-01","0000-08-31"))
   -> ComputeResult(expected=[{'dedupeKey': 'tpl-corrido_fixo:0000-08:0000-08-10', ..., 'dataPrevista': '0000-08-10', ...}], skipped=[])
   ```

2. **Uncaught crash, breaking per-template isolation (`semanal` templates).** `weekly_occurrences` calls `date.fromisoformat(range_start)` directly (no try/except of its own). For year `0000` this raises `ValueError: year 0 is out of range`. The per-template `try/except (CalendarRangeError, InvalidDateError):` block in `compute_expected_instances` (lines ~594-609) — whose entire documented purpose is "any underlying error ... is caught here so one misconfigured/out-of-range template never aborts the others" (RESEARCH Pitfall 4) — does **not** catch plain `ValueError`. The exception propagates all the way out of `compute_expected_instances`, `run_routine_instance_job`, and the `gerar_instancias` Click command, crashing the entire `apollo rotina gerar-instancias` invocation with an unhandled traceback instead of either a clean exit-code-2 validation error or a per-template `skipped` entry — and taking down every *other* template's generation in that same run, not just the misconfigured one. Reproduced:
   ```
   compute_expected_instances([semanal template], "2026-08-09", [], range_override=("0000-08-01","0000-08-31"))
   -> CRASHED: ValueError year 0 is out of range
   ```

For contrast, `du_fixo` templates are unaffected because `add_business_days`/`is_business_day` raise the vendored calendar's `CalendarRangeError`, which the existing except clause *does* catch (confirmed: cleanly skipped as `offset_dias_invalido`, mislabeled but harmless).

This is a genuine, CLI-reachable gap: a plausible fat-finger (e.g. typing `--competencia 0000-08` instead of `--competencia 2026-08` after an editing mistake) either silently corrupts production data with a nonsensical `competencia`/`dataPrevista` (worse than a crash) or crashes the whole batch depending purely on which `tipoGeracao` happens to be active — neither of which matches the documented contract ("Every invalid ... AAAA-MM ... exits 2 with zero query/write executed", D4 in `29-01-SUMMARY.md`).

**Fix:**

Primary fix — close the gap at the CLI validation boundary, mirroring how `validate_iso_date` bounds-checks via real `date` construction:

```python
def _validate_competencia_format(
    ctx: click.Context, param: click.Parameter, value: str | None
) -> str | None:
    if value is None:
        return None
    if not _COMPETENCIA_RE.match(value):
        msg = f"{value!r} nao esta no formato AAAA-MM"
        raise click.BadParameter(msg, ctx=ctx, param=param)
    year = int(value.split("-")[0])
    month = int(value.split("-")[1])
    if not (1 <= month <= 12):
        msg = f"{value!r} tem mes invalido (deve ser 01..12)"
        raise click.BadParameter(msg, ctx=ctx, param=param)
    try:
        date(year, month, 1)  # bounds-checks year against MINYEAR..MAXYEAR too
    except ValueError as error:
        msg = f"{value!r} tem ano invalido"
        raise click.BadParameter(msg, ctx=ctx, param=param) from error
    return value
```

(Requires `from datetime import date` already available via a small import addition to `rotina.py`, or reuse `apollo_cli.crud_helpers.validate_iso_date`'s underlying pattern.)

Defense-in-depth (recommended in addition, since `compute_expected_instances`/`weekly_occurrences` are public pure functions any future caller — including a prospective SPA surface per D-07/D-08 — could invoke directly with unvalidated data): broaden the per-template isolation catch in `compute_expected_instances` (both the `du_fixo`/`corrido_fixo`/`semanal` dispatch block and the `encadeado` sweep) to also catch `ValueError`, or have `weekly_occurrences` validate its own inputs and raise `InvalidDateError` instead of leaking a raw `ValueError` from `date.fromisoformat`.

## Info

### IN-01: Same unguarded-year gap exists in the TS mirror, currently unreachable but latent

**File:** `web/src/lib/routineJob.ts:432-450` (`weeklyOccurrences`), `web/src/lib/routineJob.ts:315-339` (`monthsInRange`)

**Issue:** `weeklyOccurrences`'s `parseUtcDateJob` builds a `Date` via `new Date(\`${iso}T00:00:00.000Z\`)` with no bounds validation — passing a year like `"0000"` produces an `Invalid Date` (JS `Date` doesn't throw, it silently becomes `NaN`), which is actually a *different* failure mode than Python's `ValueError` (no crash, but every downstream comparison against `Invalid Date` behaves unpredictably — e.g. `cursor <= end` involving `NaN` is always `false`). Today this is dead code from the CLI's perspective since `web/`'s `computeExpectedInstances` has no caller that ever supplies `rangeOverride` (D-07/D-08 — no SPA surface for `gerar-instancias` yet). No user-facing impact currently.

**Fix:** When (D-07/D-08's noted future milestone) a SPA surface is wired to supply `rangeOverride` directly, apply the equivalent bounds validation on the TS side before this becomes reachable — e.g. validate the parsed year in `parseUtcDateJob` (or upstream, wherever the range is first accepted from user input) and reject/throw for `NaN`/out-of-range years, so the eventual TS caller doesn't inherit CR-01's Python-side gap in a silently-different (NaN-propagation rather than crash) form.

---

_Reviewed: 2026-09-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
