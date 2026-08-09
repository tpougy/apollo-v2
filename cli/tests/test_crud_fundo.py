"""Live `fundos` CRUD round trip against the real InstantDB app (CLI-02).

Every assertion here talks to the real `.env.instantdb` app via the real,
persisted session — no mocking. Skips cleanly (via `live_session`) when no
session exists; a skip here is a failure of Task 2, not a pass.
"""

from __future__ import annotations

import json
import subprocess
import uuid
from pathlib import Path
from typing import Any, cast

import pytest
from instantdb import Instant

from apollo_cli.session import Session
from tests.conftest import CliInvocation, RunCli, unique_suffix

pytestmark = pytest.mark.live


def _query_fundo(client: Instant, eid: str) -> dict[str, Any] | None:
    result = client.query({"fundos": {"$": {"where": {"id": eid}}}})
    rows = result.get("fundos", [])
    return rows[0] if rows else None


def test_full_crud_round_trip(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    nome = f"Fundo Teste {suffix}"
    codigo = f"TST-{suffix}"

    # 1. criar
    criar_result: CliInvocation = run_cli(["fundo", "criar", "--nome", nome, "--codigo", codigo])
    assert criar_result.result.exit_code == 0, criar_result.result.output
    created = cast("dict[str, Any]", criar_result.json_out())
    eid = created["id"]
    assert eid
    cleanup_records.append(("fundos", eid))

    # 2. read back directly, assert donoId/ativo/fields/createdAt
    record = _query_fundo(live_client, eid)
    assert record is not None
    assert record["donoId"] == live_session.user_id
    assert record["ativo"] is True
    assert record["nome"] == nome
    assert record["codigo"] == codigo
    assert record.get("createdAt")

    # 3. listar contains the created id
    listar_result: CliInvocation = run_cli(["fundo", "listar"])
    assert listar_result.result.exit_code == 0, listar_result.result.output
    all_records = cast("list[dict[str, Any]]", listar_result.json_out())
    assert any(r["id"] == eid for r in all_records)

    # 4. listar --codigo filters to exactly one record
    filtered_result: CliInvocation = run_cli(["fundo", "listar", "--codigo", codigo])
    assert filtered_result.result.exit_code == 0, filtered_result.result.output
    filtered = cast("list[dict[str, Any]]", filtered_result.json_out())
    assert len(filtered) == 1
    assert filtered[0]["id"] == eid

    # 5. editar renames, deactivates, and leaves donoId untouched
    novo_nome = f"Renomeado {suffix}"
    editar_result: CliInvocation = run_cli(
        ["fundo", "editar", "--id", eid, "--nome", novo_nome, "--inativo"]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    updated_record = _query_fundo(live_client, eid)
    assert updated_record is not None
    assert updated_record["nome"] == novo_nome
    assert updated_record["ativo"] is False
    assert updated_record["donoId"] == live_session.user_id

    # 6. deletar removes it
    deletar_result: CliInvocation = run_cli(["fundo", "deletar", "--id", eid])
    assert deletar_result.result.exit_code == 0, deletar_result.result.output
    assert _query_fundo(live_client, eid) is None
    listar_after_delete: CliInvocation = run_cli(["fundo", "listar"])
    remaining = cast("list[dict[str, Any]]", listar_after_delete.json_out())
    assert not any(r["id"] == eid for r in remaining)


def test_editar_unknown_id_is_not_found_and_does_not_upsert(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(["fundo", "editar", "--id", phantom_id, "--nome", "Fantasma"])
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"


def test_deletar_unknown_id_is_not_found(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(["fundo", "deletar", "--id", phantom_id])
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"


def test_console_script_smoke_test_listar(cleanup_records: list[tuple[str, str]]) -> None:
    """Proves the installed `apollo` console script works end-to-end, not just
    the in-process `CliRunner` path used by the rest of this module."""
    completed = subprocess.run(
        ["uv", "run", "apollo", "fundo", "listar"],
        cwd=str(_cli_dir()),
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    parsed = json.loads(completed.stdout)
    assert isinstance(parsed, list)


def _cli_dir() -> Path:
    return Path(__file__).resolve().parent.parent
