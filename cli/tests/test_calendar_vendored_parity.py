"""Byte-parity gate (PKG-02): shared/anbima-calendar.json vs the vendored
cli/apollo_cli/data/ copy consumed by the installed package. Fails loudly if
someone edits one file and forgets the other — the whole point of vendoring
is that both copies never silently diverge.
"""

from __future__ import annotations

from importlib import resources
from pathlib import Path
from typing import Final

from apollo_cli.config import find_repo_root

_SOURCE_PATH: Final[Path] = find_repo_root() / "shared" / "anbima-calendar.json"
_VENDORED_RESOURCE: Final = resources.files("apollo_cli.data").joinpath("anbima-calendar.json")


def test_vendored_calendar_is_byte_identical_to_shared_source() -> None:
    source_bytes: bytes = _SOURCE_PATH.read_bytes()
    vendored_bytes: bytes = _VENDORED_RESOURCE.read_bytes()
    assert source_bytes == vendored_bytes, (
        f"{_SOURCE_PATH} and cli/apollo_cli/data/anbima-calendar.json "
        "(read via importlib.resources) have diverged — update the vendored "
        "copy (see PKG-01/PKG-02)."
    )
