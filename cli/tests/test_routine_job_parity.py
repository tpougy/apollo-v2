"""Cross-channel interoperability proof for the routine-instance generation
job (Phase 5 plan 06, ROADMAP SC-4 + T-05-34).

This live-marked test proves Direction A: "CLI generates, a second CLI-side
read confirms the record set". Direction B (SPA first / SPA second,
including the load-bearing "CLI recognizes the SPA's own dedupeKeys under
`existing`" assertion) lives in
`web/e2e/routine-job-cross-channel.spec.ts`, because only Playwright can
drive both a real browser AND shell out to the CLI in the same test.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import pytest
from instantdb import Instant

from apollo_cli.routine_job import build_dedupe_key, to_iso_date
from apollo_cli.session import Session
from tests.conftest import CliInvocation, RunCli, unique_suffix

PREFIX_DIRECTION_A = "phase05-x-"


def _cli_dir() -> Path:
    return Path(__file__).resolve().parent.parent


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
    """Normalizes the `template` link field, which the CLI's
    `--template-id`-filtered `instancia listar` returns as a bare id string
    (observed live), while other query shapes elsewhere in this phase return
    a nested dict or a one-element list of dicts. Handles all three shapes.
    """
    linked = row.get("template")
    if isinstance(linked, str):
        return linked
    if isinstance(linked, list):
        return cast("str", linked[0]["id"]) if linked else ""
    return cast("str", linked["id"]) if linked else ""


# --- Direction A: CLI generates, a second CLI-side read confirms the set ---


@pytest.mark.live
def test_direction_a_cli_generates_then_cli_recognizes_own_records(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()

    du_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"{PREFIX_DIRECTION_A}du-{suffix}",
        tipo_geracao="du_fixo",
        regra_competencia="M0",
        offset_dias=2,
    )
    corrido_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"{PREFIX_DIRECTION_A}corrido-{suffix}",
        tipo_geracao="corrido_fixo",
        regra_competencia="M0",
        offset_dias=9,
    )
    encadeado_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"{PREFIX_DIRECTION_A}encadeado-{suffix}",
        tipo_geracao="encadeado",
        regra_competencia="M0",
        offset_dias=1,
        antecessor_id=du_id,
    )
    template_ids = [du_id, corrido_id, encadeado_id]

    # Run 1: the CLI generates every expected instance for this fresh set.
    run1_result: CliInvocation = run_cli(["rotina", "gerar-instancias"])
    assert run1_result.result.exit_code == 0, run1_result.result.output
    report1 = cast("dict[str, Any]", run1_result.json_out())
    assert report1["created"], "run 1 must create at least one instance"
    assert report1["existing"] == []

    # Cross-anchor claim #1: `apollo rotina instancia listar --template-id`
    # returns EXACTLY the ids the job just created, per template.
    all_ids_run1: set[str] = set()
    for tid in template_ids:
        listar_result: CliInvocation = run_cli(
            ["rotina", "instancia", "listar", "--template-id", tid]
        )
        assert listar_result.result.exit_code == 0, listar_result.result.output
        rows = cast("list[dict[str, Any]]", listar_result.json_out())
        assert rows, f"template {tid} produced no instances on run 1"
        for row in rows:
            cleanup_records.append(("instanciasRotina", row["id"]))
            all_ids_run1.add(row["id"])

            # Cross-anchor claim #2: every dedupeKey recomputes correctly
            # from the row's OWN fields (not merely trusted from the job's
            # own report) -- anchoring the interop claim on both sides of
            # the wire, exactly as this plan's Task 1 action specifies.
            normalized_date = to_iso_date(row["dataPrevista"])
            expected_key = build_dedupe_key(
                _linked_template_id(row) or tid, row["competencia"], normalized_date
            )
            assert row["dedupeKey"] == expected_key
            assert row["donoId"] == live_session.user_id

    dedupe_keys_run1 = [
        row["dedupeKey"]
        for tid in template_ids
        for row in cast(
            "list[dict[str, Any]]",
            run_cli(["rotina", "instancia", "listar", "--template-id", tid]).json_out(),
        )
    ]
    assert len(dedupe_keys_run1) == len(set(dedupe_keys_run1)), "run 1 must have no duplicate keys"
    assert set(dedupe_keys_run1) == set(report1["created"])

    # Run 2: a second CLI-side verification -- the job must recognize its
    # own run-1 records rather than merely failing to write for some other
    # reason. This is the load-bearing assertion: `existing` must be
    # EXACTLY run 1's `created` set, proving recognition by dedupeKey.
    run2_result: CliInvocation = run_cli(["rotina", "gerar-instancias"])
    assert run2_result.result.exit_code == 0, run2_result.result.output
    report2 = cast("dict[str, Any]", run2_result.json_out())
    assert report2["created"] == [], "run 2 must create nothing new"
    assert set(report2["existing"]) == set(report1["created"])

    ids_run2: set[str] = set()
    for tid in template_ids:
        rows = _query_instances_by_template(live_client, tid)
        ids_run2.update(row["id"] for row in rows)
    assert ids_run2 == all_ids_run1, "run 2 must neither create nor delete any instance"
