# Phase 18: Navigation Foundation & EntityScreen Extension - Research

**Researched:** 2026-08-11
**Domain:** Svelte 5 SPA navigation restructuring + generic-component additive extension + Playwright e2e migration (no new external dependencies)
**Confidence:** HIGH — every claim below is grounded in files read this session (exact line numbers cited); no external library research was needed or performed (this phase introduces zero new packages).

## Summary

This phase is pure codebase surgery on four already-existing files (`types.ts`, `registry.ts`,
`Shell.svelte`, `EntityScreen.svelte`) plus one new placeholder file (`Dashboard.svelte`) and a
new e2e helper (`web/e2e/helpers/gotoNested.ts` or similar). No new npm packages, no schema
changes, no new shadcn-svelte components are required for Phase 18 itself (`tabs`,
`scroll-area`, `accordion`, `tooltip` from spec-ui.md §7 are needed by Phases 19-20's real
master-detail UI, not by this phase's placeholder work).

The single highest-risk finding is **not** in the CONTEXT.md's own migration list: three
Playwright spec files use the generic wildcard selector `[data-testid^="nav-"]` with a
**hardcoded count of `9`** (today's total `entityConfigs.length`). None of these three
reference `nav-etapas`/`nav-templatesRotina`/`nav-subtarefas`/`nav-tarefas` by name, so a
plan that only migrates the 7 files CONTEXT.md's grep would surface will still break these
three at execution time. They must be included in this phase's e2e-migration task list:
`web/e2e/shell-nav.spec.ts` (2 assertions), `web/e2e/shell-chrome.spec.ts` (1 assertion), and
`web/e2e/entities-header-states.spec.ts` (1 assertion, `ENTTBL-07`).

The second finding requiring an explicit planner decision: `EntityConfig.nav === "nested"`
entities (`etapas`, `templatesRotina`, `subtarefas`, `tarefas`) lose their `nav-<etype>` topbar
button in this phase, but the master-detail UI that will eventually host them nested
(Projetos §2.2, Rotinas §2.3, Tickets/Tarefas §2.4) is explicitly **out of scope** for Phase 18
(deferred to Phases 19-20). Yet `NAV-05` requires the 27 e2e call sites across 7 spec files
that reach these nested entities via their old `nav-<etype>` button to be migrated to a
`gotoNested(page, etype)` helper **in this same phase**. Since there is no real parent-hosted
UI to drill through yet, `gotoNested` needs an interim, fully-generic (`entityConfigs.filter(c
=> c.nav === "nested")`-driven, zero per-etype branching) navigation affordance that Phase
19-20 will later delete once the real nested UI supersedes it. This is flagged explicitly as an
assumption requiring confirmation (see Open Questions/Assumptions Log).

**Primary recommendation:** Implement the additive fields/selector/Route type exactly as
spec-ui.md §1.2/§1.3 dictates (verbatim shapes below); keep `Shell.svelte`'s new nav loop
structurally identical to today's (`{#each ... as cfg (cfg.etype)} <Button data-testid=... >`)
but sourced from `navConfigs` plus one literal `nav-dashboard` entry; make `EntityScreen`'s two
new props feed exactly two existing expressions (`buildQuery`'s returned object's `$` key, and
`startCreate`'s `selectedLinks` assignment) with a `?? null`-safe merge so the `null`/`null`
path is provably identical to current output; and treat the e2e migration as **10 files total**
(7 with direct dead-testid references + 3 with the wildcard-count exposure), not 7.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Topbar nav rendering (6 items) | Browser/Client (Svelte component) | — | Pure client-side `$state`, no server round-trip; `Shell.svelte` already owns this today (lines 85-97) |
| Route/active-section state | Browser/Client (Svelte component) | — | Spec §1.3 explicitly locks this to `$state` local to `Shell`, no router/URL, no store |
| `navConfigs` derivation | Registry module (`registry.ts`) | — | Pure derived array computed once at module load from `entityConfigs`, consumed by the Client tier |
| `EntityConfig.nav`/`navTitulo` fields | Config/type layer (`types.ts` + `defs/*.ts`) | — | Static per-entity metadata, no runtime computation |
| `scopeWhere` query narrowing | Client (Svelte component, `EntityScreen.svelte`) | API/Backend (InstantDB query engine) | `scopeWhere` is merged into the InstaQL `where` clause client-side before `db.useQuery` sends it; InstantDB (API tier) executes the actual filtering server-side per its own permission rules — this phase does not touch `instant.perms.ts` |
| `presetLinks` create-time defaults | Client (Svelte component, `EntityScreen.svelte`) | — | Pre-fills local `$state` (`selectedLinks`) before the user ever submits; no backend involvement until `handleSubmit`'s existing `db.transact` path, which is unchanged |
| Dashboard placeholder mount | Client (new `Dashboard.svelte`, not in registry) | — | Explicitly not an `EntityScreen`/not in `registry.ts` per spec §3 and CONTEXT — a mount-point proof only, content deferred to Phase 21 |

## Standard Stack

No new libraries. This phase's entire implementation surface is Svelte 5 runes (`$state`,
`$props`) and TypeScript discriminated unions already used elsewhere in this codebase.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | (already installed, project uses Svelte 5 runes) [VERIFIED: web/src/lib/entities/EntityScreen.svelte:164-193, web/src/lib/auth/LoginScreen.svelte:18] | `$state`/`$props` runes power every piece of local UI state in this phase | Already the exclusive state-management mechanism in this codebase — no store library exists anywhere in `web/src` |

### Supporting
None — no `tabs`/`scroll-area`/`accordion`/`tooltip` shadcn-svelte component is needed by
Phase 18 (those are needed starting Phase 19-20 per spec-ui.md §7's install list, none of which
are installed today — verified: `web/src/lib/components/ui/` contains only `alert,
alert-dialog, badge, button, calendar, card, checkbox, dialog, empty, input, label, popover,
select, separator, skeleton, sonner, table, textarea` [VERIFIED: `ls web/src/lib/components/ui/`]).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `$state`-typed `Route` discriminated union in `Shell.svelte` | A URL-based router (`svelte-spa-router`, hash routing) | Explicitly forbidden this milestone — spec-ui.md §10/§0.9 rules out any new dependency and any router; `Route` must stay a local `$state` object |
| Deriving `navConfigs` via `.filter()` in `registry.ts` | A hand-maintained array of primary etypes in `Shell.svelte` | Explicitly forbidden — spec-ui.md §0.7 and CONTEXT.md both lock "no manual entity list anywhere"; `registry.ts` must own the derivation |

**Installation:** None required.

**Version verification:** Not applicable — no packages added or upgraded this phase.

## Package Legitimacy Audit

**Not applicable — Phase 18 installs zero external packages.** No `npm view`/registry check
was run because there is nothing to check. If a future planning pass for this phase discovers
a need for `tabs`/`accordion`/etc., defer that need to Phase 19/20 per spec-ui.md §7 (those
phases own the sections that actually render tabbed/collapsible content); do not pull those
installs forward into Phase 18.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Shell.svelte (mounted once per authenticated session)              │
│                                                                       │
│  let rota = $state<Route>({ section: "dashboard" })  ◄── initial     │
│                                                                       │
│  ┌─ <nav> primary topbar (6 items, from navConfigs + literal         │
│  │   "Dashboard") ──────────────────────────────────────────┐        │
│  │   [Dashboard] [Rotinas] [Tickets] [Projetos] [Fundos] [Log]      │
│  │   data-testid="nav-dashboard" / "nav-<etype>"            │        │
│  └───────────────────────────┬───────────────────────────────┘      │
│                               │ onclick sets `rota`                  │
│                               ▼                                      │
│              {#if rota.section === "dashboard"}                     │
│                  <Dashboard />         ◄── new placeholder file      │
│              {:else}                                                 │
│                  {@const active = configByEtype(rota.etype)}        │
│                  {#key rota.etype}                                   │
│                    <EntityScreen config={active}                    │
│                       scopeWhere={null} presetLinks={null} />       │
│                       ▲ both null in Phase 18 — no section yet      │
│                       ▲ actually PASSES scopeWhere/presetLinks       │
│                  {/key}                                              │
│              {/if}                                                   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EntityScreen.svelte (generic engine, unchanged rendering logic)    │
│                                                                       │
│  let { config, scopeWhere = null, presetLinks = null } = $props();  │
│                                                                       │
│  buildQuery(cfg) → { [cfg.etype]: { $: scopeWhere ? { where:        │
│                       scopeWhere } : {}, ...linkSub } }              │
│                       ▲ merge point — line 61-68 today               │
│                                                                       │
│  startCreate() → selectedLinks = { ...links, ...presetLinks }       │
│                       ▲ merge point — line 204-206 today             │
│                                                                       │
│  db.useQuery(() => buildQuery(config))  ──► InstantDB (API tier)    │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
web/src/lib/
├── Shell.svelte                 # +Route type, +navConfigs consumption, +Dashboard mount
├── dashboard/
│   └── Dashboard.svelte         # NEW — minimal placeholder, no data yet (Phase 21 fills it)
├── entities/
│   ├── types.ts                 # +nav?/+navTitulo? on EntityConfig
│   ├── registry.ts              # +navConfigs derived export
│   ├── EntityScreen.svelte       # +scopeWhere/+presetLinks props (additive only)
│   └── defs/
│       ├── instanciasRotina.ts   # ordem: 1, navTitulo: "Rotinas"
│       ├── tickets.ts            # ordem: 2
│       ├── projetos.ts           # ordem: 3
│       ├── fundos.ts             # ordem: 4
│       ├── logInferenciaClaude.ts# ordem: 5, navTitulo: "Log"
│       ├── etapas.ts             # nav: "nested", ordem: 10+
│       ├── templatesRotina.ts    # nav: "nested", ordem: 10+
│       ├── subtarefas.ts         # nav: "nested", ordem: 10+
│       └── tarefas.ts            # nav: "nested", ordem: 10+
web/e2e/helpers/
└── gotoNested.ts                 # NEW — replaces 27 direct `nav-<nested-etype>` clicks
```

### Pattern 1: Additive optional-prop merge with a provable no-op path
**What:** Both new `EntityScreen` props default to `null`; every place they're consumed must
degrade to today's exact expression when the value is `null`.
**When to use:** Any generic-engine extension where "zero regression when unused" is a stated
acceptance criterion (NEST-01).
**Example — the two exact integration points, verbatim from the current file:**

```typescript
// web/src/lib/entities/EntityScreen.svelte:61-68 (buildQuery) — TODAY:
function buildQuery(cfg: EntityConfig): Record<string, unknown> {
  const sub: Record<string, Record<string, never>> = {};
  for (const link of cfg.links ?? []) sub[link.label] = {};
  if (cfg.xorLink) {
    for (const choice of cfg.xorLink.choices) sub[choice.label] = {};
  }
  return { [cfg.etype]: { $: {}, ...sub } };
}

// Additive change — the ONLY line that must move is `$: {}`:
function buildQuery(cfg: EntityConfig): Record<string, unknown> {
  const sub: Record<string, Record<string, never>> = {};
  for (const link of cfg.links ?? []) sub[link.label] = {};
  if (cfg.xorLink) {
    for (const choice of cfg.xorLink.choices) sub[choice.label] = {};
  }
  return { [cfg.etype]: { $: scopeWhere ? { where: scopeWhere } : {}, ...sub } };
}
// scopeWhere === null -> `$: {}` -- byte-identical to today's return value.
```

```typescript
// web/src/lib/entities/EntityScreen.svelte:195-211 (startCreate) — TODAY:
function startCreate() {
  formError = null;
  mode = "create";
  editingId = null;
  const values: FormValues = {};
  for (const f of config.fields) {
    values[f.name] = f.kind === "boolean" ? false : "";
  }
  formValues = values;
  const links: Record<string, string> = {};
  for (const link of config.links ?? []) links[link.label] = "";
  selectedLinks = links;               // <-- this line is the merge point
  xorParentType = config.xorLink ? config.xorLink.choices[0].label : null;
  xorParentId = "";
  originalXorParentType = null;
  originalXorParentId = "";
}

// Additive change:
  const links: Record<string, string> = {};
  for (const link of config.links ?? []) links[link.label] = "";
  selectedLinks = presetLinks ? { ...links, ...presetLinks } : links;
  // presetLinks === null -> selectedLinks === links -- byte-identical to today.
```

**Prop declaration change (line 31 today: `let { config: configProp }: { config: EntityConfig } = $props();`):**

```typescript
let {
  config: configProp,
  scopeWhere = null,
  presetLinks = null,
}: {
  config: EntityConfig;
  scopeWhere?: Record<string, unknown> | null;
  presetLinks?: Record<string, string> | null;
} = $props();
```

Both `scopeWhere` and `presetLinks` must be read as plain (non-`$state`) values exactly like
`config` is snapshotted today (line 37: `const config = configProp;`) — `EntityScreen` is
remounted per-etype via `{#key}` in Shell, so there is no reactive-update requirement for these
props within a single mount's lifetime; treating them as reactive would be unnecessary
complexity the spec's "no over-engineering" principle (§0.9) rules against.

### Pattern 2: `navConfigs` as a filtered re-export, no manual list
**What:** `registry.ts` gains exactly one derived export, following the exact style of its
existing `configByEtype` function.
**Example:**
```typescript
// web/src/lib/entities/registry.ts — after existing exports (line 33-37 today):
export const navConfigs: EntityConfig[] = entityConfigs.filter(
  (c) => (c.nav ?? "primary") === "primary",
);
```
This requires zero change to `configs.sort((a, b) => a.ordem - b.ordem)` (registry.ts:31) —
`navConfigs` inherits the same already-sorted `entityConfigs` array via `.filter()`, so its
order is `.filter()`'s stable order over an already-`ordem`-sorted array, i.e. still ascending
by `ordem`. `navConfigs.length` will be `5` once the ordem reassignment lands (`instanciasRotina,
tickets, projetos, fundos, logInferenciaClaude`).

### Pattern 3: Shell's topbar loop — minimal structural diff from today
**What:** Today's loop (`Shell.svelte:85-97`) iterates `entityConfigs` directly:
```svelte
<nav class="flex flex-wrap gap-2">
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
```
Recommended minimal-diff replacement — one literal Dashboard button prepended, then the same
`{#each}` shape over `navConfigs` instead of `entityConfigs`, `cfg.titulo` replaced by
`cfg.navTitulo ?? cfg.titulo`, and `ativo`/`{#key ativo}{@const active = configByEtype(ativo)}`
replaced by the `rota: Route` discriminated union from spec §1.3:
```svelte
<nav class="flex flex-wrap gap-2">
  <Button
    type="button"
    variant={rota.section === "dashboard" ? "secondary" : "ghost"}
    data-testid="nav-dashboard"
    aria-current={rota.section === "dashboard"}
    onclick={() => (rota = { section: "dashboard" })}
  >
    Dashboard
  </Button>
  {#each navConfigs as cfg (cfg.etype)}
    <Button
      type="button"
      variant={rota.section === "entity" && rota.etype === cfg.etype ? "secondary" : "ghost"}
      data-testid={`nav-${cfg.etype}`}
      aria-current={rota.section === "entity" && rota.etype === cfg.etype}
      onclick={() => (rota = { section: "entity", etype: cfg.etype })}
    >
      {cfg.navTitulo ?? cfg.titulo}
    </Button>
  {/each}
</nav>

{#if rota.section === "dashboard"}
  <Dashboard />
{:else}
  {@const active = configByEtype(rota.etype)}
  {#key rota.etype}
    {#if active}
      <EntityScreen config={active} />
    {/if}
  {/key}
{/if}
```
This preserves every currently-tested behavior: `aria-current` semantics
(`shell-nav.spec.ts`'s "exactly one active indicator" test), the `secondary`/`ghost` variant
distinction (same test's background-color assertion), the `{#key}`-based remount-per-etype
(`shell-chrome.spec.ts`'s bounding-box consistency test doesn't depend on this, but
`entities-*` specs' fresh-mount assumptions do), and the flat single-`<nav>`, no-`Tabs`,
`flex-wrap` structure `shell-chrome.spec.ts`'s "nav overflow strategy" test asserts (`nav`
count === 1, `flexWrap === "wrap"`, no `[role="tablist"]`).

### Anti-Patterns to Avoid
- **`if (config.etype === "etapas") ...` inside `EntityScreen.svelte`:** Explicitly forbidden
  by CONTEXT.md and spec-ui.md §0.6/§2.1 — any etype-specific branch defeats the entire point
  of the additive-props design and must not appear anywhere in the diff.
- **A `mode` prop on `EntityScreen`:** Explicitly forbidden by CONTEXT.md ("Forbidden: ... any
  'mode' prop"). `scopeWhere`/`presetLinks` being non-null already fully describes "nested
  mode" — no separate flag is needed or permitted.
- **Persisting `rota` to `localStorage`/URL:** Spec §0.9/§10 rules out any router/URL work this
  milestone; `rota` must be a plain `$state` that resets to `{ section: "dashboard" }` on every
  fresh load, exactly mirroring today's `ativo = entityConfigs[0].etype` behavior (Shell.svelte:13).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filtering "primary" vs "nested" nav entries | A second manually-maintained array of etypes in `Shell.svelte` | `registry.ts`'s `navConfigs = entityConfigs.filter(...)` | Spec §0.7 and CONTEXT.md both lock this; a second list is a second place to update whenever an entity's `nav` field changes |
| Merging `scopeWhere` into the query | A branch that swaps `buildQuery`'s whole return shape based on etype | The single conditional-spread `$: scopeWhere ? { where: scopeWhere } : {}` inline in the existing function | Keeps `buildQuery` a pure function of `(cfg, scopeWhere)`, provably identical to today when `scopeWhere` is `null` — no new code path, just one wider expression |

**Key insight:** Every "don't hand-roll" risk in this phase is really the same risk restated —
the temptation to special-case by etype instead of widening a generic function's input. The
entire NEST-01 acceptance criterion (existing e2e suite unmodified) is the automated proof that
this temptation was avoided.

## Common Pitfalls

### Pitfall 1: The hidden `[data-testid^="nav-"]` count assertions
**What goes wrong:** Three specs assert `expect(count).toBe(9)` against the generic wildcard
`[data-testid^="nav-"]` locator — none of them appear in a `grep -rl 'nav-etapas\|nav-tarefas...'`
sweep, so a migration plan built only from that grep silently misses them and CI fails after
the topbar change, even though the "did I migrate every dead testid" checklist looks complete.
**Why it happens:** The wildcard selector was written for a period when
`entityConfigs.length === 9` and every entity had a topbar button; it was never scoped to
"primary entities only."
**How to avoid:** Grep for the *pattern*, not just the specific dead testid strings:
`grep -rn 'data-testid\^="nav-"\|toBe(9)' web/e2e` — the three hits are (exact file:line, see
`## Phase Requirements` table below for detail):
- `web/e2e/shell-nav.spec.ts:19` (`expect(count).toBe(9)`, inside "each nav Button renders its
  corresponding EntityScreen") and its dependent loop `shell-nav.spec.ts:21-26` iterating and
  asserting `page.locator("h2")` text equals the button's own innerText.
- `web/e2e/shell-chrome.spec.ts:63` (`expect(count).toBe(9)`, inside "single content-frame
  consistency across entities").
- `web/e2e/entities-header-states.spec.ts:189` (`expect(count).toBe(9)`, inside `ENTTBL-07:
  every one of the 9 entities' content renders inside entity-table-frame`), whose subsequent
  loop (lines 191-201) asserts `entity-table-frame` becomes visible after every click — this
  assertion will fail specifically on the Dashboard button, since the placeholder `Dashboard.svelte`
  is not an `EntityScreen` and renders no `entity-table-frame`.
**Warning signs:** A Playwright failure reading "expected 9, got 6" (or similar) on a test whose
name contains no reference to `etapas`/`tarefas`/`subtarefas`/`templatesRotina` at all.

**Concrete fix per file:**
- `shell-nav.spec.ts:19` → change `9` to `6`; the per-button loop at lines 21-26 (`h2` text
  must equal the clicked button's own `innerText()`) will keep passing for the Dashboard button
  IF the placeholder `Dashboard.svelte` renders an `<h2>Dashboard</h2>` (matching the button's
  literal label text) — mirroring `EntityScreen.svelte:448`'s own `<h2>{config.titulo}</h2>`
  convention. This is the lowest-diff fix (one number change, one `<h2>` added to the new
  placeholder) versus rewriting the loop to special-case Dashboard.
- `shell-chrome.spec.ts:63` → change `9` to `6`; no other change needed (that test only checks
  bounding-box geometry, not per-entity content).
- `entities-header-states.spec.ts:189` → this test is explicitly about *entities*, and
  Dashboard is explicitly not an entity (CONTEXT.md, spec §3), so the correct fix is not "9→6"
  but excluding the dashboard button from the locator and changing the count to `5`:
  `page.locator('[data-testid^="nav-"]:not([data-testid="nav-dashboard"])')`, count `5`.

### Pitfall 2: Building `gotoNested` around UI that doesn't exist yet in this phase
**What goes wrong:** NAV-05 requires migrating 27 call sites across 7 spec files (enumerated
below) from `nav-<nested-etype>` clicks to a `gotoNested(page, etype)` helper — but the
master-detail UI that will eventually host these nested entities (Projetos/Rotinas/Tickets
sections) is explicitly out of scope for Phase 18 (deferred to Phases 19-20). If the planner
assumes `gotoNested` drills through a real parent section, the plan will be blocked on work
this phase's own boundary forbids.
**Why it happens:** spec-ui.md §1.4's wording ("Os specs que os usam passam a navegar pelo
caminho aninhado") describes the *end-state* milestone behavior, not literally what must exist
after Phase 18 alone.
**How to avoid:** Give `gotoNested` a stable *public signature* (`gotoNested(page, etype)`)
whose *internal implementation* is allowed to change across phases without touching any of the
27 call sites again. In Phase 18, implement it against a minimal, fully generic interim
affordance (see Open Questions below for the recommended concrete shape) rather than against
UI Phase 19-20 haven't built. When Phase 19-20 land the real nested UI, only `gotoNested`'s
body needs to change — not any spec file.
**Warning signs:** A plan task that says "add etapas drill-down inside Projetos section" as a
Phase 18 deliverable — that is Phase 19's NEST-02, not Phase 18's NAV-05.

### Pitfall 3: `EntityScreen`'s snapshotted `config` prop pattern extends naturally, but only if you follow it
**What goes wrong:** `EntityScreen.svelte:37` deliberately snapshots the reactive `configProp`
into a plain `const config = configProp;` specifically to avoid a Svelte "state referenced
locally" warning on every non-reactive read. Adding `scopeWhere`/`presetLinks` as `$state`-like
reactive reads instead of the same snapshot pattern will reintroduce that exact warning class
across every new read site (`buildQuery`, `startCreate`).
**How to avoid:** Snapshot them the same way: `const scopeWhereSnapshot = scopeWhere;` (or
simply reference the destructured `$props()` locals directly without re-wrapping in `$state`,
since props default values already produce plain bindings, not reactive state).

## Code Examples

### Reassigned `ordem` values (spec-ui.md §1.2, verbatim mapping)
```
// Primary (topbar order):
instanciasRotina: 1   // navTitulo: "Rotinas"
tickets:          2
projetos:         3
fundos:           4
logInferenciaClaude: 5   // navTitulo: "Log"

// Nested (irrelevant to nav, only for stable registry sort — recommend 10+):
etapas:           10
tarefas:          11
templatesRotina:  12
subtarefas:       13
```
Current (pre-Phase-18) values, for the diff: `fundos: 1, projetos: 2, etapas: 3, tarefas: 4,
templatesRotina: 5, instanciasRotina: 6, tickets: 7, subtarefas: 8, logInferenciaClaude: 9`
[VERIFIED: `web/src/lib/entities/defs/fundos.ts:10` (`ordem: 1,`), `projetos.ts:12` (`ordem: 2,`),
`etapas.ts:18` (`ordem: 3,`), `tarefas.ts:16` (`ordem: 4,`), `templatesRotina.ts:31` (`ordem: 5,`),
`instanciasRotina.ts:42` (`ordem: 6,`), `tickets.ts:16` (`ordem: 7,`), `subtarefas.ts:19`
(`ordem: 8,`), `logInferenciaClaude.ts:26` (`ordem: 9,`)].
`registry.test.ts:236-244` only asserts *uniqueness* of `ordem`, not specific values — this
reassignment cannot break that test as long as the 9 new values stay pairwise distinct
[VERIFIED: web/src/lib/entities/registry.test.ts:236-244, quoted: `test("every config's ordem
is unique across the registry", () => { const seen = new Map<number, string>(); for (const
config of entityConfigs) { const prior = seen.get(config.ordem); expect(prior, ...).toBeUndefined();
seen.set(config.ordem, config.etype); } });`].

### `Route` type (spec-ui.md §1.3, verbatim)
```typescript
type Route =
  | { section: "dashboard" }
  | { section: "entity"; etype: string; tab?: string; selectedId?: string | null };
let rota = $state<Route>({ section: "dashboard" });
```
No existing file in this codebase uses a discriminated-union `$state` for navigation — the
closest existing pattern is `LoginScreen.svelte:18`'s `let step = $state<"email" | "code">("email");`
(a flat string-literal union, not an object union) [VERIFIED: web/src/lib/auth/LoginScreen.svelte:18].
`Shell.svelte`'s current `ativo` is likewise a flat `$state(entityConfigs[0].etype)` (inferred
`string`, not even a literal union) [VERIFIED: web/src/lib/Shell.svelte:13]. This phase is the
first introduction of an object-shaped discriminated-union `$state` anywhere in `web/src` — there
is no existing in-repo pattern to imitate beyond the rune mechanics themselves.

## Runtime State Inventory

Not applicable — this phase is additive UI restructuring, not a rename/rebrand/data-migration.
No stored data, live external service config, OS-registered state, secret/env var name, or
build artifact carries the string `nav-etapas`/`nav-templatesRotina`/`nav-subtarefas`/
`nav-tarefas` outside the e2e spec files themselves (these are Playwright `data-testid` selector
strings, not persisted data — confirmed by grep scope: all 27 hits are inside `web/e2e/*.spec.ts`
test bodies, none inside `shared/`, `.env*`, or any InstantDB record).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | Topbar shows exactly 6 items, in order: Dashboard, Rotinas, Tickets, Projetos, Fundos, Log | `navConfigs` filter + reassigned `ordem` (Code Examples) + Shell topbar loop (Pattern 3) fully specify this; `navConfigs.length` will be 5 + 1 literal Dashboard entry = 6 |
| NAV-02 | No first-level nav path for Etapas/Templates/Subtarefas/Tarefas | Achieved by `nav: "nested"` excluding them from `navConfigs`; see Open Questions for the residual tension with NAV-05's e2e-migration requirement |
| NAV-03 | Initial route is Dashboard | `let rota = $state<Route>({ section: "dashboard" })` — Shell's current `ativo = entityConfigs[0].etype` (Shell.svelte:13) is the exact line being replaced |
| NAV-04 | `EntityConfig` gains `nav?`/`navTitulo?`; `registry.ts` gains `navConfigs` selector, no manual list | Pattern 2 gives the exact one-line derived export; `types.ts:28-39`'s current `EntityConfig` interface is the exact insertion point |
| NAV-05 | 5 unchanged primary testids; 4 dead testids removed; e2e migrates via `gotoNested` | Full 27-call-site / 7-file enumeration below, PLUS the 3 additional wildcard-count files (Pitfall 1) not named in CONTEXT.md's own description of this requirement |
| NEST-01 | `EntityScreen` gains additive `scopeWhere`/`presetLinks`, byte-identical when both `null`, zero `if (config.etype === ...)` | Pattern 1 gives the exact two integration points (`buildQuery` line 61-68, `startCreate` line 195-211) with the precise conditional-spread expressions that degrade to today's literal output |
| NEST-06 | Fundos and Log sections unchanged, only reordered | No code change to `fundos.ts`/`logInferenciaClaude.ts` beyond `ordem` (and `navTitulo` on Log); their `EntityScreen` mount path is untouched by Pattern 3's Shell diff |

**e2e migration — 7 files with direct dead-testid references (27 call sites total), exact
line numbers [VERIFIED: `grep -rn 'nav-etapas\|nav-templatesRotina\|nav-subtarefas\|nav-tarefas' web/e2e`]:**

| File | Lines | Count | Testid(s) used |
|------|-------|-------|-----------------|
| `web/e2e/entities-ticket-subtarefa.spec.ts` | 226, 263, 296, 323, 361, 394, 415, 439, 450 | 9 | `nav-subtarefas` |
| `web/e2e/entities-delete-confirmation.spec.ts` | 102, 154, 192, 223, 262 | 5 | `nav-tarefas` |
| `web/e2e/entities-projeto-etapa-tarefa.spec.ts` | 229, 258, 284, 346 | 4 | `nav-etapas` (×3), `nav-tarefas` (×1) |
| `web/e2e/entities-form-dialog-composition.spec.ts` | 42, 100, 178 | 3 | `nav-tarefas` |
| `web/e2e/cross-phase-verification.spec.ts` | 356, 380 | 2 | `nav-tarefas` |
| `web/e2e/entities-form-restyle.spec.ts` | 292, 425 | 2 | `nav-templatesRotina`, `nav-subtarefas` |
| `web/e2e/entities-rotina-log.spec.ts` | 119, 172 | 2 | `nav-templatesRotina` |

Every single one of these 27 call sites follows the identical flat pattern
`await page.goto("/"); await page.getByTestId("nav-<nested-etype>").click();` immediately
followed by generic-CRUD interaction (`entity-create-start`, `field-*`, `row-edit`, etc.) —
**none of them test nesting, scoping, or a parent-child relationship**; they are plain
full-screen CRUD round-trips for that entity in isolation [VERIFIED: sampled contexts at
`entities-projeto-etapa-tarefa.spec.ts:227-229`, `entities-ticket-subtarefa.spec.ts:224-226`,
`entities-form-restyle.spec.ts:291-292`, `entities-rotina-log.spec.ts:118-119`,
`entities-delete-confirmation.spec.ts:101-102`, `entities-form-dialog-composition.spec.ts:41-42`,
`cross-phase-verification.spec.ts:355-356`]. This means `gotoNested(page, etype)` only needs to
reach a **standalone full-screen `EntityScreen` for that etype** — it does not need to prove any
scoping/parent-selection behavior, which significantly narrows what the interim Phase 18
implementation must actually do (see Open Questions).

**3 additional files requiring a count fix, not a dead-testid swap** (Pitfall 1): `shell-nav.spec.ts:19`,
`shell-chrome.spec.ts:63`, `entities-header-states.spec.ts:189`.
</phase_requirements>

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gotoNested`'s interim (Phase 18) implementation should render a minimal, fully-generic, non-`nav-`-prefixed secondary navigation affordance (e.g. `data-testid="nested-goto-<etype>"`) driven by `entityConfigs.filter(c => c.nav === "nested")`, so it never collides with the `[data-testid^="nav-"]` wildcard used by `shell-nav.spec.ts`/`shell-chrome.spec.ts`/`entities-header-states.spec.ts` | Common Pitfalls #2, Open Questions | If the planner instead reuses the `nav-` prefix for this interim affordance, all three wildcard-count fixes in Pitfall 1 need a different (higher) count, coupling two independent pieces of work; if the planner instead routes `gotoNested` through `page.evaluate` to poke Svelte internals directly, it breaks this codebase's established "every e2e interaction goes through a real DOM element" convention (no precedent for that shortcut exists anywhere in `web/e2e/helpers/`) |
| A2 | The placeholder `Dashboard.svelte` should render an `<h2>Dashboard</h2>` (matching `EntityScreen.svelte:448`'s `<h2>{config.titulo}</h2>` convention) specifically so `shell-nav.spec.ts`'s per-button `h2`-text-equals-label loop keeps passing with a one-line count fix (9→6) instead of a loop rewrite | Common Pitfalls #1 | If Dashboard has no matching `<h2>`, that test needs its loop logic changed (skip/special-case the Dashboard button), a larger diff than CONTEXT.md's "minimal Dashboard mount point" framing implies |
| A3 | Nested defs' new `ordem` values (10/11/12/13 for etapas/tarefas/templatesRotina/subtarefas respectively) are safe to pick arbitrarily as long as they are ≥10 and pairwise unique, since `registry.test.ts` only checks uniqueness, not specific values | Code Examples | Extremely low risk — verified directly by reading the uniqueness-only assertion at `registry.test.ts:236-244`; only wrong if a future test (not present today) starts asserting specific nested `ordem` values |

**If this table is empty:** N/A — see rows above; all three require a locked-decision confirmation
before the plan executes them literally, since CONTEXT.md's "Claude's Discretion" section covers
"exact Shell.svelte internal structure" but does not explicitly resolve the NAV-02/NAV-05 tension
A1 addresses.

## Open Questions

1. **How does `gotoNested(page, etype)` reach a nested entity's `EntityScreen` in Phase 18,
   given that no parent master-detail UI exists yet?**
   - What we know: NAV-05 is scoped to Phase 18 (REQUIREMENTS.md traceability table); the
     master-detail UIs that would nest these entities (NEST-02 Projetos, NEST-04 Rotinas,
     NEST-05 Tickets/Tarefas panel) are scoped to Phase 19/20 (same table); all 27 existing call
     sites only need a standalone full-screen `EntityScreen` for the nested etype, not scoping
     behavior (verified via context sampling above).
   - What's unclear: whether the interim affordance A1 recommends (a small, visually secondary,
     fully generic button strip for `nav === "nested"` configs, testid-namespaced outside
     `nav-`) satisfies the *spirit* of NAV-02 ("no first-level nav path") given it is still a
     directly-clickable, un-nested control — or whether CONTEXT.md's author intended something
     stricter that this research did not surface.
   - Recommendation: implement A1's interim affordance now (it is generic, additive, requires
     no per-etype code, and is trivially superseded — only `gotoNested`'s body changes — once
     Phase 19/20 land real nested UI); flag explicitly to the user/planner that this is the
     assumption being locked in, since CONTEXT.md's "Claude's Discretion" section does not
     unambiguously cover this specific tension.

2. **Exact ordering among the 4 nested defs' `ordem` 10+ values** — not required by any test or
   spec passage (spec-ui.md §1.2 says only "10+", "irrelevant to nav, only for stable registry
   sort"); A3 gives one reasonable assignment (10/11/12/13) but any pairwise-distinct set ≥10
   satisfies every verified constraint.

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependency beyond the
project's existing Vite/Bun/Playwright toolchain, all already installed and exercised by every
prior phase's e2e run (`web/README.md`'s "Running the e2e suite" section documents 3 Playwright
projects already green as of Phase 17).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test` ^1.62.1 (e2e), `bun test` (unit — `registry.test.ts`) [VERIFIED: web/package.json devDependencies `"@playwright/test": "^1.62.1"`] |
| Config file | `web/playwright.config.ts` (testDir `./e2e`, projects `setup`/`authed`/`anon`) [VERIFIED: web/playwright.config.ts:7,21-39] |
| Quick run command | `cd web && bunx playwright test --project=authed --no-deps` (reuses persisted auth state, no magic-code email) |
| Full suite command | `cd web && bun run test:e2e` (all 3 projects, from `package.json` script `"test:e2e": "playwright test"`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | Topbar shows exactly 6 items in order | e2e | `bunx playwright test shell-nav.spec.ts --project=authed --no-deps` | ✅ existing, needs the 9→6 count edit (Pitfall 1) |
| NAV-02 | No first-level path to 4 nested entities | e2e | new assertion needed: nested etypes' testids absent from primary `<nav>` | ❌ Wave 0 — no existing spec asserts an *absence*; add one |
| NAV-03 | Initial route is Dashboard | e2e | new assertion: fresh `page.goto("/")` shows Dashboard content, no entity table | ❌ Wave 0 |
| NAV-04 | `navConfigs` derived, no manual list | unit | `cd web && bun test src/lib/entities/registry.test.ts` | ❌ Wave 0 — extend `registry.test.ts` with a `navConfigs` structural assertion |
| NAV-05 | `nav-<etype>` unchanged for 5 primaries; 4 dead testids gone; e2e migrated via `gotoNested` | e2e | `bun run test:e2e` (full suite; the 7 migrated files + 3 count-fixed files ARE the regression proof) | ✅ existing files, all need the edits enumerated above |
| NEST-01 | `EntityScreen` additive, byte-identical when both props null | e2e | `bun run test:e2e` full suite unedited pass = the proof (per CONTEXT.md: "the entire pre-existing Playwright suite is the regression proof, not new tests") | ✅ — this requirement is proven by NOT writing new tests, only by the existing suite staying green |
| NEST-06 | Fundos/Log unchanged | e2e | `bunx playwright test entities-fundos.spec.ts entities-rotina-log.spec.ts --project=authed --no-deps` | ✅ existing, zero edits expected to these two files' Fundos/Log-specific assertions (only `entities-rotina-log.spec.ts`'s `nav-templatesRotina` lines need the `gotoNested` swap — the Log/Rotina-instância assertions in that same file are untouched) |

### Sampling Rate
- **Per task commit:** `cd web && bunx playwright test --project=authed --no-deps <changed-spec-file>`
- **Per wave merge:** `cd web && bun run test:e2e` (full 3-project suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus `bun test src` (unit,
  `registry.test.ts`) for the `navConfigs`/`ordem` structural assertions.

### Wave 0 Gaps
- [ ] A new assertion proving NAV-02 (absence of `nav-etapas`/`nav-templatesRotina`/
  `nav-subtarefas`/`nav-tarefas` from the DOM) — none of the 10 files this research audited
  assert an *absence*, only presence/count.
- [ ] A new assertion proving NAV-03 (fresh load lands on Dashboard, not the first
  `entityConfigs` entry) — `shell-nav.spec.ts`'s existing tests all assume an entity screen is
  active by default (`ativo` defaults to `entityConfigs[0].etype` today); this default is being
  removed and needs its own positive assertion.
- [ ] `web/e2e/helpers/gotoNested.ts` — does not exist yet; needs the same lightweight,
  no-class, plain-async-function style as `web/e2e/helpers/form-controls.ts` and
  `web/e2e/helpers/magic-code.ts` (both sampled this session).
- [ ] `registry.test.ts` extension covering `navConfigs` (currently zero assertions reference
  `nav`/`navTitulo`/`navConfigs` — [VERIFIED: `grep -n 'nav\b\|navTitulo\|navConfigs'
  registry.test.ts` returned no matches]).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged this phase — `SignedIn`/magic-code flow untouched |
| V3 Session Management | no | Unchanged — `db.useAuth()` usage untouched |
| V4 Access Control | yes (narrow) | `scopeWhere` is a **client-side query convenience only** — it narrows what `EntityScreen` *displays/creates against*, it is not and must never be treated as an access-control boundary. The real access-control boundary remains InstantDB's `instant.perms.ts`, which this phase explicitly does not touch (REQUIREMENTS.md "Out of Scope": "Qualquer mudança em ... `instant.perms.ts`"). A malicious or buggy `scopeWhere` value can at most show/create the wrong rows for the *same already-authorized owner* (`donoId` scoping is unaffected — see below) — it cannot expose another user's data, since every InstaQL query InstantDB executes is still filtered server-side by the owner's permission rules regardless of what `where` clause the client sends. |
| V5 Input Validation | yes | Existing pattern unchanged: `EntityScreen.svelte`'s `handleSubmit` (lines 262-411) already validates required fields/links/xorLink before `db.transact`; `presetLinks` values flow through the exact same `selectedLinks` state and the exact same submit-time validation — no new validation surface is introduced. |
| V6 Cryptography | no | Not touched this phase. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A caller passes an unvalidated `scopeWhere` object that widens rather than narrows the query (e.g. `{}` intending "no scope" but actually matching everything, or a malformed key InstantDB's InstaQL silently ignores) | Tampering (of the intended query scope, not of data itself) | Not a security boundary — see V4 above — but a correctness risk. Recommend the (future, Phase 19/20) callers of `scopeWhere` always construct it from a known-existing parent id (`{ "ticket.id": ticket.id }`) rather than user input, and that this phase's own verification proves the `null` path is unaffected (NEST-01's whole point) rather than attempting to validate arbitrary future `scopeWhere` shapes now. |
| `presetLinks` pre-filling a link the user could otherwise not select (e.g. a link to a record they don't own) | Elevation of Privilege (client-side only) | Not exploitable beyond what today's `link-<label>` `<select>` already allows — `presetLinks` only changes the *initial* value of `selectedLinks[label]`, which the existing submit-time parent-existence check (`EntityScreen.svelte:332-343`, `db.queryOnce` + `rows.length === 0` → `parent_not_found` error) already re-validates against the live database at submit time, regardless of how `selectedLinks` was populated. |

This phase's true security-relevant boundary (InstantDB permissions) is unchanged; the two new
props are display/UX convenience layered entirely inside the already-authorized query surface.

## Sources

### Primary (HIGH confidence — files read directly this session)
- `/home/thomaz/pessoal/apollo-v2/spec-ui.md` §0, §1, §2.1 (binding spec, read in full)
- `/home/thomaz/pessoal/apollo-v2/.planning/phases/18-navigation-foundation-entityscreen-extension/18-CONTEXT.md`
- `/home/thomaz/pessoal/apollo-v2/.planning/REQUIREMENTS.md`
- `/home/thomaz/pessoal/apollo-v2/.planning/ROADMAP.md` (Phase 18-23 sections)
- `/home/thomaz/pessoal/apollo-v2/.planning/config.json`
- `web/src/lib/Shell.svelte` (full file, 106 lines)
- `web/src/lib/entities/types.ts` (full file, 39 lines)
- `web/src/lib/entities/registry.ts` (full file, 37 lines)
- `web/src/lib/entities/EntityScreen.svelte` (full file, 848 lines)
- `web/src/lib/entities/registry.test.ts` (structural assertions relevant to `ordem`/capabilities)
- `web/src/lib/entities/defs/{etapas,fundos,instanciasRotina,logInferenciaClaude,projetos,subtarefas,tarefas,templatesRotina,tickets}.ts` (all 9)
- `web/e2e/shell-nav.spec.ts`, `web/e2e/shell-chrome.spec.ts` (full files)
- `web/e2e/entities-header-states.spec.ts` (relevant sections)
- `web/e2e/{entities-ticket-subtarefa,entities-delete-confirmation,entities-projeto-etapa-tarefa,entities-form-dialog-composition,cross-phase-verification,entities-form-restyle,entities-rotina-log}.spec.ts` (grep + context around every dead-testid hit)
- `web/e2e/helpers/form-controls.ts` (existing helper style precedent)
- `web/README.md` (registry/defs pattern documentation)
- `web/src/App.svelte` (`app-shell` wrapper confirmation)
- `web/package.json`, `web/playwright.config.ts` (test tooling versions/config)
- `web/src/lib/components/ui/` directory listing (confirms no `tabs`/`accordion`/`scroll-area`/`tooltip` installed yet)

### Secondary (MEDIUM confidence)
None — no external documentation lookup was needed; this is a 100% in-repo research task.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all patterns already exist in-repo and were read directly
- Architecture: HIGH — every integration point (buildQuery, startCreate, Shell's nav loop) quoted verbatim with line numbers
- Pitfalls: HIGH — the two most valuable findings (3 hidden wildcard-count e2e files; the NAV-02/NAV-05 UI-doesn't-exist-yet tension) were discovered by direct grep/read, not inferred

**Research date:** 2026-08-11
**Valid until:** Stable until Phase 18's plan is written and executed — this research is tied to the exact current file contents (line numbers cited); if any of `Shell.svelte`, `EntityScreen.svelte`, `registry.ts`, or the audited e2e files change before planning consumes this document, line-number references should be re-verified.
