phase: 06-end-to-end-verification
plan: 03

## The v1 done gate: recorded green run

`bash .planning/phases/06-end-to-end-verification/verify-phase-06.sh` (Run A, no flags) and
`bash .../verify-phase-06.sh --final` (Run B) were both executed for real against the live
InstantDB app, from a clean `main` checkout, with no gate weakened, narrowed, or commented out
to force a pass. Every failure hit along the way was root-caused and fixed in its own commit
(see "Genuine defects found and fixed" below) before the recorded green runs below.

## ROADMAP Phase 6 success criteria -> gate mapping

| # | ROADMAP Phase 6 success criterion | Proving gate(s) | Observed result |
|---|---|---|---|
| 1 | A record created/edited/deleted via CLI is visible/reflected in the SPA and vice versa, for at least one entity per Phase 3 category | Gate 6 (VERIFY-01): re-runs `entities-fundos.spec.ts` (full-CRUD, CLI->SPA), `entities-ticket-subtarefa.spec.ts` (full-CRUD, SPA->CLI), `entities-rotina-log.spec.ts`'s WEB-09 test (log-only, CLI->SPA), `routine-job-cross-channel.spec.ts` (instanciasRotina, both directions) | 12/12 tests passed (Run A); spec->category mapping echoed in the transcript |
| 2 | `ruff` and `ty` run clean across every `.py` file in `cli/` and `shared/scripts/` | Gate 7 (VERIFY-02) | `ruff check`, `ruff format --check`, `ty check` all "All checks passed!" / "already formatted"; 41 `.py` files counted (anti-vacuity threshold: >15); zero suppression markers |
| 3 | The `web/` formatter, linter, and `svelte-check` run clean across every file in `web/` | Gate 8 (VERIFY-03) | `bun run check` (svelte-check + tsc): 298 files, 0 errors; `bun run lint`/`format:check`: no fixes needed; `bun run build`: succeeded; `bun run test`: 132/132 passed; 34 `.ts`/`.svelte` files counted (anti-vacuity threshold: >15) |
| 4 | Simulating an interrupted job run leaves no duplicate/missing `instanciasRotina` records | Gate 9 (VERIFY-04): `cli/tests/test_interrupted_job.py -m live` | 3 passed, 0 skipped; both `about-to-transact` and `transact-returned` kill-point parametrizations present in the transcript; `phase06-verify04-` leftover sweep: 0 |
| 5 | InstantDB perms correctly deny cross-user access | Gate 10 (VERIFY-05): `cli/tests/test_cross_user_isolation.py -m live` | 5 passed, 0 skipped, 1 xfailed (the opt-in teardown test, expected on a non-`--final` run); `permission-denied` confirmed both in the module's own assertions and via the three denial tests' pass status; `phase06-verify05-` leftover sweep: 0 |

## Run A (normal, no flags)

- **Started (UTC)**: 2026-08-09T19:42:47Z
- **Completed (UTC)**: 2026-08-09T19:49:05Z
- **Wall-clock duration**: 361s (~6m01s)
- **Exit code**: 0
- **Final transcript lines**:
  ```
  Gate 10: PASS
  Gate 11: SKIPPED (pass --final to also delete the second verification user)
  PHASE 06 VERIFIED
  ```
- **Gate summary**: Gates 0-10 all PASS (Gates 1-5 confirmed via each prior script's own `PHASE 0N VERIFIED` transcript marker, not exit status alone); Gate 11 SKIPPED as expected (no `--final`).

## Run B (`--final`)

- **Started (UTC)**: 2026-08-09T19:49:17Z
- **Completed (UTC)**: 2026-08-09T19:55:26Z (369s wall clock)
- **Exit code**: 0
- **Final transcript lines**:
  ```
  Gate 11: PASS (tp@ survived: same user_id, same fundos count)
  NOTE: the second-user session at cli/.auth/second-user-session is now INVALID --
    re-bootstrap it (see 06-01-SECOND-USER-EVIDENCE.md) before the next VERIFY-05 run.
  PHASE 06 VERIFIED
  APOLLO V2 v1 MILESTONE GATE: GREEN
  ```
- **Gate 11 tp@-survival figures**:

  | | pre-teardown | post-teardown |
  |---|---|---|
  | `user_id` | `adf0d402-06df-4406-a5c7-ce82ee1bcb7e` | `adf0d402-06df-4406-a5c7-ce82ee1bcb7e` (unchanged) |
  | `fundos` count | 0 | 0 (unchanged) |

  The guarded `test_06_zz_guarded_second_user_teardown` test ran for real
  (`APOLLO_VERIFY05_DELETE_SECOND_USER=1`, 1 passed, 0 skipped) and deleted the second user's
  `$users` record via the four-guard path established in plan 06-01.

## Second-user session re-bootstrap

`--final` invalidates `cli/.auth/second-user-session` by design (the underlying `$users` record
is deleted). Per the precedent recorded in `06-01-SECOND-USER-EVIDENCE.md` and
`06-01-SUMMARY.md`, the magic-code round trip needed to re-bootstrap it requires reading a
one-time code from the `admin@rbrasset.com.br` / `rm@rbrasset.com.br` inbox via an MCP tool
(`mcp__claude_ai_Microsoft_365__outlook_email_search`) that is available to the orchestrator but
**not inherited by executor subagents** in this environment. This plan's executor therefore
cannot self-serve this one step and hands it off, exactly as 06-01 did for its own Task 1 and
Task 3 re-bootstraps.

**Bootstrap command** (to be run by whichever process holds the mailbox-reading MCP tool):

```bash
APOLLO_SESSION_FILE="$PWD/cli/.auth/second-user-session" \
  uv run --project cli apollo auth login --email <admin@rbrasset.com.br|rm@rbrasset.com.br>
# read the magic code from the mailbox, then:
APOLLO_SESSION_FILE="$PWD/cli/.auth/second-user-session" \
  uv run --project cli apollo auth login --email <same-email> --code <codigo-do-email>
```

**Verification once bootstrapped**:

```bash
APOLLO_SESSION_FILE="$PWD/cli/.auth/second-user-session" uv run --project cli apollo auth whoami
```

**Status at the time this evidence file was written**: NOT YET re-bootstrapped (Run B just
invalidated it as its final, expected side effect). This is the one remaining action item
handed to the orchestrator before the next VERIFY-05 run needs a working second-user session
again -- it does not affect the fact that both Run A and Run B above completed green.

## Genuine defects found and fixed while building this gate

None of these were caused by this plan's own new code; all were pre-existing gaps or scope
drift in Phases 2-5's verification scripts/tests, exposed only once Phase 6 actually composed
and ran them together end to end -- exactly the signal this phase exists to produce. Each was
root-caused and fixed in its own commit rather than worked around:

1. `verify-phase-04.sh`'s T-04-03 `donoId` confinement gate only allowlisted
   `EntityScreen.svelte`, permanently failing once Phase 5 legitimately added `donoId` usage to
   `routineJob.ts`/`Shell.svelte`. Widened the allowlist.
2. `web/e2e/entities-rotina-log.spec.ts`'s WEB-06 test asserted against a stale 5-column
   `templatesRotina` row layout; the later addition of the `offsetDias` column shifted every
   column index after `tipoGeracao` by one. Fixed the indices.
3. Same file's WEB-07 test read `hasRows` synchronously right after a nav click, before the
   InstantDB subscription's first `isLoading` cycle resolved, always reading a stale `false` --
   masked in earlier phases by the live app having zero real rows, now surfaced because
   Phase 5's job has generated real, correctly-never-deleted rows. Added the existing
   `waitForSettle()` helper before the count check.
4. Pre-existing `ruff format` drift in `cli/apollo_cli/routine_job.py` and
   `cli/tests/test_routine_job_parity.py`, already flagged as out-of-scope-but-unfixed in
   `06-02-SUMMARY.md`. Reformatted (whitespace only).
5. `verify-phase-02.sh`'s CAL-04 ran unscoped `bun test` (now erroring on Phase 4's
   `web/e2e/*.spec.ts` Playwright specs) and unscoped `uv run pytest -q` (now re-running the
   entire later-added live suite on every offline-parity check). Scoped to `bun test src` and
   `pytest -m "not live"`, matching the convention verify-phase-04.sh/05.sh already established.
6. `verify-phase-03.sh`'s CLI-07 asserted `apollo rotina --help` never mentions
   `gerar-instancias`, true only "before Phase 5 exists". Phase 5 legitimately shipped that
   command for real. Removed the now-permanently-false assertion.
7. `verify-phase-03.sh`'s cleanup trap always exited 1 on success: `${TMP_FILES[@]:-}` on an
   empty array still yields one empty word, so the loop's last command was always `[ -n "" ]`
   (exit 1), and bash's EXIT trap adopts a non-`exit`-calling trap function's own last exit
   status. This script has printed "PHASE 03 VERIFIED" while exiting 1 since it was written --
   invisible until `verify-phase-06.sh` started checking exit status rather than eyeballing the
   transcript. Captured and restored the real `$?` inside the trap.
8. `verify-phase-06.sh` itself (this plan's own new script) had two bugs caught only by actually
   running it: Gate 10's `permission-denied` transcript check could never pass on a green pytest
   run (pytest doesn't echo passing assertions' values), and the final `PHASE 06 VERIFIED` line
   was unconditional, printing even under `--skip-composed` in violation of the plan's own
   anti-false-certification requirement. Both fixed (see this plan's commit history).

## Known scoping decisions

- **VERIFY-04 is CLI-only** (RESEARCH Open Question 2): the interrupted-job SIGKILL harness
  spawns and kills a real `apollo rotina gerar-instancias` OS process; there is no equivalent
  SPA-side process to SIGKILL (a browser tab close/crash is a different failure mode, out of
  this plan's scope), so VERIFY-04's atomicity proof is intentionally CLI-only.
- **VERIFY-01 is proven by re-executing four pre-existing specs, not new ones** (RESEARCH
  Pitfall 1): `entities-fundos.spec.ts`, `entities-ticket-subtarefa.spec.ts`,
  `entities-rotina-log.spec.ts` (WEB-09 only), and `routine-job-cross-channel.spec.ts` already
  existed from Phases 4/5; this plan's only addition is re-running them explicitly and asserting
  their filenames appear in the transcript, not writing new coverage.
- **A post-kill partial-write state is structurally unreachable** (RESEARCH Pitfall 2): the SDK
  issues one atomic POST per `client.transact(chunks)` call; InstantDB either commits the whole
  transaction or none of it, so the only two reachable post-`SIGKILL` states are "0 new records"
  (killed before the POST) or "all new records for that chunk" (killed after) -- never a partial
  count within a chunk. This is proven, not merely asserted, by `test_interrupted_job.py`'s
  strict `count in (0, len(expected))` assertion.

No refresh token, magic code, or admin token appears anywhere in this file.
