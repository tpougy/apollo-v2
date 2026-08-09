---
phase: 06-end-to-end-verification
plan: 03
subsystem: testing
tags: [bash, verification, ruff, ty, playwright, pytest, milestone-gate]

requires:
  - phase: 06-end-to-end-verification
    provides: "06-01 (VERIFY-05 second-user proof + cli/.auth/second-user-session), 06-02 (VERIFY-04 SIGKILL harness)"
  - phase: 01-repo-scaffold-live-schema
    provides: verify-phase-01.sh
  - phase: 02-shared-anbima-calendar
    provides: verify-phase-02.sh
  - phase: 03-cli-auth-crud
    provides: verify-phase-03.sh
  - phase: 04-web-spa-auth-crud-smoke-ui
    provides: verify-phase-04.sh
  - phase: 05-idempotent-routine-instance-job
    provides: verify-phase-05.sh
provides:
  - "verify-phase-06.sh -- the single 'is Apollo v2 v1 done?' gate, composing verify-phase-01..05.sh plus VERIFY-01/02/03/04/05 with anti-silent-skip/anti-vacuity assertions and an opt-in --final second-user cleanup pass"
  - "06-03-VERIFICATION-EVIDENCE.md -- two recorded green runs (Run A normal, Run B --final) mapping all five ROADMAP Phase 6 success criteria to the gate that proved each"
  - "Eight genuine pre-existing defects in Phases 2-5's own verification scripts/tests, found and fixed (none caused by this plan's new code)"
affects: []

tech-stack:
  added: []
  patterns:
    - "Transcript-marker assertions, not exit-status alone: each composed phase script's own 'PHASE 0N VERIFIED' line is grepped for, catching the exact class of bug this plan found in verify-phase-03.sh (exit 1 while printing its own success marker)"
    - "Anti-vacuity file-count floors (find | wc -l > 15) alongside quality-gate commands, so a silently narrowed lint/type-check scope fails loudly"
    - "--skip-composed prints WARNING and withholds the final marker line -- a partial run can never be mistaken for a certified milestone"

key-files:
  created:
    - .planning/phases/06-end-to-end-verification/verify-phase-06.sh
    - .planning/phases/06-end-to-end-verification/06-03-VERIFICATION-EVIDENCE.md
    - .planning/phases/06-end-to-end-verification/deferred-items.md
  modified:
    - README.md
    - .planning/phases/02-shared-anbima-calendar/verify-phase-02.sh
    - .planning/phases/03-cli-auth-crud/verify-phase-03.sh
    - .planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh
    - web/e2e/entities-rotina-log.spec.ts
    - cli/apollo_cli/routine_job.py
    - cli/tests/test_routine_job_parity.py

key-decisions:
  - "Fixed every genuine defect found while actually running the composed gate rather than working around it or stopping to ask, per the plan's explicit Task 3 instruction ('never weaken, comment out, or narrow a gate to make it pass') and the deviation rules' Rule 1/3 boundary (mechanical, low-risk, directly blocking) -- none touched application behavior or security posture, only test/verification-script correctness"
  - "Did NOT update STATE.md or ROADMAP.md per this execution's explicit orchestrator instruction, overriding plan Task 3's own action text that asked for a ROADMAP.md update -- flagged here as a deviation, not silently skipped"
  - "Second-user session re-bootstrap after Run B's --final is handed off to the orchestrator (same MCP-mailbox-scoping precedent as 06-01), not attempted by this executor"

patterns-established:
  - "A phase's own verify-phase-0N.sh script is not exempt from bugs -- Gate 1-5 composition in verify-phase-06.sh is what finally exercised these scripts' exit codes together and caught a years-latent trap bug, a stale time-bound assertion, and two scope-drift regressions that had been silently 'passing' (by transcript, not exit code) or drifting out of scope for multiple phases"

requirements-completed: [VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-05]

duration: 1 session (~2.5h wall clock including two full live verification runs)
completed: 2026-08-09
---

# Phase 6 Plan 3: The v1 Done Gate Summary

**`verify-phase-06.sh` composes all five prior phase scripts plus the new VERIFY-04/05 gates into one command; running it for real (twice) surfaced and fixed eight genuine pre-existing defects in Phases 2-5's own verification tooling, then recorded two fully green runs certifying the entire v1 milestone.**

## Performance

- **Tasks:** 3/3 completed (Task 3's scope reduced per this execution's explicit instruction: ROADMAP.md was NOT updated — see Deviations)
- **Files created:** 3 (`verify-phase-06.sh`, `06-03-VERIFICATION-EVIDENCE.md`, `deferred-items.md`)
- **Files modified:** 7 (`README.md`, 3 prior verify-phase-0N.sh scripts, 1 e2e spec, 2 CLI files)

## Accomplishments

- Built `verify-phase-06.sh`: Gate 0 preflight (tools + all three persisted sessions, every missing prerequisite a hard, actionable failure); Gates 1-5 compose `verify-phase-01.sh` through `verify-phase-05.sh` with transcript-marker assertions (not exit status alone); Gate 6 re-executes exactly the four VERIFY-01 spec files/tests the plan named; Gates 7/8 pin VERIFY-02/VERIFY-03 repo-wide with anti-vacuity file-count floors; Gates 9/10 re-assert VERIFY-04/VERIFY-05 with zero-skipped/anti-silent-skip transcript checks and leftover sweeps; Gate 11 is the opt-in `--final` second-user cleanup pass, printing an explicit `SKIPPED` line on every normal run.
- Documented the whole gate for an operator in `README.md`'s new "Re-verifying the whole milestone" section: all four flags/env-var equivalents, Gate 0's prerequisites and fixes, the second-user bootstrap command, and the `cli/.auth/` gitignore reminder.
- Ran the full gate for real, twice, against the live app: **Run A** (no flags) — `PHASE 06 VERIFIED`, exit 0, 361s. **Run B** (`--final`) — `PHASE 06 VERIFIED` + `APOLLO V2 v1 MILESTONE GATE: GREEN`, exit 0, 369s, tp@ provably survived Gate 11's second-user teardown (unchanged `user_id`, unchanged `fundos` count).
- Found and fixed eight genuine pre-existing defects surfaced only by actually composing and exit-code-checking Phases 2-5's scripts together (full list in `06-03-VERIFICATION-EVIDENCE.md`'s "Genuine defects found and fixed" section) — most notably `verify-phase-03.sh`'s cleanup trap, which has silently exited 1 on every successful run since it was written, undetected because nothing before this plan checked its exit code against its own "PHASE 03 VERIFIED" transcript claim.
- Wrote `06-03-VERIFICATION-EVIDENCE.md` mapping each of ROADMAP Phase 6's five success criteria to the specific gate and observed result that proved it.

## Task Commits

Each fix/feature was committed atomically:

1. `9a45e41` (feat) — Task 1: compose verify-phase-01..05 into the v1 done gate
2. `329e4a9` (fix) — unblock verify-phase-04.sh's T-04-03 gate (Phase 5's legitimate donoId usage)
3. `77f1845` (feat) — Task 2: wire VERIFY-04/05 gates, --final cleanup pass, README docs
4. `69f102a` (style) — fix pre-existing ruff format drift in routine_job.py
5. `9795057` (fix) — Gate 10 permission-denied check + --skip-composed final-line gating
6. `7c69ba5` (fix) — verify-phase-02.sh CAL-04 scope drift (bun test / pytest -m live)
7. `319bf44` (fix) — remove verify-phase-03.sh's now-permanently-false gerar-instancias check
8. `e421bbc` (fix) — verify-phase-03.sh cleanup trap always exited 1 on success
9. `a2ff45d` (docs) — Task 3: record the green v1 done gate run (Run A + Run B --final)

## Files Created/Modified

- `.planning/phases/06-end-to-end-verification/verify-phase-06.sh` — the v1 done gate itself, 12 gates (0-11)
- `.planning/phases/06-end-to-end-verification/06-03-VERIFICATION-EVIDENCE.md` — criteria->gate mapping, both runs' transcripts/timing, tp@-survival figures, defect log, scoping decisions
- `.planning/phases/06-end-to-end-verification/deferred-items.md` — full root-cause writeups for the WEB-06/WEB-07/T-04-03 fixes
- `README.md` — "Re-verifying the whole milestone" section
- `.planning/phases/02-shared-anbima-calendar/verify-phase-02.sh` — CAL-04 scoped to `bun test src` / `pytest -m "not live"`
- `.planning/phases/03-cli-auth-crud/verify-phase-03.sh` — removed stale gerar-instancias check; fixed cleanup trap's exit-code bug
- `.planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh` — widened T-04-03's donoId allowlist
- `web/e2e/entities-rotina-log.spec.ts` — fixed WEB-06's off-by-one column indices, WEB-07's hasRows race
- `cli/apollo_cli/routine_job.py`, `cli/tests/test_routine_job_parity.py` — ruff format (whitespace only)

## Decisions Made

- **Fix, never work around, live gate failures.** Every one of the eight defects found while actually running the composed gate was root-caused and fixed in its own commit, per the plan's explicit Task 3 instruction. None were application security/behavior defects — all were verification-script/test correctness bugs (stale assumptions, scope drift from later phases' legitimate growth, or a genuine shell scripting bug in a trap). Each is documented in `06-03-VERIFICATION-EVIDENCE.md` and `deferred-items.md`.
- **Did not update ROADMAP.md or STATE.md**, per this execution's explicit orchestrator instruction, which overrides plan Task 3's own action text asking for a ROADMAP.md checkbox/progress update. This is a deliberate scope reduction for this run, not an oversight — see Deviations below.
- **Second-user re-bootstrap handed off**, following the exact precedent 06-01 established: the magic-code mailbox read needs an MCP tool (`mcp__claude_ai_Microsoft_365__outlook_email_search`) that executor subagents don't inherit. Run B's `--final` deliberately invalidated `cli/.auth/second-user-session` as its designed side effect; re-bootstrapping it is the one action item left to the orchestrator, documented in the evidence file with the exact commands.

## Deviations from Plan

**1. [Orchestrator instruction override] ROADMAP.md not updated.** Plan 06-03's Task 3 action text explicitly asks to mark Phase 6's ROADMAP.md checkbox `[x]`, update its `**Plans**` line, replace the plan-entry placeholders, and update the Progress table. This execution's explicit instructions said "Do NOT update STATE.md or ROADMAP.md" — an orchestrator-level constraint that takes precedence over the plan's own text per this session's instructions. Everything else Task 3 asked for (running the gate twice, recording evidence, mapping success criteria) was completed in full.

**2. [Rule 1/3 — bugs/blocking issues, out-of-plan files] Eight pre-existing defects fixed.** All outside this plan's `files_modified` list (which only named `verify-phase-06.sh`, `06-03-VERIFICATION-EVIDENCE.md`, `README.md`), but each one directly blocked Gates 1-8 of the very script this plan exists to build, and each is a mechanical, low-risk, well-understood fix (see the numbered list in `06-03-VERIFICATION-EVIDENCE.md`'s "Genuine defects found and fixed" section for full root-cause detail on all eight). None involved an architectural change, a new table, or a new service — all qualify as Rule 1 (bug) or Rule 3 (blocking issue) auto-fixes, not Rule 4 (ask) territory.

## Issues Encountered

- **`verify-phase-03.sh`'s cleanup trap silently exited 1 on every prior successful run** (see defect #7 in the evidence file) — this had been true since the script was written and was invisible to every prior phase because nothing checked its exit code against its own printed "PHASE 03 VERIFIED" claim. `verify-phase-06.sh`'s own transcript-marker-plus-exit-status design is exactly what caught it.
- **Second-user session bootstrap is orchestrator-scoped, not executor-scoped** (same finding as 06-01) — documented, not worked around.

## User Setup Required

- The orchestrator (or whichever process holds `mcp__claude_ai_Microsoft_365__outlook_email_search`) needs to re-bootstrap `cli/.auth/second-user-session` before the next VERIFY-05/`verify-phase-06.sh` run, using the two-step `apollo auth login` command documented in `06-03-VERIFICATION-EVIDENCE.md`'s "Second-user session re-bootstrap" section.

## Next Phase Readiness

- All five VERIFY-01..05 requirements are proven, live, twice (Run A + Run B), with the full command re-runnable end to end from a clean checkout.
- This is the final plan of the final phase of the v1 milestone. The only remaining action item is the second-user session re-bootstrap noted above (does not block the milestone's own certification — Run A and Run B both already completed green before `--final` invalidated the session as its own designed side effect) and, per this execution's explicit scope, ROADMAP.md/STATE.md updates that the orchestrator should apply separately.

## Self-Check: PASSED

- FOUND: `.planning/phases/06-end-to-end-verification/verify-phase-06.sh`
- FOUND: `.planning/phases/06-end-to-end-verification/06-03-VERIFICATION-EVIDENCE.md`
- FOUND: `.planning/phases/06-end-to-end-verification/deferred-items.md`
- FOUND commits `9a45e41`, `329e4a9`, `77f1845`, `69f102a`, `9795057`, `7c69ba5`, `319bf44`, `e421bbc`, `a2ff45d` in `git log --oneline --all`

---
*Phase: 06-end-to-end-verification*
*Completed: 2026-08-09*
