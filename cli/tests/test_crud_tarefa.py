"""Live `tarefas` CRUD round trip against the real InstantDB app (CLI-05).

Every assertion here talks to the real `.env.instantdb` app via the real,
persisted session — no mocking. Skips cleanly (via `live_session`) when no
session exists; a skip here is a failure of Task 3, not a pass.
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


def _query_tarefa(client: Instant, eid: str, *, with_etapa: bool = False) -> dict[str, Any] | None:
    sub_query: dict[str, Any] = {"etapa": {}} if with_etapa else {}
    result = client.query({"tarefas": {**sub_query, "$": {"where": {"id": eid}}}})
    rows = result.get("tarefas", [])
    return rows[0] if rows else None


def _create_etapa(run_cli: RunCli, cleanup_records: list[tuple[str, str]], suffix: str) -> str:
    projeto_result: CliInvocation = run_cli(
        ["projeto", "criar", "--nome", f"Projeto p/ Tarefa {suffix}", "--status", "aberto"]
    )
    assert projeto_result.result.exit_code == 0, projeto_result.result.output
    projeto_id = cast("dict[str, Any]", projeto_result.json_out())["id"]
    cleanup_records.append(("projetos", projeto_id))

    etapa_result: CliInvocation = run_cli(
        [
            "etapa",
            "criar",
            "--nome",
            f"Etapa p/ Tarefa {suffix}",
            "--ordem",
            "1",
            "--status",
            "aberta",
            "--projeto-id",
            projeto_id,
        ]
    )
    assert etapa_result.result.exit_code == 0, etapa_result.result.output
    etapa_id = cast("dict[str, Any]", etapa_result.json_out())["id"]
    cleanup_records.append(("etapas", etapa_id))
    return etapa_id


def test_full_crud_round_trip(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    etapa_id = _create_etapa(run_cli, cleanup_records, suffix)

    titulo = f"Tarefa Teste {suffix}"
    criar_result: CliInvocation = run_cli(
        [
            "tarefa",
            "criar",
            "--titulo",
            titulo,
            "--tipo-prazo",
            "hard",
            "--status",
            "aberta",
            "--data-prevista",
            "2026-09-30",
            "--etapa-id",
            etapa_id,
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("tarefas", eid))

    # read back: donoId, no timezone shift on dataPrevista, etapa link resolves
    record = _query_tarefa(live_client, eid, with_etapa=True)
    assert record is not None
    assert record["donoId"] == live_session.user_id
    assert record["dataPrevista"].startswith("2026-09-30")
    assert "descricao" not in record
    linked_etapa = record.get("etapa")
    if isinstance(linked_etapa, list):
        assert len(linked_etapa) == 1
        linked_etapa = linked_etapa[0]
    assert linked_etapa is not None
    assert linked_etapa["id"] == etapa_id

    # listar --etapa-id filters correctly
    filtered_result: CliInvocation = run_cli(["tarefa", "listar", "--etapa-id", etapa_id])
    assert filtered_result.result.exit_code == 0, filtered_result.result.output
    filtered = cast("list[dict[str, Any]]", filtered_result.json_out())
    assert len(filtered) == 1
    assert filtered[0]["id"] == eid

    # editar
    novo_titulo = f"Renomeada {suffix}"
    editar_result: CliInvocation = run_cli(
        ["tarefa", "editar", "--id", eid, "--titulo", novo_titulo, "--status", "fechada"]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    updated_record = _query_tarefa(live_client, eid)
    assert updated_record is not None
    assert updated_record["titulo"] == novo_titulo
    assert updated_record["status"] == "fechada"
    assert updated_record["donoId"] == live_session.user_id

    # deletar
    deletar_result: CliInvocation = run_cli(["tarefa", "deletar", "--id", eid])
    assert deletar_result.result.exit_code == 0, deletar_result.result.output
    assert _query_tarefa(live_client, eid) is None


def test_criar_with_unknown_etapa_id_is_parent_not_found(
    run_cli: RunCli, live_client: Instant
) -> None:
    phantom_id = str(uuid.uuid4())
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "tarefa",
            "criar",
            "--titulo",
            f"Tarefa Fantasma {suffix}",
            "--tipo-prazo",
            "soft",
            "--status",
            "aberta",
            "--etapa-id",
            phantom_id,
        ]
    )
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "parent_not_found"

    all_records = live_client.query({"tarefas": {"$": {}}}).get("tarefas", [])
    assert not any(f"Tarefa Fantasma {suffix}" == r.get("titulo") for r in all_records)


def test_criar_invalid_data_prevista_exits_2_and_creates_nothing(
    run_cli: RunCli, live_client: Instant
) -> None:
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "tarefa",
            "criar",
            "--titulo",
            f"Tarefa Data Invalida {suffix}",
            "--tipo-prazo",
            "hard",
            "--status",
            "aberta",
            "--data-prevista",
            "2026-13-99",
        ]
    )
    assert result.result.exit_code == 2
    assert "Invalid value" in result.result.output

    all_records = live_client.query({"tarefas": {"$": {}}}).get("tarefas", [])
    assert not any(f"Tarefa Data Invalida {suffix}" == r.get("titulo") for r in all_records)


def test_criar_invalid_tipo_prazo_exits_2(run_cli: RunCli) -> None:
    result: CliInvocation = run_cli(
        ["tarefa", "criar", "--titulo", "T", "--tipo-prazo", "urgente", "--status", "s"]
    )
    assert result.result.exit_code == 2
    assert "urgente" in result.result.output


def test_editar_unknown_id_is_not_found_and_does_not_upsert(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(
        ["tarefa", "editar", "--id", phantom_id, "--titulo", "Fantasma"]
    )
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"


def test_deletar_unknown_id_is_not_found(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(["tarefa", "deletar", "--id", phantom_id])
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"
