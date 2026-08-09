---
phase: 05-idempotent-routine-instance-job
plan: 01
subsystem: database
tags: [instantdb, schema-migration, cli, svelte, click, templatesRotina]

# Dependency graph
requires:
  - phase: 03-cli-auth-crud
    provides: apollo_cli crud_helpers (drop_none, create_entity, update_entity) and rotina.py CLI surface
  - phase: 04-spa-auth-crud
    provides: EntityConfig contract + generic kind:"number" field rendering in EntityScreen.svelte
provides:
  - "offsetDias: i.number().optional() live on templatesRotina in the real InstantDB app"
  - "--offset-dias flag on apollo rotina template criar|editar"
  - "offsetDias field + listColumns entry on the SPA templatesRotina screen"
  - "D-05-A (single dual-purpose field) and D-05-B (encadeado = business days) locked as the schema contract for 05-02..05-06"
affects: [05-02-compute-job, 05-03-spa-trigger, 05-04-cli-gerar-instancias, 05-05-cli-job, 05-06-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema addition -> live push -> server-side re-pull verification (instant:push then instant:verify), mirroring the Phase 1 pattern"
    - "CLI optional-flag no-op via drop_none: a flag defaulting to None never overwrites an existing value on edit"

key-files:
  created: []
  modified:
    - shared/instant.schema.ts
    - cli/apollo_cli/entities/rotina.py
    - cli/tests/test_crud_rotina_template.py
    - web/src/lib/entities/defs/templatesRotina.ts
    - web/src/lib/entities/registry.test.ts

key-decisions:
  - "D-05-A: one dual-purpose optional numeric offsetDias field, interpreted per tipoGeracao, instead of three type-specific fields"
  - "D-05-B: encadeado's offsetDias counts BUSINESS days after the antecessor's dataPrevista (not calendar days), for consistency with du_fixo and the domain's ANBIMA-business-day orientation"
  - "offsetDias comment note in shared/instant.schema.ts deliberately avoids repeating the literal identifier so the schema's own single occurrence of 'offsetDias' (the field declaration) stays machine-verifiable via grep -c == 1"

patterns-established:
  - "Schema push -> instant:verify -> grep server-pulled schema for the new attribute AND for the pre-existing dedupeKey.unique() constraint before considering a schema task done"

requirements-completed: [JOB-01, JOB-02]

# Metrics
duration: 35min
completed: 2026-08-09
---

# Phase 5 Plan 1: Add offsetDias schema field (live) + CLI/SPA exposure Summary

**Added `templatesRotina.offsetDias: i.number().optional()`, pushed it live to the real InstantDB app, and wired it through both `apollo rotina template criar|editar --offset-dias` and the SPA templatesRotina screen — closing the schema gap that blocked the entire Phase 5 generation job.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-09T00:00:00Z (approx, see git log for exact commit timestamps)
- **Completed:** 2026-08-09
- **Tasks:** 3 (Task 2 and 3 ran full RED -> GREEN TDD cycles)
- **Files modified:** 5

## Accomplishments
- `templatesRotina.offsetDias` is live in the production InstantDB app, confirmed via a server-side `instant:verify` pull (not just the local schema file)
- Confirmed `instanciasRotina.dedupeKey` is still `unique().indexed()` after the push — the idempotency guarantee the rest of Phase 5 depends on survived intact
- `apollo rotina template criar|editar` now accept `--offset-dias`, with omission being a true no-op on `editar` (never resets a stored value)
- The SPA templatesRotina screen exposes an optional "Offset (dias)" number field and lists it as a column
- D-05-A and D-05-B are now recorded in three places: this plan's context section, the schema comment, and the CLI `--help` text — not silently assumed anywhere downstream

## Task Commits

Each task was committed atomically:

1. **Task 1: Add offsetDias to the schema and push it live** - `81155ed` (feat)
2. **Task 2: Expose --offset-dias on the CLI template commands** - `83a3c66` (test, RED) -> `f0470a2` (feat, GREEN)
3. **Task 3: Expose offsetDias on the SPA template screen** - `24c0753` (test, RED) -> `2cbd1a6` (feat, GREEN)

**Plan metadata:** (this commit, docs: complete plan)

_Note: Tasks 2 and 3 are `tdd="true"` — each has a failing-test commit followed by an implementation commit, per plan requirement._

## Server-Side Push/Verify Evidence

Pushed schema diff (from `bun run instant:push` output):
```
┌────────────────────────────────────────────┐
│  + CREATE ATTR  templatesRotina.offsetDias │
│      DATA TYPE: number                     │
│      OPTIONAL                              │
└────────────────────────────────────────────┘
Schema updated!
No perms changes to apply!
```

Server-side pulled schema (`web/.instant-verify/instant.schema.ts`, via `bun run instant:verify`) — `templatesRotina` block:
```
templatesRotina: i.entity({
  ativo: i.boolean(),
  donoId: i.string().indexed(),
  nome: i.string(),
  offsetDias: i.number().optional(),
  propagarAtrasoSoft: i.boolean(),
  regraCompetencia: i.string(),
  tipoGeracao: i.string(),
}),
```
`instanciasRotina.dedupeKey` line in the same pulled file: `dedupeKey: i.string().unique().indexed()` — the unique constraint survived the push unchanged.

## D-05-B Restated for Downstream Plans

**Encadeado's `offsetDias` counts BUSINESS days**, not calendar days: `dataPrevista(sucessor) = addBusinessDays(dataPrevista(antecessor for same competência), offsetDias)`. This is locked here (not left assumed) because the whole domain is dias-úteis-centric (`du_fixo` is business-day based, `corrido_fixo` exists specifically as the calendar-day escape hatch), and a silently-calendar-day encadeado chain would land routine deadlines on weekends/ANBIMA holidays — the exact failure the vendored calendar exists to prevent. Plans 05-02..05-06 must implement `encadeado` against this business-day interpretation.

## Files Created/Modified
- `shared/instant.schema.ts` - Added `offsetDias: i.number().optional()` to `templatesRotina`, plus a comment block documenting the D-05-A/D-05-B interpretation (worded to avoid a second literal occurrence of "offsetDias" so the field declaration remains the sole grep match)
- `cli/apollo_cli/entities/rotina.py` - Added `--offset-dias` (`type=int`, `default=None`) to both `criar` and `editar`, merged into the `offsetDias` fields key; `editar` folds it into the existing `drop_none({...})` call so omitting the flag is a no-op
- `cli/tests/test_crud_rotina_template.py` - Added 5 live tests: set-on-create, omit-on-create leaves key absent (checked via both a direct query and `listar` output), edit-changes-only-that-field, omit-on-edit preserves prior value, legacy `listar` still works
- `web/src/lib/entities/defs/templatesRotina.ts` - Added `offsetDias` field (`kind: "number"`, `required: false`) directly after `tipoGeracao`, added it to `listColumns` in the same position, extended the file's comment block with the D-05-A/D-05-B interpretation
- `web/src/lib/entities/registry.test.ts` - Added a structural assertion proving `templatesRotina`'s config carries a non-required `number` field named `offsetDias`, listed in `listColumns`

## Decisions Made
- Kept the schema comment prose free of the literal identifier "offsetDias" (referring instead to "a single dual-purpose optional number field ... below") so the plan's acceptance criterion of "grep -n 'offsetDias' shared/instant.schema.ts prints exactly one line" holds while still documenting the field's rationale inline — see Deviations below.
- No new validation added to either channel for `offsetDias` range — per the plan's explicit direction (and threat T-05-13's `accept` disposition), range validity is deferred to the Phase 5 generation job (05-02), which will report out-of-range/missing offsets as skipped templates rather than rejecting them at write time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Schema comment initially violated the plan's own "exactly one grep line" acceptance criterion**
- **Found during:** Task 1 (schema edit)
- **Issue:** The plan's action text asked for a comment "recording that `offsetDias` is a Phase 5 addition..." — my first draft spelled the literal identifier in that comment, which made `grep -n 'offsetDias' shared/instant.schema.ts` print 2 lines instead of the acceptance criterion's required exactly 1.
- **Fix:** Reworded the comment to describe "a single dual-purpose optional number field ... added below" without repeating the literal attribute name, preserving all the required documentation content (D-05-A/D-05-B rationale) while keeping the field declaration as the schema file's sole occurrence of the identifier.
- **Files modified:** `shared/instant.schema.ts`
- **Verification:** `grep -n 'offsetDias' shared/instant.schema.ts` returns exactly 1 line, inside the `templatesRotina` block.
- **Committed in:** `81155ed` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug-category wording fix, no functional/schema impact)
**Impact on plan:** Purely a documentation-wording adjustment to satisfy the plan's own stated acceptance criterion; no scope creep, no behavior change.

## Issues Encountered
- `bunx --bun biome format --write ...` did not apply from a different cwd than the repo root inside a single Bash call (biome resolves paths relative to invocation cwd, and the sandboxed shell resets cwd between calls) — worked around by hand-editing the one formatting violation directly rather than relying on the auto-formatter, then re-running `bun run format:check`/`bun run lint` from `web/` to confirm clean.

## User Setup Required

None - no external service configuration required (the InstantDB app was already provisioned in Phase 1; this plan only pushed an additive schema change to it).

## Next Phase Readiness
- `offsetDias` is live and settable on both channels — Plan 05-02 (the compute-expected-instances job) now has real data to read `du_fixo`/`corrido_fixo`/`encadeado` offsets from.
- D-05-A and D-05-B are locked and documented in three independent places (this plan, the schema comment, CLI help text), so 05-02..05-06 can implement against them without re-litigating the encadeado business-vs-calendar-day question.
- Pre-existing Phase 3/4 templates without `offsetDias` still list/edit cleanly on both channels (verified by the new tests) — 05-02's job will need to treat "missing offsetDias" as a skip-with-reason case per Pitfall 4 in 05-RESEARCH.md, not a crash.
- No blockers identified for Wave 2.

---
*Phase: 05-idempotent-routine-instance-job*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 5 modified/created files confirmed present on disk; all 5 task commit hashes (`81155ed`, `83a3c66`, `f0470a2`, `24c0753`, `2cbd1a6`) confirmed present in `git log --oneline --all`.
