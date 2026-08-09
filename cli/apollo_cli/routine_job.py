"""Python twin of the idempotent routine-instance generation job.

This module implements the EXACT SAME algorithm as
`web/src/lib/routineJob.ts` (plans 05-02/05-03/05-04). `shared/
routine-job.testcases.json` is the single cross-runtime fixture proving the
two implementations never silently diverge — the same pattern `shared/
bizdays.testcases.json` established for `bizdays.ts`/`bizdays.py` in Phase 2.

The pure section below (everything above the `--- I/O boundary ---` comment)
is deterministic and side-effect-free: no `Instant`, no `httpx`, no
filesystem access. It computes the set of `instanciasRotina` that OUGHT to
exist for a given set of active templates as of `today`, without ever
writing anything. Everything below the boundary orchestrates the live
query -> diff -> transact cycle against InstantDB, mirroring plan 05-03's
"Orchestration specification" and plan 05-04's antecessor-query widening.

`dedupeKey` is deliberately plain string concatenation
(`f"{template_id}:{competencia}:{data_prevista}"`), NOT a derived hash of any
kind (RESEARCH Assumption A5). The uniqueness guarantee lives in the
`instanciasRotina.dedupeKey.unique()` schema constraint, not in the key's
entropy — plain concatenation stays human-debuggable in
`apollo rotina instancia listar` output and removes any risk of a TS/Python
hash-output mismatch.

`encadeado`'s semantics are the phase's one interpretive decision, recorded
here so a reader never has to reconstruct them from the plan:

- **D-05-B**: `offsetDias` counts BUSINESS days after the antecessor
  instance's `dataPrevista`, via `add_business_days`.
- **D-05-D**: `competencia` is INHERITED verbatim from the antecessor
  instance being chained off; the encadeado template's own
  `regraCompetencia` is never consulted. An encadeado template with
  `regraCompetencia: "manual"` still generates instances — that field is
  simply not part of its date derivation.
- **D-05-E**: `dataPrevistaEstimada` (mirroring `dataPrevista`) is set when
  the antecessor's instance for that competencia is EITHER not yet
  persisted (computed in this same run) OR persisted with
  `status != "concluida"`. It is omitted once the antecessor's instance
  reads `concluida`.
- **D-05-F**: the antecessor's own PLANNED `dataPrevista` is used even when
  the antecessor is late — delay propagation is out of scope
  (PROJECT.md C-09). This keeps the encadeado `dedupeKey` stable across
  runs; a key derived from a moving date would re-create the successor on
  every run and destroy idempotency.

`propagarAtrasoSoft` is stored on the template but never read anywhere in
this module (C-09) — delay propagation is explicitly out of scope.

Chained (`encadeado`) templates are resolved via a bounded multi-pass
topological sweep (at most `len(templates)` passes): non-chained templates
resolve first, then chained templates resolve once their antecessor's
instance set is known. Anything still unresolved after the bound has a
cycle or a dangling antecessor and is reported in `skipped` as
`antecessor_ciclico` rather than looping forever.

Calendar math is imported exclusively from `apollo_cli.bizdays`
(`is_business_day`/`add_business_days`) — never a second calendar source
(C-03); `bizdays.py`'s own docstring states why. The last day of a month is
computed via `calendar.monthrange` (stdlib), aliased as `pycalendar` to keep
it visually distinct from the vendored-ANBIMA "calendar" concept
`bizdays.py` owns.
"""

from __future__ import annotations

import calendar as pycalendar
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, Final, NamedTuple

import httpx
from instantdb import Instant, InstantAPIError, lookup

from apollo_cli.bizdays import (
    CalendarRangeError,
    InvalidDateError,
    add_business_days,
    is_business_day,
)
from apollo_cli.crud_helpers import instant_errors

TIPO_PRAZO_GERADO: Final[str] = "soft"  # D-05-C
STATUS_INICIAL: Final[str] = "pendente"
REGRAS_COMPETENCIA_SUPORTADAS: Final[tuple[str, ...]] = ("M0", "M-1", "M-2", "M+1")

_DELTA_BY_RULE: Final[dict[str, int]] = {"M0": 0, "M-1": -1, "M-2": -2, "M+1": 1}


class ComputeResult(NamedTuple):
    """`expected` sorted ascending by `dedupeKey`; `skipped` sorted ascending
    by `templateId`, then `reason`.
    """

    expected: list[dict[str, Any]]
    skipped: list[dict[str, Any]]


class _OffsetValidation(NamedTuple):
    ok: bool
    reason: str | None = None


class _AntecessorRecord(NamedTuple):
    competencia: str
    data_prevista: str
    status: str
    persisted: bool


_NthDayFn = Callable[[int, int, int], str]


def _pad(value: int, width: int) -> str:
    return str(value).zfill(width)


def _format_iso(year: int, month: int, day: int) -> str:
    return f"{_pad(year, 4)}-{_pad(month, 2)}-{_pad(day, 2)}"


def _last_day_of_month(year: int, month: int) -> int:
    return pycalendar.monthrange(year, month)[1]


def end_of_next_month(today: str) -> str:
    year_str, month_str = today.split("-")[:2]
    year = int(year_str)
    month = int(month_str)

    next_month = 1 if month == 12 else month + 1
    next_month_year = year + 1 if month == 12 else year

    last_day = _last_day_of_month(next_month_year, next_month)
    return _format_iso(next_month_year, next_month, last_day)


def nth_business_day_of_month(year: int, month: int, n: int) -> str:
    day1 = _format_iso(year, month, 1)
    first = day1 if is_business_day(day1) else add_business_days(day1, 1)
    return first if n <= 1 else add_business_days(first, n - 1)


def nth_calendar_day_of_month(year: int, month: int, n: int) -> str:
    last_day = _last_day_of_month(year, month)
    clamped_day = min(n, last_day)
    return _format_iso(year, month, clamped_day)


def shift_competencia(data_prevista: str, regra_competencia: str) -> str | None:
    # Deliberately NOT trimmed: a trailing/leading space is a distinct,
    # unrecognized value here, not a formatting nuisance to tolerate.
    if regra_competencia not in REGRAS_COMPETENCIA_SUPORTADAS:
        return None

    year_str, month_str = data_prevista.split("-")[:2]
    year = int(year_str)
    month = int(month_str)  # 1-based

    delta = _DELTA_BY_RULE[regra_competencia]

    # month is 1-based; convert to a 0-based total-months count, apply the
    # delta, then normalize back — Python's floor-division `//`/`%` on a
    # negative total already produces the correct year rollover in either
    # direction, mirroring `Date.UTC`'s own wraparound arithmetic.
    total = (month - 1) + delta
    shifted_year = year + total // 12
    shifted_month = total % 12 + 1
    return f"{_pad(shifted_year, 4)}-{_pad(shifted_month, 2)}"


def build_dedupe_key(template_id: str, competencia: str, data_prevista: str) -> str:
    return f"{template_id}:{competencia}:{data_prevista}"


def _validate_offset_dias(offset_dias: object, min_value: int) -> _OffsetValidation:
    if offset_dias is None:
        return _OffsetValidation(False, "offset_dias_ausente")
    if not isinstance(offset_dias, int) or isinstance(offset_dias, bool) or offset_dias < min_value:
        return _OffsetValidation(False, "offset_dias_invalido")
    return _OffsetValidation(True, None)


def _compute_fixed_instances(
    template: dict[str, Any],
    today: str,
    range_start: str,
    range_end: str,
    min_offset_dias: int,
    nth_day_fn: _NthDayFn,
) -> tuple[list[dict[str, Any]], str | None]:
    """Returns `(instances, skip_reason)` — exactly one side is meaningful:
    a non-empty `skip_reason` means `instances` must be ignored. Raises on
    any underlying business-day computation error (e.g. `CalendarRangeError`)
    so the caller's per-template try/except can convert it to a skip — this
    function itself never catches.
    """
    validation = _validate_offset_dias(template.get("offsetDias"), min_offset_dias)
    if not validation.ok:
        return [], validation.reason
    offset_dias = template["offsetDias"]

    today_year_str, today_month_str = today.split("-")[:2]
    today_year = int(today_year_str)
    today_month = int(today_month_str)
    next_month = 1 if today_month == 12 else today_month + 1
    next_month_year = today_year + 1 if today_month == 12 else today_year

    candidate_months = [(today_year, today_month), (next_month_year, next_month)]

    instances: list[dict[str, Any]] = []
    for year, month in candidate_months:
        data_prevista = nth_day_fn(year, month, offset_dias)
        if data_prevista < range_start or data_prevista > range_end:
            continue

        competencia = shift_competencia(data_prevista, template["regraCompetencia"])
        if competencia is None:
            return [], "regra_competencia_nao_suportada"

        instances.append(
            {
                "dedupeKey": build_dedupe_key(template["id"], competencia, data_prevista),
                "templateId": template["id"],
                "competencia": competencia,
                "dataPrevista": data_prevista,
                "tipoPrazo": TIPO_PRAZO_GERADO,
            }
        )

    return instances, None


def _lookup_antecessor_instances(
    antecessor_id: str,
    computed_by_template_id: dict[str, list[dict[str, Any]]],
    existing_by_template_id: dict[str, list[dict[str, Any]]],
) -> dict[str, _AntecessorRecord]:
    """Merges this run's freshly-computed instances for `antecessor_id` with
    any already-persisted `existing` rows for the same template, keyed by
    competencia. Persisted entries take precedence over computed ones for the
    same competencia.
    """
    by_competencia: dict[str, _AntecessorRecord] = {}

    for inst in computed_by_template_id.get(antecessor_id, []):
        by_competencia[inst["competencia"]] = _AntecessorRecord(
            competencia=inst["competencia"],
            data_prevista=inst["dataPrevista"],
            status=STATUS_INICIAL,
            persisted=False,
        )

    for row in existing_by_template_id.get(antecessor_id, []):
        by_competencia[row["competencia"]] = _AntecessorRecord(
            competencia=row["competencia"],
            data_prevista=row["dataPrevista"],
            status=row["status"],
            persisted=True,
        )

    return by_competencia


def compute_expected_instances(
    templates: list[dict[str, Any]],
    today: str,
    existing: list[dict[str, Any]],
) -> ComputeResult:
    range_start = today
    range_end = end_of_next_month(today)

    expected: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    # Instances computed THIS run, keyed by templateId — grows across both
    # the fixed-offset loop below and the encadeado sweep, so a two-level
    # chain (A -> B -> C) can resolve C off B's freshly-computed
    # (not-yet-persisted) instances within the same call.
    computed_by_template_id: dict[str, list[dict[str, Any]]] = {}

    # Already-persisted instances, grouped by templateId regardless of that
    # template's own `ativo` flag — an inactive antecessor's persisted
    # instances must still be visible to an active encadeado successor.
    existing_by_template_id: dict[str, list[dict[str, Any]]] = {}
    for row in existing:
        existing_by_template_id.setdefault(row["templateId"], []).append(row)

    # Pass 1: fixed-offset types (du_fixo, corrido_fixo) and
    # genuinely-unknown tipoGeracao values. encadeado is deliberately
    # excluded here — it is resolved in the topological sweep below, once
    # antecessor instance sets are known.
    pending_encadeado: list[tuple[dict[str, Any], int]] = []

    for template in templates:
        if template.get("ativo") is False:
            continue

        tipo_geracao = template.get("tipoGeracao")

        if tipo_geracao == "encadeado":
            antecessor = template.get("antecessor")
            if not antecessor or not antecessor.get("id"):
                skipped.append({"templateId": template["id"], "reason": "antecessor_ausente"})
                continue
            # D-05-B: offsetDias counts business days after the antecessor's
            # dataPrevista and may be 0 (same day) — never negative.
            validation = _validate_offset_dias(template.get("offsetDias"), 0)
            if not validation.ok:
                skipped.append(
                    {"templateId": template["id"], "reason": validation.reason}
                )
                continue
            pending_encadeado.append((template, template["offsetDias"]))
            continue

        try:
            if tipo_geracao == "du_fixo":
                instances, skip_reason = _compute_fixed_instances(
                    template, today, range_start, range_end, 1, nth_business_day_of_month
                )
            elif tipo_geracao == "corrido_fixo":
                instances, skip_reason = _compute_fixed_instances(
                    template, today, range_start, range_end, 1, nth_calendar_day_of_month
                )
            else:
                skipped.append(
                    {"templateId": template["id"], "reason": "tipo_geracao_desconhecido"}
                )
                continue

            if skip_reason is not None:
                skipped.append({"templateId": template["id"], "reason": skip_reason})
                continue

            computed_by_template_id[template["id"]] = instances
            expected.extend(instances)
        except (CalendarRangeError, InvalidDateError):
            # Per-template isolation (RESEARCH Pitfall 4): any underlying
            # error (e.g. CalendarRangeError from bizdays.py when offsetDias
            # pushes the computed date past the vendored calendar's range) is
            # caught here so one misconfigured/out-of-range template never
            # aborts the others. There is no dedicated SkipReason for this
            # case in the locked enum; it is treated as an invalid offset,
            # since it is the offset that drove the computation out of
            # bounds.
            skipped.append({"templateId": template["id"], "reason": "offset_dias_invalido"})

    # Pass 2: bounded multi-pass topological sweep over encadeado templates.
    # `pending_ids` tracks which encadeado templates are still unresolved; a
    # template is "ready" the moment its antecessor id is no longer in that
    # set — true immediately for non-chained/inactive antecessors, and true
    # for a chained antecessor once ITS turn resolves (possibly within the
    # same pass). Anything still pending when the bound is exhausted has a
    # cycle or a dangling antecessor id and is reported, never hung on.
    pending_ids = {template["id"] for template, _ in pending_encadeado}
    remaining = pending_encadeado

    for _pass_index in range(len(templates)):
        if not remaining:
            break

        still_pending: list[tuple[dict[str, Any], int]] = []

        for template, offset_dias in remaining:
            antecessor_id = template["antecessor"]["id"]

            if antecessor_id in pending_ids:
                still_pending.append((template, offset_dias))
                continue

            antecessor_instances = _lookup_antecessor_instances(
                antecessor_id, computed_by_template_id, existing_by_template_id
            )

            if not antecessor_instances:
                skipped.append(
                    {"templateId": template["id"], "reason": "antecessor_sem_instancia"}
                )
                pending_ids.discard(template["id"])
                continue

            try:
                instances: list[dict[str, Any]] = []
                for record in antecessor_instances.values():
                    # D-05-B: business days after the antecessor's PLANNED
                    # dataPrevista (D-05-F — never a re-derived/late date,
                    # which would move the dedupeKey and break idempotency).
                    data_prevista = add_business_days(record.data_prevista, offset_dias)
                    if data_prevista < range_start or data_prevista > range_end:
                        continue

                    # D-05-D: competencia is inherited verbatim from the
                    # antecessor instance — this template's own
                    # regraCompetencia is never consulted.
                    competencia = record.competencia

                    # D-05-E: mark the date as provisional whenever the
                    # antecessor's instance is not yet persisted, or is
                    # persisted but not yet "concluida".
                    estimada = (not record.persisted) or record.status != "concluida"

                    instance: dict[str, Any] = {
                        "dedupeKey": build_dedupe_key(template["id"], competencia, data_prevista),
                        "templateId": template["id"],
                        "competencia": competencia,
                        "dataPrevista": data_prevista,
                    }
                    if estimada:
                        instance["dataPrevistaEstimada"] = data_prevista
                    instance["tipoPrazo"] = TIPO_PRAZO_GERADO
                    instances.append(instance)

                computed_by_template_id[template["id"]] = instances
                expected.extend(instances)
            except (CalendarRangeError, InvalidDateError):
                # Same per-template isolation as the fixed-offset loop above.
                skipped.append({"templateId": template["id"], "reason": "offset_dias_invalido"})

            pending_ids.discard(template["id"])

        remaining = still_pending

    # Bound exhausted: whatever is left forms a cycle (or chains through a
    # dangling antecessor id that never resolves) — report, never loop.
    for template, _offset_dias in remaining:
        skipped.append({"templateId": template["id"], "reason": "antecessor_ciclico"})

    expected.sort(key=lambda instance: instance["dedupeKey"])
    skipped.sort(key=lambda item: (item["templateId"], item["reason"]))

    return ComputeResult(expected=expected, skipped=skipped)


# --- I/O boundary: everything below this line talks to InstantDB -----------
#
# Everything above this comment is the pure, zero-I/O compute core mirroring
# `web/src/lib/routineJob.ts`. Everything below orchestrates the live
# query -> diff -> transact path against the InstantDB Python SDK, per plan
# 05-03's "Orchestration specification" and plan 05-04's antecessor-query
# widening.


def to_iso_date(value: object) -> str:
    """Normalizes any DB-sourced date value to a plain `YYYY-MM-DD` string.

    `dataPrevista` is stored as an `i.date()` attribute and can round-trip
    from InstantDB as an ISO *datetime* string (e.g.
    `"2026-09-10T00:00:00.000Z"`) or as a plain `YYYY-MM-DD` string depending
    on environment — proven by `cli/tests/test_rotina_instancia.py`, which
    asserts with `.startswith(...)`, not `==`. A missed normalization here
    would make every existing instance look "new" on every run and duplicate
    the entire table.
    """
    if value is None:
        return ""
    return str(value)[:10]


def today_utc_iso_date() -> str:
    """Computes today's UTC date as `YYYY-MM-DD`, without any timezone-local
    accessor — a local-timezone read in a non-UTC environment would shift the
    whole `[today, ...]` range by a day and change every dedupeKey computed
    from it.
    """
    now = datetime.now(UTC)
    return _format_iso(now.year, now.month, now.day)


def _query_active_templates(client: Instant, dono_id: str) -> list[dict[str, Any]]:
    result = client.query(
        {
            "templatesRotina": {
                "antecessor": {},
                "$": {"where": {"ativo": True, "donoId": dono_id}},
            }
        }
    )
    return result.get("templatesRotina", [])


def _normalize_antecessor(value: object) -> dict[str, Any] | None:
    if isinstance(value, list):
        return value[0] if value else None
    return value if isinstance(value, dict) else None


def _normalize_template(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "tipoGeracao": row.get("tipoGeracao"),
        "regraCompetencia": row.get("regraCompetencia"),
        "offsetDias": row.get("offsetDias"),
        "ativo": row.get("ativo"),
        "antecessor": _normalize_antecessor(row.get("antecessor")),
    }


def _query_existing_instances(
    client: Instant, instance_lookup_ids: list[str]
) -> list[dict[str, Any]]:
    result = client.query(
        {
            "instanciasRotina": {
                "template": {},
                "$": {"where": {"template.id": {"$in": instance_lookup_ids}}},
            }
        }
    )
    rows = result.get("instanciasRotina", [])
    existing: list[dict[str, Any]] = []
    for row in rows:
        linked = row.get("template")
        if isinstance(linked, list):
            linked = linked[0] if linked else None
        template_id = linked.get("id") if isinstance(linked, dict) else ""
        existing.append(
            {
                "dedupeKey": row["dedupeKey"],
                "templateId": template_id or "",
                "competencia": row["competencia"],
                "dataPrevista": to_iso_date(row.get("dataPrevista")),
                "status": row["status"],
            }
        )
    return existing


def _query_by_dedupe_keys(client: Instant, keys: list[str]) -> list[dict[str, Any]]:
    result = client.query(
        {"instanciasRotina": {"$": {"where": {"dedupeKey": {"$in": keys}}}}}
    )
    return result.get("instanciasRotina", [])


def _upsert_fields(dono_id: str, expected_instance: dict[str, Any]) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "dataPrevista": expected_instance["dataPrevista"],
        "competencia": expected_instance["competencia"],
        "tipoPrazo": expected_instance["tipoPrazo"],
        "status": STATUS_INICIAL,
        "donoId": dono_id,
    }
    if "dataPrevistaEstimada" in expected_instance:
        fields["dataPrevistaEstimada"] = expected_instance["dataPrevistaEstimada"]
    return fields


def run_routine_instance_job(
    client: Instant,
    dono_id: str,
    today: str,
    *,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Orchestrates the full query -> compute -> diff -> transact cycle
    against the live InstantDB app for one `dono_id`. Never carries an admin
    token (the caller must pass a `session_client()`-built `client`) and
    never issues a delete operation.

    Step 1: query active templates (with the `antecessor` self-link selected
    for encadeado resolution). Zero rows short-circuits before ever issuing
    an `instanciasRotina` query (RESEARCH Pitfall 5: `$in: []` semantics are
    unverified and must never be relied on).

    Step 2: query existing instances for the union of active template ids
    AND their antecessor ids — an encadeado template whose antecessor is
    INACTIVE would otherwise never see that antecessor's persisted
    instances and would be wrongly skipped as `antecessor_sem_instancia`.

    Step 3: compute (pure). Step 4: diff — an already-present dedupeKey is
    filtered out here and therefore never appears in any transact payload,
    so there is no code path through which `status` can be overwritten.

    Step 5: write — one transact, one lookup-keyed update chunk per new
    dedupeKey (never a strict-insert — the SDK rejects a lookup sentinel
    there), always carrying `donoId`. The `dedupeKey` attribute itself is
    deliberately absent from the update payload: the lookup sentinel already
    sets it on write, and re-including it causes InstantDB to reject the
    write (05-03's live-discovered bug).

    Step 6: concurrency tolerance — on a transact failure, re-query the
    exact keys attempted; if every one now exists, report them as
    `existing` (a lost race, not a crash); otherwise re-raise.

    `dry_run=True` performs every query and the full diff but issues no
    transact, returning the same report shape with the would-be keys under
    `created`.
    """
    with instant_errors():
        templates_raw = _query_active_templates(client, dono_id)
    templates = [_normalize_template(row) for row in templates_raw]

    if not templates:
        return {"created": [], "existing": [], "skipped": []}

    template_ids = [template["id"] for template in templates]
    antecessor_ids = [
        template["antecessor"]["id"] for template in templates if template.get("antecessor")
    ]
    instance_lookup_ids = sorted({*template_ids, *antecessor_ids})

    with instant_errors():
        existing = _query_existing_instances(client, instance_lookup_ids)

    compute_result = compute_expected_instances(templates, today, existing)
    expected = compute_result.expected
    skipped = compute_result.skipped

    existing_keys = {row["dedupeKey"] for row in existing}
    to_create = [instance for instance in expected if instance["dedupeKey"] not in existing_keys]

    if not to_create:
        return {
            "created": [],
            "existing": sorted(instance["dedupeKey"] for instance in expected),
            "skipped": skipped,
        }

    created_keys = sorted(instance["dedupeKey"] for instance in to_create)

    if dry_run:
        return {
            "created": created_keys,
            "existing": sorted(
                instance["dedupeKey"] for instance in expected if instance["dedupeKey"] in existing_keys
            ),
            "skipped": skipped,
        }

    chunks = [
        client.tx["instanciasRotina"][lookup("dedupeKey", instance["dedupeKey"])]
        .update(_upsert_fields(dono_id, instance))
        .link({"template": instance["templateId"]})
        for instance in to_create
    ]

    try:
        client.transact(chunks)
    except (InstantAPIError, httpx.HTTPError):
        with instant_errors():
            recheck_rows = _query_by_dedupe_keys(client, created_keys)
        recheck_keys = {row["dedupeKey"] for row in recheck_rows}
        if any(key not in recheck_keys for key in created_keys):
            with instant_errors():
                raise
        return {
            "created": [],
            "existing": sorted(instance["dedupeKey"] for instance in expected),
            "skipped": skipped,
        }

    return {
        "created": created_keys,
        "existing": sorted(
            instance["dedupeKey"] for instance in expected if instance["dedupeKey"] in existing_keys
        ),
        "skipped": skipped,
    }
