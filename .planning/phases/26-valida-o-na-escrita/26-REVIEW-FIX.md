---
phase: 26-valida-o-na-escrita
fixed_at: 2026-08-14T20:07:09Z
review_path: .planning/phases/26-valida-o-na-escrita/26-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 26: Code Review Fix Report

**Fixed at:** 2026-08-14T20:07:09Z
**Source review:** .planning/phases/26-valida-o-na-escrita/26-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (WR-01, WR-02 — fix_scope=critical_warning; IN-01 excluded)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `--regra-competencia` help text still attributed enforcement to `gerar-instancias`

**Files modified:** `cli/apollo_cli/entities/rotina.py`
**Commit:** `1ec2ad4`
**Applied fix:** Reworded the `template.criar` `--regra-competencia` help text to state that `criar`/`editar` reject an out-of-enum value immediately (exit 2) via `click.Choice`, and reframed `gerar-instancias`/`shift_competencia` as the downstream consumer of the now-guaranteed-valid value — matching the exact wording the review proposed.

**Note on scope divergence from REVIEW.md:** The finding's **File:** line cited two locations — `template.criar` (~134-139) and `template.editar` (~222-226). On reading the actual source, only the `criar` help text contained the misleading "Enforced by `apollo rotina gerar-instancias`..." sentence. The `editar` `--regra-competencia` help text at lines 222-226 already read `"New competencia rule. Omit to leave unchanged."` — it never made an enforcement claim and needed no change. Confirmed via `grep -n "regra-competencia\|Enforced by\|gerar-instancias\|shift_competencia" cli/apollo_cli/entities/rotina.py` that no other reference to the misleading phrasing exists. Only the `criar` location was edited; this is not a partial fix, the `editar` text was already correct.

### WR-02: No regression test exercised `M-1`, `M-2`, or `M+1` as actual accepted values through `criar`/`editar`

**Files modified:** `cli/tests/test_crud_rotina_template.py`
**Commit:** `e2a3a15`
**Applied fix:** Added two parametrized live tests — `test_criar_aceita_regra_competencia_nao_m0` and `test_editar_aceita_regra_competencia_nao_m0` — each parametrized over `["M-1", "M-2", "M+1"]`. The `criar` test creates a template with the non-M0 value directly and asserts the persisted `regraCompetencia` round-trips. The `editar` test creates an `M0` template, edits it to each non-M0 value, and asserts the round-trip, mirroring the existing `test_full_crud_round_trip` pattern (uses `run_cli`, `live_client`, `cleanup_records`, `_query_template`, `unique_suffix`, all already present in the file).

**Note on scope:** `cli/tests/test_rotina_instancia.py:92` was cited in the finding's **File:** line as another `M0`-only call site, but on inspection it is an incidental test-fixture helper (`_create_template`) used only to seed a template for unrelated `instanciasRotina` listar/status tests — it does not exercise or assert anything about `--regra-competencia` value acceptance itself. The actual CRUD contract for `--regra-competencia` lives in `test_crud_rotina_template.py`, which is where the new coverage was added. Left `test_rotina_instancia.py` unmodified since changing its incidental `M0` value would not add any meaningful coverage.

## Verification

- Tier 1 (re-read): both modified files re-read after edit; fix text present, surrounding code intact.
- Tier 2 (syntax/lint): `python3 -c "import ast; ast.parse(...)"` passed on both files; `uv run ruff check cli/tests/test_crud_rotina_template.py cli/apollo_cli/entities/rotina.py` reported "All checks passed!".
- Live test execution (running the new/existing `@pytest.mark.live` tests against the real InstantDB app) was not performed by this fixer — out of scope per the "no full test suite between fixes" rule, and requires a live `.env.instantdb` session that this run did not have permission to inspect. The verifier/human-verify phase should run the live suite to confirm the new tests pass against the real app.
- No worktree was used for this run — `workflow.use_worktrees` is `false` in `.planning/config.json`; edits and commits were made directly on the `main` branch in the primary checkout (repo-root at `/home/thomaz/pessoal/apollo-v2`), per the documented opt-out path.

---

_Fixed: 2026-08-14T20:07:09Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
