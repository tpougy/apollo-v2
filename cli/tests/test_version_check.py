"""Live tests for `apollo_cli.version_check`.

Every test here exercises the real code path end to end against a real (or
deliberately unreachable) network target — no mocking of the HTTP layer
itself. `cli/tests/conftest.py`'s autouse fixture disables the check by
default for every other test in this package; these tests explicitly opt
back in via `monkeypatch.delenv`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from apollo_cli import version_check

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
