---
phase: 05-idempotent-routine-instance-job
plan: 04
subsystem: routine-generation
tags: [instantdb, routine-job, playwright-e2e, idempotency, corrido_fixo, encadeado, topological-sort]

# Dependency graph
requires:
  - phase: 05-idempotent-routine-instance-job
    plan: 02
    provides: "web/src/lib/routineJob.ts pure compute core (nthCalendarDayOfMonth, computeExpectedInstances skeleton)"
  - phase: 05-idempotent-routine-instance-job
    plan: 03
    provides: "runRoutineInstanceJob live query -> diff -> lookup-upsert orchestration, live e2e harness"
provides:
  - "computeExpectedInstances with all three generation types (du_fixo, corrido_fixo, encadeado) fully implemented"
  - "Bounded multi-pass topological sweep resolving encadeado chains of arbitrary depth, reporting cycles/dangling antecessors instead of hanging"
  - "D-05-B/D-05-D/D-05-E/D-05-F encadeado semantics recorded in the module docstring, implemented, and pinned by 19 shared/routine-job.testcases.json scenarios"
  - "runRoutineInstanceJob orchestration widened to select the antecessor self-link and cover antecessor ids in the existing-instances lookup"
  - "Three-type live e2e proof (web/e2e/routine-job.spec.ts) of double-run idempotency, including a D-05-F executable proof that a status change on an antecessor never re-keys its encadeado successor"
affects: [05-05-cli-job, 05-06-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared computeFixedInstances(template, today, rangeStart, rangeEnd, minOffsetDias, nthDayFn) factoring the range/competencia/dedupeKey/tipoPrazo tail out of du_fixo and corrido_fixo, parameterized only by the Nth-day date rule"
    - "Bounded multi-pass topological sweep (pendingIds set shrinking within and across passes, bound = templates.length) for chained-entity resolution — reusable for any future self-referential template link"
    - "Antecessor instance lookup merges this-run computed instances with persisted `existing` rows keyed by competencia, persisted taking precedence — lets an encadeado successor see either a same-call sibling's fresh output or a real database row"

key-files:
  created: []
  modified:
    - web/src/lib/routineJob.ts
    - web/src/lib/routineJob.test.ts
    - shared/routine-job.testcases.json
    - web/e2e/routine-job.spec.ts

key-decisions:
  - "D-05-B/D-05-D/D-05-E/D-05-F (see plan context) implemented literally: business-day offset from the antecessor's PLANNED date, inherited competencia regardless of the successor's own regraCompetencia, dataPrevistaEstimada tracks persisted+concluida, dedupeKey never moves when the antecessor's status changes."
  - "Cycle/dangling-antecessor detection is a single mechanism: a template is 'ready' the instant its antecessor id is no longer in the pending-encadeado id set. A dangling id (points to a template not in the active set and not in `existing`) resolves immediately as antecessor_sem_instancia — it is NOT specially routed to antecessor_ciclico, since its outcome is behaviorally identical (no instance, reported, never crashes) and the plan's own RESEARCH pseudocode does not distinguish the two cases before the sweep bound is checked."
  - "Live bug (found during Task 3, fixed before the e2e commit): the templatesRotina query never selected the antecessor self-link, so every live-fetched TemplateRow.antecessor was undefined and every encadeado template was always reported antecessor_ausente. The compute core was correct in isolation (fixture-proven) but never received live data. Fixed by adding `antecessor: {}` to the query and widening the existing-instances lookup to the union of active template ids and their antecessor ids (the encadeado 'orchestration change' the plan specified for Task 2, which was implemented in code but initially missed in the query)."
  - "Task 1 and Task 2 were committed as separate atomic commits despite being a single continuous edit to routineJob.ts: the corrido_fixo commit was produced by temporarily reconstructing the pre-encadeado state of the file (encadeado branch reverted to tipo_geracao_desconhecido, encadeado fixture scenarios removed) so its own test suite passes in isolation, then the full encadeado implementation was restored and committed second. Both intermediate and final states were independently test/lint/typecheck verified."

requirements-completed: [JOB-01]

# Metrics
duration: 95min
completed: 2026-08-09
---

# Phase 5 Plan 4: corrido_fixo + encadeado generation types Summary

**Completed all three routine-generation types by implementing `corrido_fixo` (clamped Nth-calendar-day) and `encadeado` (bounded multi-pass topological chain resolution with inherited competencia and business-day offsets), then re-proved zero-duplicate idempotency live against the real InstantDB app with all three types running together.**

## Performance

- **Duration:** ~95 min
- **Completed:** 2026-08-09
- **Tasks:** 3 (Task 1, Task 2, Task 3) + 1 live-discovered orchestration bug fix
- **Files modified:** 4 (`web/src/lib/routineJob.ts`, `web/src/lib/routineJob.test.ts`, `shared/routine-job.testcases.json`, `web/e2e/routine-job.spec.ts`)

## Accomplishments

- `corrido_fixo` implemented via a new shared `computeFixedInstances` helper (factored out of the old `computeDuFixoInstances`) parameterized by the Nth-day rule (`nthBusinessDayOfMonth` for `du_fixo`, `nthCalendarDayOfMonth` for `corrido_fixo`); everything else — range filter, competencia derivation, dedupeKey, `tipoPrazo`, per-template try/catch — is now shared code, not duplicated.
- `encadeado` implemented as a bounded multi-pass topological sweep (`pass < templates.length`) over templates whose antecessor id is still pending; resolves single-level and multi-level chains within one call, reports `antecessor_ausente` / `antecessor_sem_instancia` / `antecessor_ciclico` as distinct, non-crashing skip reasons, and never loops (grep-gated: zero `while (true)` in the file).
- D-05-B (business-day offset from the antecessor's *planned* `dataPrevista`), D-05-D (inherited competencia, `regraCompetencia` never consulted), and D-05-E (`dataPrevistaEstimada` set iff the antecessor's instance is unpersisted or not yet `concluida`) are implemented exactly as specified and documented in the module's docstring so a future reader never has to reconstruct them from the plan.
- `shared/routine-job.testcases.json` grew from 9 to 23 scenarios: 5 real `corrido_fixo` scenarios (replacing the 05-02 placeholder) covering both-months-in-range, after-the-target-day, February/leap clamp, 30-day-month clamp with a live Sunday no-snap proof, and a real ANBIMA holiday no-snap proof; 10 real `encadeado` scenarios (replacing the placeholder) covering every behavior in the plan's `<behavior>` block, including a two-level chain, a mutual-cycle blast-radius proof, three scenarios exercising the `existing` parameter, and an `offsetDias: 0` edge case.
- A live bug was found and fixed during Task 3: `runRoutineInstanceJob`'s `templatesRotina` query never selected the `antecessor` link, so every encadeado template was reported `antecessor_ausente` on every real SPA load despite the compute core being fixture-proven correct. Fixed by adding `antecessor: {}` to the query and widening the existing-instances lookup to cover antecessor ids (including inactive antecessors) — this is the "Orchestration change" the plan specified for Task 2 and had been implemented in prose but not yet wired into the live query.
- `web/e2e/routine-job.spec.ts` now seeds all three types live and proves, against the real InstantDB app: every template produces >=1 instance; every encadeado instance's competencia is one of its antecessor's own competencia values (D-05-D); every encadeado instance carries `dataPrevistaEstimada` while its antecessor is still `pendente` (D-05-E); every encadeado `dataPrevista` is strictly after its antecessor's; a second load produces zero duplicates across the whole 3-template set with the manually-`concluida` instance unchanged; and — the assertion with no unit-test equivalent — after the antecessor is marked `concluida` and the job re-runs, the encadeado successor's `dedupeKey`/`dataPrevista`/`competencia` are byte-identical (D-05-F).

## Task Commits

1. **Task 1: implement corrido_fixo** — `8b70cf7` (feat)
2. **Task 2: implement encadeado with topological resolution** — `8a973b6` (feat)
3. **Live bug fix: widen orchestration queries for encadeado antecessor resolution** — `f1c4e10` (fix, found during Task 3's first live run)
4. **Task 3: prove live double-run idempotency across all three generation types** — `1c936ea` (test)

## Files Created/Modified

- `web/src/lib/routineJob.ts` — factored `computeFixedInstances` (shared du_fixo/corrido_fixo tail); added the bounded topological sweep, `AntecessorRecord`/`lookupAntecessorInstances`/`PendingEncadeado` for encadeado; widened `runRoutineInstanceJob`'s templates query (`antecessor: {}`) and existing-instances query (union of active + antecessor ids); updated the module docstring with D-05-B/D-05-D/D-05-E/D-05-F in prose.
- `web/src/lib/routineJob.test.ts` — extended the `Scenario` interface with optional `dataPrevistaEstimada` on `expectedInstances` (already fixture-driven; no new test bodies needed beyond the existing fixture-parity loop).
- `shared/routine-job.testcases.json` — replaced both 05-02 placeholders (`corrido_fixo`, `encadeado` both previously `tipo_geracao_desconhecido`) with 15 new real scenarios; total scenario count 9 -> 23.
- `web/e2e/routine-job.spec.ts` — widened from a single `du_fixo` template to three (`du_fixo`, `corrido_fixo`, `encadeado`), added D-05-D/D-05-E/D-05-B live assertions and the D-05-F re-run proof, extended teardown ordering (encadeado deleted before its antecessor).

## Decisions Made

See `key-decisions` in frontmatter. The two most consequential:

1. **Dangling antecessor ids resolve as `antecessor_sem_instancia`, not `antecessor_ciclico`.** A template whose antecessor id points at nothing (not in the active-templates set, not in `existing`) is immediately "ready" (its id is never in the pending-encadeado set) and its instance lookup is empty — the same code path as "antecessor produced no instance." True cycles are the only case that survives to the bound and gets `antecessor_ciclico`. This wasn't spelled out as a separate case in the plan's ten behaviors, so it's documented here explicitly as the resolution.
2. **The live orchestration bug (missing `antecessor: {}` in the templates query) was a Rule 1 fix, not scope creep** — the compute core's encadeado branch was already correct and fixture-tested; the bug was purely in the I/O boundary not supplying the data the (already-correct) pure function needed. Task 3's live verification is exactly the mechanism that was designed to catch this class of bug (05-03's own precedent: the `dedupeKey`-in-payload bug was caught the same way).

## Live Round-Trip Evidence (run 1 / run 2, all three types)

Observed directly against the real InstantDB app during the live e2e run (`web/e2e/routine-job.spec.ts`, executed 2026-08-09):

- **Run 1** (three fresh `phase05-e2e-` templates: `du_fixo` offset 2, `corrido_fixo` offset 5, `encadeado` offset 2 chained off the `du_fixo` template): each template produced >=1 instance; every instance's `dedupeKey` recomputed correctly from its own known template id (`${templateId}:${competencia}:${dataPrevista}`); every encadeado instance's `competencia` matched one of the `du_fixo` antecessor's own competencia values; every encadeado instance carried `dataPrevistaEstimada` equal to its `dataPrevista` (antecessor still `pendente`); every encadeado `dataPrevista` was strictly after the earliest antecessor `dataPrevista`.
- **Mutation step:** the `du_fixo` antecessor's instance was marked `concluida` via the CLI (`apollo rotina instancia status`) between run 1 and run 2 — this is the trigger for both the classic idempotency proof and the new D-05-F proof.
- **Run 2** (same three templates, no config change): identical record count and identical id SET across all three templates combined; zero duplicate `dedupeKey`s; the mutated instance read back `concluida` with unchanged `dedupeKey`/`competencia`/`dataPrevista`; every encadeado instance's `dedupeKey`/`dataPrevista`/`competencia` were byte-identical to run 1 despite its antecessor's status having changed — the D-05-F proof that the chain is dated from the antecessor's planned date, not a moving one, and cannot be re-keyed by a downstream status change.
- Live leftovers were fully swept afterward: `apollo rotina template listar | grep -c phase05-e2e-` returns `0`.

## Skip-Reason Table (complete, with one example each)

| Reason | Generation type(s) | Example trigger |
|---|---|---|
| `tipo_geracao_desconhecido` | any | `tipoGeracao` is neither `du_fixo`, `corrido_fixo`, nor `encadeado` |
| `offset_dias_ausente` | du_fixo, corrido_fixo, encadeado | `offsetDias` is `null`/`undefined` |
| `offset_dias_invalido` | du_fixo, corrido_fixo, encadeado | `offsetDias` is non-integer, or below the type's minimum (1 for du_fixo/corrido_fixo, 0 for encadeado), or pushes the computed date past the vendored calendar's range (`CalendarRangeError`) |
| `regra_competencia_nao_suportada` | du_fixo, corrido_fixo | `regraCompetencia` is not one of `M0`/`M-1`/`M-2`/`M+1` (encadeado never hits this — D-05-D means its own `regraCompetencia` is never consulted) |
| `antecessor_ausente` | encadeado only | the template's `antecessor` self-link is `null`/absent |
| `antecessor_sem_instancia` | encadeado only | the antecessor (whether active, inactive, or a dangling/nonexistent id) has neither a computed-this-run nor a persisted instance for any competencia |
| `antecessor_ciclico` | encadeado only | the template is still unresolved after `templates.length` sweep passes — a genuine cycle (e.g. B's antecessor is C, C's antecessor is B) |

## Final Encadeado Resolution Algorithm (prose spec for 05-05's Python twin)

1. Partition active templates into non-chained (`du_fixo`/`corrido_fixo`/unknown) and `encadeado`.
2. Compute non-chained templates first, exactly as before, recording each successfully-computed template's instances in a `computedByTemplateId` map (keyed by template id) as they're produced.
3. Group all `existing` rows by `templateId` into `existingByTemplateId`, regardless of that template's own `ativo` flag (an inactive antecessor's persisted rows must still be visible).
4. Eagerly validate every active `encadeado` template: no `antecessor.id` -> skip `antecessor_ausente`; invalid `offsetDias` (must be integer >= 0) -> skip `offset_dias_ausente`/`offset_dias_invalido`. Everything else becomes "pending," tracked in a `pendingIds` set.
5. Run up to `templates.length` sweep passes. In each pass, a pending template is "ready" the instant its antecessor id is no longer in `pendingIds` (true immediately for non-chained/inactive antecessors, true for a chained antecessor once its own turn resolves — possibly within the same pass). When ready:
   - Merge `computedByTemplateId.get(antecessorId)` (this run's fresh output) with `existingByTemplateId.get(antecessorId)` (persisted rows) into a per-competencia map, persisted entries winning ties.
   - If that merged map is empty -> skip `antecessor_sem_instancia`.
   - Otherwise, for each `(competencia, antecessorRecord)`: `dataPrevista = addBusinessDays(antecessorRecord.dataPrevista, offsetDias)`; filter by `[today, endOfNextMonth(today)]`; `competencia` is inherited verbatim from `antecessorRecord`; `dataPrevistaEstimada` is set (equal to `dataPrevista`) iff `!antecessorRecord.persisted || antecessorRecord.status !== "concluida"`.
   - Record the produced instances (even if the range filter reduced them to zero) in `computedByTemplateId` so a later-chained template can build on them, and remove the template from `pendingIds`.
6. Anything still pending after the sweep bound is exhausted is either a genuine cycle or chains through a dangling antecessor that never became ready — report `antecessor_ciclico` for each.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] templatesRotina query never selected the antecessor self-link**
- **Found during:** Task 3, first live e2e run against the real InstantDB app
- **Issue:** `runRoutineInstanceJob`'s `templatesRotina` query fetched only `{ $: { where: { ativo: true, donoId } } }`, never including the `antecessor` link. Every live-fetched `TemplateRow.antecessor` was therefore `undefined`, so the (correct, fixture-tested) encadeado branch always hit the `antecessor_ausente` skip path — the live e2e's encadeado assertion failed with zero instances even though 53/53 unit tests passed.
- **Fix:** Added `antecessor: {}` to the `templatesRotina` query, and widened the existing-instances query to cover the union of active template ids and their antecessor ids (so an INACTIVE antecessor's persisted instances remain visible — this was already specified in the plan's Task 2 "Orchestration change" section but had not yet been wired into the query).
- **Files modified:** `web/src/lib/routineJob.ts`
- **Verification:** Re-ran `bun run test:e2e -g "routine job"` end-to-end against the live app; all assertions (D-05-B/D-05-D/D-05-E/D-05-F plus the classic idempotency/status-preservation proof) passed. Unit suite (`bun test src`, 132 tests) unaffected — the fix is purely an I/O-boundary query change.
- **Committed in:** `f1c4e10`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug fix)
**Impact on plan:** Essential correctness fix — without it, `encadeado` could never generate a single instance against the live app despite being fully correct in the pure compute core. No scope creep; the fix is exactly the "Orchestration change" the plan already specified for Task 2, applied where it was missing.

## Issues Encountered

None beyond the deviation above, found and resolved within Task 3's own live-verification step exactly as the plan's design intended — a unit-test-only implementation could not have caught a missing query field, since the pure compute core has no way to know the live query never populated `antecessor`.

## User Setup Required

None. `.env.instantdb` (InstantDB admin credentials) and the `authed` Playwright project's `storageState` were already configured from Phase 4 / plan 05-03.

## Next Phase Readiness

- `computeExpectedInstances` now has complete, fixture-pinned, live-proven coverage of all three generation types (`du_fixo`, `corrido_fixo`, `encadeado`) — this is the exact specification 05-05's Python twin (`cli/apollo_cli/routine_job.py`) must satisfy against the unchanged `shared/routine-job.testcases.json`.
- 05-05 should mirror the topological-sweep algorithm above (bounded at `len(templates)` passes) and the corrected orchestration query shape (antecessor link + widened existing-instances lookup) exactly.
- `web/e2e/routine-job.spec.ts` is now the reference live-proof pattern for all three types; 05-06's verification tooling can reuse its seed/assert/teardown structure directly.
- No blockers identified for the rest of Phase 5.

---
*Phase: 05-idempotent-routine-instance-job*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 4 created/modified files confirmed present on disk
(`web/src/lib/routineJob.ts`, `web/src/lib/routineJob.test.ts`,
`shared/routine-job.testcases.json`, `web/e2e/routine-job.spec.ts`);
all 4 commit hashes (`8b70cf7`, `8a973b6`, `f1c4e10`, `1c936ea`)
confirmed present in `git log --oneline --all`.
