"""Byte-parity gate: docs/ai-usage/{README,CLAUDE}.md vs the vendored
cli/apollo_cli/data/scaffold/ copy consumed by `apollo init` (D2). Fails
loudly if someone edits one file and forgets the other — the whole point of
vendoring is that both copies never silently diverge.
"""

from __future__ import annotations

from importlib import resources
from pathlib import Path
from typing import Final

import pytest

from apollo_cli.config import find_repo_root

_FILENAMES: Final[tuple[str, str]] = ("README.md", "CLAUDE.md")


@pytest.mark.parametrize("filename", _FILENAMES)
def test_vendored_scaffold_file_is_byte_identical_to_docs_source(filename: str) -> None:
    source_path: Path = find_repo_root() / "docs" / "ai-usage" / filename
    vendored_resource = resources.files("apollo_cli.data.scaffold").joinpath(filename)
    source_bytes: bytes = source_path.read_bytes()
    vendored_bytes: bytes = vendored_resource.read_bytes()
    assert source_bytes == vendored_bytes, (
        f"{source_path} and cli/apollo_cli/data/scaffold/{filename} "
        "(read via importlib.resources) have diverged — update the vendored "
        "copy (see D2)."
    )
