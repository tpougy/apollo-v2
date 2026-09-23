"""`apollo rotina template ...` and `apollo rotina instancia listar|status`.

`rotina` is a nested command group covering recurring-routine templates
(`templatesRotina`) and the concrete instances generated from them
(`instanciasRotina`). Field/link shapes are LOCKED
(`shared/instant.schema.ts`, PROJECT.md C-04); command surface shape is
LOCKED (PROJECT.md C-07).

By design (PROJECT.md C-06), `instanciasRotina` has NO `criar` and NO
`deletar` command here. Instances exist to satisfy Phase 5's idempotent
generation job, keyed by a unique `dedupeKey` (plain
`f"{templateId}:{competencia}:{dataPrevista}"` concatenation — see
`apollo_cli.routine_job`'s module docstring for why it is not a hash). A
hand-created or hand-re-dated instance would carry a wrong or absent
`dedupeKey`, and the very next job run would then create a duplicate
alongside it — silently breaking the one idempotency guarantee this system
promises. `apollo rotina gerar-instancias` (Phase 5, JOB-02) is now wired at
the top level of this group and is the ONLY sanctioned creator of
`instanciasRotina` records — this is still the reasoning behind
`instancia` having no `criar`/`deletar`.

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

Phase 30 (LIFE-01/LIFE-02) adds exactly two narrow exceptions to the "no
`criar`/`deletar` for instances" rule above. `deletar` now blocks by default
when the target template has linked `instanciasRotina` (exact count, zero
writes) unless `--force` is passed, which proceeds without ever cascading
onto those instances. `limpar-orfas` (under `instancia`) is the ONLY command
that may ever delete an `instanciasRotina` row, and only when its `template`
link is confirmed absent. Neither exception reopens general instance
`criar`/`deletar` in the normal flow.
"""

from __future__ import annotations

import calendar
import json
import re
from datetime import date
from typing import Final

import click

from apollo_cli.crud_helpers import (
    EXIT_API_ERROR,
    client_for_session,
    create_entity,
    delete_entity,
    drop_none,
    emit,
    get_entity,
    instant_errors,
    list_entities,
    update_entity,
    validate_iso_date,
)
from apollo_cli.routine_job import (
    DIA_SEMANA_CHOICES,
    REGRAS_COMPETENCIA_SUPORTADAS,
    TIPO_GERACAO_CHOICES,
    run_routine_instance_job,
    today_utc_iso_date,
)

_ETYPE_TEMPLATE = "templatesRotina"
_ETYPE_INSTANCIA = "instanciasRotina"
_ETYPE_FUNDO = "fundos"
_COMPETENCIA_RE: Final[re.Pattern[str]] = re.compile(r"^\d{4}-\d{2}$")
# D-01/WR-01: exit code 5 for the "template has linked instancias, --force
# not passed" guard — deliberately distinct from crud_helpers.EXIT_API_ERROR
# = 3 (and the sibling EXIT_NO_SESSION = 1 / EXIT_NETWORK_ERROR = 4 constants
# there), since this is a business-rule/state guard discovered only after a
# query, not a Click argument-parsing failure. Must NOT be 2: Click's own
# UsageError/BadParameter (bad flags, missing required options, this same
# module's own `_resolve_range_override` XOR-validation) already exits 2 by
# default, and reusing that value here would make the two failure classes
# indistinguishable to a caller branching on exit code alone.
_EXIT_INSTANCES_LINKED: Final[int] = 5


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


def _validate_competencia_format(
    ctx: click.Context, param: click.Parameter, value: str | None
) -> str | None:
    """Click callback: enforce `YYYY-MM` with a month component in `1..12`
    and a year that `date` itself accepts.

    Mirrors `crud_helpers.validate_iso_date`'s exact shape, deliberately NOT
    `date.fromisoformat` (which requires a day component this flag lacks,
    D-05) — instead constructs `date(year, month, 1)` directly, which
    bounds-checks the year against `MINYEAR..MAXYEAR` the same way
    `validate_iso_date`'s `date.fromisoformat` call does for `--de`/`--ate`.
    Without this, an out-of-range year like `0000` passed CLI validation and
    flowed unguarded into `compute_expected_instances`, either silently
    writing a garbage row or crashing the whole job (CR-01).
    """
    if value is None:
        return None
    if not _COMPETENCIA_RE.match(value):
        msg = f"{value!r} nao esta no formato AAAA-MM"
        raise click.BadParameter(msg, ctx=ctx, param=param)
    year = int(value.split("-")[0])
    month = int(value.split("-")[1])
    if not (1 <= month <= 12):
        msg = f"{value!r} tem mes invalido (deve ser 01..12)"
        raise click.BadParameter(msg, ctx=ctx, param=param)
    try:
        date(year, month, 1)  # bounds-checks year against MINYEAR..MAXYEAR too
    except ValueError as error:
        msg = f"{value!r} tem ano invalido"
        raise click.BadParameter(msg, ctx=ctx, param=param) from error
    return value


def _resolve_range_override(
    competencia: str | None, de: str | None, ate: str | None
) -> tuple[str, str] | None:
    """Validate and resolve `--competencia`/`--de`/`--ate` into a
    `(range_start, range_end)` recorte, or `None` when all three are
    omitted (preserving the exact default range, D-04).

    Mirrors `subtarefa.py`'s `_resolve_parent` XOR-validation shape exactly:
    raises `click.UsageError` (exit 2) before any network call whenever the
    combination is invalid.
    """
    if competencia is not None and (de is not None or ate is not None):
        msg = "--competencia nao pode ser combinado com --de/--ate"
        raise click.UsageError(msg)

    if (de is None) != (ate is None):
        msg = "--de e --ate devem ser informados juntos"
        raise click.UsageError(msg)

    if de is not None and ate is not None:
        if de > ate:
            msg = "--de deve ser <= --ate"
            raise click.UsageError(msg)
        return (de, ate)

    if competencia is not None:
        year = int(competencia.split("-")[0])
        month = int(competencia.split("-")[1])
        last_day = calendar.monthrange(year, month)[1]
        return (f"{year:04d}-{month:02d}-01", f"{year:04d}-{month:02d}-{last_day:02d}")

    return None


group = click.Group(
    "rotina",
    help=(
        "Manage recurring-routine templates (`templatesRotina`) and their "
        "generated instances (`instanciasRotina`). Instances are created "
        "and dated only by `apollo rotina gerar-instancias` — never by hand "
        "from this CLI."
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
        "records. `limpar-orfas` is a narrow exception that deletes only "
        "instances whose `template` link no longer resolves — otherwise, "
        "no `criar`, no general `deletar` — see `rotina --help`."
    ),
)

group.add_command(template)
group.add_command(instancia)


@template.command()
@click.option("--nome", required=True, help="Display name of the routine template.")
@click.option(
    "--tipo-geracao",
    type=click.Choice(TIPO_GERACAO_CHOICES),
    required=True,
    help=(
        "How instances are dated: 'du_fixo' = fixed business-day offset, "
        "'corrido_fixo' = fixed calendar-day offset, 'encadeado' = chained "
        "off the `--antecessor-id` template's instance, 'semanal' = anchored "
        "to a chosen dia da semana (see the weekday-anchor option below)."
    ),
)
@click.option(
    "--regra-competencia",
    type=click.Choice(REGRAS_COMPETENCIA_SUPORTADAS),
    required=True,
    help=(
        "Which competencia (reference month) rule applies to generated "
        "instances of this template. Rejected immediately (exit 2) if not "
        "one of the choices above; the accepted value is later consumed by "
        "`apollo rotina gerar-instancias` via "
        "`apollo_cli.routine_job.shift_competencia`."
    ),
)
@click.option(
    "--propagar-atraso-soft/--nao-propagar-atraso-soft",
    default=False,
    help=(
        "Not currently read anywhere: stored on the template only; "
        "gerar-instancias does not propagate soft delays with it (C-09, "
        "out of scope for this milestone). Defaults to off."
    ),
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
@click.option(
    "--offset-dias",
    type=int,
    default=None,
    help=(
        "Meaning depends on --tipo-geracao (PROJECT.md/05-01-PLAN.md D-05-A): "
        "'du_fixo' = Nth BUSINESS day of the month when >= 1 (counted forward "
        "from the 1st, unchanged); when <= 0, counted BACKWARD from the "
        "month's last business day instead — 0 = the last business day of "
        "the month, negative N = N business days before it (JOB-02/D-27-B); "
        "'corrido_fixo' = Nth CALENDAR day of the month, clamped to the "
        "month's last day (integer >= 1); 'encadeado' = number of BUSINESS "
        "days after the antecessor instance's dataPrevista (integer >= 0, "
        "D-05-B). Omit to leave the field unset entirely (never writes 0)."
    ),
)
@click.option(
    "--dia-semana",
    type=click.Choice(DIA_SEMANA_CHOICES),
    default=None,
    help=(
        "Dia da semana ancorando a geracao quando --tipo-geracao=semanal "
        "(ignorado pelos outros tipos). Omitir gera "
        "'dia_semana_ausente' em `skipped` quando o template for do tipo "
        "semanal (JOB-02-style: rejeitado na geracao, nao na escrita)."
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
    offset_dias: int | None,
    dia_semana: str | None,
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
            "offsetDias": offset_dias,
            "diaSemana": dia_semana,
        },
        links=links,
    )
    emit({"id": eid})


@template.command()
@click.option("--id", "eid", required=True, help="Id of the template to update.")
@click.option("--nome", default=None, help="New display name.")
@click.option(
    "--tipo-geracao",
    type=click.Choice(TIPO_GERACAO_CHOICES),
    default=None,
    help="New generation type.",
)
@click.option(
    "--regra-competencia",
    type=click.Choice(REGRAS_COMPETENCIA_SUPORTADAS),
    default=None,
    help="New competencia rule. Omit to leave unchanged.",
)
@click.option(
    "--propagar-atraso-soft/--nao-propagar-atraso-soft",
    default=None,
    help=(
        "Not currently read anywhere: stored on the template only; "
        "gerar-instancias does not propagate soft delays with it (C-09, "
        "out of scope for this milestone). Omit to leave unchanged."
    ),
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
@click.option(
    "--offset-dias",
    type=int,
    default=None,
    help=(
        "New offset value. Meaning depends on --tipo-geracao "
        "(PROJECT.md/05-01-PLAN.md D-05-A): 'du_fixo' = Nth BUSINESS day of "
        "the month when >= 1 (counted forward from the 1st, unchanged); when "
        "<= 0, counted BACKWARD from the month's last business day instead "
        "— 0 = the last business day of the month, negative N = N business "
        "days before it (JOB-02/D-27-B); 'corrido_fixo' = Nth CALENDAR day of "
        "the month, clamped to the month's last day (integer >= 1); "
        "'encadeado' = number of BUSINESS days after the antecessor "
        "instance's dataPrevista (integer >= 0, D-05-B). Omit to leave the "
        "stored value unchanged — never resets it to 0."
    ),
)
@click.option(
    "--dia-semana",
    type=click.Choice(DIA_SEMANA_CHOICES),
    default=None,
    help=(
        "New dia da semana anchoring generation when --tipo-geracao=semanal "
        "(ignored by the other types). Omit to leave the stored value "
        "unchanged."
    ),
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
    offset_dias: int | None,
    dia_semana: str | None,
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
                "offsetDias": offset_dias,
                "diaSemana": dia_semana,
            }
        ),
        links=links,
    )
    emit({"id": eid, "updated": True})


def _count_linked_instances(template_id: str) -> int:
    """Count `instanciasRotina` reverse-linked to `template_id` via the
    schema's `instancias` link (`shared/instant.schema.ts`'s
    `templateInstancias` relation, reverse side).

    No `session.user_id` filter — this query filters by `id`, mirroring
    `get_entity`'s own no-donoId-filter convention, relying on InstantDB's
    server-side perms for ownership scoping exactly like every other
    single-record lookup in this module.

    Returns `0` when the template id does not resolve at all (the guard
    must never fire for a nonexistent template, preserving
    `test_deletar_unknown_id_is_not_found`'s existing behavior unchanged),
    and applies the same falsy-or-absent normalization as
    `routine_job._normalize_antecessor` to the `instancias` reverse link —
    an empty/absent reverse link counts as zero, never raises.
    """
    client, _ = client_for_session()
    result = client.query(
        {"templatesRotina": {"instancias": {}, "$": {"where": {"id": template_id}}}}
    )
    rows = result.get("templatesRotina", [])
    if not rows:
        return 0
    instancias = rows[0].get("instancias")
    return len(instancias) if isinstance(instancias, list) else 0


@template.command()
@click.option("--id", "eid", required=True, help="Id of the template to delete.")
@click.option(
    "--force/--no-force",
    default=False,
    help=(
        "Bypass the linked-instances block (D-01). NEVER cascades onto "
        "linked instances — they become orphans, cleanable via "
        "`apollo rotina instancia limpar-orfas`. With zero linked instances, "
        "this flag is a silent no-op (not an error to pass it anyway)."
    ),
)
def deletar(eid: str, force: bool) -> None:
    """Delete a routine template.

    Blocks by default (exit 5, exact linked-instance count, zero writes)
    when the template has linked `instanciasRotina`. `--force` bypasses the
    block WITHOUT ever cascading the delete onto those instances — they
    become orphans, cleanable via `apollo rotina instancia limpar-orfas`
    (D-01). The pre-existing `not_found` behavior for an unknown id is
    unchanged.
    """
    linked_count = _count_linked_instances(eid)
    if linked_count > 0 and not force:
        click.echo(
            json.dumps(
                {
                    "error": "instances_linked",
                    "template_id": eid,
                    "instance_count": linked_count,
                    "hint": "pass --force to delete anyway (instances become orphans, "
                    "cleanable via `apollo rotina instancia limpar-orfas`)",
                },
                sort_keys=True,
            ),
            err=True,
        )
        raise SystemExit(_EXIT_INSTANCES_LINKED)
    delete_entity(etype=_ETYPE_TEMPLATE, eid=eid)
    emit(
        {
            "id": eid,
            "deleted": True,
            "force": force,
            "instances_linked_at_delete": linked_count,
        }
    )


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
    """List generated routine instances visible to the authenticated session.

    Unlike most `listar` commands in this module, this one does NOT delegate
    to `crud_helpers.list_entities` (which never expands links) — it runs a
    direct `client.query` sub-expanding the `template` link, the exact
    `{"template": {}, ...}` shape `limpar_orfas` already uses a few lines
    below in this file, so every emitted row carries its source
    `templatesRotina` record (id + every field, notably `nome`) inline under
    the existing `template` key. This lets an operator see which recurring
    routine produced a given instance without a separate lookup. `--limit`
    and `--template-id`/`--status` filtering semantics are unchanged; only
    the emitted row shape gains the inline `template` sub-object. No CLI
    flag, no schema change. `template.listar` (a few lines above) is
    untouched — it still uses `list_entities` and never expands links.
    """
    where = drop_none({"template.id": template_id, "status": status})
    query_opts: dict[str, object] = {"where": where}
    if limit is not None:
        query_opts["limit"] = limit
    client, _ = client_for_session()
    with instant_errors():
        result = client.query({_ETYPE_INSTANCIA: {"template": {}, "$": query_opts}})
    records = result.get(_ETYPE_INSTANCIA, [])
    emit(records)


@instancia.command()
@click.option("--id", "eid", required=True, help="Id of the instance to update.")
@click.option("--status", required=True, help="New status value.")
def status(eid: str, status: str) -> None:
    """Update ONLY the `status` field of an existing routine instance.

    Deliberately narrow: this command must never grow a `--data-prevista` or
    `--competencia` flag. Either would desynchronize the record from its
    `dedupeKey` (the plain `templateId:competencia:dataPrevista`
    concatenation — deliberately not a hash, see `apollo_cli.routine_job`'s
    module docstring), and the next generation job run would then create a
    duplicate alongside it —
    breaking the one idempotency guarantee this system promises (PROJECT.md
    C-06).

    `status` remains free text here — this command never validates or
    constrains it. `gerar-instancias`'s `encadeado` successor resolution
    (`_is_concluida`, JOB-01/D-27-A) reads it back and recognizes spellings
    of "concluída"/"concluído" differing only by surrounding whitespace,
    case, or accent (e.g. "Concluída", "CONCLUIDA", "concluído ") as
    concluded; any other spelling, including a plural ("concluidas") or an
    otherwise different word, is treated as not-yet-concluded. That
    recognition is purely read-only and internal to the generation job — it
    is never enforced here at write time.
    """
    update_entity(etype=_ETYPE_INSTANCIA, eid=eid, fields={"status": status})
    emit({"id": eid, "updated": True})


@instancia.command(name="limpar-orfas")
@click.option(
    "--confirmar/--no-confirmar",
    default=False,
    help=(
        "Without --confirmar (default), only LISTS the orphaned instances "
        "found (zero writes). With --confirmar, actually deletes exactly "
        "those listed orphans."
    ),
)
def limpar_orfas(confirmar: bool) -> None:
    """List (default) or delete (`--confirmar`) `instanciasRotina` orphans.

    Strictly orphan-only scope (D-02, PROJECT.md C-06 still governs the
    normal flow) — this command never creates, edits, or deletes an
    instance with a valid `template` link. An instance is orphan when its
    `template` link, expanded, comes back falsy/absent (live-verified this
    phase: the key is entirely ABSENT, never `[]`/`null`, never a dangling
    reference or an error) — this happens when the linked template was
    deleted via `rotina template deletar --force`. Default lists only;
    `--confirmar` actually removes the listed rows.
    """
    client, session = client_for_session()
    result = client.query(
        {"instanciasRotina": {"template": {}, "$": {"where": {"donoId": session.user_id}}}}
    )
    rows = result.get("instanciasRotina", [])
    orphans = [row for row in rows if not row.get("template")]
    if confirmar:
        for row in orphans:
            delete_entity(etype=_ETYPE_INSTANCIA, eid=row["id"])
    emit(
        {
            "orphans": [{"id": row["id"], "dedupeKey": row.get("dedupeKey")} for row in orphans],
            "count": len(orphans),
            "confirmado": confirmar,
        }
    )


@group.command(name="gerar-instancias")
@click.option(
    "--data-base",
    default=None,
    callback=validate_iso_date,
    help=(
        "Data base (YYYY-MM-DD) usada como 'hoje' para o range de geracao "
        "[data-base, fim do proximo mes]. Omitir usa a data UTC atual. "
        "Ignorado quando --competencia/--de+--ate for informado (o recorte "
        "substitui o range default inteiro)."
    ),
)
@click.option(
    "--dry-run/--no-dry-run",
    default=False,
    help=(
        "Com --dry-run, executa toda a consulta e o diff mas NAO escreve nada "
        "— apenas reporta o que seria criado. Default: --no-dry-run (escreve)."
    ),
)
@click.option(
    "--competencia",
    default=None,
    callback=_validate_competencia_format,
    help=(
        "Recorta o range de geracao para exatamente o mes informado "
        "(AAAA-MM): --de = primeiro dia do mes, --ate = ultimo dia do mes. "
        "Opera sobre o range de dataPrevista candidatas, NAO sobre a "
        "competencia resultante gravada em cada instancia (que pode "
        "divergir por causa de regraCompetencia M-1/M-2/M+1). Mutuamente "
        "exclusivo com --de/--ate."
    ),
)
@click.option(
    "--de",
    default=None,
    callback=validate_iso_date,
    help=(
        "Inicio (YYYY-MM-DD, inclusive) do recorte do range de geracao. "
        "Requer --ate. Mutuamente exclusivo com --competencia."
    ),
)
@click.option(
    "--ate",
    default=None,
    callback=validate_iso_date,
    help=(
        "Fim (YYYY-MM-DD, inclusive) do recorte do range de geracao. Requer "
        "--de, que deve ser <= --ate. Mutuamente exclusivo com --competencia."
    ),
)
def gerar_instancias(
    data_base: str | None,
    dry_run: bool,
    competencia: str | None,
    de: str | None,
    ate: str | None,
) -> None:
    """Executa o job idempotente de geracao de `instanciasRotina`.

    Consulta os templates ativos e as instancias ja existentes para o dono
    autenticado, calcula o conjunto esperado de instancias para o range
    [hoje (ou --data-base), fim do proximo mes] por padrao — OU exatamente
    o recorte informado quando --competencia/--de+--ate for usado, caso em
    que o recorte SUBSTITUI o range default inteiro, nunca o intersecta
    (D-01) — e grava — via upsert lookup-keyed por `dedupeKey` — apenas as
    instancias que ainda nao existem. Este comando nunca duplica e nunca
    deleta uma instanciaRotina existente; rodar duas vezes seguidas produz
    o mesmo resultado, com ou sem recorte (D-06/D-09).

    --competencia opera sobre o range de dataPrevista candidatas, nao sobre
    a competencia gravada (ver `--competencia --help` para detalhe).

    Templates com `regraCompetencia` 'manual' ou desconhecida nunca geram
    instancia automaticamente (aparecem em `skipped`, com o motivo). Um
    template 'encadeado' herda a `competencia` e conta dias uteis a partir
    da `dataPrevista` do seu antecessor (nunca do proprio `regraCompetencia`
    do encadeado) — ver o docstring de `apollo_cli.routine_job` para as
    regras completas (D-05-B/D-05-D/D-05-E/D-05-F).

    Emite exatamente um documento JSON: `{"created": [...], "existing": [...],
    "skipped": [...]}`, todas as listas de dedupeKey ordenadas.
    """
    range_override = _resolve_range_override(competencia, de, ate)
    client, session = client_for_session()
    today = data_base or today_utc_iso_date()
    report = run_routine_instance_job(
        client, session.user_id, today, dry_run=dry_run, range_override=range_override
    )
    emit(report)
