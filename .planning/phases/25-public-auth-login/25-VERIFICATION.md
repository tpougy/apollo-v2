---
phase: 25-public-auth-login
verified: 2026-08-12T21:04:23Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 25: Public Auth Login Verification Report

**Phase Goal:** `apollo auth login` authenticates a real user via InstantDB's public `/runtime/auth/*`
endpoints, and no CLI command — including login — reads or requires `INSTANT_APP_ADMIN_TOKEN` to operate
normally, while `apollo doctor`/`admin_token_present` keep working unchanged for project-development support.
**Verified:** 2026-08-12T21:04:23Z
**Status:** passed
**Re-verification:** No — initial verification

This verification is **live/executed, not static**, per this project's standing convention (PROJECT.md):
every automated check below was actually re-run in this session against the real `cli/` source tree and,
where marked "live", against the real production InstantDB API and the real `tp@rbrasset.com.br` Outlook
inbox — not inferred from SUMMARY.md's narration.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `apollo auth login`'s send/verify path goes through direct `httpx` calls to `/runtime/auth/send_magic_code`/`verify_magic_code`, never the admin SDK | ✓ VERIFIED | Read `cli/apollo_cli/auth.py` in full: `login()` calls `_post_public_auth()` (a bare `httpx.post(f"{DEFAULT_API_URI}{path}", ...)`), zero `login_client`/`Instant(` construction inside `login()`. Re-ran `tests/test_auth_live.py -m live -k invalid_code` — **passed live** against the real API (0.46s). Re-ran `tests/test_auth_live.py -m live -k round_trip` — **passed live**, a genuine send+read-email+verify cycle (16.18s). |
| 2 | `login_client()` still exists (not deleted) and is used only by `test_cross_user_isolation.py`'s admin teardown | ✓ VERIFIED | `cli/apollo_cli/instant_client.py:48` still defines `login_client()`. `grep -rn login_client cli/apollo_cli/ cli/tests/` shows its only real *call sites* are `test_cross_user_isolation.py:367` (admin `delete_user` teardown) and `test_instant_client.py:46` (a negative unit test for `AdminTokenMissingError`). `auth.py` contains zero calls to it (only a comment). |
| 3 | No file in `apollo_cli/` outside the two documented exemptions references `INSTANT_APP_ADMIN_TOKEN` in a way that would make `apollo auth login` (or any other normal command) depend on it | ✓ VERIFIED | `grep -rn INSTANT_APP_ADMIN_TOKEN cli/apollo_cli/` shows the literal string appears only in `instant_client.py` (docstrings + `_ADMIN_TOKEN_KEY` constant, used only by `login_client()`/`_read_admin_token()`) and `config.py` (docstring + `_ADMIN_TOKEN_KEY`, used only for the boolean `admin_token_present` presence check — value never read). Re-ran the AST-walk gate `tests/test_auth_rejection.py -k admin_token` (19 files parametrized) — **all passed**, confirming `auth.py` and every other operational file is clean. Re-ran `tests/test_instant_client.py`'s parallel `_EXEMPT_FILENAMES` gate — passed as part of the full suite run below. |
| 4 | `apollo doctor`/`admin_token_present` still work correctly and unchanged in intent | ✓ VERIFIED | Ran `env -u INSTANT_APP_ADMIN_TOKEN uv run apollo doctor` live: printed `env file: ...`, `app id: ok (...d2a8) — source: file`, `admin token: present (dev/ops only — never used at runtime)` — correct three-line contract, admin token reported present-in-file even though absent from the shell (proves it reads the `.env.instantdb` file, never the process env, matching pre-phase intent). `config.py`'s `InstantConfig.admin_token_present` field/logic is untouched by this phase (confirmed via `git diff --stat` across the phase's commits — `config.py` does not appear in the changed-files list at all). |
| 5 | A real magic-code round trip was genuinely proven live, and `apollo auth login`'s output/exit-code contract is unchanged | ✓ VERIFIED | `cli/tests/test_auth_live.py::test_login_round_trip_completes_with_admin_token_entirely_absent` re-run live in this session (16.18s): real `apollo auth login --email tp@rbrasset.com.br` sent a code, `cli/tests/helpers/magic_code.py`'s `read_magic_code_after()` genuinely polled and read the real code from the real Outlook inbox via `orules.ps1 peek` (powershell.exe confirmed reachable: `/mnt/c/windows/.../powershell.exe`), and `apollo auth login --email ... --code <real-code>` verified it, ending with `{"status": "logged_in", ...}` and a persisted isolated session file — asserted by the test itself, not narrated. Output/exit-code contract (`code_sent`/`logged_in`/`auth_failed` exit 3/`network_error` exit 4) confirmed byte-shape-unchanged by reading `auth.py`'s unmodified `except` branches and by the passing `invalid_code`/`network` tests below. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cli/apollo_cli/auth.py` | `login()` rewritten to call public endpoints via `_post_public_auth()`, zero `login_client` import/call | ✓ VERIFIED | Read in full. `_post_public_auth()` present, `timeout=DEFAULT_TIMEOUT` (60s/10s-connect) passed explicitly (not httpx's 5s default). |
| `cli/apollo_cli/instant_client.py` | `login_client()` kept, docstrings corrected to name test-only caller | ✓ VERIFIED | Module + function docstrings both name `test_cross_user_isolation.py`'s teardown as the one legitimate caller; no longer claims `apollo_cli.auth.login` calls it. `session_client()`/`_read_admin_token()` bodies untouched. |
| `cli/pyproject.toml` | `httpx` declared explicit `[project.dependencies]` entry | ✓ VERIFIED | `grep httpx cli/pyproject.toml` confirms `httpx>=0.27,<1`; `uv.lock` still resolves `httpx==0.28.1` (unchanged, zero new install surface). |
| `cli/README.md` | Admin-token section corrected — login no longer needs an admin-capable client | ✓ VERIFIED | Read section: states no `apollo` command including `login` reads the token; names `instant-cli` + test-harness teardown as the only consumers. |
| `cli/tests/test_auth_rejection.py` | `_LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES` tightened (drops `auth.py`); new network-error test added | ✓ VERIFIED | Set is `{"instant_client.py"}`. New test `test_login_with_unreachable_api_uri_exits_network_error` present and **re-run live in this session — passed** (real refused connection to `127.0.0.1:1`, no mocking). |
| `cli/tests/test_auth_live.py` | New live invalid-code test + new live happy-path round-trip test | ✓ VERIFIED | Both present. Both **re-run live in this session — passed** (see Observable Truths #1/#5). |
| `cli/tests/helpers/magic_code.py` | Faithful Python port of `web/e2e/helpers/magic-code.ts` | ✓ VERIFIED | Side-by-side read against the TS source: `ORULES_COMMAND` string, `\b(\d{6})\b` regex, `"instantdb.com"` sender substring, `\n──\s` block separator all match verbatim. One documented, justified deviation (`None`-on-no-match instead of `throw`) — correct given the Python caller's baseline-read use case. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.py:login()` | `POST /runtime/auth/send_magic_code`/`verify_magic_code` | `httpx.post()` in `_post_public_auth()` | ✓ WIRED | Confirmed by live test execution reaching the real production API and getting real `record-not-found`/success responses. |
| `_post_public_auth()`'s non-2xx response | `except InstantAPIError`/`except httpx.HTTPError` in `login()` | `api_error_from_response()` (reused from `instantdb._http_errors`) | ✓ WIRED | Live `invalid_code` test asserts `exit 3`/`{"error":"auth_failed","type":"record-not-found"}`; live-adjacent `network` test asserts `exit 4`/`{"error":"network_error"}` — both branches proven to fire correctly. |
| `test_cross_user_isolation.py:367` | `instant_client.py::login_client()` | direct import + call | ✓ WIRED | `login_client` still importable; `test_cross_user_isolation.py` still imports and calls it at line 367 for its `delete_user` teardown — unchanged. |
| `test_auth_rejection.py`'s AST-walk gate | `apollo_cli/*.py` (19 files) | `ast.walk` scanning for `INSTANT_APP_ADMIN_TOKEN`/`login_client`/`Instant(` | ✓ WIRED | Re-ran all 19 parametrized cases live in this session — all passed, `auth.py` included in the strict (non-exempt) set for the `login_client` check. |

### Behavioral Spot-Checks / Live Execution (Step 7b/7c — actually re-run, not narrated)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full offline suite | `env -u INSTANT_APP_ADMIN_TOKEN uv run pytest -m "not live and not packaging" -q` | 348 passed, 2 skipped, 71 deselected | ✓ PASS |
| Admin-token AST-walk gate (auth_rejection) | `uv run pytest tests/test_auth_rejection.py -k admin_token -v` | 19/19 passed | ✓ PASS |
| Network-error test (real refused connection) | `uv run pytest tests/test_auth_rejection.py -k network -v` | 1/1 passed | ✓ PASS |
| Live invalid-code test | `uv run pytest tests/test_auth_live.py -m live -k invalid_code -v` | 1/1 passed (0.46s), real API call, `record-not-found` | ✓ PASS |
| Live full happy-path round trip (real email) | `uv run pytest tests/test_auth_live.py -m live -k round_trip -v` | 1/1 passed (16.18s), real send + real Outlook read + real verify + persisted session file | ✓ PASS |
| `apollo doctor` with admin token absent from shell | `env -u INSTANT_APP_ADMIN_TOKEN uv run apollo doctor` | `admin token: present (dev/ops only — never used at runtime)` (reads file, not env) | ✓ PASS |
| Full suite, all markers, admin token absent | `env -u INSTANT_APP_ADMIN_TOKEN uv run pytest -q` | 418 passed, 2 skipped, 1 xfailed, 0 failed | ✓ PASS |
| `ruff check` / `ruff format --check` / `ty check` across `cli/` + `../shared/scripts` | per README's documented commands | All checks passed; 48 files already formatted | ✓ PASS |
| Scope containment | `git diff --stat 9f3e88e..4ef1612 -- web/ shared/ instant.perms.ts` | empty output | ✓ PASS (no out-of-scope edits) |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| AUTH-01 | Direct httpx calls to public send/verify_magic_code | ✓ SATISFIED | `_post_public_auth()` implementation + live invalid-code and round-trip tests, both re-run and passing. |
| AUTH-02 | Observable JSON/exit-code contract unchanged | ✓ SATISFIED | `except InstantAPIError`/`except httpx.HTTPError` branches structurally unchanged; live tests confirm `auth_failed`/exit 3 and `network_error`/exit 4 shapes. |
| AUTH-03 | No CLI command reads/depends on `INSTANT_APP_ADMIN_TOKEN` | ✓ SATISFIED | AST-walk gate (19 files) re-run passing; full suite + `apollo doctor` re-run with the var genuinely unset. |
| AUTH-04 | `admin_token_present`/`apollo doctor` unchanged | ✓ SATISFIED | `config.py` untouched by this phase's diff; `apollo doctor` re-run live, correct output. |
| AUTH-05 | `test_auth_rejection.py`/`test_instant_client.py` updated for the stronger guarantee | ✓ SATISFIED | `_LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES` tightened (drops `auth.py`), new network-error test added and passing; `test_instant_client.py`'s exemption set unchanged with a clarifying comment. |

No orphaned requirements — ROADMAP.md's `phase_req_ids` for Phase 25 (`AUTH-01..AUTH-05`) exactly match REQUIREMENTS.md's traceability table and both plans' `requirements:` frontmatter union.

### Anti-Patterns Found

None. Scanned all seven phase-modified files (`auth.py`, `instant_client.py`, `pyproject.toml`, `README.md`,
`test_auth_rejection.py`, `test_instant_client.py`, `test_auth_live.py`) plus the two new files
(`tests/helpers/__init__.py`, `tests/helpers/magic_code.py`) for `TODO`/`FIXME`/`HACK`/`XXX`/`TBD`/
`placeholder`/empty-return stubs — zero hits beyond doc comments explaining *why* a design choice was made
(e.g. the intentional `None`-vs-`throw` deviation in `magic_code.py`, which is a documented, justified
behavioral difference, not a stub).

### Human Verification Required

None. Every must-have truth was verified by direct code reading plus a live, re-executed test or command in
this session — no visual, real-time-feel, or external-service-integration item remains that a human needs to
manually confirm beyond what was already executed here.

### Gaps Summary

None. All five observable truths verified, all required artifacts present/substantive/wired, all key links
wired, all five requirements (AUTH-01 through AUTH-05) satisfied with live evidence re-executed in this
verification session (not just SUMMARY.md narration), zero anti-patterns, zero out-of-scope edits. The phase
goal — public-endpoint login with zero operational dependency on `INSTANT_APP_ADMIN_TOKEN`, `apollo doctor`
unchanged — is achieved and independently confirmed.

---

_Verified: 2026-08-12T21:04:23Z_
_Verifier: Claude (gsd-verifier)_
