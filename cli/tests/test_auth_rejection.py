"""CLI-11 — write-based permission-denial probe + admin-token confinement gate.

Every assertion here that proves "rejected without a valid session" is a
WRITE. A query without authorization returns `[]` with HTTP 200 (RESEARCH
Pitfall 3) — that proves nothing about permission enforcement, so no test in
this module treats an empty `listar` result as evidence of denial (see test
6, which pins the current exit-1-before-querying behavior instead).

Extends `cli/tests/test_instant_client.py` (plan 03-01's AST-walk gate) with
the `Instant(` construction check and the `login_client` call-site check.
"""

from __future__ import annotations

import ast
import json
import os
import subprocess
import uuid
from pathlib import Path

import pytest
from instantdb import Instant, InstantAPIError
from instantdb import id as new_id

from apollo_cli.auth import EXIT_NETWORK_ERROR
from apollo_cli.config import find_repo_root, load_instant_config
from apollo_cli.crud_helpers import now_iso
from apollo_cli.instant_client import session_client
from apollo_cli.session import Session
from tests.conftest import RunCli

# NOTE: unlike an earlier version of this module, there is no module-level
# `pytestmark = pytest.mark.live` here -- tests 4/6/7 and the new network-
# error test (test 8, phase 25) are genuinely offline (no real InstantDB
# network I/O), so each test that DOES need the real network is marked
# `@pytest.mark.live` individually instead. This mirrors the same pattern
# `test_cross_user_isolation.py`'s docstring already documents for the same
# reason (one test there must run offline under `-m "not live"`).


def _cli_dir() -> Path:
    return Path(__file__).resolve().parent.parent


def _permission_denied_type(error: InstantAPIError) -> str | None:
    body = error.body if isinstance(error.body, dict) else {}
    return body.get("type")


# --- 1. Guest write is denied (live) ---------------------------------------


@pytest.mark.live
def test_guest_write_is_denied_with_permission_denied() -> None:
    config = load_instant_config()
    client = Instant(app_id=config.app_id, admin_token="").as_user(guest=True)

    with pytest.raises(InstantAPIError) as exc_info:
        client.transact(
            client.tx.fundos[new_id()].create(
                {
                    "nome": "Guest Probe",
                    "codigo": "GUEST-PROBE",
                    "ativo": True,
                    "createdAt": now_iso(),
                    "donoId": "anyone",
                }
            )
        )

    assert _permission_denied_type(exc_info.value) == "permission-denied"


# --- 2. Nonexistent-token write is rejected (live) --------------------------


@pytest.mark.live
def test_nonexistent_refresh_token_write_is_rejected() -> None:
    fake_session = Session(
        user_id="does-not-matter",
        email="nobody@example.com",
        refresh_token=str(uuid.uuid4()),
    )
    client = session_client(fake_session)

    with pytest.raises(InstantAPIError):
        client.transact(
            client.tx.fundos[new_id()].create(
                {
                    "nome": "Fake Token Probe",
                    "codigo": "FAKE-PROBE",
                    "ativo": True,
                    "createdAt": now_iso(),
                    "donoId": fake_session.user_id,
                }
            )
        )


# --- 3. Mismatched donoId is denied (live, real session) --------------------


@pytest.mark.live
def test_mismatched_donoid_is_denied_even_with_a_real_session(live_session: Session) -> None:
    client = session_client(live_session)
    other_user_id = str(uuid.uuid4())
    assert other_user_id != live_session.user_id

    with pytest.raises(InstantAPIError) as exc_info:
        client.transact(
            client.tx.fundos[new_id()].create(
                {
                    "nome": "Mismatched Owner Probe",
                    "codigo": "MISMATCH-PROBE",
                    "ativo": True,
                    "createdAt": now_iso(),
                    "donoId": other_user_id,
                }
            )
        )

    assert _permission_denied_type(exc_info.value) == "permission-denied"


# --- 4. CLI surface with no session (subprocess) ----------------------------


def test_cli_criar_with_no_session_file_exits_1_with_no_session_error(tmp_path: Path) -> None:
    nonexistent = tmp_path / "does-not-exist" / "session"
    completed = subprocess.run(
        ["uv", "run", "apollo", "fundo", "criar", "--nome", "A", "--codigo", "B"],
        cwd=str(_cli_dir()),
        capture_output=True,
        text=True,
        check=False,
        env=_subprocess_env(str(nonexistent)),
    )
    assert completed.returncode == 1
    error_body = json.loads(completed.stderr)
    assert error_body["error"] == "no_session"


# --- 5. CLI surface with an invalid session (subprocess) --------------------


@pytest.mark.live
def test_cli_criar_with_invalid_session_rejects_and_creates_nothing(
    tmp_path: Path,
    live_client: Instant,
) -> None:
    bogus_session_file = tmp_path / "bogus-session"
    bogus_session_file.write_text(
        json.dumps(
            {
                "user_id": str(uuid.uuid4()),
                "email": "bogus@example.com",
                "refresh_token": str(uuid.uuid4()),
            }
        )
    )
    unique_nome = f"Invalid Session Probe {uuid.uuid4()}"

    completed = subprocess.run(
        ["uv", "run", "apollo", "fundo", "criar", "--nome", unique_nome, "--codigo", "BOGUS"],
        cwd=str(_cli_dir()),
        capture_output=True,
        text=True,
        check=False,
        env=_subprocess_env(str(bogus_session_file)),
    )

    assert completed.returncode != 0
    error_body = json.loads(completed.stderr)
    assert "error" in error_body

    result = live_client.query({"fundos": {"$": {"where": {"nome": unique_nome}}}})
    assert result.get("fundos", []) == []


# --- 6. Empty-list is NOT proof (documentation-as-test) ---------------------


def test_listar_with_no_session_exits_1_before_ever_querying(tmp_path: Path) -> None:
    # If this ever changes to "exit 0 with `[]`", CLI-11 verification must
    # NOT be moved onto `listar` — InstantDB perms-filters query rows
    # silently (HTTP 200, empty list), which proves nothing about
    # authorization. The write-based probes above (tests 1-3) remain the
    # only valid CLI-11 evidence regardless of this command's future shape.
    nonexistent = tmp_path / "does-not-exist" / "session"
    completed = subprocess.run(
        ["uv", "run", "apollo", "fundo", "listar"],
        cwd=str(_cli_dir()),
        capture_output=True,
        text=True,
        check=False,
        env=_subprocess_env(str(nonexistent)),
    )
    assert completed.returncode == 1


# --- 7. Admin-token confinement (structural, no network) --------------------

_ADMIN_TOKEN_EXEMPT_FILENAMES = {"instant_client.py", "config.py"}
# `auth.py` is the one other module allowed to construct a bare `Instant(...)`:
# its `whoami` command deliberately hits the unauthenticated `verify_token`
# endpoint directly (never `session_client()`/`login_client()`) so a
# corrupted-but-well-formed local session file cannot fake a healthy
# `whoami` — this is a documented Plan 03-01 design decision, not new scope
# introduced here.
_INSTANT_CONSTRUCTOR_EXEMPT_FILENAMES = {"instant_client.py", "auth.py"}
# As of phase 25, `auth.py`'s `login()` no longer calls `login_client()` at
# all (it talks to the public `/runtime/auth/*` endpoints directly via
# `httpx` instead) -- so it no longer needs this exemption.
# `instant_client.py` stays exempt for clarity even though it only *defines*
# `login_client`, never *calls* it (the `ast.Call` check below never fires
# on that file either way; keeping it exempt vs. dropping it to `set()` are
# behaviorally identical).
_LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES = {"instant_client.py"}


def _package_python_files() -> list[Path]:
    package_dir = find_repo_root() / "cli" / "apollo_cli"
    return sorted(package_dir.rglob("*.py"))


@pytest.mark.parametrize(
    "path",
    _package_python_files(),
    ids=lambda path: str(path.relative_to(find_repo_root())),
)
def test_admin_token_confinement(path: Path) -> None:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))

    if path.name not in _ADMIN_TOKEN_EXEMPT_FILENAMES:
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and node.value == "INSTANT_APP_ADMIN_TOKEN":
                pytest.fail(f"{path.name}:{node.lineno} contains 'INSTANT_APP_ADMIN_TOKEN'")
            if isinstance(node, (ast.Name, ast.Attribute)):
                name = node.id if isinstance(node, ast.Name) else node.attr
                if name == "INSTANT_APP_ADMIN_TOKEN":
                    pytest.fail(f"{path.name}:{node.lineno} references 'INSTANT_APP_ADMIN_TOKEN'")

    if path.name not in _LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES:
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                name = (
                    func.id
                    if isinstance(func, ast.Name)
                    else func.attr
                    if isinstance(func, ast.Attribute)
                    else None
                )
                if name == "login_client":
                    pytest.fail(f"{path.name}:{node.lineno} calls 'login_client'")

    if path.name not in _INSTANT_CONSTRUCTOR_EXEMPT_FILENAMES:
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                name = (
                    func.id
                    if isinstance(func, ast.Name)
                    else func.attr
                    if isinstance(func, ast.Attribute)
                    else None
                )
                if name == "Instant":
                    pytest.fail(f"{path.name}:{node.lineno} constructs 'Instant(' directly")


# --- 8. Network error is surfaced structurally (real refused connection, no mocking) --


def test_login_with_unreachable_api_uri_exits_network_error(
    run_cli: RunCli,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A real (if deliberately unreachable) TCP endpoint, per RESEARCH.md Pitfall 3.

    No InstantDB mocking: `httpx.post()` genuinely attempts to connect to
    `127.0.0.1:1` (a port nothing listens on) and gets a real, immediate
    connection-refused error, which `login()`'s existing `except
    httpx.HTTPError` branch already maps to `network_error`/exit 4.
    """
    monkeypatch.setattr("apollo_cli.auth.DEFAULT_API_URI", "http://127.0.0.1:1")
    monkeypatch.setenv("APOLLO_SESSION_FILE", str(tmp_path / "session"))

    invocation = run_cli(["auth", "login", "--email", "probe@example.com"])

    assert invocation.result.exit_code == EXIT_NETWORK_ERROR, invocation.result.output
    error_body = json.loads(invocation.result.output or invocation.result.stderr)
    assert error_body["error"] == "network_error"


def _subprocess_env(session_file: str) -> dict[str, str]:
    """A copy of the current environment with `APOLLO_SESSION_FILE` overridden.

    Never a bare `{"APOLLO_SESSION_FILE": ..., "PATH": ...}` dict — `uv run`
    needs `HOME`/cache/venv-discovery variables from the real environment.
    """
    env = dict(os.environ)
    env["APOLLO_SESSION_FILE"] = session_file
    return env
