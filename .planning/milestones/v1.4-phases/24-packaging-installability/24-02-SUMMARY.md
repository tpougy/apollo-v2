---
phase: 24-packaging-installability
plan: 02
subsystem: infra
tags: [uv_build, uv-tool-install, pytest-markers, packaging, cli]

# Dependency graph
requires:
  - phase: 24-packaging-installability (plan 24-01)
    provides: "cli/apollo_cli/data/anbima-calendar.json, bizdays.py's importlib.resources rewrite, config.py's _DEFAULT_APP_ID/fallback chain/app_id_source, cli.py's doctor provenance output"
provides:
  - "cli/tests/test_packaging_live.py — permanent, automated pytest regression proof of PKG-05 (real uv build/uv venv/uv pip install round trip, marked `packaging`)"
  - "cli/pyproject.toml's `packaging` pytest marker, distinct from `live`"
  - "Confirmation that the admin-token confinement gates needed zero exemption-list changes for plan 24-01's `_DEFAULT_APP_ID`"
  - "cli/README.md documenting the embedded-default app_id fallback and the global `uv tool install` path"
  - "A verbatim-captured, real `uv tool install --force` / run-outside-repo / `uv tool uninstall apollo-cli` acceptance round trip (this document)"
affects: [25-cli-login-without-admin-token]

# Actuals (#2632)
actuals:
  tokens: 1965
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A distinct `packaging` pytest marker (separate from `live`) for tests that shell out to real build/filesystem subprocess tooling (uv build/uv venv/uv pip install) rather than the InstantDB network API — keeps `-m \"not live and not packaging\"` a fast, fully-offline inner loop."
    - "A permanent live-packaging regression test doubles as a correctness gate, not just an import-safety gate — it asserts business-day math results (is_business_day/add_business_days), not merely that the module imports without crashing, from a genuinely installed wheel outside the repo."

key-files:
  created:
    - cli/tests/test_packaging_live.py
  modified:
    - cli/pyproject.toml
    - cli/README.md

key-decisions:
  - "Isolated APOLLO_SESSION_FILE (pointed at a guaranteed-nonexistent path) both inside test_packaging_live.py's fundo listar subprocess call and in this plan's own manual acceptance round trip — this dev machine carries a real persisted apollo-cli session from prior manual testing (same environment artifact plan 24-01 documented), which would otherwise make fundo listar return a real (empty) result at exit 0 instead of exercising the no_session/exit-1 contract the test and the acceptance bar require."
  - "Fixed a ruff ISC004 (implicit string concatenation inside a list literal) in test_packaging_live.py's bizdays -c invocation, found while running Task 2's final quality gate — extracted the concatenated string into a named `bizdays_snippet` variable before the subprocess.run() call list, rather than parenthesizing the concatenation in place, for readability."

patterns-established:
  - "Live packaging round-trip proofs (uv build -> uv venv/uv tool install -> run outside repo -> uninstall) get their own pytest marker, separate from network-live tests, so the fast offline test loop stays fast while the full/CI loop still exercises the real subprocess chain."

requirements-completed: [PKG-05]

coverage:
  - id: D1
    description: "cli/tests/test_packaging_live.py — permanent automated live packaging round-trip proof (real uv build/uv venv/uv pip install, run outside the repo, correctness-checks bizdays math, checks doctor's embedded-default provenance, checks fundo listar's no_session contract)"
    requirement: "PKG-05"
    verification:
      - kind: integration
        ref: "cli/tests/test_packaging_live.py::test_installed_wheel_runs_outside_repo_with_no_shared_or_env_file — passed"
        status: pass
    human_judgment: false
  - id: D2
    description: "packaging pytest marker registered in cli/pyproject.toml, applied to test_packaging_live.py, with no PytestUnknownMarkWarning"
    requirement: "PKG-05"
    verification:
      - kind: unit
        ref: "uv run pytest tests/test_packaging_live.py -v -m packaging (with -W error::pytest.PytestUnknownMarkWarning) — passed, no warning"
        status: pass
    human_judgment: false
  - id: D3
    description: "Admin-token confinement structural gates (test_auth_rejection.py::test_admin_token_confinement, test_instant_client.py::test_admin_token_key_confined_to_exempt_modules) pass with zero exemption-list changes made in this plan"
    verification:
      - kind: unit
        ref: "uv run pytest tests/test_auth_rejection.py tests/test_instant_client.py -k \"admin_token_confinement or admin_token_key_confined_to_exempt_modules\" — 26 passed, 2 skipped (config.py/instant_client.py legitimately exempt), 0 failed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full cli/ + ../shared/scripts quality gate (ruff check, ruff format --check, ty check) all clean; full uv run pytest (all markers) shows 0 failures"
    verification:
      - kind: other
        ref: "uv run ruff check/ruff format --check/ty check --config pyproject.toml . ../shared/scripts — all clean; uv run pytest -q — 415 passed, 2 skipped, 1 xfailed, 0 failed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real uv tool install --force / run-outside-the-repo (apollo --version, apollo doctor, apollo fundo listar) / uv tool uninstall apollo-cli / uv tool list acceptance round trip executed once, live, with output captured verbatim; uv tool list confirms a clean machine afterward"
    requirement: "PKG-05"
    verification:
      - kind: manual_procedural
        ref: "See '## Manual Acceptance Round Trip (Verbatim Transcript)' below in this document"
        status: pass
    human_judgment: false

# Metrics
duration: ~30min
completed: 2026-08-12
status: complete
---

# Phase 24 Plan 02: Packaging Regression Tests + Final Quality Gate + Real Install Acceptance Summary

**Permanent `test_packaging_live.py` pytest gate (new `packaging` marker) formalizes plan 24-01's one-time scratch-venv proof into a standing regression check, and the phase's literal acceptance bar — a real `uv tool install --force` / run-outside-the-monorepo / `uv tool uninstall` round trip — was executed live with output captured verbatim below.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-12T19:45:21Z
- **Completed:** 2026-08-12T19:49:13Z
- **Tasks:** 2
- **Files modified:** 3 (`cli/tests/test_packaging_live.py` created, `cli/pyproject.toml` and `cli/README.md` modified)

## Accomplishments

- Wrote `cli/tests/test_packaging_live.py`: a real (never mocked) `uv build` → `uv venv` → `uv pip install` → run-from-outside-the-repo round trip, marked `packaging`. Beyond `--version`/`doctor`/`fundo listar` checks, it also runs a direct `python -c` correctness check of `apollo_cli.bizdays`'s `is_business_day`/`add_business_days` from the installed wheel — the permanent guard against the exact "one-time proof stops being checked once its scratch dirs are deleted" gap the plan-checker flagged for plan 24-01.
- Registered a new `packaging` pytest marker in `cli/pyproject.toml`, distinct from the existing `live` marker (per RESEARCH.md's Open Question 2 resolution) — keeps `uv run pytest -m "not live and not packaging"` a fast, fully-offline inner loop while `uv run pytest` (no filter) still exercises the real subprocess chain.
- Confirmed both admin-token confinement structural gates (`test_auth_rejection.py::test_admin_token_confinement`, `test_instant_client.py::test_admin_token_key_confined_to_exempt_modules`) pass with **zero** exemption-list changes — plan 24-01's `_DEFAULT_APP_ID` constant required no widening of the admin-token blast radius.
- Ran the full `cli/` + `../shared/scripts` quality gate: `ruff check`, `ruff format --check`, `ty check` all clean; full `uv run pytest` (all markers, including `live`/`packaging`) — 415 passed, 2 skipped, 1 xfailed, **0 failures**.
- Executed the phase's headline literal acceptance proof exactly once, live: a real `uv build` → `uv tool install --force` → `apollo --version`/`apollo doctor`/`apollo fundo listar` from `/tmp` (outside `apollo-v2`) → `uv tool uninstall apollo-cli` → `uv tool list` round trip. Full verbatim transcript captured below. Machine confirmed clean afterward (`uv tool list` → "No tools installed").
- Updated `cli/README.md`: the `doctor`-description paragraph now documents the fallback chain (explicit `env_file` > `APOLLO_ENV_FILE` > `.env.instantdb` > embedded default) instead of assuming `.env.instantdb` is always resolvable, and a new "Global install (`uv tool install`)" subsection under `## Install` documents the supported global-install sequence. The `## About the admin token` section's substance is unchanged.

## Task Commits

1. **Task 1: Automated live packaging regression test + admin-token gate confirmation** - `ed753ae` (test)
2. **Task 2: Final quality gate + real `uv tool install` acceptance round trip + README update** - `9f3e88e` (docs)

_No separate plan-metadata commit is made yet — see the STATE.md/ROADMAP.md/REQUIREMENTS.md update commit that follows this SUMMARY, per this project's standing convention (see plan 24-01-SUMMARY.md's identical note)._

## Files Created/Modified

- `cli/tests/test_packaging_live.py` - Permanent live `uv build`/`uv venv`/`uv pip install` round-trip regression test (PKG-05), marked `packaging`
- `cli/pyproject.toml` - New `packaging` pytest marker registered in `[tool.pytest.ini_options] markers`
- `cli/README.md` - `doctor`-description paragraph updated for the fallback chain; new "Global install (`uv tool install`)" subsection added under `## Install`

## Decisions Made

- **Isolated `APOLLO_SESSION_FILE` for every `fundo listar` invocation in this plan** — both inside `test_packaging_live.py`'s subprocess call and in the manual acceptance round trip below — because this dev machine carries a real, persisted `~/.config/apollo-cli/session` from prior manual testing (the same environment artifact plan 24-01's SUMMARY documented). Without isolation, `fundo listar` would return a real (empty) query result at exit 0 instead of exercising the `no_session`/exit-1 contract the test and the acceptance bar require, making the test/round-trip behave differently on this machine than on a genuinely fresh install.
- **Extracted the bizdays `-c` snippet into a named variable rather than parenthesizing it in place** when fixing the ruff `ISC004` finding (see Deviations below) — slightly more readable than a parenthesized multi-line string directly inside the `subprocess.run()` argument list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ruff `ISC004` (implicit string concatenation in a list literal)**
- **Found during:** Task 2's final quality-gate run (`uv run ruff check`)
- **Issue:** `test_packaging_live.py`'s `bizdays -c` invocation built its script string via bare adjacent string literals directly inside a list literal (`subprocess.run([..., "-c", "a " "b " "c", ...])`), which ruff's `ISC004` flags as an unparenthesized implicit concatenation inside a collection (risk of a missing comma going unnoticed).
- **Fix:** Extracted the four concatenated string literals into a single named `bizdays_snippet` variable, assigned before the `subprocess.run()` call, then passed `bizdays_snippet` as the single list element.
- **Files modified:** `cli/tests/test_packaging_live.py`
- **Verification:** `uv run ruff check` clean; re-ran `uv run pytest tests/test_packaging_live.py -v -m packaging` — still passes.
- **Committed in:** `9f3e88e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3)
**Impact on plan:** Zero scope creep — a lint-only fix inside the same file/task the plan already specified, found and fixed as part of running the plan's own quality-gate verification step.

## Issues Encountered

None beyond the documented deviation above.

## User Setup Required

None - no external service configuration required. This plan touches only `cli/tests/`, `cli/pyproject.toml`, and `cli/README.md`; no new runtime or dev dependency was added (per CONTEXT.md decisions 7-8).

## Manual Acceptance Round Trip (Verbatim Transcript)

This is the literal, real `uv tool install`/`uv tool uninstall` acceptance proof this phase's requirement text (PKG-05) explicitly demands ("comprovado via instalação real em ambiente isolado, não apenas inspeção estática"). Every command below was actually executed once, live, from `cli/apollo-v2` and then from `/tmp` — not mocked, not simulated.

**Starting state check:**

```
$ uv tool list
No tools installed
```

**Build:**

```
$ cd cli && rm -rf /tmp/apollo24-final-dist && uv build --out-dir /tmp/apollo24-final-dist
Building source distribution (uv build backend)...
Building wheel from source distribution (uv build backend)...
Successfully built /tmp/apollo24-final-dist/apollo_cli-0.1.0.tar.gz
Successfully built /tmp/apollo24-final-dist/apollo_cli-0.1.0-py3-none-any.whl
```

**Global tool install:**

```
$ uv tool install --force /tmp/apollo24-final-dist/apollo_cli-*.whl
Resolved 27 packages in 12ms
Prepared 1 package in 4ms
Installed 27 packages in 29ms
 + anyio==4.14.2
 + apollo-cli==0.1.0 (from file:///tmp/apollo24-final-dist/apollo_cli-0.1.0-py3-none-any.whl)
 + bizdays==1.0.19
 + certifi==2026.7.22
 + cffi==2.1.1
 + click==8.4.2
 + cryptography==50.0.0
 + exchange-calendars==4.13.2
 + h11==0.16.0
 + httpcore==1.0.9
 + httpx==0.28.1
 + httpx-sse==0.4.3
 + idna==3.18
 + instantdb==1.0.65
 + korean-lunar-calendar==0.4.0
 + numpy==2.5.2
 + pandas==2.3.3
 + pandas-market-calendars==4.6.1
 + pycparser==3.0
 + pyluach==2.3.0
 + python-dateutil==2.9.0.post0
 + python-dotenv==1.2.2
 + pytz==2026.3.post1
 + six==1.17.0
 + toolz==1.1.0
 + typing-extensions==4.16.0
 + tzdata==2026.3
Installed 1 executable: apollo
```

**From `/tmp` (outside `apollo-v2`, no `shared/`, no `.env.instantdb` reachable):**

```
$ cd /tmp && apollo --version
apollo, version 0.1.0
(exit code 0)
```

```
$ apollo doctor
env file: (none — using embedded default app id)
app id: ok (...d2a8) — source: embedded default
admin token: absent
(exit code 0)
```

```
$ APOLLO_SESSION_FILE=/tmp/apollo24-final-nonexistent-session/session apollo fundo listar
(stdout: empty)
(stderr:) {"error": "no_session", "hint": "run: apollo auth login --email <seu-email>"}
(exit code 1)
```

`APOLLO_SESSION_FILE` was overridden to a guaranteed-nonexistent path for this one command — see "Decisions Made" above; this dev machine's own real persisted session would otherwise have returned a real (empty) result at exit 0 instead of exercising the `no_session` contract.

**Cleanup — uninstall:**

```
$ uv tool uninstall apollo-cli
Uninstalled 1 executable: apollo
(exit code 0)
```

**Cleanup — confirm clean state:**

```
$ uv tool list
No tools installed
(exit code 0)
```

```
$ which apollo
apollo not found
(exit code 1)
```

`/tmp/apollo24-final-dist` and the isolated session-file scratch path were removed after the round trip. The developer machine's global `uv tool` registry was left in exactly the state it started in.

## Next Phase Readiness

- Phase 24 (Packaging & Installability) is now fully complete: all five requirements (PKG-01 through PKG-05) are implemented and live-verified — PKG-01–04 by plan 24-01, PKG-05 by this plan.
- `cli/tests/test_packaging_live.py` is the permanent, standing regression gate for PKG-05 — any future change to `bizdays.py`, `config.py`, or `pyproject.toml`'s build-backend settings that breaks the outside-the-repo install will be caught automatically by `uv run pytest` (or explicitly via `-m packaging`), without requiring another manual round trip.
- `git diff --stat` for this plan's two commits touches exactly `cli/tests/test_packaging_live.py`, `cli/pyproject.toml`, and `cli/README.md` — no accidental edit to `web/`, schema, or `shared/anbima-calendar.json`.
- The developer machine's global `uv tool` state was left clean (`uv tool list` → "No tools installed") after the acceptance round trip — no residual `apollo-cli` install lingers from this plan's verification.
- Phase 25 (CLI login without admin token) can proceed independently — this plan touched only test/doc/config-marker surfaces, not `auth.py`/`instant_client.py`.

---
*Phase: 24-packaging-installability*
*Completed: 2026-08-12*

## Self-Check: PASSED

`cli/tests/test_packaging_live.py` confirmed present on disk; `cli/pyproject.toml`'s `packaging` marker line and `cli/README.md`'s new "Global install" subsection confirmed present via `git diff`. Both task commits (`ed753ae`, `9f3e88e`) confirmed present in `git log --oneline`.
