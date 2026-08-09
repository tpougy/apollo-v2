---
phase: 06-end-to-end-verification
plan: 01
subsystem: auth
tags: [instantdb, permissions, magic-code, cross-user-isolation, asvs-v4, pytest]

# Dependency graph
requires:
  - phase: 03-cli-auth-crud
    provides: session.py / instant_client.py (session_client, login_client, Session), test_auth_rejection.py conventions (pytest.mark.live, _permission_denied_type, admin-token confinement gate)
  - phase: 05-idempotent-routine-instance-job
    provides: "zero leftovers" verification convention extended here from domain records to auth users
provides:
  - "Live, write-based proof that shared/instant.perms.ts donoRules deny cross-user create/update/delete between two REAL authenticated InstantDB users"
  - "cli/tests/test_cross_user_isolation.py — pytest.mark.live module with 3 denial tests, 1 positive control, 1 identity guard, 1 offline allowlist-guard test, and a guarded delete_user teardown"
  - "A working, re-bootstrapped second-user session at cli/.auth/second-user-session for plan 06-03's verify-phase-06.sh to consume"
  - "Documented precedent: orchestrator-performed magic-code round trips for MCP-mailbox-gated logins subagents cannot reach"
affects: [06-03-verify-phase-06-script, any future plan needing a second authenticated InstantDB identity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Write-only isolation proofs: never assert authorization via an empty/filtered query result (InstantDB view rules silently filter); always assert pytest.raises(InstantAPIError) with body[\"type\"] == \"permission-denied\" on create/update/delete"
    - "Four ordered guards (allowlist, identity, id=-selector, before/after inventory) before any destructive admin-token action (delete_user)"
    - "second_session fixture fails loudly via pytest.fail with the bootstrap command, never pytest.skip, when a required live credential is missing"

key-files:
  created:
    - cli/tests/test_cross_user_isolation.py
    - cli/.auth/second-user-session (gitignored, not committed)
  modified:
    - .gitignore
    - .planning/phases/06-end-to-end-verification/06-01-SECOND-USER-EVIDENCE.md

key-decisions:
  - "Magic-code round trips (both the initial Task 1 login and the post-teardown Task 3 re-bootstrap) were performed by the orchestrator, not the executor subagent, because subagents do not inherit the orchestrator's Microsoft 365 MCP tool access (mcp__claude_ai_Microsoft_365__outlook_email_search) needed to read the admin@/rm@rbrasset.com.br mailbox"
  - "delete_user fully removes the $users record rather than deactivating it — the post-teardown re-bootstrap therefore produced a brand-new user_id (a18628c8-5d25-4dd7-9ae5-389eb4ca273b) rather than resuming the deleted account (b5e0b47d-3891-4ef9-9a5a-c9e82c244d8c)"
  - "Second-user deletion is opt-in per pytest run via APOLLO_VERIFY05_DELETE_SECOND_USER=1, not an unconditional teardown, so the VERIFY-05 gate remains re-runnable without burning a fresh magic code every time"

patterns-established:
  - "Orchestrator-mediated auth gate: when a plan's auth step requires an MCP tool only the orchestrator holds, the executor documents the gap in the evidence file, hands off, and later confirms the resulting session from within its own process — never fabricating or mocking the credential"

requirements-completed: [VERIFY-05]

# Metrics
duration: 3 sessions (spanning re-bootstrap handoffs)
completed: 2026-08-09
---

# Phase 6 Plan 1: Cross-User Isolation Proof Summary

**Live write-based proof that InstantDB `donoRules` reject create/update/delete from a second real authenticated user against tp@'s records, with a guarded `delete_user` teardown and re-bootstrap, both magic-code round trips performed by the orchestrator due to subagent MCP-tool scoping.**

## Performance

- **Tasks:** 3/3 completed
- **Files modified:** 3 (`.gitignore`, `cli/tests/test_cross_user_isolation.py`, `06-01-SECOND-USER-EVIDENCE.md`)

## Accomplishments

- Authenticated a second, genuinely distinct InstantDB user (`admin@rbrasset.com.br`) into an isolated, gitignored session file (`cli/.auth/second-user-session`, mode 600) without ever touching tp@'s primary session
- Wrote `cli/tests/test_cross_user_isolation.py`: proves via real `InstantAPIError`/`permission-denied` responses that the second user cannot create a record carrying tp@'s `donoId`, cannot update tp@'s existing `fundos` record, and cannot delete it — each denial re-verified by re-reading the record through tp@'s own session
- Included a positive control (the second user creating a record with its own `donoId` succeeds) proving the denials above are authorization failures, not authentication failures
- Executed a real, guarded `delete_user` teardown with four ordered guards (email allowlist, identity check, `id=`-selector, before/after `fundos` inventory + `whoami` check on tp@'s account) — the second user's `$users` record was genuinely deleted and confirmed dead via a post-deletion probe
- Re-bootstrapped a fresh second-user session (new `user_id` `a18628c8-5d25-4dd7-9ae5-389eb4ca273b`, since `delete_user` fully removes rather than deactivates the account) so plan 06-03's `verify-phase-06.sh` remains runnable

## Task Commits

Each task was committed atomically:

1. **Task 1: Authenticate a SECOND real user into an isolated session file** - `93be70c` (feat)
2. **Task 2: Live write-denial proof (TDD)** - `545c3f7` (test)
3. **Task 3: Guarded second-user teardown** - `3764d95` (feat)

**Evidence follow-up (this session):** `25b0034` (docs — post-teardown re-bootstrap status recorded)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `cli/tests/test_cross_user_isolation.py` - VERIFY-05 / ASVS V4 live pytest module: 3 denial tests, 1 positive control, 1 identity guard, 1 offline allowlist-guard test, 1 guarded teardown test
- `.gitignore` - added `cli/.auth/` before any second-user login occurred
- `.planning/phases/06-end-to-end-verification/06-01-SECOND-USER-EVIDENCE.md` - full audit trail: initial login mechanism, verification output, teardown guard results, and post-teardown re-bootstrap status — no secrets

## Decisions Made

- **Orchestrator-performed magic-code logins:** Both the initial Task 1 login and the Task 3 post-teardown re-bootstrap required reading a one-time code from `admin@rbrasset.com.br`'s inbox via the `mcp__claude_ai_Microsoft_365__outlook_email_search` MCP tool. This tool is available to the orchestrator but **not inherited by executor subagents** in this environment. Per PROJECT.md C-10's spirit (an operator-possessed inbox-reading channel is authorized; the exact mechanism is environment-specific) and the plan's explicit allowance for this handoff, the orchestrator performed both round trips out-of-band and handed the resulting session back to the executor for verification. **This is flagged as a precedent:** any future plan requiring a real magic-code login for an account whose mailbox is only reachable via an orchestrator-scoped MCP tool should expect the same handoff pattern — the executor cannot self-serve this step.
- **Full account deletion, not deactivation:** `delete_user` removes the `$users` row entirely rather than suspending it, so the re-bootstrap after teardown necessarily produced a new `user_id` rather than reviving the old one. This is expected InstantDB admin-API behavior, not a bug.
- **Opt-in teardown:** Deletion gated behind `APOLLO_VERIFY05_DELETE_SECOND_USER=1` so the live pytest suite remains re-runnable without needing a fresh magic code on every CI/verification pass.

## Deviations from Plan

None - plan executed as written. The orchestrator-mediated login/re-bootstrap was explicitly anticipated by the plan's Task 1 action text ("If NEITHER MCP mailbox is reachable... STOP and report a blocker") and RESEARCH.md's Pitfall 3 / Assumption A2 flagged this exact mailbox-reachability risk in advance; routing the actual mailbox read to the orchestrator (which does hold the needed MCP tool) rather than fabricating a login is the documented, non-mocked-auth-compliant resolution, not a deviation from plan intent.

## Issues Encountered

- **Subagent MCP tool scoping gap:** Discovered during Task 1 (and recurred identically during Task 3's re-bootstrap) that executor subagents do not inherit the orchestrator's Microsoft 365 MCP tools. Resolved both times by having the orchestrator perform the magic-code send/read/verify steps directly and hand off the resulting session file for the executor to confirm. No workaround was needed inside the executor's own process beyond verification (`apollo auth whoami`).

## User Setup Required

None - no external service configuration required beyond the orchestrator-performed magic-code round trips documented above.

## Next Phase Readiness

- VERIFY-05 / ROADMAP SC-5 is proven: live, write-based, re-runnable cross-user isolation evidence exists with no query-based (silently-filtered) assertions.
- `cli/.auth/second-user-session` holds a live, working session (`user_id` `a18628c8-5d25-4dd7-9ae5-389eb4ca273b`) ready for plan 06-03's `verify-phase-06.sh` to consume.
- tp@'s primary session, account, and `fundos` inventory are demonstrably untouched throughout both the isolation proof and the second-user deletion/re-bootstrap cycle.
- **Precedent for future plans:** any plan requiring a live magic-code login against a mailbox only reachable via an orchestrator-scoped MCP tool (not a subagent-inherited one) should plan for this same orchestrator-handoff step up front, rather than discovering the gap mid-execution.

## Self-Check: PASSED

- FOUND: `.planning/phases/06-end-to-end-verification/06-01-SECOND-USER-EVIDENCE.md`
- FOUND: `cli/tests/test_cross_user_isolation.py`
- FOUND commit `93be70c`, `545c3f7`, `3764d95`, `25b0034` in `git log --oneline --all`

---
*Phase: 06-end-to-end-verification*
*Completed: 2026-08-09*
