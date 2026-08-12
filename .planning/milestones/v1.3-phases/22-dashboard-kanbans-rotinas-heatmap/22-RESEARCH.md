# Phase 22: Dashboard Kanbans, Rotinas & Heatmap - Research

**Researched:** 2026-08-11
**Domain:** Svelte 5 (runes) reactive DOM measurement, Tailwind v4 token-driven theming, pure-function-driven dashboard UI over an already-shipped data/derive layer
**Confidence:** HIGH (codebase-grounded; the one external claim — Svelte's built-in dimension bindings — is web-search cross-checked, MEDIUM)

## Summary

This phase is pure UI composition. Every number/grouping/bucketing decision it needs
(`rotinasPorFundo`, `cargaDoMes`, `faixaHeatmap`, `progressoEtapa`, `vencido`) already exists,
already tested, in `web/src/lib/dashboard/derive.ts` (verified by direct read this session). The
phase's only genuinely new engineering problem is `ProjectStrips.svelte`'s measured `›` overflow
indicator, because **no ResizeObserver / `$effect`-based reactive-measurement pattern exists
anywhere in this codebase today** (`grep -rn "ResizeObserver|scrollWidth|clientWidth|\$effect"` on
`web/src/` returned zero hits, verified live this session). This is genuinely new territory for
the codebase, not a pattern to copy — Section "Architecture Patterns" below gives the concrete,
Svelte-5-idiomatic mechanism to introduce.

The second-highest risk is `MonthHeatmap.svelte`'s dark-mode instruction. Spec §6 says "invert the
ramp (chart-5→chart-1) keeping contrast, no new token" — but `web/src/app.css`'s `--chart-1`
through `--chart-5` custom properties are **textually identical** between the `:root` block and
the `@media (prefers-color-scheme: dark)` block (verified, lines 25-29 vs. 61-65). The ramp does
NOT auto-invert through the token layer. "Invert the ramp" has to be implemented in the
component's own Tailwind classes (`dark:bg-chart-5/40` swapped in for `bg-chart-1/40`, etc.), never
assumed to happen for free via CSS variables. This is exactly the kind of thing that gets invented
wrong if not read carefully — see Pitfall 2.

The third risk area is one the CONTEXT.md doesn't resolve: DASH-05 says "one strip per in-progress
project," but `projetos.status` is free text (`i.string().indexed()`, verified in
`shared/instant.schema.ts:24`) and spec §0.4 forbids presuming status vocabulary anywhere. There is
no non-textual "project is finished" signal in the schema (no boolean, no `dataFimReal`). This
research recommends a concrete, precedent-consistent resolution — see "Open Questions" and
"Assumptions Log" — but it is not locked by CONTEXT.md and must be confirmed/documented in the
plan, mirroring the exact style REQUIREMENTS.md already used for the tarefa/ticket completion
decisions.

**Primary recommendation:** Build all three components as pure presentational Svelte 5 components
that take already-fetched data as props (never call `db.useQuery`/`dashboardQuery.ts`/`derive.ts`'s
grouping functions redundantly), reuse Phase 19's `w-<n> shrink-0` fixed-column mechanism for
non-compression but add what Phase 19 deliberately did NOT need (measured overflow indicator,
3-card height cap, scroll-snap, localStorage collapse), and treat the dark-mode heatmap ramp and
the "in-progress project" filter as explicit, documented decisions rather than literal spec
transcription.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Project strip grouping/columns/cards | Browser / Client (Svelte component) | — | Pure rendering over `dashboardQuery.ts`'s already-fetched `projetos.etapas.tarefas`; no new query, no server involvement |
| Overflow (`scrollWidth > clientWidth`) measurement | Browser / Client (DOM `ResizeObserver` inside `$effect`) | — | Must read live layout geometry; only the browser's own layout engine has this value, never inferable from data |
| Collapse-state persistence | Browser / Client (`localStorage`) | — | Spec explicitly forbids any server/store involvement (§0.9 "sem store global, sem camada de cache"); this is client-only, per-browser UI state |
| Rotinas fundo-grouping | Browser / Client, consuming already-shipped pure function | Data layer (`derive.ts`, already shipped Phase 21) | `rotinasPorFundo` is the data-layer/pure-function tier; the component only renders + re-sorts client-side |
| agrupar/ordenar/status controls | Browser / Client (component-local `$state` + `$derived`) | — | Spec explicitly requires these be "simple client-side reorders/filters over the same array" — no query changes |
| Heatmap bucketing | Data layer (`derive.ts`'s `cargaDoMes`/`faixaHeatmap`, already shipped) | Browser / Client (rendering only) | Bucketing logic is already pure/tested; component only maps bucket → Tailwind class |
| Dark-mode ramp inversion | Browser / Client (Tailwind `dark:` variant classes in the component) | CSS layer (`app.css` tokens, unchanged) | The token *values* don't invert on their own (verified identical light/dark); the component must select a different token index per theme |

## Standard Stack

No new dependency of any kind is permitted this phase (spec §0.3, §7; REQUIREMENTS.md "Out of
Scope": "Qualquer dependência nova fora do registry shadcn-svelte"). Everything needed is already
installed.

### Core (already installed, verified against `web/package.json` and `web/src/lib/components/ui/`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `svelte` | `^5.56.8` [VERIFIED: web/package.json] | Runes (`$state`, `$derived`, `$effect`), component model | Already the project's only UI framework |
| `bits-ui` (via shadcn-svelte components) | pinned by `shadcn-svelte` registry | `Popover`, `Select`, `Tabs`, `ScrollArea`, `Accordion` primitives | Already used identically in `WeekCalendar.svelte`/`ProjetosSection.svelte` |
| Tailwind CSS v4 | via `@import "tailwindcss"` in `app.css:1` | All styling, `dark:` variant | Confirmed default `dark:` = `prefers-color-scheme` media strategy — no `@custom-variant dark` override found in `node_modules/shadcn-svelte`'s `tailwind.css` [VERIFIED: web/node_modules/shadcn-svelte/tailwind.css — no `@custom-variant dark` block present] |

### Supporting (already installed, unused-so-far components this phase may draw on)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `$lib/components/ui/scroll-area` (bits-ui `ScrollArea`) | installed, `ls web/src/lib/components/ui/` confirms directory exists | Horizontal-scroll container | **Recommended against** for `ProjectStrips` — see Pitfall 1 |
| `$lib/components/ui/empty` (`Empty.Root`/`.Header`/`.Media`/`.Title`) | installed, used in `TicketQueue.svelte:3,40-45` | Empty states | Mirror exactly for "Nenhum projeto em andamento" |
| `@lucide/svelte` icons | `^1.31.0` [VERIFIED: web/package.json] | Icon in empty state (`Inbox` used in `TicketQueue.svelte:2`) | Pick a neutral icon (e.g. `layout-grid` / `kanban`) for `ProjectStrips`' empty state — no established precedent, discretionary |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `ResizeObserver` in `$effect` | Svelte's built-in `bind:clientWidth`/`bind:offsetWidth` | Svelte's built-ins do NOT include `scrollWidth` — confirmed via web search of `svelte.dev/tutorial/svelte/dimensions`: the documented bindable dimension properties are `clientWidth, clientHeight, offsetWidth, offsetHeight` only [CITED: svelte.dev/tutorial/svelte/dimensions]. `scrollWidth` has no Svelte binding; a manual `ResizeObserver` reading `el.scrollWidth`/`el.clientWidth` directly is required. |
| Plain `overflow-x-auto` div for the kanban strip | `$lib/components/ui/scroll-area` (`ScrollArea`) | Phase 19 already made and documented this exact choice for `ProjetosSection.svelte`'s kanban view (`ProjetosSection.svelte:586-593`, comment cites "ScrollArea's bits-ui viewport wraps content in its own custom-scrollbar machinery with no prior usage/e2e precedent") — same reasoning applies here, amplified: `ScrollArea.Root`'s actual scrolling element is an inner `ScrollAreaPrimitive.Viewport` (verified `scroll-area.svelte:29-35`), one DOM level below the ref you'd bind — measuring `scrollWidth`/`clientWidth` on the wrong element (the `Root`, which doesn't scroll) silently produces `scrollWidth === clientWidth` always false-negative. Stay with plain `overflow-x-auto` div; the mechanism this phase needs (fixed-width children, native scroll, measurable `scrollWidth`) is exactly what a plain scrolling block element gives you with zero extra indirection. |

**Installation:** none — no `npm install` step this phase.

## Package Legitimacy Audit

Not applicable. This phase installs zero packages (spec §0.3/§7, REQUIREMENTS.md "Out of Scope").

**Packages removed due to [SLOP] verdict:** none — no packages evaluated, none proposed.
**Packages flagged as suspicious [SUS]:** none.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-05 | Mini-kanban strip per in-progress project; fixed-width non-compressing columns; measured `›` overflow; `localStorage` collapse | Architecture Patterns §"Pattern 1" (fixed columns) + §"Pattern 2" (measured overflow) + §"Pattern 3" (localStorage key); Pitfall 1 (ScrollArea trap), Pitfall 3 (double-fire ResizeObserver), Pitfall 4 (SSR localStorage), Open Question 1 ("em andamento" filter) |
| DASH-04 | Rotinas grouped by fundo with functional agrupar/ordenar/status controls; monthly heatmap with exact §6 token table, weekend dimming, legend | Architecture Patterns §"Pattern 4" (RoutinesByFundo controls) + §"Pattern 5" (heatmap grid/token mapping); Pitfall 2 (dark-mode ramp inversion) |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

- All 7 focus dialogs, including every click target this phase creates — Phase 23
</user_constraints>

## Architecture Patterns

### System Architecture Diagram

```
Dashboard.svelte (unchanged this phase except mounting these 3 components)
   │
   ├─ query.data  ──────────────────────────────────────────────┐
   │   (single db.useQuery result, useDashboardQuery(db),        │
   │    already fetched by Plan 21-02 — this phase adds ZERO      │
   │    new queries)                                              │
   │                                                               ▼
   │                                              dadosNormalizados (existing
   │                                              $derived in Dashboard.svelte,
   │                                              may need extending — see below)
   │
   ├──▶ ProjectStrips.svelte  (replaces dash-placeholder-projetos)
   │        props: projetos (filtered "em andamento"), hojeIso
   │        internal pure helpers (component-local, NOT derive.ts):
   │          filtroEmAndamento(projeto) → boolean   [see Open Question 1]
   │        per-strip:
   │          etapas sorted by ordem asc (Array.prototype.sort, same idiom
   │            as ProjetosSection.svelte:414-416)
   │          progressoEtapa(etapa) → already-shipped, for "N tarefas" count
   │          vencido(...) → already-shipped, for card border/text
   │          $state: collapsed (seeded from localStorage read on mount)
   │          $effect + ResizeObserver: overflowing boolean, per-strip DOM refs
   │
   ├──▶ RoutinesByFundo.svelte  (part of replacing dash-placeholder-rotinas)
   │        props: instanciasRotina (raw, or rotinasPorFundo's Grupo[] already
   │          computed — planner's call, see Pattern 4), semana, hojeIso
   │        internal: agrupar/ordenar/status $state controls, re-deriving a
   │          *view* over rotinasPorFundo's own already-ordered Grupo[]
   │        vencido(...) → already-shipped, for bolinha color
   │
   └──▶ MonthHeatmap.svelte  (part of replacing dash-placeholder-rotinas)
            props: dadosNormalizados (tarefas/instanciasRotina/tickets shape
              cargaDoMes expects), ano, mes, hojeIso
            cargaDoMes(...) → already-shipped Map<isoDate, number>
            faixaHeatmap(n) → already-shipped 0|1|2|3|4
            per-cell: isWeekend(iso) computed locally (no derive.ts export
              for this — see Pitfall 5), token class lookup table (Pattern 5)
```

A reader can trace: `Dashboard.svelte`'s existing single query → the existing `dadosNormalizados`
`$derived` block → each of the three new leaf components, which call only already-shipped pure
functions plus a small number of new, phase-local, non-persisted helpers. No new network I/O
anywhere in this diagram.

### Recommended Project Structure
```
web/src/lib/dashboard/
├── Dashboard.svelte          # MODIFIED: mount the 3 new components in place
│                              #   of dash-placeholder-rotinas/-projetos
├── ProjectStrips.svelte       # NEW
├── RoutinesByFundo.svelte     # NEW
├── MonthHeatmap.svelte        # NEW
├── derive.ts                  # UNCHANGED (all 7 DASH-06 exports already ship)
├── dashboardQuery.ts          # UNCHANGED (no new query fields needed)
├── TicketQueue.svelte         # UNCHANGED (Phase 21)
└── WeekCalendar.svelte        # UNCHANGED (Phase 21) — mirror its Popover/
                                #   testid/props-only conventions
```

### Pattern 1: Fixed-width, never-compressing kanban columns
**What:** Every column in a `ProjectStrips` strip is `w-36 shrink-0` inside a `flex` row, the row's
parent is `overflow-x-auto`.
**When to use:** Any horizontally-scrolling row of fixed-size items in this codebase.
**Why `shrink-0` is the load-bearing class, not just `w-36`:** In a CSS flexbox row, a fixed
`width` alone is only a *flex-basis hint* — the flex algorithm will still shrink a flex item below
its specified width when the row's content overflows the container, unless `flex-shrink: 0` is
also set. Tailwind's `shrink-0` utility is exactly `flex-shrink: 0`. This is *precisely* the
mechanism spec §3.5 calls "the most repeated error in the wireframe": a `w-36` column with no
`shrink-0` will silently compress the moment total column width exceeds the strip's own width —
the visual bug looks identical to "columns compressing to fit" because that is literally what
flexbox is doing by default.
**Example (already correct in this codebase — read this exact idiom, don't reinvent it):**
```svelte
<!-- Source: web/src/lib/sections/ProjetosSection.svelte:594-596, verified this session -->
<div data-testid="etapas-kanban" class="flex gap-2 overflow-x-auto pb-2">
  {#each etapasOrdenadas as etapa (etapa.id)}
    <div
      data-testid="etapa-kanban-column"
      data-eid={etapa.id}
      class="w-48 shrink-0 border-r px-2 space-y-2"
    >
```
This proves the fixed-width mechanism (`w-<n> shrink-0` + `overflow-x-auto` ancestor) is already
correct and e2e-proven in this codebase (`projetos-section.spec.ts:779-822` asserts
`widthBaixa === widthAlta` across columns holding 4 vs. 1 card — i.e., column width is
content-independent). **This is the one piece to copy verbatim.** Everything else in this
component (no scroll-snap, no measured overflow indicator, no height cap, no localStorage) is
deliberately absent — do NOT copy those absences into `ProjectStrips`; they were correct only
because that kanban's own requirements (NEST-03) never asked for them. `ProjectStrips` must add,
on top of this same fixed-width mechanism: `box-sizing: border-box` is Tailwind's default via
Preflight (no action needed, confirm no explicit `box-sizing: content-box` override exists in this
codebase — none found), `w-36` (not `w-48` — spec §3.5's own number, distinct from Phase 19's
`w-48`), `scroll-snap-type: x proximity` on the scrolling ancestor (`class="... [scroll-snap-type:x_proximity]"` via Tailwind's arbitrary-property syntax, or a one-line `<style>` block — no
Tailwind utility class ships `scroll-snap-type` by default in this project's installed
plugin set, verified: `grep -rn "snap-" web/src/` returns nothing), and `scroll-snap-align: start`
on each column.

### Pattern 2: Measured (not inferred) `›` overflow indicator — Svelte 5 idiomatic mechanism

**This is new territory for the codebase** — no existing `$effect`/`ResizeObserver` usage was
found (`grep -rn "ResizeObserver\|scrollWidth\|clientWidth\|\$effect" web/src/` → zero hits,
verified live this session). Recommended mechanism, reasoned from two complementary facts:

1. Svelte 5's built-in reactive dimension bindings (`bind:clientWidth`, `bind:clientHeight`,
   `bind:offsetWidth`, `bind:offsetHeight`) are implemented using a `ResizeObserver` internally and
   only cover those four properties — **not `scrollWidth`** [CITED: svelte.dev/tutorial/svelte/dimensions, via WebSearch this session — the tutorial page's own list of bindable dimension properties is exactly `clientWidth, clientHeight, offsetWidth, offsetHeight`]. There is no
   built-in binding for `scrollWidth`, so a manual `ResizeObserver` is required regardless of
   approach.
2. A `ResizeObserver` only fires when the **observed element's own box** changes size — it does
   NOT fire just because a descendant's content changed while the observed element's box stayed
   fixed. Since the strip's outer scrolling container is deliberately `overflow-x-auto` with a
   size set by its grid cell (its own box does *not* grow with content), observing only the outer
   element would miss "columns were added, `scrollWidth` grew, but `clientWidth` didn't move."
   The fix is to observe **both** the outer scroll container (catches `clientWidth` changes from
   window resize / sidebar layout shifts) **and** the inner flex row that actually holds the
   columns (its own intrinsic width — which becomes the outer element's `scrollWidth` once it
   overflows — changes precisely when a column is added/removed, since a `flex` row with no
   `flex-wrap` sizes to fit its children by default). Re-run the same comparison in the shared
   callback regardless of which of the two targets fired.

**Recommended Svelte 5 pattern (write this fresh — no existing file to copy):**
```svelte
<script lang="ts">
  let stripEl: HTMLDivElement | undefined = $state();
  let rowEl: HTMLDivElement | undefined = $state();
  let overflowing = $state(false);

  // Runs once, when both refs are bound (mount). Does NOT need to re-run on
  // data change: ResizeObserver's own callback re-fires whenever either
  // observed box's size changes, which covers both "window resized" (stripEl)
  // and "a column was added/removed" (rowEl, since it's an unconstrained flex
  // row that grows/shrinks with its children).
  $effect(() => {
    if (!stripEl || !rowEl) return;
    const measure = () => {
      overflowing = (stripEl?.scrollWidth ?? 0) > (stripEl?.clientWidth ?? 0);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(stripEl);
    ro.observe(rowEl);
    return () => ro.disconnect(); // Svelte 5 $effect teardown, runs on re-run or destroy
  });
</script>

<div bind:this={stripEl} class="relative overflow-x-auto [scroll-snap-type:x_proximity]">
  <div bind:this={rowEl} class="flex gap-2">
    {#each columns as col (col.id)}
      <div class="w-36 shrink-0 [scroll-snap-align:start] box-border">...</div>
    {/each}
  </div>
  {#if overflowing}
    <span class="pointer-events-none absolute right-0 top-0 bottom-0 flex items-center
      bg-gradient-to-l from-background px-2" data-testid="project-strip-overflow">›</span>
  {/if}
</div>
```
[ASSUMED — this exact code has not been run in this codebase; the reasoning (ResizeObserver
semantics, ResizeObserver-fires-on-observe-start per the W3C spec, `$effect` cleanup-function
support) is standard web-platform/Svelte-5 knowledge, cross-checked with the WebSearch results
above, but is not itself a verified-in-this-repo fact. Confidence: MEDIUM per
`classify-confidence --provider websearch --verified`.]

Do **not** derive `overflowing` from `columns.length * 144 > stripWidth` or any other
data-based arithmetic — the CONTEXT.md is explicit that this is "never a static boolean derived
from column count," and arithmetic like that silently drifts from reality the moment a card's
text wraps to a second line, a scrollbar appears, or the grid gutter changes — all of which change
real pixel geometry without changing the input data.

### Pattern 3: `localStorage` collapse persistence — key discipline
**What:** One key per project, computed at render time, read once on mount, written on toggle.
**Example:**
```ts
const key = (projetoId: string) => `apollo.dash.collapsed.${projetoId}`;

function readCollapsed(projetoId: string): boolean {
  if (typeof localStorage === "undefined") return false; // see Pitfall 4
  return localStorage.getItem(key(projetoId)) === "true";
}

function writeCollapsed(projetoId: string, value: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key(projetoId), String(value));
}
```
No prior `localStorage` usage exists anywhere in `web/src/` to mirror (`grep -rn "localStorage"
web/src/` returns only a comment in `Dashboard.svelte:105` noting week-nav state deliberately
does NOT touch it) — this is genuinely new, but the constraint from CONTEXT.md is unambiguous:
exactly one key shape, no shared "collapse state" utility module, no other key touched.

### Pattern 4: RoutinesByFundo's client-side agrupar/ordenar/status controls
**What:** `rotinasPorFundo(instancias, semana)` (already shipped, verified `derive.ts:377-415`)
already returns `{ fundoId, fundoNome, instancias }[]` sorted with the `null`-fundo group forced
last. The component's "agrupar/ordenar/status" `Select` controls are a **display-only** transform
applied on top of that already-correct array — mirror `ProjetosSection.svelte`'s own
`groupProjetos`/`Select.Root` idiom (`ProjetosSection.svelte:84-158, 345-360`) exactly: a
`GroupBy`/`SortBy`/`StatusFilter` union type, a plain function, `$derived`, `Select.Root` with
`type="single"` and `onValueChange`.
**When to use:** `agrupar: fundo ▾` can be closer to a no-op toggle here — spec's own text
concedes fundo-grouping is "the only one wired to non-trivial logic this phase," since the data is
already fundo-grouped by the pure function; `ordenar: data ▾` reorders each group's own
`instancias` array by `dataPrevista` (already the pure function's internal sort — an "ordenar:
nome" alternative would need `template` data this phase's locked field list doesn't carry, so keep
the option set small); `status ▾` filters using `vencido(...)` (already shipped), never
`instancia.status === "..."` string comparison — CONTEXT.md is explicit the bolinha color is
"never derived from a status string," and the same rule extends to any status-labeled filter
control (e.g. "atrasadas" / "todas", not raw free-text status values).
**Example — the established Select idiom to reuse verbatim (not re-derived here for length; see
`ProjetosSection.svelte:345-360` directly for the exact `Select.Root`/`Select.Trigger`/
`Select.Content`/`Select.Item` composition).**

### Pattern 5: MonthHeatmap token-class lookup
**What:** A pure `faixaClasse(faixa: 0|1|2|3|4): string` lookup table, one branch per already-shipped
`faixaHeatmap()` bucket — never a computed/interpolated color.
**Example:**
```ts
// Source: spec-ui.md §6 (light), inverted per §6's dark-mode instruction (see Pitfall 2)
const FAIXA_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted",
  1: "bg-chart-1/40 dark:bg-chart-5/40",
  2: "bg-chart-2/70 dark:bg-chart-4/70",
  3: "bg-chart-4 text-background dark:bg-chart-2 dark:text-foreground",
  4: "bg-destructive text-destructive-foreground", // already theme-aware — --destructive itself
                                                      // differs between light/dark app.css blocks
                                                      // (verified app.css:21 vs. app.css:57)
};
```
[ASSUMED — the specific dark-mode swap pairing (`chart-5` for faixa 1, `chart-4` for faixa 2,
`chart-2` for faixa 3) is this research's own recommendation implementing spec §6's textual
instruction "invert the ramp (chart-5→chart-1) keeping contrast"; it is not itself dictated
verbatim by any file read this session. See Pitfall 2 and Assumptions Log A2.]

### Anti-Patterns to Avoid
- **Deriving `overflowing` from data (column count / card count):** explicitly forbidden by
  CONTEXT.md; also simply wrong the moment text wraps or the viewport changes.
- **Using `ScrollArea` for the kanban strip:** its actual scrolling node (`ScrollAreaPrimitive.Viewport`) is not the ref you'd naturally bind (`scroll-area.svelte:29-35`) — see Pitfall 1.
- **Filtering rotinas/projetos/tickets by a `status === "<literal>"` string comparison anywhere:** spec §0.4 forbids this everywhere in the milestone, not just where CONTEXT.md happens to call it out explicitly (bolinha color). Apply the same discipline to every new filter/sort control this phase introduces.
- **Adding a fourth `db.useQuery` call from any of the 3 new components:** DASH-07's single-query contract (verified `dashboardQuery.ts:17-23`) is a phase-21 invariant this phase must not violate; all 3 components take props from `Dashboard.svelte`, exactly like `TicketQueue.svelte`/`WeekCalendar.svelte` already do (verified, both take only props, zero `db` import).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Week-window / fundo-grouping / heatmap-bucketing / progress / overdue logic | A second copy of any of `rotinasPorFundo`/`cargaDoMes`/`faixaHeatmap`/`progressoEtapa`/`vencido` inside a `.svelte` file | The existing `web/src/lib/dashboard/derive.ts` exports (verified read, lines 377-415, 137-143, 51-55, 63-70) | Already correct and unit-tested (`derive.test.ts`, 502 lines, verified read); duplicating any of this drifts the moment one copy is edited and the other isn't |
| Horizontal-scroll-with-snap container | A custom scroll/snap library or IntersectionObserver-based "peek" indicator | Native CSS `overflow-x-auto` + `scroll-snap-type`/`scroll-snap-align` (both zero-dependency browser features) | Spec §0.3 forbids any dependency outside the shadcn-svelte registry; native CSS scroll-snap is exactly this problem's built-in solution |
| Detecting element overflow | A "does it fit" heuristic based on window width breakpoints or item counts | `ResizeObserver` + direct `scrollWidth`/`clientWidth` read (Pattern 2) | Breakpoint/count heuristics can't account for font rendering, card text wrapping, gutter/gap changes, or zoom — the exact failure mode CONTEXT.md is guarding against |
| Persisting collapse state | A generic `localStorage` wrapper/store module | Two small, phase-local functions scoped to the single documented key (Pattern 3) | CONTEXT.md explicitly forbids "no new localStorage-wide utility introduced beyond what this one feature needs" |

**Key insight:** every piece of *logic* this phase needs is already built and tested from Phase
21; the only genuinely new code is DOM measurement (a browser-platform primitive, not a
library problem) and two small, intentionally narrow client-side UI-state helpers.

## Common Pitfalls

### Pitfall 1: Binding the wrong element as the "scrolling" ref if `ScrollArea` is used anyway
**What goes wrong:** `bind:ref` on `ScrollArea.Root` gives you the *outer* wrapper, but the actual
element whose `scrollWidth`/`scrollLeft` change as the user scrolls is the inner
`ScrollAreaPrimitive.Viewport` (verified `scroll-area.svelte:23-35`: `Root` wraps `Viewport` wraps
`{@render children}`). Measuring `scrollWidth`/`clientWidth` on `Root` instead of `Viewport`
silently always returns `false` for overflow (or a bogus true), because `Root`'s own box is sized
to fit its container, not the scrollable content.
**Why it happens:** `ScrollArea` is a two-layer component; a naive `bind:this` on the top-level
Svelte component tag captures the wrong DOM node without erroring.
**How to avoid:** Use a plain `<div class="overflow-x-auto">` (Pattern 1/2), matching Phase 19's
own documented precedent for this exact situation.
**Warning signs:** the `›` indicator never appears no matter how many columns a project has, or
appears on every project including ones that visibly fit.

### Pitfall 2: Assuming the dark-mode chart ramp inverts itself via CSS custom properties
**What goes wrong:** Spec §6 says "dark mode: invert the ramp... no new token," which reads as if
merely switching color-scheme should be enough. It is not: `app.css`'s `--chart-1` through
`--chart-5` values are **identical strings** in the `:root` block (lines 25-29) and the
`@media (prefers-color-scheme: dark)` block (lines 61-65) — verified by direct read this session.
A component that ships `bg-chart-1/40` for the lowest band, unconditionally, will render exactly
the same near-white cell in dark mode as in light mode — but against a near-black page background
instead of a near-white one, so the *visual* meaning inverts (low load looks the brightest/most
prominent cell on the grid) even though no CSS rule "broke."
**Why it happens:** it's easy to conflate "this app has dark-mode tokens" (true, for
`--background`/`--foreground`/`--destructive`/etc., which DO differ between the two blocks) with
"this app's chart ramp has dark-mode tokens" (false — chart-* is deliberately theme-invariant, per
app.css's own values).
**How to avoid:** implement the inversion in the *component's own Tailwind classes* via the
`dark:` variant (confirmed to resolve via `prefers-color-scheme`, since no `@custom-variant dark`
override exists in the installed `shadcn-svelte` tailwind.css) — swap which numbered chart token
each band uses in dark mode, per Pattern 5's lookup table, not the CSS variable definitions.
**Warning signs:** toggling OS dark mode makes the heatmap's "quiet" cells look heavier than its
"busy" cells, or the whole grid looks like a flat wash of gray with no visible banding.

### Pitfall 3: Double-observing the same box and getting redundant/interleaved callbacks
**What goes wrong:** If both the outer strip and inner row happen to resize in the same paint
(e.g., the whole page reflows), the shared `ResizeObserver` callback can fire twice in quick
succession with two separate `ResizeObserverEntry` batches. Reading `entry.contentRect` from the
callback argument (rather than re-reading `el.scrollWidth`/`el.clientWidth` directly on the actual
elements, as Pattern 2 does) risks acting on a stale/partial batch.
**Why it happens:** `ResizeObserver` batches all pending size changes and can deliver multiple
observed targets per invocation, or (rarely) invoke the callback more than once per frame if a
resize triggers a further resize.
**How to avoid:** always re-read `stripEl.scrollWidth`/`stripEl.clientWidth` fresh, directly off
the bound elements, inside the callback — never trust `entry.contentRect`/`entry.target` for this
specific comparison. This is safe per platform semantics: "ResizeObserver is a safe place to read
scrollWidth/clientWidth" [CITED: tigeroakes.com/posts/resize-observer-avoid-forced-sync-layout, via WebSearch this session].
**Warning signs:** the indicator flickers on/off during a window resize instead of settling.

### Pitfall 4: `localStorage` access during SSR / before hydration
**What goes wrong:** if `readCollapsed`/`writeCollapsed` (Pattern 3) run during any server-side
rendering pass, `localStorage` is `undefined` in that environment and a bare
`localStorage.getItem(...)` throws.
**Why it happens:** this is a Vite SPA today (verified `web/vite.config.ts`-driven build, no SSR
adapter found), so in practice this may be moot — but Svelte components can still run their
`<script>` top-level/`$effect` bodies during test harnesses (e.g. Vitest jsdom without a
`localStorage` shim) or a future SSR migration.
**How to avoid:** guard every access with `typeof localStorage === "undefined"` (Pattern 3's
example already does this) and/or read inside `$effect` (which only runs client-side after
mount), never at module top-level.
**Warning signs:** a unit test importing `ProjectStrips.svelte`-adjacent logic in a non-browser
test runner throws `ReferenceError: localStorage is not defined`.

### Pitfall 5: Treating "weekend" as derivable from `derive.ts`
**What goes wrong:** `semanaUtil` returns `sabado`/`domingo` as explicit ISO strings for a given
*week*, but `MonthHeatmap` needs to know, for every day of an entire *month* (`cargaDoMes`'s
`Map<string, number>` keys), whether that day is a Saturday/Sunday — `derive.ts` has no exported
helper for this (verified: `semanaUtil`'s only weekend-related output is scoped to one 7-day
window, not a month).
**Why it happens:** it's tempting to search `derive.ts` for "the" weekend function and, finding
none, either skip the weekend styling or reach for `bizdays.ts`.
**How to avoid:** compute weekend status locally and trivially: `new Date(iso +
"T00:00:00.000Z").getUTCDay()` is `0` (Sunday) or `6` (Saturday) — same UTC-anchored idiom
`derive.ts` itself uses throughout (e.g. `semanaUtil`'s own `getUTCDay()` call, verified
`derive.ts:113`). This is a 1-line local helper, not a gap in `derive.ts`'s contract — DASH-06's
locked export list (7 functions) does not include a weekend-of-month helper, and there is no
need to add one to the shared pure module for a single-component concern.
**Warning signs:** weekend cells rendering with the numeric-load background instead of
`bg-muted/40`, or a `bizdays.ts` import appearing in `MonthHeatmap.svelte` (which spec's own
`semanaUtil` doc comment (`derive.ts:106-110`) explicitly warns is the wrong tool — `bizdays.ts`
is calendar-holiday-aware business-day logic, not a plain weekend check, and pulls in
`shared/anbima-calendar.json` unnecessarily).

## Code Examples

### Fixed-width column (verbatim precedent — read, don't reinvent)
```svelte
<!-- Source: web/src/lib/sections/ProjetosSection.svelte:594-632, verified this session -->
<div data-testid="etapas-kanban" class="flex gap-2 overflow-x-auto pb-2">
  {#each etapasOrdenadas as etapa (etapa.id)}
    <div data-testid="etapa-kanban-column" data-eid={etapa.id} class="w-48 shrink-0 border-r px-2 space-y-2">
      <!-- header + cards -->
    </div>
  {/each}
</div>
```

### Measured overflow indicator (new pattern this phase introduces — see Pattern 2 for full context/caveats)
```svelte
<script lang="ts">
  let stripEl: HTMLDivElement | undefined = $state();
  let rowEl: HTMLDivElement | undefined = $state();
  let overflowing = $state(false);

  $effect(() => {
    if (!stripEl || !rowEl) return;
    const ro = new ResizeObserver(() => {
      overflowing = (stripEl?.scrollWidth ?? 0) > (stripEl?.clientWidth ?? 0);
    });
    ro.observe(stripEl);
    ro.observe(rowEl);
    return () => ro.disconnect();
  });
</script>
```

### Fundo-grouping Select control (precedent to mirror)
```svelte
<!-- Source: web/src/lib/sections/ProjetosSection.svelte:345-360, verified this session -->
<Select.Root type="single" value={groupBy} onValueChange={(v) => { if (v) groupBy = v as GroupBy; }}>
  <Select.Trigger data-testid="project-groupby" class="w-full">{`agrupar: ${groupBy}`}</Select.Trigger>
  <Select.Content>
    <Select.Item value="fundo" label="fundo">fundo</Select.Item>
    <Select.Item value="nenhum" label="nenhum">nenhum</Select.Item>
    <Select.Item value="status" label="status">status</Select.Item>
  </Select.Content>
</Select.Root>
```

### Empty state (precedent to mirror for "Nenhum projeto em andamento")
```svelte
<!-- Source: web/src/lib/dashboard/TicketQueue.svelte:40-45, verified this session -->
<Empty.Root data-testid="dash-tickets-empty">
  <Empty.Header>
    <Empty.Media variant="icon"><Inbox /></Empty.Media>
    <Empty.Title>Nenhum ticket pendente</Empty.Title>
  </Empty.Header>
</Empty.Root>
```

## State of the Art

Not applicable — this is a single-codebase, single-framework-version phase with no
external-ecosystem drift to track (Svelte 5.56, already current; no library upgrade in scope).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Projeto em andamento" (which projects get a strip at all) = has at least one etapa, with **no** filter attempted on any completion/status signal (mirroring the exact precedent REQUIREMENTS.md §5.3 already set for the ticket queue: "não filtra por conclusão" because no non-textual completion signal exists) | Open Question 1 below; DASH-05 | If wrong, either too many strips render (completed projects still show, cluttering the dashboard) or too few (a genuinely-active project with zero etapas never gets a strip — acceptable, since a strip needs etapas-as-columns to mean anything) |
| A2 | Dark-mode heatmap ramp inversion is implemented via per-band `dark:bg-chart-<swapped-index>` Tailwind classes in `MonthHeatmap.svelte` (Pattern 5's exact swap: 1↔5, 2↔4, 3 stays paired with 2's counterpart), rather than any change to `app.css` | Pattern 5, Pitfall 2 | If wrong, dark mode either shows no visible intensity banding (if the swap is skipped) or an incorrectly-paired swap (e.g., swapping band 3 with band 1 instead of band 2) that still technically differs by theme but doesn't preserve the "quiet→busy" reading order spec asks for |
| A3 | The `›` overflow indicator markup is `position: absolute` + a `bg-gradient-to-l from-background` fade, matching spec §3.5's "`›` + fade" description, rather than a plain solid-background chevron | Pattern 2 code example | Low risk — purely cosmetic; spec text explicitly mentions "fade" so this is a direct reading, not really a leap, but the exact gradient stop/opacity is undocumented and could look different pixel-for-pixel from any intended wireframe render |
| A4 | `scroll-snap-type`/`scroll-snap-align` need Tailwind's arbitrary-value bracket syntax (`[scroll-snap-type:x_proximity]`) because no dedicated Tailwind utility class for `scroll-snap-type` exists in this project's Tailwind v4 setup | Pattern 1 | Low risk — if a `snap-x`/`snap-proximity`-style utility does in fact exist in this Tailwind v4 install and was simply not grepped correctly, the arbitrary-value form still produces identical CSS output, so this assumption is self-correcting even if the "more idiomatic" utility class exists |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **What exactly defines "projeto em andamento" for the purpose of "does this project get a strip at all"?**
   - What we know: `projetos.status` is free text (`i.string().indexed()`, verified
     `shared/instant.schema.ts:24`) and spec §0.4 forbids any screen from presuming status
     vocabulary. There is no boolean/date "project completed" field on `projetos` in the schema
     (only `dataInicioPrevista`/`dataFimPrevista`, both *planned*, optional dates — not actual
     completion signals). REQUIREMENTS.md's own decision block (§5.3) already resolved an
     identical structural problem for the ticket queue by choosing NOT to filter by completion at
     all, since no non-textual signal exists there either — and explicitly frames this as a
     documented, symmetric decision the PR must cite.
   - What's unclear: whether "em andamento" is meant to exclude *some* projects (e.g. ones with
     zero etapas, or ones whose every task is done) or is meant to include every project that
     exists, deferring all "is this project done" judgment to the human reading the dashboard.
   - Recommendation: extend the exact same documented-decision pattern (Assumption A1): a project
     gets a strip iff it has ≥1 etapa (nothing to render as kanban columns otherwise); do not
     attempt any additional "is it finished" filter, since doing so would require either a
     `status` string comparison (forbidden) or a new aggregate-progress heuristic invented for
     this phase alone with no spec-given threshold (e.g., "100% of tasks in every etapa done" —
     defensible, but not requested anywhere in spec-ui.md or REQUIREMENTS.md, and risks hiding a
     project the user still considers active but happens to have finished all currently-visible
     tasks). The planner/executor should state this decision explicitly in the phase's SUMMARY,
     matching the precedent format REQUIREMENTS.md §5.3 already established.

2. **Does `agendaPorDia`'s existing rotina-item `titulo` placeholder (documented in `derive.ts:252-258` as `instancia.id`, a stable but non-human-readable string) affect `RoutinesByFundo`?**
   - What we know: `RoutinesByFundo` is specified to consume `rotinasPorFundo`'s output directly
     (`Grupo[]` of raw `InstanciaAgendaLike` rows, verified `derive.ts:377-415` — this function
     does NOT wrap rows in the `Item` shape that carries the `titulo` placeholder; it returns the
     original instancia rows with `template.fundo` attached).
   - What's unclear: `rotinasPorFundo`'s `InstanciaAgendaLike` shape (verified `derive.ts:220-225`)
     has no title-bearing field either — only `id`, `dataPrevista`, `tipoPrazo`,
     `template.fundo.{id,nome}`. There's genuinely no human-readable label for a routine instance
     anywhere in the currently-locked query/derive shapes.
   - Recommendation: this phase must render *something* per routine row (spec §3.4: "até 4
     rotinas com bolinha de status e dia") — the safe reading is the row shows `dia` (from
     `dataPrevista`) + the bolinha, with `template.nome` as the label if the planner chooses to
     extend `dashboardQuery.ts`'s `instanciasRotina: { template: { fundo: {} } }` shape to also
     select `template.nome` (a same-hop addition, not a new link — `defs/instanciasRotina.ts`
     stays untouched either way, since this query bypasses the registry entirely, per
     `dashboardQuery.ts`'s own doc comment). Flag this as a small, likely-necessary
     `DASHBOARD_QUERY` field addition (`template.nome`) for the plan to make explicit, since
     without it there is no routine label to show at all.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | unit tests (`derive.test.ts`-style, though this phase adds no new `derive.ts` exports) | ✓ | `1.3.12` [VERIFIED: `bun --version`] | — |
| Playwright | e2e tests (`web/e2e/*.spec.ts`) | ✓ | `1.62.1` [VERIFIED: `npx playwright --version`] | — |
| Node.js | build/dev tooling | ✓ | `v20.20.2` [VERIFIED: `node --version`] | — |
| `ResizeObserver` (browser API, not an npm package) | `ProjectStrips`' measured overflow (Pattern 2) | ✓ (all evergreen browsers Playwright drives; not IE11, irrelevant here) | native | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (unit) | `bun:test`, verified `derive.test.ts:1` imports `describe, expect, test` from `"bun:test"` |
| Framework (e2e) | `@playwright/test` `^1.62.1` [VERIFIED: web/package.json], `testDir: "./e2e"`, `fullyParallel: false`, `workers: 1` [VERIFIED: web/playwright.config.ts:7-9] |
| Config file | `web/playwright.config.ts` (e2e); no dedicated unit-test config file — `bun test src` is the whole invocation [VERIFIED: `web/package.json`'s `"test": "bun test src"` script] |
| Quick run command | `cd web && bun test src/lib/dashboard` (unit); `cd web && npx playwright test e2e/dashboard.spec.ts` (e2e, scoped) |
| Full suite command | `cd web && bun test src` / `cd web && npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-05 | Kanban columns keep fixed width regardless of card count (non-compression) | e2e (bounding-box comparison, exact idiom already proven) | `npx playwright test e2e/dashboard.spec.ts -g "fixed width"` | ❌ Wave 0 — mirror `projetos-section.spec.ts:808-813`'s `boundingBox().width` comparison pattern, applied to `ProjectStrips`' own testids |
| DASH-05 | `›` indicator appears only when `scrollWidth > clientWidth` is genuinely true, never for a project whose columns fit | e2e | `npx playwright test e2e/dashboard.spec.ts -g "overflow indicator"` | ❌ Wave 0 — needs a fixture project with enough etapas to overflow a narrow viewport, and a second fixture project with 1-2 etapas that must NOT show the indicator |
| DASH-05 | Collapse state persists across reload via `localStorage['apollo.dash.collapsed.<projetoId>']` only | e2e | `npx playwright test e2e/dashboard.spec.ts -g "collapse persists"` | ❌ Wave 0 — assert via `page.evaluate(() => localStorage.getItem(...))` plus a `page.reload()` round-trip; also assert no *other* localStorage key was written (`Object.keys(localStorage)` before/after) |
| DASH-04 | Rotinas grouped by fundo, "Sem fundo vinculado" last, functional agrupar/ordenar/status controls | e2e | `npx playwright test e2e/dashboard.spec.ts -g "rotinas by fundo"` | ❌ Wave 0 |
| DASH-04 | Heatmap renders exactly 5 bands per §6's token table, weekend cells `bg-muted/40` with no number, legend visible | e2e (class assertions) + could add a `derive.ts`-adjacent unit test if any new pure helper is introduced (e.g. weekend-of-month, per Pitfall 5) | `npx playwright test e2e/dashboard.spec.ts -g "heatmap"` | ❌ Wave 0 |
| DASH-04/DASH-05 | Every new click target renders as a real `<button>` element (inert `onclick` this phase, per CONTEXT.md) | e2e (`tagName` assertion, same idiom as `projetos-section.spec.ts:672-675`) | same spec file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd web && bun test src/lib/dashboard` (fast, no network) — run after every
  `derive.ts`/component-logic change.
- **Per wave merge:** `cd web && npx playwright test e2e/dashboard.spec.ts` (live-backend e2e,
  slower — mirrors the existing `phase21-e2e-`/`phase19-e2e-` CLI-fixture + `sweepLeftovers()`
  convention verified in `dashboard.spec.ts`/`projetos-section.spec.ts`).
- **Phase gate:** full `npx playwright test` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] No existing e2e test file covers `ProjectStrips`/`RoutinesByFundo`/`MonthHeatmap` yet — all
  assertions in the table above are net-new, to be added to `web/e2e/dashboard.spec.ts`
  (extending the existing file, following its established `phase21-e2e-`-prefix/CLI-fixture/
  sweep pattern) or a new `web/e2e/dashboard-kanbans.spec.ts` — planner's discretion, no existing
  precedent dictates a hard split.
- [ ] No fixture helper exists yet for creating a project with enough etapas+tasks to force
  horizontal overflow at a realistic viewport width — needs a `beforeAll` CLI-fixture block
  (mirroring `apolloCli([...])` calls already used in `projetos-section.spec.ts`/
  `dashboard.spec.ts`), likely requiring `page.setViewportSize(...)` to a narrow-enough width to
  make the overflow assertion deterministic regardless of CI runner screen size.
- [ ] Framework install: none — `bun`/`@playwright/test` already present and configured.

## Security Domain

`security_enforcement: true` (`.planning/config.json`), `security_asvs_level: 1`. This phase adds
zero new endpoints, zero new mutations, zero new query shapes, and zero new user input that
reaches persisted storage — it is a pure read-and-render phase over data `Dashboard.svelte`
already fetches (unchanged `DASHBOARD_QUERY`, verified `dashboardQuery.ts:17-23`), with every new
click target explicitly inert this phase (CONTEXT.md: "no `onclick` handler yet, or a no-op").

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface touched — `useDashboardQuery(db)` already relies on the existing session, unchanged |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes (inherited, not newly introduced) | Every row rendered by the 3 new components arrives already server-scoped by `instant.perms.ts`'s `view` rule (verified `dashboardQuery.ts:14-16`'s own comment: "No `donoId` where-clause is added: `instant.perms.ts`'s `view` rule already scopes every row server-side"). This phase must not introduce any client-side-only filtering that a user could rely on as a security boundary — it isn't one, and isn't being asked to be one, since it's read-only UI over already-authorized data. |
| V5 Input Validation | Marginal | The only new "input" this phase accepts is UI control state (`agrupar`/`ordenar`/`status` `Select` values, collapse toggle) — all constrained to a closed `Select.Item` set (same pattern as `ProjetosSection.svelte`'s `groupBy`), never free text reaching a query or mutation. `localStorage` values read back (Pattern 3) should be treated as untrusted-but-low-stakes local state: `readCollapsed` should treat any value other than the literal string `"true"` as `false` (already the recommended implementation), never `JSON.parse` a `localStorage` value blindly. |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client trusts `localStorage` collapse value as anything beyond cosmetic UI state | Tampering (low severity — user tampering with their own browser storage) | Never gate a security/authorization decision on this value (none is planned to); treat malformed/unexpected values as the default (`false`/expanded), never throw |
| A future click-handler (Phase 23) wiring these now-inert buttons accidentally trusts client-side `agrupar`/`ordenar`/`status` selection as a data-scoping mechanism instead of a display-only reorder | Information Disclosure (only if misused later) | Out of scope for this phase to *fix*, but worth flagging in the plan/SUMMARY: these controls must remain "client-side re-sort/re-filter of already-fetched data" per CONTEXT.md, never grow into a second, unscoped query path |

## Sources

### Primary (HIGH confidence — direct `Read`/`Bash grep` of this repository, this session)
- `web/src/lib/dashboard/Dashboard.svelte` — current placeholder grid, existing `dadosNormalizados`/`semana`/`agenda` derivation
- `web/src/lib/dashboard/derive.ts` — all 7 DASH-06 exports, full doc comments
- `web/src/lib/dashboard/derive.test.ts` — full existing test coverage/fixtures
- `web/src/lib/dashboard/dashboardQuery.ts` — locked `DASHBOARD_QUERY` shape, zero-runtime-import discipline
- `web/src/lib/dashboard/WeekCalendar.svelte` — Popover/testid/props-only conventions
- `web/src/lib/dashboard/TicketQueue.svelte` — Empty-state and card-button conventions
- `web/src/lib/sections/ProjetosSection.svelte` — fixed-width kanban precedent (lines 594-632), Select/agrupar precedent (lines 84-158, 345-360), accordion/subtarefas-chip button conventions
- `web/e2e/projetos-section.spec.ts` — fixed-width-column e2e assertion pattern (lines 779-822), real-`<button>` tagName assertion pattern (lines 672-675)
- `web/e2e/dashboard.spec.ts` — existing dashboard e2e fixture/prefix conventions
- `web/src/app.css` — full token set; verified `--chart-1..5` identical light/dark
- `web/src/lib/components/ui/scroll-area/scroll-area.svelte` — `Root`/`Viewport` DOM structure
- `shared/instant.schema.ts` — `projetos.status` free-text field, no completion signal
- `web/src/lib/entities/defs/projetos.ts` — `status` field kind `"text"`, confirms no enum
- `web/package.json`, `web/playwright.config.ts` — versions, test config
- `.planning/phases/22-dashboard-kanbans-rotinas-heatmap/22-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `spec-ui.md` (§0, §3.4, §3.5, §5, §6, §7, §8, §10) — all read in full this session

### Secondary (MEDIUM confidence — WebSearch cross-checked against standard web-platform behavior)
- `svelte.dev/tutorial/svelte/dimensions` — Svelte's built-in bindable dimension properties (`clientWidth`/`clientHeight`/`offsetWidth`/`offsetHeight`, backed by `ResizeObserver`; `scrollWidth` not included)
- `tigeroakes.com/posts/resize-observer-avoid-forced-sync-layout` — "ResizeObserver is a safe place to read scrollWidth/clientWidth"

### Tertiary (LOW confidence — not independently verified this session, standard platform knowledge only)
- Exact `ResizeObserver` initial-invocation timing/ordering semantics (used in Pattern 2/Pitfall 3's reasoning) — well-established W3C spec behavior, not fetched from the spec document itself this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, every component already installed and read directly
- Architecture (fixed-width columns, controls, heatmap tokens): HIGH — direct precedent read in this codebase
- Architecture (measured overflow mechanism): MEDIUM — genuinely new to this codebase; reasoning is standard-but-unverified-in-repo web-platform behavior, cross-checked via WebSearch
- Pitfalls: HIGH for Pitfalls 1/4/5 (directly grounded in files read this session); MEDIUM for Pitfalls 2/3 (grounded in verified token values + standard ResizeObserver semantics)
- Open Questions (in-progress filter, rotina label): genuinely open — CONTEXT.md does not resolve them; flagged prominently rather than silently assumed

**Research date:** 2026-08-11
**Valid until:** 2026-09-10 (30 days — stable in-repo domain, no fast-moving external dependency)
