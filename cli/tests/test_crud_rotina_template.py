"""Live `templatesRotina` CRUD round trip against the real InstantDB app (CLI-06).

Every assertion here talks to the real `.env.instantdb` app via the real,
persisted session — no mocking. Skips cleanly (via `live_session`) when no
session exists; a skip here is a failure of an earlier task, not a pass.
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


def _query_template(
    client: Instant, eid: str, *, with_links: bool = False
) -> dict[str, Any] | None:
    sub_query: dict[str, Any] = {"fundo": {}, "antecessor": {}} if with_links else {}
    result = client.query({"templatesRotina": {**sub_query, "$": {"where": {"id": eid}}}})
    rows = result.get("templatesRotina", [])
    return rows[0] if rows else None


def _single(value: dict[str, Any] | list[dict[str, Any]] | None) -> dict[str, Any] | None:
    """`fundo`/`antecessor` may come back as a single dict or a one-item list."""
    if isinstance(value, list):
        assert len(value) == 1
        return value[0]
    return value


def _create_fundo(run_cli: RunCli, cleanup_records: list[tuple[str, str]], suffix: str) -> str:
    fundo_result: CliInvocation = run_cli(
        ["fundo", "criar", "--nome", f"Fundo p/ Rotina {suffix}", "--codigo", f"ROT-{suffix}"]
    )
    assert fundo_result.result.exit_code == 0, fundo_result.result.output
    fundo_id = cast("dict[str, Any]", fundo_result.json_out())["id"]
    cleanup_records.append(("fundos", fundo_id))
    return fundo_id


def test_full_crud_round_trip(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    nome = f"Template Teste {suffix}"

    # 1. criar with both booleans explicit
    criar_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            nome,
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "mes_corrente",
            "--propagar-atraso-soft",
            "--ativo",
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    created = cast("dict[str, Any]", criar_result.json_out())
    eid = created["id"]
    assert eid
    cleanup_records.append(("templatesRotina", eid))

    # 2. read back: donoId, all required fields + both booleans round-trip
    record = _query_template(live_client, eid)
    assert record is not None
    assert record["donoId"] == live_session.user_id
    assert record["nome"] == nome
    assert record["tipoGeracao"] == "du_fixo"
    assert record["regraCompetencia"] == "mes_corrente"
    assert record["propagarAtrasoSoft"] is True
    assert record["ativo"] is True

    # 3. criar with --fundo-id (throwaway fundo) -> nested fundo resolves
    fundo_id = _create_fundo(run_cli, cleanup_records, suffix)
    with_fundo_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template c/ Fundo {suffix}",
            "--tipo-geracao",
            "corrido_fixo",
            "--regra-competencia",
            "mes_seguinte",
            "--fundo-id",
            fundo_id,
        ]
    )
    assert with_fundo_result.result.exit_code == 0, with_fundo_result.result.output
    with_fundo_id = cast("dict[str, Any]", with_fundo_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", with_fundo_id))
    with_fundo_record = _query_template(live_client, with_fundo_id, with_links=True)
    assert with_fundo_record is not None
    linked_fundo = _single(with_fundo_record.get("fundo"))
    assert linked_fundo is not None
    assert linked_fundo["id"] == fundo_id

    # 4. criar with --antecessor-id <first id> -> nested antecessor resolves (self-link proof)
    sucessor_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Sucessor {suffix}",
            "--tipo-geracao",
            "encadeado",
            "--regra-competencia",
            "encadeada",
            "--antecessor-id",
            eid,
        ]
    )
    assert sucessor_result.result.exit_code == 0, sucessor_result.result.output
    sucessor_id = cast("dict[str, Any]", sucessor_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", sucessor_id))
    sucessor_record = _query_template(live_client, sucessor_id, with_links=True)
    assert sucessor_record is not None
    linked_antecessor = _single(sucessor_record.get("antecessor"))
    assert linked_antecessor is not None
    assert linked_antecessor["id"] == eid

    # 5. criar --tipo-geracao <invalid> -> exit 2, names all three valid values
    invalid_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            "N",
            "--tipo-geracao",
            "semanal",
            "--regra-competencia",
            "R",
        ]
    )
    assert invalid_result.result.exit_code == 2
    for expected in ("du_fixo", "corrido_fixo", "encadeado"):
        assert expected in invalid_result.result.output

    # 6. listar --ativo filters
    listar_ativo: CliInvocation = run_cli(["rotina", "template", "listar", "--ativo"])
    assert listar_ativo.result.exit_code == 0, listar_ativo.result.output
    ativo_records = cast("list[dict[str, Any]]", listar_ativo.json_out())
    assert any(r["id"] == eid for r in ativo_records)
    assert all(r["ativo"] is True for r in ativo_records)

    # 7. editar --nome alone leaves ativo/propagarAtrasoSoft unchanged (default=None regression)
    novo_nome = f"Renomeado {suffix}"
    editar_result: CliInvocation = run_cli(
        ["rotina", "template", "editar", "--id", eid, "--nome", novo_nome]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    updated_record = _query_template(live_client, eid)
    assert updated_record is not None
    assert updated_record["nome"] == novo_nome
    assert updated_record["ativo"] is True
    assert updated_record["propagarAtrasoSoft"] is True
    assert updated_record["donoId"] == live_session.user_id

    # 8. deletar removes it
    deletar_result: CliInvocation = run_cli(["rotina", "template", "deletar", "--id", eid])
    assert deletar_result.result.exit_code == 0, deletar_result.result.output
    assert _query_template(live_client, eid) is None


def test_criar_with_offset_dias_persists_value(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Offset {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "M0",
            "--offset-dias",
            "5",
        ]
    )
    assert result.result.exit_code == 0, result.result.output
    eid = cast("dict[str, Any]", result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))
    record = _query_template(live_client, eid)
    assert record is not None
    assert record["offsetDias"] == 5


def test_criar_without_offset_dias_omits_key_entirely(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Sem Offset {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "M0",
        ]
    )
    assert result.result.exit_code == 0, result.result.output
    eid = cast("dict[str, Any]", result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))
    record = _query_template(live_client, eid)
    assert record is not None
    assert "offsetDias" not in record

    listar_result: CliInvocation = run_cli(["rotina", "template", "listar", "--limit", "50"])
    assert listar_result.result.exit_code == 0, listar_result.result.output
    listed = cast("list[dict[str, Any]]", listar_result.json_out())
    listed_record = next(r for r in listed if r["id"] == eid)
    assert "offsetDias" not in listed_record


def test_editar_offset_dias_changes_only_that_field(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    nome = f"Template Editar Offset {suffix}"
    criar_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            nome,
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "M0",
            "--offset-dias",
            "3",
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))

    editar_result: CliInvocation = run_cli(
        ["rotina", "template", "editar", "--id", eid, "--offset-dias", "7"]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    record = _query_template(live_client, eid)
    assert record is not None
    assert record["offsetDias"] == 7
    assert record["nome"] == nome


def test_editar_without_offset_dias_leaves_previous_value_unchanged(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    criar_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Offset Preservado {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "M0",
            "--offset-dias",
            "9",
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))

    novo_nome = f"Renomeado Offset {suffix}"
    editar_result: CliInvocation = run_cli(
        ["rotina", "template", "editar", "--id", eid, "--nome", novo_nome]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    record = _query_template(live_client, eid)
    assert record is not None
    assert record["nome"] == novo_nome
    assert record["offsetDias"] == 9


def test_listar_legacy_templates_without_offset_dias_do_not_raise(run_cli: RunCli) -> None:
    result: CliInvocation = run_cli(["rotina", "template", "listar", "--limit", "5"])
    assert result.result.exit_code == 0, result.result.output
    records = cast("list[dict[str, Any]]", result.json_out())
    assert isinstance(records, list)


def test_editar_unknown_id_is_not_found_and_does_not_upsert(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(
        ["rotina", "template", "editar", "--id", phantom_id, "--nome", "Fantasma"]
    )
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"


def test_deletar_unknown_id_is_not_found(run_cli: RunCli) -> None:
    phantom_id = str(uuid.uuid4())
    result: CliInvocation = run_cli(["rotina", "template", "deletar", "--id", phantom_id])
    assert result.result.exit_code != 0
    error_body = json.loads(result.result.output or result.result.stderr)
    assert error_body["error"] == "not_found"
