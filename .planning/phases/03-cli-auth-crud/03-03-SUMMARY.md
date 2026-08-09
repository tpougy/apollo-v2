---
phase: 03-cli-auth-crud
plan: 03
subsystem: cli
tags: [click, instantdb, crud, links, cli-03, cli-04, cli-05]

requires:
  - phase: 03-cli-auth-crud
    provides: "crud_helpers.py (create_entity/update_entity/delete_entity/get_entity/list_entities), entities/ auto-discovery, apollo fundo as the reference module"
provides:
  - "apollo projeto criar|editar|deletar|listar with fundo link (CLI-03)"
  - "apollo etapa criar|editar|deletar|listar with projeto link (CLI-04)"
  - "apollo tarefa criar|editar|deletar|listar with etapa link and tipoPrazo/date validation (CLI-05)"
  - "Parent-existence validation pattern (_resolve_*_link helpers) reusable by future entity modules with parent links"
  - "Confirmed working InstaQL dot-path where filter (`\"projeto.id\": id`) for filtering children by a linked parent"
affects: [04-web-spa-crud, 05-idempotent-job, 06-verification]

tech-stack:
  added: []
  patterns:
    - "Per-module _resolve_<parent>_link(id) -> dict|None helper: get_entity() check -> JSON parent_not_found error + SystemExit(EXIT_API_ERROR) on miss, else {label: id} for create_entity/update_entity links="
    - "listar --<parent>-id filters via InstaQL dot-path where clause (e.g. where={'projeto.id': projeto_id}), not client-side filtering"

key-files:
  created:
    - cli/apollo_cli/entities/projeto.py
    - cli/apollo_cli/entities/etapa.py
    - cli/apollo_cli/entities/tarefa.py
    - cli/tests/test_crud_projeto.py
    - cli/tests/test_crud_etapa.py
    - cli/tests/test_crud_tarefa.py
  modified: []

key-decisions:
  - "Parent-link validation implemented per-module as a small private helper rather than a new crud_helpers export — keeps crud_helpers' LOCKED signature surface untouched per plan 03-02, and the three helpers are near-identical but each binds a different parent etype/link label."
  - "listar --<parent>-id uses InstantDB's native dot-path where filter (confirmed live: `{'projeto.id': <id>}` works against `etapas`) instead of fetching all rows and filtering in Python — simpler and pushes filtering server-side like every other where clause in this codebase."
  - "status fields (projetos/etapas/tarefas) left as free-form `str` options (not click.Choice) per the interfaces spec (schema declares them as `i.string().indexed()` with no enum) — flagged in the plan as a backstop must-have for Phase 4/5 alignment; no fixed vocabulary exists yet to enforce."

patterns-established:
  - "Parent-existence rule: every *-id link flag is validated with get_entity(etype=<parent>) before any transact; a miss emits {'error': 'parent_not_found', 'etype', 'id'} to stderr and exits EXIT_API_ERROR — never silently creates a dangling link."

requirements-completed: [CLI-03, CLI-04, CLI-05]

duration: 45min
completed: 2026-08-09
---

# Phase 03 Plan 03: projeto -> etapa -> tarefa CRUD with parent links Summary

Delivered `apollo projeto`, `apollo etapa`, and `apollo tarefa` as auto-discovered click command groups doing full live CRUD against InstantDB, each validating and writing a real parent link (`fundoProjetos`, `projetoEtapas`, `etapaTarefas`) before any write, with zero edits to `cli.py`.

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 completed
- **Files created:** 6 (3 entity modules, 3 live test modules)

## Accomplishments

- `apollo projeto criar|editar|deletar|listar` — full CRUD, optional `--fundo-id` link, optional fields correctly dropped (not written as `null`).
- `apollo etapa criar|editar|deletar|listar` — full CRUD, optional `--projeto-id` link, `--ordem` type-checked as `int` at the CLI boundary.
- `apollo tarefa criar|editar|deletar|listar` — full CRUD, optional `--etapa-id` link, `--tipo-prazo` enforced as `click.Choice(["hard", "soft"])`, both date fields validated via `validate_iso_date` (rejecting `2026-13-99` with exit 2 before any network call).
- Every `--*-id` link flag is validated with `get_entity(etype=<parent>, eid=<id>)` before transacting; a miss returns `{"error": "parent_not_found", "etype", "id"}` on stderr with `SystemExit(EXIT_API_ERROR)` — no orphan/dangling-link record is ever created.
- All three groups discovered automatically via the `entities/` auto-discovery contract from 03-02 — `cli.py` was never opened.

## Task Commits

1. **Task 1: `apollo projeto` with fundo link (CLI-03)** - `afc1474` (feat)
2. **Task 2: `apollo etapa` with projeto link (CLI-04)** - `e8df701` (feat)
3. **Task 3: `apollo tarefa` with etapa link and date validation (CLI-05)** - `44c699f` (feat)

## Files Created

- `cli/apollo_cli/entities/projeto.py` - `projeto` command group; `_resolve_fundo_link` guards `--fundo-id`.
- `cli/apollo_cli/entities/etapa.py` - `etapa` command group; `_resolve_projeto_link` guards `--projeto-id`; `--ordem` is `type=int`.
- `cli/apollo_cli/entities/tarefa.py` - `tarefa` command group; `_resolve_etapa_link` guards `--etapa-id`; `--tipo-prazo` is `click.Choice(["hard", "soft"])`.
- `cli/tests/test_crud_projeto.py` - Live CRUD round trip, fundo-link resolution proof, optional-field-absence proof, `parent_not_found`/`not_found` guards.
- `cli/tests/test_crud_etapa.py` - Live CRUD round trip, projeto-link resolution proof, numeric `ordem` round-trip proof, `listar --projeto-id` filter proof, CLI-boundary `--ordem` type check.
- `cli/tests/test_crud_tarefa.py` - Live CRUD round trip, etapa-link resolution proof, `dataPrevista` no-timezone-shift proof, `listar --etapa-id` filter proof, invalid-date and invalid-`tipo-prazo` exit-2 proofs.

## Exact Option Names Per Command

**`apollo projeto`**
- `criar`: `--nome` [req], `--status` [req], `--descricao`, `--data-inicio-prevista`, `--data-fim-prevista`, `--fundo-id`
- `editar`: `--id` [req], `--nome`, `--descricao`, `--status`, `--data-inicio-prevista`, `--data-fim-prevista`, `--fundo-id`
- `deletar`: `--id` [req]
- `listar`: `--status`, `--limit`

**`apollo etapa`**
- `criar`: `--nome` [req], `--ordem` (int) [req], `--status` [req], `--projeto-id`
- `editar`: `--id` [req], `--nome`, `--ordem` (int), `--status`, `--projeto-id`
- `deletar`: `--id` [req]
- `listar`: `--projeto-id`, `--status`, `--limit`

**`apollo tarefa`**
- `criar`: `--titulo` [req], `--tipo-prazo` (`hard`|`soft`) [req], `--status` [req], `--descricao`, `--data-prevista`, `--data-prevista-estimada`, `--competencia`, `--etapa-id`
- `editar`: `--id` [req], `--titulo`, `--descricao`, `--tipo-prazo` (`hard`|`soft`), `--data-prevista`, `--data-prevista-estimada`, `--competencia`, `--status`, `--etapa-id`
- `deletar`: `--id` [req]
- `listar`: `--etapa-id`, `--status`, `--limit`

## Status Values Used In Tests

- `projetos`: `"aberto"`, `"fechado"`
- `etapas`: `"aberta"`, `"fechada"`
- `tarefas`: `"aberta"`, `"fechada"`

These are illustrative free-form strings only — the schema does not constrain `status` to an enum for any of the three entities (`i.string().indexed()`), and no fixed vocabulary was introduced in this plan. This is the backstop must-have flagged in the plan frontmatter: Phase 4 (SPA) and Phase 5 (job) need to agree on the real vocabulary before UI dropdowns / job status transitions are built.

## InstantDB Behavior Discovered

- **Link target existence is NOT checked server-side.** Confirmed by design (not empirically forced past the guard, since the guard blocks it): the mitigation for T-03-14 exists precisely because InstantDB's `.link({label: id})` on `client.tx[...].create(...)` would happily accept an id that doesn't resolve to any row — the dangling link only becomes visible when someone queries the nested link back and finds nothing. All three modules block this via `get_entity` before every link write.
- **Linked sub-query results always come back as a list**, not a single dict, when reading a nested link back (e.g. `client.query({"projetos": {"fundo": {}, ...}})` returns `record["fundo"]` as `[{...}]`, one-element list) — this held true even though the schema declares the forward link `has: "one"`. Tests handle both shapes defensively (`isinstance(x, list)`).
- **InstaQL supports dot-path `where` filters across a link** (e.g. `where={"projeto.id": "<uuid>"}` against `etapas`) — confirmed live against the real app. Used for `listar --projeto-id` / `listar --etapa-id` instead of a client-side filter-and-slice.
- **Date fields round-trip without timezone shift** when written as the exact `YYYY-MM-DD` string via `validate_iso_date` — `tarefas.dataPrevista` was read back starting with the same date string that was written (verified via `.startswith(...)` since InstantDB's `i.date()` stores/returns an ISO datetime, not a bare date).

## Deviations from Plan

None — plan executed exactly as written. The `_resolve_*_link` helper is a new pattern (not explicitly named in `crud_helpers`) but was called for by the plan's own interface spec ("Parent-existence rule") and implemented per-module rather than as a shared export, per the key-decisions above.

## Self-Check: PASSED

- `cli/apollo_cli/entities/projeto.py` — FOUND
- `cli/apollo_cli/entities/etapa.py` — FOUND
- `cli/apollo_cli/entities/tarefa.py` — FOUND
- `cli/tests/test_crud_projeto.py` — FOUND
- `cli/tests/test_crud_etapa.py` — FOUND
- `cli/tests/test_crud_tarefa.py` — FOUND
- commit `afc1474` — FOUND
- commit `e8df701` — FOUND
- commit `44c699f` — FOUND
- `git diff --stat cli/apollo_cli/cli.py` — empty (no edit made)
- `cd cli && uv run pytest -q` — 282 passed, 2 skipped (pre-existing, unrelated)
- `cd cli && uv run ruff check . && uv run ruff format --check . && uv run ty check` — all clean
