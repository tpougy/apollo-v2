# Phase 9: Entity Table Restyle - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 1 modified file (`EntityScreen.svelte`), 9 entity def files read for data (no changes needed there)
**Analogs found:** 1 self-analog (exact) / 1 total target file; shadcn `Table`/`Badge` primitives NOT YET installed in this repo (must be added via `bunx shadcn-svelte add table badge` before restyle)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|------------------|----------------|
| `web/src/lib/entities/EntityScreen.svelte` (table/rows/actions/empty-state section only, lines 343–383, plus the `entity-create-start` button at 385–389) | component (data table + row actions) | CRUD (client-side InstantDB reactive query, no pagination/streaming) | itself — no other table exists in the codebase yet; button styling analog is `web/src/lib/components/ui/button` (already added Phase 8) | exact (self) for markup to preserve; role-match only for Button/Badge primitives (net-new to this repo) |

There is only one table in the whole app (`EntityScreen.svelte` is the generic renderer for all 9 entities), so there is no second existing table to copy from. The planner should treat the **current markup itself** as the pattern to preserve structurally, while swapping tag-for-component per the shadcn Table/Badge primitives once added.

## Pattern Assignments

### `web/src/lib/entities/EntityScreen.svelte` (component, CRUD)

**Analog:** itself (current lines 343–389) — this is what must be reproduced 1:1 in testid/behavior terms, restyled with shadcn primitives.

**Current exact markup to restyle** (lines 343–389, verbatim from file):
```svelte
<table>
  <thead>
    <tr>
      {#each config.listColumns as column}
        <th>{column}</th>
      {/each}
      <th>ações</th>
    </tr>
  </thead>
  <tbody>
    {#if rowsOf().length === 0}
      <tr data-testid="empty-state">
        <td colspan={config.listColumns.length + 1}>Nenhum registro.</td>
      </tr>
    {:else}
      {#each rowsOf() as row (row.id)}
        <tr data-testid="row" data-eid={row.id}>
          {#each config.listColumns as column}
            <td>{columnValue(row, column)}</td>
          {/each}
          <td>
            {#if config.capabilities.update}
              <button type="button" data-testid="row-edit" onclick={() => startEdit(row)}>
                editar
              </button>
            {/if}
            {#if config.capabilities.delete}
              <button
                type="button"
                data-testid="row-delete"
                onclick={() => handleDelete(row)}
              >
                excluir
              </button>
            {/if}
          </td>
        </tr>
      {/each}
    {/if}
  </tbody>
</table>

{#if mode === null && config.capabilities.create}
  <button type="button" data-testid="entity-create-start" onclick={startCreate}>
    novo
  </button>
{/if}
```

**Restyle mapping (tag → shadcn component), preserving every attribute/testid/binding verbatim:**

| Current tag | Target shadcn-svelte component | Notes |
|---|---|---|
| `<table>` | `<Table.Root>` | from `$lib/components/ui/table` (add via `bunx shadcn-svelte add table`) |
| `<thead><tr>` | `<Table.Header><Table.Row>` | |
| `<th>{column}</th>` | `<Table.Head>{column}</Table.Head>` | keep `{#each config.listColumns as column}` loop unchanged |
| `<tbody>` | `<Table.Body>` | |
| `<tr data-testid="empty-state">` | `<Table.Row data-testid="empty-state">` | **must keep `data-testid="empty-state"` on the row itself** — e2e asserts `page.getByTestId("empty-state")` directly (see e2e pattern below) |
| `<td colspan={...}>` | `<Table.Cell colspan={...}>` | |
| `<tr data-testid="row" data-eid={row.id}>` | `<Table.Row data-testid="row" data-eid={row.id}>` | **both `data-testid="row"` and `data-eid` are load-bearing** — e2e filters `page.getByTestId("row").filter({ hasText: nome })` and reads `getAttribute("data-eid")` |
| `<td>{columnValue(row, column)}</td>` | `<Table.Cell>{columnValue(row, column)}</Table.Cell>` OR `<Table.Cell><Badge variant={...}>{columnValue(row, column)}</Badge></Table.Cell>` for status-like columns (see classification below) | Badge wrapping is ENTTBL-02's scope; add via `bunx shadcn-svelte add badge` |
| row-actions `<td>` | `<Table.Cell>` | inner buttons become `<Button variant="outline" size="sm" data-testid="row-edit" onclick={...}>editar</Button>` and `<Button variant="destructive" size="sm" data-testid="row-delete" onclick={...}>excluir</Button>` — **keep `data-testid` and `onclick` handler wiring byte-for-byte**, only the wrapping element/styling changes |
| `entity-create-start` `<button>` | `<Button data-testid="entity-create-start" onclick={startCreate}>novo</Button>` | import from `web/src/lib/components/ui/button` — this is the one already-added component in the repo (Phase 8), so its import/usage pattern is the concrete analog for every Button conversion in this phase |

**Existing Button import/usage analog** (Phase 8, already in repo — read `web/src/lib/components/ui/button/index.ts` if deeper API detail is needed; the convention across the app so far is a plain named import):
```svelte
import { Button } from "$lib/components/ui/button";
...
<Button variant="outline" onclick={...}>label</Button>
```

**`columnValue()` helper (lines 102–115) — do not change signature or return type.** It returns a plain `string` for every column kind (boolean → "sim"/"não", date → ISO date slice, link → linked label, else → `String(raw)`). Badge wrapping happens at the call site in the template (`<Table.Cell><Badge>{columnValue(row, column)}</Badge></Table.Cell>`), not inside the helper — the helper's job (stringifying) does not change.

---

## Entity Capabilities and listColumns (all 9 entities — concrete data, verified by reading each `defs/*.ts`)

| Entity (`etype`) | `capabilities` | `updatableFields` | `listColumns` (in order) | Status/enum-like Badge candidates |
|---|---|---|---|---|
| `fundos` | `{create:true, update:true, delete:true}` | — | `["nome", "codigo", "ativo", "createdAt"]` | `ativo` (boolean — "sim"/"não"; Badge optional per column, e.g. green/gray variant) |
| `projetos` | `{create:true, update:true, delete:true}` | — | `["nome", "status", "fundo", "dataInicioPrevista", "dataFimPrevista"]` | `status` (free-text field, no fixed enum in FieldDef — still a natural Badge candidate since it's semantically a status column) |
| `etapas` | `{create:true, update:true, delete:true}` | — | `["ordem", "nome", "status", "projeto"]` | `status` (same free-text status column) |
| `tarefas` | `{create:true, update:true, delete:true}` | — | `["titulo", "status", "tipoPrazo", "dataPrevista", "etapa"]` | `status` (free-text) and `tipoPrazo` (true enum, `kind: "select"`, `options: ["hard", "soft"]`) |
| `templatesRotina` | `{create:true, update:true, delete:true}` | — | `["nome", "tipoGeracao", "offsetDias", "ativo", "fundo", "antecessor"]` | `tipoGeracao` (true enum, `kind: "select"`, `options: ["du_fixo", "corrido_fixo", "encadeado"]`) and `ativo` (boolean) |
| `instanciasRotina` | `{create:false, update:true, delete:false}` | `["status"]` | `["competencia", "dataPrevista", "status", "tipoPrazo"]` | `status` (free-text) and `tipoPrazo` (free-text, NOT `select` here — unlike tarefas/tickets it is `kind: "text"` in this def); update-only via `status` field, no create/delete buttons should render at all |
| `tickets` | `{create:true, update:true, delete:true}` | — | `["titulo", "remetente", "status", "tipoPrazo", "dataRecebimento", "fundo"]` | `status` (free-text) and `tipoPrazo` (true enum, `kind: "select"`, `options: ["hard", "soft"]`) |
| `subtarefas` | `{create:true, update:true, delete:true}` | — | `["ordem", "titulo", "concluida", "tarefa", "ticket"]` | `concluida` (boolean — "sim"/"não") |
| `logInferenciaClaude` | `{create:false, update:false, delete:false}` | — | `["createdAt", "entidadeTipo", "campo", "valorInferido"]` | none obviously status-like; `entidadeTipo` is free-text but low cardinality — Claude's discretion whether to Badge it. **Zero row actions and zero create button must render** — pure read-only table, no `<form>` ever shows since `mode` can never leave `null` |

**Key facts for capability-preservation (SC #4):**
- `instanciasRotina`: `capabilities.create === false` and `capabilities.delete === false` → the `entity-create-start` button and `row-delete` button must NOT render for this entity after restyle (same `{#if config.capabilities.create}` / `{#if config.capabilities.delete}` guards, unchanged). Only `row-edit` renders (`update: true`), and the edit form it opens is narrowed to the `status` field only via `updatableFields` — that narrowing logic lives in `editableFields()` (lines 89–94), untouched by this phase (form is out of scope per CONTEXT.md's Phase Boundary).
- `logInferenciaClaude`: all three capabilities `false` → after restyle, no `entity-create-start`, no `row-edit`, no `row-delete` should ever appear for this entity, and `mode` never becomes non-null so no `<form>` renders. The table itself (rows + columns) is the only UI surface.
- No `FieldDef.kind === "boolean"` field is ever a true enum with more than 2 states; `columnValue()` already normalizes them to the literal strings `"sim"`/`"não"` — a Badge wrapping these two literal strings is straightforward (e.g., variant keyed off the raw boolean, not the string).
- True `select`-kind enum fields across all entities: `tarefas.tipoPrazo` (`["hard","soft"]`), `tickets.tipoPrazo` (`["hard","soft"]`), `templatesRotina.tipoGeracao` (`["du_fixo","corrido_fixo","encadeado"]`). These are the strongest Badge candidates since their value set is closed and known at compile time (could map to fixed Badge variants per option).
- `status` columns across `projetos`, `etapas`, `tarefas`, `instanciasRotina`, `tickets` are all `kind: "text"` (free-form, not `select`) — Badge-wrapping these is a purely visual choice (e.g., a generic neutral Badge) since there's no fixed variant-per-value mapping available from the type system. Do not attempt to hardcode a status→variant map unless a fixed value set is confirmed elsewhere; default to a single consistent Badge style for all free-text status values.

## Shared Patterns

### Button (already established, Phase 8)
**Source:** `web/src/lib/components/ui/button` (added by shadcn-svelte CLI in a prior phase)
**Apply to:** `entity-create-start`, `row-edit`, `row-delete` buttons
```svelte
import { Button } from "$lib/components/ui/button";
<Button data-testid="..." onclick={...}>label</Button>
```
Preserve every `data-testid` and every `onclick` handler exactly; only swap the raw `<button type="button">` tag for `<Button>`.

### Table (net-new this phase)
**Source:** none in-repo yet — must run `bunx shadcn-svelte add table` first (per C-08, bun/bunx only). Once added, `web/src/lib/components/ui/table/index.ts` exposes `Table.Root`, `Table.Header`, `Table.Body`, `Table.Row`, `Table.Head`, `Table.Cell` (standard shadcn-svelte table primitive names) for the planner to reference directly.
**Apply to:** the single `<table>` in `EntityScreen.svelte`.

### Badge (net-new this phase)
**Source:** none in-repo yet — must run `bunx shadcn-svelte add badge` first. Exposes `Badge` component with a `variant` prop (`default`/`secondary`/`destructive`/`outline` typical for shadcn presets).
**Apply to:** status/enum-like `<td>` values per the table above, wrapping the existing `columnValue(row, column)` string return.

## E2E Test Assertion Patterns That Must Keep Passing

**Source:** `web/e2e/entities-fundos.spec.ts` (representative — same testid contract used by other `entities-*.spec.ts` files per entity)

The following testid-based assertions are load-bearing and must resolve to the same DOM structure after restyle (element tag can change, `data-testid`/`data-eid` attributes and their placement cannot):

```typescript
// row lookup + filter by text content (line 79, 129, 140, 161, 179)
await expect(page.getByTestId("row").filter({ hasText: nome })).toBeVisible();

// data-eid read off the row element itself (lines 131-132)
const eid = await row.getAttribute("data-eid");

// row-scoped action buttons — getByTestId scoped to a specific row locator (lines 136, 166)
await row.getByTestId("row-edit").click();
await reloadedRow.getByTestId("row-delete").click();

// create button (line 119)
await page.getByTestId("entity-create-start").click();

// empty-state visibility (line 194)
await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: RESYNC_TIMEOUT });

// zero-row-count assertions after delete (lines 85-87, 167-169, 179-181)
await expect(page.getByTestId("row").filter({ hasText: nomeEditado })).toHaveCount(0, { timeout: RESYNC_TIMEOUT });

// field-level testids inside the form (out of scope this phase, but co-located — do not break)
await page.getByTestId("field-nome").fill(nome);
```

**Implication for the restyle:** `data-testid="row"` must remain on the row-level element (`<tr>`/`<Table.Row>`), not on a wrapping `<td>`/`<Table.Cell>`, because `row.getByTestId("row-edit")` and `.getAttribute("data-eid")` are called on the row locator. Likewise `data-testid="empty-state"` must stay on the row-level element (it currently colspans the row), not move to an inner `<td>`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| shadcn `Table` primitive usage | component | CRUD | Not yet added to `web/src/lib/components/ui/`; no existing table in the codebase to copy composition from — plan must run `bunx shadcn-svelte add table` as a setup step before restyling |
| shadcn `Badge` primitive usage | component | display/transform | Same — not yet added; run `bunx shadcn-svelte add badge` as a setup step |

## Metadata

**Analog search scope:** `web/src/lib/entities/`, `web/src/lib/components/ui/`, `web/e2e/`
**Files scanned:** `EntityScreen.svelte`, `types.ts`, `registry.ts`, all 9 `defs/*.ts`, `entities-fundos.spec.ts`, `web/src/lib/components/ui/` directory listing
**Pattern extraction date:** 2026-08-09
</content>
