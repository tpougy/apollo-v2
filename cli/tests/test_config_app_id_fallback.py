"""Fallback-chain unit tests (PKG-03/PKG-04) for `load_instant_config()`.

Fully offline — every case uses `tmp_path`+`monkeypatch`, never the real
`.env.instantdb` or the network. Proves the full precedence chain from
CONTEXT.md decision 5: explicit `env_file` arg > `APOLLO_ENV_FILE` >
`.env.instantdb` via `find_repo_root()` > embedded default — and that
`find_repo_root()`'s own `FileNotFoundError` (not just a missing app-id key)
is caught and degrades to the embedded default (RESEARCH.md Pitfall 2).
"""

from __future__ import annotations

from pathlib import Path

import pytest

import apollo_cli.config as config_module
from apollo_cli.config import _DEFAULT_APP_ID, load_instant_config


def _write_env_file(
    path: Path, *, app_id: str | None = None, admin_token: str | None = None
) -> Path:
    lines: list[str] = []
    if app_id is not None:
        lines.append(f'NEXT_PUBLIC_INSTANT_APP_ID="{app_id}"')
    if admin_token is not None:
        lines.append(f'INSTANT_APP_ADMIN_TOKEN="{admin_token}"')
    path.write_text("\n".join(lines) + "\n" if lines else "")
    return path


# --- (a) explicit env_file resolves app_id with source == "file" -----------


def test_explicit_env_file_resolves_app_id_with_file_source(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("APOLLO_ENV_FILE", raising=False)
    env_file = _write_env_file(tmp_path / ".env.instantdb", app_id="explicit-app-id")

    config = load_instant_config(env_file=env_file)

    assert config.app_id == "explicit-app-id"
    assert config.app_id_source == "file"
    assert config.env_file == env_file


# --- (b) find_repo_root() FileNotFoundError degrades to embedded default ---


def test_missing_env_file_anywhere_falls_back_to_embedded_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _raise(*_args: object, **_kwargs: object) -> Path:
        msg = "Could not find .env.instantdb in any parent directory"
        raise FileNotFoundError(msg)

    monkeypatch.delenv("APOLLO_ENV_FILE", raising=False)
    monkeypatch.setattr(config_module, "find_repo_root", _raise)

    config = load_instant_config()

    assert config.app_id == _DEFAULT_APP_ID
    assert config.app_id_source == "embedded_default"
    assert config.env_file is None
    assert config.admin_token_present is False


# --- (c) a resolved file with no app-id key still falls back, but env_file ---
# --- still reports the real path (not None) ---------------------------------


def test_resolved_file_without_app_id_key_falls_back_but_keeps_env_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("APOLLO_ENV_FILE", raising=False)
    env_file = _write_env_file(tmp_path / ".env.instantdb", app_id=None, admin_token="some-token")

    config = load_instant_config(env_file=env_file)

    assert config.app_id == _DEFAULT_APP_ID
    assert config.app_id_source == "embedded_default"
    assert config.env_file == env_file
    assert config.admin_token_present is True


# --- (d) APOLLO_ENV_FILE overrides the embedded default; explicit env_file ---
# --- takes precedence over a simultaneously-set APOLLO_ENV_FILE -------------


def test_apollo_env_file_env_var_overrides_embedded_default(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    env_file = _write_env_file(tmp_path / ".env.instantdb", app_id="env-var-app-id")
    monkeypatch.setenv("APOLLO_ENV_FILE", str(env_file))

    config = load_instant_config()

    assert config.app_id == "env-var-app-id"
    assert config.app_id_source == "file"
    assert config.env_file == env_file


def test_explicit_env_file_takes_precedence_over_apollo_env_file_var(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    explicit_file = _write_env_file(tmp_path / "explicit.env", app_id="explicit-wins")
    env_var_file = _write_env_file(tmp_path / "env-var.env", app_id="env-var-loses")
    monkeypatch.setenv("APOLLO_ENV_FILE", str(env_var_file))

    config = load_instant_config(env_file=explicit_file)

    assert config.app_id == "explicit-wins"
    assert config.app_id_source == "file"
    assert config.env_file == explicit_file


# --- (e) admin_token_present is computed correctly regardless of app_id ---
# --- source, including the embedded-default case ---------------------------


def test_admin_token_present_true_alongside_file_app_id(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("APOLLO_ENV_FILE", raising=False)
    env_file = _write_env_file(tmp_path / ".env.instantdb", app_id="app-id", admin_token="a-token")

    config = load_instant_config(env_file=env_file)

    assert config.admin_token_present is True


def test_admin_token_absent_alongside_file_app_id(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("APOLLO_ENV_FILE", raising=False)
    env_file = _write_env_file(tmp_path / ".env.instantdb", app_id="app-id", admin_token=None)

    config = load_instant_config(env_file=env_file)

    assert config.admin_token_present is False


def test_admin_token_present_true_alongside_embedded_default_app_id(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("APOLLO_ENV_FILE", raising=False)
    env_file = _write_env_file(tmp_path / ".env.instantdb", app_id=None, admin_token="a-token")

    config = load_instant_config(env_file=env_file)

    assert config.app_id_source == "embedded_default"
    assert config.admin_token_present is True


def test_admin_token_absent_alongside_embedded_default_app_id_no_file_at_all(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _raise(*_args: object, **_kwargs: object) -> Path:
        msg = "Could not find .env.instantdb in any parent directory"
        raise FileNotFoundError(msg)

    monkeypatch.delenv("APOLLO_ENV_FILE", raising=False)
    monkeypatch.setattr(config_module, "find_repo_root", _raise)

    config = load_instant_config()

    assert config.app_id_source == "embedded_default"
    assert config.admin_token_present is False
