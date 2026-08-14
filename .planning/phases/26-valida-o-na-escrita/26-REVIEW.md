---
phase: 26-valida-o-na-escrita
reviewed: 2026-08-14T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - cli/apollo_cli/entities/rotina.py
  - docs/ai-usage/CLAUDE.md
  - cli/tests/test_crud_rotina_template.py
  - cli/tests/test_rotina_instancia.py
  - web/e2e/focus-dialog-fundo.spec.ts
  - web/e2e/focus-dialog-button-inventory.spec.ts
  - web/e2e/focus-dialog-dia-rotina.spec.ts
  - web/e2e/dashboard.spec.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-08-14
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 26 Plan 01 ("Validação na escrita") binds `type=click.Choice(REGRAS_COMPETENCIA_SUPORTADAS)` to `apollo rotina template criar`/`editar --regra-competencia`, corrects the `--propagar-atraso-soft` help text and `instancia status`'s `dedupeKey` docstring, and repairs every pre-existing CLI/e2e fixture that used a now-invalid placeholder `regraCompetencia` value. I traced the actual runtime behavior (not just the diff) by running the built CLI directly against the live app: `criar --regra-competencia bogus` does reject at exit 2 immediately, before any write, exactly as claimed; `criar --regra-competencia M-1` / `M+1` do succeed (verified live, then cleaned up the two throwaway records). The core VAL-01/VAL-02/VAL-03 fix is real and functionally correct. `ruff check` is clean on the touched Python files, and no stale placeholder `regraCompetencia` values remain in any of the touched fixture files.

No BLOCKER-level defects were found — no crash path, no injection/security issue, no data-loss risk, and no incorrect write behavior. The two WARNING findings below are both about the fix's own documentation/test-coverage completeness, which matters here specifically because this phase's stated purpose (VAL-01) is "the CLI itself must reject it at write time, not silently rely on a downstream job" — and the current `--help` text for the very option this phase changed still frames enforcement as happening downstream.

## Warnings

### WR-01: `--regra-competencia` help text still attributes enforcement to `gerar-instancias`, not to the command's own `click.Choice` binding it just gained

**File:** `cli/apollo_cli/entities/rotina.py:134-139` (`template.criar`) and `cli/apollo_cli/entities/rotina.py:222-226` (`template.editar`)

**Issue:** The rewritten help text reads:

> "Which competencia (reference month) rule applies to generated instances of this template. Enforced by `apollo rotina gerar-instancias`; see `apollo_cli.routine_job.shift_competencia`."

This is exactly what `--help` prints today (verified live: `apollo rotina template criar --help`). It attributes enforcement solely to the downstream `gerar-instancias` job. But the actual, primary enforcement this phase (VAL-01) introduces is the `type=click.Choice(REGRAS_COMPETENCIA_SUPORTADAS)` binding on `criar`/`editar` themselves — verified live: `apollo rotina template criar --nome N --tipo-geracao du_fixo --regra-competencia bogus` exits 2 immediately with `Error: Invalid value for '--regra-competencia': 'bogus' is not one of 'M0', 'M-1', 'M-2', 'M+1'.`, without ever reaching `gerar-instancias` or writing a record. The whole point of VAL-01 (per the phase's own objective text) was to close the gap where invalid values were "only rejected much later, silently, inside `gerar-instancias`" — yet the corrected help text still describes enforcement as living there, not here. A future reader of only `--help` (human or an AI agent following `docs/ai-usage/CLAUDE.md`) would reasonably conclude the CLI itself does not validate the value, which is now false and re-creates exactly the kind of misleading-documentation defect this phase exists to eliminate for `--propagar-atraso-soft`/`dedupeKey`.

**Fix:** State that `criar`/`editar` themselves reject an out-of-enum value immediately (exit 2), and keep the `gerar-instancias`/`shift_competencia` reference only as the downstream consumer of the now-guaranteed-valid stored value, e.g.:

```python
help=(
    "Which competencia (reference month) rule applies to generated "
    "instances of this template. Rejected immediately (exit 2) if not "
    "one of the choices above; the accepted value is later consumed by "
    "`apollo rotina gerar-instancias` via "
    "`apollo_cli.routine_job.shift_competencia`."
),
```

### WR-02: No regression test exercises `M-1`, `M-2`, or `M+1` through `criar`/`editar` — every fixture in both touched test files uses `M0` exclusively

**File:** `cli/tests/test_crud_rotina_template.py` (all `--regra-competencia` call sites, e.g. lines 70, 103, 128, 153, 202, 231, 265, 300, 381), `cli/tests/test_rotina_instancia.py:92`

**Issue:** The plan's own must-have truth states: "Already-valid `regraCompetencia` values (`M0`, `M-1`, `M-2`, `M+1`) continue to be accepted with unchanged behavior in both `criar` and `editar` — zero observable regression for valid input." The two new regression tests (`test_criar_regra_competencia_invalida_e_recusada_na_hora`, `test_editar_regra_competencia_invalida_e_recusada_na_hora`) only reference `"M0"`, `"M-1"`, `"M-2"`, `"M+1"` as substrings expected inside a *rejection* error message (`for expected in ("M0", "M-1", "M-2", "M+1"): assert expected in ...result.output`) — none of them is ever passed as an actual `--regra-competencia` value to a successful `criar`/`editar` call. Every other test in the file (including the pre-existing `test_full_crud_round_trip`) exclusively uses `"M0"`. I manually verified live that `M-1` and `M+1` are in fact accepted (`apollo rotina template criar --regra-competencia M-1` / `M+1` both returned exit 0 and a real id, since cleaned up), so there is no live defect today — but nothing in the automated suite would catch a regression if `REGRAS_COMPETENCIA_SUPORTADAS`'s tuple values ever drifted (e.g. a typo introduced in `M-2`/`M+1` during a future edit to `routine_job.py`) other than the job-side generation tests, which don't exercise the CLI's `click.Choice` binding at all.

**Fix:** Add (or extend an existing test with) a parametrized case that creates a template with each of `M-1`, `M-2`, and `M+1` and asserts the persisted `regraCompetencia` round-trips correctly, mirroring the existing `M0` assertions in `test_full_crud_round_trip`.

## Info

### IN-01: `--propagar-atraso-soft` help text reads awkwardly ("gerar-instancias does not propagate soft delays with it")

**File:** `cli/apollo_cli/entities/rotina.py:141-146` (`template.criar`) and `cli/apollo_cli/entities/rotina.py:229-234` (`template.editar`)

**Issue:** The corrected sentence — "Not currently read anywhere: stored on the template only; gerar-instancias does not propagate soft delays with it (C-09, out of scope for this milestone)." — is grammatically awkward ("propagate soft delays with it" reads as though `it` refers to the flag being used as a tool, rather than being the *subject* of the propagation). This was clearly reworded once already (per `26-01-SUMMARY.md`'s "Decisions Made" note) specifically to dodge Click's help-text line-wrap defeating a `grep -q 'currently read'` acceptance check, which likely explains the slightly stilted phrasing. Purely a readability nit — the meaning is still correct and unambiguous on a careful read.

**Fix:** Consider (non-blocking): "Not currently read anywhere: stored on the template only — `gerar-instancias` never propagates a soft delay based on it (C-09, out of scope for this milestone)."

---

_Reviewed: 2026-08-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
