---
phase: 14-entity-screen-header-loading-empty-states
plan: 01
subsystem: ui
tags: [svelte, shadcn-svelte, entity-screen, skeleton, empty-state, tailwind]

# Dependency graph
requires:
  - phase: 13-shell-chrome-header-nav-content-frame
    provides: "Shell.svelte's single outer content-frame wrapper (shell-content-frame) and header flex idiom (title-left/action-right) that this plan's entity-header row mirrors"
provides:
  - "EntityConfig.descricao required field, populated for all 9 entity defs"
  - "EntityScreen.svelte page-header row (entity-header: h2 title + entity-description + entity-create-start), replacing the below-table create action"
  - "Skeleton-based entity-loading state (listColumns.length + 1 columns x 5 rows), replacing plain-text loading"
  - "Empty-based empty-state (icon/title/description/CTA) as a sibling of <Table>, never nested in <tbody>, with empty-state-create CTA reusing startCreate"
  - "Card-bounded entity-table-frame wrapping Table/Empty for all 9 entities"
  - "Vendored shadcn-svelte Skeleton and Empty primitives (web/src/lib/components/ui/skeleton, .../empty)"
affects: [14-02-verification-and-regression, 15-entity-screen-form-dialog, 16-row-actions-delete-confirmation, 17-cross-cutting-polish]

# Actuals (#2632)
actuals:
  tokens: 5200
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: ["shadcn-svelte Skeleton primitive", "shadcn-svelte Empty primitive"]
  patterns:
    - "Entity-level page-header row (flex items-center justify-between gap-4) mirroring Shell.svelte's header idiom, scoped per-entity instead of page-level"
    - "Empty/Table fork happens above <Table> (inside Card's CardContent) as siblings, never inside <tbody>/<TableRow>"
    - "Dialog.Root always renders as a sibling of the loading/error/success conditional, decoupled from query.isLoading/query.error"

key-files:
  created:
    - web/src/lib/components/ui/skeleton/index.ts
    - web/src/lib/components/ui/skeleton/skeleton.svelte
    - web/src/lib/components/ui/empty/index.ts
    - web/src/lib/components/ui/empty/empty.svelte
    - web/src/lib/components/ui/empty/empty-header.svelte
    - web/src/lib/components/ui/empty/empty-media.svelte
    - web/src/lib/components/ui/empty/empty-title.svelte
    - web/src/lib/components/ui/empty/empty-description.svelte
    - web/src/lib/components/ui/empty/empty-content.svelte
  modified:
    - web/src/lib/entities/EntityScreen.svelte
    - web/src/lib/entities/types.ts
    - web/src/lib/entities/defs/etapas.ts
    - web/src/lib/entities/defs/fundos.ts
    - web/src/lib/entities/defs/instanciasRotina.ts
    - web/src/lib/entities/defs/logInferenciaClaude.ts
    - web/src/lib/entities/defs/projetos.ts
    - web/src/lib/entities/defs/subtarefas.ts
    - web/src/lib/entities/defs/tarefas.ts
    - web/src/lib/entities/defs/templatesRotina.ts
    - web/src/lib/entities/defs/tickets.ts

key-decisions:
  - "descricao made a required (not optional) EntityConfig field so bun run check fails loudly if any of the 9 defs omits it — the enforcement mechanism for ENTTBL-04's all-9-entities requirement"
  - "empty-state-create kept as a distinct testid from entity-create-start, both calling the same startCreate() function, per Pitfall's Playwright-strict-mode uniqueness constraint"
  - "Empty.Description copy branches only on config.capabilities.create, never on config.etype, per ARCHITECTURE.md's no-special-casing rule"

patterns-established:
  - "Entity-level header row pattern (title/description block + right-aligned capability-gated action) — reusable reference for any future entity-adjacent screen"
  - "Content-shaped Skeleton loading grid sized from config.listColumns.length + 1, avoiding layout jump between loading and loaded states"

requirements-completed: [ENTTBL-04, ENTTBL-05, ENTTBL-06, ENTTBL-07]

coverage:
  - id: D1
    description: "Every entity screen shows a page-header row (title + description + right-aligned entity-create-start), replacing the old below-table create action"
    requirement: "ENTTBL-04"
    verification:
      - kind: e2e
        ref: "web/e2e/shell-nav.spec.ts: each nav Button renders its corresponding EntityScreen (h2 text-per-entity contract)"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-fundos.spec.ts: WEB-02 full browser CRUD round trip (uses entity-create-start)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loading state uses a Skeleton grid shaped like the real table rows, not plain text"
    requirement: "ENTTBL-05"
    verification:
      - kind: unit
        ref: "grep -c 'data-testid=\"entity-loading\"' web/src/lib/entities/EntityScreen.svelte == 1; old <p>carregando...</p> removed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero-record entities show an icon/title/description/CTA Empty composition reusing startCreate, as a sibling of <Table> (never nested in <tbody>)"
    requirement: "ENTTBL-06"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-fundos.spec.ts: WEB-02 final empty-state-visible assertion"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-table-restyle.spec.ts: instanciasRotina (restricted) and logInferenciaClaude (read-only) empty/populated states"
        status: pass
    human_judgment: false
  - id: D4
    description: "Table renders inside a bounded Card container (entity-table-frame) across all 9 entities"
    requirement: "ENTTBL-07"
    verification:
      - kind: unit
        ref: "grep -c 'data-testid=\"entity-table-frame\"' web/src/lib/entities/EntityScreen.svelte == 1"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-table-restyle.spec.ts, entities-rotina-log.spec.ts, entities-projeto-etapa-tarefa.spec.ts, entities-ticket-subtarefa.spec.ts, entities-form-restyle.spec.ts (22 tests, all capability classes)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-10
status: complete
---

# Phase 14 Plan 01: Entity Screen Header, Loading & Empty States Summary

**Restructured `EntityScreen.svelte`'s list-view template for all 9 entities — a page-header row (title + description + relocated create action), a content-shaped `Skeleton` loading grid, and an `Empty`-composition empty state as a sibling of `<Table>` inside a bounding `Card` — proven end-to-end against fundos (full-CRUD), all 9 entities' nav contract, and both the restricted (`instanciasRotina`) and read-only (`logInferenciaClaude`) capability classes.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-10T14:32:00Z (approx.)
- **Completed:** 2026-08-10T14:52:00Z
- **Tasks:** 2 completed
- **Files modified:** 20 (11 modified, 9 new vendored component files)

## Accomplishments
- Added a required `EntityConfig.descricao` field and populated it with an entity-specific Portuguese one-liner for all 9 entity defs.
- Vendored `Skeleton` and `Empty` shadcn-svelte primitives (`bunx shadcn-svelte add skeleton empty`) with zero new npm dependencies (confirmed no `package.json`/`bun.lock` diff).
- Restructured `EntityScreen.svelte`: new `entity-header` row (title + `entity-description` + capability-gated `entity-create-start`, relocated from below the table); `entity-loading` Skeleton grid (`listColumns.length + 1` columns x 5 rows) replacing the plain-text loading placeholder; `Empty`-based `empty-state` (icon/title/description/CTA) rendered as a sibling of `<Table>` inside a new `entity-table-frame` `Card`, never nested in `<tbody>`; `Dialog.Root` relocated to always render regardless of `query.isLoading`/`query.error`.
- Proved zero regression across all 9 entities and all 3 capability classes (full-CRUD, restricted, read-only) — 27 pre-existing Playwright specs (5 in Task 1 + 22 in Task 2) pass unmodified against the restructured markup, plus `bun run check` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Page-header + Skeleton loading + Card-bounded Empty/Table** - `97cf55c` (feat)
2. **Task 2: Verify zero regression across restricted/read-only capability classes** - no commit (zero fixes needed; all pre-existing specs passed unmodified on first run)

**Plan metadata:** committed separately per `<final_commit>` step below.

## Files Created/Modified
- `web/src/lib/entities/types.ts` - Added required `descricao: string` field to `EntityConfig`, documented as the page-header sub-heading (ENTTBL-04)
- `web/src/lib/entities/defs/fundos.ts` - `descricao: "Fundos de investimento geridos pela controladoria."`
- `web/src/lib/entities/defs/projetos.ts` - `descricao: "Projetos e suas etapas de execução."`
- `web/src/lib/entities/defs/etapas.ts` - `descricao: "Etapas que compõem os projetos, em ordem de execução."`
- `web/src/lib/entities/defs/tarefas.ts` - `descricao: "Tarefas vinculadas às etapas dos projetos."`
- `web/src/lib/entities/defs/templatesRotina.ts` - `descricao: "Modelos que geram instâncias de rotina automaticamente."`
- `web/src/lib/entities/defs/instanciasRotina.ts` - `descricao: "Instâncias de rotina geradas pelos templates. Apenas o status pode ser atualizado aqui."`
- `web/src/lib/entities/defs/tickets.ts` - `descricao: "Tickets recebidos por e-mail e seus prazos de atendimento."`
- `web/src/lib/entities/defs/subtarefas.ts` - `descricao: "Subtarefas vinculadas a uma tarefa ou a um ticket."`
- `web/src/lib/entities/defs/logInferenciaClaude.ts` - `descricao: "Registro somente leitura das inferências feitas pela IA durante o preenchimento de dados."`
- `web/src/lib/entities/EntityScreen.svelte` - New `entity-header` row, `entity-loading` Skeleton grid, `Empty`-based `empty-state` inside `entity-table-frame` Card, relocated `Dialog.Root`
- `web/src/lib/components/ui/skeleton/*` (new, vendored) - `Skeleton` primitive
- `web/src/lib/components/ui/empty/*` (new, vendored) - `Empty` composition primitive (Root/Header/Media/Title/Description/Content)

## Decisions Made
- Made `descricao` required (not optional) on `EntityConfig` so `bun run check` enforces every one of the 9 defs supplies it — the mechanism proving "all 9 entities" for ENTTBL-04, per the plan's own guidance.
- Kept `entity-create-start` and `empty-state-create` as two distinct testids on two separate Buttons (both calling `startCreate()`), preserving the load-bearing uniqueness constraint on `entity-create-start` while giving the Empty-state CTA its own selector for dedicated test coverage.
- `Empty.Description` copy branches only on `config.capabilities.create` (never on `config.etype`), keeping the component generic per ARCHITECTURE.md's no-special-casing rule.

## Deviations from Plan

None - plan executed exactly as written. Task 2 required zero fixes: all 22 pre-existing regression specs across `entities-table-restyle.spec.ts`, `entities-rotina-log.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts`, and `entities-form-restyle.spec.ts` passed unmodified against Task 1's restructured markup on the first run.

One clarification (not a deviation): the plan's acceptance criteria state "5 passed" (Task 1) and "22 passed" (Task 2) for the target spec counts; the actual Playwright run reports 6 and 23 respectively, because the `authed` project's `dependencies: ["setup"]` always runs the real magic-code `auth.setup.ts` test once per invocation in addition to the named spec files. All target specs plus the setup test passed with 0 failures in both runs — this is expected Playwright project-dependency behavior, not a regression.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. (The magic-code auth round trip used during verification reads the pre-existing, already-authorized `tp@rbrasset.com.br` inbox per PROJECT.md C-10 — no new setup.)

## Next Phase Readiness

- `EntityScreen.svelte`'s new `entity-header`/`entity-loading`/`empty-state`/`entity-table-frame` structure is in place and proven for all 9 entities and all 3 capability classes; Plan 14-02 (wave 2) can now add dedicated new coverage (dual-color-scheme checks, restricted/read-only-class-specific new specs) and run the full pre-existing-plus-new suite without needing further structural changes here.
- `Dialog.Root`'s relocation to always-render (decoupled from `query.isLoading`/`query.error`) is unchanged internally — Phase 15's form/dialog spacing work can build directly on top of this plan's markup without further restructuring of the create/edit form's mount point.
- No blockers or concerns carried forward.

---
*Phase: 14-entity-screen-header-loading-empty-states*
*Completed: 2026-08-10*

## Self-Check: PASSED

All created/modified files and the Task 1 commit hash were verified present on disk / in git history.
