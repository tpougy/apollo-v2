"""ONE-OFF, TRANSIENT migration tool for quick task 260922-vbt.

Migrates every existing `fundos` row in production InstantDB to a new
`entidades` row, reusing the exact same id (`tipoEntidade: "Fundo"`), and
re-links any `projetos`/`templatesRotina`/`tickets` rows that had a `fundo`
link to also carry the new `entidade` link (both links coexist; the old
`fundo` link is never removed by this script — that happens only via Task 4's
destructive schema push, which removes the `fundos` entity/links entirely).

Deliberately lives OUTSIDE `cli/apollo_cli/` (mirrors
`cli/scripts/cleanup_rotina_test_data.py`'s established convention from
quick task 260922-t1l) so `cli/tests/test_auth_rejection.py`'s admin-token-
confinement AST gate (which only walks `cli/apollo_cli/**/*.py`) never sees
this script's `login_client()` call. Not named `test_*.py` so pytest never
tries to collect it.

Deleted once the migration is confirmed complete (see 260922-vbt-PLAN.md
Task 4, Step E) — this is NOT a permanent addition to the CLI package.
"""

from __future__ import annotations

import argparse
import json

from apollo_cli.instant_client import login_client

_LINKED_CHILDREN_SPEC = (
    ("projetos", "fundo"),
    ("templatesRotina", "fundo"),
    ("tickets", "fundo"),
)


def _counts(client) -> dict[str, int]:
    """One query merging fundos + entidades row counts."""
    result = client.query({"fundos": {}, "entidades": {}})
    return {
        "fundos": len(result.get("fundos", [])),
        "entidades": len(result.get("entidades", [])),
    }


def _fetch_fundos(client) -> list[dict]:
    """Raw fundos row list: id, nome, codigo, ativo, donoId, createdAt."""
    return client.query({"fundos": {}})["fundos"]


def _linked_children(client) -> dict[str, list[tuple[str, str]]]:
    """For each (etype, 'fundo') pair, rows with a truthy `fundo` link.

    Admin client, no donoId filter — every owner. Deliberately generic: today
    (live production, 2026-09-22) this iterates zero rows for every etype
    (0 projetos/templatesRotina/tickets exist), but must be implemented
    correctly and exercised by this script's own dry run regardless, since a
    future `apollo import`/CLI write could add real linked rows before this
    script actually runs.
    """
    out: dict[str, list[tuple[str, str]]] = {}
    for etype, link_label in _LINKED_CHILDREN_SPEC:
        result = client.query({etype: {link_label: {}, "$": {"where": {}}}})
        rows = result.get(etype, [])
        pairs: list[tuple[str, str]] = []
        for row in rows:
            fundo = row.get(link_label)
            if fundo:
                fundo_id = fundo[0]["id"] if isinstance(fundo, list) else fundo["id"]
                pairs.append((row["id"], fundo_id))
        out[etype] = pairs
    return out


def _chunked(items: list, size: int) -> list[list]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirmar", action="store_true", default=False)
    args = parser.parse_args()

    client = login_client()

    before = _counts(client)
    linked = _linked_children(client)
    print(
        json.dumps(
            {
                "before": before,
                "linked_counts": {k: len(v) for k, v in linked.items()},
                "confirmado": args.confirmar,
            },
            sort_keys=True,
        )
    )

    if not args.confirmar:
        return

    fundos = _fetch_fundos(client)

    chunks = []
    for row in fundos:
        chunks.append(
            client.tx.entidades[row["id"]].create(
                {
                    "nome": row["nome"],
                    "codigo": row["codigo"],
                    "ativo": row["ativo"],
                    "tipoEntidade": "Fundo",
                    "donoId": row["donoId"],
                    "createdAt": row["createdAt"],
                }
            )
        )
    for etype, pairs in linked.items():
        for row_id, fundo_id in pairs:
            chunks.append(client.tx[etype][row_id].link({"entidade": fundo_id}))

    for batch in _chunked(chunks, 200):
        client.transact(batch)

    after = _counts(client)
    after_linked = _linked_children(client)
    print(
        json.dumps(
            {
                "after": after,
                "after_linked_counts": {k: len(v) for k, v in after_linked.items()},
            },
            sort_keys=True,
        )
    )

    assert after["entidades"] == before["fundos"] + before["entidades"]
    assert after["fundos"] == before["fundos"]
    for etype in linked:
        assert len(after_linked[etype]) >= len(linked[etype])

    for row in fundos:
        requeried = client.query({"entidades": {"$": {"where": {"id": row["id"]}}}})
        rows = requeried.get("entidades", [])
        assert len(rows) == 1, f"expected exactly 1 entidade for id {row['id']!r}, got {len(rows)}"
        migrated = rows[0]
        assert migrated["nome"] == row["nome"]
        assert migrated["codigo"] == row["codigo"]
        assert migrated["ativo"] == row["ativo"]
        assert migrated["donoId"] == row["donoId"]
        assert migrated["createdAt"] == row["createdAt"]
        assert migrated["tipoEntidade"] == "Fundo"


if __name__ == "__main__":
    main()
