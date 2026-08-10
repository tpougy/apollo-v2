# Architecture Research

**Domain:** UI polish/composition layering for an existing Svelte 5 + Tailwind v4 + shadcn-svelte SPA
**Researched:** 2026-08-10
**Confidence:** HIGH (based on direct reading of the actual source files — `App.svelte`, `Shell.svelte`, `LoginScreen.svelte`, `EntityScreen.svelte`, `entities/types.ts`, `entities/registry.ts`, `components.json`, `app.css`, and the live Playwright specs that encode structural assumptions)

## Standard Architecture

### System Overview (current, unchanged by v1.2)

```
┌──────────────────────────────────────────────────────────────────┐
│ App.svelte  (root — <h1>, <Toaster/>, SignedOut/SignedIn switch)  │
├──────────────────────────────────────────────────────────────────┤
│  SignedOut → LoginScreen.svelte   (Card, 2-step email/code form)  │
│  SignedIn  → <div data-testid="app-shell"> → Shell.svelte         │
├──────────────────────────────────────────────────────────────────┤
│ Shell.svelte                                                       │
│  - routine job trigger (hidden div, non-visual)                    │
│  - auth status line, Logout Button                                 │
│  - <nav> of 9 Buttons (one per EntityConfig, keyed by etype)        │
│  - {#key ativo} EntityScreen config={active} {/key}                 │
├──────────────────────────────────────────────────────────────────┤
│ EntityScreen.svelte  (ONE generic component, mounted 9x/session,   │
│  never simultaneously — {#key ativo} destroys/remounts on nav)     │
│  - <section><h2>{titulo}</h2> ... Table ... create Button ...      │
│    Dialog.Root > form (fields/links/xorLink) ... </section>        │
│  - ALL business logic lives here: handleSubmit, handleDelete,      │
│    startCreate, startEdit, xor-link-switch, buildQuery             │
└──────────────────────────────────────────────────────────────────┘
```

Config fan-out: `entities/registry.ts` auto-discovers `entities/defs/*.ts` (9 files), each exporting an `EntityConfig` (`entities/types.ts`). `Shell.svelte` renders the nav from `entityConfigs` and mounts exactly one `EntityScreen` at a time. **EntityScreen.svelte itself contains zero per-entity conditionals for capability class** — `config.capabilities.{create,update,delete}` and `config.updatableFields` are the only branch points, already present and untouched by this milestone.

### Component Responsibilities (today)

| Component | Responsibility | Owns markup for |
|-----------|-----------------|------------------|
| `App.svelte` | Root shell: page `<h1>`, global `<Toaster/>`, signed-in/signed-out switch | Top-level document chrome |
| `LoginScreen.svelte` | 2-step magic-code auth UI + its own handlers | Card-wrapped auth form |
| `Shell.svelte` | Post-auth chrome: auth status, logout, nav, active-entity mount | Nav bar + entity-mount host |
| `EntityScreen.svelte` | Config-driven table + create/edit Dialog + all CRUD business logic | Section heading, error alert, table, create button, Dialog form |

## Where Composition/Spacing Polish Belongs Per File

### 1. `LoginScreen.svelte` — lowest risk, self-contained

Already wraps its content in `<Card><CardContent>...</CardContent></Card>` inside `<div data-testid="login-screen">`. Polish here is purely additive class/layout work **inside the existing tree**:
- Center the Card on the viewport (currently unstyled — no outer wrapper providing height/centering), give the Card a fixed max-width, add `CardHeader`/`CardTitle`/`CardDescription` (already-available shadcn Card sub-parts, not currently imported) for a proper heading above the form instead of a bare `<p>Código enviado para {email}</p>`.
- All existing `data-testid` attributes stay on the exact same elements; this file needs no wrapper wired in from outside, so it's an isolated, parallelizable change — safe to do first or in its own phase with no ordering dependency on Shell/EntityScreen.
- **Watch item:** `design-system.spec.ts` asserts `h1Font === bodyFont` and `h1Weight === "400"` against **`App.svelte`'s top-level `<h1>Apollo v2</h1>`**, not anything inside LoginScreen. Do not add typographic classes to that root `<h1>` without updating that test — it is a structural/CSS assertion, not a testid, and is easy to break by accident when adding "page header" polish at the App root level instead of inside Shell.

### 2. `Shell.svelte` — the architectural fulcrum

This is where a page-header/toolbar convention must be decided, because everything EntityScreen renders is a **child of whatever wrapper Shell puts around it**. Concretely, today `Shell.svelte`'s template is a flat sequence: auth line → Logout button → `<nav>` → `{#key ativo}EntityScreen{/key}`, with no wrapping container, no vertical rhythm, no visual separation between nav and content.

Two structural additions belong here, both additive (no existing element removed or retagged):
- A **top toolbar/header region** wrapping the auth-status line + Logout button (e.g. a flex row with `justify-between`, consistent padding) — this is Shell's own concern, not EntityScreen's, since it's identical chrome regardless of which entity is active.
- A **content region wrapper** around `<nav>` + the `{#key ativo}` block that establishes max-width/centering and consistent outer padding for everything EntityScreen renders. This is the single highest-leverage change in the whole milestone: because `{#key ativo}` remounts a fresh `EntityScreen` on every nav click, wrapping *outside* that block in Shell means the spacing "frame" is applied exactly once and inherited by all 9 entities for free — EntityScreen itself never needs to know about outer page margins/max-width.

**Constraint check:** `data-testid="app-shell"` lives on the `<div>` in `App.svelte` that wraps `<Shell/>`, not inside `Shell.svelte` — safe regardless of what Shell does internally. `data-testid="logout"` and `data-testid="nav-${etype}"` are on the `Button` components directly; adding a wrapping `<div>`/`<header>`/`<nav class="...">` around them is safe as long as the `Button` elements themselves keep their testid props untouched. `shell-nav.spec.ts`'s `aria-current` and background-color-contrast assertions read computed style off the nav `Button`s directly — wrapping them in a styled container doesn't affect that, but changing the Button's own `variant`/inline classes would.

**Do not touch `{#key ativo}` or the `EntityScreen config={active}` call** — that's the reactive/remount contract the business logic and testid-scoping (`Playwright` locates `row`, `field-*`, etc. per currently-mounted screen) depend on.

### 3. `EntityScreen.svelte` — highest blast radius, most constrained

This file is shared, unmodified, across all 9 entities. It renders inside whatever frame Shell now provides, so **it should not also add outer page-level width/centering** — that would double up with Shell's wrapper and fight over max-width on every entity. What DOES belong inside EntityScreen's own polish scope, because it's genuinely per-screen composition, not page chrome:
- The `<section><h2>{config.titulo}</h2>` header block: promote to a small header row (title + optional right-aligned "novo" create button, when `config.capabilities.create`) instead of the current flow where the create Button is rendered far below the table. This is a layout-only reshuffle of two already-existing elements (`<h2>` and the `entity-create-start` Button) — no new element needs a testid, and none of the existing ones move to a different component.
- Table spacing: shadcn `Table`/`TableRow`/`TableCell` already carry shadcn's own default density; this milestone's "clearer information density" goal is satisfied by shadcn's own row/cell padding utilities (`className` overrides passed to the existing `Table*` components), not by inventing new table markup.
- The empty state (`data-testid="empty-state"`, currently `<TableCell colspan={...}>Nenhum registro.</TableCell>`) and the loading state (currently a bare `<p>carregando...</p>`) are the two weakest visual moments in this file and are entirely local, testid-preserving improvements (icon + muted text inside the same cell/element).
- The `Dialog.Content` form: field spacing between the repeated `{#each editableFields()...}` blocks (each is a bare `<div>` today with no vertical gap) — a single wrapper-class change (e.g. `space-y-4` on the `<form>` or per-`<div>` `grid gap-*`) fixes rhythm for all 9 entities' forms in one place, because the form markup is generated once and reused.

**Critical constraint:** because `EntityScreen.svelte` is the single generic component instantiated for `fundos`, `projetos`, `etapas`, `tarefas`, `templatesRotina`, `instanciasRotina`, `tickets`, `subtarefas`, and one more (9 total per `registry.ts`/`shell-nav.spec.ts`'s hardcoded `count === 9`), **any structural mistake here regresses all 9 entity screens simultaneously**, including the 3 capability classes (full-CRUD, restricted create-only/status-only, read-only) already covered by the 39-test Playwright suite. This file must be changed:
- With the smallest possible diff per change (one layout concern at a time: header row, then empty/loading state, then form spacing, then table density) so a regression is attributable to one commit.
- Never by branching on `config.etype` or `config.titulo` — the file's whole value is that it has zero per-entity special-casing today (confirmed: the only conditionals are on `config.capabilities`, `config.updatableFields`, `config.xorLink`, and field `.kind`), and introducing a `titulo`-keyed style branch would silently defeat that.
- With awareness that `shell-nav.spec.ts` locates the active screen's title via a bare `page.locator("h2")` (not a testid) and asserts its text equals the clicked nav button's label — the heading must **stay an `<h2>` element** (or the test must be updated in the same change) even inside a new header-row wrapper `<div>`.

## Recommended Project Structure (delta only — no new top-level folders)

```
web/src/
├── App.svelte                     # unchanged structurally; do not add typographic
│                                   # classes to the root <h1> (breaks design-system.spec.ts)
├── lib/
│   ├── auth/
│   │   └── LoginScreen.svelte      # polish: Card sizing/centering, CardHeader/Title, spacing
│   ├── Shell.svelte                # polish: toolbar wrapper + content-frame wrapper
│   │                                # (max-width/padding applied ONCE here, inherited by
│   │                                # every EntityScreen instance)
│   ├── entities/
│   │   ├── EntityScreen.svelte     # polish: header row, empty/loading state, form/table
│   │   │                            # spacing — additive classes only, testids untouched
│   │   ├── types.ts                 # NOT touched — EntityConfig contract is locked
│   │   ├── registry.ts              # NOT touched — auto-discovery is locked
│   │   └── defs/*.ts (9 files)      # NOT touched — no per-entity visual config needed
│   └── components/ui/               # shadcn-svelte primitives; add more via
│                                     # `bunx shadcn-svelte add <x>` if a phase needs one
│                                     # (e.g. `skeleton` for loading state, `breadcrumb`
│                                     # if a header ever needs one) — still "shadcn-svelte's
│                                     # own scope", not a new dependency
```

### Structure Rationale

- **No new `web/src/lib/layout/` folder or `PageHeader.svelte` component is warranted.** There are exactly three consumers of page-level chrome in this app (`LoginScreen`, `Shell`, `EntityScreen`), and each one's "header" is structurally different enough that a shared component would either (a) be a thin `<div class="flex justify-between items-center">` wrapper not worth abstracting, or (b) force EntityScreen's `config.titulo` + conditional create-button into a generic props API that adds indirection without removing any duplication — there is only one call site (`EntityScreen.svelte` itself) that would ever use it, since Shell's toolbar and LoginScreen's Card header are visually and structurally distinct (nav+logout row vs. auth-step heading vs. entity-titulo+create-button row). Introducing a shared component for a single call site is exactly the "new component library beyond shadcn-svelte's own scope" the project's constraints (v1.2 Active section, PROJECT.md) explicitly rule out.
- **If** a genuine 2nd+ call site for the exact same header pattern (title + optional right-aligned action) emerges during execution — which would only happen if Shell's toolbar and EntityScreen's header converge on identical markup — extracting a tiny presentational `web/src/lib/components/PageHeader.svelte` (props: `title: string`, an optional action `Snippet`) is a reasonable in-flight refactor. Default to inline markup in each of the 3 files; do not pre-build the abstraction speculatively.
- **Layout frame ownership stays in `Shell.svelte`, not `EntityScreen.svelte`.** Because `EntityScreen` is remounted fresh per nav click (`{#key ativo}`) but Shell is mounted once per session, any outer max-width/centering/padding belongs in Shell so it's computed once and every entity screen inherits it identically — this also means a single visual QA pass on Shell's frame de-risks all 9 entities' outer layout at once, rather than needing to check page-width consistency per entity.
- **`entities/types.ts`, `entities/registry.ts`, and the 9 `defs/*.ts` files are explicitly out of this milestone's touch-set.** They define data/capability shape, not visual layout, and `EntityConfig` has no visual fields (no `icon`, no `description`) — adding one to support polish would be scope creep into the config contract the plan says must not change.

## Architectural Patterns

### Pattern 1: Frame-once-in-Shell, polish-locally-in-EntityScreen

**What:** Outer page frame (max-width, horizontal padding, vertical rhythm between toolbar/nav/content) lives exactly once, in `Shell.svelte`, wrapping the `<nav>` + `{#key ativo}` block. Inner screen-specific polish (header row, empty/loading state, form/table spacing) lives in `EntityScreen.svelte` and is applied identically to whichever entity is currently mounted, because there's only one instance of that file active at a time.
**When to use:** Any time a single generic component is reused across N variants (here, 9 entities) and needs page-level chrome it doesn't own itself.
**Trade-offs:** Avoids 9x duplication of frame styling; the cost is that Shell and EntityScreen must agree on which one owns "outer" vs "inner" spacing so they don't double-pad. Document the boundary in a code comment at the wrapper in Shell.svelte (e.g. "outer content frame — do not duplicate padding inside EntityScreen").

**Example (illustrative, Shell.svelte delta):**
```svelte
<div class="mx-auto max-w-5xl px-4 py-6 space-y-6">
  <nav class="flex gap-2">...</nav>
  {#key ativo}
    {@const active = configByEtype(ativo)}
    {#if active}
      <EntityScreen config={active} />
    {/if}
  {/key}
</div>
```

### Pattern 2: Additive-class-only diffs on shared components

**What:** Every change to `EntityScreen.svelte` in this milestone is either (a) a `class="..."` addition to an existing element, (b) reordering two already-existing sibling elements (title + create button) into a flex row, or (c) filling an already-conditional branch (`empty-state`, loading `<p>`) with richer markup that keeps the same root element and same `data-testid`. None of these require touching `handleSubmit`, `handleDelete`, `startCreate`, `startEdit`, or the xor-link-switch logic (lines ~157–379 in the current file) — that block should never appear in a v1.2 diff at all.
**When to use:** Any shared/generic component where a single mistake fans out to every consumer (here, 9 entities × 3 capability classes).
**Trade-offs:** Slower to iterate (must re-check all capability-class Playwright specs after each EntityScreen change) but the only safe way to touch a component this central without a full regression sweep per entity.

### Pattern 3: shadcn-svelte primitive escalation, not custom components

**What:** When a visual gap is identified (e.g. no distinct loading skeleton, no breadcrumb, no distinct card boundary), first check whether an *already-installed* primitive covers it (`Card` sub-parts are installed but underused in `LoginScreen`; `Separator` is installed at `components/ui/separator` but appears unused anywhere in the 3 files read). If not, add via `bunx shadcn-svelte add <name>` from the existing registry (`components.json` already points at `shadcn-svelte.com/registry`, style `nova`, base color `neutral`) rather than hand-rolling a bespoke component or reaching for an external UI package.
**When to use:** Any time this milestone's "no new component library" constraint (PROJECT.md C-11 carried into v1.2's Active section) is at risk of being worked around by writing custom markup that duplicates what shadcn already ships.
**Trade-offs:** Keeps the whole app on one visual vocabulary; the cost is checking `shadcn-svelte add` output for `mode-watcher` reintroduction risk — v1.1's Key Decisions log this exact trap for `sonner` (stock registry entry pulled in `mode-watcher`, which was hand-avoided) and it applies to any future `shadcn-svelte add` invocation in v1.2 as well.

## Data Flow

Unaffected by this milestone — v1.2 is presentation-only. No change to InstantDB queries (`db.useQuery`), transactions (`db.transact`), or the routine-instance job. Documenting for completeness since it constrains what "polish" is allowed to touch:

```
[User clicks nav Button in Shell]
    ↓ (ativo := etype, triggers {#key ativo} remount)
[EntityScreen.svelte mounts fresh with new config]
    ↓ (db.useQuery(buildQuery(config)) — reactive, live)
[Table renders rowsOf()] ← [InstantDB live query]
    ↓ (user clicks "novo"/"editar")
[Dialog.Root opens, mode := "create"|"edit"]
    ↓ (user submits form)
[handleSubmit → db.transact(...)] → [InstantDB] → [live query re-fires] → [Table re-renders]
```

None of this reactive chain is touched by spacing/composition work — the risk surface is exclusively the template/markup portion of `EntityScreen.svelte` (lines ~382–676 today), never the `<script>` block above it.

## Scaling Considerations

Not applicable in the traditional sense (single-user local app, per PROJECT.md's "Core Value"). The relevant "scale" axis here is **entity count** (9 today, defined by `defs/*.ts` auto-discovery) and **capability-class count** (3: full-CRUD, restricted, read-only). Any layout decision must be verified to render sanely across all 3 capability classes since EntityScreen's markup branches on `config.capabilities`:

| Capability class | What differs in EntityScreen's rendered tree | Polish risk |
|---|---|---|
| Full-CRUD (e.g. `fundos`) | Both `row-edit`/`row-delete` buttons + `entity-create-start` all render | Header row (title + create button) must handle the button being present |
| Restricted create-only/status-only (e.g. `instanciasRotina`) | `updatableFields` narrows the edit form to fewer fields; create may be absent | Header row must handle the create button being **absent** (conditional `{#if config.capabilities.create}`) without leaving a lopsided/empty flex slot |
| Read-only | Neither edit nor delete nor create renders | Table-only screen — empty-state and loading-state polish must look correct with zero action affordances below the table |

## Anti-Patterns

### Anti-Pattern 1: Branching EntityScreen's markup on `config.etype` or `config.titulo` for visual purposes

**What people do:** Add `{#if config.etype === "fundos"}` or similar to special-case one entity's look ("this one needs more spacing because it has more columns").
**Why it's wrong:** EntityScreen's entire architectural value (stated in the milestone context) is being the single generic, config-driven component reused by all 9 entities. A visual per-entity branch reintroduces the exact per-entity special-casing the config-driven design was built to avoid, and makes future entity additions (a 10th `defs/*.ts` file) inherit undefined visual behavior.
**Do this instead:** If a genuinely entity-specific visual need exists (e.g. more table columns needing more horizontal space), solve it with a config-driven, general mechanism (e.g. a `listColumns.length`-based `overflow-x-auto` on the `Table` wrapper) — general enough that any current or future entity benefits, never a named-entity conditional.

### Anti-Pattern 2: Introducing a new shared layout component before a second real call site exists

**What people do:** Pre-emptively build `PageHeader.svelte` "because Shell and EntityScreen both have headers," then discover the two headers need different props/slots (Shell's has a nav; EntityScreen's has a create button; LoginScreen's has a step-dependent subtitle) and end up passing so many optional props/snippets that the "shared" component is just a router for three unrelated layouts.
**Why it's wrong:** Matches this project's own stated boundary — v1.2 explicitly stays within shadcn-svelte's own scope, "no new component library." A `PageHeader.svelte` built for 3 dissimilar call sites is exactly that: a bespoke component library entry, not a shadcn primitive.
**Do this instead:** Inline the header markup per file (each is 3-6 lines of flex layout). Only extract once actual duplication — not superficial "both have a title" similarity — is observed across two or more call sites during implementation.

### Anti-Pattern 3: Applying outer page-frame spacing (max-width/centering) inside `EntityScreen.svelte`

**What people do:** Add `class="mx-auto max-w-5xl px-4"` to `EntityScreen.svelte`'s root `<section>` because "that's where the content is."
**Why it's wrong:** `EntityScreen` is remounted per nav click and is only one of the things Shell's content area renders (the `<nav>` is the other). Framing the page inside EntityScreen means the nav bar above it has different horizontal margins than the table/form below it, and any future non-EntityScreen content Shell adds (there is none today, but the auth-status line + Logout button already sit outside EntityScreen) would need the same class duplicated a second time.
**Do this instead:** Put page-frame spacing in `Shell.svelte`, wrapping both the `<nav>` and the `{#key ativo}` block, per Pattern 1 above.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `App.svelte` ↔ `Shell.svelte` | `data-testid="app-shell"` wrapper `<div>` owned by App, Shell has no awareness of it | Do not move this testid into Shell — `no-leakage.spec.ts`/other specs may key off the exact current DOM position; changing which file owns it is unnecessary since App already isolates it correctly |
| `Shell.svelte` ↔ `EntityScreen.svelte` | Single prop: `config: EntityConfig`, passed at the `{#key ativo}` call site | The ONLY sanctioned integration point for passing entity identity into the generic screen. Do not add new props for visual purposes (e.g. a `density` or `variant` prop) — that would start config-driven visual branching, which the project's own architecture deliberately avoids for business logic and should not be reintroduced for visuals |
| `EntityScreen.svelte` ↔ `entities/registry.ts` / `defs/*.ts` | EntityScreen never imports `registry.ts` directly; only consumes the `config` prop Shell already resolved via `configByEtype` | Confirms EntityScreen truly has zero entity-specific knowledge — polish work must preserve this by never importing anything from `entities/defs/*` into `EntityScreen.svelte` |
| `EntityScreen.svelte` ↔ `components/ui/*` (shadcn) | Direct imports of `Table`, `Dialog`, `Select`, `Calendar`, `Badge`, `Alert`, `Button`, `Input`, `Label`, `Checkbox`, `Textarea`, `Popover` | Every visual change should be expressed via these components' existing `class`/variant props (they already accept `class` via `cn()` merging, confirmed by the existing `cn(...)` usage on the date-picker Button at line ~532) rather than raw HTML replacing a shadcn component |
| Playwright specs ↔ rendered DOM | `data-testid` for all interactive/functional elements; **bare tag/role selectors for a few structural assertions** (`page.locator("h2")` in `shell-nav.spec.ts`, `page.getByRole("table")` in `entities-table-restyle.spec.ts`, computed-style reads on `h1`/nav Buttons in `design-system.spec.ts`) | This is the sharpest edge case for this milestone: the testid-preservation requirement in the milestone context is necessary but **not sufficient** — at least 3 existing specs assert on tag identity or computed CSS, not just testid presence. Any polish change must be checked against these, not only against the testid list. |

## Build-Order Implications for the Roadmap

Given the dependency chain (`App` renders `Shell`, `Shell` renders `EntityScreen`, and Shell's future content-frame wrapper physically surrounds EntityScreen in the DOM), the safe sequencing is:

1. **`LoginScreen.svelte` polish** — zero dependency on anything else; safe to do in any order, including first, as a low-risk warm-up/parallel track.
2. **`Shell.svelte` polish (toolbar + content-frame wrapper)** — must land before or independently of EntityScreen's internal polish, because once the outer frame exists, EntityScreen's internal spacing decisions (e.g. how much padding its own header row needs) should be tuned relative to the already-final outer frame, not against a naked unwrapped baseline that will change size in a later phase. Doing Shell first also means the "regresses all 9 entities at once" risk window for the outer frame is validated with the full nav-through-all-9-entities test (`shell-nav.spec.ts`'s "each nav Button renders its corresponding EntityScreen") before EntityScreen's own markup starts changing.
3. **`EntityScreen.svelte` polish** — last, and ideally split into independently-verifiable sub-steps (header row → empty/loading state → form field spacing → table density) rather than one large diff, specifically because a single mistake here regresses all 9 entities × 3 capability classes simultaneously. Re-run (or extend) the Playwright suite after each sub-step rather than only at the end of the phase.

This order also matches the file's actual DOM containment (`App` ⊃ `Shell` ⊃ `EntityScreen`) — polishing outside-in avoids re-tuning inner spacing against a moving outer frame.

## Sources

- Direct source reading (HIGH confidence, primary source): `web/src/App.svelte`, `web/src/lib/Shell.svelte`, `web/src/lib/auth/LoginScreen.svelte`, `web/src/lib/entities/EntityScreen.svelte`, `web/src/lib/entities/types.ts`, `web/src/lib/entities/registry.ts`, `web/src/app.css`, `web/components.json`, `web/package.json`.
- Test-encoded structural contracts (HIGH confidence, primary source): `web/e2e/design-system.spec.ts`, `web/e2e/shell-nav.spec.ts`, `web/e2e/entities-table-restyle.spec.ts`.
- Project scope/constraints (HIGH confidence, primary source): `.planning/PROJECT.md` (v1.2 Active section, C-11 UI stack constraint, v1.1 Key Decisions re: `sonner`/`mode-watcher` trap).

---
*Architecture research for: Svelte 5 + shadcn-svelte UI polish (v1.2 "Lapidação de UI")*
*Researched: 2026-08-10*
