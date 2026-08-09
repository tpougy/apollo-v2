"""Cross-channel interoperability (Direction A) and genuine-concurrency
non-duplication proofs for the routine-instance generation job (Phase 5
plan 06, ROADMAP SC-4 + T-05-02/T-05-34).

Both live-marked tests below run against the REAL InstantDB app.

Direction A ("CLI generates, a second CLI-side read confirms the record
set") lives entirely in this file. Direction B (SPA first / SPA second,
including the load-bearing "CLI recognizes the SPA's own dedupeKeys under
`existing`" assertion) lives in
`web/e2e/routine-job-cross-channel.spec.ts`, because only Playwright can
drive both a real browser AND shell out to the CLI in the same test.

The concurrency proof launches two REAL `apollo rotina gerar-instancias`
OS processes (`subprocess.run`, not `CliRunner`) via
`concurrent.futures.ThreadPoolExecutor`, submitting both futures before
collecting either result so their query -> diff -> transact windows
genuinely overlap. No stagger, no lock, no retry loop is added around
them: the guarantee under test is `instanciasRotina.dedupeKey.unique()`
(`shared/instant.schema.ts`), not the app-level query-before-write
courtesy diff, which cannot by itself prevent two overlapping writers
from racing on the same key.
"""

from __future__ import annotations

import concurrent.futures
import json
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any, cast

import pytest
from instantdb import Instant

from apollo_cli.routine_job import (
    build_dedupe_key,
    compute_expected_instances,
    end_of_next_month,
    to_iso_date,
    today_utc_iso_date,
)
from apollo_cli.session import Session
from tests.conftest import CliInvocation, RunCli, unique_suffix

PREFIX_DIRECTION_A = "phase05-x-"
PREFIX_CONCURRENCY = "phase05-conc-"


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


# --- Genuine-concurrency non-duplication proof (T-05-02) --------------------


def _run_gerar_instancias_subprocess() -> dict[str, Any]:
    """Launches a REAL `apollo rotina gerar-instancias` OS process (the
    installed console script via `uv run`, not the in-process `CliRunner`
    used elsewhere in this test suite -- `CliRunner` would serialize on the
    same interpreter and could share client state, making this test a
    sequential run wearing a concurrency costume).
    """
    completed = subprocess.run(
        ["uv", "run", "apollo", "rotina", "gerar-instancias"],
        cwd=str(_cli_dir()),
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, (
        f"gerar-instancias subprocess must exit 0 even on a lost race "
        f"(never crash): stderr={completed.stderr!r}"
    )
    try:
        return cast("dict[str, Any]", json.loads(completed.stdout))
    except json.JSONDecodeError:
        pytest.fail(f"gerar-instancias stdout did not parse as JSON: {completed.stdout!r}")


def _assert_live_schema_still_declares_dedupe_key_unique() -> None:
    """The concurrency proof above rests entirely on
    `instanciasRotina.dedupeKey.unique()` (`shared/instant.schema.ts`) being
    in force on the LIVE app, not merely in the local schema file. Without
    this companion check, a dropped constraint would still likely pass the
    assertions above by luck on a fast machine -- pinning the constraint
    separately is what makes the proof honest rather than probabilistic.
    """
    web_dir = _cli_dir().parent / "web"
    completed = subprocess.run(
        ["bun", "run", "instant:verify"],
        cwd=str(web_dir),
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, (
        f"bun run instant:verify must succeed to pull the live schema: {completed.stderr!r}"
    )
    pulled_schema = (web_dir / ".instant-verify" / "instant.schema.ts").read_text(encoding="utf-8")
    dedupe_key_line = next(
        (line for line in pulled_schema.splitlines() if "dedupeKey" in line), None
    )
    assert dedupe_key_line is not None, "live schema no longer declares dedupeKey at all"
    assert "unique" in dedupe_key_line, (
        f"live schema's dedupeKey attribute must still carry .unique() -- the server-side "
        f"guarantee this whole test depends on: {dedupe_key_line!r}"
    )


@pytest.mark.live
def test_concurrent_double_run_leaves_no_duplicate_dedupe_keys(
    run_cli: RunCli,
    live_client: Instant,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()

    du_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"{PREFIX_CONCURRENCY}du-{suffix}",
        tipo_geracao="du_fixo",
        regra_competencia="M0",
        offset_dias=3,
    )
    corrido_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"{PREFIX_CONCURRENCY}corrido-{suffix}",
        tipo_geracao="corrido_fixo",
        regra_competencia="M0",
        offset_dias=12,
    )
    template_ids = [du_id, corrido_id]

    today = today_utc_iso_date()
    range_end = end_of_next_month(today)
    templates_for_compute: list[dict[str, Any]] = [
        {
            "id": du_id,
            "tipoGeracao": "du_fixo",
            "regraCompetencia": "M0",
            "offsetDias": 3,
            "ativo": True,
            "antecessor": None,
        },
        {
            "id": corrido_id,
            "tipoGeracao": "corrido_fixo",
            "regraCompetencia": "M0",
            "offsetDias": 12,
            "ativo": True,
            "antecessor": None,
        },
    ]
    compute_result = compute_expected_instances(templates_for_compute, today, [])
    expected_keys = {inst["dedupeKey"] for inst in compute_result.expected}
    assert expected_keys, "fixture template config must produce at least one expected instance"

    # Submit BOTH futures before collecting either result so their
    # query -> diff -> transact windows genuinely overlap. No time.sleep,
    # no stagger, no retry loop between the two submissions -- that is the
    # entire point of this test.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_a = executor.submit(_run_gerar_instancias_subprocess)
        future_b = executor.submit(_run_gerar_instancias_subprocess)
        report_a = future_a.result()
        report_b = future_b.result()

    created_a = set(report_a["created"])
    created_b = set(report_b["created"])
    existing_a = set(report_a["existing"])
    existing_b = set(report_b["existing"])

    # Both processes MAY legitimately report the same key under `created`:
    # the write path is a lookup-keyed UPSERT (`lookup("dedupeKey", ...)`),
    # so two overlapping processes racing on the same not-yet-existing key
    # both succeed without either seeing an API error -- they converge on
    # the SAME row, never two distinct rows. This is why the plan's own
    # <behavior> block only requires "either split is acceptable" for
    # created/existing, not mutual exclusion. The load-bearing guarantee is
    # NOT this report-shape split; it is the live row count below, backed by
    # instanciasRotina.dedupeKey.unique() (shared/instant.schema.ts).
    union_reported = created_a | created_b | existing_a | existing_b
    assert union_reported == expected_keys, (
        "the union of both processes' created+existing key sets must equal the full "
        "expected key set -- neither process may leave an instance missing"
    )

    all_rows: list[dict[str, Any]] = []
    for tid in template_ids:
        rows = _query_instances_by_template(live_client, tid)
        all_rows.extend(rows)
    for row in all_rows:
        cleanup_records.append(("instanciasRotina", row["id"]))
        assert today <= to_iso_date(row["dataPrevista"]) <= range_end

    # Counter over the live-persisted dedupeKeys -- the direct, load-bearing
    # proof that instanciasRotina.dedupeKey.unique() (shared/instant.schema.ts)
    # held under genuine overlap, not merely that the two JSON reports looked
    # non-overlapping.
    dedupe_key_counts = Counter(row["dedupeKey"] for row in all_rows)
    duplicates = {key: count for key, count in dedupe_key_counts.items() if count > 1}
    assert not duplicates, (
        f"dedupeKey.unique() must make duplicates impossible; found: {duplicates}"
    )
    assert set(dedupe_key_counts) == expected_keys
    assert len(all_rows) == len(expected_keys)

    _assert_live_schema_still_declares_dedupe_key_unique()
