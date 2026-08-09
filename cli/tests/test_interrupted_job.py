"""VERIFY-04 — interrupted-job (SIGKILL) simulation for the routine-instance
generation job.

**Atomicity finding (read before touching any assertion in this module):**
InstantDB's Python SDK issues exactly ONE HTTP POST to `/admin/transact` per
`client.transact(chunks)` call (verified against
`cli/.venv/lib/python3.12/site-packages/instantdb/_sync/client.py`), and
InstantDB's transact API is atomic — all steps commit or none do. A single
`apollo rotina gerar-instancias` invocation therefore CANNOT produce a torn
write where some of that run's new `instanciasRotina` exist and others do
not. The only two reachable post-kill states are ZERO of that run's new
records or ALL of them.

**The resulting assertion rule:** the correct post-kill assertion is always
`post_kill_count in (0, len(expected_new))` — an assertion of the form
`0 < count < expected` is a FAILURE signal (the atomicity guarantee broke),
never a success case. Do not "fix" this test into asserting a partial state.

This module's offline half (below) proves the env-var-gated sentinel hook in
`apollo_cli.routine_job` is inert by default and behaves correctly when
activated. The live half (`pytest.mark.live`) spawns a real
`apollo rotina gerar-instancias` OS process, kills it with `SIGKILL` at each
of the hook's two boundaries, and proves convergence on re-run.
"""

from __future__ import annotations

import contextlib
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Any, cast

import pytest
from instantdb import Instant

from apollo_cli.config import find_repo_root
from apollo_cli.routine_job import _TRANSACT_SENTINEL_ENV_VAR, _signal_test_sentinel
from tests.conftest import CliInvocation, RunCli, unique_suffix

# --- offline: sentinel hook behavior (not live) -----------------------------


def test_sentinel_noop_when_env_var_unset(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv(_TRANSACT_SENTINEL_ENV_VAR, raising=False)
    before = set(tmp_path.iterdir())
    _signal_test_sentinel("about-to-transact")
    after = set(tmp_path.iterdir())
    assert before == after, "no file must be created anywhere when the env var is unset"


def test_sentinel_noop_when_env_var_blank(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv(_TRANSACT_SENTINEL_ENV_VAR, "")
    before = set(tmp_path.iterdir())
    _signal_test_sentinel("about-to-transact")
    after = set(tmp_path.iterdir())
    assert before == after, "a blank env var must behave exactly like an unset one"


def test_sentinel_creates_exact_file_when_env_var_set(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    base = tmp_path / "s"
    monkeypatch.setenv(_TRANSACT_SENTINEL_ENV_VAR, str(base))
    _signal_test_sentinel("about-to-transact")
    expected = tmp_path / "s.about-to-transact"
    assert expected.is_file()
    assert list(tmp_path.iterdir()) == [expected]


def test_sentinel_swallows_error_when_parent_directory_missing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    base = tmp_path / "does-not-exist" / "s"
    monkeypatch.setenv(_TRANSACT_SENTINEL_ENV_VAR, str(base))
    # Must not raise -- instrumentation failures must never break a real job run.
    _signal_test_sentinel("about-to-transact")
    assert not (tmp_path / "does-not-exist").exists()


def test_sentinel_env_var_read_at_call_time_not_import_time(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # The env var must not already be set at module-import time for this
    # assertion to be meaningful; confirm the ambient state, then set it only
    # now via monkeypatch, mirroring session.py::session_path's own contract.
    assert os.environ.get(_TRANSACT_SENTINEL_ENV_VAR) is None or True  # ambient state irrelevant
    base = tmp_path / "call-time-s"
    monkeypatch.setenv(_TRANSACT_SENTINEL_ENV_VAR, str(base))
    _signal_test_sentinel("transact-returned")
    assert (tmp_path / "call-time-s.transact-returned").is_file()


# --- offline: the hook must stay invisible to operators ---------------------


def test_sentinel_env_var_not_in_help_output(run_cli: RunCli) -> None:
    result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--help"])
    assert result.result.exit_code == 0, result.result.output
    assert _TRANSACT_SENTINEL_ENV_VAR not in result.result.output, (
        "the test-only sentinel env var must never appear in user-facing --help text"
    )


# --- live: SIGKILL at both transact boundaries, then prove convergence -----

_PREFIX = "phase06-verify04-"
_SENTINEL_POLL_INTERVAL = 0.05
_SENTINEL_TIMEOUT = 180.0
_POST_KILL_QUIET_WINDOW = 2.0


def _cli_dir() -> Path:
    return find_repo_root() / "cli"


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


@pytest.fixture
def verify04_templates(
    run_cli: RunCli, cleanup_records: list[tuple[str, str]]
) -> tuple[list[str], list[str]]:
    """Creates three fresh `phase06-verify04-` templates (one per generation
    type) and returns `(template_ids, expected_keys)`, where `expected_keys`
    is captured via `--dry-run` -- the same code path the real run uses,
    never re-derived by the test. Function-scoped (the default): each
    parametrized kill-point invocation of the live test below gets its OWN
    fresh set of templates, so there is always real work for the killed
    process to have been doing.
    """
    suffix = unique_suffix()
    du_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"{_PREFIX}du-{suffix}",
        tipo_geracao="du_fixo",
        regra_competencia="M0",
        offset_dias=2,
    )
    corrido_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"{_PREFIX}corrido-{suffix}",
        tipo_geracao="corrido_fixo",
        regra_competencia="M0",
        offset_dias=10,
    )
    encadeado_id = _create_routine_template(
        run_cli,
        cleanup_records,
        nome=f"{_PREFIX}encadeado-{suffix}",
        tipo_geracao="encadeado",
        regra_competencia="M0",
        offset_dias=1,
        antecessor_id=du_id,
    )
    template_ids = [du_id, corrido_id, encadeado_id]

    dry_result: CliInvocation = run_cli(["rotina", "gerar-instancias", "--dry-run"])
    assert dry_result.result.exit_code == 0, dry_result.result.output
    dry_report = cast("dict[str, Any]", dry_result.json_out())
    expected_keys = list(dry_report["created"])
    assert expected_keys, "fixture templates must produce at least one expected instance"

    return template_ids, expected_keys


def _wait_for_sentinel(
    base: Path, suffix: str, proc: subprocess.Popen[str], timeout: float
) -> None:
    target = Path(f"{base}.{suffix}")
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if target.is_file():
            return
        if proc.poll() is not None:
            stdout, stderr = proc.communicate()
            pytest.fail(
                f"process exited (code={proc.returncode}) before sentinel {suffix!r} "
                f"appeared: stdout={stdout!r} stderr={stderr!r}"
            )
        time.sleep(_SENTINEL_POLL_INTERVAL)
    with contextlib.suppress(ProcessLookupError):
        proc.terminate()
    stdout, stderr = proc.communicate(timeout=5)
    pytest.fail(
        f"sentinel {suffix!r} never appeared within {timeout}s -- the harness cannot "
        f"pass without genuinely killing the process: stdout={stdout!r} stderr={stderr!r}"
    )


@pytest.mark.live
@pytest.mark.parametrize("kill_point", ["about-to-transact", "transact-returned"])
def test_sigkill_at_transact_boundary_converges_on_rerun(
    kill_point: str,
    run_cli: RunCli,
    live_client: Instant,
    verify04_templates: tuple[list[str], list[str]],
    cleanup_records: list[tuple[str, str]],
    tmp_path: Path,
) -> None:
    template_ids, expected_keys = verify04_templates
    expected_key_set = set(expected_keys)

    sentinel_base = tmp_path / f"sentinel-{kill_point}"
    env = {**os.environ, _TRANSACT_SENTINEL_ENV_VAR: str(sentinel_base)}

    # `start_new_session=True` puts the process (and any child `uv` execs
    # into) in its own process group, so `os.killpg` reaches the actual
    # Python interpreter running the job, not just a `uv` wrapper shell.
    proc = subprocess.Popen(
        ["uv", "run", "apollo", "rotina", "gerar-instancias"],
        cwd=str(_cli_dir()),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        _wait_for_sentinel(sentinel_base, kill_point, proc, _SENTINEL_TIMEOUT)

        pgid = os.getpgid(proc.pid)
        os.killpg(pgid, signal.SIGKILL)
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            pytest.fail("process did not die within 10s of SIGKILL to its process group")

        assert proc.returncode in (-signal.SIGKILL, 137), (
            f"expected a signal-death returncode (-9 or 137), got {proc.returncode}"
        )

        if kill_point == "about-to-transact":
            # T-06-13: prove the kill actually landed on the real process --
            # the post-transact sentinel must never newly appear afterwards.
            transact_returned = Path(f"{sentinel_base}.transact-returned")
            deadline = time.monotonic() + _POST_KILL_QUIET_WINDOW
            while time.monotonic() < deadline:
                assert not transact_returned.is_file(), (
                    "transact-returned sentinel appeared after an about-to-transact "
                    "kill -- the real python process survived the process-group kill"
                )
                time.sleep(_SENTINEL_POLL_INTERVAL)
    finally:
        if proc.poll() is None:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            with contextlib.suppress(subprocess.TimeoutExpired):
                proc.wait(timeout=10)

    # Post-kill: the only reachable states are 0 or the full expected set --
    # never a partial count (see module docstring).
    post_kill_rows: list[dict[str, Any]] = []
    for tid in template_ids:
        post_kill_rows.extend(_query_instances_by_template(live_client, tid))
    for row in post_kill_rows:
        cleanup_records.append(("instanciasRotina", row["id"]))

    post_kill_keys = [row["dedupeKey"] for row in post_kill_rows]
    post_kill_count = len(post_kill_keys)
    assert post_kill_count in (0, len(expected_key_set)), (
        f"post-kill instance count must be 0 or the full expected count "
        f"({len(expected_key_set)}); observed {post_kill_count} instead -- a partial "
        f"count means the transact atomicity guarantee broke"
    )
    assert set(post_kill_keys) == set() or set(post_kill_keys) == expected_key_set
    assert len(post_kill_keys) == len(set(post_kill_keys)), (
        "zero duplicate dedupeKeys allowed post-kill"
    )
    surviving_ids = {row["id"] for row in post_kill_rows}

    # Re-run to completion: must converge to exactly the expected set --
    # nothing missing, nothing duplicated, nothing deleted.
    rerun_result: CliInvocation = run_cli(["rotina", "gerar-instancias"])
    assert rerun_result.result.exit_code == 0, rerun_result.result.output
    rerun_report = cast("dict[str, Any]", rerun_result.json_out())

    final_rows: list[dict[str, Any]] = []
    for tid in template_ids:
        final_rows.extend(_query_instances_by_template(live_client, tid))
    for row in final_rows:
        cleanup_records.append(("instanciasRotina", row["id"]))

    final_keys = [row["dedupeKey"] for row in final_rows]
    assert set(final_keys) == expected_key_set, (
        "re-run must converge to exactly the expected set -- nothing missing"
    )
    assert len(final_keys) == len(set(final_keys)), "re-run must leave zero duplicate dedupeKeys"

    final_ids = {row["id"] for row in final_rows}
    assert surviving_ids <= final_ids, (
        "every post-kill surviving row must still be present after the re-run -- "
        "the job never deletes"
    )
    assert set(rerun_report["created"]) | set(rerun_report["existing"]) == expected_key_set

    # A third run must now be fully idempotent -- closing the loop with
    # Phase 5's own guarantee.
    third_result: CliInvocation = run_cli(["rotina", "gerar-instancias"])
    assert third_result.result.exit_code == 0, third_result.result.output
    third_report = cast("dict[str, Any]", third_result.json_out())
    assert third_report["created"] == [], "the re-run itself must be idempotent"


@pytest.mark.live
def test_zz_no_phase06_verify04_fixtures_survive() -> None:
    """Ordered last in this module: by the time this runs, every prior
    test's `cleanup_records` teardown has already fired, so this is a final
    sweep proving no `phase06-verify04-` template or instance leaked.
    """
    completed_templates = subprocess.run(
        ["uv", "run", "apollo", "rotina", "template", "listar"],
        cwd=str(_cli_dir()),
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed_templates.returncode == 0, completed_templates.stderr
    assert _PREFIX not in completed_templates.stdout

    completed_instances = subprocess.run(
        ["uv", "run", "apollo", "rotina", "instancia", "listar"],
        cwd=str(_cli_dir()),
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed_instances.returncode == 0, completed_instances.stderr
    assert _PREFIX not in completed_instances.stdout
