---
phase: 31-cadastro-em-lote
reviewed: 2026-09-22T22:40:12Z
depth: quick
files_reviewed: 5
files_reviewed_list:
  - cli/apollo_cli/batch_import.py
  - cli/apollo_cli/cli.py
  - cli/apollo_cli/routine_job.py
  - cli/apollo_cli/entities/rotina.py
  - cli/tests/test_batch_import.py
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-09-22T22:40:12Z
**Depth:** quick (pattern-matching + targeted trace of the 5 flagged risk areas)
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed `cli/apollo_cli/batch_import.py` (new BATCH-01 module), its `cli.py` wiring,
the `routine_job.py`/`entities/rotina.py` constant promotion, and
`cli/tests/test_batch_import.py`. No hardcoded secrets, dangerous functions
(`eval`/`exec`/`os.system`), debug artifacts, or empty `catch` blocks were found
via pattern scan.

**C-06 (no `instanciasRotina` creation under any input shape) holds up**:
`_validate_top_level` rejects any top-level key outside
`{"fundos", "templatesRotina"}` — including a crafted `instanciasRotina` key —
before any record from any list is processed, and the module never imports or
references the `instanciasRotina` entity type anywhere. This claim is solid.

The **transact atomicity/ambiguous-failure recovery path is also correct**: on
`(InstantAPIError, httpx.HTTPError)` after `client.transact()`, it fully
re-resolves both entity types via the same natural-key queries; if nothing is
left `to_create` it reports full `existing` (recovered), otherwise it re-raises
through `instant_errors()`. This correctly distinguishes "everything landed"
from "nothing landed," mirroring `routine_job.py`'s pattern as claimed.

However, a **critical data-integrity gap** was found in the natural-key
idempotency logic itself (focus area #2): the module checks for duplicate
`_local_id` values across the batch, but never checks for duplicate **natural
keys** (`fundos.codigo`, or `templatesRotina`'s `(resolvedFundoId, nome)`)
among records that are *both new in the same file*. Two records sharing a
codigo/name that doesn't yet exist in the DB will both be assigned fresh ids
and both land in the same `transact()` call — creating two rows with an
identical natural key in a single invocation. This is exactly the defect
class BATCH-01 exists to prevent, and it is untested (no test in
`test_batch_import.py` exercises two same-batch records sharing a natural
key).

A secondary gap (focus area #4) was found in reference-field validation:
`fundoId`/`antecessorId` values that are non-string (e.g. an int) or an empty
string silently bypass `_check_references` (which only inspects string
values) and are not rejected by `_check_fundo_form`/`_check_template_form`
either. For `fundoId` specifically this can reach a live `client.query()`
with a malformed filter value, or build a transact link to an empty-string
id — surfacing as a raw API error instead of the clean, exit-2 validation
error the module's docstring promises. For `antecessorId` the same
malformed-type value is silently dropped (no link built, no error raised),
so a bad row imports successfully with its intended chain link quietly
missing.

## Critical Issues

### CR-01: Duplicate natural keys within one batch file are not detected — creates genuine duplicate rows

**File:** `cli/apollo_cli/batch_import.py:211-230, 345-386, 400-505`
**Issue:** `_check_local_id_uniqueness` (lines 211-230) only checks that
`_local_id` values are unique across the file. There is no equivalent check
for `fundos.codigo` uniqueness among fundo records, nor for
`templatesRotina`'s `(resolvedFundoId, nome)` uniqueness among template
records.

Trace: in `_resolve_fundos` (lines 345-386), `existing_by_codigo` is built
from one DB query keyed by `codigo`. The per-record loop (lines 367-384) then
independently checks `existing_by_codigo.get(codigo)` for *each* record — it
never checks whether an earlier record *in the same batch* already claimed
that codigo. If two records share a codigo that is not yet in the DB, both
independently get `eid = new_id()` and both are appended to `to_create`
(lines 375-384). Both then land via the single `client.transact()` call in
`run_batch_import` (lines 584-600), producing two `fundos` rows with an
identical `(donoId, codigo)` natural key — the exact violation D-05's
idempotency contract is meant to prevent.

The identical defect exists in `_resolve_templates` (lines 400-505):
`existing_by_key` (lines 419, 439, 456) is populated only from DB query
results, and the per-record creation loop (lines 463-486) checks
`existing_by_key.get(key)` per record with no in-batch collision check
against sibling records also being newly created in the same pass. Two
templates sharing `(resolvedFundoId, nome)` that don't yet exist in the DB
will both be created.

This is silent — no error, no exit code, no report entry distinguishes it —
and it directly undermines the ROADMAP SC2 idempotency guarantee the whole
feature exists to provide (a re-run after this bug would then non-deterministically
report one of the two duplicate rows as "existing," permanently masking the
duplication). It is a realistic authoring mistake (e.g., copy-paste error
producing two records with the same `codigo` but different `_local_id`s), not
just an adversarial edge case, and `test_batch_import.py` has no coverage for
it (confirmed: no `codigo_duplicado`/`nome_duplicado`-style reason code or
test exists anywhere in the module or test file).

**Fix:** Add an in-batch natural-key uniqueness pass, mirroring
`_check_local_id_uniqueness`'s "one error per occurrence" design, before
resolution runs:
```python
def _check_fundo_codigo_uniqueness(fundos: list[Any]) -> list[dict[str, Any]]:
    occurrences: dict[str, list[int]] = defaultdict(list)
    for index, record in enumerate(fundos):
        if isinstance(record, dict) and isinstance(record.get("codigo"), str):
            occurrences[record["codigo"]].append(index)
    errors: list[dict[str, Any]] = []
    for codigo, indices in occurrences.items():
        if len(indices) > 1:
            for index in indices:
                local_id = _local_id_of(fundos[index])
                errors.append(_error(_ETYPE_FUNDO, index, local_id, "codigo_duplicado_no_lote"))
    return errors
```
And an analogous `_check_template_natural_key_uniqueness` keyed on
`(fundoId-as-written, nome)` — note this must run in the form-validation pass
(before `$local_id` resolution), so key it on the raw `fundoId` field value
as written (string or `$ref` or absent) rather than the resolved real id,
since resolution hasn't happened yet at that point in the pipeline; a
sibling-referencing-the-same-$local_id case still collides correctly since
both records reference the identical raw value.

## Warnings

### WR-01: `fundoId`/`antecessorId` reference fields accept any type, bypassing the "reject with clean per-record error" contract

**File:** `cli/apollo_cli/batch_import.py:96-105, 233-281, 389-397, 497-502`
**Issue:** `_check_template_form` (lines 166-208) never validates the type of
`fundoId`/`antecessorId`. `_check_references` (lines 233-281) delegates to
`_reference_value_kind` (lines 96-105), which returns `None` — silently
treated as "field absent, nothing to check" — for any non-string or
empty-string value, per its own docstring ("defensive... this pass never
raises on it"). That means a `fundoId: 123` or `fundoId: ""` record passes
validation with zero errors.

Downstream, `_resolved_fundo_id` (lines 389-397) does *not* apply the same
"only strings count" guard: `fund_id_value` (`123` or `""`) is returned
as-is whenever it isn't a `$`-prefixed string. That value is then used
directly as a live query filter (`"fundo.id": fundo_id` in
`_resolve_templates`, lines 421-430) and, if the record ends up in
`to_create`, as a transact link target (`links["fundo"] = fundo_id`, line
496) — an int or empty string sent to InstantDB as a link id. This will
surface as a raw `InstantAPIError`/network error (exit 3/4, generic API
error JSON) instead of the specific, clean `fundo_id_...` validation error
(exit 2) the module's whole design promises, and it happens even under
`--dry-run` since `_resolve_templates` runs before the `dry_run` check.

`antecessorId` with the same malformed types takes a different, quieter
path: the second-pass link-builder (lines 497-502) guards with
`isinstance(antecessor_value, str) and antecessor_value`, so a non-string
`antecessorId` is simply dropped — the record is created successfully but
silently loses its intended antecessor chain link, with no error reported
anywhere.

**Fix:** Validate the type in the form-check pass, and have
`_reference_value_kind` distinguish "absent" from "present but malformed":
```python
if "fundoId" in record and record["fundoId"] is not None:
    if not isinstance(record["fundoId"], str) or not record["fundoId"]:
        errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "fundo_id_invalido"))
```
and the same for `antecessorId`, so a malformed reference is caught in the
same zero-write validation pass as every other field, instead of reaching a
live query or silently vanishing.

### WR-02: `run_batch_import` lets an unhandled `OSError` escape on file read

**File:** `cli/apollo_cli/batch_import.py:533-536`
**Issue:** `path.read_text(encoding="utf-8")` is wrapped only in a
`try/except UnicodeDecodeError`. Click's `click.Path(exists=True,
dir_okay=False)` (in `cli.py:78`) validates existence at option-parsing time,
but between that check and the actual read (however small the window,
including e.g. permission changes or the file being removed by another
process/script) any other `OSError` (`PermissionError`,
`FileNotFoundError`, `IsADirectoryError` if a symlink swap occurs) propagates
as an unhandled Python traceback instead of this module's otherwise
consistent clean-JSON-and-exit-code contract used everywhere else in the
file.
**Fix:** Broaden the except clause and emit a matching validation error:
```python
try:
    raw = path.read_text(encoding="utf-8")
except UnicodeDecodeError:
    _emit_validation_errors([_error("_arquivo", None, None, "arquivo_nao_e_utf8")])
except OSError:
    _emit_validation_errors([_error("_arquivo", None, None, "arquivo_nao_pode_ser_lido")])
```

## Info

### IN-01: No file-size guard on `--from-json` input

**File:** `cli/apollo_cli/batch_import.py:534, 539`
**Issue:** `path.read_text()` followed by `json.loads()` loads the entire
file into memory with no size cap. For this single-user local CLI the
severity is low (as the task brief itself notes), but an accidentally
pointed-at huge file (e.g. a wrong path landing on a large unrelated JSON
export) would load fully before any validation feedback, rather than failing
fast with a size-limit error.
**Fix:** Optional — a `path.stat().st_size` guard with a generous ceiling
(e.g. 10MB) before reading, if this is ever expected to run against
untrusted or accidentally-mis-pointed input.

### IN-02: `_check_references`' `get_entity` calls happen once per template record, not batched

**File:** `cli/apollo_cli/batch_import.py:261, 277`
**Issue:** For every template record with a bare/real (non-`$`) `fundoId` or
`antecessorId`, `_check_references` issues one `get_entity` query each
(lines 261, 277) — N live queries for N bare references, versus the batched
`$in` query pattern already used in `_resolve_fundos`/`_resolve_templates`.
Out of scope for this review (performance, not correctness), but worth
flagging since a real onboarding batch is likely to mix a handful of
already-existing bare `fundoId` references with new records, and this is
the same call shape the module deliberately avoided elsewhere.
**Fix:** Not required for this review (performance, out of v1 scope); note
for a future pass if bare-reference volume grows.

---

_Reviewed: 2026-09-22T22:40:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
