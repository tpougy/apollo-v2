"""Structural proof that `session_client` never carries an admin token.

No network calls — these tests only inspect the constructed client's
internal state and the source tree, never hit `api.instantdb.com`.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from apollo_cli.config import find_repo_root
from apollo_cli.instant_client import AdminTokenMissingError, login_client, session_client
from apollo_cli.session import Session

# Exempts files that legitimately reference the `INSTANT_APP_ADMIN_TOKEN`
# *key name* itself -- unrelated to who may *call* `login_client`, which is
# `test_auth_rejection.py`'s separate, narrower
# `_LOGIN_CLIENT_CALLER_EXEMPT_FILENAMES` gate.
_EXEMPT_FILENAMES = {"instant_client.py", "config.py"}


def test_session_client_carries_no_admin_token_even_under_hostile_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INSTANT_APP_ADMIN_TOKEN", "leaked-token-value")

    session = Session(user_id="u1", email="e@x", refresh_token="the-refresh-token")
    client = session_client(session)

    assert client._admin_token is None
    assert client._impersonation == {"as-token": "the-refresh-token"}


def test_login_client_raises_when_admin_token_missing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    env_file = tmp_path / ".env.instantdb"
    env_file.write_text('NEXT_PUBLIC_INSTANT_APP_ID="app-123"\n')
    monkeypatch.setenv("APOLLO_ENV_FILE", str(env_file))

    with pytest.raises(AdminTokenMissingError):
        login_client()


def _package_python_files() -> list[Path]:
    package_dir = find_repo_root() / "cli" / "apollo_cli"
    return sorted(package_dir.glob("*.py"))


@pytest.mark.parametrize(
    "path",
    _package_python_files(),
    ids=lambda path: path.name,
)
def test_admin_token_key_confined_to_exempt_modules(path: Path) -> None:
    if path.name in _EXEMPT_FILENAMES:
        pytest.skip(f"{path.name} is exempt (already references the key for its own contract)")

    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and node.value == "INSTANT_APP_ADMIN_TOKEN":
            pytest.fail(f"{path.name} contains the string 'INSTANT_APP_ADMIN_TOKEN'")
        if isinstance(node, (ast.Name, ast.Attribute)):
            name = node.id if isinstance(node, ast.Name) else node.attr
            if name == "INSTANT_APP_ADMIN_TOKEN":
                pytest.fail(f"{path.name} references the name 'INSTANT_APP_ADMIN_TOKEN'")
