"""Entity command-group auto-discovery.

Every module living directly under this package that exports a module-level
`group: click.Group` attribute is discovered and attached to the top-level
`apollo` group with no edit to `cli.py` required. This is the contract every
entity module in plans 03-03..03-05 must satisfy — see
`.planning/phases/03-cli-auth-crud/03-02-PLAN.md` <interfaces>.
"""

from __future__ import annotations

import importlib
import pkgutil

import click


def discover_entity_groups() -> list[click.Group]:
    """Import every sibling module and collect its `group` attribute.

    Raises `TypeError` naming the offending module when a module is missing
    the `group` attribute or it is not a `click.Group` — a silently
    unregistered entity command is exactly the failure this must not allow.

    Returns groups sorted by `group.name` for a deterministic `--help` order.
    """
    groups: list[click.Group] = []
    for module_info in pkgutil.iter_modules(__path__):
        module = importlib.import_module(f"{__name__}.{module_info.name}")
        group = getattr(module, "group", None)
        if not isinstance(group, click.Group):
            msg = (
                f"entities.{module_info.name} does not export a module-level "
                "`group: click.Group` attribute, as required by the entity "
                "discovery contract."
            )
            raise TypeError(msg)
        groups.append(group)
    return sorted(groups, key=lambda group: group.name or "")


def register_entity_groups(cli_group: click.Group) -> None:
    """Attach every discovered entity group to `cli_group`."""
    for group in discover_entity_groups():
        cli_group.add_command(group)
