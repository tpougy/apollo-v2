"""Shared live-test infrastructure consumed by every CRUD test module.

Provides a real, persisted InstantDB session (skips cleanly when absent), a
`click.testing.CliRunner`-backed `run_cli` fixture, and a `cleanup_records`
fixture that best-effort deletes anything a test creates, so repeated live
runs never accumulate junk in the real app.
"""

from __future__ import annotations

import json
import secrets
from collections.abc import Callable, Iterator
from typing import NamedTuple

import pytest
from click.testing import CliRunner, Result
from instantdb import Instant

from apollo_cli.cli import apollo
from apollo_cli.instant_client import session_client
from apollo_cli.session import MissingSessionError, Session, load_session


@pytest.fixture(scope="session")
def live_session() -> Session:
    """The real, persisted session. Skips the test cleanly when absent."""
    try:
        return load_session()
    except MissingSessionError:
        pytest.skip("no live session; run apollo auth login")
        raise


@pytest.fixture
def live_client(live_session: Session) -> Instant:
    """A real `session_client()` impersonating `live_session`'s user."""
    return session_client(live_session)


class CliInvocation(NamedTuple):
    """A `run_cli` call site's outcome, plus its JSON-parsing helper."""

    result: Result

    def json_out(self) -> object:
        """Parse the captured stdout as JSON, failing loudly on bad output."""
        try:
            return json.loads(self.result.output)
        except json.JSONDecodeError:
            pytest.fail(
                f"stdout did not parse as JSON (exit={self.result.exit_code}): "
                f"{self.result.output!r}"
            )


RunCli = Callable[[list[str]], CliInvocation]


@pytest.fixture
def run_cli() -> RunCli:
    """Invoke the `apollo` click group in-process via `CliRunner`.

    `CliRunner` (not `subprocess`) so failures produce real tracebacks; a
    dedicated `subprocess`-based smoke test still exists in
    `test_crud_fundo.py` to prove the installed console script works.
    """
    runner = CliRunner()

    def _invoke(args: list[str]) -> CliInvocation:
        result = runner.invoke(apollo, args, catch_exceptions=False)
        return CliInvocation(result=result)

    return _invoke


def json_out(result: Result) -> object:
    """Standalone `json.loads` helper for a raw `click.testing.Result`."""
    try:
        return json.loads(result.output)
    except json.JSONDecodeError:
        pytest.fail(f"stdout did not parse as JSON (exit={result.exit_code}): {result.output!r}")


@pytest.fixture
def cleanup_records(live_client: Instant) -> Iterator[list[tuple[str, str]]]:
    """Yields a list tests append `(etype, eid)` tuples to for teardown deletion.

    Teardown swallows every error — an already-deleted record (e.g. the test
    itself deleted it as part of its assertions) must not fail the suite.
    """
    records: list[tuple[str, str]] = []
    yield records
    for etype, eid in records:
        try:
            live_client.transact(live_client.tx[etype][eid].delete())
        except Exception:  # noqa: BLE001, S112 -- best-effort teardown, must never fail the suite
            continue


def unique_suffix() -> str:
    """A short random string so parallel/repeat live runs never collide."""
    return secrets.token_hex(4)
