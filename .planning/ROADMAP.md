# Roadmap: Apollo v2

## Overview

Apollo v2 replaces the original Litestar/SQLite backend with InstantDB as the sole data layer, consumed identically by a Python CLI and a pure Svelte 5 SPA. The journey starts with a scaffold where both runtimes exist, are tooled, and share one live InstantDB schema (Phase 1); establishes the one shared source of truth for ANBIMA business-day math (Phase 2); builds the CLI's full auth + CRUD surface first since it's the simpler, more direct client of the schema (Phase 3); builds the equivalent SPA auth + CRUD smoke UI (Phase 4); adds the idempotent routine-instance-generation job on top of the now-working CRUD layer, with a CLI-triggerable equivalent (Phase 5); and closes with an end-to-end verification pass proving cross-channel parity, idempotency under interruption, and clean quality gates across the whole repo (Phase 6). Every phase is self-contained and verifiable without human interaction, since the whole milestone runs unattended via `/gsd:autonomous`.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Repo Scaffold & Live Schema** - Monorepo, tooling, and InstantDB schema/perms are live for both `web/` and `cli/` (completed 2026-08-09)
- [x] **Phase 2: Shared ANBIMA Calendar** - Business-day math is correct and identical on both sides, powered by one vendored data file (completed 2026-08-09)
- [x] **Phase 3: CLI Auth & CRUD** - Full magic-code auth and CRUD for every domain entity from the terminal (completed 2026-08-09)
- [ ] **Phase 4: Web SPA Auth & CRUD Smoke UI** - Full magic-code auth and minimal CRUD screens for every domain entity in the browser
- [ ] **Phase 5: Idempotent Routine-Instance Job** - Recurring instance generation runs safely from either channel, never duplicating or deleting
- [ ] **Phase 6: End-to-End Verification** - Cross-channel parity, interrupted-run idempotency, and full-repo quality gates all proven green

## Phase Details

### Phase 1: Repo Scaffold & Live Schema

**Goal**: The apollo-v2 monorepo exists with working tooling for both runtimes, and the InstantDB schema/permissions are the live source of truth for all future work.
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05, SETUP-06, SETUP-07, SETUP-08
**Success Criteria** (what must be TRUE):

  1. `uv sync` in `cli/` and `bun install` in `web/` both succeed, producing a working dev environment for both packages, laid out exactly per the locked monorepo structure.
  2. `shared/instant.schema.ts` (all 8 domain entities + links) and `shared/instant.perms.ts` (donoId-based rules) are pushed to the live InstantDB app.
  3. `ruff` + `ty` exit 0 against the `cli/` scaffold.
  4. The configured `web/` formatter + linter exit 0 against the scaffold.
  5. A developer/CI process can authenticate to InstantDB using only the `APP_ID` in `.env.instantdb` — no admin token needed.

**Plans**: 3 plans in 2 waves

Plans:

- [x] 01-01-PLAN.md — web/ Svelte 5 + Vite SPA scaffold, shared/ 9-entity schema + donoId perms, pushed live to InstantDB and verified server-side (wave 1)
- [x] 01-02-PLAN.md — cli/ uv-managed Python 3.12 package with `apollo` entrypoint, repo-root env discovery, ruff + ty green (wave 1)
- [x] 01-03-PLAN.md — repo-root Biome covering shared/ + web/, hardened .gitignore, README, one-command SETUP-01..08 verification script (wave 2)

### Phase 2: Shared ANBIMA Calendar

**Goal**: Business-day math is correct and identical on both client and CLI, powered by one vendored data file.
**Depends on**: Phase 1
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05
**Success Criteria** (what must be TRUE):

  1. `shared/anbima-calendar.json` contains the full 2000-2078 vendored ANBIMA holiday table.
  2. Given the same input date and operation (`isBusinessDay`/`addBusinessDays`/`nextBusinessDay`), `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py` return identical results across a shared test-case set.
  3. Neither side computes holidays algorithmically or via a third-party calendar package — both read exclusively from the vendored JSON.
  4. `shared/scripts/update_calendar.py` exists and can regenerate the vendored JSON on demand, never invoked at runtime.

**Plans**: 3 plans in 3 waves

Plans:

- [x] 02-01-PLAN.md — vendor `shared/anbima-calendar.json` (2000-2078) from the MIT-licensed `bizdays` bundled `ANBIMA.cal`, add the offline `shared/scripts/update_calendar.py` regenerator, and gate the data with a pytest structural suite (wave 1)
- [x] 02-02-PLAN.md — tracer-first business-day math on both runtimes (`web/src/lib/bizdays.ts`, `cli/apollo_cli/bizdays.py`) proven identical by one shared 40+ case fixture consumed by `bun test` and `pytest` (wave 2)
- [x] 02-03-PLAN.md — extend ruff/ty scope to `shared/scripts/`, document the calendar + test workflow, and add `verify-phase-02.sh` as the single re-runnable CAL-01..05 proof (wave 3)

### Phase 3: CLI Auth & CRUD

**Goal**: The controladoria professional (or Claude on their behalf) can manage every domain entity end-to-end from the terminal, authenticated as the same real InstantDB user the web app will use.
**Depends on**: Phase 1, Phase 2
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, CLI-08, CLI-09, CLI-10, CLI-11
**Success Criteria** (what must be TRUE):

  1. `apollo auth login` completes a magic-code email flow and persists a session at `~/.config/apollo-cli/session` that survives process restarts.
  2. For each of `fundos`, `projetos`, `etapas`, `tarefas`, `templatesRotina`, `tickets`, `subtarefas`, the CLI can create, edit, delete, and list records that persist in InstantDB.
  3. `instanciasRotina` records can be listed and have their status updated via CLI.
  4. `apollo log-inferencia registrar` writes a `logInferenciaClaude` record, and it can be listed.
  5. Every CLI write is scoped to the authenticated user's `donoId` and rejected by InstantDB perms without a valid session.

**Plans**: 6 plans in 4 waves

Plans:

- [x] 03-01-PLAN.md — 0600 session store, admin/session two-client separation, `apollo auth login|logout|whoami`, proven by a REAL magic-code email round trip (wave 1)
- [x] 03-02-PLAN.md — `crud_helpers` (donoId injection, not-found guards, JSON output), `entities/` auto-discovery, tracer entity `apollo fundo`, and the CLI-11 write-based permission-denial probe (wave 2)
- [x] 03-03-PLAN.md — `apollo projeto|etapa|tarefa` full CRUD with parent links and boundary date validation (wave 3)
- [x] 03-04-PLAN.md — `apollo ticket` full CRUD and `apollo subtarefa` with XOR tarefa/ticket parent linking (wave 3)
- [x] 03-05-PLAN.md — `apollo rotina template` CRUD, `apollo rotina instancia listar|status` (structurally no-create), `apollo log-inferencia registrar|listar` (append-only) (wave 3)
- [x] 03-06-PLAN.md — schema-driven CLI coverage + help-completeness test, `verify-phase-03.sh` re-proving CLI-01..CLI-11, operator README (wave 4)

### Phase 4: Web SPA Auth & CRUD Smoke UI

**Goal**: The same professional can perform the same operations from a browser, proving UI/CLI parity at the data layer.
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, WEB-08, WEB-09, WEB-10
**Success Criteria** (what must be TRUE):

  1. A user can log into the Svelte SPA via InstantDB magic-code email auth, and the session persists across page reloads.
  2. For each of the 8 domain entities, the SPA has a minimal functional screen to create, view, edit, and delete (or list/update-status for `instanciasRotina`, view-only for `logInferenciaClaude`) records.
  3. Records created via the CLI (Phase 3) are visible in the SPA UI, proving both channels read the same backend.
  4. Attempting to load app data while unauthenticated shows the login screen instead (no data leakage).
  5. Every `web/` TypeScript file passes the configured formatter + linter with zero errors.

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 04-01: TBD

### Phase 5: Idempotent Routine-Instance Job

**Goal**: Recurring routine instances are generated automatically and safely, without ever duplicating or deleting existing instances, regardless of which channel triggers it.
**Depends on**: Phase 3, Phase 4
**Requirements**: JOB-01, JOB-02
**Success Criteria** (what must be TRUE):

  1. On authenticated SPA load, the job computes expected `instanciasRotina` for all active `templatesRotina` in range today→end of next month, for all three generation types (`du_fixo`, `corrido_fixo`, `encadeado`).
  2. Each expected instance is written via a `dedupeKey`-based upsert transact; running the job twice in a row produces zero duplicate `instanciasRotina` records.
  3. The job never deletes an existing `instanciasRotina` record.
  4. `apollo rotina gerar-instancias` triggers the same generation logic from the CLI and produces the same non-duplicating result whether run against records the SPA already generated or vice versa.

**Plans**: TBD

Plans:

- [ ] 05-01: TBD

### Phase 6: End-to-End Verification

**Goal**: The whole system is proven trustworthy — every claim from phases 1-5 holds when exercised together, and code quality gates are green across the entire repo.
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-05
**Success Criteria** (what must be TRUE):

  1. A record created/edited/deleted via CLI is visible/reflected in the SPA without manual intervention, and vice versa, for at least one entity per Phase 3 category.
  2. `ruff` and `ty` run clean (zero errors/warnings) across every `.py` file in `cli/` and `shared/scripts/`.
  3. The `web/` formatter, linter, and `svelte-check` run clean (zero errors/warnings) across every file in `web/`.
  4. Simulating an interrupted job run (killing the process mid-generation, then re-running) leaves no duplicate and no missing `instanciasRotina` records.
  5. InstantDB perms correctly deny cross-user access: a second test user cannot view/edit/delete another user's `donoId`-scoped records.

**Plans**: TBD

Plans:

- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Repo Scaffold & Live Schema | 3/3 | Complete    | 2026-08-09 |
| 2. Shared ANBIMA Calendar | 3/3 | Complete    | 2026-08-09 |
| 3. CLI Auth & CRUD | 6/6 | Complete    | 2026-08-09 |
| 4. Web SPA Auth & CRUD Smoke UI | 0/TBD | Not started | - |
| 5. Idempotent Routine-Instance Job | 0/TBD | Not started | - |
| 6. End-to-End Verification | 0/TBD | Not started | - |
