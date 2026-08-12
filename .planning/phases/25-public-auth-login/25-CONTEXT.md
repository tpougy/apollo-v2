# Phase 25: Public Auth Login - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss) — milestone scope was fully specified by the user in conversation before this milestone was created; no open questions remain.

<domain>
## Phase Boundary

`apollo auth login` authenticates a real user via InstantDB's public `/runtime/auth/*` endpoints, and no CLI command — including login — reads or requires `INSTANT_APP_ADMIN_TOKEN` to operate normally, while `apollo doctor`/`admin_token_present` keep working unchanged for project-development support.

Covers requirements AUTH-01 through AUTH-05 (see `.planning/REQUIREMENTS.md`). Depends on Phase 24 (already complete): `config.py`'s new `app_id`/`app_id_source`/`env_file: Path | None` shape from Phase 24 is the foundation this phase builds auth on top of.

</domain>

<decisions>
## Implementation Decisions

Already decided in conversation with the user before this milestone was created:

1. **Replace, don't wrap.** `apollo auth login`'s send/verify magic-code flow stops using `client.auth.send_magic_code`/`check_magic_code` from the `instantdb` package (the Python "Admin SDK", which calls admin-only `/admin/send_magic_code`/`/admin/verify_magic_code`, requiring `INSTANT_APP_ADMIN_TOKEN`). It calls, via `httpx`, the public/client-facing endpoints directly:
   - `POST {api_uri}/runtime/auth/send_magic_code` — body `{"app-id": app_id, "email": email}`
   - `POST {api_uri}/runtime/auth/verify_magic_code` — body `{"app-id": app_id, "email": email, "code": code}`
   Both confirmed (source-verified against `instantdb/instant`'s own JS client, `client/packages/core/src/authAPI.ts` on GitHub) to require no Authorization header — only `content-type: application/json`. `api_uri` defaults to `https://api.instantdb.com`, matching the `instantdb` package's own default.
2. **No behavior change in CLI output.** `apollo auth login`'s JSON stdout/stderr shape, exit codes, and error messages (invalid code, expired code, network error) stay exactly as they are today — only the internal transport changes from the SDK's admin-authenticated call to a direct `httpx` call.
3. **`login_client()` in `instant_client.py` is no longer needed for login.** Audit its other call sites before deciding whether to delete it outright or keep it if something else legitimately still needs it — this codebase's convention is not to leave dead code around, so if nothing else calls it, remove it.
4. **`session_client()` is untouched** — already never carries an admin token (`admin_token=""` explicit, never falls back to env var), used after a successful login exactly as today.
5. **`INSTANT_APP_ADMIN_TOKEN` is not read anywhere in the CLI's operational path after this phase** — not just login. `admin_token_present`/`apollo doctor` (added in the codebase from day one, kept explicitly per user decision) remain the only code that references the `INSTANT_APP_ADMIN_TOKEN` *key name* (to check presence, never the value) — this is a project-development-support feature, not part of the operational auth path, and stays unchanged.
6. **Tests get stronger, not weaker.** `tests/test_auth_rejection.py`/`tests/test_instant_client.py`'s existing AST-walk structural gates (scanning for the literal string `"INSTANT_APP_ADMIN_TOKEN"` across `apollo_cli/*.py`, with `config.py`/`instant_client.py` as documented exemptions for the presence-check/admin-only-login-client code) need updating to reflect the new, stronger guarantee: the CLI never uses the admin token anywhere, not even during login. If `instant_client.py`'s exemption existed specifically to allow `login_client()`'s old admin-token usage, and `login_client()` is removed, that exemption should likely be removed too — audit and decide during planning/execution, documenting the reasoning.
7. **Scope is `cli/` only.** No changes to `web/` (already uses the client SDK JS, which already calls `/runtime/auth/*` natively), schema, or perms.
8. **`httpx` may be declared as an explicit direct dependency** in `cli/pyproject.toml` if the code now imports it directly (today it's only a transitive dependency of `instantdb`) — no other new dependency.
9. **Live verification required, admin-token-free.** Prove `apollo auth login`'s full magic-code round trip works for real with `INSTANT_APP_ADMIN_TOKEN` entirely absent from the test/dev environment — consistent with this project's standing live-verification convention (see PROJECT.md, C-10's magic-code-email-reading mechanism, already established across v1.0-v1.3).

</decisions>

<code_context>
## Existing Code Insights

Key files (read/confirmed during the discussion that led to this milestone and during Phase 24's execution, not re-derived here):
- `cli/apollo_cli/auth.py` — `apollo auth login|logout|whoami` command group; `login()` currently calls `login_client()` then `client.auth.send_magic_code(email)` / `client.auth.check_magic_code(email=email, code=code)`; JSON emit helpers `_emit`/`_emit_api_error`/`_emit_network_error`; exit codes `EXIT_NO_SESSION=1`, `EXIT_API_ERROR=3`, `EXIT_NETWORK_ERROR=4`.
- `cli/apollo_cli/instant_client.py` — `login_client()` (admin-token-bearing, currently used only by `auth.login`) and `session_client(session)` (never admin-token-bearing, used by every other authenticated operation).
- `cli/apollo_cli/config.py` — post-Phase-24 `load_instant_config()` returns `InstantConfig(app_id, app_id_source, env_file: Path | None, admin_token_present)`.
- `cli/tests/test_auth_rejection.py`, `cli/tests/test_instant_client.py` — AST-walk structural gates scanning for `"INSTANT_APP_ADMIN_TOKEN"` literal usage, with an exemption list for files allowed to reference the key name.
- This project's magic-code live-testing mechanism (established v1.0 Phase 3, reused throughout v1.1-v1.3): real email round trips read via the mechanism documented in PROJECT.md's C-10 constraint. Full research into current file structure/exact line numbers/live-testing mechanics is expected during plan-phase's own research step.

</code_context>

<specifics>
## Specific Ideas

None beyond the Implementation Decisions above — those are the full spec for this phase.

</specifics>

<deferred>
## Deferred Ideas

None — scope for this phase is fully closed per REQUIREMENTS.md/ROADMAP.md.

</deferred>
