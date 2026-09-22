---
phase: 31-cadastro-em-lote
plan: 01
subsystem: cli
tags: [click, instantdb, batch-import, transact, cli-python]

# Dependency graph
requires:
  - phase: 30-lifecycle-templates
    provides: "templatesRotina/fundos CRUD idiom (create_entity, get_entity, link resolution) this plan generalizes to N heterogeneous records"
provides:
  - "apollo import --from-json <arquivo> [--dry-run] — bulk fundos + templatesRotina creation from one JSON batch file, cross-entity references via $local_id, one atomic client.transact()"
  - "cli/apollo_cli/batch_import.py's run_batch_import — reusable by Plan 31-02 (full 18-fundo/84-template onboarding scale + partial-failure-resume) without further changes"
  - "TIPO_GERACAO_CHOICES / DIA_SEMANA_CHOICES promoted to public constants in routine_job.py"
affects: [31-02-full-scale-import, any-future-batch-entity-extension]

# Actuals (#2632)
actuals:
  tokens: 14090
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pass batch validation (form, then reference/cycle) collecting ALL errors before any write — hand-rolled, no jsonschema/pydantic dependency introduced"
    - "Client-side new_id() pre-assignment for N heterogeneous records (generalizes crud_helpers.create_entity's single-record idiom) — every $-reference resolves before any transact chunk is built, no topological sort needed"
    - "One atomic heterogeneous client.transact() across two entity types with ambiguous-post-send-failure recovery (mirrors routine_job.py's own live-proven pattern)"

key-files:
  created:
    - cli/apollo_cli/batch_import.py
    - cli/tests/test_batch_import.py
  modified:
    - cli/apollo_cli/routine_job.py
    - cli/apollo_cli/entities/rotina.py
    - cli/apollo_cli/cli.py

key-decisions:
  - "run_batch_import(client, dono_id, path, *, dry_run=False) -> dict[str, Any] is the module's sole public entry point; report shape is {\"fundos\": {\"created\": [...], \"existing\": [...]}, \"templatesRotina\": {\"created\": [...], \"existing\": [...]}} on success, {\"errors\": [...]} (stderr, exit 2) on validation failure."
  - "Error entries are {\"entity\": str, \"index\": int | None, \"_local_id\": str | None, \"reason\": str} — entity is 'fundos'/'templatesRotina' for per-record errors, or the literal unrecognized key name for a top-level-shape error (e.g. 'instanciasRotina')."
  - "23-code validation reason vocabulary (verbatim, for Plan 31-02 to reuse without re-deriving): arquivo_nao_e_utf8, json_invalido, arquivo_nao_e_objeto_json, chave_nivel_superior_nao_reconhecida, valor_nao_e_lista, registro_nao_e_objeto, local_id_ausente, nome_ausente, codigo_ausente, ativo_invalido, donoId_nao_permitido, tipo_geracao_ausente, tipo_geracao_invalido, regra_competencia_ausente, regra_competencia_invalida, dia_semana_invalido, offset_dias_invalido, propagar_atraso_soft_invalido, local_id_duplicado, fundo_id_referencia_local_nao_encontrada, fundo_id_nao_encontrado, antecessor_id_referencia_local_nao_encontrada, antecessor_id_nao_encontrado, antecessor_ciclico."
  - "EXIT_VALIDATION_ERROR = 2 (Click's own usage-error value, D-04) — distinct from crud_helpers' EXIT_API_ERROR=3/EXIT_NETWORK_ERROR=4 and entities/rotina.py's own _EXIT_INSTANCES_LINKED=5."
  - "Ambiguous post-send transact failure is recovered by re-running _resolve_fundos/_resolve_templates (the same natural-key queries) and checking whether every previously-to-create record now resolves as existing — if so, report everything as existing (recovered, not an error); otherwise re-raise via instant_errors()."

patterns-established:
  - "Bulk cross-entity CLI commands live as a standalone top-level `@apollo.command()` in cli.py (mirroring `doctor`), never under entities/ — 'import' is a reserved Python keyword and a single cross-entity command does not fit entities/__init__.py's per-module click.Group auto-discovery contract."

requirements-completed: [BATCH-01]

coverage:
  - id: D1
    description: "apollo import creates fundos + templatesRotina from one JSON file in a single invocation, cross-entity/same-batch references ($-prefix and bare real id) resolved before any write, live-proven at meaningful scale (4 fundos, 10 templates, 3-hop encadeado chain listed successor-before-antecessor)"
    requirement: BATCH-01
    verification:
      - kind: e2e
        ref: "cli/tests/test_batch_import.py#test_import_creates_fundos_and_templates_end_to_end_at_meaningful_scale"
        status: pass
    human_judgment: false
  - id: D2
    description: "Any invalid record anywhere in the file (missing field, invalid choice, unresolved $-reference, antecessor cycle, forbidden donoId) is rejected with the COMPLETE error list, exit 2, zero writes for the whole file"
    requirement: BATCH-01
    verification:
      - kind: e2e
        ref: "cli/tests/test_batch_import.py#test_import_rejects_whole_file_on_one_broken_record_among_valid_ones"
        status: pass
      - kind: e2e
        ref: "cli/tests/test_batch_import.py#test_import_collects_all_errors_across_multiple_broken_records"
        status: pass
    human_judgment: false
  - id: D3
    description: "Idempotency by natural key (fundos: codigo; templatesRotina: resolved fundoId + nome) — an identical file re-run reports everything existing, zero duplicate rows"
    requirement: BATCH-01
    verification:
      - kind: e2e
        ref: "cli/tests/test_batch_import.py#test_import_same_file_rerun_reports_everything_existing_no_duplicates"
        status: pass
    human_judgment: false
  - id: D4
    description: "--dry-run runs full validation + existence-check + id resolution and reports the same shape a real run would, without ever calling transact"
    requirement: BATCH-01
    verification:
      - kind: e2e
        ref: "cli/tests/test_batch_import.py#test_import_dry_run_reports_created_existing_split_without_writing"
        status: pass
    human_judgment: false
  - id: D5
    description: "The command structurally cannot create an instanciasRotina row, including under a deliberately-crafted top-level instanciasRotina key (C-06 adversarial proof)"
    requirement: BATCH-01
    verification:
      - kind: e2e
        ref: "cli/tests/test_batch_import.py#test_top_level_instanciasrotina_key_rejected_wholesale_c06"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-09-22
status: complete
---

# Phase 31 Plan 1: Cadastro em lote (apollo import) Summary

**`apollo import --from-json <arquivo> [--dry-run]` — one atomic `client.transact()` bulk-creating `fundos` + `templatesRotina` from a single JSON file, with `$local_id`-prefixed cross-entity/same-batch references (including file-order-independent `encadeado` chains), two-pass collect-all-errors validation, and natural-key idempotency — live-proven end-to-end against the real production InstantDB app.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-22
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- New `cli/apollo_cli/batch_import.py` module: `run_batch_import(client, dono_id, path, *, dry_run=False)` — file parse, two-pass validation (form, then reference/cycle detection — never fail-fast, 23-code reason vocabulary), natural-key existence checking (fundos by `codigo`; templatesRotina by `fundo.id`-link + `nome`, grouped per distinct resolved fundoId, plus a client-side-filtered no-fundo group per RESEARCH.md's documented `$isNull` fallback), client-side `new_id()` pre-assignment resolving every `$`-reference before any write, and one atomic heterogeneous `client.transact()` mirroring `routine_job.py`'s own live-proven ambiguous-network-failure recovery.
- `apollo import --from-json/--dry-run` wired as a standalone top-level command in `cli.py`, mirroring `doctor`'s placement (not under `entities/` — `import` is a reserved Python keyword and a single cross-entity command doesn't fit the per-module `click.Group` auto-discovery contract).
- `TIPO_GERACAO_CHOICES`/`DIA_SEMANA_CHOICES` promoted from `entities/rotina.py`'s private module constants to public constants in `routine_job.py`, alongside `REGRAS_COMPETENCIA_SUPORTADAS` — zero behavior change, full offline `rotina`/`routine_job` suite stays green.
- Live-proven at meaningful scale against the real production InstantDB app: 4 fundos + 10 templatesRotina in one transact, spanning a `$`-fundoId reference, a bare/real-id fundoId reference, an absent-fundoId template, and a 3-hop `encadeado` chain deliberately listed successor-before-antecessor (proving file-order independence) — every re-queried `fundo`/`antecessor` link resolved to the correct REAL id.
- Validation completeness proven with a single batch collecting 6 independently-broken records' errors (missing `codigo`, invalid `tipoGeracao`, unresolvable `$`-reference, forbidden `donoId`, 2-node antecessor cycle) in one response, exit 2, zero writes for 2 valid records in the same file.
- `--dry-run` and same-file re-run idempotency both live-proven with zero duplicate rows.
- C-06 closed against BOTH an absent third-entity key (Task 1's own proof) AND a deliberately-crafted adversarial top-level `instanciasRotina` key (Task 2's `test_top_level_instanciasrotina_key_rejected_wholesale_c06`) — wholesale rejection, zero writes for the whole file, live-confirmed unchanged `apollo rotina instancia listar` row count.

## Task Commits

1. **Task 1: apollo import end-to-end — parse, validate, resolve, atomic write, live-proven at meaningful scale (D-01..D-10)** - `335c134` (feat)
2. **Task 2: Validation completeness, --dry-run, and same-file re-run idempotency (D-04, D-09, SC2)** - `9a6a1c8` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

## Files Created/Modified

- `cli/apollo_cli/batch_import.py` - new module: `run_batch_import` (parse → validate → resolve → write → report), `EXIT_VALIDATION_ERROR = 2`
- `cli/tests/test_batch_import.py` - new file: 6 live tests (end-to-end meaningful-scale, zero-write-on-broken-record, multi-error collection, `--dry-run`, re-run idempotency, C-06 adversarial rejection)
- `cli/apollo_cli/cli.py` - added `apollo import --from-json/--dry-run` standalone top-level command
- `cli/apollo_cli/routine_job.py` - promoted `TIPO_GERACAO_CHOICES`/`DIA_SEMANA_CHOICES` to public constants
- `cli/apollo_cli/entities/rotina.py` - now imports all three choice constants from `routine_job` instead of defining two privately

## Decisions Made

None beyond the plan's own locked D-01..D-10 — followed as specified. One implementation-level choice made within Task 1's scope (not a plan deviation, since the plan left it to the implementer): the ambiguous-post-send-transact-failure recovery re-runs the SAME `_resolve_fundos`/`_resolve_templates` functions used for the initial existence check (rather than a bespoke re-check query), keeping exactly one natural-key-query code path in the module.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' live tests passed on the first run against the real production InstantDB app; no auto-fixes (Rules 1-3) were needed.

## Issues Encountered

None. `ruff check`/`ruff format --check`/`ty check` passed on every file on the first or second attempt (only reformatting, no logic fixes), and the full offline regression sweep (405 passed, 2 skipped) plus `test_cli_surface.py` (14 passed, zero edits to that file) stayed green throughout both tasks.

## User Setup Required

None - no external service configuration required. The plan's `<precondition>` (a persisted `apollo auth login` session) was already satisfied at execution start.

## Next Phase Readiness

- `run_batch_import`'s signature, report shape, and full reason-code vocabulary are stable and documented above for Plan 31-02 (Wave 2) to reuse verbatim at the full 18-fundo/84-template onboarding scale and the partial-failure-resume scenario — no changes to this plan's code are anticipated to be needed.
- Live-verified: the account's `instanciasRotina` row count (252 at start of this plan's work) was confirmed unchanged by every live test run in this plan, including the adversarial C-06 test.
- No blockers.

---
*Phase: 31-cadastro-em-lote*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: cli/apollo_cli/batch_import.py
- FOUND: cli/apollo_cli/cli.py
- FOUND: cli/apollo_cli/routine_job.py
- FOUND: cli/apollo_cli/entities/rotina.py
- FOUND: cli/tests/test_batch_import.py
- FOUND: commit 335c134 (Task 1)
- FOUND: commit 9a6a1c8 (Task 2)
