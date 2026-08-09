# Roadmap: Apollo v2

## Milestones

- 🚧 **v1.1 UI bonita com Tailwind + shadcn-svelte** — Phases 7-11 (in progress)
- ✅ **v1.0 Apollo v2 MVP** — Phases 1-6 (shipped 2026-08-09)

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order. Phase numbering is
continuous across milestones — v1.1 continues from v1.0's Phase 6, starting at Phase 7.

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

### 🚧 v1.1 UI bonita com Tailwind + shadcn-svelte (In Progress)

**Milestone Goal:** Refazer visualmente as 4 telas existentes da SPA (LoginScreen, Shell,
EntityScreen genérica das 9 entidades) usando Tailwind CSS + componentes shadcn-svelte no
estilo/cores padrão, sem tocar em lógica de negócio, sem criar o painel de 5 áreas, verificado
100% via Playwright (sem UAT humano).

- [x] **Phase 7: Design System Setup** - Tailwind v4 + shadcn-svelte wired into `web/`, default tokens, automatic dark mode (completed 2026-08-09)
- [ ] **Phase 8: Auth & Shell Restyle** - LoginScreen and Shell rebuilt with shadcn-svelte primitives, flow unchanged
- [ ] **Phase 9: Entity Table Restyle** - EntityScreen list view rebuilt with shadcn Table/Badge across all 9 entities, no capability regression
- [ ] **Phase 10: Entity Form Restyle & Feedback** - EntityScreen create/edit forms rebuilt with shadcn Dialog/Sheet + per-field-type inputs; Sonner toasts on every write
- [ ] **Phase 11: Full Verification & Quality Gates** - Playwright suite updated/extended and green live against InstantDB, Biome + svelte-check clean

## Phase Details

### Phase 7: Design System Setup

**Goal**: `web/` has Tailwind v4 and shadcn-svelte initialized with default style/tokens, giving every later phase a component library and automatic dark mode to build on — no screen is restyled yet, but the foundation is live and provably wired.
**Depends on**: Phase 6 (v1.0 shipped baseline)
**Requirements**: SETUP-01, SETUP-02, SETUP-03
**Success Criteria** (what must be TRUE):

  1. Loading the SPA in Chromium shows Tailwind's preflight/reset applied (e.g. default browser body margin removed, base typography reset) via `@tailwindcss/vite`, proven by a Playwright check of computed styles — not just a config file existing.
  2. `getComputedStyle(document.documentElement)` exposes shadcn-svelte's CSS custom properties (e.g. `--background`, `--foreground`, `--primary`) with non-empty resolved values, and `components.json` is committed at the repo path shadcn-svelte expects.
  3. Emulating `prefers-color-scheme: dark` vs `light` in a Playwright browser context changes the resolved token values (or the `dark` class on `<html>`) automatically, with no toggle control present or clicked anywhere in the DOM.
  4. The existing app still boots to the (still unstyled-beyond-this) login screen with zero console errors after the Tailwind/shadcn wiring — the swap from `app.css` is a clean replacement, not a breaking one.

**Plans:** 1/1 plans complete
Plans:

- [x] 07-01-PLAN.md — Wire Tailwind v4 + shadcn-svelte (`--preset b0`) into `web/`, convert dark mode to a bare `prefers-color-scheme` media query, and prove all 4 success criteria via a new auth-free Playwright spec

**UI hint**: yes

### Phase 8: Auth & Shell Restyle

**Goal**: The two authenticated-shell-adjacent screens users see before touching any entity — the magic-code login and the top-level Shell/nav — are rebuilt on shadcn-svelte primitives, with the existing two-step auth flow and nav/logout behavior functionally unchanged.
**Depends on**: Phase 7
**Requirements**: AUTHUI-01, AUTHUI-02, SHELLUI-01, SHELLUI-02
**Success Criteria** (what must be TRUE):

  1. A real magic-code login (email step, then code step) completes end-to-end against the live InstantDB app driving shadcn `Input`/`Label`/`Button`/`Card` elements — Playwright locates and interacts with shadcn-rendered markup at each step, not the old bespoke markup.
  2. The login flow's loading, error (e.g. invalid/expired code), and success states are each visually distinguishable via distinct shadcn primitives/states (e.g. a disabled `Button` with spinner while pending, an `Alert` on error, redirect to Shell on success) — Playwright asserts each state's DOM independently, including a real induced error case.
  3. After login, `Shell.svelte` renders the entity nav using shadcn `Button` components in a flex/grid layout (no dashboard/panel layout); clicking each nav entry navigates to the corresponding `EntityScreen` for all 9 entities.
  4. The currently active entity/section is marked in the nav using a shadcn active-state convention (e.g. a distinct `Button` variant/aria-current) while all other nav entries are not — Playwright asserts exactly one active indicator matches the current route as navigation changes.
  5. Clicking Logout (a shadcn `Button`) ends the live session and returns to the restyled LoginScreen.

**Plans:** 1/1 plans executed
Plans:

- [x] 08-01-PLAN.md — Install shadcn button/input/label/card/alert; restyle LoginScreen.svelte and Shell.svelte in place; add login-flow.spec.ts + shell-nav.spec.ts proving all 5 success criteria live

**UI hint**: yes

### Phase 9: Entity Table Restyle

**Goal**: `EntityScreen.svelte`'s list view renders every one of the 9 domain entities through shadcn Table/Data Table with Badge-rendered status fields, and every entity's existing capability restriction (full-CRUD, create-only, status-only, read-only) is visually and functionally identical to before the restyle.
**Depends on**: Phase 8
**Requirements**: ENTTBL-01, ENTTBL-02, ENTTBL-03
**Success Criteria** (what must be TRUE):

  1. Navigating to each of the 9 entity screens renders its rows inside shadcn `Table` markup populated from a live InstantDB query, with row count matching the query result for at least one entity per capability class.
  2. Enum/status-like fields (`status`, `tipoGeracao`, `tipoPrazo`, and equivalents) render as shadcn `Badge` elements rather than plain text nodes, verified across representative entities including at least one with multiple distinct status values visible at once.
  3. Row-level edit/delete actions render as shadcn `Button`s and, on a full-CRUD entity, still open the edit path and perform a live delete against InstantDB exactly as before the restyle.
  4. `instanciasRotina`'s table shows no create action and only a status-changing row action (no full edit/delete), and `logInferenciaClaude`'s table shows zero row actions of any kind — both proven live post-restyle, matching each entity's pre-restyle capability exactly.

**Plans**: TBD
**UI hint**: yes

### Phase 10: Entity Form Restyle & Feedback

**Goal**: Create/edit forms for all 9 entities are rebuilt inside a shadcn Dialog/Sheet using per-field-type shadcn inputs (including a real date-picker for date fields and Select/Combobox for relationship fields), validation errors render via shadcn conventions instead of `window.alert`, and every write anywhere in the app — entity CRUD and auth alike — surfaces a Sonner toast.
**Depends on**: Phase 9
**Requirements**: ENTFRM-01, ENTFRM-02, ENTFRM-03, ENTFRM-04, FDBK-01
**Success Criteria** (what must be TRUE):

  1. Opening create or edit on an entity from each capability class opens a shadcn `Dialog` (or `Sheet`) containing shadcn `Input`/`Label`/`Select`/`Checkbox` fields matching that entity's declarative field config — Playwright asserts the dialog's role and field types.
  2. Focusing/clicking a date field (e.g. `dataPrevista`) opens a shadcn `Calendar` date-picker popover; selecting a date populates the field with the correct value and the record persists that date correctly to live InstantDB on save.
  3. A relationship field (e.g. `fundo` on `projetos`, the `tarefa`/`ticket` XOR on `subtarefas`) is driven by a shadcn `Select`/`Combobox`, correctly links the chosen record's id on save, and the pre-existing XOR selection behavior (only one of `tarefa`/`ticket` may be set) still holds after the restyle.
  4. Submitting a form with a missing/invalid required field shows inline shadcn-styled error text (or an `Alert`) and blocks submission, with no native `window.alert`/`confirm` dialog triggered anywhere in the flow (asserted via a Playwright dialog-event listener returning none).
  5. Creating, editing, and deleting a record, and logging in/out, each produce a visible shadcn `Sonner` toast whose content matches the outcome (success vs. error) — proven live for at least one entity per capability class plus both auth actions.

**Plans**: TBD
**UI hint**: yes

### Phase 11: Full Verification & Quality Gates

**Goal**: The entire restyled SPA — login, shell/nav, and every entity's table and form across all capability classes — is re-proven correct end-to-end against the live InstantDB app by an updated and extended Playwright suite, with zero human UAT anywhere in the milestone and clean formatter/linter/type-check gates on `web/`.
**Depends on**: Phase 7, Phase 8, Phase 9, Phase 10
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03, QUAL-01
**Success Criteria** (what must be TRUE):

  1. Every pre-existing spec in `web/e2e/` passes against the fully restyled markup (selectors updated as needed, asserted behavior unchanged) in a real run against the live InstantDB app.
  2. New/extended Playwright coverage exercises the restyled login screen, the restyled shell/nav, and at least one full CRUD cycle per capability class (full-CRUD, create-only/status-only, read-only) — all green in a single suite run.
  3. A single documented command re-runs the complete `web/e2e/` suite from a clean checkout with no manual/human step anywhere in the sequence, ending in an all-green summary — the concrete proof of VERIFY-03 for this milestone.
  4. Biome (formatter + linter) and `svelte-check` both exit clean (zero errors/warnings) on `web/` after the full restyle, with zero new suppressions compared to the v1.0 baseline.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10 → 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Repo Scaffold & Live Schema | v1.0 | 3/3 | Complete | 2026-08-09 |
| 2. Shared ANBIMA Calendar | v1.0 | 3/3 | Complete | 2026-08-09 |
| 3. CLI Auth & CRUD | v1.0 | 6/6 | Complete | 2026-08-09 |
| 4. Web SPA Auth & CRUD Smoke UI | v1.0 | 6/6 | Complete | 2026-08-09 |
| 5. Idempotent Routine-Instance Job | v1.0 | 6/6 | Complete | 2026-08-09 |
| 6. End-to-End Verification | v1.0 | 3/3 | Complete | 2026-08-09 |
| 7. Design System Setup | v1.1 | 1/1 | Complete    | 2026-08-09 |
| 8. Auth & Shell Restyle | v1.1 | 1/1 | In Progress|  |
| 9. Entity Table Restyle | v1.1 | 0/TBD | Not started | - |
| 10. Entity Form Restyle & Feedback | v1.1 | 0/TBD | Not started | - |
| 11. Full Verification & Quality Gates | v1.1 | 0/TBD | Not started | - |
