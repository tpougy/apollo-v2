# Requirements: Apollo v2 — Milestone v1.1

**Defined:** 2026-08-09
**Core Value:** The user can execute every piece of controladoria data-entry work — full CRUD across all domain entities — from either the Svelte SPA or the Python CLI, with both channels authenticated as the same real user and governed by the exact same InstantDB permission rules. v1.1 makes the SPA side of that value visually coherent and pleasant to operate, using Tailwind + shadcn-svelte's default look — no new functional capability, no panel/dashboard.

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Setup

- [ ] **SETUP-01**: `web/` has Tailwind v4 installed and wired via `@tailwindcss/vite`, replacing the current plain `app.css` reset
- [ ] **SETUP-02**: `web/` has `shadcn-svelte` initialized via its own CLI default (`--preset b0` = style `nova` + base color `neutral` — the literal current-CLI equivalent of "default style/base color", see PROJECT.md C-11), `@lucide/svelte` icons, with `components.json` committed
- [ ] **SETUP-03**: Dark mode follows `prefers-color-scheme` automatically (shadcn-svelte default tokens) — no manual toggle

### Auth Screen

- [ ] **AUTHUI-01**: `LoginScreen.svelte` (magic-code email + code entry) is rebuilt with shadcn-svelte `Input`, `Label`, `Button`, and `Card`/`Alert` for error states, preserving the existing two-step auth flow exactly
- [ ] **AUTHUI-02**: Loading/error/success states of the login flow are visually distinguishable using shadcn-svelte primitives (no bespoke CSS)

### Shell / Navigation

- [ ] **SHELLUI-01**: `Shell.svelte` (top-level authenticated layout: entity nav + logout) is rebuilt with shadcn-svelte `Button` and standard layout utilities (flex/grid via Tailwind) — no dashboard/panel layout (out of scope, see below)
- [ ] **SHELLUI-02**: The active entity/section is visually indicated in the nav using shadcn-svelte conventions (e.g. active nav state), not a bespoke indicator

### Entity Screen — Table

- [ ] **ENTTBL-01**: `EntityScreen.svelte`'s list view for all 9 domain entities (`fundos`, `projetos`, `etapas`, `tarefas`, `templatesRotina`, `instanciasRotina`, `tickets`, `subtarefas`, `logInferenciaClaude`) renders via the shadcn-svelte `Table` (or its Data Table pattern) driven by the existing `EntityConfig`, with row actions (edit/delete) as shadcn `Button`s
- [ ] **ENTTBL-02**: Status/enum-like fields (e.g. `status`, `tipoGeracao`, `tipoPrazo`) render as shadcn `Badge` instead of plain text
- [ ] **ENTTBL-03**: Every entity's restricted capability (create-only, status-only update, read-only log) remains visually and functionally identical after the table restyle — no capability regression

### Entity Screen — Form

- [ ] **ENTFRM-01**: Create/edit forms for all 9 entities render via shadcn-svelte `Input`/`Label`/`Select`/`Checkbox` mapped from the existing per-field-type config, inside a shadcn `Dialog` or `Sheet`
- [ ] **ENTFRM-02**: Date fields (`dataPrevista`, `dataInicioPrevista`, `dataFimPrevista`, etc.) use the shadcn-svelte `Calendar`/date-picker pattern instead of a bare `<input type="date">`
- [ ] **ENTFRM-03**: Link/relationship fields (e.g. `fundo`, `template`, `antecessor`, `tarefa`/`ticket` XOR on `subtarefas`) keep their existing selection behavior, restyled with shadcn `Select`/`Combobox` primitives
- [ ] **ENTFRM-04**: Form validation errors render via shadcn-svelte conventions (inline field error text / `Alert`), not `window.alert` or unstyled text

### Feedback

- [ ] **FDBK-01**: Success and error feedback for every write (create/edit/delete, both entity CRUD and auth) is surfaced via shadcn-svelte `Sonner` toasts, replacing any existing ad hoc feedback

### Verification

- [ ] **VERIFY-01**: The existing Playwright suite (`web/e2e/`) is updated so every existing spec passes against the restyled markup (selectors updated as needed, behavior unchanged)
- [ ] **VERIFY-02**: New Playwright coverage proves each restyled screen (login, shell/nav, and at least one full CRUD cycle per entity capability class: full-CRUD, create-only/status-only, read-only) renders and functions correctly against the live InstantDB app
- [ ] **VERIFY-03**: No phase in this milestone's roadmap depends on human UAT — every phase's done-criteria is provable by an automated Playwright run

### Quality

- [ ] **QUAL-01**: Biome (formatter + linter) and `svelte-check` remain clean on `web/` after the full restyle, with zero new suppressions

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 5-panel dashboard (Hoje / calendários / Projetos / Backlog, `.eml` drag-and-drop) | Deferred UI/UX design, separate future milestone — already documented in PROJECT.md as unbuilt technical debt; this milestone only restyles existing CRUD screens |
| Custom color palette / design tokens beyond shadcn-svelte defaults | User explicitly asked for the default shadcn-svelte look — "não precisa inventar moda no estilo" |
| Any new domain feature, entity, or business rule | Pure visual/component refactor of existing functional screens |
| External table library (TanStack Table standalone, ag-grid, etc.) | shadcn-svelte's own Table/Data Table pattern is sufficient for this app's scale (9 entities, no huge datasets) |
| External calendar/date-picker library | shadcn-svelte's own Calendar (bits-ui based) covers the date fields in scope |
| Mobile/responsive redesign beyond what Tailwind gives for free | Desktop-only usage pattern, unchanged from v1.0 |
| Human UAT checkpoints | This milestone runs autonomously; Playwright e2e is the verification mechanism for every phase (PROJECT.md C-12) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 7 | Pending |
| SETUP-02 | Phase 7 | Pending |
| SETUP-03 | Phase 7 | Pending |
| AUTHUI-01 | Phase 8 | Pending |
| AUTHUI-02 | Phase 8 | Pending |
| SHELLUI-01 | Phase 8 | Pending |
| SHELLUI-02 | Phase 8 | Pending |
| ENTTBL-01 | Phase 9 | Pending |
| ENTTBL-02 | Phase 9 | Pending |
| ENTTBL-03 | Phase 9 | Pending |
| ENTFRM-01 | Phase 10 | Pending |
| ENTFRM-02 | Phase 10 | Pending |
| ENTFRM-03 | Phase 10 | Pending |
| ENTFRM-04 | Phase 10 | Pending |
| FDBK-01 | Phase 10 | Pending |
| VERIFY-01 | Phase 11 | Pending |
| VERIFY-02 | Phase 11 | Pending |
| VERIFY-03 | Phase 11 | Pending |
| QUAL-01 | Phase 11 | Pending |

**Coverage:**
- v1.1 requirements: 19 total
- Mapped to phases: 19/19 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-09*
*Last updated: 2026-08-09 — roadmap created (Phases 7-11), full traceability mapped by `/gsd-roadmapper`*
