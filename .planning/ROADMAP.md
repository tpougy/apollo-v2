# Roadmap: Apollo v2

## Milestones

- 🔄 **v1.4 CLI instalável via uv tool, login sem admin token** — Phases 24-25 (in progress)
- ✅ **v1.3 Navegação reorganizada + Dashboard de acompanhamento** — Phases 18-23 (shipped 2026-08-12)
- ✅ **v1.2 Lapidação de UI (SaaS-grade polish)** — Phases 12-17 (shipped 2026-08-10)
- ✅ **v1.1 UI bonita com Tailwind + shadcn-svelte** — Phases 7-11 (shipped 2026-08-10)
- ✅ **v1.0 Apollo v2 MVP** — Phases 1-6 (shipped 2026-08-09)

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order. Phase numbering is
continuous across milestones — v1.1 continued from v1.0's Phase 6, starting at Phase 7; v1.2
continued from v1.1's Phase 11, starting at Phase 12; v1.3 continued from v1.2's Phase 17,
starting at Phase 18; v1.4 continued from v1.3's Phase 23, starting at Phase 24. The next
milestone continues from Phase 26.

### v1.4 CLI instalável via uv tool, login sem admin token (Phases 24-25) — IN PROGRESS

- [x] **Phase 24: Packaging & Installability** - Vendor the ANBIMA calendar into the package, embed a default `app_id`, and prove `uv build`/`uv tool install` works from a clean checkout outside the monorepo (completed 2026-08-12).
- [ ] **Phase 25: Public Auth Login** - Replace admin-token-based magic-code login with direct calls to InstantDB's public `/runtime/auth/*` endpoints, with zero CLI dependency on `INSTANT_APP_ADMIN_TOKEN` in normal operation.

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

<details>
<summary>✅ v1.2 Lapidação de UI (SaaS-grade polish) (Phases 12-17) — SHIPPED 2026-08-10</summary>

- [x] Phase 12: Login Screen Polish (1/1 plans) — completed 2026-08-10
- [x] Phase 13: Shell Chrome — Header, Nav & Content Frame (1/1 plans) — completed 2026-08-10
- [x] Phase 14: Entity Screen — Header, Loading & Empty States (2/2 plans) — completed 2026-08-10
- [x] Phase 15: Entity Screen — Form & Dialog Composition (1/1 plans) — completed 2026-08-10
- [x] Phase 16: Entity Screen — Row Actions & Delete Confirmation (2/2 plans) — completed 2026-08-10
- [x] Phase 17: Cross-Phase Verification & Quality Gates (2/2 plans) — completed 2026-08-10

Full detail archived at `.planning/milestones/v1.2-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.3 Navegação reorganizada + Dashboard de acompanhamento (Phases 18-23) — SHIPPED 2026-08-12</summary>

- [x] Phase 18: Navigation Foundation & EntityScreen Extension (3/3 plans) — completed 2026-08-11
- [x] Phase 19: Projetos Section (Master-Detail) (4/4 plans) — completed 2026-08-11
- [x] Phase 20: Rotinas & Tickets Sections (5/5 plans) — completed 2026-08-11
- [x] Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue (3/3 plans) — completed 2026-08-11
- [x] Phase 22: Dashboard Kanbans, Rotinas & Heatmap (2/2 plans) — completed 2026-08-12
- [x] Phase 23: Focus Dialog System (7/7 plans) — completed 2026-08-12

Full detail archived at `.planning/milestones/v1.3-ROADMAP.md`; closing audit at
`.planning/milestones/v1.3-MILESTONE-AUDIT.md`.

</details>

## Phase Details

### Phase 24: Packaging & Installability

**Goal**: Anyone can `uv tool install` `cli/` from a clean checkout and run `apollo` from any directory outside the `apollo-v2` monorepo — the ANBIMA calendar and the InstantDB `app_id` both resolve from inside the installed package, with no runtime dependency on `shared/` or a present `.env.instantdb`.
**Depends on**: Nothing (first phase of v1.4; builds on the existing `cli/` package from v1.0-v1.3)
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, PKG-05
**Success Criteria** (what must be TRUE):

  1. `uv build` produces a wheel for `cli/` from a clean checkout, and `uv tool install` of that wheel succeeds in an isolated environment with no `apollo-v2` monorepo present (PKG-05).
  2. Running `apollo --version`, `apollo doctor`, and a read-only listing subcommand from a directory outside `apollo-v2`, with no `shared/` directory and no `.env.instantdb` file present, succeeds using the embedded default `app_id` (PKG-03, PKG-05).
  3. Business-day calculations inside the isolated install (e.g. `apollo rotina gerar-instancias` or an equivalent bizdays-backed read path) return correct ANBIMA results, proving `cli/apollo_cli/bizdays.py` now reads its vendored copy via `importlib.resources` rather than `find_repo_root()` (PKG-01).
  4. A real `pytest` run includes a test asserting byte-identical content between `shared/anbima-calendar.json` and `cli/apollo_cli/data/anbima-calendar.json`, and that test fails when the two files are deliberately made to differ (PKG-02).
  5. With `.env.instantdb`/`APOLLO_ENV_FILE` present and pointing at a different `app_id`, the CLI resolves to that overriding value instead of the embedded default, preserving the existing resolution order (explicit argument > `APOLLO_ENV_FILE` > `.env.instantdb` via `find_repo_root()` > embedded default) (PKG-04).

**Plans**: 2/2 plans executed

- [x] 24-01-PLAN.md
- [x] 24-02-PLAN.md

### Phase 25: Public Auth Login

**Goal**: `apollo auth login` authenticates a real user via InstantDB's public `/runtime/auth/*` endpoints, and no CLI command — including login — reads or requires `INSTANT_APP_ADMIN_TOKEN` to operate normally, while `apollo doctor`/`admin_token_present` keep working unchanged for project-development support.
**Depends on**: Phase 24 (AUTH-04's `apollo doctor`/`admin_token_present` behavior must reflect PKG-03/PKG-04's new `app_id` resolution order)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):

  1. `apollo auth login` completes a real magic-code send+verify round trip by calling `POST {api_uri}/runtime/auth/send_magic_code` and `POST {api_uri}/runtime/auth/verify_magic_code` directly via `httpx`, with no `INSTANT_APP_ADMIN_TOKEN` set anywhere in the environment (AUTH-01, AUTH-03).
  2. `apollo auth login`'s observable output (JSON on stdout/stderr, exit codes, and error messages for invalid code, expired code, and network failure) is unchanged from its pre-change behavior for every one of those cases (AUTH-02).
  3. The full CLI test suite plus a live login-and-CRUD round trip pass with `INSTANT_APP_ADMIN_TOKEN` absent from the environment, proving `session_client()` and every other command still never read or require it (AUTH-03).
  4. `apollo doctor` and `InstantConfig.admin_token_present` still correctly detect and report an admin token when one is present in `.env.instantdb`, updated only as needed for Phase 24's new `app_id` resolution order — not removed, not behaviorally altered otherwise (AUTH-04).
  5. Updated `tests/test_auth_rejection.py` and `tests/test_instant_client.py` pass under a real `pytest` run and assert the stronger guarantee ("CLI never uses admin token anywhere, including login"), with `ruff` and `ty` both clean on the full `cli/` tree (AUTH-05).

**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|-----------------|--------|-----------|
| 1. Repo Scaffold & Live Schema | v1.0 | 3/3 | Complete | 2026-08-09 |
| 2. Shared ANBIMA Calendar | v1.0 | 3/3 | Complete | 2026-08-09 |
| 3. CLI Auth & CRUD | v1.0 | 6/6 | Complete | 2026-08-09 |
| 4. Web SPA Auth & CRUD Smoke UI | v1.0 | 6/6 | Complete | 2026-08-09 |
| 5. Idempotent Routine-Instance Job | v1.0 | 6/6 | Complete | 2026-08-09 |
| 6. End-to-End Verification | v1.0 | 3/3 | Complete | 2026-08-09 |
| 7. Design System Setup | v1.1 | 1/1 | Complete | 2026-08-09 |
| 8. Auth & Shell Restyle | v1.1 | 1/1 | Complete | 2026-08-09 |
| 9. Entity Table Restyle | v1.1 | 1/1 | Complete | 2026-08-09 |
| 10. Entity Form Restyle & Feedback | v1.1 | 4/4 | Complete | 2026-08-10 |
| 11. Full Verification & Quality Gates | v1.1 | 1/1 | Complete | 2026-08-10 |
| 12. Login Screen Polish | v1.2 | 1/1 | Complete | 2026-08-10 |
| 13. Shell Chrome — Header, Nav & Content Frame | v1.2 | 1/1 | Complete | 2026-08-10 |
| 14. Entity Screen — Header, Loading & Empty States | v1.2 | 2/2 | Complete | 2026-08-10 |
| 15. Entity Screen — Form & Dialog Composition | v1.2 | 1/1 | Complete | 2026-08-10 |
| 16. Entity Screen — Row Actions & Delete Confirmation | v1.2 | 2/2 | Complete | 2026-08-10 |
| 17. Cross-Phase Verification & Quality Gates | v1.2 | 2/2 | Complete | 2026-08-10 |
| 18. Navigation Foundation & EntityScreen Extension | v1.3 | 3/3 | Complete | 2026-08-11 |
| 19. Projetos Section (Master-Detail) | v1.3 | 4/4 | Complete | 2026-08-11 |
| 20. Rotinas & Tickets Sections | v1.3 | 5/5 | Complete | 2026-08-11 |
| 21. Dashboard Data Layer, Shell, Week Calendar & Ticket Queue | v1.3 | 3/3 | Complete | 2026-08-11 |
| 22. Dashboard Kanbans, Rotinas & Heatmap | v1.3 | 2/2 | Complete | 2026-08-12 |
| 23. Focus Dialog System | v1.3 | 7/7 | Complete | 2026-08-12 |
| 24. Packaging & Installability | v1.4 | 2/2 | Complete    | 2026-08-12 |
| 25. Public Auth Login | v1.4 | 0/TBD | Not started | - |

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 Apollo v2 MVP | 1-6 | 27 | Complete | 2026-08-09 |
| v1.1 UI bonita com Tailwind + shadcn-svelte | 7-11 | 8 | Complete | 2026-08-10 |
| v1.2 Lapidação de UI (SaaS-grade polish) | 12-17 | 9 | Complete | 2026-08-10 |
| v1.3 Navegação reorganizada + Dashboard de acompanhamento | 18-23 | 24 | Complete | 2026-08-12 |
| v1.4 CLI instalável via uv tool, login sem admin token | 24-25 | 0 | In progress | - |
