---
phase: 30-ciclo-de-vida-e-higiene-de-dados
verified: 2026-09-22T21:40:00Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - ".planning/phases/30-ciclo-de-vida-e-higiene-de-dados/30-01-PLAN.md"
  - ".planning/phases/30-ciclo-de-vida-e-higiene-de-dados/30-01-SUMMARY.md"
  - ".planning/phases/30-ciclo-de-vida-e-higiene-de-dados/30-02-PLAN.md"
  - ".planning/phases/30-ciclo-de-vida-e-higiene-de-dados/30-02-SUMMARY.md"
  - ".planning/phases/30-ciclo-de-vida-e-higiene-de-dados/30-CONTEXT.md"
  - ".planning/phases/30-ciclo-de-vida-e-higiene-de-dados/30-PATTERNS.md"
  - ".planning/phases/30-ciclo-de-vida-e-higiene-de-dados/30-REVIEW.md"
  - ".planning/phases/30-ciclo-de-vida-e-higiene-de-dados/deferred-items.md"
  - "cli/apollo_cli/entities/rotina.py"
  - "cli/tests/test_cli_surface.py"
  - "cli/tests/test_crud_rotina_template.py"
  - "cli/tests/test_rotina_instancia.py"
  - "cli/tests/test_routine_job.py"
  - "web/e2e/dashboard.spec.ts"
  - "web/e2e/entities-form-restyle.spec.ts"
  - "web/e2e/entities-rotina-log.spec.ts"
  - "web/e2e/fixtures/instancia-admin-fixture.ts"
  - "web/e2e/focus-dialog-button-inventory.spec.ts"
  - "web/e2e/focus-dialog-dia-rotina.spec.ts"
  - "web/e2e/focus-dialog-fundo.spec.ts"
  - "web/e2e/routine-job-cross-channel.spec.ts"
  - "web/e2e/routine-job.spec.ts"
covered_digest: "v1:sha256:698ecf350d386cdfaf0f3ba756e6f1c812ca83caa21f356067a692d5a7d14ff3"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 30: Ciclo de vida e higiene de dados — Verification Report

**Phase Goal:** Deletar um template tem consequência explícita sobre suas instâncias; resíduo
de teste não alcança mais a base usada para dados reais; órfãs já existentes podem ser limpas.
**Verified:** 2026-09-22T21:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `apollo rotina template deletar` on a template with N linked instances, no `--force`, blocks with exact count and exit code 5, zero writes (ROADMAP SC1, LIFE-01) | ✓ VERIFIED | `cli/apollo_cli/entities/rotina.py:429-503` (`_count_linked_instances` + `deletar` guard); `_EXIT_INSTANCES_LINKED: Final[int] = 5` at line 87 (raised at line 494); live test `test_deletar_with_linked_instances_blocks_by_default_with_exact_count` run directly by this verifier against the real production account — **PASSED** |
| 2 | Same command with `--force` deletes the template without cascading onto linked instances; the resulting orphan's `template` link comes back with the key entirely absent under link expansion | ✓ VERIFIED | `deletar`'s force branch (rotina.py:495) calls `delete_entity` unchanged, never touches instances; live test `test_deletar_with_force_deletes_template_and_orphans_linked_instance` run directly by this verifier — **PASSED** |
| 3 | `apollo rotina instancia limpar-orfas` (no `--confirmar`) lists orphans by default and writes nothing; structurally cannot delete a non-orphan (ROADMAP SC2, LIFE-02) | ✓ VERIFIED | Code read (`rotina.py:571-598`): the delete loop (`for row in orphans: delete_entity(...)`) iterates exclusively over `orphans = [row for row in rows if not row.get("template")]` — a row with a truthy `template` link is filtered out before the loop even exists, so `--confirmar` cannot structurally reach a non-orphan. Live tests `test_limpar_orfas_lists_orphan_without_confirmar_writes_nothing` and `test_limpar_orfas_confirmar_deletes_only_orphans_leaves_valid_linked_instance_untouched` run directly by this verifier — both **PASSED** |
| 4 | The real pre-existing orphans + `phase23-e2e-dedupe-weekday-...` residue are resolved; production currently holds zero orphans (ROADMAP SC3) | ✓ VERIFIED | This verifier ran `apollo rotina instancia limpar-orfas` live against the real `tp@rbrasset.com.br` production account directly (not trusting 30-01-SUMMARY.md's claim) — response: `{"confirmado": false, "count": 0, "orphans": []}` |
| 5 | `sweepInstancesByDedupeKeyPrefix` exists, is owner-scoped, and is wired into the 5 spec files that seed `PREFIX`-tagged instances; the other 3 touched spec files get `--force`-only | ✓ VERIFIED | `web/e2e/fixtures/instancia-admin-fixture.ts:172-190` — resolves `adminDb.auth.getUser({email: ownerEmail})` before querying/deleting, scoping strictly to that owner's `donoId`. `grep -rl 'sweepInstancesByDedupeKeyPrefix' e2e/*.spec.ts` returns exactly `dashboard.spec.ts`, `focus-dialog-dia-rotina.spec.ts`, `focus-dialog-button-inventory.spec.ts`, `focus-dialog-fundo.spec.ts`, `entities-rotina-log.spec.ts` (5/5, matches Decision C). `routine-job.spec.ts`, `routine-job-cross-channel.spec.ts`, `entities-form-restyle.spec.ts` confirmed to have zero matches |
| 6 | Every e2e sweep site calling `rotina template deletar` passes `--force` (all 8 files) | ✓ VERIFIED | Re-grepped all 8 files directly. 4 files (dashboard, focus-dialog-button-inventory, focus-dialog-dia-rotina, focus-dialog-fundo) use `tryDelete` with `if (group === "rotina template") args.push("--force");` — confirmed by direct read of each function body. 4 files (entities-rotina-log, routine-job, routine-job-cross-channel, entities-form-restyle) hardcode `"--force"` in the fixed `apolloCli([...])` args array — confirmed by direct grep |
| 7 | Offline test suites are green (CLI non-live + web check/lint) | ✓ VERIFIED | `cd cli && uv run pytest -m "not live and not packaging"` → **402 passed, 2 skipped, 99 deselected**. `cd web && bun run check` → **929 files, 0 errors** (2 pre-existing unrelated warnings). `cd web && bun run lint` → **exit 0** (3 warnings/1 info, none in phase-30-touched files, confirmed by grep against saved output) |
| 8 | The two documented deferred items are genuinely unrelated to this phase's diff | ✓ VERIFIED | Spot-checked directly: `git diff c629acb^..8bc5e62 -- cli/apollo_cli/entities/rotina.py` shows zero `def criar`/`def listar` changes (deferred item #1's claim). `git diff 9af8909..1fa0c37 -- web/e2e/dashboard.spec.ts web/e2e/routine-job-cross-channel.spec.ts` shows only `tryDelete`/`sweepLeftovers` infrastructure changes — the heatmap-class assertions and `cliReport.existing` assertion lines are untouched (deferred item #2's claim) |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cli/apollo_cli/entities/rotina.py` | `_count_linked_instances`, guarded `deletar --force/--no-force`, `_EXIT_INSTANCES_LINKED`, `instancia limpar-orfas --confirmar/--no-confirmar` | ✓ VERIFIED | All four present and wired; read in full, exit code confirmed to be **5** (changed from the plan's original 2 during code review WR-01, to avoid collision with Click's own usage-error exit code — confirmed via `--help` output, source read, and a live-passing test asserting `exit_code == 5`) |
| `web/e2e/fixtures/instancia-admin-fixture.ts` | `sweepInstancesByDedupeKeyPrefix(prefix, ownerEmail)` | ✓ VERIFIED | Present, owner-scoped, mirrors `deleteInstancesByTemplate`'s list-then-loop-delete shape |
| `cli/tests/test_crud_rotina_template.py` | Live proof of block/force/no-cascade/orphan-shape | ✓ VERIFIED | 4 new tests present; 2 of the 4 (the block-by-default and force-orphan-shape tests) run live by this verifier, both PASSED |
| `cli/tests/test_rotina_instancia.py` | Live proof of limpar-orfas precision + production cleanup | ✓ VERIFIED | Tests present; 2 run live by this verifier, both PASSED. The production-cleanup test (`test_limpar_orfas_confirmar_removes_real_production_residue_success_criterion_3`) not re-run directly (it performs a real, one-time destructive action already executed once in 30-01 — re-running it is idempotent per its own design, but this verifier instead validated its outcome directly via a fresh `limpar-orfas` call, see Truth 4) |
| `cli/tests/test_cli_surface.py` | `EXPECTED_SURFACE["instanciasRotina"]` extended | ✓ VERIFIED | Line 49: `{"listar", "status", "limpar-orfas"}` |
| `cli/tests/test_routine_job.py` | Renamed command-set assertion | ✓ VERIFIED | `test_instancia_command_set_is_exactly_listar_status_and_limpar_orfas` present; old name absent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `deletar`'s `--force` guard | `_count_linked_instances`'s reverse-link query | `client.query({"templatesRotina": {"instancias": {}, "$": {"where": {"id": eid}}}})` | ✓ WIRED | Confirmed by direct source read, lines 446-454 |
| `limpar_orfas` | forward-link orphan filter | `client.query({"instanciasRotina": {"template": {}, ...}}); orphans = [r for r in rows if not r.get("template")]` | ✓ WIRED | Confirmed by direct source read, lines 584-588 |
| 8 e2e spec files' `rotina template deletar` calls | `deletar --force/--no-force` (plan 30-01) | `--force` appended to every `apolloCli([...])` invocation | ✓ WIRED | Re-verified by this verifier via direct grep/read, not trusted from SUMMARY |
| 5 e2e spec files' `sweepLeftovers()` | `sweepInstancesByDedupeKeyPrefix` | `await sweepInstancesByDedupeKeyPrefix(PREFIX, OWNER_EMAIL)` | ✓ WIRED | Confirmed by direct grep — each of the 5 files calls it with its own file-scoped `PREFIX`/`OWNER_EMAIL` constants |

### Behavioral Spot-Checks (live, run directly by this verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Block-by-default with exact count | `pytest tests/test_crud_rotina_template.py -k test_deletar_with_linked_instances_blocks_by_default_with_exact_count` | 1 passed | ✓ PASS |
| `--force` deletes without cascade, orphan shape proven | `pytest tests/test_crud_rotina_template.py -k test_deletar_with_force_deletes_template_and_orphans_linked_instance` | 1 passed | ✓ PASS |
| `limpar-orfas` lists-only, zero writes | `pytest tests/test_rotina_instancia.py -k test_limpar_orfas_lists_orphan_without_confirmar_writes_nothing` | 1 passed | ✓ PASS |
| `limpar-orfas --confirmar` orphan-only precision | `pytest tests/test_rotina_instancia.py -k test_limpar_orfas_confirmar_deletes_only_orphans_leaves_valid_linked_instance_untouched` | 1 passed | ✓ PASS |
| Production account currently holds zero orphans | `apollo rotina instancia limpar-orfas` (real account, list-only, no `--confirmar`) | `{"confirmado": false, "count": 0, "orphans": []}` | ✓ PASS |
| `deletar --help` documents `--force` + orphan consequence | `apollo rotina template deletar --help` | contains `--force`, "orphans", exit-code-5 note | ✓ PASS |
| `limpar-orfas --help` documents `--confirmar` + orphan definition | `apollo rotina instancia limpar-orfas --help` | contains `--confirmar`, orphan definition | ✓ PASS |
| CLI offline suite | `cd cli && uv run pytest -m "not live and not packaging"` | 402 passed, 2 skipped, 99 deselected | ✓ PASS |
| Web typecheck | `cd web && bun run check` | 929 files, 0 errors | ✓ PASS |
| Web lint | `cd web && bun run lint` | exit 0, warnings in unrelated files only | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LIFE-01 | 30-01 | `deletar` blocks by default on linked instances, exact count, explicit flag to proceed | ✓ SATISFIED | Truths 1-2 above; live-verified |
| LIFE-02 | 30-01 | Dedicated command to find/remove orphaned instances, strictly cleanup scope, no `criar`/`deletar` reopened | ✓ SATISFIED | Truth 3 above, plus `instancia` command set structurally confirmed to be exactly `{listar, status, limpar-orfas}` (test_cli_surface.py:49, test_rotina_instancia.py, test_routine_job.py all pass) |
| LIFE-03 (revised scope, decision 4/D-04) | 30-02 | Test writes never appear in production data listing again — delivered via reliable same-app sweep instead of a second InstantDB app | ✓ SATISFIED | Truths 5-6 above. Note: REQUIREMENTS.md's LIFE-03 checkbox (line 147) is still `[ ]` and its bullet text still describes the ORIGINAL (pre-revision) scope — a dedicated test `app_id`. This is a documentation-currency gap, not a functional gap: the revision note at REQUIREMENTS.md lines 54-62 explicitly records the scope change and supersedes the stale bullet in spirit. Flagged below as a non-blocking documentation note, not a verification failure, since the actual delivered mechanism (same-app sweep) matches the CONTEXT.md-recorded, user-approved revision exactly. |

**Note on requirements-document hygiene (non-blocking):** `.planning/REQUIREMENTS.md` line 147's LIFE-03 checkbox remains unchecked and its literal bullet text (`"...passam a rodar contra um app_id de teste dedicado..."`) was not rewritten to match the revised scope, even though the explicit revision note two sections above it (lines 54-62) documents the change accurately. `ROADMAP.md`'s Phase 30 heading checkbox (line 36) and plan 30-02's checkbox (line 191) are also still `[ ]`. This looks like bookkeeping that was deferred to phase-completion/milestone-close tooling rather than a sign the work is incomplete — every functional truth this checkbox would gate is independently, live-verified above. Recommend updating these three checkboxes as part of closing this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | none found | — | `grep -n -E "TBD|FIXME|XXX"` across all 21 phase-touched source/test files returned zero matches |

### Code Review Cross-Check

`30-REVIEW.md` (iteration 2, final) reports `status: clean`, 0 critical/warning/info findings, after confirming both iteration-1 warnings (WR-01: exit code collision, WR-02: shared PREFIX race) were genuinely fixed — independently re-confirmed by this verifier via direct source read (exit code 5, distinct non-overlapping `PREFIX` constants across all 3 files sharing `sweepInstancesByDedupeKeyPrefix`).

### Human Verification Required

None. Every truth was verifiable either by direct code inspection (structural guarantees like "cannot delete a non-orphan") or by running the actual live test/CLI command directly against the real production account — no truth in this phase depends on subjective/visual/UX judgment.

### Gaps Summary

No gaps found. All 4 ROADMAP Success Criteria and LIFE-01/02/03 are independently verified against the current codebase and a live production account, not merely inferred from SUMMARY.md. The one documentation-currency note (REQUIREMENTS.md/ROADMAP.md checkboxes not yet checked for LIFE-03/Phase 30/30-02) is recorded above as informational — it does not reflect a functional gap and does not change the verdict.

---

_Verified: 2026-09-22T21:40:00Z_
_Verifier: Claude (gsd-verifier)_
