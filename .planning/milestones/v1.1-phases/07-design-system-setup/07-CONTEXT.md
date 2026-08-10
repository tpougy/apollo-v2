# Phase 7: Design System Setup - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

`web/` has Tailwind v4 and shadcn-svelte initialized with default style/tokens, giving every later phase a component library and automatic dark mode to build on — no screen is restyled yet, but the foundation is live and provably wired.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Locked constraints from PROJECT.md (do not reopen)
- C-11: Tailwind CSS + shadcn-svelte, default style/baseColor, default theme tokens only — no custom color palette, no bespoke design tokens beyond the shadcn-svelte init output. Icon library `@lucide/svelte`. Dark mode via `prefers-color-scheme`, no toggle.
- C-12: This milestone runs fully unattended — every phase is verified via real Playwright e2e runs against the live InstantDB app, never via a human UAT checkpoint. Plans for this phase MUST use `<verify><automated>` Playwright/tooling checks exclusively — never emit `<verify><human-check>` blocks or `checkpoint:human-verify` tasks.
- C-08: `bun` is the sole JS/TS executor; frontend logic is always `.ts`/`.svelte` with `<script lang="ts">`; Biome + `svelte-check` must stay clean.

</decisions>

<code_context>
## Existing Code Insights

- `web/` currently has NO Tailwind/shadcn-svelte — only a plain `src/app.css` box-sizing + font-family reset.
- Existing source files (untouched in this phase): `src/App.svelte`, `src/lib/Shell.svelte`, `src/lib/auth/LoginScreen.svelte`, `src/lib/entities/EntityScreen.svelte`.
- `web/package.json` scripts: `dev` (vite --port 5174 via playwright.config.ts webServer), `test:e2e` (playwright), `check` (svelte-check + tsc), `lint`/`lint:fix` (biome, run from repo root over `shared web/src ...`).
- Existing e2e suite lives in `web/e2e/` with a `setup` project (`auth.setup.ts`) producing storageState reused by an `authed` project — Phase 7 must not break this baseline; a smoke boot check is expected.
- Codebase context will be further gathered during plan-phase research (Tailwind v4 + shadcn-svelte install/init steps, `@tailwindcss/vite` wiring, `components.json` shape).

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond REQUIREMENTS.md SETUP-01/02/03 and ROADMAP.md Phase 7 success criteria. Refer to those and to PROJECT.md constraints C-11/C-12/C-08.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
