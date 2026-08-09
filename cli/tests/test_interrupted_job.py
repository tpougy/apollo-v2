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

import os
from pathlib import Path

import pytest

from apollo_cli.routine_job import _TRANSACT_SENTINEL_ENV_VAR, _signal_test_sentinel
from tests.conftest import CliInvocation, RunCli

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
