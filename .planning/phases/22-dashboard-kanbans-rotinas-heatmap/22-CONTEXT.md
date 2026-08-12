# Phase 22: Dashboard Kanbans, Rotinas & Heatmap - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Users see every in-progress project as a mini-kanban strip that never compresses, this week's
routines grouped by fundo with working display controls, and a full month's workload heatmap
using only the project's existing grayscale tokens — completing the Dashboard's content.

</domain>

<decisions>
## Implementation Decisions

Binding spec: `/home/thomaz/pessoal/apollo-v2/spec-ui.md` §3.4 (rotinas + heatmap), §3.5
(mini-kanbans, "the most repeated error in the wireframe" — read this section extremely
carefully), §5 (derive.ts functions, already shipped in Phase 21), §6 (heatmap tokens), §0
throughout.

- **Data/logic already shipped in Phase 21** — this phase is pure UI consuming already-correct,
  already-unit-tested pure functions: `rotinasPorFundo`, `cargaDoMes`, `faixaHeatmap` all exist in
  `web/src/lib/dashboard/derive.ts`. Do not reimplement grouping/bucketing logic in a component —
  call the existing functions.
- **`ProjectStrips` (mini-kanbans, DASH-05)** — one strip per in-progress project, stacked
  vertically, each: header (collapse chevron, project name — inert button this phase, dialog nº 4
  is Phase 23's job — badge of fundo — inert this phase too, `N etapas · N tarefas`), body =
  columns per `etapas.ordem` ascending, cards = that etapa's tasks capped at 3 + `+N`. **Hard
  rule from spec §3.5 (explicitly called out as the most-repeated wireframe mistake): columns
  have FIXED width (`w-36` per spec) and box-sizing border-box — NEVER compress to fit more
  columns.** The strip itself is `overflow-x-auto` with `scroll-snap-type: x proximity`. The `›`
  continuation indicator is `position: absolute` at the strip's right edge, outside the flow, and
  rendered *only* when `scrollWidth > clientWidth` is genuinely measured (not inferred from data
  — e.g. via a resize-observed ref, checked after mount/update), never a static boolean derived
  from column count. All columns in one strip share height = the fullest column up to the 3-card
  cap — short columns get empty space, never shrink the strip.
- **Collapse persistence**: `localStorage['apollo.dash.collapsed.<projetoId>']` only — no other
  key touched, no new localStorage-wide utility introduced beyond what this one feature needs.
- **`RoutinesByFundo` (DASH-04, rotinas half)**: light/transparent cards (`border` thin +
  `bg-card/60`, explicitly NOT solid `Card` — visual weight belongs to the week band) grouping
  this week's routine instances by fundo via the already-shipped `rotinasPorFundo`, up to 4 per
  card + `+N`, "Sem fundo vinculado" always last (already guaranteed by the pure function — this
  phase just renders in that order). Controls `agrupar: fundo ▾ / ordenar: data ▾ / status ▾`
  must be present and functionally real (client-side re-sort/re-filter of already-fetched data —
  no new query), per spec's explicit instruction that omitting them is not acceptable even though
  "fundo" grouping is the only one wired to non-trivial logic this phase — "ordenar"/"status" can
  be simple client-side reorders/filters over the same array. Bolinha/status dot: `bg-muted-
  foreground` normal, `bg-destructive` when `vencido()` (already-shipped pure function) says so —
  never derived from a status string.
- **`MonthHeatmap` (DASH-04, heatmap half)**: 7×5-6 grid, `aspect-square rounded-sm gap-1`, using
  the already-shipped `cargaDoMes`/`faixaHeatmap` for bucketing. Token mapping is spec §6's exact
  table (0→`bg-muted`, 1-2→`bg-chart-1/40`, 3-4→`bg-chart-2/70`, 5-7→`bg-chart-4`+`text-
  background`, 8+→`bg-destructive`+`text-destructive-foreground`) — no new color, no gradient
  library. Weekend cells `bg-muted/40`, no number rendered. Legend "tranquilo → carregado" always
  visible. Dark mode: spec says "invert the ramp (chart-5→chart-1) keeping contrast, no new
  token" — apply via existing dark-mode CSS custom properties already defined in `app.css`, not a
  new token.
- **Click targets stay inert this phase** (Phase 23 wires all dialogs): project name/fundo
  badge/column header/card/fundo card title/routine row/heatmap cell should render as real
  `<button>` elements (spec §4's "toda superfície clicável é `<button>` real" applies to the
  *element type*, satisfied now) but with no `onclick` handler yet, or a no-op — do not fake a
  dialog.
- **Empty states**: "Nenhum projeto em andamento" + link to Projetos section, per spec §3.5.

### Claude's Discretion

Exact component file split (spec §8 anticipates `ProjectStrips.svelte`, `RoutinesByFundo.svelte`,
`MonthHeatmap.svelte` as three separate files, composed into `Dashboard.svelte`'s existing grid
cells that Phase 21 left as placeholders) — follow that split, it's already spec-anticipated, not
really discretionary. Genuine discretion: exact resize-observation mechanism for the `›`
indicator (ResizeObserver vs. a reactive Svelte 5 effect re-measuring on data change), exact
shape of the "ordenar"/"status" client-side controls.

</decisions>

<code_context>
## Existing Code Insights

Read `web/src/lib/dashboard/Dashboard.svelte` (post-Phase-21 — the two placeholder grid cells
`dash-placeholder-rotinas`/`dash-placeholder-projetos` this phase replaces), `web/src/lib/
dashboard/derive.ts` (`rotinasPorFundo`, `cargaDoMes`, `faixaHeatmap`, `progressoEtapa`, `vencido`
— all already correct and unit-tested, just consume them), `web/src/lib/dashboard/
dashboardQuery.ts` (the query already brings everything needed: projetos→etapas→tarefas,
instanciasRotina→template→fundo), `web/src/app.css` (existing `chart-1..5`/`destructive` tokens
and dark-mode block) directly during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No additional specifics beyond spec-ui.md §0/§3.4/§3.5/§6 and REQUIREMENTS.md DASH-04, DASH-05.

</specifics>

<deferred>
## Deferred Ideas

- All 7 focus dialogs, including every click target this phase creates — Phase 23

</deferred>
