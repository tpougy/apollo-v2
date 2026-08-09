---
status: clean
phase: 05-idempotent-routine-instance-job
reviewed: 2026-08-09
depth: standard
---

# Phase 5 Code Review: Idempotent Routine-Instance Job

## Scope

Reviewed the dual-channel (TypeScript + Python) idempotent routine-instance generation job:

- `web/src/lib/routineJob.ts` (pure compute core + I/O orchestration)
- `cli/apollo_cli/routine_job.py` (Python twin)
- `web/src/lib/Shell.svelte` (SPA trigger)
- `cli/apollo_cli/entities/rotina.py` (CLI trigger + guardrails against hand-created instances)
- `web/src/lib/entities/defs/templatesRotina.ts`, `shared/instant.schema.ts` (schema/link shape)
- `shared/routine-job.testcases.json` (cross-runtime fixture, 23 scenarios)
- 05-04-SUMMARY.md / 05-05-SUMMARY.md (documented deviations)

Also ran both fixture-parity suites live rather than trusting the summaries' claims:

- `uv run pytest tests/test_routine_job.py -m "not live" -q` → 53 passed
- `bun test src/lib/routineJob.test.ts` → 53 pass, 0 fail

## Correctness Checks (all PASS)

1. **No `.delete(` on `instanciasRotina` anywhere.** Grepped both files; the only `.delete(` hits are `pendingIds.delete(template.id)` (a `Set.delete`, unrelated to InstantDB), and the only `.create(`/`.delete(`-shaped text is prose in comments describing what the code *doesn't* do. No live delete call exists in either implementation.

2. **`dedupeKey` excluded from the update payload in both implementations.** TS `chunks` (routineJob.ts:653-664) sets `dataPrevista`/`competencia`/`tipoPrazo`/`status`/`donoId`/optional `dataPrevistaEstimada` — never `dedupeKey`; the key is supplied only via the `lookup("dedupeKey", e.dedupeKey)` sentinel. Python's `_upsert_fields` (routine_job.py:535-545) mirrors this exactly, and the module docstring explicitly documents this as a fix for 05-03's live-discovered bug (re-including `dedupeKey` in the payload caused InstantDB to reject the write).

3. **`antecessor` self-link genuinely selected in both live queries.** TS: `templatesResult` query includes `antecessor: {}` (routineJob.ts:585). Python: `_query_active_templates` includes `"antecessor": {}` (routine_job.py:472-477). Both also widen the existing-instances lookup to the union of active template ids + antecessor ids (routineJob.ts:598-602, routine_job.py:596-600), covering the case where an antecessor is inactive. This was a documented live-discovered bug in 05-04 (missing `antecessor: {}` caused every encadeado template to report `antecessor_ausente`); the fix is present and verified by the fixture/live evidence in the SUMMARY.

4. **TS/Python compute cores are semantically identical for all three types.** Side-by-side comparison of `nthBusinessDayOfMonth`/`nth_business_day_of_month`, `nthCalendarDayOfMonth`/`nth_calendar_day_of_month`, `shiftCompetencia`/`shift_competencia`, `computeFixedInstances`/`_compute_fixed_instances`, and the encadeado topological sweep (`computeExpectedInstances` pass 2 vs. `compute_expected_instances` pass 2) show line-for-line equivalent logic: same range/candidate-month construction, same D-05-B/D-05-D/D-05-E/D-05-F handling (business-day offset from antecessor's planned date, inherited competencia, `dataPrevistaEstimada` iff unpersisted-or-not-concluida), same bounded sweep (`pass < templates.length` / `range(len(templates))`), same "ready the instant antecessor id leaves pendingIds" resolution order, same dangling-antecessor-resolves-as-`antecessor_sem_instancia` semantics. Both were independently re-run against the shared 23-scenario/21-dayMath fixture during this review and passed 53/53 on each side.

5. **`corrido_fixo` day-clamping verified correct in both.** `nthCalendarDayOfMonth`/`nth_calendar_day_of_month` clamp via `Math.min(n, lastDay)` / `min(n, last_day)` using `Date.UTC(year, month, 0)` / `calendar.monthrange` respectively — both leap-year-safe without hand-rolled leap logic. Confirmed against the fixture's own edge-case scenarios: `offsetDias=31` in February (non-leap 2026) clamps to `2026-02-28` while March (31-day month) does not clamp (`2026-03-31`); `offsetDias=31` in a 30-day month (April) clamps to `2026-04-30` while May correctly reaches `2026-05-31` and is deliberately left un-snapped even landing on a Sunday (proving `corrido_fixo` never business-day-snaps, matching the type's contract).

6. **Existing dedupeKeys are queried before any write — no blind upsert.** Step 2 (`existingResult`/`_query_existing_instances`) runs before Step 3 (compute) and Step 4 (diff via `existingKeys`/`existing_keys` set), which filters `toCreate`/`to_create` to only never-before-seen dedupeKeys. An already-present key never appears in the transact payload at all, so there is no code path capable of resetting a `status` on an already-completed instance. This is structural, not just tested-for: the diff happens client-side against a real prior read, not "let the DB dedupe."

7. **No suppression comments found.** Grepped `routineJob.ts`, `routine_job.py`, `Shell.svelte`, `templatesRotina.ts`, `rotina.py` for `noqa`, `type: ignore`, `@ts-ignore`, `biome-ignore` — zero hits.

8. **`Shell.svelte` fires the job exactly once per authenticated session.** The trigger uses a plain non-reactive module-local `let jobStarted = false` flag guarded inside `onMount`, not a `$state`/`$effect` rune — the code comment explicitly explains why (an effect would re-fire on unrelated reactive-dependency changes; `onMount` + a plain flag gives "once per mount," and `Shell.svelte` itself only mounts once per authenticated session per the `<SignedIn>` gating in `App.svelte`). The async job body is further gated on `await db.getAuth()` returning a user before calling `runRoutineInstanceJob`, and failures are caught and logged rather than thrown, so a failed job run never breaks the rest of the UI.

## Additional Observations (non-blocking)

- The concurrency-tolerant catch/re-query path (Step 6, both implementations) correctly distinguishes "lost a race, all keys now exist" (reported as `existing`, not an error) from "genuine failure" (re-raised) — same shape in both languages.
- The `instancia` CLI group intentionally has no `criar`/`deletar` subcommands, and `rotina.py`'s docstring explains why (protects the `dedupeKey` invariant from hand-created/re-dated records) — consistent with the job being described as the *only* sanctioned creator of `instanciasRotina`.
- The Python `_validate_offset_dias` correctly excludes `bool` via `isinstance(offset_dias, bool)` before the `isinstance(..., int)` check (Python's `bool` is an `int` subclass) — a real, easy-to-miss pitfall that was handled correctly.
- `dedupeKey` is deliberately plain string concatenation, not a hash, with the actual uniqueness guarantee living in the InstantDB schema (`instanciasRotina.dedupeKey.unique().indexed()`, confirmed present in `shared/instant.schema.ts:74`) rather than in the application layer — documented consistently across both modules' docstrings and the top-level README.

## Verdict

No correctness, security, or code-quality issues found. All eight focus checks pass with direct evidence from the source (not just from trusting the SUMMARY narratives), and the two live-discovered bugs documented in 05-04/05-05 (antecessor query omission, dedupeKey-in-payload) are both genuinely fixed in the current code, not just claimed fixed.
