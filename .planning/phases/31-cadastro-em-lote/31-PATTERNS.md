# Phase 31: Cadastro em lote - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 2 new + 0 modified (command wiring touches `cli.py`)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `cli/apollo_cli/batch_import.py` (new — core logic: parse, validate, resolve, query-existing, transact) | service | CRUD (batch, atomic multi-entity) | `cli/apollo_cli/routine_job.py` | exact (same split: pure logic module separate from CLI wiring, same query-then-transact idiom, same ambiguous-failure recovery) |
| `cli/apollo_cli/cli.py` (modified — add `apollo import` top-level command) | route/CLI-wiring | request-response | `cli/apollo_cli/cli.py`'s own `doctor` command (lines 40-67) | exact (both are standalone top-level commands, not per-entity CRUD groups routed through `entities/`) |
| File-reading/parsing step inside `batch_import.py` (`--from-json <arquivo>` argument -> `dict`) | utility | file I/O | `cli/apollo_cli/session.py:95-108` (`load_session`'s `Path.read_text` + `json.loads`) and `cli/apollo_cli/bizdays.py:43` (`Path.read_text` + `json.loads` module-load pattern) | role-match (no CLI-flag-driven file read exists yet; this is the first, but the read+parse idiom is already established for other JSON files) |
| Validation passes (decision 4: forma + referências) inside `batch_import.py` | utility | transform | No existing schema-validation helper — hand-rolled, reusing `entities/rotina.py`'s `_TIPO_GERACAO_CHOICES`/`_DIA_SEMANA_CHOICES` and `routine_job.py`'s `REGRAS_COMPETENCIA_SUPORTADAS` as the source-of-truth value sets | no analog for validation *mechanism* (see "No Analog Found"); strong analog for the *value sets* to reuse |
| Id pre-assignment / `_local_id` resolution (decision 6) inside `batch_import.py` | utility | transform | `cli/apollo_cli/crud_helpers.py:164-188` (`create_entity`: `eid = new_id()` before `client.tx[etype][eid].create(...)`) | exact (decision 6 explicitly generalizes this single-record idiom to N heterogeneous records) |
| Batch existence-check queries (decision 5) inside `batch_import.py` | service | request-response (query) | `cli/apollo_cli/routine_job.py:816` (`"template.id": {"$in": instance_lookup_ids}`) and `:840` (`"dedupeKey": {"$in": keys}`) | exact ($in usage, including the link-dot-path form, both already proven in this codebase) |
| Heterogeneous atomic write (decision 7) inside `batch_import.py` | service | event-driven / batch write | `cli/apollo_cli/routine_job.py:947-966` | exact — this is the literal model CONTEXT.md decision 7 names |

## Pattern Assignments

### `cli/apollo_cli/batch_import.py` (new — service, CRUD/batch)

**Analog:** `cli/apollo_cli/routine_job.py` (whole-file structural analog: a pure-logic module separate from its thin CLI wiring in `entities/rotina.py`'s `gerar_instancias` command).

**Imports pattern** — mirror `routine_job.py`'s own imports plus `crud_helpers`'s exports (`routine_job.py` does not show its own import block distinctly in the excerpts read, but `entities/rotina.py:54-70` shows the exact shape a sibling module imports from both `crud_helpers` and `routine_job`):
```python
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
from instantdb import Instant, InstantAPIError
from instantdb import id as new_id

from apollo_cli.crud_helpers import drop_none, instant_errors
from apollo_cli.entities.rotina import _TIPO_GERACAO_CHOICES, _DIA_SEMANA_CHOICES  # or hoist to a shared constants module — planner's call
from apollo_cli.routine_job import REGRAS_COMPETENCIA_SUPORTADAS
```
Note: `_TIPO_GERACAO_CHOICES`/`_DIA_SEMANA_CHOICES` are currently private (`_`-prefixed) module constants in `cli/apollo_cli/entities/rotina.py:75-76`. Planner must decide: either promote them to non-private exports (rename, drop leading underscore) or duplicate the tuple literal with a comment pointing at the source of truth. CONTEXT.md decision 2 explicitly forbids re-inventing the value list, not necessarily forbids a private-name import — but importing a `_`-prefixed name across modules is against this codebase's own convention (nothing else in the read files does this), so promoting to a shared/non-private name is the pattern-consistent choice.

**File-reading pattern** (`--from-json <arquivo>` -> parsed dict), from `cli/apollo_cli/session.py:95-108`:
```python
raw = path.read_text(encoding="utf-8")
data = json.loads(raw)
```
And the module-level load idiom from `cli/apollo_cli/bizdays.py:43`:
```python
_PAYLOAD: Final[dict[str, object]] = json.loads(_CALENDAR_RESOURCE.read_text(encoding="utf-8"))
```
No existing CLI flag reads an arbitrary user-supplied file path today (`session.py`'s path is a fixed `DEFAULT_SESSION_FILE`/override via env, not a `click.option`) — this is the first `--from-json <arquivo>`-style flag in this codebase. Recommended click declaration, following this codebase's option style (`crud_helpers.validate_iso_date` used as a `callback=` model for flag-time validation):
```python
@click.option(
    "--from-json",
    "from_json_path",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="Caminho para o arquivo JSON do lote (ver --help para o shape esperado).",
)
```
`click.Path(exists=True, ...)` gives free "file not found" handling consistent with Click's own exit-2 usage-error convention (matching how `_resolve_range_override`'s XOR validation and Click's own `BadParameter` already exit 2 elsewhere in this codebase — see `entities/rotina.py:78-86`'s comment about exit code 2 being reserved for Click's own parsing failures). JSON parse errors (`json.JSONDecodeError`) should be caught explicitly and folded into the same `{"errors": [...]}` / exit-2 report shape as decision 4's validation errors, not left to propagate as an uncaught traceback.

**Id pre-assignment pattern** (decision 6), from `cli/apollo_cli/crud_helpers.py:164-188`:
```python
def create_entity(*, etype, fields, links=None) -> str:
    ...
    eid = new_id()
    payload = drop_none(fields) | {"donoId": session.user_id}
    chunk = client.tx[etype][eid].create(payload)
    if links:
        chunk = chunk.link(links)
    ...
```
Decision 6 generalizes this exact idiom: for every `_local_id` not matched by an existence query, call `new_id()` once, store `local_id -> real_id` in a dict, and build `fields`/`links` per record before touching `client.transact` at all — never generate an id inline at transact-build time.

**Batch existence-check query pattern (decision 5)**, from `cli/apollo_cli/routine_job.py:816,840` ($in precedent) — RESEARCH.md's Code Examples section (already live-tested) gives the exact shapes to copy verbatim:
```python
# fundos
result = client.query(
    {"fundos": {"$": {"where": {"codigo": {"$in": codigos}, "donoId": dono_id}}}}
)
existing_fundos = result.get("fundos", [])

# templatesRotina, grouped by resolved fundoId (link dot-path, NOT a scalar "fundoId" key)
result = client.query(
    {
        "templatesRotina": {
            "$": {
                "where": {
                    "fundo.id": fundo_id,
                    "nome": {"$in": nomes},
                    "donoId": dono_id,
                }
            }
        }
    }
)
```
Pitfall (RESEARCH.md, live-confirmed): `templatesRotina` has no scalar `fundoId` attribute in `shared/instant.schema.ts:71-80` — the link is named `fundo` (`shared/instant.schema.ts:128-131`, `fundoTemplatesRotina`), so the where-clause key must be the dot-path `"fundo.id"`, never a bare `"fundoId"` key (a bare key would silently match zero rows, misreporting every existing template as new on re-run).

**Heterogeneous atomic transact + ambiguous-failure recovery (decision 7)**, from `cli/apollo_cli/routine_job.py:947-970` verbatim structure to follow (substituting `dedupeKey` re-check with `codigo`/`(fundo.id, nome)` re-check per decision 7's own text):
```python
chunks = [
    client.tx["fundos"][new_fundo_id].create(fundo_fields)
    for new_fundo_id, fundo_fields in fundos_to_create
] + [
    client.tx["templatesRotina"][new_template_id].create(template_fields).link(links)
    for new_template_id, template_fields, links in templates_to_create
]

try:
    client.transact(chunks)
except (InstantAPIError, httpx.HTTPError):
    # Re-query by natural keys (codigo for fundos; fundo.id+nome for
    # templatesRotina) exactly as routine_job.py:960-965 re-queries by
    # dedupeKey — report landed records as `existing`, only re-raise if the
    # recheck confirms nothing landed.
    ...
```
`routine_job.py:955-958` also shows a `_signal_test_sentinel("about-to-transact")` / `_signal_test_sentinel("transact-returned")` pair bracketing the transact call — this exists purely to let tests simulate a network failure mid-flight; planner should check whether this phase's tracer/live-verification task needs the same test hook, or whether it's routine_job-specific plumbing not worth porting.

**Error/exit-code pattern:** reuse `crud_helpers.instant_errors()` (context manager, `crud_helpers.py:110-136`) for any query/transact call not already wrapped in the try/except above — it maps `InstantAPIError`/`httpx.HTTPError` to the same JSON-stderr + exit-code contract (`EXIT_API_ERROR = 3`, `EXIT_NETWORK_ERROR = 4`) every other command already uses. Decision 4's validation-error report uses **exit 2** (distinct from `EXIT_API_ERROR`/Click's own usage-error range) — `entities/rotina.py:78-87`'s comment on `_EXIT_INSTANCES_LINKED = 5` is the pattern to follow for defining a new, clearly-documented exit-code constant if decision 4's exit 2 needs its own named constant rather than a bare literal.

---

### `cli/apollo_cli/cli.py` (modified — add `apollo import` command)

**Analog:** `cli.py`'s own `doctor` command (lines 40-67) — the only existing top-level, non-entity-group standalone command.

**Core wiring pattern** (lines 20-41 for the group + `doctor`'s shape as the template for a new standalone command):
```python
@apollo.command(name="import")
@click.option(
    "--from-json",
    "from_json_path",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="...",
)
@click.option("--dry-run/--no-dry-run", default=False, help="...")
def import_batch(from_json_path: Path, dry_run: bool) -> None:
    """apollo import --from-json <arquivo> [--dry-run]

    ...docstring mirroring gerar_instancias's tone (entities/rotina.py:659-682)...
    """
    client, session = client_for_session()
    report = run_batch_import(client, session.user_id, from_json_path, dry_run=dry_run)
    emit(report)


apollo.add_command(import_batch)
```
This command is registered directly via `apollo.add_command(...)` in `cli.py`, the same way `doctor` is defined inline and `auth.group` is added at line 36 — **not** through `entities/__init__.py`'s `register_entity_groups` auto-discovery. Rationale: `register_entity_groups` requires every module directly under `entities/` to export a module-level `click.Group` (see `entities/__init__.py:20-35`, which raises `TypeError` for any module missing that contract) — `apollo import` is a single `@click.command()`, not a `@click.group()` of CRUD subcommands, so it does not fit that contract and does not belong under `entities/`. It also is not entity-scoped (it spans `fundos` + `templatesRotina` in one call per decision 1), reinforcing that it belongs at the top level next to `doctor`, not nested inside `fundo` or `rotina`'s groups.

**Module name note:** `import` is a reserved Python keyword — cannot be a module filename imported via `import apollo_cli.entities.import`. This is a second, independent reason (beyond the auto-discovery contract mismatch above) the core logic module must live outside `entities/` with a non-keyword name — `cli/apollo_cli/batch_import.py` (mirroring `routine_job.py` sitting as a sibling top-level module, not nested under `entities/`) is the safe choice. The Click command name itself (`@apollo.command(name="import")`) is unaffected — that's a string, not a Python identifier, so `apollo import` as a CLI-invocable name works fine even though the backing module cannot be literally named `import.py`.

---

## Shared Patterns

### Session/auth acquisition
**Source:** `cli/apollo_cli/crud_helpers.py:104-107` (`client_for_session()`)
**Apply to:** `batch_import.py`'s core function and `cli.py`'s new command — every other command in this codebase acquires the InstantDB client and session via this single call; no bespoke auth path should be introduced for `import`.

### Error handling / exit codes
**Source:** `cli/apollo_cli/crud_helpers.py:35-45` (`emit`/`_emit_err`, one-JSON-document-per-command contract), `:110-136` (`instant_errors()` context manager)
**Apply to:** All query/transact calls inside `batch_import.py` not already covered by decision 7's explicit try/except recovery block.

### `$in` + link dot-path queries
**Source:** `cli/apollo_cli/routine_job.py:816,840`
**Apply to:** Both existence-check queries in `batch_import.py` (decision 5) — `$in: []` is safe (RESEARCH.md Q1, live-tested), no empty-list guard is required for correctness (though skipping the query when the candidate list is empty is a valid, cheaper optimization).

### Id pre-assignment before transact
**Source:** `cli/apollo_cli/crud_helpers.py:164-188` (`create_entity`)
**Apply to:** `batch_import.py`'s `_local_id` resolution step (decision 6) — same `new_id()`-before-`transact` ordering, generalized from 1 record to N heterogeneous records.

### Report shape (`created`/`existing`/`skipped`)
**Source:** `cli/apollo_cli/entities/rotina.py:681-682` (`gerar_instancias`'s docstring: `{"created": [...], "existing": [...], "skipped": [...]}`), backed by `routine_job.py:972-978`'s literal return shape
**Apply to:** `batch_import.py`'s final report (decision 8) — same key names, adapted to per-entity nesting (`{"fundos": {"created": [...], "existing": [...]}, "templatesRotina": {...}}`), and the `--dry-run` labelling convention (decision 9) from `gerar_instancias`'s `--dry-run/--no-dry-run` option (`entities/rotina.py:613-620`).

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Two-pass declarative validation (decision 4: forma pass + reference/cycle pass over a whole parsed JSON document) | utility | transform | No JSON-schema library or validation-helper module exists anywhere in `cli/apollo_cli/` — every existing validation is either a single Click `callback=` (`validate_iso_date`, `_validate_competencia_format`) validating one flag at a time, or `type=click.Choice(...)` for a single option. Nothing validates a whole parsed multi-record document with cross-references and cycle detection today. This must be hand-written from scratch in `batch_import.py`; do not introduce a new dependency (e.g. `jsonschema`, `pydantic`) — this codebase has no precedent for one and RESEARCH.md's "Don't Hand-Roll" table does not flag this as a solved problem, only the query/transact concerns. |
| `--from-json <arquivo>` CLI flag | route/CLI-wiring | file I/O | First file-path-accepting CLI flag in this codebase — `click.Path(exists=True, dir_okay=False, path_type=Path)` is Click's own standard idiom (not project-specific), safe to introduce as this phase's first instance. |
| Cycle detection over `antecessorId` chains within a batch | utility | transform | No existing graph/cycle-detection utility in `cli/apollo_cli/`; `entities/rotina.py`'s `antecessor` handling (`_resolve_ref`) only validates that a single referenced id exists in the DB, it never walks a chain or detects cycles (chains are walked live, one instance at a time, by `routine_job.py`'s generation logic, not by a batch-validation pass). Must be hand-written (a simple DFS/visited-set over the batch's local `_local_id` graph is sufficient — no need for a general-purpose graph library). |

## Metadata

**Analog search scope:** `cli/apollo_cli/` (entities/, crud_helpers.py, routine_job.py, cli.py, session.py, bizdays.py, config.py)
**Files scanned:** `cli.py`, `crud_helpers.py`, `entities/__init__.py`, `entities/fundo.py`, `entities/rotina.py`, `routine_job.py`, `session.py`, `bizdays.py`, `config.py` (grep only), `shared/instant.schema.ts` (schema shape only, via RESEARCH.md's prior reads — not re-read this pass)
**Pattern extraction date:** 2026-09-22
