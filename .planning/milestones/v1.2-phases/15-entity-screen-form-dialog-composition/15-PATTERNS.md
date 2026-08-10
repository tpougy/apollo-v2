# Phase 15: Entity Screen — Form & Dialog Composition - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 1 (single shared component, form/dialog section only)
**Analogs found:** 1 exact in-file precedent (busy/spinner) / 0 external — this phase is a self-modification of `EntityScreen.svelte`'s own Dialog block, using `LoginScreen.svelte` as the cross-file analog for the one net-new behavior (busy state)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `web/src/lib/entities/EntityScreen.svelte` (Dialog/form section only, lines 516-729) | component (form composition inside a generic CRUD screen) | request-response (form submit → `db.transact`) | `web/src/lib/auth/LoginScreen.svelte` (busy/spinner + Card composition) | role-match (component+form), exact-match (busy/spinner sub-pattern) |
| `web/src/lib/components/ui/field/*` (new files, if `Field` adopted) | UI primitive (vendored shadcn-svelte component) | n/a | `web/src/lib/components/ui/dialog/*`, `web/src/lib/components/ui/card/*` (existing vendored primitives) | exact (same vendoring mechanism, not yet installed) |

**Scope boundary confirmed:** Only `EntityScreen.svelte` lines ~516-729 (the `Dialog.Root` block, i.e. everything from `<Dialog.Root ...>` through the closing `</Dialog.Root>`) are in scope. Lines 1-515 (script logic incl. `handleSubmit`/`handleDelete`, and the header/table/loading/empty-state JSX at lines 402-514) are explicitly out of scope — Phase 14 already touched the header/table/loading/empty section and this phase must not regress it. `handleSubmit`'s validation logic (lines 247-385) must not change except wrapping the `await db.transact(...)` calls (lines 353 and 360) in a new busy boolean.

## Current Structure Being Modified (exact line refs, current file state)

### Dialog wrapper (lines 516-525, 727-728)
```svelte
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
    <form onsubmit={handleSubmit} novalidate>
      ...
    </form>
  </Dialog.Content>
</Dialog.Root>
```
No `Dialog.Description` under `Dialog.Title` currently (component is vendored and unused here — see below). No `Dialog.Footer` wrapping the submit/cancel row — those two `Button`s (lines 722-725) are bare trailing children of `<form>`.

### Field render block — `{#each editableFields() as f (f.name)}` (lines 527-635)
Structure: each iteration wraps ONE bare `<div>` (line 528) containing a `<Label for={`field-${f.name}`}>` then an `{#if f.kind === ...}` chain with 6 branches, closing at line 634 (`{/if}`) / 635 (`</div>`). No spacing utility exists on the wrapper `<div>` and no gap between consecutive field `<div>`s (no `space-y-*`/`grid gap-*` anywhere in this block).

Kind branches, each keyed off `f.kind`, all sharing the `id={`field-${f.name}`}` / `data-testid={`field-${f.name}`}` pair (load-bearing, must be preserved verbatim on the actual input/control element — not on any new wrapper):

| Kind | Lines | Control | Notes |
|------|-------|---------|-------|
| `text` | 530-540 | `Input type="text"` | oninput sets `formValues[f.name]` |
| `textarea` | 541-550 | `Textarea` | same oninput pattern |
| `number` | 551-562 | `Input type="number"` | `valueAsNumber` parse |
| `boolean` | 563-571 | `Checkbox` | `onCheckedChange` |
| `date` | 572-615 | `Popover.Root` > `Popover.Trigger` (button, via `{#snippet child({ props })}`) > `Popover.Content` > `Calendar` | testid lives on the trigger `Button`, not on `Popover.Root` |
| `select` | 616-632 | `Select.Root` > `Select.Trigger` > `Select.Content` > `Select.Item` per `f.options` | testid on `Select.Trigger` |

No `required`-driven visual cue on `Label` anywhere in this block — `required={f.required}` is only passed to the native `Input`/`Textarea` HTML attribute (invisible until browser-native validation fires), never rendered as an asterisk/text hint on the `Label` itself. This is the gap Requirement ENTFRM-08 (required-field indicator) targets.

### Links render block (lines 637-666) and xorLink render block (lines 668-720)
Same bare `<div><Label>...<Select.Root>...</div>` shape, no spacing. `link-${link.label}` and `xor-parent-type` testids are load-bearing (per CONTEXT.md) and live on `Select.Trigger` elements — do not move them to a wrapper.

### Submit/cancel button row (lines 722-725)
```svelte
<Button type="submit" data-testid="entity-submit">salvar</Button>
<Button type="button" variant="ghost" data-testid="entity-cancel" onclick={cancelForm}>
  cancelar
</Button>
```
Bare trailing siblings inside `<form>`, no `Dialog.Footer`, no gap utility, no busy/disabled state, no spinner.

## Pattern Assignments

### Busy/spinner submit state — analog `web/src/lib/auth/LoginScreen.svelte`

**Source pattern** (lines 18-38, 100-127 of LoginScreen.svelte):

State declaration:
```svelte
let ocupado = $state(false);
```

Async handler wrapping (`enviarCodigo`, lines 24-38):
```svelte
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
```

Button wiring (lines 100-105):
```svelte
<Button type="submit" data-testid="login-submit" disabled={ocupado}>
  {#if ocupado}
    <LoaderCircle class="size-4 animate-spin" />
  {/if}
  Enviar código
</Button>
```
Also note the sibling `Input` disables during busy too (line 97: `disabled={ocupado}`).

**How to apply to `EntityScreen.svelte`:** add `let busy = $state(false);` near the other form-local `$state` declarations (around line 175, alongside `formError`). In `handleSubmit` (lines 247-385), guard at top with `if (busy) return; busy = true;` immediately after `event.preventDefault(); formError = null;`, wrap the two `await db.transact(...)` call sites (lines 353, 360) with a `try/finally { busy = false; }` — note `handleSubmit` already has its own `try { ... } catch (err) { ... }` (lines 327-384); the CONTEXT.md constraint ("only a busy boolean around the existing `await db.transact(...)` call") means `busy = true` should be set right before the `try` block and `busy = false` set in a `finally` around the *entire* existing try/catch, not scattered per-branch. On the `entity-submit` `Button` (line 722), add `disabled={busy}` and prepend the same `{#if busy}<LoaderCircle class="size-4 animate-spin" />{/if}` block — `@lucide/svelte/icons/loader-circle` is not currently imported in `EntityScreen.svelte` (its import block, lines 1-25, currently pulls `CalendarIcon`, `CircleAlert`, `Inbox` from `@lucide/svelte/icons/*`) and must be added: `import LoaderCircle from "@lucide/svelte/icons/loader-circle";`.

### Dialog.Description / Dialog.Footer wiring — self-file, currently unused

**Vendored, confirmed present, confirmed unused in `EntityScreen.svelte`:**
- `web/src/lib/components/ui/dialog/dialog-description.svelte` — thin wrapper over `DialogPrimitive.Description`, class `text-sm text-muted-foreground ...`. Exported from `dialog/index.ts` as `Dialog.Description`.
- `web/src/lib/components/ui/dialog/dialog-footer.svelte` — class `-mx-4 -mb-4 rounded-b-xl border-t bg-muted/50 p-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`. Exported as `Dialog.Footer`.

**Apply:** insert `<Dialog.Description>` immediately after `<Dialog.Title>` (line 524), one line, e.g. reusing `config.descricao` (already rendered elsewhere at line 406 as `entity-description`) — do not duplicate the `entity-description` testid, this is a plain second rendering with no testid needed inside the dialog. Wrap the two trailing `Button`s (lines 722-725) in `<Dialog.Footer>...</Dialog.Footer>` — this changes visual layout (buttons become `flex-col-reverse sm:flex-row sm:justify-end` inside a bordered/muted footer bar) but must NOT touch the `data-testid="entity-submit"`/`data-testid="entity-cancel"` attributes or the `type`/`onclick` behavior.

### Field/FieldGroup form composition — NOT YET INSTALLED

Confirmed via `ls web/src/lib/components/ui/`: directories present are `alert, badge, button, calendar, card, checkbox, dialog, empty, input, label, popover, select, separator, skeleton, sonner, table, textarea`. **No `field` directory exists.** Must run `bunx shadcn-svelte@latest add field` from `web/` before referencing `Field`/`FieldGroup`/`FieldLabel`/`FieldDescription` — this is a net-new vendored primitive, not yet available. If the swap is judged too invasive for the 6-branch generic render block (per CONTEXT.md's explicit fallback clause), the plain-utility fallback is: wrap each field's `<div>` (line 528) with `class="space-y-2"` and wrap the whole `{#each editableFields()}` list (and the links/xorLink blocks) in a parent `<div class="grid gap-4">` or `<div class="space-y-4">` — mirrors the exact utility values `LoginScreen.svelte` already uses (`space-y-4` on `CardContent`/`form`, `space-y-2` on each field's `<div data-testid="login-email-field">`, lines 86, 88, 89, 108, 109).

### Card composition (login) — reference only, not directly reusable here

`LoginScreen.svelte` lines 75-85 show the `CardHeader > CardTitle + CardDescription` shape already applied by Phase 12 — not directly transplantable to `EntityScreen.svelte`'s `Dialog` (dialogs use `Dialog.Header`/`Dialog.Title`/`Dialog.Description`, not `Card` sub-parts), but confirms the project convention: title + one-line description directly above the interactive content, using `text-sm text-muted-foreground` for the description tier (same class Dialog.Description already vendors).

## Shared Patterns

### Busy/spinner state
**Source:** `web/src/lib/auth/LoginScreen.svelte` lines 18-38 (state + handler), 100-105 (button wiring)
**Apply to:** `EntityScreen.svelte`'s `entity-submit` Button and `handleSubmit` function only (this phase's sole functional/logic touch, explicitly scoped by CONTEXT.md as "add a busy boolean around the existing `await db.transact(...)` call — no new validation")

### Error/toast pattern (already correct, do not change)
**Source:** `EntityScreen.svelte` lines 381-384 (`catch (err) { formError = extractErrorMessage(err); toast.error(formError); }`), mirrors `LoginScreen.svelte` lines 32-37/48-53. Both files already share `extractErrorMessage`-equivalent logic and `svelte-sonner`'s `toast.error`. No change needed — this phase must not touch `handleSubmit`'s error branches.

### Label/control spacing convention
**Source:** `LoginScreen.svelte` lines 89, 109 (`<div class="space-y-2" data-testid="...-field">`) and line 88/108 (`<form ... class="space-y-4">`)
**Apply to:** `EntityScreen.svelte`'s field-wrapper `<div>`s (line 528) and the `<form>` element (line 526) if the plain-utility fallback is chosen instead of `Field`/`FieldGroup`.

### Required-field indicator
**No existing analog in the codebase** — this is a net-new visual cue. Source of truth: `config.fields[].required` (already read at line 535, 545, 556 as the native `required` prop, and at line 270 in `handleSubmit`'s validation). Recommended approach: append `f.required ? " *" : ""` (or a `<span class="text-destructive">*</span>`) to the `<Label>` text at line 529, or — if `Field`/`FieldLabel` is adopted — use `FieldDescription`/a `required` prop if the installed version exposes one (verify against the actual vendored `field.svelte` API once installed, the shadcn-svelte docs referenced in STACK.md list `FieldLabel`/`FieldDescription`/`FieldError`/`FieldSet`/`FieldLegend`/`FieldSeparator` but no confirmed `required`-asterisk prop — treat as a manual addition either way).

## No Analog Found

| File/Pattern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Required-field visual indicator | cosmetic/utility | n/a | No existing required-field UI cue anywhere in the codebase (native `required` HTML attr only, invisible until browser validation) — must be authored net-new per CONTEXT.md's ENTFRM-08 guidance, driven by existing `config.fields[].required` data only |
| `Field`/`FieldGroup` component | UI primitive | n/a | Not yet vendored (`web/src/lib/components/ui/field` does not exist) — requires `bunx shadcn-svelte@latest add field` before use; fallback is plain `space-y-2`/`grid gap-4` utilities already proven in `LoginScreen.svelte` |

## Metadata

**Analog search scope:** `web/src/lib/entities/EntityScreen.svelte` (full file, 729 lines), `web/src/lib/auth/LoginScreen.svelte` (full file, 149 lines), `web/src/lib/components/ui/dialog/*`, `web/src/lib/components/ui/` directory listing
**Files scanned:** 2 full component reads + 2 targeted primitive reads (dialog-footer.svelte, dialog-description.svelte) + 1 directory listing
**Pattern extraction date:** 2026-08-10
