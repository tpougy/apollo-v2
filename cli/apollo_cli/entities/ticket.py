"""`apollo ticket criar|editar|deletar|listar` — CRUD for the `tickets` entity.

A "ticket" is an ad-hoc inbound demand — typically arriving by email — as
opposed to structured project work planned in `projetos`/`etapas`/`tarefas`.
Command surface shape is LOCKED (PROJECT.md C-07); field shape is LOCKED
(`shared/instant.schema.ts`, PROJECT.md C-04): `titulo`, `corpo`, `remetente`,
`dataRecebimento`, `tipoPrazo`, `dataPrevista` (optional), `status` (indexed),
an owner-id field (indexed).

The owner-id field is never referenced by its schema name in this module —
grep-verified to be absent here — because it is injected exclusively by
`crud_helpers.create_entity`/`update_entity` from the authenticated session,
never from a CLI flag or a local literal.

`--fundo-id`, when supplied, links the ticket to that fundo via the
`fundoTickets` link (forward label `fundo`, on `tickets`). The parent id is
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

_ETYPE = "tickets"
_PARENT_ETYPE = "fundos"
_TIPO_PRAZO_CHOICES = ("hard", "soft")


def _resolve_fundo_link(fundo_id: str | None) -> dict[str, str] | None:
    """Validate `--fundo-id` against the real `fundos` table before linking.

    Exits with `parent_not_found` (not a raw `None` link) when the id does
    not resolve — a dangling link to a nonexistent fundo would otherwise look
    like a normal ticket until someone tries to read the link back.
    """
    if fundo_id is None:
        return None
    if get_entity(etype=_PARENT_ETYPE, eid=fundo_id) is None:
        click.echo(
            json.dumps(
                {"error": "parent_not_found", "etype": _PARENT_ETYPE, "id": fundo_id},
                sort_keys=True,
            ),
            err=True,
        )
        raise SystemExit(EXIT_API_ERROR)
    return {"fundo": fundo_id}


@click.group(name="ticket")
def group() -> None:
    """Manage `tickets` (ad-hoc inbound demands, typically arriving by email,
    as opposed to structured project work)."""


@group.command()
@click.option("--titulo", required=True, help="Title of the ticket.")
@click.option(
    "--corpo",
    required=True,
    help="Verbatim message body (e.g. the email content). Never logged or echoed elsewhere.",
)
@click.option("--remetente", required=True, help="Sender of the inbound demand.")
@click.option(
    "--data-recebimento",
    required=True,
    callback=validate_iso_date,
    help="Date the ticket was received (YYYY-MM-DD).",
)
@click.option(
    "--tipo-prazo",
    type=click.Choice(_TIPO_PRAZO_CHOICES),
    required=True,
    help=("'hard' = fixed regulatory deadline; 'soft' = internal target that can be renegotiated."),
)
@click.option("--status", required=True, help="Current status of the ticket (free-form).")
@click.option(
    "--data-prevista",
    default=None,
    callback=validate_iso_date,
    help="Optional expected due date (YYYY-MM-DD).",
)
@click.option(
    "--fundo-id",
    default=None,
    help="Optional id of a `fundo` to link this ticket to. Must already exist.",
)
def criar(
    titulo: str,
    corpo: str,
    remetente: str,
    data_recebimento: str,
    tipo_prazo: str,
    status: str,
    data_prevista: str | None,
    fundo_id: str | None,
) -> None:
    """Create a ticket. The owner comes from the authenticated session — it
    cannot be supplied as a flag."""
    links = _resolve_fundo_link(fundo_id)
    eid = create_entity(
        etype=_ETYPE,
        fields={
            "titulo": titulo,
            "corpo": corpo,
            "remetente": remetente,
            "dataRecebimento": data_recebimento,
            "tipoPrazo": tipo_prazo,
            "status": status,
            "dataPrevista": data_prevista,
        },
        links=links,
    )
    emit({"id": eid})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the ticket to update.")
@click.option("--titulo", default=None, help="New title.")
@click.option("--corpo", default=None, help="New message body.")
@click.option("--remetente", default=None, help="New sender.")
@click.option(
    "--data-recebimento",
    default=None,
    callback=validate_iso_date,
    help="New date the ticket was received (YYYY-MM-DD).",
)
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
@click.option("--status", default=None, help="New status.")
@click.option(
    "--fundo-id",
    default=None,
    help="New id of a `fundo` to link this ticket to. Must already exist.",
)
def editar(
    eid: str,
    titulo: str | None,
    corpo: str | None,
    remetente: str | None,
    data_recebimento: str | None,
    tipo_prazo: str | None,
    data_prevista: str | None,
    status: str | None,
    fundo_id: str | None,
) -> None:
    """Update a ticket. Ownership is immutable and never accepted here."""
    links = _resolve_fundo_link(fundo_id)
    update_entity(
        etype=_ETYPE,
        eid=eid,
        fields=drop_none(
            {
                "titulo": titulo,
                "corpo": corpo,
                "remetente": remetente,
                "dataRecebimento": data_recebimento,
                "tipoPrazo": tipo_prazo,
                "dataPrevista": data_prevista,
                "status": status,
            }
        ),
        links=links,
    )
    emit({"id": eid, "updated": True})


@group.command()
@click.option("--id", "eid", required=True, help="Id of the ticket to delete.")
def deletar(eid: str) -> None:
    """Delete a ticket permanently. This cannot be undone."""
    delete_entity(etype=_ETYPE, eid=eid)
    emit({"id": eid, "deleted": True})


@group.command()
@click.option("--fundo-id", default=None, help="Filter to tickets of exactly this fundo.")
@click.option("--status", default=None, help="Filter by exact `status` match.")
@click.option("--limit", type=int, default=None, help="Maximum number of records to return.")
def listar(fundo_id: str | None, status: str | None, limit: int | None) -> None:
    """List tickets visible to the authenticated session."""
    where = drop_none({"status": status, "fundo.id": fundo_id})
    records = list_entities(etype=_ETYPE, where=where, limit=limit)
    emit(records)
