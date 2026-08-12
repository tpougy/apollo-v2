---
phase: 22-dashboard-kanbans-rotinas-heatmap
plan: 02
subsystem: ui
tags: [svelte5, tailwind, shadcn-select, playwright]

requires:
  - phase: 21-dashboard-shell-tickets-calendar
    provides: DASHBOARD_QUERY (single db.useQuery), derive.ts's rotinasPorFundo/cargaDoMes/faixaHeatmap/vencido, Dashboard.svelte's dash-placeholder-rotinas slot
  - phase: 22-dashboard-kanbans-rotinas-heatmap
    provides: "Plan 22-01's ProjectStrips.svelte and Dashboard.svelte edits (this plan builds on top of that same file, never reverting it)"
provides:
  - RoutinesByFundo.svelte -- fundo-grouped weekly routine cards with functional agrupar/ordenar/status controls
  - MonthHeatmap.svelte -- 7-column, 5-band monthly workload heatmap with dark-mode-aware tokens
  - Dashboard.svelte's dash-placeholder-rotinas slot fully replaced (last remaining Dashboard content gap closed)
affects: [23-focus-dialogs]

actuals:
  tokens: 7876
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Client-side re-sort/re-filter Select controls over an already-fetched, already-grouped array (agrupar/ordenar/status), mirroring ProjetosSection.svelte's groupBy idiom, with a deliberate one-item no-op Select for a grouping key that has no alternative this phase"
    - "Phase-local FAIXA_CLASSES lookup table pairing each intensity band's light Tailwind class with its dark: swap, verified against app.css's actual custom-property set rather than trusting a research-doc example verbatim"

key-files:
  created:
    - web/src/lib/dashboard/RoutinesByFundo.svelte
    - web/src/lib/dashboard/MonthHeatmap.svelte
  modified:
    - web/src/lib/dashboard/Dashboard.svelte
    - web/e2e/dashboard.spec.ts

key-decisions:
  - "Confirmed 22-RESEARCH.md's own Pattern 5 example was wrong: `text-destructive-foreground` names a CSS custom property that does not exist anywhere in web/src/app.css (only `--destructive` is defined, no `--color-destructive-foreground` in the @theme inline block). Used `text-background` for band 4 instead, per the plan-checker's confirmation and CONTEXT.md's own §0 token-discipline rule."
  - "'agrupar: fundo' renders as a real Select.Root with exactly one Select.Item -- a deliberate no-op selection over a one-item set, since fundo grouping already arrives pre-computed via rotinasPorFundo and no other grouping key exists this phase. Documented per CONTEXT.md's explicit instruction that omitting the control outright is not acceptable even though it has nothing non-trivial to select."
  - "Renamed the local status-filter $state variable from `status` to `statusFiltro` in RoutinesByFundo.svelte -- biome's lint/suspicious/noGlobalAssign rule flags any local reassignment named `status` as shadowing the DOM `window.status` global. Purely a variable-name fix (Rule 3 -- blocking lint failure); the rendered testid/label text ('status: todas' / 'status: atrasadas') is byte-identical to what the plan specified."
  - "Added an aria-label to every dash-heatmap-cell button (Rule 2 -- missing accessibility attribute), since the cell is deliberately rendered with zero visible text content and svelte-check's a11y linter flags a button with neither text nor an aria-label. The label conveys the day + afazeres count (or 'fim de semana') without adding any visible digit, so it does not violate the 'no number rendered' rule -- aria-label is accessible-tree-only, never painted."
  - "e2e fixture for the ordenar-control test uses a SEPARATE, dedicated fundo/template with exactly 3 instances (all <= the 4-row cap) rather than reusing the 5-instance overflow-testing fundo, so the reversed row order can be asserted as an exact full-list reversal without the 4-row cap silently dropping the earliest/latest instance from view."
  - "e2e fixture for the 'vencida' instance robustly handles the one calendar edge case where no day in the current week's own window is strictly earlier than today (i.e. when the suite happens to run on that week's own Monday): the vencida-specific assertions call test.skip() with a documented reason rather than asserting on a day rotinasPorFundo's window cannot supply. Every other DASH-04 rotinas assertion (grouping order, 4-row cap, template.nome label, ordenar) is unaffected by this edge case and always runs."
  - "Confirmed derive.ts and dashboardQuery.ts remain byte-for-byte unchanged (git diff --stat shows neither file) -- template.nome surfaces purely via a Dashboard.svelte-local dadosNormalizados addition, exactly as the plan's key_links specified."

patterns-established:
  - "Weekend-of-month is computed as a 1-line phase-local helper (new Date(iso).getUTCDay() in [0,6]) rather than reaching for bizdays.ts or adding a derive.ts export -- derive.ts's own weekend-related output (semanaUtil's sabado/domingo) is scoped to one week, not a month, and this is a single-component concern."

requirements-completed: [DASH-04]

coverage:
  - id: D1
    description: "This week's routine instances group into cards by fundo via rotinasPorFundo, with 'Sem fundo vinculado' always rendered last regardless of the agrupar/ordenar/status controls' current values"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: rotinas by fundo > fundo-grouping order: 'Sem fundo vinculado' card is always last"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each fundo card shows up to 4 routine rows plus a '+N' overflow row when it has more"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: rotinas by fundo > the 5-instance fundo's card caps at 4 rotinas-row plus one +1 rotinas-overflow"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each row's bolinha is bg-destructive only when derive.ts's vencido() says that instance is overdue, and bg-muted-foreground otherwise -- never derived from a status string"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: rotinas by fundo > a vencida instance's bolinha is bg-destructive; a not-vencida one is bg-muted-foreground"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each routine row shows a human-readable label sourced from that instance's template.nome, not the instancia id"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: rotinas by fundo > each rotinas-row shows the linked template's nome, not the instancia id"
        status: pass
    human_judgment: false
  - id: D5
    description: "status: atrasadas filters to only overdue rows within a fundo card, over the same already-fetched data (no new query); status: todas restores every row"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: rotinas by fundo > status: atrasadas leaves only the vencida row visible; status: todas restores every row"
        status: pass
    human_judgment: false
  - id: D6
    description: "ordenar: data (mais distante) reverses a fundo group's own row order by dataPrevista, over the same already-fetched data"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: rotinas by fundo > ordenar: data (mais distante) reverses the fundo group's row order"
        status: pass
    human_judgment: false
  - id: D7
    description: "agrupar/ordenar/status are all present as real, wired Select.Root controls"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: rotinas by fundo > agrupar/ordenar/status controls are all present, real Select.Root triggers"
        status: pass
    human_judgment: false
  - id: D8
    description: "The monthly heatmap's 5 fixed intensity bands (0 / 1-2 / 3-4 / 5-7 / 8+) render using only bg-muted/bg-chart-1/bg-chart-2/bg-chart-4/bg-destructive (plus opacity variants), each with the correct dark: chart-token swap"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: month heatmap > each of days A-E's dash-heatmap-cell carries its exact expected FAIXA_CLASSES string"
        status: pass
    human_judgment: false
  - id: D9
    description: "Weekend cells always render bg-muted/40 regardless of their own carga count and show no visible number"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: month heatmap > the identified weekend day's cell always carries bg-muted/40 with no visible text, despite its 3 seeded tarefas"
        status: pass
    human_judgment: false
  - id: D10
    description: "A 'tranquilo -> carregado' legend is always visible"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: month heatmap > dash-heatmap-legend is always visible and mentions both tranquilo and carregado"
        status: pass
    human_judgment: false
  - id: D11
    description: "Every heatmap cell resolves to a real <button> tagName"
    requirement: "DASH-04"
    verification:
      - kind: e2e
        ref: "dashboard.spec.ts#DASH-04: month heatmap > every dash-heatmap-cell resolves to a real <button> tagName"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-08-12
status: complete
---

# Phase 22 Plan 2: RoutinesByFundo + MonthHeatmap Summary

**Fundo-grouped weekly routine cards with functional agrupar/ordenar/status controls, plus a 5-band monthly workload heatmap with dark-mode-aware tokens -- closing the Dashboard's last content gap.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-08-12T03:05:00Z
- **Completed:** 2026-08-12T03:45:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `RoutinesByFundo.svelte` renders `rotinasPorFundo`'s already-grouped, already-ordered `Grupo[]` as light `border` + `bg-card/60` cards (never solid `Card`), capped at 4 rows per fundo plus a `+N` overflow row, "Sem fundo vinculado" always last -- proven live via a 5-instance fixture fundo plus a separately-templated no-fundo instance.
- Bolinha color is driven entirely by `derive.ts`'s already-shipped `vencido()` (never a status string): `bg-destructive` for an overdue instance, `bg-muted-foreground` otherwise.
- `agrupar`/`ordenar`/`status` all render as real, wired `Select.Root` controls (mirroring `ProjetosSection.svelte`'s established idiom) that re-sort/re-filter the same already-fetched data client-side -- zero new query. `ordenar` provably reverses row order; `status: atrasadas` provably narrows to only overdue rows.
- `Dashboard.svelte`'s `dadosNormalizados.instanciasRotina` mapping now also carries `template.nome` -- the one field needed to give each routine row a human-readable label -- with zero changes to `derive.ts` or `dashboardQuery.ts`'s `DASHBOARD_QUERY` (confirmed via `git diff --stat`, neither file appears).
- `MonthHeatmap.svelte` renders a 7-column grid over `cargaDoMes`'s `Map<isoDate, number>`, bucketed by the already-shipped `faixaHeatmap`, using a fixed `FAIXA_CLASSES` lookup that matches spec-ui.md section 6's token table exactly, with the correct `dark:` chart-token swap (chart-1↔chart-5, chart-2↔chart-4) per band. Weekend cells always override to `bg-muted/40` with no visible digit; a "tranquilo → carregado" legend is always visible; every cell is a real, `aria-label`led `<button>`.
- Both new components are pure presentational leaves: neither imports `"../db"` nor calls `db.useQuery`/any `derive.ts` grouping function directly -- `Dashboard.svelte` computes `rotinaGrupos`/`rotinaNomeById`/`carga`/`anoMes` and passes them down as props, exactly like Plan 22-01's `ProjectStrips.svelte` and Phase 21's `WeekCalendar.svelte`/`TicketQueue.svelte`.

## Task Commits

Each task was committed atomically:

1. **Task 1: RoutinesByFundo.svelte -- fundo-grouped cards, bolinha, agrupar/ordenar/status controls, wired end-to-end** - `2742585` (feat)
2. **Task 2: MonthHeatmap.svelte -- 5-band grid with dark-mode token swap, weekend override, legend, wired end-to-end** - `1fa83ee` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `web/src/lib/dashboard/RoutinesByFundo.svelte` - New leaf component: fundo-grouped cards, 4-row cap + overflow, vencido()-driven bolinha, agrupar/ordenar/status Select controls
- `web/src/lib/dashboard/MonthHeatmap.svelte` - New leaf component: 7-column heatmap grid, FAIXA_CLASSES token lookup with dark: swaps, weekend override, legend, aria-labelled cells
- `web/src/lib/dashboard/Dashboard.svelte` - Added `template.nome` to `dadosNormalizados`, `rotinaGrupos`/`rotinaNomeById`/`anoMes`/`carga` derived values, mounted both new components inside the existing `dash-placeholder-rotinas` slot
- `web/e2e/dashboard.spec.ts` - Two new `test.describe` blocks: "DASH-04: rotinas by fundo" (7 tests) and "DASH-04: month heatmap" (4 tests), both using CLI/admin-fixture-seeded live data

## Decisions Made
- **spec-ui.md §6 token correction (locked by the plan-checker before execution):** 22-RESEARCH.md's own Pattern 5 code example used `text-destructive-foreground`, a CSS custom property that does not exist anywhere in `web/src/app.css`. Used `text-background` for band 4 instead -- already-defined, already-used at the equivalent band-3 spot, correctly differing between light/dark `app.css` blocks with zero extra `dark:` override needed.
- **`agrupar: fundo` as a deliberate one-item no-op Select:** fundo grouping already arrives pre-computed via `rotinasPorFundo`; there is no second grouping key to switch to this phase. Rendered as a real `Select.Root`/`Select.Item` anyway, per CONTEXT.md's explicit instruction that omitting the control outright is unacceptable even though its option set is trivial.
- **`status` → `statusFiltro` rename (Rule 3, blocking lint fix):** biome's `lint/suspicious/noGlobalAssign` rejected a local `$state` variable named `status` because it shadows/reassigns the DOM `window.status` global. Renamed the internal variable only; every rendered testid/label string is unchanged.
- **aria-label on heatmap cells (Rule 2, accessibility):** `svelte-check`'s a11y linter (`a11y_consider_explicit_label`) flagged `dash-heatmap-cell` buttons for having neither visible text nor an accessible label, since the cell is intentionally rendered with zero text content. Added a conditional `aria-label` (day + count, or "fim de semana") that satisfies the linter without painting any visible digit -- the "no number rendered" rule governs visible content, not the accessibility tree.
- **Ordenar-test fixture isolation:** the e2e test proving `ordenar: data (mais distante)` reverses row order uses a dedicated fundo/template with exactly 3 instances (under the 4-row cap), rather than reusing the 5-instance overflow-testing fixture, so the assertion can compare an exact full-list reversal without the cap dropping an instance from view mid-comparison.
- **Vencida-fixture Monday edge case:** the "vencida bolinha" and "status: atrasadas" e2e tests compute whether any day in `computeSemana()`'s own 7-key window is strictly earlier than `hojeIso()` (true every day except when the suite happens to run on that week's own Monday) and `test.skip()` with a documented reason in that one edge case, rather than asserting on a day `rotinasPorFundo`'s window filter cannot supply. All other DASH-04 rotinas assertions are unaffected and always run. (On this execution, today was a Wednesday, so both tests ran and passed.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed local `status` variable to `statusFiltro`**
- **Found during:** Task 1 (`bun run lint` after writing `RoutinesByFundo.svelte`)
- **Issue:** biome's `lint/suspicious/noGlobalAssign` rule failed the lint gate: a local `$state<StatusFilter>` variable named `status` shadows/reassigns the `window.status` DOM global.
- **Fix:** Renamed the variable to `statusFiltro` throughout the component. No rendered text, testid, or behavior changed.
- **Files modified:** `web/src/lib/dashboard/RoutinesByFundo.svelte`
- **Verification:** `bun run lint` clean; DASH-04 rotinas e2e tests re-verified passing.
- **Committed in:** `2742585` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added aria-label to heatmap cells**
- **Found during:** Task 2 (`bun run check` after writing `MonthHeatmap.svelte`)
- **Issue:** `svelte-check`'s a11y rule (`a11y_consider_explicit_label`) flagged every `dash-heatmap-cell` button for having no text content and no accessible label -- a real accessibility gap for a purely color-coded interactive grid.
- **Fix:** Added a conditional `aria-label` (`"{iso}: {n} afazeres"` or `"{iso}: fim de semana"`) -- accessible-tree-only, never painted, so the "no visible number" rule is untouched.
- **Files modified:** `web/src/lib/dashboard/MonthHeatmap.svelte`
- **Verification:** `bun run check` clean (0 errors, only the pre-existing unrelated `EntityScreen.svelte` warning remains); DASH-04 heatmap e2e tests re-verified passing.
- **Committed in:** `1fa83ee` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking lint fix, 1 missing-accessibility fix)
**Impact on plan:** Both fixes are mechanical/correctness-only -- zero change to any locked testid, rendered text, or behavior in `must_haves.truths`. No scope creep.

## Issues Encountered
- Two e2e failures appeared during the phase-wide full-suite run (`bun run test:e2e`, all 3 projects): `dashboard-kanbans.spec.ts`'s "a projeto with zero etapas never gets a strip" (a `sweepLeftovers()` CLI call hit a transient `_ssl.c:993 handshake timeout` reaching the InstantDB-backed CLI) and `tickets-section.spec.ts`'s xor-parent-type test (a `link-ticket` Select population timing issue). Neither touches any file this plan modified. Both were re-run in isolation immediately afterward and passed; a second full 3-project suite run (122/122) also passed clean with zero failures, confirming both were transient/pre-existing flakiness (the same class of issue Plan 22-01's own SUMMARY documented for a different test in this suite), not a regression introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `RoutinesByFundo.svelte`, `MonthHeatmap.svelte`, and `dash-placeholder-rotinas` are complete; combined with Plan 22-01's `ProjectStrips.svelte`/`dash-placeholder-projetos`, Phase 22's entire Dashboard content surface is now real, live data (no placeholders remain anywhere in `Dashboard.svelte`).
- Every click target this plan renders (`rotinas-fundo-titulo`, `rotinas-row`, `dash-heatmap-cell`) is a real `<button>` with no `onclick` yet, per CONTEXT.md's explicit "click targets stay inert this phase" instruction -- ready for Phase 23 to wire dialogs 2 (Dia), 5 (Fundo), and 7 (Rotina) without touching this plan's grouping/filtering/banding logic.
- `derive.ts` and `dashboardQuery.ts` remain byte-for-byte unchanged from Phase 21 across both of Phase 22's plans -- confirmed via `git diff --stat` after each task.
- The previously-flagged `DASHBOARD_QUERY` subtarefas-on-nested-tarefas gap (documented in 22-01-SUMMARY.md, affecting `ProjectStrips.svelte`'s `tarefaConcluida()`) was out of scope for this plan's declared `files_modified` and was not touched -- still flagged for a future phase if it becomes user-visible.

---
*Phase: 22-dashboard-kanbans-rotinas-heatmap*
*Completed: 2026-08-12*

## Self-Check: PASSED

All created files exist on disk (`web/src/lib/dashboard/RoutinesByFundo.svelte`,
`web/src/lib/dashboard/MonthHeatmap.svelte`, `web/e2e/dashboard.spec.ts`,
`web/src/lib/dashboard/Dashboard.svelte`, this SUMMARY.md) and both task commits
(`2742585`, `1fa83ee`) are present in `git log`.
