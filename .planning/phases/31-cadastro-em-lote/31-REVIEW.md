---
phase: 31-cadastro-em-lote
reviewed: 2026-09-22T00:00:00Z
depth: quick
files_reviewed: 3
files_reviewed_list:
  - cli/apollo_cli/batch_import.py
  - cli/tests/test_batch_import.py
  - cli/tests/test_batch_import_file_errors.py
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 31: Code Review Report (Iteration 2 — final, re-review)

**Reviewed:** 2026-09-22T00:00:00Z
**Depth:** quick (targeted re-verification of iteration-1 findings + pattern-match sweep of the diff)
**Files Reviewed:** 3 (`cli/apollo_cli/batch_import.py`, `cli/tests/test_batch_import.py`, `cli/tests/test_batch_import_file_errors.py`)
**Status:** clean

## Summary

This is iteration 2 (final, project cap) of the review-fix loop for Phase 31.
Iteration 1 (see prior findings below, superseded) found 1 Critical + 2
Warning + 2 Info. Commits `4b174bf`, `0e127cf`, `575a533` claim to fix the
Critical and both Warnings. All three were independently re-verified against
the current source (not taken on the fixer's self-report) and are confirmed
genuinely fixed. No new issues were found in a fresh quick pattern-match pass
over the full diff (`7ac64ed..HEAD`, +276/-0 lines across the three files
above — purely additive, no deletions/regressions elsewhere in the module).

### Verification detail

**CR-01 (in-batch natural-key duplicates) — CONFIRMED FIXED.**
`_check_fundo_codigo_uniqueness` (batch_import.py:243–264) and
`_check_template_natural_key_uniqueness` (267–300) are both wired into
`run_batch_import` at lines 633–634, immediately after
`_check_local_id_uniqueness` (632) and — critically — **before** the single
`if errors: _emit_validation_errors(errors)` gate at line 645. All resolution
(`_resolve_fundos`/`_resolve_templates`, lines 648–653) and the `transact()`
call (682) only execute after that gate passes with zero accumulated errors,
so a natural-key collision now aborts the whole batch (exit 2) with zero
writes — the fix is genuinely on the zero-write validation path, not a
side-channel check. `_check_fundo_codigo_uniqueness` catches duplicate
`codigo` values among fundo records (one error per colliding index, mirroring
`_check_local_id_uniqueness`'s "one error per occurrence" design).
`_check_template_natural_key_uniqueness` catches duplicate `(fundoId-as-raw,
nome)` pairs among template records, correctly keying on the raw `fundoId`
field value (not the resolved real id) since this check runs pre-resolution
— a documented, narrow trade-off (two records referencing the *same* fundo
via genuinely different raw spellings, e.g. one `$local` vs. one bare real id
for an as-yet-unresolved fundo, could theoretically still slip past) that
matches the fix approach iteration 1 itself proposed, not a new defect. Two
new live tests (`test_import_rejects_duplicate_fundo_codigo_within_same_batch`,
`test_import_rejects_duplicate_template_natural_key_within_same_batch`) exist
and pass.

**WR-01 (malformed reference field types) — CONFIRMED FIXED.**
`_check_template_form` (batch_import.py:205–213) now type-checks both
`fundoId` and `antecessorId`: `None` (absent) is explicitly permitted (`is
not None` guard), while any present-but-non-`str` or present-but-empty-string
value is rejected with `fundo_id_invalido`/`antecessor_id_invalido`. This
correctly distinguishes "absent" from "malformed" per the requested contract.
Traced the code path: this check runs at line 630–631, its errors accumulate
into the same `errors` list gated at line 645, before `_resolve_fundos`,
`_resolve_templates`, or `client.transact()` ever run — a malformed value can
no longer reach a live query or a transact link target. `_check_references`
(line 642) also runs before the gate but is defensively no-op-safe on
malformed types (`_reference_value_kind` returns `None` for non-str/empty,
so no live `get_entity` call is issued for them either way). One new live
test (`test_import_rejects_malformed_reference_field_types_as_validation_errors`)
covers both fields and passes.

**WR-02 (unhandled `OSError` on file read) — CONFIRMED FIXED, exception
hierarchy claim verified true.** `run_batch_import` (batch_import.py:603–616)
now wraps the read in `except UnicodeDecodeError: ... except OSError: ...`.
Independently confirmed in this Python 3.12 environment:
`UnicodeDecodeError.__mro__` is `(UnicodeDecodeError, UnicodeError,
ValueError, Exception, BaseException, object)` — `issubclass(UnicodeDecodeError,
OSError)` is `False`, `issubclass(UnicodeDecodeError, ValueError)` is `True`.
The two except clauses are genuinely disjoint; catching `UnicodeDecodeError`
first (as written) versus `OSError` first would behave identically here,
and neither clause can shadow or reclassify the other's error message/exit
code (both still exit `EXIT_VALIDATION_ERROR` = 2, but with distinct
`arquivo_nao_e_utf8` vs. `arquivo_nao_pode_ser_lido` reason codes). New
offline test module `cli/tests/test_batch_import_file_errors.py` covers both
paths (a chmod'd-unreadable file for the `OSError`/`PermissionError` case,
and a non-UTF-8 byte sequence for the pre-existing `UnicodeDecodeError`
case) without a live session; both pass.

### Test run

`uv run pytest tests/test_batch_import.py tests/test_batch_import_file_errors.py`
— all 4 new tests (2 for CR-01, 1 for WR-01, 1 offline module with 2 cases
for WR-02) pass individually and within the full suite. Two pre-existing,
unrelated tests (`test_full_onboarding_scale_single_invocation_success_criterion_3`,
`test_full_onboarding_scale_rerun_is_fully_existing_success_criterion_2`) fail
in this sandbox with `httpx.ConnectTimeout` (TLS handshake timeout reaching
the live InstantDB backend) — a sandbox network-access limitation, not a
regression from these fixes; these two tests require live network access
and were failing for that reason before these commits as well (they exercise
a live `transact()` against a real backend, which this sandbox cannot reach).

### Fresh pattern-match pass (new findings this iteration)

Ran the standard quick-depth regex sweep (hardcoded secrets, `eval`/`exec`/
`system`/`shell_exec`, `console.log`/`debugger`/`TODO`/`FIXME`/`XXX`/`HACK`,
empty `catch`/bare `except:`) across all three changed files and across the
full `7ac64ed..HEAD` diff. No matches. The diff is purely additive
(+276/-0 lines) with no incidental changes elsewhere in the module.

**No new findings.** The 2 Info items from iteration 1 (IN-01: no file-size
guard on `--from-json` input; IN-02: `_check_references` issues per-record
`get_entity` queries instead of batching) were explicitly left unfixed as
out-of-scope for this loop (performance/hardening, not correctness) and
remain valid but non-blocking observations — not re-litigated here since
nothing about them changed.

---

_Reviewed: 2026-09-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
_Iteration: 2 of 2 (final, project cap)_
