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


def test_import_collects_all_errors_across_multiple_broken_records(
    run_cli: RunCli,
    live_client: Instant,
    tmp_path: Path,
) -> None:
    """A single batch file with 5+ independently-broken records spanning
    both entities and both validation checks (missing `codigo`, invalid
    `tipoGeracao`, an unresolvable `$`-reference, a forbidden `donoId` key,
    and a 2-node antecessor cycle) is rejected with exactly that many error
    entries in one response, exit 2, and zero writes for the batch's
    remaining valid records (D-04)."""
    suffix = unique_suffix()

    fundos = [
        {"_local_id": "bad_fundo_no_codigo", "nome": f"Bad Fundo NoCodigo {suffix}"},
        {
            "_local_id": "bad_donoid",
            "nome": f"Bad DonoId {suffix}",
            "codigo": f"BADDONO-{suffix}",
            "donoId": "outro-usuario",
        },
        {
            "_local_id": "valid_fundo",
            "nome": f"Valid Fundo {suffix}",
            "codigo": f"VALIDF-{suffix}",
        },
    ]
    templates = [
        {
            "_local_id": "bad_tipo",
            "nome": f"Bad Tipo {suffix}",
            "tipoGeracao": "nao_existe",
            "regraCompetencia": "M0",
        },
        {
            "_local_id": "bad_ref",
            "nome": f"Bad Ref {suffix}",
            "tipoGeracao": "du_fixo",
            "regraCompetencia": "M0",
            "offsetDias": 1,
            "fundoId": "$nao_existe",
        },
        {
            "_local_id": "cycle_a",
            "nome": f"Cycle A {suffix}",
            "tipoGeracao": "encadeado",
            "regraCompetencia": "M0",
            "offsetDias": 0,
            "antecessorId": "$cycle_b",
        },
        {
            "_local_id": "cycle_b",
            "nome": f"Cycle B {suffix}",
            "tipoGeracao": "encadeado",
            "regraCompetencia": "M0",
            "offsetDias": 0,
            "antecessorId": "$cycle_a",
        },
        {
            "_local_id": "valid_template",
            "nome": f"Valid Template {suffix}",
            "tipoGeracao": "du_fixo",
            "regraCompetencia": "M0",
            "offsetDias": 2,
        },
    ]

    batch_path = _write_batch(tmp_path, {"fundos": fundos, "templatesRotina": templates})

    result: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert result.result.exit_code == 2, result.result.output
    error_body = cast("dict[str, Any]", json.loads(result.result.output or result.result.stderr))
    errors = cast("list[dict[str, Any]]", error_body["errors"])
    assert len(errors) >= 5, errors

    reasons = {e["reason"] for e in errors}
    for expected_reason in (
        "codigo_ausente",
        "tipo_geracao_invalido",
        "fundo_id_referencia_local_nao_encontrada",
        "donoId_nao_permitido",
        "antecessor_ciclico",
    ):
        assert expected_reason in reasons, f"missing reason {expected_reason!r} in {errors}"

    fundo_rows = _query_fundos_by_codigos(live_client, [f"VALIDF-{suffix}"])
    assert fundo_rows == {}
    template_rows = _query_templates_by_nomes(live_client, [f"Valid Template {suffix}"])
    assert template_rows == {}


def test_import_dry_run_reports_created_existing_split_without_writing(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
    tmp_path: Path,
) -> None:
    """`--dry-run` against a batch mixing new and already-existing records
    reports the exact created/existing split a real run would, and a direct
    re-query confirms not one "would-be-created" record actually exists
    afterward (D-09)."""
    suffix = unique_suffix()

    seed_result: CliInvocation = run_cli(
        ["fundo", "criar", "--nome", f"Seed Fundo {suffix}", "--codigo", f"SEED-{suffix}"]
    )
    assert seed_result.result.exit_code == 0, seed_result.result.output
    seed_fundo_id = cast("dict[str, Any]", seed_result.json_out())["id"]
    cleanup_records.append(("fundos", seed_fundo_id))

    fundos = [
        {
            "_local_id": "existing_fundo",
            "nome": f"Seed Fundo Batch {suffix}",
            "codigo": f"SEED-{suffix}",
        },
        {"_local_id": "new_fundo_1", "nome": f"New Fundo 1 {suffix}", "codigo": f"NEWF1-{suffix}"},
        {"_local_id": "new_fundo_2", "nome": f"New Fundo 2 {suffix}", "codigo": f"NEWF2-{suffix}"},
    ]
    templates = [
        _template_record("new_template_1", suffix, 1, offset_dias=1, fundo_id="$existing_fundo"),
        _template_record(
            "new_template_2",
            suffix,
            2,
            tipo_geracao="corrido_fixo",
            offset_dias=5,
            fundo_id="$new_fundo_1",
        ),
        _template_record(
            "new_template_3",
            suffix,
            3,
            tipo_geracao="semanal",
            dia_semana="sexta",
            fundo_id="$new_fundo_2",
        ),
    ]

    batch_path = _write_batch(tmp_path, {"fundos": fundos, "templatesRotina": templates})

    result: CliInvocation = run_cli(["import", "--from-json", str(batch_path), "--dry-run"])
    assert result.result.exit_code == 0, result.result.output
    report = cast("dict[str, Any]", result.json_out())

    assert report["fundos"]["existing"] == ["existing_fundo"]
    assert report["fundos"]["created"] == ["new_fundo_1", "new_fundo_2"]
    assert report["templatesRotina"]["existing"] == []
    assert report["templatesRotina"]["created"] == [
        "new_template_1",
        "new_template_2",
        "new_template_3",
    ]

    fundo_rows = _query_fundos_by_codigos(live_client, [f"NEWF1-{suffix}", f"NEWF2-{suffix}"])
    assert fundo_rows == {}
    template_nomes = [f"Template Lote {n} {suffix}" for n in (1, 2, 3)]
    template_rows = _query_templates_by_nomes(live_client, template_nomes)
    assert template_rows == {}


def test_import_same_file_rerun_reports_everything_existing_no_duplicates(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
    tmp_path: Path,
) -> None:
    """Running the identical file twice (second call with no `--dry-run`)
    reports every record as `existing` on the second call — zero entries in
    `created`, zero duplicate rows by natural key (D-05, SC2)."""
    suffix = unique_suffix()

    fundos = [
        {"_local_id": "rerun_f1", "nome": f"Rerun Fundo 1 {suffix}", "codigo": f"RERUNF1-{suffix}"},
        {"_local_id": "rerun_f2", "nome": f"Rerun Fundo 2 {suffix}", "codigo": f"RERUNF2-{suffix}"},
    ]
    templates = [
        _template_record("rerun_t1", suffix, 1, offset_dias=1, fundo_id="$rerun_f1"),
        _template_record(
            "rerun_t2", suffix, 2, tipo_geracao="corrido_fixo", offset_dias=3, fundo_id="$rerun_f2"
        ),
    ]

    batch_path = _write_batch(tmp_path, {"fundos": fundos, "templatesRotina": templates})

    first: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert first.result.exit_code == 0, first.result.output
    first_report = cast("dict[str, Any]", first.json_out())
    assert first_report["fundos"]["created"] == ["rerun_f1", "rerun_f2"]
    assert first_report["templatesRotina"]["created"] == ["rerun_t1", "rerun_t2"]

    second: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert second.result.exit_code == 0, second.result.output
    second_report = cast("dict[str, Any]", second.json_out())
    assert second_report["fundos"]["created"] == []
    assert second_report["fundos"]["existing"] == ["rerun_f1", "rerun_f2"]
    assert second_report["templatesRotina"]["created"] == []
    assert second_report["templatesRotina"]["existing"] == ["rerun_t1", "rerun_t2"]

    fundo_rows = _query_fundos_by_codigos(live_client, [f"RERUNF1-{suffix}", f"RERUNF2-{suffix}"])
    assert len(fundo_rows) == 2
    for row in fundo_rows.values():
        cleanup_records.append(("fundos", row["id"]))

    template_nomes = [f"Template Lote {n} {suffix}" for n in (1, 2)]
    template_rows = _query_templates_by_nomes(live_client, template_nomes)
    assert len(template_rows) == 2
    for row in template_rows.values():
        cleanup_records.append(("templatesRotina", row["id"]))

    # Exactly one row per natural key on the underlying DB (no duplicate rows
    # created by the second, no-op call).
    for codigo in (f"RERUNF1-{suffix}", f"RERUNF2-{suffix}"):
        result_rows = live_client.query({"fundos": {"$": {"where": {"codigo": codigo}}}}).get(
            "fundos", []
        )
        assert len(result_rows) == 1
    for nome in template_nomes:
        result_rows = live_client.query({"templatesRotina": {"$": {"where": {"nome": nome}}}}).get(
            "templatesRotina", []
        )
        assert len(result_rows) == 1


def test_top_level_instanciasrotina_key_rejected_wholesale_c06(
    run_cli: RunCli,
    live_client: Instant,
    tmp_path: Path,
) -> None:
    """A batch file containing otherwise-valid `fundos`/`templatesRotina`
    records PLUS a top-level `instanciasRotina` key holding one
    plausible-looking instance-shaped dict is rejected in its entirety —
    exit 2, the unrecognized top-level key named in the error list, zero
    writes for the WHOLE file, and a live `apollo rotina instancia listar`
    count unchanged before/after the run (C-06, T-31-05)."""
    suffix = unique_suffix()

    fundos = [
        {"_local_id": "c06_f1", "nome": f"C06 Fundo 1 {suffix}", "codigo": f"C06F1-{suffix}"},
        {"_local_id": "c06_f2", "nome": f"C06 Fundo 2 {suffix}", "codigo": f"C06F2-{suffix}"},
    ]
    templates = [
        _template_record("c06_t1", suffix, 1, offset_dias=1, fundo_id="$c06_f1"),
        _template_record("c06_t2", suffix, 2, offset_dias=2, fundo_id="$c06_f2"),
    ]
    adversarial_instancias = [
        {
            "_local_id": "i1",
            "templateId": "$c06_t1",
            "dataPrevista": "2025-01-10",
            "competencia": "2025-01",
            "tipoPrazo": "gerado",
            "status": "pendente",
        }
    ]

    batch_path = _write_batch(
        tmp_path,
        {
            "fundos": fundos,
            "templatesRotina": templates,
            "instanciasRotina": adversarial_instancias,
        },
    )

    before_count = _instancia_count(run_cli)

    result: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert result.result.exit_code == 2, result.result.output
    error_body = cast("dict[str, Any]", json.loads(result.result.output or result.result.stderr))
    errors = cast("list[dict[str, Any]]", error_body["errors"])
    assert any(
        e["entity"] == "instanciasRotina" and e["reason"] == "chave_nivel_superior_nao_reconhecida"
        for e in errors
    ), errors

    fundo_rows = _query_fundos_by_codigos(live_client, [f"C06F1-{suffix}", f"C06F2-{suffix}"])
    assert fundo_rows == {}
    template_nomes = [f"Template Lote {n} {suffix}" for n in (1, 2)]
    template_rows = _query_templates_by_nomes(live_client, template_nomes)
    assert template_rows == {}

    after_count = _instancia_count(run_cli)
    assert after_count == before_count
