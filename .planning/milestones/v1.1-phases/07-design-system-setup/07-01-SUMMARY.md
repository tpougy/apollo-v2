---
phase: 07-design-system-setup
plan: 01
subsystem: ui
tags: [tailwindcss, tailwindcss-v4, shadcn-svelte, vite, dark-mode, prefers-color-scheme, playwright, biome, svelte-check]

# Dependency graph
requires:
  - phase: 01-06 (v1.0)
    provides: "web/ pure Svelte 5 + Vite SPA with a hand-written vite.config.ts (@instantdb/svelte alias, .env.instantdb parsing), working Playwright e2e suite (setup/authed/anon projects)"
provides:
  - "Tailwind v4 wired via @tailwindcss/vite, replacing the plain app.css reset"
  - "shadcn-svelte initialized (style nova, base color neutral, icon lucide) with components.json committed"
  - "$lib alias resolvable in Vite build, tsc, and svelte-check, alongside the untouched @instantdb/svelte alias"
  - "cn() helper at src/lib/utils.ts for every future shadcn-svelte component"
  - "Dark mode via bare prefers-color-scheme media query, zero class toggle, zero JS mode-watcher"
  - "web/e2e/design-system.spec.ts — 4 auth-free Playwright tests proving all 4 ROADMAP Phase 7 success criteria"
affects: [08-auth-shell-restyle, 09-entity-table-restyle, 10-entity-form-feedback-restyle, 11-full-verification]

# Actuals (#2632)
actuals:
  tokens: 8582
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: [tailwindcss@4.3.3, "@tailwindcss/vite@4.3.3", "shadcn-svelte@1.5.0 (CLI, devDependency)", "@lucide/svelte@1.31.0", clsx@2.1.1, tailwind-merge@3.6.0, tw-animate-css@1.4.0, "@fontsource-variable/inter@5.3.0", "tailwind-variants@3.3.1 (installed by shadcn-svelte init, unused this phase)"]
  patterns: ["Manual additive vite.config.ts edits instead of a codemod, to protect the .env.instantdb-parsing security boundary", "Non-interactive shadcn-svelte init via --preset flag for unattended execution", "Global CSS token swap under @media (prefers-color-scheme: dark) instead of a class-based toggle"]

key-files:
  created:
    - web/components.json
    - web/src/lib/utils.ts
    - web/e2e/design-system.spec.ts
  modified:
    - web/vite.config.ts
    - web/src/app.css
    - web/tsconfig.json
    - web/tsconfig.app.json
    - web/tsconfig.e2e.json
    - web/playwright.config.ts
    - web/package.json
    - web/bun.lock
    - web/e2e/entities-projeto-etapa-tarefa.spec.ts
    - web/e2e/entities-rotina-log.spec.ts
    - web/e2e/entities-ticket-subtarefa.spec.ts

key-decisions:
  - "Wired the $lib alias into vite.config.ts/tsconfig.json/tsconfig.app.json BEFORE running shadcn-svelte init, reversing the plan's stated task-internal order — the installed CLI's preflightInit() now also validates that declared aliases already resolve in tsconfig, not just that tailwindcss is a dependency (a stricter check than 07-RESEARCH.md's session had verified)."
  - "Added `lib: [\"ES2023\", \"DOM\"]` to tsconfig.e2e.json so design-system.spec.ts's page.evaluate() callbacks referencing document/getComputedStyle type-check — a necessary, non-optional addition since no prior e2e spec referenced bare DOM globals."
  - "Fixed 3 pre-existing evaluateAll() casts (entities-projeto-etapa-tarefa.spec.ts, entities-rotina-log.spec.ts, entities-ticket-subtarefa.spec.ts) from `(opts as { value: string }[])` to `(opts as unknown as { value: string }[])` — adding the DOM lib made TypeScript resolve Element to a real SVGElement|HTMLElement union for the first time, which the original single-step cast no longer satisfied. TypeScript's own error message recommended the two-step cast; applied verbatim, no behavior change."
  - "Replaced `any` with `unknown` in the two CLI-generated WithoutChild/WithoutChildren conditional types in utils.ts and dropped their dead `// eslint-disable-next-line` comments (Biome, not ESLint, is this project's linter — the comments did nothing). `unknown` is structurally equivalent to `any` in this optional-property-presence-check position, so no type-narrowing behavior changed; this kept `bun run lint` at zero new suppressions, matching Pitfall 3's guidance to fix generated code rather than suppress."
  - "Confirmed all package versions resolved exactly at the versions 07-RESEARCH.md verified 0 days prior: tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, shadcn-svelte 1.5.0, @lucide/svelte 1.31.0, clsx 2.1.1, tailwind-merge 3.6.0, tw-animate-css 1.4.0 — no drift to account for."
  - "shadcn-svelte's nova preset also installed @fontsource-variable/inter (custom font import) and tailwind-variants (unused this phase, already vetted in 07-RESEARCH.md's Package Legitimacy Audit as a false-positive SUS verdict) as part of its own dependency graph — left as-is per C-11's 'no bespoke design tokens beyond the shadcn-svelte init output' since both are the CLI's own zero-config output, not a hand-picked addition."

patterns-established:
  - "Additive-only vite.config.ts/tsconfig.*.json edits: every new alias/plugin appended alongside existing InstantDB wiring, never replacing or codemod-ing the file."
  - "Any future e2e spec needing pre-login DOM/CSS assertions routes through the anon Playwright project's broadened testMatch, never through authed's live magic-code setup dependency."
  - "Dark-mode tokens live exclusively under a single @media (prefers-color-scheme: dark) block wrapping :root — components only ever reference var(--background) etc. via Tailwind utility classes, never hard-coded colors or a second override layer."

requirements-completed: [SETUP-01, SETUP-02, SETUP-03]

coverage:
  - id: D1
    description: "Tailwind v4 installed and wired via @tailwindcss/vite, replacing the plain app.css reset — Preflight provably resets heading/body styles"
    requirement: "SETUP-01"
    verification:
      - kind: e2e
        ref: "web/e2e/design-system.spec.ts#Tailwind preflight resets heading and body styles"
        status: pass
    human_judgment: false
  - id: D2
    description: "shadcn-svelte initialized via its own zero-config CLI default (style nova, base color neutral, icon lucide), components.json committed, design tokens present and non-empty"
    requirement: "SETUP-02"
    verification:
      - kind: e2e
        ref: "web/e2e/design-system.spec.ts#shadcn-svelte design tokens are present and swap under prefers-color-scheme"
        status: pass
      - kind: other
        ref: "test -f web/components.json && grep '\"style\": \"nova\"' && grep '\"iconLibrary\": \"lucide\"' components.json"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dark mode follows prefers-color-scheme automatically with zero class-based toggle and zero mode-watcher JS anywhere in the DOM"
    requirement: "SETUP-03"
    verification:
      - kind: e2e
        ref: "web/e2e/design-system.spec.ts#dark mode never applies a .dark class under either color scheme"
        status: pass
    human_judgment: false
  - id: D4
    description: "The app still boots to the login screen with zero console/page errors after the full Tailwind-plus-shadcn-svelte wiring, and the pre-existing no-leakage guarantee still holds"
    verification:
      - kind: e2e
        ref: "web/e2e/design-system.spec.ts#app boots to the login screen with zero console or page errors"
        status: pass
      - kind: e2e
        ref: "web/e2e/no-leakage.spec.ts#unauthenticated load shows only the login screen with zero entity data"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-09
status: complete
---

# Phase 7 Plan 1: Design System Setup Summary

**Tailwind v4 + shadcn-svelte (`nova`/`neutral`/`lucide` zero-config preset) wired into `web/`, with class-based dark mode hand-converted to a bare `prefers-color-scheme` media query and all four ROADMAP Phase 7 success criteria proven live in Chromium via a new auth-free Playwright spec.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-09T21:53:55Z
- **Completed:** 2026-08-09T22:01:28Z (drafting SUMMARY)
- **Tasks:** 3/3 completed
- **Files modified:** 14 (11 modified, 3 created — see Files Created/Modified)

## Accomplishments
- Tailwind CSS v4 (`4.3.3`) + `@tailwindcss/vite` (`4.3.3`) installed via `bun add -D` and wired additively into `vite.config.ts`'s existing `plugins` array, leaving the `.env.instantdb`-parsing block and `@instantdb/svelte` alias byte-identical.
- `web/src/app.css`'s two-rule hand-written reset replaced by a single `@import "tailwindcss";`, then extended by `shadcn-svelte@1.5.0 init --preset b0` into the full `nova` token set (`--background`, `--foreground`, `--primary`, etc.) plus `tw-animate-css` and `@fontsource-variable/inter` imports.
- `web/components.json` committed, recording `style: "nova"`, `baseColor: "neutral"`, `iconLibrary: "lucide"` — the CLI's own zero-configuration default, matching PROJECT.md C-11's resolved intent.
- `$lib` alias wired into `vite.config.ts` (`resolve.alias`), `tsconfig.json`, and `tsconfig.app.json` (`compilerOptions.paths`), resolving at both build time and type-check time alongside the untouched `@instantdb/svelte` entries.
- `web/src/app.css`'s dark-mode block hand-converted: the class-scoped `@custom-variant dark (&:is(.dark *));` line deleted, and the `.dark { ... }` token block rewritten as `@media (prefers-color-scheme: dark) { :root { ... } }` — every custom-property name/value left byte-identical to what `init` generated, only the selector/scoping mechanism changed. No `mode-watcher` or any JS-driven toggle installed anywhere.
- `web/e2e/design-system.spec.ts` created with 4 tests (`preflight`, `boots`, `tokens`, `dark mode`), all routed through the `anon` Playwright project (`playwright.config.ts`'s `testMatch`/`testIgnore` regexes broadened) — zero dependency on the live magic-code round trip.
- Full auth-free regression (`design-system.spec.ts` + `no-leakage.spec.ts`, 5 tests) plus `bun run check` and `bun run lint` all pass with zero errors/warnings introduced and no stray `package-lock.json`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Tailwind v4 into the Vite build and prove Preflight end-to-end** - `4482118` (feat)
2. **Task 2: Initialize shadcn-svelte, wire the $lib alias, convert dark mode to prefers-color-scheme** - `ac23bd0` (feat)
3. **Task 3: Run the full auth-free regression plus static quality gates** - no commit (verification-only task; produced no file changes — all four `design-system.spec.ts` tests + `no-leakage.spec.ts` + `bun run check` + `bun run lint` re-verified green against Task 1/2's committed state)

**Plan metadata:** pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates, committed next)

## Files Created/Modified
- `web/components.json` - shadcn-svelte CLI config: style `nova`, base color `neutral`, icon library `lucide`, `$lib`-rooted aliases
- `web/src/lib/utils.ts` - `cn()` className-merge helper (clsx + tailwind-merge), CLI-generated
- `web/e2e/design-system.spec.ts` - 4 Playwright tests proving all 4 ROADMAP Phase 7 success criteria, auth-free
- `web/vite.config.ts` - `tailwindcss()` plugin + `$lib` alias, additive alongside `@instantdb/svelte`
- `web/src/app.css` - Tailwind import + shadcn-svelte design tokens + `prefers-color-scheme` dark mode (no class toggle)
- `web/tsconfig.json` - `baseUrl` + `$lib`/`$lib/*` path entries (new `compilerOptions` block)
- `web/tsconfig.app.json` - `$lib`/`$lib/*` path entries added into the existing `paths` object alongside `@instantdb/svelte`
- `web/tsconfig.e2e.json` - `lib: ["ES2023", "DOM"]` added so `document`/`getComputedStyle` resolve in `page.evaluate()` callbacks
- `web/playwright.config.ts` - `anon` project's `testMatch` broadened to include `design-system.spec.ts`; `authed`'s `testIgnore` broadened to exclude it
- `web/package.json` / `web/bun.lock` - `tailwindcss`, `@tailwindcss/vite`, `shadcn-svelte`, `@lucide/svelte`, `clsx`, `tailwind-merge`, `tw-animate-css`, `@fontsource-variable/inter`, `tailwind-variants` added
- `web/e2e/entities-projeto-etapa-tarefa.spec.ts`, `web/e2e/entities-rotina-log.spec.ts`, `web/e2e/entities-ticket-subtarefa.spec.ts` - one-line cast fix (`as unknown as { value: string }[]`) required by the new `DOM` lib addition

## Decisions Made
See `key-decisions` in frontmatter — summarized: (1) wired `$lib` before running `init` because the installed CLI's preflight check is stricter than research anticipated; (2) added `DOM` to `tsconfig.e2e.json`'s `lib` and fixed 3 pre-existing casts it exposed; (3) swapped `any`→`unknown` in CLI-generated `utils.ts` type helpers to keep Biome at zero suppressions; (4) left `tailwind-variants`/`@fontsource-variable/inter` as installed by `init` itself, since both are the CLI's own zero-config output already vetted in 07-RESEARCH.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reordered $lib alias wiring before shadcn-svelte init, not after**
- **Found during:** Task 2
- **Issue:** The plan's action text describes running `init` first, then wiring the `$lib` alias afterward. The actually-installed `shadcn-svelte@1.5.0` CLI's `preflightInit()` additionally validates that every declared `--*-alias` flag already resolves against `tsconfig.json`/`tsconfig.app.json` before it will run at all (`CLI Error: "$lib/components" does not use an existing path alias defined in your tsconfig.json`) — a stricter check than 07-RESEARCH.md's session (which only found the `tailwindcss`-dependency preflight check).
- **Fix:** Added the `$lib` alias to `vite.config.ts`, `tsconfig.json`, and `tsconfig.app.json` first, then re-ran `init` successfully.
- **Files modified:** web/vite.config.ts, web/tsconfig.json, web/tsconfig.app.json
- **Verification:** `init` completed successfully on retry; Task 2's full `<verify>` command passed.
- **Committed in:** ac23bd0 (Task 2 commit)

**2. [Rule 3 - Blocking] Added `DOM` to tsconfig.e2e.json's `lib`, fixed 3 pre-existing casts it exposed**
- **Found during:** Task 2
- **Issue:** `design-system.spec.ts`'s `page.evaluate()` callbacks reference `document`/`getComputedStyle` by name — genuine TypeScript compile errors (`Cannot find name 'document'`) under the project's existing `tsconfig.e2e.json`, which has no `DOM` lib (no prior e2e spec referenced bare DOM globals). Adding `"lib": ["ES2023", "DOM"]` fixed those, but as a direct, unavoidable side effect it also made `Element` resolve to a real `SVGElement | HTMLElement` union in 3 pre-existing spec files, breaking their single-step `evaluateAll()` casts (`Conversion of type '(SVGElement | HTMLElement)[]' to type '{ value: string }[]' may be a mistake`).
- **Fix:** Added the `DOM` lib (required); changed the 3 affected casts from `(opts as { value: string }[])` to `(opts as unknown as { value: string }[])` — the exact two-step cast TypeScript's own error message recommended, with no behavior change.
- **Files modified:** web/tsconfig.e2e.json, web/e2e/entities-projeto-etapa-tarefa.spec.ts, web/e2e/entities-rotina-log.spec.ts, web/e2e/entities-ticket-subtarefa.spec.ts
- **Verification:** `bun run check` exits 0, 0 errors, across all 300 files.
- **Committed in:** ac23bd0 (Task 2 commit)

**3. [Rule 1 - Bug/lint] Replaced `any` with `unknown` in CLI-generated `utils.ts`, dropped dead ESLint comments**
- **Found during:** Task 2 (Pitfall 3, exactly as 07-RESEARCH.md anticipated)
- **Issue:** `shadcn-svelte init`'s own generated `src/lib/utils.ts` ships two conditional type helpers (`WithoutChild`, `WithoutChildren`) using `any` and `// eslint-disable-next-line` comments — Biome (this project's linter, not ESLint) flagged both `any` usages as `lint/suspicious/noExplicitAny` errors; the ESLint comments were dead weight Biome never reads.
- **Fix:** Changed `any` to `unknown` in both conditional types (structurally equivalent in this optional-property-presence-check position — `T extends { child?: unknown }` matches exactly the same set of `T` as `T extends { child?: any }` since every type is assignable to `unknown`) and deleted the two dead ESLint suppression comments. Ran `bun run lint:fix` first for the mechanical import-order/formatting findings, then hand-fixed the two `noExplicitAny` findings since autofix cannot rewrite type semantics.
- **Files modified:** web/src/lib/utils.ts
- **Verification:** `bun run lint` exits 0, 0 errors, 0 warnings; `bun run check` still exits 0 (semantics unchanged).
- **Committed in:** ac23bd0 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1/3 — bug/lint fix and blocking-issue fixes)
**Impact on plan:** All three were necessary to reach a working, `bun run check`/`bun run lint`-clean state; none changed scope, none touched `.env.instantdb`/`@instantdb/svelte` wiring, none required a suppression comment. No scope creep.

## Issues Encountered
- `shadcn-svelte@latest init`'s `Stylesheet updated` confirmation is an interactive `@clack/prompts` confirm with no CLI flag to pre-answer (unlike every other `init` prompt, which the researched `--*-alias`/`--preset`/`--css` flags do pre-answer). Piped `printf "y\n" | bunx shadcn-svelte@latest init ...` through stdin to answer it non-interactively — no PTY/expect script needed, consistent with this milestone's unattended-execution requirement (C-12).
- The first `init` invocation (before the `$lib` alias existed) partially completed — writing `components.json`, `src/lib/utils.ts`, and the `font-inter`/`nova` registry items — before erroring out on the alias preflight check. The second invocation (after wiring `$lib`) correctly detected these as "already exist" and prompted to overwrite, which was answered `Yes` (same `y` stdin pipe) to get the canonical, complete `init` output rather than a partial one.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `web/` now has a live Tailwind v4 + shadcn-svelte foundation: `cn()`, `$lib` aliases, and the full `nova`/`neutral` token set are all committed and provably wired, ready for Phase 8 (Auth & Shell Restyle) to consume via `shadcn-svelte add <component>`.
- Dark mode is automatic and toggle-free — Phases 8-10 need only use `bg-background`/`text-foreground`-style utility classes; no dark-mode wiring work remains.
- No blockers. One forward-looking note for Phase 11's planner: this plan deliberately scoped its own regression to the auth-free `anon` project (`design-system.spec.ts` + `no-leakage.spec.ts`) rather than the full `bun run test:e2e` suite — the `authed`/`setup` chain needs the orchestrator's Outlook-COM-bridge magic-code access, which a dispatched plan-execution run does not have. Full authenticated-suite regression against this Tailwind/shadcn-svelte foundation is still open and is Phase 11's explicit job (VERIFY-01/VERIFY-02).

## Self-Check: PASSED

All created/modified files (`web/components.json`, `web/src/lib/utils.ts`, `web/e2e/design-system.spec.ts`, `web/vite.config.ts`, `web/src/app.css`, `web/tsconfig.json`, `web/tsconfig.app.json`, `web/tsconfig.e2e.json`, `web/playwright.config.ts`) verified present on disk. Both task commits (`4482118`, `ac23bd0`) verified present in `git log`.

---
*Phase: 07-design-system-setup*
*Completed: 2026-08-09*
