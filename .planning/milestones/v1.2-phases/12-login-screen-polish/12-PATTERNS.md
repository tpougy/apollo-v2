# Phase 12: Login Screen Polish - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 1 (primary) + 2 read-only reference checks
**Analogs found:** 1 / 1 (self-analog — same file's own sibling Dialog.Header pattern, plus installed Card sub-parts)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `web/src/lib/auth/LoginScreen.svelte` | component (auth form) | request-response | `web/src/lib/entities/EntityScreen.svelte` `Dialog.Header`/`Dialog.Title` usage (lines 469-471) + `web/src/lib/components/ui/card/*` sub-parts | exact (sub-parts already installed, unused in this file today) |
| `web/src/App.svelte` | component (root chrome) | n/a | — | **DO NOT MODIFY** — see below |
| `web/e2e/login-flow.spec.ts` | test | request-response | n/a | no change expected |
| `web/e2e/design-system.spec.ts` | test | n/a | n/a | no change expected |

## Critical Constraint: App.svelte / design-system.spec.ts

`web/e2e/design-system.spec.ts` (lines 12-24) asserts on `App.svelte`'s root `<h1>Apollo v2</h1>` (line 9 of `App.svelte`):
```typescript
const h1 = page.locator("h1", { hasText: "Apollo v2" });
const [h1Font, bodyFont] = await Promise.all([
  h1.evaluate((el) => getComputedStyle(el).fontSize),
  page.evaluate(() => getComputedStyle(document.body).fontSize),
]);
expect(h1Font).toBe(bodyFont);
const h1Weight = await h1.evaluate((el) => getComputedStyle(el).fontWeight);
expect(h1Weight).toBe("400");
```
This test is scoped to `anon` project and runs against the **pre-login** DOM (`page.goto("/")` while signed out — the `<h1>` renders alongside `<LoginScreen>` per `App.svelte` lines 9-14, both outside `<SignedOut>`). It specifically requires the `<h1>` keep **default browser styling** (weight 400, same font-size as body — i.e., no Tailwind Preflight override, no typographic classes at all).

**Resolution for this phase:** Do not touch `App.svelte` and do not add `CardHeader`/`CardTitle` as a *replacement* for the `<h1>`. Instead, add `CardHeader`/`CardTitle`/`CardDescription` as a **new element inside the `Card`**, additive only. The root `<h1>` stays completely untouched (zero classes added), and `design-system.spec.ts` needs no changes. This directly follows CONTEXT.md's explicit instruction: "do NOT add typographic classes to `App.svelte`'s root `<h1>`" and "address its removal/relocation carefully... not incidentally" — the safe, zero-risk resolution is to leave it exactly as-is and layer the new `CardHeader` alongside it, not instead of it.

## Pattern Assignments

### `web/src/lib/auth/LoginScreen.svelte` (component, request-response)

**Current structure** (full file read, 126 lines) — two-step form (email → code) inside a bare `Card`/`CardContent`, zero spacing utilities, zero `CardHeader`.

**Analog 1 — Card sub-parts already installed, unused here**

Source: `web/src/lib/components/ui/card/card-header.svelte`, `card-title.svelte`, `card-description.svelte` (already vendored, zero new dependency):
```svelte
<!-- card-header.svelte data-slot="card-header" -->
<div data-slot="card-header" class="gap-1 rounded-t-xl px-(--card-spacing) ...">
  {@render children?.()}
</div>

<!-- card-description.svelte -->
<p data-slot="card-description" class={cn("text-sm text-muted-foreground", className)}>
  {@render children?.()}
</p>
```
Import pattern to add (mirrors existing `Card, CardContent` import at line 7):
```typescript
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
```

**Analog 2 — Dialog.Header/Dialog.Title composition precedent in the same codebase**

Source: `web/src/lib/entities/EntityScreen.svelte` lines 469-471:
```svelte
<Dialog.Header>
  <Dialog.Title>{mode === "create" ? "Novo" : "Editar"} — {config.titulo}</Dialog.Title>
</Dialog.Header>
```
This establishes the project's existing convention: a `*.Header` wrapper directly preceding the body content, containing only a `*.Title` (optionally a description). `CardHeader`/`CardTitle`/`CardDescription` should be used the same way, placed as a sibling immediately before `CardContent` inside `Card`:
```svelte
<Card class="w-full max-w-sm">
  <CardHeader>
    <CardTitle>Entrar</CardTitle>
    <CardDescription>
      {#if step === "email"}Informe seu e-mail para receber um código de acesso.{:else}Digite o código enviado para {email}.{/if}
    </CardDescription>
  </CardHeader>
  <CardContent class="space-y-4">
    ...
  </CardContent>
</Card>
```

**Core layout pattern — full-viewport centering**

No existing analog in this codebase (LoginScreen is the only auth screen; `Shell.svelte`/`EntityScreen.svelte` are post-auth and don't center). Use STACK.md's documented recipe directly (verified against shadcn-svelte's own login block convention):
```svelte
<div data-testid="login-screen" class="flex min-h-screen items-center justify-center p-4">
  <Card class="w-full max-w-sm">
    ...
  </Card>
</div>
```
**IMPORTANT:** the `data-testid="login-screen"` currently lives on this same outer `<div>` (line 65 of the current file) — when adding the centering classes, keep the testid on this exact same element (do not wrap it in a second `<div>`), avoiding Pitfall 2 (duplicate testid / Playwright strict-mode failure) from RESEARCH SUMMARY.md.

**Spacing pattern — consistent space-y-4 across both steps**

STACK.md (lines 84-87) specifies: `CardContent` wrapped content as `space-y-4`. Apply `class="space-y-4"` to `CardContent`, and ensure each `<form>` and each `Label`+`Input` pairing also participates in that rhythm (e.g. wrap each label/input pair in a `space-y-2` div, matching the field-spacing convention STACK.md documents for `EntityScreen.svelte`'s Dialog form at line 81: "each field's `<div>` becomes `space-y-2`"). Concretely:
```svelte
<CardContent class="space-y-4">
  {#if step === "email"}
    <form onsubmit={onSubmitEmail} class="space-y-4">
      <div class="space-y-2">
        <Label for="login-email">E-mail</Label>
        <Input id="login-email" data-testid="login-email" ... />
      </div>
      <Button type="submit" data-testid="login-submit" ...>...</Button>
    </form>
  {:else}
    <div class="space-y-4">
      <p class="text-sm text-muted-foreground">Código enviado para {email}</p>
      <form onsubmit={onSubmitCode} class="space-y-4">
        <div class="space-y-2">
          <Label for="login-code">Código</Label>
          <Input id="login-code" data-testid="login-code" ... />
        </div>
        <div class="flex items-center gap-2">
          <Button type="submit" data-testid="login-submit" ...>...</Button>
          <Button variant="ghost" data-testid="login-resend" ...>...</Button>
        </div>
      </form>
    </div>
  {/if}
  {#if erro}
    <Alert variant="destructive">...</Alert>
  {/if}
</CardContent>
```
This keeps the exact same load-bearing testids (`login-screen`, `login-email`, `login-code`, `login-submit`, `login-error`, `login-resend`) verbatim, per CONTEXT.md line 38.

**Error handling / Alert pattern (no change needed)**

Existing pattern at lines 117-122 is already correct and matches `login-flow.spec.ts`'s assertion (`page.locator('[data-slot="alert"]').filter({ has: errorText })`, expects class `/destructive/`). Do not restructure the `Alert`/`AlertDescription` markup — only its position within the new `space-y-4` rhythm changes, not its internal structure.

**Submit busy/spinner pattern (no change needed)**

Existing `{#if ocupado}<LoaderCircle class="size-4 animate-spin" />{/if}` inside `Button` (lines 80-82, 100-102) is the project's canonical inline-button-loading pattern per STACK.md — do not replace with a new `Spinner` component; `login-flow.spec.ts` line 32 asserts `submit.locator(".animate-spin")` directly, so this markup must survive unchanged.

---

## Shared Patterns

### Card composition (Header/Title/Description before Content)
**Source:** `web/src/lib/entities/EntityScreen.svelte` lines 469-471 (`Dialog.Header`/`Dialog.Title` precedent); `web/src/lib/components/ui/card/*.svelte` (already installed, unused)
**Apply to:** `LoginScreen.svelte` only (single file this phase)

### Spacing scale (`space-y-2` fields, `space-y-4` groups)
**Source:** STACK.md lines 81, 86 (documented convention, not yet applied anywhere in codebase); this phase is the first application
**Apply to:** Both `{#if step === "email"}` and `{:else}` branches identically — no ad hoc per-step spacing values (per CONTEXT.md's explicit "consistent rhythm... no ad hoc per-step values" instruction)

### Testid preservation
**Source:** CONTEXT.md line 38 — `login-screen`, `login-email`, `login-code`, `login-submit`, `login-error`, `login-resend` are load-bearing and must be preserved verbatim on the same elements (not moved to a new wrapper), per RESEARCH SUMMARY.md Pitfall 2.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Full-viewport centering (`min-h-screen flex items-center justify-center`) | layout | n/a | No other screen in the app centers content full-viewport (all post-auth screens are inside `Shell`'s toolbar+nav chrome) — apply STACK.md's documented recipe directly, no codebase analog needed. |

## Files Requiring No Change (verified, do not touch)

- `web/src/App.svelte` — root `<h1>` must stay exactly as-is; see Critical Constraint section above.
- `web/e2e/design-system.spec.ts` — no selector or assertion changes needed; the `<h1>` and its computed-style assertions are untouched by this phase.
- `web/e2e/login-flow.spec.ts` — all selectors are `data-testid`-based or structural (`.animate-spin`, `[data-slot="alert"]`) and survive the planned changes verbatim; no update needed as long as testids and Alert/spinner markup are preserved per the patterns above.

## Metadata

**Analog search scope:** `web/src/lib/`, `web/src/lib/components/ui/card/`, `web/src/lib/entities/EntityScreen.svelte`, `web/src/App.svelte`, `web/e2e/`
**Files scanned:** `LoginScreen.svelte`, `App.svelte`, `EntityScreen.svelte` (targeted grep + Dialog section read), `card/*.svelte` (6 sub-part files), `design-system.spec.ts`, `login-flow.spec.ts`
**Pattern extraction date:** 2026-08-10
