# Stack Research

**Domain:** UI polish / composition conventions for an existing Svelte 5 + Tailwind v4 + shadcn-svelte SaaS-style internal tool
**Researched:** 2026-08-10
**Confidence:** HIGH (Tailwind v4 container/spacing behavior and shadcn-svelte registry contents verified against current official docs; composition conventions are well-established, widely-documented shadcn/ui patterns cross-checked against the shadcn dashboard-01 reference block)

No new npm dependency is introduced anywhere in this document. Every recommendation is either a Tailwind utility class or a `shadcn-svelte add <component>` pull from the same registry v1.1 already used (still zero custom colors/tokens — `app.css`'s default `--radius`/oklch palette is untouched).

## Recommended Stack

### Core Technologies (already in place — used more deliberately, not replaced)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tailwind CSS v4 spacing scale | v4.3.3 (installed) | Consistent gaps/padding/margins | v4's default `--spacing: 0.25rem` base means every numeric utility (`gap-2`, `p-4`, `space-y-6`) is already a multiple of 4px. The codebase currently uses **no spacing utilities at all** on layout containers (`Shell.svelte`, `LoginScreen.svelte`, `EntityScreen.svelte` render bare `<div>`/`<section>`/`<nav>` with zero `gap-*`/`p-*`/`space-y-*`) — this is the single biggest lever for "looks unfinished." |
| Tailwind v4 explicit `max-w-*` + `mx-auto` + responsive `px-*` (NOT the bare `container` utility) | v4.3.3 | Content width / reading measure | Confirmed via Tailwind v4 docs/changelog: v4 dropped the v3 `theme.container` config knob (`center: true`, `padding: '1rem'`) — the bare `container` class today has **no** auto-centering or padding unless you hand-write a `@utility container { margin-inline: auto; padding-inline: 1rem }` block in `app.css`. Writing that CSS would itself start to look like a bespoke token, which this milestone's constraint forbids. **Skip `container` entirely** and just apply `mx-auto max-w-{value} px-4 sm:px-6 lg:px-8` directly on the page wrapper — zero CSS file changes, same visual result. |
| shadcn-svelte "Typography" scale conventions | shadcn-svelte v1.5.0 (installed) | Heading/body text hierarchy | shadcn's own dashboard reference (`dashboard-01` block) and Typography docs establish a small, consistent scale: page title `text-2xl font-semibold tracking-tight` (optionally `lg:text-3xl`), section/card title `text-lg font-semibold` (this is what `Card.Title` already renders — currently unused in the codebase's raw `<h2>{config.titulo}</h2>`), supporting text `text-sm text-muted-foreground`, table meta/caption `text-sm text-muted-foreground`. None of this needs new CSS — it's Tailwind utility classes on existing elements. |

### Supporting Components to Install (already published in the shadcn-svelte registry — zero new npm packages)

| Component | Registry command | Purpose | When to Use |
|-----------|-------------------|---------|-------------|
| `Skeleton` | `bunx shadcn-svelte@latest add skeleton` | Loading placeholder that matches real content shape | Replace the bare `<p>carregando...</p>` in `EntityScreen.svelte`'s `query.isLoading` branch with a stack of `<Skeleton class="h-8 w-full" />` rows shaped like the table (header row + 3-5 body rows), and a `Skeleton h-8 w-48` for the page title area if the auth/user state is still resolving in `Shell.svelte`. Table/page-shaped loading, not spinners — reserve the spinner (`LoaderCircle` + `animate-spin`, already used correctly) for inline button-level async actions (submit, send-code), which is the correct existing pattern and should NOT change. |
| `Empty` | `bunx shadcn-svelte@latest add empty` | Structured empty-state block (`Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`) | Replace the current empty-state `<TableCell>Nenhum registro.</TableCell>` row with a proper empty state rendered *outside* the table (or spanning it) — icon + title ("Nenhum registro ainda") + description + a primary "novo" CTA reusing the existing `startCreate` handler. This turns an empty table from "looks broken" into "looks like a designed first-run state." |
| `Separator` | already installed | Visual/semantic section dividers | Already in `web/src/lib/components/ui/separator` but **not used anywhere in the 3 target screens**. Use `<Separator />` under the `Shell.svelte` nav bar, between the page-header block and the table in `EntityScreen.svelte`, and inside `Dialog.Content` between the form fields and the footer action row. |
| `Field` | `bunx shadcn-svelte@latest add field` | Structured form-field wrapper (`Field`, `FieldLabel`, `FieldDescription`, `FieldError`) with built-in consistent label/control/error spacing | Optional but high-leverage: `EntityScreen.svelte`'s form currently wraps every input as a bare `<div><Label/><Input/></div>` with no gap between label and control and no consistent inter-field spacing. Swapping to `Field`/`FieldLabel` gives every field the same vertical rhythm for free, still zero new dependency (same registry, same install mechanism as everything already in the project). If adopting `Field` is judged too invasive for this milestone's diff size, the manual fallback below (`space-y-2` per field, `space-y-4`/`grid gap-4` for the field list) achieves the same visual result with pure utilities. |
| `Breadcrumb` | `bunx shadcn-svelte@latest add breadcrumb` | Location/hierarchy indicator | **Not recommended for this milestone.** The app has a single flat level of navigation (login → shell tab bar → one active entity), so a breadcrumb trail has nothing meaningful to show and would be pure decoration. Revisit only if the panel/dashboard milestone (out of scope) introduces nested drill-down views. |
| `Spinner` | `bunx shadcn-svelte@latest add spinner` | Standardized loading spinner primitive | Not required — the codebase's existing pattern (`@lucide/svelte/icons/loader-circle` + `class="size-4 animate-spin"` inside `Button`) already achieves the same visual result and is used consistently in both `LoginScreen.svelte` buttons. Do not introduce a second spinner convention; only pull this in if a future phase needs a spinner outside of a `Button` context and wants to avoid re-deriving the animation classes by hand. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `bunx shadcn-svelte@latest add <component>` | Pull additional registry components without touching `package.json` dependencies directly | Registry components are copied into `web/src/lib/components/ui/<name>` as plain `.svelte` files (same as the 15 already vendored) — they compile to Tailwind utility classes only, no runtime package added beyond what `bits-ui`/`tailwind-variants` already provide. Confirms the "shadcn-svelte defaults, no new library" constraint is satisfiable even when adding `Skeleton`/`Empty`/`Field`. |

## Installation

```bash
# From web/, using the same install path v1.1 already used for every other primitive
bunx shadcn-svelte@latest add skeleton
bunx shadcn-svelte@latest add empty
bunx shadcn-svelte@latest add field   # optional — see Field row above

# Separator is already installed (web/src/lib/components/ui/separator exists) — no action needed
```

No `bun add` / npm install of any kind is needed — these are registry-sourced `.svelte` files, not npm packages.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Explicit `max-w-{n} mx-auto px-4 sm:px-6 lg:px-8` on page wrapper | Bare `container` utility class | Never for this project — v4's `container` has no default centering/padding without a hand-written `@utility container` override in `app.css`, which would itself read as a bespoke token change. |
| `Skeleton` rows shaped like the real table | Full-page spinner overlay during `query.isLoading` | If a future screen's load time is trivial (<100ms) and a skeleton would just flash — not the case here since InstantDB queries are already the slowest thing on these screens. |
| `Empty` component | Plain centered `<p>` text for empty state | Acceptable minimal fallback if the milestone's scope is trimmed further, but loses the "looks like a designed state" benefit for near-zero extra effort since `Empty` is already a one-command install. |
| Utility-only `space-y-2` per form field | `Field`/`FieldLabel` component | Use plain utilities if the diff for swapping every field's markup in `EntityScreen.svelte` is judged too large for this milestone; utilities get 90% of the visual benefit with a much smaller patch. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Bare `container` class assuming v3 centering behavior | Silently renders full-bleed/unpadded in Tailwind v4 without a CSS override — a common "why does this look wrong" trap when porting v3 muscle memory | `mx-auto max-w-{n} px-4 sm:px-6 lg:px-8` directly on the wrapper |
| Ad-hoc one-off margin utilities (`mt-3`, `mb-5`, `ml-2` scattered per element) to fake spacing | Produces inconsistent, hard-to-audit rhythm — exactly the "components checklist, not composition" problem this milestone exists to fix | Parent-level `space-y-{n}` / `gap-{n}` on a flex or grid container, chosen from a small fixed set (2, 4, 6, 8) so the whole app reads from one scale |
| Introducing a second spinner/loading convention (e.g. the new `Spinner` component) alongside the existing `LoaderCircle animate-spin` pattern | Two different loading visuals for the same concept reads as inconsistent, the opposite of "polished" | Keep `LoaderCircle` + `animate-spin` for inline button loading (already correct); add `Skeleton` only for content-shaped page/table loading (a different use case, not a replacement) |
| Custom CSS in `app.css` for spacing/typography/container behavior | Violates this milestone's explicit "no custom design tokens" constraint and duplicates what Tailwind utilities already do declaratively in markup | Compose everything from existing utility classes on the `.svelte` files themselves |
| `window.confirm()` for destructive actions (pre-existing, logged as v1.1 tech debt) | Native browser dialogs cannot be styled and break visual consistency with the rest of a "polished SaaS" UI | Out of scope for this milestone per PROJECT.md, but worth flagging again since it directly undermines the "polished" goal — `AlertDialog` (already shadcn-svelte registry, not installed) is the natural fix whenever it is scheduled |

## Stack Patterns by Variant

**If composing `Shell.svelte` (app shell / nav):**
- Header row: `flex items-center justify-between gap-4 px-4 py-3 sm:px-6` (or `h-14`/`h-16` fixed height bar) — email/user info on one side (`text-sm text-muted-foreground`), "Sair" button on the other.
- Nav row: `flex items-center gap-1 px-4 sm:px-6` (tabs), immediately followed by `<Separator />` before the active `EntityScreen`.
- Main content region: `mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8` wrapping the `{#key ativo}` block — this single wrapper is what turns "content touching the viewport edge" into "content with breathing room," and is the highest-value single change in the whole milestone.
- Active-tab styling already correct (`variant={ativo === cfg.etype ? "secondary" : "ghost"}`) — just add `transition-colors` is unnecessary since `Button`'s own variants already include it; no change needed there.

**If composing `EntityScreen.svelte` (page header + toolbar + table + empty + dialog form):**
- Page header block: `flex items-center justify-between gap-4` wrapping a `space-y-1` div (`<h2 class="text-2xl font-semibold tracking-tight">{config.titulo}</h2>` + optional `<p class="text-sm text-muted-foreground">` record-count/description) on the left, and the "novo" `Button` on the right — this is the standard shadcn dashboard-01 page-header shape (title+description stacked, primary action right-aligned).
- Wrap the whole screen body in `space-y-6` (header → table → dialog trigger) instead of unspaced sibling elements.
- Table: no structural change needed (shadcn `Table` already ships row hover, border, and padding) — just right-align the actions column with `text-right` on that `TableHead`/`TableCell` pair and use `whitespace-nowrap` plus `gap-2` between the "editar"/"excluir" buttons (currently unwrapped adjacent buttons with no gap).
- Empty state: replace the `<TableCell>Nenhum registro.</TableCell>` row with an `Empty` block rendered in place of the table (or via `colspan` if kept inside `TableBody`) — icon, title, description, and a CTA button calling the existing `startCreate()`.
- Dialog form: wrap the field list in `grid gap-4 py-4` (standard shadcn Dialog form spacing — matches the “dashboard-01”/shadcn Dialog example convention), each field's `<div>` becomes `space-y-2` (label-to-control gap), and add a `Dialog.Footer` (or a `flex justify-end gap-2` div if this shadcn-svelte version's `Dialog` namespace lacks `Footer`) wrapping the submit/cancel buttons instead of leaving them as bare inline siblings.

**If composing `LoginScreen.svelte` (single centered card):**
- Outer wrapper: `flex min-h-screen items-center justify-center p-4` (centers the card both axes, matches the near-universal shadcn auth-screen pattern).
- Card width: `w-full max-w-sm` (not `max-w-lg`/`max-w-xl` — auth cards read as more polished narrow; shadcn's own login block examples use `sm:max-w-sm`).
- Internal spacing: `CardContent` wrapped content as `space-y-4` (form fields) with the submit button's `LoaderCircle` + label already using `gap-2` inside `Button` — verify that gap exists (`Button`'s default slot handles icon+text gap automatically in shadcn-svelte's `Button`, no action needed).
- Step transition (email → code): no animation needed for this milestone (would require extra work with no new library benefit) — just ensure consistent `space-y-4` inside both `{#if step === "email"}` / `{:else}` branches.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `shadcn-svelte@1.5.0` registry additions (`skeleton`, `empty`, `field`, `separator`) | `tailwindcss@4.3.3` + `bits-ui@2.16.3` (already installed) | All registry components target the same Tailwind v4 / bits-ui v2 combination already pinned in `web/package.json`; no version bump required for any existing dependency to add these components. |
| Tailwind v4 `max-w-*`/`space-y-*`/`gap-*` utilities | `@tailwindcss/vite@4.3.3` (already installed) | Pure utility classes, no plugin or config changes needed — works immediately with the existing Vite plugin setup in `web/vite.config.ts`. |

## Sources

- https://www.shadcn-svelte.com/docs/components — confirmed current registry contents (Skeleton, Empty, Breadcrumb, Separator, Field, Spinner, Item, etc. all present as of this milestone), HIGH confidence (official docs)
- https://github.com/tailwindlabs/tailwindcss/discussions/14801 and https://github.com/tailwindlabs/tailwindcss/discussions/15429 — confirmed Tailwind v4 dropped the v3 `theme.container` JS config in favor of a manual `@utility container` CSS override; bare `container` has no default centering/padding in v4, HIGH confidence (official maintainer discussion threads)
- shadcn/ui `dashboard-01` reference block conventions (page header shape, `gap-4 py-4` / `md:gap-6 md:py-6` spacing rhythm, `px-4 lg:px-6` content padding, `max-w-7xl mx-auto` container pattern) — MEDIUM-HIGH confidence (well-established, widely mirrored community convention derived from the official shadcn/ui blocks library; shadcn-svelte ports the same block set)
- Direct read of `web/src/lib/Shell.svelte`, `web/src/lib/auth/LoginScreen.svelte`, `web/src/lib/entities/EntityScreen.svelte`, `web/components.json`, `web/src/app.css` — HIGH confidence (verified current state of the actual codebase this research targets: confirmed zero spacing/layout utilities currently applied, confirmed `Separator` already installed but unused, confirmed default `--radius`/oklch neutral tokens untouched)

---
*Stack research for: UI polish conventions (spacing/typography/layout) for existing shadcn-svelte SPA*
*Researched: 2026-08-10*
