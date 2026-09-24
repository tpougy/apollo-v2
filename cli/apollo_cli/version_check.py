"""Best-effort, never-raising GitHub version check for the `apollo` CLI.

Runs once per `apollo` invocation, from the `apollo()` group callback. On
every invocation, compares the installed `apollo-cli` package version
(`cli/pyproject.toml`'s `version` field) against the latest version
published on GitHub for `tpougy/apollo-v2` (this repo ships no GitHub
Releases, so the effective source is the repo's git tags), and prints a
short stderr-only warning with the exact upgrade command when a newer
version is available.

Contract: this check must never block, delay meaningfully, or fail the real
command underneath it. Every network failure, timeout, or parse error
degrades to complete silence. The result is cached for 24h at
`cache_path()` so most invocations touch no network at all, and the whole
check is disabled entirely by setting `APOLLO_NO_VERSION_CHECK` to any
non-empty value.
"""

from __future__ import annotations

import json
import os
import re
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as pkg_version
from pathlib import Path
from typing import Final

import click
import httpx

DISABLE_ENV_VAR: Final[str] = "APOLLO_NO_VERSION_CHECK"
CACHE_ENV_VAR: Final[str] = "APOLLO_VERSION_CACHE_FILE"
DEFAULT_CACHE_DIR: Final[Path] = Path.home() / ".config" / "apollo-cli"
DEFAULT_CACHE_FILE: Final[Path] = DEFAULT_CACHE_DIR / "version_check_cache.json"

_RELEASES_LATEST_URL: Final[str] = "https://api.github.com/repos/tpougy/apollo-v2/releases/latest"
_TAGS_URL: Final[str] = "https://api.github.com/repos/tpougy/apollo-v2/tags?per_page=100"
_REQUEST_HEADERS: Final[dict[str, str]] = {"User-Agent": "apollo-cli-version-check"}
_REQUEST_TIMEOUT: Final[float] = 2.0
_CACHE_TTL_SECONDS: Final[float] = 24 * 60 * 60
_TAG_VERSION_RE: Final[re.Pattern[str]] = re.compile(r"^v?(\d+(?:\.\d+)*)$")


def cache_path() -> Path:
    """Return the resolved cache file path.

    Reads `CACHE_ENV_VAR` from the environment at call time (not at import
    time) so tests can `monkeypatch.setenv` it. Falls back to
    `DEFAULT_CACHE_FILE` when unset.
    """
    override = os.environ.get(CACHE_ENV_VAR)
    return Path(override) if override else DEFAULT_CACHE_FILE


def _parse_version(text: str) -> tuple[int, ...] | None:
    match = _TAG_VERSION_RE.match(text.strip())
    if match is None:
        return None
    return tuple(int(part) for part in match.group(1).split("."))


def _installed_version() -> str | None:
    """Standalone so tests can monkeypatch a synthetic old install version."""
    try:
        return pkg_version("apollo-cli")
    except PackageNotFoundError:
        return None


def _fetch_latest_version() -> str | None:
    """The only network-touching function. Degrades to `None` on any failure."""
    try:
        response = httpx.get(
            _RELEASES_LATEST_URL, headers=_REQUEST_HEADERS, timeout=_REQUEST_TIMEOUT
        )
        if response.status_code == 200:
            tag_name = response.json().get("tag_name")
            if isinstance(tag_name, str) and _parse_version(tag_name) is not None:
                return tag_name.removeprefix("v")

        response = httpx.get(_TAGS_URL, headers=_REQUEST_HEADERS, timeout=_REQUEST_TIMEOUT)
        if response.status_code != 200:
            return None
        tags = response.json()
        if not isinstance(tags, list):
            return None

        best_name: str | None = None
        best_parsed: tuple[int, ...] | None = None
        for entry in tags:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name")
            if not isinstance(name, str):
                continue
            parsed = _parse_version(name)
            if parsed is None:
                continue
            if best_parsed is None or parsed > best_parsed:
                best_parsed = parsed
                best_name = name
        return best_name.removeprefix("v") if best_name is not None else None
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return None


def _read_cache() -> dict[str, object] | None:
    path = cache_path()
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict) or "checked_at" not in data or "latest_version" not in data:
        return None
    return data


def _write_cache(latest_version: str | None) -> None:
    """Best-effort — a cache-write failure must never propagate."""
    try:
        cache_path().parent.mkdir(parents=True, exist_ok=True)
        os.chmod(cache_path().parent, 0o700)
        payload = json.dumps(
            {
                "checked_at": datetime.now(UTC).isoformat(),
                "latest_version": latest_version,
            }
        )
        cache_path().write_text(payload, encoding="utf-8")
    except OSError:
        pass


def _is_cache_fresh(cache: dict[str, object]) -> bool:
    checked_at = cache.get("checked_at")
    if not isinstance(checked_at, str):
        return False
    try:
        parsed = datetime.fromisoformat(checked_at)
    except ValueError:
        return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    delta = (datetime.now(UTC) - parsed).total_seconds()
    return 0 <= delta < _CACHE_TTL_SECONDS


def get_latest_version_cached() -> str | None:
    """Return the latest known GitHub version, using the 24h cache when fresh.

    A previously-cached `None` (a failed check) is deliberately re-returned
    as-is rather than retried every invocation during an outage.
    """
    cache = _read_cache()
    if cache is not None and _is_cache_fresh(cache):
        latest_version = cache.get("latest_version")
        return latest_version if isinstance(latest_version, str) else None

    latest_version = _fetch_latest_version()
    _write_cache(latest_version)
    return latest_version


def _format_warning(installed: str, latest: str) -> str:
    return (
        f"apollo: a new version is available (v{latest}, you have v{installed}). "
        "Update with: uv tool upgrade apollo-cli"
    )


def maybe_warn_outdated() -> None:
    """Public entry point: print a stderr warning if a newer version exists.

    Every internal call already degrades to `None`/`False` on any failure,
    so this function needs no try/except of its own — the single absolute
    safety net lives at the `cli.py` call site instead, by design, so a
    future edit to this module's internals can never accidentally remove
    the "never blocks the real command" guarantee.
    """
    if os.environ.get(DISABLE_ENV_VAR):
        return

    installed = _installed_version()
    if installed is None:
        return
    installed_parsed = _parse_version(installed)
    if installed_parsed is None:
        return

    latest = get_latest_version_cached()
    if latest is None:
        return
    latest_parsed = _parse_version(latest)
    if latest_parsed is None or not (latest_parsed > installed_parsed):
        return

    click.echo(_format_warning(installed, latest), err=True)
