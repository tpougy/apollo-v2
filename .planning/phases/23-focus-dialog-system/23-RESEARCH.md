## Phase 23: Focus Dialog System - Research

**Researched:** 2026-08-12
**Domain:** Svelte 5 dialog composition over an already-fetched single-query dashboard + existing generic `EntityScreen` CRUD engine (InstantDB)
**Confidence:** HIGH — every claim below is `[VERIFIED: <path>:<lines>]` against files read this session, or `[CITED: spec-ui.md §N]`. No `[ASSUMED]` package or external claims — this phase adds zero new dependencies.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Binding spec: `spec-ui.md` §4 (the full dialog table + common rules) is the exact spec for this
  phase — read it in full, plus §0 throughout. Every dialog *target* already exists (Phases
  19-22); this phase only builds the 7 dialog components and wires every previously-inert
  `<button>` to open the correct one.
- **7 dialogs, exactly 3 widths** (spec §4 table + "Regras comuns"): S = `sm:max-w-md` (Tarefa,
  Rotina), M = `sm:max-w-3xl` (Ticket, Dia, Fundo, Etapa), L = `sm:max-w-[90vw]` (Projeto). All
  `max-h-[85vh] overflow-y-auto`, matching the existing form-dialog pattern already used by
  `EntityScreen`'s create/edit dialog.
- **Every dialog has**: title, context line (`fundo · projeto · prazo` as applicable), read-only
  body (per spec §4's "conteúdo mínimo" column for that dialog number), footer with "editar",
  "ver na página completa →", and close. No data exists only inside a dialog — everything shown
  must be traceable to already-fetched `dashboardQuery`/section data or a light dedicated query.
- **"editar" reuses the existing form, never duplicates it**: same hidden-`EntityScreen`-instance
  + driven-click pattern already proven in Phases 19-20 (`ProjetosSection.svelte`,
  `SubtarefasPanel.svelte`) — open the dialog's own hidden `EntityScreen(config)` instance and
  drive its `row-edit`/`entity-edit-start` (or equivalent) button for the target row. Do not add
  a third prop to `EntityScreen.svelte` or any `if (etype===...)` branch anywhere — this is purely
  composition from the outside, exactly as prior phases did it.
- **"ver na página completa →"**: navigates `rota` to the real section (e.g.
  `{section:"entity", etype:"tickets"}` for the Ticket dialog, or into `ProjetosSection`'s
  existing master-detail for Projeto/Etapa/Tarefa) and closes the dialog — reuses Phase
  18-22's existing route/section machinery, no new navigation concept.
- **Wiring existing inert buttons (DLG-02)**: every button phases 19-22 already built as
  `<button>` with no `onclick` (ticket card, day header, weekend-chip items, heatmap cell,
  routine row, fundo badge, kanban column header, task/kanban card, plus §2.2's etapa/tarefa rows
  inside `ProjetosSection` where dialogs also apply per spec §4's "alvos" column) now gets its
  real handler: open the matching dialog with the right item's data. Nested targets (e.g. a
  routine row inside a fundo card, a fundo badge inside a project-strip header) call
  `stopPropagation` so clicking the child never also fires the parent's handler — this pattern is
  already established (`SubtarefasPanel.svelte`'s chip click, `ProjetosSection.svelte`'s row
  delegation) and should be reused, not reinvented.
- **Depth cap = 2 (DLG-03)**: from a Projeto dialog you may open a Tarefa dialog (or Etapa); from
  that second-level dialog, no further dialog opens — the breadcrumb/context line at the top of a
  second-level dialog is text only (spec: "o breadcrumb no topo do dialog volta um nível" — the
  breadcrumb is a `<button>` back to the first dialog, not a new destination). Concretely: only
  Projeto (dialog 4) and Dia (dialog 2) are ever "first-level" launch points that can themselves
  open a second dialog (Projeto→Etapa/Tarefa per spec's kanban card/column-header targets inside
  its own body; Dia→ any item in that day's full agenda). Ticket/Fundo/Etapa/Tarefa/Rotina dialogs
  never open another dialog from inside themselves.
- **Close behavior**: reuse `EntityScreen`'s existing `escapeKeydownBehavior={busy ? "ignore" :
  "close"}` idiom verbatim for Esc/click-outside/×. Destructive actions (only reachable via
  "editar"'s underlying `EntityScreen` form, never directly in read-only dialog body) still show
  their own `AlertDialog` on top, unchanged from existing behavior.
- **Rotina dialog (nº 7) special case**: per spec §4's table, "só `status` editável" — its
  "editar" affordance should route into `instanciasRotina`'s existing update-only form (already
  correctly restricted by `capabilities.create/delete: false`, `updatableFields: ["status"]`),
  not imply any new create/delete capability.

### Claude's Discretion

Exact component file layout (spec §8 anticipates
`dashboard/dialogs/{TicketDialog,DayDialog,TaskDialog,ProjectDialog,FundoDialog,EtapaDialog,
RotinaDialog}.svelte` — follow that, it's spec-anticipated) and whether a shared base
`FocusDialog.svelte` wrapper factors out the common title/context-line/footer chrome (spec §4's
"Regras comuns") versus 7 independent components each repeating that chrome — planner's
discretion, but a shared wrapper is likely the more maintainable/spec-consistent choice since the
rules are identical across all 7.

**This research's recommendation:** build the shared `FocusDialog.svelte` wrapper (see Q4/Pattern
3 below) — the discretion is exercised in favor of the wrapper, backed by the width/chrome
analysis in this document.

### Deferred Ideas (OUT OF SCOPE)

None — this is the final functional phase of the milestone. After this phase: milestone audit →
complete → tag v1.3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| DLG-01 | 7 focus dialogs (Ticket, Dia, Tarefa, Projeto, Fundo, Etapa, Rotina), 3 widths only, title/context-line/read-only-body/footer(editar+ver na página completa+fechar); "editar" opens the corresponding `EntityScreen` form with no duplicate markup | Q1 (data coverage per dialog), Q2 (exact "editar" testids per config), Q4 (shared `FocusDialog.svelte` feasibility), Pattern 3 (concrete wrapper code) |
| DLG-02 | Every clickable Dashboard/section surface named in spec §4 is a real `<button>`, keyboard-accessible, opens the correct dialog; nested targets use `stopPropagation` | Exhaustive Inert-Button Inventory (14 file:line-precise entries + 2 additions needed), Pitfalls 2/3, Open Questions 2/3 |
| DLG-03 | Max navigation depth 2; Esc/click-outside/× close except mid-write; destructive actions stay in `AlertDialog` | Q5 (depth-cap-2 stack mechanism), Pattern 3 (`escapeKeydownBehavior` reuse), Anti-Patterns section |
</phase_requirements>

## Summary

Phase 23 wires 7 read-first "focus dialogs" onto ~20 already-rendered-but-inert `<button>` elements (and 2 elements that are still plain non-interactive `<div>`s and must become buttons) spread across `web/src/lib/dashboard/{WeekCalendar,TicketQueue,ProjectStrips,RoutinesByFundo,MonthHeatmap}.svelte`, plus a smaller, contextually-scoped extension inside `web/src/lib/sections/ProjetosSection.svelte`'s "etapas ▾ kanban" toggle. The single existing `dashboardQuery.ts` query already carries every field every dialog's "conteúdo mínimo" needs — confirmed field-by-field below — so **no new `db.useQuery` is required anywhere in this phase**. The only data-layer work is (a) widening a few already-declared-but-too-narrow local TypeScript row types so dialogs can read fields (`corpo`, `remetente`, `status`) that are already present at runtime but currently untyped in `Dashboard.svelte`'s own `TicketRow`/`TarefaRow` etc., and (b) a couple of trivial pure joins/filters (tarefa→projeto→fundo lookup for the Tarefa dialog's context line; fundo-scoped, week-unbounded rotina/projeto/ticket filters for the Fundo dialog) that reuse `agendaPorDia`'s existing cross-referencing idiom rather than adding any db-level fetch.

"Editar" reuses the exact hidden-`EntityScreen`+driven-`row-edit`-click pattern already proven three times in `ProjetosSection.svelte` (`openProjetoDialog`/`openEtapaDialog`/`openTarefaDialog`, lines 200-283) — the testid is always `row-edit` scoped inside `[data-testid="row"][data-eid="<id>"]`, identically for all 7 underlying `EntityConfig`s (this testid is defined once, generically, in `EntityScreen.svelte:542`, never per-entity). "Ver na página completa →" reuses `Dashboard.svelte`'s existing `goToTickets`/`goToProjetos` click-simulation idiom (driving `[data-testid="nav-<etype>"]`) — CONTEXT.md explicitly mandates "no new navigation concept," which rules out threading `Shell.svelte`'s currently-unused `Route.selectedId`/`Route.tab` fields through 3 section components that don't yet accept them; this is flagged as an explicit, deliberate scope-limiting decision below, not an oversight. A shared `FocusDialog.svelte` wrapper (S/M/L width prop + title/context-line/footer chrome, Svelte 5 snippet for body) is clearly feasible and is the recommended approach. Depth-cap-2 is best implemented as a local `$state` stack of at most 2 refs per host component (`Dashboard.svelte` and, independently, `ProjetosSection.svelte`), rendering only the top of the stack (swap-in-place), with the breadcrumb `<button>` popping the stack back to length 1 — never two simultaneously-open `Dialog.Root`s.

**Primary recommendation:** Build one shared `FocusDialog.svelte` chrome wrapper + 7 body-only dialog components per spec §8's anticipated file layout; wire every inert button via callback props threaded down from whichever host component already holds the full row data (`Dashboard.svelte` for 6 of 7 dialogs, `ProjetosSection.svelte` additionally for the Etapa/Tarefa pair reachable from its own "etapas ▾ kanban" toggle); add zero new queries; fix the pre-existing `rotina Item.titulo` placeholder-UUID display bug in `WeekCalendar.svelte`/its weekend popover while wiring their click handlers, since both problems live on the exact same elements.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dialog chrome (width/title/context-line/footer/escape behavior) | Browser / Client (Svelte component) | — | Pure presentational composition, no data ownership of its own — mirrors `EntityScreen.svelte`'s own `Dialog.Content` idiom |
| Dialog body content (read-only fields per entity) | Browser / Client | API / Backend (InstantDB, read-only) | Rendered from data the host component already holds client-side from `dashboardQuery.ts`/`ProjetosSection`'s bespoke query — no dialog ever issues its own fetch |
| "editar" (opens real form) | Browser / Client, driving `EntityScreen.svelte`'s existing form | API / Backend (InstantDB `transact`) | `EntityScreen.svelte` already owns all create/update/delete transaction logic; dialogs only drive its DOM, never duplicate its logic |
| "ver na página completa →" (navigation) | Browser / Client (`Shell.svelte`'s local `rota` `$state`) | — | Pure client-side route `$state` swap, no schema/URL/router involved (spec §0.9: no store, no router) |
| Depth-cap-2 stack | Browser / Client (host component's local `$state`) | — | Local UI navigation state, not shared across pages — `Dashboard.svelte` and `ProjetosSection.svelte` each need their own independent stack |
| Data for all 7 dialogs | API / Backend (InstantDB, via the existing single query) | Browser / Client (derive.ts joins) | Zero new query; all cross-referencing is client-side over already-fetched arrays |

## Standard Stack

No new libraries. Everything below is already installed and already proven in this codebase.

### Core (already installed, reused as-is)

| Library | Version | Purpose | Why Standard (this codebase) |
|---------|---------|---------|-------------------------------|
| `bits-ui` (via `$lib/components/ui/dialog`) | `^2.16.3` `[VERIFIED: web/package.json:37]` | Dialog primitive (Root/Content/Header/Title/Description/Footer/Close) | Exact same primitive `EntityScreen.svelte` already uses for its create/edit dialog `[VERIFIED: web/src/lib/entities/EntityScreen.svelte:569-817]` |
| `svelte` | `^5.56.8` `[VERIFIED: web/package.json:42]` | Snippets (`{@render}` / `children` prop) for the shared dialog wrapper's body slot | Already the project's only UI framework; Svelte 5 runes (`$state`, `$derived`) already used everywhere in this codebase |
| `@instantdb/svelte` | `^1.0.63` `[VERIFIED: web/package.json:22]` | `db.useQuery` — but this phase adds **zero new call sites** of it | `dashboardQuery.ts`/`ProjetosSection.svelte` already cover every field needed (see Q1 below) |

### Supporting

None new. `$lib/components/ui/{dialog,popover,accordion,tabs,badge,button}` are all already installed per spec §7 and already imported across Phases 19-22's components.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local `$state` stack per host component | A Svelte context / global store for dialog state | Rejected: spec §0.9 explicitly forbids a global store; a context would also make `ProjetosSection.svelte` and `Dashboard.svelte` share state they have no reason to share (they hold independent, non-overlapping fetched data) |
| Driving `nav-<etype>` click for "ver na página completa" | Threading `Route.selectedId`/`.tab` through 3 section components | Rejected for this phase per CONTEXT.md's explicit "no new navigation concept" — documented as Open Question 1 below in case the planner wants to revisit |

**Installation:** none — no `npm install` needed this phase.

## Package Legitimacy Audit

Not applicable — this phase installs zero new packages (spec §0.3 / §10 forbid any dependency outside the already-installed shadcn-svelte registry, and no new registry component is needed either: dialog/popover/accordion/tabs/badge are all already present).

## Architecture Patterns

### System Architecture Diagram

```
User click on any inert <button>
  (WeekCalendar / TicketQueue / ProjectStrips / RoutinesByFundo / MonthHeatmap
   -- all children of Dashboard.svelte --
   OR ProjetosSection.svelte's own "etapas ▾ kanban" column-header/card)
        │
        ▼
  onclick calls a callback PROP passed down from the host component
  (mirrors Dashboard.svelte's existing onVerTodos/onVerProjetos idiom)
  e.g. onOpenTicket(id) / onOpenDia(iso) / onOpenTarefa(id) / onOpenProjeto(id) /
       onOpenFundo(id) / onOpenEtapa(id) / onOpenRotina(id)
        │
        ▼
  Host component (Dashboard.svelte OR ProjetosSection.svelte) --
  the ONLY place that holds the full already-fetched row arrays --
  pushes a { kind, id } ref onto its own local dialogStack $state
  (length-capped at 2; see Q5)
        │
        ▼
  Host looks up the FULL row object by id from its own query.data
  (dashboardQuery.ts's DASHBOARD_QUERY result, or ProjetosSection's
   bespoke db.useQuery result) -- zero new fetch, pure array .find()
        │
        ▼
  Host renders <FocusDialog size="S|M|L" ...> wrapping the ONE
  dialog component matching dialogStack's TOP entry
  (TicketDialog / DayDialog / TaskDialog / ProjectDialog / FundoDialog /
   EtapaDialog / RotinaDialog), passing the looked-up row as a prop
        │
        ├── "editar" clicked ─▶ dialog's OWN hidden <EntityScreen config={X}/>
        │                       host mounts (if not already) ─▶ bounded poll
        │                       for [data-testid="row"][data-eid=id]
        │                       [data-testid="row-edit"] ─▶ .click()
        │                       ─▶ EntityScreen's OWN existing create/edit
        │                       Dialog.Root opens on top, unmodified
        │
        ├── "ver na página completa →" clicked ─▶ drives
        │                       [data-testid="nav-<etype>"].click()
        │                       (Shell.svelte's rota $state swap) AND
        │                       closes the focus dialog (dialogStack = [])
        │
        ├── Projeto/Dia dialog's OWN body has a second inert button
        │                       (kanban card/column header, or an agenda
        │                       item) ─▶ SAME onOpenX callback, this time
        │                       pushing a 2nd ref (dialogStack.length -> 2)
        │                       ─▶ FocusDialog swaps in-place to render the
        │                       new top-of-stack dialog, with a breadcrumb
        │                       <button> that pops back to length 1
        │
        └── Esc / click-outside / × ─▶ escapeKeydownBehavior={busy?"ignore":"close"}
                                        (same idiom as EntityScreen.svelte:577-578)
```

### Recommended Project Structure

```
web/src/lib/dashboard/
├── dialogs/
│   ├── FocusDialog.svelte          # shared chrome: size prop, title, context line, footer, escape behavior
│   ├── TicketDialog.svelte         # nº1, M
│   ├── DayDialog.svelte            # nº2, M
│   ├── TaskDialog.svelte           # nº3, S
│   ├── ProjectDialog.svelte        # nº4, L
│   ├── FundoDialog.svelte          # nº5, M
│   ├── EtapaDialog.svelte          # nº6, M
│   └── RotinaDialog.svelte         # nº7, S
├── Dashboard.svelte                 # gains dialogStack $state + onOpenX callbacks threaded to children
├── WeekCalendar.svelte              # gains onOpenDia/onOpenItem props
├── TicketQueue.svelte               # gains onOpenTicket prop
├── ProjectStrips.svelte             # gains onOpenProjeto/onOpenFundo/onOpenEtapa/onOpenTarefa props
├── RoutinesByFundo.svelte           # gains onOpenFundo/onOpenRotina props
└── MonthHeatmap.svelte              # gains onOpenDia prop

web/src/lib/sections/
└── ProjetosSection.svelte           # gains its OWN independent dialogStack (Etapa/Tarefa only, from the kanban toggle) — see Open Question 2
```
(File layout matches spec §8's anticipated list verbatim `[CITED: spec-ui.md §8]`; only the `dialogs/` prefix and `FocusDialog.svelte` addition are this research's own recommendation, per CONTEXT.md's "Claude's Discretion.")

### Pattern 1: Hidden-EntityScreen "editar" host (proven 3× already)

**What:** Mount a hidden `<div class="hidden" aria-hidden="true"><EntityScreen config={X} /></div>`, lazily (`{#if hostReady}`), then bounded-poll for the target row's `row-edit` button and `.click()` it. bits-ui portals the resulting Dialog to `document.body` regardless of the hidden ancestor.
**When to use:** Every "editar" affordance in every one of the 7 dialogs.
**Example (exact reusable shape, condensed from the proven original):**
```svelte
<!-- Source: web/src/lib/sections/ProjetosSection.svelte:196-230 (openProjetoDialog/startEditProjeto) -->
async function openEditDialog(hostEl: HTMLDivElement | undefined, id: string): Promise<void> {
  hostReady = true;
  await tick();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const el = hostEl?.querySelector<HTMLButtonElement>(
      `[data-testid="row"][data-eid="${id}"] [data-testid="row-edit"]`,
    );
    if (el) { el.click(); return; }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
```
`row-edit` and `entity-create-start` are the ONLY testids involved and are defined exactly once, generically, in `EntityScreen.svelte:460,542` `[VERIFIED: web/src/lib/entities/EntityScreen.svelte:460,542]` — identical string for all 9 `EntityConfig`s, never per-entity. There is no `entity-edit-start` testid anywhere in this codebase (confirmed by grep across `web/src/lib`); CONTEXT.md's phrase "row-edit/entity-edit-start (or equivalent)" should be read as "`row-edit`" — the only one that exists.

### Pattern 2: Callback-prop-driven dialog opening (extends an existing idiom)

**What:** Leaf dashboard components never call `db.useQuery` themselves (already true today) and never resolve full rows themselves either — they only know an `id` (and sometimes a `tipo`, e.g. `WeekCalendar`'s calendar items). The host component (which already holds `query.data` in full) receives the click via a callback prop and does the id→full-row lookup itself.
**When to use:** Every one of the ~20 inert buttons inventoried below.
**Example:**
```svelte
<!-- Source: web/src/lib/dashboard/Dashboard.svelte:74-80 (existing goToTickets/goToProjetos
     precedent, extended here to dialog-opening callbacks) -->
<TicketQueue tickets={ticketRows()} onVerTodos={goToTickets} onOpenTicket={openTicketDialog} />
```
```ts
// Inside Dashboard.svelte
function openTicketDialog(id: string): void {
  dialogStack = [{ kind: "ticket", id }];
}
const activeTicket = $derived(
  dialogStack[0]?.kind === "ticket"
    ? (query.data as DashboardData | undefined)?.tickets?.find((t) => t.id === dialogStack[0].id)
    : undefined,
);
```

### Pattern 3: Shared `FocusDialog.svelte` chrome (Svelte 5 snippet body)

**What:** One wrapper owning width class, title, context line, footer (editar/ver na página/fechar), and `escapeKeydownBehavior`.
**When to use:** All 7 dialog components render `<FocusDialog>` as their outermost element.
**Example:**
```svelte
<!-- FocusDialog.svelte — new, this phase -->
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import type { Snippet } from "svelte";

  const WIDTH_CLASS = { S: "sm:max-w-md", M: "sm:max-w-3xl", L: "sm:max-w-[90vw]" } as const;

  let {
    open, size, title, contexto, busy = false, breadcrumb,
    onEditar, onVerPagina, onOpenChange, children,
  }: {
    open: boolean; size: "S" | "M" | "L"; title: string; contexto?: string;
    busy?: boolean; breadcrumb?: { label: string; onClick: () => void };
    onEditar?: () => void; onVerPagina?: () => void;
    onOpenChange: (open: boolean) => void; children: Snippet;
  } = $props();
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Content
    showCloseButton={!busy}
    escapeKeydownBehavior={busy ? "ignore" : "close"}
    interactOutsideBehavior={busy ? "ignore" : "close"}
    class={`${WIDTH_CLASS[size]} max-h-[85vh] overflow-y-auto`}
  >
    {#if breadcrumb}
      <button type="button" data-testid="focus-dialog-breadcrumb" onclick={breadcrumb.onClick}>
        ‹ {breadcrumb.label}
      </button>
    {/if}
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      {#if contexto}<Dialog.Description>{contexto}</Dialog.Description>{/if}
    </Dialog.Header>
    {@render children()}
    <Dialog.Footer>
      {#if onEditar}
        <Button type="button" variant="outline" data-testid="focus-dialog-editar" onclick={onEditar}>editar</Button>
      {/if}
      {#if onVerPagina}
        <Button type="button" variant="ghost" data-testid="focus-dialog-ver-pagina" onclick={onVerPagina}>
          ver na página completa →
        </Button>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```
Width classes and `max-h-[85vh] overflow-y-auto` are copied verbatim from `EntityScreen.svelte:579`'s existing dialog (`sm:max-w-lg` there is EntityScreen's own single-width form dialog, unrelated to the S/M/L split — the S/M/L values themselves come from CONTEXT.md's decisions, matching spec §4 "Regras comuns" `[CITED: spec-ui.md §4]`).

### Anti-Patterns to Avoid

- **Two simultaneously-open `Dialog.Root`s for depth-2 navigation:** would require juggling two focus traps/escape handlers and contradicts CONTEXT.md's own "breadcrumb volta um nível, não uma nova destinação" wording — render only the stack's top entry (swap-in-place), never mount two `FocusDialog` instances at once.
- **A new `db.useQuery` per dialog:** unnecessary — see Q1 below; every field is already fetched.
- **Threading `if (etype === ...)` into `EntityScreen.svelte`:** explicitly forbidden by spec §0.6 and CONTEXT.md; every "editar" affordance must drive the existing generic engine from the outside, exactly like `ProjetosSection.svelte` already does 3×.
- **A single app-wide/global dialog store:** forbidden by spec §0.9; `Dashboard.svelte` and `ProjetosSection.svelte` each need their own independent local stack since they hold independent, non-overlapping fetched data (see Open Question 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog focus trap / Esc / click-outside | Custom keydown listener + manual focus restoration | `$lib/components/ui/dialog`'s `Dialog.Content` (`escapeKeydownBehavior`/`interactOutsideBehavior`) | Already the exact mechanism `EntityScreen.svelte` uses; reinventing it would drift from the one `busy`-aware close idiom the whole app already shares |
| "Editar" form | A second, dialog-specific edit form per entity | Hidden `EntityScreen` instance + driven `row-edit` click (Pattern 1) | `EntityScreen.svelte` already owns every validation/transact/xor-unlink rule (`handleSubmit`, `EntityScreen.svelte:270-419`) — duplicating it anywhere is the exact "duplicate formulário" spec §4 forbids |
| Cross-referencing tarefa→projeto→fundo | An ad-hoc lookup inlined in a dialog's markup | The same `Map`-building idiom `agendaPorDia` already uses (`derive.ts:275-278`) | Keeps derive logic pure/testable and consistent with the one join pattern already established |

**Key insight:** every piece of this phase is composition over already-shipped, already-tested primitives (`EntityScreen`, `Dialog`, `derive.ts`, `dashboardQuery.ts`). There is no new "hard" sub-problem in this phase — the risk is entirely completeness (missing a click target) and consistency (depth cap, testids), not technical difficulty.

## Common Pitfalls

### Pitfall 1: Rotina items already display a placeholder UUID, not a human label
**What goes wrong:** `WeekCalendar.svelte`'s day-card items (`dash-week-item`) and its weekend popover (`dash-weekend-popover-item`) render `item.titulo` directly. For `tipo === "rotina"`, `agendaPorDia` deliberately sets `titulo: instancia.id` as a documented placeholder `[VERIFIED: web/src/lib/dashboard/derive.ts:252-258,320-328]` ("`instancia.id` is used as a stable, unique placeholder `titulo`... Phase 22... will need to resolve a human-readable label separately"). `Dashboard.svelte` already built the fix ingredient — a `rotinaNomeById: Map<string,string>` (`Dashboard.svelte:190-199`) — and already passes it to `RoutinesByFundo`, but **never to `WeekCalendar`**, so today a rotina item in the week calendar literally shows a UUID as its label.
**Why it happens:** Phase 22 built `rotinaNomeById` only for the component it was touching (`RoutinesByFundo`); `WeekCalendar` was Phase 21's scope and was never revisited.
**How to avoid:** While wiring `dash-week-item`'s click handler in this phase, also pass `rotinaNomeById` (or an equivalent resolved label) into `WeekCalendar.svelte` and use it in place of `item.titulo` for `tipo === "rotina"` items, in both the day cards and the weekend popover. This is a pre-existing display bug this phase's own code-touch is well-positioned to fix — flag it explicitly in the plan rather than silently perpetuating it.
**Warning signs:** Any e2e assertion on `dash-week-item`'s text content for a rotina row will show a UUID-shaped string.

### Pitfall 2: "Fundo" click targets can point at a null fundo
**What goes wrong:** `project-strip-fundo-badge` renders `data-eid={projeto.fundo?.id ?? ""}` and its label falls back to "Sem fundo vinculado" `[VERIFIED: web/src/lib/dashboard/ProjectStrips.svelte:160-166]`; `rotinas-fundo-titulo` similarly represents a group whose `fundoId` may be `null` `[VERIFIED: web/src/lib/dashboard/RoutinesByFundo.svelte:117-128]`. Wiring `onclick={() => onOpenFundo(id)}` naively would open a Fundo dialog for `id === ""` or `id === null`.
**Why it happens:** `projetos.fundo` and the routine's `template.fundo` are both `required: false` (spec §0.5).
**How to avoid:** Guard the handler (or disable/omit the onclick) when the resolved fundo id is falsy — there is no fundo record to show, so no dialog should open for "Sem fundo vinculado".
**Warning signs:** A dialog opening with an empty id, or a lookup returning `undefined`, rendered blank.

### Pitfall 3: `etapas-kanban`'s column/card are `<div>`, not `<button>` — a real DLG-02 violation today
**What goes wrong:** `ProjetosSection.svelte`'s "etapas ▾ kanban" view renders `etapa-kanban-column` and `etapa-kanban-card` as plain `<div>` elements with no click handler at all `[VERIFIED: web/src/lib/sections/ProjetosSection.svelte:597-628]` — not merely "inert," genuinely non-interactive markup that must be converted to real `<button>`s to satisfy both DLG-02's "never `div` com `onclick`" rule and (per CONTEXT.md's stated in-scope extension) to become Etapa/Tarefa dialog targets mirroring §3.5's own kanban rule (`[CITED: spec-ui.md §2.2]`: "O kanban aqui segue as regras de faixa de §3.5").
**Why it happens:** Phase 19 built this view purely as a read-only mirror of the list view's data, before any dialog concept existed.
**How to avoid:** Convert both to `<button type="button">`, add the dialog-open handlers, and — since this is the SAME accordion/list-view page also showing `etapa-row`/`etapa-tarefa-row`, which are NOT listed as dialog alvos anywhere in spec §4 — do not also wire those unrelated list-view elements; scope the dialog wiring strictly to the kanban-mode elements (see Open Question 2 for the exact ambiguity this resolves).

### Pitfall 4: `EntityScreen`'s create/edit dialog and the new focus dialog both use `sm:max-w-lg`-shaped classes — don't let widths collide visually
**What goes wrong:** Opening "editar" from inside a Focus Dialog stacks a second `Dialog.Root` (EntityScreen's own form dialog) on top of the first. This is expected and already how `ProjetosSection.svelte` works today (its hidden-host pattern already portals a second dialog on top of the visible master-detail UI) — but a naive implementation might try to close the Focus Dialog first and then open the edit dialog, introducing a flash/race.
**Why it happens:** Both dialogs are independent `Dialog.Root` instances portaled to `document.body`; nothing forces sequencing.
**How to avoid:** Do NOT close the Focus Dialog when "editar" is clicked — leave it mounted (or hide it, `open=false`, without resetting `dialogStack`) and let the driven `EntityScreen` form dialog open on top, exactly mirroring the already-proven `ProjetosSection.svelte` behavior where the visible master-detail page stays mounted underneath the driven edit dialog.
**Warning signs:** A visible flash of the underlying page/dialog between clicking "editar" and the form dialog appearing.

## Code Examples

### Bounded-poll pattern for driving a hidden EntityScreen (verbatim precedent)
```ts
// Source: web/src/lib/sections/SubtarefasPanel.svelte:67-75
async function pollFor<T>(description: string, fn: () => T | null | undefined): Promise<T> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${description}`);
}
```

### Existing nav-simulation "ver na página completa" precedent
```ts
// Source: web/src/lib/dashboard/Dashboard.svelte:74-80
function goToTickets(): void {
  document.querySelector<HTMLButtonElement>('[data-testid="nav-tickets"]')?.click();
}
function goToProjetos(): void {
  document.querySelector<HTMLButtonElement>('[data-testid="nav-projetos"]')?.click();
}
// This phase adds: goToFundos ([data-testid="nav-fundos"]),
// goToInstanciasRotina ([data-testid="nav-instanciasRotina"]) — same shape.
```

## Exhaustive Inert-Button Inventory (DLG-02)

Every currently-inert `<button>` (or, where flagged, non-button `<div>` that must become one) across Phases 19-22, with exact file:line, current testid, and the dialog it must open. "Inert" = no `onclick` at all today (verified by reading the full component source this session).

| # | File:Line | Testid | data-eid source | Current state | Target dialog | Notes |
|---|-----------|--------|------------------|----------------|---------------|-------|
| 1 | `WeekCalendar.svelte:45-54` | `dash-week-day-header` | `dia` (ISO string) | inert `<button>` | **#2 Dia** | header of each of the 5 weekday cards |
| 2 | `WeekCalendar.svelte:57-67` | `dash-week-item` | `item.id`, `data-tipo={item.tipo}` | inert `<button>` | **#3 Tarefa** (tipo=tarefa), **#7 Rotina** (tipo=rotina), **#1 Ticket** (tipo=ticket, always hard-deadline) | dispatch dialog by `item.tipo`; fix Pitfall 1 (rotina label) while here |
| 3 | `WeekCalendar.svelte:93-102` | `dash-weekend-popover-item` | `item.id`, `data-tipo` | **currently a `<div>`, not a button** — must convert | same dispatch as #2 | inside the `sáb/dom` `Popover.Content` |
| 4 | `WeekCalendar.svelte:83-106` (popover as a whole) | *(none yet — gap)* | sábado/domingo ISO dates | **missing entirely**: spec's "o clique no dia abre o dialog nº 2" has no corresponding per-day header/button in the current popover markup, which only lists a flat combined item list | **#2 Dia** (×2: one for sábado, one for domingo) | must ADD two new `<button>` day-headers inside `Popover.Content`, not just wire an existing element — see Open Question 3 |
| 5 | `TicketQueue.svelte:49-60` | `dash-ticket-card` | `ticket.id` | inert `<button>` (already `type="button"`, no `onclick`) | **#1 Ticket** | whole card |
| 6 | `ProjectStrips.svelte:157-159` | `project-strip-nome` | *(none — read via closure)* | inert `<button>` | **#4 Projeto** | use the `projeto.id` from the enclosing `{#each}` |
| 7 | `ProjectStrips.svelte:160-166` | `project-strip-fundo-badge` | `projeto.fundo?.id ?? ""` | inert `<button>` | **#5 Fundo** | guard against empty/null id (Pitfall 2) |
| 8 | `ProjectStrips.svelte:187-191` | `project-strip-column-header` | `etapa.id` (on parent `project-strip-column` div, line 184) | inert `<button>` | **#6 Etapa** | this is a **second-level** dialog reachable from Projeto dialog's own body if the same markup is reused there (see Q5) |
| 9 | `ProjectStrips.svelte:199-214` | `project-strip-card` | `tarefa.id` | inert `<button>` | **#3 Tarefa** | same second-level consideration as #8 |
| 10 | `RoutinesByFundo.svelte:122-128` | `rotinas-fundo-titulo` | `grupo.fundoId ?? ""` | inert `<button>` | **#5 Fundo** | guard against `null` (Pitfall 2) |
| 11 | `RoutinesByFundo.svelte:137-153` | `rotinas-row` | `instancia.id` | inert `<button>` | **#7 Rotina** | CONTEXT.md calls for `stopPropagation` here defensively even though, structurally, `rotinas-row` is a sibling of `rotinas-fundo-titulo` inside `rotinas-fundo-card` (a plain non-clickable `div`), not a descendant of it — no actual bubbling conflict exists today, but add `stopPropagation` anyway per CONTEXT's explicit instruction and in case `rotinas-fundo-card` itself later becomes clickable |
| 12 | `MonthHeatmap.svelte:60-66` | `dash-heatmap-cell` | `iso` (the cell's date, both weekday and weekend cells) | inert `<button>` (already `type="button"`, no `onclick`) | **#2 Dia** | applies uniformly to weekend cells too (spec: "Célula é `<button>` → dialog nº 2") |
| 13 | `ProjetosSection.svelte:597-607` | `etapa-kanban-column` | `etapa.id` (on wrapping div, line 599) | **currently a `<div>`, not a button** — must convert | **#6 Etapa** | inside "etapas ▾ kanban" toggle only — see Open Question 2 for scope boundary |
| 14 | `ProjetosSection.svelte:610-628` | `etapa-kanban-card` | `tarefa.id` (on wrapping div, line 612) | **currently a `<div>`, not a button** — must convert | **#3 Tarefa** | same scope note as #13 |

**Explicitly NOT in scope (verified already wired, or verified non-target by spec):**
- `dash-week-prev`/`dash-week-next`/`dash-week-today` (`Dashboard.svelte:228-251`) — already wired, week navigation, not a dialog.
- `dash-tickets-ver-todos` (`TicketQueue.svelte:65-72`), `dash-projetos-ver-todos` (`ProjectStrips.svelte:132-139`) — already wired "ver todos" links, spec's own named exception to "everything visible is clickable."
- `project-strip-collapse` (`ProjectStrips.svelte:150-156`) — already wired (collapse toggle), not a dialog target.
- `rotinas-agrupar`/`rotinas-ordenar`/`rotinas-status`, `project-groupby`/`project-search` — functional display controls, not dialog targets.
- `etapa-tarefa-subtarefas-chip` (`ProjetosSection.svelte:543-553`) — already wired, opens the existing `SubtarefasPanel`, unrelated to Focus Dialogs.
- `etapa-row` (Accordion.Trigger, `ProjetosSection.svelte:481-497`) and the list-view `etapa-tarefa-row` (`ProjetosSection.svelte:514-554`) — NOT listed in spec §4's "alvos" column anywhere; recommended out of scope (see Open Question 2).
- `*-overflow` indicators (`dash-week-item-overflow`, `project-strip-card-overflow`, `rotinas-overflow`) — plain `<div>`s showing "+N", never listed as clickable in spec §4; leave as non-interactive.
- `dash-tickets-empty`/`dash-projetos-empty` `Empty.Root` states — no dialog applicable.

## Q1 — Does `dashboardQuery.ts` already carry every field each dialog's "conteúdo mínimo" needs?

**Yes, for all 7 dialogs, with zero new `db.useQuery` anywhere.** InstantDB's InstaQL always returns every own scalar attribute of a queried/linked entity (this codebase never uses field-selection — confirmed by every existing query in `EntityScreen.svelte:69-76`, `dashboardQuery.ts:17-23`, `ProjetosSection.svelte:68-73`, all of which nest only link labels, never a field allowlist) `[VERIFIED: web/src/lib/dashboard/dashboardQuery.ts:17-23]`. The table below maps each dialog's spec §4 "conteúdo mínimo" to the exact already-fetched path:

| # | Dialog | Conteúdo mínimo (spec §4) | Already covered by `DASHBOARD_QUERY`? | Gap / supplementary work |
|---|--------|---------------------------|----------------------------------------|---------------------------|
| 1 | Ticket | corpo, remetente, dataRecebimento, tipoPrazo, fundo, subtarefas | Yes — `tickets: { fundo: {}, subtarefas: {} }` returns full ticket scalars (`corpo`, `remetente`, `dataRecebimento`, `status`, etc. per `defs/tickets.ts:18-32`) + full `fundo`/`subtarefas` rows | **Type-only gap**: `Dashboard.svelte`'s own `TicketRow` type (lines 39-47) declares only `id, titulo, tipoPrazo, dataPrevista, dataRecebimento, fundo, subtarefas` — missing `corpo`/`remetente`/`status` in the TS view. Widen this type (or declare a wider one in `TicketDialog.svelte`) — the runtime objects already have these fields. |
| 2 | Dia | agenda integral do dia (tarefas+rotinas+tickets, hard→soft, sem corte) + "ir para esta semana" | Yes — `agendaPorDia`'s per-day `Item[]` is already uncapped (the 3-item cap is `WeekCalendar.svelte:42`'s own `.slice(0,3)`, UI-only); `Dashboard.svelte`'s `agenda` Map already holds the full list | None — read `agenda.get(iso)` directly, no slice. "ir para esta semana" = `semanaBase = <that week's Monday>`, same `shiftIso`/direct-assign idiom `Dashboard.svelte:91-95,232-251` already uses. |
| 3 | Tarefa | campos da tarefa, etapa e projeto pai (ou "Sem etapa"), prazo, competência, subtarefas | Yes — `tarefas: { etapa: { projeto: {} }, subtarefas: {} }` returns full tarefa scalars (incl. `competencia`, `descricao`, `dataPrevistaEstimada` per `defs/tarefas.ts:19-38`) + full `etapa`/`projeto` rows + `subtarefas` | **Fundo context is a join, not a fetch**: `tarefa.etapa.projeto` does NOT nest `.fundo` in this query branch (only the top-level `projetos: { fundo: {}, ... }` branch does). Resolve the tarefa's fundo the same way `agendaPorDia` already does — build/reuse a `projetoId → fundo` `Map` from the top-level `projetos` array (`derive.ts:275-278`'s exact idiom), never expect `.etapa.projeto.fundo` to exist on the tarefa row itself. |
| 4 | Projeto | kanban completo das etapas (ordem asc), scroll horizontal, "+ tarefa" por coluna | Yes — `projetos: { fundo: {}, etapas: { tarefas: {} } }` is already unlimited (the 3-card cap is `ProjectStrips.svelte`'s own UI-only slice) | None for read data. "+ tarefa" per coluna needs its own hidden-`EntityScreen(tarefasConfig)` host with `presetLinks={{etapa: <clicked column's etapa id>}}` — a NEW instance of Pattern 1 inside the Projeto dialog component (not a query gap, a componentry-reuse task). |
| 5 | Fundo | todas as rotinas do fundo (não só da semana), projetos e tickets vinculados | Yes, but needs an **unfiltered-by-week** derivation, not the week-scoped `rotinasPorFundo` | `instanciasRotina: { template: { fundo: {} } }` already fetches EVERY instance system-wide (the week-window is applied only inside `rotinasPorFundo`'s own filter, `derive.ts:377-397`, never in the query). Recommend one new tiny pure export in `derive.ts`, e.g. `rotinasDoFundo(instancias, fundoId): InstanciaLike[]` (a filter, no week param) — trivial, but keeps parity with derive.ts's existing "pure, testable" discipline. Projetos/tickets vinculados: trivial `.filter(p => p.fundo?.id === fundoId)` over the already-fetched top-level `projetos`/`tickets` arrays — no new function strictly required, but could live alongside `rotinasDoFundo` for symmetry (discretion). |
| 6 | Etapa | todas as tarefas da etapa (sem limite de 3), ordem, projeto pai | Yes — same `projetos.etapas.tarefas` path as #4, already uncapped | None — "projeto pai" is already known to the caller (the Projeto strip / ProjetosSection's own selected project already carries the etapa), pass it down as a prop rather than re-deriving it. |
| 7 | Rotina | competência, dataPrevista, fundo, template que gerou, dedupeKey; só status editável | Yes — `instanciasRotina: { template: { fundo: {} } }` returns full instance scalars (`dedupeKey`, `competencia`, `dataPrevista`, `dataPrevistaEstimada`, `tipoPrazo`, `status` per `defs/instanciasRotina.ts:46-58`) + full `template` row (incl. `nome`, already read once at `Dashboard.svelte:152-158,196`) + full `fundo` row | **Type-only gap**, same shape as #1: `Dashboard.svelte`'s own `InstanciaRotinaRow` type (lines 32-38) does not currently declare `dedupeKey`/`dataPrevistaEstimada` — widen locally, no query change. `capabilities.create/delete: false`, `updatableFields: ["status"]` are already enforced generically by `EntityScreen.svelte:123-128` the moment "editar" drives `instanciasRotinaConfig` — zero extra work for the "só status editável" requirement. |

**Conclusion:** no dialog needs a new `db.useQuery`. The only "supplementary" work is (a) widening 2 already-declared local TS row types (Ticket, Rotina), and (b) one small new pure `derive.ts` export for the Fundo dialog's week-unbounded rotina filter (optionally 2 more trivial one-line filters for projetos/tickets, discretion).

## Q2 — "editar" pattern: exact testids per EntityConfig

Confirmed generic and identical for all 7: `[VERIFIED: web/src/lib/entities/EntityScreen.svelte:460,542]`
- Create trigger: `data-testid="entity-create-start"` (only rendered when `mode === null && config.capabilities.create`, `EntityScreen.svelte:459-464`)
- Edit trigger per row: `data-testid="row-edit"`, scoped inside `[data-testid="row"][data-eid="<id>"]` (`EntityScreen.svelte:524,538-546`), only rendered when `config.capabilities.update`
- There is **no** `entity-edit-start` testid anywhere in this codebase — CONTEXT.md's "row-edit/entity-edit-start (or equivalent)" phrasing should be read as "always `row-edit`."

Per-dialog underlying `EntityConfig` (all resolved via `configByEtype`, never a direct `defs/*.ts` import, per the `requireConfig` idiom every section component already uses):

| # | Dialog | `etype` / config | `capabilities.update` | `updatableFields` | Notes |
|---|--------|-------------------|------------------------|--------------------|-------|
| 1 | Ticket | `tickets` (`ticketsConfig`) | `true` `[VERIFIED: web/src/lib/entities/defs/tickets.ts:17]` | none (all fields) | full form |
| 2 | Dia | *(none — no underlying entity)* | n/a | n/a | "editar" does not apply to a virtual day; see Open Question 1 |
| 3 | Tarefa | `tarefas` (`tarefasConfig`) | `true` `[VERIFIED: web/src/lib/entities/defs/tarefas.ts:18]` | none | full form |
| 4 | Projeto | `projetos` (`projetosConfig`) | `true` `[VERIFIED: web/src/lib/entities/defs/projetos.ts:13]` | none | reuse `ProjetosSection.svelte`'s exact `projetoHostReady`/`openProjetoDialog` shape (lines 189-230), relocated into `ProjectDialog.svelte` |
| 5 | Fundo | `fundos` (`fundosConfig`) | `true` `[VERIFIED: web/src/lib/entities/defs/fundos.ts:11]` | none | full form |
| 6 | Etapa | `etapas` (`etapasConfig`) | `true` `[VERIFIED: web/src/lib/entities/defs/etapas.ts:20]` | none | full form |
| 7 | Rotina | `instanciasRotina` (`instanciasRotinaConfig`) | `true` `[VERIFIED: web/src/lib/entities/defs/instanciasRotina.ts:44-45]` | `["status"]` `[VERIFIED: web/src/lib/entities/defs/instanciasRotina.ts:45]` | `EntityScreen.svelte:123-128`'s `editableFields()` ALREADY narrows the edit form to `status` only in edit mode — no extra work needed to satisfy "só status editável" |

## Q3 — "ver na página completa →" pattern

`Shell.svelte`'s `Route` type declares, but has never used, `tab?: string` and `selectedId?: string | null` `[VERIFIED: web/src/lib/Shell.svelte:17-19]`. None of `ProjetosSection.svelte`, `RotinasSection.svelte`, or `TicketsSection.svelte` accept any prop from `Shell.svelte` today (all 3 are mounted with zero props, `Shell.svelte:124,132,140`) — so these fields are currently structurally dead.

CONTEXT.md's explicit instruction — "reuses Phase 18-22's existing route/section machinery, no new navigation concept" — is read here as: **do not** wire up `selectedId`/`tab` this phase; reuse the exact `goToTickets`/`goToProjetos` click-simulation idiom (`Dashboard.svelte:74-80`) for every dialog's "ver na página completa →", landing on the section's default view with nothing pre-selected:

| # | Dialog | Drives | Lands on |
|---|--------|--------|----------|
| 1 | Ticket | `[data-testid="nav-tickets"]` | Tickets list, unselected |
| 2 | Dia | *(no page — see Open Question 1)* | — |
| 3 | Tarefa | `[data-testid="nav-projetos"]` | Projetos master-detail, unselected |
| 4 | Projeto | `[data-testid="nav-projetos"]` | Projetos master-detail, unselected |
| 5 | Fundo | `[data-testid="nav-fundos"]` | Fundos list |
| 6 | Etapa | `[data-testid="nav-projetos"]` | Projetos master-detail, unselected |
| 7 | Rotina | `[data-testid="nav-instanciasRotina"]` | Rotinas section, Instâncias tab (already the default) |

This is flagged explicitly as Open Question 1 — landing "unselected" is weaker UX than deep-linking to the exact row, but is the literal, minimal-risk reading of both spec §4 (which only specifies the destination *section*, never a selected row) and CONTEXT.md's own "no new navigation concept" wording.

## Q4 — Is a shared `FocusDialog.svelte` wrapper feasible?

**Yes, and recommended.** The 3 widths are a pure 3-way class switch (`sm:max-w-md` / `sm:max-w-3xl` / `sm:max-w-[90vw]`, all sharing `max-h-[85vh] overflow-y-auto` `[CITED: spec-ui.md §4 "Regras comuns"]`), and the differing content shape per dialog is exactly what a Svelte 5 snippet (`{@render children()}`) is for — see Pattern 3 above for the concrete implementation. This also directly matches CONTEXT.md's own steer ("a shared wrapper is likely the more maintainable/spec-consistent choice since the rules are identical across all 7"). Each of the 7 dialog components (`TicketDialog.svelte` etc.) becomes a thin wrapper: resolve/receive its row data, render `<FocusDialog>` with its own title/context-line string and body snippet, wire its own "editar" hidden-host and (for Projeto/Dia only) its own second-level open callback.

## Q5 — Depth-cap-2 mechanism

Recommended: a local `$state` stack of at most 2 refs, owned independently by each host component (`Dashboard.svelte` and, separately, `ProjetosSection.svelte` if Open Question 2 resolves in favor of wiring its kanban toggle) — **not** a single global stack, since spec §0.9 forbids a global store and the two host components hold independent, non-overlapping fetched data anyway.

```ts
type DialogRef =
  | { kind: "ticket" | "tarefa" | "projeto" | "fundo" | "etapa" | "rotina"; id: string }
  | { kind: "dia"; id: string /* ISO date */ };

let dialogStack = $state<DialogRef[]>([]);

function openDialog(ref: DialogRef): void {
  // dialogStack.length is 0 or 1 at every call site that can actually
  // reach openDialog a second time (only Projeto/Dia dialogs render any
  // "open a dialog" affordance in their own body — CONTEXT.md: "Ticket/
  // Fundo/Etapa/Tarefa/Rotina dialogs never open another dialog from
  // inside themselves"), so this branch is structural, not just defensive.
  dialogStack = dialogStack.length === 0 ? [ref] : [dialogStack[0], ref];
}
function popToFirst(): void {
  dialogStack = dialogStack.slice(0, 1);
}
function closeAll(): void {
  dialogStack = [];
}
```

Rendering: only the TOP of the stack (`dialogStack[dialogStack.length - 1]`) is ever passed to a single mounted `<FocusDialog open={dialogStack.length > 0}>` — this is "swap-in-place," matching CONTEXT.md's own text precisely ("o breadcrumb no topo do dialog volta um nível... a breadcrumb é um `<button>` back... não uma nova destinação"), never two simultaneously-open `Dialog.Root`s. The breadcrumb button (rendered only when `dialogStack.length === 2`) calls `popToFirst()`.

## Open Questions

1. **Does the Dia dialog (#2) have "editar" and "ver na página completa →" at all?**
   - What we know: spec §4's row for Dia lists only "agenda integral do dia... botão 'ir para esta semana'" as its content — no underlying single entity exists to edit or navigate to. "Regras comuns" says universally "Todo dialog tem... rodapé com editar, ver na página completa → e fechar," which is directly in tension with Dia having no entity.
   - What's unclear: whether the spec author intended Dia to be a literal exception (its footer is closed + "ir para esta semana" only) or whether "editar"/"ver na página completa" should be omitted silently when not applicable (i.e., the shared `FocusDialog` simply renders no such buttons for Dia, controlled by omitting the `onEditar`/`onVerPagina` props — which `FocusDialog`'s own `{#if onEditar}`/`{#if onVerPagina}` guards already support, see Pattern 3).
   - Recommendation: treat Dia as the one dialog that omits both `onEditar` and `onVerPagina` and instead passes a dedicated "ir para esta semana" action in their place — `FocusDialog`'s footer slot already supports this via optional props, no wrapper redesign needed. Flag for discuss-phase/planner confirmation, but do not block on it.

2. **Does DLG-02's wiring extend into `ProjetosSection.svelte`'s own etapa/tarefa surfaces beyond the "etapas ▾ kanban" toggle?**
   - What we know: spec §4's "alvos" column for Etapa (#6) and Tarefa (#3) dialogs lists ONLY Dashboard-based targets ("cabeçalho de coluna do mini-kanban," "item do calendário; card do kanban"). CONTEXT.md's own code-context section additionally says "plus §2.2's etapa/tarefa rows inside `ProjetosSection` where dialogs also apply per spec §4's 'alvos' column."
   - What's unclear: whether "etapa/tarefa rows" refers ONLY to `ProjetosSection.svelte`'s "etapas ▾ kanban" toggle (`etapa-kanban-column`/`etapa-kanban-card`, items #13-14 in the inventory — which literally mirror spec §3.5's kanban rule per §2.2's own words "o kanban aqui segue as regras de faixa de §3.5") or ALSO the default list-view's `etapa-row` (already an `Accordion.Trigger` that expands/collapses) and `etapa-tarefa-row` (already hosts the unrelated subtarefas-chip button).
   - Recommendation: scope this phase's `ProjetosSection.svelte` dialog-wiring to the kanban-toggle elements only (items #13-14) — this is the literal, lower-risk reading, avoids overloading `etapa-row`'s existing accordion-toggle semantics with a second competing click meaning, and is explicitly supported by §2.2's own "segue as regras de §3.5" cross-reference. If the planner/discuss-phase wants the list-view rows wired too, that is an additive follow-up, not a blocker for this phase's completeness.

3. **The weekend chip's `Popover.Content` is missing the "click no dia" affordance entirely (not just unwired).**
   - What we know: spec §3.3 says "abre `Popover` com os itens dos dois dias. O clique num item abre o dialog do item; **o clique no dia** abre o dialog nº 2." The current implementation (`WeekCalendar.svelte:92-104`) renders only a flat combined `weekendItems` list with no per-day grouping or day-level clickable header at all.
   - What's unclear: exact visual/markup shape of the missing "dia" click target (e.g., "sábado"/"domingo" section headers above each day's items inside the popover).
   - Recommendation: add two `<button>` day-headers (e.g. "sábado DD" / "domingo DD") inside `Popover.Content`, each opening Dialog #2 for that specific date, positioned above that day's item subset (which requires splitting `weekendItems` back into its two source arrays — `agenda.get(sabado)` / `agenda.get(domingo)`, already computed separately at `WeekCalendar.svelte:36` before being concatenated). This is a genuine small addition, not just a wiring task — flag explicitly in the plan so it isn't missed as "already exists, just needs onclick."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Unit framework | `bun test src` (Bun's built-in test runner) `[VERIFIED: web/package.json:9]` |
| Unit test location | `web/src/lib/dashboard/derive.test.ts` (existing, extend for any new `derive.ts` export) `[VERIFIED: web/src/lib/dashboard/derive.test.ts present]` |
| e2e framework | Playwright (`playwright.config.ts`) `[VERIFIED: web/playwright.config.ts present]` |
| e2e location | `web/e2e/dashboard.spec.ts`, `web/e2e/dashboard-kanbans.spec.ts` (existing Dashboard specs; new `web/e2e/focus-dialogs.spec.ts` recommended for this phase) |
| Quick run command | `cd web && bun test src/lib/dashboard/derive.test.ts` |
| Full suite command | `cd web && bun test src && bun run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| DLG-01 | All 7 dialogs render at correct S/M/L width with title/context/body/footer | e2e | `playwright test focus-dialogs.spec.ts -g "widths"` | ❌ Wave 0 — new file |
| DLG-01 | "editar" opens the correct `EntityScreen` form, no duplicate markup | e2e | `playwright test focus-dialogs.spec.ts -g "editar"` | ❌ Wave 0 |
| DLG-02 | Every inventoried button (14 items above) is a real `<button>`, keyboard-activatable, opens the right dialog | e2e | `playwright test focus-dialogs.spec.ts -g "DLG-02"` | ❌ Wave 0 |
| DLG-02 | Nested targets use `stopPropagation` (rotinas-row inside fundo card, fundo-badge inside project-strip header) | e2e | `playwright test focus-dialogs.spec.ts -g "propagation"` | ❌ Wave 0 |
| DLG-03 | Depth never exceeds 2; breadcrumb pops back to level 1 | e2e | `playwright test focus-dialogs.spec.ts -g "depth-cap"` | ❌ Wave 0 |
| DLG-03 | Esc/click-outside/× close except while `busy`; destructive action still uses `AlertDialog` | e2e | `playwright test focus-dialogs.spec.ts -g "escape"` | ❌ Wave 0 |
| (new derive.ts export, if added for Q1's Fundo-dialog gap) | `rotinasDoFundo` filters correctly, ignoring week window | unit | `bun test src/lib/dashboard/derive.test.ts -t "rotinasDoFundo"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test src/lib/dashboard/derive.test.ts` (if `derive.ts` touched) + `svelte-check`/`tsc` (`bun run check`)
- **Per wave merge:** `bun run test:e2e` (full Playwright suite, since Shell.svelte/Dashboard.svelte/ProjetosSection.svelte are all touched and every existing e2e spec that visits Dashboard or Projetos must stay green)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `web/e2e/focus-dialogs.spec.ts` — new file covering DLG-01/02/03 across all 7 dialogs and all 14 inventoried click targets
- [ ] `derive.test.ts` additions for any new pure export (`rotinasDoFundo` etc., per Q1)
- [ ] No new framework install needed — Bun test + Playwright are already configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — `db.useAuth()` already gates the whole Shell |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes (read path only) | `instant.perms.ts`'s existing `donoId`-scoped `view` rule already scopes every row server-side for `dashboardQuery.ts`/`ProjetosSection`'s bespoke query (unchanged this phase, per spec §0 "zero `instant.perms.ts` changes") — dialogs read data already fetched under that scoping, they add no new query surface |
| V5 Input Validation | No new surface | Dialogs are read-only; the only writes are "editar," which routes through `EntityScreen.svelte`'s existing, unmodified `handleSubmit` validation |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| A dialog opened with a stale/foreign id (e.g. via a manipulated DOM `data-eid`) resolving to another user's row | Information Disclosure | Not newly introduced — `instant.perms.ts`'s server-side `donoId` scoping (unchanged) means a lookup for an id outside the current session's own data returns nothing to look up client-side in the first place; the dialog would simply find no matching row and should render an empty/graceful state rather than crash |
| Client-side `dialogStack`/`selectedId` state used as an authorization boundary | Elevation of Privilege | `SubtarefasPanel.svelte:44-47`'s own documented note already establishes the precedent for this codebase: "`scopeWhere`/`presetLinks` below are client-side UI filters only, not an authorization mechanism — the real boundary is `instant.perms.ts`'s unchanged `donoId` scoping." The same applies to every dialog's local id-based lookup — never treat it as a security control. |

## Sources

### Primary (HIGH confidence — read directly this session)
- `web/src/lib/dashboard/{Dashboard,WeekCalendar,TicketQueue,ProjectStrips,RoutinesByFundo,MonthHeatmap}.svelte` — full read, every click target and current onclick state verified
- `web/src/lib/dashboard/{dashboardQuery.ts,derive.ts}` — full read, query shape and every pure export verified
- `web/src/lib/sections/{ProjetosSection,RotinasSection,TicketsSection,SubtarefasPanel}.svelte` — full read, hidden-EntityScreen pattern and driven-click precedent verified 3× (ProjetosSection) + 1× (SubtarefasPanel)
- `web/src/lib/entities/EntityScreen.svelte` — full read, testid provenance (`entity-create-start`, `row-edit`, `escapeKeydownBehavior`) verified
- `web/src/lib/entities/defs/{tickets,tarefas,projetos,fundos,etapas,instanciasRotina,templatesRotina,subtarefas}.ts` — full read, `capabilities`/`updatableFields`/`fields` verified per entity
- `web/src/lib/entities/{types,registry}.ts` — full read, `configByEtype`/`navConfigs` verified
- `web/src/lib/Shell.svelte` — full read, `Route` type and nav testid pattern verified
- `spec-ui.md` §0, §2, §3, §4, §5, §6, §7, §8, §9, §10 — read in full
- `.planning/phases/23-focus-dialog-system/23-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 18-23 sections) — read in full
- `shared/instant.schema.ts` — grepped for entity/link shape confirmation
- `web/package.json`, `.planning/config.json` — read for versions/workflow toggles

### Secondary / Tertiary
- None — every claim in this document traces to a file read this session or a spec section cited by number; no web search was needed or performed (this phase is pure composition over an existing, fully-internal codebase).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every primitive already proven in-repo
- Architecture (dialog stack, callback-prop wiring): HIGH — directly derived from 3 already-shipped precedents in this exact codebase (ProjetosSection's 3 hidden hosts, SubtarefasPanel's driven-create, Dashboard's goToTickets/goToProjetos)
- Button inventory: HIGH — every entry read line-by-line this session, no grep-only claims
- Pitfalls: HIGH — each one is a specific, file:line-verified discrepancy discovered by reading the actual component code, not inferred

**Research date:** 2026-08-12
**Valid until:** No expiry driver — this is a pure internal-codebase research phase (no external library/version drift risk). Re-verify only if Phases 19-22's components are touched again before Phase 23 executes.
