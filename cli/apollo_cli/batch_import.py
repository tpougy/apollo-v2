"""`apollo import --from-json <arquivo>` — bulk `fundos` + `templatesRotina`
creation from one JSON batch file (BATCH-01, Phase 31).

Scope is deliberately narrow (D-10): this module creates `fundos` and
`templatesRotina` ONLY, never any other entity. In particular it NEVER
creates an `instanciasRotina` row — it defines no constant referencing that
entity type anywhere, and `_validate_top_level` rejects any top-level batch
key other than `fundos`/`templatesRotina` (including a deliberately-crafted
`instanciasRotina` key) before a single record from ANY list is ever
processed (T-31-05/C-06). `apollo rotina gerar-instancias` remains the ONLY
sanctioned creator of `instanciasRotina` records.

Validate-fully-before-any-write contract (D-04, SC1): `run_batch_import`
runs two pure, zero-write passes — form (required fields/types/choices) then
references (every `$<local_id>` resolves, right entity type, no antecessor
cycle) — collecting EVERY problem across BOTH passes, never fail-fast. Any
error anywhere means the FULL error list is emitted, `EXIT_VALIDATION_ERROR`
(2, Click's own usage-error value — this is a malformed/invalid batch FILE,
a usage error in kind), and ZERO writes for the whole file, even when only
one of many records is broken.

Idempotency is by natural key (D-05), never a schema `unique()` constraint
(neither `fundos.codigo` nor `templatesRotina.nome` has one):
`fundos`: `(donoId, codigo)`; `templatesRotina`: `(donoId, resolvedFundoId,
nome)` — `resolvedFundoId` may be `None`, a valid key component, not an
error. A matching existing row is reported `existing`, never recreated.

Id resolution happens entirely BEFORE any transact (D-06): every `_local_id`
(fundos and templatesRotina combined) resolves to either an already-existing
real id (natural-key match) or a freshly client-side-`new_id()`-assigned one
— generalizing `crud_helpers.create_entity`'s single-record idiom to N
heterogeneous records. This means every `$`-reference, including one
same-batch template pointing at ANOTHER same-batch template (an `encadeado`
chain), resolves correctly regardless of file order — no topological sort
needed.

The whole batch's new-only records land in exactly ONE atomic
`client.transact(chunks)` call (D-07, mirrors `routine_job.py:947-970`'s own
heterogeneous-chunk + ambiguous-post-send-failure-recovery pattern
verbatim, substituting `dedupeKey` re-check with `codigo`/`(fundo.id, nome)`
re-check): on an ambiguous `(InstantAPIError, httpx.HTTPError)` after
sending, every attempted natural key is re-queried; if everything attempted
now resolves, the report is returned as fully `existing` (recovered, not an
error); only if the recheck confirms something genuinely did not land is the
error re-raised through `instant_errors()`.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Final, NoReturn

import click
import httpx
from instantdb import Instant, InstantAPIError
from instantdb import id as new_id

from apollo_cli.crud_helpers import drop_none, get_entity, instant_errors, now_iso
from apollo_cli.routine_job import (
    DIA_SEMANA_CHOICES,
    REGRAS_COMPETENCIA_SUPORTADAS,
    TIPO_GERACAO_CHOICES,
)

_ETYPE_FUNDO: Final[str] = "fundos"
_ETYPE_TEMPLATE: Final[str] = "templatesRotina"
_SUPPORTED_TOP_LEVEL_KEYS: Final[frozenset[str]] = frozenset({_ETYPE_FUNDO, _ETYPE_TEMPLATE})

EXIT_VALIDATION_ERROR: Final[int] = 2
"""Deliberately Click's own usage-error value (D-04): a malformed/invalid
batch FILE is a usage error in kind, distinct from
`entities/rotina.py`'s post-query business-state guard
(`_EXIT_INSTANCES_LINKED = 5`)."""


# ---------------------------------------------------------------------------
# Validation (pure — zero writes; the reference pass does read-only queries,
# still zero writes). Never raises, never short-circuits on the first
# problem found.
# ---------------------------------------------------------------------------


def _error(entity: str, index: int | None, local_id: str | None, reason: str) -> dict[str, Any]:
    return {"entity": entity, "index": index, "_local_id": local_id, "reason": reason}


def _local_id_of(record: object) -> str | None:
    if not isinstance(record, dict):
        return None
    value = record.get("_local_id")
    return value if isinstance(value, str) and value else None


def _reference_value_kind(value: object) -> tuple[str, str] | None:
    """Returns `("local", stripped_local_id)` for a `$`-prefixed reference,
    `("real", value)` for a bare/real-id reference, or `None` when the field
    is absent/not a non-empty string (defensive — a form-check issue already
    flagged separately elsewhere; this pass never raises on it)."""
    if not isinstance(value, str) or not value:
        return None
    if value.startswith("$"):
        return ("local", value[1:])
    return ("real", value)


def _validate_top_level(data: object) -> tuple[list[dict[str, Any]], dict[str, list[Any]]]:
    """Returns `(errors, present_lists)`. `present_lists` maps only the
    valid, list-shaped, supported keys that were actually present in `data`
    — every later check consumes `present_lists`, never `data` directly, so
    it never has to re-derive a defensive `.get(key, [])`.

    This is the structural proof this module can never be pointed at
    creating a row of any other entity type (T-31-05/C-06): any key other
    than `fundos`/`templatesRotina` — including a deliberately-crafted
    `instanciasRotina` key — is rejected here, with its own reason code,
    before a single record from ANY list (including the batch's otherwise
    genuinely-valid `fundos`/`templatesRotina` records) is ever processed.
    """
    errors: list[dict[str, Any]] = []
    present: dict[str, list[Any]] = {}

    if not isinstance(data, dict):
        errors.append(_error("_arquivo", None, None, "arquivo_nao_e_objeto_json"))
        return errors, present

    for key, value in data.items():
        if key not in _SUPPORTED_TOP_LEVEL_KEYS:
            errors.append(_error(key, None, None, "chave_nivel_superior_nao_reconhecida"))
            continue
        if not isinstance(value, list):
            errors.append(_error(key, None, None, "valor_nao_e_lista"))
            continue
        present[key] = value

    return errors, present


def _check_fundo_form(index: int, record: object) -> list[dict[str, Any]]:
    if not isinstance(record, dict):
        return [_error(_ETYPE_FUNDO, index, None, "registro_nao_e_objeto")]

    errors: list[dict[str, Any]] = []
    local_id = _local_id_of(record)
    if local_id is None:
        errors.append(_error(_ETYPE_FUNDO, index, None, "local_id_ausente"))

    nome = record.get("nome")
    if not isinstance(nome, str) or not nome:
        errors.append(_error(_ETYPE_FUNDO, index, local_id, "nome_ausente"))

    codigo = record.get("codigo")
    if not isinstance(codigo, str) or not codigo:
        errors.append(_error(_ETYPE_FUNDO, index, local_id, "codigo_ausente"))

    if "ativo" in record and not isinstance(record["ativo"], bool):
        errors.append(_error(_ETYPE_FUNDO, index, local_id, "ativo_invalido"))

    if "donoId" in record:
        errors.append(_error(_ETYPE_FUNDO, index, local_id, "donoId_nao_permitido"))

    return errors


def _check_template_form(index: int, record: object) -> list[dict[str, Any]]:
    if not isinstance(record, dict):
        return [_error(_ETYPE_TEMPLATE, index, None, "registro_nao_e_objeto")]

    errors: list[dict[str, Any]] = []
    local_id = _local_id_of(record)
    if local_id is None:
        errors.append(_error(_ETYPE_TEMPLATE, index, None, "local_id_ausente"))

    nome = record.get("nome")
    if not isinstance(nome, str) or not nome:
        errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "nome_ausente"))

    tipo_geracao = record.get("tipoGeracao")
    if tipo_geracao is None:
        errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "tipo_geracao_ausente"))
    elif tipo_geracao not in TIPO_GERACAO_CHOICES:
        errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "tipo_geracao_invalido"))

    regra_competencia = record.get("regraCompetencia")
    if regra_competencia is None:
        errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "regra_competencia_ausente"))
    elif regra_competencia not in REGRAS_COMPETENCIA_SUPORTADAS:
        errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "regra_competencia_invalida"))

    if "diaSemana" in record and record["diaSemana"] not in DIA_SEMANA_CHOICES:
        errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "dia_semana_invalido"))

    if "offsetDias" in record:
        offset_dias = record["offsetDias"]
        if not isinstance(offset_dias, int) or isinstance(offset_dias, bool):
            errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "offset_dias_invalido"))

    if "ativo" in record and not isinstance(record["ativo"], bool):
        errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "ativo_invalido"))

    if "propagarAtrasoSoft" in record and not isinstance(record["propagarAtrasoSoft"], bool):
        errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "propagar_atraso_soft_invalido"))

    if "donoId" in record:
        errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "donoId_nao_permitido"))

    return errors


def _check_local_id_uniqueness(fundos: list[Any], templates: list[Any]) -> list[dict[str, Any]]:
    """`_local_id` must be unique across BOTH lists combined (D-03) — any
    value occurring more than once anywhere emits one error PER occurrence,
    not one summary error (D-04's "um erro por registro problemático")."""
    occurrences: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for index, record in enumerate(fundos):
        local_id = _local_id_of(record)
        if local_id is not None:
            occurrences[local_id].append((_ETYPE_FUNDO, index))
    for index, record in enumerate(templates):
        local_id = _local_id_of(record)
        if local_id is not None:
            occurrences[local_id].append((_ETYPE_TEMPLATE, index))

    errors: list[dict[str, Any]] = []
    for local_id, spots in occurrences.items():
        if len(spots) > 1:
            for entity, index in spots:
                errors.append(_error(entity, index, local_id, "local_id_duplicado"))
    return errors


def _check_references(
    templates: list[Any], fundo_local_ids: set[str], template_local_ids: set[str]
) -> list[dict[str, Any]]:
    """Defensive against fields a form check already flagged (`.get()`,
    never raises `KeyError`). A `$`-prefixed value must resolve to a
    `_local_id` present in the right same-batch list; a bare/real value must
    resolve via `crud_helpers.get_entity` (closing the same "unchecked
    dangling link" gap `entities/rotina.py`'s `_resolve_ref` closes for the
    single-record CLI path)."""
    errors: list[dict[str, Any]] = []
    for index, record in enumerate(templates):
        if not isinstance(record, dict):
            continue
        local_id = _local_id_of(record)

        fundo_ref = _reference_value_kind(record.get("fundoId"))
        if fundo_ref is not None:
            kind, ref_value = fundo_ref
            if kind == "local":
                if ref_value not in fundo_local_ids:
                    errors.append(
                        _error(
                            _ETYPE_TEMPLATE,
                            index,
                            local_id,
                            "fundo_id_referencia_local_nao_encontrada",
                        )
                    )
            elif get_entity(etype=_ETYPE_FUNDO, eid=ref_value) is None:
                errors.append(_error(_ETYPE_TEMPLATE, index, local_id, "fundo_id_nao_encontrado"))

        antecessor_ref = _reference_value_kind(record.get("antecessorId"))
        if antecessor_ref is not None:
            kind, ref_value = antecessor_ref
            if kind == "local":
                if ref_value not in template_local_ids:
                    errors.append(
                        _error(
                            _ETYPE_TEMPLATE,
                            index,
                            local_id,
                            "antecessor_id_referencia_local_nao_encontrada",
                        )
                    )
            elif get_entity(etype=_ETYPE_TEMPLATE, eid=ref_value) is None:
                errors.append(
                    _error(_ETYPE_TEMPLATE, index, local_id, "antecessor_id_nao_encontrado")
                )
    return errors


def _check_antecessor_cycles(templates: list[Any]) -> list[dict[str, Any]]:
    """Directed graph over ONLY the `$`-prefixed `antecessorId` edges among
    the batch's own templates (a bare/real `antecessorId` is an external,
    already-persisted record — never part of a same-batch cycle by
    construction). Plain DFS with white/grey/black marking; every
    `_local_id` participating in a detected cycle (including a direct
    self-reference) emits its own cycle-reason error."""
    index_by_local_id: dict[str, int] = {}
    edges: dict[str, str] = {}
    for index, record in enumerate(templates):
        if not isinstance(record, dict):
            continue
        local_id = _local_id_of(record)
        if local_id is None:
            continue
        index_by_local_id.setdefault(local_id, index)
        antecessor_ref = _reference_value_kind(record.get("antecessorId"))
        if antecessor_ref is not None and antecessor_ref[0] == "local":
            edges[local_id] = antecessor_ref[1]

    white, grey, black = 0, 1, 2
    color: dict[str, int] = dict.fromkeys(index_by_local_id, white)
    in_cycle: set[str] = set()

    def visit(node: str, stack: list[str]) -> None:
        color[node] = grey
        stack.append(node)
        target = edges.get(node)
        if target is not None and target in color:
            if color[target] == grey:
                cycle_start = stack.index(target)
                in_cycle.update(stack[cycle_start:])
            elif color[target] == white:
                visit(target, stack)
        stack.pop()
        if color[node] == grey:
            color[node] = black

    for local_id in index_by_local_id:
        if color[local_id] == white:
            visit(local_id, [])

    return [
        _error(_ETYPE_TEMPLATE, index_by_local_id[local_id], local_id, "antecessor_ciclico")
        for local_id in sorted(in_cycle)
    ]


def _emit_validation_errors(errors: list[dict[str, Any]]) -> NoReturn:
    click.echo(json.dumps({"errors": errors}, sort_keys=True), err=True)
    raise SystemExit(EXIT_VALIDATION_ERROR)


# ---------------------------------------------------------------------------
# Resolution (read-only queries + id pre-assignment, zero writes — D-06
# generalized to N heterogeneous records; runs ONLY when validation found
# zero errors, so every field indexed below via `record["..."]` is
# guaranteed present/well-typed by the checks above).
# ---------------------------------------------------------------------------


def _resolve_fundos(
    client: Instant, dono_id: str, fundos: list[dict[str, Any]]
) -> tuple[dict[str, str], list[str], list[str], list[tuple[str, dict[str, Any]]]]:
    """Returns `(local_id_to_real_id, created_local_ids, existing_local_ids,
    to_create)` — `to_create` is `[(new_id, create_fields), ...]`,
    `create_fields` never containing `donoId` (injected once at
    chunk-build time, never per-record)."""
    codigos = [record["codigo"] for record in fundos]
    existing_by_codigo: dict[str, str] = {}
    if codigos:
        with instant_errors():
            result = client.query(
                {"fundos": {"$": {"where": {"codigo": {"$in": codigos}, "donoId": dono_id}}}}
            )
        for row in result.get("fundos", []):
            existing_by_codigo[row["codigo"]] = row["id"]

    local_id_to_real_id: dict[str, str] = {}
    created_local_ids: list[str] = []
    existing_local_ids: list[str] = []
    to_create: list[tuple[str, dict[str, Any]]] = []

    for record in fundos:
        local_id = record["_local_id"]
        codigo = record["codigo"]
        existing_id = existing_by_codigo.get(codigo)
        if existing_id is not None:
            local_id_to_real_id[local_id] = existing_id
            existing_local_ids.append(local_id)
            continue
        eid = new_id()
        local_id_to_real_id[local_id] = eid
        created_local_ids.append(local_id)
        fields = {
            "nome": record["nome"],
            "codigo": codigo,
            "ativo": record.get("ativo", True),
            "createdAt": now_iso(),
        }
        to_create.append((eid, fields))

    return local_id_to_real_id, created_local_ids, existing_local_ids, to_create


def _resolved_fundo_id(
    record: dict[str, Any], fundo_local_id_to_real_id: dict[str, str]
) -> str | None:
    fundo_id_value = record.get("fundoId")
    if fundo_id_value is None:
        return None
    if isinstance(fundo_id_value, str) and fundo_id_value.startswith("$"):
        return fundo_local_id_to_real_id[fundo_id_value[1:]]
    return fundo_id_value


def _resolve_templates(
    client: Instant,
    dono_id: str,
    templates: list[dict[str, Any]],
    fundo_local_id_to_real_id: dict[str, str],
) -> tuple[dict[str, str], list[str], list[str], list[tuple[str, dict[str, Any], dict[str, str]]]]:
    """Returns `(local_id_to_real_id, created_local_ids, existing_local_ids,
    to_create)` — `to_create` is `[(new_id, create_fields, links), ...]`.
    Requires fundos already resolved (`fundo_local_id_to_real_id`): every
    template's `fundo.id`-scoped existence query depends on it, and a
    same-batch `antecessorId` reference (to a template that may itself be
    new OR existing) is resolved in a SECOND pass below, once every
    template's own `local_id_to_real_id` entry is known — no topological
    sort needed (D-06), regardless of file order.
    """
    groups: dict[str | None, list[dict[str, Any]]] = defaultdict(list)
    for record in templates:
        groups[_resolved_fundo_id(record, fundo_local_id_to_real_id)].append(record)

    existing_by_key: dict[tuple[str | None, str], str] = {}

    for fundo_id, group_records in groups.items():
        nomes = [record["nome"] for record in group_records]
        if fundo_id is not None:
            with instant_errors():
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
            for row in result.get("templatesRotina", []):
                existing_by_key[(fundo_id, row["nome"])] = row["id"]
        else:
            # No-fundo group (D-05's `(donoId, None, nome)` key): fetch every
            # donoId-scoped template with `fundo` expanded and filter
            # client-side for an absent link — RESEARCH.md's documented
            # fallback for the untested `$isNull` operator, the same
            # falsy-or-absent idiom `rotina.py`'s `limpar_orfas` already
            # uses for orphan detection.
            with instant_errors():
                result = client.query(
                    {"templatesRotina": {"fundo": {}, "$": {"where": {"donoId": dono_id}}}}
                )
            nomes_set = set(nomes)
            for row in result.get("templatesRotina", []):
                if row.get("fundo"):
                    continue
                if row["nome"] in nomes_set:
                    existing_by_key[(None, row["nome"])] = row["id"]

    local_id_to_real_id: dict[str, str] = {}
    created_local_ids: list[str] = []
    existing_local_ids: list[str] = []
    pending_create: list[tuple[str, dict[str, Any], dict[str, Any]]] = []

    for record in templates:
        local_id = record["_local_id"]
        fundo_id = _resolved_fundo_id(record, fundo_local_id_to_real_id)
        key = (fundo_id, record["nome"])
        existing_id = existing_by_key.get(key)
        if existing_id is not None:
            local_id_to_real_id[local_id] = existing_id
            existing_local_ids.append(local_id)
            continue
        eid = new_id()
        local_id_to_real_id[local_id] = eid
        created_local_ids.append(local_id)
        fields = drop_none(
            {
                "nome": record["nome"],
                "tipoGeracao": record["tipoGeracao"],
                "regraCompetencia": record["regraCompetencia"],
                "propagarAtrasoSoft": record.get("propagarAtrasoSoft", False),
                "ativo": record.get("ativo", True),
                "offsetDias": record.get("offsetDias"),
                "diaSemana": record.get("diaSemana"),
            }
        )
        pending_create.append((eid, fields, record))

    # Second pass: build links now that EVERY template's local_id ->
    # real_id is known (both newly-created and pre-existing) — a same-batch
    # antecessor reference resolves correctly regardless of file order.
    to_create: list[tuple[str, dict[str, Any], dict[str, str]]] = []
    for eid, fields, record in pending_create:
        links: dict[str, str] = {}
        fundo_id = _resolved_fundo_id(record, fundo_local_id_to_real_id)
        if fundo_id is not None:
            links["fundo"] = fundo_id
        antecessor_value = record.get("antecessorId")
        if isinstance(antecessor_value, str) and antecessor_value:
            if antecessor_value.startswith("$"):
                links["antecessor"] = local_id_to_real_id[antecessor_value[1:]]
            else:
                links["antecessor"] = antecessor_value
        to_create.append((eid, fields, links))

    return local_id_to_real_id, created_local_ids, existing_local_ids, to_create


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def run_batch_import(
    client: Instant, dono_id: str, path: Path, *, dry_run: bool = False
) -> dict[str, Any]:
    """Parse -> validate (form + references, D-04) -> resolve (D-06) ->
    write (D-07) -> report (D-08).

    On any validation error: emits `{"errors": [...]}` to stderr (`_error`
    dicts: `{"entity", "index", "_local_id", "reason"}`) and exits
    `EXIT_VALIDATION_ERROR` (2) — zero writes, full error list, never
    fail-fast.

    On success: returns `{"fundos": {"created": [...], "existing": [...]},
    "templatesRotina": {"created": [...], "existing": [...]}}` — every list
    holds sorted `_local_id`s (never real InstantDB ids), for human
    traceability against what the operator wrote (D-08).

    `dry_run=True` runs validation + existence-check + id resolution in
    full and returns the same report shape, but NEVER calls `transact`
    (D-09).
    """
    try:
        raw = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        _emit_validation_errors([_error("_arquivo", None, None, "arquivo_nao_e_utf8")])

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        _emit_validation_errors([_error("_arquivo", None, None, "json_invalido")])

    top_level_errors, present = _validate_top_level(data)
    fundos = present.get(_ETYPE_FUNDO, [])
    templates = present.get(_ETYPE_TEMPLATE, [])

    errors: list[dict[str, Any]] = list(top_level_errors)
    for index, record in enumerate(fundos):
        errors.extend(_check_fundo_form(index, record))
    for index, record in enumerate(templates):
        errors.extend(_check_template_form(index, record))
    errors.extend(_check_local_id_uniqueness(fundos, templates))

    fundo_local_ids = {
        local_id for record in fundos if (local_id := _local_id_of(record)) is not None
    }
    template_local_ids = {
        local_id for record in templates if (local_id := _local_id_of(record)) is not None
    }
    errors.extend(_check_references(templates, fundo_local_ids, template_local_ids))
    errors.extend(_check_antecessor_cycles(templates))

    if errors:
        _emit_validation_errors(errors)

    fundo_id_map, fundos_created, fundos_existing, fundos_to_create = _resolve_fundos(
        client, dono_id, fundos
    )
    _template_id_map, templates_created, templates_existing, templates_to_create = (
        _resolve_templates(client, dono_id, templates, fundo_id_map)
    )

    report: dict[str, Any] = {
        "fundos": {"created": sorted(fundos_created), "existing": sorted(fundos_existing)},
        "templatesRotina": {
            "created": sorted(templates_created),
            "existing": sorted(templates_existing),
        },
    }

    if dry_run:
        return report

    chunks: list[Any] = [
        client.tx[_ETYPE_FUNDO][eid].create(fields | {"donoId": dono_id})
        for eid, fields in fundos_to_create
    ] + [
        (
            client.tx[_ETYPE_TEMPLATE][eid].create(fields | {"donoId": dono_id}).link(links)
            if links
            else client.tx[_ETYPE_TEMPLATE][eid].create(fields | {"donoId": dono_id})
        )
        for eid, fields, links in templates_to_create
    ]

    if not chunks:
        return report

    try:
        client.transact(chunks)
    except (InstantAPIError, httpx.HTTPError):
        # Ambiguous post-send failure (D-07, mirrors routine_job.py:955-970
        # verbatim): re-query every attempted natural key. Everything now
        # resolving means the batch actually landed — report it as fully
        # `existing`, recovered, never re-raise. Anything still missing is a
        # genuine failure, propagated via instant_errors()'s standard
        # api_error/network JSON + exit 3/4 contract.
        recheck_fundo_map, _rf_created, _rf_existing, recheck_fundos_to_create = _resolve_fundos(
            client, dono_id, fundos
        )
        _rt_map, _rt_created, _rt_existing, recheck_templates_to_create = _resolve_templates(
            client, dono_id, templates, recheck_fundo_map
        )
        if recheck_fundos_to_create or recheck_templates_to_create:
            with instant_errors():
                raise
        return {
            "fundos": {"created": [], "existing": sorted(fundos_created + fundos_existing)},
            "templatesRotina": {
                "created": [],
                "existing": sorted(templates_created + templates_existing),
            },
        }

    return report
