---
phase: 05-idempotent-routine-instance-job
plan: 03
subsystem: routine-generation
tags: [instantdb, routine-job, playwright-e2e, idempotency, du_fixo, lookup-upsert]

# Dependency graph
requires:
  - phase: 05-idempotent-routine-instance-job
    plan: 01
    provides: "templatesRotina.offsetDias live in schema + CLI/SPA exposure"
  - phase: 05-idempotent-routine-instance-job
    plan: 02
    provides: "web/src/lib/routineJob.ts pure compute core (computeExpectedInstances, buildDedupeKey, etc.)"
provides:
  - "runRoutineInstanceJob: full query -> compute -> diff -> lookup-upsert orchestration against live InstantDB"
  - "Shell.svelte onMount trigger firing the job once per authenticated SPA session"
  - "Live e2e proof (web/e2e/routine-job.spec.ts) that a double SPA load produces zero duplicate instanciasRotina and preserves a manually-set 'concluida' status"
  - "listInstancesByTemplate / deleteInstancesByTemplate admin-only test fixture helpers"
affects: [05-04-cli-gerar-instancias, 05-05-cli-job, 05-06-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "I/O boundary section comment splitting a pure compute core from its live orchestration in the same file, so the split stays legible for the Python twin (05-05) to mirror"
    - "Lookup-keyed upsert transact where the payload deliberately omits the looked-up unique attribute itself (InstantDB rejects re-setting the lookup attribute on the create path)"
    - "Concurrency-tolerant transact: catch, re-query the exact attempted dedupeKeys, treat 'all now exist' as a lost race (report as existing) rather than crash or retry"
    - "data-job-state hidden div as a Playwright-observable completion signal for a fire-and-forget onMount side effect, avoiding fixed-sleep flakiness"

key-files:
  created:
    - web/e2e/routine-job.spec.ts
  modified:
    - web/src/lib/routineJob.ts
    - web/src/lib/routineJob.test.ts
    - web/src/lib/Shell.svelte
    - web/e2e/fixtures/instancia-admin-fixture.ts

key-decisions:
  - "The lookup-upsert payload must NOT include the looked-up attribute (dedupeKey) itself. Live testing against the real InstantDB app surfaced the server error 'Updates with lookups can only update the lookup attribute if an entity with the unique attribute value already exists' when dedupeKey was included in the .update() body on the create path — lookup() already sets it. This matches RESEARCH Pattern 1's own example (which never included dedupeKey in the payload) but diverged from a literal first-pass reading of the interface block; fixed and documented as a deviation."
  - "jobStarted guard in Shell.svelte is a plain non-reactive `let`, not `$state`, and the trigger uses `onMount` with no `$effect` anywhere — verified by grep gates so the job cannot be accidentally re-triggered by a reactive dependency change."
  - "The e2e spec recomputes each server record's expected dedupeKey from that record's OWN normalized fields (`${templateId}:${competencia}:${dataPrevista}`) rather than trusting the compute core's fixture — proving the format contract holds through a real round trip, not just in unit tests."

requirements-completed: [JOB-01]

# Metrics
duration: 70min
completed: 2026-08-09
---

# Phase 5 Plan 3: Live InstantDB orchestration + double-run idempotency proof Summary

**Wired the pure `du_fixo` compute core to the live InstantDB app via a query -> diff -> lookup-upsert `runRoutineInstanceJob`, triggered once per authenticated SPA mount from `Shell.svelte`, and proved against the real app that two consecutive SPA loads produce zero duplicate `instanciasRotina` and never clobber a manually-set `concluida` status.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-08-09
- **Tasks:** 3 (Task 1 TDD RED/GREEN, Task 2, Task 3), plus one live-discovered bug fix
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `web/src/lib/routineJob.ts` gained an "I/O boundary" section appended below the untouched pure core from 05-02: `toIsoDate` (mandatory `i.date()` round-trip normalization), `JobReport`, and `runRoutineInstanceJob` implementing all 7 orchestration steps from this plan's context block (short-circuit on zero templates, normalize-then-diff, lookup-upsert transact, concurrency-tolerant catch-and-re-query, zero `.delete()` anywhere)
- `Shell.svelte` now fires `runRoutineInstanceJob({ donoId: user.id })` exactly once per authenticated mount via `onMount` + a non-reactive `jobStarted` guard (no `$effect` anywhere in the file), swallowing failures behind `console.error` so a job failure never breaks rendering, and exposing completion via a hidden `data-job-state` element for Playwright determinism
- `web/e2e/routine-job.spec.ts` proves, against the REAL InstantDB app: a seeded `du_fixo` template with `--offset-dias 2` produces instances in `[today, endOfNextMonth]`; every instance's `dedupeKey` recomputes correctly from its own server-side fields; a CLI-issued `concluida` status mutation on one instance survives a second SPA load byte-identically (`dedupeKey`, `competencia`, `dataPrevista` unchanged); the id set and dedupeKey set are identical across both runs with zero duplicates
- `instancia-admin-fixture.ts` gained `listInstancesByTemplate`/`deleteInstancesByTemplate`, extending the existing TEST-ONLY admin-API rationale (instances have no delete path on any real channel by design)
- A live bug was found and fixed: InstantDB rejects a lookup-keyed `.update()` payload that also sets the looked-up attribute (`dedupeKey`) itself on the create path — the fix (drop `dedupeKey` from the payload, matching RESEARCH Pattern 1's own example exactly) was verified by re-running the full live e2e spec to a pass

## Task Commits

1. **Task 1 RED: failing tests for toIsoDate + JobReport invariant** — `66a0109` (test)
2. **Task 1 GREEN: implement runRoutineInstanceJob orchestration** — `ef77fa0` (feat)
3. **Task 2: trigger job once per authenticated SPA mount** — `e95d8b0` (feat)
4. **Live bug fix: drop dedupeKey from lookup-upsert payload** — `7d1ad1a` (fix, found during Task 3's first live run)
5. **Task 3: live double-run idempotency + status-preservation e2e proof** — `87245ca` (test)

## Files Created/Modified

- `web/src/lib/routineJob.ts` — appended the I/O-boundary orchestration section (`toIsoDate`, `JobReport`, `runRoutineInstanceJob`) below the unmodified 05-02 pure core
- `web/src/lib/routineJob.test.ts` — added `toIsoDate` unit coverage (datetime string, plain date, `null`, `undefined`) and a `JobReport` disjoint/sorted invariant test
- `web/src/lib/Shell.svelte` — added the `onMount` job trigger, `jobStarted` guard, `jobState` signal, and the `data-job-state` test hook
- `web/e2e/fixtures/instancia-admin-fixture.ts` — added `listInstancesByTemplate`/`deleteInstancesByTemplate`
- `web/e2e/routine-job.spec.ts` (new) — the live double-run idempotency + status-preservation e2e proof

## Decisions Made

See `key-decisions` in frontmatter. The most consequential: the lookup-upsert payload must never include the looked-up unique attribute itself — this was found live, not in unit tests, because the pure-compute unit tests never exercise a real InstantDB transact.

## Transact Chunk Shape (as implemented)

```typescript
db.tx.instanciasRotina[lookup("dedupeKey", e.dedupeKey)]
  .update({
    dataPrevista: e.dataPrevista,
    competencia: e.competencia,
    tipoPrazo: e.tipoPrazo,
    status: STATUS_INICIAL, // "pendente" — ONLY ever set on this create path
    donoId,
    ...(e.dataPrevistaEstimada ? { dataPrevistaEstimada: e.dataPrevistaEstimada } : {}),
  })
  .link({ template: e.templateId });
```

`dedupeKey` is deliberately absent from the payload — `lookup("dedupeKey", e.dedupeKey)` sets it implicitly on create, and re-including it in the `.update()` body caused InstantDB to reject the write with: `Validation failed for lookup: Updates with lookups can only update the lookup attribute if an entity with the unique attribute value already exists.`

## Live Round-Trip Evidence (for 05-05's Python twin)

Observed directly against the real InstantDB app during a probe run (temporary logging, reverted before commit — spec file is unchanged from its committed form):

- `dataPrevista` round-trips as a **plain `YYYY-MM-DD` string** in this environment (observed: `"2026-09-02"`, not a full ISO datetime) for a freshly-written record. `toIsoDate`'s 10-character slice is still mandatory and safe for both this shape and the datetime-suffixed shape documented in `cli/tests/test_rotina_instancia.py` (`"2026-09-10T00:00:00.000Z"`) — the slice is a no-op on an already-plain date and a correct truncation on a datetime string.
- Run 1 (seed `--offset-dias 2`, `du_fixo`, `M0`, executed on 2026-08-09): **1 instance created**, `dedupeKey = "3941fc26-...:2026-09:2026-09-02"`, `dataPrevista = "2026-09-02"` — correctly in `[2026-08-09, endOfNextMonth("2026-08-09") = 2026-09-30]` and correctly excluding an out-of-range August 2 candidate (August's 2nd business day had already passed).
- Run 2 (same template, no template/config change, one instance manually set to `concluida` via CLI between runs): **1 instance**, same id (`7e3f087e-bcd6-4c07-8c37-7d61dd8c2df2`), same `dedupeKey`, `status` read back as `concluida` — zero duplicates, zero clobbering, record count unchanged (1 == 1) with the id SET (not just count) proven identical.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lookup-upsert payload must not re-set the looked-up attribute**
- **Found during:** Task 3, first live e2e run against the real InstantDB app
- **Issue:** `runRoutineInstanceJob`'s transact chunk included `dedupeKey: e.dedupeKey` in the `.update()` payload alongside `lookup("dedupeKey", e.dedupeKey)`. InstantDB's server rejected every create-path write with `Validation failed for lookup: Updates with lookups can only update the lookup attribute if an entity with the unique attribute value already exists.` — the job silently failed on every real page load (caught by `Shell.svelte`'s try/catch and logged as `[routineJob] failed to run on mount`, so no instances were ever created).
- **Fix:** Removed `dedupeKey` from the update payload. `lookup()` already sets the lookup attribute on create; the field must not be repeated. This exactly matches RESEARCH's own Pattern 1 code example, which never included `dedupeKey` in its `.update()` body — the bug was introduced by this plan's `<interfaces>` block prose implying otherwise.
- **Files modified:** `web/src/lib/routineJob.ts`
- **Verification:** Re-ran `bun run test:e2e -g "routine job"` end-to-end against the live app; both `WEB-10` assertions (idempotency + status preservation) passed. Unit suite (`bun test src`, 119 tests) unaffected.
- **Committed in:** `7d1ad1a`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug fix)
**Impact on plan:** Essential correctness fix — without it, the job could never successfully write a single instance against the live app. No scope creep; the fix is a one-line payload change matching RESEARCH's own documented pattern.

## Issues Encountered

None beyond the deviation above, which was found and resolved within the plan's own live-verification step (Task 3), exactly as the plan's design intended (a unit-test-only implementation could not have caught this — it requires a real InstantDB transact).

## User Setup Required

None. `.env.instantdb` (InstantDB admin credentials) and the `authed` Playwright project's `storageState` were already configured from Phase 4.

## Next Phase Readiness

- `runRoutineInstanceJob` and `toIsoDate` are locked, live-verified building blocks: 05-04 (type expansion to `corrido_fixo`/`encadeado`) extends `computeExpectedInstances`'s existing branches without needing any change to this plan's I/O orchestration.
- 05-05's Python twin (`cli/apollo_cli/routine_job.py`) should mirror the corrected transact payload shape exactly (no `dedupeKey` field in the update body) and can reuse this plan's live round-trip evidence for `dataPrevista`'s observed shape.
- `data-job-state` on `Shell.svelte` is a stable, reusable hook for 05-04/05-06's extended e2e specs.
- No blockers identified for the rest of Phase 5.

---
*Phase: 05-idempotent-routine-instance-job*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 4 modified/created source files confirmed present on disk
(`web/src/lib/routineJob.ts`, `web/src/lib/Shell.svelte`,
`web/e2e/routine-job.spec.ts`, `web/e2e/fixtures/instancia-admin-fixture.ts`);
all 5 commit hashes (`66a0109`, `ef77fa0`, `e95d8b0`, `7d1ad1a`, `87245ca`)
confirmed present in `git log --oneline --all`.
