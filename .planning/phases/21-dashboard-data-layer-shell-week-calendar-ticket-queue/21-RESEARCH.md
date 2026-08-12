## Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue - Research

**Researched:** 2026-08-11
**Domain:** In-repo Svelte 5 + InstantDB dashboard construction (no external library research required — every question resolves against files already in this repo)
**Confidence:** HIGH — every claim below is `[VERIFIED: <path>:<lines>]` from a direct `Read` this session, except the five items in `## Assumptions Log`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Consolidation with Phase 19's `projetosDerive.ts`**: Phase 19 already shipped
  `web/src/lib/sections/projetosDerive.ts` with `tarefaConcluida`/`progressoEtapa`/`vencido`
  (per REQUIREMENTS.md §5.3/§5.4), explicitly flagged in its own CONTEXT.md as provisional —
  "Phase 21 is the module's canonical owner and will consolidate/dedupe if this phase creates it
  first." This phase MUST move/reconcile that logic into the canonical
  `web/src/lib/dashboard/derive.ts` (same exported names per ROADMAP: `progressoEtapa`,
  `vencido`; `tarefaConcluida` may be kept as an internal helper or renamed to match derive.ts's
  final API) and update `ProjetosSection.svelte`'s import to point at the new canonical module —
  no duplicate logic, no drift between the two.
- **`derive.ts`**: pure (no `db` import, `hoje` passed as parameter, no `Date.now()`/`new Date()`
  called internally without a parameter) — exports `semanaUtil`, `agendaPorDia`,
  `rotinasPorFundo`, `cargaDoMes`, `faixaHeatmap`, `progressoEtapa`, `vencido`. `derive.test.ts`
  alongside, following the existing `bizdays.test.ts` pattern already in this codebase.
  `rotinasPorFundo`/`cargaDoMes`/`faixaHeatmap` exist as pure functions in this phase even though
  their *rendering* (fundo-grouped cards, heatmap grid) is Phase 22's job — this phase just needs
  them correct and unit-tested so Phase 22 consumes them directly.
- **`dashboardQuery.ts`**: exactly one `db.useQuery` per spec §5.1, shape
  `{ projetos: { fundo: {}, etapas: { tarefas: {} } }, tarefas: { etapa: { projeto: {} },
  subtarefas: {} }, instanciasRotina: { template: { fundo: {} } }, tickets: { fundo: {},
  subtarefas: {} }, fundos: {} }`. **Never add `template`/`fundo` links to
  `defs/instanciasRotina.ts`** — that link exists in the raw InstantDB schema (same as
  `routineJob.ts` uses) but is deliberately absent from the presentation-layer `EntityConfig` to
  prevent `EntityScreen` from rendering a re-parenting select that would break `dedupeKey`. The
  Dashboard query bypasses `EntityConfig` entirely and queries `db` directly.
- **`Dashboard.svelte`**: not an `EntityScreen`, not in `registry.ts`. Mounts at
  `rota.section === "dashboard"` (already the default route since Phase 18, replacing that
  phase's placeholder). Grid: `grid-cols-[13rem_minmax(0,1fr)_16rem] gap-4` at `lg:`, single
  column below `lg` in order: semana → tickets → rotinas → projetos (spec §3.1's exact stacking
  order — note tickets is visually left at `lg:` but stacks *after* the week band on narrow
  screens, per spec text literally: "abaixo de lg, uma coluna na ordem: semana → tickets →
  rotinas → projetos").
- **This phase's slice of the grid**: left column (tickets, DASH-02) + center-top (week band,
  DASH-03) fully built and real. Center-bottom (mini-kanbans, DASH-05) and right column (rotinas
  by fundo + heatmap, DASH-04) are Phase 22's job — this phase may leave those grid cells empty
  or with a lightweight "carregando..." / structural placeholder, NOT fake data.
- **Week band (§3.3)**: 5 cards Mon-Fri only. Sat/Sun items surface only via a chip
  (`sáb/dom (N)`) rendered *only when N > 0*, opening a `Popover` with those two days' items. Card
  shows up to 3 items + `+N`, left border 3px by type (tarefa `border-foreground`, rotina
  `border-muted-foreground`, ticket-hard `border-destructive`), today's card header `bg-muted`.
  Header navigation to a day-dialog (spec §4 dialog nº 2) is explicitly **out of scope** for this
  phase — Phase 23 builds the dialog system; the day/item headers can be plain non-interactive
  elements or inert buttons for now (do not fake a dialog).
- **Ticket queue (§3.2)**: per REQUIREMENTS.md's §5.3 decision, do NOT filter by completion (no
  non-string signal exists on `tickets`) — list all tickets, `tipoPrazo === "hard"` first, then
  by date. Card = title (2-line clamp) + `fundo · PRAZO · data`, whole card is a `<button>`.
  Clicking it is explicitly **out of scope this phase** (Phase 23's dialog nº 1) — an inert/no-op
  button or a button that does nothing yet is acceptable; do not fake a dialog. "ver todos" link
  navigates to the real Tickets section (`rota = { section: "entity", etype: "tickets" }`).
  Empty state: `Empty.Root` "Nenhum ticket pendente".

### Claude's Discretion

Exact component boundaries (`Dashboard.svelte` monolith vs. splitting `WeekCalendar.svelte`/
`TicketQueue.svelte` now vs. later — spec §8 anticipates separate files
`TicketQueue,WeekCalendar,ProjectStrips,RoutinesByFundo,MonthHeatmap`, but this phase only needs
the first two functionally complete), whether placeholder grid cells for Phase 22's content are
literally empty `<div>`s or a labeled skeleton — guided by spec §0 (one spacing scale, no
over-engineering) and existing codebase conventions.

### Deferred Ideas (OUT OF SCOPE)

- Mini-kanbans by project (DASH-05) — Phase 22
- Rotinas-by-fundo column + monthly heatmap rendering (DASH-04) — Phase 22
- All 7 focus dialogs, including day/ticket/routine click targets on this phase's own UI — Phase 23
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-06 | Pure `derive.ts` module (no `db`, `hoje` by param) exporting `semanaUtil`, `agendaPorDia`, `rotinasPorFundo`, `cargaDoMes`, `faixaHeatmap`, `progressoEtapa`, `vencido`, unit-tested. | §"Answering the 5 questions" Q1/Q2 below; exact `bizdays.ts` export list `[VERIFIED: web/src/lib/bizdays.ts:19-137]`; exact `projetosDerive.ts` source to migrate `[VERIFIED: web/src/lib/sections/projetosDerive.ts:1-62]`. |
| DASH-07 | `dashboardQuery.ts` issues exactly one `db.useQuery` covering `projetos`, `tarefas`, `instanciasRotina.template.fundo`, `tickets`, `fundos`, no store/cache. | §"Answering the 5 questions" Q3; nested-query precedent `[VERIFIED: web/src/lib/sections/ProjetosSection.svelte:68-73]`; schema link chain `[VERIFIED: shared/instant.schema.ts:140-149,116-119]`; `routineJob.ts`'s actual (single-hop) query shape `[VERIFIED: web/src/lib/routineJob.ts:584-611]`. |
| DASH-01 | `Dashboard.svelte` mounts at the dashboard route (not in `registry.ts`), 3-col grid at `lg:`, 1-col below. | §"Answering the 5 questions" Q4; mount point already wired `[VERIFIED: web/src/lib/Shell.svelte:6,115-116]`. |
| DASH-02 | Ticket queue: hard-first then date, empty state, "ver todos" link. | `tickets` def fields/links `[VERIFIED: web/src/lib/entities/defs/tickets.ts:12-37]`; `Empty` component installed `[VERIFIED: web/src/lib/components/ui/ (ls) — empty/ present]`. |
| DASH-03 | 5 weekday cards, 3px left border by type, `bg-muted` today, weekend chip+Popover. | §"Answering the 5 questions" Q2/Q5; Popover already installed and used `[VERIFIED: web/src/lib/entities/EntityScreen.svelte:20,640-684]`; grayscale tokens `[VERIFIED: web/src/app.css:8-29]`. |

</phase_requirements>

## Summary

Every question this phase raises resolves against code already in the repo — there is no
external library to evaluate and no new npm/shadcn package to install. The two structurally
important findings are: (1) `web/src/lib/bizdays.ts` exports **only** business-day-skipping
helpers (`isBusinessDay`, `addBusinessDays`, `nextBusinessDay`) plus the vendored calendar
bounds — it has **no** "start of week"/"day of week" helper, so `semanaUtil` cannot be built by
calling into it; it must implement its own plain calendar-week math (Monday anchor via
`getUTCDay()`), matching the *style* of `bizdays.ts` (pure, UTC-only, ISO-string I/O) without
reusing any of its exports. (2) The `instanciasRotina.template.fundo` two-hop nested-query shape
CONTEXT.md attributes to `routineJob.ts` is only half right: `routineJob.ts` itself queries
`instanciasRotina: { template: {} }` — **one hop, never `.fundo`** — so it does not literally
prove the two-hop shape works. The actual proof of a multi-level nested `db.useQuery` object
(three levels deep, `projetos: { fundo: {}, etapas: { tarefas: { subtarefas: {} } } }`) already
shipping and passing e2e in this codebase is `ProjetosSection.svelte:68-73` (Phase 19). Combined
with the schema-level link chain `instanciasRotina --template--> templatesRotina --fundo-->
fundos` `[VERIFIED: shared/instant.schema.ts:140-149,116-119]`, this is sufficient proof the
`dashboardQuery.ts` shape from spec §5.1 will resolve — but the planner should cite
`ProjetosSection.svelte`, not `routineJob.ts`, as the syntax precedent.

Shell.svelte already mounts `<Dashboard />` unconditionally on `rota.section === "dashboard"`
(Phase 18) — this phase touches **zero** lines of `Shell.svelte`; all work is inside
`web/src/lib/dashboard/*`. Popover, Accordion, Tabs, ScrollArea, Empty, Badge, Button, Card are
all already-installed shadcn-svelte components with live usage precedent elsewhere in the
codebase — no new component needs to be added via the shadcn CLI for this phase's slice (Popover
is the one this phase specifically needs, and it is already in `package.json`/`components/ui/`).

**Primary recommendation:** Build `derive.ts` and `derive.test.ts` first (spec §9's own suggested
sequence — "5. derive.ts + testes... (antes da UI do Dashboard)"), migrating Phase 19's three
functions verbatim (same signatures) plus the four new ones, then `dashboardQuery.ts`, then wire
`Dashboard.svelte`'s real grid/`TicketQueue`/`WeekCalendar` content — with `ProjetosSection.svelte`
repointed to the new module in the same wave that deletes `projetosDerive.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Business-day / week calendar math (`semanaUtil`) | Browser / Client (pure fn module) | — | No server-side compute layer exists in this SPA; all derivation is client-side pure functions, same as `bizdays.ts`/`routineJob.ts`'s compute core |
| Dashboard aggregate data fetch (`dashboardQuery.ts`) | Browser / Client | Database / Storage (InstantDB, permission-scoped) | `db.useQuery` runs client-side against InstantDB's realtime sync engine; row-level `donoId` scoping is enforced server-side by `instant.perms.ts`'s `view` rule, not by the client query `[VERIFIED: shared/instant.perms.ts:15]` |
| Ticket/week-item rendering (`Dashboard.svelte`, `TicketQueue`, `WeekCalendar`) | Browser / Client | — | Pure Svelte 5 SPA, no SSR tier exists in this project (`web/README.md:3` — "pure Svelte 5 SPA (no SvelteKit)") |
| Route/mount decision (which top-level screen renders) | Browser / Client (`Shell.svelte`) | — | Already resolved by Phase 18; Phase 21 does not modify this tier `[VERIFIED: web/src/lib/Shell.svelte:115-116]` |
| Data persistence / access control | Database / Storage (InstantDB) | — | `donoId`-scoped `view`/`create`/`update`/`delete` rules `[VERIFIED: shared/instant.perms.ts:15-18]` |

## Standard Stack

No new library is introduced by this phase. Everything below is already a direct or transitive
dependency of `web/package.json`, already used elsewhere in this codebase.

### Core (already in use, reused as-is)
| Library | Version | Purpose | Why Standard (for this repo) |
|---------|---------|---------|--------------|
| `@instantdb/svelte` | `^1.0.63` `[VERIFIED: web/package.json:22]` | `db.useQuery` for `dashboardQuery.ts` | Sole data layer in this app; every other section queries this way |
| `bits-ui` | `^2.16.3` `[VERIFIED: web/package.json:37]` | Underlying primitive for `popover`, `accordion`, `tabs`, `scroll-area` components already installed under `web/src/lib/components/ui/` | shadcn-svelte's registry wraps this; already the app's only UI-primitive dependency |
| `shadcn-svelte` CLI | `^1.5.0` `[VERIFIED: web/package.json:41]` | Was used to add every `components/ui/*` folder present today | Used to add `popover`/`accordion`/`tabs`/`scroll-area` in Phases 19-20; no re-run needed this phase (all already present) |

### Supporting (in-repo modules this phase touches)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `web/src/lib/bizdays.ts` | Vendored ANBIMA business-day calendar (`isBusinessDay`, `addBusinessDays`, `nextBusinessDay`) | NOT used by `semanaUtil` (see Q2 below) — available if a later phase needs holiday-awareness inside the week band; not required by DASH-03/DASH-06 as currently scoped |
| `web/src/lib/routineJob.ts` | Reference style for a pure-compute-core + I/O-boundary-comment module split | Style precedent for `derive.ts`'s module-doc-comment convention, not a functional dependency |
| `web/src/lib/sections/projetosDerive.ts` | Source of `tarefaConcluida`/`progressoEtapa`/`vencido` to migrate, then delete | One-time migration source this phase, then removed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain UTC-day-of-week math for `semanaUtil` | Reusing `addBusinessDays`/`nextBusinessDay` to step through the week | Rejected: those functions **skip** weekends/holidays by construction (`bizdays.ts:102-129`), so stepping 5 times from Monday would NOT reliably land on Friday if a holiday falls inside the week — wrong semantics for "5 calendar weekdays regardless of holiday status" (spec §3.3 never mentions excluding holiday weekdays from the 5 cards) |
| Splitting `WeekCalendar.svelte`/`TicketQueue.svelte` now | One `Dashboard.svelte` monolith | Explicitly Claude's Discretion per CONTEXT.md — spec §8 names the eventual split but this phase "only needs the first two functionally complete"; either is acceptable, but splitting now reduces Phase 22's diff size since spec §8 already names `ProjectStrips`/`RoutinesByFundo`/`MonthHeatmap` as separate files |

**Installation:** None required — zero new npm/shadcn packages for this phase's slice.

## Package Legitimacy Audit

**No external packages are introduced by this phase.** Every dependency and shadcn-svelte
component this phase's code touches (`@instantdb/svelte`, `bits-ui`, `popover`, `card`, `badge`,
`button`, `empty`, `accordion`, `tabs`, `scroll-area`) is already present in `web/package.json`
and `web/src/lib/components/ui/` `[VERIFIED: web/package.json:21-41, and directory listing of
web/src/lib/components/ui/ showing accordion, alert, alert-dialog, badge, button, calendar, card,
checkbox, dialog, empty, input, label, popover, scroll-area, select, separator, skeleton, sonner,
table, tabs, textarea]`. No `npm view`/`gsd_run query package-legitimacy check` run was needed —
there is nothing new to check.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Answering the 5 planning questions

### Q1 — Consolidating `projetosDerive.ts` into `dashboard/derive.ts`

**Exact mechanical steps** (zero behavior change required — only file location and import path
move):

1. **Read the exact source to migrate** `[VERIFIED: web/src/lib/sections/projetosDerive.ts:1-62]`:
   ```ts
   export interface SubtarefaLike { concluida: boolean; }
   export interface TarefaLike { dataPrevista?: string | null; subtarefas?: SubtarefaLike[]; }
   export interface EtapaLike { tarefas?: TarefaLike[]; }

   export function tarefaConcluida(tarefa: TarefaLike): boolean {
     const subtarefas = tarefa.subtarefas ?? [];
     return subtarefas.length > 0 && subtarefas.every((s) => s.concluida === true);
   }

   export function progressoEtapa(etapa: EtapaLike): { feitas: number; total: number } {
     const tarefas = etapa.tarefas ?? [];
     const feitas = tarefas.filter((t) => tarefaConcluida(t)).length;
     return { feitas, total: tarefas.length };
   }

   export function vencido(
     dataPrevista: string | null | undefined,
     concluido: boolean,
     hoje: Date,
   ): boolean {
     if (!dataPrevista) return false;
     return new Date(dataPrevista) < hoje && !concluido;
   }
   ```
2. Create `web/src/lib/dashboard/derive.ts` and paste these three functions/types **verbatim** —
   same signatures, same names (including keeping `tarefaConcluida` **exported**, not just
   internal — see step 3's reason why it cannot become purely internal).
3. **Do not drop the `tarefaConcluida` export.** `ProjetosSection.svelte` calls it directly (not
   only through `progressoEtapa`) at two call sites: as a `Checkbox`'s `checked` prop
   `[VERIFIED: web/src/lib/sections/ProjetosSection.svelte:521]` and as `vencido`'s second
   argument at two sites `[VERIFIED: web/src/lib/sections/ProjetosSection.svelte:529,620]`. CONTEXT.md's "may be kept as an internal helper or renamed" is Claude's-discretion language for the *new* consumers derive.ts will pick up in this phase (`agendaPorDia`, etc.) — it does not override the existing, still-live call sites in `ProjetosSection.svelte`, which require the export to keep existing. Recommendation: keep the name `tarefaConcluida` unchanged to make the `ProjetosSection.svelte` diff a one-line import-path change only.
4. **Preserve `vencido`'s exact signature** `(dataPrevista: string | null | undefined, concluido: boolean, hoje: Date): boolean`. Both existing call sites pass `new Date()` as the third argument themselves `[VERIFIED: web/src/lib/sections/ProjetosSection.svelte:530,621]` — the purity constraint ("no `Date.now()`/`new Date()` called internally without a parameter") is already satisfied by this signature; the caller, not the function, constructs the `Date`. Do not change this to an ISO-string comparison for `vencido` unless every call site is migrated in the same commit (both existing call sites plus every new Dashboard call site).
5. Add the four new exports required by DASH-06 that don't yet exist anywhere: `semanaUtil`, `agendaPorDia`, `rotinasPorFundo`, `cargaDoMes`, `faixaHeatmap` (five, not four — `progressoEtapa`/`vencido`/`tarefaConcluida` are the three migrated ones).
6. Create `web/src/lib/dashboard/derive.test.ts`. Merge `projetosDerive.test.ts`'s existing five `describe` blocks (`tarefaConcluida`, `progressoEtapa`, `vencido`) verbatim `[VERIFIED: web/src/lib/sections/projetosDerive.test.ts:1-73]` plus new test blocks for the five new functions. This mirrors the `bizdays.test.ts` fixture-driven pattern the CONTEXT.md explicitly asks to follow (though `derive.test.ts` doesn't need a JSON fixture file — direct `expect()` assertions are the existing `projetosDerive.test.ts` style and are sufficient).
7. **Repoint the one import site.** Change `ProjetosSection.svelte`'s import line 18
   `[VERIFIED: web/src/lib/sections/ProjetosSection.svelte:18]`:
   ```ts
   // before
   import { progressoEtapa, tarefaConcluida, vencido } from "./projetosDerive";
   // after
   import { progressoEtapa, tarefaConcluida, vencido } from "../dashboard/derive";
   ```
   (relative path: `web/src/lib/sections/` → `web/src/lib/dashboard/derive.ts` is `../dashboard/derive`).
8. **Confirm no other file references the old module** before deleting it — grep-verified this
   session: only `ProjetosSection.svelte` and `projetosDerive.test.ts` itself reference
   `projetosDerive` anywhere under `web/src` or `web/e2e`
   `[VERIFIED: ripgrep of web/src and web/e2e for "projetosDerive" returned exactly those two paths]`. No e2e spec imports the module directly — Playwright specs only assert on rendered DOM/testids, so they are insulated from this move.
9. Delete `web/src/lib/sections/projetosDerive.ts` and `web/src/lib/sections/projetosDerive.test.ts`.
10. Verify: `bun run test` (== `bun test src`, which recursively discovers `*.test.ts` under `src`, so `dashboard/derive.test.ts` runs automatically without any config change `[VERIFIED: web/package.json:10]`), then `bun run check` (svelte-check + tsc, catches the import-path break if step 7 is wrong), then the existing Playwright specs `web/e2e/projetos-section.spec.ts` and `web/e2e/entities-projeto-etapa-tarefa.spec.ts` (both exist `[VERIFIED: directory listing of web/e2e]`) to prove zero UI regression.

### Q2 — `semanaUtil` and `bizdays.ts`

`bizdays.ts` exports exactly this surface, confirmed by a full read of the file
`[VERIFIED: web/src/lib/bizdays.ts:19-137]`:

```ts
export const CALENDAR_START: string;          // e.g. vendored calendar's first date
export const CALENDAR_END: string;
export class InvalidDateError extends Error {}
export class CalendarRangeError extends Error {}
export function isBusinessDay(date: string): boolean;
export function addBusinessDays(date: string, n: number): string;
export function nextBusinessDay(date: string): string;   // = addBusinessDays(date, 1)
```

There is **no** "day of week", "start of week", or "next N business days from date returning
an array" helper. `addBusinessDays`/`nextBusinessDay` both **skip weekends and ANBIMA holidays**
by walking one calendar day at a time and only decrementing the counter on a business day
`[VERIFIED: web/src/lib/bizdays.ts:110-126]` — this is the wrong primitive for "the 5 calendar
weekdays of this week" (spec §3.3), because a holiday inside the target week would cause a
5-step walk from Monday to overshoot into the following week's Monday instead of landing on
Friday.

**Recommendation:** `semanaUtil(hoje: string /* ISO YYYY-MM-DD */)` should NOT call into
`bizdays.ts` at all for its core Monday-anchor math. It must compute its own weekday index via
`new Date(...).getUTCDay()` (Sunday=0…Saturday=6, same UTC-only discipline `bizdays.ts` and
`routineJob.ts` both use, e.g. `routineJob.ts`'s own `todayUtcIsoDate()`
`[VERIFIED: web/src/lib/routineJob.ts:556-564]`), derive the Monday offset (`(dow + 6) % 7` days
back from `hoje`, mapping Sunday=0 to "6 days back"), then step forward with **plain calendar-day
arithmetic** (`cursor.setUTCDate(cursor.getUTCDate() + 1)`, not `addBusinessDays`) to produce
Monday through Sunday, returning `{ dias: [5 ISO dates Mon-Fri], sabado: ISO date, domingo: ISO
date }` per spec §5.2's signature `semanaUtil(hoje | base) → { dias: [5 datas], sabado, domingo }`.
This keeps `derive.ts` in the "same spirit" as `bizdays.ts` (pure, UTC, ISO-string in/out, no
implicit `Date.now()`) that spec §5.2 asks for, without literally importing from it — because none
of its exports fit the calendar-week (not business-week) semantics DASH-03 needs.

`isBusinessDay`/`bizdays.ts` remain available, unused by this phase, for a future phase that
wants to visually distinguish an ANBIMA holiday weekday from a normal one — not required by
DASH-03's acceptance criteria (only left-border-by-type and `bg-muted`-for-today are specified;
no holiday indicator is mentioned anywhere in spec §3.3 or DASH-03).

### Q3 — `dashboardQuery.ts`'s single `db.useQuery` and the `template.fundo` traversal

**The exact query shape** locked by CONTEXT.md/spec §5.1:
```ts
db.useQuery(() => ({
  projetos: { fundo: {}, etapas: { tarefas: {} } },
  tarefas: { etapa: { projeto: {} }, subtarefas: {} },
  instanciasRotina: { template: { fundo: {} } },
  tickets: { fundo: {}, subtarefas: {} },
  fundos: {},
}) as never);
```

**Correction to CONTEXT.md's citation:** CONTEXT.md and spec-ui.md §5.1 both assert this
`instanciasRotina → template → fundo` path "é o mesmo que `routineJob.ts` usa em `queryOnce`."
This is only true of the **schema link chain**, not of `routineJob.ts`'s actual query object.
`routineJob.ts`'s own `queryOnce` calls are, verbatim:
```ts
// templatesRotina query — one hop (antecessor), never touches fundo
const templatesResult = await db.queryOnce({
  templatesRotina: { antecessor: {}, $: { where: { ativo: true, donoId } } },
} as never);
// instanciasRotina query — one hop (template), never nests to .fundo
const existingResult = await db.queryOnce({
  instanciasRotina: {
    template: {},
    $: { where: { "template.id": { $in: instanceLookupIds } } },
  },
} as never);
```
`[VERIFIED: web/src/lib/routineJob.ts:584-611]`. Neither query in this file ever nests two levels
to `template.fundo` — `routineJob.ts` doesn't need `fundo` data at all for its own compute, so it
never queries it. **Do not cite `routineJob.ts` as proof the two-hop nested-object syntax
resolves** — cite the schema link chain instead, plus the actual in-repo precedent for a
multi-level nested `db.useQuery` object:

- **Schema proof the link chain exists:** `instanciasRotina --template--> templatesRotina`
  (`templateInstancias` link, forward `on: "instanciasRotina", label: "template"`)
  `[VERIFIED: shared/instant.schema.ts:140-143]`, and `templatesRotina --fundo--> fundos`
  (`fundoTemplatesRotina` link, forward `on: "templatesRotina", label: "fundo"`)
  `[VERIFIED: shared/instant.schema.ts:116-119]`. Chaining both links means
  `instanciasRotina: { template: { fundo: {} } }` is a syntactically valid two-hop InstaQL nested
  object over this schema.
- **Syntax precedent that a multi-level nested `db.useQuery` object actually resolves and
  renders in this app**, already shipped and e2e-proven: `ProjetosSection.svelte`'s own bespoke
  query, THREE levels deep (`projetos.etapas.tarefas.subtarefas`), not just two:
  ```ts
  const query = db.useQuery(
    () => ({ projetos: { fundo: {}, etapas: { tarefas: { subtarefas: {} } } } }) as never,
  );
  ```
  `[VERIFIED: web/src/lib/sections/ProjetosSection.svelte:68-73]`. This is deeper than the
  `instanciasRotina.template.fundo` two-hop dashboardQuery.ts needs, and it is exercised live by
  `web/e2e/projetos-section.spec.ts` (Phase 19's own regression suite), so it is the stronger,
  directly-relevant in-repo proof.
- **Cast-at-the-boundary convention** to follow for `dashboardQuery.ts` (same pattern used by
  both `EntityScreen.svelte:82` and `ProjetosSection.svelte:68-73`): the `as never` cast is
  applied to the query builder's return value because the query shape mixes five top-level
  entity keys that don't collectively exist as one literal type in InstantDB's generated schema
  union — this is the established idiom in this codebase for a bespoke multi-entity query, not a
  type-safety shortcut invented for this phase.
- **Never add `template`/`fundo` to `defs/instanciasRotina.ts`.** Confirmed still true and
  explained in that file's own header comment: declaring `template` as a `LinkDef` would make
  `EntityScreen.svelte` render it as an always-editable `<select>` (every declared link is
  rendered editable — no read-only-link mode exists), which would let a user re-parent an
  instance and desync it from the `dedupeKey` computed against its original template
  `[VERIFIED: web/src/lib/entities/defs/instanciasRotina.ts:22-36]`.
- **No `donoId` filter needed in `dashboardQuery.ts`'s `$: { where: ... }`.** Every existing
  `db.useQuery`/`db.queryOnce` call in this codebase (`EntityScreen.svelte:82`,
  `ProjetosSection.svelte:68-73`, `routineJob.ts:584,606`) omits an explicit `donoId` clause,
  because InstantDB's own permission engine enforces per-row `donoId` scoping server-side:
  `view: "auth.id != null && auth.id == data.donoId"` `[VERIFIED: shared/instant.perms.ts:15]`.
  `dashboardQuery.ts` should follow the same convention — no `where: { donoId }` needed on any
  of the five top-level query keys.

### Q4 — Mounting real Dashboard content in `Shell.svelte`

**No `Shell.svelte` change is required at all.** Phase 18 already wired the mount point and it
is unconditional — confirmed by a full read of the current file:
```svelte
<!-- Shell.svelte:6 -->
import Dashboard from "./dashboard/Dashboard.svelte";
<!-- Shell.svelte:115-116 -->
{#if rota.section === "dashboard"}
  <Dashboard />
```
`[VERIFIED: web/src/lib/Shell.svelte:6,115-116]`. `rota` defaults to `{ section: "dashboard" }`
`[VERIFIED: web/src/lib/Shell.svelte:20]`, and the `nav-dashboard` button in the same file sets it
back to that value on click `[VERIFIED: web/src/lib/Shell.svelte:96-101]`. This phase's entire
job is inside `web/src/lib/dashboard/Dashboard.svelte` (currently a two-line placeholder
`[VERIFIED: web/src/lib/dashboard/Dashboard.svelte:1-3]`) and its new sibling files under
`web/src/lib/dashboard/` — no route contract changes, no new Shell state, no new `Route` union
member (the `Route` type already has exactly the two variants spec §1.3 wants, unchanged since
Phase 18) `[VERIFIED: web/src/lib/Shell.svelte:17-19]`.

### Q5 — Popover / 3px-border / `bg-muted` pattern for the week band

**Popover is already installed and has live usage precedent** — confirmed the exact export
surface and an in-repo consumer:
```
web/src/lib/components/ui/popover/index.ts exports:
  Root (aka Popover), Trigger, Content, Close, Description, Header, Portal, Title
```
`[VERIFIED: web/src/lib/components/ui/popover/index.ts:1-27]`, already used for a live
date-picker popover in `EntityScreen.svelte`:
```svelte
<Popover.Root open={datePopoverOpen[f.name] ?? false} onOpenChange={(open) => { ... }}>
  <Popover.Trigger> ... </Popover.Trigger>
  <Popover.Content class="w-auto p-0"> ... </Popover.Content>
</Popover.Root>
```
`[VERIFIED: web/src/lib/entities/EntityScreen.svelte:20,640-684]`. For the weekend chip
(spec §3.3), the same three-part shape applies directly:
```svelte
<Popover.Root>
  <Popover.Trigger>
    {#if weekendCount > 0}
      <button type="button" data-testid="dash-weekend-chip">sáb/dom ({weekendCount})</button>
    {/if}
  </Popover.Trigger>
  <Popover.Content class="w-64">
    <!-- list of the two weekend days' items -->
  </Popover.Content>
</Popover.Root>
```
The chip itself is only rendered when `N > 0` (spec §3.3), so the whole `Popover.Root` block
should be gated behind that condition rather than rendering a disabled trigger.

**3px left border and `bg-muted` — no new token needed.** All three border colors and the
`bg-muted` background are existing CSS custom properties already mapped into Tailwind's theme:
`--foreground`, `--muted-foreground`, `--destructive`, `--muted` are all defined in both light and
dark blocks of `app.css` `[VERIFIED: web/src/app.css:8-29,44-65]`. Tailwind's default `border-l-*`
width scale (`border-l`, `border-l-2`, `border-l-4`, `border-l-8`) has no exact-3px step, so the
literal "3px" from spec §3.3/§4 requires Tailwind's arbitrary-value syntax: `border-l-[3px]`.
Combined with the color utility, the three item-type classes are:
```
tarefa:        border-l-[3px] border-foreground
rotina:        border-l-[3px] border-muted-foreground
ticket (hard): border-l-[3px] border-destructive
```
and today's day-card header is `bg-muted` (no arbitrary value needed — `bg-muted` already exists
as a Tailwind utility because `--muted` is mapped into the theme `[VERIFIED: web/src/app.css:17,
53]`). None of this introduces a hex value or a new CSS variable, satisfying spec §0.1/§0.2's
"no new color, no arbitrary hex" constraint — `border-l-[3px]` is an arbitrary **width**, not an
arbitrary color, so it does not violate that rule.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── Shell.svelte (unchanged this phase) ───────────────────────────┐
│  rota = $state({ section: "dashboard" })  (default, already wired since Phase 18)          │
│                                                                                              │
│         {#if rota.section === "dashboard"}  →  <Dashboard />                                │
└───────────────────────────────────────┬──────────────────────────────────────────────────┘
                                         │
                                         ▼
                       web/src/lib/dashboard/Dashboard.svelte
                                         │
              ┌──────────────────────────┼───────────────────────────┐
              │                          │                           │
              ▼                          ▼                           ▼
   dashboardQuery.ts             derive.ts (pure)           (Phase 22 placeholder cells)
   ONE db.useQuery over:         semanaUtil(hoje)  ────────▶  { dias, sabado, domingo }
   projetos, tarefas,            agendaPorDia(dados, semana) ▶ Map<isoDate, Item[]>
   instanciasRotina.template     progressoEtapa / vencido / tarefaConcluida (migrated)
     .fundo, tickets, fundos     rotinasPorFundo / cargaDoMes / faixaHeatmap (unused-by-UI
   (bypasses EntityConfig            this phase, unit-tested only)
   entirely, InstantDB
   permission-scoped by donoId)
              │                          │
              └──────────┬───────────────┘
                         ▼
              raw query result + derived
              Map<isoDate, Item[]> feed:
                 - TicketQueue (left column, DASH-02)
                 - WeekCalendar (center-top, DASH-03) — 5 weekday cards +
                   weekend Popover chip
```

### Recommended Project Structure
```
web/src/lib/dashboard/
├── Dashboard.svelte      # grid shell; mounts TicketQueue + WeekCalendar (real this phase);
│                         #   empty/placeholder cells for kanbans + rotinas/heatmap (Phase 22)
├── dashboardQuery.ts     # the one db.useQuery, no store, no cache
├── derive.ts             # pure: semanaUtil, agendaPorDia, rotinasPorFundo, cargaDoMes,
│                         #   faixaHeatmap, progressoEtapa, vencido, tarefaConcluida
├── derive.test.ts        # unit tests for every derive.ts export (bun test)
├── TicketQueue.svelte    # OR inlined in Dashboard.svelte — Claude's discretion
└── WeekCalendar.svelte   # OR inlined in Dashboard.svelte — Claude's discretion
```

### Pattern 1: Pure derive module with caller-supplied `hoje`
**What:** Every date-dependent function takes `hoje`/`base` as its first or last parameter; the
module itself never calls `new Date()`/`Date.now()`.
**When to use:** Every export of `derive.ts`, following `projetosDerive.ts`'s own precedent
(`vencido(dataPrevista, concluido, hoje: Date)`) and `bizdays.ts`'s (`isBusinessDay(date: string)`,
no hidden clock read anywhere in the module).
**Example:**
```ts
// Source: web/src/lib/sections/projetosDerive.ts:55-62 (pattern to replicate for new fns)
export function vencido(
  dataPrevista: string | null | undefined,
  concluido: boolean,
  hoje: Date,
): boolean {
  if (!dataPrevista) return false;
  return new Date(dataPrevista) < hoje && !concluido;
}
```

### Pattern 2: Bespoke multi-level `db.useQuery` bypassing `EntityConfig`
**What:** A one-off, hand-typed `db.useQuery` call whose shape does not go through
`buildQuery(config)` — used whenever a screen needs a nesting depth or a query shape
`EntityConfig`'s generic engine cannot express.
**When to use:** `dashboardQuery.ts` (this phase) and `ProjetosSection.svelte` (Phase 19,
existing precedent).
**Example:**
```ts
// Source: web/src/lib/sections/ProjetosSection.svelte:68-73 (existing, shipped, e2e-proven)
const query = db.useQuery(
  () => ({ projetos: { fundo: {}, etapas: { tarefas: { subtarefas: {} } } } }) as never,
);
```

### Anti-Patterns to Avoid
- **Calling `addBusinessDays`/`nextBusinessDay` to build `semanaUtil`'s Monday-Friday range:**
  these skip holidays/weekends by design (`bizdays.ts:110-129`) — wrong tool for "the calendar
  week's 5 weekdays regardless of holiday status."
- **Adding `template`/`fundo` as a `LinkDef` to `defs/instanciasRotina.ts`:** would reopen the
  re-parenting hole that field's absence was designed to close — the Dashboard must read this
  data through its own bespoke query, never through the `EntityConfig`/`EntityScreen` path.
- **Citing `routineJob.ts` as literal proof the `template.fundo` two-hop query resolves:** it
  doesn't query `.fundo` at all; cite `ProjetosSection.svelte`'s three-level nested query instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover for the weekend chip | A custom absolutely-positioned `<div>` toggle | `$lib/components/ui/popover` (`Popover.Root`/`Trigger`/`Content`) | Already installed, already has a live usage precedent (`EntityScreen.svelte`'s date picker) with correct focus/dismiss/keyboard behavior via `bits-ui` |
| Empty state for zero pending tickets | A hand-written "no tickets" `<p>` | `$lib/components/ui/empty` (`Empty.Root`) | Already installed (`web/src/lib/components/ui/empty/` present); spec §3.2 explicitly names `Empty.Root` |
| ISO date parsing/UTC-safe day math | A hand-rolled `Date` string splitter | Follow `bizdays.ts`'s/`routineJob.ts`'s existing `formatIso`/UTC-getter idiom (not exported, but the pattern is copy-worthy) | Both existing modules solved the local-timezone-shift bug already (`routineJob.ts:556-564`'s comment explains exactly why `getUTCFullYear`/`getUTCMonth`/`getUTCDate` are mandatory over their non-UTC counterparts) |

**Key insight:** This phase has zero cases where reaching for an external package would be
appropriate — every "don't hand-roll" case above is solved by a component or pattern already
committed to this repo.

## Runtime State Inventory

*(Included because moving `projetosDerive.ts` → `dashboard/derive.ts` is a file
relocation/refactor, even though the majority of the phase is greenfield.)*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `projetosDerive.ts`'s functions are pure, stateless, no persisted data references its file path or export names by string | None |
| Live service config | None — no external service (InstantDB perms, n8n, etc.) references this module | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts / other imports | Exactly two files reference `projetosDerive` anywhere in `web/src`/`web/e2e`: `ProjetosSection.svelte` (import) and `projetosDerive.test.ts` (self-test) `[VERIFIED: ripgrep search this session over web/src and web/e2e for the literal string "projetosDerive"]` | Repoint the one import (step 7 of Q1 above); delete both files after the move |

**Nothing else found** — verified by direct grep this session; no e2e spec, CLI script, or config
file references `projetosDerive` by name or path.

## Common Pitfalls

### Pitfall 1: Using `bizdays.ts`'s business-day steppers for the week band
**What goes wrong:** `semanaUtil` returns a week where Friday is wrong (shifted) whenever an
ANBIMA holiday falls inside that week.
**Why it happens:** `addBusinessDays`/`nextBusinessDay` skip non-business days by design
`[VERIFIED: web/src/lib/bizdays.ts:102-129]` — a 4-step walk from Monday would land past a
holiday-adjusted Friday.
**How to avoid:** Compute Monday-Friday with plain UTC calendar-day arithmetic; don't call into
`bizdays.ts` for this.
**Warning signs:** A unit test asserting `semanaUtil` over a week containing a known ANBIMA
holiday (check `shared/anbima-calendar.json`'s `holidays` array for a fixture date) would reveal
the bug immediately if the wrong primitive is used.

### Pitfall 2: Re-declaring `template`/`fundo` on `defs/instanciasRotina.ts` "just to make the query easier"
**What goes wrong:** `EntityScreen`'s generic `buildQuery` renders every declared `LinkDef` as an
always-editable `<select>` — this would let a user re-parent an existing instance and desync its
`dedupeKey` from its original template.
**Why it happens:** It looks like the path of least resistance for `dashboardQuery.ts`'s shape,
but `dashboardQuery.ts` never goes through `EntityConfig`/`buildQuery` at all — it's a fully
bespoke `db.useQuery`, so there is no need to touch the def file.
**How to avoid:** Keep `dashboardQuery.ts` entirely separate from `defs/instanciasRotina.ts`; the
schema link exists independent of the presentation-layer `EntityConfig`.
**Warning signs:** Any diff touching `web/src/lib/entities/defs/instanciasRotina.ts` in this
phase's plan should be treated as a red flag and re-reviewed against this constraint.

### Pitfall 3: Dropping `tarefaConcluida`'s export when consolidating into `derive.ts`
**What goes wrong:** `ProjetosSection.svelte` breaks at build time (`svelte-check`/`tsc` failure)
because it imports `tarefaConcluida` directly, not only through `progressoEtapa`.
**Why it happens:** CONTEXT.md's phrasing ("may be kept as an internal helper") reads as
permission to un-export it, but that permission is scoped to derive.ts's *own* new consumers, not
retroactive to the still-live `ProjetosSection.svelte` call sites.
**How to avoid:** Keep `tarefaConcluida` exported from `derive.ts`; verify with `bun run check`
after the migration.
**Warning signs:** A TypeScript error citing `ProjetosSection.svelte:18` or `:521`/`:529`/`:620`.

## Code Examples

### Verified pattern: multi-level nested `db.useQuery` (the precedent for `dashboardQuery.ts`)
```ts
// Source: web/src/lib/sections/ProjetosSection.svelte:68-73 (shipped, Phase 19, e2e-proven)
const query = db.useQuery(
  () =>
    ({
      projetos: { fundo: {}, etapas: { tarefas: { subtarefas: {} } } },
    }) as never,
);
```

### Verified pattern: Popover for a conditionally-rendered trigger
```svelte
<!-- Source: web/src/lib/entities/EntityScreen.svelte:640-684 (shipped, Phase 10) -->
<Popover.Root
  open={datePopoverOpen[f.name] ?? false}
  onOpenChange={(open) => { datePopoverOpen[f.name] = open; }}
>
  <Popover.Trigger>
    <!-- trigger markup -->
  </Popover.Trigger>
  <Popover.Content class="w-auto p-0">
    <!-- content markup -->
  </Popover.Content>
</Popover.Root>
```

### Verified pattern: UTC-only "today" computation (avoid local-timezone shift)
```ts
// Source: web/src/lib/routineJob.ts:556-564 (shipped, Phase 5)
function todayUtcIsoDate(): string {
  const now = new Date();
  return formatIso(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}
```
Note: `formatIso`/`pad` are module-private in `routineJob.ts` (not exported) — `derive.ts` needs
its own equivalent local helpers if it needs this idiom; do not attempt to import them.

## State of the Art

Not applicable — no external library/stack has changed. This phase's entire scope is new
first-party code plus a file relocation, both governed by patterns already committed to this
repo (see Architecture Patterns above).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Popover.Root`'s conditional-render approach (gating the whole `Popover.Root` behind `weekendCount > 0`, rather than always rendering the trigger and disabling it) is the correct application of spec §3.3's "chip... só renderizado quando N > 0" — not independently verified against a bits-ui `Popover.Root`-with-no-trigger edge case. | Q5 / Architecture Patterns | Low — if wrong, the fix is a one-line `{#if}` guard adjustment; no data-model or query impact. |
| A2 | `bun test src` (the `test` script) picks up `*.test.ts` files placed anywhere under `web/src`, including a new `web/src/lib/dashboard/derive.test.ts`, without any config change — inferred from Bun's documented default test-file glob behavior, not from reading Bun's own source or a `bunfig.toml` in this repo (none was found). | Q1 step 10 / Validation Architecture | Low — `bizdays.test.ts` and `projetosDerive.test.ts` both already live under `web/src/lib/**` and are known to run today via this same script, which is strong indirect evidence, but no `bunfig.toml` was found to confirm the glob explicitly. |
| A3 | The `border-l-[3px]` arbitrary-value Tailwind class compiles correctly under this project's Tailwind v4 config (no explicit test run of this exact class was performed this session). | Q5 | Low — Tailwind v4's arbitrary-value syntax is stable/documented; worst case is a build-time CSS warning, not a runtime failure. |
| A4 | `agendaPorDia`'s `Item` shape (`{ tipo, id, titulo, prazo, vencido, fundoId }` per spec §5.2) maps `tipo` to a closed 3-value union (`"tarefa" \| "rotina" \| "ticket"`) — spec text doesn't spell this out as a TypeScript type literal, only as English-language item categories in §3.3/§4. | Q2 / DASH-06 | Medium — if the union needs a 4th value (e.g. distinguishing ticket-hard from ticket-soft at the type level rather than via a `prazo` field check), `agendaPorDia`'s return type needs a follow-up edit; low blast radius since it's a pure-function signature change caught immediately by `derive.test.ts`. |
| A5 | Merging `projetosDerive.test.ts`'s existing `describe` blocks directly into `derive.test.ts` (rather than keeping them in a separate file re-exported from `derive.ts`) is consistent with "no duplicate logic, no drift" from CONTEXT.md — read as directing a single test file, not merely a single source-of-truth module. | Q1 step 6 | Low — either file layout satisfies "no drift"; a single `derive.test.ts` is simply the more conventional choice mirroring `bizdays.test.ts`. |

## Open Questions

1. **Should `Dashboard.svelte` be a monolith or split into `WeekCalendar.svelte`/`TicketQueue.svelte` now?**
   - What we know: CONTEXT.md marks this as Claude's Discretion; spec §8 names the eventual
     split (`TicketQueue`, `WeekCalendar`, `ProjectStrips`, `RoutinesByFundo`, `MonthHeatmap`) as
     files Phase 22/23 will also touch.
   - What's unclear: Whether splitting now reduces or increases the diff Phase 22 will need to
     make to add its own two components into the same grid.
   - Recommendation: Split now into `WeekCalendar.svelte` and `TicketQueue.svelte` (2 small
     files) since spec §8 already commits to that file layout eventually — deferring the split
     only postpones unavoidable work and risks a larger single-file diff when Phase 22 adds its
     two remaining components into the same grid.

2. **Exact `Item.tipo` union and `agendaPorDia`'s Map value ordering (by time-of-day? by type?).**
   - What we know: Spec §3.3 says "até 3 itens, depois `+N itens`" per day card, with items shown
     with a left border by type; §4's dialog table implies items are individually addressable by
     `(tipo, id)`.
   - What's unclear: Spec doesn't specify a sort order for items *within* a day when more than 3
     exist (which 3 show, which are folded into `+N`).
   - Recommendation: Sort deterministically (e.g. hard-deadline items first, then by `prazo`
     ascending, then stable by `id`) mirroring the ticket-queue's own `tipoPrazo === "hard"` first
     rule (§3.2) for consistency; this is a display-only decision with no data-model
     consequence, safe to decide during planning without further research.

## Environment Availability

No new external dependency is introduced by this phase — `bun`, `svelte-check`, `tsc`, `biome`,
and Playwright are already the project's toolchain (`web/package.json` scripts:
`test`/`test:e2e`/`check`/`lint` `[VERIFIED: web/package.json:6-19]`) and none of this phase's
work requires anything beyond them.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun's built-in test runner (`bun:test`), used by every existing `*.test.ts` in this repo `[VERIFIED: web/src/lib/bizdays.test.ts:1, web/src/lib/routineJob.test.ts, web/src/lib/sections/projetosDerive.test.ts:1]`; Playwright for e2e |
| Config file | none for unit tests (Bun's default discovery) `[VERIFIED: web/package.json:10 — "test": "bun test src"]`; `web/playwright.config.ts` for e2e |
| Quick run command | `cd web && bun test src/lib/dashboard/derive.test.ts` |
| Full suite command | `cd web && bun run test` (unit) and `bunx playwright test --project=authed --no-deps` (e2e, reusing persisted auth state per `web/README.md`'s documented invocation) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-06 | `semanaUtil`/`agendaPorDia`/`rotinasPorFundo`/`cargaDoMes`/`faixaHeatmap`/`progressoEtapa`/`vencido` all pure and correct | unit | `bun test src/lib/dashboard/derive.test.ts` | ❌ Wave 0 (new file) |
| DASH-06 (migration) | `progressoEtapa`/`vencido`/`tarefaConcluida` behavior unchanged after move | unit | `bun test src/lib/dashboard/derive.test.ts` (merged from `projetosDerive.test.ts`) | ❌ Wave 0 (content migrates from existing `projetosDerive.test.ts`, which is ✅ already exists pre-migration) |
| DASH-07 | `dashboardQuery.ts` issues exactly one `db.useQuery` | manual/code-review (no live-DB unit test precedent in this repo for query shape assertions — every existing `db.useQuery`/`queryOnce` is proven via e2e, not unit test) | `bunx playwright test --project=authed --no-deps -g dashboard` | ❌ Wave 0 (no `dashboard.spec.ts` exists yet) |
| DASH-01 | 3-col grid at `lg:`, 1-col below `lg`, mounts at dashboard route | e2e (viewport-driven) | new `web/e2e/dashboard.spec.ts` | ❌ Wave 0 |
| DASH-02 | Ticket queue ordering (hard-first, then date), empty state, "ver todos" link | e2e | new `web/e2e/dashboard.spec.ts` | ❌ Wave 0 |
| DASH-03 | 5 weekday cards, weekend chip only when N>0, `bg-muted` today, 3px border by type | e2e | new `web/e2e/dashboard.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd web && bun test src/lib/dashboard/derive.test.ts`
- **Per wave merge:** `cd web && bun run test && bun run check`
- **Phase gate:** `bunx playwright test --project=authed --no-deps` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `web/src/lib/dashboard/derive.test.ts` — covers DASH-06 (new + migrated tests)
- [ ] `web/e2e/dashboard.spec.ts` — covers DASH-01, DASH-02, DASH-03 (new e2e file; no existing
      dashboard e2e spec was found — `[VERIFIED: directory listing of web/e2e contains no
      "dash"-prefixed file]`)
- [ ] No new test-framework install needed — Bun test runner and Playwright are both already
      configured and used by every prior phase in this milestone.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — unchanged | InstantDB magic-code auth, untouched by this phase |
| V3 Session Management | No — unchanged | `@instantdb/svelte`'s `SignedIn` gate, untouched |
| V4 Access Control | Yes | Row-level `donoId` scoping enforced by InstantDB's `view` permission rule, not by client-side query filters — `dashboardQuery.ts` must NOT attempt to add its own `donoId` where-clause as a substitute for this (redundant, and a wrong clause could silently under-fetch); rely on the existing `[VERIFIED: shared/instant.perms.ts:15]` rule exactly as every other query in this codebase does |
| V5 Input Validation | Marginal | No user-supplied input is newly accepted this phase — `hoje`/`semanaBase` navigation state is internal `$state`, not URL/query-string-derived (spec §1.3: "sem router e sem URL nesta milestone") |
| V6 Cryptography | No | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user data leakage via an aggregate query that forgets row-level scoping | Information Disclosure | Rely on InstantDB's server-side `donoId` permission rule (already in place); do not hand-roll a client-side filter that could diverge from it |
| Re-parenting `instanciasRotina` via an accidentally-exposed editable link | Tampering | Never declare `template`/`fundo` as a `LinkDef` on `defs/instanciasRotina.ts` — already enforced by that file's existing design and explicitly called out in this phase's constraints |

## Sources

### Primary (HIGH confidence — direct `Read` of the file this session)
- `web/src/lib/bizdays.ts` — exact exported surface, business-day-skip algorithm
- `web/src/lib/bizdays.test.ts` — existing fixture-driven test pattern
- `web/src/lib/sections/projetosDerive.ts` and `.test.ts` — migration source
- `web/src/lib/sections/ProjetosSection.svelte` — import site, nested-query precedent, `vencido`/`tarefaConcluida` call sites
- `web/src/lib/routineJob.ts` — actual query shape (one-hop, not two), UTC-date idiom
- `web/src/lib/Shell.svelte` — confirmed Dashboard mount already wired, unconditional
- `web/src/lib/dashboard/Dashboard.svelte` — confirmed current placeholder content
- `web/src/lib/entities/EntityScreen.svelte` — Popover usage precedent, `buildQuery` cast idiom
- `web/src/lib/entities/defs/{tickets,tarefas,instanciasRotina,templatesRotina,fundos,projetos,etapas}.ts`
- `web/src/lib/db.ts`, `shared/instant.schema.ts`, `shared/instant.perms.ts`
- `web/src/app.css` — confirmed grayscale token set, no new color needed
- `web/README.md`, `web/package.json` — toolchain/test-runner confirmation
- `.planning/phases/21-.../21-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `spec-ui.md` §0/§3/§5/§6/§7/§8

### Secondary / Tertiary
None used — no web search or external documentation lookup was necessary; every question this
phase raised resolves entirely against in-repo source already committed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nothing new; every dependency already installed and verified in `package.json`
- Architecture: HIGH — every pattern cited is `[VERIFIED]` against a shipped, e2e-proven file in this exact repo
- Pitfalls: HIGH — each pitfall traces to a specific line range demonstrating the risk

**Research date:** 2026-08-11
**Valid until:** No external expiry — this research is anchored to in-repo files, not to a
third-party library's release cycle. Re-verify only if `bizdays.ts`, `routineJob.ts`,
`instant.schema.ts`, or `instant.perms.ts` change before Phase 21 executes.
