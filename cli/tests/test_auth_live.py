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

import stat

import pytest
from instantdb import Instant

from apollo_cli.config import load_instant_config
from apollo_cli.session import MissingSessionError, Session, load_session, session_path


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
