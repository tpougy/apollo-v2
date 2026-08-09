"""Live `etapas` CRUD round trip against the real InstantDB app (CLI-04).

Every assertion here talks to the real `.env.instantdb` app via the real,
persisted session — no mocking. Skips cleanly (via `live_session`) when no
session exists; a skip here is a failure of Task 2, not a pass.
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


def _query_etapa(client: Instant, eid: str, *, with_projeto: bool = False) -> dict[str, Any] | None:
    sub_query: dict[str, Any] = {"projeto": {}} if with_projeto else {}
    result = client.query({"etapas": {**sub_query, "$": {"where": {"id": eid}}}})
    rows = result.get("etapas", [])
    return rows[0] if rows else None


def _create_projeto(run_cli: RunCli, cleanup_records: list[tuple[str, str]], suffix: str) -> str:
    result: CliInvocation = run_cli(
        ["projeto", "criar", "--nome", f"Projeto p/ Etapa {suffix}", "--status", "aberto"]
    )
    assert result.result.exit_code == 0, result.result.output
    projeto_id = cast("dict[str, Any]", result.json_out())["id"]
    cleanup_records.append(("projetos", projeto_id))
    return projeto_id


def test_full_crud_round_trip(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    projeto_id = _create_projeto(run_cli, cleanup_records, suffix)

    # 1. criar under the throwaway projeto
    nome = f"Etapa Teste {suffix}"
    criar_result: CliInvocation = run_cli(
        [
            "etapa",
            "criar",
            "--nome",
            nome,
            "--ordem",
            "1",
            "--status",
            "aberta",
            "--projeto-id",
            projeto_id,
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("etapas", eid))

    # 2. read back, assert donoId, ordem is a number, and the projeto link resolves
    record = _query_etapa(live_client, eid, with_projeto=True)
    assert record is not None
    assert record["donoId"] == live_session.user_id
    assert record["ordem"] == 1
    assert isinstance(record["ordem"], int)
    linked_projeto = record.get("projeto")
    if isinstance(linked_projeto, list):
        assert len(linked_projeto) == 1
        linked_projeto = linked_projeto[0]
    assert linked_projeto is not None
    assert linked_projeto["id"] == projeto_id

    # 3. listar --projeto-id filters to only this projeto's etapas
    filtered_result: CliInvocation = run_cli(["etapa", "listar", "--projeto-id", projeto_id])
    assert filtered_result.result.exit_code == 0, filtered_result.result.output
    filtered = cast("list[dict[str, Any]]", filtered_result.json_out())
    assert len(filtered) == 1
    assert filtered[0]["id"] == eid

    # 4. editar changes nome/ordem/status, leaves donoId untouched
    novo_nome = f"Renomeada {suffix}"
    editar_result: CliInvocation = run_cli(
        ["etapa", "editar", "--id", eid, "--nome", novo_nome, "--ordem", "2", "--status", "fechada"]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    updated_record = _query_etapa(live_client, eid)
    assert updated_record is not None
    assert updated_record["nome"] == novo_nome
    assert updated_record["ordem"] == 2
    assert updated_record["status"] == "fechada"
    assert updated_record["donoId"] == live_session.user_id

    # 5. deletar removes it
    deletar_result: CliInvocation = run_cli(["etapa", "deletar", "--id", eid])
    assert deletar_result.result.exit_code == 0, deletar_result.result.output
    assert _query_etapa(live_client, eid) is None


def test_criar_with_unknown_projeto_id_is_parent_not_found(
    run_cli: RunCli, live_client: Instant
) -> None:
    phantom_id = str(uuid.uuid4())
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "etapa",
            "criar",
            "--nome",
            f"Etapa Fantasma {suffix}",
            "--ordem",
            "1",
            "--status",
            "aberta",
            "--projeto-id",
            phantom_id,
        ]
    )
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "parent_not_found"

    all_records = live_client.query({"etapas": {"$": {}}}).get("etapas", [])
    assert not any(f"Etapa Fantasma {suffix}" == r.get("nome") for r in all_records)


def test_editar_unknown_id_is_not_found_and_does_not_upsert(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(["etapa", "editar", "--id", phantom_id, "--nome", "Fantasma"])
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"


def test_deletar_unknown_id_is_not_found(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(["etapa", "deletar", "--id", phantom_id])
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"


def test_criar_ordem_type_checked_at_cli_boundary(run_cli: RunCli) -> None:
    result: CliInvocation = run_cli(
        ["etapa", "criar", "--nome", "X", "--ordem", "abc", "--status", "s"]
    )
    assert result.result.exit_code == 2
    assert "Invalid value" in (result.result.output + str(result.result.exception or ""))
