# Phase 10: Entity Form Restyle & Feedback - Research

**Researched:** 2026-08-09
**Domain:** shadcn-svelte 1.5.0 (`nova` style, bits-ui 2.18.1) Dialog/Select/Checkbox/Popover+Calendar/Sonner adoption into a single generic, config-driven `EntityScreen.svelte` form block, covering all 9 domain entities, zero business-logic change, zero human UAT
**Confidence:** HIGH (all component source pulled live from the exact registry URL the installed CLI resolves against, all bits-ui runtime behavior — roles, ARIA attributes, bindable/`onXChange` prop shapes — confirmed by reading the actual installed `node_modules/bits-ui` source this session, all entity field-kind claims confirmed by reading every `web/src/lib/entities/defs/*.ts` file directly this session, existing `EntityScreen.svelte`/`LoginScreen.svelte`/`App.svelte` read in full this session)

## Summary

`EntityScreen.svelte`'s create/edit `<form>` block (lines 391-565, currently untouched since Phase 4) is a single generic renderer driven by `EntityConfig` — there are no per-entity form components, so every change here applies uniformly across `fundos`, `projetos`, `etapas`, `tarefas`, `templatesRotina`, `instanciasRotina`, `tickets`, `subtarefas`. `logInferenciaClaude` never reaches this code path (all three capabilities false). The mechanical installs are `bunx shadcn-svelte@latest add dialog select checkbox textarea popover calendar --no-deps-install -y` (zero new npm dependency — `bits-ui@2.18.1` and `@internationalized/date@3.12.3` already satisfy every one of these six components' declared registry dependencies) plus a **deliberately separate, hand-edited** Sonner install (see Pitfall 1 below — the stock `shadcn-svelte add sonner` wraps `svelte-sonner` in a `mode-watcher`-dependent wrapper that reintroduces the exact class-based dark-mode toggle machinery Phase 7 removed to satisfy C-11's "no toggle" clause).

Three concrete architectural findings drive this phase's plan:

1. **Dialog, not Sheet.** Confirmed via direct registry read: shadcn-svelte's `nova` style has no distinct "Combobox" registry entry at all (404) — Select is the only relationship-field primitive available, at any field count. Dialog's default `max-w-sm` (confirmed from the live `dialog-content.svelte` source) is comfortably widened via `class="sm:max-w-lg"` to fit `templatesRotina`'s/`tickets`'s worst case of 6 fields + up to 2 links, with `max-h-[85vh] overflow-y-auto` on the content for scroll safety — no case in this app's 9 entities needs a side-panel form. Dialog is also the shadcn-svelte-canonical "create/edit record" composition (confirmed against the official docs' own examples), so no bespoke pattern is being invented.
2. **The date-picker's ISO conversion needs zero changes to `dateInputValueToIso`/`isoToDateInputValue`.** `@internationalized/date`'s `parseDate("YYYY-MM-DD")` and `CalendarDate.toString()` round-trip through the *exact same* `YYYY-MM-DD` string shape `<input type="date">` already produced and those two helpers already consume [VERIFIED: WebSearch cross-checked against `@internationalized/date` docs, then confirmed against the live shadcn `calendar.svelte` registry source's `bind:value={value as never}` `DateValue`-typed prop]. `formValues[f.name]` for a date field stays a plain `"YYYY-MM-DD"` string exactly as today — only the widget rendering that string changes.
3. **Every one of Select/Checkbox/Calendar forwards `data-testid` straight through to a real interactive DOM node with the correct ARIA role** — confirmed by reading the actual installed `bits-ui` source, not the shadcn wrapper alone: Select's trigger is a plain `<button role="combobox" {...mergedProps}>` [VERIFIED: `web/node_modules/bits-ui/dist/bits/select/components/select-trigger.svelte`, read this session — `child` snippet is entirely optional, only needed if you want a *different* element than the default button], Checkbox's root is `<button role="checkbox" aria-checked={...}>` [VERIFIED: `web/node_modules/bits-ui/dist/bits/checkbox/checkbox.svelte.js:172`], and Select's listbox/items render `role="listbox"`/`role="option"` [VERIFIED: `web/node_modules/bits-ui/dist/bits/select/select.svelte.js:485,857,991`]. The one place the `child`-snippet/`asChild`-equivalent pattern genuinely IS required (additional_context's flagged gotcha class) is the **date-picker's Popover.Trigger wrapping a Button** — the official pattern renders the Button via `{#snippet child({ props })}<Button {...props}>` specifically so the visible, testid-bearing element is the Button itself, not an extra wrapper (see Code Examples).

**Primary recommendation:** Wrap the existing `{#if mode !== null}<form onsubmit={handleSubmit}>...</form>{/if}` block in `<Dialog.Root open={mode !== null} onOpenChange={(open) => { if (!open) cancelForm(); }}>` / `<Dialog.Content class="sm:max-w-lg max-h-[85vh] overflow-y-auto">`, keep the `<form>` element and every handler/testid inside unchanged, and swap each field-kind branch's underlying element 1:1 (text/textarea/number stay native `Input`/`Textarea`/`Input type=number`; boolean → `Checkbox` with explicit `checked`/`onCheckedChange` callback, matching this codebase's existing explicit-callback style rather than `bind:`; date → `Popover`+`Calendar` composition; select/links/xorLink → `Select.Root type="single"`). Install `svelte-sonner` directly (skip `mode-watcher` entirely), mount a hand-edited `<Toaster theme="system" />` once in `App.svelte` (outside `SignedIn`/`SignedOut` so both auth and entity-CRUD writes can toast), call `toast.success()`/`toast.error()` from `handleSubmit`, `handleDelete`, and both `LoginScreen.svelte` auth calls.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Form field rendering (Input/Textarea/Select/Checkbox/Calendar) | Browser/Client | — | Pure client-rendered Svelte 5 components inside a Vite SPA, no SSR tier exists |
| Dialog open/close state (`mode !== null`) | Browser/Client | — | Existing `$state` primitive already drives visibility; Dialog's `open`/`onOpenChange` is a thin controlled-component wrapper over the same state, no new state machine |
| Date value representation | Browser/Client (UI) | — | `CalendarDate` only exists transiently inside the Popover/Calendar composition; `formValues[f.name]` (the source of truth fed to `dateInputValueToIso`) stays a plain string, never a `CalendarDate`, so no tier boundary is crossed |
| Relationship-option data (link/xorLink target rows) | Database/Storage (InstantDB live query) | Browser/Client (Select rendering) | Unchanged — `linkOptionsFor`/`xorOptionsFor` already read from `db.useQuery()` results; only the `<select>`→`Select.Item` rendering changes |
| Write feedback (Sonner toast) | Browser/Client | — | Toast is purely a client-side UI reaction to the resolved/rejected Promise from `db.transact()`/`db.auth.*` — no new network call, no backend involvement |
| Validation error surfacing (`formError` → `Alert`) | Browser/Client | — | Unchanged from Phase 8's `Alert` pattern; `formError` state and the checks that set it (`parent_not_found`, required-field checks) are pure client-side, pre-transact |

## User Constraints

<user_constraints>
### Locked Decisions (from CONTEXT.md, do not reopen)

- **C-11**: shadcn-svelte preset b0 (style `nova`, base color `neutral`, icons `lucide`). This phase adds: Dialog **or** Sheet (planner's choice, justified below — **Dialog** recommended), Select (enum + relationship fields), Checkbox (boolean fields), Calendar + Popover (date-picker pattern), Sonner (toast). No custom color palette/tokens.
- **C-12**: zero human UAT anywhere — every `<verify>` must be `<verify><automated>`.
- **C-08**: `bun`/`bunx` only, all `web/` frontend logic in `.ts`/`<script lang="ts">`.

### Full field-kind inventory (verified directly against `web/src/lib/entities/defs/*.ts` this session — every entity file was read in full, not summarized from CONTEXT.md alone)

| Kind | Fields (entity.field) | Target shadcn primitive |
|------|------------------------|--------------------------|
| `text` | most string fields across all entities | `Input` (unchanged from Phase 8's already-installed component) |
| `textarea` | `tarefas.descricao`, `projetos.descricao`, `tickets.corpo`, `logInferenciaClaude.trechoMotivador` (display-only, capabilities all false) | `Textarea` (new install) |
| `number` | `subtarefas.ordem`, `etapas.ordem`, `templatesRotina.offsetDias` | `Input type="number"` (unchanged) |
| `boolean` | `fundos.ativo`, `templatesRotina.propagarAtrasoSoft`, `templatesRotina.ativo`, `subtarefas.concluida` | `Checkbox` (new install) |
| `date` | `fundos.createdAt`, `tarefas.dataPrevista`/`dataPrevistaEstimada`, `projetos.dataInicioPrevista`/`dataFimPrevista`, `tickets.dataRecebimento`/`dataPrevista`, `instanciasRotina.dataPrevista`/`dataPrevistaEstimada` (edit-form for this entity only shows `status`, per `updatableFields`, so these two never actually render in a form — display-only in practice), `logInferenciaClaude.createdAt` (display-only, capabilities all false) | `Popover` + `Calendar` (new installs) |
| `select` (static options) | `tarefas.tipoPrazo` (`["hard","soft"]`), `tickets.tipoPrazo` (`["hard","soft"]`), `templatesRotina.tipoGeracao` (`["du_fixo","corrido_fixo","encadeado"]`) | `Select` (new install) |
| `links` (single-target relationship) | `tarefas.etapa`→etapas, `templatesRotina.fundo`→fundos, `templatesRotina.antecessor`→templatesRotina (self, `excludeSelf: true`), `etapas.projeto`→projetos, `projetos.fundo`→fundos, `tickets.fundo`→fundos | `Select` (same component as static-option fields, different option source — live query rows via existing `linkOptionsFor()`) |
| `xorLink` (two-step chooser) | `subtarefas`: choose `tarefa`→tarefas OR `ticket`→tickets, exactly one required | Two `Select`s, same two-step structure (`xor-parent-type` chooser + dynamic `link-${xorParentType}` target picker), preserved exactly |

Capability-restricted entities (verified directly against their def files this session):
- `logInferenciaClaude`: `capabilities: { create: false, update: false, delete: false }` [VERIFIED: `web/src/lib/entities/defs/logInferenciaClaude.ts`] — `mode` can never become non-null, the Dialog code path is dead code for this entity, do not force it to render.
- `instanciasRotina`: `capabilities: { create: false, update: true, delete: false }`, `updatableFields: ["status"]` [VERIFIED: `web/src/lib/entities/defs/instanciasRotina.ts`] — only an edit Dialog exists, containing exactly one field (`status`, `kind: "text"` → plain `Input`, not a date/select widget at all despite the entity having date fields — `editableFields()` already filters to `updatableFields` before this phase's widget-swap logic ever runs, so this entity's Dialog is trivial: one `Input`, no Select/Checkbox/Calendar).

### Claude's Discretion

All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

### Deferred Ideas (OUT OF SCOPE)

Delete-confirmation dialog conversion (`window.confirm` → shadcn `AlertDialog`) — not required by any REQUIREMENTS.md item, left to Claude's discretion, not a blocking gap if skipped.
</user_constraints>

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| ENTFRM-01 | Create/edit forms for all 9 entities render via shadcn `Input`/`Label`/`Select`/`Checkbox`, inside a shadcn `Dialog` or `Sheet` | See "Architecture Patterns: Dialog composition" and "Code Examples" for the full skeleton; "Standard Stack" for exact install command and confirmed zero-new-dependency install |
| ENTFRM-02 | Date fields use the shadcn `Calendar`/date-picker pattern instead of bare `<input type="date">` | See "Code Examples: Date-picker field" for the full Popover+Calendar composition and the confirmed zero-change ISO conversion path |
| ENTFRM-03 | Link/relationship fields keep existing selection behavior, restyled with `Select`/`Combobox` | See "Common Pitfalls: no Combobox registry entry exists" (justifies plain `Select` for both enum and relationship fields) and "Code Examples: Select field / link field / xorLink" |
| ENTFRM-04 | Form validation errors render via shadcn conventions (inline text / `Alert`), not `window.alert` | See "Architecture Patterns: validation-error surfacing" — reuses Phase 8's already-installed `Alert`, testid `entity-error` unchanged |
| FDBK-01 | Success/error feedback for every write (CRUD + auth) via Sonner toast | See "Common Pitfalls: Sonner's default wrapper conflicts with C-11" and "Code Examples: Toaster mount + toast call sites" |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `shadcn-svelte` | `1.5.0` [VERIFIED: `npm view shadcn-svelte version`, run this session — matches installed devDependency] | CLI that copies `dialog`/`select`/`checkbox`/`textarea`/`popover`/`calendar`/`sonner` component source into `web/src/lib/components/ui/` | Already the project's chosen component-generation tool (C-11); same CLI/style already used Phases 7-9 |
| `bits-ui` | `2.18.1` installed [VERIFIED: `npm view bits-ui version`; `web/package.json` devDependencies, read this session] | Headless primitive every new component wraps (`Dialog`/`Select`/`Checkbox`/`Popover`/`Calendar` primitives) | Already installed since Phase 8 (pulled in by `Label`); satisfies every new component's `bits-ui@^2.16.3` registry requirement — **zero version bump needed** |
| `@internationalized/date` | `3.12.3` installed [VERIFIED: `web/node_modules/@internationalized/date/package.json`, read this session; `web/package.json` devDependencies lists `^3.12.0`] | `CalendarDate`/`parseDate`/`DateFormatter`/`getLocalTimeZone` for the date-picker composition | Already installed since Phase 8 (declared dependency, not previously exercised in app code); satisfies every new component's `@internationalized/date@^3.12.0` registry requirement — **zero version bump needed** |
| `svelte-sonner` | `1.1.1` [VERIFIED: `npm view svelte-sonner version`, run this session] | Underlying toast engine (`Toaster` component, `toast` object) | Standard, official shadcn-svelte-recommended toast library for Svelte — the only new runtime dependency this entire phase requires |

### Supporting

None beyond the Core table. `tailwind-variants`/`clsx`/`tailwind-merge` (already present since Phase 7/8) satisfy every new component's styling needs — no new styling library.

### Explicitly NOT installed

| Package | Why not |
|---------|---------|
| `mode-watcher` | The stock `shadcn-svelte add sonner` registry entry declares `mode-watcher@^1.1.0` as a devDependency (its generated `sonner.svelte` imports `{ mode } from "mode-watcher"` to set `theme={mode.current}`) [VERIFIED: `curl https://shadcn-svelte.com/registry/styles/nova/sonner.json`, run this session]. Installing it would reintroduce class-based/store-based dark-mode tracking machinery — the exact thing Phase 7 removed to satisfy C-11's "no toggle" clause (PROJECT.md C-11: "shadcn-svelte's own default init output wires a class-based mode-watcher toggle, which must be removed/converted... to satisfy 'no toggle'"). See Pitfall 1 for the zero-dependency replacement (`theme="system"` passed directly to `svelte-sonner`'s own `Toaster`, which already implements `prefers-color-scheme` matching internally with no external package). |

**Installation:**
```bash
cd web
# Six components with zero new npm dependency — bits-ui/@internationalized/date already satisfy every declared registry devDependency:
bunx shadcn-svelte@latest add dialog select checkbox textarea popover calendar --no-deps-install -y
# select.json's registryDependencies pulls in a `separator` component transitively (zero new dep, same reason) — expected, not an error.
# Sonner installed by hand (see Pitfall 1) — do NOT run `bunx shadcn-svelte@latest add sonner` as-is:
bun add svelte-sonner
mkdir -p src/lib/components/ui/sonner
# Write index.ts + sonner.svelte manually (see Code Examples) — omits the mode-watcher import.
```

**Version verification:** Confirmed live this session:
```bash
npm view shadcn-svelte version    # 1.5.0
npm view bits-ui version          # 2.18.1
npm view svelte-sonner version    # 1.1.1
npm view svelte-sonner scripts.postinstall   # (empty — no postinstall script)
cat web/node_modules/@internationalized/date/package.json | grep version   # 3.12.3
git diff web/package.json web/bun.lock   # expected: empty after the 6-component add, one new line (svelte-sonner) after the sonner install
```

## Package Legitimacy Audit

| Package | Registry | Age (latest version) | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------------------|-------------------|--------------|---------|-------------|
| `bits-ui` | npm | ~3 months (2026-05-03) | 941,914 | github.com/huntabyte/bits-ui | OK | Already installed since Phase 8 — no new install, no re-audit needed |
| `svelte-sonner` | npm | package created 2023, latest version 2026-04-24 | 489,873 | github.com/wobsoriano/svelte-sonner | OK | Approved — new install this phase, `gsd_run query package-legitimacy check` this session returned OK, zero postinstall script confirmed via `npm view svelte-sonner scripts.postinstall` |
| `mode-watcher` | npm | latest 2025-06-28 | 343,901 | github.com/svecosystem/mode-watcher | OK (legitimacy) | **Not installed** — legitimacy is fine, but it conflicts with C-11's architectural intent (see "Explicitly NOT installed" above); this is an architecture decision, not a legitimacy rejection |
| `@internationalized/date` | npm | latest 2026-07-31 | 13,415,612 | github.com/adobe/react-spectrum | SUS ("too-new" heuristic) | Already installed since Phase 8, same false-positive disposition as Phase 8's own audit (huge downloads, recognized org/monorepo, zero postinstall) — no new install this phase |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]` requiring extra scrutiny (not a human checkpoint, per C-12):** `@internationalized/date` — pre-existing false positive, already carried forward from Phase 8's own disposition, no new install this phase.

## Architecture Patterns

### System Architecture Diagram

```
┌───────────────────────────── Browser (Chromium, no server tier) ─────────────────────────────┐
│                                                                                                  │
│  App.svelte                                                                                     │
│   <Toaster theme="system" />  ── mounted once, outside SignedIn/SignedOut ──►                  │
│                                    receives toast.success()/toast.error() calls from anywhere   │
│                                                                                                   │
│   <SignedOut> ──► LoginScreen.svelte                                                            │
│     enviarCodigo() / verificarCodigo() success ──► toast.success("...")  [NEW this phase]      │
│     enviarCodigo() / verificarCodigo() catch    ──► toast.error(erro)    [NEW this phase]      │
│     (Alert[variant=destructive] unchanged — Phase 8, still renders inline error)                │
│                                                                                                   │
│   <SignedIn> ──► Shell.svelte ──► EntityScreen.svelte (config-driven, same component ×9)        │
│     Table/Badge/Button list-view: UNCHANGED (Phase 9 scope)                                     │
│     entity-create-start / row-edit ──► mode="create"|"edit" (unchanged $state)                  │
│       ──► <Dialog.Root open={mode!==null} onOpenChange={...}>                                  │
│             <Dialog.Content class="sm:max-w-lg max-h-[85vh] overflow-y-auto">                   │
│               <form onsubmit={handleSubmit}>  (unchanged handler, unchanged validation)          │
│                 {#each editableFields()}                                                        │
│                   text/textarea/number  ──► Input/Textarea (unchanged handlers)                 │
│                   boolean                ──► Checkbox (checked + onCheckedChange)                │
│                   date                   ──► Popover(Trigger=Button) + Calendar                  │
│                                              value: formValues[f.name] stays "YYYY-MM-DD" string │
│                   select (static/link)   ──► Select.Root type="single" (onValueChange)           │
│                 xorLink                  ──► two Select.Roots, same two-step structure           │
│                 formError (validation)   ──► Alert[variant=destructive] (unchanged testid)       │
│               handleSubmit success  ──► toast.success("...")   [NEW this phase]                 │
│               handleSubmit catch    ──► toast.error(formError) [NEW this phase, ADDITIVE to Alert]│
│           handleDelete success  ──► toast.success("...")   [NEW this phase]                     │
│           handleDelete catch    ──► toast.error(...)       [NEW this phase]                     │
│                                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                         ▲
                         │ real db.transact()/db.auth.* round trips (unchanged)
                         ▼
              InstantDB hosted backend
```

### Recommended Project Structure

```
web/src/lib/
├── components/ui/
│   ├── dialog/       # new, `add dialog`
│   ├── select/       # new, `add select` (transitively adds separator/)
│   ├── checkbox/     # new, `add checkbox`
│   ├── textarea/     # new, `add textarea`
│   ├── popover/      # new, `add popover`
│   ├── calendar/      # new, `add calendar`
│   ├── separator/     # new, transitive dependency of select
│   └── sonner/         # new, HAND-WRITTEN (see Pitfall 1) — not the stock generated output
├── entities/EntityScreen.svelte   # form block (lines 391-565) restyled in place
└── auth/LoginScreen.svelte        # add two toast calls, no markup restructure needed
```

### Pattern 1: Dialog composition (ENTFRM-01)

**What:** Wrap the existing `<form>` in a controlled `Dialog.Root`, driven by the pre-existing `mode` state — no `Dialog.Trigger` needed, since `entity-create-start`/`row-edit` already set `mode` directly via their own `onclick` handlers.
**When to use:** The single `{#if mode !== null}` block in `EntityScreen.svelte`.

```svelte
<!-- Source: registry-verified https://shadcn-svelte.com/registry/styles/nova/dialog.json,
     read live this session; open/onOpenChange verified against
     web/node_modules/bits-ui/dist/bits/dialog/types.d.ts -->
<Dialog.Root
  open={mode !== null}
  onOpenChange={(open) => {
    if (!open) cancelForm();
  }}
>
  <Dialog.Content class="sm:max-w-lg max-h-[85vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>{mode === "create" ? "Novo" : "Editar"} — {config.titulo}</Dialog.Title>
    </Dialog.Header>
    <form onsubmit={handleSubmit}>
      <!-- unchanged field loop, unchanged links/xorLink loop, unchanged submit/cancel -->
    </form>
  </Dialog.Content>
</Dialog.Root>
```

`Dialog.Content`'s own close-X button (rendered by the shadcn wrapper unconditionally unless `showCloseButton={false}`) calls `DialogPrimitive.Close`, which fires `onOpenChange(false)` — this already routes through `cancelForm()` above, so no extra wiring is needed for "click X to cancel" to behave identically to the existing `entity-cancel` button. Keep `entity-cancel` as an explicit second `Button type="button" onclick={cancelForm}` inside the form too — REQUIREMENTS/ROADMAP don't ask to remove it, and existing e2e specs click it by testid.

**Why Dialog, not Sheet:** No `Combobox` registry entry exists in the `nova` style (`curl` returns a 404-equivalent HTML fallback page, confirmed this session) — Select is the only available relationship-field primitive regardless of Dialog/Sheet choice, so field-count-driven Combobox-vs-Select tradeoffs don't factor into the Dialog-vs-Sheet decision at all. Dialog's default `max-w-sm` easily widens via a `class` override to fit the worst-case entity (`templatesRotina`: 6 fields + 2 links = 8 controls; `tickets`: 7 fields + 1 link = 8 controls) without needing Sheet's extra vertical real estate — this is a desktop-only app (Out of Scope: "Mobile/responsive redesign"), so Sheet's mobile-drawer ergonomics buy nothing here.

### Pattern 2: Checkbox field (boolean kind)

**What:** Explicit `checked`/`onCheckedChange` callback prop, matching this codebase's existing explicit-handler style (not `bind:`) used by every other field kind.
**Verified:** `web/node_modules/bits-ui/dist/bits/checkbox/components/checkbox.svelte` destructures `onCheckedChange` (not shown in the shadcn wrapper's own signature, but the wrapper spreads `...restProps` onto `CheckboxPrimitive.Root`, so passing `onCheckedChange` on the shadcn `<Checkbox>` flows straight through) [VERIFIED: `web/node_modules/bits-ui/dist/bits/checkbox/components/checkbox.svelte`, read this session]. Root renders `<button role="checkbox" aria-checked={...}>` [VERIFIED: `web/node_modules/bits-ui/dist/bits/checkbox/checkbox.svelte.js:172`].

```svelte
{:else if f.kind === "boolean"}
  <Checkbox
    id={`field-${f.name}`}
    data-testid={`field-${f.name}`}
    checked={Boolean(formValues[f.name])}
    onCheckedChange={(v) => {
      formValues[f.name] = v === true;
    }}
  />
```

`onCheckedChange`'s value type is `boolean | "indeterminate"` — the `v === true` guard collapses `"indeterminate"` to `false`, which this app never produces (no `indeterminate` prop passed) but keeps the type narrow without an `as boolean` cast.

### Pattern 3: Select field (static-option AND relationship, same component)

**What:** `Select.Root type="single"` with `value`/`onValueChange`, `Select.Trigger` (renders as `<button role="combobox">`) showing a derived label, `Select.Content`>`Select.Item` for options.
**Verified:** `Select.Root` requires `type: "single"` (not inferred) [VERIFIED: `web/node_modules/bits-ui/dist/bits/select/types.d.ts:103`]. `onValueChange?: OnChangeFn<string>` exists on the single-select root props [VERIFIED: same file, line 97]. Trigger role/element confirmed above (Pattern summary). Content/Item roles: `role="listbox"` / `role="option"` [VERIFIED: `web/node_modules/bits-ui/dist/bits/select/select.svelte.js:857,991`].

Static-option field (`tipoPrazo`/`tipoGeracao`):
```svelte
{:else if f.kind === "select"}
  <Select.Root
    type="single"
    value={formValues[f.name] as string}
    onValueChange={(v) => {
      formValues[f.name] = v;
    }}
  >
    <Select.Trigger id={`field-${f.name}`} data-testid={`field-${f.name}`} class="w-full">
      {(formValues[f.name] as string) || "selecione..."}
    </Select.Trigger>
    <Select.Content>
      {#each f.options as opt (opt)}
        <Select.Item value={opt} label={opt}>{opt}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
```

Relationship link field — identical component, option source swapped to `linkOptionsFor(link)` (live query rows), label lookup swapped to `targetLabelField`:
```svelte
{#each config.links ?? [] as link (link.label)}
  <Select.Root
    type="single"
    value={selectedLinks[link.label] ?? ""}
    onValueChange={(v) => {
      selectedLinks[link.label] = v;
    }}
  >
    <Select.Trigger id={`link-${link.label}`} data-testid={`link-${link.label}`} class="w-full">
      {linkOptionsFor(link).find((o) => o.id === selectedLinks[link.label])?.[link.targetLabelField] ?? "—"}
    </Select.Trigger>
    <Select.Content>
      {#if !link.required}
        <Select.Item value="" label="—">—</Select.Item>
      {/if}
      {#each linkOptionsFor(link) as opt (opt.id)}
        <Select.Item value={opt.id} label={String(opt[link.targetLabelField] ?? "")}>
          {String(opt[link.targetLabelField] ?? "")}
        </Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{/each}
```

An empty-string `Select.Item` value is safe: bits-ui's own `hasValue` check is literally `value.current !== ""` [VERIFIED: `web/node_modules/bits-ui/dist/bits/select/select.svelte.js:174,238`] — selecting the `"—"` item genuinely represents "no value," matching the exact semantics the current `<option value="">—</option>` already has. The `xorLink` two-step chooser (`xor-parent-type` + dynamic `link-${xorParentType}`) is the same pattern applied twice — do not introduce any new component for it, just two `Select.Root`s wired to the existing `xorParentType`/`xorParentId` state.

### Pattern 4: Date-picker field (Popover + Calendar)

**What:** A `Popover.Trigger` wrapping a `Button` via the `child` snippet (the one genuine `asChild`-equivalent gotcha in this phase), showing the formatted date; `Popover.Content` holds a `Calendar type="single"`.
**Verified:** Full pattern confirmed against the official shadcn-svelte docs page (fetched live this session) and cross-checked against the installed `calendar.svelte`/`popover-trigger.svelte` source. `Calendar`'s `onValueChange?: OnChangeFn<DateValue | undefined>` for the single-selection variant [VERIFIED: `web/node_modules/bits-ui/dist/bits/calendar/types.d.ts:196`].

**Critical ISO-conversion finding:** `formValues[f.name]` for a date field stays a plain `"YYYY-MM-DD"` string, exactly as today. `parseDate("YYYY-MM-DD")` builds a `CalendarDate`; `CalendarDate.toString()` produces `"YYYY-MM-DD"` back [confirmed via WebSearch cross-check of `@internationalized/date`'s documented `parseDate`/`toString` behavior against the installed calendar component's `DateValue`-typed bindable prop this session] — this is the *exact* string shape `isoToDateInputValue()` already returns (it does `iso.slice(0, 10)`) and `dateInputValueToIso()` already consumes (`new Date(`${value}T00:00:00.000Z`).toISOString()`) [VERIFIED: `web/src/lib/entities/EntityScreen.svelte:21-27`, read this session, function bodies quoted verbatim above]. **Neither helper needs to change.**

```svelte
<script lang="ts">
  import { parseDate, DateFormatter, getLocalTimeZone, type DateValue } from "@internationalized/date";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import { Button } from "$lib/components/ui/button";
  import { Calendar } from "$lib/components/ui/calendar";
  import * as Popover from "$lib/components/ui/popover";
  import { cn } from "$lib/utils";

  const df = new DateFormatter("pt-BR", { dateStyle: "long" });
  let datePopoverOpen = $state<Record<string, boolean>>({});
</script>

{:else if f.kind === "date"}
  <Popover.Root bind:open={datePopoverOpen[f.name]}>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button
          variant="outline"
          id={`field-${f.name}`}
          data-testid={`field-${f.name}`}
          class={cn(
            "w-full justify-start text-start font-normal",
            !formValues[f.name] && "text-muted-foreground",
          )}
          {...props}
        >
          <CalendarIcon class="me-2 size-4" />
          {formValues[f.name]
            ? df.format(parseDate(formValues[f.name] as string).toDate(getLocalTimeZone()))
            : "Selecione..."}
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-auto p-0">
      <Calendar
        type="single"
        value={formValues[f.name] ? (parseDate(formValues[f.name] as string) as DateValue) : undefined}
        onValueChange={(v) => {
          formValues[f.name] = v ? v.toString() : "";
          datePopoverOpen[f.name] = false;
        }}
      />
    </Popover.Content>
  </Popover.Root>
```

The `child` snippet on `Popover.Trigger` is what forwards `data-testid`/`id` onto the actually-visible, actually-clickable `Button` — omitting the `child` snippet would render `Popover.Trigger`'s own default `<button>` wrapping the `Button` component's markup as an invalid nested-button DOM structure and would put any `data-testid` prop passed directly to `Popover.Trigger` on the *outer* button instead of a place Playwright's click would land cleanly on the intended element.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast queue/stacking/auto-dismiss timing | Custom `$state` array + `setTimeout` removal logic | `svelte-sonner`'s `Toaster`/`toast` | Already handles stacking, swipe-to-dismiss, pause-on-hover, and `aria-live` regions correctly — a hand-rolled version would need to reinvent all of this to match FDBK-01's "visible... whose content matches the outcome" bar |
| Date parsing/formatting/locale handling | Manual `Date` string slicing beyond the existing `iso.slice(0,10)` helper | `@internationalized/date`'s `parseDate`/`DateFormatter` | Already installed, already the exact type the shadcn `Calendar` primitive requires — reinventing calendar-date math (leap years, month lengths) to avoid the dependency would be strictly worse for zero benefit |
| Dropdown/combobox open-state, keyboard nav, portal positioning | Custom `<div>`-based dropdown with manual click-outside listener | `Select.Root`/`Popover.Root` (bits-ui) | Already ships full keyboard nav (arrow keys, typeahead), focus trapping, and Floating-UI-based positioning — a hand-rolled version is the exact class of bug ("looks right, subtly broken keyboard/focus behavior") this milestone's zero-human-UAT constraint makes expensive to catch |

**Key insight:** Every new component this phase installs is a thin bits-ui wrapper with well-documented, ARIA-correct rendered output (confirmed by reading the actual installed source, not just the styled wrapper) — there is no place in this phase where a hand-rolled alternative is faster or more testable than the generated component's own prop surface.

## Common Pitfalls

### Pitfall 1: Stock `shadcn-svelte add sonner` reintroduces the exact dark-mode toggle machinery C-11 requires removed

**What goes wrong:** Running `bunx shadcn-svelte@latest add sonner -y` generates a `sonner.svelte` that does `import { mode } from "mode-watcher"; ... theme={mode.current}` and adds `mode-watcher` to `package.json` [VERIFIED: `curl https://shadcn-svelte.com/registry/styles/nova/sonner.json`, read in full this session — devDependencies `["mode-watcher@^1.1.0", "svelte-sonner@^1.1.0"]`]. `mode-watcher` is the exact package PROJECT.md C-11 documents as removed in Phase 7: *"shadcn-svelte's own default init output wires a class-based mode-watcher toggle, which must be removed/converted to a bare `@media (prefers-color-scheme: dark)` block."*
**Why it happens:** The registry entry is written for shadcn-svelte's default (unconverted) dark-mode setup; this project deliberately diverged from that default in Phase 7.
**How to avoid:** Install with `--no-deps-install`, `bun add svelte-sonner` (not `mode-watcher`), and hand-write `web/src/lib/components/ui/sonner/sonner.svelte` with the `mode-watcher` import removed and `theme` hardcoded to `"system"`. `svelte-sonner`'s own `Toaster` already implements `prefers-color-scheme` matching with zero external dependency when `theme="system"` is passed directly [VERIFIED: `curl https://raw.githubusercontent.com/wobsoriano/svelte-sonner/main/src/lib/Toaster.svelte`, read this session — `getInitialTheme()` (lines 96-110) checks `window.matchMedia('(prefers-color-scheme: dark)').matches` whenever `theme !== 'system'` is false, and a `$effect`-driven `matchMedia` listener (lines ~260-281) keeps it live-reactive to OS-level scheme changes, with zero additional package]:
```svelte
<!-- web/src/lib/components/ui/sonner/sonner.svelte — hand-written, no mode-watcher import -->
<script lang="ts">
  import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";

  let { ...restProps }: SonnerProps = $props();
</script>

<Sonner
  theme="system"
  class="toaster group"
  style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
  {...restProps}
/>
```
```ts
// web/src/lib/components/ui/sonner/index.ts
export { default as Toaster } from "./sonner.svelte";
```
**Warning signs:** `git diff web/package.json` showing a new `mode-watcher` line is the tell — if seen, the install went through the stock path and needs correcting before any other work continues.

### Pitfall 2: `.fill()`/`.selectOption()` calls in the pre-existing e2e suite break the instant this phase's markup lands

**What goes wrong:** Four existing spec files interact with today's native form elements using APIs that don't exist on the new components: `entities-fundos.spec.ts:122` (`page.getByTestId("field-createdAt").fill("2026-01-15")` on what becomes a `Button`), `entities-rotina-log.spec.ts:132,150,152` and `entities-projeto-etapa-tarefa.spec.ts:200,237,301,304,362` and `entities-ticket-subtarefa.spec.ts:187,235-390` (`.selectOption(...)` on what becomes a `Select.Trigger` button — no `<option>` elements exist anymore), and `entities-rotina-log.spec.ts:126-127` (`.locator("option").evaluateAll(...)` to enumerate `tipoGeracao`'s choices) [VERIFIED: literal grep of every `.selectOption(`/`field-.*\.fill(` call site in `web/e2e/*.spec.ts`, run this session — exact line numbers above].
**Why it happens:** These specs were written against the native `<input type="date">`/`<select>` markup that predates this phase.
**How to avoid:** Officially, VERIFY-01 ("every existing spec passes against restyled markup") is Phase 11's requirement — but leaving these four files red between Phase 10 and Phase 11 means the suite reports failures that are indistinguishable from a real regression for an entire phase-boundary. **Recommend updating these specific call sites as part of this phase's own plan** (not deferring the fix), converting: `.fill(dateStr)` → click the date-picker `Button`, then click the day inside `[data-slot="popover-content"]` (see Validation Architecture below); `.selectOption(value)` → click the `Select.Trigger`, then `page.getByRole("option", { name: ... }).click()`; `.locator("option").evaluateAll(...)` → open the Select first, then `page.locator('[data-slot="select-content"]').getByRole("option").allTextContents()`. Checkbox interactions (`.isChecked()`/`.check()`/`.uncheck()` in `entities-fundos.spec.ts:124,147`) need **no change at all** — see Pitfall 3.
**Warning signs:** `bun run test:e2e` failing on these four files immediately after this phase's markup change, with errors like "Element is not an <input>, <textarea> or [contenteditable] element" (from `.fill()`) or "Element is not a <select> element" (from `.selectOption()`).

### Pitfall 3: Checkbox interactions in existing specs need zero code changes (false alarm to watch for)

**What goes wrong:** It's tempting to assume `.isChecked()`/`.check()`/`.uncheck()` (used in `entities-fundos.spec.ts:124,147`) will also break, since the underlying element changes from `<input type="checkbox">` to a bits-ui `<button role="checkbox">`.
**Why it happens:** Surface-level pattern-matching with the Select/date breakage above.
**How to avoid:** Don't touch these lines. Playwright's `.check()`/`.uncheck()`/`.isChecked()` are ARIA-role-aware, not element-type-aware — they operate on any element exposing `role="checkbox"` + `aria-checked`, which the restyled `Checkbox` provides identically [VERIFIED: `web/node_modules/bits-ui/dist/bits/checkbox/checkbox.svelte.js:172`, `"aria-checked": getAriaChecked(...)`].
**Warning signs:** None — this is a preventative note to stop the executor from "fixing" code that doesn't need fixing.

### Pitfall 4: No `Combobox` registry entry exists — don't spend time searching for one

**What goes wrong:** REQUIREMENTS.md ENTFRM-03 mentions "`Select`/`Combobox` primitives," which could read as "pick whichever is available and richer."
**Why it happens:** Other shadcn ecosystems (React) do ship a first-class Combobox composition; it's reasonable to expect the same here.
**How to avoid:** `curl https://shadcn-svelte.com/registry/styles/nova/combobox.json` returns the site's HTML 404 fallback page, not a registry JSON payload [VERIFIED: run this session] — the `nova` style has no discrete Combobox target at all (it would have to be hand-composed from `Popover`+`Command`, and `Command` isn't in scope for this phase). Use `Select` uniformly for every relationship/enum field, exactly as designed in Pattern 3 above — this is also the only choice consistent with the "não precisa inventar moda" spirit already established in Phase 9's Badge-column decisions.
**Warning signs:** A plan task budgeting time to "evaluate Combobox vs Select" — there is no live Combobox alternative to evaluate against.

## Code Examples

### `App.svelte` — mount `Toaster` once, outside the auth boundary

```svelte
<script lang="ts">
  import { SignedIn, SignedOut } from "@instantdb/svelte";
  import LoginScreen from "./lib/auth/LoginScreen.svelte";
  import { db } from "./lib/db";
  import Shell from "./lib/Shell.svelte";
  import { Toaster } from "$lib/components/ui/sonner";
</script>

<h1>Apollo v2</h1>
<Toaster />

<SignedOut {db}>
  <LoginScreen />
</SignedOut>

<SignedIn {db}>
  <div data-testid="app-shell">
    <Shell />
  </div>
</SignedIn>
```

### `EntityScreen.svelte` — toast calls added to `handleSubmit`/`handleDelete`

```svelte
<!-- Source: import { toast } from "svelte-sonner" — confirmed exact export shape via
     https://www.shadcn-svelte.com/docs/components/sonner, fetched live this session -->
<script lang="ts">
  import { toast } from "svelte-sonner";
  // ...existing imports...
</script>
```
```ts
// inside handleSubmit's try block, after the existing `mode = null; editingId = null;`:
mode = null;
editingId = null;
toast.success(mode === "create" ? "Registro criado." : "Registro atualizado.");
// Note: capture the pre-reset mode into a local const BEFORE nulling mode, since the
// ternary above reads `mode` after it has already been set to null — see the
// exact ordering fix noted in the Assumptions Log (A2).
```
```ts
// inside handleSubmit's catch block, unchanged formError assignment, PLUS:
} catch (err) {
  formError = extractErrorMessage(err);
  toast.error(formError);
}
```
```ts
// handleDelete, symmetric addition:
async function handleDelete(row: Row) {
  const confirmed = window.confirm(`Excluir este registro de ${config.titulo}?`);
  if (!confirmed) return;
  formError = null;
  try {
    const tx = db.tx as unknown as Record<string, Record<string, { delete: () => unknown }>>;
    await db.transact(tx[config.etype][row.id].delete() as never);
    toast.success("Registro excluído.");
  } catch (err) {
    formError = extractErrorMessage(err);
    toast.error(formError);
  }
}
```

### `LoginScreen.svelte` — toast calls added to the existing two auth functions

```ts
async function enviarCodigo() {
  if (ocupado) return;
  ocupado = true;
  erro = null;
  try {
    await db.auth.sendMagicCode({ email });
    step = "code";
    toast.success("Código enviado.");
  } catch (err) {
    erro = (err as { body?: { message?: string } }).body?.message ?? "Falha ao enviar código.";
    toast.error(erro);
  } finally {
    ocupado = false;
  }
}

async function verificarCodigo() {
  if (ocupado) return;
  ocupado = true;
  erro = null;
  try {
    await db.auth.signInWithMagicCode({ email, code });
    toast.success("Login realizado.");
  } catch (err) {
    erro = (err as { body?: { message?: string } }).body?.message ?? "Código inválido.";
    toast.error(erro);
  } finally {
    ocupado = false;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Older shadcn-svelte styles wrapping bits-ui `asChild`/render-prop pattern universally | `nova` style uses the `child`-snippet pattern (`{#snippet child({ props })}`) **only** where a component needs to merge trigger behavior onto an arbitrary child (Popover.Trigger, Select's optional custom trigger element, Dialog.Close's icon button) — most components (Select.Trigger, Checkbox.Root) render their own styled native element directly and need no snippet at all | Confirmed live in the installed `1.5.0` CLI's `nova` registry this session (same finding pattern as Phase 8's research, extended here to the components that DO wrap interactive primitives) | The `child`-snippet gotcha is real but narrow — only the date-picker's `Popover.Trigger`+`Button` composition in this phase needs it; every other new component (Select, Checkbox, Dialog, Calendar) forwards `data-testid` with zero snippet ceremony |
| shadcn-svelte's Sonner registry entry assumes `mode-watcher`-based dark mode | This project's Phase 7 conversion to bare `prefers-color-scheme` | Phase 7, this milestone | Requires a one-file hand-edit deviation from the stock `add sonner` output (Pitfall 1) — the only component in this phase that cannot be installed and used verbatim |

**Deprecated/outdated:** None specific to this phase's date/select/checkbox/dialog components — all fetched live from the current registry this session, matching the already-pinned `nova` style and `1.5.0` CLI version.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dialog (not Sheet) is the right container, widened via `class="sm:max-w-lg"` rather than switching to Sheet for the two highest-field-count entities | Architecture Patterns: Pattern 1 | Low — REQUIREMENTS.md ENTFRM-01 explicitly allows either; if a reviewer prefers Sheet, the field-widget patterns (Select/Checkbox/Calendar/Popover) are identical regardless of the outer container, only the wrapping component swaps |
| A2 | `handleSubmit`'s toast message needs the pre-reset `mode` value captured in a local const before `mode = null` runs, to correctly say "criado" vs "atualizado" | Code Examples | Low — purely cosmetic wording; a planner/executor who misses this ordering nuance still satisfies FDBK-01's literal requirement (a toast fires on success), just with a generic message instead of a mode-specific one |
| A3 | `theme="system"` passed directly to the hand-written Sonner wrapper is sufficient to satisfy "no toggle" (C-11) without needing to also verify it live-updates when the OS scheme changes mid-session | Common Pitfalls: Pitfall 1 | Low — confirmed via reading `svelte-sonner`'s own source (`$effect`-driven `matchMedia` listener) that it does react live, not just at initial mount; risk only materializes if a future `svelte-sonner` major version removes that internal listener, in which case a `<ModeWatcher>`-free CSS-variable-based fallback would need re-deriving |
| A4 | Selecting a day exactly in the middle of the currently-displayed month (e.g. day "15") in Playwright avoids any ambiguity with adjacent-month overflow days sharing the same visible number | Validation Architecture | Low — a 42-cell (6-week) calendar grid's overflow days are confined to the first/last 1-6 cells; day 15 cannot collide with either boundary in any month layout, but this hasn't been executed live yet — first live test run should confirm |

## Open Questions

1. **Should the date-picker's `Calendar` `locale` prop be `"pt-BR"` (matching the app's Portuguese UI text) or left at the shadcn default `"en-US"`?**
   - What we know: The shadcn `Calendar` wrapper defaults `locale = "en-US"` [VERIFIED: `curl https://shadcn-svelte.com/registry/styles/nova/calendar.json`, read this session]. The app's own visible copy ("novo", "salvar", "cancelar", "Nenhum registro.") is Portuguese.
   - What's unclear: Whether `pt-BR` locale changes the calendar's weekday-header abbreviations/month names in a way that affects any Playwright text-based assertion (e.g. asserting a month name appears).
   - Recommendation: Pass `locale="pt-BR"` on the `Calendar` for UI consistency with the rest of the app; the Validation Architecture's Playwright strategy below deliberately avoids asserting on locale-dependent text (month names, weekday abbreviations, `aria-label` full-date strings) precisely to stay locale-agnostic regardless of this choice.

2. **Should `entity-cancel`'s `Button` also be given `variant="outline"` or `variant="ghost"` for visual distinction from `entity-submit`?**
   - What we know: Neither ENTFRM-01..04 nor ROADMAP Phase 10's success criteria specify a variant for these two buttons.
   - What's unclear: Whether Dialog's own close-X (default variant `ghost`, `size="icon-sm"`) already provides enough visual "escape hatch" affordance, making `entity-cancel`'s own variant purely cosmetic.
   - Recommendation: Discretionary — `variant="outline"` on `entity-cancel` (matching Phase 9's row-edit precedent) is a reasonable default with zero testability impact either way.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun`/`bunx` | C-08, running `shadcn-svelte add`/`bun add`/Playwright | ✓ | matches Phase 8's `1.3.12` finding, unchanged this session | — |
| Network access to `shadcn-svelte.com` registry | `shadcn-svelte add`, and this session's own research `curl` calls | ✓ | confirmed via direct `curl` this session for dialog/select/checkbox/textarea/popover/calendar/sonner/combobox(404) | — |
| Network access to `registry.npmjs.org` | `npm view` version/legitimacy checks this session | ✓ | confirmed live this session | — |
| Network access to InstantDB (`instantdb.com`) | live entity CRUD + auth round trips in new/updated Playwright specs | ✓ (implied — Phase 8/9's specs already pass against the live app; not independently re-checked this session) | — | — |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** none identified.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `@playwright/test` `^1.62.1` [VERIFIED: `web/package.json` devDependencies, matches Phase 8/9's own finding] |
| Config file | `web/playwright.config.ts` — three projects: `setup` (real magic-code round trip), `authed` (depends on `setup`, reuses `STORAGE_STATE`), `anon` (empty storageState) [VERIFIED: read in full this session] |
| Quick run command | `bunx playwright test <file> --project=authed` for targeted entity-CRUD specs |
| Full suite command | `bun run test:e2e` (all three projects) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENTFRM-01 | Create/edit opens a `Dialog` (`role="dialog"` [VERIFIED: `web/node_modules/bits-ui/dist/bits/dialog/dialog.svelte.js:265`, `role: this.root.opts.variant.current === "alert-dialog" ? "alertdialog" : "dialog"`]) containing the field-kind-matched primitives | e2e (authed, new/extended spec) | `bunx playwright test e2e/entities-form-restyle.spec.ts --project=authed` | ❌ Wave 0 — new spec, one per capability class (fundos full-CRUD, instanciasRotina restricted single-field edit) |
| ENTFRM-02 | Clicking the date-picker `Button` opens `[data-slot="popover-content"]`; clicking a mid-month day (e.g. "15") sets the field, and the value round-trips through `db.transact()` to live InstantDB correctly | e2e (authed, same new spec, extends `entities-fundos.spec.ts` WEB-02's `createdAt` interaction) | same command as above, plus updating `entities-fundos.spec.ts:122`'s `.fill("2026-01-15")` call (see Pitfall 2) | ❌ Wave 0 for the new spec; existing file needs the call-site update in this phase, per Pitfall 2's recommendation |
| ENTFRM-03 | A `Select.Trigger` (`role="combobox"`) opens `role="listbox"`/`role="option"` content; selecting an option updates `selectedLinks`/`formValues` and the xorLink two-step structure still enforces "exactly one" | e2e (authed, same new spec + updated `entities-projeto-etapa-tarefa.spec.ts`/`entities-ticket-subtarefa.spec.ts`/`entities-rotina-log.spec.ts` call sites) | `bunx playwright test e2e/entities-form-restyle.spec.ts e2e/entities-projeto-etapa-tarefa.spec.ts e2e/entities-ticket-subtarefa.spec.ts e2e/entities-rotina-log.spec.ts --project=authed` | ❌ Wave 0 for the new spec; ❌ existing files need `.selectOption()`→click-role-option conversion this phase |
| ENTFRM-04 | Submitting with a missing required field renders `Alert[variant=destructive]` with `data-testid="entity-error"`, blocks the transact, and triggers zero `window.alert`/`confirm` (proven via a `page.on("dialog", ...)` assertion that fires zero times during the submit path) | e2e (authed, new spec) | same command as ENTFRM-01 | ❌ Wave 0 — same new spec file, add a dedicated test case |
| FDBK-01 | `db.transact()`/`db.auth.*` success and failure each render `[data-sonner-toast][data-type="success"|"error"]` with `[data-title]` text matching the outcome, for one entity per capability class plus both auth actions | e2e (authed for entity CRUD, anon/setup for auth) | `bunx playwright test e2e/entities-form-restyle.spec.ts e2e/login-flow.spec.ts --project=authed,anon` | ❌ Wave 0 for entity-CRUD toast assertions (new spec); ❌ `login-flow.spec.ts` (Phase 8, already exists) needs two new toast assertions added |

### Concrete Playwright locator strategies (bits-ui portal/role specifics)

All of the following were confirmed by reading the actual installed `bits-ui` source this session, not assumed from general Radix/shadcn familiarity:

- **Select:** `await page.getByTestId("field-tipoPrazo").click();` (opens — trigger is `role="combobox"`) then `await page.getByRole("option", { name: "hard", exact: true }).click();` (items are `role="option"` inside a `role="listbox"` [VERIFIED: `select.svelte.js:485,857,991`]). Portal-rendered content is still attached to the page's DOM tree (bits-ui's `Portal` moves it to `document.body` by default, it does not use an iframe) — `page.getByRole`/`page.getByTestId` traverse the whole document regardless of portal target, no special handling needed.
- **Checkbox:** No change from today's pattern — `.check()`/`.uncheck()`/`.isChecked()` work unmodified (Pitfall 3).
- **Dialog:** `await expect(page.getByRole("dialog")).toBeVisible();` after clicking `entity-create-start`/`row-edit`. Closing: clicking `entity-cancel` OR the Dialog's own close-X OR pressing Escape all route through the same `onOpenChange(false)` → `cancelForm()` path (Pattern 1) — a single assertion (`await expect(page.getByTestId("entity-submit")).toHaveCount(0)`) proves closure regardless of which path was used.
- **Popover + Calendar date-picker:** `await page.getByTestId("field-dataPrevista").click();` opens the popover; scope subsequent interaction to `page.locator('[data-slot="popover-content"]')` (confirmed `data-slot` attribute set on `popover-content.svelte` [VERIFIED: registry source, read this session]) and click a mid-month day by its exact visible text, e.g. `await page.locator('[data-slot="popover-content"]').getByText("15", { exact: true }).click();` — deliberately avoiding the day cell's `aria-label` (a full locale-formatted date string, e.g. via `role="button"` + `aria-label={cell.labelText}` [VERIFIED: `calendar.svelte.js:538-539`]) since that text is locale-dependent (see Open Question 1) and the plain visible day-number text is not.
- **Sonner toast:** `await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();` then optionally `.locator('[data-title]')` for message-text assertions [VERIFIED: `curl https://raw.githubusercontent.com/wobsoriano/svelte-sonner/main/src/lib/Toast.svelte`, grepped this session — `data-sonner-toast=""`, `data-type={toastType}`, `data-title=""`].
- **Zero native dialog proof (ENTFRM-04):** Register `page.on("dialog", (d) => { throw new Error(`Unexpected native dialog: ${d.message()}`); })` before the invalid-submit interaction (contrast with `entities-fundos.spec.ts:108`'s intentional `dialog.accept()` for the *delete* confirm, which this phase's scope explicitly excludes per CONTEXT.md's Deferred Ideas) — a thrown error inside the listener fails the test if any native dialog fires during the validation-error path.

### Sampling Rate

- **Per task commit:** targeted `bunx playwright test <new-or-touched-spec> --project=<matching project>`.
- **Per wave merge:** `bun run test:e2e` (full suite, including the four existing files this phase's Pitfall 2 recommends updating).
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus `bun run check` (svelte-check) and `bun run lint` (Biome) clean, per C-08/QUAL-01 precedent from Phases 8-9.

### Wave 0 Gaps

- [ ] `web/e2e/entities-form-restyle.spec.ts` — new spec, covers ENTFRM-01/02/03/04 + FDBK-01 (entity side) across one entity per capability class (`fundos` full-CRUD including the date-picker + boolean Checkbox, `instanciasRotina` single-field status-only edit, `templatesRotina` or `subtarefas` for Select/xorLink coverage), added to the `authed` project's default `testMatch` (no config edit needed, matches Phase 9's `entities-table-restyle.spec.ts` precedent).
- [ ] `web/e2e/login-flow.spec.ts` (Phase 8, existing) — add two toast assertions (success + error) for FDBK-01's auth side; this file already runs live magic-code round trips, no new infrastructure needed.
- [ ] Four existing spec files' `.fill()`/`.selectOption()` call sites — update per Pitfall 2, in this phase's own plan (not deferred to Phase 11's VERIFY-01), to avoid a red suite persisting across the phase boundary: `entities-fundos.spec.ts`, `entities-rotina-log.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts`.
- [ ] Framework install: none — `@playwright/test` already installed and configured (Phase 6/7/8/9).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | yes | Unchanged — `db.auth.sendMagicCode`/`signInWithMagicCode` calls are untouched; this phase only adds a `toast.success`/`toast.error` reaction to their existing resolve/reject, no new auth logic |
| V3 Session Management | no | Session storage untouched by this phase |
| V4 Access Control | no | `instant.perms.ts` untouched; the `parent_not_found` pre-check and `donoId` injection in `handleSubmit` are unchanged verbatim |
| V5 Input Validation | yes | `required`/`type="email"`/`type="number"` attribute-level validation is preserved on `Input`/`Textarea`; `Select`'s `type="single"` + explicit option lists preserve the existing "no free text" invariant for `tipoPrazo`/`tipoGeracao` enum fields exactly as the native `<select>` did |
| V6 Cryptography | no | No cryptographic code in this phase |
| V7 Error Handling and Logging | yes | `extractErrorMessage(err)` is unchanged; this phase adds `toast.error(formError)` as an *additional* surface for the same already-sanitized message (never raw `err` objects), consistent with the existing fallback-to-generic-PT-BR-message pattern |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Toast message echoing raw backend error text (potential internals leakage) | Information Disclosure | Unchanged risk profile from the existing `Alert`-based error display — `toast.error(formError)` reuses the exact same already-sanitized `formError`/`extractErrorMessage()` value, never a raw exception; no new leakage surface introduced |
| XSS via unsanitized interpolation into `Select.Item`/`Dialog.Title`/toast content | Tampering | Svelte's default text interpolation (`{opt}`, `{config.titulo}`, `toast.success("...")` with static or already-sanitized strings) is auto-escaped; no `{@html}` introduced anywhere in this phase's changes |
| Native `window.confirm` on delete remaining un-migrated (explicitly out of scope this phase) | Tampering (accidental data loss via un-styled but still-functional confirm) | No new risk — this is the exact pre-existing behavior, explicitly deferred per CONTEXT.md; ENTFRM-04's "no `window.alert`/`confirm`" success-criterion language is scoped to the *submission* validation path, not delete, per ROADMAP SC4's literal text and CONTEXT.md's Deferred Ideas section |

## Sources

### Primary (HIGH confidence)

- `https://shadcn-svelte.com/registry/styles/nova/{dialog,select,checkbox,textarea,popover,calendar,sonner}.json` — full component source for every new component, fetched live via `curl` this session [VERIFIED]
- `https://shadcn-svelte.com/registry/styles/nova/combobox.json` — confirmed 404/no such registry entry, fetched live this session [VERIFIED]
- `web/node_modules/bits-ui/dist/bits/{select,checkbox,dialog,calendar,popover}/**` — actual installed runtime source, read/grepped this session for roles, ARIA attributes, and bindable/`onXChange` prop shapes [VERIFIED]
- `web/node_modules/@internationalized/date/package.json` — installed version `3.12.3`, read this session [VERIFIED]
- `https://raw.githubusercontent.com/wobsoriano/svelte-sonner/main/src/lib/{Toaster,Toast}.svelte` — actual `svelte-sonner` source, fetched live this session, confirming `theme="system"`'s `matchMedia`-based behavior and `data-sonner-toast`/`data-type`/`data-title` DOM attributes [VERIFIED]
- `npm view shadcn-svelte version`, `npm view bits-ui version`, `npm view svelte-sonner version`, `npm view svelte-sonner scripts.postinstall` — registry versions/postinstall-script check, run this session [VERIFIED]
- `gsd_run query package-legitimacy check --ecosystem npm bits-ui svelte-sonner mode-watcher @internationalized/date` — legitimacy verdicts this session [VERIFIED]
- `web/src/lib/entities/EntityScreen.svelte`, `web/src/lib/entities/defs/*.ts` (all 9), `web/src/lib/entities/types.ts`, `web/src/lib/auth/LoginScreen.svelte`, `web/App.svelte`, `web/e2e/*.spec.ts` (grepped for `.selectOption`/`.fill` call sites), `web/playwright.config.ts`, `web/package.json`, `web/components.json` — all read in full or grepped this session [VERIFIED]
- `.planning/phases/08-auth-shell-restyle/08-RESEARCH.md`, `.planning/phases/09-entity-table-restyle/09-01-SUMMARY.md` — prior-phase precedent read this session for consistency [VERIFIED]

### Secondary (MEDIUM confidence)

- `https://www.shadcn-svelte.com/docs/components/date-picker` — official Svelte 5 date-picker composition example, fetched via WebFetch this session, cross-checked against the live registry source [CITED]
- `https://www.shadcn-svelte.com/docs/components/select` — official Svelte 5 Select usage example, fetched via WebFetch this session, cross-checked against the live registry source [CITED]
- `https://www.shadcn-svelte.com/docs/components/sonner` — official Toaster-mount/`toast`-call usage example, fetched via WebFetch this session [CITED]
- `@internationalized/date`'s `parseDate`/`CalendarDate.toString()` round-trip behavior — confirmed via WebSearch this session, cross-checked against the installed `calendar.svelte`'s `DateValue`-typed bindable prop [CITED, cross-verified]

### Tertiary (LOW confidence)

- None — every claim that could be verified directly against installed tooling, live registry source, or in-repo files was verified that way rather than left as unconfirmed training-data recall.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every new component's registry devDependency was checked against the actually-installed `bits-ui`/`@internationalized/date` versions this session; confirmed zero version bump needed for six of seven new components
- Architecture: HIGH — the exact form block being restyled, every entity def file, and the exact ISO-date-conversion helpers were read in full this session; the Dialog-vs-Sheet and Select-vs-Combobox questions were resolved by directly probing the live registry (404 on combobox), not by general shadcn-svelte familiarity
- Pitfalls: HIGH — the mode-watcher conflict (Pitfall 1) and the four existing-spec breakage sites (Pitfall 2) were both discovered by direct inspection (registry JSON read, literal grep of e2e spec files) rather than anticipated generically

**Research date:** 2026-08-09
**Valid until:** 30 days (stable component registry; re-verify `shadcn-svelte`/`bits-ui`/`svelte-sonner` versions if this phase's execution slips past early September 2026)
