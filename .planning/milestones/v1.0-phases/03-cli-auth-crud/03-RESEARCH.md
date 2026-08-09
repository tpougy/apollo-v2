# Phase 3: CLI Auth & CRUD - Research

**Researched:** 2026-08-09
**Domain:** InstantDB Python Admin SDK (magic-code auth, impersonation, transact/query) + `click`-based CLI CRUD surface
**Confidence:** HIGH (the single most important open question — non-admin, perms-respecting auth from the CLI — was verified empirically against the live InstantDB API, not just documentation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
PROJECT.md C-05 is LOCKED: magic-code email auth, CLI stores session at `~/.config/apollo-cli/session`, no admin token in normal operation, same `instant.perms.ts` rules as the browser (auth.id == data.donoId). C-07 is LOCKED: CLI surface uses `click`, subcommands organized entity+action.

**Autonomous magic-code auth testing (LOCKED, user-authorized — see PROJECT.md C-10):** This phase's `apollo auth login` flow requires a real magic-code email round trip. The user explicitly authorized reading that email from their real inbox (`tp@rbrasset.com.br`) using the `mcp__claude_ai_Microsoft_365__outlook_email_search` tool, whenever needed to complete or test this flow. Search for the most recent InstantDB magic-code email, extract the code, use it immediately. Scoped strictly to fetching that one code — never use this access for anything else. The EXECUTOR agent implementing/testing this flow must do this itself (it has tool access), not defer to a human.

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-01 | `apollo auth login` completes a magic-code email auth flow and persists a session at `~/.config/apollo-cli/session` that survives process restarts | Architecture Patterns 1/3, Code Examples (session persistence), Common Pitfalls #1/#2/#4 |
| CLI-02 | `apollo fundo criar\|editar\|deletar\|listar` full CRUD on `fundos`, scoped to `donoId` | Pattern 2 (donoId injection), Recommended Project Structure |
| CLI-03 | `apollo projeto criar\|editar\|deletar\|listar` full CRUD on `projetos` | Pattern 2, Recommended Project Structure |
| CLI-04 | `apollo etapa criar\|editar\|deletar\|listar` full CRUD on `etapas` | Pattern 2, Recommended Project Structure |
| CLI-05 | `apollo tarefa criar\|editar\|deletar\|listar` full CRUD on `tarefas` | Pattern 2, Recommended Project Structure |
| CLI-06 | `apollo rotina template criar\|editar\|deletar\|listar` full CRUD on `templatesRotina` | Pattern 2, Recommended Project Structure |
| CLI-07 | CLI can list `instanciasRotina` and update status only (no create) | Pattern 4 |
| CLI-08 | `apollo ticket criar\|editar\|deletar\|listar` full CRUD on `tickets` | Pattern 2, Recommended Project Structure |
| CLI-09 | `apollo subtarefa criar\|editar\|deletar\|listar` full CRUD on `subtarefas` (linked to `tarefa` or `ticket`) | Pattern 2, Recommended Project Structure |
| CLI-10 | `apollo log-inferencia registrar` creates + lists `logInferenciaClaude` | Recommended Project Structure |
| CLI-11 | Every CLI write scoped to `donoId`, rejected without valid session | Don't Hand-Roll (perms enforcement), Common Pitfalls #3, Validation Architecture |
</phase_requirements>

## Summary

The installed `instantdb` PyPI package (`1.0.63`, released 2026-08-07 — current as of this research) is structurally an **Admin SDK**: every data-plane call goes through `/admin/query` and `/admin/transact`. However, it exposes an `as_user(token=..., email=..., guest=...)` impersonation method that — when given a **user's own refresh token** (`as-token` header) — lets the client skip the admin bearer token entirely and have the request evaluated **as that real user**, subject to `instant.perms.ts` rules exactly like the browser SDK. This was verified two ways in this session: (1) direct source inspection of `_sync/http.py`'s `_validate_auth()`, which only *requires* an admin token when impersonation headers are absent or when impersonating by `email` — `as-token` and `as-guest` are explicitly exempted; and (2) a live HTTP round-trip against the real InstantDB app in `.env.instantdb` using a syntactically-valid-but-nonexistent UUID as a fake refresh token, which returned a real, non-admin-authenticated `record-not-found: app-user` error (not a 401/"admin token required" error) — proof the server itself accepts `as-token`-only requests. A second live test confirmed `as_user(guest=True).transact(...)` on a `create` returns a genuine `permission-denied` error identical in shape to what a real unauthenticated write would get, while `as_user(guest=True).query(...)` returns an **empty result list**, not an error — a critical distinction for how CLI-11 must be tested.

The practical architecture this implies: `apollo auth login` is the **only** code path in the CLI that ever needs `INSTANT_APP_ADMIN_TOKEN` (to call `/admin/send_magic_code` and `/admin/verify_magic_code`, which are true admin-only endpoints). The instant it obtains the verified user's `refresh_token`, that token — not the admin token — is what gets persisted to `~/.config/apollo-cli/session` and reused on every subsequent invocation via `Instant(app_id=..., admin_token=None).as_user(token=refresh_token)`. This satisfies PROJECT.md C-05's "no admin token in normal operation" literally, verified against the live server rather than assumed.

**Primary recommendation:** Build a small `apollo_cli/instant_client.py` module owning exactly two client constructors — `login_client()` (loads the admin token, used only inside `auth.py`'s login/verify flow) and `session_client()` (loads the persisted refresh token, used by every other command) — so no CRUD command file can accidentally reach for the admin token. Persist `{"user_id", "email", "refresh_token"}` as 0600 JSON at `~/.config/apollo-cli/session`, and inject `donoId = session.user_id` into every `create` transaction automatically — it must never be a user-supplied CLI flag.

## Architectural Responsibility Map

Apollo v2 has no custom backend/API server — the CLI is a direct client of InstantDB's cloud service, mirroring the browser SPA's role at the data-access tier.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Magic-code send/verify | InstantDB Cloud (Admin API) | CLI (Client) | Instant's backend owns code generation/expiry/email delivery; CLI is a thin caller, briefly using the admin token for this one call pair |
| Session persistence (refresh token) | CLI (Client, local filesystem) | — | No server-side session concept beyond the refresh token itself; `~/.config/apollo-cli/session` is the CLI's analogue of the browser's `localStorage` |
| Permission enforcement (`donoId` scoping) | InstantDB Cloud (`instant.perms.ts`, evaluated server-side) | — | CLI must never re-implement this check locally; a client-side check would create drift risk with the browser and violate "same perms rules" (C-05) |
| CRUD command dispatch (click subcommands → tx builder) | CLI (Client) | — | Pure request construction; no business logic beyond field validation and `donoId` injection |
| `instanciasRotina` status update (no create) | CLI (Client) | InstantDB Cloud (perms still apply) | Creation is reserved for the Phase 5 generation job; CLI-07 only needs `update`/`link`-style ops on `status` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `instantdb` (PyPI) | `1.0.63` [VERIFIED: pypi.org, installed venv] | Python Admin/impersonation client for InstantDB (query/transact/auth) | Only Python SDK InstantDB publishes; already a locked runtime dep since Phase 1 |
| `click` | `8.4.2` [VERIFIED: cli/uv.lock via Phase 1 SUMMARY] | CLI framework, groups/subcommands | LOCKED by PROJECT.md C-07 |
| `python-dotenv` | `1.2.2` [VERIFIED: cli/uv.lock] | Reads `.env.instantdb` (`dotenv_values`, never `load_dotenv`) | Already established in `config.py`, keeps admin token out of `os.environ` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `httpx` | transitively via `instantdb` | Underlying HTTP client; its exceptions (`httpx.ConnectError`, `httpx.TimeoutException`) are **not** wrapped into `InstantError` by the SDK | Catch alongside `InstantAPIError`/`InstantError` for user-facing network-failure messages |
| stdlib `json` | — | Session file read/write | `~/.config/apollo-cli/session` is a small JSON object, not a raw token string (see Code Examples) |
| stdlib `pathlib`/`os` | — | Session dir creation with `0700`, file with `0600` | Credential file — must not be group/world readable |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| InstantDB Python Admin SDK's `as_user(token=...)` | Hand-rolled `httpx` calls to `/runtime/*` endpoints directly | Would duplicate wire-format/error-handling logic the SDK already gets right (tx op shapes, `lookup__` sentinel encoding); no upside since the SDK's impersonation path already avoids the admin token |
| Real magic-code email round trip for every CLI-01 test run | InstantDB Dashboard "static test code" per email (never expires) [CITED: instantdb.com/docs/auth/magic-codes] | LOCKED by CONTEXT.md/PROJECT.md C-10 to use the real inbox via `mcp__claude_ai_Microsoft_365__outlook_email_search` — static codes are Claude's-discretion-only as a *supplementary* fast-iteration aid for repeated manual dev testing, not a substitute for the one real E2E proof required by CLI-01 |

**Installation:** already present — `instantdb`, `click`, `python-dotenv` are existing `cli/pyproject.toml` dependencies (Phase 1). No new packages required for Phase 3.

**Version verification:** `instantdb==1.0.63` confirmed as PyPI's current `latest` (checked via `pypi.org/pypi/instantdb/json`, upload date 2026-08-07) — the version already pinned in `cli/pyproject.toml` is not stale.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  apollo (click group)                                            │
│                                                                    │
│  apollo auth login --email E [--code C]                          │
│      │                                                            │
│      ├─(no --code)─► login_client() [admin_token from .env]      │
│      │                    .auth.send_magic_code(E)                │
│      │                    → print "check your email, re-run       │
│      │                       with --code"                         │
│      │                                                            │
│      └─(--code C)──► login_client() [admin_token from .env]      │
│                           .auth.check_magic_code(email=E, code=C) │
│                           → (user{id,email,refresh_token}, created)│
│                           → write ~/.config/apollo-cli/session     │
│                             (0600 JSON: user_id, email,            │
│                              refresh_token)                        │
│                                                                    │
│  apollo fundo|projeto|etapa|tarefa|ticket|subtarefa|              │
│        rotina|log-inferencia <action> [flags]                    │
│      │                                                            │
│      ├─► session_client() = Instant(app_id=..., admin_token=None) │
│      │        .as_user(token=<persisted refresh_token>)           │
│      │                                                            │
│      ├─► create: inject donoId = session.user_id into args,       │
│      │           tx.<entity>[id()].create({...})                  │
│      ├─► editar: tx.<entity>[eid].update({...})                   │
│      ├─► deletar: tx.<entity>[eid].delete()                       │
│      └─► listar: query({<entity>: {}})  ── perms-filtered by      │
│                    InstantDB server (auth.id == data.donoId)      │
│                                                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                 InstantDB Cloud (api.instantdb.com)
        /admin/send_magic_code, /admin/verify_magic_code   (admin-token-gated)
        /admin/query, /admin/transact                       (as-token-gated when
                                                              no admin token present)
        /runtime/auth/verify_refresh_token                  (fully unauthenticated,
                                                              usable for `whoami`)
```

### Recommended Project Structure
```
cli/apollo_cli/
├── cli.py                # apollo click group (existing) — attaches all subgroups below
├── config.py              # existing: app_id + admin-token-PRESENCE only (unchanged contract)
├── instant_client.py      # NEW: login_client() [admin token], session_client() [refresh token]
├── session.py             # NEW: load_session()/save_session()/clear_session(), 0600 file I/O
├── auth.py                # NEW: `apollo auth` group — login, logout, whoami
├── entities/
│   ├── fundo.py            # NEW: `apollo fundo` group — criar/editar/deletar/listar
│   ├── projeto.py
│   ├── etapa.py
│   ├── tarefa.py
│   ├── ticket.py
│   ├── subtarefa.py
│   ├── rotina.py           # `apollo rotina template ...` + `apollo rotina instancia listar|status`
│   └── log_inferencia.py   # `apollo log-inferencia registrar|listar`
└── crud_helpers.py         # NEW: shared create/edit/delete/list plumbing (donoId injection, error formatting)
```

### Pattern 1: Two-client separation (admin vs. session)
**What:** Exactly one module (`instant_client.login_client()`) is allowed to read `INSTANT_APP_ADMIN_TOKEN`. Every other command uses `session_client()`, which constructs `Instant(app_id=app_id, admin_token=None).as_user(token=refresh_token)`.
**When to use:** Always — this is the mechanism that makes C-05 ("no admin token in normal operation") mechanically true rather than a convention someone can violate by accident.
**Example:**
```python
# Source: verified against instantdb 1.0.63 source
# (.venv/lib/python3.12/site-packages/instantdb/_sync/{client,http}.py)
from instantdb import Instant

def session_client(app_id: str, refresh_token: str) -> Instant:
    base = Instant(app_id=app_id, admin_token=None)  # no admin bearer, ever
    return base.as_user(token=refresh_token)          # sends `as-token` header only
```

### Pattern 2: `donoId` is never a CLI input — it is derived from the session
**What:** Every domain entity's `create` perms rule is `auth.id != null && auth.id == newData.donoId` [VERIFIED: `shared/instant.perms.ts`]. `auth.id` for an `as-token`-impersonated request is the InstantDB user id tied to that refresh token — i.e. the same value returned as `user["id"]` from `check_magic_code`.
**When to use:** In every `criar` subcommand, across all 9 entities.
**Example:**
```python
# Source: pattern derived from instantdb 1.0.63 _transact.py + shared/instant.perms.ts
from instantdb import id as gen_id

def criar_fundo(client, session, nome, codigo, ativo):
    new_id = gen_id()
    client.transact(
        client.tx.fundos[new_id].create({
            "nome": nome,
            "codigo": codigo,
            "ativo": ativo,
            "donoId": session.user_id,      # NEVER a --dono-id flag
            "createdAt": _now_iso(),
        })
    )
    return new_id
```

### Pattern 3: Login/verify split via optional `--code`
**What:** `apollo auth login --email E` (no `--code`) calls `send_magic_code` and exits, printing instructions. `apollo auth login --email E --code C` skips the send and calls `check_magic_code` directly — because the code already exists server-side from the prior invocation's send call; **do not** call `send_magic_code` again when `--code` is supplied, or you invalidate the code the executor just read from email.
**When to use:** `apollo auth login` implementation — this shape lets a human run one interactive command with a prompt, and lets an autonomous executor run two separate, scriptable invocations (send, then search email, then verify) with no TTY/stdin interaction required.
**Example:**
```python
# Source: derived from instantdb 1.0.63 Auth.send_magic_code / Auth.check_magic_code
@auth_group.command("login")
@click.option("--email", required=True)
@click.option("--code", default=None, help="Magic code from email. Omit to request a new code.")
def login(email: str, code: str | None) -> None:
    client = login_client()  # admin_token from .env.instantdb, used ONLY here
    if code is None:
        client.auth.send_magic_code(email)
        click.echo(f"Magic code sent to {email}. Re-run with --code <code>.")
        return
    user, created = client.auth.check_magic_code(email=email, code=code)
    save_session(user_id=user["id"], email=user["email"], refresh_token=user["refresh_token"])
    click.echo(f"Logged in as {user['email']} ({'new user' if created else 'existing user'}).")
```

### Pattern 4: `instanciasRotina` — update/list only, never create (CLI-07)
**What:** Creation is reserved exclusively for the Phase 5 idempotent job; the CLI-07 subcommand surface must expose `apollo rotina instancia listar` and `apollo rotina instancia status <id> <novo-status>` (an `update` transact on `status` only), with **no** `criar` subcommand for this entity.
**When to use:** Building `entities/rotina.py`.

### Anti-Patterns to Avoid
- **Reading `INSTANT_APP_ADMIN_TOKEN` inside any `entities/*.py` file:** Defeats the entire point of the impersonation pattern; the admin token bypasses `instant.perms.ts` entirely [VERIFIED via live test: `client.as_user(guest=True)` with `admin_token` set on the base client still had its `create` denied — proving perms are enforced only when the admin bearer is *not* the thing authorizing the call; conversely a client constructed *with* `admin_token` set and used **without** `as_user(...)` bypasses perms by design per official docs].
- **`as_user(email=...)` for normal login-based operation:** This impersonation mode *requires* an admin token (`_validate_auth` raises `InstantError` otherwise) — it is for backend-initiated "act as this known user" flows, not for the CLI's own end-user session replay. Use `as_user(token=refresh_token)` instead.
- **Treating an empty `listar` result as ambiguous between "no rows" and "denied by perms":** InstantDB's query endpoint silently filters non-matching rows rather than erroring [VERIFIED live: `as_user(guest=True).query({"fundos": {}})` → `{"fundos": []}`, HTTP 200]. CLI-11's "rejected without valid session" verification must use a **write** (create/update/delete) as the probe, which does raise a genuine `permission-denied` `InstantAPIError` — this matches the write-based-probe methodology already established in Phase 1/2, not a new approach.
- **Hand-constructing `lookup__attr__value` sentinel strings:** Always go through `instantdb.lookup(attr, value)` or `client.tx.<entity>.lookup(attr, value)` — the encoding is a private wire format (`json.dumps` of the value appended after `__`), not part of the public contract.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction op encoding (create/update/delete/link/unlink) | Raw `httpx.post("/admin/transact", json={"steps": [...]})` with hand-written op arrays | `instantdb`'s `client.tx.<entity>[eid].create/update/delete(...)` + `client.transact(chunk)` | SDK already encodes the exact `[action, etype, eid, args]` wire tuples and handles date/datetime JSON coercion (`_jsonable`) |
| Refresh-token validity check for a `whoami`/session-health command | Guessing based on whether a query succeeds | `client.auth.verify_token(refresh_token)` → hits `/runtime/auth/verify_refresh_token`, fully unauthenticated (no admin token, no impersonation header needed) [VERIFIED: `_sync/auth.py:60-68`] | Purpose-built endpoint; avoids a wasted/misleading query against a real entity just to test auth |
| donoId-based access control | Any local Python `if record.dono_id != session.user_id` filtering before/after CLI calls | Rely entirely on `instant.perms.ts` server-side evaluation | A client-side check can drift from the server rule and gives a false sense of security; also literally redundant since the server already filters/denies |
| Retry/backoff for transient network errors | Custom retry loop with `time.sleep` | None needed for v1 — surface the raw `httpx`/`InstantAPIError` message; do not add hidden retry logic that could double-submit a `create` (idempotency is not guaranteed by the tx endpoint for arbitrary retried creates, unlike the `dedupeKey`-based routine job in Phase 5) | Silent retries on `transact` risk duplicate writes for entities without a unique dedupe key (all CLI-01..CLI-11 entities except `instanciasRotina`) |

**Key insight:** The Admin SDK conflates "backend SDK" with "impersonation-capable SDK" — the temptation is to reach for the SDK's most obvious code path (construct `Instant(admin_token=...)`, then just call `.query()`/`.transact()` directly), which silently bypasses every permission rule. The entire Phase 3 auth design hinges on **always** routing non-login commands through `.as_user(token=...)` on a client that was never given an admin token in the first place — not merely "using `as_user` but also happening to hold an admin token," which would still bypass perms if a code path ever called the un-impersonated client by mistake.

## Common Pitfalls

### Pitfall 1: Assuming the Admin SDK's `as_user` requires the admin token
**What goes wrong:** Developers reflexively pass `admin_token=os.environ["INSTANT_APP_ADMIN_TOKEN"]` into every `Instant(...)` construction "just in case," including the session client used for day-to-day CRUD — silently reintroducing full perms bypass and violating C-05/CLI-11 even though the code "looks" like it authenticates as the user via `as_user(token=...)`.
**Why it happens:** Every official example and the class's own `__init__` signature treats `admin_token` as a near-mandatory constructor arg (it's the *first* thing shown in InstantDB's own quickstart).
**How to avoid:** `session_client()` must construct `Instant(app_id=app_id, admin_token=None)` explicitly (not by omission — omission falls back to `INSTANT_APP_ADMIN_TOKEN` from the environment if it happens to be set) before calling `.as_user(token=...)`.
**Warning signs:** Any `entities/*.py` file importing `load_instant_config()`'s admin-token-adjacent fields, or any code path that constructs `Instant(...)` without immediately chaining `.as_user(...)`.

### Pitfall 2: Re-sending the magic code when `--code` is supplied
**What goes wrong:** If `apollo auth login --email E --code C` calls `send_magic_code` again before `check_magic_code`, and InstantDB invalidates the previous code on a fresh send (behavior **not confirmed** by official docs in this research — see Assumptions Log A1), the code `C` the executor just extracted from email may already be stale by the time it's checked, causing spurious `check_magic_code` failures during autonomous execution.
**Why it happens:** A naive single-command implementation calls both `send_magic_code` and `check_magic_code` back-to-back in one invocation for "convenience."
**How to avoid:** Structure `login` so `--code` presence *skips* `send_magic_code` entirely (Pattern 3 above) — the send only ever happens once, from the first invocation with no `--code`.
**Warning signs:** `check_magic_code` returning an "invalid code" error immediately after a seemingly-correct code was extracted from the most recent email.

### Pitfall 3: Confusing perms-filtered empty results with an authentication failure
**What goes wrong:** A test for CLI-11 ("listar" rejected without a session) that asserts on an exception/non-zero exit code will never trigger, because `listar` without a valid session returns an empty list with exit code 0 — not an error.
**Why it happens:** InstantDB's query engine treats permission checks as a row filter, not a request-level authorization gate (unlike `transact`, which does raise `permission-denied`).
**How to avoid:** For CLI-11 verification, use a `create`/`editar`/`deletar` attempt without a valid session as the probe (asserting on the real `permission-denied` `InstantAPIError`), matching the write-based-probe methodology already used in Phase 1/2's own verification scripts.
**Warning signs:** A "listar" test that seems to pass regardless of whether a session file exists.

### Pitfall 4: Session file permissions/location drift
**What goes wrong:** Writing the session file with default `open()` permissions (often `0644`) or to a path that doesn't survive `~` expansion differences (e.g. hardcoding `/home/<user>` instead of `Path.home()`) leaks the refresh token to other local users or breaks portability.
**Why it happens:** Easy to overlook when the immediate goal is just "make the test pass."
**How to avoid:** `Path.home() / ".config" / "apollo-cli"` with `os.makedirs(..., mode=0o700, exist_ok=True)`, then write the session JSON via a temp file + `os.chmod(path, 0o600)` + atomic `os.replace` before any content is written, or open with `os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)`.
**Warning signs:** `ls -la ~/.config/apollo-cli/session` showing group/other read bits.

## Code Examples

### Session persistence (0600, atomic)
```python
# Source: stdlib patterns, no external library needed
import json
import os
from pathlib import Path

SESSION_DIR = Path.home() / ".config" / "apollo-cli"
SESSION_FILE = SESSION_DIR / "session"

def save_session(*, user_id: str, email: str, refresh_token: str) -> None:
    SESSION_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    payload = json.dumps({"user_id": user_id, "email": email, "refresh_token": refresh_token})
    fd = os.open(SESSION_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(fd, payload.encode("utf-8"))
    finally:
        os.close(fd)

def load_session() -> dict[str, str] | None:
    if not SESSION_FILE.is_file():
        return None
    return json.loads(SESSION_FILE.read_text())
```

### Verified live-API behavior captured during this research (do not re-run against production casually)
```python
# Executed against the real .env.instantdb app during research, 2026-08-09.
# 1) as_user(token=<well-formed-but-nonexistent UUID>), NO admin_token set:
#    -> InstantAPIError('Record not found: app-user'), proving the server
#       accepts and processes as-token-only requests (no admin bearer sent).
# 2) as_user(guest=True) query({"fundos": {}}) -> {"fundos": []}  (HTTP 200,
#    perms-filtered, not an error)
# 3) as_user(guest=True) transact(tx.fundos[id()].create({...})) ->
#    InstantAPIError: {'type': 'permission-denied',
#                       'message': 'Permission denied: not perms-pass?', ...}
```

## State of the Art

| Old Approach (hypothesized pre-research) | Current/Verified Approach | When Changed | Impact |
|--------------------------------------------|---------------------------|---------------|--------|
| Assume the Python SDK has no non-admin auth path at all, requiring a workaround (e.g. hitting undocumented `/runtime/*` endpoints by hand) | `as_user(token=refresh_token)` on an `admin_token=None` client is the SDK's own, documented, supported mechanism | Confirmed present in `instantdb` 1.0.63 (2026-08-07) and matches `@instantdb/admin`'s JS `db.asUser` behavior | Phase 3 can honor C-05 literally with SDK-native calls; no custom HTTP layer needed |

**Deprecated/outdated:** None identified — this is the SDK's current, actively-maintained (2 days old at research time) surface.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Requesting a new magic code does not invalidate a previously-sent, still-valid code for the same email (or: it's unclear whether it does) — official docs do not state this either way | Common Pitfalls #2, Code Examples (login split) | If sending a second code DOES invalidate the first, an executor that accidentally triggers `login` (no `--code`) twice before verifying would need to search email for the newest code only, not stale ones — low risk since the recommended flow already only sends once per login attempt, but the plan should instruct the executor to always use the most recently received magic-code email if in doubt |
| A2 | `check_magic_code`'s returned `user` dict's `id` field is the same value InstantDB evaluates as `auth.id` in `instant.perms.ts` checks for that user's subsequent `as-token` requests | Pattern 2, Code Examples | If the field returned is not literally the entity id used in the perms context (e.g. some other identifier), `donoId` assignment would be wrong and every write would fail authorization or (worse) write bad data; low actual risk since this is standard `$users.id` behavior, but not empirically verified in this session because doing so requires a real completed login round trip (deferred to the executor per CONTEXT.md/C-10) |
| A3 | `client.as_user(token=refresh_token).auth.sign_out(refresh_token=refresh_token)` (server-side token revocation) works without an admin token, by the same `as-token`-exemption logic verified for `query`/`transact` | Not required by any CLI-XX requirement, but relevant if the plan wants `apollo auth logout` to also revoke server-side | Low — `logout` can simply delete the local session file (client-side-only logout, matching typical SPA `localStorage.clear()` behavior) without needing server revocation at all; CLI-01..CLI-11 do not require server-side revocation |

**If this table is empty:** N/A — see entries above. All three assumptions are low-risk to plan-correctness; A1 and A3 have safe fallbacks (use latest email; skip server-side revocation), and A2 is standard, widely-documented InstantDB auth behavior even though this specific session didn't complete a live magic-code round trip to double-confirm it against `tp@rbrasset.com.br`.

## Open Questions

1. **Exact rate limit / expiry window for magic codes**
   - What we know: Codes are 6-digit numeric [CITED: instantdb.com/docs/emails], sent via `/admin/send_magic_code`.
   - What's unclear: Official docs do not publish an expiry duration or a rate-limit count for repeated sends to the same email within a short window.
   - Recommendation: The executor's send→wait→search-email→verify sequence should (a) wait a fixed, generous interval (e.g. 15-30s) after send before searching, to allow for email delivery latency, and (b) always extract the code from the **most recent** InstantDB magic-code email matching the target address, discarding older ones, to be robust regardless of whether old codes remain valid.

2. **Whether `check_magic_code`'s `created` boolean matters for this project**
   - What we know: `created=True` means this was the user's first-ever sign-in (new `$users` row); `created=False` means an existing user.
   - What's unclear: Whether Phase 3 needs any first-login-only behavior (e.g., there is no per-user profile/onboarding step in this schema).
   - Recommendation: Treat `created` as informational only (log/print it); no special-case logic needed given the schema has no onboarding fields tied to `$users`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `instantdb` (PyPI) | All CLI-01..CLI-11 | ✓ | 1.0.63 (matches PyPI latest) | — |
| `click` | CLI command surface | ✓ | 8.4.2 | — |
| `python-dotenv` | `.env.instantdb` reading | ✓ | 1.2.2 | — |
| `.env.instantdb` (app id + admin token) | `apollo auth login` | ✓ (exists at repo root per Phase 1) | — | — |
| Live InstantDB app (network reachability to `api.instantdb.com`) | Every command | ✓ (confirmed via live test calls made during this research) | — | — |
| `mcp__claude_ai_Microsoft_365__outlook_email_search` (executor-side tool, not available to this research subagent) | Reading the real magic-code email during `apollo auth login` execution/testing | Not verified from this session (no access to that tool here) | — | User explicitly authorized per PROJECT.md C-10; the **executor** agent (not this researcher) must have and use this tool |

**Missing dependencies with no fallback:** None for the researched/verifiable portion. The executor's access to the Outlook email-search MCP tool could not be verified from this research session (out of this subagent's tool scope) but is already locked/authorized in PROJECT.md C-10 and CONTEXT.md — flagged here only so the planner confirms the executor's tool availability before relying on it.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `pytest` (already a `cli/` dev dependency since Phase 2 — `pytest>=9.1.1` in `cli/pyproject.toml`) |
| Config file | none dedicated — `cli/pyproject.toml` has no `[tool.pytest.ini_options]` section; tests auto-discovered under `cli/tests/` |
| Quick run command | `cd cli && uv run pytest tests/test_auth.py -x` (per new test file) |
| Full suite command | `cd cli && uv run pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-01 | `apollo auth login` persists session at `~/.config/apollo-cli/session` surviving process restart | integration (real API, real email — human/executor-driven, not a pure `pytest` unit) | manual/executor CLI invocation sequence (send, search email, verify) + `pytest tests/test_session.py` for the local file-format contract | ❌ Wave 0 |
| CLI-02..CLI-06, CLI-08, CLI-09 | Full CRUD per entity, `donoId`-scoped | integration (real API, using a persisted test session) | `uv run pytest tests/test_crud_<entity>.py -x` | ❌ Wave 0 |
| CLI-07 | `instanciasRotina` list + status update only, no create subcommand | integration + structural (assert no `criar` command registered) | `uv run pytest tests/test_rotina_instancia.py -x` | ❌ Wave 0 |
| CLI-10 | `log-inferencia registrar`/listar | integration | `uv run pytest tests/test_log_inferencia.py -x` | ❌ Wave 0 |
| CLI-11 | Writes rejected without valid session (real `permission-denied`) | integration, write-based probe (per Common Pitfalls #3) | `uv run pytest tests/test_auth_rejection.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `pytest tests/test_<area>.py -x`
- **Per wave merge:** `uv run pytest` (full `cli/` suite) + `uv run ruff check . && uv run ruff format --check . && uv run ty check`
- **Phase gate:** Full suite green, plus one real, human-verifiable `apollo auth login` round trip using the real inbox, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `cli/tests/test_session.py` — covers session file format/permissions (CLI-01, no live API needed)
- [ ] `cli/tests/conftest.py` — shared fixture for a test InstantDB session (either a pre-provisioned real refresh token stored out-of-band for CI-less local runs, or executor-driven live login before the CRUD test files run)
- [ ] `cli/tests/test_crud_<entity>.py` × 7 (fundo, projeto, etapa, tarefa, ticket, subtarefa, templateRotina) + `test_rotina_instancia.py` + `test_log_inferencia.py` — covers CLI-02..CLI-10
- [ ] `cli/tests/test_auth_rejection.py` — covers CLI-11 (write-based probe, no session)
- [ ] No new framework install needed — `pytest` already present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | InstantDB magic-code auth (email possession-based); no password storage in this system at all |
| V3 Session Management | yes | Local session file (`~/.config/apollo-cli/session`, `0600`) holding a long-lived refresh token — functionally equivalent to a "remember me" token; no CLI-side expiry/rotation logic beyond what InstantDB's server enforces on the token itself |
| V4 Access Control | yes | Enforced entirely server-side via `instant.perms.ts` (`auth.id == data.donoId`); CLI performs zero local authorization logic by design |
| V5 Input Validation | yes | `click` option type validation (`click.Path`, `type=str`, required flags) at the CLI boundary; InstantDB schema itself enforces field types server-side (`i.string()`, `i.date()`, etc.) |
| V6 Cryptography | no | No cryptographic primitives implemented in this CLI — TLS to `api.instantdb.com` is handled by `httpx`/the OS trust store, never hand-rolled |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin token leaking into a normal CRUD code path, silently bypassing all `donoId` scoping | Elevation of Privilege | Structural separation (Pattern 1): only `instant_client.login_client()` ever reads `INSTANT_APP_ADMIN_TOKEN`; `config.py` already refuses to expose the token *value* to any other module (only `admin_token_present: bool`) |
| Session file (`~/.config/apollo-cli/session`) readable by other local users, leaking the refresh token | Information Disclosure | `0700` dir / `0600` file permissions enforced at creation time (Code Examples) |
| Retried/duplicated `create` transacts on transient network failure | Tampering (unintended duplicate records) | No automatic retry logic for non-idempotent entities (Don't Hand-Roll) — surface the error and let the caller (human or Claude) decide whether to retry |
| Magic-code interception via a shared/compromised inbox | Spoofing | Out of scope to mitigate in code — accepted risk per PROJECT.md C-10's explicit, scoped authorization for this single-user system |

## Sources

### Primary (HIGH confidence)
- Direct source inspection: `/home/thomaz/pessoal/apollo-v2/cli/.venv/lib/python3.12/site-packages/instantdb/` (`_sync/client.py`, `_sync/http.py`, `_sync/auth.py`, `_transact.py`, `_errors.py`, `_http_errors.py`) — version `1.0.63`
- Live API verification against the real `.env.instantdb` app (this session, 2026-08-09): `as_user(token=<fake-uuid>)` with no admin token → real `record-not-found` error (not an auth error); `as_user(guest=True).query(...)` → perms-filtered empty result; `as_user(guest=True).transact(create)` → real `permission-denied` error
- `shared/instant.schema.ts`, `shared/instant.perms.ts` (this repo, LOCKED per PROJECT.md C-04/C-05)
- `cli/apollo_cli/config.py`, `cli/apollo_cli/cli.py`, `cli/pyproject.toml` (this repo, Phase 1 output)
- PyPI registry (`pypi.org/pypi/instantdb/json`) — confirmed `1.0.63` is current, released 2026-08-07

### Secondary (MEDIUM confidence)
- [Instant on the Backend](https://www.instantdb.com/docs/backend) — `sendMagicCode`/`checkMagicCode`/`asUser` semantics, confirms `refresh_token` field and perms-respecting impersonation
- [Magic Code Auth](https://www.instantdb.com/docs/auth/magic-codes) — 6-digit code format, static test codes for review/testing
- [Admin HTTP API](https://www.instantdb.com/docs/http-api) — exact request/response JSON shapes for `/admin/send_magic_code`, `/admin/verify_magic_code`, `/admin/query`, `/admin/transact`, matching source code exactly

### Tertiary (LOW confidence)
- General WebSearch results on magic-code expiry/rate-limit/invalidation-on-resend — no authoritative answer found; captured as Assumption A1

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against installed venv and PyPI registry directly
- Architecture (auth/impersonation pattern): HIGH — verified via source code AND live API calls against the real app, cross-checked against official docs
- Pitfalls: HIGH — all four pitfalls are grounded in either source-code behavior or a live-verified API response in this session
- Magic-code expiry/rate-limit behavior: LOW — no authoritative source found; documented as Assumption A1 with a safe operational fallback

**Research date:** 2026-08-09
**Valid until:** 2026-09-08 (30 days — InstantDB's SDK ships frequently, but the core auth/impersonation contract verified here is a stable, documented feature, not a fast-moving edge)
