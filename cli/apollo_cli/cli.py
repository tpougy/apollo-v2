"""The `apollo` command-line entrypoint.

Apollo v2 is a local, single-user system for a fund-controladoria professional.
This CLI is the AI-operated channel, built to have full parity with the web SPA:
every write operation available in the browser must also be available here,
authenticated as the same real user under the same InstantDB permission rules.
"""

from __future__ import annotations

from importlib.metadata import version
from pathlib import Path

import click

from apollo_cli import auth, version_check
from apollo_cli.batch_import import run_batch_import
from apollo_cli.config import load_instant_config
from apollo_cli.crud_helpers import client_for_session, emit
from apollo_cli.entities import register_entity_groups
from apollo_cli.init import run_init


@click.group()
@click.version_option(version=version("apollo-cli"))
def apollo() -> None:
    """Apollo v2 command-line interface.

    This is the AI-operated channel for Apollo v2, with full parity with the
    web SPA: every write available in the browser is also available here.

    `auth` (login, logout, whoami) is available. Every entity subcommand
    group (entidade, projeto, etapa, tarefa, ticket, subtarefa, rotina,
    log-inferencia) is auto-discovered from `apollo_cli/entities/` as each
    module lands — no edit to this file is required per new entity, see
    `apollo_cli.entities.register_entity_groups`.

    On every invocation, also best-effort checks GitHub for a newer version
    and prints a one-line warning to stderr when one exists. Never blocks,
    delays, or fails the real command; disable entirely with
    `APOLLO_NO_VERSION_CHECK`.
    """
    try:
        version_check.maybe_warn_outdated()
    except Exception:
        # Absolute last-resort guarantee: this best-effort UX nicety must
        # never fail or delay the real command underneath it, no matter
        # what future bug lands in version_check.py.
        pass


apollo.add_command(auth.group)
register_entity_groups(apollo)


@apollo.command()
def doctor() -> None:
    """Check that the InstantDB app id and env file resolve and are valid.

    Prints the resolved env file path (or a note that none was found and the
    embedded default app id is being used), whether the InstantDB app id is
    present (showing only its last 4 characters) along with its provenance
    (file vs embedded default), and whether an admin token is present in the
    file (never used at runtime — see the README). Never prints either
    credential value in full.
    """
    try:
        config = load_instant_config()
    except (FileNotFoundError, ValueError) as error:
        click.echo(str(error), err=True)
        raise SystemExit(1) from error

    if config.env_file is None:
        click.echo("env file: (none — using embedded default app id)")
    else:
        click.echo(f"env file: {config.env_file}")
    click.echo(
        f"app id: ok (...{config.app_id[-4:]}) — source: {config.app_id_source.replace('_', ' ')}"
    )
    if config.admin_token_present:
        click.echo("admin token: present (dev/ops only — never used at runtime)")
    else:
        click.echo("admin token: absent")


@apollo.command(name="import")
@click.option(
    "--from-json",
    "from_json_path",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help=(
        "Caminho para o arquivo JSON do lote: um objeto top-level com chaves "
        '`entidades`/`templatesRotina` (ex.: `{"entidades": [...], '
        '"templatesRotina": [...]}`), nenhuma outra chave e aceita. Cada '
        "registro tem um `_local_id` (unico no arquivo inteiro) e campos "
        "espelhando exatamente os --flags de `entidade criar`/`rotina "
        "template criar` (`tipoEntidade` e opcional em `entidades[]`, "
        'default `"Fundo"` quando omitido). `templatesRotina[].entidadeId`/'
        "`antecessorId` aceitam um id real ja existente OU "
        '`"$<local_id>"` para referenciar outro registro do mesmo arquivo '
        "(inclusive um antecessor `encadeado` listado antes ou depois no "
        "arquivo)."
    ),
)
@click.option(
    "--dry-run/--no-dry-run",
    default=False,
    help=(
        "Com --dry-run, executa toda a validacao + verificacao de "
        "existencia + resolucao de ids mas NUNCA escreve nada — apenas "
        "reporta o que seria criado/o que ja existe. Default: --no-dry-run "
        "(escreve)."
    ),
)
def import_batch(from_json_path: Path, dry_run: bool) -> None:
    """Cadastra `entidades` + `templatesRotina` em lote a partir de um unico
    arquivo JSON (`apollo import --from-json <arquivo> [--dry-run]`).

    Valida o arquivo INTEIRO antes de escrever qualquer coisa: qualquer
    registro invalido em qualquer lista (campo ausente, choice invalido,
    referencia `$<local_id>` nao resolvida, ciclo de antecessor, ou uma
    chave `donoId` proibida) faz o comando reportar a lista COMPLETA de
    problemas encontrados, sair com codigo 2, e nao escrever nada — mesmo
    que so um registro dentre muitos esteja quebrado. Registros cuja chave
    natural ja existir na base (entidades por `codigo`, templatesRotina por
    `entidadeId` resolvido + `nome`) sao reportados como `existing`, nunca
    recriados. Este comando nunca cria uma `instanciasRotina` — apenas
    `apollo rotina gerar-instancias` cria instancias.

    Emite exatamente um documento JSON: `{"entidades": {"created": [...],
    "existing": [...]}, "templatesRotina": {"created": [...], "existing":
    [...]}}` (listas de `_local_id`, nao ids reais) em caso de sucesso, ou
    `{"errors": [...]}` no stderr (exit 2) em caso de falha de validacao.
    """
    client, session = client_for_session()
    report = run_batch_import(client, session.user_id, from_json_path, dry_run=dry_run)
    emit(report)


@apollo.command(name="init")
@click.argument("path", type=click.Path(file_okay=False, path_type=Path))
@click.option(
    "--force/--no-force",
    default=False,
    help=(
        "Overwrite README.md/CLAUDE.md even if their current content differs "
        "from the vendored scaffold template. Any OTHER file already in the "
        "folder is never touched. With identical content already present, "
        "this flag is a silent no-op."
    ),
)
def init(path: Path, force: bool) -> None:
    """Scaffold an "Apollo Tasks" folder at PATH.

    Creates PATH if it doesn't exist and writes the vendored README.md/
    CLAUDE.md onboarding template into it, then reports real auth status
    (authenticated email, or the exact next `apollo auth login` commands to
    run) so the folder is ready to open directly in Claude Code.
    """
    report = run_init(path, force=force)
    emit(report)


def main() -> None:
    """Console-script entrypoint referenced by `[project.scripts]`."""
    apollo()
