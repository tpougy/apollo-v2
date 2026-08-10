# Feature Research

**Domain:** SaaS UI polish / composition for a single-user internal data-entry tool (tables + forms + magic-code auth), shadcn-svelte primitives only
**Researched:** 2026-08-10
**Confidence:** HIGH for code-grounded findings (verified against `web/src/lib/{App,Shell,auth/LoginScreen,entities/EntityScreen}.svelte` and the installed `web/src/lib/components/ui/*` sources); MEDIUM for general "what reads as SaaS" conventions (web-search consensus, no single canonical spec — this is inherently a taste/convention question, not a factual one)

## Research note on the Reddit source

The milestone context pointed at `reddit.com/r/AgentContext_dev/comments/1vddlso/...` (curated UI-focused agent skills) as a starting point. Both direct fetch (`WebFetch` — blocked, Reddit is unreachable by this tool) and web search for the thread's content came back empty (search surfaced only unrelated "awesome-agent-skills" repo lists, not this specific post's contents). **The thread could not be read.** Per the milestone's own instruction ("do not adopt anything requiring a new library given the shadcn-svelte-only constraint"), this is a low-cost miss: the constraint means only shadcn-svelte's own component catalog is actionable anyway, and that catalog was fetched directly and is the basis for everything below. If the user has the thread content already open on their end, it's worth a 2-minute skim for composition ideas, but it should not block scoping this milestone.

## Current-state baseline (why this is a "components checklist," concretely)

Direct code read confirms the milestone framing precisely:

- `App.svelte` has a bare `<h1>Apollo v2</h1>` at document root (renders even above the login card, outside both signed-in/signed-out branches) — no shell container, no centering wrapper anywhere in the app.
- `Shell.svelte` renders "autenticado como {email}", a raw `<Button>Sair</Button>`, and a `<nav class="flex gap-2">` of 9 plain `Button` toggles — no header bar, no grouping, no icons, no overflow handling for 9 items.
- `EntityScreen.svelte`'s page top is a bare `<h2>{config.titulo}</h2>` — no description, no right-aligned primary action (the "novo" button sits *below* the table instead of in a header).
- Loading state is literally the text `carregando...`; empty state is a single `<TableCell>Nenhum registro.</TableCell>` — both are text-only, no `Skeleton`/`Empty` composition.
- The create/edit `Dialog.Content` form is a flat sequence of `<div><Label>...<Input>...</div>` blocks with **zero spacing utilities** between them — `Dialog.Description`, `Dialog.Footer`, and `Field`/`FieldGroup` are all either already-installed-but-unused (`Dialog.Description`, `Dialog.Footer` exist in `ui/dialog/index.ts` right now) or a one-command CLI add away (`Field`).
- Submit button in `EntityScreen.svelte` has **no busy/spinner state** during `db.transact`, unlike `LoginScreen.svelte` which already has this pattern (`ocupado` + `LoaderCircle`) — an internal inconsistency, not just a missing feature.
- `LoginScreen.svelte`'s `Card` has **no `CardHeader`/`CardTitle`/`CardDescription`** at all — it's `Card > CardContent` only, straight into the form.
- Delete uses native `window.confirm()` (already flagged as tech debt in `PROJECT.md`) — this alone is one of the fastest ways an internal tool visually announces itself as unfinished.
- `app.css` already ships the full `--sidebar-*` OKLCH token set from shadcn-svelte's init output, unused — a `Sidebar` component (if ever wanted) would need zero new theming work, just markup.

This baseline matters for scoping: almost everything below is "use a primitive/prop that is already installed or a one-line CLI add away, and actually wire it up" — not "build new components."

## Feature Landscape

### Table Stakes (Users Expect These)

The line between "checklist" and "finished SaaS" for a tables+forms+auth internal tool is almost entirely here — none of these require new libraries, and every row below reuses `EntityScreen.svelte`/`Shell.svelte`/`LoginScreen.svelte` as the single point of change (config-driven reuse across all 9 entities holds).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **[Shell] App container + content max-width** | Every real SaaS app bounds content width and centers/pads it; edge-to-edge raw text reads as a prototype. | LOW | Wrap `Shell.svelte`'s content in a container (`mx-auto max-w-6xl px-6 py-8` or similar spacing scale) — no new component, pure Tailwind on existing markup. |
| **[Shell] Header bar with app identity + user/logout area** | Users expect a persistent top bar separating "where am I" from content, not a floating logout button and stray `<h1>`. | LOW–MEDIUM | Move `Apollo v2` heading into `Shell.svelte`'s header row, right-align the auth email + logout; use `Separator` (already installed) under it. |
| **[Shell] Nav with a real active-state indicator + icon per entity** | 9 flat destinations read as a tab bar; users expect one visually obvious "you are here," ideally icon + label pairing common to every SaaS side/top nav. | LOW–MEDIUM | Current `variant={active ? "secondary" : "ghost"}` swap is a reasonable start but weak/inconsistent visually at 9 items wrapped in a flex row; add `@lucide/svelte` icons per entity (already a dependency) and a bottom-border/background active affordance. |
| **[Shell] Nav overflow strategy for 9 items** | An unbounded `flex gap-2` of 9 buttons will wrap unpredictably on any narrower viewport — reads broken, not "polished." | LOW | Either a horizontal scroll container (`overflow-x-auto` + `flex-nowrap`) or shadcn `Tabs` (installable, no new lib) with the same button labels. |
| **[Table] Page header per entity: title + description + primary action row** | The single most common SaaS convention — every list page top has a title/subtitle on the left and the primary "Create" action top-right, not buried below the table. | LOW | `EntityScreen.svelte`: replace bare `<h2>` with a flex row (`justify-between items-start`) containing title + a one-line description slot, and move the existing "novo" `Button` there. |
| **[Table] Loading state via `Skeleton`** | Text "carregando..." reads unfinished; skeleton rows matching the real column count is the universal SaaS loading convention for tables. | LOW | `bunx shadcn-svelte add skeleton`; render `config.listColumns.length + 1` skeleton cells per row, 3–5 placeholder rows, in place of the current `<p>carregando...</p>`. |
| **[Table] Empty state via `Empty`** | A single text cell ("Nenhum registro.") in a table is the #1 "this is a checklist demo" tell; the SaaS convention is icon + title + short description + (optional) the same primary action from the header. | LOW–MEDIUM | `bunx shadcn-svelte add empty`; swap the current `TableRow`/`TableCell` empty branch for `Empty.Root > Empty.Header (Empty.Media + Empty.Title + Empty.Description) > Empty.Content` with a "Criar" button reusing `startCreate`. |
| **[Table] Table wrapped in a bounding container (`Card` or bordered div)** | Bare `<Table>` floating in page flow with no visual boundary looks unfinished next to a header + actions row; SaaS list views almost universally frame the table in a card/border. | LOW | `Card` is already installed; wrap the existing `Table` in `Card > CardContent` (or a plain `rounded-lg border` div, cheaper) — no structural change to table internals. |
| **[Table] Row hover feedback** | Table rows that don't visually respond to hover feel static/dead, not interactive. | **Already done** | Confirmed in `ui/table/table-row.svelte`: `hover:bg-muted/50` ships by default in the installed shadcn-svelte `Table`. Zero work — just don't lose it in any future custom row markup. |
| **[Table] `AlertDialog` replacing `window.confirm()` for delete** | A native browser `confirm()` popup is the single starkest "this isn't a real product" signal possible — every polished SaaS app uses an in-app confirm dialog with product styling. | LOW–MEDIUM | `bunx shadcn-svelte add alert-dialog`; swap `handleDelete`'s `window.confirm` for `AlertDialog.Root/Trigger/Content/Action/Cancel`, one small per-row state addition in `EntityScreen.svelte`. Already flagged as tech debt in `PROJECT.md` — this milestone is the natural place to close it. |
| **[Form] `Field`/`FieldGroup`/`FieldLabel`/`FieldDescription` for form composition** | Flat `<div><Label><Input></div>` blocks with no spacing between them is the literal definition of "components checklist, not composition"; consistent field spacing/grouping is what makes a form *read* considered. | MEDIUM | `bunx shadcn-svelte add field`; wrap each field-rendering branch in `EntityScreen.svelte`'s form loop with `Field.Field`/`Field.Label`/`Field.Description` (for the handful of non-obvious fields, e.g. `dedupeKey`-adjacent or xorLink fields) inside one `Field.Group`. Touches the single generic form-rendering block — applies to all 9 entities at once. |
| **[Form] `Dialog.Description` under `Dialog.Title`** | Users expect a one-line "what is this dialog for" under the title, especially for less-obvious entities (e.g. `templatesRotina`, `logInferenciaClaude`). | LOW | Already installed, unused. One line per dialog open. |
| **[Form] `Dialog.Footer` for action buttons** | Submit/cancel floating inline at the end of a field list (no visual separation) reads unfinished; the SaaS convention is a footer row, often with a top border, primary action right-aligned. | LOW | Already installed, unused — wrap the existing `Button type="submit"` + `Button variant="ghost"` (cancel) pair in `Dialog.Footer` instead of leaving them as trailing form children. |
| **[Form] Busy/spinner state on dialog submit** | `LoginScreen.svelte` already has this (`ocupado` + `LoaderCircle`); `EntityScreen.svelte`'s submit has none — an inconsistency a user will notice once one screen has it and others don't. | LOW | Reuse the exact `LoaderCircle class="size-4 animate-spin"` + `disabled` pattern already proven in `LoginScreen.svelte`; add one `$state<boolean>` around the existing `handleSubmit`'s `await db.transact(...)`. |
| **[Form] Required-field visual indicator** | Fields already carry `required={f.required}` at the HTML level but give no visual cue until an invalid-submit error fires; SaaS forms conventionally mark required fields (asterisk or "(obrigatório)" in `FieldDescription`). | LOW | Cosmetic addition inside the same `Field.Label` render, driven by data already on `config.fields[].required` — no new state. |
| **[Login] `CardHeader`/`CardTitle`/`CardDescription` on the login card** | A card with zero header — straight into a form — is the single clearest "unstyled prototype" tell on a login screen; virtually every real product's login card has an app name/title + one-line description above the form. | LOW | `CardHeader`/`CardTitle`/`CardDescription` are standard `Card` sub-parts, already installed as part of `ui/card`; add "Entrar no Apollo" + a one-line description, replacing the stray `<h1>` currently living outside the card in `App.svelte`. |
| **[Login] Full-viewport centered layout** | `LoginScreen.svelte` has no wrapper providing vertical centering — currently whatever `App.svelte`'s default flow gives it. Every SaaS login screen centers the card in the viewport. | LOW | One wrapper div (`min-h-svh flex items-center justify-center`) around the existing `Card` in `LoginScreen.svelte` — no internal change to the two-step form logic. |

### Differentiators (Nice-to-Have — Real Value, Not Required)

Worth doing if time allows within this milestone's scope, but the product doesn't feel broken without them. All are shadcn-svelte-native and installable via its own CLI.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **User menu (`Avatar` + `DropdownMenu`) instead of a raw logout button** | Reads more "product," less "debug button," for the auth-email + logout affordance in `Shell.svelte`. | LOW–MEDIUM | `bunx shadcn-svelte add avatar dropdown-menu`; low value for a single named user, but cheap and visually strong in the header. |
| **`Tooltip` on icon-only or ambiguous action buttons** | If row actions are ever compacted to icon-only buttons (see anti-feature below on kebab menus), a tooltip prevents ambiguity. | LOW | Only relevant if icon-only buttons are adopted; skip if labels ("editar"/"excluir") stay as text. |
| **Column alignment conventions (numbers/dates right or consistently aligned, text left)** | Slightly denser, more "data-tool-professional" table read; currently every column is left-aligned regardless of type. | LOW–MEDIUM | Needs a `field.kind`-driven alignment class in `columnValue`'s render path — touches the one generic table-cell renderer, so it's cheap to apply everywhere at once, but requires deciding a convention per `kind` (date/number/boolean/badge/text). |
| **Consistent icon-per-entity in both nav and page header** | Small but real "considered product" signal — icons already used elsewhere (`CalendarIcon`, `CircleAlert`, `LoaderCircle`) via `@lucide/svelte`, so this is just extending an existing pattern to `entityConfigs`. | LOW | Requires picking one lucide icon per of the 9 entity configs — a content decision, not a technical one. |
| **`Tabs` component formalizing the entity switcher** | Slightly more "this is a designed navigation system" than a `flex` row of `Button`s, and solves overflow (see table-stakes nav-overflow row) in one primitive. | MEDIUM | Would replace `Shell.svelte`'s `<nav>` block; functionally equivalent to the table-stakes nav-overflow fix, just via a named component instead of raw flex/scroll — pick one, not both. |
| **`Sidebar` component as a full left-nav shell** | The single most "textbook SaaS" layout shape; tokens are already in `app.css` (`--sidebar-*`), unused. | HIGH | See Anti-Features — flagged there as likely not worth it *for this milestone specifically*, but listed here because it is a legitimate, zero-new-dependency upgrade path if a future milestone wants it. |

### Anti-Features (Would Look Like Effort, Not Worth It Here)

| Feature | Why It's Tempting | Why Problematic for This Project | Alternative |
|---------|--------------------|-----------------------------------|-------------|
| **Full collapsible/floating `Sidebar` (offcanvas, icon-collapse modes)** | It's *the* canonical "real SaaS" shape and shadcn-svelte ships it fully, tokens even pre-seeded. | High setup cost (`Provider` → `Root` → `Content` → `Group` → `Menu` → `MenuItem` → `MenuButton`) for what is a flat, fixed, 9-item list with no sub-navigation, no collapse need (single desktop user, no mobile use case in scope) — pure structural churn against a "polish, don't restructure" milestone. | Polish the existing horizontal nav (active state + icons + overflow handling, both already table-stakes above). Revisit `Sidebar` only if a future milestone adds real hierarchy (e.g., the deferred dashboard/panel). |
| **Breadcrumb trail** | Common "professional SaaS" signal in generic advice. | This app has no route hierarchy at all — it's flat tab-switching between 9 top-level entity screens, no drill-down/detail pages exist. A breadcrumb here would show a single, static, non-clickable crumb — pure decoration with nothing to communicate. | Skip entirely; the page-header title (table stakes above) already answers "where am I." Reconsider only if a future entity-detail view introduces real nesting. |
| **Kebab/`DropdownMenu` for row actions** | Looks denser/more "enterprise table" than two inline buttons. | Only 2 possible actions per row (edit/delete), and not every entity has both (`config.capabilities`); collapsing 2 buttons into a menu adds a click and a new interaction pattern for no density win at this action count. | Keep the current two inline `Button`s (`sm`, `outline`/`destructive`) — already a reasonable, unambiguous pattern; just make sure they render consistently sized/aligned. |
| **Command palette (Cmd+K)** | High "polished app" signal in general SaaS advice, easy to over-index on given the reddit-thread pointer toward general SaaS/agent-UI conventions. | Real feature-build complexity (global keybinding, fuzzy search index across 9 entity types) for a single named user who already knows exactly which of 9 fixed tabs they want — solves a discoverability problem that doesn't exist here. | Not in scope; the nav polish above already makes all 9 destinations visible at all times. |
| **TanStack-style advanced data table (sorting/filtering/column visibility/pagination)** | "Real SaaS tables always have this" is a common reflex. | This milestone is explicitly visual/compositional, not data-shape; current row counts are small (single-user controladoria data), and adding sort/filter state is a functional feature, not polish — risks scope creep into "new domain functionality," which is explicitly out of scope this milestone. | Keep the plain `Table` primitive; if row counts grow large enough to need this later, that's a phase-specific research flag for a future milestone, not v1.2. |
| **Bespoke illustrations/logo/brand palette for empty states or login** | Tempting once you're already touching `Empty`/`Card` composition — "while I'm here, make it look distinctive." | User explicitly said "sem originalidade" (no custom/original styling) and the LOCKED constraint (C-11) forbids any custom color palette or design tokens beyond shadcn-svelte's default. Any bespoke visual asset work directly violates both. | Use `Empty.Media variant="icon"` with a stock `@lucide/svelte` icon (already the icon library) and neutral copy — zero new visual assets. |
| **Manual dark-mode toggle / `mode-watcher` reintroduction** | Common "polish" request in generic SaaS checklists. | Already explicitly LOCKED out (C-11): dark mode is `prefers-color-scheme`-only, and `mode-watcher` was deliberately removed in v1.1 (Sonner was hand-installed specifically to avoid reintroducing it). Reopening this is out of bounds for this milestone. | No action — leave as-is. |
| **Multi-step animated login wizard (progress bar, step transitions)** | The 2-step (email → code) flow is a natural fit for "wizard" styling seen in consumer SaaS onboarding. | Only 2 steps, single-user, no abandonment/analytics concern — a progress indicator or animated transition is complexity for a flow that's already fast and clear once given `CardHeader` + spacing (table stakes above). | Keep the existing `{#if step === "email"}...{:else}...{/if}` conditional block; just apply the same `Field`/spacing polish to both branches. |

## Feature Dependencies

```
[Form] Field/FieldGroup adoption
    └──requires──> `bunx shadcn-svelte add field` (new primitive, zero new deps)

[Table] Empty state via `Empty`
    └──enhances──> [Table] Page header primary action (Empty.Content's CTA reuses the same `startCreate` handler as the header button)

[Table] AlertDialog delete confirm
    └──requires──> `bunx shadcn-svelte add alert-dialog`
    └──conflicts with──> nothing; drop-in replacement for `window.confirm()` in `handleDelete`, no other change needed

[Shell] Nav active-state + icons
    └──enhances──> [Shell] Nav overflow strategy (icons alone don't fix wrapping; pick one overflow approach — scroll container or `Tabs` — and apply icons on top of it)

[Differentiator] Tabs component for entity switcher
    └──conflicts with──> [Table stakes] plain flex/scroll nav overflow fix (pick one mechanism, not both — they solve the same problem)

[Anti-feature] Full Sidebar shell
    └──requires──> would obsolete/replace [Shell] header+nav table-stakes work above if ever adopted (don't build both in the same milestone)

[Login] CardHeader/CardTitle
    └──requires──> removing the stray `<h1>Apollo v2</h1>` from `App.svelte` (currently the only "app title" anywhere) — these two changes should land together to avoid a duplicate/orphaned title
```

### Dependency Notes

- **Empty state enhances Page header:** once the header carries the primary "novo" action, the `Empty` component's own CTA button should call the *same* `startCreate` function rather than duplicating logic — one behavior, two entry points, both already exist in `EntityScreen.svelte`.
- **Nav active-state enhances Nav overflow:** doing icons/active-styling without first deciding the overflow mechanism (scroll vs. `Tabs`) means redoing the markup twice. Decide overflow approach first.
- **Tabs conflicts with flex/scroll nav fix:** these are two different technical solutions to the identical problem (9 items, no overflow handling) — implement exactly one.
- **Sidebar conflicts with Shell header+nav polish:** these are alternative shell shapes (top-nav vs. left-nav). Building both in one milestone means throwing away the top-nav polish work; pick one shape before starting Shell work. Given this milestone's "polish, don't restructure" framing and the Anti-Features reasoning above, top-nav polish is the recommended shape for v1.2.
- **Login CardHeader requires removing the stray `<h1>`:** `App.svelte`'s `<h1>Apollo v2</h1>` currently renders unconditionally (both signed-in and signed-out). Moving app identity into `LoginScreen`'s `CardHeader` (signed-out) and `Shell`'s header bar (signed-in) makes the top-level `<h1>` redundant — remove it as part of this work, don't leave both.

## MVP Definition

Given this is a single, bounded polish milestone (not an incremental product), "MVP" here means: the minimum set that actually earns "reads as a finished SaaS product" per the milestone's own success criterion, versus what can be deferred without contradicting that criterion.

### Launch With (v1.2 — do all of these)

All items are LOW–MEDIUM complexity, touch only the 3 already-generic files (`Shell.svelte`, `LoginScreen.svelte`, `EntityScreen.svelte`), and directly answer the question's four composition areas (header pattern, table polish, form/dialog polish, login composition):

- [ ] App container + content max-width in `Shell.svelte` — without this, every other polish item sits inside an unbounded, edge-to-edge page
- [ ] Header bar (app identity + user/logout) — replaces the stray `<h1>` + floating logout button
- [ ] Nav active-state + overflow fix (pick flex/scroll or `Tabs`, not both) — 9 items is currently a real visual risk
- [ ] Page header per entity: title + description + primary action — the single highest-leverage change per the question's own framing
- [ ] `Skeleton` loading state — replaces "carregando..."
- [ ] `Empty` empty state — replaces "Nenhum registro."
- [ ] Table wrapped in bounding container (`Card` or bordered div)
- [ ] `AlertDialog` replacing `window.confirm()` — closes known tech debt, single highest-impact "looks unfinished" fix in the whole list
- [ ] `Field`/`FieldGroup`/`FieldDescription` form composition — the core of "form polish," applies once to the shared form-render block, benefits all 9 entities
- [ ] `Dialog.Description` + `Dialog.Footer` — already-installed, currently-unused primitives; essentially free
- [ ] Busy/spinner state on entity-form submit — parity with the already-shipped `LoginScreen` pattern
- [ ] Required-field indicator — cheap, driven by existing `config.fields[].required` data
- [ ] `CardHeader`/`CardTitle`/`CardDescription` on login card
- [ ] Full-viewport centered login layout

### Add After Validation (only if time remains in this same milestone)

- [ ] User menu (`Avatar` + `DropdownMenu`) for logout — nice but single-user value is modest
- [ ] Column alignment conventions by field kind — real polish, but a content/convention decision (which kinds align how) needs to be made first
- [ ] Per-entity icons in nav + page header — needs a full icon-per-entity content pass across all 9 configs

### Future Consideration (explicitly not v1.2)

- [ ] Full `Sidebar` left-nav shell — reconsider only if/when the deferred dashboard/panel milestone introduces real navigational hierarchy
- [ ] Advanced data-table features (sort/filter/pagination) — reconsider only if row counts grow enough to need it; flag for phase-specific research at that time, not this milestone

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Page header (title + description + action) | HIGH | LOW | P1 |
| `AlertDialog` replacing `window.confirm()` | HIGH | LOW | P1 |
| `Field`/`FieldGroup` form composition | HIGH | MEDIUM | P1 |
| App container + max-width | HIGH | LOW | P1 |
| `Skeleton` loading state | MEDIUM | LOW | P1 |
| `Empty` empty state | MEDIUM | LOW | P1 |
| Header bar + nav active-state/overflow | HIGH | LOW–MEDIUM | P1 |
| Login `CardHeader` + centered layout | MEDIUM | LOW | P1 |
| `Dialog.Description`/`Dialog.Footer` | MEDIUM | LOW | P1 |
| Entity-form submit busy state | MEDIUM | LOW | P1 |
| Table bounding container | MEDIUM | LOW | P1 |
| Required-field indicator | LOW | LOW | P2 |
| User menu (Avatar + DropdownMenu) | LOW | LOW–MEDIUM | P2 |
| Column alignment by field kind | LOW–MEDIUM | LOW–MEDIUM | P2 |
| Per-entity icons | LOW | LOW | P2 |
| `Tabs` as nav mechanism (alt. to scroll) | LOW | MEDIUM | P3 |
| Full `Sidebar` shell | LOW (for this user/scope) | HIGH | P3 (defer) |
| Advanced data-table (sort/filter/paginate) | LOW (current data volume) | HIGH | P3 (defer) |

**Priority key:**
- P1: Do in this milestone — directly satisfies "reads as finished SaaS product"
- P2: Do if time remains within this milestone, non-blocking
- P3: Defer to a future milestone, only if underlying conditions change (real nav hierarchy, real data volume)

## Sources

- Direct code read (HIGH confidence, primary grounding for every dependency/complexity claim): `web/src/App.svelte`, `web/src/lib/Shell.svelte`, `web/src/lib/auth/LoginScreen.svelte`, `web/src/lib/entities/EntityScreen.svelte`, `web/src/lib/components/ui/{dialog,table}/*`, `web/src/app.css`, `web/components.json`, `web/package.json`
- [shadcn-svelte components documentation](https://www.shadcn-svelte.com/docs/components) — full registry list (Sidebar, Breadcrumb, Skeleton, Empty, Tooltip, Dropdown Menu, Alert Dialog, Field, Tabs, Avatar, etc. all confirmed present)
- [shadcn-svelte Field component docs](https://www.shadcn-svelte.com/docs/components/field) — Field/FieldGroup/FieldLabel/FieldDescription/FieldError/FieldSeparator/FieldSet/FieldLegend API
- [shadcn-svelte Sidebar component docs](https://www.shadcn-svelte.com/docs/components/sidebar) — Provider/Root/Header/Footer/Content/Group/Menu/MenuButton structure, `isActive` prop, setup weight
- [shadcn-svelte Skeleton component docs](https://www.shadcn-svelte.com/docs/components/skeleton) — placeholder API and dimension-driven usage pattern
- [shadcn-svelte Empty component docs](https://www.shadcn-svelte.com/docs/components/empty) — Empty.Root/Header/Media/Title/Description/Content composition for empty states
- Web search consensus (MEDIUM confidence — general convention, not a single authoritative source): shadcn/SaaS page-header pattern (title + description + breadcrumb + right-aligned actions), table loading/empty-state and row-density conventions (`shadcndesign.com`, `shadcn.io`, `shadcnstudio.com` block galleries)
- Reddit thread `r/AgentContext_dev/comments/1vddlso/...` — **unreachable** (WebFetch blocked on reddit.com; web search did not surface thread contents). Not incorporated; flagged as a gap below.

---
*Feature research for: SaaS UI polish milestone (v1.2), Apollo v2*
*Researched: 2026-08-10*
