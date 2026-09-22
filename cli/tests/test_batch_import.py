"""Live `apollo import --from-json <arquivo>` tests (BATCH-01, Phase 31).

Every assertion here talks to the real InstantDB app via the real,
persisted session — no mocking. Skips cleanly (via `live_session`) when no
session exists; a skip here is a failure of an earlier task, not a pass.
"""

from __future__ import annotations

import importlib
import json
from collections import Counter
from pathlib import Path
from typing import Any, cast

import pytest
from instantdb import Instant
from instantdb import id as new_id

from apollo_cli.crud_helpers import now_iso
from apollo_cli.routine_job import (
    DIA_SEMANA_CHOICES,
    REGRAS_COMPETENCIA_SUPORTADAS,
    TIPO_GERACAO_CHOICES,
)
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


def _build_scale_batch(
    suffix: str, n_fundos: int, n_templates: int, *, build_chains: bool = True
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[list[str]]]:
    """Programmatically builds `n_fundos` fundo records and `n_templates`
    template records via looped construction (never hand-typed literals):
    every template's `tipoGeracao` cycles through ALL `TIPO_GERACAO_CHOICES`
    values, `regraCompetencia` cycles through `REGRAS_COMPETENCIA_SUPORTADAS`,
    and `fundoId` round-robins across the `n_fundos` fundo local_ids (every
    10th template deliberately left with no `fundoId` at all — a small
    handful). When `build_chains` is set, 2 disjoint `encadeado` chains
    (3-hop then 2-hop) are carved out of the templates the cycling above
    already assigned `tipoGeracao="encadeado"` — every OTHER
    `encadeado`-typed template deliberately keeps no `antecessorId` (a
    valid, non-chained record); `build_chains=False` skips this (used for
    smaller batches with too few `encadeado`-typed templates to carve 2
    disjoint chains from). Returns `(fundos, templates, chains)` — `chains`
    is the list of local_id chains, antecessor-first order, for live
    assertion against real resolved links.
    """
    fundos = [_fundo_record(f"f{n}", suffix, n) for n in range(1, n_fundos + 1)]

    tipo_values = list(TIPO_GERACAO_CHOICES)
    regra_values = list(REGRAS_COMPETENCIA_SUPORTADAS)
    dia_values = list(DIA_SEMANA_CHOICES)

    templates: list[dict[str, Any]] = []
    encadeado_local_ids: list[str] = []

    for n in range(1, n_templates + 1):
        local_id = f"t{n}"
        tipo = tipo_values[(n - 1) % len(tipo_values)]
        regra = regra_values[(n - 1) % len(regra_values)]
        fundo_id = None if n % 10 == 0 else f"$f{((n - 1) % n_fundos) + 1}"

        if tipo == "semanal":
            record = _template_record(
                local_id,
                suffix,
                n,
                tipo_geracao=tipo,
                regra_competencia=regra,
                dia_semana=dia_values[(n - 1) % len(dia_values)],
                fundo_id=fundo_id,
            )
        else:
            record = _template_record(
                local_id,
                suffix,
                n,
                tipo_geracao=tipo,
                regra_competencia=regra,
                offset_dias=n,
                fundo_id=fundo_id,
            )
        if tipo == "encadeado":
            encadeado_local_ids.append(local_id)
        templates.append(record)

    chains: list[list[str]] = []
    if build_chains:
        assert len(encadeado_local_ids) >= 5, (
            f"need >=5 encadeado-typed templates to carve 2 disjoint chains, "
            f"got {len(encadeado_local_ids)}"
        )
        chain_a = encadeado_local_ids[0:3]
        chain_b = encadeado_local_ids[3:5]
        chains = [chain_a, chain_b]
        by_local_id = {record["_local_id"]: record for record in templates}
        for chain in chains:
            for position in range(1, len(chain)):
                by_local_id[chain[position]]["antecessorId"] = f"${chain[position - 1]}"

    return fundos, templates, chains


def _assert_no_duplicate_rows_by_key(
    client: Instant, etype: str, where_field: str, keys: list[str]
) -> None:
    """Confirms exactly one row per natural key. A dict-collapsing helper
    like `_query_fundos_by_codigos` silently hides a duplicate behind its
    last-write-wins key, so this queries the RAW row list for the whole key
    set in one call and counts occurrences per key directly via `Counter`."""
    if not keys:
        return
    result = client.query({etype: {"$": {"where": {where_field: {"$in": keys}}}}})
    rows = result.get(etype, [])
    counts = Counter(row[where_field] for row in rows)
    assert len(rows) == len(keys), f"{etype}: expected {len(keys)} rows, got {len(rows)}"
    for key in keys:
        assert counts[key] == 1, f"{etype}: {key!r} has {counts[key]} rows (expected 1)"


def _seed_fundo(client: Instant, dono_id: str, record: dict[str, Any]) -> str:
    """Directly `client.transact`s a single fundo row, bypassing the CLI
    entirely — the closest honest simulation of "a prior partial run
    already committed this," since a genuinely torn `apollo import` mid-run
    is unreachable to engineer directly (RESEARCH.md Q3)."""
    eid = new_id()
    client.transact(
        client.tx["fundos"][eid].create(
            {
                "nome": record["nome"],
                "codigo": record["codigo"],
                "ativo": True,
                "createdAt": now_iso(),
                "donoId": dono_id,
            }
        )
    )
    return eid


def _seed_template(
    client: Instant, dono_id: str, record: dict[str, Any], fundo_real_id: str | None
) -> str:
    """Directly `client.transact`s a single templatesRotina row, bypassing
    the CLI entirely, linked to an already-real `fundo_real_id` (or no
    `fundo` link at all) so its natural key exactly matches what
    `run_batch_import`'s own resolution would compute for the same batch
    record."""
    eid = new_id()
    fields: dict[str, Any] = {
        "nome": record["nome"],
        "tipoGeracao": record["tipoGeracao"],
        "regraCompetencia": record["regraCompetencia"],
        "propagarAtrasoSoft": False,
        "ativo": True,
        "donoId": dono_id,
    }
    if "offsetDias" in record:
        fields["offsetDias"] = record["offsetDias"]
    if "diaSemana" in record:
        fields["diaSemana"] = record["diaSemana"]
    chunk = client.tx["templatesRotina"][eid].create(fields)
    if fundo_real_id is not None:
        chunk = chunk.link({"fundo": fundo_real_id})
    client.transact(chunk)
    return eid


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


def test_full_onboarding_scale_single_invocation_success_criterion_3(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
    tmp_path: Path,
) -> None:
    """ROADMAP Success Criterion 3, literal scale: an 18-fundo/84-template
    batch (the real onboarding shape) — cycling all 4 `tipoGeracao` values
    and every `regraCompetencia` value, `fundoId` round-robin across the 18
    fundo local_ids (a handful with none), and 2 disjoint `encadeado`
    chains of 2-3 templates each — completes in exactly ONE
    `apollo import --from-json` invocation, not 102 separate CLI calls."""
    suffix = unique_suffix()
    fundos, templates, chains = _build_scale_batch(suffix, 18, 84)
    batch_path = _write_batch(tmp_path, {"fundos": fundos, "templatesRotina": templates})

    result: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert result.result.exit_code == 0, result.result.output
    report = cast("dict[str, Any]", result.json_out())

    assert len(report["fundos"]["created"]) == 18
    assert report["fundos"]["existing"] == []
    assert len(report["templatesRotina"]["created"]) == 84
    assert report["templatesRotina"]["existing"] == []

    fundo_codigos = [f"LOTE-F{n}-{suffix}" for n in range(1, 19)]
    fundo_rows = _query_fundos_by_codigos(live_client, fundo_codigos)
    assert set(fundo_rows) == set(fundo_codigos)
    for row in fundo_rows.values():
        assert row["donoId"] == live_session.user_id
        assert row["ativo"] is True
        cleanup_records.append(("fundos", row["id"]))

    template_nomes = [f"Template Lote {n} {suffix}" for n in range(1, 85)]
    template_rows = _query_templates_by_nomes(live_client, template_nomes, with_links=True)
    assert set(template_rows) == set(template_nomes)
    template_real_ids: dict[str, str] = {}
    for n in range(1, 85):
        row = template_rows[f"Template Lote {n} {suffix}"]
        assert row["donoId"] == live_session.user_id
        template_real_ids[f"t{n}"] = row["id"]
        cleanup_records.append(("templatesRotina", row["id"]))

    # Both encadeado chains' antecessor links resolve to the correct real
    # sibling ids, regardless of chain-member position in the file.
    assert len(chains) == 2
    for chain in chains:
        assert 2 <= len(chain) <= 3
        for position in range(1, len(chain)):
            child_nome = f"Template Lote {chain[position][1:]} {suffix}"
            parent_local_id = chain[position - 1]
            antecessor = _single(template_rows[child_nome].get("antecessor"))
            assert antecessor is not None
            assert antecessor["id"] == template_real_ids[parent_local_id]


def test_full_onboarding_scale_rerun_is_fully_existing_success_criterion_2(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
    tmp_path: Path,
) -> None:
    """ROADMAP Success Criterion 2, literal onboarding scale: re-running the
    identical 18+84 file reports every record `existing` for BOTH entities
    (fundos and templatesRotina) — zero `created`, and the live row counts
    by natural key are unchanged, zero duplicate rows (D-05)."""
    suffix = unique_suffix()
    fundos, templates, _chains = _build_scale_batch(suffix, 18, 84)
    batch_path = _write_batch(tmp_path, {"fundos": fundos, "templatesRotina": templates})

    first: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert first.result.exit_code == 0, first.result.output
    first_report = cast("dict[str, Any]", first.json_out())
    assert len(first_report["fundos"]["created"]) == 18
    assert len(first_report["templatesRotina"]["created"]) == 84

    second: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert second.result.exit_code == 0, second.result.output
    second_report = cast("dict[str, Any]", second.json_out())
    assert second_report["fundos"]["created"] == []
    assert len(second_report["fundos"]["existing"]) == 18
    assert second_report["templatesRotina"]["created"] == []
    assert len(second_report["templatesRotina"]["existing"]) == 84

    fundo_codigos = [f"LOTE-F{n}-{suffix}" for n in range(1, 19)]
    fundo_rows = _query_fundos_by_codigos(live_client, fundo_codigos)
    assert len(fundo_rows) == 18
    for row in fundo_rows.values():
        cleanup_records.append(("fundos", row["id"]))

    template_nomes = [f"Template Lote {n} {suffix}" for n in range(1, 85)]
    template_rows = _query_templates_by_nomes(live_client, template_nomes)
    assert len(template_rows) == 84
    for row in template_rows.values():
        cleanup_records.append(("templatesRotina", row["id"]))

    # Still exactly one row per natural key — the second, no-op call created
    # zero duplicates.
    _assert_no_duplicate_rows_by_key(live_client, "fundos", "codigo", fundo_codigos)
    _assert_no_duplicate_rows_by_key(live_client, "templatesRotina", "nome", template_nomes)


def test_partial_batch_already_landed_resumes_without_duplication(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
    tmp_path: Path,
) -> None:
    """A batch where roughly a third of its fundo/template natural keys
    already exist — seeded directly via `live_client` BEFORE `apollo import`
    ever runs, simulating "a prior partial run already landed these" (a
    genuinely torn `apollo import` mid-run is unreachable to engineer
    directly per RESEARCH.md Q3) — converges correctly on ONE full-file
    `apollo import` call: the pre-seeded third is reported `existing`, the
    rest `created`, and re-querying confirms not one natural key has more
    than one matching row (D-05/D-06/D-07's resumability guarantee, SC2)."""
    suffix = unique_suffix()
    dono_id = live_session.user_id
    fundos, templates, _chains = _build_scale_batch(suffix, 6, 15, build_chains=False)
    by_local_id = {record["_local_id"]: record for record in [*fundos, *templates]}

    # Pre-seed roughly a third of the batch's natural keys directly,
    # bypassing `apollo import` entirely: 2 of 6 fundos and 5 of 15
    # templates (7 of 21 total natural keys, ~33%) — including one
    # no-fundoId template (t10) to exercise the (donoId, None, nome) key too.
    preseeded_fundo_local_ids = ["f1", "f2"]
    preseeded_template_local_ids = ["t1", "t2", "t7", "t8", "t10"]

    fundo_real_ids: dict[str, str] = {}
    for local_id in preseeded_fundo_local_ids:
        fundo_real_ids[local_id] = _seed_fundo(live_client, dono_id, by_local_id[local_id])

    for local_id in preseeded_template_local_ids:
        record = by_local_id[local_id]
        fundo_ref = record.get("fundoId")
        fundo_real_id = (
            fundo_real_ids[fundo_ref[1:]]
            if isinstance(fundo_ref, str) and fundo_ref.startswith("$")
            else None
        )
        _seed_template(live_client, dono_id, record, fundo_real_id)

    batch_path = _write_batch(tmp_path, {"fundos": fundos, "templatesRotina": templates})

    result: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert result.result.exit_code == 0, result.result.output
    report = cast("dict[str, Any]", result.json_out())

    all_fundo_local_ids = {f"f{n}" for n in range(1, 7)}
    all_template_local_ids = {f"t{n}" for n in range(1, 16)}

    assert sorted(report["fundos"]["existing"]) == sorted(preseeded_fundo_local_ids)
    assert sorted(report["fundos"]["created"]) == sorted(
        all_fundo_local_ids - set(preseeded_fundo_local_ids)
    )
    assert sorted(report["templatesRotina"]["existing"]) == sorted(preseeded_template_local_ids)
    assert sorted(report["templatesRotina"]["created"]) == sorted(
        all_template_local_ids - set(preseeded_template_local_ids)
    )

    fundo_codigos = [f"LOTE-F{n}-{suffix}" for n in range(1, 7)]
    template_nomes = [f"Template Lote {n} {suffix}" for n in range(1, 16)]

    fundo_rows = _query_fundos_by_codigos(live_client, fundo_codigos)
    assert len(fundo_rows) == 6
    for row in fundo_rows.values():
        cleanup_records.append(("fundos", row["id"]))

    template_rows = _query_templates_by_nomes(live_client, template_nomes)
    assert len(template_rows) == 15
    for row in template_rows.values():
        cleanup_records.append(("templatesRotina", row["id"]))

    # Not one natural key (pre-seeded OR newly-created) has more than one
    # matching row — the full-file re-run converged without duplicating a
    # single pre-existing record.
    _assert_no_duplicate_rows_by_key(live_client, "fundos", "codigo", fundo_codigos)
    _assert_no_duplicate_rows_by_key(live_client, "templatesRotina", "nome", template_nomes)


def test_import_rejects_duplicate_fundo_codigo_within_same_batch(
    run_cli: RunCli,
    live_client: Instant,
    tmp_path: Path,
) -> None:
    """Two fundo records in the SAME batch sharing a `codigo` that doesn't
    yet exist in the DB are rejected wholesale (CR-01, D-05): without the
    in-batch natural-key check, both would independently resolve as "new" in
    `_resolve_fundos` and both land in the same `transact()`, creating two
    rows with an identical `(donoId, codigo)` natural key. Exit 2, zero
    writes, and both colliding `_local_id`s named in the error."""
    suffix = unique_suffix()

    fundos = [
        {"_local_id": "dup_f1", "nome": f"Dup Fundo A {suffix}", "codigo": f"DUPCOD-{suffix}"},
        {"_local_id": "dup_f2", "nome": f"Dup Fundo B {suffix}", "codigo": f"DUPCOD-{suffix}"},
    ]

    batch_path = _write_batch(tmp_path, {"fundos": fundos, "templatesRotina": []})

    result: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert result.result.exit_code == 2, result.result.output
    error_body = cast("dict[str, Any]", json.loads(result.result.output or result.result.stderr))
    errors = cast("list[dict[str, Any]]", error_body["errors"])
    colliding_local_ids = {
        e["_local_id"] for e in errors if e["reason"] == "codigo_duplicado_no_lote"
    }
    assert colliding_local_ids == {"dup_f1", "dup_f2"}, errors

    fundo_rows = _query_fundos_by_codigos(live_client, [f"DUPCOD-{suffix}"])
    assert fundo_rows == {}


def test_import_rejects_duplicate_template_natural_key_within_same_batch(
    run_cli: RunCli,
    live_client: Instant,
    tmp_path: Path,
) -> None:
    """Two templatesRotina records in the SAME batch sharing the identical
    raw `fundoId` value plus `nome` are rejected wholesale (CR-01, D-05):
    without the in-batch natural-key check, both would independently resolve
    as "new" in `_resolve_templates` and both land in the same `transact()`,
    creating two rows with an identical resolved `(fundo, nome)` natural
    key. Exit 2, zero writes for the WHOLE file (including the sibling
    fundo record), and both colliding `_local_id`s named in the error."""
    suffix = unique_suffix()

    fundos = [
        {"_local_id": "dup_t_fundo", "nome": f"Dup T Fundo {suffix}", "codigo": f"DUPTF-{suffix}"}
    ]
    templates = [
        _template_record("dup_t1", suffix, 1, offset_dias=1, fundo_id="$dup_t_fundo"),
        _template_record("dup_t2", suffix, 1, offset_dias=2, fundo_id="$dup_t_fundo"),
    ]

    batch_path = _write_batch(tmp_path, {"fundos": fundos, "templatesRotina": templates})

    result: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert result.result.exit_code == 2, result.result.output
    error_body = cast("dict[str, Any]", json.loads(result.result.output or result.result.stderr))
    errors = cast("list[dict[str, Any]]", error_body["errors"])
    colliding_local_ids = {
        e["_local_id"] for e in errors if e["reason"] == "nome_duplicado_no_lote"
    }
    assert colliding_local_ids == {"dup_t1", "dup_t2"}, errors

    fundo_rows = _query_fundos_by_codigos(live_client, [f"DUPTF-{suffix}"])
    assert fundo_rows == {}
    template_rows = _query_templates_by_nomes(live_client, [f"Template Lote 1 {suffix}"])
    assert template_rows == {}


def test_import_rejects_malformed_reference_field_types_as_validation_errors(
    run_cli: RunCli,
    live_client: Instant,
    tmp_path: Path,
) -> None:
    """A non-string `fundoId` (an int) and a non-string `antecessorId` (a
    list) are rejected as clean, zero-write validation errors (WR-01)
    instead of reaching a live query/transact call (`fundoId`) or silently
    dropping the intended antecessor chain link (`antecessorId`)."""
    suffix = unique_suffix()

    templates = [
        {
            "_local_id": "bad_fundo_type",
            "nome": f"Bad Fundo Type {suffix}",
            "tipoGeracao": "du_fixo",
            "regraCompetencia": "M0",
            "offsetDias": 1,
            "fundoId": 123,
        },
        {
            "_local_id": "bad_antecessor_type",
            "nome": f"Bad Antecessor Type {suffix}",
            "tipoGeracao": "encadeado",
            "regraCompetencia": "M0",
            "offsetDias": 0,
            "antecessorId": ["not", "a", "string"],
        },
    ]

    batch_path = _write_batch(tmp_path, {"fundos": [], "templatesRotina": templates})

    result: CliInvocation = run_cli(["import", "--from-json", str(batch_path)])
    assert result.result.exit_code == 2, result.result.output
    error_body = cast("dict[str, Any]", json.loads(result.result.output or result.result.stderr))
    errors = cast("list[dict[str, Any]]", error_body["errors"])

    assert any(
        e["_local_id"] == "bad_fundo_type" and e["reason"] == "fundo_id_invalido" for e in errors
    ), errors
    assert any(
        e["_local_id"] == "bad_antecessor_type" and e["reason"] == "antecessor_id_invalido"
        for e in errors
    ), errors

    template_rows = _query_templates_by_nomes(
        live_client, [f"Bad Fundo Type {suffix}", f"Bad Antecessor Type {suffix}"]
    )
    assert template_rows == {}


def test_batch_import_module_defines_no_instance_entity_reference() -> None:
    """A second, independent structural check of D-10/C-06 beyond Plan
    31-01's own text-grep gate
    (`test_top_level_instanciasrotina_key_rejected_wholesale_c06`): a
    runtime scan of the LOADED `apollo_cli.batch_import` module object's own
    attributes (names via `dir(...)`, values via `vars(...)`) — not a text
    search — confirming none of them equal or contain the instance entity's
    schema name, `instanciasRotina`."""
    module = importlib.import_module("apollo_cli.batch_import")
    instance_entity_name = "instanciasRotina"

    def _references_instance_entity(value: object) -> bool:
        if isinstance(value, str):
            return instance_entity_name in value
        if isinstance(value, (frozenset, set, tuple, list)):
            return any(_references_instance_entity(item) for item in value)
        return False

    # Module-level dunders (`__doc__`, `__name__`, `__file__`, ...) are
    # Python/import-machinery metadata, not the module's own defined
    # constants/logic — `__doc__` in particular legitimately DISCUSSES
    # `instanciasRotina` in prose (explaining the exclusion this test
    # proves structurally), so it is deliberately excluded from the scan.
    offending = {
        name: value
        for name, value in vars(module).items()
        if not name.startswith("__")
        and (instance_entity_name in name or _references_instance_entity(value))
    }
    assert offending == {}, offending
    assert not any(
        instance_entity_name in name for name in dir(module) if not name.startswith("__")
    )
