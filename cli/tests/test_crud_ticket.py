"""Live `tickets` CRUD round trip against the real InstantDB app (CLI-08).

Every assertion here talks to the real `.env.instantdb` app via the real,
persisted session — no mocking. Skips cleanly (via `live_session`) when no
session exists; a skip here is a failure of Task 1, not a pass.
"""

from __future__ import annotations

import json
import uuid
from typing import Any, cast

import pytest
from instantdb import Instant

from apollo_cli.session import Session
from tests.conftest import CliInvocation, RunCli, unique_suffix

pytestmark = pytest.mark.live


def _query_ticket(
    client: Instant, eid: str, *, with_entidade: bool = False
) -> dict[str, Any] | None:
    sub_query: dict[str, Any] = {"entidade": {}} if with_entidade else {}
    result = client.query({"tickets": {**sub_query, "$": {"where": {"id": eid}}}})
    rows = result.get("tickets", [])
    return rows[0] if rows else None


def _create_entidade(run_cli: RunCli, cleanup_records: list[tuple[str, str]], suffix: str) -> str:
    entidade_result: CliInvocation = run_cli(
        [
            "entidade",
            "criar",
            "--nome",
            f"Fundo p/ Ticket {suffix}",
            "--codigo",
            f"TCK-{suffix}",
            "--tipo-entidade",
            "Fundo",
        ]
    )
    assert entidade_result.result.exit_code == 0, entidade_result.result.output
    entidade_id = cast("dict[str, Any]", entidade_result.json_out())["id"]
    cleanup_records.append(("entidades", entidade_id))
    return entidade_id


def test_full_crud_round_trip(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    entidade_id = _create_entidade(run_cli, cleanup_records, suffix)

    titulo = f"Ticket Teste {suffix}"
    criar_result: CliInvocation = run_cli(
        [
            "ticket",
            "criar",
            "--titulo",
            titulo,
            "--corpo",
            "Corpo do email de teste.",
            "--remetente",
            "remetente@example.com",
            "--data-recebimento",
            "2026-09-01",
            "--tipo-prazo",
            "hard",
            "--status",
            "novo",
            "--entidade-id",
            entidade_id,
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("tickets", eid))

    # read back: donoId, all required fields round-trip, no timezone shift,
    # dataPrevista absent (not null), entidade link resolves
    record = _query_ticket(live_client, eid, with_entidade=True)
    assert record is not None
    assert record["donoId"] == live_session.user_id
    assert record["titulo"] == titulo
    assert record["corpo"] == "Corpo do email de teste."
    assert record["remetente"] == "remetente@example.com"
    assert record["dataRecebimento"].startswith("2026-09-01")
    assert record["tipoPrazo"] == "hard"
    assert record["status"] == "novo"
    assert "dataPrevista" not in record
    linked_entidade = record.get("entidade")
    if isinstance(linked_entidade, list):
        assert len(linked_entidade) == 1
        linked_entidade = linked_entidade[0]
    assert linked_entidade is not None
    assert linked_entidade["id"] == entidade_id

    # listar --entidade-id and --status filter correctly
    filtered_by_entidade: CliInvocation = run_cli(
        ["ticket", "listar", "--entidade-id", entidade_id]
    )
    assert filtered_by_entidade.result.exit_code == 0, filtered_by_entidade.result.output
    by_entidade = cast("list[dict[str, Any]]", filtered_by_entidade.json_out())
    assert len(by_entidade) == 1
    assert by_entidade[0]["id"] == eid

    filtered_by_status: CliInvocation = run_cli(["ticket", "listar", "--status", "novo"])
    assert filtered_by_status.result.exit_code == 0, filtered_by_status.result.output
    by_status = cast("list[dict[str, Any]]", filtered_by_status.json_out())
    assert any(r["id"] == eid for r in by_status)

    # editar changes status and data-prevista, leaves donoId untouched
    editar_result: CliInvocation = run_cli(
        [
            "ticket",
            "editar",
            "--id",
            eid,
            "--status",
            "em_andamento",
            "--data-prevista",
            "2026-09-15",
        ]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    updated_record = _query_ticket(live_client, eid)
    assert updated_record is not None
    assert updated_record["status"] == "em_andamento"
    assert updated_record["dataPrevista"].startswith("2026-09-15")
    assert updated_record["donoId"] == live_session.user_id

    # deletar removes it
    deletar_result: CliInvocation = run_cli(["ticket", "deletar", "--id", eid])
    assert deletar_result.result.exit_code == 0, deletar_result.result.output
    assert _query_ticket(live_client, eid) is None


def test_criar_with_unknown_entidade_id_is_parent_not_found(
    run_cli: RunCli, live_client: Instant
) -> None:
    phantom_id = str(uuid.uuid4())
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "ticket",
            "criar",
            "--titulo",
            f"Ticket Fantasma {suffix}",
            "--corpo",
            "corpo",
            "--remetente",
            "x@example.com",
            "--data-recebimento",
            "2026-09-01",
            "--tipo-prazo",
            "soft",
            "--status",
            "novo",
            "--entidade-id",
            phantom_id,
        ]
    )
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "parent_not_found"

    all_records = live_client.query({"tickets": {"$": {}}}).get("tickets", [])
    assert not any(f"Ticket Fantasma {suffix}" == r.get("titulo") for r in all_records)


def test_criar_invalid_data_recebimento_exits_2_and_creates_nothing(
    run_cli: RunCli, live_client: Instant
) -> None:
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "ticket",
            "criar",
            "--titulo",
            f"Ticket Data Invalida {suffix}",
            "--corpo",
            "corpo",
            "--remetente",
            "x@example.com",
            "--data-recebimento",
            "2026-02-30",
            "--tipo-prazo",
            "hard",
            "--status",
            "novo",
        ]
    )
    assert result.result.exit_code == 2
    assert "Invalid value" in result.result.output

    all_records = live_client.query({"tickets": {"$": {}}}).get("tickets", [])
    assert not any(f"Ticket Data Invalida {suffix}" == r.get("titulo") for r in all_records)


def test_criar_invalid_tipo_prazo_exits_2(run_cli: RunCli) -> None:
    result: CliInvocation = run_cli(
        [
            "ticket",
            "criar",
            "--titulo",
            "T",
            "--corpo",
            "c",
            "--remetente",
            "r",
            "--data-recebimento",
            "2026-09-01",
            "--tipo-prazo",
            "urgente",
            "--status",
            "novo",
        ]
    )
    assert result.result.exit_code == 2
    assert "urgente" in result.result.output


def test_editar_unknown_id_is_not_found_and_does_not_upsert(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(
        ["ticket", "editar", "--id", phantom_id, "--status", "fantasma"]
    )
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"


def test_deletar_unknown_id_is_not_found(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(["ticket", "deletar", "--id", phantom_id])
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"
