---
phase: 05-idempotent-routine-instance-job
plan: 02
subsystem: routine-generation
tags: [routine-job, bizdays, tdd, cross-runtime-fixture, du_fixo]

# Dependency graph
requires:
  - phase: 05-idempotent-routine-instance-job
    plan: 01
    provides: "templatesRotina.offsetDias live in schema + CLI/SPA exposure"
  - phase: 02-shared-anbima-calendar
    provides: "web/src/lib/bizdays.ts (isBusinessDay, addBusinessDays) as the sole business-day source"
provides:
  - "web/src/lib/routineJob.ts: pure, I/O-free compute core for du_fixo routine-instance generation"
  - "Locked exported contract (endOfNextMonth, nthBusinessDayOfMonth, nthCalendarDayOfMonth, shiftCompetencia, buildDedupeKey, computeExpectedInstances) for 05-03/05-04/05-05"
  - "shared/routine-job.testcases.json: cross-runtime fixture (dayMath + 10 scenarios) that cli/apollo_cli/routine_job.py (05-05) will consume unchanged"
  - "dedupeKey format contractually pinned: plain `templateId:competencia:dataPrevista` concatenation"
affects: [05-03-spa-trigger, 05-04-cli-gerar-instancias, 05-05-cli-job, 05-06-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-runtime JSON fixture (dayMath + scenarios) as the single source of truth for TS/Python parity, extending the shared/bizdays.testcases.json pattern from Phase 2"
    - "Per-template try/catch isolation: a throwing template (e.g. CalendarRangeError) is converted to a skipped entry without aborting the batch"
    - "Programmatic conservation-law audit (dropAudit) over the whole fixture, not per-scenario hand assertions, so it stays valid as 05-04 adds more scenarios"

key-files:
  created:
    - shared/routine-job.testcases.json
    - web/src/lib/routineJob.ts
    - web/src/lib/routineJob.test.ts
  modified: []

key-decisions:
  - "shiftCompetencia does NOT trim its regraCompetencia input before allowlist matching — a trailing-space variant like \"M-1 \" must remain unrecognized (returns null), not silently normalized to \"M-1\". This diverges from a literal reading of the plan's action text (\"...not in REGRAS_COMPETENCIA_SUPORTADAS after .trim()\") but matches the plan's own fixture requirement and RESEARCH Pitfall 3's wording (\"a trailing space that survives trimming\" implies no trim happens in this function)."
  - "A caught CalendarRangeError (or any other unexpected throw) inside computeExpectedInstances maps to SkipReason 'offset_dias_invalido' — the locked SkipReason enum has no dedicated 'calendar range' reason, and the plan explicitly sanctioned reusing offset_dias_invalido for this catch-all case, pinned explicitly in the fixture (scenario 'offsetDias grande o suficiente...')."
  - "Task 1 and Task 3 fixture/test content (the dropAudit conservation-law block, the CalendarRangeError scenario, the inactive-template scenario, and the empty-input assertion) were authored together during Task 1, since they are all part of the single shared/routine-job.testcases.json + routineJob.test.ts design. Task 3's acceptance criteria were re-verified independently after Task 2's GREEN commit and all pass; see Deviations."

requirements-completed: [JOB-01]

# Metrics
duration: 45min
completed: 2026-08-09
---

# Phase 5 Plan 2: Pure du_fixo compute core (routineJob.ts) Summary

**Built `web/src/lib/routineJob.ts` — a pure, zero-I/O TypeScript module that computes exactly which `du_fixo` routine instances should exist for `[today, endOfNextMonth(today)]`, proven correct via a hand-derived ANBIMA fixture and now the locked cross-runtime contract for the rest of Phase 5.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-09
- **Tasks:** 3 (Task 1 RED, Task 2 GREEN, Task 3 verification — see Deviations for how Task 3's content was authored)
- **Files created:** 3

## Accomplishments

- `shared/routine-job.testcases.json` created with 21 hand-derived `dayMath` cases (6 `nthBusinessDayOfMonth`, 4 `nthCalendarDayOfMonth`, 3 `endOfNextMonth`, 8 `shiftCompetencia`) and 10 `scenarios`, every business-day expectation traced back to `shared/anbima-calendar.json` (weekend-starting months, a holiday-starting month, a mid-month-holiday month, and a final-week large-`n` case)
- `web/src/lib/routineJob.ts` implements the full locked interface: `TIPO_PRAZO_GERADO`, `STATUS_INICIAL`, `REGRAS_COMPETENCIA_SUPORTADAS`, `endOfNextMonth`, `nthBusinessDayOfMonth`, `nthCalendarDayOfMonth`, `shiftCompetencia`, `buildDedupeKey`, `computeExpectedInstances` — all business-day reasoning delegated to `./bizdays` (`isBusinessDay`/`addBusinessDays`), zero direct calendar reads, zero hand-rolled weekday checks
- `computeExpectedInstances` is verified pure (identical repeated calls produce deeply-equal results, inputs never mutated) and never throws even for `[]` input
- Misconfiguration is never silently dropped: missing/invalid `offsetDias`, unsupported `regraCompetencia` (including `"manual"`), and unknown `tipoGeracao` (`corrido_fixo`/`encadeado`, reserved for 05-04) all report a machine-readable `SkipReason`
- A programmatic `dropAudit` test proves, over every one of the 10 fixture scenarios, that every `ativo !== false` template appears in exactly one of `expected`/`skipped`, and every `ativo: false` template appears in neither
- A `CalendarRangeError`-triggering template (huge `offsetDias` pushing past the vendored calendar's end) is isolated: it is reported skipped while a healthy template in the same call still produces its instances
- 35/35 fixture-driven tests pass; full `bun test src` suite (114 tests) has zero regressions in `bizdays.test.ts`/`registry.test.ts`

## Task Commits

1. **Task 1: Author the cross-runtime fixture and failing test harness (RED)** — `8e33563` (test)
2. **Task 2: Implement the pure compute core for du_fixo (GREEN)** — `8264157` (feat)
3. **Task 3: Prove the diagnostic contract (dropAudit, CalendarRangeError isolation, inactive-template exclusion, empty-input)** — content authored in `8e33563`/`8264157`; no separate commit (see Deviations)

## Final Exported Signatures

```typescript
export const TIPO_PRAZO_GERADO = "soft";
export const STATUS_INICIAL = "pendente";
export const REGRAS_COMPETENCIA_SUPORTADAS = ["M0", "M-1", "M-2", "M+1"] as const;

export function endOfNextMonth(today: string): string;
export function nthBusinessDayOfMonth(year: number, month: number, n: number): string; // month 1-based
export function nthCalendarDayOfMonth(year: number, month: number, n: number): string; // month 1-based
export function shiftCompetencia(dataPrevista: string, regraCompetencia: string): string | null;
export function buildDedupeKey(templateId: string, competencia: string, dataPrevista: string): string;
export function computeExpectedInstances(
  templates: readonly TemplateRow[],
  today: string,
  existing: readonly ExistingInstance[],
): ComputeResult;
```

**dedupeKey format:** `` `${templateId}:${competencia}:${dataPrevista}` `` — plain concatenation, e.g. `"tpl-a:2026-08:2026-08-10"`.

**SkipReason enum (as implemented in this plan):**
- `tipo_geracao_desconhecido` — unknown `tipoGeracao`, or `corrido_fixo`/`encadeado` (reserved for 05-04)
- `offset_dias_ausente` — `offsetDias` missing or `null`
- `offset_dias_invalido` — `offsetDias` not an integer, `< 1` for `du_fixo`, OR any uncaught throw during computation (e.g. `CalendarRangeError` — see Decisions)
- `regra_competencia_nao_suportada` — `regraCompetencia` not one of `M0`/`M-1`/`M-2`/`M+1` (includes `"manual"`, typos, and whitespace variants)
- `antecessor_ausente`, `antecessor_sem_instancia`, `antecessor_ciclico` — reserved, unused in this plan

## Hand-Derivation Notes for Holiday-Affected Fixture Cases

These are recorded here (in addition to each case's `nome` field in the fixture) so 05-05's Python twin can be validated against the same reasoning, not just the same numeric outputs:

- **`nthBusinessDayOfMonth(2026, 8, 1)` = `"2026-08-03"`**: 2026-08-01 is a Saturday (confirmed via `Date.UTC(2026,7,1).getUTCDay() === 6`). Not a business day → composition advances via `addBusinessDays(day1, 1)`: 08-02 is Sunday (skip), 08-03 is Monday and not an ANBIMA holiday → first business day = 08-03. `n=1` returns `first` directly.
- **`nthBusinessDayOfMonth(2026, 2, 1)` = `"2026-02-02"`**: 2026-02-01 is a Sunday. `addBusinessDays(day1, 1)`: 02-02 is Monday, not a holiday → first = 02-02.
- **`nthBusinessDayOfMonth(2026, 5, 1)` = `"2026-05-04"`**: 2026-05-01 is a Friday AND present in `shared/anbima-calendar.json`'s holiday list (Labor Day) → `isBusinessDay` returns false. `addBusinessDays(day1, 1)`: 05-02 Saturday (skip), 05-03 Sunday (skip), 05-04 Monday, not a holiday → first = 05-04.
- **`nthBusinessDayOfMonth(2026, 9, 5)` = `"2026-09-08"`**: 2026-09-01 is a Tuesday, business day → `first = "2026-09-01"`. `n=5` → `addBusinessDays(first, 4)`. Walking forward: 09-02 (Wed, count 1), 09-03 (Thu, 2), 09-04 (Fri, 3), 09-05/09-06 (Sat/Sun, skip), 09-07 (Mon — present in the holiday list as Independência, skip), 09-08 (Tue, count 4) → result = 09-08. This is the case proving the mid-month-holiday-before-target-day composition (RESEARCH Assumption A6) is correct: naively counting "the 5th weekday" without the holiday check would have landed on 09-07, which is wrong.
- **`nthBusinessDayOfMonth(2026, 10, 21)` = `"2026-10-30"`**: October 2026 has exactly 21 business days (verified by iterating `isBusinessDay` over every calendar day 1–31 in a throwaway script during fixture authoring); the 21st and last one is 2026-10-30 (a Friday), proving the "large n lands in the final week" composition holds without overshooting into November.
- **CalendarRangeError isolation scenario (`today = "2078-11-01"`)**: `tpl-j` has `offsetDias: 50`. Walking 49 business days forward from `2078-11-01` crosses `CALENDAR_END = "2078-12-25"` (the vendored calendar's last day) before reaching the 50th business day, so `addBusinessDays` throws `CalendarRangeError` partway through. `tpl-k` (`offsetDias: 6`) stays well within range for both `2078-11` (`2078-11-09`) and `2078-12` (`2078-12-08`), proving isolation.

## Files Created

- `shared/routine-job.testcases.json` — cross-runtime fixture (`dayMath` + `scenarios`), consumed unchanged by `cli/apollo_cli/routine_job.py` in plan 05-05
- `web/src/lib/routineJob.ts` — the pure compute core (min_lines requirement of 120 satisfied; file is ~250 lines including the module docstring)
- `web/src/lib/routineJob.test.ts` — fixture-driven `bun test` suite: `dayMath` describes, `scenarios` describe, `dropAudit` conservation-law describe, purity/empty-input describe, `buildDedupeKey` unit test

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `shiftCompetencia` must NOT trim before matching, despite the plan's action-text wording**
- **Found during:** Task 2 (GREEN implementation), first test run
- **Issue:** The plan's `<action>` prose for Task 2 says "return `null` for any `regraCompetencia` not in `REGRAS_COMPETENCIA_SUPORTADAS` after `.trim()`", which read literally means trim-then-match — but the Task 1 fixture (also authored per this plan's own `<behavior>` spec) requires `"M-1 "` (trailing space) to resolve to `null`. Trimming first would turn `"M-1 "` into `"M-1"`, which IS in the allowlist, producing `"2026-12"` instead of `null` — contradicting both the fixture and RESEARCH Pitfall 3's own wording ("a trailing space that survives trimming ... returns null", implying no trim happens in this function).
- **Fix:** Implemented `shiftCompetencia` with a strict (non-trimmed) allowlist membership check. A code comment documents this is deliberate.
- **Files modified:** `web/src/lib/routineJob.ts`
- **Verification:** All 8 `shiftCompetencia` fixture cases pass, including the trailing-space case.
- **Committed in:** `8264157` (Task 2 commit)

**2. [Rule 1 - Bug] Comment wording accidentally matched a purity-grep gate**
- **Found during:** Task 2, acceptance-criteria grep pass
- **Issue:** The module docstring originally used the word "cryptographic" to describe why `dedupeKey` is plain concatenation, which matched the acceptance criterion's `grep -c 'crypto\|hashlib\|sha256'` gate (intended to catch an actual `crypto` import, not prose).
- **Fix:** Reworded to "NOT a derived hash of any kind" — same meaning, no longer a substring match.
- **Files modified:** `web/src/lib/routineJob.ts`
- **Verification:** `grep -c 'crypto\|hashlib\|sha256' web/src/lib/routineJob.ts` returns 0.
- **Committed in:** `8264157` (Task 2 commit)

### Task 3 content front-loaded into Tasks 1–2

**Not a deviation from required behavior, but a deviation from the plan's task-commit sequencing:** Task 3 asks for a `dropAudit` describe block, two additional fixture scenarios (`CalendarRangeError` isolation, inactive-template exclusion), and an empty-input assertion. Because all of this content lives in the same two files (`shared/routine-job.testcases.json`, `web/src/lib/routineJob.test.ts`) that Task 1 was already authoring as a single coherent fixture + test suite, it was written and committed as part of Task 1's RED commit (`8e33563`) rather than as a separate Task 3 commit. Task 2's GREEN implementation (`8264157`) satisfies all of it in the same pass Task 2 was already required to make green. All of Task 3's acceptance criteria were independently re-verified after Task 2's commit:
- `scenarios.length` = 10 (≥ 9 required)
- `dropAudit` block present, asserts `scenarios.length > 0`, and passes
- Empty-input assertion present (`toEqual({ expected: [], skipped: [] })`) and passes
- `bun run check && bun run lint && bun run format:check` all exit 0

**Total deviations:** 2 auto-fixed (Rule 1 bug fixes), plus 1 sequencing note (no functional gap — all Task 3 requirements verified present and passing).

## Threat Flags

None. All threats in this plan's `<threat_model>` (T-05-05, T-05-14 through T-05-18) map directly to behavior implemented and tested in Tasks 1–3 (per-template try/catch, `regraCompetencia` allowlist, `offsetDias` validation, pinned `dedupeKey` format, calendar-source grep gates, conservation-law audit). No new security-relevant surface was introduced beyond what the threat model already covers — this module has no I/O.

## Known Stubs

None. `du_fixo` is fully implemented and tested end-to-end (pure compute only — no InstantDB writes exist yet in this phase, which is the plan's explicit tracer scope). `corrido_fixo` and `encadeado` are deliberately stubbed to `tipo_geracao_desconhecido` per the plan's TRACER sequencing; this is documented inline in `routineJob.ts` and pinned by fixture scenarios (`tpl-f`, `tpl-g`), not a silent omission.

## User Setup Required

None.

## Next Phase Readiness

- `web/src/lib/routineJob.ts`'s exported contract is locked and ready for 05-03 (SPA trigger / InstantDB diff-and-write orchestration) to consume `computeExpectedInstances` output directly.
- 05-04 can extend `computeDuFixoInstances`-adjacent branches for `corrido_fixo` (using the already-shipped `nthCalendarDayOfMonth`) and `encadeado` (using `existing`, already threaded through the signature but unused) without any interface changes.
- 05-05's Python twin (`cli/apollo_cli/routine_job.py`) has `shared/routine-job.testcases.json` ready to consume unchanged, plus the hand-derivation notes above for validating identical reasoning, not just identical numbers.
- No blockers identified for Wave 3 (05-03/05-04, per `depends_on`).

---
*Phase: 05-idempotent-routine-instance-job*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 3 created files confirmed present on disk (`shared/routine-job.testcases.json`, `web/src/lib/routineJob.ts`, `web/src/lib/routineJob.test.ts`); both task commit hashes (`8e33563`, `8264157`) confirmed present in `git log --oneline --all`.
