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
import os
import stat
import subprocess
from pathlib import Path

import pytest
from instantdb import Instant

from apollo_cli.auth import EXIT_API_ERROR
from apollo_cli.config import find_repo_root, load_instant_config
from apollo_cli.session import MissingSessionError, Session, load_session, session_path
from tests.conftest import RunCli
from tests.helpers.magic_code import read_latest_magic_code, read_magic_code_after


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


# --- Full happy-path round trip, real email, admin-token entirely absent ---
#
# This is the phase's headline live acceptance proof (AUTH-01/AUTH-03,
# CONTEXT.md decision 9): plan 25-01 only live-proved the invalid-code error
# path above (which needs no real email); this test is what actually proves
# a real magic-code send+verify round trip completes end-to-end. Uses real
# subprocess invocations (not CliRunner) so `INSTANT_APP_ADMIN_TOKEN` can be
# genuinely absent from a real child-process environment, matching
# test_packaging_live.py's `_subprocess_env` isolation idiom. Sends only once
# per test run -- no loop, no retry-by-resending (RESEARCH.md Security Domain
# note on InstantDB's per-email rate limit under bursty sends).


def _subprocess_env(session_file: Path) -> dict[str, str]:
    """A copy of the current environment with `INSTANT_APP_ADMIN_TOKEN`
    removed (defensive -- proves the round trip works even if the var
    happened to be exported) and `APOLLO_SESSION_FILE` overridden to an
    isolated path, so the developer's real persisted
    `~/.config/apollo-cli/session` is never touched.
    """
    env = dict(os.environ)
    env.pop("INSTANT_APP_ADMIN_TOKEN", None)
    env["APOLLO_SESSION_FILE"] = str(session_file)
    return env


@pytest.mark.live
def test_login_round_trip_completes_with_admin_token_entirely_absent(
    tmp_path: Path,
) -> None:
    email = "tp@rbrasset.com.br"
    session_file = tmp_path / "session"
    env = _subprocess_env(session_file)
    cli_dir = find_repo_root() / "cli"

    prior_code = read_latest_magic_code()

    send = subprocess.run(
        ["uv", "run", "apollo", "auth", "login", "--email", email],
        cwd=str(cli_dir),
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )
    assert send.returncode == 0, send.stderr
    send_body = json.loads(send.stdout)
    assert send_body["status"] == "code_sent"

    code = read_magic_code_after(prior_code)

    verify = subprocess.run(
        ["uv", "run", "apollo", "auth", "login", "--email", email, "--code", code],
        cwd=str(cli_dir),
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )
    assert verify.returncode == 0, verify.stderr
    verify_body = json.loads(verify.stdout)
    assert verify_body["status"] == "logged_in"

    assert session_file.is_file()
