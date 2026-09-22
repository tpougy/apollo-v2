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
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-08-14
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This is a re-review after a fix pass addressing the two WARNING findings (WR-01, WR-02) from the prior 26-REVIEW.md, plus a mechanical fixture-repair commit (`d924a53`). I did not take the fix commit messages at face value — I re-read the actual current source, re-derived the constant set (`REGRAS_COMPETENCIA_SUPORTADAS = ("M0", "M-1", "M-2", "M+1")` in `routine_job.py`), and cross-checked every touched file against it.

**WR-01 (misleading `--regra-competencia` help text) — verified RESOLVED.** `cli/apollo_cli/entities/rotina.py:134-140` (`criar`) now reads "Rejected immediately (exit 2) if not one of the choices above; the accepted value is later consumed by `apollo rotina gerar-instancias`...", correctly attributing enforcement to the command's own `click.Choice` binding rather than the downstream job. `editar`'s help text (`:224-227`) was already accurate and needed no change, matching the fix commit's own claim.

**WR-02 (no test proved M-1/M-2/M+1 are actually accepted) — verified RESOLVED.** `cli/tests/test_crud_rotina_template.py:345-410` adds two new parametrized live tests, `test_criar_aceita_regra_competencia_nao_m0` and `test_editar_aceita_regra_competencia_nao_m0`, each running once per `["M-1", "M-2", "M+1"]`. Both create/edit a real record, query it back via the live client, and assert `record["regraCompetencia"] == regra` — genuine acceptance proof, not merely a substring match inside a rejection-message assertion (which is all the previous tests did). This closes exactly the gap the prior review identified.

**Mechanical fixture repair (`d924a53`) — verified correct and complete.** Five pre-existing invalid `--regra-competencia` values (`mes_corrente`, `mes_seguinte`, `encadeada`, `R` in the CLI tests; nine `mes-corrente` occurrences across the four e2e spec files) were corrected to `M0`. I grepped every `--regra-competencia` call site across the entire touched-file set (`cli/tests/*.py`, `web/e2e/*.spec.ts`) and confirmed zero stale values remain — only `M0`, `M-1`, `M-2`, `M+1`, and the deliberate negative-test value `bogus` appear anywhere. I also confirmed the one dependent assertion (`test_full_crud_round_trip`'s `record["regraCompetencia"] == "M0"`) was updated in lockstep with its corresponding `criar` call, so no stale-assertion mismatch was introduced. The out-of-scope live-DB pagination flake discovered incidentally during this fix (`test_criar_without_offset_dias_omits_key_entirely`) was correctly deferred rather than silently patched — logged in `deferred-items.md` with a documented root cause, consistent with the phase's scope-boundary rule.

I also independently verified the two docstring corrections mentioned in `c4399ba` (not part of the original WR-01/WR-02 findings, but touched by the same file): the `--propagar-atraso-soft` help text's claim that the value is "not currently read anywhere" matches `routine_job.py:46`'s own docstring ("`propagarAtrasoSoft` is stored on the template but never read anywhere..."), and `instancia status`'s docstring no longer calls `dedupeKey` a hash, correctly matching `routine_job.py`'s canonical "plain string concatenation... NOT a derived hash" wording.

No BLOCKER or WARNING-level defects remain. Two minor INFO items are noted below — one carried forward unresolved from the prior review, one newly observed during this pass.

## Info

### IN-01 (carried forward, still unresolved): `--propagar-atraso-soft` help text reads awkwardly

**File:** `cli/apollo_cli/entities/rotina.py:143-149` (`template.criar`) and `cli/apollo_cli/entities/rotina.py:230-236` (`template.editar`)

**Issue:** This INFO item from the prior review was not addressed by the fix pass (the fix pass targeted only WR-01/WR-02). The text still reads "Not currently read anywhere: stored on the template only; gerar-instancias does not propagate soft delays with it (C-09, out of scope for this milestone)." — "propagate soft delays with it" still reads awkwardly, as if `it` is a tool rather than the subject. Purely a readability nit; the meaning is correct and unambiguous.

**Fix:** Consider (non-blocking): "Not currently read anywhere: stored on the template only — `gerar-instancias` never propagates a soft delay based on it (C-09, out of scope for this milestone)."

### IN-02 (new): module-level `expect()` assertion inside `test.describe()` callback, not inside a `test()`

**File:** `web/e2e/focus-dialog-button-inventory.spec.ts:186`

**Issue:** `expect(INVENTORY.length).toBe(16);` executes directly inside the `test.describe(...)` callback body, at file-collection/discovery time, rather than inside a `test()` or `test.beforeAll()`. If this assertion ever fails (e.g. someone edits `INVENTORY` and miscounts), Playwright would report a collection-time error affecting the whole file's test run rather than a single clearly-attributed test failure. This line predates the current fix pass (it was not touched by `d924a53`, which only replaced the adjacent `--regra-competencia` fixture value), so it is not a regression introduced by this phase — noted for completeness since the file is in scope for this review.

**Fix:** Move the assertion into a dedicated test, e.g. `test("INVENTORY has exactly 16 entries", () => { expect(INVENTORY.length).toBe(16); });`, or into the existing `test.beforeAll()` hook.

---

_Reviewed: 2026-08-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
