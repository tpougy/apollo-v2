"""Live `apollo init <path>` tests (D1/D4/D5).

Every assertion here invokes the real CLI via `run_cli`; the force-refusal
round trip and folder-scaffold tests need no live session, but the
authenticated-status branch (Test 3) does — it skips cleanly (via
`live_session`) when no session exists, matching `test_batch_import.py`'s
own convention. `init` never creates any InstantDB record, so this file
needs no `cleanup_records`.
"""

from __future__ import annotations

from importlib import resources
from pathlib import Path

import pytest

from apollo_cli.session import Session
from tests.conftest import RunCli

pytestmark = pytest.mark.live


def test_init_creates_folder_and_writes_vendored_scaffold_files(
    tmp_path: Path, run_cli: RunCli
) -> None:
    target = tmp_path / "apollo-tasks"
    result = run_cli(["init", str(target)])
    assert result.result.exit_code == 0
    report = result.json_out()
    assert isinstance(report, dict)
    assert sorted(report["written"]) == ["CLAUDE.md", "README.md"]
    assert report["unchanged"] == []

    for filename in ("README.md", "CLAUDE.md"):
        vendored_text = (
            resources.files("apollo_cli.data.scaffold").joinpath(filename).read_text(
                encoding="utf-8"
            )
        )
        assert (target / filename).read_text(encoding="utf-8") == vendored_text


def test_init_force_refusal_then_override_round_trip(tmp_path: Path, run_cli: RunCli) -> None:
    target = tmp_path / "apollo-tasks-force"
    target.mkdir()
    (target / "README.md").write_text("minhas notas pessoais\n", encoding="utf-8")

    refusal = run_cli(["init", str(target)])
    assert refusal.result.exit_code == 6
    assert (target / "README.md").read_text(encoding="utf-8") == "minhas notas pessoais\n"

    override = run_cli(["init", str(target), "--force"])
    assert override.result.exit_code == 0
    vendored_readme = (
        resources.files("apollo_cli.data.scaffold").joinpath("README.md").read_text(
            encoding="utf-8"
        )
    )
    assert (target / "README.md").read_text(encoding="utf-8") == vendored_readme


def test_init_reports_authenticated_status_when_session_present(
    tmp_path: Path, run_cli: RunCli, live_session: Session
) -> None:
    target = tmp_path / "apollo-tasks-auth"
    result = run_cli(["init", str(target)])
    assert result.result.exit_code == 0
    report = result.json_out()
    assert isinstance(report, dict)
    assert report["authenticated"] is True
    assert report["email"] == live_session.email


def test_init_reports_guidance_when_unauthenticated(
    tmp_path: Path, run_cli: RunCli, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("APOLLO_SESSION_FILE", str(tmp_path / "does-not-exist" / "session"))
    target = tmp_path / "apollo-tasks-noauth"
    result = run_cli(["init", str(target)])
    assert result.result.exit_code == 0
    report = result.json_out()
    assert isinstance(report, dict)
    assert report["authenticated"] is False
    assert report["next_steps"] == [
        "apollo auth login --email <voce@exemplo.com>",
        "apollo auth login --email <voce@exemplo.com> --code <codigo>",
    ]
