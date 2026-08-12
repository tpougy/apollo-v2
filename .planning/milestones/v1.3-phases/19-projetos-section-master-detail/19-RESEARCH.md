# Phase 19: Projetos Section (Master-Detail) - Research

**Researched:** 2026-08-11
**Domain:** Svelte 5 + InstantDB nested master-detail UI, built on the Phase 18 `EntityScreen` additive extension
**Confidence:** HIGH (this phase is almost entirely internal-codebase archaeology; the two external facts used — InstaQL `$isNull` syntax and shadcn-svelte's registry component names — are both CITED against official docs / the project's own binding spec, not assumed)

## Summary

This phase does not need any new library. Every fact needed to build `ProjetosSection.svelte`
already lives in three places: `spec-ui.md` §2.2 (locked layout), `EntityScreen.svelte` (the
one reusable data/CRUD engine, already extended in Phase 18 with `scopeWhere`/`presetLinks`),
and the schema/defs files (`etapas.ordem` is a real numeric field on the `etapas` entity,
completely distinct from `EntityConfig.ordem`, and the codebase already documents this
distinction in a comment at `etapas.ts:9-13`).

The single hardest technical fact this research surfaces is that **`EntityScreen.svelte` has
no externally-triggerable API** — `startCreate()`/`startEdit()` are internal functions gated by
local `$state`, not exported, not bindable. `scopeWhere`/`presetLinks` (Phase 18) only affect
the query and the create-form's preset link value; they do not expose a way to open the dialog
from outside the component. "+ novo projeto" reusing "`EntityScreen`'s own create dialog" (per
CONTEXT.md) can only be achieved, without touching `EntityScreen.svelte` again (spec §0.6 permits
*exactly one* additive extension, already spent in Phase 18), by mounting a real
`<EntityScreen config={projetosConfig} />` instance and driving its own real
`entity-create-start` button programmatically — which works because bits-ui's `Dialog` renders
through a `Portal` to `document.body` (`dialog-content.svelte:24-47`), independent of whether the
mounting `EntityScreen` instance's own wrapper is visually hidden.

The second hardest fact is that `ProjetosSection` needs its own **bespoke** `db.useQuery` — the
generic `EntityScreen.buildQuery` (`EntityScreen.svelte:69-76`) only ever nests link labels one
level deep (`sub[link.label] = {}`), so it cannot express `projetos → etapas → tarefas →
subtarefas` in one call. InstantDB itself has no depth limit on nested link traversal (the
project's own future `dashboardQuery.ts`, spec §5.1, nests two levels: `instanciasRotina →
template → fundo`), so a bespoke query is both necessary and safe.

**Primary recommendation:** Build one bespoke `db.useQuery` in `ProjetosSection.svelte` shaped
`{ projetos: { fundo: {}, etapas: { tarefas: { subtarefas: {} } } } }`; use it for both the
master column (group by `fundo`) and the detail column (etapas ordered by `etapas.ordem`,
progress bar from `subtarefas.concluida`); reuse the *existing* `EntityScreen` unmodified for
(a) a hidden `projetos`-configured instance to host the create dialog, (b) a hidden
`etapas`-configured instance with `presetLinks: { projeto: <id> }` to host "+ etapa", (c) a
hidden `tarefas`-configured instance with `presetLinks: { etapa: <id> }` to host "+ tarefa nesta
etapa", and (d) a fully visible, unscoped `tarefas`-configured instance for the "Todas as
tarefas" tab, with the "Sem etapa" filter implemented via the *existing* `scopeWhere` prop set to
`{ "etapa.id": { "$isNull": true } }` (InstaQL's documented null-link filter) rather than
client-side filtering.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Projetos grouped-by-fundo master list | Browser/Client (Svelte component state) | API/Backend (InstantDB reactive query) | Grouping/search is pure client-side derivation over an already-loaded reactive query result (spec §2.2: "filtro client-side sobre as linhas já carregadas") — no new backend query per keystroke. |
| Etapas accordion + inline tasks | Browser/Client | Database (InstantDB nested link fetch) | One reactive query fetches the full projeto→etapas→tarefas→subtarefas tree; which etapa is "open" is pure client `$state`, never re-queried. |
| Progress bar / `N/M` counts | Browser/Client (pure function) | — | `progressoEtapa`-shaped logic operates on already-fetched rows; REQUIREMENTS.md §5.3 locks the rule (must not compare `status` strings). |
| Task completion / prazo `destructive` styling | Browser/Client (pure function `vencido()`) | — | Date comparison only, no backend involvement; must be the same single function every other Phase (21/22) reuses. |
| Create/edit projeto, etapa, tarefa | API/Backend (InstantDB `transact`) via the existing generic engine | Browser/Client (hidden `EntityScreen` instance as dialog host) | All writes go through the unmodified `EntityScreen.svelte` transact path (`donoId` injection, xor/link validation) — no new write path is introduced. |
| "Todas as tarefas" / "Sem etapa" escape hatch | API/Backend (InstantDB `where` filter via `scopeWhere`) | Browser/Client | Reuses Phase 18's `scopeWhere` prop with InstaQL's `$isNull` operator — no client-side filtering needed, no new query engine. |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NEST-02 | Projetos section is master-detail: left column groups by fundo (search + display-only group-by), right column shows selected project's etapas as `ordem`-ordered collapsible single-open accordion rows with that etapa's tasks inline | Bespoke query shape below; `etapas.ordem` field vs `EntityConfig.ordem` distinction (already documented at `etapas.ts:9-13`); accordion component recommendation |
| NEST-03 | "etapas ▾" list/kanban toggle over the same data; "Todas as tarefas" tab (no `scopeWhere`) with a "Sem etapa" convenience filter | Same bespoke query feeds both list/kanban render modes (pure `$state` view toggle, no re-fetch); `scopeWhere: { "etapa.id": { "$isNull": true } }` recommendation for the filter, reusing Phase 18's `scopeWhere` prop unmodified |

## Standard Stack

No new npm dependency is needed or permitted (spec §0.3, §10 "Fora de escopo": "Qualquer
dependência nova fora do registry shadcn-svelte"). `bits-ui` (already a `devDependency`,
`^2.16.3` — `web/package.json`) already provides every primitive the new shadcn-svelte
components below wrap; `shadcn-svelte add` only copies source files into
`web/src/lib/components/ui/`, it does not add an npm package.

### Core

| Component | Source | Purpose | Already installed? |
|-----------|--------|---------|---------------------|
| `accordion` | shadcn-svelte registry (`bunx shadcn-svelte@latest add accordion`, run from `web/`) | Single-open etapas rows (`Accordion.Root type="single"`) | **No** — verified absent: `ls web/src/lib/components/ui/` (18 dirs: alert, alert-dialog, badge, button, calendar, card, checkbox, dialog, empty, input, label, popover, select, separator, skeleton, sonner, table, textarea — no `accordion`) |
| `tabs` | shadcn-svelte registry | "Todas as tarefas" tab inside the detail column (spec §7 explicitly names Projetos as one of the two consumers) | **No** — same listing, absent |
| `scroll-area` | shadcn-svelte registry | Horizontal-scroll kanban view of etapas (spec §3.5's overflow rules apply here too, per §2.2: "O kanban aqui segue as regras de faixa de §3.5") | **No** — same listing, absent |

### Supporting

| Component | Purpose | When to use |
|-----------|---------|-------------|
| `tooltip` | Icon-only affordance without a text label | Only if some Phase 19 control ends up icon-only with no visible text — current spec §2.2 wording ("+ novo projeto", "+ etapa", "editar projeto", "+ tarefa nesta etapa") is all text-labeled, so this is likely **not needed in Phase 19**; do not pre-install speculatively. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn `accordion` (bits-ui `Accordion.Root type="single"`) | Hand-rolled `button` + `{#if}` with a single `$state<string \| null>` tracking the open etapa id | Spec §7 explicitly permits either ("decidir uma vez e ser consistente"). The hand-rolled version is ~10 fewer lines of installed surface but loses `bits-ui`'s built-in `aria-expanded`/keyboard handling for free. **Recommendation: install `accordion`** — it is the more idiomatic choice given every other `components/ui/*` file in this codebase is already a thin `bits-ui` wrapper (e.g. `dialog-content.svelte:9` `import { Dialog as DialogPrimitive } from "bits-ui"`), so accordion is one more of the same pattern, not a new one. |
| Bespoke `db.useQuery` in `ProjetosSection.svelte` | Extending `EntityScreen.buildQuery` to support nested sub-links | Not possible without a second additive `EntityScreen` prop, which spec §0.6 forbids beyond the one already shipped in Phase 18 (`scopeWhere`/`presetLinks`). A bespoke query is the only spec-compliant option. |
| `scopeWhere: { "etapa.id": { "$isNull": true } }` for "Sem etapa" | Client-side `.filter()` over `rowsOf()` | CONTEXT.md explicitly allows either ("client-side ou scopeWhere-driven, executor's discretion"). The `$isNull` operator is CITED from InstantDB's official docs (see Sources) but has **zero prior usage in this codebase** — flag as the one net-new InstaQL feature this phase introduces; smoke-test it against the live app before committing to it. If it misbehaves against this project's InstantDB SDK version (`@instantdb/svelte@^1.0.63`), fall back to client-side filtering with no loss of correctness, only a marginally larger client bundle already loaded into memory. |

**Installation:**
```bash
cd web
bunx shadcn-svelte@latest add accordion tabs scroll-area
```
Verified reachable in this environment: `bunx shadcn-svelte@latest --version` resolved to
`1.5.0`, matching `package.json`'s pinned `shadcn-svelte: ^1.5.0` devDependency, without
installing any new package (confirmed no `bun.lock` diff from a dry run of the CLI's own
version check in this session).

## Package Legitimacy Audit

Not applicable — this phase adds zero new `npm`/`bun` package.json dependencies. `shadcn-svelte
add <component>` copies source files from the already-configured registry
(`web/components.json`: `"registry": "https://shadcn-svelte.com/registry"`) directly into
`web/src/lib/components/ui/<component>/`; it does not touch `dependencies`/`devDependencies`
beyond what `bits-ui`/`tailwind-variants` (both already present) provide. No `package-legitimacy
check` is warranted for a source-copy operation with no new registry-external package name.

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Projetos" (nav-projetos)
        │
        ▼
Shell.svelte: rota = { section: "entity", etype: "projetos" }
        │
        ▼  (NEW branch needed: rota.etype === "projetos" mounts ProjetosSection,
        │   not the generic EntityScreen fallback)
        ▼
ProjetosSection.svelte
        │
        ├─ db.useQuery({ projetos: { fundo:{}, etapas:{ tarefas:{ subtarefas:{} } } } })
        │        │
        │        ▼
        │  group by row.fundo?.nome, "Sem fundo vinculado" group forced last
        │        │
        │        ▼
        │  MASTER COLUMN: list of project buttons (testid project-item + data-eid)
        │        │  (click sets selectedProjetoId — local $state, no re-query)
        │        ▼
        └─ DETAIL COLUMN: rows.find(p => p.id === selectedProjetoId)
                 │
                 ├─ header: nome · fundo · etapas.length · Σ tarefas.length
                 │
                 ├─ etapas sorted by row-level `ordem` field ascending
                 │        │
                 │        ▼
                 │  Accordion (single-open) — openEtapaId: $state<string|null>
                 │        │
                 │        ▼ (on open)
                 │  tasks of that etapa: checkbox / titulo / prazo (vencido() → destructive)
                 │  / subtarefa N/M chip (passive, Phase 20 wires the click)
                 │        │
                 │        ▼
                 │  "+ tarefa nesta etapa" → hidden EntityScreen(tarefas,
                 │      presetLinks:{etapa:<id>}).click("entity-create-start")
                 │
                 ├─ "etapas ▾" toggle: list (default) | kanban — same query, $state view mode
                 │
                 └─ "Todas as tarefas" tab → visible EntityScreen(tarefas, no scopeWhere)
                          + "Sem etapa" toggle → scopeWhere: {"etapa.id":{"$isNull":true}}
```

### Recommended Project Structure

```
web/src/lib/
├── sections/
│   └── ProjetosSection.svelte     # NEW — master-detail component, per spec §8's file list
├── entities/
│   ├── EntityScreen.svelte        # UNCHANGED — Phase 18's scopeWhere/presetLinks reused as-is
│   └── defs/{projetos,etapas,tarefas}.ts   # UNCHANGED — no schema/def edits needed
└── Shell.svelte                   # ONE new conditional branch: etype==="projetos" → ProjetosSection
```
`web/src/lib/sections/` does not exist yet (`ls` returned nothing) — it is a new directory,
exactly as spec §8 lists it ("Novos ... `web/src/lib/sections/{ProjetosSection,...}.svelte`").

### Pattern 1: Bespoke nested query (replaces EntityScreen's buildQuery for this screen only)

**What:** `ProjetosSection.svelte` calls `db.useQuery` directly (same pattern `EntityScreen.svelte`
itself uses at line 82: `db.useQuery(() => buildQuery(config) as never)`), but with a
hand-written, multi-level query object instead of `buildQuery()`.
**When to use:** Any time the generic one-level-deep `EntityScreen.buildQuery` cannot express the
needed shape — this is a *known, accepted* divergence, not a workaround.
**Example:**
```typescript
// Source: pattern mirrors EntityScreen.svelte:69-82's own db.useQuery(() => ... as never)
// cast-at-the-InstaQL-boundary comment (etype is a runtime string, not a schema literal).
type ProjetoRow = {
  id: string;
  nome: string;
  status: string;
  fundo?: { id: string; nome: string };
  etapas?: EtapaRow[];
};
type EtapaRow = {
  id: string;
  nome: string;
  ordem: number; // <-- the ROW-LEVEL field, see "ordem vs ordem" section below
  status: string;
  tarefas?: TarefaRow[];
};
type TarefaRow = {
  id: string;
  titulo: string;
  status: string;
  dataPrevista?: string;
  subtarefas?: { id: string; concluida: boolean }[];
};

const query = db.useQuery(() => ({
  projetos: {
    fundo: {},
    etapas: { tarefas: { subtarefas: {} } },
  },
}) as never);

function rowsOf(): ProjetoRow[] {
  const data = query.data as Record<string, ProjetoRow[]> | undefined;
  return (data?.projetos ?? []) as ProjetoRow[];
}
```

### Pattern 2: Reusing EntityScreen's create dialog with no external API, via a hidden mount + real-button click

**What:** Mount a real `<EntityScreen>` instance, visually hidden, and drive its own DOM button.
**When to use:** Every "+ X" affordance in this phase that must produce the exact same
create-dialog behavior `EntityScreen` already has (validation, `donoId` injection, xor-link
enforcement) without adding a second prop to `EntityScreen.svelte` (spec §0.6 forbids it).
**Verified mechanism:** bits-ui's `Dialog.Content` renders through a `Portal`
(`web/src/lib/components/ui/dialog/dialog-content.svelte:24,47` — `<DialogPortal
{...portalProps}>` wrapping `DialogPrimitive.Content`, closed by `</DialogPortal>`), so the
open dialog is appended to `document.body` regardless of whether its trigger's ancestor tree is
`hidden`.
```svelte
<!-- Source: pattern combines EntityScreen.svelte's own existing DOM-query precedent
     (EntityScreen.svelte:406,441: document.querySelector('[data-testid="entity-create-start"]')?.focus())
     with the verified Portal fact above -->
<div class="hidden" aria-hidden="true">
  <EntityScreen config={projetosConfig} />
</div>

<Button
  type="button"
  onclick={() => {
    document
      .querySelector<HTMLButtonElement>('[data-testid="entity-create-start"]')
      ?.click();
  }}
>
  + novo projeto
</Button>
```
**Multiple-instance caution:** if more than one hidden `EntityScreen` is mounted at once (e.g. a
hidden `projetos` instance for "+ novo projeto" AND a hidden `etapas` instance for "+ etapa"
simultaneously), `document.querySelector(...)` returns only the FIRST DOM match — scope the
query to a `bind:this`-captured wrapper `<div>` per hidden instance instead of a bare global
`querySelector`, e.g. `wrapperEl.querySelector('[data-testid="entity-create-start"]')`, to avoid
ever clicking the wrong hidden instance's button.

### Pattern 3: `ordem` field vs `EntityConfig.ordem` — verified distinct, already documented in-repo

**Verified:** `web/src/lib/entities/defs/etapas.ts:9-13`:
```
// Note: the field named `ordem` (sequence order within a projeto) is a
// distinct key from `EntityConfig.ordem` (nav sort order) below — they live
// on different objects and are never conflated by EntityScreen, which reads
// the field-level value from `config.fields`/row data, not from the config's
// own `ordem`.
```
and `web/src/lib/entities/defs/etapas.ts:18`: `ordem: 10,` is the `EntityConfig.ordem` (nav sort
order — see `web/src/lib/entities/types.ts:33`: `ordem: number; // nav sort order`), while
`web/src/lib/entities/defs/etapas.ts:23`: `{ name: "ordem", label: "Ordem", required: true, kind:
"number" }` inside `fields` declares the **row-level** `ordem` field that actually exists on the
`etapas` entity in `shared/instant.schema.ts:32`: `ordem: i.number(),`. `ProjetosSection.svelte`
must sort etapas by `row.ordem` (the fetched query-row field), **never** by `etapasConfig.ordem`
(which is the constant `10`, irrelevant to per-project ordering and not even present on query
result rows).

### Anti-Patterns to Avoid

- **Filtering "sem etapa" tasks by re-querying `db.useQuery` on every keystroke of a group-by
  toggle:** the master column's search/group-by controls are spec'd as pure client-side
  filters over already-loaded rows (spec §2.2) — never re-fetch on search input or group-by
  change.
- **Sorting etapas by array insertion order or by `etapasConfig.ordem`:** always sort by the
  fetched row's own `ordem` numeric field (see Pattern 3).
- **Adding a third prop to `EntityScreen.svelte`:** spec §0.6 permits exactly one additive
  extension (already spent). Any new cross-cutting need must be solved in `ProjetosSection.svelte`
  itself (bespoke query, hidden-instance trick), never by touching the generic engine again.
- **`if (config.etype === "projetos")` anywhere in a generic file:** forbidden by spec §0.6/§0.7.
  The Shell.svelte branch that special-cases `rota.etype === "projetos"` is fine — `Shell.svelte`
  is not `EntityScreen.svelte`/`registry.ts`, and choosing which top-level component to mount per
  route is exactly what a router/shell is for.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Single-open collapsible etapas list | A custom open/close state machine with manual ARIA attributes | shadcn-svelte `accordion` (`Accordion.Root type="single"`) | `bits-ui` already ships correct `aria-expanded`, keyboard (`Enter`/`Space`/arrow) handling for free; every other interactive `components/ui/*` primitive in this codebase is already a `bits-ui` wrapper — consistent, not novel. |
| Projeto/etapa/tarefa create-with-validation forms | A second, parallel form component for "creating from inside Projetos" | The hidden-`EntityScreen`-instance + real-button-click pattern (Pattern 2 above) | `EntityScreen.svelte` already has the complete, tested create/validate/`donoId`-inject/transact logic (`EntityScreen.svelte:203-419`); duplicating it anywhere violates the "one generic engine" architecture this whole milestone protects. |
| Overdue/`vencido` styling for tasks in the etapa detail | A local `dataPrevista < new Date()` inline check | The `vencido()` rule locked by REQUIREMENTS.md §5.4: `dataPrevista != null && dataPrevista < hoje && !concluido` | Every later phase (Dashboard's calendar/kanban/heatmap, Phase 21-22) must reuse the exact same rule — starting a second ad-hoc overdue check in Phase 19 creates exactly the drift the requirement doc explicitly forbids. |

**Key insight:** every "don't hand-roll" item in this phase resolves to "reuse `EntityScreen`'s
engine or `bits-ui`'s primitive," never a new npm dependency — this phase's entire risk surface is
composition, not tooling choice.

## Common Pitfalls

### Pitfall 1: `nav-projetos` currently mounts the generic `EntityScreen`, and 1 existing e2e file directly depends on that

**What goes wrong:** `entities-projeto-etapa-tarefa.spec.ts`'s `WEB-03` test
(`web/e2e/entities-projeto-etapa-tarefa.spec.ts:155-220`) clicks `nav-projetos` then asserts
`entity-create-start`, `field-nome`, `field-status`, `link-fundo`, and `row`-level table cells —
all of which come from the generic `EntityScreen`'s own table/dialog markup. Once
`rota.etype === "projetos"` mounts `ProjetosSection` instead, none of that markup exists at the
top level any more.
**Why it happens:** NEST-02 is an intentional, spec-mandated UI replacement for the projetos
screen — this is not a zero-regression phase like Phase 18's `NEST-01` was for `scopeWhere`/
`presetLinks` defaults.
**How to avoid:** Rewrite `WEB-03` (only that test, in that file) to drive the new master-detail
markup (`project-item`, `data-eid`, "+ novo projeto", "editar projeto") instead of the old flat
table. This is a **required plan task**, not optional cleanup — CONTEXT.md's inclusion of this
spec file in `files_to_read` "to not break" means "keep this file's assertions valid after
updating them to match the new UI," not "leave every line unedited."
**Warning signs:** `bunx playwright test entities-projeto-etapa-tarefa.spec.ts` failing on
`entity-create-start`/`row` locators immediately after `ProjetosSection` ships.

### Pitfall 2: `shell-nav.spec.ts` hard-asserts a single `<h2>Projetos</h2>` after clicking `nav-projetos`

**What goes wrong:** `web/e2e/shell-nav.spec.ts:20-36` — `EXPECTED_H2_BY_TESTID["nav-projetos"] =
"Projetos"`, then asserted via `await expect(page.locator("h2")).toHaveText(EXPECTED_H2_BY_TESTID[testid])`
in a loop over all 6 nav buttons. This assumes exactly one `<h2>` exists on the page at a time,
with that exact text.
**Why it happens:** the generic `EntityScreen` today renders `<h2>{config.titulo}</h2>`
(`EntityScreen.svelte:456`), which happens to read "Projetos" for the `projetos` config; once
`ProjetosSection` replaces that mount, nothing produces an `<h2>` unless `ProjetosSection.svelte`
explicitly includes one.
**How to avoid:** `ProjetosSection.svelte` must render exactly one `<h2>Projetos</h2>` (or
equivalent literal text) as its section title, and it must be the **only** `<h2>` on the page in
that route (the breadcrumb `PROJETOS › <nome> › Etapa N · <nome>` from spec §2.2 must NOT be an
`<h2>` — use a `<p>`/`<div class="text-xs text-muted-foreground">` for it, matching the spec's own
styling instruction).
**Warning signs:** `shell-nav.spec.ts`'s main loop test failing only on the `nav-projetos`
iteration, or failing with a "strict mode violation: locator resolved to 2 elements" Playwright
error if a second `<h2>` sneaks in (e.g. from a hidden `EntityScreen` instance rendering its own
`<h2>{config.titulo}</h2>` — hidden via CSS `display:none`, but `<h2>` text content is still in
the DOM and still matched by `page.locator("h2")`, `hidden` attribute alone does not remove it
from `hasText`/`toHaveText` matching unless combined with `visibility` filtering, so prefer
`page.locator('[data-testid="entity-header"] h2')` scoping if this becomes an issue — but the
simplest fix is to keep hidden `EntityScreen` instances' own `<h2>` out of query scope entirely by
not including them in generic `h2` locators used elsewhere).

### Pitfall 3: `gotoNested(page, "etapas")` and `gotoNested(page, "tarefas")` have 9+ call sites across the e2e suite that assume a raw, unscoped `EntityScreen` table

**What goes wrong:** `web/e2e/helpers/gotoNested.ts` is used by
`entities-form-dialog-composition.spec.ts`, `entities-form-restyle.spec.ts`,
`entities-rotina-log.spec.ts`, `entities-header-states.spec.ts`,
`entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts`,
`cross-phase-verification.spec.ts`, and `entities-delete-confirmation.spec.ts` — the majority via
`gotoNested(page, "tarefas")` expecting an unscoped `entity-table-frame`/`row`/`entity-create-start`
for **all** tarefas.
**Why it happens:** `gotoNested.ts`'s own docstring explicitly anticipates this: "Phase 19/20 ship
the real parent-hosted nested UI (replacing today's interim `nested-goto` Select in Shell.svelte
with a real master-detail drill-down) — none of the call sites using `gotoNested(page, etype)`
will need to change again." This is a **contract**, not a suggestion: only `gotoNested.ts`'s body
may change; call sites must not need edits.
**How to avoid:** Update `gotoNested.ts`'s `"tarefas"` case to navigate to Projetos, then click
into the "Todas as tarefas" tab — since that tab is spec'd as literally `<EntityScreen
config={tarefasConfig} />` with no `scopeWhere`, it produces the exact same
`entity-table-frame`/`row`/`entity-create-start`/`field-*` markup the 8 other spec files already
depend on, satisfying the contract with **zero edits to those 8 files**. The `"etapas"` case has
no equivalent unscoped-table destination any more (etapas only exist inside a selected project's
detail column) — this is the one case that genuinely cannot honor the "no call-site changes"
contract, and is scoped to exactly one file (`entities-projeto-etapa-tarefa.spec.ts`'s `WEB-04` and
its `T-04-04` dangling-link test, `web/e2e/entities-projeto-etapa-tarefa.spec.ts:222-271` and
`:330-371`) — rewrite those two tests' etapa-specific interactions directly, and either retire
`gotoNested`'s `"etapas"` case or repoint it at "select a project, then the etapa list" as its new
meaning.
**Warning signs:** any spec outside `entities-projeto-etapa-tarefa.spec.ts` failing after this
phase is a sign `gotoNested.ts`'s `"tarefas"` body was changed in a way that breaks the contract
— re-check it lands on an actual unscoped `EntityScreen(tarefas)`.

### Pitfall 4: `NAV-02`'s test loop in `shell-nav.spec.ts` iterates over all 4 nested etypes expecting `entity-table-frame`

**What goes wrong:** `web/e2e/shell-nav.spec.ts:68-84` loops
`["etapas", "tarefas", "templatesRotina", "subtarefas"]`, calling `gotoNested(page, etype)` then
asserting `entity-table-frame` visible, for **all four**. Once `"etapas"`'s destination changes
(Pitfall 3), this loop's `"etapas"` iteration breaks.
**Why it happens:** this test predates the Phase 19/20 split and was written generically for the
whole nested-entity set at once.
**How to avoid:** update this loop to special-case `"etapas"` (assert the new detail-column
markers instead of `entity-table-frame`) while leaving `"tarefas"`/`"templatesRotina"`/
`"subtarefas"` on the generic assertion (the latter two stay untouched until Phase 20).
**Warning signs:** this specific test failing only on the `etapas` array element.

### Pitfall 5: `$isNull` in `scopeWhere` is unverified against this project's exact InstantDB SDK pin

**What goes wrong:** the InstaQL `$isNull: true` operator (used for the "Sem etapa" filter,
`scopeWhere: { "etapa.id": { "$isNull": true } }`) is documented on instantdb.com but has never
been exercised anywhere in this codebase (`grep -rn "isNull" web/src shared` returns nothing).
**Why it happens:** every existing `scopeWhere` usage in this codebase (Phase 18, and spec §2.4's
planned Tickets/Subtarefas usage) filters on a concrete id (`{"etapa.id": <id>}`), never on
absence.
**How to avoid:** smoke-test this specific query shape against the live hosted InstantDB app
early in the plan (e.g. via `db.queryOnce` in a scratch script, or as the very first assertion in
the new "Sem etapa" e2e test) before building UI around it. If it does not behave as documented
for `@instantdb/svelte@^1.0.63`, fall back to client-side `.filter(row => !row.etapa)` over
`rowsOf()` — CONTEXT.md explicitly permits either.
**Warning signs:** the "Sem etapa" filter silently returning zero rows or all rows instead of the
expected subset.

## Code Examples

### "Sem etapa" filter via the existing `scopeWhere` prop

```typescript
// Source: InstantDB docs (instantdb.com/docs/patterns) — see Sources.
// Existing merge point this plugs into: EntityScreen.svelte:75
//   return { [cfg.etype]: { $: scopeWhere ? { where: scopeWhere } : {}, ...sub } };
let semEtapa = $state(false);
const tarefasScopeWhere = $derived(semEtapa ? { "etapa.id": { "$isNull": true } } : null);
```
```svelte
<EntityScreen config={tarefasConfig} scopeWhere={tarefasScopeWhere} />
```

### Grouping projetos by fundo, "Sem fundo vinculado" forced last

```typescript
// Source: mirrors Shell.svelte:26-41's own nestedGroups grouping pattern
// (Map + Array.from(entries), zero per-entity branching) applied to project rows instead.
function groupByFundo(rows: ProjetoRow[]): { label: string; rows: ProjetoRow[] }[] {
  const groups = new Map<string, ProjetoRow[]>();
  for (const row of rows) {
    const label = row.fundo?.nome ?? "Sem fundo vinculado";
    const list = groups.get(label) ?? [];
    list.push(row);
    groups.set(label, list);
  }
  const entries = Array.from(groups.entries());
  entries.sort((a, b) => {
    if (a[0] === "Sem fundo vinculado") return 1;
    if (b[0] === "Sem fundo vinculado") return -1;
    return a[0].localeCompare(b[0]);
  });
  return entries.map(([label, rows]) => ({ label, rows }));
}
```

## State of the Art

Not applicable in the usual sense — this is a 2-day-old internal codebase (the entire v1.0-v1.2
history is 2026-08-09/10), not an ecosystem with a meaningful "old vs. current approach" axis. The
one relevant internal "state of the art" shift is Phase 18 → Phase 19 itself:

| Old Approach (Phase 18, interim) | Current Approach (Phase 19) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `etapas`/`tarefas` reachable only via the "(temporário)" `nested-goto` `<Select>` in `Shell.svelte:136-160`, landing on a raw unscoped `EntityScreen` | `etapas` live inside a selected project's detail column; `tarefas` reachable both there (scoped to one etapa via `presetLinks`) and via the "Todas as tarefas" tab (unscoped) | This phase | The interim `<Select>` becomes redundant for these two etypes once ProjetosSection ships (still needed for `templatesRotina`/`subtarefas` until Phase 20) — see Pitfall 3/Open Questions for whether to prune it now or leave it. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | InstaQL's `$isNull: true` operator behaves as documented against `@instantdb/svelte@^1.0.63` specifically (docs checked were general InstantDB docs, not version-pinned) | Code Examples / Pitfall 5 | "Sem etapa" filter silently returns wrong rows; mitigated by the documented client-side fallback, so worst case is a small rework, not a blocked phase |
| A2 | Removing `etapas`/`tarefas` from `Shell.svelte`'s interim `nestedGroups` (lines 26-41) and retiring `gotoNested`'s `"etapas"` case is the *intended* end-state, not merely optional polish | Common Pitfall 3 / Open Questions | If the milestone author intended the interim dropdown to persist alongside the real UI until Phase 20's blanket cleanup, pruning it early is harmless (spec's NAV-02 acceptance criteria don't test for its absence either way) — low risk either direction, but the two paths need a decision recorded before the plan starts |

## Open Questions

1. **Does Phase 19 need to support editing or deleting an existing etapa's fields (`nome`,
   `ordem`, `status`) through any UI at all, or is that fully deferred to Phase 23's Etapa dialog?**
   - What we know: spec §2.2's detail-column body only describes "+ etapa" (create) and the
     read-only progress bar/counter per etapa row — no "editar etapa"/"excluir etapa" affordance
     is described anywhere in §2.2. CONTEXT.md's Deferred section explicitly defers "the
     Projeto/Etapa/Tarefa focus dialogs that will later wrap this same data" to Phase 23.
   - What's unclear: `entities-projeto-etapa-tarefa.spec.ts`'s existing `WEB-04` test edits an
     etapa's `ordem` (10→20) and deletes it via the generic table's `row-edit`/`row-delete` — a
     capability the new detail-column UI has no obvious equivalent affordance for in this phase.
   - Recommendation: scope Phase 19 to etapa **create only** through the UI (matching spec §2.2
     literally), rewrite `WEB-04`'s edit/delete assertions to either be removed or moved to a
     deferred-coverage note pointing at Phase 23, and confirm this reading with the milestone
     owner before the plan locks it in — this is a genuine spec gap, not a research gap.

2. **Should `Shell.svelte`'s interim `nestedGroups`/`nested-goto` `<Select>` drop `etapas` and
   `tarefas` from its options once `ProjetosSection` ships, or remain untouched until Phase 20
   retires the whole affordance at once?**
   - What we know: `gotoNested.ts`'s own docstring frames the Select as being "replaced" by the
     real UI per-etype as each phase ships (see Pitfall 3); nothing in NEST-02/NEST-03's literal
     acceptance criteria requires its removal.
   - What's unclear: whether leaving a "(temporário)" label pointing at a UI that a real user
     could reach as a duplicate, out-of-context path to `etapas`/`tarefas` is acceptable for this
     "UI and organization" milestone's actual quality bar, versus being dead scaffolding the
     milestone intends to retire incrementally.
   - Recommendation: prune `etapas` and `tarefas` from `Shell.svelte`'s `nestedGroups` computation
     in this phase (it is still a zero-per-etype-branch change — `nestedGroups` already derives
     structurally from `c.nav === "nested"`; the prune is filtering the *config* list, e.g. by
     also checking a "already has a real home" allowlist, or by having Phase 19 flip those two
     defs' `nav` back toward a value the Select excludes) and pair it with `gotoNested.ts`'s body
     update from Pitfall 3, so the temporary UI visibly shrinks as each phase gives its entities a
     real home — matches the milestone's own narrative in `ROADMAP.md`'s Phase 18 plan comment.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun`/`bunx` | Running `shadcn-svelte add`, `bun test`, dev server | ✓ | `1.3.12` | — |
| `shadcn-svelte` CLI (via `bunx`) | Adding `accordion`/`tabs`/`scroll-area` | ✓ | resolves `1.5.0`, matching `package.json`'s pinned `^1.5.0` | — |
| `bits-ui` | Underlying primitives for the new components | ✓ (already a `devDependency`, `^2.16.3`) | — | — |
| Live hosted InstantDB app | Smoke-testing the `$isNull` query shape (Pitfall 5) | Not probed this session (would require live auth) — assume ✓ per every prior phase's successful e2e runs against it | — | Client-side filter fallback, no blocked path either way |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the `$isNull` InstaQL operator (Assumption A1) has a
documented, zero-risk client-side fallback if it does not behave as expected.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (unit) | `bun:test` (Bun's built-in runner) — see `web/src/lib/bizdays.test.ts:1`: `import { describe, expect, test } from "bun:test";` |
| Framework (e2e) | Playwright, 3 projects (`setup`/`authed`/`anon`) per `web/README.md`'s "Running the e2e suite" section |
| Config file | none dedicated for unit (`bun test src` runs everything under `src`); `web/playwright.config.ts` for e2e |
| Quick run command | `cd web && bun test src/lib/entities/registry.test.ts` (unit, if a Phase 19 unit-testable module is added); `bunx playwright test entities-projeto-etapa-tarefa.spec.ts --project=authed --no-deps` (e2e, targeted) |
| Full suite command | `cd web && bun test src` (unit); `bun run test:e2e` (full Playwright suite, all 3 projects) |

No component-level (Svelte Testing Library / vitest-browser) test tooling exists in this
repository (`package.json` has no such dependency) — `ProjetosSection.svelte`'s interactive
behavior can only be verified through the live Playwright suite, not an isolated unit test. Any
*pure* logic this phase extracts (e.g. a phase-local `progressoEtapa`/`vencido` implementation,
per CONTEXT.md's "may start `derive.ts` early" allowance) is unit-testable via `bun:test`
following `bizdays.test.ts`'s fixture-driven pattern.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NEST-02 | Master column groups projetos by fundo, "Sem fundo vinculado" last, search filters client-side | e2e | `bunx playwright test entities-projeto-etapa-tarefa.spec.ts --project=authed --no-deps` (rewritten) | ❌ Wave 0 — rewrite `WEB-03` |
| NEST-02 | Detail column etapas ordered by `ordem` asc, single-open accordion, tasks inline | e2e | new spec assertions in the same or a new file | ❌ Wave 0 — new assertions |
| NEST-02 | Progress bar / `N/M` uses the subtarefa-based rule, never `status` string comparison | unit (if `progressoEtapa` extracted to a pure function) + e2e (rendered value) | `bun test src/lib/dashboard/derive.test.ts` (if started early) or inline e2e assertion | ❌ Wave 0 |
| NEST-03 | "etapas ▾" list/kanban toggle renders the same data two ways | e2e | new spec assertions | ❌ Wave 0 |
| NEST-03 | "Todas as tarefas" tab reachable, "Sem etapa" filter surfaces orphaned tasks | e2e | new spec assertions + `$isNull` smoke test (Pitfall 5) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted `bunx playwright test <file> --project=authed --no-deps` for the
  file(s) touched.
- **Per wave merge:** `cd web && bun run test:e2e` (full 3-project suite) — this is the same
  command `README.md` documents as the single reproducible proof used by every prior phase.
- **Phase gate:** full suite green before `/gsd-verify-work`, per this project's established
  convention (README.md's Phase 11/17 precedent).

### Wave 0 Gaps

- [ ] `entities-projeto-etapa-tarefa.spec.ts`'s `WEB-03` test — rewrite for the new master-detail
      markup (Pitfall 1).
- [ ] `entities-projeto-etapa-tarefa.spec.ts`'s `WEB-04`/`T-04-04` etapa tests — rewrite or
      descope per Open Question 1.
- [ ] `shell-nav.spec.ts`'s `EXPECTED_H2_BY_TESTID`/`NAV-02` loop — verify still passes; adjust the
      `etapas` loop iteration if `gotoNested`'s `"etapas"` case changes (Pitfall 2/4).
- [ ] `gotoNested.ts` — update `"tarefas"` (and possibly `"etapas"`) case bodies per Pitfall 3.
- [ ] New e2e coverage for: grouped-by-fundo master list + search, accordion single-open behavior,
      list/kanban toggle, "Todas as tarefas" + "Sem etapa" filter, hidden-`EntityScreen` create
      flows for projeto/etapa/tarefa-in-etapa.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no (unchanged) | `@instantdb/svelte`'s magic-code auth, already shipped; this phase adds no new auth surface |
| V3 Session Management | no (unchanged) | Same as above |
| V4 Access Control | yes | InstantDB permissions (`shared/instant.perms.ts`) already scope every read/write by `donoId`; this phase is explicitly out of scope for `instant.perms.ts` changes (REQUIREMENTS.md "Out of Scope") — the bespoke `ProjetosSection` query must rely on the *same* existing permission rules, not introduce a new unauthenticated/broader-scoped query path |
| V5 Input Validation | yes | All writes still go through `EntityScreen.svelte`'s existing validation (`handleSubmit`, `EntityScreen.svelte:270-419`) via the hidden-instance pattern — no new validation logic is introduced by this phase |
| V6 Cryptography | no | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Hidden `EntityScreen` instance exposing a create/edit surface for an entity the current `rota` shouldn't otherwise reach (e.g. a hidden `etapas` instance staying mounted after the user navigates away from Projetos) | Elevation of Privilege (scope, not auth) | `ProjetosSection.svelte` must only mount its hidden `EntityScreen` instances while it itself is mounted (Svelte's `{#key}`/component lifecycle already tears this down on route change, per `Shell.svelte`'s existing `{#key rota.etype}` pattern at `Shell.svelte:166`) — do not lift any hidden instance to a Shell-level always-mounted singleton, or its create-dialog surface would outlive the section that is supposed to own it. |
| Race between a hidden instance's `presetLinks: { projeto: <id> }` and the user switching `selectedProjetoId` mid-dialog | Tampering (wrong parent link written) | Reuse the existing, already-audited "dangling parent" guard in `EntityScreen.svelte:340-351` (`queryOnce` existence check before `transact`) — this is unmodified in this phase and already covers a stale/deleted parent id; ensure `presetLinks` is recomputed to the *currently selected* project/etapa id at the moment the hidden instance's dialog opens, not memoized from an earlier selection. |

## Sources

### Primary (HIGH confidence — direct file reads this session)
- `web/src/lib/Shell.svelte` — current `Route` union, `navConfigs`, interim `nestedGroups`/`nested-goto` Select, routing branch
- `web/src/lib/entities/EntityScreen.svelte` — `buildQuery`, `scopeWhere`/`presetLinks` merge points, `startCreate`/`startEdit`/`handleSubmit`, dangling-parent guard, post-action DOM-query focus-restoration precedent
- `web/src/lib/entities/types.ts` — `EntityConfig.ordem` comment ("nav sort order")
- `web/src/lib/entities/defs/{projetos,etapas,tarefas,fundos,subtarefas}.ts` — field/link/config shapes, the `ordem` vs `ordem` distinguishing comment
- `web/src/lib/entities/registry.ts` — `navConfigs` derivation
- `shared/instant.schema.ts` — `etapas.ordem: i.number()`, all link definitions (`projetoEtapas`, `etapaTarefas`, `tarefaSubtarefas`)
- `web/e2e/entities-projeto-etapa-tarefa.spec.ts`, `web/e2e/shell-nav.spec.ts`, `web/e2e/helpers/gotoNested.ts`, and the 6 other spec files grepped for `gotoNested(page, "tarefas")` usage
- `web/components.json`, `web/package.json`, `web/src/lib/components/ui/` directory listing, `web/src/lib/components/ui/dialog/dialog-content.svelte`
- `web/README.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `spec-ui.md`, `.planning/phases/19-projetos-section-master-detail/19-CONTEXT.md`, `.planning/config.json`

### Secondary (MEDIUM confidence)
- [InstantDB docs — InstaQL null-link filter (`$isNull`)](https://www.instantdb.com/docs/patterns) — CITED, exact syntax fetched this session; not yet exercised against this project's live app or exact SDK version (see Assumption A1 / Pitfall 5)

### Tertiary (LOW confidence)
- None — no findings in this research rest on an unverified web search alone.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new package; component names (`accordion`/`tabs`/`scroll-area`) are directly CITED from the project's own binding `spec-ui.md` §7, and their absence from `web/src/lib/components/ui/` was directly verified with `ls`.
- Architecture: HIGH — every pattern (bespoke query, hidden-instance dialog reuse, `ordem` distinction) is grounded in a specific file:line read this session, not inferred.
- Pitfalls: HIGH for the e2e-breakage findings (each backed by a grep + read of the actual assertion); MEDIUM for the `$isNull` operator specifically (CITED docs, not verified against this exact SDK pin in this session).

**Research date:** 2026-08-11
**Valid until:** Effectively the start of Phase 19's execution — this research is tightly coupled to the exact current state of `Shell.svelte`/`EntityScreen.svelte`/the e2e suite as of this commit; if Phase 19 is delayed and other phases land first, re-verify the file:line references before planning.
