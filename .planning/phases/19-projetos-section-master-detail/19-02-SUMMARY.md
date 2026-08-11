---
phase: 19-projetos-section-master-detail
plan: 02
subsystem: ui
tags: [svelte5, instantdb, shadcn-svelte, bits-ui, accordion, playwright, master-detail, runes, derive]

# Dependency graph
requires:
  - phase: 19-projetos-section-master-detail (Plan 01)
    provides: ProjetosSection.svelte's bespoke db.useQuery, master column, selectedProjetoId $state, requireConfig helper, and the hidden-EntityScreen-host + bounded-poll dialog-opening pattern (projetoHostEl/openProjetoDialog)
provides:
  - projetosDerive.ts — phase-local pure module (tarefaConcluida/progressoEtapa/vencido) matching REQUIREMENTS.md §5.3/§5.4 exactly, unit-tested
  - ProjetosSection.svelte's etapas accordion (list view) — single-open, row-level `etapas.ordem`-ascending, progress bar + N/M counter per row
  - Inline tarefas list inside an open etapa — disabled completion checkbox, text-destructive prazo, passive subtarefa chip
  - "+ etapa" and "+ tarefa nesta etapa" hidden-EntityScreen-host create flows (etapaHostEl/tarefaHostEl), presetLinks read live from selectedProjetoId/openEtapaId
affects: [19-03-kanban-todas-tarefas, 19-04-regression-fixes, 20-rotinas-tickets-subtarefas-panel, 21-dashboard-derive-consolidation]

# Actuals (#2632)
actuals:
  tokens: 9100
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Phase-local pure derivation module (projetosDerive.ts) mirroring bizdays.ts's doc-comment style, ahead of Phase 21's canonical dashboard/derive.ts — explicitly allowed by 19-CONTEXT.md so Phase 21 can consolidate/dedupe later."
    - "Guarding bits-ui Accordion.Content's children with `{#if openEtapaId === etapa.id}` — bits-ui keeps every item's Content mounted in the DOM regardless of open/closed state (Radix-style height animation, never display:none), so without the guard every per-etapa testid exists once per etapa simultaneously."
    - "Third independent hidden-EntityScreen-host (tarefaHostEl) added alongside Plan 19-01's projetoHostEl and this plan's own etapaHostEl — same bounded-poll dialog-opening shape, never a shared host across etypes."

key-files:
  created:
    - web/src/lib/sections/projetosDerive.ts
    - web/src/lib/sections/projetosDerive.test.ts
  modified:
    - web/src/lib/sections/ProjetosSection.svelte
    - web/e2e/projetos-section.spec.ts

key-decisions:
  - "openEtapaId uses an empty string (\"\") as the \"closed\" sentinel instead of `null` — the installed bits-ui Accordion.Root's `type=\"single\"` value prop is typed `string` (default `\"\"`), not `string | null`, and this bits-ui version has no `collapsible` prop at all (verified absent from AccordionRootSinglePropsWithoutHTML). `\"\"` is falsy exactly like `null` for every downstream check (`openEtapaId ? {...} : null` for presetLinks), so behavior is unaffected; documented inline in ProjetosSection.svelte."
  - "Prazo text-destructive assertions use Playwright's `.toHaveClass(/text-destructive/)` on the element directly, not the plan-suggested `getComputedStyle(el).color` oklch-token match — the class is rendered directly on the tested span (no dual-color-scheme ambiguity to resolve), and this mirrors an existing simpler precedent in this codebase (entities-form-dialog-composition.spec.ts's `.locator(\".text-destructive\")` checks) rather than the heavier getComputedStyle technique used elsewhere for background-color assertions where no class-based check is available."
  - "'+ etapa' nesta plan reuses the exact bounded-poll dialog-opening shape from Plan 19-01's openProjetoDialog for its own etapaHostEl, even though '+ etapa''s own target (entity-create-start) does not strictly need polling (it always exists once the host mounts) — kept for consistency across all three hidden hosts in this component, and because 19-01's own SUMMARY documented this fix as necessary for network-dependent targets in general."

patterns-established:
  - "projetosDerive.ts's three functions are consumed IDENTICALLY by the accordion header's progress bar/counter and each inline task row's checkbox/prazo styling — one source of truth; no second ad-hoc completion or overdue check exists anywhere in ProjetosSection.svelte."
  - "Every Accordion.Content's children are gated behind `{#if openEtapaId === etapa.id}` in this codebase's accordion usage going forward, since bits-ui does not conditionally unmount closed items on its own."

requirements-completed: [NEST-02]

coverage:
  - id: D1
    description: "Selecting a projeto renders its etapas as collapsible rows ordered by the row-level etapas.ordem field ascending (never etapasConfig.ordem's constant nav-sort value), one open at a time (accordion single), each showing a thin progress bar and an N/M counter derived from progressoEtapa's subtarefa-based rule"
    requirement: "NEST-02"
    verification:
      - kind: unit
        ref: "web/src/lib/sections/projetosDerive.test.ts#progressoEtapa"
        status: pass
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: etapas render ordered by row-level ordem asc regardless of creation order, with progress bar/counter from progressoEtapa"
        status: pass
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: accordion is single-open -- opening one etapa closes the other"
        status: pass
    human_judgment: false
  - id: D2
    description: "Opening an etapa lists that etapa's own tarefas inline: a disabled completion checkbox reflecting tarefaConcluida, titulo, prazo styled destructive only when vencido() is true, and a passive (non-clickable) subtarefa N/M chip"
    requirement: "NEST-02"
    verification:
      - kind: unit
        ref: "web/src/lib/sections/projetosDerive.test.ts#tarefaConcluida, #vencido"
        status: pass
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: inline tarefas show a disabled completion checkbox matching tarefaConcluida"
        status: pass
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: prazo is styled text-destructive only per vencido()'s exact rule"
        status: pass
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: subtarefa chip shows the exact concluida/total count from the fixture"
        status: pass
    human_judgment: false
  - id: D3
    description: "\"+ etapa\" opens EntityScreen's real create dialog via a hidden instance, pre-linked (presetLinks) to the live selected projeto, with the link select still visible and editable"
    requirement: "NEST-02"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: '+ etapa' creates via the hidden-instance pattern, presetLinks pre-fills but does not lock the projeto link"
        status: pass
    human_judgment: false
  - id: D4
    description: "\"+ tarefa nesta etapa\" opens EntityScreen's real create dialog via a hidden instance, pre-linked (presetLinks) to the live open etapa, with the link select still visible and editable"
    requirement: "NEST-02"
    verification:
      - kind: e2e
        ref: "web/e2e/projetos-section.spec.ts#NEST-02: '+ tarefa nesta etapa' creates via the hidden-instance pattern, pre-linked to the live open etapa"
        status: pass
    human_judgment: false

duration: ~22min
completed: 2026-08-11
status: complete
---

# Phase 19 Plan 02: Etapas Accordion + Inline Tarefas Summary

**`projetosDerive.ts` (tarefaConcluida/progressoEtapa/vencido, REQUIREMENTS.md §5.3/§5.4 verbatim) plus `ProjetosSection.svelte`'s single-open etapas accordion (row-level `ordem` ascending, progress bar/counter) with inline tarefas (disabled checkbox, destructive-styled prazo, passive subtarefa chip) and two new hidden-EntityScreen-host create flows ("+ etapa", "+ tarefa nesta etapa").**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-08-11T18:41Z (approx.)
- **Completed:** 2026-08-11T19:03Z
- **Tasks:** 2 (both TDD: RED then GREEN)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `projetosDerive.ts` implements `tarefaConcluida`/`progressoEtapa`/`vencido` as pure functions (no `db`, `hoje` always a parameter), matching REQUIREMENTS.md §5.3/§5.4's locked rules verbatim; `projetosDerive.test.ts` covers every fixture case from the plan plus one extra (mixed subtarefas-present/absent tarefas landing correctly in `total` vs `feitas`).
- `ProjetosSection.svelte`'s detail column now renders etapas as a `bits-ui` `Accordion.Root type="single"`, sorted by the row-level `etapas.ordem` field (never `etapasConfig.ordem`'s constant `10`), each row showing `ordem` (mono), `nome`, a thin luminosity-only progress bar, and an `N/M` counter — all derived from `progressoEtapa`, one source of truth.
- Opening an etapa renders that etapa's own tarefas inline: a disabled `Checkbox` reflecting `tarefaConcluida`, `titulo`, a prazo span styled `text-destructive` only per `vencido()`'s exact `!concluido` term, and a passive (non-button) subtarefa count `Badge` — intentionally inert pending Phase 20's `SubtarefasPanel` (NEST-05).
- "+ etapa" and "+ tarefa nesta etapa" both drive real, unmodified `EntityScreen` instances (`etapasConfig`/`tarefasConfig`) through two more independent hidden hosts (`etapaHostEl`/`tarefaHostEl`), each with `presetLinks` computed inline from the live `selectedProjetoId`/`openEtapaId` `$state` — never a stale snapshot.
- `web/e2e/projetos-section.spec.ts` grows from 5 to 12 tests, all green against the live hosted InstantDB backend, with a dedicated CLI-fixture chain (fundo-free projeto → two etapas created deliberately out of `ordem` order → tarefas covering all-done/mixed/no-subtarefas and overdue-done/overdue-not-done cases).

## Task Commits

Each task was committed atomically (both TDD):

1. **Task 1: projetosDerive.ts + etapas accordion** - `6ecf765` (test, RED), `cad30cd` (feat, GREEN)
2. **Task 2: inline tarefas list + "+ tarefa nesta etapa"** - `59e666c` (test, RED), `8f2b861` (feat, GREEN)

Follow-up cosmetic fix: `884178a` (style — indentation only, no behavior change).

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

_Note: both tasks are TDD — RED confirmed by actually deleting/never-having the implementation and observing the real failure (module-not-found for Task 1's unit tests; strict-timeout/element-not-found for Task 2's e2e assertions) before writing the GREEN implementation, per the plan's `tdd="true"` requirement on both tasks._

## Files Created/Modified
- `web/src/lib/sections/projetosDerive.ts` - New: pure `tarefaConcluida`/`progressoEtapa`/`vencido`, phase-local per 19-CONTEXT.md's explicit allowance ahead of Phase 21's canonical `dashboard/derive.ts`.
- `web/src/lib/sections/projetosDerive.test.ts` - New: `bun:test`, fixture-driven exactly like `bizdays.test.ts`, 12 passing cases.
- `web/src/lib/sections/ProjetosSection.svelte` - Etapas accordion (list view), inline tarefas list, two new hidden hosts (`etapaHostEl`, `tarefaHostEl`) and their bounded-poll open functions, two new header/content actions ("+ etapa", "+ tarefa nesta etapa").
- `web/e2e/projetos-section.spec.ts` - New `describe("etapas accordion (NEST-02)")` block (7 new tests) with its own CLI fixture chain and cleanup, plus `sweepLeftovers()` extended to also sweep leftover subtarefas/tarefas/etapas by prefix.

## Decisions Made
- `openEtapaId` uses `""` (empty string) as the "closed" sentinel rather than `null`, because the installed `bits-ui` `Accordion.Root` (`type="single"`) types `value` as `string` (default `""`) with no `collapsible` prop at all in this version — verified absent from `AccordionRootSinglePropsWithoutHTML` in `node_modules/bits-ui/dist/bits/accordion/types.d.ts`. `""` is falsy exactly like `null` for every `openEtapaId ? {...} : null` presetLinks check, so this has zero behavioral impact; single-open behavior itself only requires `type="single"`, which does not depend on `collapsible`.
- Prazo `text-destructive` e2e assertions use Playwright's `.toHaveClass(/text-destructive/)` directly on the tested `<span>`, rather than the plan-suggested `getComputedStyle(el).color` oklch-token comparison — the class lives directly on the asserted element (no ambiguity to resolve across light/dark), and this mirrors `entities-form-dialog-composition.spec.ts`'s existing simpler `.locator(".text-destructive")` precedent for the same kind of check. `getComputedStyle` remains reserved (as in `projetos-section.spec.ts`'s own pre-existing `project-item` selection test) for cases with no direct class to assert against (e.g. background-color highlighting).
- `openEtapaDialog` (the "+ etapa" host's dialog-opening function) reuses the exact same bounded-poll shape as Plan 19-01's `openProjetoDialog`, even though "+ etapa"'s own target (`entity-create-start`) does not strictly need polling — kept uniform across all three hidden hosts in this component for one consistent dialog-opening code path, per the user's explicit instruction to apply the same care documented in 19-01-SUMMARY.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `bits-ui`'s `Accordion.Content` stays mounted for every item regardless of open/closed state, breaking every per-etapa testid query once a project has more than one etapa**
- **Found during:** Task 2 GREEN implementation (first real e2e run of the new inline-tarefas tests failed with `strict mode violation: getByTestId('etapa-tarefas-list') resolved to 2 elements`, and `'+ tarefa nesta etapa'`'s test failed identically on `etapa-add-tarefa-start`)
- **Issue:** `bits-ui`'s `Accordion` (Radix-style) keeps every `Accordion.Item`'s `Content` mounted in the DOM at all times, height-animating collapsed items rather than unmounting them (never `display: none`). The original implementation rendered `etapa-tarefas-list`/`etapa-add-tarefa-start` unconditionally inside every etapa's `Accordion.Content`, so with 2 etapas both existed simultaneously — invisible to a human eye (one is height-collapsed) but not to Playwright's `getByTestId`, which matches DOM presence, not visibility, until an assertion explicitly checks it.
- **Fix:** Wrapped each `Accordion.Content`'s inline-tarefas markup in `{#if openEtapaId === etapa.id}...{/if}`, so only the actually-open etapa's tarefas list and "+ tarefa nesta etapa" button exist in the DOM at all.
- **Files modified:** `web/src/lib/sections/ProjetosSection.svelte`
- **Verification:** All 12 tests in `web/e2e/projetos-section.spec.ts` pass against the live hosted InstantDB backend; `bun run check`/`bun run lint` both clean.
- **Committed in:** `8f2b861` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness of every testid-scoped e2e assertion involving more than one etapa (the exact fixture shape this plan's own Task 1 introduced) — no scope creep, the fix only touches the guard around markup this plan itself added.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `projetosDerive.ts`'s three pure functions, the etapas accordion, and the inline tarefas list are all ready for Plan 19-03 ("etapas ▾" list/kanban toggle) to reuse directly — the kanban view reads from the exact same `etapasOrdenadas`/`progressoEtapa` data, no new query.
- The three hidden-EntityScreen hosts (`projetoHostEl`, `etapaHostEl`, `tarefaHostEl`) and their bounded-poll open functions are now an established, consistent three-of-a-kind pattern in this component; Plan 19-03 needs no new host for "Todas as tarefas" since that's a fully visible `EntityScreen` instance, not a hidden one.
- The subtarefa chip remains intentionally passive (non-button) per 19-CONTEXT.md's explicit deferral — Phase 20's `SubtarefasPanel` (NEST-05) wires the click later; no rework needed here.
- Per this plan's own scope boundary (and the user's explicit instruction), the following known, already-accepted deferred regressions from Plan 19-01 were NOT touched and remain Plan 19-04's scope: `entities-projeto-etapa-tarefa.spec.ts`'s `WEB-03` test (still assumes the old flat `EntityScreen` table for `nav-projetos`) and `shell-nav.spec.ts`'s `NAV-02` loop (still calls `gotoNested(page, "etapas")`). Neither was run as a gate for this plan; the targeted `projetos-section.spec.ts` run (12/12 passing) is this plan's own gate, consistent with 19-01-SUMMARY.md's documented precedent.

## Self-Check: PASSED

All created/modified files confirmed present on disk (`projetosDerive.ts`, `projetosDerive.test.ts`, `ProjetosSection.svelte`, `projetos-section.spec.ts`, this SUMMARY). All five task/RED/GREEN commit hashes (`6ecf765`, `cad30cd`, `59e666c`, `8f2b861`, `884178a`) confirmed present in `git log --oneline --all`.

---
*Phase: 19-projetos-section-master-detail*
*Completed: 2026-08-11*
