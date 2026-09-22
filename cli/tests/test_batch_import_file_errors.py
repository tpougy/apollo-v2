"""Offline coverage of `run_batch_import`'s file-read error contract
(WR-01/WR-02, Phase 31 code review). No live session, no network call, no
`client` usage: every case here exits before `run_batch_import` ever touches
its `client` argument, so a `None` sentinel stands in for it — never a mock
of any InstantDB behavior, just proof the exit-2/clean-JSON contract holds
for file-level errors before validation even runs.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, cast

import pytest
from instantdb import Instant

from apollo_cli.batch_import import EXIT_VALIDATION_ERROR, run_batch_import

_NO_CLIENT = cast("Instant", None)
"""Every case in this module exits before `run_batch_import` ever touches
its `client` argument (the file read fails first) — this sentinel is never
called into, just a type-correct stand-in so the signature is satisfied
without pulling in a real `Instant` session."""


@pytest.mark.skipif(
    os.name == "nt" or (hasattr(os, "geteuid") and os.geteuid() == 0),
    reason="chmod-based permission denial is unreliable for root/Windows",
)
def test_run_batch_import_reports_permission_error_via_clean_contract(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """WR-02: an `OSError` other than `UnicodeDecodeError` on file read (here,
    `PermissionError` via a chmod'd-unreadable file) is reported through the
    module's clean-JSON/exit-2 contract instead of escaping as a raw
    traceback."""
    path = tmp_path / "unreadable.json"
    path.write_text('{"fundos": []}', encoding="utf-8")
    path.chmod(0o000)
    try:
        with pytest.raises(SystemExit) as exc_info:
            run_batch_import(client=_NO_CLIENT, dono_id="dono-x", path=path)
    finally:
        path.chmod(0o644)

    assert exc_info.value.code == EXIT_VALIDATION_ERROR
    captured = capsys.readouterr()
    error_body = cast("dict[str, Any]", json.loads(captured.err))
    errors = cast("list[dict[str, Any]]", error_body["errors"])
    assert any(e["reason"] == "arquivo_nao_pode_ser_lido" for e in errors), errors


def test_run_batch_import_reports_non_utf8_via_clean_contract(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Existing `UnicodeDecodeError` path (unchanged by WR-02) still reports
    its own distinct reason code, proving the new `except OSError` clause
    does not shadow it."""
    path = tmp_path / "not_utf8.json"
    path.write_bytes(b"\xff\xfe\x00\x01invalid-utf8")

    with pytest.raises(SystemExit) as exc_info:
        run_batch_import(client=_NO_CLIENT, dono_id="dono-x", path=path)

    assert exc_info.value.code == EXIT_VALIDATION_ERROR
    captured = capsys.readouterr()
    error_body = cast("dict[str, Any]", json.loads(captured.err))
    errors = cast("list[dict[str, Any]]", error_body["errors"])
    assert any(e["reason"] == "arquivo_nao_e_utf8" for e in errors), errors
