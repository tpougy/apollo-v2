# Phase 7: Design System Setup - Research

**Researched:** 2026-08-09
**Domain:** Tailwind CSS v4 + shadcn-svelte 1.x integration into a plain Vite + Svelte 5 SPA (no SvelteKit), automatic `prefers-color-scheme` dark mode, Playwright-provable wiring
**Confidence:** HIGH (CLI/install mechanics verified against `huntabyte/shadcn-svelte` source at the exact published version; a few naming/terminology items in the locked spec are stale relative to the current tool — flagged explicitly below)

## Summary

`web/` is a plain Vite 8 + Svelte 5 SPA with a hand-written `vite.config.ts` (custom `@instantdb/svelte` alias + manual `.env.instantdb` parsing) and a two-rule `src/app.css` reset. Phase 7 must replace that reset with Tailwind CSS v4 (via the official `@tailwindcss/vite` plugin — no PostCSS config, no content globs) and initialize `shadcn-svelte@1.5.0` against it, non-destructively preserving the existing custom Vite config.

The critical, non-obvious finding this session: **shadcn-svelte's CLI was redesigned around a "design system preset" model** (named presets like `nova`/`vega`/`maia`... bundling style+baseColor+theme+iconLibrary+font+radius) that no longer has a style called `"default"` or a base color called `"slate"` — both terms in this project's locked spec (REQUIREMENTS.md SETUP-02, PROJECT.md C-11) are stale relative to the CLI actually on the registry today. The literal zero-configuration default (index 0 of every preset field) is style `"nova"`, base color `"neutral"`, icon library `"lucide"` — this satisfies the *intent* of C-11 ("no custom picks, use whatever the tool defaults to, don't invent fashion") even though it doesn't use the word "slate." This is flagged as an assumption for the planner (see Assumptions Log #A1) rather than silently substituted.

Second critical finding: shadcn-svelte's own init output does **not** give automatic `prefers-color-scheme` dark mode out of the box — it hard-codes a class-based `@custom-variant dark (&:is(.dark *));` (meant to pair with a `mode-watcher` JS toggle, which this project must never install per C-11 "no toggle"). Tailwind v4 itself defaults `dark:` to `prefers-color-scheme` — so satisfying SETUP-03 means *deleting* the `@custom-variant dark` line shadcn-svelte writes and wrapping the `.dark { ... }` variable block in `@media (prefers-color-scheme: dark) { :root { ... } }` instead of leaving it as a `.dark` class selector. This is a small, mechanical, fully-scripted edit — no new package needed.

**Primary recommendation:** Install `tailwindcss` + `@tailwindcss/vite` manually (add the plugin to the existing `plugins: [svelte()]` array — do not run the `sv add tailwindcss` codemod, it risks rewriting the hand-tuned `vite.config.ts`). Then run `shadcn-svelte@latest init` fully non-interactively via `--preset b0` (the verified zero-config default) plus explicit `--css`/`--*-alias` flags (no prompts, no browser open). Then hand-edit `app.css` to convert the `.dark` class selector to a `prefers-color-scheme` media query and delete the class-based `@custom-variant dark` override. Prove all of it live in Chromium via `getComputedStyle` + `page.emulateMedia({ colorScheme })`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tailwind CSS processing (utility generation, preflight reset) | Build tooling (Vite plugin) | Browser/Client (rendered CSS) | `@tailwindcss/vite` runs at build/dev-server time; the resulting CSS is what the browser renders — no server tier exists in this pure-SPA architecture |
| shadcn-svelte component library (Button, Input, etc. — none consumed yet in Phase 7) | Browser/Client | — | Components are Svelte components shipped in the client bundle; this app has no SSR tier |
| Design tokens (CSS custom properties: `--background`, `--primary`, etc.) | Browser/Client | Build tooling (written once by CLI into `app.css`) | Tokens are static CSS resolved by the browser at paint time; the CLI only writes the file once, it does not run at request time |
| Dark mode switching | Browser/Client (CSS `@media` query, zero JS) | — | Locked constraint (C-11) forbids a JS toggle; the OS-level `prefers-color-scheme` media feature is evaluated entirely by the browser's rendering engine |
| Icon rendering (`@lucide/svelte`) | Browser/Client | — | Icons are inline SVG Svelte components bundled and rendered client-side |

## User Constraints

<user_constraints>
### Locked Decisions (from PROJECT.md, do not reopen)

- **C-11**: Tailwind CSS + shadcn-svelte, default style/baseColor, default theme tokens only — no custom color palette, no bespoke design tokens beyond the shadcn-svelte init output. Icon library `@lucide/svelte`. Dark mode via `prefers-color-scheme`, no toggle.
- **C-12**: This milestone runs fully unattended — every phase is verified via real Playwright e2e runs against the live InstantDB app, never via a human UAT checkpoint. Plans for this phase MUST use `<verify><automated>` Playwright/tooling checks exclusively — never emit `<verify><human-check>` blocks or `checkpoint:human-verify` tasks.
- **C-08**: `bun` is the sole JS/TS executor; frontend logic is always `.ts`/`.svelte` with `<script lang="ts">`; Biome + `svelte-check` must stay clean.

### Claude's Discretion

All implementation choices are at Claude's discretion — discuss phase was skipped per user setting (`workflow.skip_discuss`). Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)

None — discuss phase skipped for this phase.
</user_constraints>

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | `web/` has Tailwind v4 installed and wired via `@tailwindcss/vite`, replacing the current plain `app.css` reset | See "Standard Stack" + "Code Examples: Tailwind v4 wiring" — exact package names/versions verified via `npm view`; exact `vite.config.ts` diff given, preserving existing custom plugin/alias/env-parsing code |
| SETUP-02 | `web/` has `shadcn-svelte` initialized (default style, default/slate base color, `@lucide/svelte` icons) with `components.json` committed | See "Common Pitfalls: stale style/baseColor terminology" + "Code Examples: non-interactive init command" — CLI source read directly from `huntabyte/shadcn-svelte@main` (matches published `1.5.0`); exact flags for a fully non-interactive, unattended-safe init given |
| SETUP-03 | Dark mode follows `prefers-color-scheme` automatically (shadcn-svelte default tokens) — no manual toggle | See "Common Pitfalls: shadcn-svelte's dark mode is class-based by default" + "Code Examples: converting `.dark` class to `@media` query" — exact CSS transformation given, confirmed against Tailwind v4's own default `dark:` behavior |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tailwindcss` | `4.3.3` [VERIFIED: npm registry, `npm view tailwindcss version`] | Utility-first CSS engine, v4 CSS-native config | Locked by C-11; official, only viable Tailwind major for current shadcn-svelte `init` (CLI preflight check requires Tailwind v4 — see Pitfalls) |
| `@tailwindcss/vite` | `4.3.3` [VERIFIED: npm registry] | First-party Vite plugin — replaces PostCSS pipeline entirely | Official Tailwind Labs package (`tailwindlabs/tailwindcss` repo), zero-config, matches project's Vite-only (no SvelteKit) architecture |
| `shadcn-svelte` | `1.5.0` [VERIFIED: npm registry; CLI source read directly from GitHub `main` this session, matches package.json `"version": "1.5.0"`] | CLI that scaffolds `components.json`, `src/lib/utils.ts`, `app.css` tokens, and copies component source into the repo (not an npm runtime dependency — it's a dev-time codegen tool, invoked via `bunx`) | The de facto standard "shadcn for Svelte" port; maintained by `huntabyte`, matches locked C-11 |
| `bits-ui` | `1.5.0` region — currently `2.18.1` [VERIFIED: npm registry; peer dep `svelte: ^5.33.0` confirmed via `npm view bits-ui peerDependencies`, satisfied by project's `svelte@5.56.8`] | Headless/unstyled interaction primitives (focus mgmt, ARIA, keyboard) that shadcn-svelte's generated components wrap | Installed automatically as a dependency the first time any shadcn-svelte component is added — no direct install needed in Phase 7 itself (Phase 7 only runs `init`, no `add` yet), but the version constraint matters for planning ahead |
| `@lucide/svelte` | `1.31.0` [VERIFIED: npm registry] | Icon components, Svelte-5-native (tree-shakable, inline SVG) | Locked by C-11. **Package name provenance:** `@lucide/svelte` (scoped) is the CURRENT package for Svelte 5; the older unscoped `lucide-svelte` is for Svelte 3/4 only and must NOT be installed [ASSUMED — confirmed via WebSearch/community sources, not an official doc page fetched this session, but corroborated by the shadcn-svelte CLI's own `iconLibraries.lucide.packages = ["@lucide/svelte"]`, which IS source-verified] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` | `2.1.1` [VERIFIED: npm registry] | Conditional className composition | Used inside the CLI-generated `src/lib/utils.ts` `cn()` helper — every shadcn-svelte component imports it |
| `tailwind-merge` | `3.6.0` [VERIFIED: npm registry; `shadcn-svelte`'s own `package.json` dependency is `tailwind-merge: ^3.6.0`, confirmed via `npm view shadcn-svelte dependencies`] | Resolves conflicting Tailwind utility classes when merging `class` props | Same `cn()` helper — required by every generated component that accepts a `class` prop |
| `tw-animate-css` | `1.4.0` [VERIFIED: npm registry] | Tailwind v4 replacement for the (now-incompatible) `tailwindcss-animate` plugin | shadcn-svelte's `init` writes `@import "tw-animate-css";` into `app.css` when any preset uses animated components (accordion, dialog, etc.) — safe/expected to be added even though Phase 7 doesn't consume components yet |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tailwindcss/vite` | PostCSS + `tailwindcss` + `autoprefixer` (Tailwind v3-style pipeline) | Rejected — this is the deprecated v3 flow; v4's Vite plugin is faster (Rust-based Oxide engine) and is what the shadcn-svelte v1.5 CLI's own preflight check expects (`tailwindcss` semver `^4.0.0` required for `init` to run at all) |
| `sv add tailwindcss` (Svelte CLI codemod) | Manual `vite.config.ts` + `app.css` edits | Chosen manual: this repo's `vite.config.ts` already has hand-written logic (custom `@instantdb/svelte` alias, manual `.env.instantdb` parsing per a documented security threat T-01-02). An automated codemod is a higher-risk edit to a file with load-bearing custom logic than three manually-verified lines |
| `--preset b0` non-interactive init | Answering the CLI's interactive prompts manually via a PTY/expect script | Chosen `--preset` + explicit alias/css flags: fully deterministic, no TTY emulation needed, matches this milestone's unattended-execution requirement (C-12 context: `/gsd:autonomous` runs for hours with no human available) |

**Installation:**
```bash
cd web
bun add -D tailwindcss @tailwindcss/vite
# shadcn-svelte itself is invoked via bunx, never added as a project dependency
```

**Version verification:** All versions above were checked live against the npm registry this session:
```bash
npm view tailwindcss version          # 4.3.3
npm view @tailwindcss/vite version    # 4.3.3
npm view shadcn-svelte version        # 1.5.0
npm view bits-ui version              # 2.18.1
npm view @lucide/svelte version       # 1.31.0
npm view clsx version                 # 2.1.1
npm view tailwind-merge version       # 3.6.0
npm view tw-animate-css version       # 1.4.0
```
Training-data versions for this stack are stale by multiple majors (shadcn-svelte in particular shipped a from-scratch CLI redesign — see Pitfalls); always re-verify at execution time, not from this table alone, since these packages release frequently (`tailwindcss` and `@tailwindcss/vite` both published new versions within the last 3 days of this research date).

## Package Legitimacy Audit

| Package | Registry | Age (latest version) | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------------------|-------------------|--------------|---------|-------------|
| `tailwindcss` | npm | 3 days (2026-08-07) | 120,470,732 | github.com/tailwindlabs/tailwindcss | SUS* | Approved — false positive |
| `@tailwindcss/vite` | npm | 3 days (2026-08-07) | 43,634,154 | github.com/tailwindlabs/tailwindcss | SUS* | Approved — false positive |
| `shadcn-svelte` | npm | 7 days (2026-08-02) | 86,087 | github.com/huntabyte/shadcn-svelte | SUS* | Approved — false positive |
| `bits-ui` | npm | ~3 months (2026-05-03) | 941,914 | github.com/huntabyte/bits-ui | OK | Approved |
| `@lucide/svelte` | npm | 0 days (2026-08-09) | 707,362 | github.com/lucide-icons/lucide | SUS* | Approved — false positive |
| `tailwind-variants` | npm | 6 days (2026-08-03) | 3,426,441 | github.com/heroui-inc/tailwind-variants | SUS* | Not used this phase — not a Phase 7 dependency (relevant only if a later phase needs `tv()`-style variant composition) |
| `tw-animate-css` | npm | ~11 months (2025-09-24) | 36,232,942 | github.com/Wombosvideo/tw-animate-css | OK | Approved |
| `clsx` | npm | ~2 years (2024-04-23) | 116,671,303 | github.com/lukeed/clsx | OK | Approved |
| `tailwind-merge` | npm | 3 months (2026-05-10) | 79,795,703 | github.com/dcastil/tailwind-merge | OK | Approved |

*\*Note on the `SUS`/"too-new" verdicts:* the `package-legitimacy check` seam flags packages whose **latest published version** is recent as `too-new`. For `tailwindcss`, `@tailwindcss/vite`, `shadcn-svelte`, and `@lucide/svelte` this is a heuristic false positive: `publishedAt` reflects a routine version bump of an actively-maintained, extremely high-download package with an official, recognizable GitHub org (`tailwindlabs`, `huntabyte`, `lucide-icons`) and zero `postinstall` scripts — not a newly-created/hallucinated package. **Disposition: approved, no `checkpoint:human-verify` needed** — inserting one would violate this phase's locked C-12 (no human-check blocks in this milestone). The download-count + repo-provenance evidence gathered above constitutes the automated verification C-12 requires in place of a human checkpoint.

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]` requiring extra scrutiny (not a human checkpoint, per C-12):** none beyond the false positives explained above — all are cleared by download count + repo provenance.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────── Build time (bun / Vite) ───────────────────────────────┐
│                                                                                          │
│  web/vite.config.ts                                                                     │
│   plugins: [svelte(), tailwindcss()]  ← @tailwindcss/vite added to EXISTING array        │
│   resolve.alias: { "@instantdb/svelte": ..., "$lib": ... }  ← both aliases coexist       │
│        │                                                                                 │
│        ▼                                                                                 │
│  web/src/app.css                                                                         │
│   @import "tailwindcss";        ← Tailwind utilities + Preflight reset                   │
│   @import "tw-animate-css";     ← shadcn-svelte init output                              │
│   :root { --background: ...; --foreground: ...; --primary: ...; ... }  ← light tokens    │
│   @media (prefers-color-scheme: dark) { :root { --background: ...; ... } }  ← dark tokens│
│        (NOT `.dark { ... }` — that's shadcn-svelte's raw output; must be hand-edited)     │
│   @theme inline { --color-background: var(--background); ... }  ← Tailwind v4 token map  │
│                                                                                           │
└──────────────────────────────────────┬───────────────────────────────────────────────────┘
                                        │ bundled CSS + JS shipped to browser
                                        ▼
┌──────────────────────────────── Runtime (Chromium / any browser) ──────────────────────┐
│                                                                                          │
│  OS/browser reports prefers-color-scheme ──► matched by @media query in app.css         │
│                                              ──► CSS custom properties resolve           │
│                                              ──► getComputedStyle(html) exposes them      │
│                                                                                           │
│  web/src/App.svelte  (untouched this phase — still <h1>Apollo v2</h1> + SignedIn/Out)    │
│   Preflight already visible here: <h1> font-size/weight now equal to body (no h1 boost)  │
│                                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
web/
├── components.json          # NEW — shadcn-svelte config, committed (SETUP-02)
├── vite.config.ts           # MODIFIED — add tailwindcss() to existing plugins[], add $lib alias
├── tsconfig.json            # MODIFIED — add baseUrl + $lib paths (coexists with existing refs)
├── tsconfig.app.json        # MODIFIED — add baseUrl + $lib paths (coexists with existing @instantdb/svelte path)
└── src/
    ├── app.css              # REPLACED — Tailwind import + shadcn tokens + prefers-color-scheme fix
    └── lib/
        ├── utils.ts          # NEW — cn() helper (clsx + tailwind-merge), written by `init`
        └── components/
            └── ui/           # EMPTY this phase — no `add <component>` calls yet; created by later phases
```

### Pattern 1: Manual Tailwind v4 + Vite wiring (no SvelteKit, no codemod)
**What:** Add the `@tailwindcss/vite` plugin directly to the existing `plugins` array instead of running a codemod tool.
**When to use:** Any Vite project (SvelteKit or not) with pre-existing custom `vite.config.ts` logic that a generic codemod could clobber.
**Example:**
```typescript
// web/vite.config.ts — additive diff on top of the EXISTING file (do not remove
// the @instantdb/svelte alias or the .env.instantdb parsing logic already there)
import tailwindcss from "@tailwindcss/vite"; // NEW import

export default defineConfig({
  plugins: [svelte(), tailwindcss()], // tailwindcss() appended, svelte() untouched
  resolve: {
    alias: {
      "@instantdb/svelte": instantdbSveltePath, // UNCHANGED
      $lib: fileURLToPath(new URL("./src/lib", import.meta.url)), // NEW — shadcn-svelte's default alias
    },
  },
  define: { /* UNCHANGED */ },
});
```
[VERIFIED: `npm view @tailwindcss/vite peerDependencies` → `{ vite: '^5.2.0 || ^6 || ^7 || ^8' }`, satisfied by this project's `vite@8.2.1`]

### Pattern 2: Fully non-interactive `shadcn-svelte init`
**What:** Every CLI prompt in `init` can be pre-answered via a flag, making the command runnable unattended (required by this milestone's autonomous execution — no human is present to answer interactive `@clack/prompts` selects).
**When to use:** Any GSD-autonomous phase that needs to run `shadcn-svelte init`.
**Example:**
```bash
cd web
bunx shadcn-svelte@latest init \
  --preset b0 \
  --css src/app.css \
  --lib-alias '$lib' \
  --components-alias '$lib/components' \
  --ui-alias '$lib/components/ui' \
  --utils-alias '$lib/utils' \
  --hooks-alias '$lib/hooks'
```
[VERIFIED: `github.com/huntabyte/shadcn-svelte`, `packages/cli/src/commands/init/index.ts` (read this session) — `promptForConfig` only prompts for (a) tsconfig path if `detectConfigs` can't find one [not applicable — `tsconfig.json` already exists], (b) the design-system preset via `promptForPreset()` if `--preset` is absent, (c) the CSS path if `--css` is absent, (d) each alias individually if its `--*-alias` flag is absent (`promptAlias()` in `packages/cli/src/utils/config/utils.ts`, read this session: `let path = options[\`${alias}Alias\`]; if (path === undefined) { ...prompt... }`). Supplying all of the above eliminates every prompt.]

**Where `--preset b0` comes from:** [VERIFIED: `packages/cli/src/preset/preset.ts`, read this session] `DEFAULT_PRESET_CONFIG` is built from index-0 of every preset field's value array (`PRESET_STYLES[0] = "nova"`, `PRESET_BASE_COLOR_KEYS[0] = "neutral"`, `PRESET_ICON_LIBRARIES` from `keys(iconLibraries)`, and `lucide` is the first key declared in `packages/cli/src/icons/libraries.ts`, read this session — literal source: `export const iconLibraries = { lucide: { name: "lucide", ... }, tabler: ..., hugeicons: ..., phosphor: ..., remixicon: ... }`). `encodePreset({})` merges the empty override onto `DEFAULT_PRESET_CONFIG` and bit-packs it; since every field index is `0`, the packed integer is `0`, and `toBase62(0)` explicitly returns `"0"` (`if (num === 0) return "0";`, read this session) with version prefix `"b"` (`CURRENT_VERSION = "b"`), producing the code `"b0"`. This is a derived-and-checked value, not a copied example — the planner/executor should have the resulting `components.json` read back afterward to confirm `style: "nova"`, `iconLibrary: "lucide"` before trusting it further (cheap file-read verification, not a human checkpoint).

### Pattern 3: Automatic `prefers-color-scheme` dark mode (no toggle, no mode-watcher)
**What:** Rewrite shadcn-svelte's class-based dark mode output into a pure-CSS media-query approach.
**When to use:** Any project where C-11-style "no manual toggle" is locked.
**Example — what `init` actually writes (DO NOT keep as-is):**
```css
/* shadcn-svelte's raw init output — class-based, requires a JS toggle to ever activate */
@custom-variant dark (&:is(.dark *));
:root { --background: oklch(1 0 0); /* ...light tokens... */ }
.dark { --background: oklch(0.129 0.042 264.695); /* ...dark tokens... */ }
```
[CITED: `shadcn-svelte.com/docs/migration/tailwind-v4` + `github.com/huntabyte/shadcn-svelte/issues/2044` "Dark Mode Requires additional app.css on tailwind v4"]

**Required edit to satisfy SETUP-03:**
```css
/* app.css after the required edit — delete the @custom-variant line entirely so
   Tailwind v4's OWN default (prefers-color-scheme-based) dark: variant applies,
   and change the token block from a .dark class selector to a media query */
@import "tailwindcss";
@import "tw-animate-css";
/* no @custom-variant dark line — Tailwind v4 defaults dark: to prefers-color-scheme */

:root { --background: oklch(1 0 0); /* ...light tokens, unchanged from init output... */ }

@media (prefers-color-scheme: dark) {
  :root { --background: oklch(0.129 0.042 264.695); /* ...same dark values init wrote under .dark... */ }
}
```
[VERIFIED via WebFetch of `tailwindcss.com/docs/dark-mode`: "By default this uses the `prefers-color-scheme` CSS media feature... you can also build sites that support toggling dark mode manually by overriding the dark variant." — confirms the override is opt-in, i.e. simply not adding `@custom-variant dark (&:is(.dark *));` restores the default media-query behavior.]

### Anti-Patterns to Avoid
- **Installing `mode-watcher`:** shadcn-svelte's own dark-mode docs (SvelteKit-flavored) recommend `mode-watcher` for toggling. This project's C-11 explicitly forbids a toggle — do not install it, do not add a `<ModeWatcher />` component, do not add any button/dropdown that calls `toggleMode()`/`setMode()`.
- **Running `shadcn-svelte init` before Tailwind is installed:** the CLI's own `preflightInit()` [VERIFIED: `packages/cli/src/commands/init/preflight.ts`, read this session] reads `tailwindcss`/`svelte` from `package.json` and throws `"This CLI version requires Tailwind CSS v4 and Svelte v5 to initialize a project."` if `tailwindcss` isn't already a dependency — order matters, Tailwind must land first.
- **Passing `--base-color` to `init` expecting it to set the color:** [VERIFIED: `packages/cli/src/commands/init/index.ts`, read this session] the top-level `--base-color` CLI option is defined in the schema but is never read inside `promptForConfig` when building `rawConfig.tailwind.baseColor` — that field comes exclusively from `decidedPresets.baseColor` (i.e., from `--preset` or the interactive preset flow). Passing `--base-color slate` silently does nothing on `init` in this CLI version (and `"slate"` isn't even in the valid preset base-color list any more — see Pitfalls).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `class` prop merging with conflict resolution (e.g. a caller passing `class="p-4"` overriding a component's own `p-2`) | A custom string-concatenation `class` merge helper | `cn()` from `src/lib/utils.ts` (`clsx` + `tailwind-merge`), written once by `shadcn-svelte init` | `tailwind-merge` understands Tailwind's own specificity/conflict rules (e.g. `p-4` should replace `p-2`, not just append) — a naive string-join produces both classes and lets CSS source order decide, which is fragile |
| Dark-mode CSS variable duplication per component | Hand-writing `@media (prefers-color-scheme: dark)` overrides inside every future component's `<style>` block | The global token swap in `app.css` (Pattern 3) — components should only ever reference `var(--background)` etc. via Tailwind's `bg-background` utility classes, never hard-code colors | shadcn-svelte's entire design is "components reference semantic tokens, tokens swap once at the root" — hand-rolling per-component dark overrides defeats that and violates C-11's "no bespoke design tokens" |

**Key insight:** Every visual convention this phase establishes (tokens, dark mode, icon set) exists specifically so Phases 8-10 never touch raw colors or write bespoke CSS — hand-rolling anything here breaks that guarantee for every downstream phase.

## Common Pitfalls

### Pitfall 1: Locked-spec terminology ("default style", "slate base color") is stale relative to the current CLI
**What goes wrong:** A plan that literally searches for a shadcn-svelte "default" style or a "slate" base color option in the current CLI will not find either — `init --base-color slate` is silently ignored, and there is no `style: "default"` in the preset system.
**Why it happens:** shadcn-svelte shipped a ground-up CLI redesign (the "design system preset" model — 8 named presets: `nova`, `vega`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`; 7 base-color tones: `neutral`, `stone`, `zinc`, `mauve`, `olive`, `mist`, `taupe`) sometime after the locked C-11/SETUP-02 wording was written, which used the older "default"/"new-york" style + "slate"/"gray"/"zinc"/"neutral"/"stone" base-color vocabulary.
**How to avoid:** Use `--preset b0` (verified zero-config default: style `nova`, base color `neutral`, icon library `lucide`) as the correct current-CLI equivalent of "default style, default base color." See Assumptions Log #A1 — this substitution preserves the *intent* of C-11 (no custom picks) but not the literal words, and should be called out explicitly in the plan's task description so a future reader isn't confused searching for "slate."
**Warning signs:** `shadcn-svelte@latest init --base-color slate` exits with a CLI validation error (`slate` isn't in the current `--base-color` choices list either) or (if some other flag combination is used) silently produces a different base color than expected — read the resulting `components.json` after `init` to confirm.

### Pitfall 2: shadcn-svelte's default dark mode is class-based, not media-query-based
**What goes wrong:** If `app.css` is committed exactly as `init` writes it, dark mode will never activate for any user, ever — because nothing in this project (correctly, per C-11) ever adds a `.dark` class to `<html>`, and the `@custom-variant dark (&:is(.dark *));` line means Tailwind's `dark:` utilities and the `.dark { ... }` token block only apply when that class is present.
**Why it happens:** shadcn-svelte's dark-mode story is designed around `mode-watcher` toggling a class; it does not ship a `prefers-color-scheme`-only mode out of the box.
**How to avoid:** Apply the Pattern 3 edit — delete the `@custom-variant dark` line and convert `.dark { ... }` to `@media (prefers-color-scheme: dark) { :root { ... } }`.
**Warning signs:** A Playwright check using `page.emulateMedia({ colorScheme: 'dark' })` shows no change in `getComputedStyle(document.documentElement).getPropertyValue('--background')` — this is exactly what Phase 7's Success Criterion 3 is designed to catch.

### Pitfall 3: Biome lints and formats shadcn-svelte's generated component files
**What goes wrong:** Any component later added via `shadcn-svelte add <name>` lands under `web/src/lib/components/ui/**/*.svelte` and `web/src/lib/utils.ts`, both of which fall inside this repo's Biome `files.includes` globs — `"web/src/**/*.ts"` and `"web/src/**/*.svelte"` [VERIFIED: `/home/thomaz/pessoal/apollo-v2/biome.json:11-12`, quoted verbatim: `"web/src/**/*.ts", "web/src/**/*.svelte"`]. There is no exclusion carve-out for a `components/ui` subtree in this config. Generated code from an upstream registry is not guaranteed to satisfy Biome's `recommended` rule set (community reports of type errors like `'string | ClassArray | ...' is not assignable to type 'ClassNameValue'` in generated Button/Carousel components, and a Biome `useFocusableInteractive`/a11y conflict reported against the sibling React shadcn/ui project's generated markup).
**Why it happens:** shadcn-svelte's registry targets ESLint/Prettier-shaped projects by convention; Biome parity isn't guaranteed for every generated file, and this repo's `QUAL-01` requires zero new suppressions.
**How to avoid:** Phase 7 itself only writes `components.json` + `src/lib/utils.ts` (no `ui/` components added yet — see ROADMAP Phase 7 scope), so the blast radius this phase is small: run `bun run lint` (Biome) and `bun run check` (svelte-check) immediately after `init` and fix or format any finding on `utils.ts` before considering the phase done. Flag this pitfall forward for Phases 8-10, which DO run `add <component>` and will need the same check-after-every-add discipline.
**Warning signs:** `bun run lint` reports errors on `src/lib/utils.ts` right after `init`, or `bun run check` reports type errors — both must be zero before Phase 7's done-criteria is met (QUAL-01 applies project-wide, not just to phases 8-11).

### Pitfall 4: `bunx --bun shadcn-svelte@latest init` can behave differently than plain `bunx`
**What goes wrong:** Community reports show `bunx --bun <cli>@latest init`-style invocations for the sibling React `shadcn` CLI failing in ways plain `bunx <cli>@latest init` does not (package-manager auto-detection picking npm instead of bun, creating a stray `package-lock.json` alongside `bun.lock`).
**Why it happens:** Package-manager auto-detection in these CLIs inspects lockfiles/environment heuristically and doesn't always resolve to Bun correctly under the `--bun` runtime-forcing flag.
**How to avoid:** Invoke as `bunx shadcn-svelte@latest init ...` (no `--bun` flag) from inside `web/` (where `bun.lock` lives), matching this repo's existing `package.json` scripts convention (none of which use `--bun`).
**Warning signs:** A `package-lock.json` file appears in `web/` after running `init` — delete it and re-run with plain `bunx` if so; verify `git status` shows no new lockfile before committing.

## Code Examples

### Tailwind v4 + Vite wiring (SETUP-01)
```bash
cd web
bun add -D tailwindcss @tailwindcss/vite
```
```typescript
// web/vite.config.ts — full file after the additive edit (existing lines marked UNCHANGED)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte"; // UNCHANGED
import tailwindcss from "@tailwindcss/vite"; // NEW
import { parse } from "dotenv"; // UNCHANGED
import { defineConfig } from "vite"; // UNCHANGED

const instantdbSveltePath = fileURLToPath(
  new URL("./node_modules/@instantdb/svelte", import.meta.url),
); // UNCHANGED — do not remove, shared/*.ts imports depend on this alias

const envPath = fileURLToPath(new URL("../.env.instantdb", import.meta.url)); // UNCHANGED
const parsed = parse(readFileSync(envPath)); // UNCHANGED
const appId = parsed.NEXT_PUBLIC_INSTANT_APP_ID ?? parsed.INSTANT_APP_ID; // UNCHANGED
if (!appId) { throw new Error(`Missing InstantDB app id...`); } // UNCHANGED

export default defineConfig({
  plugins: [svelte(), tailwindcss()], // MODIFIED — tailwindcss() appended
  resolve: {
    alias: {
      "@instantdb/svelte": instantdbSveltePath, // UNCHANGED
      $lib: fileURLToPath(new URL("./src/lib", import.meta.url)), // NEW
    },
  },
  define: {
    "import.meta.env.VITE_INSTANT_APP_ID": JSON.stringify(appId), // UNCHANGED
  },
});
```
```json
// web/tsconfig.json — additive edit (existing "files"/"references" untouched)
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "$lib": ["./src/lib"], "$lib/*": ["./src/lib/*"] }
  }
}
```
```json
// web/tsconfig.app.json — additive edit (existing "paths" entry for @instantdb/svelte kept)
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "module": "esnext",
    "types": ["svelte", "vite/client", "bun-types"],
    "allowArbitraryExtensions": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "moduleDetection": "force",
    "baseUrl": ".",
    "paths": {
      "@instantdb/svelte": ["./node_modules/@instantdb/svelte"],
      "$lib": ["./src/lib"],
      "$lib/*": ["./src/lib/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "../shared/*.ts"]
}
```
[VERIFIED: `/home/thomaz/pessoal/apollo-v2/web/tsconfig.app.json` and `/home/thomaz/pessoal/apollo-v2/web/vite.config.ts` read in full this session — every "UNCHANGED" line above is quoted verbatim from those files]

### Non-interactive shadcn-svelte init (SETUP-02)
```bash
cd web
bunx shadcn-svelte@latest init \
  --preset b0 \
  --css src/app.css \
  --lib-alias '$lib' \
  --components-alias '$lib/components' \
  --ui-alias '$lib/components/ui' \
  --utils-alias '$lib/utils' \
  --hooks-alias '$lib/hooks'
git status web/components.json web/src/lib/utils.ts web/src/app.css  # confirm expected new files
```

### Playwright proof of Tailwind preflight (Success Criterion 1)
```typescript
// Proves Preflight ran, not just that a config file exists.
// App.svelte already renders <h1>Apollo v2</h1> unconditionally — before Tailwind,
// browsers give <h1> a large bold font distinct from body text; Preflight
// unstyles all headings to match body text exactly.
test("Tailwind preflight resets heading + body styles", async ({ page }) => {
  await page.goto("/");
  const h1 = page.locator("h1", { hasText: "Apollo v2" });
  const [h1Font, bodyFont] = await Promise.all([
    h1.evaluate((el) => getComputedStyle(el).fontSize),
    page.evaluate(() => getComputedStyle(document.body).fontSize),
  ]);
  expect(h1Font).toBe(bodyFont); // Preflight removes the browser's default h1 font-size boost
  const h1Weight = await h1.evaluate((el) => getComputedStyle(el).fontWeight);
  expect(h1Weight).toBe("400"); // not browser-default "bold"/"700"
  const bodyMargin = await page.evaluate(() => getComputedStyle(document.body).marginTop);
  expect(bodyMargin).toBe("0px");
});
```
[VERIFIED via WebFetch of `tailwindcss.com/docs/preflight`: "Preflight removes all of the default margins from all elements including headings..." and "All heading elements are completely unstyled by default, and have the same font size and weight as normal text."]

### Playwright proof of shadcn-svelte tokens + dark mode (Success Criteria 2-3)
```typescript
const TOKENS = ["--background", "--foreground", "--primary"] as const;

test("shadcn-svelte tokens are present and swap with prefers-color-scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const light = await page.evaluate((tokens) => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(tokens.map((t) => [t, cs.getPropertyValue(t).trim()]));
  }, TOKENS);
  for (const t of TOKENS) expect(light[t]).not.toBe("");

  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await page.evaluate((tokens) => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(tokens.map((t) => [t, cs.getPropertyValue(t).trim()]));
  }, TOKENS);
  for (const t of TOKENS) expect(dark[t]).not.toBe(light[t]); // token values changed
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false); // no class toggle ever used
});
```
[VERIFIED: Playwright `page.emulateMedia({ colorScheme })` signature and behavior confirmed via WebFetch of `playwright.dev/docs/api/class-page#page-emulate-media` this session, quoted: `await page.emulateMedia({ colorScheme: 'dark' }); await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches); // → true`]

### Playwright proof of clean boot (Success Criterion 4)
```typescript
test("app boots with zero console errors after the Tailwind/shadcn swap", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/");
  await expect(page.getByTestId("login-screen")).toBeVisible();
  expect(errors).toEqual([]);
});
```
[Existing convention — `data-testid="login-screen"` pattern matches `web/e2e/auth.setup.ts` (read this session), which already asserts `page.getByTestId("login-screen")`]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Tailwind v3 + `tailwind.config.js` + PostCSS + `autoprefixer` | Tailwind v4 + CSS-native `@import "tailwindcss"` + `@tailwindcss/vite`, zero PostCSS config | Tailwind v4 GA (2025) | No `tailwind.config.ts` file to write or maintain in this phase at all |
| `tailwindcss-animate` (Tailwind v3 plugin) | `tw-animate-css` (plain CSS import, v4-compatible) | shadcn-svelte's Tailwind v4 migration | Different package name — do not install the old one, it's incompatible with v4's plugin architecture |
| shadcn-svelte "style" = `default` \| `new-york`, "baseColor" = `slate`\|`gray`\|`zinc`\|`neutral`\|`stone` | shadcn-svelte "style" = one of 8 named design-system presets (`nova`/`vega`/`maia`/`lyra`/`mira`/`luma`/`sera`/`rhea`), "baseColor" = one of 7 tones (`neutral`/`stone`/`zinc`/`mauve`/`olive`/`mist`/`taupe`) | Sometime before `shadcn-svelte@1.5.0` (current) | Directly affects SETUP-02's literal wording — see Pitfall 1 and Assumptions Log #A1 |
| `lucide-svelte` (unscoped) | `@lucide/svelte` (scoped, Svelte-5-only) | Lucide's monorepo split for Svelte 5 | Confirmed as the package shadcn-svelte's own `iconLibraries.lucide` config references |
| `mode-watcher` + `.dark` class toggle (SvelteKit-documented pattern) | Not used in this project — `prefers-color-scheme` media query only | N/A — project-specific constraint (C-11), not an upstream deprecation | See Pattern 3 |

**Deprecated/outdated:**
- `tailwind.config.ts`/`.js`: not used at all in Tailwind v4's Vite-plugin flow — all configuration lives in CSS (`@theme`, `@import`).
- `--overwrite` flag on `shadcn-svelte init`: deprecated in favor of `--reinstall` [VERIFIED: `packages/cli/src/commands/init/index.ts`, read this session: `.addOption(new Option("-o, --overwrite", "deprecated: use --reinstall")...)`] — not needed for a first-time `init` on a project with no prior `components.json`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The current CLI's zero-config default (`--preset b0`: style `nova`, base color `neutral`, icon library `lucide`) is the correct present-day equivalent of REQUIREMENTS.md SETUP-02's "default style, default/slate base color" and PROJECT.md C-11's "default style/baseColor" | Summary, Pitfall 1, Pattern 2 | Low-medium — visually this only changes exact token hex/oklch values (all still shadcn-svelte-authored, no custom palette), so it does not violate C-11's actual prohibition ("no custom color palette, no bespoke design tokens"). Risk is purely that a human reviewer expects the literal word "slate" somewhere and doesn't find it; worth a one-line note in the plan or a quick user confirmation before Phase 7 executes, since C-11 is explicitly locked/"do not reopen" and this is the closest-available reading of it rather than a literal match |
| A2 | `@lucide/svelte` (not `lucide-svelte`) is the correct current package for Svelte 5 | Standard Stack, State of the Art | Low — corroborated by shadcn-svelte's own CLI source (`packages: ["@lucide/svelte"]` under the `lucide` icon library, read this session) even though the Svelte-5-vs-Svelte-4 split narrative itself came from WebSearch, not an official doc page fetched directly |
| A3 | shadcn-svelte's `add` command (not run in Phase 7, but referenced in Pitfall 3 for forward-planning) will install `bits-ui` as an automatic dependency the first time a component is added | Don't Hand-Roll, Standard Stack | Low — not load-bearing for Phase 7's own success criteria (Phase 7 only runs `init`), informational for Phase 8+ planning only |

## Open Questions

1. **Should the plan explicitly ask the user to confirm the `--preset b0` interpretation of "default/slate" before executing, given C-11 says "do not reopen"?**
   - What we know: The literal terms in the locked spec don't exist in the current tool; the closest-available, zero-customization reading is `--preset b0`.
   - What's unclear: Whether "do not reopen" was written anticipating this kind of terminology drift, or whether the user would want a heads-up given how explicit REQUIREMENTS.md is about "slate" specifically.
   - Recommendation: Proceed with `--preset b0` (it fully satisfies C-11's substantive prohibition on customization) but have the plan's task description say explicitly "using shadcn-svelte's current zero-config default (style=nova/base=neutral), since 'default'/'slate' no longer exist in the CLI" so this is visible/traceable in the commit history rather than silently substituted.

2. **Exact oklch values shadcn-svelte's registry will emit for base color `neutral` at `init` time.**
   - What we know: The CSS custom property *names* are stable (`--background`, `--foreground`, `--primary`, `--card`, `--popover`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`) regardless of which base color/preset is chosen — this is what Phase 7's Playwright checks assert on (names + non-empty values + value-changes-under-dark), not literal color numbers.
   - What's unclear: The exact oklch numbers are generated server-side by the shadcn-svelte registry API at `init` time (not baked into the CLI's own source, which I read directly) — I could not fetch them without actually running `init` against the live registry.
   - Recommendation: Non-blocking — the plan's verification tasks should assert on property *names* and *value presence/difference*, never on hard-coded color numbers, which is already what the Code Examples above do.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | Sole JS/TS executor (C-08) — running `bunx shadcn-svelte@latest init`, `bun add`, `bun run dev` | ✓ | 1.3.12 | — |
| `node` | Some tooling underneath Vite/Playwright shells out to Node | ✓ | v20.20.2 | — |
| Playwright Chromium browser | Phase 7's success criteria are Playwright-only (C-12) | ✓ | `chromium-1234` present in `~/.cache/ms-playwright` (Playwright package `1.62.1`, matches `web/package.json`) | — |
| `@tailwindcss/vite` peer `vite` range | Tailwind v4 Vite plugin | ✓ | project has `vite@8.2.1`, plugin requires `^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8` [VERIFIED: `npm view @tailwindcss/vite peerDependencies`] | — |
| `bits-ui` peer `svelte` range | Transitively needed once any component is `add`-ed (not this phase) | ✓ | project has `svelte@5.56.8`, `bits-ui@2.18.1` requires `^5.33.0` [VERIFIED: `npm view bits-ui peerDependencies`] | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — environment is fully provisioned for this phase.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test` `1.62.1` [VERIFIED: `web/package.json` devDependency + `npx playwright --version` this session] |
| Config file | `web/playwright.config.ts` (read this session — `authed`/`setup`/`anon` projects, `baseURL: http://localhost:5174`, `webServer` auto-starts `bun run dev -- --port 5174 --strictPort`) |
| Quick run command | `cd web && bunx playwright test e2e/design-system.spec.ts` (new spec file this phase adds) |
| Full suite command | `cd web && bun run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| SETUP-01 | Tailwind preflight visibly resets `<h1>`/body styles | e2e (Playwright, `anon` or new project — no auth needed, this is pre-login DOM) | `bunx playwright test e2e/design-system.spec.ts -g "preflight"` | ❌ Wave 0 — new spec file |
| SETUP-02 | `components.json` committed at repo path shadcn-svelte expects; CSS custom properties present with non-empty values | e2e (Playwright) + tooling (file existence check) | `bunx playwright test e2e/design-system.spec.ts -g "tokens"` + `test -f web/components.json` | ❌ Wave 0 |
| SETUP-03 | Dark tokens swap under `page.emulateMedia({ colorScheme: 'dark' })`, no `.dark` class ever applied | e2e (Playwright) | `bunx playwright test e2e/design-system.spec.ts -g "dark mode"` | ❌ Wave 0 |
| (all) | Zero console errors on boot, existing `login-screen` testid still renders | e2e (Playwright, reuses existing `data-testid` convention) | `bunx playwright test e2e/design-system.spec.ts -g "boots"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd web && bunx playwright test e2e/design-system.spec.ts` (new spec, ~4 short assertions, runs in seconds)
- **Per wave merge:** `cd web && bun run test:e2e` (full existing suite — this phase must not break `auth.setup.ts`/entity specs, since it touches nothing but `app.css`/`vite.config.ts`/`components.json`)
- **Phase gate:** Full suite green (`bun run test:e2e`) + `bun run check` (svelte-check/tsc) + `bun run lint` (Biome) all clean before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `web/e2e/design-system.spec.ts` — new file, covers SETUP-01/02/03 per the Code Examples above
- [ ] No new fixtures/conftest-equivalent needed — this spec needs no auth (`anon`-style, pre-login DOM is enough for all four assertions) and can run standalone or inside the existing `authed` project without depending on the login flow

*(Framework itself is already installed and configured — `@playwright/test` is a `web/package.json` devDependency and `playwright.config.ts` already exists; no install step needed.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Phase 7 touches no auth code (`LoginScreen.svelte` untouched until Phase 8) |
| V3 Session Management | No | Untouched this phase |
| V4 Access Control | No | Untouched this phase |
| V5 Input Validation | No | Phase 7 adds zero new user input surfaces — it's a build-tooling/styling-foundation phase |
| V6 Cryptography | No | Not applicable |
| V14 Configuration (supply chain) | Yes | Package Legitimacy Audit above is the standard control — every new dependency verified against the npm registry with download-count + repo-provenance evidence, no unvetted `postinstall` scripts (`npm view <pkg> scripts.postinstall` returned `null` for all packages checked) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malicious/typosquatted npm package injected via a CLI-driven `bunx`/`bun add` install | Tampering | Package Legitimacy Audit (this document) + always running `bunx <pkg>@latest` with the exact, hand-verified package name — never a name suggested only by training memory |
| A `vite.config.ts` codemod tool (e.g. `sv add`) silently overwriting the existing `.env.instantdb`-parsing security boundary (already documented internally as mitigating threat T-01-02 — keeping `INSTANT_APP_ADMIN_TOKEN` out of the browser bundle) | Tampering / Information Disclosure | Manual, line-by-line `vite.config.ts` edits only (Pattern 1) — never run an automated codemod against this file |

## Sources

### Primary (HIGH confidence)
- `github.com/huntabyte/shadcn-svelte` (`main` branch, matches published `1.5.0`) — read directly this session: `packages/cli/src/commands/init/index.ts`, `packages/cli/src/commands/init/preflight.ts`, `packages/cli/src/preset/preset.ts`, `packages/cli/src/preset/presets.ts`, `packages/cli/src/preset/index.ts`, `packages/cli/src/icons/libraries.ts`, `packages/cli/src/utils/config/schema.ts`, `packages/cli/src/utils/config/utils.ts`
- `npm view <pkg> version|peerDependencies|dependencies|scripts.postinstall` for `tailwindcss`, `@tailwindcss/vite`, `shadcn-svelte`, `bits-ui`, `@lucide/svelte`, `clsx`, `tailwind-merge`, `tw-animate-css` — live registry queries this session
- Local repo files read in full this session: `web/vite.config.ts`, `web/tsconfig.json`, `web/tsconfig.app.json`, `web/package.json`, `web/playwright.config.ts`, `web/src/app.css`, `web/src/App.svelte`, `web/src/lib/Shell.svelte`, `web/e2e/auth.setup.ts`, `biome.json`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/07-design-system-setup/07-CONTEXT.md`
- `tailwindcss.com/docs/installation/using-vite`, `tailwindcss.com/docs/preflight`, `tailwindcss.com/docs/dark-mode` — fetched directly this session
- `playwright.dev/docs/api/class-page#page-emulate-media` — fetched directly this session

### Secondary (MEDIUM confidence)
- `shadcn-svelte.com/docs/installation/vite`, `shadcn-svelte.com/docs/installation/manual`, `shadcn-svelte.com/docs/theming`, `shadcn-svelte.com/docs/dark-mode/svelte`, `shadcn-svelte.com/docs/cli` — fetched via WebFetch this session; some of these pages describe the OLDER "default/new-york" style + SvelteKit-flavored dark-mode docs, superseded in this document by the directly-read CLI source for anything that conflicted

### Tertiary (LOW confidence)
- WebSearch results on `@lucide/svelte` vs `lucide-svelte` package naming (corroborated against source-verified `iconLibraries` config, so treated as effectively confirmed — see Assumptions Log #A2)
- WebSearch results on Biome + shadcn-svelte generated-component lint friction and Bun/CLI package-manager-detection quirks (community GitHub issues, not officially documented — flagged as Pitfalls to watch for, not asserted as certain)

## Metadata

**Confidence breakdown:**
- Standard stack (package names/versions): HIGH — every version live-verified against npm registry this session
- shadcn-svelte CLI mechanics (init flags, preset encoding, dark-mode default): HIGH — read directly from the exact source matching the published version, cross-checked by deriving the `b0` preset code from the algorithm rather than assuming it
- Terminology mapping ("default"/"slate" → current preset system): MEDIUM — substantively correct but explicitly flagged as an interpretive assumption (A1) since it touches a locked constraint's literal wording
- Playwright verification patterns: HIGH — Playwright API confirmed via official docs, testid conventions matched against this repo's existing `e2e/auth.setup.ts`
- Biome/svelte-check interaction pitfalls: MEDIUM — real community-reported issues, not something reproduced first-hand in this repo yet (no components have been `add`-ed)

**Research date:** 2026-08-09
**Valid until:** 7 days (this stack — Tailwind v4, `@tailwindcss/vite`, and especially `shadcn-svelte`'s CLI — is releasing new versions every few days per the registry timestamps checked this session; re-verify package versions and CLI flag names if execution slips more than a week past this research date)
