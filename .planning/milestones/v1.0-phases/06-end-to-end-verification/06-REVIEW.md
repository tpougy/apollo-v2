---
status: clean
phase: 06-end-to-end-verification
reviewed: 2026-08-09
depth: standard
---

# Phase 06 Code Review — End-to-End Verification

Scope: `.gitignore`, `README.md`, `cli/apollo_cli/routine_job.py` (sentinel hook),
`cli/tests/test_cross_user_isolation.py`, `cli/tests/test_interrupted_job.py`,
`cli/tests/test_routine_job_parity.py`, `web/e2e/entities-rotina-log.spec.ts`,
`.planning/PROJECT.md`.

## Focus 1 — Sentinel hook is a genuine no-op when unset

`_signal_test_sentinel` (`cli/apollo_cli/routine_job.py:441-468`) reads
`APOLLO_TEST_TRANSACT_SENTINEL` via `os.environ.get(...)` at call time (not import
time) and returns immediately (`if not path: return`) for both the unset and
blank-string cases. In the real job path (`run_routine_instance_job`) it is called
exactly twice, immediately before and after the single `client.transact(chunks)`
call (lines 666, 668) — both calls are cheap (env lookup + falsy check), no
filesystem access occurs when the var is unset, and no other behavior/branching in
`run_routine_instance_job` is gated on this env var. Confirmed further by the
dedicated offline tests in `test_interrupted_job.py`
(`test_sentinel_noop_when_env_var_unset`, `test_sentinel_noop_when_env_var_blank`),
which assert zero filesystem side effects, and
`test_sentinel_env_var_not_in_help_output`, which proves the var never leaks into
`--help` text. No performance or behavioral change to the production job path when
the var is unset. Clean.

## Focus 2 — `delete_user` teardown guard completeness

`test_06_zz_guarded_second_user_teardown` in `test_cross_user_isolation.py`
(lines 328-398) implements exactly the four guards described:

1. **Email allowlist** (`_assert_allowlisted`, lines 300-312): raises unless
   `second_session.email` is one of `{admin@rbrasset.com.br, rm@rbrasset.com.br}`
   — `tp@rbrasset.com.br` is categorically excluded. This guard is independently
   unit-tested offline in `test_05_teardown_allowlist_guard_rejects_tp_offline`,
   which proves it rejects `tp@rbrasset.com.br` and accepts both allowlisted
   addresses, without live network access.
2. **Identity check** (lines 357-359): explicit `assert second_session.user_id !=
   live_session.user_id` and `assert second_session.email != live_session.email`
   immediately before the delete call.
3. **`id=` selector, never `email=`** (line 371): `admin.auth.delete_user(id=
   second_session.user_id)` — the returned id is asserted to match
   (`deleted_id == second_session.user_id`), so a mailbox alias or an unexpected
   email-based resolution cannot substitute a different account.
4. **Before/after inventory check** (lines 361-365, 375-381): tp@'s `fundos`
   count under `donoId == live_session.user_id` is captured before the delete and
   re-asserted equal after, and `load_session()` is re-verified to still resolve
   to tp@'s `user_id`.

Defense in depth: guards 1 and 2 are independent and overlapping — even if the
second-user session file were ever misconfigured to hold tp@'s own credentials,
guard 1 (which checks only `second_session.email`, not a comparison to
`live_session`) would still refuse the delete on its own, since
`tp@rbrasset.com.br` is never in the allowlist regardless of what
`live_session.email` happens to be. Guard 2 independently catches the same
failure mode via direct user_id/email comparison. There is no code path in this
test by which `tp@`'s `$users` record could be targeted: the `id=` argument is
sourced exclusively from `second_session.user_id`, which is loaded from an
isolated file path (`cli/.auth/second-user-session` or
`APOLLO_SECOND_SESSION_FILE`) that `_load_second_session` never conflates with
the primary `~/.config/apollo-cli/session`. The gate is also opt-in
(`APOLLO_VERIFY05_DELETE_SECOND_USER=1`, default `pytest.xfail`), so it cannot
fire accidentally in a normal test run. Post-delete, the test also verifies the
second user's refresh token is genuinely invalidated (a further write raises
`InstantAPIError`), closing the loop on "silent no-op reads as success." Clean.

## Focus 3 — Second-user session file / credential gitignore coverage

`.gitignore:21` declares `cli/.auth/` (with an explanatory comment on lines
19-20 that it holds the VERIFY-05 second user's InstantDB refresh token and must
never be committed). Verified directly:

- `git check-ignore -v cli/.auth/second-user-session` confirms the file is
  matched by `.gitignore:21`.
- `git ls-files | grep -i "cli/.auth\|second-user-session"` returns nothing —
  no such file is currently tracked.
- `git log --all --full-history -- cli/.auth` returns nothing — no such path
  was ever committed in this repo's history.

Clean.

## Focus 4 — Suppression comments

Grepped all seven reviewed files for `noqa`, `type: ignore`, and
`biome-ignore`: zero matches. No suppression comments were introduced. Clean.

## Other observations (non-blocking)

- `routine_job.py`'s docstring for `run_routine_instance_job` and the module
  header are thorough and cross-reference the exact invariants (D-05-B through
  D-05-F, C-09) each branch encodes — this held up under a close read of the
  `encadeado` topological sweep and the concurrency-tolerant catch/re-query
  around `client.transact`.
- `test_interrupted_job.py`'s atomicity reasoning (single POST to
  `/admin/transact`, all-or-nothing) is documented and the assertion rule
  (`post_kill_count in (0, len(expected_new))`) is enforced correctly at lines
  306-313, including the guard against `0 < count < expected` masquerading as
  success.
- `test_routine_job_parity.py`'s concurrency test correctly treats the
  `created`/`existing` report-shape split as non-load-bearing and pins the real
  guarantee (`dedupeKey.unique()` on the live schema) via
  `_assert_live_schema_still_declares_dedupe_key_unique`, which re-pulls the
  live schema rather than trusting the local file.
- `entities-rotina-log.spec.ts` correctly scopes destructive test-only admin
  fixture access (`deleteAdminRecord`) to a file under `web/e2e/`, documented as
  never bundled into the shipped app.

No issues found across all four focus areas or in the surrounding code. Status: **clean**.
