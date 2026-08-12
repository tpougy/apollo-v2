---
phase: 24-packaging-installability
plan: 01
subsystem: infra
tags: [uv_build, importlib.resources, packaging, cli, python-dotenv, instantdb]

# Dependency graph
requires: []
provides:
  - "cli/apollo_cli/data/anbima-calendar.json — byte-identical vendored copy of shared/anbima-calendar.json, read via importlib.resources"
  - "bizdays.py with zero find_repo_root() dependency — import-time-safe outside the monorepo"
  - "config.py's InstantConfig.app_id_source field + Path | None env_file + _DEFAULT_APP_ID embedded fallback"
  - "cli.py doctor reporting app_id provenance (file vs embedded default) without altering the admin-token diagnostic"
  - "cli/tests/test_calendar_vendored_parity.py and cli/tests/test_config_app_id_fallback.py — permanent regression gates for PKG-02/03/04"
affects: [24-02-packaging-installability]

# Actuals (#2632)
actuals:
  tokens: 8950
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bundled package data read via importlib.resources.files(pkg).joinpath(name).read_text/read_bytes() instead of any find_repo_root()/__file__-relative path — the only pattern correct in every install mode (editable, wheel, zipimport)."
    - "Fallback-chain config resolution: wrap the deepest-nested lookup call itself (find_repo_root()) in try/except, not just the downstream 'value missing' branch — the actual crash site is earlier than the naive fix targets."

key-files:
  created:
    - cli/apollo_cli/data/anbima-calendar.json
    - cli/apollo_cli/data/__init__.py
    - cli/tests/test_calendar_vendored_parity.py
    - cli/tests/test_config_app_id_fallback.py
  modified:
    - cli/apollo_cli/bizdays.py
    - cli/apollo_cli/config.py
    - cli/apollo_cli/cli.py

key-decisions:
  - "Reconfirmed the embedded _DEFAULT_APP_ID value (7936ca82-5cb4-43c2-811d-788a6ec0d2a8) live by rebuilding web/ fresh (bun run build) and re-extracting from the freshly-built bundle, rather than trusting RESEARCH.md's [ASSUMED] tag blindly — the rebuild produced the byte-identical asset hash and the same UUID, confirming no staleness."
  - "Ran a live RED reproduction of the pre-fix crash (real uv build -> uv venv -> uv pip install -> apollo --version from /tmp) before writing any code, matching RESEARCH.md's documented Pitfall 1 traceback verbatim, then reran the identical round trip post-fix for GREEN — both real, not simulated."
  - "The plan's literal fundo listar verify step assumes a session-less environment; this dev machine has a real persisted ~/.config/apollo-cli/session from prior work, so the unmodified command returned a real (empty) query result at exit 0 instead of the expected no_session/exit 1. Re-ran with APOLLO_SESSION_FILE pointed at a nonexistent path to isolate from that pre-existing local state — confirmed the intended no_session/exit-1 behavior. This is an environment artifact of running on a dev machine with prior real logins, not a defect in the fix."

patterns-established:
  - "importlib.resources.files(...).joinpath(...) for any future package-bundled data file in cli/apollo_cli/ — never Path(__file__).parent-relative or find_repo_root()-based lookups for anything that must work post-install."

requirements-completed: [PKG-01, PKG-02, PKG-03, PKG-04]

coverage:
  - id: D1
    description: "bizdays.py reads the vendored calendar via importlib.resources with zero find_repo_root() dependency; business-day math (is_business_day/add_business_days/next_business_day) unchanged"
    requirement: "PKG-01"
    verification:
      - kind: unit
        ref: "cli/tests/test_bizdays.py (235 fixture cases, unmodified) — all pass"
        status: pass
      - kind: integration
        ref: "live scratch-venv round trip: uv build -> uv venv -> uv pip install -> python -c bizdays check from outside the repo"
        status: pass
    human_judgment: false
  - id: D2
    description: "Vendored cli/apollo_cli/data/anbima-calendar.json is byte-identical to shared/anbima-calendar.json, and the assertion is proven non-vacuous"
    requirement: "PKG-02"
    verification:
      - kind: unit
        ref: "cli/tests/test_calendar_vendored_parity.py::test_vendored_calendar_is_byte_identical_to_shared_source"
        status: pass
      - kind: unit
        ref: "mutate-then-revert cycle: deliberate one-byte mutation made the test fail (exit 1), then reverted to green"
        status: pass
    human_judgment: false
  - id: D3
    description: "load_instant_config() embeds a default app_id (_DEFAULT_APP_ID) as the last fallback, resolved only when no file/env resolves one, with app_id_source reporting provenance"
    requirement: "PKG-03"
    verification:
      - kind: unit
        ref: "cli/tests/test_config_app_id_fallback.py (10 tests covering full precedence chain + admin_token_present under every source)"
        status: pass
      - kind: integration
        ref: "live scratch-venv round trip: apollo doctor from outside the repo prints '(none — using embedded default app id)' + 'source: embedded default'"
        status: pass
    human_judgment: false
  - id: D4
    description: "find_repo_root()'s FileNotFoundError is caught at its call site inside load_instant_config(); explicit env_file/APOLLO_ENV_FILE/.env.instantdb overrides still take precedence over the embedded default in that exact order"
    requirement: "PKG-04"
    verification:
      - kind: unit
        ref: "cli/tests/test_config_app_id_fallback.py::test_missing_env_file_anywhere_falls_back_to_embedded_default, ::test_explicit_env_file_takes_precedence_over_apollo_env_file_var, ::test_apollo_env_file_env_var_overrides_embedded_default"
        status: pass
      - kind: integration
        ref: "live scratch-venv round trip: apollo --version/doctor/fundo listar all complete with zero traceback from outside apollo-v2 with no shared/ or .env.instantdb reachable"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-12
status: complete
---

# Phase 24 Plan 01: Vendor Calendar + Embed Default App ID Summary

**Removed the CLI's two monorepo-only filesystem dependencies — `bizdays.py`'s eager `find_repo_root()`-based calendar lookup and `config.py`'s `.env.instantdb`-or-crash app_id resolution — proven live via a real `uv build`/`uv venv`/`uv pip install` round trip from outside the repo.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 7 (2 created dirs/files: `data/anbima-calendar.json`, `data/__init__.py`; 3 modified: `bizdays.py`, `config.py`, `cli.py`; 2 new test files)

## Accomplishments

- Vendored `shared/anbima-calendar.json` into `cli/apollo_cli/data/anbima-calendar.json` (byte-identical, 18459 bytes) and rewrote `bizdays.py`'s module-level calendar load to use `importlib.resources.files("apollo_cli.data").joinpath(...)` instead of `find_repo_root()` — the exact eager import-time dependency that crashed every subcommand (including `--version`) when the package ran outside the monorepo (RESEARCH.md Pitfall 1).
- Added an embedded `_DEFAULT_APP_ID` constant to `config.py` (the real, public `NEXT_PUBLIC_INSTANT_APP_ID`, reconfirmed live this session — see Decisions below) and rewrote `load_instant_config()`'s fallback chain so `find_repo_root()`'s own `FileNotFoundError` — not just a missing app-id key — degrades cleanly to the embedded default instead of crashing (RESEARCH.md Pitfall 2). `InstantConfig` gained `app_id_source: str` (`"file"` | `"embedded_default"`) and `env_file` became `Path | None`.
- Updated `apollo doctor` to render `env_file=None` as `"(none — using embedded default app id)"` and to print the resolved `app_id_source` alongside the existing `app id: ok (...last4)` line, leaving the admin-token diagnostic completely untouched (byte-identical wording and logic, verified by rerunning the existing admin-token confinement AST-walk gates).
- Wrote two permanent regression tests: `test_calendar_vendored_parity.py` (byte-parity gate, proven non-vacuous via a deliberate mutate-then-revert cycle) and `test_config_app_id_fallback.py` (10 tests covering the full explicit-arg > `APOLLO_ENV_FILE` > `.env.instantdb` > embedded-default precedence chain, plus `admin_token_present` correctness under every app_id source).
- Proved the whole fix end-to-end with a real, live scratch-venv round trip: built the actual wheel, installed it into an isolated `uv venv`, and ran `apollo --version`/`apollo doctor`/`apollo fundo listar` plus a direct `python -c` bizdays correctness check from `/tmp` — outside the repo, with no `shared/` or `.env.instantdb` reachable — with zero traceback. Also reproduced the pre-fix crash live (RED) before implementing, to confirm the fix targets the real failure mode, not a hypothetical one.

## Task Commits

1. **Task 1: Vendor calendar + embed default app_id — end-to-end, live-proven outside the repo** - `3a24b08` (feat)
2. **Task 2: Regression tests for calendar byte-parity and app_id fallback chain** - `703bf31` (test)

_No separate plan-metadata commit was made per this project's convention — see `git log` for `SUMMARY.md`/`STATE.md`/`ROADMAP.md` update commit that follows this one._

## Files Created/Modified

- `cli/apollo_cli/data/anbima-calendar.json` - Byte-identical vendored copy of `shared/anbima-calendar.json` (18459 bytes)
- `cli/apollo_cli/data/__init__.py` - Empty, convention-only (not required for `importlib.resources` on Python 3.12's implicit namespace packages)
- `cli/apollo_cli/bizdays.py` - Module-level calendar load via `importlib.resources` instead of `find_repo_root()`; zero behavior change to business-day math
- `cli/apollo_cli/config.py` - `_DEFAULT_APP_ID` constant, `InstantConfig.app_id_source` + `env_file: Path | None`, `find_repo_root()` call site wrapped in `try/except FileNotFoundError`
- `cli/apollo_cli/cli.py` - `doctor` handles `env_file=None` and prints app_id provenance; admin-token line unchanged
- `cli/tests/test_calendar_vendored_parity.py` - Byte-parity gate (PKG-02)
- `cli/tests/test_config_app_id_fallback.py` - Fallback-chain unit tests (PKG-03/PKG-04)

## Decisions Made

- **Reconfirmed `_DEFAULT_APP_ID`'s value live rather than trusting RESEARCH.md's `[ASSUMED]` tag.** Rebuilt `web/` fresh (`cd web && bun run build`) immediately before extracting — the rebuild produced the byte-identical asset hash (`index-Be7yV2Yy.js`) already present in the gitignored `web/dist`, and the same single non-placeholder UUID (`7936ca82-5cb4-43c2-811d-788a6ec0d2a8`) was recovered, confirming no staleness risk.
- **Ran a live RED reproduction before implementing.** Built the current (unfixed) wheel, installed it into a throwaway venv, and ran `apollo --version` from `/tmp` — captured the exact `FileNotFoundError` traceback RESEARCH.md documented (Pitfall 1), confirming the fix targets the real, reproduced failure mode rather than a hypothetical one. Reran the identical round trip after implementing the fix for GREEN.
- **Isolated `APOLLO_SESSION_FILE` for the `fundo listar` verify step.** The plan's literal verify script assumes a session-less environment; this dev machine carries a real persisted session from prior `apollo auth login` use, so the unmodified command returned a real (empty) query result at exit 0 rather than the plan's expected `no_session`/exit 1. Setting `APOLLO_SESSION_FILE` to a nonexistent path for that one check isolated the test from this machine's pre-existing local state and confirmed the intended behavior — not a defect in the implementation, a session-state artifact of running verification on a machine with prior real logins.

## Deviations from Plan

### Auto-fixed Issues

None requiring code changes beyond the plan's own `<action>` — the only "deviation" was a verification-script adjustment (isolating `APOLLO_SESSION_FILE` for one live check), documented above under Decisions, not a Rule 1-4 code fix.

**1. [Rule 3 - Blocking, verification-only] Isolated `APOLLO_SESSION_FILE` for the `fundo listar` live check**
- **Found during:** Task 1's scratch-venv round trip
- **Issue:** This dev machine's real, persisted `~/.config/apollo-cli/session` (from prior legitimate `apollo auth login` use) caused `apollo fundo listar` to succeed with a real (empty) query result (exit 0) instead of the plan's expected `no_session` error (exit 1) — a pre-existing environment state, not a code defect.
- **Fix:** Reran the check with `APOLLO_SESSION_FILE` pointed at a nonexistent path inside the scratch outside-dir, isolating the verification from this machine's local session state.
- **Files modified:** None (verification-only, no source change)
- **Verification:** With the isolated session file, `apollo fundo listar` correctly returned `{"error": "no_session", ...}` at exit 1, matching the plan's `<done>` criteria exactly.

---

**Total deviations:** 1 (verification-only environment adjustment, no code change)
**Impact on plan:** None on scope or correctness — the underlying implementation behaves exactly as specified; only the local verification harness needed session isolation to match the plan's assumed "clean install" scenario.

## Issues Encountered

None beyond the verification-environment nuance documented above.

## User Setup Required

None - no external service configuration required. This plan touches only `cli/` source and test files; no new dependency was introduced (per CONTEXT.md decision 8).

## Next Phase Readiness

- All four of this plan's requirements (PKG-01 through PKG-04) are complete and live-verified.
- Plan 24-02 (packaging-installability's second plan) can proceed: it depends on this plan's fix landing first, and per its own scope owns `test_packaging_live.py`, the `packaging` pytest marker registration, the final full-suite acceptance round trip, and the `cli/README.md` update — none of which were touched here.
- `git diff --stat` for this plan touches exactly the 7 files declared in `files_modified`; no accidental edit to `shared/anbima-calendar.json`, `cli/apollo_cli/instant_client.py`, or any `web/` file.
- Admin-token confinement gates (`test_auth_rejection.py::test_admin_token_confinement`, `test_instant_client.py::test_admin_token_key_confined_to_exempt_modules`) rerun clean — no admin-token leak was introduced alongside the new `_DEFAULT_APP_ID` constant (T-24-01-02 mitigated).
- Full non-live suite (`uv run pytest -m "not live"`): 326 passed, 2 skipped, 0 failed.

---
*Phase: 24-packaging-installability*
*Completed: 2026-08-12*

## Self-Check: PASSED

All 7 created/modified source and test files confirmed present on disk; both task commits (`3a24b08`, `703bf31`) confirmed present in `git log`.
