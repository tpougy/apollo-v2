---
phase: 03-cli-auth-crud
plan: 06
subsystem: cli-verification
tags: [click, pytest, ast, verification, phase-closeout]

# Dependency graph
requires:
  - phase: 03-cli-auth-crud
    provides: "All of 03-01..03-05: apollo auth, crud_helpers.py, entities/ auto-discovery, and full CRUD/list+status/append-only surfaces for all 9 schema entities"
provides:
  - "cli/tests/test_cli_surface.py — schema-driven CLI coverage assertion (parses shared/instant.schema.ts, no hand-maintained entity list), help-completeness walk, click.echo-emits-JSON-only AST scan, zero-suppression gate"
  - ".planning/phases/03-cli-auth-crud/verify-phase-03.sh — one-command, idempotent, cwd-independent re-proof of CLI-01..CLI-11 plus C-08 quality gates against the live InstantDB app"
  - "cli/README.md — operator documentation: two-step auth flow, session security contract, admin-token confinement, JSON output + exit-code table, full command surface, verification instructions"
  - "Zero lint/type suppressions across cli/ (3 pre-existing noqa/type:ignore comments removed and replaced with real fixes)"
affects: ["04-web-spa-crud (parity reference)", "05-idempotent-job (attaches gerar-instancias to the existing rotina group; verify-phase-03.sh is the regression backstop)", "06-verification (VERIFY-02/VERIFY-03 reuse this script and the ruff/ty scope)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema-entity-name extraction via a formatting-locked regex (^\\s{4}(\\w+): i\\.entity\\() over shared/instant.schema.ts, asserting >=9 matches so a schema reformat breaks the test loudly instead of silently matching zero"
    - "EXPECTED_SURFACE: dict[str, tuple[list[str], set[str], bool]] as the single hand-maintained mapping from schema entity to (click command path, required command names, exact-match flag) — exact match for instanciasRotina/logInferenciaClaude, subset-or-equal for the other 7"
    - "click command-tree walk via group.commands (not CliRunner --help parsing) for both the coverage test and the help-completeness test — structural, no subprocess, no session"
    - "click.echo(...) AST scan restricted to entities/*.py + crud_helpers.py + auth.py (not the whole package) — cli.py's `doctor` command is a deliberate plain-text diagnostic, not part of the JSON-output CRUD contract"
    - "Suppression-count self-exclusion: the gate's own source builds its marker strings from string-literal concatenation so grepping/AST-scanning the codebase for '# noqa'/'# type: ignore' never matches the test file that defines those markers"

key-files:
  created:
    - cli/tests/test_cli_surface.py
    - .planning/phases/03-cli-auth-crud/verify-phase-03.sh
  modified:
    - cli/README.md
    - cli/apollo_cli/entities/__init__.py
    - cli/apollo_cli/bizdays.py
    - cli/tests/conftest.py
    - cli/apollo_cli/entities/fundo.py
    - cli/apollo_cli/entities/etapa.py
    - cli/apollo_cli/entities/projeto.py
    - cli/apollo_cli/entities/tarefa.py
    - cli/apollo_cli/entities/ticket.py
    - cli/apollo_cli/entities/subtarefa.py

key-decisions:
  - "EXPECTED_USER_ID is pinned as adf0d402-06df-4406-a5c7-ce82ee1bcb7e in verify-phase-03.sh, sourced from 03-01-SUMMARY.md/03-01-LOGIN-EVIDENCE.md (tp@rbrasset.com.br) — matches the plan's drift-guard convention from verify-phase-02.sh's EXPECTED_HOLIDAY_COUNT."
  - "The zero-suppression must-have (C-08) forced three real fixes to pre-existing 03-01/03-02 code rather than accepting the gate as aspirational: entities/__init__.py now raises TypeError (satisfies ruff TRY004 without a noqa), tests/conftest.py's cleanup teardown catches (InstantAPIError, httpx.HTTPError) and logs via logging.debug instead of a blind except/continue (satisfies BLE001/S112), and bizdays.py narrows the vendored JSON payload's 'holidays' value via an explicit isinstance(..., list) check instead of a type: ignore[arg-type]. All three were verified: ruff/ruff-format/ty all still pass, and the full cli/ suite (325 tests, 2 pre-existing unrelated skips) still passes after the changes."
  - "Six deletar() docstrings (fundo/etapa/projeto/tarefa/ticket/subtarefa) were under the plan's 20-character help-text threshold ('Delete a fundo.' etc.) — expanded to '...permanently. This cannot be undone.' to satisfy the coverage test's help-completeness check without changing behavior."
  - "The click.echo()-emits-JSON-only AST scan is scoped to entities/*.py + crud_helpers.py + auth.py, not the whole apollo_cli package — cli.py's `doctor` command deliberately prints human-readable plain text (env file path, masked app id, admin-token presence) as a developer diagnostic, not a JSON-per-command CRUD response, and was never claimed to be part of that contract."
  - "verify-phase-03.sh's CLI-11 section runs the existing test_auth_rejection.py pytest module AND an independent, freestanding live guest-write probe invoked directly via `uv run --project cli python -` — a second, script-level proof that does not depend on the pytest module having actually exercised the network."

patterns-established:
  - "A phase-closeout verification script is idempotent by construction when every live probe it performs either (a) is guarded by an existence check before writing, (b) is denied by permission rules and creates nothing, or (c) is cleaned up by the same fixtures the underlying pytest modules already use — verify-phase-03.sh adds no new live-write path beyond what 03-01..03-05's own test suites already prove clean."

requirements-completed: [CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, CLI-08, CLI-09, CLI-10, CLI-11]

# Metrics
duration: ~1h10min
completed: 2026-08-09
---

# Phase 03 Plan 06: Schema-Driven CLI Coverage Gate + One-Command Verification + Operator README Summary

**A single `verify-phase-03.sh` re-proves CLI-01..CLI-11 end-to-end against the live InstantDB app; `test_cli_surface.py` asserts every schema entity has its mandated CLI surface (parsed from `shared/instant.schema.ts`, not a hand-maintained list) with rich `--help` everywhere and zero lint/type suppressions; `cli/README.md` now documents the full auth/session/output/exit-code contract for an operator.**

## Performance

- **Duration:** ~1h10min
- **Tasks:** 2/2
- **Files created:** 2 (`cli/tests/test_cli_surface.py`, `verify-phase-03.sh`)
- **Files modified:** 8 (`cli/README.md` + 7 pre-existing source files touched by the zero-suppression/help-length fixes)

## Accomplishments

- `cli/tests/test_cli_surface.py`: 14 offline, session-free tests proving (1) every one of the 9 `shared/instant.schema.ts` entities resolves to its mandated `apollo` command path with the right command set (exact for `instanciasRotina`/`logInferenciaClaude`, at-least for the other 7), (2) every command and option in the whole `apollo` tree has real `--help` text (>= 20 chars), (3) every `click.echo(...)` in an entity module wraps `json.dumps(...)` (no stray plain-text output breaking the JSON contract), and (4) zero `# noqa`/`# type: ignore` markers remain anywhere in `cli/apollo_cli` or `cli/tests`.
- `.planning/phases/03-cli-auth-crud/verify-phase-03.sh`: one command, run twice in a row with `git status --porcelain` clean both times, from both the repo root and `/tmp`, that re-proves CLI-01 through CLI-11 plus the full C-08 quality-gate scope (`ruff check`, `ruff format --check`, `ty check` over `cli/` + `shared/scripts/`, plus the zero-suppression grep) and asserts no test-prefixed record survives in the live `fundos` table afterward.
- `cli/README.md`: new sections covering the two-step magic-code login flow, session file security (`0600`/`0700`, `APOLLO_SESSION_FILE` override), the admin token's confinement to `auth login` only, the JSON-stdout/JSON-stderr output convention with a full exit-code table, the entire command surface (flagging `instanciasRotina`'s list+status-only shape and `log-inferencia`'s append-only shape, and that `gerar-instancias` is Phase 5), and how to run `verify-phase-03.sh`.
- Fixed 3 pre-existing lint/type suppressions the new zero-suppression gate caught (see Deviations) and expanded 6 near-empty `deletar()` docstrings so every subcommand meets the plan's rich-`--help` threshold.

## Task Commits

1. **Task 1: Schema-driven CLI coverage and help-completeness test** - `0a6bdbe` (test)
2. **Task 2: verify-phase-03.sh and operator documentation** - `82e0b17` (feat)

## Files Created/Modified

- `cli/tests/test_cli_surface.py` - schema-driven coverage, help completeness, JSON-output-convention AST scan, zero-suppression gate (14 tests)
- `.planning/phases/03-cli-auth-crud/verify-phase-03.sh` - one-command CLI-01..CLI-11 + quality-gate + no-junk-left-behind proof (245 lines)
- `cli/README.md` - added Autenticação, Sessão, admin-token-confinement, Saída e códigos de saída, Superfície de comandos, Verificação sections
- `cli/apollo_cli/entities/__init__.py` - `discover_entity_groups()` now raises `TypeError` (was `RuntimeError` + `# noqa: TRY004`)
- `cli/apollo_cli/bizdays.py` - explicit `isinstance(_holidays_raw, list)` narrowing replaces a `# type: ignore[arg-type]` on the `Calendar(holidays=...)` construction
- `cli/tests/conftest.py` - `cleanup_records`'s teardown now catches `(InstantAPIError, httpx.HTTPError)` and logs via `logging.debug` instead of a blind `except Exception: continue` (was `# noqa: BLE001, S112`)
- `cli/apollo_cli/entities/{fundo,etapa,projeto,tarefa,ticket,subtarefa}.py` - `deletar()` docstrings expanded from e.g. `"Delete a fundo."` (16 chars) to `"Delete a fundo permanently. This cannot be undone."` (>= 20 chars)

## Final `apollo --help` command tree (verbatim)

```
Usage: apollo [OPTIONS] COMMAND [ARGS]...

  Apollo v2 command-line interface.

  This is the AI-operated channel for Apollo v2, with full parity with the web
  SPA: every write available in the browser is also available here.

  `auth` (login, logout, whoami) is available. Every entity subcommand group
  (fundo, projeto, etapa, tarefa, ticket, subtarefa, rotina, log-inferencia)
  is auto-discovered from `apollo_cli/entities/` as each module lands — no
  edit to this file is required per new entity, see
  `apollo_cli.entities.register_entity_groups`.

Options:
  --version  Show the version and exit.
  --help     Show this message and exit.

Commands:
  auth            Magic-code authentication: login, logout, whoami.
  doctor          Check that the repo-root `.env.instantdb` file resolves...
  etapa           Manage `etapas` (sequenced phases within a `projeto`).
  fundo           Manage `fundos` (investment funds this user administers...
  log-inferencia  Append-only audit trail of values Claude inferred and...
  projeto         Manage `projetos` (structured, non-recurring work...
  rotina          Manage recurring-routine templates (`templatesRotina`)...
  subtarefa       Manage `subtarefas` (checklist items belonging to...
  tarefa          Manage `tarefas` (concrete work items within an `etapa`).
  ticket          Manage `tickets` (ad-hoc inbound demands, typically...
```

Exactly the 9 groups the plan's must-have requires (`auth`, `doctor`, `fundo`, `log-inferencia`, `projeto`, `rotina`, `subtarefa`, `tarefa`, `ticket`) plus `etapa` and `ticket` — 9 total, no leftover placeholder.

## Pinned `EXPECTED_USER_ID`

`adf0d402-06df-4406-a5c7-ce82ee1bcb7e` (`tp@rbrasset.com.br`) — sourced verbatim from `03-01-SUMMARY.md` / `03-01-LOGIN-EVIDENCE.md`'s real magic-code round trip. `verify-phase-03.sh`'s CLI-01 section asserts `apollo auth whoami` reports exactly this id on every run, without ever sending a new magic code.

## Fail-Loud Demonstrations

**1. Coverage test (Task 1 acceptance criterion):**
- Renamed `cli/apollo_cli/entities/etapa.py` → `etapa.py.bak`.
- `APOLLO_SESSION_FILE=/nonexistent uv run pytest tests/test_cli_surface.py -q -k coverage` → `1 failed, 8 passed, 5 deselected`, failure explicitly naming `test_schema_entity_coverage[etapas]` with `apollo etapa does not resolve (available under apollo: ['auth', 'doctor', 'fundo', 'log-inferencia', 'projeto', 'rotina', 'subtarefa', 'tarefa', 'ticket'])`.
- Restored the file; re-ran: `9 passed, 5 deselected`.

**2. Help-text test (Task 1 acceptance criterion):**
- Temporarily blanked `--nome`'s help string in `cli/apollo_cli/entities/fundo.py` to `help=""`.
- `APOLLO_SESSION_FILE=/nonexistent uv run pytest tests/test_cli_surface.py -q -k option` → `1 failed`, naming `apollo fundo criar ['--nome']`.
- Restored the file; re-ran full `test_cli_surface.py`: `14 passed`.

**3. Permission gate / whole-script fail-loud (Task 2 acceptance criterion):**
- `chmod 644 ~/.config/apollo-cli/session`, re-ran `verify-phase-03.sh` → exit 1, output `FAIL: session file mode is 644, expected 600`, **no** `PHASE 03 VERIFIED` line.
- `chmod 600 ~/.config/apollo-cli/session`, re-ran → `PHASE 03 VERIFIED`, exit 0.

## Exact command an operator runs to re-verify the phase

```bash
bash .planning/phases/03-cli-auth-crud/verify-phase-03.sh
```

(from the repo root, or from any other cwd — the script resolves its own location via `BASH_SOURCE[0]` and `cd`s to the repo root itself). Exits `0` and prints `PHASE 03 VERIFIED` as its final line only when every gate passes; confirmed green twice in a row and from `/tmp` during this plan's execution, with `git status --porcelain` clean after each run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Zero-suppression gate exposed 3 pre-existing lint/type suppressions that had to be genuinely fixed, not just asserted away**
- **Found during:** Task 1, while writing `test_zero_lint_or_type_suppressions`.
- **Issue:** `cli/apollo_cli/entities/__init__.py` (`# noqa: TRY004`), `cli/tests/conftest.py` (`# noqa: BLE001, S112`), and `cli/apollo_cli/bizdays.py` (`# type: ignore[arg-type]`) all pre-dated this plan (03-01/03-02) and would have failed the new zero-suppression must-have.
- **Fix:** `entities/__init__.py` now raises `TypeError` instead of `RuntimeError` (satisfies ruff's TRY004 "prefer TypeError for invalid-type checks" natively — no test in the codebase asserted the old exception type, so this is a safe, behavior-preserving change); `conftest.py`'s cleanup teardown now catches `(InstantAPIError, httpx.HTTPError)` specifically and logs via `logging.debug(...)` instead of a blind `except Exception: continue`; `bizdays.py` narrows the vendored calendar payload's `"holidays"` value with an explicit `isinstance(_holidays_raw, list)` check before constructing the `Calendar`, eliminating the need for a `type: ignore` on that call.
- **Files modified:** `cli/apollo_cli/entities/__init__.py`, `cli/tests/conftest.py`, `cli/apollo_cli/bizdays.py`.
- **Verification:** `uv run ruff check .`, `uv run ruff format --check .`, `uv run ty check .` all pass with zero suppressions remaining; full `cli/` suite re-run afterward: `325 passed, 2 skipped` (the 2 skips are pre-existing, unrelated to this change — `test_instant_client.py`'s admin-token-confinement exemptions for `config.py`/`instant_client.py`).
- **Committed in:** `0a6bdbe` (Task 1 commit)

**2. [Rule 2 - Missing critical functionality] Six `deletar()` docstrings were below the plan's 20-character help-text threshold**
- **Found during:** Task 1, first run of `test_every_command_has_rich_help_text`.
- **Issue:** `fundo.py`, `etapa.py`, `projeto.py`, `tarefa.py`, `ticket.py`, `subtarefa.py` all had a `deletar()` docstring of the shape `"Delete a fundo."` (16 chars) — below the plan's explicit 20-character minimum for "rich" `--help` text (C-07).
- **Fix:** Expanded each to `"Delete a <entity> permanently. This cannot be undone."` — no behavior change, longer and more informative help text for an operator about to run an irreversible command.
- **Files modified:** `cli/apollo_cli/entities/{fundo,etapa,projeto,tarefa,ticket,subtarefa}.py`.
- **Verification:** `test_every_command_has_rich_help_text` passes; full `cli/` suite still `325 passed, 2 skipped`.
- **Committed in:** `0a6bdbe` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical functionality required by this plan's own must-haves, not scope creep beyond it)
**Impact on plan:** No impact on the plan's substantive deliverables. Both fixes were required to make Task 1's own acceptance criteria (zero suppressions, rich help text) pass at all, and were folded into Task 1's single commit rather than becoming their own out-of-scope changes.

## Issues Encountered

- The click.echo()-JSON-only AST scan initially covered the whole `apollo_cli` package and immediately flagged `cli.py`'s `doctor` command (5 plain-text `click.echo(...)` calls) as violations. `doctor` is a deliberate human-readable diagnostic command (env file path, masked app id, admin-token presence), never claimed to emit JSON, and is not part of the entity CRUD surface the plan's `<interfaces>` output-convention note governs. Fixed by scoping the scan to `entities/*.py` + `crud_helpers.py` + `auth.py` only.
- The suppression-count test initially failed against itself: its own source necessarily contains the literal strings `"# noqa"` and `"# type: ignore"` in the module docstring/comments describing what it looks for, and `grep`-based logic in a heredoc comment triggered `RUF100` ("unused blanket noqa directive") from ruff parsing a comment as a real suppression directive. Fixed by rewording the offending comment and building the runtime marker strings from concatenated literals (`"#" + " noqa"`) so the source text never contains the literal substring, while `verify-phase-03.sh`'s shell-level grep independently excludes `cli/tests/test_cli_surface.py` by path.
- `grep -rn 'INSTANT_APP_ADMIN_TOKEN' cli/apollo_cli/` in an early draft of the CLI-11 script section produced noisy `grep: ... binary file matches` stderr lines from `__pycache__/*.pyc` files (harmless — pipes only carry stdout, so the binary matches never reached the `if` condition — but confusing to read). Fixed by adding `--include='*.py'` to the grep.

## User Setup Required

None — no external service configuration required. The live session persisted by plan 03-01 at `~/.config/apollo-cli/session` was used directly for every live gate in `verify-phase-03.sh` and every live pytest module it invokes.

## Next Phase Readiness

- Phase 3 is closed: `bash .planning/phases/03-cli-auth-crud/verify-phase-03.sh` is the one-command regression backstop for Phases 4, 5, and 6 to re-run whenever CLI behavior might have drifted.
- Phase 5's `apollo rotina gerar-instancias` will attach directly to the existing `rotina` group (per 03-05's readiness note) — `test_cli_surface.py`'s `instanciasRotina` exact-match check will need its `EXPECTED_SURFACE` entry updated at that point only if the *instancia* sub-group's command set changes (it should not; `gerar-instancias` attaches to `template`/`rotina` top-level scope, not `instancia`).
- Phase 4 (web SPA) has `cli/README.md`'s "Superfície de comandos" and "Saída e códigos de saída" sections as a direct parity reference for what the browser client must also support.
- Phase 6's VERIFY-02/VERIFY-03 can reuse `verify-phase-03.sh` verbatim and the exact `ruff check --config pyproject.toml . ../shared/scripts` / `ty check . ../shared/scripts` invocations already proven here.
- No blockers.

---
*Phase: 03-cli-auth-crud*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created/modified files verified present on disk (`cli/tests/test_cli_surface.py`, `.planning/phases/03-cli-auth-crud/verify-phase-03.sh`, `cli/README.md`); both task commits (`0a6bdbe`, `82e0b17`) verified present in `git log --oneline --all`.
