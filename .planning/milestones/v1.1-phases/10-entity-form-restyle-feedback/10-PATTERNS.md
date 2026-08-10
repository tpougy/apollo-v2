# Phase 10: Entity Form Restyle & Feedback - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 1 primary target (`EntityScreen.svelte`, shared across all 9 entities) + `LoginScreen.svelte` (toast addition) + 9 entity def files (read-only reference, no changes expected)
**Analogs found:** 2 strong in-repo analogs (LoginScreen.svelte for Alert/shadcn-form idiom; EntityScreen.svelte's own table section from Phase 9 for Dialog-wrapping precedent) — no Dialog/Select/Checkbox/Calendar/Sonner components exist in the repo yet, so those specific primitives have **no in-repo analog** and must follow shadcn-svelte's own registry conventions (installed via `bunx shadcn-svelte@latest add <name>`).

## Installed shadcn components (as of Phase 9)

`web/src/lib/components/ui/`: `alert`, `badge`, `button`, `card`, `input`, `label`, `table`.

**Not yet installed — must be added in this phase:** `dialog` (or `sheet`), `select`, `checkbox`, `textarea`, `calendar` + `popover` (date-picker pattern), `sonner`.

```bash
bunx shadcn-svelte@latest add dialog select checkbox textarea calendar popover sonner
```

`components.json`: style `nova`, baseColor `neutral`, iconLibrary `lucide`, aliases use `$lib/components/ui`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `web/src/lib/entities/EntityScreen.svelte` (form section only, lines ~427-565; logic lines 141-350 stays functionally identical) | component (form/dialog) | CRUD (request-response via InstantDB transact) | `web/src/lib/auth/LoginScreen.svelte` (Alert + shadcn Input/Label/Button idiom) | role-match (form idiom), no Dialog precedent in-repo |
| `web/src/lib/auth/LoginScreen.svelte` (add toast calls only — FDBK-01) | component | request-response | itself (existing `erro` state + Alert pattern) | exact — additive change only |
| New: toast/Sonner wiring (likely a `<Toaster />` mount in root layout/App shell + `toast.success`/`toast.error` calls in EntityScreen + LoginScreen) | provider/utility | event-driven (fire-and-forget UI feedback) | none in-repo | no analog — follow shadcn-svelte Sonner registry docs |

**Entity def files (`web/src/lib/entities/defs/*.ts`) are NOT expected to change** — they are pure config consumed by `EntityScreen.svelte`. Do not touch unless a field-kind rendering gap is found (none identified).

## Pattern Assignments

### `web/src/lib/entities/EntityScreen.svelte` — form section

**This is a single shared component used by all 9 entity screens** (via `config` prop). All markup/logic changes here apply uniformly; there is no per-entity file to edit.

#### Current imports (lines 1-6)
```svelte
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
import { db, id } from "../db";
import type { EntityConfig, LinkDef } from "./types";
```
New imports needed (add, do not remove existing): `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` (or `Sheet` equivalents) from `$lib/components/ui/dialog`, `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` from `$lib/components/ui/select`, `Checkbox` from `$lib/components/ui/checkbox`, `Textarea` from `$lib/components/ui/textarea`, `Calendar`+`Popover` for date, `Label`/`Input` from existing `ui/label`+`ui/input`, `Alert`/`AlertDescription` from existing `ui/alert`, `toast` from `svelte-sonner` (or wherever the Sonner registry places it — check post-install).

#### `mode` state controls visibility — reuse as Dialog `open` binding (lines 141, 421-427, 565)
```svelte
let mode = $state<"create" | "edit" | null>(null);
...
{#if mode === null && config.capabilities.create}
  <Button type="button" data-testid="entity-create-start" onclick={startCreate}>novo</Button>
{/if}
{#if mode !== null}
  <form onsubmit={handleSubmit}> ... </form>
{/if}
```
Planner's Dialog wrapping should bind `open={mode !== null}` and call `cancelForm()` on `onOpenChange(false)` (so Escape/overlay-click behaves like the existing Cancel button) — but `cancelForm`'s body (line 217-221) must stay byte-identical in behavior.

#### Error display — becomes Alert, testid unchanged (lines 356-358)
```svelte
{#if formError}
  <p data-testid="entity-error">{formError}</p>
{/if}
```
Direct analog for the Alert conversion — `LoginScreen.svelte` lines 112-117:
```svelte
{#if erro}
  <Alert variant="destructive">
    <CircleAlert class="size-4" />
    <AlertDescription data-testid="login-error">{erro}</AlertDescription>
  </Alert>
{/if}
```
Apply the same `Alert variant="destructive"` + `CircleAlert` icon + `AlertDescription` wrapper to `formError`, **keeping `data-testid="entity-error"` on the `AlertDescription`** (not a new testid — the e2e suite and Phase 9 list-load error path both key off `entity-error`; the list-load error render at line 362-363 `{:else if query.error}<p data-testid="entity-error">{query.error.message}</p>{/if}` is a SEPARATE branch outside the form and should get the identical Alert treatment for visual consistency, but is out of this phase's required scope per CONTEXT.md — safe to leave as `<p>` if time-constrained, but recommended to convert too since it shares the testid convention).

#### Field rendering — per-kind branches, testid pattern to preserve exactly (lines 429-501)

All branches share this shape: `id={`field-${f.name}`}`, `data-testid={`field-${f.name}`}`, controlled value bound to `formValues[f.name]`, `required={f.required}` where applicable.

| Kind | Current element (lines) | Target shadcn primitive | Value binding pattern to preserve |
|---|---|---|---|
| `text` | `<input type="text">` (433-442) | `Input` (`ui/input`) | `value={formValues[f.name] as string}` / `oninput={(e) => formValues[f.name] = e.currentTarget.value}` |
| `textarea` | `<textarea>` (444-452) | `Textarea` (`ui/textarea`, new install) | same string oninput pattern |
| `number` | `<input type="number">` (454-464) | `Input type="number"` | `formValues[f.name] = v === "" ? "" : e.currentTarget.valueAsNumber` — preserve empty-string sentinel for optional fields |
| `boolean` | `<input type="checkbox">` (466-474) | `Checkbox` (`ui/checkbox`, new install) | Checkbox uses `checked`/`onCheckedChange` not `checked`/`onchange` — adapt: `checked={Boolean(formValues[f.name])}` `onCheckedChange={(v) => formValues[f.name] = v}` |
| `date` | `<input type="date">` (476-485) | Calendar+Popover date-picker (new install) | Internal value stays the `yyyy-mm-dd` string produced by `isoToDateInputValue`/consumed by `dateInputValueToIso` (lines 21-27) — the picker just needs to read/write that same string format into `formValues[f.name]`, do not change the ISO conversion helpers |
| `select` (enum, e.g. `tipoPrazo`, `tipoGeracao`) | `<select>` + `<option>` per `f.options` (486-500) | `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` (`ui/select`, new install) | `value={formValues[f.name] as string}` / on change set `formValues[f.name] = value`; iterate `f.options` for `SelectItem`s, keep the `disabled` placeholder ("selecione...") behavior via Select's placeholder prop |

**Label pattern** (line 431, applies to all kinds): `<label for={`field-${f.name}`}>{f.label}</label>` → swap for `<Label for={`field-${f.name}`}>{f.label}</Label>` (component already installed, used identically in `LoginScreen.svelte` line 65: `<Label for="login-email">E-mail</Label>`).

#### Links rendering — plain relationship select (lines 505-525)
```svelte
{#each config.links ?? [] as link (link.label)}
  <div>
    <label for={`link-${link.label}`}>{link.label}</label>
    <select
      id={`link-${link.label}`}
      data-testid={`link-${link.label}`}
      required={link.required}
      value={selectedLinks[link.label] ?? ""}
      onchange={(e) => { selectedLinks[link.label] = e.currentTarget.value; }}
    >
      {#if !link.required}<option value="">—</option>{/if}
      {#each linkOptionsFor(link) as opt (opt.id)}
        <option value={opt.id}>{String(opt[link.targetLabelField] ?? "")}</option>
      {/each}
    </select>
  </div>
{/each}
```
Convert to shadcn `Select` keeping **`data-testid={`link-${link.label}`}` on the element Playwright actually queries** — verify whether the e2e suite selects the native-equivalent trigger or an inner input; since shadcn-svelte's `Select` is a Bits-UI wrapper (button trigger + portal content, not a real `<select>`), the testid must go on the `SelectTrigger` (the visible interactive element) and any option-selection interaction in Playwright will change from `.selectOption()` to `.click()` + `.getByRole('option', {name})` or similar — **flag this as a behavior change requiring e2e spec updates**, not just a markup swap (see e2e section below).

#### xorLink rendering — two-step select, dynamic testid (lines 527-560)
```svelte
{#if config.xorLink}
  <div>
    <label for="xor-parent-type">{config.xorLink.label}</label>
    <select id="xor-parent-type" data-testid="xor-parent-type" value={xorParentType ?? ""}
      onchange={(e) => { xorParentType = e.currentTarget.value; xorParentId = ""; }}>
      {#each config.xorLink.choices as choice (choice.label)}
        <option value={choice.label}>{choice.label}</option>
      {/each}
    </select>
    {#if xorParentType}
      <select data-testid={`link-${xorParentType}`} value={xorParentId}
        onchange={(e) => { xorParentId = e.currentTarget.value; }}>
        <option value="">—</option>
        {#each activeXorChoice() ? xorOptionsFor(activeXorChoice() as LinkDef) : [] as opt (opt.id)}
          <option value={opt.id}>{String(opt[(activeXorChoice() as LinkDef).targetLabelField] ?? "")}</option>
        {/each}
      </select>
    {/if}
  </div>
{/if}
```
Only entity using this: `subtarefas` (choices `tarefa`/`ticket`). Same two-step structure must be preserved 1:1 with shadcn `Select`s — `xor-parent-type` testid stays on the first `SelectTrigger`, `link-${xorParentType}` stays on the second (dynamic) `SelectTrigger`.

#### Submit/Cancel buttons (lines 562-563) — already using native `<button>`, convert to `Button` (already installed)
```svelte
<button type="submit" data-testid="entity-submit">salvar</button>
<button type="button" data-testid="entity-cancel" onclick={cancelForm}>cancelar</button>
```
Analog: `LoginScreen.svelte` lines 74-79 (`Button type="submit" data-testid="login-submit"`) and line 100-108 (`Button type="button" variant="ghost" data-testid="login-resend"`). Place inside `DialogFooter` if using Dialog wrapping.

### Business logic — MUST stay functionally identical (lines 141-350)

Do not rewrite; only wrap with toast calls per FDBK-01. Key functions and their exact current bodies (for planner reference, no line-level diff needed since these should not change):

- `startCreate()` (156-172) — resets `formError`, `mode="create"`, seeds `formValues` (`false`/`""` defaults), seeds `selectedLinks` to `""`, seeds `xorParentType` to first choice.
- `startEdit(row)` (174-215) — resets `formError`, `mode="edit"`, populates `formValues` from `editableFields()` with kind-specific coercion (date→`isoToDateInputValue`, boolean→`Boolean`, number→raw-or-`""`, else string), populates `selectedLinks` and xorLink snapshot (`originalXorParentType`/`originalXorParentId`).
- `cancelForm()` (217-221) — `mode=null`, `editingId=null`, `formError=null`. **Use this exact function as the Dialog's `onOpenChange(false)` handler.**
- `handleSubmit(event)` (223-338) — `event.preventDefault()`, xorLink required-check, links required-check, per-field required-check + type coercion (date→ISO, number→`Number()`), builds `linkPayload`/`unlinkPayload` (xor-switch-away detection), pre-transact `parent_not_found` existence check via `db.queryOnce`, then `db.tx[...].update(...).link(...)`/`.unlink(...)` + `db.transact(...)`, sets `mode=null; editingId=null` on success, catches into `formError = extractErrorMessage(err)` on failure. **Add `toast.success(...)` right after the success reset (line 333-334) and `toast.error(extractErrorMessage(err))` in the catch (line 335-337), alongside the existing `formError` assignment — do not remove `formError`, ENTFRM-04 requires the inline Alert too.**
- `handleDelete(row)` (340-350) — `window.confirm(...)` (leave as-is, deferred), `db.transact(tx[...].delete())`, catches into `formError`. **Add `toast.success(...)` after successful transact and `toast.error(...)` in catch**, same dual-surface approach as `handleSubmit`.
- `extractErrorMessage(err)` (29-36) — reused for both toast text and Alert text; no changes needed.

### `web/src/lib/auth/LoginScreen.svelte` — add toasts (FDBK-01)

Existing error surfacing (lines 24-28, 38-42) sets local `erro` state, rendered via Alert (112-117). Add `toast.success("Código enviado")` after `sendMagicCode` succeeds (after line 22) and/or `toast.success` after `signInWithMagicCode` succeeds (after line 36); add `toast.error(erro)` alongside each existing `erro = ...` assignment (lines 25, 39), mirroring the same dual-surface (toast + inline Alert) approach used in EntityScreen.

## Shared Patterns

### Toast (Sonner) — new, no existing analog
**Source:** none in-repo; install via `bunx shadcn-svelte@latest add sonner`, mount `<Toaster />` once in the app root (likely `web/src/App.svelte` or root layout — check where `LoginScreen`/`Shell` are composed), then `import { toast } from "svelte-sonner"` in any file calling `toast.success`/`toast.error`.
**Apply to:** `EntityScreen.svelte` (`handleSubmit`, `handleDelete`) and `LoginScreen.svelte` (`enviarCodigo`, `verificarCodigo`).

### Error Alert pattern
**Source:** `web/src/lib/auth/LoginScreen.svelte` lines 112-117
```svelte
{#if erro}
  <Alert variant="destructive">
    <CircleAlert class="size-4" />
    <AlertDescription data-testid="login-error">{erro}</AlertDescription>
  </Alert>
{/if}
```
**Apply to:** `EntityScreen.svelte`'s `formError` render (currently `<p data-testid="entity-error">`) — same structure, keep `entity-error` testid on the `AlertDescription`.

### Label pattern
**Source:** `LoginScreen.svelte` line 65: `<Label for="login-email">E-mail</Label>` (component: `$lib/components/ui/label`, already installed)
**Apply to:** every `<label for=...>` in `EntityScreen.svelte`'s form (field labels, link labels, xor label).

### Button pattern
**Source:** `LoginScreen.svelte` lines 74-79, 100-108 (variants: default submit, `ghost` secondary action; `disabled` + inline `LoaderCircle` spinner while busy)
**Apply to:** `entity-submit`/`entity-cancel` buttons; consider adding a busy/`disabled` state during `handleSubmit`'s in-flight transact for UX parity, though not explicitly required.

## Per-Entity Field/Link/Capability Table (all 9 — read once, do not re-open defs files)

| Entity (`etype`) | Field kinds present | `links` | `xorLink` | `updatableFields` | Capabilities | Form exists? |
|---|---|---|---|---|---|---|
| `fundos` | text(nome, codigo), boolean(ativo), date(createdAt) | — | — | — | create/update/delete: true | create+edit |
| `projetos` | text(nome, status), textarea(descricao, optional), date(dataInicioPrevista, dataFimPrevista, both optional) | `fundo`→fundos (optional) | — | — | true/true/true | create+edit |
| `etapas` | text(nome, status), number(ordem) | `projeto`→projetos (optional) | — | — | true/true/true | create+edit |
| `tarefas` | text(titulo, competencia optional, status), textarea(descricao optional), select(tipoPrazo: hard/soft), date(dataPrevista optional, dataPrevistaEstimada optional) | `etapa`→etapas (optional) | — | — | true/true/true | create+edit |
| `templatesRotina` | text(nome, regraCompetencia), select(tipoGeracao: du_fixo/corrido_fixo/encadeado), number(offsetDias, optional), boolean(propagarAtrasoSoft, ativo) | `fundo`→fundos (optional), `antecessor`→templatesRotina (optional, **excludeSelf: true**) | — | — | true/true/true | create+edit |
| `instanciasRotina` | text(dedupeKey, competencia, tipoPrazo, status), date(dataPrevista, dataPrevistaEstimada optional) | — (template link deliberately omitted, see def file comment) | — | `["status"]` | create:false, update:true, delete:false | **edit-only, single field (status)** |
| `tickets` | text(titulo, remetente, status), textarea(corpo), date(dataRecebimento, dataPrevista optional), select(tipoPrazo: hard/soft) | `fundo`→fundos (optional) | — | — | true/true/true | create+edit |
| `subtarefas` | text(titulo), boolean(concluida), number(ordem) | — | `Pai`: choices `tarefa`→tarefas / `ticket`→tickets (both required within the xor) | — | true/true/true | create+edit, **only xorLink entity** |
| `logInferenciaClaude` | text(campo, valorInferido, entidadeTipo, entidadeId), textarea(trechoMotivador, optional), date(createdAt) | — | — | — | create:false, update:false, delete:false | **no form ever renders** — pure read-only table |

Note: every `select`-kind field in the table above (`tipoPrazo`, `tipoGeracao`) uses a static `options: readonly string[]` array on the `FieldDef`, not a query — the shadcn `Select` conversion for these is simpler than for `links` (no async data, no `linkOptionsFor`/query dependency).

## No Analog Found

| File/Feature | Role | Data Flow | Reason |
|---|---|---|---|
| Dialog/Sheet wrapper for the form | component | request-response | No Dialog or Sheet component installed or used anywhere in the repo yet — this phase is the first consumer. Follow shadcn-svelte's own registry example (`Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter`), bind `open` to `mode !== null`. |
| Select (enum + relationship) | component | CRUD | No `Select` install yet. Bits-UI-based, trigger+portal pattern differs from native `<select>` — testid placement and e2e interaction patterns will change (see below). |
| Checkbox | component | CRUD | No `Checkbox` install yet — API is `checked`/`onCheckedChange`, not `checked`/`onchange`. |
| Calendar/Popover date-picker | component | CRUD | No date-picker precedent; current native `<input type="date">` is being replaced with a popover+calendar combo — this is the most structurally different conversion in the phase. Must preserve the `yyyy-mm-dd` string contract with `isoToDateInputValue`/`dateInputValueToIso`. |
| Sonner toast | provider | event-driven | Not installed; no `<Toaster/>` mount point exists yet. Needs a one-time app-root mount plus per-call-site imports. |

## E2E Impact Warning (for planner)

`web/e2e/entities-fundos.spec.ts` currently drives the fundos form using **native form APIs**: `.fill()` on `field-nome`/`field-codigo`/`field-createdAt` (text/date inputs), `.isChecked()`/`.check()`/`.uncheck()` on `field-ativo` (native checkbox). Once `date` becomes a Calendar/Popover and `boolean` becomes a shadcn `Checkbox`:
- `field-ativo`'s `.isChecked()`/`.check()`/`.uncheck()` Playwright calls only work if the shadcn `Checkbox`'s underlying DOM node is still a real `<input type="checkbox">` with the `data-testid` on it (Bits-UI Checkbox typically renders a `<button role="checkbox">`, not a native input) — **if it renders as a button, the spec's `.check()`/`.uncheck()`/`.isChecked()` calls will break** and must become `.click()` + `aria-checked` assertions. This spec is explicitly called out in the phase scope as "must keep passing" — the planner must either (a) confirm the installed Checkbox preserves `.isChecked()` compatibility, or (b) plan an update to this spec file's interaction calls (not a scope violation — REQUIREMENTS.md doesn't freeze the spec, only the *coverage*).
- `field-createdAt`'s `.fill("2026-01-15")` will not work against a Calendar/Popover trigger — planner must decide whether the date field keeps a text-input-with-picker hybrid (fillable) or a pure calendar-grid picker (requires `.click()` sequences on day cells), and update the spec accordingly.
- `link-*` selects: fundos has no `links`/`xorLink`, so this specific spec file is unaffected by the Select conversion, but other entities' (currently nonexistent) e2e specs would be. No action needed here beyond awareness.

## Metadata

**Analog search scope:** `web/src/lib/entities/`, `web/src/lib/auth/`, `web/src/lib/components/ui/`, `web/e2e/`
**Files scanned:** `EntityScreen.svelte`, `types.ts`, 9 `defs/*.ts` files, `LoginScreen.svelte`, `entities-fundos.spec.ts`, `components.json`, `ui/` directory listing
**Pattern extraction date:** 2026-08-09
