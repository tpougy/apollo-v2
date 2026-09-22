---
phase: 28-periodicidade-semanal
plan: 03
subsystem: ui
tags: [svelte, entity-form, playwright, select]

# Dependency graph
requires:
  - phase: 28-01
    provides: "diaSemana: i.string().optional() pushed live to shared/instant.schema.ts's templatesRotina entity"
  - phase: 28-02
    provides: "semanal tipoGeracao + --dia-semana CLI option + compute engine dispatch (both runtimes)"
provides:
  - "tipoGeracao SPA select offers \"semanal\" as a real, selectable option"
  - "diaSemana select field (7 weekday tokens, non-required) on the SPA templatesRotina create/edit form"
  - "listColumns surfaces diaSemana"
  - "registry.test.ts regression guard for diaSemana's shape + tipoGeracao's extended option set"
  - "two pre-existing e2e specs repaired for the new 4-value option set and the listColumns index shift"
affects: [29-recorte-de-range]

# Actuals (#2632)
actuals:
  tokens: 1886
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SPA entity-def field addition mirrors 05-01-PLAN.md Task 3's exact shape: extend an existing select's options array + add a new non-required select field + extend listColumns, no EntityScreen.svelte change needed (kind:\"select\" already renders generically)."

key-files:
  created: []
  modified:
    - web/src/lib/entities/defs/templatesRotina.ts
    - web/src/lib/entities/registry.test.ts
    - web/e2e/entities-rotina-log.spec.ts
    - web/e2e/entities-form-restyle.spec.ts

key-decisions:
  - "diaSemana field placed immediately after offsetDias in both fields[] and listColumns, matching the plan's specified insertion point."
  - "Fixed a second-order bug the plan didn't explicitly call out: inserting diaSemana into listColumns shifted every column index after it, breaking WEB-06's column-index assertions (cellsA.nth(4)/(5), cellsB.nth(5), reloadedRowB td.nth(3)) in entities-rotina-log.spec.ts, not just the sort()-based option-set assertion the plan named. Treated as Rule 1 (auto-fix bug) since it was directly caused by this task's own listColumns change; all four index sites updated (nth(4)->nth(5), nth(5)->nth(6), nth(3)->nth(4)) and the whole spec re-verified green against a real browser."

requirements-completed: [SEM-01]

coverage:
  - id: D1
    description: "tipoGeracao's SPA select offers \"semanal\" as a real, selectable option (not just raw-string display for CLI-created semanal templates)"
    requirement: SEM-01
    verification:
      - kind: unit
        ref: "web/src/lib/entities/registry.test.ts#templatesRotina: has a non-required \"select\" field named diaSemana (7 weekday tokens), listed in listColumns, and tipoGeracao offers \"semanal\""
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-rotina-log.spec.ts#WEB-06: templatesRotina full CRUD, including the self-referential antecessor link"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ENTFRM-01/03: templatesRotina — static-option Select (tipoGeracao) and relationship-link Select (fundo) render and persist"
        status: pass
    human_judgment: false
  - id: D2
    description: "diaSemana exists as a non-required select field (7 lowercase unaccented Portuguese weekday tokens) on the SPA templatesRotina form, and appears in listColumns"
    requirement: SEM-01
    verification:
      - kind: unit
        ref: "web/src/lib/entities/registry.test.ts#templatesRotina: has a non-required \"select\" field named diaSemana (7 weekday tokens), listed in listColumns, and tipoGeracao offers \"semanal\""
        status: pass
    human_judgment: false
  - id: D3
    description: "EntityScreen.svelte remains unmodified — kind:\"select\" fields already render generically"
    verification:
      - kind: other
        ref: "git diff --stat HEAD~1 HEAD (4 files changed: templatesRotina.ts, registry.test.ts, entities-rotina-log.spec.ts, entities-form-restyle.spec.ts — EntityScreen.svelte absent)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-22
status: complete
---

# Phase 28 Plan 03: SPA templatesRotina form + e2e repair Summary

**Extended the SPA templatesRotina create/edit form to offer `tipoGeracao="semanal"` and a new non-required `diaSemana` select (7 weekday tokens), closing the SPA/CLI parity gap RESEARCH.md's Open Question 1 flagged; repaired both pre-existing e2e specs' stale option-set and column-index assertions, proven green in a real browser.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-22T18:47:18Z
- **Completed:** 2026-09-22T18:51:05Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- `tipoGeracao`'s SPA select now offers `du_fixo | corrido_fixo | encadeado | semanal` (was 3 values).
- New `diaSemana` select field added to `templatesRotina`'s fields array — `required: false`, `kind: "select"`, options `["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"]`, mirroring `cli/apollo_cli/entities/rotina.py`'s `_DIA_SEMANA_CHOICES` exactly so a value round-trips unchanged between the SPA and the CLI.
- `listColumns` extended to include `"diaSemana"` (inserted after `"offsetDias"`, before `"ativo"`).
- New `registry.test.ts` assertion pins `diaSemana`'s shape (kind, required, all 7 tokens), its presence in `listColumns`, and `tipoGeracao`'s inclusion of `"semanal"` — a permanent regression guard against this exact enum-drift class of bug.
- Both pre-existing e2e specs (`entities-rotina-log.spec.ts`'s `WEB-06`, `entities-form-restyle.spec.ts`'s `ENTFRM-01/03`) repaired to assert the new 4-value option set, plus four column-index sites in `WEB-06` repaired for the `listColumns` shift — all proven green in a real Playwright/Chrome run against the live authenticated SPA (`--project=authed`), not just statically.
- `EntityScreen.svelte` left untouched, as required — it already renders `kind: "select"` fields generically.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the SPA templatesRotina form + repair the two broken e2e option-set assertions** - `962b981` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `web/src/lib/entities/defs/templatesRotina.ts` - `tipoGeracao` options extended with `"semanal"`; new `diaSemana` field entry; `listColumns` extended; top comment block extended with a `diaSemana`/SEM-01 rationale note.
- `web/src/lib/entities/registry.test.ts` - new `templatesRotina: has a non-required "select" field named diaSemana...` test.
- `web/e2e/entities-rotina-log.spec.ts` - `WEB-06`'s `optionValues.sort()` assertion updated to 4 values; comment updated; 4 column-index sites (`cellsA.nth(4)/(5)` -> `nth(5)/(6)`, `cellsB.nth(5)` -> `nth(6)`, `reloadedRowB` `td.nth(3)` -> `nth(4)`) updated for the `listColumns` shift caused by inserting `diaSemana`.
- `web/e2e/entities-form-restyle.spec.ts` - `ENTFRM-01/03`'s `tipoGeracaoOptions.sort()` assertion updated to 4 values; comment updated.

## Decisions Made
- `diaSemana` inserted immediately after `offsetDias` in both `fields[]` and `listColumns`, exactly as the plan specified — keeps the "dual-purpose offsetDias, then the new type-specific diaSemana" grouping adjacent and readable.
- Discovered and fixed a bug the plan's `read_first`/`action` sections did not explicitly call out: the `listColumns` insertion shifts every column index positioned after `diaSemana` (`ativo`, `fundo`, `antecessor`), which broke four index-based assertions in `entities-rotina-log.spec.ts`'s `WEB-06` test beyond the single `sort()` assertion the plan named. Fixed under deviation Rule 1 (auto-fix bugs directly caused by this task's own change) rather than leaving the e2e suite red — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed listColumns index shift breaking WEB-06's column-position assertions**
- **Found during:** Task 1, running the live Playwright verification
- **Issue:** Inserting `"diaSemana"` into `listColumns` (`["nome", "tipoGeracao", "offsetDias", "ativo", "fundo", "antecessor"]` -> `[..., "offsetDias", "diaSemana", "ativo", "fundo", "antecessor"]`) shifts `ativo` from index 3 to 4, `fundo` from 4 to 5, and `antecessor` from 5 to 6. `entities-rotina-log.spec.ts`'s `WEB-06` test asserted specific `td.nth(N)` positions for these columns (blank-link checks at `nth(4)`/`nth(5)`, `antecessor` text at `nth(5)`, `ativo`'s `"não"` value at `nth(3)`) — all of which would silently read the wrong column's text after the field addition, even though the plan's `<action>` section only named the `optionValues.sort()` assertion in this file.
- **Fix:** Updated `cellsA.nth(4)` -> `nth(5)` and `cellsA.nth(5)` -> `nth(6)` (both-blank-link check), `cellsB.nth(5)` -> `nth(6)` (antecessor text), and `reloadedRowB.locator("td").nth(3)` -> `nth(4)` (ativo `"não"` check); updated the adjacent comment to reflect the new 7-column `listColumns` order.
- **Files modified:** web/e2e/entities-rotina-log.spec.ts
- **Verification:** Full live Playwright run (`--project=authed entities-rotina-log.spec.ts entities-form-restyle.spec.ts`) — all 9 tests pass, including `WEB-06`.
- **Committed in:** 962b981 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, Rule 1)
**Impact on plan:** Necessary for correctness — without this fix the live e2e suite would have failed on `WEB-06` despite the plan's own acceptance criteria only checking the two named `sort()`-based assertions. No scope creep: the fix is confined to the same file the plan already listed in `files_modified`.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 28 (Periodicidade semanal, SEM-01) is now fully complete across all 3 plans: 28-01 (schema push), 28-02 (CLI + compute engine, both runtimes), 28-03 (SPA form parity, this plan).
- `semanal` templates are now a first-class, selectable option from both the SPA and the CLI — no remaining raw-string-display gap.
- Phase 29 (recorte de range) depends on this phase per STATE.md's roadmap derivation and can proceed.

## Self-Check: PASSED

- FOUND: web/src/lib/entities/defs/templatesRotina.ts (diaSemana field + semanal option present)
- FOUND: web/src/lib/entities/registry.test.ts (new diaSemana test present)
- FOUND: web/e2e/entities-rotina-log.spec.ts (4-value assertion + index fixes present)
- FOUND: web/e2e/entities-form-restyle.spec.ts (4-value assertion present)
- FOUND: commit 962b981 in `git log --oneline`

---
*Phase: 28-periodicidade-semanal*
*Completed: 2026-09-22*
