"""`apollo auth login|logout|whoami` — the CLI's magic-code auth command group.

All output is a single JSON document: success on stdout, errors on stderr.
This CLI is Claude-operated; JSON is the parse target. The refresh token and
the magic code itself are never emitted, logged, or written anywhere but the
0600 session file.
"""

from __future__ import annotations

import json
from typing import Any, Final

import click
import httpx
from instantdb import Instant, InstantAPIError
from instantdb._http_errors import api_error_from_response
from instantdb._sync.http import DEFAULT_API_URI, DEFAULT_TIMEOUT

from apollo_cli.config import load_instant_config
from apollo_cli.session import (
    MissingSessionError,
    Session,
    clear_session,
    load_session,
    save_session,
    session_path,
)

EXIT_NO_SESSION: Final[int] = 1
EXIT_API_ERROR: Final[int] = 3
EXIT_NETWORK_ERROR: Final[int] = 4


def _post_public_auth(path: str, body: dict[str, Any]) -> dict[str, Any] | None:
    """POST to an unauthenticated InstantDB `/runtime/auth/*` endpoint.

    Mirrors `instantdb._sync.http._HTTP._request`'s unauthenticated=True path
    exactly: same base URL, same timeout, same content-type header, same
    response/error translation -- just without going through an `Instant()`
    client instance, since these endpoints need no admin token or session.
    """
    response = httpx.post(
        f"{DEFAULT_API_URI}{path}",
        json=body,
        headers={"content-type": "application/json"},
        timeout=DEFAULT_TIMEOUT,
    )
    if response.is_success:
        return response.json() if response.content else None
    raise api_error_from_response(response)


def _emit(payload: dict[str, Any], *, err: bool = False) -> None:
    click.echo(json.dumps(payload), err=err)


def _emit_api_error(error: InstantAPIError, *, error_type: str) -> None:
    body = error.body if isinstance(error.body, dict) else {}
    _emit(
        {
            "error": error_type,
            "status": error.status,
            "type": body.get("type"),
            "message": body.get("message"),
            "trace_id": error.trace_id,
        },
        err=True,
    )
    raise SystemExit(EXIT_API_ERROR)


def _emit_network_error(error: httpx.HTTPError) -> None:
    _emit({"error": "network_error", "message": str(error)}, err=True)
    raise SystemExit(EXIT_NETWORK_ERROR)


@click.group(name="auth")
def group() -> None:
    """Magic-code authentication: login, logout, whoami."""


@group.command()
@click.option("--email", required=True, help="Email address to authenticate as.")
@click.option(
    "--code",
    default=None,
    help="Magic code from email. Omit to request a new code.",
)
def login(email: str, code: str | None) -> None:
    """Send or verify a magic code, then persist the session on success."""
    try:
        config = load_instant_config()
        if code is None:
            # discard the returned body ({"sent": true} -- no code on this endpoint)
            _post_public_auth(
                "/runtime/auth/send_magic_code",
                {"app-id": config.app_id, "email": email},
            )
            _emit(
                {
                    "status": "code_sent",
                    "email": email,
                    "next": f"apollo auth login --email {email} --code <codigo-do-email>",
                }
            )
            return

        body = _post_public_auth(
            "/runtime/auth/verify_magic_code",
            {"app-id": config.app_id, "email": email, "code": code},
        )
        assert body is not None, "verify_magic_code returned an empty success response"
        user = body["user"]
        created = body["created"]
        save_session(
            Session(
                user_id=user["id"],
                email=user["email"],
                refresh_token=user["refresh_token"],
            )
        )
        _emit(
            {
                "status": "logged_in",
                "user_id": user["id"],
                "email": user["email"],
                "created": created,
                "session_file": str(session_path()),
            }
        )
    except InstantAPIError as error:
        _emit_api_error(error, error_type="auth_failed")
    except httpx.HTTPError as error:
        _emit_network_error(error)


@group.command()
def logout() -> None:
    """Remove the local session file. Idempotent — always exits 0."""
    removed = clear_session()
    _emit({"status": "logged_out", "removed": removed})


@group.command()
def whoami() -> None:
    """Verify the persisted session against the live InstantDB app."""
    try:
        session = load_session()
    except MissingSessionError:
        _emit(
            {
                "error": "no_session",
                "hint": "run: apollo auth login --email <seu-email>",
            },
            err=True,
        )
        raise SystemExit(EXIT_NO_SESSION) from None

    try:
        config = load_instant_config()
        # Unauthenticated endpoint — no admin token, no impersonation header.
        # Do NOT use session_client() or login_client() here.
        client = Instant(app_id=config.app_id, admin_token="")
        user = client.auth.verify_token(session.refresh_token)
        _emit(
            {
                "user_id": user["id"],
                "email": user["email"],
                "session_file": str(session_path()),
            }
        )
    except InstantAPIError as error:
        _emit_api_error(error, error_type="invalid_session")
    except httpx.HTTPError as error:
        _emit_network_error(error)
