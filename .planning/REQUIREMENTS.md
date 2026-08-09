# Requirements: Apollo v2

**Defined:** 2026-08-09
**Core Value:** The user can execute every piece of controladoria data-entry work — full CRUD across all domain entities — from either the Svelte SPA or the Python CLI, with both channels authenticated as the same real user and governed by the exact same InstantDB permission rules.

## v1 Requirements

Requirements for this migration milestone. Each maps to exactly one roadmap phase. Derived from the approved SPEC (`docs/superpowers/specs/2026-08-09-migracao-instantdb-design.md`) — no PRD/ADR existed for this batch, so requirement IDs are newly assigned here from the SPEC's locked constraints (see PROJECT.md Constraints for the source constraint per item).

### Setup (SETUP)

- [x] **SETUP-01**: Monorepo layout exists exactly as specified (`shared/`, `web/`, `cli/`, `.env.instantdb`) — *C-01*
- [x] **SETUP-02**: `cli/` is a `uv`-managed Python 3.12 package that installs cleanly (`uv sync`) with entrypoint `apollo` — *C-01, C-07*
- [x] **SETUP-03**: `web/` is a `bun`-managed pure Svelte 5 + Vite SPA (no SvelteKit) that installs and runs a dev server cleanly — *C-01, C-08*
- [x] **SETUP-04**: `ruff` (curated rule set) and `ty` are configured for `cli/` and pass clean (zero errors/warnings) on scaffold files — *C-08*
- [x] **SETUP-05**: A formatter (Prettier or Biome) and lint/type checker (ESLint or Biome + `svelte-check`) are configured for `web/` and pass clean on scaffold files — *C-08*
- [x] **SETUP-06**: Developer can authenticate to InstantDB (CLI login) using the app's `APP_ID` stored in `.env.instantdb`, with no admin token required for normal operation — *C-05*
- [x] **SETUP-07**: `shared/instant.schema.ts` defines all 8 domain entities and their links per the SPEC schema table and is pushed live to InstantDB — *C-04*
- [x] **SETUP-08**: `shared/instant.perms.ts` defines the `donoId`-based permission rules (identical across entities) and is pushed live to InstantDB — *C-05*

### ANBIMA Calendar (CAL)

- [x] **CAL-01**: `shared/anbima-calendar.json` contains the vendored ANBIMA holiday table (2000-2078, federal-only), sourced from `github.com/ianliu/feriados-anbima` — *C-03*
- [x] **CAL-02**: `web/src/lib/bizdays.ts` implements `isBusinessDay`, `addBusinessDays`, `nextBusinessDay` reading exclusively from the vendored JSON — *C-03*
- [x] **CAL-03**: `cli/apollo_cli/bizdays.py` implements equivalent business-day math using Python `bizdays` configured with a custom calendar pointing at the same vendored JSON (not the library's built-in `ANBIMA` calendar) — *C-03*
- [x] **CAL-04**: For a shared set of test dates/operations, `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py` produce identical results — *C-03*
- [x] **CAL-05**: `shared/scripts/update_calendar.py` exists as the sole (manual, non-runtime) path to regenerate the vendored calendar — *C-03*

### CLI (CLI)

- [x] **CLI-01**: `apollo auth login` completes a magic-code email auth flow and persists a session at `~/.config/apollo-cli/session` that survives process restarts — *C-05*
- [x] **CLI-02**: `apollo fundo criar|editar|deletar|listar` performs full CRUD on `fundos`, scoped to the authenticated user's `donoId` — *C-07*
- [x] **CLI-03**: `apollo projeto criar|editar|deletar|listar` performs full CRUD on `projetos` — *C-07*
- [x] **CLI-04**: `apollo etapa criar|editar|deletar|listar` performs full CRUD on `etapas` — *C-02, C-07*
- [x] **CLI-05**: `apollo tarefa criar|editar|deletar|listar` performs full CRUD on `tarefas` — *C-07*
- [x] **CLI-06**: `apollo rotina template criar|editar|deletar` (+ `listar`) performs full CRUD on `templatesRotina` — *C-07*
- [x] **CLI-07**: CLI can list `instanciasRotina` and update their status (creation is exclusively via the generation job, not direct create) — *C-02, C-04*
- [x] **CLI-08**: `apollo ticket criar|editar|deletar|listar` performs full CRUD on `tickets` — *C-07*
- [x] **CLI-09**: `apollo subtarefa criar|editar|deletar|listar` performs full CRUD on `subtarefas` (linked to a `tarefa` or a `ticket`) — *C-02, C-04, C-07*
- [x] **CLI-10**: `apollo log-inferencia registrar` creates a `logInferenciaClaude` record, and it can be listed — *C-07*
- [x] **CLI-11**: Every CLI write is scoped to the authenticated user's `donoId`, and is rejected by InstantDB perms if attempted without a valid session — *C-05*

### Web SPA (WEB)

- [ ] **WEB-01**: User can log into the Svelte SPA via InstantDB magic-code email auth, with session persisted across page reloads (localStorage) — *C-05*
- [ ] **WEB-02**: SPA has a minimal functional screen for full CRUD on `fundos` — *C-02*
- [ ] **WEB-03**: SPA has a minimal functional screen for full CRUD on `projetos` — *C-02*
- [ ] **WEB-04**: SPA has a minimal functional screen for full CRUD on `etapas` — *C-02*
- [ ] **WEB-05**: SPA has a minimal functional screen for full CRUD on `tarefas` — *C-02*
- [ ] **WEB-06**: SPA has a minimal functional screen for full CRUD on `templatesRotina` — *C-02*
- [ ] **WEB-07**: SPA has a minimal functional screen to list/update-status `instanciasRotina` — *C-02*
- [ ] **WEB-08**: SPA has a minimal functional screen for full CRUD on `tickets` and `subtarefas` — *C-02*
- [ ] **WEB-09**: SPA has a minimal functional screen to view `logInferenciaClaude` entries — *C-02*
- [ ] **WEB-10**: Unauthenticated access to app data redirects to/shows the login screen (no data leakage) — *C-05*

### Idempotent Job (JOB)

- [ ] **JOB-01**: On authenticated SPA load, the job computes expected `instanciasRotina` for all active `templatesRotina` in range today→end of next month across all three generation types (`du_fixo`, `corrido_fixo`, `encadeado`), and upserts each via `dedupeKey`-based atomic transact — never duplicating, never deleting existing instances — *C-06*
- [ ] **JOB-02**: `apollo rotina gerar-instancias` runs the same generation logic from the CLI with the same non-duplicating, non-deleting guarantee, interoperable with instances the SPA already generated (and vice versa) — *C-06, C-07*

### Verification & Quality (VERIFY)

- [ ] **VERIFY-01**: A record created/edited/deleted via CLI is visible/reflected in the SPA without manual intervention, and vice versa, for at least one entity per CLI category — *Core value*
- [ ] **VERIFY-02**: `ruff` and `ty` run clean (zero errors/warnings) across every `.py` file in `cli/` and `shared/scripts/` — *C-08*
- [ ] **VERIFY-03**: The configured `web/` formatter, linter, and `svelte-check` run clean (zero errors/warnings) across every file in `web/` — *C-08*
- [ ] **VERIFY-04**: Simulating an interrupted job run (killing the process mid-generation, then re-running) leaves no duplicate and no missing `instanciasRotina` records — *C-06*
- [ ] **VERIFY-05**: InstantDB perms correctly deny cross-user access — a second test user cannot view/edit/delete another user's `donoId`-scoped records — *C-05*

## v2 Requirements

None identified — this SPEC's explicit "fora de escopo" items are excluded outright (see Out of Scope below), not deferred as v2 candidates. The follow-on UI panel/dashboard design is a separate future spec, not part of this project's v2 backlog.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Migrating existing SQLite data from original `apollo` | No real production data exists yet — *C-09* |
| UI panel/dashboard design (5 fixed panels, ordering, `.eml` drag-and-drop) | Separate future spec; this milestone covers data layer + auth + CLI + job only — *C-09* |
| Automatic soft-deadline reallocation | Advanced v2 rule from original `apollo`, was out of scope there too — *C-09* |
| Chained delay propagation | Advanced v2 rule from original `apollo`, was out of scope there too — *C-09* |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Complete |
| SETUP-02 | Phase 1 | Complete |
| SETUP-03 | Phase 1 | Complete |
| SETUP-04 | Phase 1 | Complete |
| SETUP-05 | Phase 1 | Complete |
| SETUP-06 | Phase 1 | Complete |
| SETUP-07 | Phase 1 | Complete |
| SETUP-08 | Phase 1 | Complete |
| CAL-01 | Phase 2 | Complete |
| CAL-02 | Phase 2 | Complete |
| CAL-03 | Phase 2 | Complete |
| CAL-04 | Phase 2 | Complete |
| CAL-05 | Phase 2 | Complete |
| CLI-01 | Phase 3 | Complete |
| CLI-02 | Phase 3 | Complete |
| CLI-03 | Phase 3 | Complete |
| CLI-04 | Phase 3 | Complete |
| CLI-05 | Phase 3 | Complete |
| CLI-06 | Phase 3 | Complete |
| CLI-07 | Phase 3 | Complete |
| CLI-08 | Phase 3 | Complete |
| CLI-09 | Phase 3 | Complete |
| CLI-10 | Phase 3 | Complete |
| CLI-11 | Phase 3 | Complete |
| WEB-01 | Phase 4 | Pending |
| WEB-02 | Phase 4 | Pending |
| WEB-03 | Phase 4 | Pending |
| WEB-04 | Phase 4 | Pending |
| WEB-05 | Phase 4 | Pending |
| WEB-06 | Phase 4 | Pending |
| WEB-07 | Phase 4 | Pending |
| WEB-08 | Phase 4 | Pending |
| WEB-09 | Phase 4 | Pending |
| WEB-10 | Phase 4 | Pending |
| JOB-01 | Phase 5 | Pending |
| JOB-02 | Phase 5 | Pending |
| VERIFY-01 | Phase 6 | Pending |
| VERIFY-02 | Phase 6 | Pending |
| VERIFY-03 | Phase 6 | Pending |
| VERIFY-04 | Phase 6 | Pending |
| VERIFY-05 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-09*
*Last updated: 2026-08-09 after initial roadmap creation*
