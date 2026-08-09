"""Live `instanciasRotina` list/status round trip + structural no-create proof (CLI-07).

`instanciasRotina` has no `criar` and no `deletar` command in this CLI by
design (PROJECT.md C-06): creation is exclusively the Phase 5 dedupeKey-based
upsert job. Since the CLI cannot create instances, the live tests here seed
one directly through `live_client.tx` (per the plan's `<interfaces>` note),
then exercise `listar`/`status` through the CLI.
"""

from __future__ import annotations

import json
import uuid
from typing import Any, cast

import pytest
from instantdb import Instant
from instantdb import id as new_id

from apollo_cli.entities import rotina
from apollo_cli.session import Session
from tests.conftest import CliInvocation, RunCli, unique_suffix

pytestmark = pytest.mark.live


# --- Structural (no session needed) -----------------------------------------


def test_instancia_command_set_is_exactly_listar_and_status() -> None:
    commands = set(rotina.instancia.commands)
    assert commands == {"listar", "status"}, (
        "apollo rotina instancia must expose only {listar, status} — PROJECT.md C-06: "
        "instanciasRotina creation/deletion is exclusively Phase 5's dedupeKey-based "
        f"upsert job, never a hand-run CLI command. Found: {commands}"
    )
    assert "criar" not in commands, "C-06: no hand-created instanciasRotina — see module docstring"
    assert "deletar" not in commands, "C-06: instances are never hand-deleted from the CLI"


def test_gerar_instancias_does_not_exist_yet() -> None:
    assert "gerar-instancias" not in rotina.group.commands, (
        "apollo rotina gerar-instancias is Phase 5 scope (JOB-02) — no stub or "
        "placeholder may pre-empt it in Phase 3"
    )


def test_cli_surface_criar_is_no_such_command(run_cli: RunCli) -> None:
    result: CliInvocation = run_cli(["rotina", "instancia", "criar"])
    assert result.result.exit_code != 0
    assert "No such command" in (result.result.output + str(result.result.exception))


# --- Live --------------------------------------------------------------------


def _seed_instancia(
    live_client: Instant,
    live_session: Session,
    template_id: str,
    suffix: str,
) -> dict[str, Any]:
    eid = new_id()
    fields = {
        "dedupeKey": f"test-{suffix}",
        "dataPrevista": "2026-09-10",
        "competencia": "2026-09",
        "tipoPrazo": "hard",
        "status": "pendente",
        "donoId": live_session.user_id,
    }
    live_client.transact(
        live_client.tx["instanciasRotina"][eid].create(fields).link({"template": template_id})
    )
    return {"id": eid, **fields}


def _create_template(run_cli: RunCli, cleanup_records: list[tuple[str, str]], suffix: str) -> str:
    result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template p/ Instancia {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "mes_corrente",
        ]
    )
    assert result.result.exit_code == 0, result.result.output
    template_id = cast("dict[str, Any]", result.json_out())["id"]
    cleanup_records.append(("templatesRotina", template_id))
    return template_id


def _query_instancia(client: Instant, eid: str) -> dict[str, Any] | None:
    result = client.query({"instanciasRotina": {"$": {"where": {"id": eid}}}})
    rows = result.get("instanciasRotina", [])
    return rows[0] if rows else None


def test_listar_and_status_round_trip(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    template_id = _create_template(run_cli, cleanup_records, suffix)
    seeded = _seed_instancia(live_client, live_session, template_id, suffix)
    eid = seeded["id"]
    cleanup_records.append(("instanciasRotina", eid))

    # listar includes it
    listar_result: CliInvocation = run_cli(["rotina", "instancia", "listar"])
    assert listar_result.result.exit_code == 0, listar_result.result.output
    all_records = cast("list[dict[str, Any]]", listar_result.json_out())
    assert any(r["id"] == eid for r in all_records)

    # listar --template-id returns it
    filtered_result: CliInvocation = run_cli(
        ["rotina", "instancia", "listar", "--template-id", template_id]
    )
    assert filtered_result.result.exit_code == 0, filtered_result.result.output
    filtered = cast("list[dict[str, Any]]", filtered_result.json_out())
    assert any(r["id"] == eid for r in filtered)

    # status updates ONLY status
    status_result: CliInvocation = run_cli(
        ["rotina", "instancia", "status", "--id", eid, "--status", "concluida"]
    )
    assert status_result.result.exit_code == 0, status_result.result.output

    updated = _query_instancia(live_client, eid)
    assert updated is not None
    assert updated["status"] == "concluida"
    assert updated["dedupeKey"] == seeded["dedupeKey"], "status update must not touch dedupeKey"
    assert updated["dataPrevista"].startswith(seeded["dataPrevista"]), (
        "status update must not touch dataPrevista"
    )
    assert updated["competencia"] == seeded["competencia"], (
        "status update must not touch competencia"
    )
    assert updated["tipoPrazo"] == seeded["tipoPrazo"], "status update must not touch tipoPrazo"
    assert updated["donoId"] == seeded["donoId"], "status update must not touch donoId"


def test_status_unknown_id_is_not_found_and_creates_no_phantom(
    run_cli: RunCli, live_client: Instant
) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(
        ["rotina", "instancia", "status", "--id", phantom_id, "--status", "x"]
    )
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"

    phantom_record = live_client.query(
        {"instanciasRotina": {"$": {"where": {"id": phantom_id}}}}
    ).get("instanciasRotina", [])
    assert phantom_record == []
