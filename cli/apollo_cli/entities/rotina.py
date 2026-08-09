"""`apollo rotina template ...` and `apollo rotina instancia listar|status`.

`rotina` is a nested command group covering recurring-routine templates
(`templatesRotina`) and the concrete instances generated from them
(`instanciasRotina`). Field/link shapes are LOCKED
(`shared/instant.schema.ts`, PROJECT.md C-04); command surface shape is
LOCKED (PROJECT.md C-07).

By design (PROJECT.md C-06), `instanciasRotina` has NO `criar` and NO
`deletar` command here, and NO `gerar-instancias` command lands in this
phase. Instances exist to satisfy Phase 5's idempotent generation job, keyed
by a unique `dedupeKey = hash(templateId + competencia + dataPrevista)`. A
hand-created or hand-re-dated instance would carry a wrong or absent
`dedupeKey`, and the very next job run would then create a duplicate
alongside it — silently breaking the one idempotency guarantee this system
promises. `apollo rotina gerar-instancias` (the job trigger) is Phase 5
scope (JOB-02) and must not be stubbed here.

The owner-id field is never referenced by its schema name in this module —
grep-verified to be absent here — because it is injected exclusively by
`crud_helpers.create_entity`/`update_entity` from the authenticated session,
never from a CLI flag or a local literal.

`--fundo-id` and `--antecessor-id`, when supplied, are each validated with
`get_entity` before being merged into `links` — InstantDB does not check
link targets exist, so an unchecked link would happily write a dangling
reference. `--antecessor-id` writes the `templateAntecessor` self-link
(a `templatesRotina` may declare another `templatesRotina` as its
predecessor, used by the `encadeado` generation type).
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

_ETYPE_TEMPLATE = "templatesRotina"
_ETYPE_INSTANCIA = "instanciasRotina"
_ETYPE_FUNDO = "fundos"
_TIPO_GERACAO_CHOICES = ("du_fixo", "corrido_fixo", "encadeado")


def _resolve_ref(*, etype: str, eid: str | None, link_label: str) -> dict[str, str] | None:
    """Validate a `--*-id` flag against the real table before linking.

    Exits with `parent_not_found` (not a raw `None` link) when the id does
    not resolve — a dangling link would otherwise look like a normal record
    until someone tries to read the link back.
    """
    if eid is None:
        return None
    if get_entity(etype=etype, eid=eid) is None:
        click.echo(
            json.dumps({"error": "parent_not_found", "etype": etype, "id": eid}, sort_keys=True),
            err=True,
        )
        raise SystemExit(EXIT_API_ERROR)
    return {link_label: eid}


def _merge_links(*links: dict[str, str] | None) -> dict[str, str] | None:
    merged: dict[str, str] = {}
    for link in links:
        if link:
            merged.update(link)
    return merged or None


group = click.Group(
    "rotina",
    help=(
        "Manage recurring-routine templates (`templatesRotina`) and their "
        "generated instances (`instanciasRotina`). Instances are created "
        "and dated only by the Phase 5 generation job — never by hand from "
        "this CLI."
    ),
)

template = click.Group(
    "template",
    help="CRUD for `templatesRotina` (the recurring-routine definitions).",
)

instancia = click.Group(
    "instancia",
    help=(
        "List and update the status of generated `instanciasRotina` "
        "records. No `criar`, no `deletar` — see `rotina --help`."
    ),
)

group.add_command(template)
group.add_command(instancia)


@template.command()
@click.option("--nome", required=True, help="Display name of the routine template.")
@click.option(
    "--tipo-geracao",
    type=click.Choice(_TIPO_GERACAO_CHOICES),
    required=True,
    help=(
        "How instances are dated: 'du_fixo' = fixed business-day offset, "
        "'corrido_fixo' = fixed calendar-day offset, 'encadeado' = chained "
        "off the `--antecessor-id` template's instance."
    ),
)
@click.option(
    "--regra-competencia",
    required=True,
    help=(
        "Free-form rule describing which competencia (reference month) each "
        "generated instance belongs to. Not enforced/parsed by the CLI."
    ),
)
@click.option(
    "--propagar-atraso-soft/--nao-propagar-atraso-soft",
    default=False,
    help="Whether a soft delay on this template propagates to its sucessores. Defaults to off.",
)
@click.option(
    "--ativo/--inativo",
    default=True,
    help="Whether the template is active (eligible for generation). Defaults to --ativo.",
)
@click.option(
    "--fundo-id",
    default=None,
    help="Optional id of a `fundo` to link this template to. Must already exist.",
)
@click.option(
    "--antecessor-id",
    default=None,
    help=(
        "Optional id of another `templatesRotina` to declare as this "
        "template's predecessor (self-link, used by 'encadeado'). Must "
        "already exist."
    ),
)
def criar(
    nome: str,
    tipo_geracao: str,
    regra_competencia: str,
    propagar_atraso_soft: bool,
    ativo: bool,
    fundo_id: str | None,
    antecessor_id: str | None,
) -> None:
    """Create a routine template. The owner comes from the authenticated
    session — it cannot be supplied as a flag."""
    links = _merge_links(
        _resolve_ref(etype=_ETYPE_FUNDO, eid=fundo_id, link_label="fundo"),
        _resolve_ref(etype=_ETYPE_TEMPLATE, eid=antecessor_id, link_label="antecessor"),
    )
    eid = create_entity(
        etype=_ETYPE_TEMPLATE,
        fields={
            "nome": nome,
            "tipoGeracao": tipo_geracao,
            "regraCompetencia": regra_competencia,
            "propagarAtrasoSoft": propagar_atraso_soft,
            "ativo": ativo,
        },
        links=links,
    )
    emit({"id": eid})


@template.command()
@click.option("--id", "eid", required=True, help="Id of the template to update.")
@click.option("--nome", default=None, help="New display name.")
@click.option(
    "--tipo-geracao",
    type=click.Choice(_TIPO_GERACAO_CHOICES),
    default=None,
    help="New generation type.",
)
@click.option("--regra-competencia", default=None, help="New competencia rule.")
@click.option(
    "--propagar-atraso-soft/--nao-propagar-atraso-soft",
    default=None,
    help="New soft-delay-propagation flag. Omit to leave unchanged.",
)
@click.option(
    "--ativo/--inativo",
    default=None,
    help="New active/inactive state. Omit to leave unchanged.",
)
@click.option(
    "--fundo-id",
    default=None,
    help="New id of a `fundo` to link this template to. Must already exist.",
)
@click.option(
    "--antecessor-id",
    default=None,
    help="New id of the predecessor `templatesRotina` self-link. Must already exist.",
)
def editar(
    eid: str,
    nome: str | None,
    tipo_geracao: str | None,
    regra_competencia: str | None,
    propagar_atraso_soft: bool | None,
    ativo: bool | None,
    fundo_id: str | None,
    antecessor_id: str | None,
) -> None:
    """Update a routine template. Ownership is immutable and never accepted
    here. Boolean flags default to unset (`None`) so omitting a flag never
    silently resets `ativo` or `propagarAtrasoSoft`."""
    links = _merge_links(
        _resolve_ref(etype=_ETYPE_FUNDO, eid=fundo_id, link_label="fundo"),
        _resolve_ref(etype=_ETYPE_TEMPLATE, eid=antecessor_id, link_label="antecessor"),
    )
    update_entity(
        etype=_ETYPE_TEMPLATE,
        eid=eid,
        fields=drop_none(
            {
                "nome": nome,
                "tipoGeracao": tipo_geracao,
                "regraCompetencia": regra_competencia,
                "propagarAtrasoSoft": propagar_atraso_soft,
                "ativo": ativo,
            }
        ),
        links=links,
    )
    emit({"id": eid, "updated": True})


@template.command()
@click.option("--id", "eid", required=True, help="Id of the template to delete.")
def deletar(eid: str) -> None:
    """Delete a routine template."""
    delete_entity(etype=_ETYPE_TEMPLATE, eid=eid)
    emit({"id": eid, "deleted": True})


@template.command()
@click.option("--fundo-id", default=None, help="Filter to templates of exactly this fundo.")
@click.option(
    "--ativo/--inativo",
    default=None,
    help="Filter by active/inactive state. Omit to return both.",
)
@click.option("--limit", type=int, default=None, help="Maximum number of records to return.")
def listar(fundo_id: str | None, ativo: bool | None, limit: int | None) -> None:
    """List routine templates visible to the authenticated session."""
    where = drop_none({"fundo.id": fundo_id, "ativo": ativo})
    records = list_entities(etype=_ETYPE_TEMPLATE, where=where, limit=limit)
    emit(records)


@instancia.command(name="listar")
@click.option("--template-id", default=None, help="Filter to instances of exactly this template.")
@click.option("--status", default=None, help="Filter by exact `status` match.")
@click.option("--limit", type=int, default=None, help="Maximum number of records to return.")
def listar_instancia(template_id: str | None, status: str | None, limit: int | None) -> None:
    """List generated routine instances visible to the authenticated session."""
    where = drop_none({"template.id": template_id, "status": status})
    records = list_entities(etype=_ETYPE_INSTANCIA, where=where, limit=limit)
    emit(records)


@instancia.command()
@click.option("--id", "eid", required=True, help="Id of the instance to update.")
@click.option("--status", required=True, help="New status value.")
def status(eid: str, status: str) -> None:
    """Update ONLY the `status` field of an existing routine instance.

    Deliberately narrow: this command must never grow a `--data-prevista` or
    `--competencia` flag. Either would desynchronize the record from its
    `dedupeKey` (hash of templateId + competencia + dataPrevista), and the
    next generation job run would then create a duplicate alongside it —
    breaking the one idempotency guarantee this system promises (PROJECT.md
    C-06).
    """
    update_entity(etype=_ETYPE_INSTANCIA, eid=eid, fields={"status": status})
    emit({"id": eid, "updated": True})
