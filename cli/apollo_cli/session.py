"""Local session persistence for `apollo auth login`.

Stores exactly three fields — `user_id`, `email`, `refresh_token` — as a JSON
object at `session_path()`. This file is the CLI's analogue of the browser
SDK's `localStorage` session: the refresh token is a long-lived, non-rotating
credential, so the file is created at `0600` under a `0700` directory and its
contents are never echoed to stdout/stderr, logged, or included in a
traceback. See PROJECT.md C-05 and phase 03 RESEARCH.md Pitfall 4.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final

SESSION_ENV_VAR: Final[str] = "APOLLO_SESSION_FILE"
DEFAULT_SESSION_DIR: Final[Path] = Path.home() / ".config" / "apollo-cli"
DEFAULT_SESSION_FILE: Final[Path] = DEFAULT_SESSION_DIR / "session"

_REQUIRED_KEYS: Final[tuple[str, ...]] = ("user_id", "email", "refresh_token")


@dataclass(frozen=True)
class Session:
    """A persisted, authenticated InstantDB session."""

    user_id: str
    email: str
    refresh_token: str = field(repr=False)


class SessionError(RuntimeError):
    """Base class for all session-file errors."""


class MissingSessionError(SessionError):
    """Raised when no session file exists."""


class CorruptSessionError(SessionError):
    """Raised when the session file exists but cannot be parsed as a Session.

    Never includes the file's raw contents in its message — the file may
    contain a partially-written credential.
    """


def session_path() -> Path:
    """Return the resolved session file path.

    Reads `APOLLO_SESSION_FILE` from the environment at call time (not at
    import time) so tests can `monkeypatch.setenv` it. Falls back to
    `DEFAULT_SESSION_FILE` when unset.
    """
    override = os.environ.get(SESSION_ENV_VAR)
    return Path(override) if override else DEFAULT_SESSION_FILE


def save_session(session: Session) -> None:
    """Persist `session` as 0600 JSON under a 0700 parent directory.

    Re-tightens permissions unconditionally on every call, even when the
    file/directory already existed with looser permissions.
    """
    path = session_path()
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)

    payload = json.dumps(
        {
            "user_id": session.user_id,
            "email": session.email,
            "refresh_token": session.refresh_token,
        }
    )
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(fd, payload.encode("utf-8"))
    finally:
        os.close(fd)
    os.chmod(path, 0o600)


def load_session() -> Session:
    """Load and validate the persisted session.

    Raises `MissingSessionError` when no file exists, and `CorruptSessionError`
    when the file exists but is not valid JSON, is not a JSON object, or is
    missing/blank any of `user_id`, `email`, `refresh_token`.
    """
    path = session_path()
    if not path.is_file():
        msg = f"No session found at {path}. Run: apollo auth login --email <seu-email>"
        raise MissingSessionError(msg)

    try:
        raw = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        msg = (
            f"Session file at {path} is not valid UTF-8. Run: apollo auth login --email <seu-email>"
        )
        raise CorruptSessionError(msg) from error

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        msg = (
            f"Session file at {path} is not valid JSON. Run: apollo auth login --email <seu-email>"
        )
        raise CorruptSessionError(msg) from error

    if not isinstance(data, dict):
        msg = f"Session file at {path} is not a JSON object. Run: apollo auth login --email <seu-email>"
        raise CorruptSessionError(msg)

    for key in _REQUIRED_KEYS:
        value = data.get(key)
        if not isinstance(value, str) or not value:
            msg = (
                f"Session file at {path} is missing required field {key!r}. "
                "Run: apollo auth login --email <seu-email>"
            )
            raise CorruptSessionError(msg)

    return Session(
        user_id=data["user_id"],
        email=data["email"],
        refresh_token=data["refresh_token"],
    )


def clear_session() -> bool:
    """Remove the session file if it exists.

    Returns `True` when a file was actually removed, `False` when there was
    nothing to remove. Never raises on a missing file.
    """
    path = session_path()
    try:
        path.unlink()
    except FileNotFoundError:
        return False
    return True
