---
phase: 260922-t1m
verified: 2026-09-22T22:20:00Z
status: passed
score: 3/3 must-haves verified
covered_files:
  - .planning/quick/20260922-mostrar-o-nome-do-template-de-rotina-na-listagem-de-instanci/260922-t1m-PLAN.md
  - .planning/quick/20260922-mostrar-o-nome-do-template-de-rotina-na-listagem-de-instanci/260922-t1m-SUMMARY.md
  - cli/apollo_cli/entities/rotina.py
  - cli/tests/test_rotina_instancia.py
  - web/e2e/entities-rotina-log.spec.ts
  - web/src/lib/entities/EntityScreen.svelte
  - web/src/lib/entities/defs/instanciasRotina.ts
  - web/src/lib/entities/types.ts
covered_digest: "v1:sha256:fc05e691df655e3e56f9e3fe516c69ddebb9acd02803a717547d05b0f26b28b1"
behavior_unverified: 0
overrides_applied: 0
---

# Quick Batch 260922-t1m: Show routine template name on instanciasRotina listing Verification Report

**Item Goal:** Mostrar o nome do template de rotina na listagem de instancias de rotina (CLI `apollo rotina instancia listar` e a tela web correspondente), resolvendo via `instanciasRotina.template`, sem mudança de schema.
**Verified:** 2026-09-22T22:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CLI `apollo rotina instancia listar` (with or without `--template-id`) returns each instance row with its source `templatesRotina` record's `nome` resolved inline via the existing `template` link, with no schema change | ✓ VERIFIED | `cli/apollo_cli/entities/rotina.py:526-550` — `listar_instancia` runs `client.query({_ETYPE_INSTANCIA: {"template": {}, "$": query_opts}})` instead of `list_entities`, preserving `where`/`limit` semantics. Live pytest `test_listar_expands_template_nome_inline` (real InstantDB, real session) **executed by this verifier** and PASSED for both unfiltered and `--template-id`-filtered calls (see Behavioral Spot-Checks). |
| 2 | The web instanciasRotina listing table shows a column with the source template's name for every row, resolved via the same `template` link | ✓ VERIFIED | `web/src/lib/entities/defs/instanciasRotina.ts:58-67` declares the `template` link (`readOnly: true`) and adds it as the first `listColumns` entry; `EntityScreen.svelte`'s generic `columnValue`/`labelForLinkedValue` (unchanged, already generic) render it. Live Playwright test `WEB-10` **executed by this verifier** against the real app/DB and PASSED — asserted the row's text contains the seeded template's `nome`. |
| 3 | The instanciasRotina create/edit dialog in the web app never exposes `template` as an editable field — `status` remains the only editable field, exactly as before this change | ✓ VERIFIED | `EntityScreen.svelte:84-85` filters `readOnly` links out of `linkTargetQueries`; line 714 filters them out of the per-link `<Select>` form loop (`(config.links ?? []).filter((l) => !l.readOnly)`). Live Playwright test `WEB-10` asserted `field-status` count=1 and `link-template` count=0 in the edit dialog — **executed by this verifier**, PASSED. Full-file re-run of `entities-rotina-log.spec.ts` also confirms `WEB-06` (templatesRotina CRUD, a non-readOnly self-link) and `WEB-07` (instanciasRotina status-only edit) still pass unchanged, confirming the `readOnly` filter did not reopen or break editable-link behavior elsewhere. |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cli/apollo_cli/entities/rotina.py` | `listar_instancia` sub-expands `template` link | ✓ VERIFIED | Direct `client.query` call wrapped in `instant_errors()`, `template.listar` untouched |
| `cli/tests/test_rotina_instancia.py` | New live test for template expansion | ✓ VERIFIED | `test_listar_expands_template_nome_inline` present, ran live, passed |
| `web/src/lib/entities/types.ts` | `LinkDef.readOnly?: boolean` | ✓ VERIFIED | Field added with documenting comment, line 26 |
| `web/src/lib/entities/EntityScreen.svelte` | `readOnly` filter in two places | ✓ VERIFIED | Lines 84-85 (`linkTargetQueries`), line 714 (form `<Select>` loop); `buildQuery`/`columnValue`/`startEdit`/`handleSubmit` left generic and untouched as specified |
| `web/src/lib/entities/defs/instanciasRotina.ts` | `template` declared `readOnly: true`, added to `listColumns` | ✓ VERIFIED | Lines 58-67 |
| `web/e2e/entities-rotina-log.spec.ts` | New live e2e test (`WEB-10`) | ✓ VERIFIED | Present at line 270, ran live, passed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `instanciasRotina.template` (schema `templateInstancias` link) | CLI `listar_instancia`'s `client.query` sub-expansion | emitted `template.nome` | ✓ WIRED | Confirmed by live pytest assertion `linked["nome"] == template_nome` |
| `instanciasRotina.template` | `instanciasRotina.ts`'s `readOnly` `LinkDef` | `EntityScreen.svelte`'s generic `buildQuery` sub-expansion → `columnValue()`/`labelForLinkedValue()` → rendered table column | ✓ WIRED | Confirmed by live Playwright assertion the row contains the template's `nome` |
| `LinkDef.readOnly` flag | `EntityScreen.svelte`'s `linkTargetQueries` filter + per-link `<Select>` form loop filter | excludes `template` from the editable create/edit form | ✓ WIRED | Confirmed by live Playwright assertion `link-template` testid has count 0 in the edit dialog, while `field-status` remains present |

### Behavioral Spot-Checks (Live, No Mocking)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CLI listar (unfiltered) carries expanded `template.nome` | `cd cli && uv run pytest tests/test_rotina_instancia.py -k test_listar_expands_template_nome_inline -x -v` | `1 passed` — real InstantDB session, real seeded template+instance | ✓ PASS |
| CLI full-file regression (10 tests incl. `limpar_orfas`, status round-trip) | `cd cli && uv run pytest tests/test_rotina_instancia.py -x` | `10 passed` | ✓ PASS |
| `_linked_template_id` shape-handling unaffected | `cd cli && uv run pytest tests/test_routine_job_parity.py -x` (no test names matched `-k template`; ran full file per plan's "or the relevant subset") | `2 passed` | ✓ PASS |
| Web listing shows template name + edit dialog stays read-only | `cd web && bunx playwright test e2e/entities-rotina-log.spec.ts --project=authed --no-deps -g "WEB-10"` | `1 passed` — real app, real seeded template+instance via `apolloCli`/`seedInstance` | ✓ PASS |
| Web full-file regression (WEB-06/07/09/10) | `cd web && bunx playwright test e2e/entities-rotina-log.spec.ts --project=authed --no-deps` | `4 passed` (WEB-06 templatesRotina CRUD incl. self-link antecessor, WEB-07 instanciasRotina status-only, WEB-10 new, WEB-09 read-only log) | ✓ PASS |
| TypeScript typecheck | `cd web && bun run check` | `929 FILES 0 ERRORS 2 WARNINGS` (both warnings pre-existing/unrelated) | ✓ PASS |

### Anti-Patterns Found

None. Scanned all 6 modified files (`rotina.py`, `test_rotina_instancia.py`, `types.ts`, `EntityScreen.svelte`, `instanciasRotina.ts`, `entities-rotina-log.spec.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and "not yet implemented"/"not available" — zero matches.

### Reassignment-Hole Regression Check

The plan's stated risk was that a generic `readOnly` flag on `EntityScreen.svelte` could inadvertently affect other entities' editable links. Verified:
- `grep -rn "readOnly" web/src/lib/entities/defs/*.ts` shows `readOnly: true` used **only** in `instanciasRotina.ts` — every other entity def leaves the field unset (falsy), so the two new filters (`linkTargetQueries`, form `<Select>` loop) are no-ops for them.
- Live Playwright `WEB-06` (templatesRotina full CRUD, including the self-referential `antecessor` link, a non-readOnly link) passed in the same full-file run, confirming editable-link behavior for other entities is unchanged.
- `handleSubmit`'s link-relink loop (`EntityScreen.svelte:316-322`) still iterates over **all** `config.links` unconditionally (not filtered by `readOnly`), and `startEdit` (line 242-246) still seeds `selectedLinks[label]` from the row's current server value for every link including `template`. Since no `<Select>` control renders for a `readOnly` link, `selectedLinks.template` is never user-mutated — the resubmitted value on edit is always identical to what was loaded from the server, so the "never reassign template" invariant holds without a submit-path change, exactly as the plan intended and as `WEB-10`'s edit-dialog assertion (no `link-template` control) directly confirms.

### Requirements Coverage

Not applicable — this is a `.planning/quick/` item with no `requirements:` field in the PLAN frontmatter and no REQUIREMENTS.md mapping.

### Human Verification Required

None. All must-haves were verified through direct code inspection plus live, unmocked automated runs (pytest against real InstantDB, Playwright against the real running app).

### Gaps Summary

No gaps found. All 3 must-have truths verified with live evidence; all artifacts exist, are substantive, and are wired; all key links confirmed; no anti-patterns; the `readOnly` LinkDef flag was confirmed generic-safe (opt-in, unset elsewhere) and does not reopen the template-reassignment hole for `instanciasRotina` or any other entity.

---

_Verified: 2026-09-22T22:20:00Z_
_Verifier: Claude (gsd-verifier)_
