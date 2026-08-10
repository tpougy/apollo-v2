# Project Research Summary

**Project:** apollo-v2 — milestone v1.2 "Lapidação de UI"
**Domain:** UI polish / composition pass on an already-functional, already-tested internal SaaS-style data tool (Svelte 5 + Tailwind v4 + shadcn-svelte)
**Researched:** 2026-08-10
**Confidence:** HIGH

## Executive Summary

This milestone is not a build — it's a composition/refinement pass on an app whose functional layer (auth, CRUD, InstantDB live queries, 39-test Playwright suite across 9 config-driven entities) is already done and must stay untouched. Every research track converges on the same diagnosis: the app is currently a "components checklist" (bare `<h1>`, unspaced `<div>` stacks, text-only loading/empty states, `window.confirm()`, zero use of already-installed primitives like `Separator`, `Dialog.Footer`, `CardHeader`) rather than a composed product. The fix requires zero new npm dependencies — everything needed is either a Tailwind utility class already available (v4's default 4px spacing scale) or a `bunx shadcn-svelte add <component>` pull from the same registry already used (`Skeleton`, `Empty`, `Field`, optionally `AlertDialog`). No new visual identity, custom color, or brand palette should be introduced: `app.css`'s neutral, chroma-zero OKLCH tokens stay exactly as-is, per this milestone's explicit "no custom color palette" constraint.

The recommended approach is outside-in, three-file, additive-only: `LoginScreen.svelte` first (isolated, zero dependency, safe warm-up), then `Shell.svelte` (establish the single outer content-frame/max-width wrapper once, inherited by all 9 entities), then `EntityScreen.svelte` last and in small sub-steps (header row → empty/loading state → form spacing → table density), because it is the single generic component shared by all 9 entities × 3 capability classes (full-CRUD, restricted, read-only) — any structural mistake there regresses everything at once. Architecture research is explicit that no new shared component (`PageHeader.svelte`, `EmptyState.svelte`) is warranted for only 3 dissimilar call sites; inline markup per file is correct until real duplication is observed.

The key risks are not visual-judgment risks but structural/regression risks specific to a codebase this well-tested: (1) portal-based components (`DropdownMenu`, `Popover`, `Select`) breaking row-scoped Playwright locators if row actions are collapsed into a kebab menu; (2) duplicate `data-testid` from wrapper `<div>`s causing Playwright strict-mode failures; (3) dark-mode contrast regressions that no existing test catches, since `design-system.spec.ts` only asserts light/dark tokens differ, not that new composed surfaces stay legible; (4) "just a touch of color" creeping in via arbitrary OKLCH/hex literals, which passes lint/type-check silently; (5) scope creep — folding the already-logged, explicitly out-of-scope `window.confirm()` → `AlertDialog` tech debt into an unrelated visual diff. All five have concrete, cheap mitigations (grep-gates, per-file testid-count checks, dual-color-scheme verification, and an explicit roadmap-level decision on `AlertDialog` before phase planning starts) that should be baked into every phase's verification step, not deferred to a final QA phase.

## Key Findings

### Recommended Stack

No new npm dependency anywhere. Two families of change: (1) Tailwind v4 utility classes for spacing/typography/layout — the codebase currently uses almost no `gap-*`/`p-*`/`space-y-*` on layout containers, which is the single biggest lever for "looks unfinished"; note Tailwind v4 dropped the v3 `container` config knob, so use explicit `mx-auto max-w-{n} px-4 sm:px-6 lg:px-8` instead of the bare `container` class. (2) A handful of shadcn-svelte registry components already targeting the installed `tailwindcss@4.3.3` / `bits-ui@2.16.3` versions:

**Core technologies:**
- Tailwind v4 spacing scale (`gap-*`, `p-*`, `space-y-*`) — fixes the "zero spacing anywhere" baseline; highest-leverage single change
- `Skeleton` (new, `bunx shadcn-svelte add skeleton`) — replaces text-only "carregando..." with content-shaped loading rows
- `Empty` (new, `bunx shadcn-svelte add empty`) — replaces the single-text-cell empty state with a proper icon+title+description+CTA block
- `Field`/`FieldGroup` (new, optional, `bunx shadcn-svelte add field`) — consistent label/control/error spacing for the generic form-render block; a plain-utility fallback (`space-y-2`/`grid gap-4`) achieves ~90% of the benefit with a smaller diff if the swap is judged too invasive
- `Separator`, `Card` sub-parts (`CardHeader`/`CardTitle`/`CardDescription`), `Dialog.Description`/`Dialog.Footer` — all already installed and unused; essentially free wins

### Expected Features

**Must have (table stakes) — do all in v1.2:**
- App container + content max-width in `Shell.svelte` (applied once, inherited by all entities)
- Header bar (app identity + user/logout), replacing the stray root `<h1>` and floating logout button
- Nav active-state + an explicit overflow strategy for 9 items (scroll container or `Tabs` — pick one, not both)
- Per-entity page header: title + description + right-aligned primary "novo" action (currently below the table)
- `Skeleton` loading state, `Empty` empty state, table wrapped in a bounding `Card`/border
- `AlertDialog` replacing `window.confirm()` for delete — **the roadmap must explicitly decide whether this is in v1.2 scope before phase planning**, since it is a functional/behavioral change wrapped in a UI decision, not pure polish
- `Field`/`FieldGroup` form composition, `Dialog.Description`/`Dialog.Footer`, submit busy/spinner state (parity with `LoginScreen`'s existing pattern), required-field indicator
- Login: `CardHeader`/`CardTitle`/`CardDescription`, full-viewport centered layout

**Should have (if time remains, non-blocking):** user menu (`Avatar`+`DropdownMenu`) for logout, column alignment conventions by field kind, per-entity icons in nav/header.

**Defer (explicitly not v1.2):** full collapsible `Sidebar` shell (tokens pre-seeded in `app.css` but high setup cost for a flat 9-item nav with no hierarchy), breadcrumb trail (no route hierarchy exists), kebab/`DropdownMenu` for row actions (only 2 actions per row, and portaling risks breaking scoped tests — see Pitfalls), command palette, advanced sortable/filterable data table, any bespoke illustration/logo/brand-color work, manual dark-mode toggle (`mode-watcher` reintroduction is explicitly locked out).

### Architecture Approach

Presentation-only milestone; no change to InstantDB queries/transactions or the routine-instance job. Three-file touch-set, outside-in ownership: `LoginScreen.svelte` polish is self-contained and lowest risk. `Shell.svelte` is the architectural fulcrum — it must own the *one* outer content-frame wrapper (max-width, padding, vertical rhythm) around `<nav>` + the `{#key ativo}` mount point, because `EntityScreen` remounts fresh per nav click while `Shell` is mounted once per session; putting frame spacing in `EntityScreen` instead would double-pad and require re-duplicating across all 9 configs. `EntityScreen.svelte` is the highest-blast-radius file — one generic, registry-driven component instantiated for all 9 entities across 3 capability classes — so its polish must be additive-class-only, applied in small independently-verifiable sub-steps, and must never branch on `config.etype`/`config.titulo` for visual purposes.

**Major components:**
1. `App.svelte` — root chrome (`<h1>`, `Toaster`, signed-in/out switch); do not add typographic classes to the root `<h1>` (breaks `design-system.spec.ts`)
2. `Shell.svelte` — post-auth toolbar + nav + single content-frame wrapper (owns outer spacing exactly once)
3. `EntityScreen.svelte` — config-driven header row, table, empty/loading state, create/edit `Dialog` form (owns inner, per-screen spacing only)
4. `web/src/lib/components/ui/*` — shadcn-svelte primitives, escalate via `bunx shadcn-svelte add <name>` only when an already-installed primitive doesn't cover the gap

No new `PageHeader`/`EmptyState`/layout-abstraction component is warranted — only 3 dissimilar call sites exist today; extract only if genuine duplication (not superficial "both have a title" similarity) emerges during execution.

### Critical Pitfalls

1. **Row-action portaling breaks scoped Playwright locators** — collapsing edit/delete buttons into a `DropdownMenu`/`Popover` kebab menu renders content via a Radix/bits-ui Portal outside the row's DOM subtree, silently breaking `row.getByTestId("row-edit")` assertions across all 9 entity specs. Avoid: prefer non-portaled row-action patterns; if a menu is used, keep the testid on the trigger only and query portaled content unscoped.
2. **Duplicate `data-testid` from wrapper additions** — wrapping an element for spacing while copying (not moving) its testid causes Playwright strict-mode "resolved to 2 elements" failures. Avoid: grep each touched testid for count==1 after every edit.
3. **Dark-mode contrast regressions no test catches** — `design-system.spec.ts` only asserts light/dark tokens *differ*, not that new composed surfaces stay legible; arbitrary opacity modifiers (`bg-foreground/5`) or hard-coded `gray-*` classes can crush contrast in dark mode invisibly. Avoid: use only semantic tokens (`bg-muted`, `border-border`); verify every new surface in both `prefers-color-scheme` states via `page.emulateMedia`.
4. **Custom color creep via plausible UX justification** — a "subtle accent" or success tint requires no new dependency and passes lint cleanly, but directly violates the milestone's no-custom-palette constraint. Avoid: grep-gate every touched file for raw `oklch(`/hex/`rgba(` literals outside `app.css`; use icon/weight/opacity-of-meaning instead of hue.
5. **Scope creep folding in `window.confirm()` → `AlertDialog`** — already-logged, explicitly out-of-scope tech debt that lives in the exact file this milestone touches, tempting to "fix while in there." This must be decided explicitly at the roadmap level (own phase with own Playwright coverage) — not silently absorbed into a spacing plan.

(Also flagged, secondary severity: over-abstracting `EntityScreen.svelte` into new per-concern components; denser layouts shrinking hit targets/clipping focus rings via `overflow-hidden`; `shadcn-svelte add --overwrite` silently reintroducing removed behavior, mirroring the exact `sonner`/`mode-watcher` incident already hit once in v1.1.)

### External source note (Reddit "UI-focused Agent Skills" article)

Two points from the user-shared article reinforce and are folded into this synthesis:
- **Reuse shadcn/ui components consistently, consistent spacing/typography/hover/focus/disabled states** — directly aligned with, and already covered in depth by, STACK.md/FEATURES.md/ARCHITECTURE.md above (Pattern 3: shadcn-svelte primitive escalation, not custom components).
- **Basic accessibility hygiene** (semantic HTML, keyboard-accessible interactive elements, labels/`aria-label` on icon-only buttons, focus management, WCAG AA contrast) — worth adding as a **lightweight cross-cutting requirement** on every phase, not a dedicated accessibility phase or full WCAG audit. Concretely this overlaps with Pitfall 6 (focus-ring clipping, hit-target size) already identified independently by PITFALLS.md, plus: any icon-only button introduced in this milestone (e.g., a denser row-action icon) needs an `aria-label`; interactive elements must stay real `<button>`/`<a>` elements, not `<div onclick>`.

**Explicitly rejected:** the same article's "anti-slop design taste" pattern, which recommends "never default Tailwind colors" and inventing a distinctive custom aesthetic/palette. **This directly contradicts the user's explicit instruction for v1.2** — keep shadcn-svelte's default style and colors, no custom palette, no invented visual identity ("não precisa inventar moda no estilo"). The shadcn-default, chroma-zero-OKLCH constraint (already independently derived by STACK/FEATURES/PITFALLS as the standing "no custom color palette" rule) overrides that generic advice entirely. Do not adopt "anti-slop" custom-color guidance in this milestone.

## Implications for Roadmap

Based on research, suggested phase structure (outside-in, matching DOM containment `App ⊃ Shell ⊃ EntityScreen` and risk-ascending order):

### Phase 1: Login screen polish
**Rationale:** Zero dependency on any other file; self-contained (`Card`-wrapped, own `data-testid` scope); safe first/parallel-track warm-up with the lowest regression risk in the milestone.
**Delivers:** Centered full-viewport layout, `CardHeader`/`CardTitle`/`CardDescription`, consistent `space-y-4` internal spacing across both auth steps (email/code).
**Addresses:** FEATURES.md "Login: CardHeader + full-viewport centered layout" table-stakes items.
**Avoids:** Pitfall 4 (custom color creep) and the `design-system.spec.ts` `<h1>` trap — do not add typographic classes to `App.svelte`'s root `<h1>`; remove/relocate it into this phase or Shell's header, not both.

### Phase 2: Shell chrome — header, nav, content frame
**Rationale:** Must land before or independently of `EntityScreen` polish, because it establishes the single outer max-width/padding wrapper that all 9 entity screens will be tuned against; doing this first also validates the full nav-through-all-9-entities Playwright suite before entity-internal markup changes begin.
**Delivers:** Toolbar row (app identity + user/logout, `Separator` underneath), nav active-state + a chosen overflow strategy (scroll container or `Tabs` — pick exactly one) for 9 items, and the single content-frame wrapper (`mx-auto max-w-{n} px-4 sm:px-6 lg:px-8`) around `<nav>` + `{#key ativo}`.
**Uses:** Tailwind v4 spacing scale, `Separator` (already installed), optionally `Tabs` (new registry pull).
**Implements:** ARCHITECTURE.md Pattern 1 (frame-once-in-Shell, polish-locally-in-EntityScreen).
**Avoids:** Anti-Pattern 3 (page-frame spacing inside `EntityScreen` instead of `Shell`); Pitfall 2 (duplicate testid on new wrapper `<div>`s around `Button`/nav elements).

### Phase 3: Entity screen — header row + loading/empty states
**Rationale:** First EntityScreen sub-step; lowest-risk portion of the shared component (no row-action or form-field restructuring yet), and directly targets the two weakest visual moments in the app ("carregando..." and "Nenhum registro.").
**Delivers:** Title+description+right-aligned primary-action header row; `Skeleton` loading state shaped like the real table; `Empty` empty state with icon/title/description/CTA reusing the existing `startCreate` handler; table wrapped in a bounding `Card`/border.
**Addresses:** FEATURES.md P1 items — page header, `Skeleton`, `Empty`, table bounding container.
**Avoids:** Pitfall 5 (over-abstraction — keep this inline in `EntityScreen.svelte`, no new `PageHeader`/`EmptyState` file); the UX pitfall of nesting block-level illustration markup invalidly inside `<tbody>` — restructure `Empty` as a sibling to `<Table>`, not nested content inside it.

### Phase 4: Entity screen — form/dialog composition
**Rationale:** Second EntityScreen sub-step, isolated from table/header changes so a regression is attributable to this phase alone; touches the generic `{#each editableFields()}` render block once, benefiting all 9 entities.
**Delivers:** `Field`/`FieldGroup`/`FieldDescription` (or plain-utility `space-y-2`/`grid gap-4` fallback) field spacing; `Dialog.Description` + `Dialog.Footer` wiring (already installed, unused); submit busy/spinner state matching `LoginScreen`'s existing pattern; required-field visual indicator.
**Addresses:** FEATURES.md P1 form-composition items.
**Avoids:** Pitfall 8 — this phase must NOT touch `handleSubmit`/validation logic beyond adding a busy boolean around the existing `await db.transact(...)` call; no new required-field enforcement, only a visual cue driven by existing `config.fields[].required` data.

### Phase 5: Entity screen — row actions, density, and (decision-gated) AlertDialog
**Rationale:** Highest-risk sub-step (row-action markup changes have the most severe regression potential per Pitfall 1/6); scheduled last so earlier phases' verification patterns (per-file testid grep, dual-color-scheme check) are already proven out before this riskier work begins.
**Delivers:** Row action button alignment/gap fixes (`text-right`, `whitespace-nowrap`, `gap-2` — no portal-based menu), column alignment-by-kind (if time remains), and — **only if the roadmap explicitly scopes it in** — `window.confirm()` → `AlertDialog` conversion as its own reviewed sub-scope with dedicated Playwright coverage.
**Uses:** Existing inline `Button` pattern (no `DropdownMenu`); optionally `bunx shadcn-svelte add alert-dialog`.
**Avoids:** Pitfall 1 (portaling), Pitfall 6 (hit-target/focus-ring clipping under increased density), Pitfall 8 (scope creep) — this is the phase where the AlertDialog decision must be made explicit and bounded, not incidental.

### Phase 6 (cross-cutting, can run in parallel with 1-5 as a standing checklist, formalized at the end): Verification pass
**Rationale:** Several pitfalls (dark-mode contrast, focus-visible/keyboard nav, raw-color-literal grep, testid uniqueness) have no existing automated coverage and are invisible to mouse-driven visual QA; research recommends baking per-phase checks in but also closing with one consolidated pass.
**Delivers:** At least one dual-color-scheme (`page.emulateMedia`) check per touched surface, one keyboard-navigation/`:focus-visible` smoke test across one representative screen per capability class (full-CRUD/restricted/read-only), full 39-test Playwright suite green, final grep sweep for raw color literals and testid duplicates across all touched files.
**Avoids:** All 8 pitfalls collectively — this is the safety net, not a substitute for per-phase checks.

### Phase Ordering Rationale

- Outside-in file order (`LoginScreen` → `Shell` → `EntityScreen`) matches actual DOM containment and avoids re-tuning inner spacing against a moving outer frame (ARCHITECTURE.md's explicit recommendation).
- `EntityScreen.svelte` sub-steps are ordered risk-ascending: header/empty/loading (no shared testid risk) → form spacing (isolated to Dialog) → row actions/density (highest portaling/focus-ring risk) — so a regression in a later, riskier sub-step is attributable to a small diff, not conflated with earlier safe changes.
- The `window.confirm()`→`AlertDialog` question is deliberately placed as a **gated decision inside Phase 5**, not silently folded into any earlier phase — per Pitfall 8, the roadmap should decide up front whether it's in scope at all.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Shell nav overflow):** the scroll-container-vs-`Tabs` decision for 9 nav items has real UX tradeoffs (overflow indicator affordance, keyboard behavior) worth a quick `--research-phase` pass if not already settled by discussion.
- **Phase 5 (row actions / AlertDialog):** if `AlertDialog` is scoped in, its keyboard/focus-trap semantics and Playwright coverage pattern warrant a focused look before planning, given the portaling pitfall already identified.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1 (Login):** conventional centered-card auth layout, thoroughly covered by STACK.md/FEATURES.md with concrete class recipes.
- **Phase 3 (header/empty/loading):** direct application of documented shadcn `Skeleton`/`Empty` component APIs, already fetched from official docs.
- **Phase 4 (form/dialog composition):** `Field`/`Dialog.Footer` usage is a documented, one-command registry pull with clear fallback if judged too invasive.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against current official Tailwind v4 and shadcn-svelte docs, cross-checked against direct reads of the actual `web/src` source files; no speculative library choices |
| Features | HIGH (code-grounded) / MEDIUM (general "what reads as SaaS" conventions) | Grounded in direct code read of all 3 target files; general SaaS-convention claims are community consensus (shadcn block galleries), not a single canonical spec — inherent to a taste/convention question |
| Architecture | HIGH | Based on direct reading of source files, `entities/types.ts`/`registry.ts`, and the live Playwright specs that encode structural assumptions (not inferred from docs alone) |
| Pitfalls | HIGH | Every pitfall anchored to actual files/patterns in `web/src`/`web/e2e`, cross-checked against verified external sources (Radix Portal docs, Playwright strict-mode docs, shadcn/ui GitHub issue on overflow-hidden) |

**Overall confidence:** HIGH

### Gaps to Address

- **Reddit thread `r/AgentContext_dev/comments/1vddlso/...` (original milestone pointer) could not be fetched directly** by the researcher agents (WebFetch blocked on reddit.com, web search did not surface its contents). The user separately supplied a summary of its relevant points during synthesis; those two relevant points (shadcn/design-system consistency, basic accessibility hygiene) are folded into this SUMMARY above, and the one contradictory point (custom-color "anti-slop" advice) is explicitly rejected per the user's own constraint. No further action needed unless the user wants the roadmapper to re-verify against the full original thread.
- **`window.confirm()` → `AlertDialog` in/out-of-scope decision** is not resolved by research — it is deliberately left as an explicit roadmap-level call (see Phase 5 above) rather than assumed either way.
- **Nav overflow mechanism (scroll vs. `Tabs`) for 9 items** is a genuine open choice research flags but doesn't resolve; needs a decision during Phase 2 planning/discussion.
- **No automated accessibility/contrast test exists today** (dark-mode contrast, focus-visible, hit-target size) — research recommends adding minimal smoke coverage in the final verification phase rather than a full audit, consistent with the "lightweight cross-cutting requirement, not a full WCAG audit" framing from the user's own guidance.

## Sources

### Primary (HIGH confidence)
- https://www.shadcn-svelte.com/docs/components — full registry contents (Skeleton, Empty, Field, Separator, Breadcrumb, Tabs, AlertDialog, etc.)
- https://www.shadcn-svelte.com/docs/components/field, /skeleton, /empty, /sidebar — component APIs
- https://github.com/tailwindlabs/tailwindcss/discussions/14801 and /15429 — Tailwind v4 dropped `theme.container` config
- Direct source reads: `web/src/App.svelte`, `web/src/lib/Shell.svelte`, `web/src/lib/auth/LoginScreen.svelte`, `web/src/lib/entities/EntityScreen.svelte`, `web/src/lib/entities/types.ts`, `web/src/lib/entities/registry.ts`, `web/src/app.css`, `web/components.json`, `web/package.json`, all `web/e2e/*.spec.ts`, `.planning/PROJECT.md`
- https://www.radix-ui.com/primitives/docs/utilities/portal, https://playwright.dev/docs/locators — portal/strict-mode mechanisms

### Secondary (MEDIUM confidence)
- shadcn/ui `dashboard-01` reference block conventions (page-header shape, spacing rhythm) — widely mirrored community convention
- shadcndesign.com / shadcn.io / shadcnstudio.com block galleries — general SaaS table/loading/empty-state conventions
- https://github.com/radix-ui/primitives/discussions/1130, https://github.com/shadcn-ui/ui/issues/2885 — portal testing and overflow-hidden/focus-ring corroboration

### Tertiary (LOW confidence)
- User-summarized Reddit article "UI-focused Agent Skills" (original thread unreachable) — two points incorporated (shadcn consistency, basic a11y hygiene), one point explicitly rejected (anti-slop custom-color advice, overridden by the project's own no-custom-palette constraint)

---
*Research completed: 2026-08-10*
*Ready for roadmap: yes*
