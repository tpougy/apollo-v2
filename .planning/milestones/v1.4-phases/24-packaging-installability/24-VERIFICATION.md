---
phase: 24-packaging-installability
verified: 2026-08-12T20:15:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 24: Packaging & Installability Verification Report

**Phase Goal:** Anyone can `uv tool install` `cli/` from a clean checkout and run `apollo` from any
directory outside the `apollo-v2` monorepo — the ANBIMA calendar and the InstantDB `app_id` both resolve
from inside the installed package, with no runtime dependency on `shared/` or a present `.env.instantdb`.
**Verified:** 2026-08-12
**Status:** passed
**Re-verification:** No — initial verification.

All checks below were run live, independently, in this verification session (not taken from
SUMMARY.md transcripts) — including a full, fresh `uv build` → `uv tool install --force` →
run-outside-the-repo → `uv tool uninstall` round trip on this machine, per this project's standing
convention of real/live verification over static inspection.

## Goal Achievement

### Observable Truths (mapped to ROADMAP.md Success Criteria + PKG-01..05)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `uv build` produces a wheel for `cli/` from a clean checkout, and `uv tool install` of that wheel succeeds in an isolated environment with no `apollo-v2` monorepo present (PKG-05, SC1) | ✓ VERIFIED | Live, this session: `uv build --out-dir /tmp/apollo24_verify_dist` succeeded; `uv tool install --force /tmp/apollo24_verify_dist/apollo_cli-0.1.0-py3-none-any.whl` installed 27 packages, `Installed 1 executable: apollo`. |
| 2 | `apollo --version`, `apollo doctor`, and a read-only listing subcommand succeed from outside `apollo-v2`, with no `shared/`/`.env.instantdb` present, using the embedded default `app_id` (PKG-03, PKG-05, SC2) | ✓ VERIFIED | Live, this session, run from `/tmp/apollo24_verify_outside` (created fresh, no monorepo ancestor): `apollo --version` → `apollo, version 0.1.0` (exit 0); `apollo doctor` → `env file: (none — using embedded default app id)` / `app id: ok (...d2a8) — source: embedded default` / `admin token: absent` (exit 0); `apollo fundo listar` (with `APOLLO_SESSION_FILE` pointed at a nonexistent path to isolate from this dev machine's real persisted session) → `{"error": "no_session", ...}` (exit 1, clean — not an import crash). |
| 3 | Business-day calculations inside the isolated install return correct ANBIMA results, proving `bizdays.py` reads its vendored copy via `importlib.resources` rather than `find_repo_root()` (PKG-01, SC3) | ✓ VERIFIED | Live, this session: ran `apollo_cli.bizdays.is_business_day`/`add_business_days` directly from the installed tool's own interpreter (`~/.local/share/uv/tools/apollo-cli/bin/python`) from outside the repo — `is_business_day('2024-03-28') is True`, `is_business_day('2024-03-29') is False` (Good Friday), `add_business_days('2024-03-28', 1) == '2024-04-01'` — all correct, not just "imports without crashing." `bizdays.py` source inspected directly: zero references to `find_repo_root`/`_CALENDAR_PATH`; uses `resources.files("apollo_cli.data").joinpath(...)`. |
| 4 | A real `pytest` run asserts byte-identical content between `shared/anbima-calendar.json` and `cli/apollo_cli/data/anbima-calendar.json`, and fails when the two files are deliberately made to differ (PKG-02, SC4) | ✓ VERIFIED | `shasum` comparison this session: both files 18459 bytes, identical hash. `uv run pytest tests/test_calendar_vendored_parity.py -v` passes (re-run this session). Test file inspected: asserts `source_path.read_bytes() == vendored_bytes`, non-vacuous (mutate/revert cycle documented in 24-01-SUMMARY.md; test file structure confirms the assertion is load-bearing, not tautological). |
| 5 | With `.env.instantdb`/`APOLLO_ENV_FILE` present and pointing at a different `app_id`, the CLI resolves to that overriding value instead of the embedded default, preserving the existing resolution order (PKG-04, SC5) | ✓ VERIFIED | Live spot-check this session: called `load_instant_config(env_file=Path(...))` pointing at a tmp file with a different UUID app_id → returned that exact UUID with `app_id_source == "file"`. `config.py` source inspected: explicit-arg / `APOLLO_ENV_FILE` / `find_repo_root()` branches are structurally unchanged and run before the embedded-default fallback. Named precedence tests exist and pass: `test_missing_env_file_anywhere_falls_back_to_embedded_default`, `test_apollo_env_file_env_var_overrides_embedded_default`, `test_explicit_env_file_takes_precedence_over_apollo_env_file_var`. |
| 6 | `load_instant_config()` never raises for a missing app_id/env file (the `find_repo_root()` `FileNotFoundError` is caught at its call site, not just the downstream "no app_id key" path) (PKG-04) | ✓ VERIFIED | `config.py:83-88` inspected directly: `find_repo_root()` call wrapped in `try/except FileNotFoundError`, falling through to `resolved_env_file = None`. Confirmed live: `apollo doctor` from outside the repo (no `.env.instantdb` reachable) completed with exit 0, no traceback. |
| 7 | `apollo doctor` reports app_id provenance (file vs embedded default) without altering the pre-existing admin-token diagnostic (CONTEXT.md decision 6) | ✓ VERIFIED | `cli.py:57-67` inspected: `env_file is None` → `"(none — using embedded default app id)"`; prints `config.app_id_source.replace('_',' ')`; admin-token branch (`"admin token: present/absent"`) untouched. Live output confirms exact wording. Admin-token confinement gates re-run this session — `test_admin_token_confinement`/`test_admin_token_key_confined_to_exempt_modules`: 26 passed, 2 skipped (pre-existing exemptions), 0 failed, 0 exemption-list changes. |
| 8 | `uv tool uninstall apollo-cli` fully removes the installed tool; the developer machine is left clean | ✓ VERIFIED | Live, this session: `uv tool uninstall apollo-cli` → `Uninstalled 1 executable: apollo`; `uv tool list` → `No tools installed`; `which apollo` → not found (exit 1). Matches state both before and after this verification session's own install cycle. |
| 9 | No new dependency introduced; scope confined to `cli/` (CONTEXT.md decisions 7-8) | ✓ VERIFIED | `git diff --stat 3a24b08^ 9f3e88e` shows exactly 10 files touched, all under `cli/` (`README.md`, `apollo_cli/{bizdays,cli,config}.py`, `apollo_cli/data/{__init__.py,anbima-calendar.json}`, `pyproject.toml`, `tests/test_{calendar_vendored_parity,config_app_id_fallback,packaging_live}.py`). Diff against `cli/apollo_cli/instant_client.py`, `shared/anbima-calendar.json`, and `web/` is empty (zero changes). |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cli/apollo_cli/data/anbima-calendar.json` | Byte-identical vendored copy, 18459 bytes | ✓ VERIFIED | Confirmed via `shasum`/`wc -c` this session: identical hash, identical size to `shared/anbima-calendar.json`. |
| `cli/apollo_cli/data/__init__.py` | Empty, convention-only | ✓ VERIFIED | Exists, 0 bytes. |
| `cli/apollo_cli/bizdays.py` | `importlib.resources` load, zero `find_repo_root()` | ✓ VERIFIED | Read in full; matches exactly. |
| `cli/apollo_cli/config.py` | `_DEFAULT_APP_ID`, `app_id_source`, `env_file: Path \| None`, wrapped `find_repo_root()` | ✓ VERIFIED | Read in full; matches exactly. |
| `cli/apollo_cli/cli.py` | `doctor` handles `env_file=None`, prints provenance | ✓ VERIFIED | Read in full; matches exactly. |
| `cli/tests/test_calendar_vendored_parity.py` | Byte-parity gate (PKG-02) | ✓ VERIFIED | Exists, passes, re-run this session. |
| `cli/tests/test_config_app_id_fallback.py` | Fallback-chain unit tests (PKG-03/04) | ✓ VERIFIED | Exists, 10 tests, all pass, re-run this session. |
| `cli/tests/test_packaging_live.py` | Automated live packaging round-trip (PKG-05), marked `packaging` | ✓ VERIFIED | Exists, passes for real (genuine subprocess `uv build`/`uv venv`/`uv pip install`), re-run this session — 1 passed in 2.54s. |
| `cli/pyproject.toml` `packaging` marker | Registered, distinct from `live` | ✓ VERIFIED | `markers = [...]` inspected directly; both `live` and `packaging` present. |
| `cli/README.md` | Documents embedded-default fallback + global install path | ✓ VERIFIED | "Global install (`uv tool install`)" subsection and doctor-fallback paragraph both present and accurate. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bizdays.py` module-level load | `apollo_cli/data/anbima-calendar.json` | `resources.files("apollo_cli.data").joinpath(...)` | ✓ WIRED | Confirmed by direct read of correct calendar values (`is_business_day`) from the *installed wheel*, outside the repo — not just import success. |
| `cli.py`'s eager `register_entity_groups()` → entities → `routine_job` → `bizdays` | import-time safety outside the repo | live `apollo --version` invocation | ✓ WIRED | `apollo --version` completes with exit 0 outside the repo — the eager-import chain (RESEARCH.md Pitfall 1) no longer crashes. |
| `load_instant_config()` | `find_repo_root()` | `try/except FileNotFoundError` at the call site | ✓ WIRED | Live `apollo doctor` outside the repo (no `.env.instantdb` reachable) completes cleanly; source inspected to confirm the wrap is at the actual crash site (RESEARCH.md Pitfall 2), not just the downstream `ValueError` branch. |
| `doctor` | `InstantConfig.app_id_source`/`env_file` | direct field read + string formatting | ✓ WIRED | Live output shows exact expected strings (`"(none — using embedded default app id)"`, `"source: embedded default"`). |

### Data-Flow Trace

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `bizdays.py::_PAYLOAD` | ANBIMA holidays | `apollo_cli/data/anbima-calendar.json` via `importlib.resources` | Yes — verified via correct `is_business_day`/`add_business_days` results from the installed wheel | ✓ FLOWING |
| `config.py::load_instant_config()` | `app_id` | embedded `_DEFAULT_APP_ID` constant (fallback) or resolved `.env.instantdb`/`APOLLO_ENV_FILE`/explicit-arg file (override) | Yes — both paths independently exercised live this session | ✓ FLOWING |

### Behavioral Spot-Checks (live, this session — not taken from SUMMARY.md)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Wheel contains exactly the expected packaged files | `uv build` + `python3 -m zipfile -l` | `apollo_cli/data/anbima-calendar.json`, `bizdays.py`, `config.py`, `cli.py` all present | ✓ PASS |
| Fresh `uv tool install --force` succeeds outside repo | `uv tool install --force <wheel>` | `Installed 1 executable: apollo` | ✓ PASS |
| `apollo --version` from outside repo | run from `/tmp/apollo24_verify_outside` | `apollo, version 0.1.0`, exit 0 | ✓ PASS |
| `apollo doctor` from outside repo | same | embedded-default provenance printed correctly, exit 0 | ✓ PASS |
| `apollo fundo listar` from outside repo (isolated session) | same, `APOLLO_SESSION_FILE` pointed at nonexistent path | `{"error":"no_session",...}`, exit 1 (clean, no crash) | ✓ PASS |
| Correct bizdays math from installed wheel outside repo | direct `python -c` via the tool's own venv interpreter | `is_business_day`/`add_business_days` all correct | ✓ PASS |
| Embedded `_DEFAULT_APP_ID` matches current public source of truth | grepped UUIDs from `web/dist/assets/index-*.js` | `7936ca82-5cb4-43c2-811d-788a6ec0d2a8` present, matches `config.py`'s constant | ✓ PASS |
| PKG-04 override precedence (explicit `env_file` wins over embedded default) | `load_instant_config(env_file=<tmp file with different app_id>)` | returned that file's app_id, `app_id_source == "file"` | ✓ PASS |
| `uv tool uninstall`/`uv tool list` leaves machine clean | `uv tool uninstall apollo-cli && uv tool list` | `No tools installed`; `which apollo` → not found | ✓ PASS |
| `cli/tests/test_packaging_live.py` (real subprocess, not mocked) | `uv run pytest tests/test_packaging_live.py -v -m packaging` | 1 passed in 2.54s | ✓ PASS |
| Fast/offline suite regression check | `uv run pytest -m "not live and not packaging" -q` | 326 passed, 2 skipped, 90 deselected | ✓ PASS |
| Full unit test set for calendar/config/bizdays | `uv run pytest tests/test_calendar_vendored_parity.py tests/test_config_app_id_fallback.py tests/test_bizdays.py tests/test_calendar_json.py -v` | 234 passed | ✓ PASS |
| Admin-token confinement structural gates unmodified | `uv run pytest tests/test_auth_rejection.py tests/test_instant_client.py -k "admin_token_confinement or admin_token_key_confined_to_exempt_modules"` | 26 passed, 2 skipped, 0 failed | ✓ PASS |
| Quality gates on `cli/` + `../shared/scripts` | `ruff check`, `ruff format --check`, `ty check` | all clean | ✓ PASS |

### Probe Execution

Not applicable in the formal sense (no `scripts/*/tests/probe-*.sh` files declared for this phase), but
the phase's own equivalent — the real `uv build` → `uv tool install --force` → run-outside-repo →
`uv tool uninstall` round trip — was executed live in this verification session (see Behavioral
Spot-Checks above), independently of the transcript already captured in `24-02-SUMMARY.md`. Both
transcripts agree.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| PKG-01 | 24-01 | Vendor calendar, read via `importlib.resources` | ✓ SATISFIED | Truths #3, #9; artifact/data-flow checks above. |
| PKG-02 | 24-01 | Byte-parity test, non-vacuous | ✓ SATISFIED | Truth #4. |
| PKG-03 | 24-01 | Embedded default `app_id` | ✓ SATISFIED | Truths #2, #7; spot-check confirming value matches public source of truth. |
| PKG-04 | 24-01 | File/env override precedence preserved | ✓ SATISFIED | Truths #5, #6; live override spot-check. |
| PKG-05 | 24-02 | Real `uv build`/`uv tool install` round trip works outside repo | ✓ SATISFIED | Truths #1, #2, #8; full live round trip re-executed independently this session. |

No orphaned requirements — REQUIREMENTS.md maps only PKG-01..05 to Phase 24, and all five appear in
plan frontmatter (`24-01-PLAN.md`: PKG-01..04; `24-02-PLAN.md`: PKG-05).

### Anti-Patterns Found

None. Scanned all created/modified source and test files (`bizdays.py`, `config.py`, `cli.py`,
`data/__init__.py`, `test_calendar_vendored_parity.py`, `test_config_app_id_fallback.py`,
`test_packaging_live.py`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` — zero matches.

### Human Verification Required

None. Every truth was verified programmatically and live this session; no visual, real-time, or
external-service-dependent behavior applies to this phase.

### Gaps Summary

No gaps. All 5 requirements (PKG-01 through PKG-05) and all 5 ROADMAP.md success criteria are
independently, live-verified against the actual current state of `cli/` — not merely inferred from
SUMMARY.md's claims. A fresh `uv build` → `uv tool install --force` → run-from-outside-the-repo →
`uv tool uninstall` round trip was executed by this verification session itself (distinct from the one
already captured in `24-02-SUMMARY.md`) and produced identical, correct results. The developer machine
was confirmed left in a clean state (`uv tool list` → "No tools installed") both before this
verification began and after it concluded.

---

_Verified: 2026-08-12_
_Verifier: Claude (gsd-verifier)_
