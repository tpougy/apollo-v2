"""Live session-health assertion — CLI-01 proof (no mocking).

Exercises the real, persisted `~/.config/apollo-cli/session` against the live
InstantDB app via the unauthenticated `verify_token` endpoint. This module
contains no mock, stub, or fixture standing in for InstantDB: it either talks
to the real API using the real refresh token from a real magic-code round
trip, or it skips outright when no session is present (e.g. CI, a fresh
clone). See `.planning/phases/03-cli-auth-crud/03-01-LOGIN-EVIDENCE.md` for
the recorded proof that the session under test was created via a real inbox
round trip.
"""

from __future__ import annotations

import json
import stat
from pathlib import Path

import pytest
from instantdb import Instant

from apollo_cli.auth import EXIT_API_ERROR
from apollo_cli.config import load_instant_config
from apollo_cli.session import MissingSessionError, Session, load_session, session_path
from tests.conftest import RunCli


@pytest.fixture
def live_session() -> Session:
    try:
        return load_session()
    except MissingSessionError:
        pytest.skip("no live session; run apollo auth login")
        raise


@pytest.mark.live
def test_verify_token_reports_the_persisted_user(live_session: Session) -> None:
    config = load_instant_config()
    client = Instant(app_id=config.app_id, admin_token="")

    user = client.auth.verify_token(live_session.refresh_token)

    assert user["id"] == live_session.user_id


@pytest.mark.live
def test_session_file_is_mode_0600(live_session: Session) -> None:
    mode = stat.S_IMODE(session_path().stat().st_mode)
    assert mode == 0o600


# --- Public-endpoint invalid-code proof (AUTH-01/AUTH-02/AUTH-03) -----------
#
# Needs no real email at all -- InstantDB's public `/runtime/auth/verify_magic_code`
# endpoint rejects a nonexistent (email, code) pair deterministically before any
# side effect (no email sent, no user created), live-verified in RESEARCH.md.


@pytest.mark.live
def test_login_with_invalid_code_exits_api_error_with_zero_admin_token(
    run_cli: RunCli,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APOLLO_SESSION_FILE", str(tmp_path / "session"))
    monkeypatch.delenv("INSTANT_APP_ADMIN_TOKEN", raising=False)

    invocation = run_cli(
        [
            "auth",
            "login",
            "--email",
            "nonexistent-probe-test@example.com",
            "--code",
            "000000",
        ]
    )

    assert invocation.result.exit_code == EXIT_API_ERROR, invocation.result.output
    error_body = json.loads(invocation.result.output or invocation.result.stderr)
    assert error_body["error"] == "auth_failed"
    assert error_body["type"] == "record-not-found"
