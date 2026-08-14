---
phase: 27-robustez-do-job
plan: 02
subsystem: routine-generation-job
tags: [python, typescript, unicode-normalization, cli, instantdb]

requires:
  - phase: 27-robustez-do-job
    provides: "Plan 01's du_fixo <= 0 support and final shared/routine-job.testcases.json shape as of that plan's close (JOB-02) — this plan's mechanical fixture retrofit runs exactly once over the phase's FINAL scenario set"
provides:
  - "_is_concluida/isConcluida in routine_job.py/routineJob.ts — case/accent/whitespace-tolerant recognition of both grammatical forms of 'concluída', wired into the encadeado successor dataPrevistaEstimada decision"
  - "nome threaded through every skipped entry in both runtimes' gerar-instancias report, plus a fully-retrofitted shared/routine-job.testcases.json (every scenario's templates[]/expectedSkipped[] carry nome)"
affects: [28-periodicidade-semanal, 29-recorte-de-range]

actuals:
  tokens: 10432
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Normalized-comparison helper (_is_concluida/isConcluida) placed as a small pure predicate immediately before its single call site's enclosing function, mirroring _validate_offset_dias's existing style — NFKD decompose + combining-mark strip + casefold/toLowerCase against a tight two-literal-form Set/frozenset, never a substring/prefix match"
    - "Mechanical one-off Python transform over a shared JSON fixture (derive missing keys, preserve key order, write back with indent=2) for a purely additive contract change across every existing scenario in one pass"

key-files:
  created: []
  modified:
    - cli/apollo_cli/routine_job.py
    - web/src/lib/routineJob.ts
    - cli/apollo_cli/entities/rotina.py
    - shared/routine-job.testcases.json
    - cli/tests/test_routine_job.py
    - web/src/lib/routineJob.test.ts

key-decisions:
  - "_is_concluida/isConcluida recognizes BOTH concluida (feminine) and concluido (masculine) grammatical forms via a tight two-literal-form frozenset/Set — never a substring/prefix match, proven by a dedicated negative fixture case (plural 'concluidas' must NOT match)."
  - "status stays free text at write time (instancia status --status accepts any string verbatim) — normalization is read-only and internal to gerar-instancias's encadeado resolution, per REQUIREMENTS.md's explicit JOB-01 decision."
  - "No InstantDB query change was needed for JOB-03 — nome was already returned unrestricted by the existing template query in both runtimes (confirmed by 27-PATTERNS.md's live verification); the fix was purely _normalize_template (Python) and the TemplateRow interface (TS) not yet exposing it."
  - "web/src/lib/routineJob.test.ts's local Scenario type (not in the plan's files_modified list) was updated to require nome on expectedSkipped entries — a Rule 3 blocking-issue fix, since the fixture retrofit's new nome fields would otherwise fail bun run check's type assertion against the stale local type."

patterns-established:
  - "Cross-runtime normalization-helper placement: a Set/frozenset constant plus a small pure predicate function, placed directly before the single call site's enclosing function in both routine_job.py and routineJob.ts, with the module docstring gaining a matching D-27-X labeled paragraph explaining the WHY (not just the WHAT) before the next existing decision paragraph."

requirements-completed: [JOB-01, JOB-03]

coverage:
  - id: D1
    description: "encadeado successor's dataPrevistaEstimada decision recognizes case/accent/whitespace variants of 'concluída' (both grammatical forms) as concluded, via _is_concluida/isConcluida; a plural near-miss ('concluidas') is proven NOT to match"
    requirement: "JOB-01"
    verification:
      - kind: unit
        ref: "cli/tests/test_routine_job.py::test_scenario[encadeado (JOB-01): ... 'CONCLUIDA' ...], [... 'Concluída' ...], [... 'concluído ' ...], [... 'concluidas' ...]"
        status: pass
      - kind: unit
        ref: "web/src/lib/routineJob.test.ts (routineJob computeExpectedInstances scenario fixture parity, same 4 new scenarios)"
        status: pass
      - kind: integration
        ref: "cli/tests/test_routine_job.py::test_gerar_instancias_recognizes_normalized_concluida_status (pytest.mark.live, run against production InstantDB)"
        status: pass
      - kind: other
        ref: "apollo rotina instancia status --help | grep -q '_is_concluida'"
        status: pass
    human_judgment: false
  - id: D2
    description: "status remains unvalidated free text at write time — instancia status --status keeps accepting any string verbatim; no click.Choice introduced"
    requirement: "JOB-01"
    verification:
      - kind: other
        ref: "cli/apollo_cli/entities/rotina.py's status command signature unchanged (--status required=True, no type=click.Choice); grep confirms no enum introduced"
        status: pass
    human_judgment: false
  - id: D3
    description: "every skipped entry gerar-instancias emits, in both runtimes, includes the template's nome alongside templateId/reason"
    requirement: "JOB-03"
    verification:
      - kind: unit
        ref: "cli/tests/test_routine_job.py::test_scenario (all 28 scenarios, expectedSkipped now asserts nome) + FIXTURE_NOME_OK programmatic shape audit"
        status: pass
      - kind: unit
        ref: "web/src/lib/routineJob.test.ts (routineJob computeExpectedInstances scenario fixture parity, all 28 scenarios)"
        status: pass
      - kind: integration
        ref: "cli/tests/test_routine_job.py::test_gerar_instancias_skipped_entries_include_template_nome (pytest.mark.live, run against production InstantDB)"
        status: pass
    human_judgment: false
  - id: D4
    description: "shared/routine-job.testcases.json gains normalized-status fixture coverage and a full nome retrofit across every scenario, including Plan 01's own additions"
    requirement: "JOB-01, JOB-03"
    verification:
      - kind: unit
        ref: "python3 fixture-shape audit script printing FIXTURE_NOME_OK (every templates[]/expectedSkipped[] entry across all 28 scenarios)"
        status: pass
    human_judgment: false
  - id: D5
    description: "zero regressions across the phase's complete, final fixture set — both offline suites and quality gates clean"
    verification:
      - kind: unit
        ref: "cli: uv run pytest -m 'not live and not packaging' — 358 passed, 2 skipped"
        status: pass
      - kind: unit
        ref: "web: bun run test (bun test src) — 184 pass, 0 fail"
        status: pass
      - kind: other
        ref: "cli: ruff check/format --check, ty check — all clean; web: bun run lint, bun run check — 0 errors"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-14
status: complete
---

# Phase 27 Plan 02: Normalized status recognition + nome in skipped (JOB-01/JOB-03) Summary

**`_is_concluida`/`isConcluida` recognize case/accent/whitespace variants of "concluída" (both grammatical forms) in the `encadeado` successor date-estimation decision, and every `skipped` entry `gerar-instancias` emits now carries the template's `nome` — both proven live against production InstantDB, closing Phase 27 in full.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `_is_concluida(status)`/`isConcluida(status)`: NFKD-decompose + strip combining marks + casefold/lowercase, checked against a tight two-form set (`concluida`/`concluido`) — replaces the exact-literal `status != "concluida"` comparison that silently missed the real onboarding data's `"Concluída"`/`"CONCLUIDA"` spellings.
- `status` remains free text at write time — `apollo rotina instancia status --status <valor>` still accepts any string verbatim; normalization is read-only, internal to `gerar-instancias`'s `encadeado` resolution. `instancia status --help` now documents the recognized spellings.
- A dedicated negative fixture case (`"concluidas"`, plural) proves normalization does NOT over-match — a genuinely different word stays unrecognized.
- Every `skipped` entry in both runtimes' `gerar-instancias` report now includes the template's `nome`, resolved via `_normalize_template` (Python, direct `row["nome"]` indexing) and `TemplateRow` (TS, `nome: string` required field) — no InstantDB query change was needed, since the existing unrestricted query already returned `nome`.
- `shared/routine-job.testcases.json` mechanically retrofitted: all 28 scenarios' `templates[]`/`expectedSkipped[]` entries now carry `nome` (4 new JOB-01 scenarios added, then the transform ran once over the full, final scenario set including Plan 01's own additions).
- Two new permanent live tests proving both requirements against the real InstantDB app: a real `"Concluída"`-marked antecessor correctly suppresses `dataPrevistaEstimada` on a newly-created `encadeado` successor; a real `skipped` entry's `nome` matches the template's actual `nome`.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "normalized 'concluída' recognition" — both runtimes, real live proof (JOB-01)** - `5169591` (feat)
2. **Task 2: `nome` in every `skipped` entry — both runtimes, full fixture retrofit, real live proof (JOB-03)** - `b6d32d5` (feat)

_Note: Task 1 was a `tracer` task — executed and committed as a full production-quality implementation with its own `<verify>`, then followed immediately by the tracer feedback gate (live-verify re-run of the same `<verify>`) before Task 2's expansion, per the workflow's tracer protocol. No checkpoint was surfaced because the tracer's `<verify>` passed cleanly on first run (auto mode active: `workflow._auto_chain_active`/`workflow.auto_advance` both `true`)._

## Files Created/Modified
- `cli/apollo_cli/routine_job.py` - new `import unicodedata`; new `_CONCLUIDA_FORMS` frozenset + `_is_concluida(status)`; `encadeado` sweep's `estimada` comparison rewritten; `_normalize_template` gains `nome`; all 8 `skipped.append(...)` sites gain `nome`; module docstring gains `_is_concluida (JOB-01/D-27-A)` and `nome`-in-skipped (JOB-03/D-27-C) paragraphs.
- `web/src/lib/routineJob.ts` - twin `CONCLUIDA_FORMS`/`isConcluida`; `estimada` comparison rewritten; `TemplateRow`/`SkippedTemplate` interfaces gain `nome: string`; all 8 `skipped.push(...)` sites gain `nome`; JSDoc gains the twin paragraphs.
- `cli/apollo_cli/entities/rotina.py` - `instancia.status`'s docstring documents `_is_concluida`'s recognized spellings (also serves as the command's `--help` text).
- `cli/tests/test_routine_job.py` - two new live tests: `test_gerar_instancias_recognizes_normalized_concluida_status`, `test_gerar_instancias_skipped_entries_include_template_nome`.
- `shared/routine-job.testcases.json` - 4 new normalized-status scenarios (`tpl-b4b`-`tpl-b4e`); every one of the 28 scenarios' `templates[]`/`expectedSkipped[]` entries gain `nome`.
- `web/src/lib/routineJob.test.ts` - local `Scenario` type's `expectedSkipped` field updated to require `nome` (not in the plan's `files_modified`, see Deviations).

## Decisions Made
- `_is_concluida`/`isConcluida` recognize both `concluida` (feminine) and `concluido` (masculine) grammatical forms deliberately — CONTEXT.md's own worked examples require both, and the phase's threat register (T-27-03) explicitly calls for a tight two-literal-form set rather than any fuzzy/substring match.
- `_normalize_template` indexes `row["nome"]` directly (not `.get()`) since `nome` is `required=True` on `template criar` and required by the schema — same "guaranteed present" treatment as `id`, the only other directly-indexed field in that function.
- No query-shape change in `_query_active_templates`/`runRoutineInstanceJob` — confirmed via 27-PATTERNS.md's prior live verification that the existing unrestricted InstaQL query already returns `nome`; the gap was purely in the normalization/type layer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `web/src/lib/routineJob.test.ts`'s local `Scenario` type updated to require `nome` on `expectedSkipped`**
- **Found during:** Task 2 (fixture retrofit + `bun run check`)
- **Issue:** The test file's own local `Scenario` interface (not the shared `SkippedTemplate` type) declared `expectedSkipped: Array<{ templateId: string; reason: SkipReason }>` with no `nome` field. After retrofitting `shared/routine-job.testcases.json` with `nome` on every `expectedSkipped` entry, this local type would silently permit the field via structural typing at import time, but the file wasn't in the plan's `files_modified` list — flagging it explicitly rather than leaving it undocumented.
- **Fix:** Added `nome: string;` to the local `Scenario` interface's `expectedSkipped` array element type, matching the runtime `SkippedTemplate` interface's shape.
- **Files modified:** `web/src/lib/routineJob.test.ts`
- **Verification:** `bun run check` clean (0 errors); `bun test src/lib/routineJob.test.ts` — 58 pass.
- **Committed in:** `b6d32d5` (Task 2 commit)

**2. [Rule 3 - Blocking] `biome check --write` formatting fix on `web/src/lib/routineJob.ts`**
- **Found during:** Task 2 (`bun run lint`)
- **Issue:** The new `isConcluida` function body and one multi-property `skipped.push({...})` call site did not match the project's biome formatting rules (line-wrapping/multi-line object literal style).
- **Fix:** Ran `biome check --write` on the single file; no logic change, formatting only.
- **Files modified:** `web/src/lib/routineJob.ts`
- **Verification:** `bun run lint` exits 0 with zero errors; `bun test src/lib/routineJob.test.ts` and `bun run check` still clean.
- **Committed in:** `b6d32d5` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues preventing a clean `bun run check`/`bun run lint`)
**Impact on plan:** Both fixes are mechanical (a type annotation, a formatter pass) with zero behavior change. No scope creep.

## Issues Encountered
None beyond the two auto-fixed formatting/typing issues above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 27 (Robustez do job) is now fully complete: JOB-01, JOB-02 (Plan 01), and JOB-03 all closed and live-verified.
- `git diff --stat` from Plan 01's final commit confirms this plan touched exactly the 5 files in `files_modified` plus one additional file (`web/src/lib/routineJob.test.ts`, documented above as a Rule 3 deviation) — no accidental edit to schema, perms, InstantDB query shape, or unrelated generation logic.
- Full offline regression gate green: 358 `cli/` pytest passed (2 skipped, pre-existing/unrelated), 184 `web/` bun tests passed, `ruff`/`ty check`/`bun run lint`/`bun run check` all clean.
- Ready for `/gsd-verify-work` or phase transition to Phase 28 (Periodicidade semanal, SEM-01), which depends on this phase only by extending the same `tipoGeracao` dispatch, not by any functional coupling to JOB-01/03.

---
*Phase: 27-robustez-do-job*
*Completed: 2026-08-14*

## Self-Check: PASSED

All 6 `key-files.modified` paths verified present on disk; both task commits (`5169591`, `b6d32d5`) verified present in `git log`.
