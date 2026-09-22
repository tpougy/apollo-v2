"""Cross-runtime parity test + live idempotency proof for the routine-instance
generation job.

The non-live half consumes `shared/routine-job.testcases.json`, the single
source of test data shared with `web/src/lib/routineJob.test.ts` (plans
05-02/05-04). It must run fully offline (`pytest -m "not live"`, no session,
no network) — see `cli/tests/test_bizdays.py` for the established pattern
this mirrors.

The live half (`pytest.mark.live`) proves, against the real InstantDB app,
that `apollo rotina gerar-instancias` never duplicates on a second run, never
deletes, and never clobbers a manually-set `concluida` status.
"""

from __future__ import annotations

import json
from typing import Any, cast

import click
import pytest
from instantdb import Instant

from apollo_cli.config import find_repo_root
from apollo_cli.entities import rotina
from apollo_cli.routine_job import (
    _DIA_SEMANA_INDEX,
    _compute_semanal_instances,
    build_dedupe_key,
    compute_expected_instances,
    end_of_next_month,
    nth_business_day_of_month,
    nth_calendar_day_of_month,
    shift_competencia,
    to_iso_date,
    today_utc_iso_date,
    weekly_occurrences,
)
from apollo_cli.session import Session
from tests.conftest import CliInvocation, RunCli, unique_suffix

_FIXTURE_PATH = find_repo_root() / "shared" / "routine-job.testcases.json"
FIXTURE: dict[str, Any] = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))


# --- dayMath fixture parity (not live) --------------------------------------


@pytest.mark.parametrize(
    "case", FIXTURE["dayMath"]["nthBusinessDayOfMonth"], ids=lambda c: c["nome"]
)
def test_nth_business_day_of_month(case: dict[str, Any]) -> None:
    assert nth_business_day_of_month(case["year"], case["month"], case["n"]) == case["expected"]


@pytest.mark.parametrize(
    "case", FIXTURE["dayMath"]["nthCalendarDayOfMonth"], ids=lambda c: c["nome"]
)
def test_nth_calendar_day_of_month(case: dict[str, Any]) -> None:
    assert nth_calendar_day_of_month(case["year"], case["month"], case["n"]) == case["expected"]


@pytest.mark.parametrize("case", FIXTURE["dayMath"]["endOfNextMonth"], ids=lambda c: c["nome"])
def test_end_of_next_month(case: dict[str, Any]) -> None:
    assert end_of_next_month(case["today"]) == case["expected"]


@pytest.mark.parametrize("case", FIXTURE["dayMath"]["shiftCompetencia"], ids=lambda c: c["nome"])
def test_shift_competencia(case: dict[str, Any]) -> None:
    assert shift_competencia(case["dataPrevista"], case["regraCompetencia"]) == case["expected"]


@pytest.mark.parametrize("case", FIXTURE["dayMath"]["weeklyOccurrences"], ids=lambda c: c["nome"])
def test_weekly_occurrences(case: dict[str, Any]) -> None:
    assert (
        weekly_occurrences(
            case["rangeStart"], case["rangeEnd"], _DIA_SEMANA_INDEX[case["diaSemana"]]
        )
        == case["expected"]
    )


# --- scenarios fixture parity (not live) ------------------------------------


@pytest.mark.parametrize("scenario", FIXTURE["scenarios"], ids=lambda s: s["nome"])
def test_scenario(scenario: dict[str, Any]) -> None:
    result = compute_expected_instances(
        scenario["templates"], scenario["today"], scenario["existing"]
    )
    assert result.expected == scenario["expectedInstances"]
    assert result.skipped == scenario["expectedSkipped"]


# --- unit coverage for helpers not directly in the fixture (not live) ------


def test_build_dedupe_key() -> None:
    assert build_dedupe_key("tpl-a", "2026-08", "2026-08-10") == "tpl-a:2026-08:2026-08-10"


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("2026-09-10T00:00:00.000Z", "2026-09-10"),
        ("2026-09-10", "2026-09-10"),
        (None, ""),
        (12345, "12345"),
    ],
)
def test_to_iso_date(value: object, expected: str) -> None:
    assert to_iso_date(value) == expected


def test_compute_expected_instances_empty() -> None:
    result = compute_expected_instances([], "2026-08-09", [])
    assert result.expected == []
    assert result.skipped == []


# --- SEM-01 type-guard direct coverage (not live; WR-01 iteration 2) -------
#
# `_compute_semanal_instances`'s `isinstance(dia_semana, str)` guard (CR-01's
# fix) had no direct unit test — only exercised incidentally by the
# `dia_semana_ausente` @pytest.mark.live test. Drive the private function
# directly with malformed `diaSemana` types, mirroring the fixture template
# shape (`shared/routine-job.testcases.json`'s `tpl-sem-a`).


@pytest.mark.parametrize(
    "dia_semana",
    [["sexta"], {"dia": "sexta"}, 4, True],
    ids=["list", "dict", "int", "bool"],
)
def test_compute_semanal_instances_dia_semana_tipo_invalido(dia_semana: object) -> None:
    template = {
        "id": "tpl-sem-a",
        "nome": "Atualiz Calc RF",
        "tipoGeracao": "semanal",
        "regraCompetencia": "M0",
        "diaSemana": dia_semana,
        "ativo": True,
        "antecessor": None,
    }
    instances, skip_reason = _compute_semanal_instances(template, "2026-08-09", "2026-08-15")
    assert instances == []
    assert skip_reason == "dia_semana_invalido"


# --- dropAudit conservation law + purity (not live; WR-02) ------------------
#
# Mirrors `web/src/lib/routineJob.test.ts`'s "routineJob dropAudit —
# conservation law over every scenario" and "routineJob purity" blocks
# (lines 113-169) — this module is explicitly a "twin" implementation whose
# whole value proposition is behavioral parity, so a defensive property
# proven on the TS side must be proven here too.


def test_dropaudit_conservation_law_over_every_scenario() -> None:
    """Every `ativo` template appears in exactly one of expected/skipped;
    every inactive template appears in neither; no template is skipped more
    than once — over every scenario in the shared fixture.
    """
    scenarios = FIXTURE["scenarios"]
    assert len(scenarios) > 0

    for scenario in scenarios:
        result = compute_expected_instances(
            scenario["templates"], scenario["today"], scenario["existing"]
        )
        template_ids_with_instances = {e["templateId"] for e in result.expected}
        template_ids_skipped = {s["templateId"] for s in result.skipped}

        for skipped_entry in result.skipped:
            occurrences = sum(
                1 for s in result.skipped if s["templateId"] == skipped_entry["templateId"]
            )
            assert occurrences == 1

        for tpl in scenario["templates"]:
            is_inactive = tpl.get("ativo") is False
            has_instances = tpl["id"] in template_ids_with_instances
            is_skipped = tpl["id"] in template_ids_skipped

            if is_inactive:
                assert not has_instances
                assert not is_skipped
            else:
                # Never both, never neither.
                assert has_instances != is_skipped


def test_compute_expected_instances_does_not_mutate_inputs() -> None:
    """`compute_expected_instances` is pure: identical inputs produce
    deeply-equal results without mutating `templates`/`existing`.
    """
    scenario = FIXTURE["scenarios"][0]
    templates_copy = json.loads(json.dumps(scenario["templates"]))
    existing_copy = json.loads(json.dumps(scenario["existing"]))

    result_a = compute_expected_instances(templates_copy, scenario["today"], existing_copy)
    result_b = compute_expected_instances(templates_copy, scenario["today"], existing_copy)

    assert result_a == result_b
    assert templates_copy == scenario["templates"]
    assert existing_copy == scenario["existing"]


# --- structural: gerar-instancias exists at the group level (not live) -----


def test_gerar_instancias_exists_at_group_level() -> None:
    assert "gerar-instancias" in rotina.group.commands, (
        "apollo rotina gerar-instancias must exist at the top level of the "
        "rotina group (PROJECT.md C-07)"
    )
    assert "gerar-instancias" not in rotina.instancia.commands, (
        "gerar-instancias must not live under `rotina instancia` — it operates "
        "across all templates, not one instance"
    )


def test_instancia_command_set_is_exactly_listar_and_status() -> None:
    commands = set(rotina.instancia.commands)
    assert commands == {"listar", "status"}, (
        "apollo rotina instancia must still expose only {listar, status} after "
        "gerar-instancias lands at the group level — PROJECT.md C-06"
    )


def test_gerar_instancias_help_documents_options_and_idempotency(run_cli: RunCli) -> None:
    result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--help"])
    assert result.result.exit_code == 0, result.result.output
    output = result.result.output
    normalized = " ".join(output.split())
    assert "--data-base" in output
    assert "--dry-run" in output
    assert "--competencia" in output
    assert "--de" in output
    assert "--ate" in output
    assert "nunca duplica" in normalized
    assert "substitui" in normalized


# --- RANGE-01: --competencia/--de/--ate validation (not live) ---------------


@pytest.mark.parametrize(
    ("competencia", "expected"),
    [
        ("2026-08", ("2026-08-01", "2026-08-31")),
        ("2026-02", ("2026-02-01", "2026-02-28")),
        ("2028-02", ("2028-02-01", "2028-02-29")),
        ("2026-12", ("2026-12-01", "2026-12-31")),
    ],
)
def test_resolve_range_override_competencia_resolves_to_first_and_last_day_of_month(
    competencia: str, expected: tuple[str, str]
) -> None:
    assert rotina._resolve_range_override(competencia, None, None) == expected


def test_resolve_range_override_de_ate_passthrough_unchanged() -> None:
    assert rotina._resolve_range_override(None, "2026-08-05", "2026-08-20") == (
        "2026-08-05",
        "2026-08-20",
    )


def test_resolve_range_override_all_omitted_returns_none() -> None:
    assert rotina._resolve_range_override(None, None, None) is None


@pytest.mark.parametrize(
    ("competencia", "de", "ate"),
    [
        ("2026-08", "2026-08-01", None),
        ("2026-08", None, "2026-08-31"),
        (None, "2026-08-01", None),
        (None, None, "2026-08-31"),
        (None, "2026-08-31", "2026-08-01"),
    ],
)
def test_resolve_range_override_invalid_combinations_raise_usage_error(
    competencia: str | None, de: str | None, ate: str | None
) -> None:
    with pytest.raises(click.UsageError):
        rotina._resolve_range_override(competencia, de, ate)


@pytest.mark.parametrize(
    "args",
    [
        ["--competencia", "2026-08", "--de", "2026-08-01"],
        ["--competencia", "2026-08", "--ate", "2026-08-31"],
        ["--de", "2026-08-01"],
        ["--ate", "2026-08-31"],
        ["--de", "2026-08-31", "--ate", "2026-08-01"],
    ],
)
def test_gerar_instancias_invalid_range_flags_cli_exit_code_2(
    run_cli: RunCli, args: list[str]
) -> None:
    result: CliInvocation = run_cli(["rotina", "gerar-instancias", *args])
    assert result.result.exit_code == 2, result.result.output


@pytest.mark.parametrize(
    "competencia",
    ["2026-13", "2026-00", "2026-8", "abcd-08", "2026-08-01"],
)
def test_gerar_instancias_competencia_malformed_format_exit_code_2(
    run_cli: RunCli, competencia: str
) -> None:
    result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--competencia", competencia])
    assert result.result.exit_code == 2, result.result.output


# --- live: double-run idempotency + status preservation ---------------------

pytestmark_live = pytest.mark.live


def _create_routine_template(
    run_cli: RunCli,
    cleanup_records: list[tuple[str, str]],
    *,
    nome: str,
    tipo_geracao: str,
    regra_competencia: str,
    offset_dias: int | None = None,
    antecessor_id: str | None = None,
    dia_semana: str | None = None,
) -> str:
    args = [
        "rotina",
        "template",
        "criar",
        "--nome",
        nome,
        "--tipo-geracao",
        tipo_geracao,
        "--regra-competencia",
        regra_competencia,
    ]
    if offset_dias is not None:
        args += ["--offset-dias", str(offset_dias)]
    if antecessor_id is not None:
        args += ["--antecessor-id", antecessor_id]
    if dia_semana is not None:
        args += ["--dia-semana", dia_semana]
    result: CliInvocation = run_cli(args)
    assert result.result.exit_code == 0, result.result.output
    template_id = cast("dict[str, Any]", result.json_out())["id"]
    cleanup_records.append(("templatesRotina", template_id))
    return template_id


def _query_instances_by_template(client: Instant, template_id: str) -> list[dict[str, Any]]:
    result = client.query(
        {
            "instanciasRotina": {
                "template": {},
                "$": {"where": {"template.id": template_id}},
            }
        }
    )
    return result.get("instanciasRotina", [])


def _linked_template_id(row: dict[str, Any]) -> str:
    linked = row.get("template")
    if isinstance(linked, list):
        return cast("str", linked[0]["id"]) if linked else ""
    return cast("str", linked["id"]) if linked else ""


def _query_instance_by_id(client: Instant, eid: str) -> dict[str, Any] | None:
    result = client.query({"instanciasRotina": {"$": {"where": {"id": eid}}}})
    rows = result.get("instanciasRotina", [])
    return rows[0] if rows else None


@pytest.mark.live
def test_gerar_instancias_double_run_idempotent_and_preserves_status(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()

    du_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase05-cli-du-{suffix}",
        tipo_geracao="du_fixo",
        regra_competencia="M0",
        offset_dias=2,
    )
    corrido_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase05-cli-corrido-{suffix}",
        tipo_geracao="corrido_fixo",
        regra_competencia="M0",
        offset_dias=10,
    )
    encadeado_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase05-cli-encadeado-{suffix}",
        tipo_geracao="encadeado",
        regra_competencia="M0",
        offset_dias=1,
        antecessor_id=du_id,
    )
    template_ids = [du_id, corrido_id, encadeado_id]

    # --dry-run must report a plan but write nothing.
    dry_result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--dry-run"])
    assert dry_result.result.exit_code == 0, dry_result.result.output
    dry_report = cast("dict[str, Any]", dry_result.json_out())
    assert dry_report["created"], "dry-run must still report what WOULD be created"

    for tid in template_ids:
        assert _query_instances_by_template(live_client, tid) == [], (
            "dry-run must never write a real instance"
        )

    # Real run 1.
    run1_result: CliInvocation = run_cli(["rotina", "gerar-instancias"])
    assert run1_result.result.exit_code == 0, run1_result.result.output
    report1 = cast("dict[str, Any]", run1_result.json_out())
    assert report1["created"], "run 1 must create at least one instance"
    assert report1["existing"] == []

    today = today_utc_iso_date()
    range_end = end_of_next_month(today)

    all_instances: list[dict[str, Any]] = []
    for tid in template_ids:
        rows = _query_instances_by_template(live_client, tid)
        assert rows, f"template {tid} produced no instances on run 1"
        all_instances.extend(rows)

    for row in all_instances:
        cleanup_records.append(("instanciasRotina", row["id"]))
        normalized_date = to_iso_date(row["dataPrevista"])
        expected_key = build_dedupe_key(
            _linked_template_id(row), row["competencia"], normalized_date
        )
        assert row["dedupeKey"] == expected_key
        assert row["donoId"] == live_session.user_id
        assert row["status"] == "pendente"
        assert today <= normalized_date <= range_end

    ids_run1 = {row["id"] for row in all_instances}
    dedupe_keys_run1 = [row["dedupeKey"] for row in all_instances]
    assert len(dedupe_keys_run1) == len(set(dedupe_keys_run1)), "run 1 must have no duplicate keys"

    # Manually mark one instance concluida through the existing CLI command.
    target = all_instances[0]
    status_result: CliInvocation = run_cli(
        ["rotina", "instancia", "status", "--id", target["id"], "--status", "concluida"]
    )
    assert status_result.result.exit_code == 0, status_result.result.output

    # Real run 2: must be a no-op write-wise.
    run2_result: CliInvocation = run_cli(["rotina", "gerar-instancias"])
    assert run2_result.result.exit_code == 0, run2_result.result.output
    report2 = cast("dict[str, Any]", run2_result.json_out())
    assert report2["created"] == [], "run 2 must create nothing new"
    assert set(report2["existing"]) == set(report1["created"])

    ids_run2: set[str] = set()
    dedupe_keys_run2: list[str] = []
    for tid in template_ids:
        rows = _query_instances_by_template(live_client, tid)
        for row in rows:
            ids_run2.add(row["id"])
            dedupe_keys_run2.append(row["dedupeKey"])

    assert ids_run2 == ids_run1, "run 2 must neither create nor delete any instance"
    assert len(dedupe_keys_run2) == len(set(dedupe_keys_run2)), (
        "run 2 must still have no duplicate dedupeKeys"
    )

    updated_target = _query_instance_by_id(live_client, target["id"])
    assert updated_target is not None
    assert updated_target["status"] == "concluida", (
        "run 2 must never clobber a manually-set concluida status"
    )
    assert to_iso_date(updated_target["dataPrevista"]) == to_iso_date(target["dataPrevista"])
    assert updated_target["competencia"] == target["competencia"]
    assert updated_target["dedupeKey"] == target["dedupeKey"]


@pytest.mark.live
def test_gerar_instancias_du_fixo_offset_le_zero_real_previa_du2_case(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """JOB-02/D-27-B: proves the exact real onboarding "Previa DU-2" case
    live against production InstantDB — offsetDias=-2 (2 business days
    before the month's last business day) and offsetDias=0 (the last
    business day of the month itself), for August and September 2026.
    """
    suffix = unique_suffix()

    offset_neg2_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase27-cli-du-neg2-{suffix}",
        tipo_geracao="du_fixo",
        regra_competencia="M0",
        offset_dias=-2,
    )
    offset_zero_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase27-cli-du-zero-{suffix}",
        tipo_geracao="du_fixo",
        regra_competencia="M0",
        offset_dias=0,
    )

    result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--data-base", "2026-08-09"])
    assert result.result.exit_code == 0, result.result.output

    def _by_competencia(template_id: str) -> dict[str, str]:
        rows = _query_instances_by_template(live_client, template_id)
        by_competencia: dict[str, str] = {}
        for row in rows:
            cleanup_records.append(("instanciasRotina", row["id"]))
            by_competencia[row["competencia"]] = to_iso_date(row["dataPrevista"])
        return by_competencia

    assert _by_competencia(offset_neg2_id) == {"2026-08": "2026-08-27", "2026-09": "2026-09-28"}
    assert _by_competencia(offset_zero_id) == {"2026-08": "2026-08-31", "2026-09": "2026-09-30"}


@pytest.mark.live
def test_gerar_instancias_recognizes_normalized_concluida_status(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """JOB-01/D-27-A: proves `_is_concluida` recognizes a real, accented and
    capitalized `"Concluída"` status live against production InstantDB —
    the antecessor's persisted instance must correctly suppress
    `dataPrevistaEstimada` on a newly-created `encadeado` successor.
    """
    suffix = unique_suffix()

    antecessor_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase27-cli-du-antecessor-{suffix}",
        tipo_geracao="du_fixo",
        regra_competencia="M0",
        offset_dias=5,
    )

    run1_result: CliInvocation = run_cli(
        ["rotina", "gerar-instancias", "--data-base", "2026-08-09"]
    )
    assert run1_result.result.exit_code == 0, run1_result.result.output

    antecessor_rows = _query_instances_by_template(live_client, antecessor_id)
    assert len(antecessor_rows) == 1
    antecessor_row = antecessor_rows[0]
    cleanup_records.append(("instanciasRotina", antecessor_row["id"]))
    assert antecessor_row["competencia"] == "2026-09"
    assert to_iso_date(antecessor_row["dataPrevista"]) == "2026-09-08"

    status_result: CliInvocation = run_cli(
        [
            "rotina",
            "instancia",
            "status",
            "--id",
            antecessor_row["id"],
            "--status",
            "Concluída",
        ]
    )
    assert status_result.result.exit_code == 0, status_result.result.output

    successor_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase27-cli-du-successor-{suffix}",
        tipo_geracao="encadeado",
        regra_competencia="M0",
        offset_dias=2,
        antecessor_id=antecessor_id,
    )

    run2_result: CliInvocation = run_cli(
        ["rotina", "gerar-instancias", "--data-base", "2026-08-09"]
    )
    assert run2_result.result.exit_code == 0, run2_result.result.output

    successor_rows = _query_instances_by_template(live_client, successor_id)
    assert len(successor_rows) == 1
    successor_row = successor_rows[0]
    cleanup_records.append(("instanciasRotina", successor_row["id"]))
    assert to_iso_date(successor_row["dataPrevista"]) == "2026-09-10"
    assert successor_row.get("dataPrevistaEstimada") is None, (
        "a real accented/capitalized 'Concluída' antecessor status must be "
        "recognized as concluded, omitting dataPrevistaEstimada on the "
        "newly-created encadeado successor"
    )


@pytest.mark.live
def test_gerar_instancias_skipped_entries_include_template_nome(
    run_cli: RunCli,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """JOB-03/D-27-C: proves a real `skipped` entry's `nome` matches the
    template's actual `nome`, against production InstantDB. Uses a `du_fixo`
    template deliberately created WITHOUT `--offset-dias`, triggering the
    pre-existing, unaffected `offset_dias_ausente` skip path.
    """
    suffix = unique_suffix()
    nome = f"phase27-cli-skipped-nome-{suffix}"

    create_result: CliInvocation = run_cli(
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
        ]
    )
    assert create_result.result.exit_code == 0, create_result.result.output
    template_id = cast("dict[str, Any]", create_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", template_id))

    result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--data-base", "2026-08-09"])
    assert result.result.exit_code == 0, result.result.output
    report = cast("dict[str, Any]", result.json_out())

    matching = [entry for entry in report["skipped"] if entry["templateId"] == template_id]
    assert len(matching) == 1
    assert matching[0]["reason"] == "offset_dias_ausente"
    assert matching[0]["nome"] == nome


@pytest.mark.live
def test_gerar_instancias_semanal_sexta_real_atualiz_calc_rf_case(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """SEM-01: proves the real "Atualiz Calc RF" case (toda sexta-feira) live
    against production InstantDB — for `--data-base 2026-08-09`, a `semanal`
    template anchored on `sexta` must produce exactly the 7 real Fridays in
    August/September 2026, RESEARCH.md-verified.
    """
    suffix = unique_suffix()

    template_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase28-cli-semanal-{suffix}",
        tipo_geracao="semanal",
        regra_competencia="M0",
        dia_semana="sexta",
    )

    result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--data-base", "2026-08-09"])
    assert result.result.exit_code == 0, result.result.output

    rows = _query_instances_by_template(live_client, template_id)
    for row in rows:
        cleanup_records.append(("instanciasRotina", row["id"]))

    dates = sorted(to_iso_date(row["dataPrevista"]) for row in rows)
    assert dates == [
        "2026-08-14",
        "2026-08-21",
        "2026-08-28",
        "2026-09-04",
        "2026-09-11",
        "2026-09-18",
        "2026-09-25",
    ]

    for row in rows:
        normalized_date = to_iso_date(row["dataPrevista"])
        assert row["competencia"] == normalized_date[:7], (
            "M0 has zero shift; competencia must match dataPrevista's own year-month"
        )


@pytest.mark.live
def test_gerar_instancias_semanal_sem_dia_semana_e_skipped(
    run_cli: RunCli,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """SEM-01: a `semanal` template created WITHOUT `--dia-semana` must
    surface `dia_semana_ausente` in `skipped`, never crash or silently
    generate nothing unexplained — mirrors
    `test_gerar_instancias_skipped_entries_include_template_nome`.
    """
    suffix = unique_suffix()
    nome = f"phase28-cli-semanal-sem-dia-{suffix}"

    create_result: CliInvocation = run_cli(
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
        ]
    )
    assert create_result.result.exit_code == 0, create_result.result.output
    template_id = cast("dict[str, Any]", create_result.json_out())["id"]
    cleanup_records.append(("templatesRotina", template_id))

    result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--data-base", "2026-08-09"])
    assert result.result.exit_code == 0, result.result.output
    report = cast("dict[str, Any]", result.json_out())

    matching = [entry for entry in report["skipped"] if entry["templateId"] == template_id]
    assert len(matching) == 1
    assert matching[0]["reason"] == "dia_semana_ausente"
    assert matching[0]["nome"] == nome


# --- RANGE-01: live proof of Success Criteria 1/2/3 --------------------------


@pytest.mark.live
def test_gerar_instancias_range_competencia_narrows_to_single_month_no_drag(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """Success Criterion 1: `--competencia 2026-08` generates instances only
    within August 2026 for a real `semanal`+`sexta` template — no September
    date, even though the default range would include it.
    """
    suffix = unique_suffix()

    template_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase29-cli-competencia-{suffix}",
        tipo_geracao="semanal",
        regra_competencia="M0",
        dia_semana="sexta",
    )

    result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--competencia", "2026-08"])
    assert result.result.exit_code == 0, result.result.output

    rows = _query_instances_by_template(live_client, template_id)
    for row in rows:
        cleanup_records.append(("instanciasRotina", row["id"]))

    dates = sorted(to_iso_date(row["dataPrevista"]) for row in rows)
    assert dates == ["2026-08-07", "2026-08-14", "2026-08-21", "2026-08-28"]


@pytest.mark.live
def test_gerar_instancias_range_de_ate_recovers_past_date_of_current_month(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """Success Criterion 2: `--de`/`--ate` recovers an already-passed
    `dataPrevista` of the current month when run mid-month via
    `--data-base`, without disturbing an already-created September
    instance.
    """
    suffix = unique_suffix()

    template_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase29-cli-recorte-{suffix}",
        tipo_geracao="corrido_fixo",
        regra_competencia="M0",
        offset_dias=3,
    )

    run1_result: CliInvocation = run_cli(
        ["rotina", "gerar-instancias", "--data-base", "2026-08-15"]
    )
    assert run1_result.result.exit_code == 0, run1_result.result.output

    rows_after_run1 = _query_instances_by_template(live_client, template_id)
    assert len(rows_after_run1) == 1
    assert to_iso_date(rows_after_run1[0]["dataPrevista"]) == "2026-09-03"
    cleanup_records.append(("instanciasRotina", rows_after_run1[0]["id"]))

    run2_result: CliInvocation = run_cli(
        [
            "rotina",
            "gerar-instancias",
            "--data-base",
            "2026-08-15",
            "--de",
            "2026-08-01",
            "--ate",
            "2026-08-31",
        ]
    )
    assert run2_result.result.exit_code == 0, run2_result.result.output
    report2 = cast("dict[str, Any]", run2_result.json_out())
    created_for_template = [
        key for key in report2["created"] if key.endswith(":2026-08:2026-08-03")
    ]
    assert created_for_template == [f"{template_id}:2026-08:2026-08-03"]

    all_rows = _query_instances_by_template(live_client, template_id)
    for row in all_rows:
        cleanup_records.append(("instanciasRotina", row["id"]))

    assert len(all_rows) == 2
    dates = sorted(to_iso_date(row["dataPrevista"]) for row in all_rows)
    assert dates == ["2026-08-03", "2026-09-03"]


@pytest.mark.live
def test_gerar_instancias_range_idempotent_across_recorte_and_default_range(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    """Success Criteria 3/4 (D-06): a recorte run followed by a wider
    default-range run produces byte-identical dedupeKeys AND row ids for
    the overlapping instances — no duplication, no re-creation.
    """
    suffix = unique_suffix()

    template_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"phase29-cli-idempotencia-{suffix}",
        tipo_geracao="semanal",
        regra_competencia="M0",
        dia_semana="sexta",
    )

    run1_result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--competencia", "2026-08"])
    assert run1_result.result.exit_code == 0, run1_result.result.output
    report1 = cast("dict[str, Any]", run1_result.json_out())
    expected_august_keys = sorted(
        f"{template_id}:2026-08:{date}"
        for date in ("2026-08-07", "2026-08-14", "2026-08-21", "2026-08-28")
    )
    # The live app is production and carries other active templates from
    # earlier phases' tests — filter every report list to this test's own
    # template_id prefix so unrelated concurrent template state never makes
    # this assertion flaky.
    created1_for_template = sorted(
        key for key in report1["created"] if key.startswith(f"{template_id}:")
    )
    assert created1_for_template == expected_august_keys

    rows_after_run1 = _query_instances_by_template(live_client, template_id)
    assert len(rows_after_run1) == 4
    ids_after_run1 = {row["dedupeKey"]: row["id"] for row in rows_after_run1}

    run2_result: CliInvocation = run_cli(
        ["rotina", "gerar-instancias", "--data-base", "2026-08-01"]
    )
    assert run2_result.result.exit_code == 0, run2_result.result.output
    report2 = cast("dict[str, Any]", run2_result.json_out())
    existing2_for_template = sorted(
        key for key in report2["existing"] if key.startswith(f"{template_id}:")
    )
    assert existing2_for_template == expected_august_keys

    expected_september_keys = sorted(
        f"{template_id}:2026-09:{date}"
        for date in ("2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25")
    )
    created2_for_template = sorted(
        key for key in report2["created"] if key.startswith(f"{template_id}:")
    )
    assert created2_for_template == expected_september_keys

    all_rows = _query_instances_by_template(live_client, template_id)
    for row in all_rows:
        cleanup_records.append(("instanciasRotina", row["id"]))

    assert len(all_rows) == 8
    dedupe_keys = [row["dedupeKey"] for row in all_rows]
    assert len(dedupe_keys) == len(set(dedupe_keys)), "no duplicate dedupeKeys"

    for row in all_rows:
        if row["dedupeKey"] in ids_after_run1:
            assert row["id"] == ids_after_run1[row["dedupeKey"]], (
                "the August rows must retain their exact row id across runs "
                "(row-level idempotency, not merely dedupeKey-level)"
            )
