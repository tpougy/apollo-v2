"""`apollo tarefa criar|editar|deletar|listar` — CRUD for the `tarefas` entity.

A "tarefa" is a concrete work item within an `etapa`. Command surface shape is
LOCKED (PROJECT.md C-07); field shape is LOCKED (`shared/instant.schema.ts`,
PROJECT.md C-04): `titulo`, `descricao` (optional), `tipoPrazo`,
`dataPrevista` (optional), `dataPrevistaEstimada` (optional), `competencia`
(optional, free-form), `status` (indexed), an owner-id field (indexed).

The owner-id field is never referenced by its schema name in this module —
grep-verified to be absent here — because it is injected exclusively by
`crud_helpers.create_entity`/`update_entity` from the authenticated session,
never from a CLI flag or a local literal.

`--etapa-id`, when supplied, links the tarefa to that etapa via the
`etapaTarefas` link (forward label `etapa`, on `tarefas`). The parent id is
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
    validate_iso_date,
)

_ETYPE = "tarefas"
_PARENT_ETYPE = "etapas"
_TIPO_PRAZO_CHOICES = ("hard", "soft")


def _resolve_etapa_link(etapa_id: str | None) -> dict[str, str] | None:
    """Validate `--etapa-id` against the real `etapas` table before linking.

    Exits with `parent_not_found` (not a raw `None` link) when the id does
    not resolve — a dangling link to a nonexistent etapa would otherwise look
    like a normal tarefa until someone tries to read the link back.
    """
    if etapa_id is None:
        return None
    if get_entity(etype=_PARENT_ETYPE, eid=etapa_id) is None:
        click.echo(
            json.dumps(
                {"error": "parent_not_found", "etype": _PARENT_ETYPE, "id": etapa_id},
                sort_keys=True,
            ),
            err=True,
        )
        raise SystemExit(EXIT_API_ERROR)
    return {"etapa": etapa_id}


@click.group(name="tarefa")
def group() -> None:
    """Manage `tarefas` (concrete work items within an `etapa`)."""


@group.command()
@click.option("--titulo", required=True, help="Title of the tarefa.")
@click.option(
    "--tipo-prazo",
    type=click.Choice(_TIPO_PRAZO_CHOICES),
    required=True,
    help=("'hard' = fixed regulatory deadline; 'soft' = internal target that can be renegotiated."),
)
@click.option("--status", required=True, help="Current status of the tarefa (free-form).")
@click.option("--descricao", default=None, help="Optional free-form description.")
@click.option(
    "--data-prevista",
    default=None,
    callback=validate_iso_date,
    help="Optional expected due date (YYYY-MM-DD).",
)
@click.option(
    "--data-prevista-estimada",
    default=None,
    callback=validate_iso_date,
    help="Optional estimated due date, used before the final date is confirmed (YYYY-MM-DD).",
)
@click.option(
    "--competencia",
    default=None,
    help="Optional free-form competencia reference (e.g. '2026-07'). Not format-enforced.",
)
@click.option(
    "--etapa-id",
    default=None,
    help="Optional id of an `etapa` to link this tarefa to. Must already exist.",
)
def criar(
    titulo: str,
    tipo_prazo: str,
    status: str,
    descricao: str | None,
    data_prevista: str | None,
    data_prevista_estimada: str | None,
    competencia: str | None,
    etapa_id: str | None,
) -> None:
    """Create a tarefa. The owner comes from the authenticated session — it
    cannot be supplied as a flag."""
    links = _resolve_etapa_link(etapa_id)
    eid = create_entity(
        etype=_ETYPE,
        fields={
            "titulo": titulo,
            "tipoPrazo": tipo_prazo,
            "status": status,
            "descricao": descricao,
            "dataPrevista": data_prevista,
            "dataPrevistaEstimada": data_prevista_estimada,
            "competencia": competencia,
        },
        links=links,
    )
    emit({"id": eid})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the tarefa to update.")
@click.option("--titulo", default=None, help="New title.")
@click.option("--descricao", default=None, help="New description.")
@click.option(
    "--tipo-prazo",
    type=click.Choice(_TIPO_PRAZO_CHOICES),
    default=None,
    help="New tipoPrazo ('hard' or 'soft').",
)
@click.option(
    "--data-prevista",
    default=None,
    callback=validate_iso_date,
    help="New expected due date (YYYY-MM-DD).",
)
@click.option(
    "--data-prevista-estimada",
    default=None,
    callback=validate_iso_date,
    help="New estimated due date (YYYY-MM-DD).",
)
@click.option("--competencia", default=None, help="New free-form competencia reference.")
@click.option("--status", default=None, help="New status.")
@click.option(
    "--etapa-id",
    default=None,
    help="New id of an `etapa` to link this tarefa to. Must already exist.",
)
def editar(
    eid: str,
    titulo: str | None,
    descricao: str | None,
    tipo_prazo: str | None,
    data_prevista: str | None,
    data_prevista_estimada: str | None,
    competencia: str | None,
    status: str | None,
    etapa_id: str | None,
) -> None:
    """Update a tarefa. Ownership is immutable and never accepted here."""
    links = _resolve_etapa_link(etapa_id)
    update_entity(
        etype=_ETYPE,
        eid=eid,
        fields=drop_none(
            {
                "titulo": titulo,
                "descricao": descricao,
                "tipoPrazo": tipo_prazo,
                "dataPrevista": data_prevista,
                "dataPrevistaEstimada": data_prevista_estimada,
                "competencia": competencia,
                "status": status,
            }
        ),
        links=links,
    )
    emit({"id": eid, "updated": True})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the tarefa to delete.")
def deletar(eid: str) -> None:
    """Delete a tarefa permanently. This cannot be undone."""
    delete_entity(etype=_ETYPE, eid=eid)
    emit({"id": eid, "deleted": True})


@group.command()
@click.option("--etapa-id", default=None, help="Filter to tarefas of exactly this etapa.")
@click.option("--status", default=None, help="Filter by exact `status` match.")
@click.option("--limit", type=int, default=None, help="Maximum number of records to return.")
def listar(etapa_id: str | None, status: str | None, limit: int | None) -> None:
    """List tarefas visible to the authenticated session."""
    where = drop_none({"status": status, "etapa.id": etapa_id})
    records = list_entities(etype=_ETYPE, where=where, limit=limit)
    emit(records)
