"""`apollo etapa criar|editar|deletar|listar` — CRUD for the `etapas` entity.

An "etapa" is a sequenced phase within a `projeto`. Command surface shape is
LOCKED (PROJECT.md C-07); field shape is LOCKED (`shared/instant.schema.ts`,
PROJECT.md C-04): `nome`, `ordem` (number — display/sequence order within a
projeto), `status` (indexed), an owner-id field (indexed).

The owner-id field is never referenced by its schema name in this module —
grep-verified to be absent here — because it is injected exclusively by
`crud_helpers.create_entity`/`update_entity` from the authenticated session,
never from a CLI flag or a local literal.

`--projeto-id`, when supplied, links the etapa to that projeto via the
`projetoEtapas` link (forward label `projeto`, on `etapas`). The parent id is
validated with `get_entity` before any write — InstantDB does not check link
targets exist, so an unchecked link would happily write a dangling reference.
"""

from __future__ import annotations

import json

import click

from apollo_cli.crud_helpers import (
    EXIT_API_ERROR,
    create_entity,
    delete_entity,
    drop_none,
    emit,
    get_entity,
    list_entities,
    update_entity,
)

_ETYPE = "etapas"
_PARENT_ETYPE = "projetos"


def _resolve_projeto_link(projeto_id: str | None) -> dict[str, str] | None:
    """Validate `--projeto-id` against the real `projetos` table before linking.

    Exits with `parent_not_found` (not a raw `None` link) when the id does
    not resolve — a dangling link to a nonexistent projeto would otherwise
    look like a normal etapa until someone tries to read the link back.
    """
    if projeto_id is None:
        return None
    if get_entity(etype=_PARENT_ETYPE, eid=projeto_id) is None:
        click.echo(
            json.dumps(
                {"error": "parent_not_found", "etype": _PARENT_ETYPE, "id": projeto_id},
                sort_keys=True,
            ),
            err=True,
        )
        raise SystemExit(EXIT_API_ERROR)
    return {"projeto": projeto_id}


@click.group(name="etapa")
def group() -> None:
    """Manage `etapas` (sequenced phases within a `projeto`)."""


@group.command()
@click.option("--nome", required=True, help="Display name of the etapa.")
@click.option(
    "--ordem",
    type=int,
    required=True,
    help="Display/sequence order of this etapa within its projeto.",
)
@click.option("--status", required=True, help="Current status of the etapa (free-form).")
@click.option(
    "--projeto-id",
    default=None,
    help="Optional id of a `projeto` to link this etapa to. Must already exist.",
)
def criar(nome: str, ordem: int, status: str, projeto_id: str | None) -> None:
    """Create an etapa. The owner comes from the authenticated session — it
    cannot be supplied as a flag."""
    links = _resolve_projeto_link(projeto_id)
    eid = create_entity(
        etype=_ETYPE,
        fields={"nome": nome, "ordem": ordem, "status": status},
        links=links,
    )
    emit({"id": eid})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the etapa to update.")
@click.option("--nome", default=None, help="New display name.")
@click.option("--ordem", type=int, default=None, help="New display/sequence order.")
@click.option("--status", default=None, help="New status.")
@click.option(
    "--projeto-id",
    default=None,
    help="New id of a `projeto` to link this etapa to. Must already exist.",
)
def editar(
    eid: str,
    nome: str | None,
    ordem: int | None,
    status: str | None,
    projeto_id: str | None,
) -> None:
    """Update an etapa. Ownership is immutable and never accepted here."""
    links = _resolve_projeto_link(projeto_id)
    update_entity(
        etype=_ETYPE,
        eid=eid,
        fields=drop_none({"nome": nome, "ordem": ordem, "status": status}),
        links=links,
    )
    emit({"id": eid, "updated": True})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the etapa to delete.")
def deletar(eid: str) -> None:
    """Delete an etapa permanently. This cannot be undone."""
    delete_entity(etype=_ETYPE, eid=eid)
    emit({"id": eid, "deleted": True})


@group.command()
@click.option("--projeto-id", default=None, help="Filter to etapas of exactly this projeto.")
@click.option("--status", default=None, help="Filter by exact `status` match.")
@click.option("--limit", type=int, default=None, help="Maximum number of records to return.")
def listar(projeto_id: str | None, status: str | None, limit: int | None) -> None:
    """List etapas visible to the authenticated session."""
    where = drop_none({"status": status, "projeto.id": projeto_id})
    records = list_entities(etype=_ETYPE, where=where, limit=limit)
    emit(records)
