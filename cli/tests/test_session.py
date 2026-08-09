"""Session file format + permission contract (no network).

Every test points `APOLLO_SESSION_FILE` at a `tmp_path` location via the
autouse fixture below — no test may read or write the developer's real
`~/.config/apollo-cli/session`.
"""

from __future__ import annotations

import os
import stat
from pathlib import Path

import pytest

from apollo_cli.session import (
    CorruptSessionError,
    MissingSessionError,
    Session,
    clear_session,
    load_session,
    save_session,
    session_path,
)


@pytest.fixture(autouse=True)
def _isolated_session_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APOLLO_SESSION_FILE", str(tmp_path / "cfg" / "session"))


def _mode(path: Path) -> int:
    return stat.S_IMODE(path.stat().st_mode)


def test_round_trips_all_fields() -> None:
    save_session(Session(user_id="u1", email="e@x", refresh_token="rt"))
    loaded = load_session()
    assert loaded.user_id == "u1"
    assert loaded.email == "e@x"
    assert loaded.refresh_token == "rt"


def test_file_and_dir_permissions() -> None:
    save_session(Session(user_id="u1", email="e@x", refresh_token="rt"))
    assert _mode(session_path()) == 0o600
    assert _mode(session_path().parent) == 0o700


def test_retightens_permissions_on_existing_loose_file() -> None:
    path = session_path()
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.write_text("{}")
    os.chmod(path, 0o644)

    save_session(Session(user_id="u1", email="e@x", refresh_token="rt"))

    assert _mode(path) == 0o600


def test_load_missing_raises_missing_session_error() -> None:
    with pytest.raises(MissingSessionError):
        load_session()


def test_load_corrupt_json_raises_corrupt_session_error() -> None:
    path = session_path()
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.write_text("{ not json")

    with pytest.raises(CorruptSessionError):
        load_session()


def test_load_missing_required_key_raises_corrupt_session_error() -> None:
    path = session_path()
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.write_text('{"user_id": "u1", "email": "e@x"}')

    with pytest.raises(CorruptSessionError):
        load_session()


def test_repr_does_not_leak_refresh_token() -> None:
    session = Session(user_id="u1", email="e@x", refresh_token="super-secret-token")
    assert "super-secret-token" not in repr(session)


def test_clear_session_returns_true_when_file_existed() -> None:
    save_session(Session(user_id="u1", email="e@x", refresh_token="rt"))
    assert clear_session() is True
    assert not session_path().exists()


def test_clear_session_returns_false_when_nothing_to_remove() -> None:
    assert clear_session() is False
