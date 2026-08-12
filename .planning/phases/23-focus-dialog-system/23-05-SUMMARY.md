---
phase: 23-focus-dialog-system
plan: 05
subsystem: ui
tags: [svelte5, bits-ui, dialog, entityscreen, dashboard, playwright]

# Dependency graph
requires:
  - phase: 23-01
    provides: "FocusDialog.svelte's shared S/M/L chrome wrapper; Dashboard.svelte's dialogStack/DialogKind/openDialog/popToFirst/closeAllDialogs/activeDialogRef mechanism (DialogKind already pre-declared \"fundo\")"
  - phase: 23-02
    provides: "derive.ts's rotinasDoFundo(instancias, fundoId) -- the week-unbounded fundo filter this plan's FundoDialog.svelte calls directly"
  - phase: 23-04
    provides: "Dashboard.svelte's now-established derived-state patterns (fundoByProjetoId-style joins, activeX $derived.by lookups) reused for fundoDialogProjetos/fundoDialogTickets"
provides:
  - "FundoDialog.svelte: dialog #5 of 7 (M), the one dialog that imports and calls a derive.ts export directly (rotinasDoFundo) rather than receiving an already-filtered list"
  - "Dashboard.svelte's dialogStack chain now covers 5 of 7 kinds (ticket, dia, rotina, tarefa, fundo)"
  - "RoutinesByFundo.svelte's rotinas-fundo-titulo/rotinas-row and ProjectStrips.svelte's project-strip-fundo-badge fully wired, closing items #7 and #10-11 of the Exhaustive Inert-Button Inventory"
  - "A proven, tested null-fundo no-op guard pattern (belt at openFundoDialog itself, suspenders at each call site) for any future fundo-targeting click surface"
affects: [23-06, 23-07]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 7505
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One dialog (FundoDialog) deliberately calls a derive.ts pure export (rotinasDoFundo) directly instead of receiving an already-filtered list from its host -- the week-unbounded filter is a pure, host-agnostic rule, unlike every other dialog's host-owned lookup/join."
    - "Belt-and-suspenders null-fundo guard: the Dashboard-level open*Dialog function no-ops on a falsy id (belt), AND every individual call site's own onclick also guards independently (suspenders) -- two redundant layers rather than relying on either alone."
    - "Null-guarded onclick via ternary-to-undefined (`cond ? handler : undefined`) is this phase's established idiom for a button that must stay a real, focusable <button> (spec's literal per-surface requirement) while being a documented no-op for one specific data state ('Sem fundo vinculado')."

key-files:
  created:
    - web/src/lib/dashboard/dialogs/FundoDialog.svelte
    - web/e2e/focus-dialog-fundo.spec.ts
  modified:
    - web/src/lib/dashboard/Dashboard.svelte
    - web/src/lib/dashboard/RoutinesByFundo.svelte
    - web/src/lib/dashboard/ProjectStrips.svelte
    - web/src/lib/dashboard/derive.ts

key-decisions:
  - "Widened derive.ts's module-local InstanciaAgendaLike interface to add an optional `nome` field on `template` (Deviation Rule 1/2, auto-fixed during Task 1's own `bun run check` run). FundoDialog.svelte's plan-specified prop type declares `template: { nome: string; fundo: {...} | null } | null`, but `rotinasDoFundo`'s return type is fixed to `InstanciaAgendaLike[]` -- which, before this widening, had no top-level `nome` on `template` (only `template.fundo.nome`). Calling `rotinasDoFundo(instanciasRotina, fundoId)` and then reading `instancia.template?.nome` on the result failed to type-check. Added `nome?: string` (optional, so `agendaPorDia`/`rotinasPorFundo`'s existing call sites that never supply it stay structurally compatible -- zero behavior change, zero new query) rather than casting the call result or exporting a wider type, since this is the minimal, most reusable fix and matches the exact 'widen too-narrow local TS type, add zero new query' precedent Plan 23-01/23-04 already established for sibling fields."
  - "RoutinesByFundo.svelte's `rotinas-fundo-titulo` and ProjectStrips.svelte's `project-strip-fundo-badge` both use a non-null assertion (`grupo.fundoId!` / `projeto.fundo!.id`) inside their guarded onclick closures -- TypeScript's control-flow narrowing on a truthy ternary check (`grupo.fundoId ? () => onOpenFundo(grupo.fundoId!) : undefined`) does not propagate through to a nested arrow function body for a property access (only local `const`/`let` bindings narrow that way), so the assertion is needed even though the runtime guard already guarantees non-null at the point of the call. This is provably safe (the ternary's condition and the assertion read the exact same expression) and required zero behavior change from the plan's literal pseudocode -- purely a TS-narrowing technicality."
  - "e2e test (d)'s 'Sem fundo vinculado' card is forced into existence via a dedicated no-fundo rotina template + one in-week seeded instance, rather than relying on any pre-existing null-fundo data possibly already in the live app -- guarantees the test is deterministic regardless of what other fixtures/leftovers exist at run time, per this task's 'resolve ambiguity, document the call' instruction (the plan's own text says this card is 'present whenever any rotina lacks a fundo,' which this fixture satisfies unconditionally rather than conditionally)."

patterns-established: []

requirements-completed: [DLG-01, DLG-02]

coverage:
  - id: D1
    description: "Clicking a fundo's title in the routines-by-fundo card, or a fundo badge on a project strip, opens the Fundo dialog for that exact fundo -- showing EVERY rotina belonging to it (not just this week's), plus every projeto and ticket vinculado, all read from already-fetched data with zero new query"
    requirement: "DLG-01"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-fundo.spec.ts#(a) rotinas-fundo-titulo opens the Fundo dialog at M width containing both rotina instances (in-week and weeks-out), the linked projeto, and the linked ticket"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-fundo.spec.ts#(b) project-strip-fundo-badge for the same projeto opens the identical Fundo dialog (same fundo id, same content)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Neither fundo-badge nor fundo-titulo ever opens a dialog for the 'Sem fundo vinculado' case (a null/empty fundo id) -- clicking that specific control is a documented no-op, never a broken/blank dialog"
    requirement: "DLG-01"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-fundo.spec.ts#(c) the no-fundo projeto's fundo-badge is a real <button> but clicking it opens no dialog at all"
        status: pass
      - kind: e2e
        ref: "web/e2e/focus-dialog-fundo.spec.ts#(d) rotinas-fundo-titulo for the 'Sem fundo vinculado' card is likewise a no-op"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clicking a routine row inside a fundo card opens the Rotina dialog for that exact instance without also opening the enclosing card's Fundo dialog (stopPropagation)"
    requirement: "DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-fundo.spec.ts#(e) a rotinas-row click opens the Rotina dialog for that exact instance, and the enclosing Fundo dialog never also opens"
        status: pass
    human_judgment: false
  - id: D4
    description: "FundoDialog's editar/ver-pagina both function against the real fundos EntityScreen edit form and the real nav-fundos route, with zero duplicated markup"
    requirement: "DLG-01, DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/focus-dialog-fundo.spec.ts#(f) editar drives EntityScreen(fundos)'s real edit form; ver-pagina navigates to nav-fundos"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dashboard.svelte's dialogStack chain now covers 5 of 7 kinds; zero regression to the pre-existing dashboard.spec.ts/dashboard-kanbans.spec.ts suites this plan's RoutinesByFundo.svelte/ProjectStrips.svelte edits touch"
    requirement: "DLG-01, DLG-02"
    verification:
      - kind: e2e
        ref: "web/e2e/dashboard.spec.ts (22 tests, all pass)"
        status: pass
      - kind: e2e
        ref: "web/e2e/dashboard-kanbans.spec.ts (7 tests, all pass)"
        status: pass
      - kind: other
        ref: "cd web && bun run check (0 errors, 2 pre-existing warnings unrelated to this plan)"
        status: pass

duration: 35min
completed: 2026-08-12
status: complete
---

# Phase 23 Plan 5: Fundo Dialog + Remaining Fundo-Targeting Wiring Summary

**`FundoDialog.svelte` (M) built as the one dialog in this phase that calls `derive.ts`'s `rotinasDoFundo` directly over the host's already-fetched, unfiltered `instanciasRotina` array, then wired into `Dashboard.svelte`'s dialog-stack chain and both remaining fundo-targeting click surfaces (`RoutinesByFundo.svelte`'s `rotinas-fundo-titulo`/`rotinas-row`, `ProjectStrips.svelte`'s `project-strip-fundo-badge`) -- with an explicit, e2e-proven belt-and-suspenders null-fundo no-op guard.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `FundoDialog.svelte` (M): self-contained per the established pattern, but the one dialog that imports `rotinasDoFundo` from `../derive` and calls it directly on the full, week-unbounded `instanciasRotina` prop -- computing `rotinas`/`projetosVinculados`/`ticketsVinculados` as three `$derived` values. No `breadcrumb` prop (Fundo is always depth-1, per CONTEXT.md's locked depth-cap-2 decision -- only Projeto and Dia ever open a second level). Title = `fundoNome`; contexto = `${rotinas.length} rotinas · ${projetosVinculados.length} projetos · ${ticketsVinculados.length} tickets`. Three read-only lists (`fundo-dialog-rotinas`/`fundo-dialog-projetos`/`fundo-dialog-tickets`), each a plain row (never a button, since Fundo is always a leaf), each with an empty-state message. "editar" drives `fundosConfig`'s own hidden `EntityScreen` host via the same bounded-poll row-edit-click pattern every other dialog in this phase uses. "ver na página completa" clicks `nav-fundos` then closes.
- `Dashboard.svelte`: `openFundoDialog` (defensive no-op guard on falsy `id` -- belt), `fundoNomeFor` (looks up `query.data.fundos` by id), `fundoDialogProjetos`/`fundoDialogTickets` (built from already-fetched `projetoRows()`/`ticketRows()`, zero new query). New `{:else if activeDialogRef?.kind === "fundo"}` render branch, passing `dadosNormalizados.instanciasRotina` unchanged (structural typing accepts it against `FundoDialog`'s prop type with zero cast). `onOpenFundo={openFundoDialog}` wired into both `<RoutinesByFundo>` and `<ProjectStrips>` mounts; `onOpenRotina={openRotinaDialog}` (already defined in Plan 23-04) wired into `<RoutinesByFundo>`.
- `RoutinesByFundo.svelte`: new `onOpenFundo`/`onOpenRotina` props. `rotinas-fundo-titulo`'s `onclick` is `grupo.fundoId ? () => onOpenFundo(grupo.fundoId!) : undefined` -- a real, focusable `<button>` for every group including "Sem fundo vinculado," but a documented no-op click for that specific null-fundo case (suspenders). `rotinas-row`'s `onclick` now calls `e.stopPropagation()` then `onOpenRotina(instancia.id)`.
- `ProjectStrips.svelte`: new `onOpenFundo` prop. `project-strip-fundo-badge`'s `onclick` is `projeto.fundo?.id ? (e) => { e.stopPropagation(); onOpenFundo(projeto.fundo!.id); } : undefined` -- same null-guard, plus `stopPropagation` since the badge sits inside `project-strip-header` alongside other clickable siblings.
- `derive.ts`: widened the module-local `InstanciaAgendaLike` interface's `template` to add an optional `nome?: string` field (Deviation, documented below) -- needed for `FundoDialog.svelte`'s read-only rotina list to render `instancia.template?.nome` on `rotinasDoFundo`'s return value.
- `web/e2e/focus-dialog-fundo.spec.ts`: 6 new tests (a-f), all green, proving DLG-01/DLG-02 end-to-end for the Fundo dialog and both of its remaining click surfaces, including the null-fundo no-op guard on both surfaces and `rotinas-row`'s `stopPropagation`.

## Task Commits

Each task was committed atomically:

1. **Task 1: FundoDialog.svelte** - `f23e010` (feat)
2. **Task 2: Dashboard.svelte "fundo" branch, RoutinesByFundo.svelte, ProjectStrips.svelte wiring** - `b31d395` (feat)
3. **Task 3: e2e coverage** - `cc60d01` (test)

**Plan metadata:** (pending -- this SUMMARY's own commit)

## Files Created/Modified

- `web/src/lib/dashboard/dialogs/FundoDialog.svelte` - dialog #5 of 7, calls `rotinasDoFundo` directly (new)
- `web/src/lib/dashboard/Dashboard.svelte` - `openFundoDialog`/`fundoNomeFor`/`fundoDialogProjetos`/`fundoDialogTickets`, `fundo` render branch, `onOpenFundo`/`onOpenRotina` wiring
- `web/src/lib/dashboard/RoutinesByFundo.svelte` - `onOpenFundo`/`onOpenRotina` props, `rotinas-fundo-titulo`/`rotinas-row` wiring
- `web/src/lib/dashboard/ProjectStrips.svelte` - `onOpenFundo` prop, `project-strip-fundo-badge` wiring
- `web/src/lib/dashboard/derive.ts` - widened `InstanciaAgendaLike.template` to add optional `nome`
- `web/e2e/focus-dialog-fundo.spec.ts` - new standalone e2e spec (new)

## Decisions Made

- **Ambiguity resolution** (per this task's "resolve using plan text/CONTEXT/RESEARCH/spec-ui.md" instruction): the plan's literal `<action>` text for Task 1 declares `FundoDialog`'s `instanciasRotina` prop type with `template: { nome: string; ... }`, but calling `rotinasDoFundo` (whose return type is `derive.ts`'s own fixed, module-local `InstanciaAgendaLike[]`) on that prop loses the `nome` field at the type level, since `InstanciaAgendaLike.template` had no top-level `nome` before this plan. Resolved by widening `InstanciaAgendaLike.template` to add `nome?: string` (optional, so no existing caller of `agendaPorDia`/`rotinasPorFundo` is affected) rather than casting `rotinasDoFundo`'s return value or exporting a second, wider type -- the minimal fix, matching the exact "widen too-narrow local TS type, zero new query" precedent Plans 23-01/23-04 already established. Documented as Deviation Rule 1/2 below.
- Followed the plan's literal `grupo.fundoId ? () => onOpenFundo(grupo.fundoId) : undefined` / `projeto.fundo?.id ? (e) => {...} : undefined` pseudocode exactly, adding only the non-null assertions (`!`) TypeScript's control-flow narrowing requires for a property access read a second time inside a nested closure (the ternary condition and the assertion read the identical expression, so this is provably safe, not a behavior change).
- e2e test (d)'s "Sem fundo vinculado" card is forced into existence via a dedicated no-fundo `rotina template` + one in-week seeded instance (rather than assuming pre-existing null-fundo data), so the test is deterministic regardless of what other data exists in the live app at run time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Too-narrow local TS type] Widened `derive.ts`'s `InstanciaAgendaLike.template` to add optional `nome`**
- **Found during:** Task 1's own `<verify>` (`bun run check`), immediately after writing `FundoDialog.svelte`
- **Issue:** `rotinasDoFundo`'s return type is fixed to `InstanciaAgendaLike[]`, whose `template` field (before this plan) was `{ fundo: { id: string; nome: string } | null } | null}` -- no top-level `nome`. `FundoDialog.svelte`'s read-only rotina list reads `instancia.template?.nome ?? "Rotina"` on the array `rotinasDoFundo` returns, which failed to type-check (`Property 'nome' does not exist...`).
- **Fix:** Added `nome?: string` (optional) to `InstanciaAgendaLike.template` in `derive.ts`. Optional means every existing caller (`agendaPorDia`, `rotinasPorFundo`) that never supplies it stays structurally compatible -- zero behavior change, zero new query, verified by re-running the full 35-test `derive.test.ts` suite (all pass).
- **Files modified:** `web/src/lib/dashboard/derive.ts`
- **Verification:** `bun run check` (0 errors); `bun test src/lib/dashboard/derive.test.ts` (35/35 pass).
- **Committed in:** `f23e010` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1/2 -- too-narrow type, matching the plan's own precedent for a sibling field).
**Impact on plan:** Pure type-widening, zero behavior change to any other consumer of `InstanciaAgendaLike`. No scope creep.

## Issues Encountered

One transient, non-reproducible network handshake timeout (`_ssl.c:993: The handshake operation timed out`) occurred on the first `bunx playwright test` run, in the CLI's call to the live InstantDB admin API during test (f)'s setup -- not caused by any code in this plan. A second run of the identical command passed cleanly (6/6), and the full regression gate (`focus-dialog-fundo.spec.ts` + `dashboard.spec.ts` + `dashboard-kanbans.spec.ts`, 35 tests) subsequently passed with zero failures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard.svelte's `dialogStack` chain now covers 5 of 7 kinds (ticket, dia, rotina, tarefa, fundo). Only `projeto` (L) and `etapa` (already built in Plan 23-03 but its Dashboard-level wiring, if any remains, is out of this plan's scope) remain to close out the full 7-dialog system, per Plan 23-06/23-07.
- `FundoDialog.svelte`'s self-contained pattern (own hidden edit host, own nav-click "ver na página completa," direct `derive.ts` import) is available as precedent for any future dialog that similarly needs a pure, host-agnostic derivation applied directly rather than received pre-filtered.
- No blockers.

---
*Phase: 23-focus-dialog-system*
*Completed: 2026-08-12*

## Self-Check: PASSED
