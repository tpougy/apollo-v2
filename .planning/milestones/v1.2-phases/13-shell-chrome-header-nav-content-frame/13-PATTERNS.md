# Phase 13: Shell Chrome — Header, Nav & Content Frame - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 1 (modify) + 1 (verify-only, may need selector-adjacent read)
**Analogs found:** 1 / 1 (self-analog: `LoginScreen.svelte` supplies the composition idiom already used elsewhere in this codebase for the equivalent "page chrome" concern)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `web/src/lib/Shell.svelte` | component (layout/shell) | request-response (renders auth/session state + static nav) | `web/src/lib/auth/LoginScreen.svelte` (composition idiom: shadcn primitives + wrapper spacing) and its own current markup (structural in-place refactor) | role-match |
| `web/e2e/shell-nav.spec.ts` | test | request-response (Playwright assertions) | itself — read-only reference, not expected to change unless `<h2>`/testid structure moves | n/a (verify existing contract, no analog needed) |

Only one file is actually created/modified in this phase: `web/src/lib/Shell.svelte`. `shell-nav.spec.ts` is listed because its assertions constrain the refactor (see Shared Patterns / Constraints below) but CONTEXT.md explicitly says Phase 13 should not need to touch it.

## Pattern Assignments

### `web/src/lib/Shell.svelte` (component, request-response)

**Current full content is the "before" — this is an in-place structural refactor, not a from-scratch build.** Current file (`web/src/lib/Shell.svelte` lines 1-90):

```svelte
<div data-testid="routine-job-state" data-job-state={jobState} hidden></div>

{#if !auth.isLoading && auth.user}
  <p>autenticado como {auth.user.email}</p>
{/if}
<Button type="button" variant="outline" data-testid="logout" onclick={...}>Sair</Button>

<nav class="flex gap-2">
  {#each entityConfigs as cfg (cfg.etype)}
    <Button
      type="button"
      variant={ativo === cfg.etype ? "secondary" : "ghost"}
      data-testid={`nav-${cfg.etype}`}
      aria-current={ativo === cfg.etype}
      onclick={() => (ativo = cfg.etype)}
    >
      {cfg.titulo}
    </Button>
  {/each}
</nav>

{#key ativo}
  {@const active = configByEtype(ativo)}
  {#if active}
    <EntityScreen config={active} />
  {/if}
{/key}
```

No shadcn `Card`/`Separator`/header-row composition exists in this file today — the only in-codebase precedent for "wrap raw elements in a composed shadcn layout with rhythm" is `LoginScreen.svelte`. Use it as the idiom reference, not a literal template (Login is a centered card; Shell is a full-width toolbar+nav+frame).

**Imports pattern to add** (model on `LoginScreen.svelte` lines 1-16 — same `$lib/components/ui/*` aliasing convention):
```typescript
import { Separator } from "$lib/components/ui/separator";
```
Current Shell imports already include `Button` from `$lib/components/ui/button` (line 4) — keep that import, just add `Separator`. No new npm dependency; `Separator` is pre-installed at `web/src/lib/components/ui/separator` (confirmed unused anywhere in the app before this phase).

**Toolbar/header composition pattern** (model on `LoginScreen.svelte`'s flex/spacing idiom, lines 71-86, adapted to a horizontal toolbar per STACK.md's "Stack Patterns by Variant → Shell.svelte" guidance):
```svelte
<!-- LoginScreen's outer wrapper idiom: fixed positioning class + flex + padding -->
<div
  data-testid="login-screen"
  class="fixed inset-0 flex items-center justify-center overflow-y-auto bg-background p-4"
>
```
Adapt (not copy) to Shell's header row shape:
```svelte
<header class="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
  {#if !auth.isLoading && auth.user}
    <p class="text-sm text-muted-foreground">autenticado como {auth.user.email}</p>
  {/if}
  <Button type="button" variant="outline" data-testid="logout" onclick={...}>Sair</Button>
</header>
<Separator />
```
Critical: keep `data-testid="logout"` on the `Button` element itself, unchanged — only the surrounding `<header>` wrapper is new (Architecture research: "adding a wrapping `<div>`/`<header>`/`<nav class=...>` around them is safe as long as the `Button` elements themselves keep their testid props untouched").

**Content-frame wrapper pattern** (ARCHITECTURE.md Pattern 1 — the single highest-leverage change in this phase; illustrative snippet already given in ARCHITECTURE.md lines 118-129):
```svelte
<div class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
  <nav class="flex flex-wrap gap-2">
    {#each entityConfigs as cfg (cfg.etype)}
      <Button ... data-testid={`nav-${cfg.etype}`} aria-current={ativo === cfg.etype} ...>
        {cfg.titulo}
      </Button>
    {/each}
  </nav>

  {#key ativo}
    {@const active = configByEtype(ativo)}
    {#if active}
      <EntityScreen config={active} />
    {/if}
  {/key}
</div>
<!-- outer content frame — do not duplicate padding inside EntityScreen -->
```
Note CONTEXT.md's locked decision: nav row uses `flex flex-wrap gap-*` (no `Tabs`, no scroll container) — this supersedes ARCHITECTURE.md's illustrative `flex gap-2` (add `flex-wrap`).

**Error handling pattern:** N/A — this file has no data mutation of its own; the only async operation (`db.auth.signOut()` in the `logout` handler, and the routine job `onMount`) already has try/catch (lines 24-45, 57-64) and must be preserved verbatim — do not touch this logic, only the surrounding markup/classes.

**No validation pattern applies** — Shell has no form.

---

## Shared Patterns

### Testid preservation (structural constraint, not a copy-source but mandatory)
**Source:** `web/e2e/shell-nav.spec.ts` (all 3 tests) + `web/src/lib/Shell.svelte` current testids
**Apply to:** Every edit to `Shell.svelte`
Must remain unchanged and unique (count === 1, or count === 9 for nav):
- `data-testid="logout"` on the Sair `Button` (`shell-nav.spec.ts` line 69)
- `data-testid={`nav-${cfg.etype}`}` on each nav `Button`, exactly 9 total (`shell-nav.spec.ts` lines 17-19)
- `aria-current={ativo === cfg.etype}` on each nav `Button` — `shell-nav.spec.ts` line 38/44-49 asserts exactly one `[aria-current="true"]` at a time and that its testid matches the just-clicked button
- The active nav `Button`'s computed background-color must differ from an inactive one (line 54-59) — this is driven by the existing `variant={ativo === cfg.etype ? "secondary" : "ghost"}` prop, already correct; do not change the `variant` binding logic, only the wrapping container classes
- `page.locator("h2")` (line 25) reads text from **inside `EntityScreen.svelte`**, not `Shell.svelte` — Phase 13 must not touch that `<h2>`; confirmed out of scope here (it lives at `EntityScreen.svelte` line 383, Phase 14's concern)
- `data-testid="app-shell"` lives in `App.svelte`, wrapping `<Shell/>` — not inside `Shell.svelte`; do not add a duplicate

### Separator usage
**Source:** `web/src/lib/components/ui/separator/separator.svelte` (full file, 24 lines, reproduced above)
**Apply to:** `Shell.svelte`, between the new header/toolbar row and the nav+content region
Import as `import { Separator } from "$lib/components/ui/separator";` (barrel export confirmed via `index.ts` in the same directory) and render `<Separator />` as a plain sibling — it renders a full-width `h-px` divider by default (`data-orientation=horizontal` is bits-ui's default), no props required for the toolbar/nav split described in CONTEXT.md.

### Tailwind v4 container convention
**Source:** STACK.md / ARCHITECTURE.md (research, not codebase — no existing analog in the 3 target files predates this pattern)
**Apply to:** The one outer content-frame wrapper in `Shell.svelte`
Never use the bare `container` class (no-op in Tailwind v4 without a hand-written `@utility container` override, which would violate the "no custom CSS/tokens" constraint). Use explicit `mx-auto max-w-6xl px-4 sm:px-6 lg:px-8` (sanity-check `max-w-6xl` against the widest entity table's column count per CONTEXT.md, but no codebase analog table-width exists to compare against yet — defer to visual check during execution).

### Import ordering / path-alias convention
**Source:** `web/src/lib/auth/LoginScreen.svelte` lines 1-16, `web/src/lib/entities/EntityScreen.svelte` lines 1-19
**Apply to:** Any new import line added to `Shell.svelte`
Imports are alphabetized within groups: external packages first (`@lucide/svelte/icons/*`, `svelte-sonner`), then `$lib/components/ui/*` (also alphabetized by component name), then relative/local imports (`./db`, `./entities/...`). New `Separator` import should slot alphabetically among existing `$lib/components/ui/*` imports (after `button`, matching existing `Shell.svelte` import block at lines 1-8 which already has `Button` before `db`/`EntityScreen`/`registry`/`routineJob`).

## No Analog Found

None — Shell.svelte itself is the only file to modify, and its composition idiom is directly informed by `LoginScreen.svelte`'s already-executed Phase 12 pattern (shadcn Card/spacing primitives layered onto previously-bare markup) plus explicit research guidance (STACK.md/ARCHITECTURE.md) since no other file in the codebase has this exact "toolbar + nav + content-frame" shape yet.

## Metadata

**Analog search scope:** `web/src/lib/` (Shell.svelte, auth/LoginScreen.svelte, entities/EntityScreen.svelte), `web/src/lib/components/ui/separator/`, `web/e2e/shell-nav.spec.ts`
**Files scanned:** 5
**Pattern extraction date:** 2026-08-10
