"""Schema-driven CLI coverage + help completeness + suppression-count gate.

Fully offline: no network call, no session required (verified by the
acceptance criterion that runs this module with `APOLLO_SESSION_FILE` pointed
at a nonexistent path). This module is the structural backstop for Phase 3:
a tenth schema entity landing with no CLI surface, a command/option shipped
with no help text, a stray `click.echo` bypassing the JSON-output contract,
or a reintroduced lint/type suppression must all fail here, loudly, before
any live test ever runs.
"""

from __future__ import annotations

import ast
import re
from collections.abc import Iterator
from pathlib import Path

import click
import pytest

from apollo_cli.cli import apollo
from apollo_cli.config import find_repo_root

# ---------------------------------------------------------------------------
# 1. Schema-driven coverage
# ---------------------------------------------------------------------------

# Matches the schema's own formatting exactly: four-space-indented entity
# keys immediately followed by `i.entity(` (see shared/instant.schema.ts). A
# formatting change to the schema file must break this regex loudly (the
# `len(names) >= 9` assertion below), never silently match zero entities.
_ENTITY_RE = re.compile(r"^\s{4}(\w+): i\.entity\(", re.MULTILINE)

# entity name -> (click command path under `apollo`, required command names,
# exact_match). `exact_match=True` means the entity's command set must equal
# `required` exactly (no criar/deletar may ever be added); otherwise
# `required` must be a subset of the actual command set.
EXPECTED_SURFACE: dict[str, tuple[list[str], set[str], bool]] = {
    "fundos": (["fundo"], {"criar", "editar", "deletar", "listar"}, False),
    "projetos": (["projeto"], {"criar", "editar", "deletar", "listar"}, False),
    "etapas": (["etapa"], {"criar", "editar", "deletar", "listar"}, False),
    "tarefas": (["tarefa"], {"criar", "editar", "deletar", "listar"}, False),
    "templatesRotina": (
        ["rotina", "template"],
        {"criar", "editar", "deletar", "listar"},
        False,
    ),
    "instanciasRotina": (["rotina", "instancia"], {"listar", "status"}, True),
    "tickets": (["ticket"], {"criar", "editar", "deletar", "listar"}, False),
    "subtarefas": (["subtarefa"], {"criar", "editar", "deletar", "listar"}, False),
    "logInferenciaClaude": (["log-inferencia"], {"registrar", "listar"}, True),
}


def _schema_entity_names() -> list[str]:
    schema_path = find_repo_root() / "shared" / "instant.schema.ts"
    text = schema_path.read_text(encoding="utf-8")
    names = _ENTITY_RE.findall(text)
    assert len(names) >= 9, (
        f"expected >= 9 entities in {schema_path} matching {_ENTITY_RE.pattern!r}, "
        f"found {len(names)}: {names} -- the schema's formatting may have changed"
    )
    return names


def _resolve_group(path: list[str]) -> click.Group:
    node: click.Command = apollo
    walked: list[str] = []
    for part in path:
        assert isinstance(node, click.Group), (
            f"apollo {' '.join(walked)!r} is not a group; cannot descend into {part!r}"
        )
        child = node.commands.get(part)
        assert child is not None, (
            f"apollo {' '.join([*walked, part])} does not resolve "
            f"(available under {' '.join(walked) or 'apollo'}: {sorted(node.commands)})"
        )
        node = child
        walked.append(part)
    assert isinstance(node, click.Group), f"apollo {' '.join(walked)} is not a command group"
    return node


@pytest.mark.parametrize("entity_name", _schema_entity_names(), ids=lambda name: name)
def test_schema_entity_coverage(entity_name: str) -> None:
    """Every schema entity must appear in EXPECTED_SURFACE with a real click path."""
    assert entity_name in EXPECTED_SURFACE, (
        f"schema entity {entity_name!r} has no CLI coverage mapping in "
        "EXPECTED_SURFACE -- a new entity must never ship without a CLI surface"
    )
    path, required, exact = EXPECTED_SURFACE[entity_name]
    group = _resolve_group(path)
    actual = set(group.commands.keys())
    if exact:
        assert actual == required, (
            f"{entity_name} (apollo {' '.join(path)}): expected exactly {sorted(required)}, "
            f"got {sorted(actual)}"
        )
    else:
        missing = required - actual
        assert not missing, (
            f"{entity_name} (apollo {' '.join(path)}): missing required commands {sorted(missing)} "
            f"(has {sorted(actual)})"
        )


def test_expected_surface_has_no_stale_entries() -> None:
    """Every EXPECTED_SURFACE key must exist in the schema (catches renames/drops)."""
    schema_names = set(_schema_entity_names())
    stale = set(EXPECTED_SURFACE) - schema_names
    assert not stale, f"EXPECTED_SURFACE has entries not in the schema: {sorted(stale)}"


# ---------------------------------------------------------------------------
# 2. Help completeness (C-07: "rich --help" for every subcommand)
# ---------------------------------------------------------------------------

_MIN_HELP_LEN = 20


def _walk_commands(group: click.Group, prefix: str) -> Iterator[tuple[str, click.Command]]:
    for name, cmd in sorted(group.commands.items()):
        full = f"{prefix} {name}"
        yield full, cmd
        if isinstance(cmd, click.Group):
            yield from _walk_commands(cmd, full)


def _all_commands() -> list[tuple[str, click.Command]]:
    return [("apollo", apollo), *_walk_commands(apollo, "apollo")]


def test_every_command_has_rich_help_text() -> None:
    missing = []
    for path, cmd in _all_commands():
        help_text = (cmd.help or cmd.short_help or "").strip()
        if len(help_text) < _MIN_HELP_LEN:
            missing.append(f"{path!r} (help={help_text!r})")
    assert not missing, (
        f"commands with insufficient --help text (< {_MIN_HELP_LEN} chars): {missing}"
    )


def test_every_option_has_help_text() -> None:
    missing = []
    for path, cmd in _all_commands():
        for param in cmd.params:
            if isinstance(param, click.Option) and not (param.help or "").strip():
                missing.append(f"{path} {param.opts}")
    assert not missing, f"options with no --help text: {missing}"


# ---------------------------------------------------------------------------
# 3. Output-convention check: click.echo emits JSON only
# ---------------------------------------------------------------------------


def _package_python_files() -> list[Path]:
    package_dir = find_repo_root() / "cli" / "apollo_cli"
    return sorted(package_dir.rglob("*.py"))


def _leaf_entity_python_files() -> list[Path]:
    """Every module under `entities/` plus `crud_helpers.py`/`auth.py`.

    Deliberately excludes `cli.py` (the `doctor` diagnostic command prints
    deliberate human-readable plain text, not JSON -- it is not part of the
    entity CRUD surface this contract governs) and `bizdays.py`/`config.py`/
    `instant_client.py`/`session.py` (no `click.echo` call sites at all).
    """
    apollo_cli_dir = find_repo_root() / "cli" / "apollo_cli"
    entity_files = sorted((apollo_cli_dir / "entities").rglob("*.py"))
    return [*entity_files, apollo_cli_dir / "crud_helpers.py", apollo_cli_dir / "auth.py"]


def _is_click_echo_call(node: ast.Call) -> bool:
    func = node.func
    return (
        isinstance(func, ast.Attribute)
        and func.attr == "echo"
        and isinstance(func.value, ast.Name)
        and func.value.id == "click"
    )


def _is_json_dumps_call(node: ast.expr) -> bool:
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "dumps"
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "json"
    )


def test_click_echo_only_ever_emits_json() -> None:
    """Pins the "one JSON document per command" output contract.

    Every `click.echo(...)` call anywhere in `apollo_cli` must wrap a
    `json.dumps(...)` call as its first argument -- a stray plain-string
    `click.echo("some text")` would break the CLI's single-JSON-output
    guarantee that every consumer (Claude, tests, `verify-phase-03.sh`)
    relies on.
    """
    violations = []
    for path in _leaf_entity_python_files():
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or not _is_click_echo_call(node):
                continue
            if not node.args or not _is_json_dumps_call(node.args[0]):
                violations.append(f"{path.name}:{node.lineno}")
    assert not violations, f"click.echo(...) not wrapping json.dumps(...) at: {violations}"


# ---------------------------------------------------------------------------
# 4. Suppression count (C-08: zero lint/type suppression comments)
# ---------------------------------------------------------------------------


def _suppression_scan_dirs() -> list[Path]:
    repo_root = find_repo_root()
    return [repo_root / "cli" / "apollo_cli", repo_root / "cli" / "tests"]


def test_zero_lint_or_type_suppressions() -> None:
    # Built from parts so this gate's own source text (which necessarily
    # names the markers it looks for) never matches itself.
    markers = ("#" + " noqa", "#" + " type: ignore")
    this_file = Path(__file__).resolve()
    violations = []
    for base in _suppression_scan_dirs():
        for path in sorted(base.rglob("*.py")):
            if path.resolve() == this_file:
                continue
            text = path.read_text(encoding="utf-8")
            for marker in markers:
                if marker in text:
                    violations.append(f"{path.relative_to(find_repo_root())}: contains {marker!r}")
    assert not violations, f"suppressions must be zero across cli/: {violations}"
