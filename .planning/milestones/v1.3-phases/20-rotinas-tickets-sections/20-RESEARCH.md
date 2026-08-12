# Phase 20: Rotinas & Tickets Sections - Research

**Researched:** 2026-08-11
**Domain:** Svelte 5 SPA nested-entity UI composition over a shared generic `EntityScreen` engine (InstantDB-backed), zero new packages
**Confidence:** HIGH (every claim below is grounded in a file read this session; no web search was used — all four search providers are disabled in `.planning/config.json` and none were needed, this is a pure in-repo composition problem)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Binding spec: `/home/thomaz/pessoal/apollo-v2/spec-ui.md` §2.3 ("Rotinas") and §2.4 ("Tickets e
subtarefas, base: 1d") — read in full before planning, plus §0. Locked decisions:

- **RotinasSection**: `Tabs.Root` with two tabs — "Instâncias" (default) and "Templates".
  Instâncias tab = `EntityScreen` of `instanciasRotina` exactly as today (`capabilities.create`/
  `.delete` stay `false`, `updatableFields: ["status"]` only — zero new affordance). Templates
  tab = `EntityScreen` of `templatesRotina` exactly as today, plus a static context paragraph
  ("configuração que gera as instâncias").
- **TicketsSection**: `EntityScreen` of `tickets`; selecting a row opens an inline side panel
  (`w-56`, `border`, inside the Shell content frame — explicitly NOT a new `Sheet` component per
  spec §7's "não adicionar: sheet") showing that ticket's subtarefas.
- **Shared `SubtarefasPanel.svelte`**: one component, used from both TicketsSection (opened from
  a selected ticket) and from wherever a task is shown (Phase 19's `ProjetosSection` etapa-detail
  task rows — their subtarefa count chip becomes a real trigger for this same panel, replacing
  the "passive count only" placeholder Phase 19 CONTEXT.md explicitly deferred to this phase).
  The panel is `EntityScreen` of `subtarefas` with `scopeWhere: {"ticket.id": <id>}` or
  `{"tarefa.id": <id>}` and `presetLinks: { ticket: <id> }` or `{ tarefa: <id> }` — both using
  Phase 18's additive props, no new prop, no `if (etype===...)` anywhere.
  **Research finding: the `presetLinks` half of this decision does not work as stated for
  create — see Pitfall 1 below. `scopeWhere` for listing/filtering works exactly as decided.**
- **`xor-parent-type` never touched by the user in this flow**: because the panel always opens
  already scoped/pre-resolved to one concrete parent (ticket or tarefa), the generic form's
  existing `xor-parent-type` selector (unchanged, still exists in the generic engine) is
  pre-filled and the user's normal path never needs to interact with it.
  **Research finding: this is achievable, but not "for free" via `presetLinks` alone — it
  requires SubtarefasPanel to drive the DOM itself on create (Pattern 1); on edit it already
  works for free (Pitfall 2).**
- Fundos and Log sections are untouched (NEST-06, already satisfied by Phase 18 — not this
  phase's concern, no regression expected).

### Claude's Discretion

Exact panel layout/trigger UI (icon button vs. text link vs. clicking the whole subtarefa chip),
whether `SubtarefasPanel` is a fully standalone component or a thin wrapper that composes
`EntityScreen` directly — guided by spec §0/§2.3/§2.4 and existing Phase 18/19 conventions
(hidden-EntityScreen-instance pattern is available if useful, but a panel is more naturally a
directly-visible mounted `EntityScreen` with `scopeWhere`/`presetLinks`, not hidden).

### Deferred Ideas (OUT OF SCOPE)

- Dashboard real content — Phase 21-22
- Dialog system — Phase 23
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NEST-04 | Rotinas section has Instâncias (default, no create/delete affordance) and Templates (with context paragraph) tabs | Architecture Patterns (system diagram, RotinasSection structure); Standard Stack (Tabs already installed); Validation Architecture (test map row) — this half of the phase has no open technical gap |
| NEST-05 | Selecting a ticket row opens an inline (non-Sheet) panel showing that ticket's subtarefas via scoped `EntityScreen`; the same panel opens from a tarefa; the `xor-parent-type` selector is never touched by the user | Pitfall 1 (the core gap: `presetLinks` does not reach `xorParentType`/`xorParentId`), Pattern 1 (the DOM-driving resolution that avoids touching `EntityScreen.svelte`), Pitfall 2 (edit path already correct), Pitfall 3/4 (e2e migration consequences), Code Examples (exact chip location to wire up), Open Question 1 (whether create-from-panel is even required) |
</phase_requirements>

## Summary

Phase 20 is pure composition over code that already exists and is already proven: `EntityScreen.svelte`'s
`scopeWhere`/`presetLinks` additive props (Phase 18), the Tabs/Accordion/ScrollArea shadcn components
(already installed, used by Phase 19's `ProjetosSection.svelte`), and the "hidden-EntityScreen-instance"
pattern Phase 19 established for driving create/edit dialogs from outside `EntityScreen.svelte` without a
third prop or an etype branch. `RotinasSection.svelte` is the easy half: two `Tabs.Content` blocks each
mounting an unmodified `EntityScreen` — no scoping props needed at all, since neither tab is nested under
a concrete parent record.

`TicketsSection.svelte` + `SubtarefasPanel.svelte` is where a real, previously-invisible gap surfaces.
**`presetLinks` (Phase 18's additive prop) does not — and structurally cannot, without editing
`EntityScreen.svelte` — pre-fill `subtarefas`' `xorLink` selector.** `presetLinks` is spliced only into
`selectedLinks`, the state backing `config.links` (plain 1:1 links); `subtarefas.ts` declares no `links`
array at all, only an `xorLink` with two choices (`tarefa`, `ticket`). The xor selector's own state
(`xorParentType`/`xorParentId`) is set in `startCreate()` unconditionally to `config.xorLink.choices[0]`
and `""` — `presetLinks` is never read on that code path (`EntityScreen.svelte:203-219`). So mounting
`EntityScreen` with `scopeWhere` + `presetLinks` correctly **filters the list** (scopeWhere is fully
independent of xorLink internals) but does **not** pre-resolve the create form's parent selector the way
CONTEXT.md's decision log assumes. This is the one finding the planner must design around, without
touching `EntityScreen.svelte` again (it already has its one permitted additive extension).

**Primary recommendation:** Build `RotinasSection.svelte` as a thin `Tabs.Root` wrapper mounting
`EntityScreen(instanciasRotinaConfig)` / `EntityScreen(templatesRotinaConfig)` verbatim, zero scoping
props. Build `SubtarefasPanel.svelte` as a directly-visible `EntityScreen(subtarefasConfig, scopeWhere,
presetLinks)` for the **list/toggle/edit/delete** surface (this part works today, verified) plus a
locally-cloned config (`{ ...subtarefasConfig, capabilities: { ...subtarefasConfig.capabilities, create:
false } }`) to suppress the generic "novo" button's broken xor-defaulting inside the panel, paired with
the panel's own `<button>` that drives a **second, hidden** `EntityScreen(subtarefasConfig)` instance using
the exact click-driven pattern `ProjetosSection.svelte`'s `openEtapaDialog`/`openTarefaDialog` already use
(`EntityScreen.svelte:712-798`'s testids `xor-parent-type`, `link-tarefa`, `link-ticket` are public, stable
DOM surface) — the wrapper opens the create dialog, then programmatically clicks the correct xor-type
option and the correct target-id option, so the **user** never touches the selector even though the
selector itself is unmodified and still exists in the DOM.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rotinas tabbed browse (Instâncias/Templates) | Browser/Client (Svelte component) | API/Backend (InstantDB query, unchanged) | Pure UI composition; no new query shape, reuses `EntityScreen`'s existing `db.useQuery` per tab |
| Ticket list + selection | Browser/Client | — | `EntityScreen(tickets)` unchanged; selection state (`selectedTicketId`) is local `$state` in `TicketsSection.svelte`, no store |
| Subtarefas scoped list/toggle/delete | Browser/Client (SubtarefasPanel wraps EntityScreen) | Database/Storage (InstantDB `where` filter via `scopeWhere`) | `scopeWhere: {"ticket.id"/"tarefa.id": <id>}` is a client-issued InstaQL filter, not a server authorization boundary (see Security Domain) |
| Subtarefa create (parent pre-resolution) | Browser/Client (SubtarefasPanel's own driver code) | — | Cannot be pushed to `EntityScreen.svelte` (forbidden to touch again) or to the API tier (no schema/perms change permitted this milestone) — must be solved entirely in the new component via DOM-level click-driving of the existing generic form |
| Passive subtarefa count chip → real trigger | Browser/Client (ProjetosSection.svelte) | — | Becomes a `<button>` calling into the same `SubtarefasPanel`/open-panel mechanism TicketsSection uses; no new query, reuses `ProjetosSection`'s already-loaded `tarefa.subtarefas` data for the *count*, but the *panel itself* still issues its own scoped `EntityScreen` query (do not try to feed ProjetosSection's nested query data into the panel — different components, different data-fetch boundary) |
| Interim `nestedGroups` dropdown retirement | Browser/Client (Shell.svelte) | — | Router-level bookkeeping only; no data-layer impact |

## Standard Stack

No new libraries. This phase adds zero npm packages and zero new shadcn-svelte components.

### Core (already installed, reused as-is)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `$lib/components/ui/tabs` (bits-ui `Tabs`) | already vendored | Instâncias/Templates tabs (RotinasSection); already used identically by `ProjetosSection.svelte:361-372,588` for its "Projeto"/"Todas as tarefas" tabs [VERIFIED: web/src/lib/sections/ProjetosSection.svelte:13,367-372] | Established in-repo pattern from Phase 19, zero new surface |
| `$lib/components/ui/badge` | already vendored | The subtarefa count chip already renders as a `Badge` [VERIFIED: web/src/lib/sections/ProjetosSection.svelte:502-507] — Phase 20 turns its container into a `<button>`, keeps the `Badge` inside it |
| `EntityScreen.svelte` (`scopeWhere`/`presetLinks`) | Phase 18, unmodified | Powers TicketsSection's ticket table, RotinasSection's two tabs, and SubtarefasPanel's scoped subtarefa table | The one sanctioned generic-reuse mechanism; spec-ui.md §0.6 forbids a second extension |

### Package Legitimacy Audit

Not applicable — no packages installed. `web/src/lib/components/ui/` already contains `tabs`, `scroll-area`,
and `accordion` [VERIFIED: `ls web/src/lib/components/ui/` output: accordion, alert, alert-dialog, badge,
button, calendar, card, checkbox, dialog, empty, input, label, popover, scroll-area, select, separator,
skeleton, sonner, table, tabs, textarea] — every shadcn-svelte primitive spec-ui.md §7 calls for in this
phase ("tabs — abas internas de Rotinas e Projetos") is already present from Phase 19's own setup. No
`npx shadcn-svelte add` invocation is needed in this phase's plan.

## Architecture Patterns

### System Architecture Diagram

```
Shell.svelte (router: rota.section === "entity", rota.etype === "instanciasRotina" | "tickets")
   │
   ├─ rota.etype === "instanciasRotina" ──► RotinasSection.svelte
   │        │
   │        ├─ Tabs.Root value="instancias" (default)
   │        │     └─ EntityScreen(instanciasRotinaConfig)      -- unchanged, zero props
   │        └─ Tabs.Content value="templates"
   │              ├─ <p> static context paragraph
   │              └─ EntityScreen(templatesRotinaConfig)       -- unchanged, zero props
   │
   └─ rota.etype === "tickets" ──► TicketsSection.svelte
            │
            ├─ EntityScreen(ticketsConfig)                      -- unchanged, zero props
            │     (selecting a row sets local $state selectedTicketId)
            │
            └─ {#if selectedTicketId}
                  SubtarefasPanel  parentType="ticket" parentId={selectedTicketId}
                     │
                     ├─ visible: EntityScreen(
                     │     { ...subtarefasConfig, capabilities: {...c, create:false} },
                     │     scopeWhere={{"ticket.id": selectedTicketId}},
                     │     presetLinks={{ ticket: selectedTicketId }}   -- harmless no-op for xor,
                     │   )                                              -- correct for list filtering
                     │
                     └─ own "+ nova subtarefa" <button> ──► drives a SECOND hidden
                           EntityScreen(subtarefasConfig) instance's own create dialog:
                           1. .click() on its own [data-testid="entity-create-start"]
                           2. .click() on [data-testid="xor-parent-type"], then the matching
                              [role="option"] (e.g. "ticket")
                           3. .click() on [data-testid="link-ticket"], then the option matching
                              selectedTicketId's label
                           4. fill titulo/ordem, .click() [data-testid="entity-submit"]
                        (mirrors ProjetosSection.svelte's openEtapaDialog/openTarefaDialog
                         click-driving pattern — no new mechanism invented)

ProjetosSection.svelte (unchanged mount point, Phase 19)
   │
   └─ etapa-tarefa-row (per tarefa)
         └─ [was: inert Badge] ──► becomes <button> opening the SAME SubtarefasPanel,
               parentType="tarefa" parentId={tarefa.id}
```

### Recommended Project Structure
```
web/src/lib/sections/
├── ProjetosSection.svelte      # Phase 19, edited: chip → button (1 line + wiring)
├── RotinasSection.svelte       # NEW — Tabs wrapper, no scoping props anywhere
├── TicketsSection.svelte       # NEW — EntityScreen(tickets) + selection + <SubtarefasPanel>
└── SubtarefasPanel.svelte      # NEW — shared by TicketsSection and ProjetosSection
```

### Pattern 1: xor-parent-type is pre-resolved by code driving the DOM, not by a prop

**What:** Since `presetLinks` cannot reach `xorParentType`/`xorParentId` (see Common Pitfalls below), and
`EntityScreen.svelte` cannot be touched again, `SubtarefasPanel.svelte` must open its own hidden
`EntityScreen(subtarefasConfig)` instance for CREATE and then **click** through the already-rendered,
unmodified xor UI itself — exactly the same technique already proven live for `presetLinks`-adjacent flows
in `ProjetosSection.svelte`.

**When to use:** Any time a scoped panel needs to create a child of an `xorLink` entity with the parent
type/id already known, and the shared engine cannot be edited.

**Example (mirrors the exact established precedent):**
```svelte
<!-- Source: web/src/lib/sections/ProjetosSection.svelte:232-248 (openEtapaDialog/startCreateEtapa) -->
async function openSubtarefaDialog(selector: string): Promise<void> {
  subtarefaHostReady = true;
  await tick();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const el = subtarefaHostEl?.querySelector<HTMLButtonElement>(selector);
    if (el) { el.click(); return; }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
```
Extend this same shape with two more driven clicks (xor-type option, then target-id option) before
filling `titulo`/`ordem` and submitting — all against `EntityScreen.svelte`'s existing, unmodified,
public testids (`xor-parent-type`, `link-tarefa`, `link-ticket`) [VERIFIED: web/src/lib/entities/EntityScreen.svelte:756,774].

### Pattern 2: scopeWhere for a link-scoped list needs no new mechanism

**What:** `scopeWhere: { "ticket.id": <id> }` / `{ "tarefa.id": <id> }` merges straight into
`buildQuery`'s `$: { where: scopeWhere }` [VERIFIED: web/src/lib/entities/EntityScreen.svelte:69-76 —
`function buildQuery(cfg: EntityConfig): Record<string, unknown> { ... return { [cfg.etype]: { $:
scopeWhere ? { where: scopeWhere } : {}, ...sub } }; }`]. This dotted-link-field where-clause shape is
already live and proven working in production code, not merely theorized: `ProjetosSection.svelte:616`
passes `scopeWhere={semEtapa ? { "etapa.id": { $isNull: true } } : null}` to filter `tarefas` by a link
field. A plain equality (`{"ticket.id": "<uuid>"}`) is a strictly simpler case of the same InstaQL
mechanism.

**When to use:** Every list-filtering need in this phase. Zero risk, zero new code path.

### Anti-Patterns to Avoid
- **Assuming `presetLinks` "just works" for `xorLink` entities:** It only ever populates
  `selectedLinks[key]`, consumed solely by `config.links` (plain links). `subtarefas.ts` has no `links`
  array [VERIFIED: web/src/lib/entities/defs/subtarefas.ts:15-35 — no `links:` key present, only
  `xorLink:`]. Passing `presetLinks={{ ticket: id }}` to a mounted `EntityScreen(subtarefasConfig)` is a
  silent no-op for create — it neither errors nor helps.
- **Touching `EntityScreen.svelte` a second time:** spec-ui.md §0.6 — "É permitida exatamente uma
  extensão aditiva" [CITED: spec-ui.md:26]. The fix belongs entirely in the new `SubtarefasPanel.svelte`.
- **Mutating the shared `subtarefasConfig` singleton to force `capabilities.create: false`:** always
  spread-clone (`{ ...subtarefasConfig, capabilities: { ... } }`) — `configByEtype("subtarefas")` returns
  the same object reference every caller shares (`registry.ts:35-37`); mutating it in place would also
  disable create wherever else `subtarefasConfig` might still be referenced (e.g. any residual nested
  route left for admin/testing purposes).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Driving a bits-ui `Select` programmatically | A raw DOM `element.value = ...` assignment (does not exist on a custom listbox, not a native `<select>`) | `.click()` on the trigger testid, then `.click()` on the matching `[role="option"]` element — the same two-step interaction `web/e2e/helpers/form-controls.ts:40-43`'s `selectByText` uses in tests | bits-ui's `Select.Trigger`/`Select.Content` render a custom `role="listbox"`/`role="option"` tree (confirmed by that same helper reading `page.getByRole("listbox").getByRole("option")` at form-controls.ts:53), not a native HTML `<select>` — no `.value` setter exists |
| Suppressing a shared config's capability for one mount only | A third `EntityScreen` prop, or an `if (config.etype === "subtarefas")` branch inside `EntityScreen.svelte` | A local object-spread clone of the `EntityConfig` passed as `config` | `config` is a plain JS object prop — nothing prevents a caller-side clone; this is exactly the same "compose without touching the engine" discipline the whole milestone already follows |
| Opening a create/edit dialog for an `EntityScreen` mounted elsewhere in the DOM | A callback prop / exposed method on `EntityScreen.svelte` | The hidden-instance + `querySelector` + `.click()` pattern already proven in `ProjetosSection.svelte:185-197,232-244,256-268` | Established, tested, zero-regression precedent from the immediately preceding phase — reinventing this here would be pure risk for no benefit |

**Key insight:** Every apparent "gap" in this phase (xor pre-resolution, capability suppression,
dialog-driving from outside) already has a proven, in-repo solution shape from Phase 19 — the work is
recomposing that shape one more time, not inventing anything new.

## Runtime State Inventory

Not applicable — this phase touches no rename/refactor/migration surface. No stored data, live service
config, OS-registered state, secrets, or build artifacts reference `templatesRotina`/`subtarefas` by a
string that this phase changes. The `nestedGroups`/`gotoNested` retirement below is pure UI-routing
bookkeeping removal, not a rename.

## Common Pitfalls

### Pitfall 1: `presetLinks` silently does nothing for `xorLink` entities on create
**What goes wrong:** A plan that mounts `EntityScreen(subtarefasConfig, scopeWhere, presetLinks)` and
assumes the create form opens pre-resolved to the panel's parent. It does not.
**Why it happens:** `startCreate()`'s only use of `presetLinks` is
`selectedLinks = presetLinks ? { ...links, ...presetLinks } : links;` where `links` is built from
`config.links ?? []` [VERIFIED: web/src/lib/entities/EntityScreen.svelte:212-214, exact text: `const
links: Record<string, string> = {}; for (const link of config.links ?? []) links[link.label] = "";
selectedLinks = presetLinks ? { ...links, ...presetLinks } : links;`]. The very next two lines,
unconditionally: `xorParentType = config.xorLink ? config.xorLink.choices[0].label : null; xorParentId =
"";` [VERIFIED: web/src/lib/entities/EntityScreen.svelte:215-216]. `subtarefas.ts` has no `config.links`
entry named `ticket` or `tarefa` at all [VERIFIED: web/src/lib/entities/defs/subtarefas.ts:15-35], so the
merged key is dead weight and the xor state is always reset to the first choice (`"tarefa"`, per
`subtarefas.ts:29-32`'s literal choice order) with an empty id, regardless of what `presetLinks` says.
**How to avoid:** Do not rely on `presetLinks` for the create path of any `xorLink`-only entity (currently
only `subtarefas`). Use Pattern 1 above (drive the DOM) or descope create-from-panel in favor of the
existing nested route (rejected — see Open Questions, since CONTEXT.md and the ROADMAP both imply the
panel should make the interim route unnecessary).
**Warning signs:** An e2e test that opens the panel, clicks "+ nova subtarefa", and asserts the xor
selector already shows the correct type/id without any click on it — this assertion will fail against the
current `EntityScreen.svelte`, confirming the gap live rather than by inspection alone.

### Pitfall 2: `startEdit()` needs no fix — don't over-engineer the edit path
**What goes wrong:** Spending plan effort "fixing" xor pre-resolution for *editing* an existing subtarefa
from the panel.
**Why it happens:** Pitfall 1 is about `startCreate()` only. `startEdit()` independently walks
`config.xorLink.choices` and reads `row[choice.label]` directly off the already-loaded row to find which
parent is actually linked [VERIFIED: web/src/lib/entities/EntityScreen.svelte:250-261, exact text: `if
(config.xorLink) { for (const choice of config.xorLink.choices) { const linked = row[choice.label] ...
if (one?.id) { xorParentType = choice.label; xorParentId = one.id; ... } } }`]. This is correct today for
any row, scoped or not, and needs zero change.
**How to avoid:** Scope Phase 20's xor-fix work to CREATE only.
**Warning signs:** A plan task titled "fix xorLink pre-resolution in EntityScreen" with no distinction
between create and edit — a sign the gap's actual shape (Pitfall 1) hasn't been read from source yet.

### Pitfall 3: retiring `gotoNested`'s interim `subtarefas` branch breaks tests that need BOTH parent types in one flow
**What goes wrong:** `web/e2e/entities-ticket-subtarefa.spec.ts` has 6 tests that all currently reach
`subtarefas` via `gotoNested(page, "subtarefas")` landing on an **unscoped** table where the user is free
to pick either xor choice, including two tests that specifically create-then-switch or edit-then-switch
the parent type mid-flow [VERIFIED: web/e2e/entities-ticket-subtarefa.spec.ts:313-348,350-400 — "T-04-11:
switching parent type before submit", "T-04-11: editing a subtarefa's parent type unlinks the old
parent"]. `SubtarefasPanel` is, by design, always scoped to ONE concrete parent (a selected ticket or a
selected tarefa) — there is no unscoped destination left once the interim dropdown retires. A single
`gotoNested(page, "subtarefas")` call cannot land on "a panel scoped to whichever parent the test wants,"
because the function's signature takes only `(page, etype)`, no parent id.
**Why it happens:** `gotoNested`'s public signature is documented as stable across phases — "only this
function's body changes" [VERIFIED: web/e2e/helpers/gotoNested.ts:8-16] — which worked cleanly for
`etapas`/`tarefas` in Phase 19 because those destinations, though now parent-hosted, are still reachable
unscoped-enough (Phase 19's own comment: "Callers relying on this case must guarantee at least one projeto
exists" [VERIFIED: web/e2e/helpers/gotoNested.ts:26-30]). `subtarefas` is structurally different: the two
existing tests above need free switching between BOTH xor choices in one session, which an inherently
single-parent-scoped panel cannot offer without opening two different panels.
**How to avoid:** Do not try to force `gotoNested(page, "subtarefas")` to keep serving these two
switching tests. `entities-ticket-subtarefa.spec.ts` already tracks `chainTarefaId`/`chainTicketId` as
named fixtures at the top of the file [VERIFIED: web/e2e/entities-ticket-subtarefa.spec.ts:104-107]. Give
these call sites (and the 4 simpler creation/deletion tests in the same file) dedicated helpers driven by
the already-known concrete id (e.g. open TicketsSection → select the row matching `chainTicketId` →
assert the panel; open ProjetosSection's tarefa row matching `chainTarefaId` → click its subtarefa chip →
assert the panel) instead of routing through `gotoNested` at all. This is a call-site rewrite, not a
`gotoNested` body extension — flag it as its own plan task, not folded into the generic dropdown-removal
task.
**Warning signs:** A plan task that says "add a `templatesRotina`/`subtarefas` branch to `gotoNested.ts`"
as a single undifferentiated unit — `templatesRotina` genuinely fits that shape (see Pitfall 4), but
`subtarefas` does not.

### Pitfall 4: `templatesRotina` DOES fit the simple `gotoNested` branch-extension shape — don't over-generalize Pitfall 3's caution
**What goes wrong:** Assuming `templatesRotina`'s migration is equally fraught and needs the same
per-call-site rewrite treatment as `subtarefas`.
**Why it happens:** `templatesRotina`'s only call sites are plain CRUD flows with no xor/parent-switching
complexity — `entities-rotina-log.spec.ts`'s "WEB-06: templatesRotina full CRUD" test just needs to land on
`EntityScreen(templatesRotinaConfig)`'s table, which RotinasSection's Templates tab still provides
byte-identically once selected [VERIFIED: web/src/lib/entities/defs/templatesRotina.ts:27-77 — same
`capabilities`/`fields`/`links`/`listColumns` shape as today, mount point only moves].
**How to avoid:** Add a `templatesRotina` branch to `gotoNested.ts`'s body only (click `nav-instanciasRotina`,
click the new Templates tab testid) exactly mirroring the `etapas`/`tarefas` precedent — zero call-site
changes in `entities-rotina-log.spec.ts`, consistent with the function's documented stability guarantee.
**Warning signs:** None — this is the easy case; listed here only to prevent Pitfall 3's caution from
being over-applied.

## Code Examples

### Current `nestedGroups`/interim-dropdown shape to retire (Shell.svelte)
```svelte
<!-- Source: web/src/lib/Shell.svelte:22-51 (verbatim) -->
const HANDLED_BY_SECTION = new Set(["etapas", "tarefas"]);

const nestedGroups: { label: string; configs: EntityConfig[] }[] = (() => {
  const nested = entityConfigs.filter(
    (c) => c.nav === "nested" && !HANDLED_BY_SECTION.has(c.etype),
  );
  const groups = new Map<string, EntityConfig[]>();
  for (const cfg of nested) {
    const primaryLink = (cfg.links ?? []).find((link) => {
      const target = configByEtype(link.targetEtype);
      return target !== undefined && (target.nav ?? "primary") === "primary";
    });
    const primaryTarget = primaryLink ? configByEtype(primaryLink.targetEtype) : undefined;
    const label = primaryTarget ? primaryTarget.navTitulo ?? primaryTarget.titulo : "Outros";
    const list = groups.get(label) ?? [];
    list.push(cfg);
    groups.set(label, list);
  }
  return Array.from(groups.entries(), ([label, configs]) => ({ label, configs }));
})();
```
There are exactly 4 `nav: "nested"` entities in the whole registry — `etapas`, `tarefas`, `templatesRotina`,
`subtarefas` [VERIFIED: `grep -n "nav:" web/src/lib/entities/defs/*.ts` output: only those 4 files contain
`nav: "nested"`]. `etapas`/`tarefas` are already in `HANDLED_BY_SECTION` (Phase 19). Once Phase 20 adds
`"templatesRotina"` and `"subtarefas"` to that same Set, `nested` (line 35-36 above) filters to an empty
array, `nestedGroups` becomes `[]`, and the entire "Acesso direto (temporário)" `<Select.Root>` block
[VERIFIED: web/src/lib/Shell.svelte:146-170] renders zero groups — at that point delete the whole block
(the `<div class="flex items-center gap-2">...</div>` at lines 146-170), the `nestedGroups` computation
(lines 34-51), and the now-pointless `HANDLED_BY_SECTION` Set (line 32) together, rather than leaving a
permanently-empty dropdown mounted.

### Current `gotoNested.ts` dispatch to extend
```typescript
// Source: web/e2e/helpers/gotoNested.ts:17-46 (verbatim, current full body)
export async function gotoNested(page: Page, etype: string): Promise<void> {
  await page.goto("/");

  if (etype === "etapas") {
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("project-item").first().click();
    return;
  }

  if (etype === "tarefas") {
    await page.getByTestId("nav-projetos").click();
    await page.getByTestId("projetos-tab-todas").click();
    return;
  }

  await page.getByTestId("nested-goto").click();
  await page.getByTestId(`nested-goto-${etype}`).click();
}
```
Add a `templatesRotina` branch (click `nav-instanciasRotina`, click the new Templates tab trigger) before
the final fallback. Do **not** add a `subtarefas` branch here — per Pitfall 3, its 6 call sites need
individual, parent-id-aware rewrites in `entities-ticket-subtarefa.spec.ts` instead; leaving `subtarefas`
unhandled in `gotoNested.ts` after this phase (with every call site migrated away from calling it for that
etype) is the correct end state, not a gap.

### The exact chip to wire up (ProjetosSection.svelte)
```svelte
<!-- Source: web/src/lib/sections/ProjetosSection.svelte:472-509 (relevant excerpt, verbatim) -->
<div data-testid="etapa-tarefas-list" class="space-y-2">
  {#each [...(etapa.tarefas ?? [])] as tarefa (tarefa.id)}
    {@const subs = tarefa.subtarefas ?? []}
    <div
      data-testid="etapa-tarefa-row"
      data-eid={tarefa.id}
      class="flex items-center gap-4"
    >
      <Checkbox data-testid="etapa-tarefa-concluida" checked={tarefaConcluida(tarefa)} disabled />
      <span class="flex-1">{tarefa.titulo}</span>
      <span data-testid="etapa-tarefa-prazo" class={vencido(...) ? "text-destructive" : ""}>
        {tarefa.dataPrevista ? tarefa.dataPrevista.slice(0, 10) : "—"}
      </span>
      <!-- Intentionally inert: this chip is a passive count
           display pending Phase 20's SubtarefasPanel
           (NEST-05, deferred per 19-CONTEXT.md). It must
           never be a <button> in this phase. -->
      <Badge data-testid="etapa-tarefa-subtarefas-chip" variant="outline">
        {subs.filter((s) => s.concluida).length}/{subs.length}
      </Badge>
    </div>
  {/each}
</div>
```
The comment at lines 498-501 is the explicit hand-off marker. Phase 20's edit here is: wrap the `Badge` in
a `<button type="button">` (keeping the `data-testid="etapa-tarefa-subtarefas-chip"` on the outer button
so no existing e2e assertion locator breaks — `projetos-section.spec.ts:656,661,666,671` all locate this
testid and only assert its **text**, never its tag [VERIFIED: web/e2e/projetos-section.spec.ts:656,661,666,671]),
`onclick` opens `SubtarefasPanel` with `parentType="tarefa" parentId={tarefa.id}`. Note this chip's `subs`
data comes from `ProjetosSection`'s own bespoke nested query [VERIFIED:
web/src/lib/sections/ProjetosSection.svelte:67-72 — `projetos: { fundo: {}, etapas: { tarefas: {
subtarefas: {} } } } }`] — that data is only used for the *count badge text*; opening the panel must issue
its own `scopeWhere`-filtered `EntityScreen` query, not attempt to reuse this nested query's rows.

## State of the Art

Not applicable — no external ecosystem/library research; this phase is entirely in-repo composition.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Suggested testids (`rotinas-tab-instancias`/`rotinas-tab-templates`, a `subtarefas-panel` container testid, a hidden-host testid for the create-driving instance) are naming *suggestions* only, not read from any source — no such testids exist yet anywhere in the codebase | Architecture Patterns / Code Examples | Low — the planner/executor can choose different concrete names as long as they are internally consistent; nothing downstream depends on these specific strings today |
| A2 | The recommended fix for Pitfall 1 (drive the DOM via two extra `.click()`s on the hidden create instance) is the *lowest-risk* option that avoids editing `EntityScreen.svelte`, but it was not built or executed this session — its exact click sequence (in particular, whether the target-id `Select`'s options are ready to click immediately after the xor-type click, or need an extra `tick()`/poll given the target-list query is itself reactive) is unverified in a live browser | Pattern 1 / Pitfall 1 | Medium — if the second Select's options render one reactive tick later than assumed, the click-driving code needs the same bounded-poll retry loop `openProjetoDialog` already uses (cited), not a single blind `.click()` |

**All other claims above are `[VERIFIED: <path:line>]` against files read this session, with verbatim quotes inline; none required `[CITED]`-only sourcing beyond spec-ui.md's plain-text section references.**

## Open Questions

1. **Should `SubtarefasPanel` support creating a new subtarefa at all, or should it be list/toggle/edit/delete-only?**
   - What we know: `subtarefas.ts` has `capabilities: { create: true, update: true, delete: true }`
     [VERIFIED: web/src/lib/entities/defs/subtarefas.ts:21], and CONTEXT.md's decision log assumes create
     works via `presetLinks` (Pitfall 1 shows it doesn't, unaided). ROADMAP.md's Phase 20 goal says users
     "manage" instances/templates but only says they "inspect" subtarefas via the panel — the word choice
     is not decisive either way [CITED: .planning/ROADMAP.md:134-136].
   - What's unclear: Whether skipping create-from-panel (falling back to CLI-only creation of subtarefas,
     consistent with README's "full parity with the Python CLI" framing [CITED: web/README.md:3-7]) is an
     acceptable interpretation of NEST-05, or whether the phase's success criteria implicitly require it
     since retiring the interim `nested-goto` entry removes the only other SPA path to create one.
   - Recommendation: Implement create via Pattern 1 (DOM-driving) since it is fully achievable without
     touching `EntityScreen.svelte` and preserves SPA/CLI parity — but flag this as a discussion point for
     `/gsd-discuss-phase` or the planner's own judgment call if effort needs trimming; it is the single
     most complex piece of new logic in this phase and is genuinely optional relative to NEST-05's literal
     text ("selecting a ticket row opens... showing that ticket's subtarefas").

2. **Exact call-site rewrite plan for `entities-ticket-subtarefa.spec.ts`'s 6 tests (Pitfall 3).**
   - What we know: All 6 tests currently call `gotoNested(page, "subtarefas")` then interact with an
     unscoped table/form; 2 of them specifically require switching between both xor choices in one test.
   - What's unclear: Whether the plan should introduce two new named e2e helpers
     (`openSubtarefasPanelFromTicket`/`openSubtarefasPanelFromTarefa`) or inline the open-panel steps at
     each of the 6 call sites directly — a style choice, not a correctness question.
   - Recommendation: New helpers, mirroring the existing `web/e2e/helpers/` convention (one file per
     concern, plain exported async functions, no class) — keeps the 6 call sites short and makes the
     "open panel scoped to X" operation reusable for any future spec that also needs it.

## Environment Availability

Not applicable — this phase has zero new external tool/service/runtime dependencies. Playwright, bun, and
InstantDB (the hosted backend) are already configured and used by every prior phase in this milestone;
nothing new is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test` ^1.62.1 [VERIFIED: web/package.json:31] |
| Config file | `web/playwright.config.ts` (existing, unmodified by this phase) |
| Quick run command | `bunx playwright test --project=authed --no-deps -g "<test name substring>"` |
| Full suite command | `bun run test:e2e` (all three projects — `setup`, `authed`, `anon`) [VERIFIED: web/README.md:126-131] |

No unit-test framework (vitest) exists in this repo yet [VERIFIED: `grep -n "test:e2e\|vitest\|playwright"
web/package.json` shows only Playwright scripts] — `DASH-06`'s later `derive.test.ts` will be the first
unit-test file in this codebase, introduced in Phase 21, not this one. Phase 20 has no pure-function
surface of its own (no `derive.ts`-style module) — all new logic is Svelte component wiring, so Playwright
is the only validation layer this phase needs.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NEST-04 | Rotinas has Instâncias(default)/Templates tabs; Instâncias keeps no create/delete affordance | e2e | `bunx playwright test entities-rotina-log.spec.ts --project=authed --no-deps` | ✅ existing spec, needs its `templatesRotina` call site migrated (Pitfall 4), `instanciasRotina` test needs re-verification against the new tab wrapper but likely needs zero edits |
| NEST-04 | Templates tab shows context paragraph | e2e | new assertion in a Rotinas-section spec | ❌ Wave 0 — new `rotinas-section.spec.ts` (mirrors `projetos-section.spec.ts`'s naming) |
| NEST-05 | Selecting a ticket opens the panel with `scopeWhere`/`presetLinks` resolved | e2e | new `tickets-section.spec.ts` | ❌ Wave 0 |
| NEST-05 | Same panel opens from a tarefa's subtarefa chip inside Projetos | e2e | extend `projetos-section.spec.ts` | ✅ file exists, needs new test cases for the chip-turned-button |
| NEST-05 | xor-parent-type never touched by the user | e2e | assert no `.click()`/`.fill()` call targets `[data-testid="xor-parent-type"]` in the new panel-driven test flow (a negative assertion — the human/test flow simply never targets that testid, only the app's own internal driving code does) | ❌ Wave 0 |
| NAV-02 (regression) | No first-level nav path for `templatesRotina`/`subtarefas` | e2e | `shell-nav.spec.ts`'s existing NAV-02 test | ✅ existing, needs its `gotoNested` loop reworked once `subtarefas` is no longer dispatchable through `gotoNested` (Pitfall 3) — this test currently iterates `["tarefas", "templatesRotina", "subtarefas"]` in one loop [VERIFIED: web/e2e/shell-nav.spec.ts:107] and will need `subtarefas` either removed from that loop (with a separate assertion added) or replaced with a call through the new dedicated helper |

### Sampling Rate
- **Per task commit:** run the single new/modified spec file with `--project=authed --no-deps`.
- **Per wave merge:** `bun run test:e2e` (full 3-project suite).
- **Phase gate:** Full suite green before `/gsd-verify-work`, per this project's existing zero-human-UAT
  convention for this milestone [CITED: .planning/ROADMAP.md:71 — "zero human UAT anywhere in the
  milestone (per PROJECT.md Context — this project runs fully autonomously)"].

### Wave 0 Gaps
- [ ] `web/e2e/rotinas-section.spec.ts` — covers NEST-04 (tabs, default tab, context paragraph, no
  create/delete affordance on Instâncias)
- [ ] `web/e2e/tickets-section.spec.ts` — covers NEST-05 (ticket selection → panel, scoped list content)
- [ ] `web/e2e/helpers/subtarefasPanel.ts` (or similarly named) — `openSubtarefasPanelFromTicket`/
  `openSubtarefasPanelFromTarefa` helpers used by the rewritten `entities-ticket-subtarefa.spec.ts` call
  sites and by the two new specs above
- [ ] Framework install: none — Playwright is already fully configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing InstantDB magic-code auth, out of scope this phase |
| V3 Session Management | no (unchanged) | Existing `db.useAuth()`/IndexedDB session, out of scope |
| V4 Access Control | yes, but only as a documentation point | `scopeWhere`/`presetLinks` are **client-side UI convenience filters only** — they narrow which rows a query asks for, they do **not** authorize anything. The actual authorization boundary is `instant.perms.ts`, which this milestone is explicitly forbidden from modifying [CITED: .planning/REQUIREMENTS.md:8-9, .planning/REQUIREMENTS.md:108]. A user cannot see another owner's subtarefas through the new panel for the same reason they could never see them through the old unscoped table: server-side perms already scope every query to the authenticated `donoId`, independent of any `scopeWhere` value the client sends. |
| V5 Input Validation | yes (unchanged) | The panel's create/edit form is the same generic `EntityScreen` form validation already in place (`required` field checks, xor-exactly-one-parent check at `EntityScreen.svelte:277-281`) — no new validation surface is introduced |
| V6 Cryptography | no | Not applicable to this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client trusts `scopeWhere` as an authorization mechanism | Elevation of Privilege | Do not rely on it as one — verified above that InstantDB's own permission rules (unchanged, out of scope) are the real boundary; the plan/executor must not write any comment or code implying `scopeWhere` "secures" the panel |
| Cloned `EntityConfig` object accidentally shared/mutated across mounts | Tampering (data integrity within the client, not a remote threat) | Always spread-clone (`{ ...subtarefasConfig, capabilities: {...} }`), never mutate the shared `configByEtype("subtarefas")` reference in place, per the Anti-Patterns section above |

## Sources

### Primary (HIGH confidence — all files read this session, verbatim quotes inline above)
- `web/src/lib/entities/EntityScreen.svelte` — full read; `scopeWhere`/`presetLinks` props (31-39),
  `buildQuery` (69-76), `startCreate` (203-219), `startEdit` (221-262), xor UI block (744-798)
- `web/src/lib/entities/defs/subtarefas.ts`, `instanciasRotina.ts`, `templatesRotina.ts`, `tickets.ts`,
  `tarefas.ts` — full reads
- `web/src/lib/entities/types.ts`, `web/src/lib/entities/registry.ts` — full reads
- `web/src/lib/Shell.svelte` — full read (post-Phase-19 state)
- `web/src/lib/sections/ProjetosSection.svelte` — full read, including the exact inert chip (472-509)
  and the three hidden-instance click-driving functions (185-197, 232-244, 256-268)
- `web/e2e/helpers/gotoNested.ts`, `web/e2e/helpers/form-controls.ts` — full reads
- `web/e2e/entities-ticket-subtarefa.spec.ts`, `entities-rotina-log.spec.ts`, `shell-nav.spec.ts`
  (relevant sections) — read for exact call-site/testid dependencies
- `spec-ui.md` §0, §1, §2.1-§2.5, §3 (partial), §7 — read in full per file list
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 20 section + traceability), `20-CONTEXT.md`,
  `.planning/config.json` — read in full

### Secondary (MEDIUM confidence)
- None used — no web search performed (all research providers disabled in config; not needed for an
  in-repo composition question).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, everything already installed and verified present via `ls`
- Architecture: HIGH — every pattern cited is copied from already-shipped, already-tested Phase 19 code
- Pitfalls: HIGH — the central pitfall (presetLinks vs. xorLink) is demonstrated with exact line numbers
  and verbatim source quotes from `EntityScreen.svelte`, not inferred from documentation or memory
- Open Questions: these are genuine product/scope decisions (create-from-panel: yes/no), not knowledge
  gaps — flagged for the planner's judgment call, not further research

**Research date:** 2026-08-11
**Valid until:** No expiry concern — this is a closed, in-repo codebase snapshot, not a fast-moving
external dependency; valid until the next commit touches any of the cited files.
