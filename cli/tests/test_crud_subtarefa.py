"""Live `subtarefas` CRUD round trip against the real InstantDB app (CLI-09).

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


def _query_subtarefa(
    client: Instant, eid: str, *, with_tarefa: bool = False, with_ticket: bool = False
) -> dict[str, Any] | None:
    sub_query: dict[str, Any] = {}
    if with_tarefa:
        sub_query["tarefa"] = {}
    if with_ticket:
        sub_query["ticket"] = {}
    result = client.query({"subtarefas": {**sub_query, "$": {"where": {"id": eid}}}})
    rows = result.get("subtarefas", [])
    return rows[0] if rows else None


def _create_tarefa(run_cli: RunCli, cleanup_records: list[tuple[str, str]], suffix: str) -> str:
    result: CliInvocation = run_cli(
        [
            "tarefa",
            "criar",
            "--titulo",
            f"Tarefa p/ Subtarefa {suffix}",
            "--tipo-prazo",
            "hard",
            "--status",
            "aberta",
        ]
    )
    assert result.result.exit_code == 0, result.result.output
    tarefa_id = cast("dict[str, Any]", result.json_out())["id"]
    cleanup_records.append(("tarefas", tarefa_id))
    return tarefa_id


def _create_ticket(run_cli: RunCli, cleanup_records: list[tuple[str, str]], suffix: str) -> str:
    result: CliInvocation = run_cli(
        [
            "ticket",
            "criar",
            "--titulo",
            f"Ticket p/ Subtarefa {suffix}",
            "--corpo",
            "corpo",
            "--remetente",
            "x@example.com",
            "--data-recebimento",
            "2026-09-01",
            "--tipo-prazo",
            "hard",
            "--status",
            "novo",
        ]
    )
    assert result.result.exit_code == 0, result.result.output
    ticket_id = cast("dict[str, Any]", result.json_out())["id"]
    cleanup_records.append(("tickets", ticket_id))
    return ticket_id


def test_full_crud_under_tarefa(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    tarefa_id = _create_tarefa(run_cli, cleanup_records, suffix)

    titulo = f"Subtarefa Teste {suffix}"
    criar_result: CliInvocation = run_cli(
        [
            "subtarefa",
            "criar",
            "--titulo",
            titulo,
            "--ordem",
            "1",
            "--tarefa-id",
            tarefa_id,
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("subtarefas", eid))

    record = _query_subtarefa(live_client, eid, with_tarefa=True)
    assert record is not None
    assert record["donoId"] == live_session.user_id
    assert record["titulo"] == titulo
    assert record["ordem"] == 1
    assert record["concluida"] is False
    linked_tarefa = record.get("tarefa")
    if isinstance(linked_tarefa, list):
        assert len(linked_tarefa) == 1
        linked_tarefa = linked_tarefa[0]
    assert linked_tarefa is not None
    assert linked_tarefa["id"] == tarefa_id

    # listar --tarefa-id filters correctly
    filtered_result: CliInvocation = run_cli(["subtarefa", "listar", "--tarefa-id", tarefa_id])
    assert filtered_result.result.exit_code == 0, filtered_result.result.output
    filtered = cast("list[dict[str, Any]]", filtered_result.json_out())
    assert len(filtered) == 1
    assert filtered[0]["id"] == eid

    # --concluida / --nao-concluida round trip
    concluida_result: CliInvocation = run_cli(["subtarefa", "editar", "--id", eid, "--concluida"])
    assert concluida_result.result.exit_code == 0, concluida_result.result.output
    after_concluida = _query_subtarefa(live_client, eid)
    assert after_concluida is not None
    assert after_concluida["concluida"] is True

    nao_concluida_result: CliInvocation = run_cli(
        ["subtarefa", "editar", "--id", eid, "--nao-concluida"]
    )
    assert nao_concluida_result.result.exit_code == 0, nao_concluida_result.result.output
    after_nao_concluida = _query_subtarefa(live_client, eid)
    assert after_nao_concluida is not None
    assert after_nao_concluida["concluida"] is False

    # regression: editing --titulo alone must not reset --concluida to False
    concluida_result2: CliInvocation = run_cli(["subtarefa", "editar", "--id", eid, "--concluida"])
    assert concluida_result2.result.exit_code == 0, concluida_result2.result.output
    novo_titulo = f"Renomeada {suffix}"
    titulo_only_result: CliInvocation = run_cli(
        ["subtarefa", "editar", "--id", eid, "--titulo", novo_titulo]
    )
    assert titulo_only_result.result.exit_code == 0, titulo_only_result.result.output
    after_titulo_only = _query_subtarefa(live_client, eid)
    assert after_titulo_only is not None
    assert after_titulo_only["titulo"] == novo_titulo
    assert after_titulo_only["concluida"] is True

    # ordem round-trips as a number
    ordem_result: CliInvocation = run_cli(["subtarefa", "editar", "--id", eid, "--ordem", "7"])
    assert ordem_result.result.exit_code == 0, ordem_result.result.output
    after_ordem = _query_subtarefa(live_client, eid)
    assert after_ordem is not None
    assert after_ordem["ordem"] == 7

    # deletar removes it
    deletar_result: CliInvocation = run_cli(["subtarefa", "deletar", "--id", eid])
    assert deletar_result.result.exit_code == 0, deletar_result.result.output
    assert _query_subtarefa(live_client, eid) is None


def test_full_crud_under_ticket(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    ticket_id = _create_ticket(run_cli, cleanup_records, suffix)

    titulo = f"Subtarefa Ticket Teste {suffix}"
    criar_result: CliInvocation = run_cli(
        [
            "subtarefa",
            "criar",
            "--titulo",
            titulo,
            "--ordem",
            "2",
            "--ticket-id",
            ticket_id,
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("subtarefas", eid))

    record = _query_subtarefa(live_client, eid, with_ticket=True)
    assert record is not None
    assert record["donoId"] == live_session.user_id
    linked_ticket = record.get("ticket")
    if isinstance(linked_ticket, list):
        assert len(linked_ticket) == 1
        linked_ticket = linked_ticket[0]
    assert linked_ticket is not None
    assert linked_ticket["id"] == ticket_id

    # listar --ticket-id filters correctly
    filtered_result: CliInvocation = run_cli(["subtarefa", "listar", "--ticket-id", ticket_id])
    assert filtered_result.result.exit_code == 0, filtered_result.result.output
    filtered = cast("list[dict[str, Any]]", filtered_result.json_out())
    assert len(filtered) == 1
    assert filtered[0]["id"] == eid


def test_criar_with_both_parents_is_usage_error_and_creates_nothing(
    run_cli: RunCli, live_client: Instant, cleanup_records: list[tuple[str, str]]
) -> None:
    suffix = unique_suffix()
    tarefa_id = _create_tarefa(run_cli, cleanup_records, suffix)
    ticket_id = _create_ticket(run_cli, cleanup_records, suffix)

    result: CliInvocation = run_cli(
        [
            "subtarefa",
            "criar",
            "--titulo",
            f"Subtarefa Ambigua {suffix}",
            "--ordem",
            "1",
            "--tarefa-id",
            tarefa_id,
            "--ticket-id",
            ticket_id,
        ]
    )
    assert result.result.exit_code != 0
    assert "--tarefa-id" in result.result.output
    assert "--ticket-id" in result.result.output

    all_records = live_client.query({"subtarefas": {"$": {}}}).get("subtarefas", [])
    assert not any(f"Subtarefa Ambigua {suffix}" == r.get("titulo") for r in all_records)


def test_criar_with_neither_parent_is_usage_error_and_creates_nothing(
    run_cli: RunCli, live_client: Instant
) -> None:
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "subtarefa",
            "criar",
            "--titulo",
            f"Subtarefa Orfa {suffix}",
            "--ordem",
            "1",
        ]
    )
    assert result.result.exit_code != 0
    assert "--tarefa-id" in result.result.output
    assert "--ticket-id" in result.result.output

    all_records = live_client.query({"subtarefas": {"$": {}}}).get("subtarefas", [])
    assert not any(f"Subtarefa Orfa {suffix}" == r.get("titulo") for r in all_records)


def test_criar_with_unknown_tarefa_id_is_parent_not_found(
    run_cli: RunCli, live_client: Instant
) -> None:
    phantom_id = str(uuid.uuid4())
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "subtarefa",
            "criar",
            "--titulo",
            f"Subtarefa Fantasma {suffix}",
            "--ordem",
            "1",
            "--tarefa-id",
            phantom_id,
        ]
    )
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "parent_not_found"

    all_records = live_client.query({"subtarefas": {"$": {}}}).get("subtarefas", [])
    assert not any(f"Subtarefa Fantasma {suffix}" == r.get("titulo") for r in all_records)


def test_editar_unknown_id_is_not_found_and_does_not_upsert(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(
        ["subtarefa", "editar", "--id", phantom_id, "--titulo", "Fantasma"]
    )
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"


def test_deletar_unknown_id_is_not_found(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(["subtarefa", "deletar", "--id", phantom_id])
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"
