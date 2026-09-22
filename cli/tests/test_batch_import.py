"""Live `apollo import --from-json <arquivo>` tests (BATCH-01, Phase 31).

Every assertion here talks to the real InstantDB app via the real,
persisted session — no mocking. Skips cleanly (via `live_session`) when no
session exists; a skip here is a failure of an earlier task, not a pass.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest
from instantdb import Instant

from apollo_cli.session import Session
from tests.conftest import CliInvocation, RunCli, unique_suffix

pytestmark = pytest.mark.live


def _single(value: dict[str, Any] | list[dict[str, Any]] | None) -> dict[str, Any] | None:
    """`fundo`/`antecessor` may come back as a single dict or a one-item list."""
    if isinstance(value, list):
        assert len(value) == 1
        return value[0]
    return value


def _write_batch(tmp_path: Path, data: dict[str, Any]) -> Path:
    path = tmp_path / "batch.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def _fundo_record(local_id: str, suffix: str, n: int) -> dict[str, Any]:
    return {
        "_local_id": local_id,
        "nome": f"Fundo Lote {n} {suffix}",
        "codigo": f"LOTE-F{n}-{suffix}",
    }


def _template_record(
    local_id: str,
    suffix: str,
    n: int,
    *,
    tipo_geracao: str = "du_fixo",
    regra_competencia: str = "M0",
    offset_dias: int | None = None,
    dia_semana: str | None = None,
    fundo_id: str | None = None,
    antecessor_id: str | None = None,
) -> dict[str, Any]:
    record: dict[str, Any] = {
        "_local_id": local_id,
        "nome": f"Template Lote {n} {suffix}",
        "tipoGeracao": tipo_geracao,
        "regraCompetencia": regra_competencia,
    }
    if offset_dias is not None:
        record["offsetDias"] = offset_dias
    if dia_semana is not None:
        record["diaSemana"] = dia_semana
    if fundo_id is not None:
        record["fundoId"] = fundo_id
    if antecessor_id is not None:
        record["antecessorId"] = antecessor_id
    return record


def _query_fundos_by_codigos(client: Instant, codigos: list[str]) -> dict[str, dict[str, Any]]:
    result = client.query({"fundos": {"$": {"where": {"codigo": {"$in": codigos}}}}})
    return {row["codigo"]: row for row in result.get("fundos", [])}


def _query_templates_by_nomes(
    client: Instant, nomes: list[str], *, with_links: bool = False
) -> dict[str, dict[str, Any]]:
    sub_query: dict[str, Any] = {"fundo": {}, "antecessor": {}} if with_links else {}
    result = client.query(
        {"templatesRotina": {**sub_query, "$": {"where": {"nome": {"$in": nomes}}}}}
    )
    return {row["nome"]: row for row in result.get("templatesRotina", [])}


def _instancia_count(run_cli: RunCli) -> int:
    return len(cast("list[dict[str, Any]]", run_cli(["rotina", "instancia", "listar"]).json_out()))


def test_import_creates_fundos_and_templates_end_to_end_at_meaningful_scale(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
    tmp_path: Path,
) -> None:
    """Task 1's tracer proof: N fundos + M templatesRotina (including a
    `$`-fundoId reference, a bare/real-id fundoId reference, an
    absent-fundoId template, and a 2-3-hop `encadeado` chain listed
    successor-before-antecessor) all land in exactly ONE atomic transact,
    every reference resolving to the REAL id of its sibling record, and the
    account's `instanciasRotina` row count stays unchanged (C-06)."""
    suffix = unique_suffix()

    bare_fundo_result: CliInvocation = run_cli(
        ["fundo", "criar", "--nome", f"Fundo Bare {suffix}", "--codigo", f"BARE-{suffix}"]
    )
    assert bare_fundo_result.result.exit_code == 0, bare_fundo_result.result.output
    bare_fundo_id = cast("dict[str, Any]", bare_fundo_result.json_out())["id"]
    cleanup_records.append(("fundos", bare_fundo_id))

    fundos = [_fundo_record(f"f{n}", suffix, n) for n in range(1, 5)]

    # t6/t5 are deliberately listed BEFORE t4 (their ultimate antecessor) to
    # prove file-order independence of the encadeado chain resolution.
    templates = [
        _template_record("t1", suffix, 1, offset_dias=5, fundo_id="$f1"),
        _template_record(
            "t2", suffix, 2, tipo_geracao="corrido_fixo", offset_dias=10, fundo_id=bare_fundo_id
        ),
        _template_record("t3", suffix, 3, tipo_geracao="semanal", dia_semana="sexta"),
        _template_record(
            "t6", suffix, 6, tipo_geracao="encadeado", offset_dias=2, antecessor_id="$t5"
        ),
        _template_record(
            "t5", suffix, 5, tipo_geracao="encadeado", offset_dias=1, antecessor_id="$t4"
        ),
        _template_record("t4", suffix, 4, fundo_id="$f2"),
        _template_record("t7", suffix, 7, regra_competencia="M-1", offset_dias=3, fundo_id="$f3"),
        _template_record(
            "t8",
            suffix,
            8,
            tipo_geracao="corrido_fixo",
            regra_competencia="M+1",
            offset_dias=15,
            fundo_id="$f4",
        ),
        _template_record("t9", suffix, 9, offset_dias=-1, fundo_id="$f1"),
        _template_record("t10", suffix, 10, fundo_id="$f2"),
    ]

    batch_path = _write_batch(tmp_path, {"fundos": fundos, "templatesRotina": templates})

    before_count = _instancia_count(run_cli)

    result: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert result.result.exit_code == 0, result.result.output
    report = cast("dict[str, Any]", result.json_out())

    assert report["fundos"]["created"] == sorted(f"f{n}" for n in range(1, 5))
    assert report["fundos"]["existing"] == []
    assert report["templatesRotina"]["created"] == sorted(f"t{n}" for n in range(1, 11))
    assert report["templatesRotina"]["existing"] == []

    after_count = _instancia_count(run_cli)
    assert after_count == before_count

    fundo_codigos = {n: f"LOTE-F{n}-{suffix}" for n in range(1, 5)}
    fundo_rows = _query_fundos_by_codigos(live_client, list(fundo_codigos.values()))
    assert set(fundo_rows) == set(fundo_codigos.values())
    fundo_real_ids: dict[str, str] = {}
    for n, codigo in fundo_codigos.items():
        row = fundo_rows[codigo]
        assert row["donoId"] == live_session.user_id
        assert row["ativo"] is True
        fundo_real_ids[f"f{n}"] = row["id"]
        cleanup_records.append(("fundos", row["id"]))

    template_nomes = {n: f"Template Lote {n} {suffix}" for n in range(1, 11)}
    template_rows = _query_templates_by_nomes(
        live_client, list(template_nomes.values()), with_links=True
    )
    assert set(template_rows) == set(template_nomes.values())
    template_real_ids: dict[str, str] = {}
    for n, nome in template_nomes.items():
        row = template_rows[nome]
        assert row["donoId"] == live_session.user_id
        template_real_ids[f"t{n}"] = row["id"]
        cleanup_records.append(("templatesRotina", row["id"]))

    # $-reference (t1 -> f1) resolves to the real fundo id.
    t1_fundo = _single(template_rows[template_nomes[1]].get("fundo"))
    assert t1_fundo is not None
    assert t1_fundo["id"] == fundo_real_ids["f1"]

    # bare/real-id reference (t2 -> bare_fundo_id) resolves unchanged.
    t2_fundo = _single(template_rows[template_nomes[2]].get("fundo"))
    assert t2_fundo is not None
    assert t2_fundo["id"] == bare_fundo_id

    # absent fundoId (t3): no `fundo` link key at all.
    assert "fundo" not in template_rows[template_nomes[3]]

    # encadeado chain: t5.antecessor == t4 (real id), t6.antecessor == t5
    # (real id) — correct even though t6/t5 were listed BEFORE t4 in the file.
    t5_antecessor = _single(template_rows[template_nomes[5]].get("antecessor"))
    assert t5_antecessor is not None
    assert t5_antecessor["id"] == template_real_ids["t4"]

    t6_antecessor = _single(template_rows[template_nomes[6]].get("antecessor"))
    assert t6_antecessor is not None
    assert t6_antecessor["id"] == template_real_ids["t5"]


def test_import_rejects_whole_file_on_one_broken_record_among_valid_ones(
    run_cli: RunCli,
    live_client: Instant,
    tmp_path: Path,
) -> None:
    """A batch with one deliberately-broken record (unresolvable
    `$antecessorId`) mixed among otherwise-valid records is rejected wholesale
    — exit 2, the error names the broken record, and NONE of the file's other
    valid records were written (D-04)."""
    suffix = unique_suffix()

    fundos = [_fundo_record("gf1", suffix, 900), _fundo_record("gf2", suffix, 901)]
    templates = [
        _template_record("gt1", suffix, 900, offset_dias=1, fundo_id="$gf1"),
        _template_record("gt2", suffix, 901, offset_dias=2, fundo_id="$gf2"),
        _template_record(
            "gt_broken",
            suffix,
            902,
            tipo_geracao="encadeado",
            offset_dias=0,
            antecessor_id="$nao_existe",
        ),
    ]

    batch_path = _write_batch(tmp_path, {"fundos": fundos, "templatesRotina": templates})

    result: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert result.result.exit_code == 2, result.result.output
    error_body = cast("dict[str, Any]", json.loads(result.result.output or result.result.stderr))
    errors = cast("list[dict[str, Any]]", error_body["errors"])
    assert any(
        e["_local_id"] == "gt_broken"
        and e["reason"] == "antecessor_id_referencia_local_nao_encontrada"
        for e in errors
    )

    fundo_rows = _query_fundos_by_codigos(
        live_client, [f"LOTE-F900-{suffix}", f"LOTE-F901-{suffix}"]
    )
    assert fundo_rows == {}
    template_rows = _query_templates_by_nomes(
        live_client, [f"Template Lote 900 {suffix}", f"Template Lote 901 {suffix}"]
    )
    assert template_rows == {}
