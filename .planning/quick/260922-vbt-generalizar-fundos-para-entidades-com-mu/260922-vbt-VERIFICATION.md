---
phase: 260922-vbt-generalizar-fundos-para-entidades-com-mu
verified: 2026-09-23T04:15:00Z
status: human_needed
score: 6/7 must-haves verified
covered_files: [".planning/STATE.md", ".planning/WINDOWS.md", ".planning/quick/260922-vbt-generalizar-fundos-para-entidades-com-mu/260922-vbt-CONTEXT.md", ".planning/quick/260922-vbt-generalizar-fundos-para-entidades-com-mu/260922-vbt-PLAN.md", ".planning/quick/260922-vbt-generalizar-fundos-para-entidades-com-mu/260922-vbt-SUMMARY.md", "cli/apollo_cli/batch_import.py", "cli/apollo_cli/cli.py", "cli/apollo_cli/entities/entidade.py", "cli/apollo_cli/entities/projeto.py", "cli/apollo_cli/entities/rotina.py", "cli/apollo_cli/entities/ticket.py", "cli/tests/test_auth_rejection.py", "cli/tests/test_batch_import.py", "cli/tests/test_cli_surface.py", "cli/tests/test_cross_user_isolation.py", "cli/tests/test_crud_entidade.py", "shared/instant.perms.ts", "shared/instant.schema.ts", "web/e2e/cross-phase-verification.spec.ts", "web/e2e/entities-entidades.spec.ts", "web/e2e/entities-header-states.spec.ts", "web/e2e/focus-dialog-entidade.spec.ts", "web/src/lib/dashboard/Dashboard.svelte", "web/src/lib/dashboard/RoutinesByEntidade.svelte", "web/src/lib/dashboard/dashboardQuery.ts", "web/src/lib/dashboard/derive.ts", "web/src/lib/dashboard/dialogs/EntidadeDialog.svelte", "web/src/lib/entities/defs/entidades.ts", "web/src/lib/entities/registry.test.ts", "web/src/lib/sections/ProjetosSection.svelte"]
covered_digest: "v1:sha256:8cc65ac55f3d026c0ab3ec99409e9c55f5643211283b643e0d68371455135ffe"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Decide whether the 2 additional Playwright failures (ENTTBL-06 in entities-header-states.spec.ts, VERIFY-05 keyboard-focus in cross-phase-verification.spec.ts) satisfy must-have #7's literal wording ('excluding the 3 pre-existing... items already tracked in STATE.md Deferred Items')."
    expected: "A decision on whether the SUMMARY's classification of these 2 new failures as 'same root-cause class, pre-existing, unrelated to this rename' is accepted, and whether STATE.md's Deferred Items table should be updated to formally list them (currently only WINDOWS.md ids #16/#17 track them, both status: open)."
    why_human: "This is a policy/scope-interpretation call, not a code defect. My independent investigation (below) supports the claim that the underlying data volume (58 rows) predates this task and that the specific tests were likely never exercised at this data scale before — but the must-have's literal text names 3 specific STATE.md-tracked items, and these are 2 different tests not in that list, so the literal criterion is not met as written even though the substance is plausible."
---

# Quick Task 260922-vbt: Generalizar fundos para entidades — Verification Report

**Task Goal:** Generalizar fundos para entidades com multiplos tipos configuraveis — nova
modelagem de entidade generica no lugar de fundos fixo, com suporte a multiplos tipos de
entidade, templatesRotina/projetos/tickets vinculam a qualquer tipo de entidade, migracao
dos dados de producao existentes (fundos atuais viram entidades do tipo Fundo).

**Verified:** 2026-09-23T04:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every `entidades` row in production carries byte-identical nome/codigo/ativo/donoId/createdAt to the fundos row it replaced, plus tipoEntidade="Fundo" | ✓ VERIFIED | Independent live query (fresh python process, not reusing the migration script): `entidades` = 58 rows, `all(row.get('tipoEntidade') for row in e) == True`, `set(tipoEntidade values) == {'Fundo'}`. Spot-checked 3 sample rows via `apollo entidade listar --limit 3` — full field shape (nome/codigo/ativo/donoId/createdAt/tipoEntidade) present and well-formed. Cannot re-diff against source `fundos` rows post-migration (deleted by design in Task 4) — byte-identity itself relies on the migration script's own internal per-row assertions (all 58 rows, not sampled), which is inherent to any destructive migration's verification design, not a gap in this verifier's method. |
| 2 | `apollo entidade criar/editar/deletar/listar` work end-to-end against production; criar requires --tipo-entidade; no `apollo fundo` exists | ✓ VERIFIED | Ran live: `apollo entidade --help`, `apollo entidade criar --help` (shows `--tipo-entidade TEXT ... [required]`), `apollo entidade listar --limit 3` (returned real production rows). `apollo fundo --help` → `Error: No such command 'fundo'.` exit code 2. |
| 3 | `apollo projeto/ticket/rotina template` accept `--entidade-id` (never `--fundo-id`); `apollo import` creates entidades with `tipoEntidade` optional, defaulting to "Fundo" | ✓ VERIFIED | Grep confirms `--entidade-id` wired in projeto.py/ticket.py/rotina.py (`_resolve_entidade_link`, link dict `{"entidade": entidade_id}`). Ran live: `test_import_entidade_without_tipo_entidade_defaults_to_fundo` (`-m live`) → PASSED. `apollo import --help` documents `tipoEntidade` optional, default `"Fundo"`. Zero `--fundo-id`/`fundoId`/`_ETYPE_FUNDO` matches anywhere in `cli/`. |
| 4 | Web SPA nav/dashboard/dialogs/table read "Entidades"/"por entidade"; Entidade form exposes `tipoEntidade` as free text | ✓ VERIFIED | `web/src/lib/entities/defs/entidades.ts` read directly: `titulo: "Entidades"`, field `{ name: "tipoEntidade", label: "Tipo", required: true, kind: "text" }` present in both `fields` and `listColumns`. `RoutinesByEntidade.svelte`, `EntidadeDialog.svelte`, `Dashboard.svelte`, `dashboardQuery.ts`, `derive.ts` (`rotinasPorEntidade`/`rotinasDoEntidade`) all confirmed present and cross-wired by direct grep. |
| 5 | `fundos` schema entity and its 3 links no longer exist in production; confirmed independently | ✓ VERIFIED | `grep -n '"fundos"|fundos: i.entity|fundoProjetos|fundoTemplatesRotina|fundoTickets' shared/instant.schema.ts` → zero matches. Independent live admin query (fresh process): `c.query({'fundos': {}})` → 0 rows. `shared/instant.perms.ts` no longer has a `fundos:` rule; `entidades: donoRules` present, using the identical shared `donoRules` object every other entity uses (no special-casing). |
| 6 | grep across `cli/`/`web/` finds zero remaining old identifiers (`_ETYPE_FUNDO`, `--fundo-id`, `fundoId`, `apollo_cli.entities.fundo`, schema entity `"fundos"`) | ✓ VERIFIED | Ran the grep myself, not trusting the SUMMARY: zero matches in `cli/apollo_cli`/`cli/tests` for `_ETYPE_FUNDO`, `--fundo-id`, `fundoId`, `"fundos"`. In `web/src`, the only remaining literal "fundo" hits are: (a) a doc-comment in `derive.ts` quoting `spec-ui.md`'s original prose verbatim (historical citation, not a stale identifier), (b) `defs/entidades.ts`'s own doc-comment listing "fundos, clientes, areas" as example `tipoEntidade` values (intentional prose), (c) `derive.test.ts` fixture data using the string `"Fundo B"` as a sample entity name (legitimate test data, not a stale identifier). None are functional stale references. |
| 7 | Full offline+live `cli/` pytest suite and `web/` bun test + svelte-check + Playwright e2e suite are green (excluding the 3 pre-existing, documented-unrelated test-fragility items in STATE.md Deferred Items) | ⚠️ DISCREPANCY — see Human Verification | Re-ran `test_cli_surface.py` (14 passed) and `registry.test.ts` (45 passed) myself — both green, matching SUMMARY. However, the full Playwright run (per SUMMARY, 159 passed / 2 failed) surfaced 2 failures — `entities-header-states.spec.ts`'s ENTTBL-06 and `cross-phase-verification.spec.ts`'s VERIFY-05 keyboard-focus — that are **not** among the 3 specific items STATE.md's Deferred Items table names ("2 dashboard heatmap density-band assertions, 1 cross-channel `existing==[]` assertion", all from Phase 30). The must-have's literal wording is therefore not satisfied as written. See investigation below. |

**Score:** 6/7 truths verified (1 routed to human decision, not counted as failed or verified)

### Investigation of Truth #7's Discrepancy

Independently traced the root cause rather than accepting the SUMMARY's classification at face value:

- Confirmed via `.planning/quick/20260922-limpar.../260922-t1l-VERIFICATION.md` (a prior, already-verified quick task) that production `fundos` already held exactly 58 rows **before this quick task's own research phase began** — these are batch-import test artifacts (naming pattern `LOTE-F*-<hash>`, consistent with Phase 31's batch-import feature testing), explicitly left untouched by `260922-t1l`'s own cleanup (which treated `fundos=58` as an unchanged canary, not test pollution in its scope).
- Read the pre-rename version of both failing tests at commit `0588bcd` (before this task's Task 4 e2e rename, commit `2136ef0`): `entities-header-states.spec.ts`'s `ENTTBL-06` contains an explicit code comment "This live app's fundos baseline is empty (no real production data exists yet, per PROJECT.md)" — an assumption that was **already false** before this task started, since 58 fundos rows already existed at that point. The `VERIFY-05` keyboard-focus test in `cross-phase-verification.spec.ts` asserts a freshly-created row is exactly one Tab away from `entity-create-start`, which requires new rows to sort first — not something the app's un-ordered/default InstantDB query result guarantees once dozens of rows exist.
- This supports the SUMMARY's substantive claim: the underlying defect (tests assuming a near-empty account) predates this task and is the same class as STATE.md's already-tracked items — the rename did not introduce it, it just carried the same 58 rows over under a new name.
- However: STATE.md's Deferred Items table itself was **not** updated to list these 2 new items — only `.planning/WINDOWS.md` (ids #16, #17, both `status: open`) tracks them. The plan's own success criterion literally scoped the exclusion to "the 3 pre-existing... items already tracked in STATE.md Deferred Items" — a scope that, read literally, 2 of these 5 total failures don't fit.

This is a defensible-but-imperfect documentation gap, not a functional regression and not evidence the migration/rename itself is broken. Routed to human decision rather than silently passed or hard-failed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/instant.schema.ts` | `entidades` entity + 3 links; `fundos` fully removed | ✓ VERIFIED | Confirmed both halves directly |
| `shared/instant.perms.ts` | `entidades: donoRules` | ✓ VERIFIED | Present, identical shared rule object |
| `cli/apollo_cli/entities/entidade.py` | `apollo entidade` group | ✓ VERIFIED | Exists, live-tested |
| `cli/apollo_cli/batch_import.py` | entidades/entidadeId, tipoEntidade optional default Fundo | ✓ VERIFIED | Live test passed |
| `cli/tests/test_crud_entidade.py` | renamed from test_crud_fundo.py | ✓ VERIFIED | Exists; old file gone |
| `web/src/lib/entities/defs/entidades.ts` | tipoEntidade required text field | ✓ VERIFIED | Read directly, matches spec |
| `web/src/lib/dashboard/dialogs/EntidadeDialog.svelte` | renamed from FundoDialog.svelte | ✓ VERIFIED | Exists; old file gone |
| `web/src/lib/dashboard/RoutinesByEntidade.svelte` | renamed from RoutinesByFundo.svelte | ✓ VERIFIED | Exists; old file gone |
| `web/e2e/entities-entidades.spec.ts` | renamed from entities-fundos.spec.ts | ✓ VERIFIED | Exists; old file gone |
| `web/e2e/focus-dialog-entidade.spec.ts` | renamed from focus-dialog-fundo.spec.ts | ✓ VERIFIED | Exists; old file gone |
| `cli/scripts/migrate_fundos_to_entidades.py` | transient script, deleted after use | ✓ VERIFIED | `ls` confirms absent; `git status --porcelain cli/scripts/` clean |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `shared/instant.schema.ts`'s `entidadeProjetos`/`entidadeTemplatesRotina`/`entidadeTickets` | `shared/instant.perms.ts`'s `rules.entidades: donoRules` | Links declared + perms rule present | ✓ WIRED |
| perms `entidades: donoRules` | CLI `--entidade-id` resolution (`projeto.py`/`ticket.py`/`rotina.py`) | `_resolve_entidade_link` → `get_entity(etype=_PARENT_ETYPE...)` → `{"entidade": entidade_id}` | ✓ WIRED |
| CLI entidade link | `web/src/lib/entities/defs/{projetos,tickets,templatesRotina}.ts`'s entidade link | grep-confirmed rename applied | ✓ WIRED |
| `defs/*.ts` entidade link | `dashboardQuery.ts`'s nested `entidade: {}` branches | Read directly: `projetos: { entidade: {}, ... }`, `instanciasRotina: { template: { entidade: {} } }`, `tickets: { entidade: {}, ... }`, top-level `entidades: {}` | ✓ WIRED |
| `dashboardQuery.ts` | `derive.ts`'s `rotinasPorEntidade`/`rotinasDoEntidade` | Both exported functions present, called from `RoutinesByEntidade.svelte` and `EntidadeDialog.svelte` | ✓ WIRED |
| `derive.ts` exports | `RoutinesByEntidade.svelte` + `EntidadeDialog.svelte` | `import { rotinasDoEntidade } from "../derive"` confirmed in `EntidadeDialog.svelte`; `RoutinesByEntidade.svelte` consumes `rotinasPorEntidade`'s return shape | ✓ WIRED |
| `cli/scripts/migrate_fundos_to_entidades.py` (historical, now deleted) | InstantDB admin client | Not re-testable post-deletion; migration already executed and independently re-verified via row counts | ✓ VERIFIED (historical) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `apollo entidade` CLI group exists, `criar` requires `--tipo-entidade` | `apollo entidade criar --help` | Shows `--tipo-entidade TEXT ... [required]` | ✓ PASS |
| `apollo fundo` no longer exists | `apollo fundo --help` | `Error: No such command 'fundo'.` exit 2 | ✓ PASS |
| `apollo entidade listar` returns real production data | `apollo entidade listar --limit 3` | 3 real rows returned, full field shape | ✓ PASS |
| Production `entidades`/`fundos` counts | ad-hoc `python -c` admin query (fresh process) | `entidades=58` (all `tipoEntidade=="Fundo"`), `fundos=0` | ✓ PASS |
| D6 `apollo import` optional tipoEntidade default | `pytest test_batch_import.py::test_import_entidade_without_tipo_entidade_defaults_to_fundo -m live` | 1 passed | ✓ PASS |
| `test_cli_surface.py` clean post-cleanup (no transitional exception left) | `pytest tests/test_cli_surface.py -q` | 14 passed; grep confirms `_PENDING_SCHEMA_REMOVAL` absent | ✓ PASS |
| `registry.test.ts` clean post-cleanup | `bun test src/lib/entities/registry.test.ts` | 45 pass, 0 fail; grep confirms `PENDING_SCHEMA_REMOVAL` absent | ✓ PASS |

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers found in the covered files. No stub return values, no empty handlers, no hardcoded-empty data flowing to rendering.

### Deviations Cross-Check (documented in SUMMARY.md)

| # | Deviation claimed | Independently confirmed? |
|---|--------------------|---------------------------|
| 1 | Missing `tipoEntidade` on raw admin-client `entidades` creates in `test_cross_user_isolation.py`/`test_auth_rejection.py`/`test_batch_import.py`, fixed | ✓ CONFIRMED — grep shows `"tipoEntidade": "Fundo"` present at the cited line numbers in all 3 files |
| 2 | Missing `field-tipoEntidade` fill in browser-driven e2e create forms, fixed in 4 files | Not independently re-run (would require live browser session); plausible given form now has a required field. Not flagged as a concern — consistent with defs/entidades.ts's `required: true` field. |
| 3 | `web/src/lib/entities/registry.test.ts` needed the identical transitional `PENDING_SCHEMA_REMOVAL` exception as `test_cli_surface.py`, added then removed | ✓ CONFIRMED — grep shows zero remaining `PENDING_SCHEMA_REMOVAL`/`fundos` references in the file today (Task 4's cleanup applied); test passes green |
| 4 | Fixed `entities-entidades.spec.ts`'s WEB-02 empty-state assertion (no longer valid post-migration), removed rather than left broken | ✓ CONFIRMED — file's comments explicitly document the removal and rationale at the cited location |
| 5 | Task 2's own literal verify-grep would have matched its own instructed transitional exception; resolved by acknowledging the known exception rather than treating it as a blocker (no code change) | Reasonable — documentation-only note, no independent check needed |

All 4 code-affecting deviations are genuine, verifiable fixes — not swept-under-the-rug items.

### Human Verification Required

### 1. Accept or reject Truth #7's literal-wording discrepancy

**Test:** Review the 2 new Playwright failures (`ENTTBL-06`, `VERIFY-05`) and this report's root-cause investigation above.
**Expected:** A decision — either (a) accept the SUMMARY's classification as "same pre-existing test-fragility class, not a rename regression" and optionally have someone add these 2 items to STATE.md's Deferred Items table for full traceability (WINDOWS.md already tracks them as open, ids #16/#17), or (b) require a follow-up fix before considering must-have #7 fully satisfied.
**Why human:** Policy/scope-interpretation call about what "already tracked in STATE.md" should be read to mean when the underlying root cause is the same class but the specific test names weren't enumerated at plan-authoring time. Not a code defect — production state, CLI, schema, and web wiring are all independently confirmed correct and complete.

### Gaps Summary

No blocking gaps. All schema/CLI/web/production-data must-haves are independently verified against the live codebase and live production InstantDB app (not trusted from SUMMARY.md). One must-have (full-suite "green," excluding named pre-existing flaky items) has a literal-wording mismatch that this verifier's own investigation found substantively explainable but not a perfect match to the plan's exact exclusion list — routed to human decision rather than silently passed or hard-failed.

---

_Verified: 2026-09-23T04:15:00Z_
_Verifier: Claude (gsd-verifier)_
