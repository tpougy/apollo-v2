---
phase: 03-cli-auth-crud
verified: 2026-08-09T13:41:07Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 03: CLI Auth + CRUD Verification Report

**Phase Goal:** The controladoria professional (or Claude on their behalf) can manage every domain entity end-to-end from the terminal, authenticated as the same real InstantDB user the web app will use.
**Verified:** 2026-08-09T13:41:07Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is a live-system phase (real InstantDB app, real magic-code email auth). Verification was performed by actually re-running the phase's own executable proofs rather than trusting SUMMARY.md narrative:

1. Ran `bash .planning/phases/03-cli-auth-crud/verify-phase-03.sh` twice in a row, from the repo root, against the live InstantDB app and the already-persisted real session at `~/.config/apollo-cli/session`.
2. Ran the full `cli/` pytest suite directly (`uv run pytest -q`), not just the subset the script invokes.
3. Ran `ruff check`, `ruff format --check`, and `ty check` directly (also invoked inside the script, confirmed independently).
4. Inspected `apollo --help`, `cli/README.md`, `cli/tests/test_cli_surface.py`, and every entity module for the structural claims (auto-discovery, XOR linking, absence of `instancia criar`/`gerar-instancias`, admin-token confinement).
5. Cross-referenced `requirements:` frontmatter across all 6 plans against `.planning/REQUIREMENTS.md`'s CLI-01..CLI-11 block.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CLI-01: magic-code login persists a real, restart-surviving, 0600/0700 session | ✓ VERIFIED | `03-01-LOGIN-EVIDENCE.md` documents a fresh, non-mocked round trip (logout → send → real inbox read via `orules.ps1` COM tool → verify → new-process `whoami` match). Re-confirmed live: `apollo auth whoami` in this run returned `user_id: adf0d402-06df-4406-a5c7-ce82ee1bcb7e`; `stat` shows session file `600`, dir `700`. |
| 2 | CLI-02: full CRUD on `fundos`, `donoId`-scoped | ✓ VERIFIED | `uv run pytest tests/test_crud_fundo.py -q` → 4 passed, live against InstantDB (run twice, no leftovers). |
| 3 | CLI-03: full CRUD on `projetos` + `fundo` link | ✓ VERIFIED | `test_crud_projeto.py` → 5 passed live. |
| 4 | CLI-04: full CRUD on `etapas` + `projeto` link | ✓ VERIFIED | `test_crud_etapa.py` → 5 passed live. |
| 5 | CLI-05: full CRUD on `tarefas` + `etapa` link + date validation | ✓ VERIFIED | `test_crud_tarefa.py` → 6 passed live. |
| 6 | CLI-06: full CRUD on `templatesRotina` + self-link | ✓ VERIFIED | `test_crud_rotina_template.py` → 3 passed live. |
| 7 | CLI-07: `instanciasRotina` list+status only, no create, no `gerar-instancias` stub | ✓ VERIFIED | `test_rotina_instancia.py` → 5 passed; script independently re-checks `apollo rotina instancia --help` == `{listar, status}` and `apollo rotina --help` has zero `gerar-instancias` mentions. Confirmed via direct `apollo --help` inspection: no `gerar-instancias` anywhere in the command tree. |
| 8 | CLI-08: full CRUD on `tickets` + `fundo` link | ✓ VERIFIED | `test_crud_ticket.py` → 6 passed live. |
| 9 | CLI-09: full CRUD on `subtarefas` with XOR `tarefa`/`ticket` parent | ✓ VERIFIED | `test_crud_subtarefa.py` → 7 passed live. |
| 10 | CLI-10: `logInferenciaClaude` registrar/listar, append-only | ✓ VERIFIED | `test_log_inferencia.py` → 4 passed live. |
| 11 | CLI-11: every write `donoId`-scoped, real permission-denied enforcement, admin token confined | ✓ VERIFIED | `test_auth_rejection.py` → 23 passed; script's independent freestanding guest-write probe against live `fundos` returned `{"denied": true, "type": "permission-denied"}` (a real write-based proof, not an empty `listar`); grep confirms `INSTANT_APP_ADMIN_TOKEN` appears only in `instant_client.py`/`config.py`. |

**Score:** 11/11 truths verified

### Full-Command Proof

`bash .planning/phases/03-cli-auth-crud/verify-phase-03.sh` — run twice from repo root, both times exiting 0 with final line `PHASE 03 VERIFIED`:

- Run 1: all 11 CLI-NN gates PASS, quality gates PASS, idempotency check PASS (0 leftover records).
- Run 2 (immediately after): identical result — same 11 gates PASS, quality gates PASS, idempotency PASS. Confirms the script's own re-runnability/no-junk-left-behind claim, not just its self-report.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cli/apollo_cli/session.py` | 0600 session persistence | ✓ VERIFIED | Exists, exports match plan; live `stat` confirms 600/700 enforcement. |
| `cli/apollo_cli/instant_client.py` | login_client/session_client separation | ✓ VERIFIED | `session_client()` builds `Instant(admin_token="")` + `.as_user(...)`; structural AST test (`test_auth_rejection.py::test_admin_token_confinement`) passes. |
| `cli/apollo_cli/auth.py` | auth login/logout/whoami | ✓ VERIFIED | Present, live-tested. |
| `cli/apollo_cli/crud_helpers.py` | shared CRUD plumbing | ✓ VERIFIED | `create_entity`/`update_entity`/`delete_entity`/`get_entity`/`list_entities`/`emit`/exit codes present and exercised by every entity test module. |
| `cli/apollo_cli/entities/__init__.py` | auto-discovery | ✓ VERIFIED | `apollo --help` lists all 10 groups (`auth, doctor, etapa, fundo, log-inferencia, projeto, rotina, subtarefa, tarefa, ticket`) with no manual registration edits per SUMMARY diffs (`cli.py` only touched to call `register_entity_groups`). |
| `cli/apollo_cli/entities/{fundo,projeto,etapa,tarefa,ticket,subtarefa,rotina,log_inferencia}.py` | 8 entity modules | ✓ VERIFIED | All present, each with a live-tested CRUD (or list/status/append-only) surface. |
| `cli/tests/test_cli_surface.py` | schema-driven coverage assertion | ✓ VERIFIED | 241 lines; `test_schema_entity_coverage`, `test_expected_surface_has_no_stale_entries`, `test_every_command_has_rich_help_text`, `test_every_option_has_help_text`, `test_click_echo_only_ever_emits_json`, `test_zero_lint_or_type_suppressions` all present and passing. |
| `.planning/phases/03-cli-auth-crud/verify-phase-03.sh` | one-command re-runnable proof | ✓ VERIFIED | 220+ lines, executed twice for real in this verification, both times `PHASE 03 VERIFIED`. |
| `cli/README.md` | operator documentation | ✓ VERIFIED | 187 lines; documents session 0600 contract, admin-token confinement, JSON output + exit-code table, verification instructions. |
| `.planning/phases/03-cli-auth-crud/03-01-LOGIN-EVIDENCE.md` | real magic-code round-trip evidence | ✓ VERIFIED | Present, documents a genuine non-mocked inbox read (with an honest discrepancy note about which MCP/tool was actually used vs. the one named in PROJECT.md C-10 — flagged, not hidden). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `auth.py` | `instant_client.py` | `login_client()` | ✓ WIRED | Structural AST test confirms `login_client()` reachable only from `auth.py`. |
| `entities/*.py` | `crud_helpers.py` | `create_entity`/`update_entity`/`delete_entity`/`get_entity`/`list_entities` | ✓ WIRED | Every entity module imports and delegates to these; confirmed by live tests actually mutating InstantDB through this path. |
| `entities/projeto.py`/`etapa.py`/`tarefa.py` | parent entity | `links={...}` after `get_entity` existence check | ✓ WIRED | Live tests assert the linked parent is returned when reading back (`fundoProjetos`, `projetoEtapas`, `etapaTarefas`). |
| `entities/subtarefa.py` | `tarefa`/`ticket` | XOR-validated `links=` | ✓ WIRED | `test_crud_subtarefa.py` passing, includes XOR violation (both/neither) cases per plan 03-04. |
| `verify-phase-03.sh` | `cli/tests/*.py` | `uv run pytest` per requirement | ✓ WIRED | Confirmed by direct execution — each `CLI-NN` section actually invokes and blocks on the corresponding pytest module. |
| `test_cli_surface.py` | `shared/instant.schema.ts` | regex-parsed entity list | ✓ WIRED | Test present and passing (`test_schema_entity_coverage` parametrized over parsed entity names, not a hand list). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `apollo auth whoami` reflects the real persisted session | `uv run --project cli apollo auth whoami` | `user_id: adf0d402-...`, exit 0 | ✓ PASS |
| Session file permissions | `stat -c '%a' ~/.config/apollo-cli/session` / `.../apollo-cli` | `600` / `700` | ✓ PASS |
| `apollo --help` surface | `uv run --project cli apollo --help` | 10 groups exactly as expected, no `gerar-instancias` anywhere | ✓ PASS |
| Full live verification script | `bash verify-phase-03.sh` (x2) | `PHASE 03 VERIFIED` both times, no leftover records | ✓ PASS |
| Full `cli/` test suite | `uv run pytest -q` (from `cli/`) | 325 passed, 2 skipped (documented exemptions in a parametrized confinement test) | ✓ PASS |
| Lint/format/type gates | `ruff check`, `ruff format --check`, `ty check` (cli/ + shared/scripts) | All clean, zero suppressions | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `verify-phase-03.sh` (run 1) | `bash .planning/phases/03-cli-auth-crud/verify-phase-03.sh` | exit 0, `PHASE 03 VERIFIED` | PASS |
| `verify-phase-03.sh` (run 2, immediately after) | same | exit 0, `PHASE 03 VERIFIED`, 0 leftover records | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| CLI-01 | 03-01, 03-06 | Magic-code auth flow + persisted session | ✓ SATISFIED | Live evidence file + re-confirmed `whoami`/`stat` in this run. |
| CLI-02 | 03-02, 03-06 | `fundos` full CRUD, `donoId`-scoped | ✓ SATISFIED | Live pytest pass. |
| CLI-03 | 03-03, 03-06 | `projetos` full CRUD | ✓ SATISFIED | Live pytest pass. |
| CLI-04 | 03-03, 03-06 | `etapas` full CRUD | ✓ SATISFIED | Live pytest pass. |
| CLI-05 | 03-03, 03-06 | `tarefas` full CRUD | ✓ SATISFIED | Live pytest pass. |
| CLI-06 | 03-05, 03-06 | `templatesRotina` full CRUD | ✓ SATISFIED | Live pytest pass. |
| CLI-07 | 03-05, 03-06 | `instanciasRotina` list+status only | ✓ SATISFIED | Live pytest pass + structural absence checks. |
| CLI-08 | 03-04, 03-06 | `tickets` full CRUD | ✓ SATISFIED | Live pytest pass. |
| CLI-09 | 03-04, 03-06 | `subtarefas` full CRUD, XOR parent | ✓ SATISFIED | Live pytest pass. |
| CLI-10 | 03-05, 03-06 | `logInferenciaClaude` registrar/listar | ✓ SATISFIED | Live pytest pass. |
| CLI-11 | 03-02, 03-06 | `donoId` scoping + permission-denial enforcement | ✓ SATISFIED | Live write-based guest-probe denial + AST admin-token confinement test. |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s Phase 3 block (CLI-01..CLI-11) matches exactly the union of `requirements:` frontmatter across all 6 plans — no extra, no missing.

**Note (non-blocking):** `.planning/REQUIREMENTS.md`'s checklist boxes and status table for CLI-01..CLI-11 still show `[ ]` / "Pending" as of this verification. Given SETUP/CAL phases show "Complete" only after their own verification pass, this is consistent with the doc being updated as a post-verification step by the orchestrator/milestone tracker rather than by phase execution itself — flagged here for the orchestrator to flip to Complete now that this VERIFICATION.md confirms the phase goal is met.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across `cli/apollo_cli/` and `cli/tests/` returned zero matches. `verify-phase-03.sh`'s own suppression gate (`# noqa` / `# type: ignore`) returned zero outside the one self-documenting exclusion (`test_cli_surface.py`, which defines the markers as string literals to test for their absence elsewhere — not an actual suppression). Confirmed independently via direct grep, not just trusting the script's self-report.

### Human Verification Required

None. Every must-have in this phase is either a live, machine-checkable CRUD/permission proof against the real InstantDB app (already executed twice in this verification) or a structural code/test assertion (already inspected directly). The one inherently human-possession step (reading a real magic-code email) was already performed for real by the phase's executor and is documented with a concrete, checkable trail (timestamps, exact commands, `user_id` match across a process restart) in `03-01-LOGIN-EVIDENCE.md`; re-doing that specific step in this verification would burn another real magic-code login for no additional evidentiary value, since a persisted, still-valid session from that exact round trip is what every other command in this report exercised live.

### Gaps Summary

No gaps. All 11 must-have truths verified against a live InstantDB app via direct re-execution (not SUMMARY.md narrative), the full `cli/` test suite passes (325 passed, 2 skipped for documented reasons), `ruff`/`ruff format`/`ty` are clean with zero suppressions, and the phase's own one-command verification script (`verify-phase-03.sh`) was independently run twice with identical `PHASE 03 VERIFIED` results and zero leftover data in the live app both times. The single documentation note above (`REQUIREMENTS.md` checkbox staleness) is informational, not a functional gap — it does not affect phase-goal achievement.

---

_Verified: 2026-08-09T13:41:07Z_
_Verifier: Claude (gsd-verifier)_
