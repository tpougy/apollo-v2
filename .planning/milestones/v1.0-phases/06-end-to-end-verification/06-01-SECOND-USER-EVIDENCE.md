# 06-01 Second-User Evidence — VERIFY-05 real magic-code round trip

## Mechanism used, and why the orchestrator (not this executor) performed the login

A prior executor attempt at this plan correctly stopped at Task 1: subagents
spawned under this environment do not inherit the orchestrator's MCP tool
set, and the orchestrator's Microsoft 365 MCP tool
(`mcp__claude_ai_Microsoft_365__outlook_email_search`) — the channel
06-CONTEXT.md/06-RESEARCH.md identify as reachable for `admin@rbrasset.com.br`
/ `rm@rbrasset.com.br` (the OPPOSITE channel from tp@'s Outlook-Classic/WSL
bridge documented in PROJECT.md C-10) — was not available to that subagent.

Per PROJECT.md C-10's spirit (a human/orchestrator-possessed inbox-reading
channel is authorized; the exact mechanism is environment-specific) and this
plan's explicit instruction that the higher-level orchestrator performs the
email-read step when a subagent cannot, the orchestrator itself completed the
real two-step magic-code round trip for the second user:

- Chosen second address: `admin@rbrasset.com.br` (first of the two allowlisted
  addresses from 06-CONTEXT.md/RESEARCH; `rm@rbrasset.com.br` was not needed).
- Channel confirmed reachable: the orchestrator's own
  `mcp__claude_ai_Microsoft_365__outlook_email_search` MCP tool access,
  exactly as predicted by 06-RESEARCH.md Pitfall 3 / Assumption A2.
- Magic code: a genuine one-time code read from the real inbox via that MCP
  tool. The code has already been consumed and expired by the time this
  document is written. Per this plan's explicit prohibition (T-06-03), the
  code's digits are NOT recorded here or anywhere else in this repository —
  only its use and expiry are noted.
- The round trip used `APOLLO_SESSION_FILE=/home/thomaz/pessoal/apollo-v2/cli/.auth/second-user-session`
  on both the `--email`-only (send) and `--email --code` (verify) invocations,
  so tp@'s `~/.config/apollo-cli/session` was never opened for writing during
  this process.

This is a genuine, non-mocked second InstantDB user, consistent with this
project's "no mocked auth" discipline (Phases 3-4, 06-CONTEXT.md).

## Result of the round trip

- **Second user email:** `admin@rbrasset.com.br`
- **Second user `user_id`:** `b5e0b47d-3891-4ef9-9a5a-c9e82c244d8c`
- **tp@'s `user_id` (unchanged, for comparison):** `adf0d402-06df-4406-a5c7-ce82ee1bcb7e`
- **Session file:** `cli/.auth/second-user-session`, mode `600`, parent
  directory `cli/.auth/` mode `700` (confirmed via `stat`).
- **`.gitignore`:** `cli/.auth/` added immediately after the existing
  `web/e2e/.auth/` line, BEFORE any login occurred, with a comment noting it
  holds the second verification user's InstantDB refresh token. Confirmed
  `git status --porcelain cli/.auth` produces no output (directory fully
  ignored).

## tp@'s primary session — untouched

Because the login happened out-of-band (performed by the orchestrator, not
this executor subagent), this executor cannot itself attest to a
byte-identical SHA-256 spanning the exact moment of that external login
event. What this executor DID verify directly, from within its own process,
after resuming the plan:

```
$ sha256sum ~/.config/apollo-cli/session
edabe3bdd327f3aae5818a2bad96590d46657e478814b7651c3f4b00d4b34438  /home/thomaz/.config/apollo-cli/session
```

This hash was re-checked identical after every subsequent second-user
operation performed in this executor's own process (Task 1 verification,
Task 2's live pytest run, Task 3's teardown + re-bootstrap), proving that
none of this executor's own second-user commands — all of which set
`APOLLO_SESSION_FILE` per-process, never `export`ed — ever touched tp@'s
primary session file. Combined with the mechanism note above (both of the
orchestrator's login invocations also used `APOLLO_SESSION_FILE` pointed at
`cli/.auth/second-user-session`, per this plan's Task 1 instructions and the
session-establishment message that handed off this session), this
constitutes the T-06-05 mitigation.

## Verification performed by this executor

```
$ APOLLO_SESSION_FILE="$PWD/cli/.auth/second-user-session" uv run --project cli apollo auth whoami
{"user_id": "b5e0b47d-3891-4ef9-9a5a-c9e82c244d8c", "email": "admin@rbrasset.com.br", "session_file": ".../cli/.auth/second-user-session"}

$ uv run --project cli apollo auth whoami
{"user_id": "adf0d402-06df-4406-a5c7-ce82ee1bcb7e", "email": "tp@rbrasset.com.br", "session_file": "/home/thomaz/.config/apollo-cli/session"}
```

Both exit 0. The two `user_id` values are different, and the second matches
tp@'s known, previously-recorded `user_id` from `03-01-LOGIN-EVIDENCE.md`.

No refresh token or magic code appears anywhere else in this repository.

## Second-user teardown

Executed for real via `cli/tests/test_cross_user_isolation.py::test_06_zz_guarded_second_user_teardown`,
opted in with `APOLLO_VERIFY05_DELETE_SECOND_USER=1`:

```
$ APOLLO_VERIFY05_DELETE_SECOND_USER=1 uv run --project cli pytest \
    cli/tests/test_cross_user_isolation.py -m live -k zz -v
tests/test_cross_user_isolation.py::test_06_zz_guarded_second_user_teardown PASSED
```

All four ordered guards passed before the delete call executed:

1. **Allowlist guard:** `admin@rbrasset.com.br` is in `{admin@rbrasset.com.br, rm@rbrasset.com.br}` — the offline unit test `test_05_teardown_allowlist_guard_rejects_tp_offline` independently proves this same guard function rejects `tp@rbrasset.com.br`.
2. **Identity guard:** `second_session.user_id` (`b5e0b47d-3891-4ef9-9a5a-c9e82c244d8c`) `!=` `live_session.user_id` (`adf0d402-06df-4406-a5c7-ce82ee1bcb7e`), and the emails differ.
3. **Selector guard:** `login_client().auth.delete_user(id="b5e0b47d-3891-4ef9-9a5a-c9e82c244d8c")` — `id=`, never `email=`. The returned `deleted` payload's `id` was asserted equal to the requested id.
4. **Inventory guard:** tp@'s `fundos` row count (scoped to `donoId == live_session.user_id`) was `0` both immediately before and immediately after the delete call. `apollo auth whoami` (primary session, no env override) still returned `user_id = adf0d402-06df-4406-a5c7-ce82ee1bcb7e` after the delete.

- **Deletion UTC timestamp:** `2026-08-09T19:03:17Z` (captured immediately after the passing test run above).
- **Deleted user id:** `b5e0b47d-3891-4ef9-9a5a-c9e82c244d8c` (`admin@rbrasset.com.br`).
- **tp@'s `fundos` count before/after:** `0` / `0` (identical).
- **tp@'s post-deletion `whoami`:** `{"user_id": "adf0d402-06df-4406-a5c7-ce82ee1bcb7e", "email": "tp@rbrasset.com.br", "session_file": "/home/thomaz/.config/apollo-cli/session"}` — exit 0, same `user_id` as before.
- **Post-deletion dead-session probe:** the test itself, and a manual follow-up `apollo auth whoami` invocation with `APOLLO_SESSION_FILE` pointed at the now-invalidated `cli/.auth/second-user-session`, both confirm the second user is genuinely gone (`{"error": "invalid_session", "status": 400, "type": "record-not-found", "message": "Record not found: app-user", ...}`, exit 3) — `delete_user` did not silently no-op.

### Re-bootstrap status

`delete_user` invalidates the second user's refresh token, so `cli/.auth/second-user-session` held a dead credential immediately after the teardown above. Per this task's requirement, a fresh second-user session needed to be re-bootstrapped so `verify-phase-06.sh` (plan 06-03) remains runnable. As predicted in the note this section previously carried, re-bootstrapping required a new real magic-code round trip via the same orchestrator-level mailbox-reading MCP tool access used in the original Task 1 login (this executor subagent does not inherit that tool set).

The orchestrator performed this second, post-teardown magic-code round trip using the same mechanism as the original Task 1 login (mailbox `admin@rbrasset.com.br`, `mcp__claude_ai_Microsoft_365__outlook_email_search`), producing a brand-new InstantDB user:

- **New second-user email:** `admin@rbrasset.com.br` (re-registered — `delete_user` removed the prior `$users` row entirely, so this magic-code login created a fresh account rather than resuming the deleted one).
- **New second-user `user_id`:** `a18628c8-5d25-4dd7-9ae5-389eb4ca273b` (different from the deleted `b5e0b47d-3891-4ef9-9a5a-c9e82c244d8c`, as expected for a freshly created `$users` record).
- **Session file:** `cli/.auth/second-user-session` (same path, contents replaced).
- **Verification performed by this executor after the hand-off:**

```
$ APOLLO_SESSION_FILE=/home/thomaz/pessoal/apollo-v2/cli/.auth/second-user-session uv run --project cli apollo auth whoami
{"user_id": "a18628c8-5d25-4dd7-9ae5-389eb4ca273b", "email": "admin@rbrasset.com.br", "session_file": ".../cli/.auth/second-user-session"}
```

Exit 0, `.user_id` matches the value handed off, `.email` matches the allowlisted address. Re-bootstrap confirmed successful; `verify-phase-06.sh` (plan 06-03) has a working second-user session to consume again. As with the original login, no magic code or refresh token is recorded in this file or anywhere else in this repository.
