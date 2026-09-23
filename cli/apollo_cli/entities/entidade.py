"""`apollo entidade criar|editar|deletar|listar` — CRUD for the `entidades` entity.

An "entidade" is any typed entity the user administers controladoria work
for (e.g. a "Fundo" investment fund, a "Cliente", an "Area"), discriminated
by the free-text `tipoEntidade` field (no separate types catalog — quick task
260922-vbt, CONTEXT.md D2). Command surface shape is LOCKED (PROJECT.md
C-07); field shape is LOCKED (`shared/instant.schema.ts`, PROJECT.md C-04):
`nome`, `codigo` (indexed), `ativo`, `tipoEntidade`, an owner-id field
(indexed), `createdAt`.

The owner-id field is never referenced by its schema name in this module —
grep-verified to be absent here — because it is injected exclusively by
`crud_helpers.create_entity` from the authenticated session, never from a
CLI flag or a local literal.
"""

from __future__ import annotations

import click

from apollo_cli.crud_helpers import (
    create_entity,
    delete_entity,
    drop_none,
    emit,
    list_entities,
    now_iso,
    update_entity,
)

_ETYPE = "entidades"


@click.group(name="entidade")
def group() -> None:
    """Manage `entidades` (typed entities this user administers controladoria
    for, e.g. Fundo/Cliente/Area, discriminated by `--tipo-entidade`)."""


@group.command()
@click.option("--nome", required=True, help="Display name of the entidade.")
@click.option("--codigo", required=True, help="Short unique-ish code for the entidade.")
@click.option(
    "--tipo-entidade",
    required=True,
    help="Tipo/categoria da entidade (texto livre, ex.: Fundo, Cliente, Area) — sem catalogo separado.",
)
@click.option(
    "--ativo/--inativo",
    default=True,
    help="Whether the entidade is currently active. Defaults to --ativo.",
)
def criar(nome: str, codigo: str, tipo_entidade: str, ativo: bool) -> None:
    """Create an entidade. The owner and creation timestamp are set
    automatically from the authenticated session and the current time — they
    cannot be supplied as flags."""
    eid = create_entity(
        etype=_ETYPE,
        fields={
            "nome": nome,
            "codigo": codigo,
            "tipoEntidade": tipo_entidade,
            "ativo": ativo,
            "createdAt": now_iso(),
        },
    )
    emit({"id": eid})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the entidade to update.")
@click.option("--nome", default=None, help="New display name.")
@click.option("--codigo", default=None, help="New code.")
@click.option(
    "--tipo-entidade",
    default=None,
    help="Tipo/categoria da entidade (texto livre, ex.: Fundo, Cliente, Area). Omit to leave unchanged.",
)
@click.option(
    "--ativo/--inativo",
    default=None,
    help="New active/inactive state. Omit to leave unchanged.",
)
def editar(
    eid: str, nome: str | None, codigo: str | None, tipo_entidade: str | None, ativo: bool | None
) -> None:
    """Update an entidade. Ownership is immutable and never accepted here."""
    update_entity(
        etype=_ETYPE,
        eid=eid,
        fields=drop_none(
            {"nome": nome, "codigo": codigo, "tipoEntidade": tipo_entidade, "ativo": ativo}
        ),
    )
    emit({"id": eid, "updated": True})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the entidade to delete.")
def deletar(eid: str) -> None:
    """Delete an entidade permanently. This cannot be undone."""
    delete_entity(etype=_ETYPE, eid=eid)
    emit({"id": eid, "deleted": True})


@group.command()
@click.option("--limit", type=int, default=None, help="Maximum number of records to return.")
@click.option("--codigo", default=None, help="Filter by exact `codigo` match.")
def listar(limit: int | None, codigo: str | None) -> None:
    """List entidades visible to the authenticated session."""
    where = drop_none({"codigo": codigo})
    records = list_entities(etype=_ETYPE, where=where, limit=limit)
    emit(records)
