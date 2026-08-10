# Roadmap: Apollo v2

## Milestones

- 🚧 **v1.2 Lapidação de UI (SaaS-grade polish)** — Phases 12-17 (in progress)
- ✅ **v1.1 UI bonita com Tailwind + shadcn-svelte** — Phases 7-11 (shipped 2026-08-10)
- ✅ **v1.0 Apollo v2 MVP** — Phases 1-6 (shipped 2026-08-09)

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order. Phase numbering is
continuous across milestones — v1.1 continued from v1.0's Phase 6, starting at Phase 7; v1.2
continues from v1.1's Phase 11, starting at Phase 12.

<details>
<summary>✅ v1.0 Apollo v2 MVP (Phases 1-6) — SHIPPED 2026-08-09</summary>

- [x] Phase 1: Repo Scaffold & Live Schema (3/3 plans) — completed 2026-08-09
- [x] Phase 2: Shared ANBIMA Calendar (3/3 plans) — completed 2026-08-09
- [x] Phase 3: CLI Auth & CRUD (6/6 plans) — completed 2026-08-09
- [x] Phase 4: Web SPA Auth & CRUD Smoke UI (6/6 plans) — completed 2026-08-09
- [x] Phase 5: Idempotent Routine-Instance Job (6/6 plans) — completed 2026-08-09
- [x] Phase 6: End-to-End Verification (3/3 plans) — completed 2026-08-09

Full detail archived at `.planning/milestones/v1.0-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.1 UI bonita com Tailwind + shadcn-svelte (Phases 7-11) — SHIPPED 2026-08-10</summary>

- [x] Phase 7: Design System Setup (1/1 plans) — completed 2026-08-09
- [x] Phase 8: Auth & Shell Restyle (1/1 plans) — completed 2026-08-09
- [x] Phase 9: Entity Table Restyle (1/1 plans) — completed 2026-08-09
- [x] Phase 10: Entity Form Restyle & Feedback (4/4 plans) — completed 2026-08-10
- [x] Phase 11: Full Verification & Quality Gates (1/1 plans) — completed 2026-08-10

Full detail archived at `.planning/milestones/v1.1-ROADMAP.md`.

</details>

### 🚧 v1.2 Lapidação de UI (SaaS-grade polish) (Phases 12-17) — IN PROGRESS

**Milestone goal:** Refine the same four screens v1.1 restyled (login, shell/nav, entity table, entity form) so they read as a finished, real SaaS product — composition, spacing rhythm, hierarchy, and microinteractions — still strictly on shadcn-svelte's default look. No new domain functionality, no dashboard/panel, zero human UAT.

- [x] **Phase 12: Login Screen Polish** - LoginScreen reads as a composed, centered auth Card with consistent step spacing (completed 2026-08-10)
- [x] **Phase 13: Shell Chrome — Header, Nav & Content Frame** - One header/toolbar, one nav strategy, one content-frame wrapper inherited by every entity screen (completed 2026-08-10)
- [ ] **Phase 14: Entity Screen — Header, Loading & Empty States** - Page-header row, Skeleton loading state, composed Empty state, bounded table container
- [ ] **Phase 15: Entity Screen — Form & Dialog Composition** - Spaced form fields, Dialog.Description/Footer, busy submit state, required-field indicator
- [ ] **Phase 16: Entity Screen — Row Actions & Delete Confirmation** - Aligned row actions plus a shadcn AlertDialog replacing `window.confirm()`
- [ ] **Phase 17: Cross-Phase Verification & Quality Gates** - Earlier phases re-checked together, full Playwright suite + Biome/svelte-check green

## Phase Details

### Phase 12: Login Screen Polish

**Goal**: `LoginScreen.svelte` reads as a properly composed, centered auth card — not a bare form floating on the page — while the existing magic-code auth flow keeps working unchanged.
**Depends on**: Phase 11 (previous milestone baseline; no in-milestone dependency — sequenced first as the lowest-risk, self-contained warm-up)
**Requirements**: LOGIN-01, LOGIN-02
**Success Criteria** (what must be TRUE):

  1. `LoginScreen` renders inside a Card (`CardHeader`/`CardTitle`/`CardDescription`) centered in the full viewport, at both the email-entry and code-entry step.
  2. Both auth steps use the same internal spacing scale between field groups — no ad hoc per-step spacing values.
  3. A live magic-code login round trip (email step → code step → authenticated session) completes successfully through the restyled markup.

**Plans**: 1/1 plans executed
Plans:

- [x] 12-01-PLAN.md — Card composition + full-viewport centering + consistent spacing scale on both auth steps, proven via live magic-code round trip

**UI hint**: yes

### Phase 13: Shell Chrome — Header, Nav & Content Frame

**Goal**: `Shell.svelte` presents one coherent header/toolbar and nav, and owns the single content-frame wrapper every entity screen inherits.
**Depends on**: Phase 12
**Requirements**: SHELL-01, SHELL-02, SHELL-03
**Success Criteria** (what must be TRUE):

  1. `Shell` renders a header/toolbar row with app identity and a user/logout action, replacing the stray root `<h1>` and floating logout button.
  2. The entity nav shows one clear, consistent active-state indicator for the selected entity, and all 9 nav items are reachable via a single deliberate strategy with no ad hoc wrapping/overflow at desktop width.
  3. `Shell` owns exactly one outer content-frame wrapper (max-width + horizontal padding + vertical rhythm) around the nav and the active entity screen — verified identical across all 9 entities, not re-declared per screen.
  4. Navigating through all 9 entities via the nav continues to mount the correct entity screen each time, with no regression to existing nav/logout Playwright coverage.

**Plans**: 1/1 plans executed planned
Plans:

- [x] 13-01-PLAN.md — Header/toolbar + Separator + single content-frame wrapper on Shell.svelte, plus dedicated Playwright coverage (shell-chrome.spec.ts) and a full-suite regression run

**UI hint**: yes

### Phase 14: Entity Screen — Header, Loading & Empty States

**Goal**: Every entity screen presents a proper page header, a content-shaped loading state, and a composed empty state, with the table visually bounded — for all 9 entities across all 3 capability classes.
**Depends on**: Phase 13
**Requirements**: ENTTBL-04, ENTTBL-05, ENTTBL-06, ENTTBL-07
**Success Criteria** (what must be TRUE):

  1. Each entity screen shows a page-header row — title, short description, and a right-aligned primary "novo" action — above the table, replacing the old below-table create action.
  2. While an entity's data is loading, the screen shows a `Skeleton` shaped like the real table rows, not plain "carregando..." text.
  3. When an entity has zero records, the screen shows an icon/title/description/CTA `Empty` composition that reuses the existing create action, not a single text cell.
  4. The table renders inside a bounded card/border container instead of floating on the page background, across all 9 entities.

**Plans**: TBD
**UI hint**: yes

### Phase 15: Entity Screen — Form & Dialog Composition

**Goal**: The create/edit `Dialog` form reads as a properly composed form across all 9 entities, not an unspaced `<div>` stack.
**Depends on**: Phase 14
**Requirements**: ENTFRM-05, ENTFRM-06, ENTFRM-07, ENTFRM-08
**Success Criteria** (what must be TRUE):

  1. Every field inside the create/edit `Dialog` shows consistent label/control/helper-text spacing, replacing the current unspaced `<div>` stack, across all 9 entities' forms.
  2. The create/edit `Dialog` uses `Dialog.Description` and `Dialog.Footer` for its footer actions, replacing the current ad hoc footer markup.
  3. Submitting a create/edit form shows a busy/spinner state on the submit button while the write is in flight, matching `LoginScreen`'s existing pattern.
  4. Required fields show a visual indicator driven by the existing `config.fields[].required` data, with no change to validation behavior.

**Plans**: TBD
**UI hint**: yes

### Phase 16: Entity Screen — Row Actions & Delete Confirmation

**Goal**: Row-level edit/delete actions read as deliberate, aligned controls, and delete requires a proper `AlertDialog` confirmation instead of the native browser confirm.
**Depends on**: Phase 15
**Requirements**: ENTTBL-08, DELCONF-01
**Success Criteria** (what must be TRUE):

  1. Row action buttons (edit/delete) show consistent alignment and spacing across all 9 entities' tables, with no portal-based dropdown/popover menu introduced for row actions.
  2. Every pre-existing row-scoped Playwright locator (row edit/delete `data-testid`) still resolves to exactly one element after the alignment/spacing changes.
  3. Clicking delete opens a shadcn `AlertDialog` (not `window.confirm()`) that can be confirmed or canceled via keyboard, with correct focus handling.
  4. Dedicated Playwright coverage proves both the confirm path (record deleted) and the cancel path (record retained) through the `AlertDialog`.

**Plans**: TBD
**UI hint**: yes

### Phase 17: Cross-Phase Verification & Quality Gates

**Goal**: The whole v1.2 polish pass is proven together — every earlier phase's surface re-checked alongside the others, not just in isolation — and the codebase remains defect-free.
**Depends on**: Phase 12, Phase 13, Phase 14, Phase 15, Phase 16
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, VERIFY-04, VERIFY-05, VERIFY-06, VERIFY-07, QUAL-02
**Success Criteria** (what must be TRUE):

  1. The full Playwright suite (the 39 pre-existing tests plus every new spec added across Phases 12-16) passes in one run against the live InstantDB app, with every pre-existing `data-testid` selector preserved verbatim.
  2. Re-running representative checks across Phase 12's login, Phase 13's shell/nav, and each Phase 14-16 entity surface together — not phase-by-phase — confirms the spacing/rhythm scale established early still reads consistently after every later phase's changes landed, with no one-off spacing values found across the milestone's diffs.
  3. Each surface touched this milestone passes a dual-color-scheme (light/dark `prefers-color-scheme`) legibility check and at least one keyboard/focus-visible smoke test, covering one representative surface per capability class (full-CRUD, restricted, read-only).
  4. A grep sweep across every file touched this milestone finds zero raw color literals (hex/rgb/oklch outside the shared token stylesheet) and zero duplicate `data-testid` values, and every icon-only button introduced carries an `aria-label` with only real `<button>`/`<a>` elements used for interaction.
  5. Biome (formatter + linter) and `svelte-check` run clean on `web/` after the full polish pass, with zero new suppressions versus the v1.1 baseline, and no phase's done-criteria required human UAT.

**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Repo Scaffold & Live Schema | v1.0 | 3/3 | Complete | 2026-08-09 |
| 2. Shared ANBIMA Calendar | v1.0 | 3/3 | Complete | 2026-08-09 |
| 3. CLI Auth & CRUD | v1.0 | 6/6 | Complete | 2026-08-09 |
| 4. Web SPA Auth & CRUD Smoke UI | v1.0 | 6/6 | Complete | 2026-08-09 |
| 5. Idempotent Routine-Instance Job | v1.0 | 6/6 | Complete | 2026-08-09 |
| 6. End-to-End Verification | v1.0 | 3/3 | Complete | 2026-08-09 |
| 7. Design System Setup | v1.1 | 1/1 | Complete    | 2026-08-09 |
| 8. Auth & Shell Restyle | v1.1 | 1/1 | Complete    | 2026-08-09 |
| 9. Entity Table Restyle | v1.1 | 1/1 | Complete    | 2026-08-09 |
| 10. Entity Form Restyle & Feedback | v1.1 | 4/4 | Complete    | 2026-08-10 |
| 11. Full Verification & Quality Gates | v1.1 | 1/1 | Complete    | 2026-08-10 |
| 12. Login Screen Polish | v1.2 | 1/1 | Complete    | 2026-08-10 |
| 13. Shell Chrome — Header, Nav & Content Frame | v1.2 | 1/1 | Complete    | 2026-08-10 |
| 14. Entity Screen — Header, Loading & Empty States | v1.2 | 0/TBD | Not started | - |
| 15. Entity Screen — Form & Dialog Composition | v1.2 | 0/TBD | Not started | - |
| 16. Entity Screen — Row Actions & Delete Confirmation | v1.2 | 0/TBD | Not started | - |
| 17. Cross-Phase Verification & Quality Gates | v1.2 | 0/TBD | Not started | - |
