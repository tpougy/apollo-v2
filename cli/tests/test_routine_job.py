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

import pytest
from instantdb import Instant

from apollo_cli.config import find_repo_root
from apollo_cli.entities import rotina
from apollo_cli.routine_job import (
    build_dedupe_key,
    compute_expected_instances,
    end_of_next_month,
    nth_business_day_of_month,
    nth_calendar_day_of_month,
    shift_competencia,
    to_iso_date,
    today_utc_iso_date,
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
    assert "nunca duplica" in normalized


# --- live: double-run idempotency + status preservation ---------------------

pytestmark_live = pytest.mark.live


def _create_routine_template(
    run_cli: RunCli,
    cleanup_records: list[tuple[str, str]],
    *,
    nome: str,
    tipo_geracao: str,
    regra_competencia: str,
    offset_dias: int,
    antecessor_id: str | None = None,
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
        "--offset-dias",
        str(offset_dias),
    ]
    if antecessor_id is not None:
        args += ["--antecessor-id", antecessor_id]
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
