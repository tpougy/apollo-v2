"""Live tests for `apollo_cli.version_check`.

Every test here exercises the real code path end to end against a real (or
deliberately unreachable) network target — no mocking of the HTTP layer
itself. `cli/tests/conftest.py`'s autouse fixture disables the check by
default for every other test in this package; these tests explicitly opt
back in via `monkeypatch.delenv`.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from apollo_cli import version_check
from apollo_cli.session import Session
from tests.conftest import RunCli

pytestmark = pytest.mark.live


def test_warns_when_a_newer_version_is_available_on_github(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("APOLLO_NO_VERSION_CHECK", raising=False)
    monkeypatch.setenv("APOLLO_VERSION_CACHE_FILE", str(tmp_path / "cache.json"))
    monkeypatch.setattr(version_check, "_installed_version", lambda: "0.0.1")

    version_check.maybe_warn_outdated()

    captured = capsys.readouterr()
    assert captured.out == ""
    assert "0.0.1" in captured.err
    assert "uv tool upgrade apollo-cli" in captured.err


def test_stays_silent_and_never_raises_when_github_is_unreachable(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("APOLLO_NO_VERSION_CHECK", raising=False)
    monkeypatch.setenv("APOLLO_VERSION_CACHE_FILE", str(tmp_path / "cache.json"))
    monkeypatch.setattr(version_check, "_RELEASES_LATEST_URL", "http://127.0.0.1:1/releases/latest")
    monkeypatch.setattr(version_check, "_TAGS_URL", "http://127.0.0.1:1/tags")
    monkeypatch.setattr(version_check, "_installed_version", lambda: "0.0.1")

    version_check.maybe_warn_outdated()

    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == ""
    assert version_check.cache_path().is_file()
    cached = json.loads(version_check.cache_path().read_text(encoding="utf-8"))
    assert cached["latest_version"] is None


def test_cache_prevents_a_second_live_network_call_within_the_ttl_window(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("APOLLO_NO_VERSION_CHECK", raising=False)
    monkeypatch.setenv("APOLLO_VERSION_CACHE_FILE", str(tmp_path / "cache.json"))

    first = version_check.get_latest_version_cached()
    checked_at_after_first = json.loads(version_check.cache_path().read_text(encoding="utf-8"))[
        "checked_at"
    ]

    second = version_check.get_latest_version_cached()

    assert second == first
    checked_at_after_second = json.loads(version_check.cache_path().read_text(encoding="utf-8"))[
        "checked_at"
    ]
    assert checked_at_after_second == checked_at_after_first


def test_stdout_of_a_json_emitting_command_stays_valid_json_when_the_warning_fires(
    run_cli: RunCli, live_session: Session, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("APOLLO_NO_VERSION_CHECK", raising=False)
    monkeypatch.setenv("APOLLO_VERSION_CACHE_FILE", str(tmp_path / "cache.json"))
    monkeypatch.setattr(version_check, "_installed_version", lambda: "0.0.1")

    invocation = run_cli(["entidade", "listar"])

    assert invocation.result.exit_code == 0
    # Parsed from `.stdout` specifically (not the combined `.output` /
    # `json_out()` helper, which mixes stdout+stderr as the user would see
    # in a terminal, per Click 8.2+) -- this is the load-bearing assertion:
    # stdout must stay valid, parseable JSON even though the warning fires
    # on stderr in the same invocation.
    body = json.loads(invocation.result.stdout)
    assert isinstance(body, list)
    assert "0.0.1" in invocation.result.stderr
    assert "uv tool upgrade apollo-cli" in invocation.result.stderr
