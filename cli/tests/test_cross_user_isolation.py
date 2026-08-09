"""VERIFY-05 / ASVS V4 — cross-user object-level access control proof.

This module proves `shared/instant.perms.ts`'s `donoRules` deny access
BETWEEN TWO REAL AUTHENTICATED USERS, not merely between an authenticated
user and a guest/fake token. That weaker guest/fake-token boundary is already
covered by Phase 1's `guest-write-check.mjs` and Phase 3's
`cli/tests/test_auth_rejection.py` (tests 1-3). This is qualitatively
different: the second session here is a genuine InstantDB user with a valid,
live refresh token (see `06-01-SECOND-USER-EVIDENCE.md`), so a denial here
can only be explained by the `auth.id == data.donoId` authorization rule —
never by "the request wasn't authenticated at all."

Every assertion that proves denial is a WRITE (create/update/delete), never a
query. `test_auth_rejection.py`'s test 6 documents, as executable
documentation, that InstantDB's `view` rule silently filters disallowed rows
out of query results: an empty `listar` returns HTTP 200 with `[]` whether or
not perms are enforced, and whether or not any matching row exists. A
VERIFY-05 assertion of the form "the second user's `apollo fundo listar`
shows nothing" would therefore be worthless. Only
`pytest.raises(InstantAPIError)` with `body["type"] == "permission-denied"`
on a create/update/delete attempt is valid evidence here. The requirement's
word "view" is satisfied because the same `donoRules` `view` expression is
exactly the one the `update`/`delete` rules reuse, and this module's
update/delete denials prove that expression evaluates to `false` for the
second user against tp@'s row — i.e. the row is genuinely unreachable, not
merely hidden by a query-time filter with weaker enforcement underneath.

This file is a deliberate, documented exception to
`cli/apollo_cli/instant_client.py`'s "`login_client()` is legal to call ONLY
from `apollo_cli.auth.login`" convention, scoped to Task 3's guarded
`delete_user` teardown only. `test_auth_rejection.py::test_admin_token_confinement`'s
AST-walk gate does not scan this exception in: `_package_python_files()`
globs `cli/apollo_cli/**/*.py` only (verified by reading that function), so
files under `cli/tests/` — including this one — are structurally out of that
gate's scope. No exemption-list edit is required; this docstring records that
verification rather than assuming it.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from instantdb import Instant, InstantAPIError
from instantdb import id as new_id

from apollo_cli.config import find_repo_root
from apollo_cli.crud_helpers import now_iso
from apollo_cli.instant_client import login_client, session_client
from apollo_cli.session import Session, load_session
from tests.conftest import unique_suffix

# NOTE: unlike `test_auth_rejection.py`, this module does NOT use a
# module-level `pytestmark = pytest.mark.live` — one test (the allowlist
# guard, test 05) must run offline under `-m "not live"` to prove the guard
# itself is tested. Every other test is marked `@pytest.mark.live`
# individually below.

_SECOND_SESSION_ENV_VAR = "APOLLO_SECOND_SESSION_FILE"
_BOOTSTRAP_HINT = (
    "No usable second-user session found. Bootstrap one with (from the repo root):\n"
    '  APOLLO_SESSION_FILE="$PWD/cli/.auth/second-user-session" '
    "uv run --project cli apollo auth login --email <admin@rbrasset.com.br|rm@rbrasset.com.br>\n"
    '  APOLLO_SESSION_FILE="$PWD/cli/.auth/second-user-session" '
    "uv run --project cli apollo auth login --email <same-email> --code <codigo-do-email>\n"
    "See .planning/phases/06-end-to-end-verification/06-01-SECOND-USER-EVIDENCE.md."
)


def _default_second_session_path() -> Path:
    return find_repo_root() / "cli" / ".auth" / "second-user-session"


def _permission_denied_type(error: InstantAPIError) -> str | None:
    body = error.body if isinstance(error.body, dict) else {}
    return body.get("type")


def _load_second_session(path: Path) -> Session:
    """Load a `Session` from `path` without ever touching the primary session.

    Never `pytest.skip`s — a missing/corrupt second-user session must fail
    the gate loudly (T-06-06: a "silently green" skip is the exact failure
    mode this phase exists to prevent).
    """
    if not path.is_file():
        pytest.fail(f"Second-user session file not found at {path}.\n{_BOOTSTRAP_HINT}")

    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        pytest.fail(
            f"Second-user session file at {path} is unreadable/corrupt: {error}\n{_BOOTSTRAP_HINT}"
        )

    if not isinstance(data, dict):
        pytest.fail(f"Second-user session file at {path} is not a JSON object.\n{_BOOTSTRAP_HINT}")

    for key in ("user_id", "email", "refresh_token"):
        value = data.get(key)
        if not isinstance(value, str) or not value:
            pytest.fail(
                f"Second-user session file at {path} is missing required field {key!r}.\n{_BOOTSTRAP_HINT}"
            )

    return Session(
        user_id=data["user_id"],
        email=data["email"],
        refresh_token=data["refresh_token"],
    )


@pytest.fixture(scope="session")
def second_session() -> Session:
    """The second real user's session, loaded from an isolated path.

    Resolves from `APOLLO_SECOND_SESSION_FILE`, defaulting to
    `cli/.auth/second-user-session`. The primary `~/.config/apollo-cli/session`
    is never opened by this fixture.
    """
    override = os.environ.get(_SECOND_SESSION_ENV_VAR)
    path = Path(override) if override else _default_second_session_path()
    return _load_second_session(path)


@pytest.fixture
def second_client(second_session: Session) -> Instant:
    """A real `session_client()` impersonating the second real user."""
    return session_client(second_session)


@pytest.fixture
def tp_owned_fundo(
    live_client: Instant,
    live_session: Session,
    cleanup_records: list[tuple[str, str]],
) -> Iterator[tuple[str, str]]:
    """A fresh `fundos` record owned by tp@, dedicated to this module.

    Created and cleaned up via tp@'s own `live_client`/`cleanup_records` — per
    RESEARCH Open Question 1's "own your fixtures" recommendation, this test
    never targets a record another phase's leftover sweep depends on.
    """
    nome = f"phase06-verify05-{unique_suffix()}"
    fundo_id = new_id()
    live_client.transact(
        live_client.tx.fundos[fundo_id].create(
            {
                "nome": nome,
                "codigo": "V05",
                "ativo": True,
                "createdAt": now_iso(),
                "donoId": live_session.user_id,
            }
        )
    )
    cleanup_records.append(("fundos", fundo_id))
    yield fundo_id, nome


# --- 0. Guard: the two sessions are genuinely different users --------------


@pytest.mark.live
def test_00_second_user_is_a_different_real_user_than_tp(
    second_session: Session,
    live_session: Session,
) -> None:
    # Runs first by name ordering (pytest collects/executes in file order by
    # default; "00" pins it ahead of every other test in this module). A
    # same-user session would make every later assertion vacuously "pass" for
    # the wrong reason.
    assert second_session.user_id != live_session.user_id
    assert second_session.email != live_session.email


# --- 1. Create-as-tp@ is denied ---------------------------------------------


@pytest.mark.live
def test_01_second_user_cannot_create_a_record_owned_by_tp(
    second_client: Instant,
    live_client: Instant,
    live_session: Session,
) -> None:
    nome = f"phase06-verify05-{unique_suffix()}"
    fundo_id = new_id()

    with pytest.raises(InstantAPIError) as exc_info:
        second_client.transact(
            second_client.tx.fundos[fundo_id].create(
                {
                    "nome": nome,
                    "codigo": "V05-CREATE",
                    "ativo": True,
                    "createdAt": now_iso(),
                    "donoId": live_session.user_id,
                }
            )
        )

    assert _permission_denied_type(exc_info.value) == "permission-denied"

    result = live_client.query({"fundos": {"$": {"where": {"nome": nome}}}})
    assert result.get("fundos", []) == []


# --- 2. Update of tp@'s row is denied ---------------------------------------


@pytest.mark.live
def test_02_second_user_cannot_update_tps_record(
    second_client: Instant,
    live_client: Instant,
    tp_owned_fundo: tuple[str, str],
) -> None:
    fundo_id, original_nome = tp_owned_fundo

    with pytest.raises(InstantAPIError) as exc_info:
        second_client.transact(second_client.tx.fundos[fundo_id].update({"nome": "hijacked"}))

    assert _permission_denied_type(exc_info.value) == "permission-denied"

    result = live_client.query({"fundos": {"$": {"where": {"id": fundo_id}}}})
    rows = result.get("fundos", [])
    assert len(rows) == 1
    assert rows[0]["nome"] == original_nome


# --- 3. Delete of tp@'s row is denied ---------------------------------------


@pytest.mark.live
def test_03_second_user_cannot_delete_tps_record(
    second_client: Instant,
    live_client: Instant,
    tp_owned_fundo: tuple[str, str],
) -> None:
    fundo_id, _original_nome = tp_owned_fundo

    with pytest.raises(InstantAPIError) as exc_info:
        second_client.transact(second_client.tx.fundos[fundo_id].delete())

    assert _permission_denied_type(exc_info.value) == "permission-denied"

    result = live_client.query({"fundos": {"$": {"where": {"id": fundo_id}}}})
    assert len(result.get("fundos", [])) == 1


# --- 4. Positive control: second user's OWN create succeeds ----------------


@pytest.mark.live
def test_04_second_user_can_create_its_own_record_positive_control(
    second_client: Instant,
    second_session: Session,
) -> None:
    """Proves the session is genuinely authenticated.

    Without this control, tests 1-3's denials could (in principle) be masked
    authentication failures rather than authorization failures. This test
    creates a record with the second user's OWN `donoId`, asserts success,
    then deletes it itself in a `finally` — it must NOT be registered on
    `cleanup_records`, since that fixture uses tp@'s client, which the very
    rules under test forbid from deleting a second-user-owned record.
    """
    nome = f"phase06-verify05-{unique_suffix()}"
    fundo_id = new_id()

    try:
        second_client.transact(
            second_client.tx.fundos[fundo_id].create(
                {
                    "nome": nome,
                    "codigo": "V05-OWN",
                    "ativo": True,
                    "createdAt": now_iso(),
                    "donoId": second_session.user_id,
                }
            )
        )
        result = second_client.query({"fundos": {"$": {"where": {"id": fundo_id}}}})
        rows = result.get("fundos", [])
        assert len(rows) == 1
        assert rows[0]["nome"] == nome
    finally:
        second_client.transact(second_client.tx.fundos[fundo_id].delete())


# --- 5. Guarded second-user teardown (opt-in) -------------------------------

_DELETE_SECOND_USER_ENV_VAR = "APOLLO_VERIFY05_DELETE_SECOND_USER"
_ALLOWED_SECOND_USER_EMAILS = frozenset({"admin@rbrasset.com.br", "rm@rbrasset.com.br"})


def _assert_allowlisted(email: str) -> None:
    """Guard 1: the email must be one of the two allowlisted addresses.

    Split out so it can be exercised offline (`-m "not live"`) against both a
    good and a bad address without needing any network access or a real
    session.
    """
    if email not in _ALLOWED_SECOND_USER_EMAILS:
        msg = (
            f"Refusing to delete {email!r}: not in the VERIFY-05 second-user "
            f"allowlist {sorted(_ALLOWED_SECOND_USER_EMAILS)}."
        )
        raise ValueError(msg)


def test_05_teardown_allowlist_guard_rejects_tp_offline() -> None:
    """Guard 1 is itself tested, offline, so it is not merely written.

    Runs under `-m "not live"` — no network, no live session required.
    """
    with pytest.raises(ValueError, match="Refusing to delete"):
        _assert_allowlisted("tp@rbrasset.com.br")

    # Sanity: the allowlisted addresses themselves must NOT raise.
    _assert_allowlisted("admin@rbrasset.com.br")
    _assert_allowlisted("rm@rbrasset.com.br")


@pytest.mark.live
def test_06_zz_guarded_second_user_teardown(
    second_session: Session,
    live_session: Session,
    live_client: Instant,
) -> None:
    """Deletes the second user's `$users` record for real, when opted in.

    Gated on `APOLLO_VERIFY05_DELETE_SECOND_USER=1`. `delete_user` invalidates
    the second user's refresh token, so an unconditional teardown would make
    this gate a one-shot-per-magic-code check and break
    `verify-phase-06.sh`'s re-runnability. Deletion is therefore an explicit
    final-run action, not a silent per-run side effect — this is a scheduling
    decision, not a scope reduction: the deletion IS performed and IS proven
    by this test when opted in.

    Named to sort last within this module (`test_06_zz_...`) so it never runs
    before the create/update/delete/positive-control proofs above, even under
    alphabetical test-ordering plugins.
    """
    if os.environ.get(_DELETE_SECOND_USER_ENV_VAR) != "1":
        pytest.xfail(
            f"Cleanup not requested: set {_DELETE_SECOND_USER_ENV_VAR}=1 to run the real "
            "delete_user teardown. This is an explicit opt-in per plan design, not a bug."
        )

    # Guard 1: email allowlist (tp@ must never be reachable here).
    _assert_allowlisted(second_session.email)

    # Guard 2: identity check — the second session is genuinely not tp@'s.
    assert second_session.user_id != live_session.user_id
    assert second_session.email != live_session.email

    # Guard 4a (inventory, BEFORE): tp@'s fundos count and user_id.
    before_result = live_client.query(
        {"fundos": {"$": {"where": {"donoId": live_session.user_id}}}}
    )
    before_count = len(before_result.get("fundos", []))

    admin = login_client()

    # Guard 3: selector is `id=`, never `email=`, so a mailbox alias or a
    # same-address collision cannot resolve to a different account.
    deleted = admin.auth.delete_user(id=second_session.user_id)
    deleted_id = deleted.get("id") if isinstance(deleted, dict) else None
    assert deleted_id == second_session.user_id

    # Guard 4b (inventory, AFTER): tp@'s fundos count and whoami unchanged.
    after_result = live_client.query({"fundos": {"$": {"where": {"donoId": live_session.user_id}}}})
    after_count = len(after_result.get("fundos", []))
    assert after_count == before_count

    reloaded_tp_session = load_session()
    assert reloaded_tp_session.user_id == live_session.user_id

    # The second user must now be genuinely gone: a further write with the
    # now-invalidated refresh token must fail (a silent no-op delete_user
    # must not read as success).
    dead_client = session_client(second_session)
    with pytest.raises(InstantAPIError):
        dead_client.transact(
            dead_client.tx.fundos[new_id()].create(
                {
                    "nome": "post-delete-probe",
                    "codigo": "V05-DEAD",
                    "ativo": True,
                    "createdAt": now_iso(),
                    "donoId": second_session.user_id,
                }
            )
        )
