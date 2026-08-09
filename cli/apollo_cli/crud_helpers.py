"""Shared CRUD plumbing consumed by every `entities/*.py` module.

Owns: `donoId` injection (never a caller-supplied value), the not-found guard
against InstantDB's silent-upsert-on-`update` behavior, error -> exit-code
mapping, and the single-JSON-document-per-command output contract. See
`.planning/phases/03-cli-auth-crud/03-02-PLAN.md` <interfaces> — these
signatures are LOCKED for plans 03-03..03-05, do not rename.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime
from typing import Any, Final

import click
import httpx
from instantdb import Instant, InstantAPIError
from instantdb import id as new_id

from apollo_cli.instant_client import session_client
from apollo_cli.session import CorruptSessionError, MissingSessionError, Session, load_session

# Re-exported verbatim from auth.py's definitions (see plan <interfaces>).
EXIT_NO_SESSION: Final[int] = 1
EXIT_API_ERROR: Final[int] = 3
EXIT_NETWORK_ERROR: Final[int] = 4

_ISO_DATE_RE: Final[re.Pattern[str]] = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def emit(payload: object) -> None:
    """Emit exactly one JSON document to stdout.

    `sort_keys=True` keeps output byte-stable across runs/tests.
    """
    click.echo(json.dumps(payload, sort_keys=True))


def _emit_err(payload: object) -> None:
    click.echo(json.dumps(payload, sort_keys=True), err=True)


def drop_none(fields: dict[str, Any]) -> dict[str, Any]:
    """Return `fields` with every `None`-valued key removed.

    Lets `criar`/`editar` commands pass every click option through unchanged —
    unset optional flags default to `None` and must not become a payload key
    (InstantDB would happily write a literal null onto the record).
    """
    return {key: value for key, value in fields.items() if value is not None}


def now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(UTC).isoformat()


def validate_iso_date(ctx: click.Context, param: click.Parameter, value: str | None) -> str | None:
    """Click callback: enforce `YYYY-MM-DD` and reject invalid calendar dates."""
    if value is None:
        return None
    if not _ISO_DATE_RE.match(value):
        msg = f"{value!r} is not an ISO date (expected YYYY-MM-DD)"
        raise click.BadParameter(msg, ctx=ctx, param=param)
    try:
        date.fromisoformat(value)
    except ValueError as error:
        msg = f"{value!r} is not a valid calendar date"
        raise click.BadParameter(msg, ctx=ctx, param=param) from error
    return value


def require_session() -> Session:
    """Load the persisted session or exit with a JSON error.

    `MissingSessionError` -> `{"error": "no_session", ...}`, exit 1.
    `CorruptSessionError` -> `{"error": "corrupt_session", ...}`, exit 1.
    """
    try:
        return load_session()
    except MissingSessionError:
        _emit_err(
            {
                "error": "no_session",
                "hint": "run: apollo auth login --email <seu-email>",
            }
        )
        raise SystemExit(EXIT_NO_SESSION) from None
    except CorruptSessionError as error:
        _emit_err(
            {
                "error": "corrupt_session",
                "message": str(error),
                "hint": "run: apollo auth login --email <seu-email>",
            }
        )
        raise SystemExit(EXIT_NO_SESSION) from None


def client_for_session() -> tuple[Instant, Session]:
    """`require_session()` + `session_client()` in one call."""
    session = require_session()
    return session_client(session), session


@contextmanager
def instant_errors() -> Iterator[None]:
    """Map InstantDB/network errors to a JSON stderr document + `SystemExit`.

    No retry logic anywhere in this module or its callers: these entities have
    no dedupe key (unlike `instanciasRotina`'s `dedupeKey`), so a hidden retry
    on a timeout that actually succeeded server-side would silently duplicate
    a record — corrupted data that looks like normal data. Errors surface raw
    and the caller (human or Claude) decides whether to retry.
    """
    try:
        yield
    except InstantAPIError as error:
        body = error.body if isinstance(error.body, dict) else {}
        _emit_err(
            {
                "error": "api_error",
                "status": error.status,
                "type": body.get("type"),
                "message": body.get("message"),
                "trace_id": error.trace_id,
            }
        )
        raise SystemExit(EXIT_API_ERROR) from error
    except httpx.HTTPError as error:
        _emit_err({"error": "network", "detail": str(error)})
        raise SystemExit(EXIT_NETWORK_ERROR) from error


def get_entity(*, etype: str, eid: str) -> dict[str, Any] | None:
    """Fetch a single record by id, or `None` when it does not exist."""
    client, _ = client_for_session()
    with instant_errors():
        result = client.query({etype: {"$": {"where": {"id": eid}}}})
    rows = result.get(etype, [])
    return rows[0] if rows else None


def list_entities(
    *,
    etype: str,
    where: dict[str, Any] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """List records of `etype`, perms-filtered server-side by `donoId`."""
    client, _ = client_for_session()
    query_opts: dict[str, Any] = {"where": where or {}}
    if limit is not None:
        query_opts["limit"] = limit
    with instant_errors():
        result = client.query({etype: {"$": query_opts}})
    return result.get(etype, [])


def create_entity(
    *,
    etype: str,
    fields: dict[str, Any],
    links: dict[str, str] | None = None,
) -> str:
    """Create a record, injecting `donoId = session.user_id` last.

    Raises `ValueError` immediately if `fields` already contains a `donoId`
    key — that is a programming error in the caller and must fail loudly at
    development time rather than being silently overwritten.
    """
    if "donoId" in fields:
        msg = "create_entity(): `fields` must never contain 'donoId' — it is injected from the session"
        raise ValueError(msg)

    client, session = client_for_session()
    eid = new_id()
    payload = drop_none(fields) | {"donoId": session.user_id}
    chunk = client.tx[etype][eid].create(payload)
    if links:
        chunk = chunk.link(links)
    with instant_errors():
        client.transact(chunk)
    return eid


def update_entity(
    *,
    etype: str,
    eid: str,
    fields: dict[str, Any],
    links: dict[str, str] | None = None,
) -> None:
    """Update an existing record.

    Calls `get_entity` first: InstantDB's `update` upserts a partial record
    on an unknown id, so a missing record must be reported as `not_found`
    rather than silently creating a phantom row. Never includes `donoId`.
    """
    if "donoId" in fields:
        msg = "update_entity(): `fields` must never contain 'donoId' — ownership is immutable"
        raise ValueError(msg)

    if get_entity(etype=etype, eid=eid) is None:
        _emit_err({"error": "not_found", "etype": etype, "id": eid})
        raise SystemExit(EXIT_API_ERROR)

    client, _ = client_for_session()
    chunk = client.tx[etype][eid].update(drop_none(fields))
    if links:
        chunk = chunk.link(links)
    with instant_errors():
        client.transact(chunk)


def delete_entity(*, etype: str, eid: str) -> None:
    """Delete an existing record, guarded by the same not-found check."""
    if get_entity(etype=etype, eid=eid) is None:
        _emit_err({"error": "not_found", "etype": etype, "id": eid})
        raise SystemExit(EXIT_API_ERROR)

    client, _ = client_for_session()
    with instant_errors():
        client.transact(client.tx[etype][eid].delete())
