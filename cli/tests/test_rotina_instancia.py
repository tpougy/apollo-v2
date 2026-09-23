"""Live `instanciasRotina` list/status round trip + structural no-create proof (CLI-07).

`instanciasRotina` has no `criar` and no general `deletar` command in this
CLI by design (PROJECT.md C-06): creation is exclusively the Phase 5
dedupeKey-based upsert job. Since the CLI cannot create instances, the live
tests here seed one directly through `live_client.tx` (per the plan's
`<interfaces>` note), then exercise `listar`/`status` through the CLI.

`limpar-orfas` (Phase 30, LIFE-02) is the sole, narrow exception — it may
delete an instance, but only when its `template` link is confirmed absent.
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


def test_instancia_command_set_is_exactly_listar_status_and_limpar_orfas() -> None:
    commands = set(rotina.instancia.commands)
    assert commands == {"listar", "status", "limpar-orfas"}, (
        "apollo rotina instancia must expose only {listar, status, limpar-orfas} — "
        "PROJECT.md C-06: instanciasRotina creation is exclusively Phase 5's "
        "dedupeKey-based upsert job, and deletion is exclusively Phase 30's "
        f"orphan-only limpar-orfas, never a hand-run criar/deletar. Found: {commands}"
    )
    assert "criar" not in commands, "C-06: no hand-created instanciasRotina — see module docstring"
    assert "deletar" not in commands, (
        "C-06: instances are never hand-deleted from the CLI — only limpar-orfas may "
        "delete, and only orphans"
    )


def test_gerar_instancias_exists_at_group_level() -> None:
    assert "gerar-instancias" in rotina.group.commands, (
        "apollo rotina gerar-instancias (Phase 5, JOB-02) must exist at the "
        "top level of the rotina group"
    )
    assert "gerar-instancias" not in rotina.instancia.commands, (
        "gerar-instancias must never live under `rotina instancia` — it "
        "operates across all templates, not a single instance"
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
            "M0",
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


def _linked_template(row: dict[str, Any]) -> dict[str, Any] | None:
    """Normalizes the `template` expanded-link field, which InstantDB has
    been observed (see `test_routine_job_parity.py`'s `_linked_template_id`)
    to return as either a nested dict or a one-element list of dicts
    depending on query shape. Handles both, returning `None` when absent.
    """
    linked = row.get("template")
    if isinstance(linked, list):
        return linked[0] if linked else None
    return linked


def test_listar_expands_template_nome_inline(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    template_id = _create_template(run_cli, cleanup_records, suffix)
    template_nome = f"Template p/ Instancia {suffix}"
    seeded = _seed_instancia(live_client, live_session, template_id, suffix)
    eid = seeded["id"]
    cleanup_records.append(("instanciasRotina", eid))

    # Unfiltered listar carries the expanded template.nome inline.
    listar_result: CliInvocation = run_cli(["rotina", "instancia", "listar"])
    assert listar_result.result.exit_code == 0, listar_result.result.output
    all_records = cast("list[dict[str, Any]]", listar_result.json_out())
    matching = [r for r in all_records if r["id"] == eid]
    assert matching, "seeded instance must appear in unfiltered listar"
    linked = _linked_template(matching[0])
    assert linked is not None, "seeded instance must carry an expanded template sub-record"
    assert linked["nome"] == template_nome

    # --template-id-filtered listar also carries the expanded template.nome.
    filtered_result: CliInvocation = run_cli(
        ["rotina", "instancia", "listar", "--template-id", template_id]
    )
    assert filtered_result.result.exit_code == 0, filtered_result.result.output
    filtered = cast("list[dict[str, Any]]", filtered_result.json_out())
    filtered_matching = [r for r in filtered if r["id"] == eid]
    assert filtered_matching, "seeded instance must appear in --template-id-filtered listar"
    filtered_linked = _linked_template(filtered_matching[0])
    assert filtered_linked is not None
    assert filtered_linked["nome"] == template_nome


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


# --- limpar-orfas (LIFE-02, D-02) --------------------------------------------


def test_limpar_orfas_lists_orphan_without_confirmar_writes_nothing(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    template_id = _create_template(run_cli, cleanup_records, suffix)
    seeded = _seed_instancia(live_client, live_session, template_id, suffix)
    instance_id = seeded["id"]

    force_delete_result: CliInvocation = run_cli(
        ["rotina", "template", "deletar", "--id", template_id, "--force"]
    )
    assert force_delete_result.result.exit_code == 0, force_delete_result.result.output

    listar_orfas_result: CliInvocation = run_cli(["rotina", "instancia", "limpar-orfas"])
    assert listar_orfas_result.result.exit_code == 0, listar_orfas_result.result.output
    body = cast("dict[str, Any]", listar_orfas_result.json_out())
    assert body["confirmado"] is False
    assert body["count"] >= 1
    assert any(o["id"] == instance_id for o in body["orphans"])

    # Zero writes: the seeded instance still exists.
    assert _query_instancia(live_client, instance_id) is not None
    cleanup_records.append(("instanciasRotina", instance_id))


def test_limpar_orfas_confirmar_deletes_only_orphans_leaves_valid_linked_instance_untouched(
    run_cli: RunCli,
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> None:
    suffix = unique_suffix()
    template_a_id = _create_template(run_cli, cleanup_records, f"{suffix}-a")
    template_b_id = _create_template(run_cli, cleanup_records, f"{suffix}-b")
    cleanup_records.append(("templatesRotina", template_b_id))

    orphan_seed = _seed_instancia(live_client, live_session, template_a_id, f"{suffix}-orphan")
    valid_seed = _seed_instancia(live_client, live_session, template_b_id, f"{suffix}-valid")
    instance_orphan_id = orphan_seed["id"]
    instance_valid_id = valid_seed["id"]
    cleanup_records.append(("instanciasRotina", instance_valid_id))

    force_delete_result: CliInvocation = run_cli(
        ["rotina", "template", "deletar", "--id", template_a_id, "--force"]
    )
    assert force_delete_result.result.exit_code == 0, force_delete_result.result.output

    confirmar_result: CliInvocation = run_cli(
        ["rotina", "instancia", "limpar-orfas", "--confirmar"]
    )
    assert confirmar_result.result.exit_code == 0, confirmar_result.result.output
    body = cast("dict[str, Any]", confirmar_result.json_out())
    assert body["confirmado"] is True
    assert any(o["id"] == instance_orphan_id for o in body["orphans"])

    assert _query_instancia(live_client, instance_orphan_id) is None

    valid_expanded = live_client.query(
        {"instanciasRotina": {"template": {}, "$": {"where": {"id": instance_valid_id}}}}
    ).get("instanciasRotina", [])
    assert valid_expanded, "validly-linked instance must still exist"
    assert valid_expanded[0].get("template"), (
        "validly-linked instance's template link must still resolve (truthy/non-empty)"
    )


def test_limpar_orfas_help_documents_confirmar_and_orphan_definition(run_cli: RunCli) -> None:
    result: CliInvocation = run_cli(["rotina", "instancia", "limpar-orfas", "--help"])
    assert result.result.exit_code == 0, result.result.output
    assert "--confirmar" in result.result.output
    assert "orf" in result.result.output.lower()


def test_limpar_orfas_confirmar_removes_real_production_residue_success_criterion_3(
    run_cli: RunCli,
) -> None:
    """ROADMAP Success Criterion 3 / D-03: running `limpar-orfas --confirmar`
    against the real production account removes every currently-orphaned
    row, including the named `phase23-e2e-dedupe-weekday`/`-weekend`
    residue, with an exact-delta proof that no other row was affected.

    This is the ONE test in this entire phase permitted to touch
    pre-existing (non-test-prefixed) production rows — safe by construction,
    since `limpar-orfas` can only ever act on a row whose `template` link is
    already confirmed absent (already-broken, unusable production data,
    never a row with a valid link).
    """
    total_before = len(
        cast("list[dict[str, Any]]", run_cli(["rotina", "instancia", "listar"]).json_out())
    )

    list_result: CliInvocation = run_cli(["rotina", "instancia", "limpar-orfas"])
    assert list_result.result.exit_code == 0, list_result.result.output
    before_body = cast("dict[str, Any]", list_result.json_out())
    orphan_count = before_body["count"]

    # Informational only — a prior run of this same idempotent test may have
    # already cleaned the named residue, so this is a soft note, not an assertion.
    weekday_weekend_dedupe_keys = [
        key
        for key in (o.get("dedupeKey") for o in before_body["orphans"])
        if key and str(key).startswith("phase23-e2e-dedupe-week")
    ]
    if weekday_weekend_dedupe_keys:
        print(f"Found named residue dedupeKeys pre-cleanup: {weekday_weekend_dedupe_keys}")

    confirm_result: CliInvocation = run_cli(["rotina", "instancia", "limpar-orfas", "--confirmar"])
    assert confirm_result.result.exit_code == 0, confirm_result.result.output
    confirm_body = cast("dict[str, Any]", confirm_result.json_out())
    assert confirm_body["count"] == orphan_count
    assert confirm_body["confirmado"] is True

    after_list_result: CliInvocation = run_cli(["rotina", "instancia", "limpar-orfas"])
    assert after_list_result.result.exit_code == 0, after_list_result.result.output
    after_body = cast("dict[str, Any]", after_list_result.json_out())
    assert after_body["count"] == 0
    after_dedupe_keys = [o.get("dedupeKey") for o in after_body["orphans"]]
    assert not any(
        key and str(key).startswith("phase23-e2e-dedupe-weekday") for key in after_dedupe_keys
    )
    assert not any(
        key and str(key).startswith("phase23-e2e-dedupe-weekend") for key in after_dedupe_keys
    )

    total_after = len(
        cast("list[dict[str, Any]]", run_cli(["rotina", "instancia", "listar"]).json_out())
    )
    assert total_before - total_after == orphan_count, (
        "the exact-delta invariant: only the listed orphans were removed, no other row"
    )
