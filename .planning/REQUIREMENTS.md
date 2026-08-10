# Requirements: Apollo v2 — Milestone v1.2

**Defined:** 2026-08-10
**Core Value:** The user can execute every piece of controladoria data-entry work — full CRUD across all domain entities — from either the Svelte SPA or the Python CLI, with both channels authenticated as the same real user and governed by the exact same InstantDB permission rules. v1.2 refines the SPA's composition/spacing/hierarchy so it reads as a finished, professional SaaS product on shadcn-svelte's own default look — no new functional capability, no new dependency, no custom color palette.

## Design Intent

The user's standing brief for this milestone, restated so every phase is planned and reviewed against it, not just the checklist below: the app should feel **bonito, elegante e orgânico** — beautiful, elegant, and organic — not merely "componentized correctly." Concretely, this means:

- **Consistent rhythm, not just individual fixes**: spacing between page header → content → actions should read as one deliberate flow per screen, using a single scale throughout (no screen-by-screen ad hoc spacing values), so transitions between sections feel natural rather than mechanically stitched together.
- **Organic composition over rigid uniformity**: where the same pattern (page header, empty state, form section) repeats across the 9 entities, it should feel like one coherent design language applied with care, not 9 identical blind copies that happen to share markup — natural proportions (breathing room, alignment, grouping) over "it compiles and every screen technically matches."
- **Reasonable assumptions, no re-litigation**: since the user has limited UI opinion and asked me to assume defaults rather than ask more questions, every open composition judgment call (spacing values, alignment, hierarchy) should be resolved toward whatever reads as most polished/finished within the shadcn-svelte-default constraint — not the minimum viable diff.
- **Still testable, not vibes-only**: because this milestone runs with zero human UAT (C-12), "elegant/organic" is operationalized below as concrete, Playwright-provable proxies — a single consistent spacing scale (POLISH-04), and no phase treated as done merely because its own screen looks fine in isolation if it visibly breaks the flow established by an earlier phase (VERIFY-07).

This section is not a separate requirements category to check off — it is the lens every phase plan, execution, and code review in this milestone should be evaluated through, in addition to the literal checkboxes below.

## v1.2 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Login Screen

- [x] **LOGIN-01**: `LoginScreen.svelte` renders as a properly composed card (`CardHeader`/`CardTitle`/`CardDescription`) centered in the full viewport, not a bare form floating on the page
- [x] **LOGIN-02**: Both auth steps (email entry, code entry) use consistent internal spacing between field groups, matching the spacing scale used elsewhere in the app

### Shell / Navigation

- [x] **SHELL-01**: `Shell.svelte` has a proper header/toolbar row (app identity + user/logout action), replacing the current stray root `<h1>` and floating logout button
- [x] **SHELL-02**: The entity nav has a clear, consistent active-state and a single deliberate strategy for handling all 9 nav items on desktop (no ad hoc wrapping/overflow)
- [x] **SHELL-03**: `Shell.svelte` owns exactly one outer content-frame wrapper (max-width + horizontal padding + vertical rhythm) around the nav and the active entity screen, so every entity screen inherits the same frame instead of each managing its own

### Entity Screen — Table & States

- [ ] **ENTTBL-04**: Each entity screen has a page-header row (title + short description + right-aligned primary "novo" action), replacing the current below-table create action
- [ ] **ENTTBL-05**: The table's loading state uses a `Skeleton` shaped like the real table rows, replacing the current plain "carregando..." text
- [ ] **ENTTBL-06**: The table's empty state uses a proper icon/title/description/CTA composition (shadcn `Empty` or equivalent), reusing the existing create action, replacing the current single-text-cell message
- [ ] **ENTTBL-07**: The table is visually bounded (card/border container) instead of floating directly on the page background
- [ ] **ENTTBL-08**: Row action buttons (edit/delete) have consistent alignment and spacing, with no portal-based menu (dropdown/popover) introduced for row actions, preserving all existing row-scoped Playwright locators

### Entity Screen — Form & Dialog

- [ ] **ENTFRM-05**: Create/edit form fields inside the `Dialog` have consistent label/control/helper-text spacing (via shadcn `Field`/`FieldGroup` or an equivalent utility-class pattern), replacing the current unspaced `<div>` stack
- [ ] **ENTFRM-06**: The create/edit `Dialog` uses `Dialog.Description` and `Dialog.Footer` (already installed, currently unused) instead of ad hoc footer markup
- [ ] **ENTFRM-07**: The submit action shows a busy/spinner state while the write is in flight, matching the pattern already used on `LoginScreen`'s submit button
- [ ] **ENTFRM-08**: Required fields have a visual indicator driven by existing `config.fields[].required` data (no new validation logic)

### Delete Confirmation

- [ ] **DELCONF-01**: The delete action uses a shadcn `AlertDialog` instead of the native `window.confirm()`, with its own dedicated Playwright coverage (keyboard confirm/cancel, focus handling) — explicitly scoped in for this milestone since it is the single highest-leverage "looks unfinished" fix and was already logged as tech debt in v1.1

### Cross-Cutting Polish & Accessibility

- [ ] **POLISH-01**: No raw color literal (hex/rgb/oklch outside `app.css`) is introduced anywhere touched by this milestone — every surface uses existing semantic Tailwind/shadcn tokens only
- [ ] **POLISH-02**: Every new or restyled icon-only button has an `aria-label`; all interactive elements remain real `<button>`/`<a>` elements (no `<div onclick>`)
- [ ] **POLISH-03**: Every surface touched by this milestone remains legible (no contrast/focus-ring regression) in both light and dark `prefers-color-scheme` states
- [ ] **POLISH-04**: All spacing (gaps, padding, vertical rhythm between page header/content/actions) across every touched screen is drawn from one consistent scale — no one-off spacing values that don't recur elsewhere in the same milestone's diffs

### Verification

- [ ] **VERIFY-04**: The full existing Playwright suite (39 tests) passes unmodified in behavior against the restyled markup, with all `data-testid` selectors preserved verbatim (selectors updated only where markup structure genuinely requires it, never removed)
- [ ] **VERIFY-05**: New Playwright coverage proves each polished surface (login, shell/nav, table loading/empty states, form/dialog, delete confirmation) renders and functions correctly against the live InstantDB app, including at least one dual-color-scheme check per touched surface and one keyboard/focus-visible smoke test
- [ ] **VERIFY-06**: No phase in this milestone's roadmap depends on human UAT — every phase's done-criteria is provable by an automated Playwright run
- [ ] **VERIFY-07**: The final cross-cutting verification phase explicitly re-checks earlier phases' surfaces together (not just the current phase's own screen in isolation) to confirm the spacing/rhythm established in Phase 1-2 still reads consistently once every later phase's changes have landed

### Quality

- [ ] **QUAL-02**: Biome (formatter + linter) and `svelte-check` remain clean on `web/` after the full polish pass, with zero new suppressions

## Future Requirements

Deferred to a future release. Tracked but not in this milestone's roadmap.

### Layout

- **FUTURE-01**: Collapsible `Sidebar` shell — high setup cost for a flat 9-item nav with no hierarchy; tokens already pre-seeded in `app.css`
- **FUTURE-02**: Breadcrumb trail — no route hierarchy exists to justify it yet
- **FUTURE-03**: User menu (`Avatar` + `DropdownMenu`) for logout — nice-to-have, current header logout button is sufficient
- **FUTURE-04**: Column alignment conventions by field kind, per-entity nav/header icons — content-level polish, not structural

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 5-panel dashboard (Hoje / calendários / Projetos / Backlog, `.eml` drag-and-drop) | Separate future spec, unchanged from v1.0/v1.1 deferral |
| Custom color palette / design tokens / "anti-slop" bespoke visual identity | User explicitly asked to stay on shadcn-svelte's default look — this milestone reinforces, not reopens, that constraint |
| Any new domain feature, entity, or business rule | Pure visual/composition refactor of existing functional screens |
| Command palette, advanced sortable/filterable table, kebab/`DropdownMenu` row-action menu | Over-engineering relative to a flat 9-entity, single-user, no-hierarchy internal tool; portal-based menus also risk breaking row-scoped Playwright locators |
| Full WCAG audit / dedicated accessibility phase | Lightweight cross-cutting hygiene (POLISH-02/03) is in scope; a full audit is not, per research recommendation |
| Mobile/responsive redesign | Desktop-only usage pattern, unchanged from v1.0/v1.1 |
| External UI/component libraries | shadcn-svelte's own registry (already installed + one-command adds) covers every gap identified in research |
| Human UAT checkpoints | This milestone runs autonomously; Playwright e2e is the verification mechanism for every phase, same as v1.1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOGIN-01 | Phase 12 | Complete |
| LOGIN-02 | Phase 12 | Complete |
| SHELL-01 | Phase 13 | Complete |
| SHELL-02 | Phase 13 | Complete |
| SHELL-03 | Phase 13 | Complete |
| ENTTBL-04 | Phase 14 | Pending |
| ENTTBL-05 | Phase 14 | Pending |
| ENTTBL-06 | Phase 14 | Pending |
| ENTTBL-07 | Phase 14 | Pending |
| ENTTBL-08 | Phase 16 | Pending |
| ENTFRM-05 | Phase 15 | Pending |
| ENTFRM-06 | Phase 15 | Pending |
| ENTFRM-07 | Phase 15 | Pending |
| ENTFRM-08 | Phase 15 | Pending |
| DELCONF-01 | Phase 16 | Pending |
| POLISH-01 | Phase 17 | Pending |
| POLISH-02 | Phase 17 | Pending |
| POLISH-03 | Phase 17 | Pending |
| POLISH-04 | Phase 17 | Pending |
| VERIFY-04 | Phase 17 | Pending |
| VERIFY-05 | Phase 17 | Pending |
| VERIFY-06 | Phase 17 | Pending |
| VERIFY-07 | Phase 17 | Pending |
| QUAL-02 | Phase 17 | Pending |

**Coverage:**

- v1.2 requirements: 24 total
- Mapped to phases: 24/24 ✓
- Unmapped: 0

---
*Requirements defined: 2026-08-10*
