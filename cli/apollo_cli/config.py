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
    env_file: Path
    admin_token_present: bool


def load_instant_config(env_file: Path | None = None) -> InstantConfig:
    """Parse `.env.instantdb` and return the resolved `InstantConfig`.

    Resolution order for `env_file`: explicit argument, then `APOLLO_ENV_FILE`
    environment variable, then `find_repo_root() / ENV_FILENAME`.

    Raises `ValueError` if neither `NEXT_PUBLIC_INSTANT_APP_ID` nor the
    `INSTANT_APP_ID` fallback key is present with a non-empty value.
    """
    resolved_env_file: Path
    if env_file is not None:
        resolved_env_file = env_file
    elif override := os.environ.get(_ENV_FILE_OVERRIDE_VAR):
        resolved_env_file = Path(override)
    else:
        resolved_env_file = find_repo_root() / ENV_FILENAME

    values: dict[str, str | None] = dotenv_values(resolved_env_file)

    app_id: str | None = values.get(_APP_ID_KEY) or values.get(_APP_ID_FALLBACK_KEY)
    if not app_id:
        msg = (
            f"No app id found in {resolved_env_file}. "
            f"Expected one of: {_APP_ID_KEY!r}, {_APP_ID_FALLBACK_KEY!r}"
        )
        raise ValueError(msg)

    admin_token_present: bool = bool(values.get(_ADMIN_TOKEN_KEY))

    return InstantConfig(
        app_id=app_id,
        env_file=resolved_env_file,
        admin_token_present=admin_token_present,
    )
