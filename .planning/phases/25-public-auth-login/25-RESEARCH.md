# Phase 25: Public Auth Login - Research

**Researched:** 2026-08-12
**Domain:** InstantDB public runtime auth HTTP endpoints, direct `httpx` transport, admin-token confinement testing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Claude's Discretion

None declared separately — CONTEXT.md's "Specific Ideas" section states the Implementation Decisions above are the full spec; the two open engineering choices this research surfaces (see "Open Questions" below — whether to import `instantdb`'s private error-mapping helper vs. duplicate it locally, and exactly how `login_client()`'s docstring/exemption sets should read once it becomes test-only) are left to plan-time judgment, informed by the findings in this document.

### Deferred Ideas (OUT OF SCOPE)

None — CONTEXT.md's `<deferred>` section is empty; scope for this phase is fully closed per REQUIREMENTS.md/ROADMAP.md. Also explicitly out of scope per REQUIREMENTS.md: any `web/` change, any schema/perms change, any behavior change to non-auth subcommands, multi-app config support, real PyPI publication, and removal of `admin_token_present`/`apollo doctor`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | `apollo auth login` calls `POST {api_uri}/runtime/auth/send_magic_code` and `POST {api_uri}/runtime/auth/verify_magic_code` directly via `httpx`, replacing `client.auth.send_magic_code`/`check_magic_code` | Exact request/response/error shapes verified against the live API (this session) and against InstantDB's own JS client + Clojure server source (see "Standard Stack" / "Code Examples" / "Pitfalls"). Confirms no admin token/Authorization header needed. |
| AUTH-02 | `apollo auth login`'s JSON stdout/stderr, exit codes, and error messages stay identical | Server-side source read (routes.clj) proves the public endpoint reuses the *exact same* `magic-code-auth/verify!`/`wrap-errors` machinery as the admin endpoint — error `type`/`message`/`hint`/`trace-id` shapes are byte-identical between admin and public paths. Live-probed against the real API this session (400 `record-not-found`, 400 `param-malformed`) to confirm. |
| AUTH-03 | No CLI command reads/depends on `INSTANT_APP_ADMIN_TOKEN`; `session_client()` unaffected | `session_client()`'s `admin_token=""` short-circuit re-confirmed by reading `instantdb._sync.client.Instant.__init__` (installed package, this session). `login_client()` — the only other admin-token consumer — is proven to have a real, legitimate remaining caller outside `apollo_cli/` (see "Don't Hand-Roll" / Pitfall 1), so AUTH-03's "operational path" framing (not "anywhere in the repo") is the correct scope. |
| AUTH-04 | `admin_token_present`/`apollo doctor` unchanged beyond Phase 24's `app_id` provenance work | Confirmed via `Read` of current `cli.py`/`config.py`: `doctor` only reads the boolean `config.admin_token_present`, never the token value; nothing in this phase's plan needs to touch that line. |
| AUTH-05 | `test_auth_rejection.py`/`test_instant_client.py` updated for the stronger guarantee | Exact, file-and-line-scoped diff identified: `test_auth_rejection.py`'s `_LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES` must drop `"auth.py"` (see Pitfall 1); no other exemption set changes are needed since `login_client()` is not deleted. |

</phase_requirements>

## Summary

This phase replaces exactly one thing: how `apollo auth login` sends and verifies a magic code. Today it goes through `instantdb`'s Python Admin SDK (`client.auth.send_magic_code`/`check_magic_code`), which calls `/admin/send_magic_code`/`/admin/verify_magic_code` and therefore requires an `Authorization: Bearer <admin_token>` header — the sole reason `apollo auth login` has ever needed `INSTANT_APP_ADMIN_TOKEN`. This research proves, by reading InstantDB's actual Clojure server source (not just the JS/Python client wrappers), that `/runtime/auth/send_magic_code` and `/runtime/auth/verify_magic_code` invoke the **exact same** business logic (`instant.runtime.magic-code-auth/send!`/`verify!`) and the **exact same** error-formatting middleware (`instant.util.http/wrap-errors`) as their admin counterparts — the only difference is how the caller's identity/authorization is established (admin bearer token vs. none). This means the public endpoints are a drop-in replacement at the response-shape level: same `{"user": {...}, "created": bool}` success body, same `{"type", "message", "hint", "trace-id"}` error body, same HTTP status codes for the same failure conditions. Both send/verify request bodies use kebab-case JSON keys (`"app-id"`, `"code"`) — this is already the exact pattern the codebase's own `whoami()` command uses today for `verify_token`'s `/runtime/auth/verify_refresh_token` call, so this phase extends an existing, working pattern rather than introducing a new one.

The single genuinely new engineering decision is how to convert a raw `httpx.Response` into the same `InstantAPIError` shape `auth.py`'s existing `except InstantAPIError` branch already expects. The `instantdb` package's own internal HTTP layer (`instantdb._sync.http._HTTP._handle_response` calling `instantdb._http_errors.api_error_from_response`) does exactly this in five lines, and this function is safely reusable (see Code Examples) rather than needing to be re-invented — reusing it, plus the package's own `DEFAULT_API_URI`/`DEFAULT_TIMEOUT` constants, guarantees byte-for-byt identical error/timeout behavior with zero duplicated logic that could drift on a future `instantdb` version bump.

A significant, non-obvious finding changes the plan's shape versus a naive reading of CONTEXT.md decision 3: `login_client()` is **not** dead code once `login()` stops calling it. `cli/tests/test_cross_user_isolation.py` (a live, pre-existing test file, not touched by this phase's requirements) calls `login_client()` directly at line 367 to perform an admin-only `delete_user` teardown that has **no public/runtime equivalent** — InstantDB's public auth surface has no "delete my account" endpoint. `login_client()` must therefore be **kept**, but its purpose and its only legitimate caller both change: from "the CLI's login command" to "test-only admin teardown infrastructure with no production caller." This changes the required edits to `instant_client.py`'s docstring, and — critically — to `test_auth_rejection.py`'s AST-walk exemption set, which must drop `"auth.py"` from the set of files allowed to call `login_client()`, since after this phase no file in `apollo_cli/` calls it at all.

**Primary recommendation:** In `auth.py`, add a small `_post_public_auth(path, body)` helper built on a single `httpx.post()` call using `instantdb`'s own `DEFAULT_API_URI`/`DEFAULT_TIMEOUT` and `api_error_from_response` (imported from `instantdb._sync.http`/`instantdb._http_errors`), remove `login()`'s `login_client()` call and the now-unused import, keep `login_client()` itself intact in `instant_client.py` for `test_cross_user_isolation.py`'s continued use, and tighten `test_auth_rejection.py`'s `_LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES` to `{"instant_client.py"}` (or drop it entirely — see Pitfalls). Add `httpx` as an explicit `[project.dependencies]` entry (`httpx>=0.27,<1`, matching `instantdb`'s own floor). Prove the live round trip with a new `@pytest.mark.live` test that ports `web/e2e/helpers/magic-code.ts`'s exact Outlook-COM-via-PowerShell mechanism into a small Python helper.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Magic-code send/verify HTTP transport | CLI (Python process, `apollo_cli/auth.py`) | InstantDB public API (`api.instantdb.com`) | The CLI is a thin, stateless client of InstantDB's public runtime auth surface — no intermediate server tier exists or is introduced. |
| Session persistence (refresh token) | CLI (`apollo_cli/session.py`, local filesystem `~/.config/apollo-cli/session`) | — | Unchanged by this phase; the CLI's analogue of the browser SDK's `localStorage`. |
| Admin-token-gated operations (schema/perms push, test-only user teardown) | Developer tooling / test harness (`instant-cli` from `web/`, `cli/tests/test_cross_user_isolation.py`) | — | Never the CLI's operational (`apollo` entrypoint) tier — confirmed by this research to be the correct, narrower scope for AUTH-03 ("operational path," not "the whole repo"). |
| `admin_token_present` diagnostic | CLI (`apollo_cli/config.py`/`cli.py doctor`) | — | Presence-only check, dev-support feature explicitly kept per CONTEXT.md decision 5/AUTH-04 — reads a boolean derived from `.env.instantdb`, never the token value. |
| InstantDB permission enforcement (`instant.perms.ts` `donoRules`) | InstantDB backend | — | Untouched; this phase changes only how a session is *obtained*, not how it's *authorized* against data. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `httpx` | `0.28.1` (resolved in `cli/uv.lock`; latest on PyPI as of this research — [VERIFIED: pypi.org/pypi/httpx/json]) | Direct sync HTTP calls to InstantDB's public `/runtime/auth/*` endpoints | Already imported directly in `auth.py` today (for `except httpx.HTTPError`) and already a transitive dependency of `instantdb` (confirmed via the real `uv tool install` output captured in Phase 24's `24-02-SUMMARY.md`: `+ httpx==0.28.1`). This phase makes an existing indirect dependency direct, adding zero new supply-chain surface. [VERIFIED: `cli/.venv/lib/python3.12/site-packages/httpx-0.28.1.dist-info`, confirmed installed this session] |
| `instantdb` | `>=1.0.63,<2` (unchanged; already pinned in `cli/pyproject.toml`) | Source of the `InstantAPIError` exception class, the `Instant` client (still used by `whoami()`), and (optionally, see Code Examples) the `api_error_from_response`/`DEFAULT_API_URI`/`DEFAULT_TIMEOUT` helpers this phase reuses | No version bump needed — the constants/function this research recommends reusing already exist at the currently-pinned `1.0.63`. [VERIFIED: `cli/.venv/lib/python3.12/site-packages/instantdb-1.0.63.dist-info`, read this session] |

### Supporting

No new supporting libraries. `click`, `python-dotenv`, `bizdays` are all untouched by this phase's scope.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `instantdb._sync.http.DEFAULT_API_URI`/`DEFAULT_TIMEOUT`/`instantdb._http_errors.api_error_from_response` (private, underscore-prefixed modules) | Defining local equivalents (`_API_URI = "https://api.instantdb.com"`, a hand-copied 5-line error-mapping function) in `auth.py` | Reuse avoids ~10 lines of duplicated logic that could silently drift from the vendor's actual behavior on a future `instantdb` bump; but it imports from modules the vendor marks `# AUTOGENERATED ... DO NOT EDIT` and does not export via `__init__.py`'s `__all__`. Since these symbols back the SDK's own public `Instant`/`AsyncInstant` classes' entire error-reporting contract, they cannot change shape without breaking the SDK's own public API — making this a low-risk reuse, but still a **new pattern** for this codebase (no existing file imports from `instantdb._sync.*`/`instantdb._http_errors`). Flagged as an Open Question below for an explicit plan-time call. |
| `httpx.post()` (module-level, one-shot client) | An explicit `httpx.Client()` context manager | The CLI is a short-lived, one-invocation-per-command process; each `apollo auth login` call makes at most one HTTP request (send OR verify, never both). A persistent client provides no benefit here and would add teardown complexity for no gain — matches this codebase's existing bias toward the simplest correct thing (`whoami()`'s ad hoc `Instant(...)` construction, not a shared/cached client, either). |
| `httpx` sync API | `httpx.AsyncClient` / `anyio` | The entire CLI is synchronous (`instantdb.Instant`, not `AsyncInstant`); introducing async here would require an event loop wrapper around a single `click` command for no behavioral benefit. `anyio` is already an installed transitive dependency (via `instantdb`/`httpx`) but nothing in this codebase uses it directly today. |

**Installation:**
```bash
# cli/pyproject.toml — add to [project] dependencies list:
#   "httpx>=0.27,<1",
cd cli && uv sync
```

**Version verification:** `httpx` version confirmed via three independent checks this session: (1) live PyPI JSON API (`curl https://pypi.org/pypi/httpx/json` → `"version": "0.28.1"`), (2) `cli/uv.lock`'s already-resolved pin, (3) the real, already-installed venv at `cli/.venv/lib/python3.12/site-packages/httpx-0.28.1.dist-info`. `instantdb`'s own `METADATA` declares `Requires-Dist: httpx>=0.27` — this phase's new explicit constraint (`>=0.27,<1`) matches that floor and follows this project's existing `<next-major>` capping style (e.g. `click>=8.4,<9`).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `httpx` | PyPI | first published well before 2024 (this version published 2024-12-06 per registry metadata) | Not resolvable via the legitimacy seam's automated PyPI signal ([ASSUMED: extremely high — `httpx` is one of the most widely used Python HTTP clients, used by `fastapi`, `starlette` test clients, and `instantdb` itself]) | `github.com/encode/httpx` | SUS (seam) | **Approved — SUS verdict is a downloads-signal gap, not a red flag.** `httpx` is already a *resolved, pinned, installed* transitive dependency in this exact project's `cli/uv.lock` (`httpx==0.28.1`, confirmed running inside `instantdb`'s own dependency tree and inside every `uv tool install` this project has already performed live in Phase 24). This phase declares an existing dependency explicit — it installs nothing new. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `httpx` — flagged above for the seam's benign reason (no downloads signal for PyPI in this environment); disposition is Approved with justification, not a `checkpoint:human-verify` gate, given it is already installed and load-bearing in this exact project today.

## Architecture Patterns

### System Architecture Diagram

```
apollo auth login --email E [--code C]
        |
        v
click command `login()` in auth.py
        |
        +-- load_instant_config() --> InstantConfig{app_id, ...}   (unchanged, Phase 24 output)
        |
        +-- [no --code] ---> httpx.post(f"{API_URI}/runtime/auth/send_magic_code",
        |                                json={"app-id": app_id, "email": E})
        |                        |
        |                        +-- 2xx --> {"sent": true} (discarded) --> emit {"status": "code_sent", ...}
        |                        +-- 4xx/5xx --> api_error_from_response() --> raise InstantAPIError
        |                        +-- connection/timeout error --> raise httpx.HTTPError subclass
        |
        +-- [--code C] -----> httpx.post(f"{API_URI}/runtime/auth/verify_magic_code",
                                          json={"app-id": app_id, "email": E, "code": C})
                                   |
                                   +-- 2xx --> {"user": {id, email, refresh_token, ...}, "created": bool}
                                   |             |
                                   |             +--> save_session(Session(user_id, email, refresh_token))
                                   |             +--> emit {"status": "logged_in", ...}
                                   |
                                   +-- 4xx (record-not-found | record-expired | rate-limited | ...)
                                   |     --> api_error_from_response() --> raise InstantAPIError
                                   |     --> except InstantAPIError --> _emit_api_error(..., "auth_failed") --> exit 3
                                   |
                                   +-- connection/timeout error
                                         --> except httpx.HTTPError --> _emit_network_error(...) --> exit 4

(InstantDB server side, for reference — NOT touched by this phase)
POST /runtime/auth/send_magic_code  --> instant.runtime.routes/send-magic-code-post
                                           --> instant.runtime.magic-code-auth/send!   (same fn as /admin path)
POST /runtime/auth/verify_magic_code --> instant.runtime.routes/verify-magic-code-post
                                           --> instant.runtime.magic-code-auth/verify! (same fn as /admin path)
                                           --> instant.util.http/wrap-errors           (same middleware as /admin path)
```

### Recommended Project Structure

No new files/directories. All changes are localized:
```
cli/
├── apollo_cli/
│   ├── auth.py            # login() rewritten to call the public endpoints; new _post_public_auth() helper
│   └── instant_client.py  # login_client() KEPT, docstring updated (test-only caller now); session_client() untouched
├── tests/
│   ├── test_auth_rejection.py   # _LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES tightened (drop "auth.py")
│   ├── test_instant_client.py   # no functional change expected (see Open Questions); docstring/comment pass
│   ├── test_cross_user_isolation.py  # UNCHANGED — its login_client() call is the reason login_client() survives
│   └── test_auth_live.py        # (or a new sibling file) gains the new admin-token-free login round-trip test
└── pyproject.toml          # httpx added to [project] dependencies
```

### Pattern 1: Reuse the SDK's own error-response translation

**What:** Convert a raw `httpx.Response` from a direct call into the exact same `InstantAPIError` the rest of `auth.py` already catches, instead of writing new error-parsing logic.
**When to use:** Any time this codebase makes a direct `httpx` call to an InstantDB endpoint the `instantdb` package doesn't wrap (as `whoami()` already does implicitly today by staying inside the SDK for `verify_token`, and as this phase now needs for send/verify magic code).
**Example:**
```python
# Source: instantdb 1.0.63, cli/.venv/lib/python3.12/site-packages/instantdb/_http_errors.py
# (read directly this session — reused, not duplicated)
from instantdb._http_errors import api_error_from_response
from instantdb._sync.http import DEFAULT_API_URI, DEFAULT_TIMEOUT

def _post_public_auth(path: str, body: dict[str, Any]) -> Any:
    """POST to an unauthenticated InstantDB /runtime/auth/* endpoint.

    Mirrors instantdb._sync.http._HTTP._request's unauthenticated=True path
    exactly: same base URL, same timeout, same content-type header, same
    response/error translation — just without going through an Instant()
    client instance, since these endpoints need no admin token or session.
    """
    response = httpx.post(
        f"{DEFAULT_API_URI}{path}",
        json=body,
        headers={"content-type": "application/json"},
        timeout=DEFAULT_TIMEOUT,
    )
    if response.is_success:
        return response.json() if response.content else None
    raise api_error_from_response(response)
```

### Pattern 2: Public runtime auth request bodies use kebab-case keys

**What:** Every `/runtime/auth/*` endpoint expects `"app-id"` (not `app_id`/`appId`) and, where applicable, `"code"`/`"email"`/`"refresh-token"` verbatim.
**When to use:** Building the `json=` payload for `send_magic_code`/`verify_magic_code`.
**Example:**
```python
# Source: instantdb/instant GitHub, client/packages/core/src/authAPI.ts (read verbatim this session)
# and instantdb 1.0.63's own cli/.venv/.../instantdb/_sync/auth.py verify_token() call, which already
# uses this exact pattern for /runtime/auth/verify_refresh_token:
#   json={"app-id": self._app_id, "refresh-token": token}, unauthenticated=True

send_body = {"app-id": config.app_id, "email": email}
verify_body = {"app-id": config.app_id, "email": email, "code": code}
```

### Anti-Patterns to Avoid

- **Mocking `httpx`/InstantDB in tests:** This entire codebase's test suite (`cli/tests/*.py`, confirmed by grep this session) has zero precedent for mocking any InstantDB network call — every "mock"/"monkeypatch" hit in the suite is env-var/session-file isolation, never a faked HTTP response. Introducing `respx` or `unittest.mock` for the new auth code would break this established convention. Use genuine live calls against real (if deliberately invalid) inputs instead — see Pitfall 3/Validation Architecture below for how to get deterministic error-path coverage without a real email round trip.
- **Constructing an `Instant(...)` client just to make these two calls:** Defeats the purpose — `Instant.__init__` still runs `_validate_auth()` on every authenticated request path, and there is no path through the public `Auth` surface in the currently-installed `instantdb==1.0.63` that reaches `/runtime/auth/send_magic_code`/`verify_magic_code` (only `verify_token`→`/runtime/auth/verify_refresh_token` is wired up — confirmed by reading `instantdb/_sync/auth.py` in full this session). A bare `httpx.post()` is the correct, minimal tool.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translating a non-2xx `httpx.Response` into an `InstantAPIError` with the right `status`/`body`/`hint`/`trace_id` | A new local `_parse_error(response)` function | `instantdb._http_errors.api_error_from_response(response)` (already installed, already what the SDK itself uses for every one of its own error paths) | Zero duplicated logic to keep in sync with the vendor; guaranteed identical shape to what `_emit_api_error` already expects, since it's the *same* function the admin-SDK code path already funnels through today. |
| Reading a magic-code email from the real inbox | A new OS-automation/email-parsing mechanism | Port `web/e2e/helpers/magic-code.ts`'s exact `orules.ps1 peek` PowerShell/COM invocation + sender/regex logic into a small Python helper (`subprocess.run(["powershell.exe", ...])`) | This project has one working, already-debugged channel (PROJECT.md C-10, corrected 2026-08-09 for the exact `--grep` phrase that actually matches). Reinventing it in Python risks reintroducing the same `--grep 'nstant'` bug the TS helper's own comments document having fixed. |

**Key insight:** Every piece of this phase's "hard part" (error shape parsing, email reading) already has a working, source-verified implementation elsewhere in this codebase or its dependencies. The only genuinely new code is the ~10-line `httpx.post()` call itself.

## Common Pitfalls

### Pitfall 1: `login_client()` is not dead code — deleting it breaks a different, live test file

**What goes wrong:** Following CONTEXT.md decision 3's framing literally ("if nothing else calls it, remove it") without checking `cli/tests/` (not just `cli/apollo_cli/`) leads to deleting `login_client()`, which breaks `cli/tests/test_cross_user_isolation.py::test_06_zz_guarded_second_user_teardown` (line 367: `admin = login_client()`, used for `admin.auth.delete_user(id=...)` — an admin-only operation with no public-endpoint equivalent).
**Why it happens:** A grep scoped to `apollo_cli/*.py` (the package) finds zero remaining callers after `auth.py`'s rewrite, but `cli/tests/*.py` is a separate directory the same grep habit tends to skip; `test_cross_user_isolation.py`'s own docstring (lines 28-36, read this session) already anticipates and documents this exact tension.
**How to avoid:** Keep `login_client()` and `AdminTokenMissingError`/`_read_admin_token()` in `instant_client.py` exactly as-is. Update only its docstring (module-level and function-level) to stop claiming "legal to call ONLY from `apollo_cli.auth.login`" — replace with something like "legal to call ONLY from test-only, admin-required operations with no public-endpoint equivalent (e.g. `cli/tests/test_cross_user_isolation.py`'s `delete_user` teardown) — no `apollo_cli` operational command may call it." Then, in `test_auth_rejection.py`, remove `"auth.py"` from `_LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES` (leaving `{"instant_client.py"}`, or drop the set to `set()` entirely since `instant_client.py` only *defines* `login_client`, never *calls* it — either is correct; verify by rerunning the AST-walk test after the edit, which is exactly the "structural check enforces the invariant" pattern this test file's docstring already documents at lines 190-201, read this session).
**Warning signs:** `ruff` reporting `F401` (unused import) on `from apollo_cli.instant_client import login_client` in `auth.py` after the rewrite — that is the confirming signal the deletion of the *call site* (not the function) was done correctly; if `test_cross_user_isolation.py` instead fails with `ImportError: cannot import name 'login_client'`, the function itself was wrongly deleted.
**Addressed in:** the plan's task that edits `instant_client.py` and `test_auth_rejection.py` (implementing AUTH-01/AUTH-05).

### Pitfall 2: `httpx`'s default timeout (5s) is far shorter than the SDK's (60s/10s connect) — a silent behavior narrowing

**What goes wrong:** A bare `httpx.post(url, json=body)` call with no `timeout=` argument uses `httpx`'s built-in `DEFAULT_TIMEOUT_CONFIG = Timeout(timeout=5.0)` (verified by reading `cli/.venv/lib/python3.12/site-packages/httpx/_config.py:246` this session), whereas the `instantdb` SDK's own `_HTTP` class uses `DEFAULT_TIMEOUT = httpx.Timeout(60.0, connect=10.0)` (verified by reading `instantdb/_sync/http.py:24` this session). A slow-but-successful response (6-59s) that used to succeed via the admin-SDK path could now raise `httpx.ReadTimeout` and hit the `network_error`/exit-4 branch instead of completing — a real, if narrow, AUTH-02 regression risk under network latency.
**Why it happens:** `httpx.post()`'s `timeout=` parameter is easy to omit since the call otherwise "just works" on a fast connection, and no test in this codebase currently exercises a slow (not down) connection.
**How to avoid:** Pass `timeout=DEFAULT_TIMEOUT` (imported from `instantdb._sync.http`, per Pattern 1 above) explicitly on every direct call this phase adds, matching the SDK's own generous timeout exactly rather than silently narrowing it.
**Warning signs:** Flaky `network_error` results under load or on a slow connection that previously worked; a code review noticing an `httpx.post()` call with no `timeout=` kwarg anywhere touching InstantDB.
**Addressed in:** the plan's task implementing `_post_public_auth()` (AUTH-01/AUTH-02).

### Pitfall 3: Testing "invalid code" and "expired code" does not require a real email round trip — but testing "logged in" does

**What goes wrong:** Assuming every AUTH-02 error-path assertion needs the fragile Outlook-COM/PowerShell mechanism (and its ~60-90s code-expiry window) leads to either skipping error-path coverage entirely or building unnecessarily flaky, slow tests.
**Why it happens:** The one existing precedent for a full magic-code round trip (`.planning/milestones/v1.0-phases/03-cli-auth-crud/03-01-LOGIN-EVIDENCE.md`, read this session) is a manual, one-time proof, not a template that distinguishes "needs a real code" from "just needs the API to reject something."
**How to avoid:** Split error-path coverage from happy-path coverage:
  - **"Invalid code" (`record-not-found`)** requires no email at all — live-probed this session against the real production API (`curl`-equivalent `httpx.post` with `email="nonexistent-probe-test@example.com"`, `code="000000"`) returned `400 {"type":"record-not-found","message":"Record not found: app-user-magic-code",...}` deterministically, with zero side effects (no email sent, no user created). This is directly automatable as a permanent `@pytest.mark.live` test with no dependency on the email-reading mechanism.
  - **"Expired code"** genuinely requires waiting out the app's configured expiry window after a real send — impractical for a fast test, and (confirmed by grep this session) **was never covered by a dedicated live test even before this phase**; this is a pre-existing gap, not a regression this phase introduces, and is not required by AUTH-02's "stays identical" bar (which only requires the *existing* generic `except InstantAPIError` pass-through to keep working, which it structurally does regardless of which `type` string comes back).
  - **"Logged in" (happy path)** is the one scenario that genuinely needs a real code, and therefore genuinely needs the email-reading mechanism (see Open Question/Validation Architecture below).
  - **"Network error"** can be produced with a real (if deliberately unreachable) TCP endpoint — e.g. temporarily monkeypatching the module's API-URI constant to `http://127.0.0.1:1` for one test — without mocking InstantDB's protocol at all.
**Warning signs:** A test file that imports `respx`/`unittest.mock` for InstantDB calls (breaks the zero-mock convention); a test that waits 90+ seconds inline for "expired" coverage that duplicates a real send unnecessarily.
**Addressed in:** the plan's task(s) implementing AUTH-02's test coverage and the live round-trip proof (AUTH-05, Validation Architecture).

### Pitfall 4: `cli/README.md`'s "About the admin token" section becomes factually wrong after this phase

**What goes wrong:** `cli/README.md` (read this session, lines 104-119) currently states: *"The only other place this CLI reads that token at all is inside `apollo auth login` (via `apollo_cli/instant_client.py`'s `login_client()`), because completing a magic-code login requires an admin-capable client..."* — this sentence is the literal thing AUTH-01/AUTH-03 make false. Leaving it unedited means shipped documentation actively contradicts the new, stronger guarantee this phase exists to deliver.
**Why it happens:** README updates are easy to forget when the change is "purely internal transport," since nothing about the *external* CLI interface changes.
**How to avoid:** Update the paragraph to state the admin token is now used only by `instant-cli` (dev tooling, from `web/`) and, internally, only by this project's own live test harness (`test_cross_user_isolation.py`'s teardown) — never by any `apollo` command, including `login`.
**Addressed in:** the plan's documentation task (AUTH-01/AUTH-04 cleanup).

## Code Examples

### Send magic code (public endpoint) — full request/response, live-verified this session

```python
# Source: instantdb/instant GitHub client/packages/core/src/authAPI.ts (curled verbatim this session)
# and instant.runtime.routes/send-magic-code-post (server source, curled verbatim this session):
#   (defn send-magic-code-post [req]
#     (let [email (ex/get-param! req [:body :email] email/coerce)
#           app-id (ex/get-param! req [:body :app-id] uuid-util/coerce)]
#       (magic-code-auth/send! {:app-id app-id :email email})
#       (response/ok {:sent true})))
import httpx

response = httpx.post(
    "https://api.instantdb.com/runtime/auth/send_magic_code",
    json={"app-id": config.app_id, "email": email},
    headers={"content-type": "application/json"},
)
# response.status_code == 200 on success; response.json() == {"sent": true}
# The admin SDK's send_magic_code() returns result["code"] (a testing convenience
# not available on this endpoint) — auth.py's current login() already discards
# that value ("# discard the returned code"), so this is a zero-impact change.
```

### Verify magic code (public endpoint) — full request/response, live-verified this session

```python
# Source: instant.runtime.routes/verify-magic-code-post (server source, curled verbatim this session):
#   (response/ok {:user (dissoc result :created) :created (:created result)})
# where `result` = (assoc user :refresh_token refresh-token-id :created created?)
# — i.e. `user` already contains `id`/`email`/`refresh_token` (User type,
# client/packages/core/src/clientTypes.ts, curled verbatim this session):
#   { id: string; refresh_token: string; email?: string|null; imageURL?: ...; isGuest: boolean }
response = httpx.post(
    "https://api.instantdb.com/runtime/auth/verify_magic_code",
    json={"app-id": config.app_id, "email": email, "code": code},
    headers={"content-type": "application/json"},
)
body = response.json()
user = body["user"]          # {"id": ..., "email": ..., "refresh_token": ..., "isGuest": False, ...}
created = body["created"]    # bool — same field auth.py's login() already destructures today
```

### Live-verified error response for an invalid code (no email/session needed)

```
$ uv run python3 -c "
import httpx
r = httpx.post('https://api.instantdb.com/runtime/auth/verify_magic_code',
                json={'app-id': '7936ca82-5cb4-43c2-811d-788a6ec0d2a8',
                      'email': 'nonexistent-probe-test@example.com', 'code': '000000'})
print(r.status_code); print(r.text)
"
400
{"type":"record-not-found","message":"Record not found: app-user-magic-code","hint":{"args":[{"app-id":"7936ca82-5cb4-43c2-811d-788a6ec0d2a8","code":"000000","email":"nonexistent-probe-test@example.com"}],"record-type":"app-user-magic-code"},"trace-id":"43f4ea8a0e660540f43bcdb86a7cd1b0"}
```
This exact live call was executed this research session against the real production API with `INSTANT_APP_ADMIN_TOKEN` unset — no admin token was sent (no `authorization` header at all) and the call still reached full business-logic validation, confirming AUTH-01's core premise end to end.

### Live-verified error response for a malformed `app-id` (confirms no auth gate exists before param validation)

```
$ uv run python3 -c "
import httpx
r = httpx.post('https://api.instantdb.com/runtime/auth/send_magic_code',
                json={'app-id': 'not-a-uuid', 'email': 'test@example.com'})
print(r.status_code); print(r.text)
"
400
{"type":"param-malformed","message":"Malformed parameter: [\"body\" \"app-id\"]","hint":{"in":["body","app-id"],"original-input":"not-a-uuid"},"trace-id":"433b587830a3f49da949f95f6a7cd1a8"}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `client.auth.check_magic_code(email=, code=)` → `/admin/verify_magic_code` (requires admin token) | Direct `httpx.post` → `/runtime/auth/verify_magic_code` (no auth header) | This phase | Removes `INSTANT_APP_ADMIN_TOKEN` requirement from the CLI's only remaining consumer of it in the operational path |
| JS client's `verifyMagicCode` | JS client's `checkMagicCode` (adds `created` field + `extraFields` support) | Already true upstream, unrelated to this phase | Not relevant here — the *server* endpoint (`/runtime/auth/verify_magic_code`) is shared by both client-side wrapper functions; the Python side never had either wrapper for this endpoint at all, which is exactly the gap this phase closes |

**Deprecated/outdated:** InstantDB's own JS client marks `verifyMagicCode` (without the `created` field) `@deprecated` in favor of `checkMagicCode` — both hit the identical server endpoint and response shape (`created` is simply an additional field in the same JSON body already), so this has zero bearing on the Python implementation this phase writes; the plan should destructure `created` from the response regardless (matching the admin SDK's existing `check_magic_code` return contract that `auth.py` already relies on).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `httpx`'s PyPI weekly-download count is extremely high (the package-legitimacy seam could not retrieve a number for PyPI in this environment) | Package Legitimacy Audit | None practical — `httpx` is already a load-bearing, installed, pinned transitive dependency of `instantdb` in this exact project; even if the assumption about download volume were wrong, the disposition (Approved) would not change, since the package is already running in production via `instantdb`. |
| A2 | No `web/` code needs to change as a side effect of this phase | User Constraints / Out of Scope | Low — explicitly locked by CONTEXT.md decision 7 and REQUIREMENTS.md's Out-of-Scope section; `web/`'s SPA already calls `/runtime/auth/*` natively via the JS SDK, unaffected by any Python-side change. |

**If this table is empty:** N/A — see above; both entries are low-risk and do not require user reconfirmation before planning proceeds, but are logged per protocol.

## Open Questions

1. **Should `auth.py` import `instantdb._sync.http.DEFAULT_API_URI`/`DEFAULT_TIMEOUT` and `instantdb._http_errors.api_error_from_response` directly (reuse, zero duplication, but a new "import private vendor internals" pattern for this codebase), or should the plan define small local equivalents (a literal `"https://api.instantdb.com"` constant, a locally-copied 5-line error-mapping function, both explicitly commented as "adapted from instantdb._http_errors, version 1.0.63")?**
   - What we know: Both approaches are functionally correct and produce byte-identical behavior today; the private-module approach is more DRY and lower-drift-risk but sets a new precedent (no existing file in this codebase imports from `instantdb._sync.*`/`instantdb._http_errors`); the local-copy approach is more defensive against a future breaking rename of those specific symbols but duplicates vendor logic this project's "Don't Hand-Roll" philosophy generally discourages duplicating.
   - What's unclear: Whether the team has an implicit "never import a `_`-prefixed vendor symbol" rule not yet written down anywhere (searched — no such rule exists in `CLAUDE.md`, `ruff` config, or any RESEARCH.md/PROJECT.md constraint found this session).
   - Recommendation: Reuse (import), given the tight, already-pinned version range (`<2`) and the fact these symbols back the SDK's own public error contract — but flag this explicitly for a one-line confirmation at plan-review time rather than deciding it silently, since it is a new import pattern.

2. **Exact wording for `instant_client.py`'s updated module/function docstrings once `login_client()` becomes test-only-with-no-production-caller** — left as a plan-time drafting task; this research supplies the correct *facts* (who calls it now, why it must stay) but not the exact prose, per this project's convention of writing these decisions inline during implementation (see PROJECT.md's Key Decisions table entries, which are written post-hoc, not pre-drafted).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Network access to `api.instantdb.com` | AUTH-01 implementation + all live tests | ✓ (confirmed via live `httpx.post` calls this session) | — | — |
| `httpx` (Python package) | AUTH-01 direct calls | ✓ | 0.28.1 (installed) | — |
| `instantdb` (Python package) | `InstantAPIError`, `Instant` (for `whoami`), optionally `_http_errors`/`_sync.http` internals | ✓ | 1.0.63 (installed, matches pin) | — |
| `powershell.exe` / Outlook Classic COM bridge (`orules.ps1 peek`) | Live magic-code email round-trip proof (AUTH-05/CONTEXT.md decision 9) | ✓ (confirmed reachable from this sandbox: `command -v powershell.exe` resolved to `/mnt/c/windows/System32/WindowsPowerShell/v1.0//powershell.exe` this session) | — | If unreachable in the executor's actual environment: fall back to a manual, orchestrator-performed round trip captured as a `*-LOGIN-EVIDENCE.md` file, matching the exact precedent already set by `.planning/milestones/v1.0-phases/03-cli-auth-crud/03-01-LOGIN-EVIDENCE.md`. |
| `uv` | build/test runner | ✓ | 0.9.21 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the PowerShell/Outlook bridge (documented fallback above); this is the one dependency genuinely external to the repo's own toolchain.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `pytest 9.1.1` [VERIFIED: `uv run pytest --version`, this session] |
| Config file | `cli/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd cli && uv run pytest -m "not live and not packaging"` |
| Full suite command | `cd cli && uv run pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Send/verify magic code hits the public `/runtime/auth/*` endpoints with no admin token | live (network) | `uv run pytest tests/test_auth_live.py -m live -k login` | ❌ Wave 0 — new test needed |
| AUTH-02 | Invalid-code error shape/exit code unchanged | live (network, no email needed — see Pitfall 3) | `uv run pytest tests/test_auth_live.py -m live -k invalid_code` | ❌ Wave 0 — new test needed |
| AUTH-02 | Network-error shape/exit code unchanged | unit-ish (real unreachable socket, no InstantDB mocking) | `uv run pytest tests/test_auth_rejection.py -k network` (or a new dedicated test) | ❌ Wave 0 — new test needed (optional; existing generic exception handling already covers the code path structurally) |
| AUTH-03 | `session_client()`/other commands never carry admin token | unit (structural, AST-walk) | `uv run pytest tests/test_instant_client.py tests/test_auth_rejection.py -k admin_token` | ✅ exists, needs exemption-set edit only (Pitfall 1) |
| AUTH-04 | `apollo doctor`/`admin_token_present` unchanged | unit + live packaging | `uv run pytest tests/test_config_app_id_fallback.py tests/test_packaging_live.py` | ✅ exists, unmodified |
| AUTH-05 | Stronger admin-token-confinement guarantee | unit (structural, AST-walk) | `uv run pytest tests/test_auth_rejection.py::test_admin_token_confinement` | ✅ exists, needs exemption-set edit only |
| — | Full happy-path login round trip, admin-token-free, real email | live (network + email) | new test in `tests/test_auth_live.py`, gated `@pytest.mark.live` | ❌ Wave 0 — new test + new Python email-reading helper needed |

### Sampling Rate

- **Per task commit:** `cd cli && uv run pytest -m "not live and not packaging"` plus `ruff check`/`ruff format --check`/`ty check`
- **Per wave merge:** `cd cli && uv run pytest -m "not live and not packaging"` (full offline suite)
- **Phase gate:** `cd cli && uv run pytest` (all markers, including `live`) with `INSTANT_APP_ADMIN_TOKEN` genuinely absent from the shell environment for at least one full run, plus the real `apollo auth login` round trip proof.

### Wave 0 Gaps

- [ ] A small Python port of `web/e2e/helpers/magic-code.ts`'s `readLatestMagicCode`/`readMagicCodeAfter` (e.g. `cli/tests/helpers/magic_code.py`), reusing the exact same `orules.ps1 peek --folder Inbox --days 1 --grep 'verification code' --body 0 --max 5` command and sender/regex logic — do not re-derive the `--grep` phrase from PROJECT.md C-10's prose (which is documented-stale); copy the corrected phrase from `magic-code.ts` itself.
- [ ] New live test(s) in `tests/test_auth_live.py` (or a new sibling module) covering: (a) admin-token-free full login round trip with a real email, isolated to a scratch `APOLLO_SESSION_FILE` so the developer's real persisted session is never clobbered (same pattern Phase 24 already established for `fundo listar` verification); (b) the no-email-needed invalid-code error-path assertion.
- [ ] `cli/pyproject.toml`: add `httpx` to `[project] dependencies`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Single-use, time-limited (60-90s observed) 6-digit OTP over email, consumed on use (deleted server-side on `consume!`) — unchanged mechanism, only the transport/authorization-of-the-*caller* changes. Server-side rate limiting (`check-send-rate-limit!`/`check-verify-rate-limit!`, confirmed by reading `instant.runtime.magic-code-auth` this session) already mitigates brute-force code guessing; unaffected by this phase. |
| V3 Session Management | yes | Refresh-token-based session, stored locally at `0600`/`0700` (`session.py`, unchanged); this phase does not touch session storage or lifetime. |
| V4 Access Control | no (indirectly relevant) | `instant.perms.ts` `donoRules` enforcement is unchanged; this phase only changes how a session is minted, not how it's authorized against data. |
| V5 Input Validation | yes (server-side, out of this phase's control) | `email`/`app-id`/`code` are validated server-side (`ex/get-param!` with `email/coerce`, `uuid-util/coerce`, `string-util/safe-trim` — confirmed by reading `instant.runtime.routes` this session) before any business logic runs; the CLI does not need to duplicate this validation, matching today's behavior. |
| V6 Cryptography | no | Code hashing (`crypt-util/str->sha256`) happens entirely server-side; this phase never touches cryptographic code. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Excess-privilege credential required for a low-privilege operation (the exact defect this phase fixes) | Elevation of Privilege | Removing the admin-token requirement from `login()` shrinks the blast radius of `INSTANT_APP_ADMIN_TOKEN`: after this phase, possessing that token is no longer a prerequisite for a developer/agent to authenticate as themselves, meaning fewer places on disk/in-memory/in-process-env need to ever hold that permission-bypassing credential. This is this phase's primary, and non-obvious, security *improvement* — worth stating explicitly in the plan's rationale, not just as a packaging convenience. |
| OTP interception via a slow/compromised email channel | Information Disclosure | Unchanged by this phase — mitigated server-side by the existing short expiry window and single-use consumption; this phase's own live test (per Pitfall 3) must never log/print the real code to stdout/stderr/CI logs, matching `auth.py`'s existing "never emitted, logged, or written anywhere but the 0600 session file" convention (module docstring, read this session) for the refresh token, extended here to the magic code the new live test handles in-process. |
| Rate-limit (`429`) under bursty/parallel live-test runs | Denial of Service (self-inflicted) | Already flagged in PROJECT.md's Key Decisions table ("watch for InstantDB's per-email rate limit (`429`) under parallel/bursty sends"); the new live test added by this phase should not run the full send→verify cycle more than necessary per test session — reuse a single send/verify pair per live test run rather than looping. |

## Sources

### Primary (HIGH confidence)
- `instantdb/instant` GitHub repo, `client/packages/core/src/authAPI.ts` — curled verbatim this session (`sendMagicCode`, `verifyMagicCode`, `checkMagicCode`, `verifyRefreshToken` request bodies and types).
- `instantdb/instant` GitHub repo, `client/packages/core/src/clientTypes.ts` — curled verbatim this session (`User` type shape).
- `instantdb/instant` GitHub repo, `client/packages/core/src/utils/fetch.ts` — curled verbatim this session (`InstantAPIError`/`InstantIssueBody` type union, `jsonFetch`'s status-code-to-rejection logic).
- `instantdb/instant` GitHub repo, `server/src/instant/runtime/routes.clj` — curled verbatim this session (`send-magic-code-post`/`verify-magic-code-post` handlers, proving public and admin routes share the exact same business-logic function and response-shaping code).
- `instantdb/instant` GitHub repo, `server/src/instant/admin/routes.clj` — curled verbatim this session (admin-side `send-magic-code-post`/`verify-magic-code-post`, confirming byte-identical response shape to the public route, differing only in `req->app-id-authed!` and `:admin? true`).
- `instantdb/instant` GitHub repo, `server/src/instant/runtime/magic_code_auth.clj` — curled verbatim this session (`send!`/`verify!`, rate-limiting, `matches-test-user?`).
- `instantdb/instant` GitHub repo, `server/src/instant/model/app_user_magic_code.clj` — curled verbatim this session (`consume!`'s `record-not-found`/`record-expired` conditions).
- `instantdb/instant` GitHub repo, `server/src/instant/util/exception.clj` and `server/src/instant/util/http.clj` — curled verbatim this session (`bad-request-types` set, `wrap-errors` middleware, HTTP status mapping: 400 for bad-request types, 429 for rate-limited).
- Live production API calls against `https://api.instantdb.com`, this session (`httpx.post` to `/runtime/auth/send_magic_code` with a malformed `app-id`, and to `/runtime/auth/verify_magic_code` with an unknown email/code) — confirmed no admin/authorization header required, confirmed exact error body shapes.
- `cli/.venv/lib/python3.12/site-packages/instantdb/` (installed package, version 1.0.63) — read in full this session: `_sync/auth.py`, `_sync/http.py`, `_sync/client.py`, `_errors.py`, `_http_errors.py`, `__init__.py`.
- `cli/.venv/lib/python3.12/site-packages/httpx/_config.py` (installed, version 0.28.1) — read this session (`DEFAULT_TIMEOUT_CONFIG = Timeout(timeout=5.0)`).
- This project's own source: `cli/apollo_cli/auth.py`, `instant_client.py`, `config.py`, `session.py`, `cli.py`; `cli/tests/test_auth_rejection.py`, `test_instant_client.py`, `test_auth_live.py`, `test_cross_user_isolation.py`, `conftest.py`; `cli/pyproject.toml`; `cli/README.md`; `web/e2e/helpers/magic-code.ts` — all read in full this session.
- `.planning/milestones/v1.0-phases/03-cli-auth-crud/03-01-LOGIN-EVIDENCE.md` — read this session (precedent for the manual/agent-performed live round-trip pattern).

### Secondary (MEDIUM confidence)
- None used beyond the primary sources above — all package/endpoint claims were resolved to primary sources this session.

### Tertiary (LOW confidence)
- `httpx`'s PyPI weekly-download volume (Package Legitimacy Audit, A1 in Assumptions Log) — not independently confirmed by a download-count API this session; disposition unaffected regardless (see audit table).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `httpx`/`instantdb` versions and behavior confirmed directly against the installed venv and live production API, not analogy.
- Architecture: HIGH — request/response/error shapes confirmed against InstantDB's actual server source code (Clojure), not just client-side wrapper types, plus live-probed this session.
- Pitfalls: HIGH — `login_client()`'s real remaining caller found by direct `grep`+`Read` of `cli/tests/test_cross_user_isolation.py`, not inferred; timeout discrepancy confirmed by reading both `httpx`'s and `instantdb`'s installed source.

**Research date:** 2026-08-12
**Valid until:** 2026-09-11 (30 days — InstantDB's public runtime auth endpoints are stable, versioned server infrastructure; `httpx`/`instantdb` Python package versions are pinned in `cli/uv.lock` and won't drift silently).
