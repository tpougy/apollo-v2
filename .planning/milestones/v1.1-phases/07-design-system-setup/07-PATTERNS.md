# Phase 7: Design System Setup - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 7 (modified: 4, new: 3)
**Analogs found:** 7 / 7 (all matched — this is an additive/config-heavy phase; every target file has a direct existing counterpart to extend)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `web/vite.config.ts` | config | build-time transform | `web/vite.config.ts` (itself — additive edit) | exact (same file, extend existing `plugins`/`resolve.alias`) |
| `web/src/app.css` | config/stylesheet | transform (CSS tokens) | `web/src/app.css` (itself — replaced) | exact (same file, full rewrite per Pattern 3 in RESEARCH.md) |
| `web/components.json` | config | N/A (static CLI output) | *(none — genuinely new artifact type; no prior config-json in `web/`)* | no analog — CLI-generated, structure fixed by `shadcn-svelte init` |
| `web/src/lib/utils.ts` | utility | transform (className merge) | `web/src/lib/db.ts` (closest existing single-export utility module under `src/lib/`, role-match only) | role-match (both are small `src/lib/*.ts` singleton-export utility modules; no code shape to copy — `utils.ts`'s content is fixed by the `shadcn-svelte init` codegen, not hand-written) |
| `web/tsconfig.json` / `web/tsconfig.app.json` | config | build-time (path resolution) | `web/tsconfig.app.json` (itself — additive `paths`/`baseUrl` edit) | exact (same file, additive edit alongside existing `@instantdb/svelte` path entry) |
| `web/biome.json` (repo-root) glob scope | config | build-time (lint scope) | `biome.json` (itself — additive glob edit, no new file) | exact (same file; only if `components/ui` subtree needs excluding — see Shared Patterns) |
| `web/e2e/design-system.spec.ts` | test | request-response (Playwright DOM assertions) | `web/e2e/no-leakage.spec.ts` (closest: standalone, `anon`-style, no-auth-dependency spec) | exact (same role + same "no setup dependency" data flow) |

## Pattern Assignments

### `web/vite.config.ts` (config, build-time transform)

**Analog:** `web/vite.config.ts` itself (read in full — 46 lines)

**Full current file** (all lines UNCHANGED except the two marked below):
```typescript
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { parse } from "dotenv";
import { defineConfig } from "vite";

const instantdbSveltePath = fileURLToPath(
  new URL("./node_modules/@instantdb/svelte", import.meta.url),
);
const envPath = fileURLToPath(new URL("../.env.instantdb", import.meta.url));
const parsed = parse(readFileSync(envPath));
const appId = parsed.NEXT_PUBLIC_INSTANT_APP_ID ?? parsed.INSTANT_APP_ID;
if (!appId) {
  throw new Error(
    `Missing InstantDB app id: expected NEXT_PUBLIC_INSTANT_APP_ID (or INSTANT_APP_ID) in ${envPath}`,
  );
}

export default defineConfig({
  plugins: [svelte()],                 // <-- MODIFY: append tailwindcss()
  resolve: {
    alias: {
      "@instantdb/svelte": instantdbSveltePath,   // <-- KEEP, do not remove
      // <-- ADD: $lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
    },
  },
  define: {
    "import.meta.env.VITE_INSTANT_APP_ID": JSON.stringify(appId),
  },
});
```

**Core edit pattern:** two additive lines only — `import tailwindcss from "@tailwindcss/vite";` at the top, `tailwindcss()` appended to `plugins`, and `$lib` alias added to `resolve.alias`. Do not touch the `.env.instantdb` parsing block (documented as mitigating threat T-01-02 — see comment at lines 17-23 of the current file) and do not run `sv add tailwindcss` (codemod risk — see RESEARCH.md Pattern 1/Anti-Patterns).

**Error handling pattern:** none needed — this file's only error handling (`if (!appId) throw ...`) is pre-existing and must be preserved verbatim.

---

### `web/src/app.css` (config/stylesheet, CSS token transform)

**Analog:** `web/src/app.css` itself (read in full — 15 lines, plain reset)

**Current file (to be fully replaced):**
```css
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
```

**Core pattern (post-edit, per RESEARCH.md Pattern 3):**
```css
@import "tailwindcss";
@import "tw-animate-css";
/* no @custom-variant dark line — Tailwind v4 defaults dark: to prefers-color-scheme */
:root { /* light tokens exactly as shadcn-svelte init writes them */ }
@media (prefers-color-scheme: dark) {
  :root { /* dark tokens — same values init wrote under `.dark { ... }`, moved into this media query */ }
}
@theme inline { /* Tailwind v4 token map, exactly as init writes it — do not hand-edit */ }
```
The box-sizing/font-family reset in the current file is fully superseded by Tailwind's Preflight — do not try to preserve it alongside the Tailwind import (Preflight already includes an equivalent/stronger reset).

---

### `web/components.json` (config, no analog)

No existing file in this repo has this role — it is a fixed-shape artifact written once by `bunx shadcn-svelte@latest init --preset b0 --css src/app.css --lib-alias '$lib' --components-alias '$lib/components' --ui-alias '$lib/components/ui' --utils-alias '$lib/utils' --hooks-alias '$lib/hooks'` (exact command from RESEARCH.md Pattern 2/Code Examples). Do not hand-author its contents — run the CLI, then `Read` the resulting file back to confirm `style: "nova"`, `iconLibrary: "lucide"` before considering this file done (per RESEARCH.md Pattern 2 closing note).

---

### `web/src/lib/utils.ts` (utility, className transform)

**Analog:** `web/src/lib/db.ts` (role-match only — both are single-purpose exported-const utility modules directly under `src/lib/`)

This file's content (`cn()` helper using `clsx` + `tailwind-merge`) is generated verbatim by `shadcn-svelte init` — there is no hand-written pattern to copy from the existing codebase. The only applicable convention from `db.ts` is placement (`src/lib/*.ts`, no subdirectory) and that it must pass `bun run lint` / `bun run check` immediately after generation (see RESEARCH.md Pitfall 3 — Biome/svelte-check parity is not guaranteed for CLI-generated code).

---

### `web/tsconfig.json` + `web/tsconfig.app.json` (config, build-time path resolution)

**Analog:** same two files, additive edit

**`tsconfig.json` current (3 lines of substance):**
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```
**Edit:** add `"compilerOptions": { "baseUrl": ".", "paths": { "$lib": ["./src/lib"], "$lib/*": ["./src/lib/*"] } }` alongside the existing `files`/`references` keys (do not remove either).

**`tsconfig.app.json` current `paths` block (lines 13-15):**
```json
"paths": {
  "@instantdb/svelte": ["./node_modules/@instantdb/svelte"]
}
```
**Edit:** add `"$lib": ["./src/lib"]` and `"$lib/*": ["./src/lib/*"]` into this same object — keep the existing `@instantdb/svelte` entry untouched (same convention as the `vite.config.ts` alias: additive, never replace).

---

### `web/e2e/design-system.spec.ts` (test, Playwright request-response)

**Analog:** `web/e2e/no-leakage.spec.ts` (full file read — 50+ lines; closest match: runs standalone without the `setup`/`authed` project dependency chain, matches this new spec's no-auth-needed nature)

**Imports pattern** (`no-leakage.spec.ts` lines 1-2):
```typescript
import { expect, test } from "@playwright/test";
```

**Structural comment convention** (lines 3-5, to imitate):
```typescript
// This spec runs in the `anon` project, which uses an explicitly empty
// storageState (no cookies, no origins) — no dependency on the `setup`
// project, so it never triggers a magic-code send.
```
Note: `design-system.spec.ts` is not itself assigned to the `anon` Playwright project (`playwright.config.ts` maps `anon` specifically to `no-leakage.spec.ts` via regex `testMatch: /no-leakage\.spec\.ts/`, and `authed` maps to `/.*\.spec\.ts/` minus `no-leakage`). Since `design-system.spec.ts` will match the `authed` project's glob by default, it will run once logged in via the `setup` dependency chain — which is fine, since Preflight/tokens/dark-mode assertions are DOM/CSS checks independent of auth state. No `playwright.config.ts` changes are required unless the plan explicitly wants this spec to also run pre-login (optional).

**Core assertion pattern** (`no-leakage.spec.ts` lines 18-19, `data-testid` convention):
```typescript
await page.goto("/");
await expect(page.getByTestId("login-screen")).toBeVisible();
```
This exact `data-testid="login-screen"` selector is the established convention (also used in `e2e/auth.setup.ts` line 16) and should anchor the "boots with zero console errors" assertion described in RESEARCH.md Code Examples.

**Console-error capture pattern:** not present in `no-leakage.spec.ts` or `auth.setup.ts` verbatim — RESEARCH.md's Code Examples section already supplies the exact `page.on("console", ...)` / `page.on("pageerror", ...)` pattern to use; no closer in-repo analog exists (this repo's e2e suite has no prior console-error assertion). Use RESEARCH.md's snippet directly.

**Error/no-op handling pattern** (`no-leakage.spec.ts` lines 24-31 — try/catch around a Playwright response body read):
```typescript
let length = 0;
try {
  const body = await response.body();
  length = body.length;
} catch {
  // Some responses (e.g. websocket upgrades) have no readable body.
  length = 0;
}
```
Illustrates this codebase's convention of catching narrow, expected failure modes with an explanatory comment rather than a broad try/catch — apply the same discipline if `design-system.spec.ts` needs any similar defensive read (unlikely, since its assertions are all `getComputedStyle`/`emulateMedia`, which don't throw).

---

## Shared Patterns

### Additive-only edits to existing config files
**Source:** `web/vite.config.ts`, `web/tsconfig.json`, `web/tsconfig.app.json` (all read in full this session)
**Apply to:** Every MODIFIED file in this phase
Every existing config file in `web/` that this phase touches has load-bearing custom logic already (the `.env.instantdb` parsing in `vite.config.ts` mitigates threat T-01-02; the `@instantdb/svelte` path entry in `tsconfig.app.json` supports the `shared/*.ts` cross-package import). The established pattern across this codebase is: never replace, only append new keys/array entries alongside existing ones, and never run an automated codemod (`sv add ...`) against a file with hand-written comments explaining a security rationale.

### `data-testid` convention for Playwright assertions
**Source:** `web/e2e/auth.setup.ts:16`, `web/e2e/no-leakage.spec.ts:18-19,37-39`
**Apply to:** `web/e2e/design-system.spec.ts`
```typescript
await expect(page.getByTestId("login-screen")).toBeVisible();
await expect(page.getByTestId("app-shell")).toHaveCount(0); // when unauthenticated
```
All existing specs assert via `data-testid`, never CSS class/tag selectors for structural elements (tag selectors like `page.locator("h1", ...)` are only used in RESEARCH.md's Preflight example because `<h1>` is the literal thing being visually tested, not a structural landmark).

### Biome glob scope
**Source:** `biome.json:9-16` (repo root, read in full)
**Apply to:** `web/src/lib/utils.ts`, `web/components.json` (JSON — not covered by any existing Biome glob; `web/src/**/*.ts` already covers `utils.ts` with no edit needed)
Current `files.includes` is `["shared/**/*.ts", "web/src/**/*.ts", "web/src/**/*.svelte", "web/vite.config.ts", "web/e2e/**/*.ts", "web/playwright.config.ts"]` — `web/src/**/*.ts` already covers the new `src/lib/utils.ts` with zero glob edits required. No JSON files are in Biome's scope at all currently, so `components.json` needs no lint-scope change (and per RESEARCH.md Pitfall 3, no `ui/` subtree exists yet to consider excluding — defer that glob decision to Phase 8+ if generated components fail Biome).

### Verification-only, no human checkpoints (C-12)
**Source:** RESEARCH.md Validation Architecture section + this phase's CONTEXT.md C-12
**Apply to:** all plan `<verify>` blocks for this phase
Every verification step must be `<verify><automated>` (Playwright test run, `bun run check`, `bun run lint`, or a file-read confirming `components.json` content) — never `<verify><human-check>`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `web/components.json` | config | N/A (static) | First config-JSON file of its kind in `web/` — content is fixed by the `shadcn-svelte init` CLI output, not hand-authored; nothing in the existing codebase to pattern-match against. Use the exact CLI invocation in RESEARCH.md Pattern 2. |

## Metadata

**Analog search scope:** `web/` (all source, config, and `e2e/` files read directly — no Glob/Grep needed beyond direct reads, since this is a small ~10-file app and CONTEXT.md/RESEARCH.md already enumerated every relevant existing file)
**Files scanned:** `web/vite.config.ts`, `web/src/app.css`, `web/tsconfig.json`, `web/tsconfig.app.json`, `web/package.json`, `biome.json`, `web/playwright.config.ts`, `web/e2e/auth.setup.ts`, `web/e2e/no-leakage.spec.ts`, `web/src/App.svelte`, `web/src/lib/Shell.svelte`
**Pattern extraction date:** 2026-08-09
