# Phase 13: Shell Chrome — Header, Nav & Content Frame - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

`Shell.svelte` presents one coherent header/toolbar and nav, and owns the single content-frame wrapper every entity screen inherits.

Requirements: SHELL-01, SHELL-02, SHELL-03.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Design Intent (from REQUIREMENTS.md, applies to every phase this milestone)
The app should feel bonito, elegante e orgânico — not merely "componentized correctly." For this phase: the header/toolbar/nav/content-frame rhythm established here is inherited by every later phase (14-17), so get the spacing scale right here first — it is the foundation the rest of the milestone builds on. Resolve open judgment calls toward the most polished/finished option within shadcn-svelte defaults, not the minimum diff.

### Nav overflow decision (already made — do not re-litigate)
The user approved keeping the 9 nav items in a single row with consistent spacing (`flex flex-wrap gap-*` or similar), with NO `Tabs` component and NO horizontal-scroll-container mechanism. Rationale: the app is desktop-only (already an established out-of-scope boundary — no mobile/responsive redesign), so a plain wrapping flex row is sufficient and avoids introducing unnecessary complexity/new components for a problem that doesn't really exist at this screen size.

### Research guidance (from .planning/research/SUMMARY.md and STACK.md)
- `Shell.svelte` must own exactly ONE outer content-frame wrapper (max-width + horizontal padding + vertical rhythm, e.g. `mx-auto max-w-6xl px-4 sm:px-6 lg:px-8` + `space-y-6`) around `<nav>` + the `{#key ativo}` EntityScreen mount point. Do NOT put page-frame spacing inside `EntityScreen.svelte` — that would double-pad and require re-duplicating across all 9 entity configs (ARCHITECTURE.md Pattern 1).
- Tailwind v4 dropped the v3 `container` class's auto-center/padding behavior — use explicit `mx-auto max-w-*` classes, never the bare `container` class.
- Add a proper header/toolbar row: app identity + user/logout action, with a `Separator` (already installed at `web/src/lib/components/ui/separator`, currently unused) between the toolbar and the nav/content below.
- Nav active-state should use a clear, consistent visual treatment (e.g. `aria-current="page"` + a distinct background/border on the active `nav-${etype}` button) — already partially present from v1.1, refine/confirm consistency.
- `max-w-6xl` is a reasonable starting point for content width — the planner/executor should sanity-check against the widest entity table's column count.

</decisions>

<code_context>
## Existing Code Insights

- `web/src/lib/Shell.svelte` — top-level authenticated layout. Currently has a floating logout button and no proper header/toolbar row; nav is a flat row of buttons with `data-testid="nav-${etype}"` for each of the 9 entities; owns the `{#key ativo}` EntityScreen mount point.
- Load-bearing `data-testid`s that MUST be preserved verbatim: `app-shell`, `logout`, `nav-${etype}` (one per entity, 9 total).
- `web/e2e/shell-nav.spec.ts` exercises nav-through-all-9-entities and asserts on `page.locator("h2")` for the active entity title (tag identity, not just testid) — any header/typography change to EntityScreen's own `<h2>` must keep this working, but that's Phase 14's concern; Phase 13 should not need to touch EntityScreen's internal header.
- `web/src/App.svelte` mounts `Shell.svelte` when signed in; do not add typographic classes to the root `<h1>Apollo v2</h1>` (breaks `design-system.spec.ts`).
- `web/src/lib/components/ui/separator` — already installed, unused anywhere in the app.
- No new npm dependency needed; everything achievable with Tailwind utilities + already-installed shadcn-svelte primitives (Button, Separator).

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the goal/success-criteria and decisions above — discuss phase was skipped. Refer to ROADMAP phase description, success criteria, and the research guidance above.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
