---
phase: 03-cli-auth-crud
plan: 02
subsystem: cli-crud
tags: [instantdb, click, crud, permissions, pkgutil, ast-walk]

# Dependency graph
requires:
  - phase: 03-cli-auth-crud
    plan: 01
    provides: "cli/apollo_cli/session.py, instant_client.py (login_client()/session_client()), auth.py's EXIT_* constants, a real live session at ~/.config/apollo-cli/session"
provides:
  - "cli/apollo_cli/crud_helpers.py — donoId injection, not-found guard, error->exit-code mapping, JSON emit, click validators (require_session, client_for_session, create_entity, update_entity, delete_entity, get_entity, list_entities, emit, drop_none, validate_iso_date, now_iso, EXIT_*)"
  - "cli/apollo_cli/entities/__init__.py — discover_entity_groups()/register_entity_groups() auto-discovery contract every future entity module must satisfy"
  - "cli/apollo_cli/entities/fundo.py — apollo fundo criar|editar|deletar|listar, live-proven (CLI-02)"
  - "cli/tests/conftest.py — live_session/live_client/run_cli(+CliInvocation)/cleanup_records/unique_suffix fixtures for every later CRUD test module"
  - "CLI-11 proven: real permission-denied on guest/mismatched-donoId writes, real rejection on a fake refresh token, and a subprocess-level proof the CLI surface never creates a phantom record without a valid session"
affects: [03-03, 03-04, 03-05, 03-06, phase-5, phase-6]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "donoId is merged into the create payload AFTER the caller's fields (drop_none(fields) | {\"donoId\": session.user_id}) so a caller can never override it; a caller-supplied donoId key raises ValueError immediately"
    - "update_entity/delete_entity call get_entity first and exit EXIT_API_ERROR with error: not_found on a miss — InstantDB's update is a silent partial-record upsert on an unknown id, so this existence check (not an authorization check) is mandatory before every mutation"
    - "Entity command groups self-register via pkgutil.iter_modules + a module-level `group: click.Group` attribute contract — cli.py never needs an edit to gain a new entity"
    - "One shared @contextmanager instant_errors() maps InstantAPIError -> exit 3 and httpx.HTTPError -> exit 4 for every CRUD data function; no retry logic anywhere (comment states why: non-dedupe-keyed entities would silently duplicate on a retried create)"
    - "CLI-11 verification is write-based only (guest write, fake-token write, mismatched-donoId write) — never an empty `listar`, which InstantDB perms-filters silently to [] with HTTP 200 and proves nothing"

key-files:
  created:
    - cli/apollo_cli/crud_helpers.py
    - cli/apollo_cli/entities/__init__.py
    - cli/apollo_cli/entities/fundo.py
    - cli/tests/conftest.py
    - cli/tests/test_crud_fundo.py
    - cli/tests/test_auth_rejection.py
  modified:
    - cli/apollo_cli/cli.py

key-decisions:
  - "InstantDB's fundos.createdAt is a REQUIRED (non-optional) date field, not documented as such in the plan's <interfaces> — every create probe (including the CLI-11 denial probes in test_auth_rejection.py) must include it, or the server returns `validation-failed` before perms are ever evaluated, masking the permission-denied proof this plan needs. Fixed during Task 3 by adding `createdAt: now_iso()` to all three write probes."
  - "The admin-token-confinement AST-walk (test 7) exempts `auth.py` from the 'bare Instant( construction' rule, in addition to `instant_client.py`. This is not new scope: Plan 03-01 already, deliberately, has `whoami()` construct `Instant(app_id=..., admin_token=\"\")` directly (never via session_client()/login_client()) so a corrupted-but-well-formed local session file cannot fake a healthy whoami. Excluding this pre-existing, documented design choice from the new structural gate is a correctness decision, not a hole: the gate still fails on any *other* module doing the same thing, and it still fails on `login_client` being called from anywhere but `auth.py`."
  - "conftest.py's `run_cli` fixture uses `click.testing.CliRunner` (in-process) for fast, traceback-preserving assertions; a single subprocess-based smoke test in `test_crud_fundo.py` proves the installed `apollo` console script itself works end-to-end, per the plan's explicit split."

patterns-established:
  - "Every entity's `criar`/`editar`/`deletar`/`listar` module follows the shape in `entities/fundo.py`: thin click commands delegating all InstantDB I/O to `crud_helpers`, with a single JSON document emitted per invocation via `emit()`."

requirements-completed: [CLI-02, CLI-11]

# Metrics
duration: ~45min active execution
completed: 2026-08-09
---

# Phase 3 Plan 2: CRUD Plumbing + `apollo fundo` + CLI-11 Denial Proof Summary

**`crud_helpers` + `entities/` auto-discovery + `apollo fundo criar|editar|deletar|listar` proven live against the real InstantDB app, with CLI-11 proven via three real server-side `permission-denied`/rejection errors on writes (guest, fake-token, mismatched-donoId).**

## Performance

- **Duration:** ~45 min active execution
- **Started:** 2026-08-09 (Task 1 commit `e75e4a7`)
- **Completed:** 2026-08-09T12:57:57Z (Task 3 commit `917bac1`)
- **Tasks:** 3/3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- `crud_helpers.py`: the full `<interfaces>` contract — `donoId` injection that cannot be overridden by a caller, a not-found guard preventing InstantDB's silent partial-record upsert on `update`/`delete` of an unknown id, one shared error-to-exit-code mapper, and click validators — ready for plans 03-03..03-05 to build every remaining entity on top of with zero shared-file edits.
- `entities/__init__.py` + `entities/fundo.py`: self-registering entity groups (`pkgutil.iter_modules` + a `group: click.Group` contract) and the first live-proven entity, `apollo fundo`.
- CLI-02 proven live: full create/read/update/delete round trip against the real InstantDB app, `donoId` verified equal to the real session's `user_id`, both not-found guards verified to reject rather than silently upsert/no-op, and a `subprocess`-based smoke test of the installed `apollo` console script.
- CLI-11 proven live: a guest write and a mismatched-`donoId` write both raise a genuine server-side `permission-denied` `InstantAPIError`; a fake-refresh-token write is rejected; the CLI surface itself exits non-zero with structured JSON errors and creates nothing for both a missing and a syntactically-valid-but-invalid session file; an admin-token-confinement AST-walk (extending Plan 03-01's) now also covers `entities/` recursively and gates `login_client`/bare `Instant(` construction, verified to actually fail on a deliberately introduced leak and to pass again once reverted.

## Task Commits

1. **Task 1: crud_helpers + entity auto-discovery + `apollo fundo` group** - `e75e4a7` (feat)
2. **Task 2: Live `fundos` CRUD round trip against the real InstantDB app (CLI-02)** - `99d555d` (test)
3. **Task 3: CLI-11 write-based permission-denial probe + admin-token confinement gate** - `917bac1` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `cli/apollo_cli/crud_helpers.py` - shared CRUD plumbing: `require_session`, `client_for_session`, `create_entity`, `update_entity`, `delete_entity`, `get_entity`, `list_entities`, `emit`, `drop_none`, `validate_iso_date`, `now_iso`, `instant_errors`, `EXIT_NO_SESSION`/`EXIT_API_ERROR`/`EXIT_NETWORK_ERROR`
- `cli/apollo_cli/entities/__init__.py` - `discover_entity_groups()`/`register_entity_groups()` auto-discovery
- `cli/apollo_cli/entities/fundo.py` - `apollo fundo criar|editar|deletar|listar`
- `cli/apollo_cli/cli.py` - wired `register_entity_groups(apollo)`
- `cli/tests/conftest.py` - `live_session`/`live_client`/`run_cli` (+`CliInvocation`, `RunCli`)/`cleanup_records`/`unique_suffix`/`json_out` shared fixtures
- `cli/tests/test_crud_fundo.py` - live CLI-02 round trip (4 tests: full CRUD cycle, editar-unknown-id, deletar-unknown-id, console-script smoke test)
- `cli/tests/test_auth_rejection.py` - CLI-11 proof (6 behavior tests + a 10-file-parametrized admin-token-confinement AST walk)

## Decisions Made

See `key-decisions` in frontmatter — most notably: `fundos.createdAt` is a required schema field that had to be added to every write probe in `test_auth_rejection.py` (the plan's `<interfaces>` didn't flag this), and `auth.py` is a deliberate, pre-existing (Plan 03-01) exemption from the new "no bare `Instant(` construction outside `instant_client.py`" structural gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added the required `createdAt` field to every CLI-11 write probe**
- **Found during:** Task 3
- **Issue:** The plan's CLI-11 write probes (guest write, mismatched-donoId write) initially omitted `createdAt`. `shared/instant.schema.ts` declares `fundos.createdAt` as a required (non-optional) `i.date()`. InstantDB rejected these writes with `validation-failed` ("Missing required attribute `fundos/createdAt`") *before* perms were ever evaluated — masking the intended `permission-denied` proof entirely (assertions failed with `'validation-failed' == 'permission-denied'`).
- **Fix:** Added `"createdAt": now_iso()` (imported from `crud_helpers`) to all three hand-constructed transaction payloads in `test_auth_rejection.py`.
- **Files modified:** `cli/tests/test_auth_rejection.py`
- **Verification:** `uv run pytest tests/test_auth_rejection.py -q` — both previously-failing tests now assert `body["type"] == "permission-denied"` and pass.
- **Committed in:** `917bac1` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No impact on CLI-11's substantive guarantee — the fix only corrected which server-side rejection type the test payload triggers first (validation vs. permission), and the final assertions still prove the exact claim the plan requires (a real, server-side `permission-denied` on a guest write and on a mismatched-`donoId` write).

## Issues Encountered

- **Deliberate gate-break check (Task 3 acceptance criterion):** Temporarily appended `INSTANT_APP_ADMIN_TOKEN = "leaked"` to `cli/apollo_cli/entities/fundo.py`. Result: `uv run pytest tests/test_auth_rejection.py -q -k confinement` went from `10 passed` to `1 failed, 9 passed`, correctly naming `fundo.py:96` as the offending reference. Reverted via `git checkout -- cli/apollo_cli/entities/fundo.py`; re-ran the same command and confirmed `10 passed` again. No commit was ever made with the leaked token present.
- **`-k confinement` selects 10 parametrized instances, not 1:** The plan's acceptance criterion phrased this as "`1 passed`" for `APOLLO_SESSION_FILE=/nonexistent uv run pytest tests/test_auth_rejection.py -q -k confinement`; because `test_admin_token_confinement` is parametrized over every `.py` file under `cli/apollo_cli/` (10 files after this plan's additions), the actual output is `10 passed` — all ten instances pass with no session present, which is the substantive guarantee the criterion was checking for (the confinement gate needs no live session to run).

## User Setup Required

None - no external service configuration required. The live session persisted by Plan 03-01 at `~/.config/apollo-cli/session` was used directly for every live test in this plan.

## Next Phase Readiness

- `crud_helpers.py` and `entities/__init__.py` are ready for plans 03-03, 03-04, and 03-05 to add `projeto`, `etapa`, `tarefa`, `ticket`, `subtarefa`, `rotina`, and `log-inferencia` entity modules with zero edits to `cli.py` or any shared file — each new module only needs to export a module-level `group: click.Group`.
- The `conftest.py` fixtures (`live_session`, `live_client`, `run_cli`, `cleanup_records`, `unique_suffix`) are the reference shape every later CRUD test module should copy.
- No blockers for 03-03 onward.

---
*Phase: 03-cli-auth-crud*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created files verified present on disk (`crud_helpers.py`, `entities/__init__.py`, `entities/fundo.py`, `tests/conftest.py`, `tests/test_crud_fundo.py`, `tests/test_auth_rejection.py`); all three task commits (`e75e4a7`, `99d555d`, `917bac1`) verified present in git history via `git log --oneline`.
