---
phase: 03-cli-auth-crud
plan: 04
subsystem: cli
tags: [click, instantdb, crud, xor-link]

# Dependency graph
requires:
  - phase: 03-cli-auth-crud
    provides: "03-02's crud_helpers.py plumbing (require_session, create_entity, update_entity, delete_entity, get_entity, list_entities, validate_iso_date) and entities/ auto-discovery contract"
provides:
  - "apollo ticket criar|editar|deletar|listar (CLI-08), with fundo link via get_entity-before-write"
  - "apollo subtarefa criar|editar|deletar|listar (CLI-09), with XOR tarefa/ticket parent enforced in-process before any network call"
affects: [03-05, 03-06, phase-4-parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "XOR parent link resolution via count-then-validate helper (_resolve_parent), raising click.UsageError before any network call"
    - "Boolean flag pair defaulting to None on editar (not False) to avoid silent data loss on partial edits"

key-files:
  created:
    - cli/apollo_cli/entities/ticket.py
    - cli/apollo_cli/entities/subtarefa.py
    - cli/tests/test_crud_ticket.py
    - cli/tests/test_crud_subtarefa.py
  modified: []

key-decisions:
  - "XOR error message text is exactly 'informe exatamente um de --tarefa-id ou --ticket-id' (criar) / 'informe no máximo um de --tarefa-id ou --ticket-id' (editar), naming both flags per acceptance criteria."
  - "subtarefa editar's links argument passes `links or None` so an empty dict (no parent flags given) does not trigger a link-chunk write, leaving the existing parent untouched."
  - "Did not test bypassing the parent-existence guard against real InstantDB (not attempted) — the guard runs entirely client-side before any transact call, so there was no code path to disable for that experiment without editing the module under test."

requirements-completed: [CLI-08, CLI-09]

# Metrics
duration: 25min
completed: 2026-08-09
---

# Phase 03 Plan 04: Ticket & Subtarefa CRUD Summary

**`apollo ticket` and `apollo subtarefa` live CRUD, with subtarefa's tarefa/ticket parent enforced as a structural exclusive-or validated client-side before any InstantDB transact.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-09T12:44:00Z (approx, first read)
- **Completed:** 2026-08-09T13:09:23Z
- **Tasks:** 2
- **Files modified:** 4 (all created, none modified)

## Accomplishments
- `apollo ticket criar|editar|deletar|listar` live CRUD against InstantDB, with `--fundo-id` validated via `get_entity` before linking (`fundoTickets`/`fundo` label), `--data-recebimento`/`--data-prevista` boundary-validated via `validate_iso_date`, `--tipo-prazo` locked to the same `hard`/`soft` vocabulary as `tarefa`.
- `apollo subtarefa criar|editar|deletar|listar` live CRUD with a private `_resolve_parent` helper enforcing exactly-one parent on `criar` and at-most-one on `editar`, raising `click.UsageError` (exit 2) naming both `--tarefa-id`/`--ticket-id` flags before any network call when the count is wrong.
- `--concluida/--nao-concluida` on `editar` defaults to `None` (not `False`), with a dedicated regression test proving `editar --titulo X` alone does not reset `concluida`.
- Both command groups appear in `apollo --help` with zero edits to `cli.py` (auto-discovery via `apollo_cli/entities/`).

## Task Commits

Each task was committed atomically:

1. **Task 1: `apollo ticket` with fundo link (CLI-08)** - `dd9ed9e` (feat)
2. **Task 2: `apollo subtarefa` with XOR tarefa/ticket parent (CLI-09)** - `ba925a6` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `cli/apollo_cli/entities/ticket.py` - `apollo ticket` group; `_resolve_fundo_link` validates `--fundo-id` via `get_entity(etype="fundos", ...)` before `links={"fundo": fundo_id}`.
- `cli/apollo_cli/entities/subtarefa.py` - `apollo subtarefa` group; `_resolve_parent(tarefa_id, ticket_id, *, required)` implements the XOR count check plus per-parent `get_entity` validation.
- `cli/tests/test_crud_ticket.py` - live round trip (create/read/link-resolve/list-by-fundo/list-by-status/edit/delete), `parent_not_found`, invalid date exit 2, invalid `tipo-prazo` exit 2, `not_found` on unknown id for edit/delete.
- `cli/tests/test_crud_subtarefa.py` - live round trip under a throwaway tarefa and separately under a throwaway ticket, both-parents and neither-parent XOR rejection (message names both flags, nothing created), `concluida`/`nao-concluida` round trip, the `editar --titulo` alone regression (concluida unchanged), `ordem` round trip as a number, `listar --tarefa-id`/`--ticket-id` filters, `parent_not_found`, `not_found` on unknown id.

## Decisions Made
- Followed the `tarefa.py`/`fundo.py` pattern exactly: module-private `_resolve_*` helper returning a `links` dict or raising before the network call, `drop_none` on all optional field payloads, dot-path `where` filters (`"fundo.id"`, `"tarefa.id"`, `"ticket.id"`) for `listar`.
- `_resolve_parent`'s `editar` path returns `{}` (not `None`) when no parent flags are given; the call site does `links or None` so `update_entity` never receives an empty-but-truthy links dict.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `ruff format` initially flagged two lines in `test_crud_subtarefa.py` as needing collapse to one line, and `ty check` flagged two `# type: ignore[index]`-suppressed subscript-on-possibly-`None` lines as still erroring (the ignore comment doesn't satisfy `ty`'s narrowing the way it does other type checkers). Fixed by reformatting (ruff) and replacing the inline assertions with intermediate `assert x is not None` + subscript, matching the pattern already used elsewhere in the same test file. Not a deviation from the plan's required behavior — purely a local quality-gate fix within Task 2, folded into its single commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CLI-08 and CLI-09 satisfied; `cli.py` untouched (`git diff --stat cli/apollo_cli/cli.py` empty).
- Full `cli/` suite green: `297 passed, 2 skipped` (skips are the two live-suite session-dependent modules when no session exists, per existing convention — not triggered here since a live session is present).
- `ruff check`, `ruff format --check`, and `ty check` all clean.
- `subtarefas` proven as a real linked entity attachable to exactly one of `tarefas`/`tickets`, matching PROJECT.md C-04.
- Ready for 03-05/03-06 (remaining wave-3 plans and end-to-end parity verification).

---
*Phase: 03-cli-auth-crud*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created files found on disk; both task commits (`dd9ed9e`, `ba925a6`) found in `git log`.
