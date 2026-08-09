---
phase: 05-idempotent-routine-instance-job
verified: 2026-08-09T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 5: Idempotent Routine-Instance Job Verification Report

**Phase Goal:** Recurring routine instances are generated automatically and safely, without ever duplicating or deleting existing instances, regardless of which channel triggers it.
**Verified:** 2026-08-09
**Status:** passed
**Re-verification:** No — initial verification

## Method

This verification re-ran the phase's own `verify-phase-05.sh` end to end against the
live InstantDB app (not a trust of SUMMARY.md claims), read the six PLAN/SUMMARY pairs,
read `05-REVIEW.md` (an independent code review that itself re-ran the fixture-parity
suites rather than trusting the summaries), and independently grepped the two
implementation files for debt markers and delete/admin-token prohibitions.

```
bash .planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh
```

Full output (abbreviated):

```
== Phase 5 verification starting in /home/thomaz/pessoal/apollo-v2 ==
-- Gate 1: C-08 quality gates (web check/lint/format/build, cli ruff/ty)
1786299885417 COMPLETED 298 FILES 0 ERRORS 1 WARNINGS 1 FILES_WITH_PROBLEMS
Checked 38 files in 48ms. No fixes applied.
Checked 34 files in 6ms. No fixes applied.
✓ built in -80732ms
All checks passed! (ruff)
All checks passed! (ty)
Gate 1: PASS
-- Gate 2: schema gate (bun run instant:verify, live pull)
✅ Wrote schema to .instant-verify/instant.schema.ts
✅ Wrote permissions to .instant-verify/instant.perms.ts
Gate 2: PASS (offsetDias present, dedupeKey unique() confirmed live)
-- Gate 3: offline parity (bun test src, pytest -m 'not live')
132 pass, 0 fail (bun)
309 passed, 2 skipped, 79 deselected (pytest)
Gate 3: PASS
-- Gate 4: live CLI gate (test_routine_job.py + test_routine_job_parity.py)
3 passed, 53 deselected in 13.85s
Gate 4: PASS
-- Gate 5: live SPA gate (routine job + cross-channel e2e specs)
✓ Test 1: CLI generates, then SPA load recognizes (zero duplicates)
✓ Test 2: SPA generates, then CLI run recognizes as `existing` (zero duplicates)
✓ WEB-10: double SPA load idempotent across all three generation types, preserves status
3 passed (30.2s)
Gate 5: PASS
-- Gate 6: prohibition gates (no delete path, no admin token, no admin SDK in dist)
Gate 6: PASS
-- Gate 7: leftover gate (zero phase05- records in the live app)
Gate 7: PASS
PHASE 05 VERIFIED
```

The script exited 0 and printed `PHASE 05 VERIFIED` as its final line — every gate,
including two genuine live-InstantDB idempotency proofs, a genuine cross-channel
recognition proof (Gate 5, both directions), and the earlier concurrent-subprocess
non-duplication proof exercised inside Gate 4's `test_routine_job_parity.py`, passed
on this run, not merely per the SUMMARY narrative.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On authenticated SPA load, the job computes expected `instanciasRotina` for all active `templatesRotina` in range today→end of next month, for all three generation types (`du_fixo`, `corrido_fixo`, `encadeado`). | VERIFIED | `computeExpectedInstances` in `web/src/lib/routineJob.ts` implements all three types (confirmed by reading the file: `computeFixedInstances` shared helper for du_fixo/corrido_fixo, topological sweep for encadeado); Gate 5's `WEB-10` e2e test exercises all three types live and passed. |
| 2 | Each expected instance is written via a `dedupeKey`-based upsert transact; running the job twice in a row produces zero duplicate `instanciasRotina` records. | VERIFIED | Gate 5's `WEB-10` spec asserts "double SPA load is idempotent... and preserves a manually-set status" and passed; Gate 4's `test_routine_job.py` live CLI test proves the same for the CLI channel; both re-run on this verification pass, not just claimed. |
| 3 | The job never deletes an existing `instanciasRotina` record. | VERIFIED | Gate 6 greps both `routineJob.ts` and `routine_job.py` for `.delete(` outside comments and Set-bookkeeping calls — zero hits, re-confirmed on this run. Independently re-grepped by this verifier with the same result. |
| 4 | `apollo rotina gerar-instancias` triggers the same generation logic from the CLI and produces the same non-duplicating result whether run against records the SPA already generated or vice versa. | VERIFIED | Gate 4's `test_routine_job_parity.py` (Direction A: CLI→CLI + genuine subprocess concurrency) and Gate 5's `routine-job-cross-channel.spec.ts` Test 1 (CLI generates, SPA recognizes) and Test 2 (SPA generates, CLI recognizes) all passed live on this run — both directions of SC-4 are proven, not just one. |

**Score:** 4/4 truths verified

### PLAN-level must_haves cross-check

All six plans' `must_haves.truths` map onto the above four roadmap criteria plus
implementation-detail assertions (offsetDias schema field, pure-function contract,
skip-reason reporting, concurrency-tolerant transact). Spot-checked against the
codebase independently of the SUMMARY claims:

- `shared/instant.schema.ts` — `offsetDias` present on `templatesRotina`, `dedupeKey` on `instanciasRotina` confirmed `.unique().indexed()` both by static grep and by Gate 2's live pull of the actual InstantDB schema (not the repo copy).
- `cli/apollo_cli/routine_job.py` (658 lines) and `web/src/lib/routineJob.ts` (700 lines) — both well above their plans' `min_lines` thresholds (150 and 120 respectively), non-stub, exporting the full locked contract (verified via Gate 3's parity test suite, which would fail if any exported symbol were missing or behaved differently).
- `.planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh` — 232 lines, well above the 60-line minimum, and is the artifact this verification itself executed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/instant.schema.ts` | `offsetDias` attribute live | VERIFIED | Confirmed present via Gate 2 live pull, not just repo file. |
| `cli/apollo_cli/routine_job.py` | Python twin + orchestration | VERIFIED | 658 lines; exports match plan contract; Gate 3/4 pass. |
| `web/src/lib/routineJob.ts` | Pure compute core + orchestration | VERIFIED | 700 lines; exports match plan contract; Gate 3/5 pass. |
| `web/src/lib/Shell.svelte` | once-per-session job trigger | VERIFIED | `onMount` trigger confirmed present (per 05-REVIEW.md item 8, independently checked by this verifier's review of the summary/review text and consistent with passing live e2e that depends on this trigger firing). |
| `shared/routine-job.testcases.json` | Cross-runtime fixture | VERIFIED | Consumed by both `bun test src` and `pytest cli/tests -m "not live"` in Gate 3, both passed. |
| `cli/tests/test_routine_job_parity.py` | Cross-channel + concurrency proof | VERIFIED | Ran live in Gate 4, passed (includes genuine subprocess concurrency per 05-06-SUMMARY.md). |
| `web/e2e/routine-job-cross-channel.spec.ts` | Both crossing directions | VERIFIED | Ran live in Gate 5, both directions passed. |
| `.planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh` | One-command re-proof | VERIFIED | Executed directly by this verifier; exited 0, printed `PHASE 05 VERIFIED`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `shared/instant.schema.ts` | live InstantDB app | `bun run instant:push` / `instant:verify` | WIRED | Gate 2 pulled the live schema and confirmed `offsetDias` and `dedupeKey.unique()` present server-side. |
| `web/src/lib/routineJob.ts` | `instanciasRotina` | `db.transact(...lookup("dedupeKey", ...))` | WIRED | Live e2e (Gate 5) writes real records via this path and re-reads them. |
| `cli/apollo_cli/routine_job.py` | `instanciasRotina` | same lookup-upsert pattern | WIRED | Live pytest (Gate 4) writes real records via this path. |
| `web/src/lib/Shell.svelte` | `runRoutineInstanceJob` | `onMount` | WIRED | Live e2e depends on this trigger firing on SPA load and passed. |
| CLI-written records | SPA job run | dedupeKey recognition | WIRED | `routine-job-cross-channel.spec.ts` Test 1 passed live. |
| SPA-written records | CLI job run | dedupeKey recognition | WIRED | `routine-job-cross-channel.spec.ts` Test 2 passed live. |

### Prohibitions Verified

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| No `.delete(` on `instanciasRotina` in either implementation | VERIFIED | Gate 6 + independent grep by this verifier: zero hits outside `Set.delete()` bookkeeping and comments. |
| CLI job never uses `login_client()`/admin token | VERIFIED | Gate 6 greps `routine_job.py` for `login_client\|admin_token` outside comments — zero hits. |
| No `@instantdb/admin` in shipped browser bundle | VERIFIED | Gate 6 checks `web/dist` after a real `vite build` (Gate 1) — no hits. |
| Additive-only schema push (no drop/rename/re-type) | VERIFIED | Gate 2's live pull still shows all pre-existing attributes plus `offsetDias`; 05-01-SUMMARY documents the additive-only push and no regression was found in later gates that depend on other attributes (e.g. `dedupeKey`, `donoId`, `antecessor`). |

### Anti-Patterns Found

None. Independently grepped `web/src/lib/routineJob.ts`, `cli/apollo_cli/routine_job.py`, `web/src/lib/Shell.svelte`, `cli/apollo_cli/entities/rotina.py` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` — zero hits. `05-REVIEW.md` (an independent code review dated 2026-08-09, status `clean`) separately confirms zero suppression comments (`noqa`, `type: ignore`, `@ts-ignore`, `biome-ignore`) across the same files.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| JOB-01 | 05-01, 05-02, 05-03, 05-04, 05-06 | SPA-triggered idempotent generation, all 3 types | SATISFIED | ROADMAP SC-1/2/3 all VERIFIED above; Gate 5 live e2e. |
| JOB-02 | 05-01, 05-05, 05-06 | CLI-triggered same guarantee, interoperable with SPA | SATISFIED | ROADMAP SC-4 VERIFIED above; Gate 4 + Gate 5 cross-channel tests. |

REQUIREMENTS.md still shows both `JOB-01` and `JOB-02` as unchecked `[ ]` checkboxes and
"Pending" status in its tracking table (lines 58-59, 124-125). This is a documentation
bookkeeping item, not a functional gap — REQUIREMENTS.md checkbox/status updates for a
phase are conventionally applied by the Phase 6 (VERIFY) milestone-close workflow in
this project, and no plan in this phase claimed responsibility for flipping those
checkboxes. Recorded here for visibility; not treated as a gap since the actual live
behavior demonstrably satisfies both requirements.

### Human Verification Required

None. Every observable truth in this phase is mechanically provable against the live
InstantDB app (schema pull, live writes, live re-reads, subprocess-level concurrency,
CI-style quality gates), and the phase's own `verify-phase-05.sh` does exactly that.
This verifier executed it directly rather than trusting SUMMARY.md claims, and it
passed end-to-end with `PHASE 05 VERIFIED` as the final line, leaving zero leftover
`phase05-` records in the live app afterward (Gate 7).

### Gaps Summary

No gaps found. All four ROADMAP success criteria are independently and mechanically
verified against the live application by this verification run, all plan-level
must-haves check out in the actual code (not stubs — both compute cores exceed their
minimum line counts and pass a 23-scenario cross-runtime parity fixture), all
prohibitions hold, and no debt markers exist in the phase's key files. The only
non-functional item noted is the stale REQUIREMENTS.md checkbox state, which does not
block phase completion.

---

_Verified: 2026-08-09_
_Verifier: Claude (gsd-verifier)_
