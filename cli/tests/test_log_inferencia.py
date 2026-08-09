"""Live `logInferenciaClaude` registrar/listar round trip + structural
append-only proof (CLI-10).

`logInferenciaClaude` is an append-only audit trail of what Claude inferred
and why. No `editar`/`deletar` exists in this CLI by design — a rewritable
audit log cannot serve its purpose of letting the user check the AI's
reasoning after the fact.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast

import pytest
from instantdb import Instant

from apollo_cli.entities import log_inferencia
from apollo_cli.session import Session
from tests.conftest import CliInvocation, RunCli, unique_suffix

pytestmark = pytest.mark.live


# --- Structural (no session needed) -----------------------------------------


def test_command_set_is_exactly_registrar_and_listar() -> None:
    commands = set(log_inferencia.group.commands)
    assert commands == {"registrar", "listar"}, (
        "apollo log-inferencia must expose only {registrar, listar} — this is an "
        "append-only audit trail; an editable/deletable audit log cannot serve its "
        f"purpose of letting the user check the AI's reasoning after the fact. Found: {commands}"
    )
    assert "editar" not in commands
    assert "deletar" not in commands


# --- Live --------------------------------------------------------------------


def _query_log(client: Instant, eid: str) -> dict[str, Any] | None:
    result = client.query({"logInferenciaClaude": {"$": {"where": {"id": eid}}}})
    rows = result.get("logInferenciaClaude", [])
    return rows[0] if rows else None


def test_registrar_and_listar_round_trip(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    entidade_id = f"tarefa-{suffix}"

    registrar_result: CliInvocation = run_cli(
        [
            "log-inferencia",
            "registrar",
            "--campo",
            "dataPrevista",
            "--valor-inferido",
            "2026-09-15",
            "--entidade-tipo",
            "tarefas",
            "--entidade-id",
            entidade_id,
            "--trecho-motivador",
            "precisamos entregar ate meados de setembro",
        ]
    )
    assert registrar_result.result.exit_code == 0, registrar_result.result.output
    created = cast("dict[str, Any]", registrar_result.json_out())
    eid = created["id"]
    assert eid
    cleanup_records.append(("logInferenciaClaude", eid))

    record = _query_log(live_client, eid)
    assert record is not None
    assert record["donoId"] == live_session.user_id
    assert record["campo"] == "dataPrevista"
    assert record["valorInferido"] == "2026-09-15"
    assert record["entidadeTipo"] == "tarefas"
    assert record["entidadeId"] == entidade_id
    assert record["trechoMotivador"] == "precisamos entregar ate meados de setembro"
    created_at = record.get("createdAt")
    assert created_at
    datetime.fromisoformat(created_at)

    listar_result: CliInvocation = run_cli(
        ["log-inferencia", "listar", "--entidade-tipo", "tarefas", "--entidade-id", entidade_id]
    )
    assert listar_result.result.exit_code == 0, listar_result.result.output
    filtered = cast("list[dict[str, Any]]", listar_result.json_out())
    assert len(filtered) == 1
    assert filtered[0]["id"] == eid


def test_registrar_without_trecho_motivador_key_is_absent(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    registrar_result: CliInvocation = run_cli(
        [
            "log-inferencia",
            "registrar",
            "--campo",
            "status",
            "--valor-inferido",
            "concluido",
            "--entidade-tipo",
            "tickets",
            "--entidade-id",
            f"ticket-{suffix}",
        ]
    )
    assert registrar_result.result.exit_code == 0, registrar_result.result.output
    eid = cast("dict[str, Any]", registrar_result.json_out())["id"]
    cleanup_records.append(("logInferenciaClaude", eid))

    record = _query_log(live_client, eid)
    assert record is not None
    assert "trechoMotivador" not in record


def test_deletar_is_no_such_command(run_cli: RunCli) -> None:
    result: CliInvocation = run_cli(["log-inferencia", "deletar", "--id", "x"])
    assert result.result.exit_code != 0
    assert "No such command" in (result.result.output + str(result.result.exception))
