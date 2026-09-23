# Quick Task 260923-ivg: Tooltips + diaSemana clear-bug fix — Research

**Researched:** 2026-09-23
**Domain:** Svelte 5 + bits-ui component wrapper (new Tooltip primitive) + a generic-form select-rendering bug fix in `EntityScreen.svelte`
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D1 — Tooltip trigger and icon.** New `Tooltip` component at
`web/src/lib/components/ui/tooltip/`, built on the same `bits-ui` primitive
family already used by the existing `Popover` component (consistency with
this project's established shadcn-svelte-style wrapper pattern under
`web/src/lib/components/ui/`). Trigger: hover AND keyboard focus
(accessibility — a mouse-only tooltip is unusable via Tab navigation). Icon:
`circle-help` from `@lucide/svelte` (confirmed present in
`node_modules/@lucide/svelte/dist/icons/circle-help.js` this session), placed
immediately after each field's label, `text-muted-foreground` sizing
consistent with this project's existing icon usage (e.g. `CircleAlert` in
`EntityScreen.svelte`).

**D2 — Help copy source of truth.** Every tooltip's text must be derived from
the actual generation-engine code (`cli/apollo_cli/routine_job.py` /
`web/src/lib/routineJob.ts`), read in full before writing copy — never
invented or guessed. Required content per field:
- `tipoGeracao`: explain all 4 values (`du_fixo`, `corrido_fixo`, `semanal`,
  `encadeado`) and when to use each, per the engine's actual semantics.
- `offsetDias`: explain its meaning is conditional on `tipoGeracao` (Nth
  business day for `du_fixo`, Nth calendar day for `corrido_fixo`, business
  days after antecessor for `encadeado`, not applicable to `semanal`).
- `diaSemana`: explain it only applies when `tipoGeracao == "semanal"`.
- `regraCompetencia`: explain the exact accepted vocabulary (read the engine
  code to confirm the literal strings it accepts — do not guess).
- `propagarAtrasoSoft`: MUST honestly state this field is currently
  reserved/has no effect on generation (every generated instance is
  hardcoded `tipoPrazo="soft"` regardless of this field's value — confirmed
  this session at `routineJob.ts:146` / `routine_job.py:73`, decision VAL-02
  already documented in `PROJECT.md`/v1.5). Do not word this tooltip as if
  the field currently does something it doesn't.
- `ativo`: explain only active templates are considered by the
  instance-generation job.

**D3 — Select "clear to empty" fix mechanism.** `EntityScreen.svelte`'s
generic `kind: "select"` field renderer (around lines 690-709) currently
never emits a blank/"—" `<Select.Item>`, unlike its own link-select rendering
(around lines 735/788) which already does. Fix: emit a blank option for
`kind: "select"` fields that are NOT `required: true` in their `EntityConfig`
field definition (check `types.ts` for how `required` is currently expressed
on a plain select field — reuse that existing flag rather than inventing a
new one). `diaSemana` (`required` should be false/absent, since it is only
meaningful for one of 4 `tipoGeracao` values) must gain the blank option;
`tipoGeracao` (`required: true`, always meaningful) must NOT gain one — this
is existing product behavior, do not weaken the required-field guarantee.

**D4 — Verification.** Live Playwright tests (this project's established
convention — no mocking): confirm a tooltip's exact expected text appears on
hover/focus for at least the `propagarAtrasoSoft` field (the one with the
most consequential, easy-to-get-wrong copy) and one other field; confirm
`diaSemana` can be set then cleared back to empty via the real UI, with the
persisted value actually becoming absent/null (not just visually blank)
after save.

### Claude's Discretion
- Exact wording/length of each tooltip's copy (must satisfy D2's
  factual-accuracy requirement, phrasing itself is planner/executor
  judgment).
- Whether the Tooltip component supports rich content (multi-line, lists) or
  plain text only — plain text is sufficient for this task's copy, keep the
  component itself simple unless a field's copy genuinely needs structure.
- Task/file breakdown — likely 2 tasks: (1) new Tooltip component + Select
  clear-fix (infrastructure), (2) wiring tooltips into `templatesRotina.ts`'s
  field defs with the actual copy + live verification. Planner's call if a
  different split is cleaner.

### Deferred Ideas (OUT OF SCOPE)
None recorded in CONTEXT.md beyond this task's own boundary. Nothing in this
research proposes expanding scope.
</user_constraints>

## Summary

This is an infrastructure-plus-copy task with one genuinely load-bearing
technical risk. Infrastructure: a new `Tooltip` wrapper component under
`web/src/lib/components/ui/tooltip/` should wrap **bits-ui's own `Tooltip`
primitive** (confirmed present and exported at this project's installed
`bits-ui@^2.16.3` — `dist/bits/tooltip/`, re-exported from the package root),
not be hand-rolled on top of `Popover` — bits-ui's `Tooltip` already
implements hover-delay, keyboard-focus-open, Escape-to-close, and
`aria-describedby` wiring natively, exactly matching D1's accessibility
requirement with zero custom behavior code. The wrapper should mirror the
existing `Popover` wrapper's file-per-primitive, `bits-ui`-import,
`cn()`-class-merge pattern exactly (see Code Examples below for the full
source of every `popover-*.svelte` file, read in full this session).

The `diaSemana` clear-bug (D3) has two parts, and only the first is what the
task description names. Part A — the *rendering* bug — is exactly as
CONTEXT.md describes: `EntityScreen.svelte`'s generic `kind: "select"`
renderer (lines 688-710) never emits a blank `<Select.Item>`, unlike the
link-select renderer three code-blocks below it (lines 715-745, blank item at
735, guarded by `{#if !link.required}`) and the `xorLink` second-select block
(lines 769-798, blank item unconditional at 788). Fixing Part A alone (adding
a `{#if !f.required}<Select.Item value="" label="—">—</Select.Item>{/if}`
inside the `kind === "select"` block) is necessary but **not sufficient** to
satisfy D4's stricter requirement ("the persisted value actually becoming
absent/null... not just visually blank"). Part B — the *submit-payload* gap —
is a pre-existing, task-relevant behavior discovered this session:
`handleSubmit`'s payload-building loop (lines 294-313) explicitly `continue`s
(skips adding the key to `payload` entirely) whenever an optional field's
current value is `""`/`undefined` (line 298: `if (raw === undefined || raw
=== "") { if (f.required) {...}; continue; }`). Since InstantDB's `.update()`
only touches keys present in the payload, clearing `diaSemana` to `""` in the
form and submitting will currently **not** change the persisted value at
all — the old `diaSemana` stays in the database, silently. The fix needs a
change to that loop (or an equivalent explicit-clear path) for this to
satisfy D4. See Common Pitfalls below for the exact mechanism and the one
open verification gap (InstantDB's own docs do not document whether
top-level scalar attributes accept `null` as a "remove" sentinel via
`update()` — only `merge()` on nested JSON objects is documented that way).

**Primary recommendation:** wrap bits-ui's native `Tooltip` (not `Popover`);
fix both the rendering gap (add blank `Select.Item`) and the payload gap
(explicitly send a clearing value for a field whose form value went from
non-empty to empty) in the same task, and let D4's own live Playwright
assertion (re-fetch the row after save, assert `diaSemana` is absent) be the
actual falsification test for which clearing mechanism (`null` vs literal
absence-tolerant re-query) really works against the live InstantDB app.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tooltip display (hover/focus popup) | Browser / Client | — | Pure client-side UI primitive (bits-ui), no server interaction |
| Help-copy content | Browser / Client | — | Static strings in `templatesRotina.ts`'s field defs, rendered client-side |
| Select "clear to blank" UI | Browser / Client | — | `EntityScreen.svelte` form-state rendering |
| Persisting the cleared value | API / Backend (InstantDB) | Browser / Client | The clear must reach the InstantDB `update()` payload (client-authored transact) to persist — a client-only visual fix does not satisfy D4 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `bits-ui` | `^2.16.3` [VERIFIED: web/package.json:<bits-ui line>] | Headless Svelte primitive family; already the base for every `components/ui/*` wrapper in this project (`Popover`, `Select`, `Dialog`, `AlertDialog`, etc.) | Already the project's locked primitive layer (C-11-adjacent convention); has a first-class `Tooltip` export as of this installed version — confirmed via `dist/bits/tooltip/` and `dist/index.d.ts`'s re-export list `[VERIFIED: node_modules/bits-ui/dist/index.d.ts:1]` |
| `@lucide/svelte` | `^1.31.0` [VERIFIED: web/package.json] | Icon set; `circle-help` icon for the tooltip trigger | Already the project's sole icon library (no alternative ever used) |

No new package needs to be installed — both `bits-ui` and `@lucide/svelte`
are already dependencies and already contain everything this task needs.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bits-ui's native `Tooltip` primitive | Hand-roll hover/focus/escape logic on top of `Popover` | CONTEXT.md's own framing anticipated this as a fallback, but it is unnecessary and strictly worse: bits-ui's `Tooltip` already has the exact semantics needed (`TooltipTriggerState`'s `onpointerenter`/`onfocus`/`onblur` handlers, `TooltipProviderState`'s `delayDuration`, `TooltipContentState`'s `onEscapeKeydown`) — confirmed by reading `dist/bits/tooltip/tooltip.svelte.js`'s type declarations this session `[VERIFIED: node_modules/bits-ui/dist/bits/tooltip/tooltip.svelte.d.ts]` |

**Installation:** None required — both packages are already installed.

## Package Legitimacy Audit

Not applicable — this task installs no new external packages. Both `bits-ui`
and `@lucide/svelte` are pre-existing dependencies already used elsewhere in
the codebase (`Popover`, `Select`, and `CircleAlert` respectively), so no new
legitimacy check applies.

## Architecture Patterns

### Recommended Project Structure
```
web/src/lib/components/ui/tooltip/
├── index.ts               # re-exports: Root, Trigger, Content, Provider (mirrors popover/index.ts)
├── tooltip.svelte          # wraps bits-ui Tooltip.Root
├── tooltip-provider.svelte # wraps bits-ui Tooltip.Provider (needed once, near app root or per-instance)
├── tooltip-trigger.svelte  # wraps bits-ui Tooltip.Trigger
└── tooltip-content.svelte  # wraps bits-ui Tooltip.Content, shadcn-style content classes
```

### Pattern 1: Wrapper component mirrors the existing Popover family exactly

**What:** Each `components/ui/tooltip/*.svelte` file is a thin pass-through
around the matching `bits-ui` `Tooltip` primitive — same shape as every
existing `Popover` file in this repo.

**When to use:** For this task's Tooltip component specifically; this is
the project's established convention for every `components/ui/*` wrapper.

**Example — the existing Popover family, read in full this session (exact
current source, to mirror 1:1 for Tooltip):**

```svelte
<!-- Source: web/src/lib/components/ui/popover/popover.svelte (verbatim) -->
<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";

	let { open = $bindable(false), ...restProps }: PopoverPrimitive.RootProps = $props();
</script>

<PopoverPrimitive.Root bind:open {...restProps} />
```

```svelte
<!-- Source: web/src/lib/components/ui/popover/popover-trigger.svelte (verbatim) -->
<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: PopoverPrimitive.TriggerProps = $props();
</script>

<PopoverPrimitive.Trigger
	bind:ref
	data-slot="popover-trigger"
	class={cn("", className)}
	{...restProps}
/>
```

```svelte
<!-- Source: web/src/lib/components/ui/popover/popover-content.svelte (verbatim) -->
<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";
	import type { ComponentProps } from "svelte";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";
	import PopoverPortal from "./popover-portal.svelte";

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		align = "center",
		portalProps,
		...restProps
	}: PopoverPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof PopoverPortal>>;
	} = $props();
</script>

<PopoverPortal {...portalProps}>
	<PopoverPrimitive.Content
		bind:ref
		data-slot="popover-content"
		{sideOffset}
		{align}
		class={cn(
			"flex flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 z-50 w-72 origin-(--transform-origin) outline-hidden",
			className
		)}
		{...restProps}
	/>
</PopoverPortal>
```

`[VERIFIED: web/src/lib/components/ui/popover/popover.svelte, popover-trigger.svelte, popover-content.svelte — full files read this session]`

**bits-ui's `Tooltip` namespace has the equivalent primitives** (confirmed
by reading the package's own `.d.ts`/`.svelte` sources this session, not
merely by name-matching against `Popover`):

```
Tooltip.Provider   — dist/bits/tooltip/components/tooltip-provider.svelte
Tooltip.Root       — dist/bits/tooltip/components/tooltip.svelte(.d.ts)
Tooltip.Trigger    — dist/bits/tooltip/components/tooltip-trigger.svelte(.d.ts)
Tooltip.Content    — dist/bits/tooltip/components/tooltip-content.svelte(.d.ts)
Tooltip.ContentStatic — dist/bits/tooltip/components/tooltip-content-static.svelte(.d.ts)
Tooltip.Arrow      — dist/bits/tooltip/components/tooltip-arrow.svelte(.d.ts)
```

All re-exported from the package root: `export { ..., Tooltip, Portal, ...
} from "./bits/index.js"` `[VERIFIED: node_modules/bits-ui/dist/index.d.ts:1]`.

`TooltipProviderState`'s actual verbatim source (confirms hover-delay +
close-on-trigger-click + disable knobs exist natively):

```svelte
<!-- Source: node_modules/bits-ui/dist/bits/tooltip/components/tooltip-provider.svelte (verbatim) -->
<script lang="ts">
	import { boxWith } from "svelte-toolbelt";
	import type { TooltipProviderProps } from "../types.js";
	import { TooltipProviderState } from "../tooltip.svelte.js";

	let {
		children,
		delayDuration = 700,
		disableCloseOnTriggerClick = false,
		disableHoverableContent = false,
		disabled = false,
		ignoreNonKeyboardFocus = false,
		skipDelayDuration = 300,
	}: TooltipProviderProps = $props();

	TooltipProviderState.create({
		delayDuration: boxWith(() => delayDuration),
		disableCloseOnTriggerClick: boxWith(() => disableCloseOnTriggerClick),
		disableHoverableContent: boxWith(() => disableHoverableContent),
		disabled: boxWith(() => disabled),
		ignoreNonKeyboardFocus: boxWith(() => ignoreNonKeyboardFocus),
		skipDelayDuration: boxWith(() => skipDelayDuration),
	});
</script>

{@render children?.()}
```

`TooltipTriggerState`'s prop surface (confirms native hover + focus + blur +
click handlers, i.e. D1's "hover AND keyboard focus" requirement is already
built in, not something the wrapper needs to implement):

```
readonly props: {
    readonly onpointerup: PointerEventHandler<HTMLElement>;
    readonly onpointerdown: PointerEventHandler<HTMLElement>;
    readonly onpointerenter: PointerEventHandler<HTMLElement>;
    readonly onpointermove: PointerEventHandler<HTMLElement>;
    readonly onpointerleave: PointerEventHandler<HTMLElement>;
    readonly onfocus: FocusEventHandler<HTMLElement>;
    readonly onblur: FocusEventHandler<HTMLElement>;
    readonly onclick: MouseEventHandler<HTMLElement>;
};
```

`[VERIFIED: node_modules/bits-ui/dist/bits/tooltip/tooltip.svelte.d.ts:118-134]`

**Where to place the trigger in the form:** the field `<Label>` line is the
exact, singular attachment point for every field — read in full this
session:

```svelte
<!-- Source: web/src/lib/entities/EntityScreen.svelte:591 (verbatim) -->
<Label for={`field-${f.name}`}>{f.label}{#if f.required}<span class="text-destructive" aria-hidden="true"> *</span>{/if}</Label>
```

`[VERIFIED: web/src/lib/entities/EntityScreen.svelte:591]`

There is currently **no field-level help/description text in the data
model** — `FieldDef` (below) has no such property. A new optional property
(e.g. `help?: string`) needs to be added to `FieldDef` in `types.ts` for
`templatesRotina.ts` to attach copy per field, and `EntityScreen.svelte`'s
label line needs to render the new `Tooltip` immediately after `{f.label}`
when `f.help` is present. This is a plan-level implementation detail, not
an existing pattern — flagged here as the concrete shape research recommends
based on the file this touches.

### Pattern 2: `kind: "select"` blank-option fix (D3, Part A)

**Current buggy code (verbatim, read in full this session):**

```svelte
<!-- Source: web/src/lib/entities/EntityScreen.svelte:688-711 (verbatim) -->
            {:else if f.kind === "select"}
              <Select.Root
                type="single"
                disabled={busy}
                value={formValues[f.name] as string}
                onValueChange={(v) => {
                  formValues[f.name] = v;
                }}
              >
                <Select.Trigger
                  id={`field-${f.name}`}
                  data-testid={`field-${f.name}`}
                  aria-required={f.required}
                  class="w-full"
                >
                  {(formValues[f.name] as string) || "selecione..."}
                </Select.Trigger>
                <Select.Content>
                  {#each f.options as opt (opt)}
                    <Select.Item value={opt} label={opt}>{opt}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            {/if}
```

**The pattern already used elsewhere in the SAME file to fix this exact gap**
(link-select, three blocks below — verbatim):

```svelte
<!-- Source: web/src/lib/entities/EntityScreen.svelte:733-736 (verbatim) -->
              <Select.Content>
                {#if !link.required}
                  <Select.Item value="" label="—">—</Select.Item>
                {/if}
                {#each linkOptionsFor(link) as opt (opt.id)}
```

`[VERIFIED: web/src/lib/entities/EntityScreen.svelte:688-745 — full block read this session]`

The fix is to add the same `{#if !f.required}<Select.Item value="" label="—">—</Select.Item>{/if}` line inside the `kind === "select"` block's `<Select.Content>`, before the `{#each f.options ...}` loop. `diaSemana`'s field def already has `required: false` `[VERIFIED: web/src/lib/entities/defs/templatesRotina.ts:59-65, quoted below]`; `tipoGeracao`'s already has `required: true` `[VERIFIED: web/src/lib/entities/defs/templatesRotina.ts:46-52, quoted below]` — no field-def change needed for D3 itself, only the renderer.

### Pattern 3: The submit-payload gap (D3, Part B — the part CONTEXT.md's framing does not mention)

**Current payload-building loop (verbatim, read in full this session):**

```svelte
<!-- Source: web/src/lib/entities/EntityScreen.svelte:294-313 (verbatim) -->
      const visible = editableFields();
      const payload: Record<string, string | number | boolean> = {};
      for (const f of visible) {
        const raw = formValues[f.name];
        if (raw === undefined || raw === "") {
          if (f.required) {
            formError = `Campo obrigatório: ${f.label}`;
            toast.error(formError);
            return;
          }
          continue;
        }
        if (f.kind === "date") {
          payload[f.name] = dateInputValueToIso(raw as string);
        } else if (f.kind === "number") {
          payload[f.name] = Number(raw);
        } else {
          payload[f.name] = raw;
        }
      }
```

`[VERIFIED: web/src/lib/entities/EntityScreen.svelte:294-313]`

When an optional field's form value is `""` (empty — including right after
the user clears a previously-set select), the loop's `continue` means the
key is **never added to `payload`**, and `tx[etype][id].update(payload)` is
called downstream (line 384) with that key entirely absent. InstantDB's
`update()` only touches keys present in its argument object — it does not
treat "key absent from this call" as "clear this attribute". So today, even
after Pattern 2's fix makes the Select visually clearable, saving does
**nothing** to the persisted `diaSemana` value: the previous value silently
survives in the database. This is the actual blocker for D4's stricter
requirement ("persisted value actually becoming absent/null... not just
visually blank"). See Common Pitfalls for the concrete fix shape and its one
unverified assumption.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Tooltip hover/focus/escape/positioning | Custom `Popover`-based hover simulation (mouseenter/mouseleave/focus handlers, manual `aria-describedby` wiring) | `bits-ui`'s native `Tooltip.Root`/`Tooltip.Trigger`/`Tooltip.Content`/`Tooltip.Provider` | Already implements exactly D1's hover+focus trigger requirement, Escape-to-close, and ARIA wiring — confirmed by reading the shipped `.d.ts`/`.svelte` sources this session, not assumed from the package name |

**Key insight:** The one genuine build-vs-reuse decision in this task (how
to implement the tooltip) is already answered by what's installed — no
judgment call needed, just confirmation, which this research completed.

## Common Pitfalls

### Pitfall 1: Fixing only the Select renderer (Pattern 2) looks done but silently fails D4

**What goes wrong:** The Select visually shows a blank/"—" option, the user
picks it, the form's local `formValues[f.name]` becomes `""`, the "salvar"
click appears to succeed (no error), but after reload the field's old value
is still there.

**Why it happens:** Pattern 3's payload-building loop (line 298: `if (raw
=== undefined || raw === "") { ...; continue; }`) treats "field cleared to
empty" identically to "field was never touched" — both simply omit the key
from the InstantDB `update()` payload, and an omitted key leaves the
existing persisted value untouched.

**How to avoid:** The submit logic needs a way to distinguish "field is
optional and was never filled in" (fine to omit) from "field HAD a value and
the user explicitly cleared it back to empty" (must be sent as an explicit
clear). One concrete mechanism: track each optional field's initial value at
`startEdit()` time (already captured into `formValues` at line 238) and, at
submit time, if `raw === "" && initialValues[f.name] !== "" &&
initialValues[f.name] !== undefined`, send `payload[f.name] = null` instead
of `continue`-ing. This mirrors what the InstantDB SDK's own docs document
for `merge()` on nested objects (see next pitfall) — but is **unverified**
for a plain scalar `update()` field on this specific attribute, which is why
D4's own live Playwright re-fetch-and-assert step is exactly the right
place to prove (or disprove) this mechanism against the real app, not just
trust it from documentation.

**Warning signs:** A live Playwright assertion that only checks the UI shows
blank after clearing (not a `db.queryOnce`/CLI re-fetch of the persisted
row) would pass even if Part B is never fixed — D4 explicitly guards against
this ("not just visually blank").

### Pitfall 2: InstantDB's documented `null`-removal semantics are for `merge()`, not confirmed for plain `update()`

**What goes wrong:** Assuming `payload[f.name] = null` inside `tx[etype][id].update(payload)` is guaranteed, by InstantDB's own docs, to clear a top-level scalar attribute like `diaSemana`.

**What the docs actually say** (fetched and quoted this session,
`https://www.instantdb.com/docs/instaml`): *"Setting a key to `undefined`
will have no effect. Set the key to `null` to remove the property."* — but
this sentence, and its accompanying code example, is written specifically in
the context of `merge()` removing a key from a **nested JSON object**
(`db.tx.games[gameId].merge({ state: { '0-1': null } })` removing `'0-1'`
from the nested `state` map). The docs page does not separately state, nor
show a code example of, `update({ topLevelField: null })` clearing a
top-level scalar attribute the way `diaSemana` is modeled
(`i.string().optional()` on the entity itself, not a nested JSON blob)
`[CITED: instantdb.com/docs/instaml — page fetched and searched for every
"null" mention this session; no update()-on-scalar-attribute example found]`.

**Why it matters:** This is exactly the class of claim the absent-evidence
rule flags — the docs' silence on `update()`+scalar-`null` does not confirm
it works, nor that it doesn't. This is `[ASSUMED]`, not `[VERIFIED]`, and
cannot become `[VERIFIED]` from documentation alone.

**How to avoid:** Do not trust the `null`-clear mechanism as fact going into
execution. Either (a) prove it live in the very first executor task (a
throwaway `db.transact`/CLI probe against a scratch record, asserting the
re-queried row has no `diaSemana` key), before wiring it into the real form,
or (b) treat D4's own live Playwright assertion as that proof and be
prepared for the fix to need a different mechanism (e.g. `unlink`-style
approach does not apply here since `diaSemana` is a scalar attribute, not a
link — if `null` genuinely does not clear it, the only remaining InstantDB
primitive to investigate would be whether `update()` accepts an explicit
"delete attribute" sentinel distinct from `null`, which is undocumented on
this page and would need a support-channel/source-code check).

**Warning signs:** A live re-fetch after save showing the OLD `diaSemana`
value still present (not blank, not `null` — the literal old string) is the
signature of this exact gap.

### Pitfall 3: `required` on `FieldDef` already means "select has no blank option" for `tipoGeracao` — do not weaken it

**What goes wrong:** A well-meaning "consistency" pass adds the blank option
to every `kind: "select"` field unconditionally, including `tipoGeracao`.

**Why it happens:** The link-select pattern (Pattern 2's second code block)
guards on `!link.required`; it's easy to miss porting that same guard.

**How to avoid:** `tipoGeracao`'s field def already has `required: true`
`[VERIFIED: web/src/lib/entities/defs/templatesRotina.ts:47-52]` — the fix
must gate the new blank `Select.Item` behind `{#if !f.required}`, exactly
mirroring the link-select precedent, so `tipoGeracao` is unaffected. This is
already D3's own explicit instruction; flagged here because it is the most
mechanically easy part of the fix to get subtly wrong (an off-by-negation
`{#if f.required}` would invert the bug instead of fixing it).

## Code Examples

### `FieldDef` — the field-definition contract a new `help` property must extend (verbatim, full file read this session)

```typescript
// Source: web/src/lib/entities/types.ts:1-47 (verbatim)
export type FieldDef =
  | { name: string; label: string; required: boolean; kind: "text" }
  | { name: string; label: string; required: boolean; kind: "textarea" }
  | { name: string; label: string; required: boolean; kind: "number" }
  | { name: string; label: string; required: boolean; kind: "boolean" }
  | { name: string; label: string; required: boolean; kind: "date" }
  | { name: string; label: string; required: boolean; kind: "select"; options: readonly string[] };
```

`[VERIFIED: web/src/lib/entities/types.ts:7-13]` — no `help`/`description`/`tooltip` property exists on any variant today. It must be added (e.g. as an optional `help?: string` shared across all variants) for `templatesRotina.ts` to attach copy, and `EntityScreen.svelte`'s Label line (591) must render it via the new Tooltip.

### `templatesRotina.ts`'s exact current field list (verbatim, full file read this session — the field order/names/required-ness the tooltips attach to)

```typescript
// Source: web/src/lib/entities/defs/templatesRotina.ts:44-79 (verbatim)
  fields: [
    { name: "nome", label: "Nome", required: true, kind: "text" },
    {
      name: "tipoGeracao",
      label: "Tipo de geração",
      required: true,
      kind: "select",
      options: ["du_fixo", "corrido_fixo", "encadeado", "semanal"],
    },
    {
      name: "offsetDias",
      label: "Offset (dias)",
      required: false,
      kind: "number",
    },
    {
      name: "diaSemana",
      label: "Dia da semana",
      required: false,
      kind: "select",
      options: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"],
    },
    {
      name: "regraCompetencia",
      label: "Regra de competência",
      required: true,
      kind: "text",
    },
    {
      name: "propagarAtrasoSoft",
      label: "Propagar atraso soft",
      required: true,
      kind: "boolean",
    },
    { name: "ativo", label: "Ativo", required: true, kind: "boolean" },
  ],
```

`[VERIFIED: web/src/lib/entities/defs/templatesRotina.ts:44-79]` — CONTEXT.md's D2 field list (`tipoGeracao`, `offsetDias`, `diaSemana`, `regraCompetencia`, `propagarAtrasoSoft`, `ativo`) matches this exactly; `nome` is the only field without a D2 copy requirement.

### Engine semantics for tooltip copy (verbatim excerpts, both files read in full this session)

`tipoGeracao` values and `regraCompetencia` vocabulary — the Python module's public constants (the TS twin has the equivalent `REGRAS_COMPETENCIA_SUPORTADAS` but not a `TIPO_GERACAO_CHOICES`/`DIA_SEMANA_CHOICES` export; the web field def hardcodes its own option lists, already quoted above):

```python
# Source: cli/apollo_cli/routine_job.py:163-175 (verbatim)
TIPO_PRAZO_GERADO: Final[str] = "soft"  # D-05-C
STATUS_INICIAL: Final[str] = "pendente"
REGRAS_COMPETENCIA_SUPORTADAS: Final[tuple[str, ...]] = ("M0", "M-1", "M-2", "M+1")
TIPO_GERACAO_CHOICES: Final[tuple[str, ...]] = ("du_fixo", "corrido_fixo", "encadeado", "semanal")
DIA_SEMANA_CHOICES: Final[tuple[str, ...]] = (
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
    "domingo",
)
```

`offsetDias`'s per-`tipoGeracao` meaning — module docstring, verbatim:

```
# Source: cli/apollo_cli/routine_job.py:63-71 (verbatim, module docstring)
`du_fixo` (**JOB-02/D-27-B**): `offsetDias >= 1` counts business days forward
from the month's 1st, unchanged, via `nth_business_day_of_month`.
`offsetDias <= 0` counts business days BACKWARD from the month's last
business day instead, via the new `apollo_cli.bizdays.
nth_business_day_from_month_end`: `0` is the last business day of the month
itself, negative `N` is `N` business days before it. `_du_fixo_nth_day`
dispatches between the two based on the sign of `offsetDias`.
`corrido_fixo` is entirely untouched by this — it keeps requiring
`offsetDias >= 1` and its own `nth_calendar_day_of_month` date rule.
```

`encadeado`'s `offsetDias` meaning — module docstring, verbatim:

```
# Source: cli/apollo_cli/routine_job.py:28-29 (verbatim, module docstring)
- **D-05-B**: `offsetDias` counts BUSINESS days after the antecessor
  instance's `dataPrevista`, via `add_business_days`.
```

`semanal`'s `diaSemana`/`offsetDias` relationship — module docstring, verbatim (confirms `offsetDias` truly has zero effect for `semanal`, matching D2's "not applicable to semanal"):

```
# Source: cli/apollo_cli/routine_job.py:99-117 (verbatim, module docstring, excerpted)
`semanal` (**SEM-01**): a fourth `tipoGeracao`, anchored to a named weekday
(`diaSemana`) instead of a monthly offset — covers the real "Atualiz Calc RF"
case (toda sexta-feira), which no month-anchored type can represent without
an artificial approximation. ...
`offsetDias` is never read for `semanal` templates (document-only,
mirrors `encadeado` never consulting its own unused `regraCompetencia`).
```

`propagarAtrasoSoft`'s no-op status — BOTH runtimes, verbatim, exact line citations matching CONTEXT.md's own claim:

```python
# Source: cli/apollo_cli/routine_job.py:73-74 (verbatim)
`propagarAtrasoSoft` is stored on the template but never read anywhere in
this module (C-09) — delay propagation is explicitly out of scope.
```

```typescript
// Source: web/src/lib/routineJob.ts:81-82 (verbatim)
 * `propagarAtrasoSoft` is stored on the template but never read anywhere in
 * this module (C-09) — delay propagation is explicitly out of scope.
```

```typescript
// Source: web/src/lib/routineJob.ts:146 (verbatim)
export const TIPO_PRAZO_GERADO = "soft"; // D-05-C
```

`[VERIFIED: cli/apollo_cli/routine_job.py — full file read this session (999 lines); web/src/lib/routineJob.ts — lines 1-170 read this session]` — CONTEXT.md's own citations (`routineJob.ts:146`, `routine_job.py:73`) independently reconfirmed at those exact line numbers this session.

`ativo`'s effect — Python orchestration code, verbatim:

```python
# Source: cli/apollo_cli/routine_job.py:543-544 (verbatim)
    for template in templates:
        if template.get("ativo") is False:
            continue
```

Also confirmed at the query level: `_query_active_templates` filters
`{"ativo": True, "donoId": dono_id}` server-side (line 803) — inactive
templates are excluded from generation twice over (query filter + defensive
loop check).

### Schema confirmation: `diaSemana` is genuinely optional at the DB level

```typescript
// Source: shared/instant.schema.ts:78-87 (verbatim)
    templatesRotina: i.entity({
      nome: i.string(),
      tipoGeracao: i.string(),
      regraCompetencia: i.string(),
      propagarAtrasoSoft: i.boolean(),
      ativo: i.boolean(),
      offsetDias: i.number().optional(),
      diaSemana: i.string().optional(),
      donoId: i.string().indexed(),
    }),
```

`[VERIFIED: shared/instant.schema.ts:78-87]`

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test`), `authed` project (persisted `storageState` from `auth.setup.ts` — no magic-code round trip needed per-test) |
| Config file | `web/playwright.config.ts` (pre-existing, not touched by this task) |
| Quick run command | `bunx playwright test web/e2e/<new-or-existing-spec>.spec.ts --project=authed` |
| Full suite command | `bunx playwright test` (per this project's established convention) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|--------------------|--------------|
| D4-a | Tooltip text appears on hover/focus for `propagarAtrasoSoft` | e2e | `page.getByTestId("field-propagarAtrasoSoft-help").hover()` (testid pattern TBD by executor) then assert tooltip content text | ❌ new test needed |
| D4-b | Tooltip text appears on hover/focus for ≥1 other field | e2e | same pattern, different field | ❌ new test needed |
| D4-c | `diaSemana` can be cleared via UI and persists as absent/null | e2e | create template with `tipoGeracao=semanal`+`diaSemana` set, edit, clear to blank, save, then re-fetch the row (via `apollo rotina template listar --id <id>` CLI or `db.queryOnce`) and assert `diaSemana` absent | ❌ new test needed |

### Existing pattern to extend (not a gap — reuse directly)

`web/e2e/entities-rotina-log.spec.ts`'s `WEB-06` test already drives
`templatesRotina`'s create/edit/delete form live, using exactly the helpers
a new test should reuse:

```typescript
// Source: web/e2e/entities-rotina-log.spec.ts:113-190 (excerpted, verbatim structure)
test("WEB-06: templatesRotina full CRUD, including the self-referential antecessor link", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await gotoNested(page, "templatesRotina");
  await page.getByTestId("entity-create-start").click();
  const optionValues = await openAndReadSelectOptions(page, "field-tipoGeracao");
  // ...
  await selectByText(page, "field-tipoGeracao", "du_fixo");
  await page.getByTestId("field-regraCompetencia").fill("mes-corrente");
  await submitForm(page);
  // ... row assertions, edit, delete via confirmRowDelete
```

Reusable helpers, all read in full this session:
- `web/e2e/helpers/form-controls.ts`: `selectByText(page, testid, optionText)`, `openAndReadSelectOptions(page, testid)` — both work identically for `kind: "select"` fields and link-selects (bits-ui renders `role="option"` items either way) `[VERIFIED: web/e2e/helpers/form-controls.ts — full file read this session]`.
- `web/e2e/helpers/gotoNested.ts`: `gotoNested(page, "templatesRotina")` navigates to the real nested screen (`nav-instanciasRotina` → `rotinas-tab-templates`) `[VERIFIED: full file read this session]`.
- `entities-rotina-log.spec.ts`'s own local helpers: `apolloCli(args)` (shells to `uv run --project cli apollo ...` for setup/teardown), `uniqueName(prefix)` (returns `phase04-e2e-<prefix>-<timestamp>-<rand>`), `sweepLeftovers()` (deletes every `templatesRotina` whose `nome` starts with the test's prefix via `apollo rotina template deletar --force`), `submitForm(page)` (tolerates a known DOM-actionability race after "salvar").

**No existing hover/tooltip test pattern exists anywhere in `web/e2e/`** —
searched (`grep -rln "hover(\|tooltip"`), zero matches. This will be a new
pattern the executor introduces; there is no precedent risk to reconcile,
but also no shortcut to reuse beyond the generic `page.hover()`/
`page.getByRole("tooltip")` Playwright APIs.

### Wave 0 Gaps
- [ ] A new e2e spec file (or an addition to `entities-rotina-log.spec.ts`) covering D4-a/b/c — none of the 3 assertions exist today.
- [ ] A `data-testid` convention for the tooltip trigger icon (e.g. `` `field-help-${f.name}` ``) — none exists yet, needed for `page.getByTestId(...).hover()`/`.focus()` in the new test.

## Security Domain

Not applicable in any meaningful sense — this task adds a static-text UI
affordance (a tooltip) and fixes a form-clearing bug on an already-authenticated,
already-permission-scoped entity screen (`instant.perms.ts`'s existing
`auth.id == data.donoId` rule, unchanged by this task). No new input surface,
no new auth path, no new externally-reachable endpoint. The one item worth
flagging: the `diaSemana` clear-fix must not accidentally allow a payload
key that bypasses the existing `donoId`-immutability invariant
(`update_entity`'s `"donoId" in fields` guard on the CLI side has no direct
web equivalent to check here, but `handleSubmit`'s payload construction
never includes `donoId` from `formValues` today — confirmed by reading the
whole submit function, `donoId` is injected separately at line 372's
`auth.user?.id` read, never sourced from `payload`). The fix should not
change that.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `payload[f.name] = null` will clear a top-level scalar `.optional()` attribute via `tx[etype][id].update(payload)`, the same way InstantDB's docs describe for `merge()` on nested objects | Common Pitfalls #2, Pattern 3 | If wrong, the D3/D4 fix needs a different mechanism (possibly undocumented) — must be falsified live by D4's own test before considering the fix complete; do not ship the `null`-based fix without that live proof passing |
| A2 | A new `help?: string` property added to every `FieldDef` variant in `types.ts`, rendered via the new `Tooltip` next to each field's `<Label>`, is the right shape for attaching D2's copy | Architecture Patterns, Pattern 1 | Low risk — this is an additive, backward-compatible type change (every other entity's field defs simply omit `help` and render no tooltip); no existing behavior changes for other entities |

## Open Questions

1. **Does InstantDB's `update()` (not `merge()`) actually clear a top-level scalar attribute when passed `null`?**
   - What we know: the official docs (`instantdb.com/docs/instaml`, fetched and searched this session) document `null`-based removal only in the context of `merge()` on a nested JSON object; no `update()`+scalar+`null` example exists on that page, and no existing call site in this codebase (`web/` or `cli/`) currently passes `null` to clear a scalar field — both runtimes' generic update helpers (`EntityScreen.svelte`'s payload loop; `crud_helpers.py`'s `drop_none(fields)`) currently *omit* optional-but-empty fields rather than explicitly nulling them.
   - What's unclear: whether `update({ diaSemana: null })` behaves as "remove the attribute value" (matching the `merge()` doc language) or is silently a no-op / rejected / coerced to something else for a scalar (non-nested) field.
   - Recommendation: make this the very first thing the executor's D4 Playwright test proves — write the live assertion (set → clear → save → re-fetch → assert absent) before treating the D3 fix as done. If it fails, the fallback path (undocumented InstantDB behavior) may need a source-code check of `@instantdb/core`'s transaction builder, or a question to InstantDB's own support channel — out of scope for this research session to chase further without a live falsification attempt.

## Sources

### Primary (HIGH confidence)
- `web/src/lib/components/ui/popover/*.svelte` — full files read this session (existing wrapper pattern to mirror).
- `node_modules/bits-ui/dist/bits/tooltip/**` — `.d.ts` and `.svelte` sources read this session (confirms native Tooltip primitive, its exact prop surface, and its native hover/focus/escape handling).
- `web/src/lib/entities/EntityScreen.svelte` — lines 1-60, 180-320, 590-820 read this session (Label rendering, `kind: "select"` renderer, link-select renderer, submit-payload loop).
- `web/src/lib/entities/types.ts` — full file read this session (`FieldDef`/`EntityConfig` contract).
- `web/src/lib/entities/defs/templatesRotina.ts` — full file read this session (exact current field list).
- `cli/apollo_cli/routine_job.py` — full file (999 lines) read this session.
- `web/src/lib/routineJob.ts` — lines 1-170 read this session (module docstring + constants + type defs).
- `shared/instant.schema.ts` — full file read this session (`diaSemana`'s `.optional()` confirmation).
- `web/e2e/entities-rotina-log.spec.ts`, `web/e2e/helpers/form-controls.ts`, `web/e2e/helpers/gotoNested.ts` — full files read this session (reusable e2e patterns).
- `web/package.json` — `bits-ui: "^2.16.3"`, `@lucide/svelte: "^1.31.0"` versions confirmed via grep this session.

### Secondary (MEDIUM confidence)
- `https://www.instantdb.com/docs/instaml` — fetched and searched this session for every "null" mention; confirms `merge()`'s documented null-removal semantics, explicitly does NOT confirm the same for `update()` on a scalar attribute (see Open Question 1).

### Tertiary (LOW confidence)
None — every claim in this research is either verified against a file read this session or explicitly flagged as an open question/assumption above.

## Metadata

**Confidence breakdown:**
- Standard stack (bits-ui Tooltip availability): HIGH — confirmed by reading the actual installed package's type declarations and root export list, not by name-matching against `Popover`.
- Architecture (Select blank-option fix, wrapper pattern): HIGH — both the bug and its in-file precedent fix were read verbatim at exact line numbers.
- The submit-payload gap (Pitfall 1/Pattern 3): HIGH that the gap exists (payload loop read verbatim); MEDIUM-LOW on the exact fix mechanism working as expected — genuinely unresolved by documentation, flagged as Open Question 1 for live falsification.
- Help-copy factual content (D2): HIGH — every claim sourced from the actual engine module docstrings/code, both runtimes cross-checked.

**Research date:** 2026-09-23
**Valid until:** No expiry concern — this is a point-in-time snapshot of this repo's own code, not a fast-moving external dependency; re-read the same files if this quick task is revisited after further code changes to `EntityScreen.svelte`, `routine_job.py`, or `routineJob.ts`.
