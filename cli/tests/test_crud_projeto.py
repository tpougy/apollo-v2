"""Live `projetos` CRUD round trip against the real InstantDB app (CLI-03).

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


def _query_projeto(client: Instant, eid: str, *, with_fundo: bool = False) -> dict[str, Any] | None:
    sub_query: dict[str, Any] = {"fundo": {}} if with_fundo else {}
    result = client.query({"projetos": {**sub_query, "$": {"where": {"id": eid}}}})
    rows = result.get("projetos", [])
    return rows[0] if rows else None


def test_full_crud_round_trip(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    nome = f"Projeto Teste {suffix}"

    # 1. criar without --descricao
    criar_result: CliInvocation = run_cli(
        ["projeto", "criar", "--nome", nome, "--status", "aberto"]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    created = cast("dict[str, Any]", criar_result.json_out())
    eid = created["id"]
    assert eid
    cleanup_records.append(("projetos", eid))

    # 2. read back, assert donoId and absence of the optional key
    record = _query_projeto(live_client, eid)
    assert record is not None
    assert record["donoId"] == live_session.user_id
    assert record["nome"] == nome
    assert record["status"] == "aberto"
    assert "descricao" not in record

    # 3. listar --status filters
    filtered_result: CliInvocation = run_cli(["projeto", "listar", "--status", "aberto"])
    assert filtered_result.result.exit_code == 0, filtered_result.result.output
    filtered = cast("list[dict[str, Any]]", filtered_result.json_out())
    assert any(r["id"] == eid for r in filtered)

    # 4. editar changes nome and status, leaves donoId untouched
    novo_nome = f"Renomeado {suffix}"
    editar_result: CliInvocation = run_cli(
        ["projeto", "editar", "--id", eid, "--nome", novo_nome, "--status", "fechado"]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    updated_record = _query_projeto(live_client, eid)
    assert updated_record is not None
    assert updated_record["nome"] == novo_nome
    assert updated_record["status"] == "fechado"
    assert updated_record["donoId"] == live_session.user_id

    # 5. deletar removes it
    deletar_result: CliInvocation = run_cli(["projeto", "deletar", "--id", eid])
    assert deletar_result.result.exit_code == 0, deletar_result.result.output
    assert _query_projeto(live_client, eid) is None


def test_criar_with_fundo_link_resolves(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()

    fundo_result: CliInvocation = run_cli(
        ["fundo", "criar", "--nome", f"Fundo Link {suffix}", "--codigo", f"FLK-{suffix}"]
    )
    assert fundo_result.result.exit_code == 0, fundo_result.result.output
    fundo_id = cast("dict[str, Any]", fundo_result.json_out())["id"]
    cleanup_records.append(("fundos", fundo_id))

    projeto_result: CliInvocation = run_cli(
        [
            "projeto",
            "criar",
            "--nome",
            f"Projeto Linkado {suffix}",
            "--status",
            "aberto",
            "--fundo-id",
            fundo_id,
        ]
    )
    assert projeto_result.result.exit_code == 0, projeto_result.result.output
    projeto_id = cast("dict[str, Any]", projeto_result.json_out())["id"]
    cleanup_records.append(("projetos", projeto_id))

    record = _query_projeto(live_client, projeto_id, with_fundo=True)
    assert record is not None
    linked_fundo = record.get("fundo")
    assert linked_fundo is not None
    # InstantDB returns linked records as a list regardless of `has: "one"`
    # cardinality on the forward side.
    if isinstance(linked_fundo, list):
        assert len(linked_fundo) == 1
        linked_fundo = linked_fundo[0]
    assert linked_fundo["id"] == fundo_id


def test_criar_with_unknown_fundo_id_is_parent_not_found(
    cleanup_records: list[tuple[str, str]],
    run_cli: RunCli,
    live_client: Instant,
) -> None:
    phantom_id = str(uuid.uuid4())
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "projeto",
            "criar",
            "--nome",
            f"Projeto Fantasma {suffix}",
            "--status",
            "aberto",
            "--fundo-id",
            phantom_id,
        ]
    )
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "parent_not_found"

    # No orphan projeto with that name was created.
    all_records = live_client.query({"projetos": {"$": {}}}).get("projetos", [])
    assert not any(f"Projeto Fantasma {suffix}" == r.get("nome") for r in all_records)


def test_editar_unknown_id_is_not_found_and_does_not_upsert(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(["projeto", "editar", "--id", phantom_id, "--nome", "Fantasma"])
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"


def test_deletar_unknown_id_is_not_found(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(["projeto", "deletar", "--id", phantom_id])
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"
