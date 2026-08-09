---
phase: 03-cli-auth-crud
plan: 01
subsystem: auth
tags: [instantdb, click, magic-code-auth, session, cli]

# Dependency graph
requires:
  - phase: 01-repo-scaffold-live-schema
    provides: cli/apollo_cli/config.py (load_instant_config), the cli/ uv package, instant.perms.ts rules
provides:
  - "cli/apollo_cli/session.py — 0600/0700 Session persistence (save_session, load_session, clear_session, session_path)"
  - "cli/apollo_cli/instant_client.py — login_client() (admin, login-only) vs session_client() (as-token impersonation, structurally immune to INSTANT_APP_ADMIN_TOKEN env fallback)"
  - "cli/apollo_cli/auth.py — apollo auth login|logout|whoami click group, JSON stdout/stderr, EXIT_NO_SESSION/EXIT_API_ERROR/EXIT_NETWORK_ERROR"
  - "A persisted, live InstantDB session at ~/.config/apollo-cli/session for user_id adf0d402-06df-4406-a5c7-ce82ee1bcb7e (tp@rbrasset.com.br)"
  - "cli/tests/test_session.py, cli/tests/test_instant_client.py, cli/tests/test_auth_live.py"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, phase-5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-client separation: login_client() (admin bearer, login-flow only) vs session_client() (admin_token='' + as_user(token=...), never admin-capable even under a hostile env)"
    - "0600 file / 0700 dir enforced via os.open(..., mode) + unconditional os.chmod on every save, re-tightening pre-existing loose permissions"
    - "Session dataclass declares refresh_token: str = field(repr=False) so no traceback/echo can leak it"
    - "All CLI output is a single JSON document — success on stdout, errors on stderr with dedicated EXIT_* constants"
    - "Real, non-mocked auth-flow verification via a live pytest marker (@pytest.mark.live) that skips cleanly when no session exists"

key-files:
  created:
    - cli/apollo_cli/session.py
    - cli/apollo_cli/instant_client.py
    - cli/apollo_cli/auth.py
    - cli/tests/test_session.py
    - cli/tests/test_instant_client.py
    - cli/tests/test_auth_live.py
    - .planning/phases/03-cli-auth-crud/03-01-LOGIN-EVIDENCE.md
  modified:
    - cli/apollo_cli/cli.py
    - cli/pyproject.toml

key-decisions:
  - "session_client() constructs Instant(app_id=..., admin_token=\"\") (empty string, never None) specifically to defeat the SDK's os.environ[\"INSTANT_APP_ADMIN_TOKEN\"] fallback that triggers only when admin_token is None."
  - "INSTANT_APP_ADMIN_TOKEN is read in exactly one function (instant_client._read_admin_token), reachable only from login_client(), which is reachable only from auth.login — enforced by an AST-walk test over every other module in the package."
  - "whoami() calls the unauthenticated verify_token endpoint directly via Instant(app_id=..., admin_token=\"\") rather than session_client()/login_client(), and reports identity from the SERVER response, not from local file contents — a corrupted-but-well-formed local session cannot fake a healthy whoami."
  - "The CLI-01 live proof was executed as a genuinely fresh round trip (apollo auth logout first) rather than reusing a prior proof-of-concept session, to produce first-hand evidence."
  - "On this machine, the magic-code email was read via a WSL/PowerShell COM tool (orules.ps1 peek) against real Outlook Classic, not via the mcp__claude_ai_Microsoft_365__outlook_email_search tool named in PROJECT.md C-10 and in this plan's Task 3 — see Deviations below."

patterns-established:
  - "Pattern: every InstantDB-facing CLI command wraps calls in try/except InstantAPIError / httpx.HTTPError and converts to a JSON error + specific exit code (1/3/4) — no raw traceback ever reaches the user. Plans 03-02..03-05 re-export EXIT_* from a shared crud_helpers module per the plan's key_links."

requirements-completed: [CLI-01]

# Metrics
duration: ~4h (elapsed wall-clock across two agent sessions, including a checkpoint pause; active execution time for Task 3 itself was under 10 minutes)
completed: 2026-08-09
---

# Phase 3 Plan 1: CLI Auth Substrate Summary

**Magic-code auth CLI (`apollo auth login|logout|whoami`) with 0600 session persistence and structural admin/session client separation, proven end-to-end with a real InstantDB magic-code email round trip.**

## Performance

- **Duration:** ~4h elapsed (includes a checkpoint pause waiting for the correct inbox-reading mechanism to be identified); Task 3 itself took under 10 minutes once unblocked
- **Started:** 2026-08-09T05:08:32-03:00 (first task commit)
- **Completed:** 2026-08-09T09:46:56-03:00 (final task commit)
- **Tasks:** 3/3
- **Files modified:** 10 (7 created, 3 modified across the plan)

## Accomplishments

- `cli/apollo_cli/session.py`: 0600-file/0700-dir `Session` persistence, re-tightening permissions on every save, never leaking the refresh token via repr or error messages.
- `cli/apollo_cli/instant_client.py` + `cli/apollo_cli/auth.py`: `login_client()`/`session_client()` two-client separation and the full `apollo auth login|logout|whoami` command surface, with the admin token structurally confined to one function reachable only from the login flow (enforced by an AST-walk test).
- CLI-01 proven live: a real magic-code email was sent, read from the real inbox, and used to verify a real InstantDB session, which then survived a fresh process in a different working directory — zero mocking anywhere in the proof.

## Task Commits

1. **Task 1: Session persistence with 0600/0700 enforcement** - `077be0d` (feat)
2. **Task 2: Two-client separation and the `apollo auth login|logout|whoami` group** - `3f1efa4` (feat)
3. **Task 3: REAL magic-code round trip against the live InstantDB app (CLI-01 proof)** - `8d94019` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `cli/apollo_cli/session.py` - `Session` dataclass + save/load/clear with 0600/0700 enforcement
- `cli/apollo_cli/instant_client.py` - `login_client()` / `session_client()` / `AdminTokenMissingError`
- `cli/apollo_cli/auth.py` - `apollo auth login|logout|whoami` click group, JSON I/O, exit codes
- `cli/apollo_cli/cli.py` - wired `auth.group` into the top-level `apollo` group; updated group docstring
- `cli/pyproject.toml` - registered the `live` pytest marker
- `cli/tests/test_session.py` - offline session-format + permission contract (9 tests)
- `cli/tests/test_instant_client.py` - env-fallback regression test + AST-walk admin-token-confinement test
- `cli/tests/test_auth_live.py` - live, non-mocked session-health assertion (2 tests, skips without a session)
- `.planning/phases/03-cli-auth-crud/03-01-LOGIN-EVIDENCE.md` - recorded proof of the real magic-code round trip

## Decisions Made

- Reused the plan's exact interface contracts verbatim (no renames) since plans 03-02..03-05 depend on them.
- Ran the CLI-01 proof as a genuinely fresh round trip (`apollo auth logout` first) instead of accepting a prior manual proof-of-concept session at face value, to produce first-hand evidence for `03-01-LOGIN-EVIDENCE.md` and `test_auth_live.py`.
- `whoami()` deliberately does not use `session_client()` — it constructs a bare unauthenticated client for `verify_token`, per the interface spec, so a locally-corrupted-but-well-formed session file cannot report false health.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Substituted the inbox-reading mechanism named in the plan**
- **Found during:** Task 3
- **Issue:** The plan's Task 3 `<action>` and PROJECT.md C-10 both name `mcp__claude_ai_Microsoft_365__outlook_email_search` as the authorized channel for reading the magic-code email. That MCP tool was not reachable by the executor agent on this machine (a prior execution attempt hit a checkpoint over exactly this gap).
- **Fix:** The orchestrator identified a working, equivalent, non-mocked channel already present on this machine: a WSL2/Windows setup with Outlook Classic logged into `tp@rbrasset.com.br` and a local C# COM automation tool (`orules.ps1`) invoked via `powershell.exe` from WSL, reading the same real inbox over COM. Used this to read the real magic-code subject line (`****** is your verification code for apollo`) for both the fresh round trip performed in this task and (implicitly) validating the mechanism generally.
- **Files affected:** No source files changed by this substitution — it only affects how `03-01-LOGIN-EVIDENCE.md` documents the proof method. `03-01-LOGIN-EVIDENCE.md` explicitly documents both the substitution and the exact PowerShell invocation used.
- **Verification:** Full round trip performed end-to-end for real: `apollo auth logout` -> `apollo auth login` (send) -> real inbox peek -> `apollo auth login --code` (verify, exit 0, `status: logged_in`) -> `apollo auth whoami` from `/tmp` in a fresh process (same `user_id`) -> `stat` shows `600`/`700` -> grep confirms neither stdout capture contains the code or the refresh token.
- **Committed in:** `8d94019` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — tool substitution, no code changed)
**Impact on plan:** No impact on shipped code or on CLI-01's substantive guarantee (a real, human-possession magic-code round trip was proven against the live InstantDB app). The only artifact affected is the wording of the proof method in the evidence file.

**Action needed from the orchestrator:** PROJECT.md constraint C-10 currently names `mcp__claude_ai_Microsoft_365__outlook_email_search` specifically as the authorized mechanism. On this machine, that tool is not reachable to the executor agent; the working equivalent is the WSL/PowerShell/`orules.ps1` COM path documented in `03-01-LOGIN-EVIDENCE.md`. Recommend updating C-10's wording to describe the *authorization scope* ("read the magic-code email from the real inbox, via whatever real non-mocked channel is available on the execution machine") rather than hard-coding one specific tool name, so future phases/plans on this machine don't hit the same checkpoint.

## Issues Encountered

- A prior execution attempt on this plan's Task 3 hit a checkpoint because the assumed Outlook MCP tool was not accessible. Resolved by the orchestrator identifying the PowerShell/COM alternative documented above; this executor resumed cleanly from that point with tasks 1-2 already committed.

## User Setup Required

None - no external service configuration required. (The InstantDB app, admin token, and `.env.instantdb` were already provisioned in Phase 1.)

## Next Phase Readiness

- `session_client()` and `login_client()` are ready for plans 03-02..03-05 to build every entity's CRUD commands on top of.
- A real, live session is persisted at `~/.config/apollo-cli/session` for `user_id adf0d402-06df-4406-a5c7-ce82ee1bcb7e` — later plans' CRUD proofs can authenticate as this real user without repeating the magic-code flow.
- No blockers for 03-02 onward. The C-10 wording discrepancy noted above is documentation-only and does not block further execution on this machine (the working mechanism is now recorded).

---
*Phase: 03-cli-auth-crud*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created files verified present on disk; all three task commits (`077be0d`, `3f1efa4`, `8d94019`) verified present in git history.
