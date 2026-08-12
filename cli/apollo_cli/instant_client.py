"""The only two sanctioned `Instant` client constructors.

`login_client()` carries the admin bearer token. As of phase 25, no
`apollo_cli` operational command calls it — `apollo_cli.auth.login` now talks
to InstantDB's public, unauthenticated `/runtime/auth/*` endpoints directly
via `httpx`. `login_client()`'s one remaining legitimate caller is
`cli/tests/test_cross_user_isolation.py`'s admin-only `delete_user` teardown,
which has no public-endpoint equivalent; it must stay legal to call ONLY from
test-only, admin-required operations with no public-endpoint equivalent.
Every other operation must go through `session_client()`, which never
carries an admin token, even when `INSTANT_APP_ADMIN_TOKEN` is present in the
process environment. This module is the ONLY place in the package that reads
`INSTANT_APP_ADMIN_TOKEN` (besides `config.py`'s presence-only check) — see
PROJECT.md C-05, phase 03 RESEARCH.md Pattern 1 / Pitfall 1, and phase 25
RESEARCH.md Pitfall 1.
"""

from __future__ import annotations

from dotenv import dotenv_values
from instantdb import Instant

from apollo_cli.config import load_instant_config
from apollo_cli.session import Session

_ADMIN_TOKEN_KEY = "INSTANT_APP_ADMIN_TOKEN"


class AdminTokenMissingError(RuntimeError):
    """Raised when `INSTANT_APP_ADMIN_TOKEN` is absent or blank in the env file."""


def _read_admin_token() -> str:
    """Read the admin token value directly from the resolved env file.

    Never via `load_dotenv`, never via `os.environ` — only `dotenv_values`
    against `config.env_file`, matching `config.py`'s existing convention.
    """
    config = load_instant_config()
    values = dotenv_values(config.env_file)
    token = values.get(_ADMIN_TOKEN_KEY)
    if not token:
        msg = f"{_ADMIN_TOKEN_KEY!r} is missing or blank in {config.env_file}"
        raise AdminTokenMissingError(msg)
    return token


def login_client() -> Instant:
    """Return an admin-token-bearing client.

    Legal to call ONLY from test-only, admin-required operations with no
    public-endpoint equivalent (e.g. `cli/tests/test_cross_user_isolation.py`'s
    `delete_user` teardown) — no `apollo_cli` operational command may call it.
    The returned client bypasses every `instant.perms.ts` rule.
    """
    config = load_instant_config()
    return Instant(app_id=config.app_id, admin_token=_read_admin_token())


def session_client(session: Session) -> Instant:
    """Return a client impersonating `session`'s user, carrying no admin token.

    Passing an empty string for `admin_token` (NOT `None`) is load-bearing:
    the SDK's `Instant.__init__` (`_sync/client.py`) falls back to
    `os.environ["INSTANT_APP_ADMIN_TOKEN"]` only when `admin_token is None`;
    an empty string short-circuits that fallback so this client stays
    admin-token-free even under a hostile environment.
    """
    config = load_instant_config()
    base = Instant(app_id=config.app_id, admin_token="")
    return base.as_user(token=session.refresh_token)
