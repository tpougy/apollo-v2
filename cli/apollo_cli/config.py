"""Repo-root discovery and `.env.instantdb` loading for every apollo_cli command.

The CLI never reads `INSTANT_APP_ADMIN_TOKEN` into its normal operating path —
that credential bypasses every InstantDB permission rule (C-05). `InstantConfig`
only ever reports whether the token is *present*, never its value.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from dotenv import dotenv_values

ENV_FILENAME: Final[str] = ".env.instantdb"

_APP_ID_KEY: Final[str] = "NEXT_PUBLIC_INSTANT_APP_ID"
_APP_ID_FALLBACK_KEY: Final[str] = "INSTANT_APP_ID"
_ADMIN_TOKEN_KEY: Final[str] = "INSTANT_APP_ADMIN_TOKEN"
_ENV_FILE_OVERRIDE_VAR: Final[str] = "APOLLO_ENV_FILE"

# Safe to embed: this is `NEXT_PUBLIC_INSTANT_APP_ID`, already public — it
# ships verbatim, in plaintext, inside the built `web/` bundle (see plan
# 24-01 RESEARCH.md). It is never a substitute for `INSTANT_APP_ADMIN_TOKEN`,
# which keeps no default and is never embedded anywhere in this package
# (see the module docstring / C-05).
_DEFAULT_APP_ID: Final[str] = "7936ca82-5cb4-43c2-811d-788a6ec0d2a8"


def find_repo_root(start: Path | None = None) -> Path:
    """Walk upward from `start` (default: this file's location) until a directory
    containing `ENV_FILENAME` is found, and return that directory.

    Raises `FileNotFoundError` if the filesystem root is reached without finding it.
    """
    current: Path = (start or Path(__file__).resolve()).resolve()
    search_start: Path = current
    if current.is_file():
        current = current.parent

    while True:
        if (current / ENV_FILENAME).is_file():
            return current
        if current.parent == current:
            msg = f"Could not find {ENV_FILENAME} in any parent directory of {search_start}"
            raise FileNotFoundError(msg)
        current = current.parent


@dataclass(frozen=True)
class InstantConfig:
    """Resolved InstantDB configuration for the CLI's normal operating path.

    Deliberately has no field for the admin token value — only whether it is
    present in the env file. See `ENV_FILENAME`'s module docstring / C-05.
    """

    app_id: str
    app_id_source: str  # "file" | "embedded_default"
    env_file: Path | None
    admin_token_present: bool


def load_instant_config(env_file: Path | None = None) -> InstantConfig:
    """Parse `.env.instantdb` and return the resolved `InstantConfig`.

    Resolution order for `env_file`/`app_id`: explicit `env_file` argument,
    then `APOLLO_ENV_FILE` environment variable, then `find_repo_root() /
    ENV_FILENAME`, then the embedded `_DEFAULT_APP_ID` default (used only when
    no file resolves an app id at all — including when no `.env.instantdb` is
    reachable anywhere up the tree, the expected outcome for a real `uv tool
    install` outside the monorepo). Never raises for a missing app id/env
    file; `app_id_source` reports which of the two paths was taken.
    """
    resolved_env_file: Path | None
    if env_file is not None:
        resolved_env_file = env_file
    elif override := os.environ.get(_ENV_FILE_OVERRIDE_VAR):
        resolved_env_file = Path(override)
    else:
        try:
            resolved_env_file = find_repo_root() / ENV_FILENAME
        except FileNotFoundError:
            # No monorepo checkout reachable from this install location —
            # this is the expected, correct outcome for `uv tool install`.
            resolved_env_file = None

    values: dict[str, str | None] = (
        dotenv_values(resolved_env_file) if resolved_env_file is not None else {}
    )

    app_id: str | None = values.get(_APP_ID_KEY) or values.get(_APP_ID_FALLBACK_KEY)
    app_id_source: str
    if app_id:
        app_id_source = "file"
    else:
        app_id = _DEFAULT_APP_ID
        app_id_source = "embedded_default"

    admin_token_present: bool = bool(values.get(_ADMIN_TOKEN_KEY))

    return InstantConfig(
        app_id=app_id,
        app_id_source=app_id_source,
        env_file=resolved_env_file,
        admin_token_present=admin_token_present,
    )
