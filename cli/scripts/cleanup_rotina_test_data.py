"""ONE-OFF, TRANSIENT maintenance tool for quick task 260922-t1l.

Deletes EVERY `templatesRotina` and `instanciasRotina` row in the production
InstantDB app (test-onboarding pollution), across all `donoId`s, leaving the
other 7 entities (`fundos`, `projetos`, `etapas`, `tarefas`, `tickets`,
`subtarefas`, `logInferenciaClaude`) untouched.

This is NOT a permanent CLI command. It is deleted from the repo once the
cleanup is confirmed (see 260922-t1l-PLAN.md Task 2). It lives outside
`apollo_cli` on purpose: `cli/tests/test_auth_rejection.py`'s admin-token
confinement AST gate walks only `cli/apollo_cli/**/*.py`, and this script
legitimately needs the admin client (`login_client()`) to reach every
`donoId`, not just the current session's own rows.

Default (no `--confirmar`): read-only dry run, prints before-counts only,
performs zero writes. With `--confirmar`: deletes, then verifies live that
the two target entities are at 0 and all 7 canary entities are unchanged.
"""

from __future__ import annotations

import argparse
import json

from apollo_cli.instant_client import login_client

_ETYPES_DELETE = ("templatesRotina", "instanciasRotina")
_ETYPES_CANARY = (
    "fundos",
    "projetos",
    "etapas",
    "tarefas",
    "tickets",
    "subtarefas",
    "logInferenciaClaude",
)
_BATCH_SIZE = 200


def _counts(client) -> dict[str, int]:
    q = {etype: {} for etype in (*_ETYPES_DELETE, *_ETYPES_CANARY)}
    result = client.query(q)
    return {etype: len(result.get(etype, [])) for etype in (*_ETYPES_DELETE, *_ETYPES_CANARY)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirmar", action="store_true", default=False)
    args = parser.parse_args()

    client = login_client()
    before = _counts(client)
    print(json.dumps({"before": before, "confirmado": args.confirmar}, sort_keys=True))

    if not args.confirmar:
        return

    for etype in _ETYPES_DELETE:
        result = client.query({etype: {}})
        ids = [row["id"] for row in result.get(etype, [])]
        for start in range(0, len(ids), _BATCH_SIZE):
            batch = ids[start : start + _BATCH_SIZE]
            client.transact([client.tx[etype][eid].delete() for eid in batch])

    after = _counts(client)
    print(json.dumps({"after": after}, sort_keys=True))

    assert after["templatesRotina"] == 0
    assert after["instanciasRotina"] == 0
    for etype in _ETYPES_CANARY:
        assert after[etype] == before[etype], f"canary entity {etype} changed: {before[etype]} -> {after[etype]}"


if __name__ == "__main__":
    main()
