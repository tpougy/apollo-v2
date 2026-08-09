# Phase 6: End-to-End Verification - Research

**Researched:** 2026-08-09
**Domain:** Cross-cutting verification composition (CLI↔SPA parity, quality gates, InstantDB transact atomicity, InstantDB admin user management)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Second real test user for SC-5 (cross-user permission isolation)
The primary account for all prior testing is `tp@rbrasset.com.br`. SC-5 requires a SECOND real, distinct InstantDB user to prove `donoId` isolation is enforced by the server (not just by client-side UI hiding). Two real, distinct mailboxes exist that are reachable by tools available in this environment:
- `admin@rbrasset.com.br` and/or `rm@rbrasset.com.br` — reachable via the `mcp__claude_ai_Microsoft_365__outlook_email_search` MCP tool (confirmed working in earlier phases' troubleshooting — this tool DOES have access to these mailboxes, unlike `tp@rbrasset.com.br`).
Use one of these as the second real InstantDB user's email for the SC-5 magic-code login + cross-user isolation proof. This is a genuine second real user account on the live app, not a mock — consistent with this project's "no mocked auth" discipline established in Phases 3-4.

### Claude's Discretion
All implementation choices at Claude's discretion — discuss was skipped. This phase should primarily COMPOSE existing per-phase verify scripts (`verify-phase-01.sh` through `verify-phase-05.sh`, all already proven working) rather than reinvent checks, adding only what's genuinely new: cross-channel parity across the full entity set (SC-1), an interrupted-job simulation (SC-4), and a real second-user permission-isolation test (SC-5).

### Deferred Ideas (OUT OF SCOPE)
None — this is the final phase of the milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| VERIFY-01 | A record created/edited/deleted via CLI is visible/reflected in the SPA without manual intervention, and vice versa, for at least one entity per CLI category | Pitfall 1 + Architecture Diagram: already fully proven by `entities-fundos.spec.ts` (CLI→SPA, full-CRUD), `entities-ticket-subtarefa.spec.ts` (SPA→CLI, full-CRUD), `entities-rotina-log.spec.ts` WEB-09 (CLI→SPA, log-only), `routine-job-cross-channel.spec.ts` (both directions, instanciasRotina). Composition only — re-run via `verify-phase-04.sh`/`verify-phase-05.sh`. |
| VERIFY-02 | ruff and ty run clean across every .py file in cli/ and shared/scripts/ | Already asserted repo-wide by `verify-phase-03.sh`'s Quality gates section — re-run, no new config |
| VERIFY-03 | web/ formatter, linter, and svelte-check run clean across every file in web/ | Already asserted repo-wide by `verify-phase-04.sh`'s C-08 gates — re-run, no new config |
| VERIFY-04 | Simulating an interrupted job run leaves no duplicate and no missing instanciasRotina records | Standard Stack, Pattern 1, Pitfall 2, Validation Architecture — new sentinel-hook + pytest module required; InstantDB `transact()` atomicity verified via SDK source |
| VERIFY-05 | InstantDB perms correctly deny cross-user access for a second test user | Pattern 2, Pattern 3, Pitfall 4/5, Validation Architecture — new pytest module using existing `APOLLO_SESSION_FILE` override; admin `delete_user` for cleanup |
</phase_requirements>

## Summary

Phase 6 is a composition phase, not a feature phase. Reading `verify-phase-01.sh` through `verify-phase-05.sh` in full, plus the actual Playwright specs they invoke, shows that **VERIFY-01 (CLI↔SPA parity) already has complete, automated, bidirectional evidence in the repository** — it does not need a single new test written, only re-execution. VERIFY-02 and VERIFY-03 (quality gates) are already scoped repo-wide by Phase 3's and Phase 4's scripts respectively, so they too are a matter of re-running, not writing new lint config. The two requirements that need genuinely new engineering are **VERIFY-04** (interrupted-job simulation) and **VERIFY-05** (second real user isolation).

For VERIFY-04, the critical fact this research uncovered by reading the InstantDB Python SDK source (`cli/.venv/lib/python3.12/site-packages/instantdb/_sync/client.py`) is that `client.transact(chunks)` issues **exactly one HTTP POST to `/admin/transact`** carrying every step, and InstantDB's transact API is documented as atomic (all steps commit or none do). There is no SDK-side chunking into multiple network calls. This means a "torn write" (some but not all of a batch's `instanciasRotina` persisted) cannot happen from a single `apollo rotina gerar-instancias` invocation under normal operation — killing the process can only ever land in "nothing written yet" or "everything already committed server-side" from the database's point of view. The verification design must therefore prove that invariant empirically (kill at many different points in the process lifecycle, always converging to nothing-or-everything, never partial) rather than try to catch a genuinely torn write, which the atomic API forecloses by design. This is a favorable finding — it validates JOB-01/JOB-02's approach rather than exposing a gap — but the plan must document it explicitly instead of silently assuming "mid-generation kill" means something it structurally cannot mean here.

For VERIFY-05, `cli/apollo_cli/session.py` already reads an `APOLLO_SESSION_FILE` environment variable (checked at call time, not import time) to relocate the session file. This is a pre-existing, tested override point (used by `cli/tests/test_auth_rejection.py`) — no new CLI flag or code change is needed to run two independent, non-clobbering sessions side by side. `login_client()` also exposes `client.auth.delete_user(email=...)`, an admin-only InstantDB endpoint (`DELETE /admin/users`) that can clean up the second test user's `$users` record after the isolation proof, addressing the "don't leave permanent cruft" concern from research goal 5. Note this only deletes the `$users` record — it does not touch any domain rows the second user might have (by design, the second user should never succeed in creating any).

**Primary recommendation:** Compose, don't reinvent. `verify-phase-06.sh` should literally invoke `verify-phase-01.sh` through `verify-phase-05.sh` (they are each idempotent, safe to re-run, and already prove VERIFY-01/02/03 in full) and then add exactly two new gates: a VERIFY-04 kill/re-run harness (requiring one small, env-var-gated instrumentation hook added to `routine_job.py`/`cli.py`) and a VERIFY-05 second-real-user isolation test (requiring zero CLI code changes, only a new pytest module using `APOLLO_SESSION_FILE`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CLI↔SPA parity re-proof (VERIFY-01) | Verification/CI script | Playwright (web) + pytest (cli) | Composes existing Phase 4/5 test suites; no new app code |
| Quality gates (VERIFY-02/03) | Verification/CI script | ruff/ty (cli), Biome/svelte-check (web) | Already repo-wide scoped by Phase 3/4 scripts |
| Interrupted-job simulation (VERIFY-04) | CLI process (`apollo rotina gerar-instancias`) | InstantDB backend (atomic transact) | The atomicity guarantee is server-side; the CLI only needs a test-only timing hook |
| Second-user isolation (VERIFY-05) | InstantDB backend (perms engine, `instant.perms.ts`) | CLI session layer (`session.py` env override) | Enforcement is 100% server-side; CLI only needs two independent sessions |
| Second-user cleanup | InstantDB Admin API (`DELETE /admin/users`) | CLI (`login_client()` already has admin token) | Avoids permanent test-account cruft in the live app |

## Standard Stack

### Core (already in place — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `instantdb` (Python SDK) | already pinned in `cli/uv.lock` | Admin client (`login_client()`), used for `auth.delete_user` and to build the second-user's own `session_client()` | Same SDK already used throughout `cli/` — no alternative needed |
| `pytest` + `pytest.mark.live` | already configured (`cli/tests/conftest.py`) | Houses VERIFY-04 and VERIFY-05 as live-marked test modules, matching Phase 3/5's pattern | Consistent with `test_auth_rejection.py`, `test_routine_job_parity.py` |
| Playwright | already configured (`web/playwright.config.ts`, projects `setup`/`authed`/`anon`) | Re-executed, not extended, for VERIFY-01 | Already proves SC-1's cross-channel directions |
| `concurrent.futures` / `subprocess` (stdlib) | n/a | Spawning and killing the `apollo rotina gerar-instancias` subprocess for VERIFY-04 | Already the pattern `test_routine_job_parity.py`'s concurrency proof uses (`subprocess.run` + `ThreadPoolExecutor`); VERIFY-04 needs `subprocess.Popen` + `os.kill(pid, signal.SIGKILL)` instead |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `signal` (stdlib) | n/a | `SIGKILL` (not `SIGTERM`) to guarantee no graceful shutdown/cleanup runs — the "genuinely killed" requirement | VERIFY-04 kill harness |
| `powershell.exe` via WSL (`orules.ps1`) | n/a — existing operational tool, PROJECT.md C-10 | Reading the magic-code email for the SECOND user | VERIFY-05, IF the second mailbox is also reachable only via the Outlook Classic/WSL bridge (see Open Questions — CONTEXT.md says `mcp__claude_ai_Microsoft_365__outlook_email_search` DOES reach `admin@`/`rm@rbrasset.com.br`, which is the opposite constraint from `tp@` in C-10; confirm which channel actually works for the chosen second mailbox before planning the exact retrieval command) | VERIFY-05 magic-code retrieval |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Env-var sentinel-file hook for VERIFY-04 timing | Randomized-delay kill with no hook | No production code change needed, but timing is not provably "mid-generation" — could land before any query, or after a fully-committed-but-unprinted transact, indistinguishably. Recommended only as a supplementary trial, not the primary proof. |
| `client.auth.delete_user(email=...)` for cleanup | Leave the second user's `$users` record in the live app | SPEC has no stated retention policy for test accounts; deleting is the safer default (matches every other phase's "never leaves the live app dirty" convention: see `verify-phase-03.sh`'s leftover checks, `verify-phase-04.sh`'s cleanliness gate) — `[ASSUMED]` that leaving zero test users is the desired end state; not explicitly required by REQUIREMENTS.md |
| Full re-run of `verify-phase-01.sh`..`05.sh` | Re-assert only VERIFY-02/03 gates + new SC-1/4/5 checks | Full re-run is slower and (if `--with-magic-code` is passed) re-sends real magic-code emails with a tight 60-90s expiry window (PROJECT.md C-10); but this is the final "is v1 done" gate for an autonomously-executed milestone with no human waiting on it, so slowness is an acceptable tradeoff for maximum rigor. Recommend running WITHOUT `--with-magic-code` (reusing persisted sessions/storageState, exactly as each script's own docstring recommends for normal runs) to avoid unnecessary email churn, and only add `--with-magic-code` as an optional one-time full-depth run. |

**Installation:** No new packages required for `cli/` or `web/`. All research above concerns SDK behavior already vendored in `cli/.venv` and existing project scripts.

**Version verification:** N/A — no new dependency versions to pin. The `instantdb` Python package installed in `cli/.venv/lib/python3.12/site-packages/instantdb` was inspected directly (source read, not training-data recall) to confirm `transact()`'s single-POST behavior — this is `[VERIFIED: local site-packages source]`, current for whatever version Phase 1-5 already locked in `cli/uv.lock`.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────┐
                    │   verify-phase-06.sh          │
                    │   (single "is v1 done" gate)  │
                    └──────────────┬────────────────┘
                                   │
        ┌──────────────┬──────────┼──────────┬───────────────┬───────────────┐
        ▼              ▼          ▼          ▼               ▼               ▼
  verify-phase-  verify-phase- verify-phase- verify-phase- verify-phase-  NEW gates
  01.sh          02.sh         03.sh         04.sh         05.sh          (VERIFY-04,
  (schema/perms  (calendar     (CLI CRUD +   (SPA CRUD +   (idempotent    VERIFY-05)
   scaffold)      parity)       CLI-11 deny) SC-1/SC-3     job, cross-
                                              CLI→SPA,      channel both
                                              quality gate) directions)
                                                   │              │
                                                   ▼              ▼
                                       ┌─────────────────┐ ┌──────────────────┐
                                       │ Playwright specs │ │ pytest -m live   │
                                       │ entities-fundos   │ │ test_routine_job │
                                       │ (SC-3: CLI→SPA)   │ │ _parity.py       │
                                       │ entities-ticket-  │ │ (concurrency)    │
                                       │ subtarefa (SPA→   │ └──────────────────┘
                                       │ CLI via `listar`) │
                                       │ entities-rotina-  │
                                       │ log (WEB-09:      │
                                       │ CLI→SPA log)      │
                                       │ routine-job-cross-│
                                       │ channel (both     │
                                       │ directions)        │
                                       └───────────────────┘

  NEW: VERIFY-04 harness                    NEW: VERIFY-05 harness
  ┌───────────────────────────┐            ┌──────────────────────────────┐
  │ subprocess.Popen(          │            │ login_client() [admin token] │
  │   "apollo rotina           │            │   → auth.send_magic_code(    │
  │    gerar-instancias")      │            │      second_email)           │
  │  + sentinel-file hook       │            │ → read code (Outlook MCP /   │
  │    (env-var gated)          │            │   orules.ps1 per which        │
  │  → poll sentinel             │            │   mailbox is reachable)      │
  │  → os.kill(pid, SIGKILL)    │            │ → check_magic_code() with    │
  │  → re-run to completion      │            │   APOLLO_SESSION_FILE=<tmp2> │
  │  → assert count == expected, │            │ → session_client(session2)   │
  │    zero dupe dedupeKeys      │            │   .transact(create/update/   │
  └───────────────────────────┘            │   delete on tp@'s known id)   │
                                             │ → assert permission-denied   │
                                             │ → login_client().auth.       │
                                             │   delete_user(email=second)  │
                                             └──────────────────────────────┘
```

### Recommended Project Structure
```
.planning/phases/06-end-to-end-verification/
├── verify-phase-06.sh              # orchestrator: re-runs 01-05, then new gates
cli/tests/
├── test_interrupted_job.py         # NEW — VERIFY-04 (pytest.mark.live)
├── test_cross_user_isolation.py    # NEW — VERIFY-05 (pytest.mark.live)
cli/apollo_cli/
├── routine_job.py                  # + optional test-only sentinel hook (env-var gated)
```

### Pattern 1: Env-var-gated test-only instrumentation hook
**What:** Add an optional sentinel-file signal immediately before (and optionally immediately after) the `client.transact(chunks)` call in `run_routine_instance_job`, active only when an env var (e.g. `APOLLO_TEST_TRANSACT_SENTINEL`) is set to a file path. When unset (the default, and the only state in normal/production use), the code path is a no-op.
**When to use:** Only for VERIFY-04's kill-timing harness. Never referenced by any user-facing command help text or production code path.
**Example:**
```python
# Source: pattern inferred from cli/apollo_cli/session.py's existing
# APOLLO_SESSION_FILE env-var override (verified in this session) — same
# "read env var at call time, default to production behavior" shape.
import os
from pathlib import Path

_SENTINEL_ENV_VAR = "APOLLO_TEST_TRANSACT_SENTINEL"

def _signal_test_sentinel(suffix: str) -> None:
    path = os.environ.get(_SENTINEL_ENV_VAR)
    if not path:
        return
    Path(f"{path}.{suffix}").touch()

# ... inside run_routine_instance_job, immediately before `client.transact(chunks)`:
_signal_test_sentinel("about-to-transact")
try:
    client.transact(chunks)
finally:
    _signal_test_sentinel("transact-returned")
```
**Rationale:** This is the only way to make "kill mid-generation" mean something precise and reproducible: the harness spawns the subprocess, polls for `<path>.about-to-transact` to appear (proving Steps 1-4 — query, query, compute, diff — are done and the process is entering the one atomic write), and issues `SIGKILL` at that instant. Because the write is a single HTTP POST, the kill will land either just-before-send (nothing committed) or just-after-the-OS-already-flushed-the-request (committed, but the process dies before it can touch `<path>.transact-returned` or print output) — both are exactly the two boundary cases worth proving convergence for.

### Pattern 2: Two independent, non-clobbering CLI sessions via `APOLLO_SESSION_FILE`
**What:** `cli/apollo_cli/session.py`'s `session_path()` reads `os.environ.get("APOLLO_SESSION_FILE")` at call time. Setting this env var to a distinct path (e.g. a `tmp_path`-scoped file) for the second user's login/CRUD calls leaves the primary session at `~/.config/apollo-cli/session` completely untouched.
**When to use:** VERIFY-05's second-user isolation proof.
**Example:**
```python
# Source: cli/apollo_cli/session.py (verified in this session) +
# cli/tests/test_auth_rejection.py's existing `_subprocess_env(session_file)`
# helper pattern for subprocess-based CLI invocations.
import os
import subprocess

def run_apollo_as(session_file: str, *args: str) -> subprocess.CompletedProcess[str]:
    env = {**os.environ, "APOLLO_SESSION_FILE": session_file}
    return subprocess.run(
        ["uv", "run", "apollo", *args],
        cwd="cli",
        capture_output=True,
        text=True,
        env=env,
    )

# Login as the second real user without touching tp@'s session:
run_apollo_as(second_session_path, "auth", "login", "--email", second_email)
# ... after retrieving the magic code from the reachable inbox ...
run_apollo_as(second_session_path, "auth", "login", "--email", second_email, "--code", code)
```
**Rationale:** No CLI code change required — this env var already exists and is already tested (`cli/tests/test_auth_rejection.py::_subprocess_env`). It is the correct mechanism the research goal 2 question was probing for; no `--session-file` flag or `HOME` trick is needed.

### Pattern 3: Server-side write-based isolation proof (never a query-based one)
**What:** Prove `donoId` isolation via a WRITE attempt (create/update/delete) from the second user's `session_client()` targeting a record `donoId`-owned by `tp@rbrasset.com.br`, asserting `InstantAPIError` with `type == "permission-denied"`.
**When to use:** VERIFY-05. This mirrors the exact pattern already proven correct in Phase 1 (`guest-write-check.mjs`) and Phase 3 (`test_auth_rejection.py`'s tests 1 and 3) — both documented with the same warning.
**Example:**
```python
# Source: cli/tests/test_auth_rejection.py (verified in this session) —
# same shape as test_mismatched_donoid_is_denied_even_with_a_real_session,
# but with a REAL second user's session instead of a synthetic other_user_id.
from instantdb import InstantAPIError

with pytest.raises(InstantAPIError) as exc_info:
    second_user_client.transact(
        second_user_client.tx.fundos[tp_fundo_id].update({"nome": "hijacked"})
    )
body = exc_info.value.body if isinstance(exc_info.value.body, dict) else {}
assert body.get("type") == "permission-denied"
```
**Anti-pattern warning already documented in this repo:** `test_auth_rejection.py`'s test 6 explicitly warns that an empty `listar`/query result under InstantDB's per-row `view` rule filtering proves NOTHING about enforcement (a query with zero visible rows returns `[]` with HTTP 200 regardless of whether perms are enforced). VERIFY-05 must not rely on "second user's `listar` shows nothing" as evidence — only a rejected WRITE is valid evidence. This is `[VERIFIED: cli/tests/test_auth_rejection.py:151-165]`, not an assumption.

### Anti-Patterns to Avoid
- **Treating a single-`transact()` kill as capable of producing a torn write:** the SDK issues one HTTP POST for the whole batch (`cli/.venv/.../instantdb/_sync/client.py:99-106`, verified). Do not design a test that asserts "N of M records exist" as a *success* case for VERIFY-04 — that would actually indicate the atomicity guarantee broke. The only valid post-kill states are 0 or full-batch-count for that specific run's `to_create` set.
- **Using `SIGTERM` instead of `SIGKILL`:** `SIGTERM` allows Python to run `finally`/atexit handlers, which could mask exactly the "unclean interruption" scenario the requirement describes. Always `SIGKILL` (`signal.SIGKILL` / `os.kill(pid, 9)`).
- **Re-authenticating the second user's magic-code flow inside a tight retry loop without checking which mailbox-reading tool actually works for `admin@`/`rm@rbrasset.com.br`:** PROJECT.md C-10 documents that the working channel for `tp@rbrasset.com.br` is the Outlook Classic/WSL bridge, NOT the `mcp__claude_ai_Microsoft_365__outlook_email_search` MCP tool — but 06-CONTEXT.md states the OPPOSITE is true for `admin@`/`rm@` (the MCP tool DOES reach those mailboxes). Confirm this at execution time with a cheap read-only probe before wiring the full login retry loop; do not assume either channel works for a mailbox it hasn't been proven against.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Second-user session isolation | A new CLI flag (`--session-file`), a `HOME` env var trick, or a second `~/.config` directory scheme | `APOLLO_SESSION_FILE` (already exists, already tested) | Zero new code; matches the one sanctioned override point |
| Cross-user permission proof | A custom perms-simulation harness or InstantDB rule dry-run tool | A real write attempt via `session_client()` + `pytest.raises(InstantAPIError)` | This is the exact pattern Phase 1 and Phase 3 already validated; InstantDB's `debug_transact`/`debug_query` admin endpoints exist but require an admin token and don't test the REAL enforcement path a real user hits |
| Test-user cleanup | Manual dashboard deletion, or leaving the account | `login_client().auth.delete_user(email=second_email)` (`DELETE /admin/users`, `[CITED: instantdb.com/docs/http-api, instantdb.com/docs/users]`) | Already wired into the installed SDK (`cli/.venv/.../instantdb/_sync/auth.py:82-92`, verified) |
| "Mid-generation" kill timing | A blind `sleep(random)` + kill with no way to know what state the process was in | Env-var-gated sentinel-file hook (Pattern 1) | Random-delay-only kills cannot distinguish "killed before any query" from "killed after a fully committed but unprinted transact" — both trivially safe and uninteresting; the sentinel makes the interesting boundary (about to write / just wrote) observable and reproducible |

**Key insight:** Every piece of infrastructure VERIFY-01/02/03/05 needs already exists in the repo from Phases 1-5; the only genuinely new code this phase should introduce is the ~10-line sentinel hook for VERIFY-04 and the two new pytest modules that exercise it and VERIFY-05.

## Common Pitfalls

### Pitfall 1: Assuming VERIFY-01 needs new e2e specs
**What goes wrong:** A planner could naively schedule new Playwright specs for "CLI creates a fundo, SPA reads it" or "SPA creates a subtarefa, CLI confirms it," duplicating work.
**Why it happens:** The roadmap/CONTEXT.md phrasing ("cross-channel parity across the full entity set") sounds like new test-writing work.
**How to avoid:** `web/e2e/entities-fundos.spec.ts` already has a test literally named `"SC-3: a fundo created by the CLI is visible in the SPA"` (CLI→SPA, full-CRUD category). `web/e2e/entities-ticket-subtarefa.spec.ts` already proves SPA→CLI for the same category via `apollo subtarefa listar --tarefa-id/--ticket-id`. `web/e2e/entities-rotina-log.spec.ts`'s `WEB-09` test proves CLI→SPA for the log-only category. `web/e2e/routine-job-cross-channel.spec.ts` proves both directions for the instanciasRotina category. All four are already invoked by `verify-phase-04.sh`'s `authed` Playwright project run and `verify-phase-05.sh`'s Gate 5. **Re-running these via the composed `verify-phase-06.sh` is the entire VERIFY-01 requirement — confirmed `[VERIFIED: read of the four spec files + both verify scripts in this session]`.**
**Warning signs:** A plan that adds a new `web/e2e/*.spec.ts` file whose only purpose is "prove CLI write shows in SPA" for an entity/category combination not listed above should be double-checked against this table before being accepted.

### Pitfall 2: Misinterpreting "interrupted mid-generation" as requiring a partial-write assertion
**What goes wrong:** Writing a test that expects to observe, say, 3 of 5 expected `instanciasRotina` existing after a kill, and treating that as the "correct" interrupted-then-recovered state.
**Why it happens:** The natural mental model of "kill a batch job mid-loop" assumes per-record writes, which is how the client-side `web/src/lib/routineJob.ts`/`cli/apollo_cli/routine_job.py` code COMPUTES the batch (a list of chunks), but not how it WRITES it (one atomic `client.transact(chunks)` call).
**How to avoid:** Verify (as this research did, reading `_sync/client.py`) that the write is a single POST before designing the test. Assert only the two valid observable outcomes: 0 new records (kill won the race) or all new records (transact won the race) — never a partial count. The re-run-to-completion step must then always converge to the fully-expected count with zero duplicates, in both cases.
**Warning signs:** A test assertion of the form `assert 0 < count < expected` after a kill — this should never be the success condition.

### Pitfall 3: Confusing "second real user" mailbox access with `tp@`'s documented channel
**What goes wrong:** Reusing the `orules.ps1`/Outlook-Classic-via-WSL retrieval command verbatim for `admin@`/`rm@rbrasset.com.br`, assuming the same local mailbox setup applies.
**Why it happens:** PROJECT.md C-10 is very detailed about `tp@`'s channel and could be pattern-matched without re-reading 06-CONTEXT.md's correction.
**How to avoid:** 06-CONTEXT.md explicitly states the reachable channel for `admin@`/`rm@rbrasset.com.br` is `mcp__claude_ai_Microsoft_365__outlook_email_search` (the OPPOSITE of what worked for `tp@`). Confirm with one lightweight read-only search call before building the full login-retry loop around a specific tool.
**Warning signs:** A plan/task that imports or shells out to `orules.ps1` for the second user's magic code without first verifying that tool actually has access to that mailbox.

### Pitfall 4: Treating an empty `listar` result as isolation proof
**What goes wrong:** Asserting "second user's `apollo fundo listar` returns `[]`, therefore isolation holds."
**Why it happens:** It's the most obvious/cheap thing to check, and looks superficially correct.
**How to avoid:** As documented in this repo's own `test_auth_rejection.py` test 6 and its inline comment: InstantDB's `view` rule silently filters disallowed rows out of query results (HTTP 200, empty list) regardless of whether perms are enforced or the app simply has zero matching rows. Only a WRITE attempt (create/update/delete) against a record known to be `donoId`-owned by `tp@` produces a genuine pass/fail signal (`InstantAPIError` with `type: "permission-denied"`). VERIFY-05 must exercise create, update, AND delete against a real existing `tp@`-owned record id (obtained via the primary/admin-authenticated CLI session) to satisfy the requirement's explicit "view/edit/delete" wording.
**Warning signs:** A VERIFY-05 test with no `pytest.raises(InstantAPIError)` assertion, or one that only checks list/query output.

### Pitfall 5: Leaving the second test user permanently registered
**What goes wrong:** Running the magic-code flow for `admin@`/`rm@rbrasset.com.br` creates (or reuses) an InstantDB `$users` row for that email in the live app, which then persists forever if nothing cleans it up.
**Why it happens:** Every prior phase's cleanup convention (Phase 3's fundo-prefix sweep, Phase 4's `phase04-e2e-` sweep, Phase 5's `phase05-` sweep) cleans up DOMAIN records, not auth users — there is no prior precedent in this repo for deleting a `$users` row, so it's easy to overlook.
**How to avoid:** Call `login_client().auth.delete_user(email=second_email)` (admin-token-bearing client, legal per the existing `login_client()`/`session_client()` split documented in `instant_client.py`) as the LAST step of the VERIFY-05 test, in a `finally`/fixture-teardown block so it runs even on assertion failure.
**Warning signs:** A VERIFY-05 test with no teardown step calling `delete_user`, or one that reuses `login_client()` for anything other than the send/verify magic-code calls and this final cleanup (per `instant_client.py`'s existing "legal to call ONLY from `apollo_cli.auth.login`" convention — VERIFY-05's test code is a new, deliberate, documented exception to that convention, scoped to this one test file).

## Code Examples

### Composing the five prior verify scripts (recommended `verify-phase-06.sh` skeleton)
```bash
# Source: this session's read of verify-phase-01.sh..verify-phase-05.sh —
# every one of them is `set -euo pipefail`, cd's to REPO_ROOT via
# SCRIPT_DIR-relative resolution, and is documented as "safe to run twice in
# a row, from any cwd." Composing them is therefore safe.
PHASES_DIR=".planning/phases"
bash "${PHASES_DIR}/01-repo-scaffold-live-schema/verify-phase-01.sh"
bash "${PHASES_DIR}/02-shared-anbima-calendar/verify-phase-02.sh"
bash "${PHASES_DIR}/03-cli-auth-crud/verify-phase-03.sh"
bash "${PHASES_DIR}/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh"
bash "${PHASES_DIR}/05-idempotent-routine-instance-job/verify-phase-05.sh"
# ^ VERIFY-01 (SC-1), VERIFY-02, VERIFY-03 fully re-proven by the above.
# New gates below: VERIFY-04, VERIFY-05.
```

### Confirming InstantDB's Python SDK issues one POST per `transact()` call
```python
# Source: cli/.venv/lib/python3.12/site-packages/instantdb/_sync/client.py:99-106
# (read directly in this session — [VERIFIED: local site-packages source])
def transact(self, chunks: _TxChunk | list[_TxChunk]) -> dict[str, Any]:
    return self._http.post(
        "/admin/transact",
        params={"app_id": self._app_id},
        json={
            "steps": _flatten_chunks(chunks),
            "throw-on-missing-attrs?": False,
        },
    )
```

### Admin user deletion (VERIFY-05 cleanup)
```python
# Source: cli/.venv/lib/python3.12/site-packages/instantdb/_sync/auth.py:82-92
# (read directly in this session)
def delete_user(
    self, *, email: str | None = None, id: str | None = None, refresh_token: str | None = None,
) -> dict[str, Any] | None:
    params = _exactly_one({"email": email, "id": id, "refresh_token": refresh_token})
    params["app_id"] = self._app_id
    result = self._http.delete("/admin/users", params=params)
    return result["deleted"]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — this phase does not touch external library versions | N/A | N/A | This research is entirely about THIS repo's existing code (Phases 1-5), not an external ecosystem. No library upgrades or deprecations are in scope. |

**Deprecated/outdated:** None identified — all findings are `[VERIFIED]` against code already in this repository or `[CITED]` against current InstantDB docs pages fetched via WebSearch this session.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The second test user's `$users` record should be deleted after VERIFY-05 (no stated retention requirement exists in REQUIREMENTS.md/PROJECT.md) | Alternatives Considered, Pitfall 5 | Low — if wrong, the fix is a one-line removal of the cleanup call; leaving the account is not harmful to app correctness, only to "no live cruft" tidiness which every other phase already treats as a convention worth enforcing |
| A2 | `admin@rbrasset.com.br` or `rm@rbrasset.com.br` is reachable via `mcp__claude_ai_Microsoft_365__outlook_email_search` as stated in 06-CONTEXT.md (not independently re-verified with a live probe in this research session) | Pattern 3, Pitfall 3 | Medium — if the tool cannot actually reach that mailbox in the execution environment, VERIFY-05 blocks entirely on magic-code retrieval; the plan should include a cheap read-only probe as its first task before building the full retry loop |
| A3 | A single kill-timing sentinel hook (Pattern 1) is an acceptable, small, env-var-gated addition to production code (`routine_job.py`) for this final verification phase, rather than out-of-scope feature creep | Pattern 1, Don't Hand-Roll | Low — the hook is inert by default and mirrors the project's own established `APOLLO_SESSION_FILE` convention; if deemed unacceptable, the fallback (Alternatives Considered) is a randomized-delay-only kill with weaker "provably mid-generation" claims, documented as a known limitation |

**If this table is empty:** N/A — see above; three assumptions logged, none high-risk.

## Open Questions

1. **Which specific `tp@`-owned record should VERIFY-05 target for the write-denial proof?**
   - What we know: The primary session (`~/.config/apollo-cli/session`, pinned `EXPECTED_USER_ID` from `verify-phase-03.sh`) can list any entity to obtain a real, live record id belonging to `tp@`.
   - What's unclear: Whether the plan should create a fresh, dedicated `phase06-`-prefixed record for this purpose (safer — avoids any risk of the second user's denied-but-attempted write somehow touching a record another phase's leftover-sweep depends on) or reuse an existing one.
   - Recommendation: Create a dedicated `phase06-verify05-` prefixed `fundos` record via the primary CLI session at test setup, target it with the second user's denied create/update/delete attempts, then delete it via the primary session at teardown — mirrors every prior phase's "own your fixtures" convention.

2. **Should VERIFY-04's sentinel hook also be exercised against the SPA (`web/src/lib/routineJob.ts`), or is the CLI alone sufficient?**
   - What we know: JOB-01 (SPA, client-side on load) and JOB-02 (CLI) are described in REQUIREMENTS.md as parallel implementations of "the same algorithm," and VERIFY-04's roadmap wording says "the process" (singular), and CONTEXT.md's research goal 1 exclusively discusses spawning `apollo rotina gerar-instancias` as a subprocess.
   - What's unclear: Whether a browser-side kill (closing the tab mid-fetch) is in scope too, which would need a Playwright-driven kill instead of `subprocess`+`SIGKILL`.
   - Recommendation: Scope VERIFY-04 to the CLI process only (matches CONTEXT.md's explicit framing and is the only channel where a genuine OS-level `SIGKILL` is meaningful — a browser tab close doesn't have an equivalent "did the in-flight fetch already leave the process" ambiguity in the same way). Note this scoping decision explicitly in the plan so it isn't silently narrowed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `instantdb` Python SDK (admin `delete_user`, `transact`) | VERIFY-04, VERIFY-05 | ✓ | already vendored in `cli/.venv` (verified via source read) | — |
| `mcp__claude_ai_Microsoft_365__outlook_email_search` MCP tool | VERIFY-05 magic-code retrieval for `admin@`/`rm@rbrasset.com.br` | Not independently verified this session (per 06-CONTEXT.md, "confirmed working in earlier phases' troubleshooting") | — | `orules.ps1` (Outlook Classic/WSL bridge) as used for `tp@`, IF the MCP tool turns out not to reach the chosen second mailbox either |
| `uv`, `bun`, live InstantDB app connectivity | All gates (re-running 01-05) | ✓ (used successfully by all prior phases) | pinned in `uv.lock`/`bun.lock` | — |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** Second-mailbox magic-code retrieval channel (see Open Question 1 / Pitfall 3) — has a documented fallback (the `orules.ps1` bridge), contingent on probing which channel actually works for the chosen mailbox first.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (cli, `pytest.mark.live` convention) + Playwright (web, `authed`/`anon`/`setup` projects) + bun test (web unit) — all already configured, no new framework needed |
| Config file | `cli/pyproject.toml` (pytest config), `web/playwright.config.ts` |
| Quick run command | `uv run --project cli pytest cli/tests -m "not live"` (offline parity, ~seconds) |
| Full suite command | `bash .planning/phases/06-end-to-end-verification/verify-phase-06.sh` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| VERIFY-01 | CLI write visible in SPA and vice versa, one entity per category | e2e (Playwright) | `bunx playwright test --project=authed` (web/e2e/entities-fundos.spec.ts, entities-ticket-subtarefa.spec.ts, entities-rotina-log.spec.ts, routine-job-cross-channel.spec.ts) | ✅ (all four already exist) |
| VERIFY-02 | ruff+ty clean on cli/ + shared/scripts | lint/typecheck | `(cd cli && uv run ruff check . ../shared/scripts && uv run ty check . ../shared/scripts)` | ✅ (already asserted in verify-phase-03.sh) |
| VERIFY-03 | web/ formatter+linter+svelte-check clean | lint/typecheck | `(cd web && bun run check && bun run lint && bun run format:check)` | ✅ (already asserted in verify-phase-04.sh) |
| VERIFY-04 | Interrupted job run leaves no dupe/no missing | live integration (pytest) | `uv run --project cli pytest cli/tests/test_interrupted_job.py -m live` | ❌ Wave 0 — new file + sentinel hook |
| VERIFY-05 | Second real user cannot view/edit/delete tp@'s records | live integration (pytest) | `uv run --project cli pytest cli/tests/test_cross_user_isolation.py -m live` | ❌ Wave 0 — new file |

### Sampling Rate
- **Per task commit:** offline parity suite (`pytest -m "not live"`, `bun test src`) — fast, no network, no live-account side effects
- **Per wave merge:** the new live-marked VERIFY-04/VERIFY-05 modules individually
- **Phase gate:** full `verify-phase-06.sh` (re-runs 01-05 + new gates) green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `cli/tests/test_interrupted_job.py` — covers VERIFY-04
- [ ] `cli/tests/test_cross_user_isolation.py` — covers VERIFY-05
- [ ] Sentinel-hook addition to `cli/apollo_cli/routine_job.py` (env-var gated, ~10 lines) — required by VERIFY-04's test to have a deterministic kill point
- [ ] `.planning/phases/06-end-to-end-verification/verify-phase-06.sh` — the orchestrator script itself

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Magic-code email auth via InstantDB (already implemented, C-05) — VERIFY-05 exercises a SECOND real account through the same flow, no new auth code |
| V3 Session Management | yes | `APOLLO_SESSION_FILE` env-var isolation ensures the two sessions in VERIFY-05 never share state; both are 0600-permissioned session files per `session.py`'s existing hardening |
| V4 Access Control | yes | `donoId`-scoped InstantDB perm rules (`shared/instant.perms.ts`) — VERIFY-05 IS the ASVS V4 verification for this project's entire object-level access control model |
| V5 Input Validation | no (not new input surface this phase) | — |
| V6 Cryptography | no (no new crypto this phase; magic-code/refresh-token handling is InstantDB's own, already covered in Phase 3 research) | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Broken object-level authorization (a second authenticated user reading/writing another user's rows) — this IS the exact scenario VERIFY-05 tests | Elevation of Privilege | `instant.perms.ts`'s `auth.id == data.donoId` rule, enforced server-side; VERIFY-05 proves it holds against a write, not just a query (Pitfall 4) |
| Torn/partial writes under process interruption (VERIFY-04's concern) | Tampering / Repudiation (of the "did this run complete" kind) | InstantDB's atomic `transact()` API — verified server-side, single POST, all-or-nothing |
| Leaking the admin token via a verification harness (a new risk this phase introduces, since VERIFY-05's cleanup step is a new legitimate use of `login_client()` outside `auth.py`) | Information Disclosure | Keep `login_client()`/admin-token usage confined to the new test file's setup (send code) and teardown (delete_user) only — never print/log the token, matching `instant_client.py`'s existing confinement convention; the existing "admin-token confinement" AST-walk gate in `test_auth_rejection.py`'s test 7 currently exempts only `instant_client.py`/`auth.py`/`config.py` — the plan should extend that exemption list to include the new VERIFY-05 test file explicitly, rather than let the gate silently pass or silently fail on it |

## Sources

### Primary (HIGH confidence)
- `cli/.venv/lib/python3.12/site-packages/instantdb/_sync/client.py` — `transact()` implementation, read directly this session
- `cli/.venv/lib/python3.12/site-packages/instantdb/_sync/auth.py` — `delete_user()`/`get_user()` implementation, read directly this session
- `cli/apollo_cli/session.py`, `cli/apollo_cli/instant_client.py`, `cli/apollo_cli/auth.py` — read directly this session
- `cli/apollo_cli/routine_job.py` — read directly this session (transact call site, atomicity confirmation)
- `web/e2e/entities-fundos.spec.ts`, `entities-ticket-subtarefa.spec.ts`, `entities-rotina-log.spec.ts`, `routine-job-cross-channel.spec.ts` — read directly this session
- `.planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh` through `05-idempotent-routine-instance-job/verify-phase-05.sh` — read directly this session
- `.planning/phases/04-web-spa-auth-crud-smoke-ui/04-02-SUMMARY.md` — read directly this session (manual SC-3 demonstration record)
- `cli/tests/test_auth_rejection.py` — read directly this session

### Secondary (MEDIUM confidence)
- InstantDB docs, "Writing data" (`instantdb.com/docs/instaml`) — via WebSearch, confirms transact atomicity as documented product behavior
- InstantDB docs, "Admin HTTP API" and "Managing users" (`instantdb.com/docs/http-api`, `instantdb.com/docs/users`) — via WebSearch, confirms `DELETE /admin/users` exists and is the documented deletion mechanism

### Tertiary (LOW confidence)
- Whether `mcp__claude_ai_Microsoft_365__outlook_email_search` genuinely reaches `admin@rbrasset.com.br`/`rm@rbrasset.com.br` in THIS execution environment — taken from 06-CONTEXT.md's claim, not independently re-verified with a live probe in this research session (see Open Questions, Assumption A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all findings verified against installed source
- Architecture (VERIFY-01 composition): HIGH — every claim traced to a specific file/line read this session
- VERIFY-04 mechanism (atomicity): HIGH — verified against SDK source, cross-checked with official docs
- VERIFY-05 mechanism (session isolation, admin delete_user): HIGH — verified against SDK source and existing tested code
- Second-mailbox reachability: LOW — inherited claim from CONTEXT.md, flagged as Assumption A2 / Open Question, not independently re-verified

**Research date:** 2026-08-09
**Valid until:** 30 days (this research is entirely internal-repo-state-dependent; re-verify if `cli/uv.lock`'s `instantdb` pin changes, or if Phases 1-5's verify scripts are modified before Phase 6 executes)
