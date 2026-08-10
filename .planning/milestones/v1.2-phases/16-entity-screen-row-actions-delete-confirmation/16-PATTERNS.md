# Phase 16: Entity Screen — Row Actions & Delete Confirmation - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 1 source file (multi-region edit) + 6 e2e spec files
**Analogs found:** 2 / 2 pattern categories (row-action markup, AlertDialog composition)

## Confirmed Codebase Facts (verified by direct read, not inferred)

- `bunx shadcn-svelte add alert-dialog` has **not** been run yet: `web/src/lib/components/ui/` contains `alert` (the static `Alert`/`AlertDescription` banner component, unrelated) but **no** `alert-dialog` directory. It must be installed as part of this phase's implementation (not a planning assumption — grep-verified: `ls web/src/lib/components/ui/` shows `alert, badge, button, calendar, card, checkbox, dialog, empty, input, label, popover, select, separator, skeleton, sonner, table, textarea` — no `alert-dialog`).
- `handleDelete` currently: `web/src/lib/entities/EntityScreen.svelte:409-421`.
- Row-action buttons currently: `web/src/lib/entities/EntityScreen.svelte:507-528` (inside `<TableCell>` inside `<TableRow data-testid="row">`).
- `Dialog.Root`/`Dialog.Content` composition (Phase 15's work, closest structural analog for a bits-ui overlay in this codebase): `web/src/lib/entities/EntityScreen.svelte:538-553` and `:769-783` (`Dialog.Footer`).
- 6 e2e spec files interact with `window.confirm` / `page.on("dialog", ...)` for delete flows and must be updated.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `web/src/lib/entities/EntityScreen.svelte` (row-action markup, lines ~507-528) | component (table row fragment) | request-response (sync UI, no data flow change) | same file, `Dialog.Root`/`Dialog.Content` block (lines 538-553, 769-783) | exact (same file, same component, established Phase-15 overlay pattern) |
| `web/src/lib/entities/EntityScreen.svelte` (`handleDelete`, lines 409-421) | event handler / service call | CRUD (delete) | same file's `handleSubmit`'s try/catch/finally + `busy` pattern (lines ~370-407) and the `Dialog.Root` `onOpenChange`/`busy`-gated close pattern (lines 538-547) | exact (only existing modal-gated async-action pattern in the file) |
| `web/src/lib/components/ui/alert-dialog/*` (new, via CLI) | UI primitive (generated) | n/a | `web/src/lib/components/ui/dialog/*` (structurally identical bits-ui wrapper family: Root/Trigger/Portal/Overlay/Content/Header/Footer/Title/Description) | exact (AlertDialog is bits-ui's dialog variant with `Action`/`Cancel` instead of a close button; same file-per-part generation shape) |
| `web/e2e/entities-fundos.spec.ts` | test (e2e) | event-driven (Playwright dialog events → UI events) | itself (pre-change baseline) | exact — must be updated |
| `web/e2e/entities-form-restyle.spec.ts` | test (e2e) | event-driven | itself | exact — must be updated (2 delete sites + ENTFRM-04 "zero native dialogs" assertion, which now needs re-validating against AlertDialog instead) |
| `web/e2e/entities-projeto-etapa-tarefa.spec.ts` | test (e2e) | event-driven | itself | exact — must be updated (4 delete sites) |
| `web/e2e/entities-ticket-subtarefa.spec.ts` | test (e2e) | event-driven | itself | exact — must be updated (6 delete sites) |
| `web/e2e/entities-rotina-log.spec.ts` | test (e2e) | event-driven | itself | exact — must be updated (2 delete sites; also has 3 `row-delete` toHaveCount(0) capability-gating assertions that are unaffected) |
| `web/e2e/entities-table-restyle.spec.ts` | test (e2e) | event-driven | itself | not affected for delete-confirm (only asserts `row-delete` absence for restricted entities — no `window.confirm`/`page.on("dialog")` usage found); listed for completeness, no change needed |

## Pattern Assignments

### `web/src/lib/entities/EntityScreen.svelte` — row-action button markup (role: component fragment, data flow: request-response)

**Current code** (lines 507-528):
```svelte
                  <TableCell>
                    {#if config.capabilities.update}
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="row-edit"
                        onclick={() => startEdit(row)}
                      >
                        editar
                      </Button>
                    {/if}
                    {#if config.capabilities.delete}
                      <Button
                        variant="destructive"
                        size="sm"
                        data-testid="row-delete"
                        onclick={() => handleDelete(row)}
                      >
                        excluir
                      </Button>
                    {/if}
                  </TableCell>
```

**Decision context (from CONTEXT.md, do not re-litigate):** keep both `Button`s inline, non-portaled, inside this exact `<TableCell>` — no `DropdownMenu`/kebab. Only fix alignment/spacing/gap (e.g. wrap in a `<div class="flex justify-end gap-2">` or add `gap-2` directly) — do NOT change `data-testid` values or move them off these `Button` elements (Pitfall 2: duplicate-testid risk if a new wrapper `<div>` is introduced — the testid must stay on the `Button`, not copied onto a new wrapper).

**`handleDelete` — current implementation** (lines 409-421):
```typescript
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

This must become two pieces: (1) a click handler on `row-delete` that opens an `AlertDialog` (tracking which row is pending delete in local state, e.g. `let pendingDelete = $state<Row | null>(null)`), and (2) an `AlertDialog.Action` handler that runs the existing `db.transact`/`toast`/`catch` body verbatim — this is the "CRUD" core to preserve unchanged (Pitfall 8: do not change delete's error-handling/toast behavior, only the confirmation mechanism).

---

### `web/src/lib/entities/EntityScreen.svelte` — AlertDialog composition (role: component, overlay)

**Closest analog in this codebase: the existing `Dialog.Root` block, same file** (imports line 15, usage lines 538-553 and 769-783):

**Imports pattern** (line 15, extend similarly for AlertDialog):
```typescript
  import * as Dialog from "$lib/components/ui/dialog";
```
→ add: `import * as AlertDialog from "$lib/components/ui/alert-dialog";`

**Core overlay pattern to mirror** (lines 538-553):
```svelte
  <Dialog.Root
    open={mode !== null}
    onOpenChange={(open) => {
      if (!open && !busy) cancelForm();
    }}
  >
    <Dialog.Content
      showCloseButton={!busy}
      escapeKeydownBehavior={busy ? "ignore" : "close"}
      interactOutsideBehavior={busy ? "ignore" : "close"}
      class="sm:max-w-lg max-h-[85vh] overflow-y-auto"
    >
      <Dialog.Header>
        <Dialog.Title>{mode === "create" ? "Novo" : "Editar"} — {config.titulo}</Dialog.Title>
        <Dialog.Description>{config.descricao}</Dialog.Description>
      </Dialog.Header>
      ...
```

**Footer/action-pair pattern to mirror** (lines 769-783):
```svelte
        <Dialog.Footer>
          <Button type="submit" data-testid="entity-submit" disabled={busy}>
            {#if busy}<LoaderCircle class="size-4 animate-spin" />{/if}
            salvar
          </Button>
          <Button
            type="button"
            variant="ghost"
            data-testid="entity-cancel"
            disabled={busy}
            onclick={cancelForm}
          >
            cancelar
          </Button>
        </Dialog.Footer>
```

**Recommended AlertDialog shape (standard bits-ui/shadcn-svelte API, mirroring the above conventions exactly)** — for the planner/implementer to compose, not yet in the codebase:
```svelte
<AlertDialog.Root open={pendingDelete !== null} onOpenChange={(open) => { if (!open) pendingDelete = null; }}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Excluir registro?</AlertDialog.Title>
      <AlertDialog.Description>
        Excluir este registro de {config.titulo}? Esta ação não pode ser desfeita.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel data-testid="delete-cancel">cancelar</AlertDialog.Cancel>
      <AlertDialog.Action data-testid="delete-confirm" onclick={confirmDelete}>
        excluir
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
```
Naming (`delete-cancel`/`delete-confirm`) is a suggestion, not a locked requirement — CONTEXT.md only locks `row`, `row-edit`, `row-delete` verbatim; any new testids introduced for the AlertDialog's own trigger/cancel/confirm elements are the planner's/implementer's choice, but must be picked once and used consistently across all 6 e2e spec updates below.

**Focus-management note (CONTEXT.md explicit risk flag):** shadcn-svelte's own `alert-dialog` default focuses `AlertDialog.Cancel` on open (matches the destructive-action-safety convention already cited in CONTEXT.md) — do not override this default without a reason. On close, bits-ui returns focus to the trigger element by default; since the trigger (`row-delete` Button) may no longer exist after a successful delete (the row is gone), an explicit `onOpenChange`/`focus()` fallback (e.g. to `entity-create-start`, per CONTEXT.md's own suggestion) needs to be verified with a real Playwright `document.activeElement` assertion, not assumed from bits-ui's default behavior.

---

## Shared Patterns

### Async transact + toast + error pattern (apply to the new confirm handler)
**Source:** `web/src/lib/entities/EntityScreen.svelte:409-420` (current `handleDelete` body) and `:370-407` (`handleSubmit`'s try/catch/finally with `busy`)
```typescript
    try {
      const tx = db.tx as unknown as Record<string, Record<string, { delete: () => unknown }>>;
      await db.transact(tx[config.etype][row.id].delete() as never);
      toast.success("Registro excluído.");
    } catch (err) {
      formError = extractErrorMessage(err);
      toast.error(formError);
    }
```
**Apply to:** the new AlertDialog `Action` onclick handler — copy this body verbatim, do not alter error/toast semantics (Pitfall 8).

### Busy-gated overlay dismissal pattern
**Source:** `web/src/lib/entities/EntityScreen.svelte:538-547`
```svelte
  <Dialog.Root
    open={mode !== null}
    onOpenChange={(open) => {
      if (!open && !busy) cancelForm();
    }}
  >
    <Dialog.Content
      showCloseButton={!busy}
      escapeKeydownBehavior={busy ? "ignore" : "close"}
      interactOutsideBehavior={busy ? "ignore" : "close"}
```
**Apply to:** the AlertDialog if the delete transact is treated as async/awaitable while the dialog is still open (recommended: disable `AlertDialog.Action`/`Cancel` while a delete is in flight, mirroring `disabled={busy}` on `entity-submit`/`entity-cancel`, lines 770-782).

## E2E Specs Requiring Delete-Confirmation Update

All 6 files below currently use `window.confirm`-era Playwright APIs (`page.on("dialog", ...)` / `page.once("dialog", ...)` with `dialog.accept()`) and must be changed to interact with the new `AlertDialog` (click `row-delete` → assert dialog visible → click the confirm/cancel testid instead of firing a native `dialog` event):

| File | Delete-confirm interaction sites (line numbers) |
|---|---|
| `web/e2e/entities-fundos.spec.ts` | 109-110 (`page.on("dialog", ...)`), 165-167 (click `row-delete`) |
| `web/e2e/entities-form-restyle.spec.ts` | 104-107 (delete via `page.on("dialog")`), 305-306, 460-461 (`page.once("dialog", ...)` + `row-delete` click); **also** 120-139 `ENTFRM-04` test whose entire premise ("fires zero native dialogs") needs re-validation — an `AlertDialog` fires zero native `dialog` events by construction, so this specific assertion becomes trivially true, but the test's intent (no native `window.confirm`/`alert`/`prompt` anywhere) should be preserved/re-asserted against the new component |
| `web/e2e/entities-projeto-etapa-tarefa.spec.ts` | 209-210, 215-216, 270-271, 329-330 (all `page.once("dialog", ...)` + `row-delete` click) |
| `web/e2e/entities-ticket-subtarefa.spec.ts` | 211-212, 249-250, 285-286, 349-350, 404-405, 458-459 (all `page.once("dialog", ...)` + `row-delete` click) |
| `web/e2e/entities-rotina-log.spec.ts` | 178-179, 185-186 (`page.once("dialog", ...)` + `row-delete` click); lines 205, 244, 304 assert `row-delete` has count 0 for restricted capability entities — unaffected, keep as-is |

**Not affected (verified, no `window.confirm`/`page.on("dialog")` usage found):** `web/e2e/entities-table-restyle.spec.ts`, `web/e2e/entities-header-states.spec.ts` — grep-confirmed zero matches for `confirm\|dialog` beyond unrelated comment text/`role="dialog"` visibility checks already tied to the create/edit `Dialog`, not delete.

**Recommended replacement pattern for each site** (concrete, based on this codebase's existing `page.getByRole("dialog")` conventions used for the create/edit Dialog throughout `entities-form-restyle.spec.ts`/`entities-form-dialog-composition.spec.ts`):
```typescript
// old:
page.once("dialog", (dialog) => void dialog.accept());
await row.getByTestId("row-delete").click();

// new (shape, exact testids TBD by implementer per the AlertDialog composition above):
await row.getByTestId("row-delete").click();
await expect(page.getByRole("alertdialog")).toBeVisible();
await page.getByTestId("delete-confirm").click(); // or getByRole("button", { name: "excluir" }) inside the alertdialog
await expect(page.getByRole("alertdialog")).toHaveCount(0);
```
Note: bits-ui's `AlertDialog.Content` renders with `role="alertdialog"` (not `role="dialog"`), per standard ARIA alertdialog semantics — this is the correct Playwright role selector to use, distinct from the existing `page.getByRole("dialog")` used for the create/edit form.

## No Analog Found

None — both the row-action markup and the overlay-composition pattern have exact same-file analogs (Phase 15's `Dialog.Root` work), and the `alert-dialog` primitive itself has an exact structural analog in the already-generated `dialog/*` primitive family (same bits-ui wrapper-per-part shape).

## Metadata

**Analog search scope:** `web/src/lib/entities/EntityScreen.svelte` (full read, targeted sections), `web/src/lib/components/ui/` (directory listing), `web/e2e/*.spec.ts` (grep across all files, targeted reads of `entities-form-restyle.spec.ts`)
**Files scanned:** 1 source file (multi-region), 1 ui directory listing, 8 e2e spec files (grep), 1 e2e spec file (targeted read)
**Pattern extraction date:** 2026-08-10
