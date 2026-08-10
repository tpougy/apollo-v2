
# Phase 14: Entity Screen — Header, Loading & Empty States - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 1 modified (+ 2 new shadcn-svelte component installs)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `web/src/lib/entities/EntityScreen.svelte` (modified — list-view markup only, lines 382–460) | component | request-response (InstantDB live query render) | itself (prior structure) + `web/src/lib/Shell.svelte` (header/toolbar composition) + `web/src/lib/auth/LoginScreen.svelte` (Card composition) | role-match (composition idiom), no true "entity list header" analog exists yet |
| `web/src/lib/components/ui/skeleton/*` (new install, `bunx shadcn-svelte add skeleton`) | component (shadcn primitive) | n/a | none installed yet | no analog — first use in repo |
| `web/src/lib/components/ui/empty/*` (new install, `bunx shadcn-svelte add empty`) | component (shadcn primitive) | n/a | none installed yet | no analog — first use in repo |

**Component-install status (checked directly in `web/src/lib/components/ui/`):**
- `Skeleton` — **NOT installed**. Must run `bunx shadcn-svelte add skeleton` before use.
- `Empty` — **NOT installed**. Must run `bunx shadcn-svelte add empty` before use.
- `Card` — **already installed**, full sub-part set present: `web/src/lib/components/ui/card/{card,card-header,card-title,card-description,card-content,card-footer,card-action}.svelte`, barrel-exported from `web/src/lib/components/ui/card/index.ts` as `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction`. No install step needed — just import and use, matching `LoginScreen.svelte`'s existing usage.

## Current EntityScreen.svelte List-View Structure (exact, pre-change)

File: `web/src/lib/entities/EntityScreen.svelte`. The entire list-view template is one `<section>` block, lines 382–460 (form/Dialog internals below that, lines 462–674, are Phase 15 scope — do not touch).

```
382  <section>
383    <h2>{config.titulo}</h2>                          ← "header" today: bare h2, no description, no action
385-390  {#if formError} ... Alert ... {/if}             ← shared error alert (data-testid="entity-error")
392-393  {#if query.isLoading}
           <p>carregando...</p>                          ← LOADING BRANCH (line 393) — plain text, replace with Skeleton
394-398  {:else if query.error}
           ... Alert ... AlertDescription data-testid="entity-error" ...
399-455  {:else}                                          ← MAIN BRANCH START (line 399)
400-408    <Table><TableHeader><TableRow>
             {#each config.listColumns as column} <TableHead> ... {/each}
             <TableHead>ações</TableHead>
409-453    <TableBody>
410-413      {#if rowsOf().length === 0}
               <TableRow data-testid="empty-state">      ← EMPTY BRANCH (lines 410-413) — single <TableCell> text
                 <TableCell colspan={...}>Nenhum registro.</TableCell>
414-452      {:else}
               {#each rowsOf() as row (row.id)}
                 <TableRow data-testid="row" data-eid={row.id}> ... row-edit / row-delete Buttons ...
454        </Table>                                       ← TABLE ends here, currently NOT wrapped in any bounding container
456-460    {#if mode === null && config.capabilities.create}
             <Button data-testid="entity-create-start" onclick={startCreate}>novo</Button>
           {/if}                                          ← CREATE ACTION today: BELOW the table — must move into header row
462+       <Dialog.Root> ... (Phase 15 scope, do not touch)
676  </section>
```

**Precise blast-radius notes:**
- The `{#if query.isLoading} / {:else if query.error} / {:else}` three-way branch (lines 392–399) is the single control-flow structure that gates the entire list view + dialog. The new Skeleton must replace only the `<p>carregando...</p>` (line 393) content — do not restructure the branch itself.
- The empty-state `<TableRow data-testid="empty-state">` (lines 410–413) is nested **inside `<TableBody>`, inside `<Table>`**. Per CONTEXT.md's explicit pitfall, the new `Empty` composition must NOT be nested inside `<tbody>`/`<TableRow>`/`<TableCell>` — it must become a **sibling to `<Table>`**, conditionally rendered instead of `<Table>` when `rowsOf().length === 0`, not inside it. This means restructuring the conditional from "always render Table, conditionally render an empty row inside tbody" to "conditionally render Table OR Empty as siblings inside the bounding Card/container."
- `data-testid="empty-state"` must be preserved verbatim but will move from a `<TableRow>` to whatever root element wraps the new `Empty` composition (likely the `Empty` root itself, e.g. `<Empty data-testid="empty-state">`).
- `data-testid="entity-create-start"` (line 457, currently a `<Button>` below the table) must be preserved verbatim but relocated up into the new header row's right-aligned primary action slot, AND reused as the `Empty` state's CTA per CONTEXT.md ("reusing the existing `startCreate` handler"). This implies **two `Button`s with the same handler** (`startCreate`) may both exist in different states — header CTA always visible when `capabilities.create`, Empty-state CTA only visible when the list is empty AND `capabilities.create`. If both are literally present in the DOM at once (header) that's fine — the empty-state CTA is inside the `{:else}` main branch's now-conditional Table/Empty fork, and `data-testid="entity-create-start"` must stay unique (count == 1) per the Playwright-strict-mode pitfall — do NOT duplicate the same testid onto both header and Empty CTA buttons simultaneously. Recommendation surfaced to planner: keep `entity-create-start` on exactly one button (the header one, since it's always present when `capabilities.create` and simplest to keep unique), and give the Empty CTA a distinct or no separate testid, OR keep the below-table button removed entirely and only the header button carries this testid — final call is the planner/implementer's, but the uniqueness constraint is non-negotiable.
- `data-testid="row"`, `row-edit`, `row-delete` are inside the row-rendering `{#each}` (lines 415–451) — entirely untouched by this phase (Phase 16 scope for row actions), but wrapping the `<Table>` in a `Card`/border container must not add any wrapper `<div>` between `<TableBody>` and `<TableRow data-testid="row">` — wrap outside `<Table>`, not inside.
- The `<h2>{config.titulo}</h2>` (line 383) is the only current "header" content. `config.titulo` is already available; there is no `config.description` field today (checked `types.ts` — not present), so a "short description" per CONTEXT.md must either be omitted (title only) or the planner should check `types.ts`/`registry.ts` field for something description-like before inventing new config schema. Flagging this as a planning decision point, not resolved by this pattern map.

## Pattern Assignments

### `web/src/lib/entities/EntityScreen.svelte` — header row (component, request-response)

**Analog:** `web/src/lib/Shell.svelte` lines 51–77 (header/toolbar composition idiom) — this is the closest existing "title + right-aligned action row" pattern in the codebase, even though it's a page-level header rather than entity-level.

**Header composition pattern to copy** (`web/src/lib/Shell.svelte:51-77`):
```svelte
<header
  data-testid="shell-header"
  class="flex items-center justify-between gap-4 px-4 py-3 sm:px-6"
>
  <h1 data-testid="shell-app-name" class="text-lg font-semibold">Apollo v2</h1>
  <div class="flex items-center gap-4">
    <!-- ... right-aligned content (status text + action Button) ... -->
    <Button type="button" variant="outline" data-testid="logout" onclick={...}>
      Sair
    </Button>
  </div>
</header>
```
Apply the same `flex items-center justify-between gap-4` idiom to EntityScreen's new header row: `config.titulo` (+ optional description) on the left, the relocated `data-testid="entity-create-start"` primary `Button` right-aligned via the same wrapping `<div>` pattern, gated by `config.capabilities.create` exactly as the current below-table `{#if mode === null && config.capabilities.create}` guard already does (lines 456–460) — do not change that gating condition, only its position and container.

**Bounding container pattern to copy** (`web/src/lib/auth/LoginScreen.svelte` Card usage, and `web/src/lib/components/ui/card/index.ts` exports):
```svelte
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
...
<Card class="w-full max-w-sm">
  <CardHeader>
    <CardTitle>Entrar</CardTitle>
    <CardDescription>...</CardDescription>
  </CardHeader>
  <CardContent>
    ...
  </CardContent>
</Card>
```
For EntityScreen's table-bounding requirement, the closest-fit usage is `Card` + `CardContent` wrapping the `<Table>` only (not the whole `<section>`, since the header row and error Alert should stay outside per Shell's "single outer frame" ownership rule — Shell already owns page-level framing; EntityScreen's Card here is a plain bounding/border container around the table specifically, matching FEATURES.md's "table wrapped in a bounding Card/border" item). `CardHeader`/`CardTitle` are optional for this use (the header row above already carries the title) — a plain `<Card><CardContent>...</CardContent></Card>` wrap around `<Table>` is the minimal correct pattern; do not duplicate `config.titulo` inside a `CardTitle` as well.

**Loading branch replacement** (currently `web/src/lib/entities/EntityScreen.svelte:393`, `<p>carregando...</p>`):

No existing Skeleton usage anywhere in the repo (first install). Per shadcn-svelte's documented API (referenced in RESEARCH.md/STACK.md), the standard shape for a table-loading skeleton is repeated `Skeleton` bars matching row/column count, e.g.:
```svelte
import { Skeleton } from "$lib/components/ui/skeleton";
...
<div class="space-y-2">
  {#each Array(5) as _, i (i)}
    <Skeleton class="h-8 w-full" />
  {/each}
</div>
```
Shape it against `config.listColumns.length` (columns) and a fixed small row count (e.g. 5) to read as "content-shaped," per CONTEXT.md's requirement. Place this inside the same position currently occupied by `<p>carregando...</p>` — i.e., still inside the `{#if query.isLoading}` branch of the existing three-way conditional, still inside the bounding Card, so the loading skeleton appears where the table will appear once loaded (avoids layout jump).

**Empty branch replacement** (currently `web/src/lib/entities/EntityScreen.svelte:410-413`, nested `<TableRow data-testid="empty-state">` inside `<tbody>`):

No existing Empty usage anywhere in the repo (first install). Per shadcn-svelte's documented API, standard composition:
```svelte
import * as Empty from "$lib/components/ui/empty";
...
<Empty.Root data-testid="empty-state">
  <Empty.Header>
    <Empty.Media variant="icon"><SomeIcon /></Empty.Media>
    <Empty.Title>Nenhum registro</Empty.Title>
    <Empty.Description>Comece criando o primeiro registro de {config.titulo}.</Empty.Description>
  </Empty.Header>
  {#if config.capabilities.create}
    <Empty.Content>
      <Button type="button" onclick={startCreate}>novo</Button>
    </Empty.Content>
  {/if}
</Empty.Root>
```
Must be restructured as a **sibling to `<Table>`**, not nested inside `<tbody>`: i.e., the `{#if rowsOf().length === 0} ... {:else} <Table>...</Table> {/if}` fork happens at the `<Table>` level (inside the bounding Card's `CardContent`), replacing the current fork that happens inside `<TableBody>`. `TableHeader` (column headings) should arguably still not render when the state is empty — confirm against existing e2e specs (`entities-table-restyle.spec.ts` et al.) for what they assert on the empty state; this pattern map flags this as an exact-DOM-shape decision for the planner, since specs may specifically check for `data-testid="empty-state"` presence/absence of table headers.

## Shared Patterns

### Alert / error pattern (unchanged, reference only)
**Source:** `web/src/lib/entities/EntityScreen.svelte:385-390` and `:394-398`
**Apply to:** No change needed this phase — the `Alert`/`AlertDescription data-testid="entity-error"` pattern stays exactly as-is; do not touch it while restructuring the surrounding branches.
```svelte
<Alert variant="destructive">
  <CircleAlert class="size-4" />
  <AlertDescription data-testid="entity-error">{formError}</AlertDescription>
</Alert>
```

### Card composition (from LoginScreen.svelte, already installed)
**Source:** `web/src/lib/components/ui/card/index.ts`, used in `web/src/lib/auth/LoginScreen.svelte:6-12,78-...`
**Apply to:** `EntityScreen.svelte`'s new table-bounding container. `Card`/`CardContent` sub-parts already exist — no install step, just import from `$lib/components/ui/card`.

### Header row flex idiom (from Shell.svelte)
**Source:** `web/src/lib/Shell.svelte:51-54` (`class="flex items-center justify-between gap-4 px-4 py-3 sm:px-6"`)
**Apply to:** EntityScreen's new title+description+action header row — reuse the same `flex items-center justify-between gap-*` idiom for visual consistency between Shell's page-level header and EntityScreen's entity-level header, per CONTEXT.md's "coherent, careful design language" requirement. Padding values may differ (EntityScreen's header sits inside Shell's already-padded `<main>` content frame, so likely no extra `px-*`/`py-*` needed — only `gap-*`/`space-y-*` for internal rhythm) — do not duplicate Shell's outer padding.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `web/src/lib/components/ui/skeleton/*` | component | n/a | Not yet installed anywhere in repo; first use — follow shadcn-svelte's official Skeleton doc API (see RESEARCH.md STACK.md sources) rather than an internal analog |
| `web/src/lib/components/ui/empty/*` | component | n/a | Not yet installed anywhere in repo; first use — follow shadcn-svelte's official Empty doc API (see RESEARCH.md STACK.md sources) rather than an internal analog |

## Metadata

**Analog search scope:** `web/src/lib/entities/`, `web/src/lib/`, `web/src/lib/auth/`, `web/src/lib/components/ui/`
**Files scanned:** `EntityScreen.svelte`, `Shell.svelte`, `LoginScreen.svelte`, `web/src/lib/entities/types.ts` (checked for `description` field — absent), `web/src/lib/components/ui/card/*`, directory listing of `web/src/lib/components/ui/`
**Pattern extraction date:** 2026-08-10
