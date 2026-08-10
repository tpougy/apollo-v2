# Phase 9: Entity Table Restyle - Research

**Researched:** 2026-08-09
**Domain:** shadcn-svelte 1.5.0 (`nova` style, `neutral` base) `Table`/`Badge` adoption into a single generic, config-driven `EntityScreen.svelte` reused across all 9 domain entities, zero functional/capability regression, zero human UAT
**Confidence:** HIGH (Table and Badge component source pulled live from the exact registry URL the installed CLI resolves against, identical style pinned in `web/components.json`; every entity's `EntityConfig` and `EntityScreen.svelte` read in full this session; no new npm dependency introduced)

## Summary

`web/src/lib/entities/EntityScreen.svelte` (531 lines) is the single generic screen every one of the 9 entity nav buttons mounts (`Shell.svelte`'s `{#key ativo}<EntityScreen config={configByEtype(ativo)} />`). Its list-view markup (lines 343–383) is a plain `<table>`/`<thead>`/`<tbody>` driven entirely by `config.listColumns: string[]` and `config.capabilities: {create,update,delete}` — it has zero per-entity branches. This phase's job is a pure, mechanical swap of that markup for shadcn-svelte's `Table` primitive component group plus wrapping status-like cell values in `Badge`, without touching the script block (query building, `columnValue()`, `startEdit`/`handleDelete`, capability gating) at all. The create/edit `<form>` below the table (lines 391–529) is explicitly out of scope (Phase 10 owns it) and must not be touched.

Fetching the live `nova`-style registry JSON this session (`https://shadcn-svelte.com/registry/styles/nova/table.json` and `.../badge.json` — the identical URL `bunx shadcn-svelte@latest add` resolves against, confirmed by `web/components.json`'s `"registry"` field and `"style": "nova"`) shows both component groups are trivial, dependency-free wrappers: `Table`'s 8 sub-components (`Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`/`TableCaption`/`TableFooter`) are plain native-element wrappers (`<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>`) using only `cn()` (already in `web/src/lib/utils.ts` since Phase 7) — **zero new npm dependency**. `Badge` is a plain `<span>`/`<a>` wrapper using `tailwind-variants`' `tv()`, and `tailwind-variants@^3.3.0` is already installed at `^3.3.1` (pulled in by Phase 8's `Button`/`Alert`). Running `bunx shadcn-svelte@latest add table badge -y` from `web/` will therefore only add two new local files under `web/src/lib/components/ui/{table,badge}/` — no `package.json`/`bun.lock` change is expected.

The `<table>` element rendered by `Table.svelte` carries no explicit `role` attribute, but native `<table>` has an implicit ARIA role of `table` — `page.getByRole("table")` works out of the box with zero markup changes needed for that assertion. `TableRow`/`TableHead`/`TableCell` all spread `...restProps`, so every existing `data-testid`/`data-eid` attribute on the current plain `<tr>`/`<th>`/`<td>` elements survives the swap verbatim, exactly as Phase 8 found for `Button`/`Input`/`Card`/`Alert`.

Because `EntityScreen.svelte` is genuinely generic — it does not know column count or type at compile time — the `{#each config.listColumns as column}<th>{column}</th>{/each}` loop translates directly to `{#each config.listColumns as column}<TableHead>{column}</TableHead>{/each}` with no typing friction: `TableHead`/`TableCell` accept `children` snippets and forward `HTMLThAttributes`/`HTMLTdAttributes`, so a runtime string-keyed loop needs no per-column static type. This is also why the TanStack-Table-based "Data Table" pattern is the wrong choice for this phase (see Architecture Patterns below) — TanStack's `ColumnDef<TData>` API is built around compile-time-known, typed columns, which actively fights this codebase's runtime, config-driven column model, adds a new dependency (`@tanstack/table-core`), and buys nothing REQUIREMENTS.md asks for (no sorting/filtering/pagination requirement, no huge datasets, and REQUIREMENTS.md's own Out of Scope table explicitly rules out external table libraries).

For Badge-worthy columns, no entity's `status` field has a closed, schema-enforced set of values — every `status` field across `projetos`/`etapas`/`tarefas`/`tickets`/`instanciasRotina` is `kind: "text"` and the CLI's own `--help` text calls it "free-form" verbatim (confirmed by reading `cli/apollo_cli/entities/{projeto,etapa,tarefa,ticket}.py`, `rotina.py` this session). Only `tarefas.tipoPrazo`/`tickets.tipoPrazo` (`kind: "select"`, options `["hard","soft"]`) and `templatesRotina.tipoGeracao` (`kind: "select"`, options `["du_fixo","corrido_fixo","encadeado"]`) are true closed enums; `instanciasRotina.tipoPrazo` is declared `kind: "text"` (not `"select"`) despite conceptually mirroring the other two entities' `tipoPrazo` — an inconsistency in the existing defs, not something this phase should "fix" (out of scope; not a capability). This phase should treat "Badge-worthy" as a fixed, cross-entity **column-name allowlist** (`status`, `tipoGeracao`, `tipoPrazo`) plus any `kind: "boolean"` field — never a per-entity or per-value special case — see Architecture Patterns for the exact variant-mapping recommendation.

`instanciasRotina` and `logInferenciaClaude`'s capability restrictions are gated entirely by `config.capabilities.{create,update,delete}` booleans already read directly this session (`instanciasRotina`: `{create:false, update:true, delete:false}` plus `updatableFields: ["status"]`; `logInferenciaClaude`: `{create:false, update:false, delete:false}`) — none of that logic lives in the table markup being restyled, so the restyle cannot regress it as long as the `{#if config.capabilities.update}`/`{#if config.capabilities.delete}`/`{#if mode === null && config.capabilities.create}` guards are copied over unchanged around the new `Button`-wrapped actions.

**Primary recommendation:** Run `bunx shadcn-svelte@latest add table badge -y` from `web/` (no new npm dependency expected — verify `git diff web/package.json` is empty after). Swap the plain `<table>`/`<thead>`/`<tr>`/`<th>`/`<tbody>`/`<td>` for `Table`/`TableHeader`/`TableRow`/`TableHead`/`TableBody`/`TableCell`, keeping every existing `{#each}`/`{#if}` and every `data-testid`/`data-eid` attribute byte-identical. Wrap the resolved string value of any `listColumns` entry named `status`, `tipoGeracao`, or `tipoPrazo`, plus any column whose `FieldDef.kind === "boolean"`, in `<Badge variant={...}>` using the generic, value-blind variant function in Architecture Patterns. Replace the two plain `<button>` row actions with `Button` (`variant="outline"` or `"ghost"`, small size), keeping `onclick`/testid/capability-gating identical. Do not touch the script block, the create/edit `<form>`, or anything below line 390.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Table/row/cell markup rendering (`Table`/`TableRow`/`TableCell`) | Browser/Client | — | Pure client-rendered Svelte components in this Vite-only SPA; no SSR tier exists |
| Status/enum value → Badge variant mapping | Browser/Client | — | Pure presentational logic derived from already-fetched row data; no new query/network round trip |
| Row data fetching (`db.useQuery`) | Browser/Client (via `@instantdb/svelte` SDK) | Database/Storage (InstantDB backend resolves the live query) | Untouched by this phase — the restyle only changes how already-fetched `query.data` rows are rendered, not how they are fetched |
| Capability gating (create/update/delete visibility) | Browser/Client | — | `config.capabilities` booleans are read client-side from the already-loaded `EntityConfig` object; the actual enforcement boundary is InstantDB's `instant.perms.ts` (Database/Storage tier), untouched by this phase |
| Row-action buttons (edit/delete triggers) | Browser/Client | — | `Button`-wrapped `onclick` handlers remain plain client-side state toggles (`mode`/`editingId`) and `db.transact()` calls, unchanged |

## User Constraints

<user_constraints>
### Locked Decisions (from CONTEXT.md, do not reopen)

- **C-11**: shadcn-svelte preset b0 (`nova`/`neutral`/lucide), already initialized (Phase 7). `Button`/`Input`/`Label`/`Card`/`Alert` already added (Phase 8).
- **C-12**: zero human UAT anywhere — every `<verify>` must be `<verify><automated>`, never `<human-check>`.
- **C-08**: `bun`/`bunx` only.

### Claude's Discretion

All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions (Phase 7/8 precedent) to guide decisions.

### Phase Boundary (explicit exclusion, do not attempt)

The create/edit `<form>` itself (fields, Dialog/Sheet wrapping, date-picker, Select/Combobox for relationships) is explicitly deferred to Phase 10. Phase 9 only touches the `<table>`/rows/row-actions/empty-state/badges. The "novo" (create) button and row-edit/row-delete buttons become shadcn `Button`, but their `onclick` behavior (toggling `mode` to show the still-plain inline form below the table) stays exactly as-is.

### Deferred Ideas (OUT OF SCOPE)

None specific to this phase — see Phase Boundary above (Phase 10 owns the form restyle).
</user_constraints>

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| ENTTBL-01 | `EntityScreen.svelte`'s list view for all 9 entities renders via shadcn `Table`, driven by existing `EntityConfig`, row actions as shadcn `Button` | See "Code Examples" for the exact registry source of `Table`'s 8 sub-components and a full restyled table-markup skeleton preserving every testid; "Architecture Patterns: Pattern 1" for the genericization argument (no per-column static typing needed) |
| ENTTBL-02 | Status/enum-like fields render as shadcn `Badge` instead of plain text | See "Architecture Patterns: Pattern 2 (Badge variant mapping)" for the generic, value-blind column-name-allowlist approach and its rationale |
| ENTTBL-03 | Every entity's restricted capability (create-only, status-only update, read-only log) remains visually and functionally identical after the restyle | See "Runtime State Inventory"-equivalent capability audit in Summary (exact `capabilities`/`updatableFields` values read from `instanciasRotina.ts`/`logInferenciaClaude.ts` this session) and "Validation Architecture" for the Playwright proof per capability class |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `shadcn-svelte` (CLI, devDependency) | `1.5.0` [VERIFIED: `npm view shadcn-svelte version`, run this session] | Generates local `Table`/`Badge` component groups under `web/src/lib/components/ui/` | Already the project's locked UI component source (C-11); same CLI used in Phase 7/8 |
| `bits-ui` | `^2.16.3` (already installed, Phase 8) | Transitive dependency of `Label` — **not** used by `Table`/`Badge` | No new version needed; neither `Table` nor `Badge` imports it |
| `tailwind-variants` | `^3.3.1` (already installed, Phase 8) | `Badge`'s `tv()`-based variant classes | `badge.json`'s only declared `devDependencies` entry is `tailwind-variants@^3.3.0`, already satisfied |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@lucide/svelte` | `^1.31.0` (already installed) | Optional icon inside `Button` row actions (e.g. `Pencil`/`Trash2`) | Only if the plan chooses icon+text buttons; plain text `Button`s (matching current "editar"/"excluir" labels) need no new icon import |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain shadcn `Table` primitive | shadcn-svelte's Data Table pattern (`bunx shadcn-svelte@latest add data-table` + `@tanstack/table-core`) | Adds a new npm dependency and a typed `ColumnDef<TData>[]` layer that fights this codebase's runtime `config.listColumns: string[]` model; buys sorting/filtering/pagination this phase's REQUIREMENTS.md never asks for. REQUIREMENTS.md's own Out of Scope table rules out external table libraries for exactly this reason ("shadcn-svelte's own Table/Data Table pattern is sufficient for this app's scale"). **Recommendation: do not use.** |
| Column-name-allowlist Badge mapping | Per-entity-hardcoded Badge variant switch statements (e.g. a `fundosBadgeMap`, `tarefasBadgeMap`, ...) | Reintroduces exactly the per-entity special-casing the generic `EntityScreen.svelte` architecture was built to avoid (CONTEXT.md explicitly asks for a mapping "without per-entity special-casing every value") |

**Installation:**
```bash
cd web && bunx shadcn-svelte@latest add table badge -y
```

**Version verification:** `npm view shadcn-svelte version` → `1.5.0` [VERIFIED, run this session] — matches `web/package.json`'s pinned `"shadcn-svelte": "^1.5.0"` exactly, so `bunx shadcn-svelte@latest add` will resolve against the CLI version already used for Phase 7/8's installs, no version drift risk. `npm view tailwind-variants version` → `3.3.1` [VERIFIED, run this session] — already the version pinned in `web/package.json`.

## Package Legitimacy Audit

No new npm package is installed by this phase. `bunx shadcn-svelte@latest add table badge -y` generates local `.svelte`/`index.ts` files only — confirmed by reading the live registry JSON for both items this session: `table.json` declares no `dependencies`/`devDependencies` field at all, and `badge.json`'s sole declared devDependency (`tailwind-variants@^3.3.0`) is already satisfied by the installed `^3.3.1`. The two packages already present in `web/package.json` that this phase's registry fetch touches are audited below for completeness (both pre-existing since Phase 7/8, neither newly introduced):

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|--------------|
| `shadcn-svelte` | npm | pre-existing (Phase 7/8) | 86,087/wk [VERIFIED: `gsd_run query package-legitimacy check`, this session] | `github.com/huntabyte/shadcn-svelte` | SUS ("too-new" — flags the *latest published version's* date, not the package's age; already vetted and in use since Phase 7) | Approved — already installed, no action; flag is a false positive on version-publish recency, not package legitimacy |
| `tailwind-variants` | npm | pre-existing (Phase 7/8) | 3,426,441/wk [VERIFIED: `gsd_run query package-legitimacy check`, this session] | `github.com/heroui-inc/tailwind-variants` | SUS ("too-new", same false-positive pattern — 3.4M weekly downloads is not consistent with a slopsquat/new package) | Approved — already installed, no action |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `shadcn-svelte`, `tailwind-variants` — both are false positives (the legitimacy checker's "too-new" signal reads the most-recently-published version's timestamp, not first-release date or download volume; both packages are already installed, already used since Phase 7/8, and carry no genuine slopsquat signal — high weekly downloads, verified GitHub source repos, no suspicious `postinstall`). No `checkpoint:human-verify` is warranted since no *new* install is happening this phase.

## Architecture Patterns

### System Architecture Diagram

```
InstantDB (live backend)
     │ db.useQuery() — reactive subscription
     ▼
EntityScreen.svelte (script block — UNCHANGED this phase)
     │ query.data → rowsOf() → Row[]
     ▼
list-view markup (THIS PHASE'S SCOPE)
     │
     ├─ config.listColumns loop ──► TableHead (header) / TableCell (body)
     │        │
     │        └─ columnValue(row, column) — UNCHANGED
     │                │
     │                ├─ if column ∈ {status, tipoGeracao, tipoPrazo} or field.kind==="boolean"
     │                │        ▼
     │                │   Badge variant={badgeVariantFor(...)}  ◄── NEW
     │                │
     │                └─ else: plain text cell (unchanged)
     │
     ├─ config.capabilities.update → Button "editar" (was <button>)
     ├─ config.capabilities.delete → Button "excluir" (was <button>)
     └─ config.capabilities.create → Button "novo"     (was <button>)  [below table, unchanged position]
```

### Recommended Project Structure

```
web/src/lib/
├── components/ui/
│   ├── table/            # NEW this phase — 8 files (table.svelte, table-header.svelte, ...)
│   └── badge/             # NEW this phase — badge.svelte, index.ts
├── entities/
│   ├── EntityScreen.svelte   # MODIFIED — list-view markup only (lines ~343-383)
│   └── defs/*.ts             # UNCHANGED — no def file needs editing for this phase
```

### Pattern 1: Generic Table markup over a runtime column list

**What:** `{#each config.listColumns as column}<TableHead>{column}</TableHead>{/each}` in the header, mirrored by `{#each config.listColumns as column}<TableCell>{columnValueOrBadge(row, column)}</TableCell>{/each}` in the body — a 1:1 structural swap of `<th>`→`TableHead`, `<td>`→`TableCell`, `<tr>`→`TableRow`, `<thead>`→`TableHeader`, `<tbody>`→`TableBody`, `<table>`→`Table`.
**When to use:** Any config-driven component where column identity is only known at runtime (this codebase's entire `EntityConfig` model).
**Why it translates cleanly:** shadcn-svelte's `Table` sub-components accept `HTMLThAttributes`/`HTMLTdAttributes`/`HTMLAttributes<...>` plus a `children` snippet — none of them require a generic type parameter or a compile-time-known column shape. This is the opposite of the TanStack-based Data Table pattern, whose `ColumnDef<TData>[]` requires `TData` to be a concrete, known-at-compile-time row shape (not this codebase's `Row = {id:string} & Record<string, unknown>`).
**Example:**
```svelte
<!-- Source: https://shadcn-svelte.com/registry/styles/nova/table.json, fetched live this session -->
<Table.Root>
  <Table.Header>
    <Table.Row>
      {#each config.listColumns as column}
        <Table.Head>{column}</Table.Head>
      {/each}
      <Table.Head>ações</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#if rowsOf().length === 0}
      <Table.Row data-testid="empty-state">
        <Table.Cell colspan={config.listColumns.length + 1}>Nenhum registro.</Table.Cell>
      </Table.Row>
    {:else}
      {#each rowsOf() as row (row.id)}
        <Table.Row data-testid="row" data-eid={row.id}>
          {#each config.listColumns as column}
            <Table.Cell>
              {#if isBadgeColumn(column)}
                <Badge variant={badgeVariantFor(column, columnValue(row, column))}>
                  {columnValue(row, column)}
                </Badge>
              {:else}
                {columnValue(row, column)}
              {/if}
            </Table.Cell>
          {/each}
          <Table.Cell>
            {#if config.capabilities.update}
              <Button variant="outline" size="sm" data-testid="row-edit" onclick={() => startEdit(row)}>
                editar
              </Button>
            {/if}
            {#if config.capabilities.delete}
              <Button variant="destructive" size="sm" data-testid="row-delete" onclick={() => handleDelete(row)}>
                excluir
              </Button>
            {/if}
          </Table.Cell>
        </Table.Row>
      {/each}
    {/if}
  </Table.Body>
</Table.Root>
```
`data-testid="empty-state"`/`"row"`/`"row-edit"`/`"row-delete"` copied verbatim from `web/src/lib/entities/EntityScreen.svelte` lines 354, 359, 365, 370-373 (read in full this session) — no testid string differs from the current file. `Table.Root`/`Table.Header`/etc. import style shown for clarity; the flat `Table`/`TableHeader`/`TableRow`/`TableHead`/`TableBody`/`TableCell` named exports (from `table/index.ts`) work identically and match the naming ENTTBL-01 uses.

### Pattern 2: Badge variant mapping — column-name allowlist, value-blind

**What:** A single, generic function keyed by column name + `FieldDef.kind`, applied identically across all 9 entities — never a per-entity or per-value switch statement.
```typescript
// Column names treated as Badge-worthy across every entity, cross-referenced
// against ENTTBL-02's own literal examples ("status", "tipoGeracao", "tipoPrazo")
// and ROADMAP Phase 9 SC #2 ("status, tipoGeracao, tipoPrazo, and equivalents").
const BADGE_COLUMN_NAMES = new Set(["status", "tipoGeracao", "tipoPrazo"]);

function isBadgeColumn(columnName: string): boolean {
  const field = config.fields.find((f) => f.name === columnName);
  if (field?.kind === "boolean") return true;
  return BADGE_COLUMN_NAMES.has(columnName);
}

function badgeVariantFor(columnName: string, rawValue: unknown): "secondary" | "outline" {
  const field = config.fields.find((f) => f.name === columnName);
  if (field?.kind === "boolean") return rawValue ? "secondary" : "outline";
  if (columnName === "status") return "secondary";
  // tipoGeracao / tipoPrazo — small closed enum, no inherent severity difference
  // between values (e.g. "hard" vs "soft" is not an error state) — outline
  // visually distinguishes it from the "secondary" status badge.
  return "outline";
}
```
**When to use:** Any `listColumns` entry whose name is in the fixed allowlist, or whose `FieldDef.kind === "boolean"`.
**Rationale for excluding other candidates:** `regraCompetencia` (templatesRotina) is free-form prose ("regra de competência", e.g. a sentence describing a business rule), not a small enum — Badge does not fit unbounded prose text; it stays plain text. `dedupeKey`/`createdAt`/etc. are never enum-like. `destructive` variant is intentionally unused by default — no field in the current 8-entity + 1-log schema represents a genuinely blocked/error state (see Assumptions Log A1); the variant remains available for a future entity that does.
**Example (rendered result per entity, verified from each `defs/*.ts` read this session):**

| Entity | Badge columns | Variant source |
|--------|---------------|-----------------|
| `fundos` | `ativo` (boolean) | secondary (true) / outline (false) |
| `projetos` | `status` (text, free-form) | secondary (all values) |
| `etapas` | `status` (text, free-form) | secondary (all values) |
| `tarefas` | `status` (text, free-form), `tipoPrazo` (select: hard/soft) | secondary / outline |
| `templatesRotina` | `tipoGeracao` (select: du_fixo/corrido_fixo/encadeado), `ativo` (boolean) | outline / secondary-or-outline |
| `instanciasRotina` | `status` (text, free-form) — note `tipoPrazo` here is `kind:"text"`, not `"select"`, but still name-matches the allowlist | secondary / outline (name-matched regardless of kind) |
| `tickets` | `status` (text, free-form), `tipoPrazo` (select: hard/soft) | secondary / outline |
| `subtarefas` | `concluida` (boolean) | secondary (true) / outline (false) |
| `logInferenciaClaude` | none — no listColumn matches the allowlist or is boolean | plain text throughout (correctly stays a pure read-only table) |

### Pattern 3: Row-action `Button` with unchanged capability gating

**What:** Replace `<button type="button" data-testid="row-edit" onclick={...}>editar</button>` with `<Button variant="outline" size="sm" data-testid="row-edit" onclick={...}>editar</Button>` — the `{#if config.capabilities.update}`/`{#if config.capabilities.delete}` guards stay exactly where they are, wrapping the `Button` instead of the `<button>`.
**When to use:** Every row-action and the "novo" create-trigger button.
**Why this preserves capability correctness:** The guard conditions are untouched — only the element inside them changes. `instanciasRotina` (`capabilities.update: true, delete: false`) will render the "editar" `Button` but not "excluir", exactly as today; `logInferenciaClaude` (`create/update/delete` all `false`) will render neither `Button`, and because `mode` can then never become non-null, the `<form>` never renders — this is unaffected by the restyle since the form is untouched. `Button`'s default `type="button"` (confirmed in Phase 8 research) matches the current markup's explicit `type="button"` — no `type="submit"` gotcha applies here (only form-submit buttons, which are Phase 10's territory, need explicit `type="submit"`).

### Anti-Patterns to Avoid

- **Introducing the TanStack-Table-based Data Table pattern:** Adds a dependency and a typed-column layer this app's runtime `config.listColumns: string[]` model cannot cleanly satisfy, for zero required benefit (no sort/filter/pagination requirement). REQUIREMENTS.md explicitly rules this out in its Out of Scope table.
- **Per-entity Badge variant switch statements:** Reintroduces the special-casing the generic `EntityScreen.svelte` was designed to avoid; use the column-name-allowlist function above instead.
- **Inventing status-value-based color logic** (e.g. mapping the free-text string `"concluído"` → green, `"atrasado"` → red): the `status` field's value set is genuinely unbounded free text (CLI help text says so verbatim) with no schema-level enum — hand-rolling keyword-matching business logic to guess severity from arbitrary strings is exactly the kind of "inventar moda" (inventing new UI conventions) PROJECT.md's C-11 rationale explicitly warns against ("não precisa inventar moda no estilo"). Keep `status` badges a single uniform variant.
- **Touching the `<form>` block (lines 391-529) or the script block:** explicitly out of scope per CONTEXT.md's Phase Boundary; any edit there belongs to Phase 10.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Table markup + basic styling (borders, hover row highlight, header weight) | Custom `<table>` CSS | shadcn `Table` component group | `table-row.svelte` already ships `hover:bg-muted/50`, `table.svelte` already ships responsive overflow-x wrapping (`data-slot="table-container"`) — free, no custom CSS needed |
| Status pill/chip styling | Custom `<span class="badge-...">` CSS | shadcn `Badge` | `badge.svelte`'s `tv()` variants already handle border, padding, rounded corners, dark-mode-aware colors via existing CSS tokens (`--secondary`, `--muted`, `--destructive`, `--border` — all confirmed present in `web/src/app.css`) |
| Sortable/filterable/paginated grid | Hand-rolled sort/filter state + pagination controls | Not needed this phase (REQUIREMENTS.md explicitly out of scope) — if a future milestone needs it, shadcn's Data Table pattern + `@tanstack/table-core` is the sanctioned escape hatch, not a hand-rolled solution |

**Key insight:** This phase is a pure visual pass-through over an already-correct, already-generic data/capability model — the entire risk surface is "did every testid and capability guard survive the markup swap," not "does the table need new logic." Resist any temptation to add sorting, filtering, per-value color logic, or column-type inference beyond what's already declared in `EntityConfig`.

## Common Pitfalls

### Pitfall 1: Losing `data-eid`/`data-testid` during the markup swap
**What goes wrong:** `TableRow`/`TableCell`/`TableHead` forward `...restProps`, but a careless refactor could drop `data-eid={row.id}` or rename a testid while "cleaning up" the markup.
**Why it happens:** The swap touches every line of the table markup at once, making it easy to typo or omit an attribute mid-refactor.
**How to avoid:** Diff the restyled block against the original line-by-line; grep the final file for every testid string (`entity-error`, `row`, `row-edit`, `row-delete`, `empty-state`, `entity-create-start`) and confirm each still appears exactly once per its original context before running any test.
**Warning signs:** Existing `entities-*.spec.ts` specs fail on a selector `getByTestId(...)` that used to resolve.

### Pitfall 2: Treating `instanciasRotina.tipoPrazo`'s `kind: "text"` as if it were a `"select"`
**What goes wrong:** Assuming all `tipoPrazo` columns share the same `FieldDef.kind` (they don't — `tarefas`/`tickets` declare it `"select"` with `["hard","soft"]`, `instanciasRotina` declares it `"text"`) could tempt a fix like "normalize the kind" or building `kind`-dependent Badge logic that silently drops the `instanciasRotina.tipoPrazo` Badge.
**Why it happens:** The three `tipoPrazo`-bearing entities look conceptually identical but were defined independently.
**How to avoid:** Use the column-**name** allowlist (Pattern 2) as the primary Badge-worthy signal, not `kind` alone — this makes `instanciasRotina.tipoPrazo` get a Badge regardless of its declared `kind`, matching ROADMAP SC #2's literal example list.
**Warning signs:** A Playwright assertion for "at least one entity with multiple distinct status values visible at once" (SC #2) passes for `tarefas`/`tickets` but silently has no Badge on `instanciasRotina`'s `tipoPrazo` column.

### Pitfall 3: Regressing `instanciasRotina`'s edit-form scope while restyling row actions
**What goes wrong:** `instanciasRotina.capabilities.update` is `true` (not `false`) — so the "editar" row `Button` **does** render (this is correct and matches ROADMAP SC #4's "only a status-changing row action", since the *form* opened by that button is separately narrowed to just the `status` field by `editableFields()`/`updatableFields`, a script-block mechanism this phase does not touch). A plan that reads SC #4 too literally might try to hide the edit button entirely for `instanciasRotina`, which would be a functional regression (it currently opens a status-only edit form) rather than a fix.
**Why it happens:** SC #4's phrasing ("no create action and only a status-changing row action") describes the *net effect* of the edit button (it can only ever change `status`, because the form is pre-narrowed), not a request to relabel or hide the button itself.
**How to avoid:** Verify by reading the pre-restyle behavior first (edit button renders, opens a form containing only the `status` field) and assert the *post-restyle* behavior matches exactly — same button, same narrowed form contents, not a differently-labeled or hidden button.
**Warning signs:** A Playwright test that expects zero row actions on `instanciasRotina` (instead of one narrowed edit action) will fail against both the old and new markup identically — a signal the test itself misread SC #4, not a regression.

## Code Examples

### Table sub-component source (verified, `nova` style — matches `web/components.json`'s pinned style)

```svelte
<!-- Source: https://shadcn-svelte.com/registry/styles/nova/table.json, fetched live via curl this session -->
<!-- table/table.svelte -->
<script lang="ts">
	import { cn, type WithElementRef } from "$UTILS$.js";
	import type { HTMLTableAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLTableAttributes> = $props();
</script>

<div data-slot="table-container" class="relative w-full overflow-x-auto">
	<table bind:this={ref} data-slot="table" class={cn("w-full caption-bottom text-sm", className)} {...restProps}>
		{@render children?.()}
	</table>
</div>
```

```svelte
<!-- table/table-row.svelte -->
<tr bind:this={ref} data-slot="table-row" class={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)} {...restProps}>
	{@render children?.()}
</tr>
```

```typescript
// table/index.ts — exact named exports available for import
export {
	Root, Body, Caption, Cell, Footer, Head, Header, Row,
	//
	Root as Table,
	Body as TableBody,
	Caption as TableCaption,
	Cell as TableCell,
	Footer as TableFooter,
	Head as TableHead,
	Header as TableHeader,
	Row as TableRow,
};
```

### Badge component source (verified, `nova` style)

```svelte
<!-- Source: https://shadcn-svelte.com/registry/styles/nova/badge.json, fetched live via curl this session -->
<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const badgeVariants = tv({
		base: "h-5 gap-1 rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium ... inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap ...",
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
				secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
				destructive: "bg-destructive/10 text-destructive ... dark:bg-destructive/20 ...",
				outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
				ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
				link: "text-primary underline-offset-4 hover:underline",
			},
		},
		defaultVariants: { variant: "default" },
	});
	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "$UTILS$.js";
	import type { HTMLAnchorAttributes } from "svelte/elements";

	let {
		ref = $bindable(null), href, class: className, variant = "default", children, ...restProps
	}: WithElementRef<HTMLAnchorAttributes> & { variant?: BadgeVariant } = $props();
</script>

<svelte:element this={href ? "a" : "span"} bind:this={ref} data-slot="badge" {href} class={cn(badgeVariants({ variant }), className)} {...restProps}>
	{@render children?.()}
</svelte:element>
```

Six variants exist (`default`/`secondary`/`destructive`/`outline`/`ghost`/`link`); this phase's Pattern 2 uses only `secondary` and `outline` by design (see Pattern 2 rationale for why `destructive` stays unused for now).

### Full list-view restyle skeleton

```svelte
<!-- EntityScreen.svelte — script block, form block (lines 1-329, 391-529) UNCHANGED -->
<section>
  <h2>{config.titulo}</h2>

  {#if formError}
    <p data-testid="entity-error">{formError}</p>
  {/if}

  {#if query.isLoading}
    <p>carregando...</p>
  {:else if query.error}
    <p data-testid="entity-error">{query.error.message}</p>
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          {#each config.listColumns as column}
            <TableHead>{column}</TableHead>
          {/each}
          <TableHead>ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if rowsOf().length === 0}
          <TableRow data-testid="empty-state">
            <TableCell colspan={config.listColumns.length + 1}>Nenhum registro.</TableCell>
          </TableRow>
        {:else}
          {#each rowsOf() as row (row.id)}
            <TableRow data-testid="row" data-eid={row.id}>
              {#each config.listColumns as column}
                <TableCell>
                  {#if isBadgeColumn(column)}
                    <Badge variant={badgeVariantFor(column, columnValue(row, column))}>
                      {columnValue(row, column)}
                    </Badge>
                  {:else}
                    {columnValue(row, column)}
                  {/if}
                </TableCell>
              {/each}
              <TableCell>
                {#if config.capabilities.update}
                  <Button variant="outline" size="sm" data-testid="row-edit" onclick={() => startEdit(row)}>
                    editar
                  </Button>
                {/if}
                {#if config.capabilities.delete}
                  <Button variant="destructive" size="sm" data-testid="row-delete" onclick={() => handleDelete(row)}>
                    excluir
                  </Button>
                {/if}
              </TableCell>
            </TableRow>
          {/each}
        {/if}
      </TableBody>
    </Table>

    {#if mode === null && config.capabilities.create}
      <Button type="button" data-testid="entity-create-start" onclick={startCreate}>
        novo
      </Button>
    {/if}

    {#if mode !== null}
      <!-- form block: byte-identical to current EntityScreen.svelte lines 392-528, out of scope -->
    {/if}
  {/if}
</section>
```
`data-testid="entity-error"`/`"empty-state"`/`"row"`/`"row-edit"`/`"row-delete"`/`"entity-create-start"` all copied verbatim from `web/src/lib/entities/EntityScreen.svelte` lines 335, 341, 354, 359, 365, 370-373, 386 (read in full this session).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|----------------|--------|
| Older shadcn-svelte styles/versions wrapping bits-ui primitives even for simple display components | `nova`-style `Table` and `Badge` are plain native-element wrappers, zero bits-ui import | Confirmed live in the currently-installed `1.5.0` CLI's `nova` registry this session (same finding Phase 8 made for `Button`/`Input`/`Card`/`Alert`) | No `asChild`/child-snippet handling needed for either component this phase — purely mechanical restyle |

**Deprecated/outdated:** None specific to this phase — the components fetched this session are the current registry output for the exact style/version already pinned in `web/components.json` (`"style": "nova"`) and `web/package.json` (`shadcn-svelte@^1.5.0`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | `secondary`/`outline` (never `destructive`) is the right default variant pairing for `status`/`tipoGeracao`/`tipoPrazo`/boolean columns, since no field in the current schema represents a genuine error/blocked state | Architecture Patterns: Pattern 2 | Low — purely cosmetic; if a future phase needs a "blocked"/"error" status, `destructive` is already available and no markup restructuring is needed to adopt it later |
| A2 | `regraCompetencia` (templatesRotina) should NOT receive Badge treatment because its values are free-form prose, not a small enum | Architecture Patterns: Pattern 2 | Low — if the planner disagrees and wants it badged anyway, it can be added to `BADGE_COLUMN_NAMES` with no other architectural change; ENTTBL-02 does not name it explicitly (only "e.g. status, tipoGeracao, tipoPrazo") |
| A3 | `Button` `variant="outline"`/`"destructive"` for row-edit/row-delete (chosen for visual distinction, matching the semantic weight of "delete is destructive") is an acceptable discretionary choice, since ENTTBL-01 only requires "row actions... as shadcn Buttons" without naming a variant | Architecture Patterns: Pattern 3, Code Examples | Low — any `Button` variant satisfies ENTTBL-01's literal text; this is a cosmetic choice with no capability or testid impact |
| A4 | Row-edit `Button` size `"sm"` (not default) fits better inside a table cell — `Button`'s exact size-variant option set was not independently re-verified against the live `button.json` registry this session (Phase 8 already confirmed `button.json`'s variant/size shape) | Code Examples | Low — if `size="sm"` is not a valid prop value, `svelte-check`/TypeScript will catch it immediately at plan-execution time, before any test run |

## Open Questions

1. **Should `instanciasRotina`'s `tipoPrazo` column be normalized to `kind: "select"` (matching `tarefas`/`tickets`) as part of this phase, or left as-is?**
   - What we know: `instanciasRotina.tipoPrazo` is declared `kind: "text"` in `web/src/lib/entities/defs/instanciasRotina.ts` (read this session), while `tarefas.tipoPrazo`/`tickets.tipoPrazo` are `kind: "select"` with the same conceptual `["hard","soft"]` domain (`instanciasRotina`'s own field-shape comment cites the same schema row as `tarefas`).
   - What's unclear: Whether this is an intentional divergence (perhaps `instanciasRotina`'s `tipoPrazo` is copied verbatim from its generating template rather than user-selected, so a free-text `kind` was deliberate) or a latent inconsistency.
   - Recommendation: Do not touch `defs/instanciasRotina.ts` this phase — out of scope (no ENTTBL requirement asks for a data-model change), and Pattern 2's name-based allowlist already Badges it correctly regardless of `kind`. Flag for a future phase if the inconsistency ever causes a real bug (it does not affect anything ENTTBL-01/02/03 require).

2. **Does `Badge`'s default `rounded-4xl` (pill) shape read well at this app's table density, or would a plan want a `class` override?**
   - What we know: The live `badgeVariants()` base class includes `rounded-4xl` (fully rounded pill), `h-5` (20px tall) — this is the unmodified default look, consistent with C-11's "no custom color palette / design tokens beyond shadcn-svelte defaults" constraint.
   - What's unclear: Whether a plan/executor would find the pill shape visually cramped inside dense table rows (subjective, no functional impact).
   - Recommendation: Use the unmodified default (no `class` override) — PROJECT.md's C-11 and REQUIREMENTS.md's Out of Scope table are explicit that this milestone uses shadcn-svelte defaults only ("não precisa inventar moda no estilo").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|-----------|
| `bun`/`bunx` | C-08, running `shadcn-svelte add` and Playwright | ✓ | `1.3.12` [VERIFIED: `bun --version`, run this session] | — |
| `node` | tooling scripts | ✓ | `v20.20.2` [VERIFIED: `node -v`, run this session] | — |
| `@playwright/test` | e2e proof of all 4 success criteria | ✓ | `1.62.1` [VERIFIED: `bunx playwright --version`, run this session] | — |
| Network access to `shadcn-svelte.com` registry | `shadcn-svelte add table badge` fetching component source | ✓ | confirmed via direct `curl` to the registry API this session | — |
| Network access to InstantDB (`instantdb.com`) | live query round trips proving row counts/badges/capabilities | ✓ (implied — Phase 7/8's specs already pass live against the hosted app; not independently re-checked this session) | — | — |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** none identified.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `@playwright/test` `^1.62.1` [VERIFIED: `web/package.json` devDependencies, read this session] |
| Config file | `web/playwright.config.ts` (three projects: `setup`, `authed` depends-on `setup`, `anon` with empty storageState) — unchanged this phase, existing convention |
| Quick run command | `bunx playwright test <new-or-touched-spec> --project=authed` |
| Full suite command | `bun run test:e2e` |

### Phase Requirements → Test Map

| Req ID / SC | Behavior | Test Type | Automated Command | File Exists? |
|-------------|-----------|-----------|---------------------|---------------|
| ENTTBL-01 / SC1 | Each of the 9 entity screens renders `role="table"` markup with rows matching the live query result, for at least one entity per capability class | e2e (live, `authed` project) | `bunx playwright test e2e/entities-table-restyle.spec.ts --project=authed` | ❌ Wave 0 — new file (or additive to an existing `entities-*.spec.ts`) |
| ENTTBL-02 / SC2 | `status`/`tipoGeracao`/`tipoPrazo` (and boolean-kind) columns render as `Badge[data-slot="badge"]`, with at least one entity showing 2+ distinct status values simultaneously | e2e (live, same spec) | same command as above | ❌ Wave 0 — same new file |
| ENTTBL-01 / SC3 | Row-level `Button` edit/delete still work: on a full-CRUD entity (`fundos`), the edit path opens and a live delete succeeds | e2e (live, extends existing `entities-fundos.spec.ts` WEB-02 test or a new equivalent) | `bunx playwright test e2e/entities-fundos.spec.ts --project=authed` | ✅ `entities-fundos.spec.ts` already exercises create/edit/delete against the CURRENT plain markup — must keep passing against the restyled markup unchanged (VERIFY-01 territory), plus new Badge/Table-specific assertions |
| ENTTBL-03 / SC4 | `instanciasRotina`: no create action, no delete action, edit action present and its form contains only `status`; `logInferenciaClaude`: zero row actions of any kind | e2e (live, extends `entities-rotina-log.spec.ts` or new spec) | `bunx playwright test e2e/entities-rotina-log.spec.ts --project=authed` | ✅ `entities-rotina-log.spec.ts` exists (covers rotina/log entities per Phase 4/5) — verify it already asserts capability gating; add restyle-specific `Button`/`Table` selector assertions if the existing spec used plain `<button>`/`<table>` selectors that need updating |

### Concrete Playwright Proof Strategy (per additional_context question 5)

- **`role="table"` presence:** `await expect(page.getByRole("table")).toBeVisible()` — no markup change needed; native `<table>` (rendered by `Table.svelte`) has an implicit ARIA role of `table`.
- **Badge rendering, stable selector:** `page.locator('[data-slot="badge"]')` — `data-slot="badge"` is hardcoded in `badge.svelte` (verified in Code Examples above) and is stable across variant/value. For asserting variant, check the rendered class list contains the variant's marker class (e.g. `bg-secondary`/`border-border`) via `await expect(badge).toHaveClass(/bg-secondary/)` or, more robustly, assert `data-slot="badge"` count matches the number of Badge-worthy columns × visible rows.
- **Multiple distinct status values visible at once (SC2):** seed (via CLI, following the existing `phase04-e2e-`/`phase0X-e2e-` prefix + cleanup convention already used in `entities-fundos.spec.ts`) at least two rows on the same entity with different `status` strings, assert both `Badge` texts are simultaneously present in the DOM.
- **Row-action buttons still functioning:** reuse the exact pattern already proven in `entities-fundos.spec.ts`'s `WEB-02` test (create → assert row → edit → assert updated row → delete → assert row gone) — only the selectors' underlying elements change (`Button` instead of `<button>`), the `data-testid`-based Playwright locators (`getByTestId("row-edit")`, etc.) do not need to change at all.
- **Capability-restriction proof (SC4):** `await expect(page.getByTestId("row-edit")).toHaveCount(0)` for `logInferenciaClaude` rows (zero row actions of any kind — no `row-edit`/`row-delete` anywhere), and for `instanciasRotina`: `getByTestId("row-delete")` count 0, `getByTestId("entity-create-start")` count 0 (screen-level, not per-row), `getByTestId("row-edit")` count > 0 and, after clicking it, only `field-status` (or equivalent testid, verify against the live rendered form) is present among `[data-testid^="field-"]` locators.

### Sampling Rate

- **Per task commit:** targeted `bunx playwright test <new-or-touched-spec> --project=authed`.
- **Per wave merge:** `bun run test:e2e` (full suite, all three Playwright projects, live against InstantDB).
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus `bun run check` (svelte-check + tsc) and `bun run lint` (Biome) both clean, zero new suppressions (QUAL-01 applies project-wide even though it's formally scoped to Phase 11).

### Wave 0 Gaps

- [ ] A new or extended e2e spec proving SC1/SC2 (Table role + Badge rendering + row-count-matches-query) across at least one entity per capability class (full-CRUD: `fundos`; restricted create-only/status-only: `instanciasRotina`; read-only: `logInferenciaClaude`).
- [ ] Verify existing `entities-fundos.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-rotina-log.spec.ts`, `entities-ticket-subtarefa.spec.ts` still pass unmodified against the restyled markup (they use `data-testid` locators exclusively, which this phase preserves verbatim — expected to require zero edits, per VERIFY-01's eventual Phase 11 scope, but worth a `bun run test:e2e` full-suite run at this phase's gate too, not deferred entirely).
- [ ] Framework install: none — `@playwright/test` already installed and configured (Phase 6/7).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | no | This phase touches no auth flow — `db.auth.*` calls are untouched, out of file scope |
| V3 Session Management | no | Session storage untouched |
| V4 Access Control | yes (visual-only, no logic change) | `config.capabilities` gating is read, never modified, by this phase — the actual enforcement boundary (`instant.perms.ts`'s `auth.id == data.donoId` rules) is server-side and entirely untouched. This phase's only access-control risk is a *presentation* bug (rendering a `Button` for an action `instant.perms.ts` would reject anyway) — low severity, since the InstantDB-side rule is the real gate regardless of what the UI shows |
| V5 Input Validation | no | No new input surface introduced — Badge/Table render already-validated, already-persisted row data; no new user input path |
| V6 Cryptography | no | No cryptographic code in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Rendering a `Button` for an action the backend would actually reject (e.g. a stray "excluir" button on `instanciasRotina` if a capability guard were dropped during the markup swap) | Elevation of Privilege (UI-only; real enforcement is server-side) | Copy every `{#if config.capabilities.*}` guard verbatim, unchanged position, around the new `Button` elements (Pattern 3) — verified this session that `instant.perms.ts`'s rules are the actual enforcement layer regardless, so a UI-only regression here is a UX bug, not a real privilege escalation, but must still be caught by SC4's Playwright proof |
| XSS via `columnValue()`'s string interpolation into `Badge`/`TableCell` children | Tampering | Unchanged from current behavior — Svelte's default text interpolation (`{columnValue(row, column)}`) is auto-escaped; no `{@html}` introduced anywhere by this restyle |

## Sources

### Primary (HIGH confidence)

- `https://shadcn-svelte.com/registry/styles/nova/table.json` — full `Table` component-group source (8 files), fetched live via `curl` this session [VERIFIED] — identical URL the installed `bunx shadcn-svelte@latest add` CLI resolves against for the `nova` style pinned in `web/components.json`
- `https://shadcn-svelte.com/registry/styles/nova/badge.json` — full `Badge` component source, fetched live via `curl` this session [VERIFIED]
- `bunx shadcn-svelte@latest add --help` — CLI flags confirmed by running the installed binary this session [VERIFIED]
- `npm view shadcn-svelte version`, `npm view tailwind-variants version` — registry versions confirmed this session [VERIFIED]
- `gsd_run query package-legitimacy check --ecosystem npm shadcn-svelte tailwind-variants` — legitimacy verdicts this session [VERIFIED]
- `web/src/lib/entities/EntityScreen.svelte`, `web/src/lib/entities/types.ts`, `web/src/lib/entities/registry.ts`, all 9 `web/src/lib/entities/defs/*.ts` files, `web/src/app.css`, `web/components.json`, `web/package.json`, `web/e2e/entities-fundos.spec.ts` — all read in full this session [VERIFIED]
- `cli/apollo_cli/entities/{projeto,etapa,tarefa,ticket,rotina}.py` — grepped this session confirming `status` fields are documented "free-form" (no enum) [VERIFIED: grep output, this session]
- `.planning/phases/08-auth-shell-restyle/08-RESEARCH.md`, `08-01-SUMMARY.md` — Phase 8 precedent for shadcn-svelte `nova`-style component behavior (no bits-ui wrapping for simple display components, `Button` `type="button"` default) [VERIFIED: read this session]

### Secondary (MEDIUM confidence)

- WebSearch: "shadcn-svelte data table TanStack Table setup guide svelte 5" — confirmed the Data Table pattern requires `@tanstack/table-core` and a `bunx shadcn-svelte@latest add data-table` step distinct from the plain `Table` primitive, corroborating the recommendation against using it this phase [CITED: shadcn-svelte.com/docs/components/data-table, via WebSearch this session]

### Tertiary (LOW confidence)

None — every claim above is either read directly from this session's codebase reads, fetched live from the authoritative registry, or corroborated by an official-docs-citing web search.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new package introduced; both components' exact registry source read live this session, matching the pinned `nova`/`1.5.0` install
- Architecture: HIGH — `EntityScreen.svelte`, `types.ts`, and every `defs/*.ts` file read in full this session; the generic-column argument is a direct structural fact about the existing code, not a projection
- Pitfalls: MEDIUM — the `instanciasRotina.tipoPrazo` kind-inconsistency and SC4 phrasing risk are inferred from reading the code+ROADMAP text carefully, not externally corroborated (no prior incident to cite)

**Research date:** 2026-08-09
**Valid until:** 30 days (stable component APIs; the underlying `EntityConfig`/`EntityScreen.svelte` facts are as stable as the codebase itself and would only go stale if Phase 10 or a later phase changes `types.ts`/`defs/*.ts` shapes first)
