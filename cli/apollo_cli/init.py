"""`apollo init <path>` — scaffold an "Apollo Tasks" folder (D1).

Creates `<path>` if it doesn't exist and writes the vendored `README.md`/
`CLAUDE.md` scaffold (see `apollo_cli.data.scaffold`, D2) into it, refusing to
overwrite locally-edited copies unless `--force`. After writing, reports
read-only auth status so the user knows whether to run `apollo auth login`
next — this module's auth-status check (`_auth_status`) NEVER raises or
exits non-zero, even on a completely unauthenticated first-run machine (D4):
that is the single most common real-world state this command runs in.
"""

from __future__ import annotations

import json
from importlib import resources
from pathlib import Path
from typing import Final

import click
import httpx
from instantdb import Instant, InstantAPIError

from apollo_cli.config import load_instant_config
from apollo_cli.session import CorruptSessionError, MissingSessionError, load_session

# "target files exist, content differs from the vendored scaffold, --force
# not passed" guard — deliberately distinct from crud_helpers.EXIT_API_ERROR
# = 3 (and the sibling EXIT_NO_SESSION = 1 / EXIT_NETWORK_ERROR = 4 constants
# there) and rotina.py's _EXIT_INSTANCES_LINKED = 5, since this is a
# business-rule/state guard discovered only after a filesystem check, not a
# Click argument-parsing failure. Must NOT be 2: Click's own
# UsageError/BadParameter (bad flags, missing required options) already
# exits 2 by default, and reusing that value here would make the two failure
# classes indistinguishable to a caller branching on exit code alone.
_EXIT_TARGET_EXISTS_DIFFERS: Final[int] = 6

_SCAFFOLD_FILES: Final[tuple[str, str]] = ("README.md", "CLAUDE.md")

_LOGIN_NEXT_STEPS: Final[tuple[str, str]] = (
    "apollo auth login --email <voce@exemplo.com>",
    "apollo auth login --email <voce@exemplo.com> --code <codigo>",
)


def _scaffold_text(filename: str) -> str:
    """Return the vendored scaffold file's text, read via `importlib.resources`."""
    return resources.files("apollo_cli.data.scaffold").joinpath(filename).read_text(
        encoding="utf-8"
    )


def _auth_status() -> dict[str, object]:
    """Read-only, NEVER-raising reimplementation of `auth.whoami`'s check.

    Every failure branch returns a status dict instead of emitting/raising
    (D4 step 3) — an unauthenticated first-run machine must never crash or
    exit non-zero here, since that is the expected, normal first-run state.
    """
    try:
        session = load_session()
    except (MissingSessionError, CorruptSessionError):
        return {"authenticated": False}

    try:
        config = load_instant_config()
        # Unauthenticated endpoint — no admin token, no impersonation header.
        # Do NOT use session_client() or login_client() here.
        client = Instant(app_id=config.app_id, admin_token="")
        user = client.auth.verify_token(session.refresh_token)
        return {"authenticated": True, "email": user["email"]}
    except (InstantAPIError, httpx.HTTPError):
        return {"authenticated": False}


def run_init(target: Path, *, force: bool) -> dict[str, object]:
    """Scaffold `target` with the vendored README.md/CLAUDE.md, then report
    auth status. See module docstring for the full contract."""
    target.mkdir(parents=True, exist_ok=True)

    conflicts: list[str] = []
    for filename in _SCAFFOLD_FILES:
        vendored_text = _scaffold_text(filename)
        file_path = target / filename
        if file_path.is_file():
            existing_text = file_path.read_text(encoding="utf-8")
            if existing_text != vendored_text and not force:
                conflicts.append(filename)

    if conflicts:
        click.echo(
            json.dumps(
                {
                    "error": "scaffold_files_exist",
                    "path": str(target.resolve()),
                    "conflicting_files": sorted(conflicts),
                    "hint": "pass --force to overwrite (any other file in the folder is left untouched)",
                },
                sort_keys=True,
            ),
            err=True,
        )
        raise SystemExit(_EXIT_TARGET_EXISTS_DIFFERS)

    written: list[str] = []
    unchanged: list[str] = []
    for filename in _SCAFFOLD_FILES:
        vendored_text = _scaffold_text(filename)
        file_path = target / filename
        if file_path.is_file() and file_path.read_text(encoding="utf-8") == vendored_text:
            unchanged.append(filename)
            continue
        file_path.write_text(vendored_text, encoding="utf-8")
        written.append(filename)

    auth_status = _auth_status()

    report: dict[str, object] = {
        "path": str(target.resolve()),
        "written": sorted(written),
        "unchanged": sorted(unchanged),
        "authenticated": auth_status["authenticated"],
        "readme": str((target / "README.md").resolve()),
        "hint": "Abra esta pasta no Claude Code — o README.md explica os próximos passos.",
    }
    if auth_status["authenticated"]:
        report["email"] = auth_status["email"]
    else:
        report["next_steps"] = list(_LOGIN_NEXT_STEPS)

    return report
