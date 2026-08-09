---
phase: 03-cli-auth-crud
plan: 05
subsystem: cli
tags: [click, instantdb, cli, crud, audit-log, idempotency]

# Dependency graph
requires:
  - phase: 03-cli-auth-crud
    provides: "plan 03-02's crud_helpers.py (create_entity/update_entity/get_entity/list_entities/emit) and entities/ auto-discovery contract"
provides:
  - "`apollo rotina template criar|editar|deletar|listar` — full CRUD on templatesRotina, including the fundo link and the templateAntecessor self-link"
  - "`apollo rotina instancia listar|status` — structurally-enforced list+status-only surface on instanciasRotina (no criar, no deletar, no gerar-instancias stub)"
  - "`apollo log-inferencia registrar|listar` — append-only Claude inference audit trail"
affects: ["05-rotina-generation-job (attaches gerar-instancias to the existing rotina group)", "04-web-parity"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nested click.Group instances built directly (not via @click.group() decorator) so a group can host sub-groups: `group = click.Group(\"rotina\", help=...)`, then `template`/`instancia` sub-groups added with `group.add_command(...)`"
    - "Self-link validation reuses the same `_resolve_ref`-style get_entity-before-write pattern already used for parent links (fundo), applied here to templatesRotina.antecessor pointing at another templatesRotina row"
    - "Deliberate CLI-surface absence pinned by structural tests reading `group.commands` directly (no live session needed) rather than only asserting via CliRunner exit codes"

key-files:
  created:
    - cli/apollo_cli/entities/rotina.py
    - cli/apollo_cli/entities/log_inferencia.py
    - cli/tests/test_crud_rotina_template.py
    - cli/tests/test_rotina_instancia.py
    - cli/tests/test_log_inferencia.py
  modified: []

key-decisions:
  - "instancia sub-group's `listar` command function is named `listar_instancia` internally but registered via `@instancia.command(name=\"listar\")` (not the bare `.command()` default) to avoid a second auto-named `listar-instancia` command leaking into `--help`"
  - "Group help text for `rotina` avoids the literal string `gerar-instancias` (says 'the Phase 5 generation job' instead) so `apollo rotina --help | grep -c gerar-instancias` stays 0, per the plan's own verification gate"
  - "instanciasRotina test fixture seeds directly via `live_client.tx` in the test body (per plan's <interfaces> note) since no CLI path can create one — this is the one place in the test suite where `tx` is used to set up state rather than only for cleanup"

patterns-established:
  - "A locked absence (no criar/deletar/gerar-instancias) is verified two ways: a structural test on `group.commands` (fast, no live session) and a CLI-surface test asserting `No such command` — both are required so a regression can't slip past either channel"

requirements-completed: [CLI-06, CLI-07, CLI-10]

duration: 12min
completed: 2026-08-09
---

# Phase 03 Plan 05: Rotina Template/Instancia CRUD + Log-Inferencia Audit Trail Summary

**`apollo rotina template` full CRUD (with fundo link and templateAntecessor self-link), `apollo rotina instancia listar|status` with no create/delete, and `apollo log-inferencia registrar|listar` append-only — all three surfaces structurally pinned against widening.**

## Performance

- **Duration:** ~12 min (03:14:07 → 03:16:04 local commit timestamps for the three task commits, plus setup/read time before)
- **Tasks:** 3
- **Files modified:** 5 (2 entity modules, 3 test modules)

## Accomplishments
- `templatesRotina` full CRUD, including validated `--fundo-id` and `--antecessor-id` (self-link) writes and default-`None` boolean flags on `editar` so omission never resets `ativo`/`propagarAtrasoSoft`
- `instanciasRotina` restricted to `listar`/`status` only, with the `status` update payload provably touching just the `status` key — pinned by both a structural command-set test and a live field-by-field round trip
- `logInferenciaClaude` append-only audit log (`registrar`/`listar`) with automatic `createdAt`/`donoId`, no `editar`/`deletar`
- Zero edits to `cli.py` — both new groups (`rotina`, `log-inferencia`) auto-discovered per the existing contract

## Task Commits

Each task was committed atomically:

1. **Task 1: `apollo rotina template` full CRUD with fundo and antecessor links (CLI-06)** - `ed07177` (feat)
2. **Task 2: `apollo rotina instancia listar|status` with structurally-enforced no-create (CLI-07)** - `fb830e3` (feat)
3. **Task 3: `apollo log-inferencia registrar|listar` append-only audit log (CLI-10)** - `02cdf62` (feat)

_Note: Task 1's commit already contains the full nested-group scaffold (`rotina`, `template`, `instancia`) because `rotina.py` was authored as one file before the first `verify` gate; Task 2's commit is the incremental diff on top of it (a docstring fix to keep `apollo rotina --help` free of the literal string `gerar-instancias`) plus its own test module._

## Files Created/Modified
- `cli/apollo_cli/entities/rotina.py` - `group = click.Group("rotina")` with `template` (criar/editar/deletar/listar) and `instancia` (listar/status) sub-groups; no `criar`/`deletar`/`gerar-instancias` on `instancia`
- `cli/apollo_cli/entities/log_inferencia.py` - `group = click.Group("log-inferencia")` with `registrar`/`listar` only
- `cli/tests/test_crud_rotina_template.py` - live full-CRUD + fundo-link + antecessor-self-link + invalid-choice + not-found proofs
- `cli/tests/test_rotina_instancia.py` - structural `{listar, status}` proof, no-`gerar-instancias` proof, `No such command` proof, live listar/status field-by-field round trip, not-found-no-phantom proof
- `cli/tests/test_log_inferencia.py` - structural `{registrar, listar}` proof, live registrar/listar round trip, optional-field-absent-not-null proof, `No such command` proof

## Decisions Made
- Kept the `rotina` nested-group structure exactly as specified in `<interfaces>` (`click.Group("rotina")` → `template`/`instancia` sub-`click.Group`s) so Phase 5 has an unambiguous attach point for `gerar-instancias` directly on the existing `rotina` group object.
- Reworded the `rotina` group's `--help` text to avoid the literal substring `gerar-instancias`, since the plan's own verification command (`apollo rotina --help | grep -c 'gerar-instancias'`) requires a zero count — mentioning the future command name in prose would have failed that gate even though no command exists.
- Used `@instancia.command(name="listar")` instead of the bare decorator to prevent click's default name-from-function-name behavior from registering a stray second `listar-instancia` command alongside the correctly-named `listar`.

## Deviations from Plan

None — plan executed exactly as written. The one self-caught issue (the `gerar-instancias` string appearing in `--help` output) was fixed inline during Task 2's own verification step, before that task's commit, so it is development-time iteration rather than a deviation from a completed/committed state.

## Issues Encountered
- Initial draft of `instancia`'s `listar` command used the bare `@instancia.command()` decorator on a function named `listar_instancia`, which registered as `listar-instancia` (click's auto-kebab-case-from-function-name) in addition to the explicit rename — caught by manually inspecting `apollo rotina instancia --help` output before writing tests, fixed with `@instancia.command(name="listar")`.
- The `rotina` group's help text originally spelled out `apollo rotina gerar-instancias` by name to explain the design rationale; this collided with the plan's literal `grep -c 'gerar-instancias'` verification gate on `apollo rotina --help`. Fixed by rewording to "the Phase 5 generation job" without naming the future command.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (routine-instance generation job) can attach `gerar-instancias` directly to the existing `rotina` group (imported from `apollo_cli.entities.rotina`) — no restructuring needed.
- Phase 5's idempotency contract (`dedupeKey`) is fully protected at the CLI layer: no path creates or re-dates an `instanciasRotina` record.
- Phase 4 (web parity) can mirror the same three command surfaces (`rotina.template`, `rotina.instancia`, `log-inferencia`) 1:1 against the same InstantDB schema and perms.
- No blockers for 03-06 (final phase verification/wrap-up plan).

---
*Phase: 03-cli-auth-crud*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 5 created source/test files and all 3 task commit hashes (`ed07177`, `fb830e3`, `02cdf62`) verified present on disk / in git history.
