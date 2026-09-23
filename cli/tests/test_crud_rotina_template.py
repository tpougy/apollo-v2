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
from instantdb import id as new_id

from apollo_cli.session import Session
from tests.conftest import CliInvocation, RunCli, unique_suffix

pytestmark = pytest.mark.live


def _query_template(
    client: Instant, eid: str, *, with_links: bool = False
) -> dict[str, Any] | None:
    sub_query: dict[str, Any] = {"entidade": {}, "antecessor": {}} if with_links else {}
    result = client.query({"templatesRotina": {**sub_query, "$": {"where": {"id": eid}}}})
    rows = result.get("templatesRotina", [])
    return rows[0] if rows else None


def _single(value: dict[str, Any] | list[dict[str, Any]] | None) -> dict[str, Any] | None:
    """`entidade`/`antecessor` may come back as a single dict or a one-item list."""
    if isinstance(value, list):
        assert len(value) == 1
        return value[0]
    return value


def _create_entidade(run_cli: RunCli, cleanup_records: list[tuple[str, str]], suffix: str) -> str:
    entidade_result: CliInvocation = run_cli(
        [
            "entidade",
            "criar",
            "--nome",
            f"Fundo p/ Rotina {suffix}",
            "--codigo",
            f"ROT-{suffix}",
            "--tipo-entidade",
            "Fundo",
        ]
    )
    assert entidade_result.result.exit_code == 0, entidade_result.result.output
    entidade_id = cast("dict[str, Any]", entidade_result.json_out())["id"]
    cleanup_records.append(("entidades", entidade_id))
    return entidade_id


def _seed_linked_instancia(
    live_client: Instant,
    live_session: Session,
    template_id: str,
    suffix: str,
    n: int,
) -> str:
    """Seed one `instanciasRotina` row linked to `template_id`, mirroring
    `test_rotina_instancia.py`'s own `_seed_instancia` shape (same field set,
    same `.create(fields).link({"template": ...})` chain), returning only the
    new instance id.
    """
    eid = new_id()
    fields = {
        "dedupeKey": f"phase30-life01-{suffix}-{n}",
        "dataPrevista": "2026-09-10",
        "competencia": "2026-09",
        "tipoPrazo": "hard",
        "status": "pendente",
        "donoId": live_session.user_id,
    }
    live_client.transact(
        live_client.tx["instanciasRotina"][eid].create(fields).link({"template": template_id})
    )
    return eid


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
            "M0",
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
    assert record["regraCompetencia"] == "M0"
    assert record["propagarAtrasoSoft"] is True
    assert record["ativo"] is True

    # 3. criar with --entidade-id (throwaway entidade) -> nested entidade resolves
    entidade_id = _create_entidade(run_cli, cleanup_records, suffix)
    with_entidade_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template c/ Fundo {suffix}",
            "--tipo-geracao",
            "corrido_fixo",
            "--regra-competencia",
            "M0",
            "--entidade-id",
            entidade_id,
        ]
    )
    assert with_entidade_result.result.exit_code == 0, with_entidade_result.result.output
    with_entidade_id = cast("dict[str, Any]", with_entidade_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", with_entidade_id))
    with_entidade_record = _query_template(live_client, with_entidade_id, with_links=True)
    assert with_entidade_record is not None
    linked_entidade = _single(with_entidade_record.get("entidade"))
    assert linked_entidade is not None
    assert linked_entidade["id"] == entidade_id

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
            "M0",
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

    # 5. criar --tipo-geracao <invalid> -> exit 2, names all four valid values
    # (SEM-01: "semanal" is now a valid tipoGeracao, so the invalid-value
    # probe must use a genuinely still-invalid token instead.)
    invalid_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            "N",
            "--tipo-geracao",
            "invalido",
            "--regra-competencia",
            "M0",
        ]
    )
    assert invalid_result.result.exit_code == 2
    for expected in ("du_fixo", "corrido_fixo", "encadeado", "semanal"):
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


def test_criar_with_dia_semana_persists_value(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """SEM-01: `--dia-semana` persists on a `semanal` template, mirroring
    `test_criar_with_offset_dias_persists_value`."""
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Dia Semana {suffix}",
            "--tipo-geracao",
            "semanal",
            "--regra-competencia",
            "M0",
            "--dia-semana",
            "sexta",
        ]
    )
    assert result.result.exit_code == 0, result.result.output
    eid = cast("dict[str, Any]", result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))
    record = _query_template(live_client, eid)
    assert record is not None
    assert record["diaSemana"] == "sexta"


def test_criar_without_dia_semana_omits_key_entirely(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """SEM-01: omitting `--dia-semana` never writes the key, mirroring
    `test_criar_without_offset_dias_omits_key_entirely`."""
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Sem Dia Semana {suffix}",
            "--tipo-geracao",
            "semanal",
            "--regra-competencia",
            "M0",
        ]
    )
    assert result.result.exit_code == 0, result.result.output
    eid = cast("dict[str, Any]", result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))
    record = _query_template(live_client, eid)
    assert record is not None
    assert "diaSemana" not in record


def test_editar_dia_semana_changes_only_that_field(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """SEM-01: `--dia-semana` on `editar` changes only that field, mirroring
    `test_editar_offset_dias_changes_only_that_field`."""
    suffix = unique_suffix()
    nome = f"Template Editar Dia Semana {suffix}"
    criar_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            nome,
            "--tipo-geracao",
            "semanal",
            "--regra-competencia",
            "M0",
            "--dia-semana",
            "sexta",
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))

    editar_result: CliInvocation = run_cli(
        ["rotina", "template", "editar", "--id", eid, "--dia-semana", "quarta"]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    record = _query_template(live_client, eid)
    assert record is not None
    assert record["diaSemana"] == "quarta"
    assert record["nome"] == nome


def test_editar_without_dia_semana_leaves_previous_value_unchanged(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """SEM-01: omitting `--dia-semana` on `editar` never resets a previously
    set value, mirroring `test_editar_without_offset_dias_leaves_previous_value_unchanged`."""
    suffix = unique_suffix()
    criar_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Dia Semana Preservado {suffix}",
            "--tipo-geracao",
            "semanal",
            "--regra-competencia",
            "M0",
            "--dia-semana",
            "sexta",
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))

    novo_nome = f"Renomeado Dia Semana {suffix}"
    editar_result: CliInvocation = run_cli(
        ["rotina", "template", "editar", "--id", eid, "--nome", novo_nome]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    record = _query_template(live_client, eid)
    assert record is not None
    assert record["nome"] == novo_nome
    assert record["diaSemana"] == "sexta"


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


def test_deletar_with_linked_instances_blocks_by_default_with_exact_count(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """D-01/LIFE-01 must-have: a template with linked instances blocks by
    default, exit 5, exact count in the error, zero writes."""
    suffix = unique_suffix()
    criar_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Bloqueio {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "M0",
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    template_id = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", template_id))

    instance_id_1 = _seed_linked_instancia(live_client, live_session, template_id, suffix, 1)
    instance_id_2 = _seed_linked_instancia(live_client, live_session, template_id, suffix, 2)
    cleanup_records.append(("instanciasRotina", instance_id_1))
    cleanup_records.append(("instanciasRotina", instance_id_2))

    deletar_result: CliInvocation = run_cli(["rotina", "template", "deletar", "--id", template_id])
    assert deletar_result.result.exit_code == 5, deletar_result.result.output

    error_body = json.loads(deletar_result.result.output or deletar_result.result.stderr)
    assert error_body["error"] == "instances_linked"
    assert error_body["template_id"] == template_id
    assert error_body["instance_count"] == 2

    # Zero writes: template and both instances still exist.
    assert _query_template(live_client, template_id) is not None
    for instance_id in (instance_id_1, instance_id_2):
        record = live_client.query({"instanciasRotina": {"$": {"where": {"id": instance_id}}}}).get(
            "instanciasRotina", []
        )
        assert record, f"instance {instance_id} must still exist after a blocked delete"


def test_deletar_with_force_deletes_template_and_orphans_linked_instance(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """D-01/LIFE-01 must-have: `--force` deletes the template without ever
    cascading, and the live-verified 30-PATTERNS.md orphan shape (the
    `template` key entirely absent under link expansion, not `[]`/`null`)
    becomes a permanent regression test."""
    suffix = unique_suffix()
    criar_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Force {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "M0",
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    template_id = cast("dict[str, Any]", criar_result.json_out())["id"]

    instance_id = _seed_linked_instancia(live_client, live_session, template_id, suffix, 1)
    cleanup_records.append(("instanciasRotina", instance_id))

    deletar_result: CliInvocation = run_cli(
        ["rotina", "template", "deletar", "--id", template_id, "--force"]
    )
    assert deletar_result.result.exit_code == 0, deletar_result.result.output
    body = cast("dict[str, Any]", deletar_result.json_out())
    assert body["deleted"] is True
    assert body["force"] is True
    assert body["instances_linked_at_delete"] == 1

    assert _query_template(live_client, template_id) is None

    # Live-verified exact key-absence proof from 30-PATTERNS.md's experiment.
    expanded = live_client.query(
        {"instanciasRotina": {"template": {}, "$": {"where": {"id": instance_id}}}}
    )
    rows = expanded.get("instanciasRotina", [])
    assert rows, "orphaned instance row must still exist"
    assert "template" not in rows[0], (
        f"orphaned instance's expanded 'template' key must be entirely absent, got: {rows[0]}"
    )


def test_deletar_force_with_zero_linked_instances_is_noop_and_still_succeeds(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """D-01/LIFE-01 must-have: `--force` with zero linked instances is a
    documented no-op, not an error to pass the flag."""
    suffix = unique_suffix()
    criar_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Force Noop {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "M0",
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    template_id = cast("dict[str, Any]", criar_result.json_out())["id"]

    deletar_result: CliInvocation = run_cli(
        ["rotina", "template", "deletar", "--id", template_id, "--force"]
    )
    assert deletar_result.result.exit_code == 0, deletar_result.result.output
    body = cast("dict[str, Any]", deletar_result.json_out())
    assert body["instances_linked_at_delete"] == 0
    assert body["force"] is True
    assert _query_template(live_client, template_id) is None


def test_deletar_help_documents_force_and_orphan_consequence(run_cli: RunCli) -> None:
    result: CliInvocation = run_cli(["rotina", "template", "deletar", "--help"])
    assert result.result.exit_code == 0, result.result.output
    assert "--force" in result.result.output
    assert "orf" in result.result.output.lower()


@pytest.mark.parametrize("regra", ["M-1", "M-2", "M+1"])
def test_criar_aceita_regra_competencia_nao_m0(
    regra: str,
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """VAL-01/VAL-02/VAL-03 must-have: M-1/M-2/M+1 stay accepted and persist
    unchanged — not just referenced inside a rejection-message assertion."""
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Regra {regra} {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            regra,
        ]
    )
    assert result.result.exit_code == 0, result.result.output
    eid = cast("dict[str, Any]", result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))
    record = _query_template(live_client, eid)
    assert record is not None
    assert record["regraCompetencia"] == regra


@pytest.mark.parametrize("regra", ["M-1", "M-2", "M+1"])
def test_editar_aceita_regra_competencia_nao_m0(
    regra: str,
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """Mirrors test_criar_aceita_regra_competencia_nao_m0 but through editar:
    an existing M0 template can be changed to M-1/M-2/M+1 and it round-trips."""
    suffix = unique_suffix()
    criar_result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template p/ Editar Regra {regra} {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "M0",
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))

    editar_result: CliInvocation = run_cli(
        ["rotina", "template", "editar", "--id", eid, "--regra-competencia", regra]
    )
    assert editar_result.result.exit_code == 0, editar_result.result.output
    record = _query_template(live_client, eid)
    assert record is not None
    assert record["regraCompetencia"] == regra


def test_criar_regra_competencia_invalida_e_recusada_na_hora(run_cli: RunCli) -> None:
    suffix = unique_suffix()
    result: CliInvocation = run_cli(
        [
            "rotina",
            "template",
            "criar",
            "--nome",
            f"Template Invalido {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "bogus",
        ]
    )
    assert result.result.exit_code == 2
    for expected in ("M0", "M-1", "M-2", "M+1"):
        assert expected in result.result.output


def test_editar_regra_competencia_invalida_e_recusada_na_hora(
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
            f"Template p/ Editar Invalido {suffix}",
            "--tipo-geracao",
            "du_fixo",
            "--regra-competencia",
            "M0",
        ]
    )
    assert criar_result.result.exit_code == 0, criar_result.result.output
    eid = cast("dict[str, Any]", criar_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", eid))

    editar_result: CliInvocation = run_cli(
        ["rotina", "template", "editar", "--id", eid, "--regra-competencia", "bogus"]
    )
    assert editar_result.result.exit_code == 2
    for expected in ("M0", "M-1", "M-2", "M+1"):
        assert expected in editar_result.result.output

    record = _query_template(live_client, eid)
    assert record is not None
    assert record["regraCompetencia"] == "M0"
