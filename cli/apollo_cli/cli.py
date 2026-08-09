"""The `apollo` command-line entrypoint.

Apollo v2 is a local, single-user system for a fund-controladoria professional.
This CLI is the AI-operated channel, built to have full parity with the web SPA:
every write operation available in the browser must also be available here,
authenticated as the same real user under the same InstantDB permission rules.
"""

from __future__ import annotations

from importlib.metadata import version

import click

from apollo_cli import auth
from apollo_cli.config import load_instant_config


@click.group()
@click.version_option(version=version("apollo-cli"))
def apollo() -> None:
    """Apollo v2 command-line interface.

    This is the AI-operated channel for Apollo v2, with full parity with the
    web SPA: every write available in the browser is also available here.

    `auth` (login, logout, whoami) is available. The remaining entity
    subcommand surface (fundo, projeto, etapa, tarefa, ticket, subtarefa,
    rotina, log-inferencia) lands as each is implemented later in Phase 3.
    """


apollo.add_command(auth.group)


@apollo.command()
def doctor() -> None:
    """Check that the repo-root `.env.instantdb` file resolves and is valid.

    Prints the resolved env file path, whether the InstantDB app id is
    present (showing only its last 4 characters), and whether an admin
    token is present in the file (never used at runtime — see the README).
    Never prints either credential value in full.
    """
    try:
        config = load_instant_config()
    except (FileNotFoundError, ValueError) as error:
        click.echo(str(error), err=True)
        raise SystemExit(1) from error

    click.echo(f"env file: {config.env_file}")
    click.echo(f"app id: ok (...{config.app_id[-4:]})")
    if config.admin_token_present:
        click.echo("admin token: present (dev/ops only — never used at runtime)")
    else:
        click.echo("admin token: absent")


def main() -> None:
    """Console-script entrypoint referenced by `[project.scripts]`."""
    apollo()
