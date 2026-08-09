"""`apollo subtarefa criar|editar|deletar|listar` — CRUD for `subtarefas`.

A "subtarefa" is a checklist item belonging to exactly one `tarefa` or one
`ticket` — never both, never neither. It is a first-class linked entity
(PROJECT.md C-04), not an embedded field on its parent, so it stays queryable
and does not silently disappear from either parent's checklist view.

Command surface shape is LOCKED (PROJECT.md C-07); field shape is LOCKED
(`shared/instant.schema.ts`, PROJECT.md C-04): `titulo`, `concluida`,
`ordem`, an owner-id field (indexed).

The owner-id field is never referenced by its schema name in this module —
grep-verified to be absent here — because it is injected exclusively by
`crud_helpers.create_entity`/`update_entity` from the authenticated session,
never from a CLI flag or a local literal.

`--tarefa-id`/`--ticket-id` are exclusive-or: `criar` requires exactly one,
`editar` allows at most one (0 or 1, to leave the existing parent untouched).
Whichever id is supplied is validated with `get_entity` before any write —
InstantDB does not check link targets exist, so an unchecked link would
happily write a dangling reference.
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

_ETYPE = "subtarefas"
_TAREFA_ETYPE = "tarefas"
_TICKET_ETYPE = "tickets"


def _resolve_parent(
    tarefa_id: str | None, ticket_id: str | None, *, required: bool
) -> dict[str, str]:
    """Validate and resolve the XOR parent link payload.

    On `criar` (`required=True`) exactly one of `tarefa_id`/`ticket_id` must
    be given. On `editar` (`required=False`) zero or one may be given — zero
    means "leave the existing parent link untouched".

    Raises `click.UsageError` before any network call when the count is
    wrong. Exits with `parent_not_found` (via `SystemExit`) when the chosen
    id does not resolve against the real table.
    """
    given = [value for value in (tarefa_id, ticket_id) if value is not None]
    if required and len(given) != 1:
        msg = "informe exatamente um de --tarefa-id ou --ticket-id"
        raise click.UsageError(msg)
    if not required and len(given) > 1:
        msg = "informe no máximo um de --tarefa-id ou --ticket-id"
        raise click.UsageError(msg)

    if tarefa_id is not None:
        if get_entity(etype=_TAREFA_ETYPE, eid=tarefa_id) is None:
            click.echo(
                json.dumps(
                    {"error": "parent_not_found", "etype": _TAREFA_ETYPE, "id": tarefa_id},
                    sort_keys=True,
                ),
                err=True,
            )
            raise SystemExit(EXIT_API_ERROR)
        return {"tarefa": tarefa_id}

    if ticket_id is not None:
        if get_entity(etype=_TICKET_ETYPE, eid=ticket_id) is None:
            click.echo(
                json.dumps(
                    {"error": "parent_not_found", "etype": _TICKET_ETYPE, "id": ticket_id},
                    sort_keys=True,
                ),
                err=True,
            )
            raise SystemExit(EXIT_API_ERROR)
        return {"ticket": ticket_id}

    return {}


@click.group(name="subtarefa")
def group() -> None:
    """Manage `subtarefas` (checklist items belonging to exactly one `tarefa`
    or one `ticket` — a first-class linked record, not an embedded field;
    see PROJECT.md C-04)."""


@group.command()
@click.option("--titulo", required=True, help="Title of the subtarefa.")
@click.option("--ordem", type=int, required=True, help="Ordering position (integer).")
@click.option(
    "--concluida/--nao-concluida",
    default=False,
    help="Whether the subtarefa is already complete. Defaults to --nao-concluida.",
)
@click.option(
    "--tarefa-id",
    default=None,
    help="Id of the `tarefa` this subtarefa belongs to. Exactly one of --tarefa-id/--ticket-id is required.",
)
@click.option(
    "--ticket-id",
    default=None,
    help="Id of the `ticket` this subtarefa belongs to. Exactly one of --tarefa-id/--ticket-id is required.",
)
def criar(
    titulo: str,
    ordem: int,
    concluida: bool,
    tarefa_id: str | None,
    ticket_id: str | None,
) -> None:
    """Create a subtarefa attached to exactly one tarefa or ticket. The owner
    comes from the authenticated session — it cannot be supplied as a flag."""
    links = _resolve_parent(tarefa_id, ticket_id, required=True)
    eid = create_entity(
        etype=_ETYPE,
        fields={
            "titulo": titulo,
            "ordem": ordem,
            "concluida": concluida,
        },
        links=links,
    )
    emit({"id": eid})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the subtarefa to update.")
@click.option("--titulo", default=None, help="New title.")
@click.option("--ordem", type=int, default=None, help="New ordering position.")
@click.option(
    "--concluida/--nao-concluida",
    default=None,
    help="New completion state. Omit to leave unchanged (default is None, not False).",
)
@click.option(
    "--tarefa-id",
    default=None,
    help="New id of the `tarefa` to re-parent this subtarefa to. At most one of --tarefa-id/--ticket-id.",
)
@click.option(
    "--ticket-id",
    default=None,
    help="New id of the `ticket` to re-parent this subtarefa to. At most one of --tarefa-id/--ticket-id.",
)
def editar(
    eid: str,
    titulo: str | None,
    ordem: int | None,
    concluida: bool | None,
    tarefa_id: str | None,
    ticket_id: str | None,
) -> None:
    """Update a subtarefa. Ownership is immutable and never accepted here."""
    links = _resolve_parent(tarefa_id, ticket_id, required=False)
    update_entity(
        etype=_ETYPE,
        eid=eid,
        fields=drop_none(
            {
                "titulo": titulo,
                "ordem": ordem,
                "concluida": concluida,
            }
        ),
        links=links or None,
    )
    emit({"id": eid, "updated": True})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the subtarefa to delete.")
def deletar(eid: str) -> None:
    """Delete a subtarefa permanently. This cannot be undone."""
    delete_entity(etype=_ETYPE, eid=eid)
    emit({"id": eid, "deleted": True})


@group.command()
@click.option("--tarefa-id", default=None, help="Filter to subtarefas of exactly this tarefa.")
@click.option("--ticket-id", default=None, help="Filter to subtarefas of exactly this ticket.")
@click.option("--limit", type=int, default=None, help="Maximum number of records to return.")
def listar(tarefa_id: str | None, ticket_id: str | None, limit: int | None) -> None:
    """List subtarefas visible to the authenticated session."""
    where = drop_none({"tarefa.id": tarefa_id, "ticket.id": ticket_id})
    records = list_entities(etype=_ETYPE, where=where, limit=limit)
    emit(records)
