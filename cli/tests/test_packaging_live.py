"""Live packaging round-trip proof (PKG-05): build the real wheel, install it
into a throwaway venv via genuine `uv build`/`uv venv`/`uv pip install`
subprocess calls, then run the installed `apollo` console script — plus a
direct interpreter check of `apollo_cli.bizdays` — from a directory outside
`apollo-v2` with no `shared/` or `.env.instantdb` reachable from that install
location. Proves the installed package never depends on the monorepo
checkout at runtime.

This is the *permanent* regression gate for the one-time proof plan 24-01 ran
by hand: once that plan's own scratch dirs are deleted, this test is the only
thing still checking PKG-05 on every future change (including the bizdays
correctness assertion — not just "imports without crashing").

Marked `packaging` (not `live`) since it shells out to real filesystem/build
tooling, not the InstantDB network API — see `pyproject.toml`'s marker
registration and RESEARCH.md's Open Question 2.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest

from apollo_cli.config import find_repo_root

pytestmark = pytest.mark.packaging


def _cli_dir() -> Path:
    return find_repo_root() / "cli"


def _subprocess_env(session_file: str) -> dict[str, str]:
    """A copy of the current environment with `APOLLO_SESSION_FILE` overridden
    to a guaranteed-nonexistent path.

    This dev machine carries a real, persisted `~/.config/apollo-cli/session`
    from prior legitimate `apollo auth login` use (see plan 24-01
    SUMMARY.md's Decisions) — without this override, `fundo listar` would
    return a real (empty) query result at exit 0 instead of exercising the
    `no_session` contract this test asserts, making the test behave
    differently on this machine than on a genuinely fresh install.
    """
    env = dict(os.environ)
    env["APOLLO_SESSION_FILE"] = session_file
    return env


def test_installed_wheel_runs_outside_repo_with_no_shared_or_env_file(
    tmp_path: Path,
) -> None:
    dist_dir = tmp_path / "dist"
    venv_dir = tmp_path / "venv"
    outside_cwd = tmp_path / "outside"  # guaranteed not inside apollo-v2
    outside_cwd.mkdir()

    subprocess.run(
        ["uv", "build", "--out-dir", str(dist_dir)],
        cwd=str(_cli_dir()),
        check=True,
    )
    wheel = next(dist_dir.glob("*.whl"))

    subprocess.run(["uv", "venv", str(venv_dir), "--python", "3.12"], check=True)
    venv_python = venv_dir / "bin" / "python"
    subprocess.run(
        ["uv", "pip", "install", "--python", str(venv_python), str(wheel)],
        check=True,
    )

    apollo_bin = venv_dir / "bin" / "apollo"

    version = subprocess.run(
        [str(apollo_bin), "--version"],
        cwd=str(outside_cwd),
        capture_output=True,
        text=True,
        check=True,
    )
    assert version.returncode == 0

    doctor = subprocess.run(
        [str(apollo_bin), "doctor"],
        cwd=str(outside_cwd),
        capture_output=True,
        text=True,
        check=True,
    )
    assert doctor.returncode == 0
    assert "embedded" in doctor.stdout.lower()

    # Permanent regression proof that the vendored calendar resolves
    # CORRECTLY (not just "imports without crashing") via importlib.resources
    # from an installed package — plan 24-01's own live proof alone stops
    # being checked once its scratch dirs are deleted.
    bizdays_snippet = (
        "from apollo_cli.bizdays import is_business_day, add_business_days; "
        "assert is_business_day('2024-03-28') is True; "
        "assert is_business_day('2024-03-29') is False; "
        "assert add_business_days('2024-03-28', 1) == '2024-04-01'"
    )
    bizdays_check = subprocess.run(
        [str(venv_python), "-c", bizdays_snippet],
        cwd=str(outside_cwd),
        capture_output=True,
        text=True,
        check=True,
    )
    assert bizdays_check.returncode == 0

    # A read-only subcommand must reach its NORMAL documented no-session
    # behavior — proves no import-time crash, not a live-data assertion
    # (matches test_auth_rejection.py's existing no_session contract).
    listar = subprocess.run(
        [str(apollo_bin), "fundo", "listar"],
        cwd=str(outside_cwd),
        capture_output=True,
        text=True,
        check=False,
        env=_subprocess_env(str(outside_cwd / "does-not-exist" / "session")),
    )
    assert listar.returncode == 1
    error_body = json.loads(listar.stderr)
    assert error_body["error"] == "no_session"
