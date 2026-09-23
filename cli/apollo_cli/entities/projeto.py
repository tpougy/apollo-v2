"""`apollo projeto criar|editar|deletar|listar` — CRUD for the `projetos` entity.

A "projeto" is a structured, non-recurring work container the user manages
independently of the recurring-routine machinery, optionally owned by an
`entidade`. Command surface shape is LOCKED (PROJECT.md C-07); field shape is
LOCKED (`shared/instant.schema.ts`, PROJECT.md C-04): `nome`, `descricao`
(optional), `status` (indexed), `dataInicioPrevista` (optional),
`dataFimPrevista` (optional), an owner-id field (indexed).

The owner-id field is never referenced by its schema name in this module —
grep-verified to be absent here — because it is injected exclusively by
`crud_helpers.create_entity`/`update_entity` from the authenticated session,
never from a CLI flag or a local literal.

`--entidade-id`, when supplied, links the projeto to that entidade via the
`entidadeProjetos` link (forward label `entidade`, on `projetos`). The parent
id is validated with `get_entity` before any write — InstantDB does not check
link targets exist, so an unchecked link would happily write a dangling
reference.
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
    validate_iso_date,
)

_ETYPE = "projetos"
_PARENT_ETYPE = "entidades"


def _resolve_entidade_link(entidade_id: str | None) -> dict[str, str] | None:
    """Validate `--entidade-id` against the real `entidades` table before linking.

    Exits with `parent_not_found` (not a raw `None` link) when the id does
    not resolve — a dangling link to a nonexistent entidade would otherwise
    look like a normal projeto until someone tries to read the link back.
    """
    if entidade_id is None:
        return None
    if get_entity(etype=_PARENT_ETYPE, eid=entidade_id) is None:
        click.echo(
            json.dumps(
                {"error": "parent_not_found", "etype": _PARENT_ETYPE, "id": entidade_id},
                sort_keys=True,
            ),
            err=True,
        )
        raise SystemExit(EXIT_API_ERROR)
    return {"entidade": entidade_id}


@click.group(name="projeto")
def group() -> None:
    """Manage `projetos` (structured, non-recurring work items), optionally
    linked to an `entidade`."""


@group.command()
@click.option("--nome", required=True, help="Display name of the projeto.")
@click.option("--status", required=True, help="Current status of the projeto (free-form).")
@click.option("--descricao", default=None, help="Optional free-form description.")
@click.option(
    "--data-inicio-prevista",
    default=None,
    callback=validate_iso_date,
    help="Optional expected start date (YYYY-MM-DD).",
)
@click.option(
    "--data-fim-prevista",
    default=None,
    callback=validate_iso_date,
    help="Optional expected end date (YYYY-MM-DD).",
)
@click.option(
    "--entidade-id",
    default=None,
    help="Optional id of an `entidade` to link this projeto to. Must already exist.",
)
def criar(
    nome: str,
    status: str,
    descricao: str | None,
    data_inicio_prevista: str | None,
    data_fim_prevista: str | None,
    entidade_id: str | None,
) -> None:
    """Create a projeto. The owner comes from the authenticated session — it
    cannot be supplied as a flag."""
    links = _resolve_entidade_link(entidade_id)
    eid = create_entity(
        etype=_ETYPE,
        fields={
            "nome": nome,
            "status": status,
            "descricao": descricao,
            "dataInicioPrevista": data_inicio_prevista,
            "dataFimPrevista": data_fim_prevista,
        },
        links=links,
    )
    emit({"id": eid})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the projeto to update.")
@click.option("--nome", default=None, help="New display name.")
@click.option("--descricao", default=None, help="New description.")
@click.option("--status", default=None, help="New status.")
@click.option(
    "--data-inicio-prevista",
    default=None,
    callback=validate_iso_date,
    help="New expected start date (YYYY-MM-DD).",
)
@click.option(
    "--data-fim-prevista",
    default=None,
    callback=validate_iso_date,
    help="New expected end date (YYYY-MM-DD).",
)
@click.option(
    "--entidade-id",
    default=None,
    help="New id of an `entidade` to link this projeto to. Must already exist.",
)
def editar(
    eid: str,
    nome: str | None,
    descricao: str | None,
    status: str | None,
    data_inicio_prevista: str | None,
    data_fim_prevista: str | None,
    entidade_id: str | None,
) -> None:
    """Update a projeto. Ownership is immutable and never accepted here."""
    links = _resolve_entidade_link(entidade_id)
    update_entity(
        etype=_ETYPE,
        eid=eid,
        fields=drop_none(
            {
                "nome": nome,
                "descricao": descricao,
                "status": status,
                "dataInicioPrevista": data_inicio_prevista,
                "dataFimPrevista": data_fim_prevista,
            }
        ),
        links=links,
    )
    emit({"id": eid, "updated": True})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the projeto to delete.")
def deletar(eid: str) -> None:
    """Delete a projeto permanently. This cannot be undone."""
    delete_entity(etype=_ETYPE, eid=eid)
    emit({"id": eid, "deleted": True})


@group.command()
@click.option("--status", default=None, help="Filter by exact `status` match.")
@click.option("--limit", type=int, default=None, help="Maximum number of records to return.")
def listar(status: str | None, limit: int | None) -> None:
    """List projetos visible to the authenticated session."""
    where = drop_none({"status": status})
    records = list_entities(etype=_ETYPE, where=where, limit=limit)
    emit(records)
