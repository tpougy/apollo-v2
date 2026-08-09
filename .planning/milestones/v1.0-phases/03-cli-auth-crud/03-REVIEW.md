---
status: clean
phase: 03-cli-auth-crud
reviewed: 2026-08-09
depth: standard
---

# Phase 03 Code Review — cli-auth-crud

## Scope

Reviewed every file in `cli/apollo_cli/` (auth, session, instant_client,
config, crud_helpers, cli, entities/__init__ + all 8 entity modules,
bizdays), `cli/README.md`, `cli/tests/test_auth_rejection.py`, and
`.planning/PROJECT.md` (constraints C-04, C-05, C-07, C-10). This is the
security-critical phase (real magic-code auth, real session credential
persistence, real `donoId` permission enforcement against a live InstantDB
app), so all seven mandated security checks were verified directly against
source and, where a claim was testable, against the enforcing test.

## Security focus — findings

1. **`INSTANT_APP_ADMIN_TOKEN` confinement** — PASS. Grepped the whole
   `apollo_cli/` package: the string appears only in `instant_client.py`
   (the sanctioned reader, used exclusively inside `login_client()`) and
   `config.py` (presence-only boolean, never the value, per its own
   docstring and `InstantConfig.admin_token_present`). No other module
   references it. This is enforced structurally, not just by convention:
   `tests/test_auth_rejection.py::test_admin_token_confinement` AST-walks
   every `.py` file under `apollo_cli/` and fails the build if the literal
   string, a `Name`, or an `Attribute` named `INSTANT_APP_ADMIN_TOKEN`
   appears outside the two exempt files, and separately fails if
   `login_client()` is called from anywhere but `auth.py`/`instant_client.py`
   itself, or if `Instant(...)` is constructed directly outside
   `instant_client.py`/`auth.py`.

2. **`session_client()` never falls back to env admin token** — PASS.
   `instant_client.py:62` calls `Instant(app_id=config.app_id,
   admin_token="")` — an explicit empty string, never `None`. The module's
   own docstring correctly explains why this matters (the SDK only reads
   `os.environ["INSTANT_APP_ADMIN_TOKEN"]` when `admin_token is None`), and
   `test_nonexistent_refresh_token_write_is_rejected` / the mismatched-donoId
   live test exercise this client end-to-end against the real app.

3. **Session file permissions** — PASS, verified in code, not just
   docstring. `session.py::save_session` creates the parent dir with
   `mkdir(mode=0o700, ...)`, then unconditionally re-asserts `os.chmod(path.parent,
   0o700)`; the file itself is opened via `os.open(path, os.O_WRONLY |
   os.O_CREAT | os.O_TRUNC, 0o600)` and the mode is reasserted with
   `os.chmod(path, 0o600)` after write. Both the directory and file modes are
   re-tightened on every call regardless of pre-existing looser permissions,
   matching the README's claim exactly.

4. **`donoId` never a CLI flag** — PASS. Grepped `entities/*.py` for
   `donoId`/`dono_id`/`dono-id`: zero matches anywhere in the entity layer.
   `crud_helpers.create_entity` injects `"donoId": session.user_id` itself
   and raises `ValueError` if a caller's `fields` dict already contains a
   `donoId` key (defense against a future caller regression, not just a
   missing flag). `update_entity` raises the same guard against `donoId` in
   an edit payload (ownership immutability). No `criar` command across
   `fundo`, `projeto`, `etapa`, `tarefa`, `ticket`, `subtarefa`, `rotina
   template`, or `log-inferencia` exposes an owner-id flag.

5. **Not-found guard before update/delete (anti-upsert-phantom)** — PASS.
   `crud_helpers.update_entity` and `delete_entity` both call `get_entity`
   first and exit with a JSON `not_found` error (`SystemExit(EXIT_API_ERROR)`)
   before ever calling `client.transact(...)`. This is the single shared
   choke point used by every entity module — no entity module bypasses
   `update_entity`/`delete_entity` to call `client.tx[...].update()`/`.delete()`
   directly. Parent-link ids (`--fundo-id`, `--projeto-id`, `--etapa-id`,
   `--tarefa-id`/`--ticket-id`, `--antecessor-id`) are independently
   validated via the same `get_entity` before being merged into `links`,
   guarding against dangling references (InstantDB doesn't validate link
   targets).

6. **No suppressions introduced** — PASS. Grepped `apollo_cli/` and
   `cli/tests/` for `# noqa`, `# type: ignore`, `# ty: ignore`, `# pragma`:
   zero matches. The `bizdays.py` diff (checked via `git diff` against the
   prior commit) is exactly what the task description anticipated: it
   *removes* a pre-existing `# type: ignore[arg-type]` on the `Calendar(...)`
   construction and replaces it with a genuine runtime `isinstance(...,
   list)` guard that raises `TypeError` on a malformed payload — a real fix,
   not a suppression, and no behavior change to the business-day algorithm
   itself (confirmed by reading the full file: `_parse_iso_date`,
   `_assert_in_range`, `add_business_days`, `next_business_day` are
   unchanged).

7. **`rotina instancia` / `log-inferencia` command surface restrictions** —
   PASS. `entities/rotina.py` defines only `instancia.command(name="listar")`
   and `instancia.command()` (named `status`, which updates *only* the
   `status` field — deliberately no `--data-prevista`/`--competencia` per
   its own docstring, protecting `dedupeKey` integrity) on the `instancia`
   group; no `criar`/`deletar` registered anywhere. `entities/log_inferencia.py`
   defines only `registrar` and `listar`; no `editar`/`deletar`. Both
   restrictions are load-bearing design decisions (idempotency key
   preservation for C-06; immutable audit trail) documented in the module
   docstrings and matched by the actual registered commands, not just
   claimed there.

## Other observations (non-blocking)

- `auth.py::whoami` deliberately constructs `Instant(app_id=..., admin_token="")`
  directly rather than going through `session_client()`, with an inline
  comment explaining why (unauthenticated `verify_token` endpoint, no
  impersonation). This is a documented, tested exemption
  (`_INSTANT_CONSTRUCTOR_EXEMPT_FILENAMES`), not an oversight.
- `crud_helpers.instant_errors()` deliberately has no retry logic, with a
  clear comment explaining that a hidden retry on a possibly-already-applied
  write could silently duplicate a record — sound reasoning for entities
  with no dedupe key.
- Error/exit-code contract (`EXIT_NO_SESSION=1`, `EXIT_API_ERROR=3`,
  `EXIT_NETWORK_ERROR=4`) is consistently re-exported and reused between
  `auth.py` and `crud_helpers.py` rather than duplicated/redefined.
- `save_session`/session file only ever contains `user_id`, `email`,
  `refresh_token` — no extraneous fields; `Session.refresh_token` is a
  `field(repr=False)` dataclass field, so an accidental `repr()`/log of a
  `Session` object won't leak the credential.

## Verdict

No security or correctness issues found across the seven mandated checks or
in general review of the CRUD plumbing, entity modules, session handling,
and the `bizdays.py` diff. All security-critical guarantees claimed in
`cli/README.md` and module docstrings are backed by actual code (and in the
admin-token and CLI-11 cases, by structural/live tests), not just comments.
Status: **clean**.
