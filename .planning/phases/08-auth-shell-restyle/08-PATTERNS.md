# Phase 8: Auth & Shell Restyle - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 4 (2 restyle targets + 2 new-file categories: shadcn component adds, possible new e2e spec)
**Analogs found:** 0 exact / 4 — **this app has zero restyled Svelte screens and zero shadcn component files on disk today.** Phase 7 only wired the Tailwind/shadcn-svelte *foundation* (tokens, `cn()`, `components.json`) — it added no actual `.svelte` component under `src/lib/components/ui/` and restyled no screen. There is no in-repo Button/Input/Card/Alert/Label to imitate. The only real "pattern source" for this phase is (a) the current plain-CSS `LoginScreen.svelte`/`Shell.svelte` themselves — which must be behaviorally preserved verbatim — and (b) `shadcn-svelte add` will generate the component files from its own registry, not from anything in this repo.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `web/src/lib/auth/LoginScreen.svelte` | component (form/auth screen) | request-response (two-step magic-code) | **itself** (current plain-CSS version, must preserve behavior) | self-analog only |
| `web/src/lib/Shell.svelte` | component (layout/nav shell) | event-driven (nav click / auth reactive state) + request-response (logout) | **itself** (current plain-CSS version) | self-analog only |
| `web/src/lib/components/ui/button/*.svelte`, `input/*.svelte`, `label/*.svelte`, `card/*.svelte`, `alert/*.svelte` | component (UI primitive) | n/a (presentational) | none in repo — generated fresh by `bunx shadcn-svelte@latest add button input label card alert` from the shadcn-svelte `nova` registry | no analog (CLI-generated) |
| `web/e2e/design-system.spec.ts` (existing, may be extended) or a new auth/shell-focused spec | test | request-response (Playwright assertions) | `web/e2e/design-system.spec.ts` (Phase 7) for auth-free structural pattern; `web/e2e/auth.setup.ts` for authenticated-flow pattern | role-match (test), exact for testid-assertion style |

## Pattern Assignments

### `web/src/lib/auth/LoginScreen.svelte` (component, request-response)

**Analog:** itself — `web/src/lib/auth/LoginScreen.svelte` (current, full file, 91 lines, read in full above)

This is a **restyle-in-place**, not a new pattern to imitate from elsewhere. The planner/executor must preserve:

**State/logic to preserve verbatim** (lines 1-50):
```svelte
<script lang="ts">
  import { db } from "../db";

  let step = $state<"email" | "code">("email");
  let email = $state("");
  let code = $state("");
  let erro = $state<string | null>(null);
  let ocupado = $state(false);

  async function enviarCodigo() {
    if (ocupado) return;
    ocupado = true;
    erro = null;
    try {
      await db.auth.sendMagicCode({ email });
      step = "code";
    } catch (err) {
      erro = (err as { body?: { message?: string } }).body?.message ?? "Falha ao enviar código.";
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
      // No manual navigation: db.useAuth() flips reactively and SignedIn takes over.
    } catch (err) {
      erro = (err as { body?: { message?: string } }).body?.message ?? "Código inválido.";
    } finally {
      ocupado = false;
    }
  }
  // ... onSubmitEmail/onSubmitCode/reenviar wrappers, unchanged
</script>
```

**Load-bearing `data-testid`s (MUST survive restyle exactly, per `web/e2e/auth.setup.ts` lines 16, 27-33, 40, 49-50)**:
- `login-screen` (root container)
- `login-email` (email `<input>`)
- `login-submit` (submit `<button>` — used for BOTH the email-step submit and the code-step submit; `auth.setup.ts` line 29 & 33 both click `login-submit`, so if restyled into two different shadcn `<Button>` instances, both must carry this same testid)
- `login-code` (code `<input>`)
- `login-resend` (resend `<button>`, only rendered/needed on error branch, line 49)
- `login-error` (error message element, line 40-44 — must be `visible`/`not.visible` toggleable and contain the raw error text, since `auth.setup.ts` regex-matches `errorLocator.innerText()` for `/expired|record-expired|inválido/i`)

**Restyle target — swap for shadcn-svelte primitives** (after `bunx shadcn-svelte add button input label card alert`):
- `<label>`/`<input>` pairs → `Label`/`Input` from `$lib/components/ui/label`, `$lib/components/ui/input` — bind `data-testid` and `bind:value`/`disabled` straight through as props (shadcn-svelte `Input.svelte` forwards `...restProps` including `data-*` attrs and `disabled`).
- `<button type="submit">`/`<button type="button">` → `Button` from `$lib/components/ui/button`, preserving `type`, `data-testid`, `disabled`, `onclick`.
- Wrap the whole two-step form in a `Card`/`CardContent` from `$lib/components/ui/card` for visual structure (`data-testid="login-screen"` stays on the outermost wrapping `<div>`, can wrap the Card).
- Error message → `Alert`/`AlertDescription` from `$lib/components/ui/alert` with `variant="destructive"`, keeping `data-testid="login-error"` on the element that contains the error text.

**Error handling pattern (unchanged, do not touch):** try/catch around each `db.auth.*` call, `erro` set from `err.body?.message` fallback to a hardcoded PT-BR string, `ocupado` guard flag reset in `finally`.

---

### `web/src/lib/Shell.svelte` (component, event-driven + request-response)

**Analog:** itself — `web/src/lib/Shell.svelte` (current, full file, 72 lines, read in full above)

**State/logic to preserve verbatim:**
```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "./db";
  import EntityScreen from "./entities/EntityScreen.svelte";
  import { configByEtype, entityConfigs } from "./entities/registry";
  import { runRoutineInstanceJob } from "./routineJob";

  const auth = db.useAuth();
  let ativo = $state(entityConfigs[0].etype);
  let jobStarted = false; // deliberately non-reactive, see comment lines 12-18
  let jobState = $state<"idle" | "running" | "done" | "error">("idle");

  onMount(() => { /* runRoutineInstanceJob, once per mount — do not change to $effect */ });
</script>
```
- The `onMount`-not-`$effect` choice is intentional (comment lines 12-18) — restyle must not refactor this to a reactive effect.
- `jobState`/`jobStarted` job-tracking must remain untouched; the hidden `data-testid="routine-job-state"` sentinel div (line 46) must survive restyle exactly as-is (hidden, `data-job-state` attribute).

**Load-bearing `data-testid`s (MUST survive restyle exactly, per `web/e2e/auth.setup.ts` lines 57-59, 62-63)**:
- `app-shell` — root container; `auth.setup.ts` asserts `toBeVisible()` AND `toContainText(EMAIL)` — so the authenticated user's email must remain textually present somewhere inside this container (currently line 49: `autenticado como {auth.user.email}`).
- `logout` (the `<button>` calling `db.auth.signOut()`, line 51)
- `nav-${cfg.etype}` (per-entity nav buttons, templated from `entityConfigs`, line 57) — dynamic testid, must keep the exact `nav-${etype}` template string
- `routine-job-state` (hidden sentinel div, line 46) — not asserted by `auth.setup.ts` directly but likely load-bearing for other existing specs; do not remove/rename

**Restyle target — swap for shadcn-svelte primitives:**
- Top status line (`autenticado como {auth.user.email}`) and `logout` button → could live in a header bar; `logout` button becomes `Button` (e.g. `variant="ghost"` or `variant="outline"`), keeping `data-testid="logout"` and the `onclick={() => db.auth.signOut()}` handler untouched.
- `<nav>` entity-switcher buttons → each becomes a `Button` with `variant={ativo === cfg.etype ? "default" : "ghost"}` (or similar active-state styling), preserving `data-testid={`nav-${cfg.etype}`}`, `aria-current={ativo === cfg.etype}`, and the `onclick={() => (ativo = cfg.etype)}` handler verbatim.
- No `Card`/`Alert` needed here structurally — `Card` could optionally wrap the main content area (`{#key ativo}...{/key}` block containing `EntityScreen`) for visual polish, but this is discretionary; the `{#key}`/`{@const}` reactivity block must be preserved exactly since it drives the tab-switch remount behavior.

**Error handling pattern (unchanged, do not touch):** the `runRoutineInstanceJob` try/catch/`console.error` swallow-and-continue pattern (lines 27-42) is deliberately fail-soft — restyle must not add UI for job errors beyond what already exists (`jobState = "error"` is tracked but not currently rendered to the user; out of scope to add UI for it unless CONTEXT.md later says otherwise — it doesn't).

---

### `web/src/lib/components/ui/{button,input,label,card,alert}/*.svelte` (component, presentational)

**No repo analog — CLI-generated.** Run `bunx shadcn-svelte@latest add button input label card alert` (non-interactively, matching Phase 7's `--preset`/piped-stdin pattern from `07-01-SUMMARY.md` "Issues Encountered" — the CLI may prompt for overwrite confirmation via `@clack/prompts`; pipe `y` via stdin if unattended, or check for a `--yes`/`-y`/`--overwrite` flag in whatever `shadcn-svelte@latest` version resolves).

Expected output shape (from shadcn-svelte `nova` preset conventions, consistent with Phase 7's already-committed `components.json` aliases and `$lib/utils.ts`'s `cn()` helper): each component under `web/src/lib/components/ui/<name>/<name>.svelte` plus an `index.ts` barrel re-exporting it, importing `cn` from `$lib/utils` for class merging, and using Svelte 5 `$props()`/`children` snippet conventions (matching the `WithoutChild`/`WithElementRef` type helpers already present in `web/src/lib/utils.ts`). Do not hand-write these — let the CLI generate them, then only import/consume from `LoginScreen.svelte`/`Shell.svelte`.

---

### `web/e2e/design-system.spec.ts` or new auth/shell e2e spec (test, request-response)

**Analog:** `web/e2e/design-system.spec.ts` (Phase 7, auth-free `anon` project) for structural/testid-assertion style; `web/e2e/auth.setup.ts` (full file, read above) for the authenticated round-trip contract this phase must not break.

**Testid-assertion pattern to reuse** (style established in Phase 7, referenced in CONTEXT.md line 38: "assert via `data-testid`, not CSS/tag selectors"):
```typescript
await page.goto("/");
await expect(page.getByTestId("login-screen")).toBeVisible();
```
Any new Phase 8 e2e coverage (e.g. verifying shadcn classes are applied, or verifying visual structure post-restyle) should route through the `anon` Playwright project like `design-system.spec.ts` does, NOT through `authed`, unless it specifically needs the live magic-code round trip — in which case it must reuse `auth.setup.ts`'s exact `readMagicCodeAfter`/resend-retry loop pattern (lines 26-55) rather than reinvent it.

**Critical regression contract — do not weaken:** `auth.setup.ts` is the ground truth for what "restyle without breaking behavior" means. Every testid it references (`login-screen`, `login-email`, `login-submit`, `login-code`, `login-error`, `login-resend`, `app-shell`) must resolve to a visible/interactable element with identical semantics after the restyle. This spec is the acceptance test for Phase 8, not just a reference pattern.

---

## Shared Patterns

### Testid preservation (cross-cutting, applies to both LoginScreen.svelte and Shell.svelte)
**Source:** `web/e2e/auth.setup.ts` (full file)
**Apply to:** `LoginScreen.svelte`, `Shell.svelte`
Every `data-testid` currently present must be re-attached to whichever new shadcn-svelte element replaces the old plain HTML tag. shadcn-svelte components (Button, Input, etc.) forward arbitrary props including `data-testid` via `{...restProps}` spreading — verify this per-component after `add`, but it is the standard shadcn-svelte/bits-ui convention.

### Dark-mode / token usage (cross-cutting)
**Source:** `web/src/app.css` (Phase 7, full file read above) — `--background`, `--foreground`, `--primary`, `--destructive`, etc., swapped automatically under `@media (prefers-color-scheme: dark)`.
**Apply to:** any custom Tailwind utility classes added directly in `LoginScreen.svelte`/`Shell.svelte` (e.g. layout wrappers not covered by a shadcn primitive) — use `bg-background`, `text-foreground`, `text-destructive`, `border-border`, etc. Never hard-code colors or add a second dark-mode override layer (Phase 7 pattern, `07-01-SUMMARY.md` "patterns-established").

### No custom design tokens (cross-cutting, constraint C-11)
**Source:** `.planning/phases/08-auth-shell-restyle/08-CONTEXT.md` line 21; `web/components.json` (Phase 7)
**Apply to:** all restyled markup — only use `bunx shadcn-svelte add` output and its own `nova`/`neutral` token set; do not introduce bespoke colors, spacing scales, or a second theme file.

### Non-interactive CLI invocation pattern (operational, not code)
**Source:** `07-01-SUMMARY.md` "Issues Encountered" section
**Apply to:** the `bunx shadcn-svelte@latest add button input label card alert` step — expect a possible interactive overwrite/confirm prompt; pipe `y` via stdin (`printf "y\n" | bunx shadcn-svelte@latest add ...`) if the installed CLI version has no non-interactive flag, exactly as Phase 7's `init` step required.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `web/src/lib/components/ui/button/button.svelte` (and input/label/card/alert siblings) | component | presentational | Zero shadcn component files exist anywhere in this repo as of Phase 7's completion — Phase 7 explicitly stopped short of adding any (see `07-01-SUMMARY.md` "Next Phase Readiness": "ready for Phase 8 ... to consume via `shadcn-svelte add <component>`"). These will be CLI-generated fresh; there is nothing in-repo to copy from. Reference the shadcn-svelte `nova` preset's own registry output (generated by the CLI itself) as ground truth once `add` is run. |

## Metadata

**Analog search scope:** `web/src/` (all `.svelte` files, 4 total: `App.svelte`, `Shell.svelte`, `LoginScreen.svelte`, `EntityScreen.svelte`), `web/src/lib/components/ui/` (empty, confirmed via `ls`), `web/e2e/` (existing Playwright specs), `web/src/app.css`, `web/src/lib/utils.ts`, `web/components.json`
**Files scanned:** 4 Svelte components, 1 CSS token file, 1 utils file, 1 components.json, 2 e2e spec/setup files (`design-system.spec.ts` referenced via Phase 7 summary, `auth.setup.ts` read in full)
**Pattern extraction date:** 2026-08-09
