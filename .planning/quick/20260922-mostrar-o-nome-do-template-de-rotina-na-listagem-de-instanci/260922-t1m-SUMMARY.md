---
phase: 260922-t1m
plan: 1
subsystem: entities
tags: [cli, click, svelte, instantdb, entity-screen, link-expansion]

requires: []
provides:
  - CLI `apollo rotina instancia listar` emits each row's inline `template` sub-record (id + fields, notably `nome`)
  - `LinkDef.readOnly` generic flag on `EntityScreen.svelte`'s shared entity table/form component
  - instanciasRotina web listing shows the source template's `nome` as a read-only column
affects: [rotina, entities, entity-screen]

actuals:
  tokens: 3128
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Generic readOnly LinkDef flag lets a shared EntityScreen.svelte config declare a link that resolves into the table but is excluded from the editable create/edit form — reusable for any future entity needing a display-only link."

key-files:
  created: []
  modified:
    - cli/apollo_cli/entities/rotina.py
    - cli/tests/test_rotina_instancia.py
    - web/src/lib/entities/types.ts
    - web/src/lib/entities/EntityScreen.svelte
    - web/src/lib/entities/defs/instanciasRotina.ts
    - web/e2e/entities-rotina-log.spec.ts

key-decisions:
  - "listar_instancia switched from crud_helpers.list_entities to a direct client.query sub-expanding the template link (same shape limpar_orfas already used), rather than adding link-expansion support to list_entities itself — kept the change scoped to this one command, matching the plan's narrow objective."
  - "Closed the 'template link was omitted from listColumns to avoid reopening the reassignment hole' gap by adding a generic LinkDef.readOnly flag to EntityScreen.svelte rather than a one-off instanciasRotina-specific rendering branch — reusable by any future entity with the same need."

requirements-completed: []

coverage:
  - id: D1
    description: "apollo rotina instancia listar (filtered or not) returns each row's template sub-record with nome resolved inline"
    verification:
      - kind: unit
        ref: "cli/tests/test_rotina_instancia.py#test_listar_expands_template_nome_inline"
        status: pass
    human_judgment: false
  - id: D2
    description: "instanciasRotina web listing table shows a template column with the source template's name; edit dialog never exposes template as editable"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-rotina-log.spec.ts#WEB-10: instanciasRotina listing mostra o nome do template e o mantém somente leitura"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-22
status: complete
---

# Quick Batch 260922-t1m: Show routine template name on instanciasRotina listing Summary

**`apollo rotina instancia listar` and the web instanciasRotina table both now resolve and display the source template's `nome` via the existing `template` link, with a new generic `LinkDef.readOnly` flag keeping it strictly read-only in the web edit form.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments

- `listar_instancia` (CLI) now runs a direct `client.query` sub-expanding the `template` link (id + every `templatesRotina` field, notably `nome`) instead of delegating to `list_entities`, which never expands links. `--template-id`/`--status`/`--limit` semantics are byte-identical; `template.listar` is untouched.
- Added a live test (`test_listar_expands_template_nome_inline`) asserting the expanded `template.nome` matches, for both unfiltered and `--template-id`-filtered `listar`, with a local `_linked_template` helper normalizing InstantDB's observed dict-vs-list expansion shape.
- Added `LinkDef.readOnly?: boolean` to the shared entity-config contract (`types.ts`) and wired `EntityScreen.svelte` to filter `readOnly` links out of both `linkTargetQueries` and the per-link `<Select>` form loop, while leaving `buildQuery`/`columnValue`/`labelForLinkedValue`/`startEdit`/`handleSubmit` untouched (all already generic).
- `instanciasRotina.template` is now declared as a `readOnly: true` link and the first `listColumns` entry — the web table renders the template's `nome`, and the create/edit dialog still exposes only `field-status`, no `link-template` select.
- Added a live Playwright test (`WEB-10`) seeding a template + linked instance, asserting the table row contains the template's `nome` and the edit dialog shows no `link-template` control.

## Task Commits

Each task was committed atomically:

1. **Task 1: CLI — expand `template` inline on `rotina instancia listar`** - `db515bb` (feat)
2. **Task 2: Web — read-only `template` column on the instanciasRotina screen** - `5f72b14` (feat)

_No plan-metadata commit made per this run's constraints — orchestrator commits STATE.md/ROADMAP.md/PLAN.md/SUMMARY.md itself._

## Files Created/Modified

- `cli/apollo_cli/entities/rotina.py` - `listar_instancia` now sub-expands `template` via a direct `client.query`, wrapped in `instant_errors()`
- `cli/tests/test_rotina_instancia.py` - new live test `test_listar_expands_template_nome_inline` + `_linked_template` shape-normalizing helper
- `web/src/lib/entities/types.ts` - `LinkDef.readOnly?: boolean` added
- `web/src/lib/entities/EntityScreen.svelte` - `linkTargetQueries` and the per-link `<Select>` form loop now filter out `readOnly` links
- `web/src/lib/entities/defs/instanciasRotina.ts` - declares `template` as a `readOnly: true` link, added to `listColumns`, stale comment replaced with the new rationale
- `web/e2e/entities-rotina-log.spec.ts` - new live e2e test `WEB-10` seeding a template+instance and asserting the read-only column/form behavior

## Decisions Made

- Kept the link-expansion change scoped to `listar_instancia` alone (direct `client.query`) rather than generalizing `list_entities` to support link expansion — narrower blast radius, matches the plan's stated scope, and mirrors `limpar_orfas`'s existing pattern in the same file.
- Implemented the "read-only link" concept as a generic `LinkDef.readOnly` flag on the shared `EntityScreen.svelte` component rather than a one-off `instanciasRotina`-specific rendering branch, so any future entity needing a display-only link can reuse it without touching the shared component again.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- No follow-up work identified; the read-only `LinkDef` flag is generic and available for reuse by any future entity needing a display-only link (defaults to falsy/unset everywhere else, verified via the full `entities-rotina-log.spec.ts` suite passing unchanged for `WEB-06`).

---
*Quick batch item: 260922-t1m*
*Completed: 2026-09-22*

## Self-Check: PASSED
