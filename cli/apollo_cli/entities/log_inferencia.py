"""`apollo log-inferencia registrar|listar` — append-only Claude inference audit log.

`logInferenciaClaude` is an append-only record of values Claude inferred
while operating the CLI and the text that justified each inference. It is
deliberately not editable or deletable from this CLI — a rewritable audit
log cannot serve its purpose of letting the user check the AI's reasoning
after the fact (PROJECT.md, threat T-03-26). The InstantDB perms rule still
permits the owner to delete the underlying record at the data layer; the
CLI-level absence of `editar`/`deletar` is the control enforced here.

Field shape is LOCKED (`shared/instant.schema.ts`, PROJECT.md C-04): `campo`,
`valorInferido`, `trechoMotivador` (optional), `entidadeTipo`, `entidadeId`,
an owner-id field (indexed), `createdAt`.

The click group name is kebab-case (`log-inferencia`) even though this
module is `log_inferencia.py` — the entity-discovery contract registers a
module's exported `group` under its click name, not the module's filename
(see `cli/apollo_cli/entities/__init__.py`).

The owner-id field is never referenced by its schema name in this module —
grep-verified to be absent here — because it is injected exclusively by
`crud_helpers.create_entity` from the authenticated session, never from a
CLI flag or a local literal.
"""

from __future__ import annotations

import click

from apollo_cli.crud_helpers import create_entity, drop_none, emit, list_entities, now_iso

_ETYPE = "logInferenciaClaude"

group = click.Group(
    "log-inferencia",
    help=(
        "Append-only audit trail of values Claude inferred and the text "
        "that justified each inference. No `editar`, no `deletar` — the "
        "user must always be able to audit the AI's reasoning after the "
        "fact."
    ),
)


@group.command()
@click.option("--campo", required=True, help="Name of the field whose value was inferred.")
@click.option("--valor-inferido", required=True, help="The value Claude inferred for that field.")
@click.option(
    "--entidade-tipo",
    required=True,
    help="Type of the entity the inference applies to, as used in the schema (e.g. `tarefas`, `tickets`).",
)
@click.option("--entidade-id", required=True, help="Id of the entity the inference applies to.")
@click.option(
    "--trecho-motivador",
    default=None,
    help="Optional verbatim excerpt of the text that justified the inference.",
)
def registrar(
    campo: str,
    valor_inferido: str,
    entidade_tipo: str,
    entidade_id: str,
    trecho_motivador: str | None,
) -> None:
    """Record an inference. The owner and `createdAt` timestamp are set
    automatically from the authenticated session and the current time —
    they cannot be supplied as flags."""
    fields = drop_none(
        {
            "campo": campo,
            "valorInferido": valor_inferido,
            "trechoMotivador": trecho_motivador,
            "entidadeTipo": entidade_tipo,
            "entidadeId": entidade_id,
        }
    )
    fields["createdAt"] = now_iso()
    eid = create_entity(etype=_ETYPE, fields=fields)
    emit({"id": eid})


@group.command()
@click.option("--entidade-tipo", default=None, help="Filter by exact `entidadeTipo` match.")
@click.option("--entidade-id", default=None, help="Filter by exact `entidadeId` match.")
@click.option("--limit", type=int, default=None, help="Maximum number of records to return.")
def listar(entidade_tipo: str | None, entidade_id: str | None, limit: int | None) -> None:
    """List inference audit records visible to the authenticated session."""
    where = drop_none({"entidadeTipo": entidade_tipo, "entidadeId": entidade_id})
    records = list_entities(etype=_ETYPE, where=where, limit=limit)
    emit(records)
