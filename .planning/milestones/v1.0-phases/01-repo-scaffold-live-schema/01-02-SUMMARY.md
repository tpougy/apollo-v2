---
phase: 01-repo-scaffold-live-schema
plan: 02
subsystem: cli
tags: [uv, python312, click, ruff, ty, instantdb, python-dotenv]

# Dependency graph
requires: []
provides:
  - "cli/ — uv-managed, fully typed Python 3.12 package with the apollo entrypoint"
  - "cli/apollo_cli/config.py — find_repo_root(), InstantConfig, load_instant_config() (repo-root-independent .env.instantdb resolution)"
  - "cli/apollo_cli/cli.py — apollo click group, main(), doctor subcommand"
  - "Curated ruff (extend-select I, ANN) + ty quality-gate configuration in cli/pyproject.toml, proven at zero findings"
affects: [03-cli-crud, 05-routine-job, 06-parity-verification]

# Actuals
actuals:
  tokens: ~4200
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: ["click==8.4.2", "python-dotenv==1.2.2", "instantdb==1.0.63", "ruff==0.16.2", "ty==0.0.69"]
  patterns:
    - "uv init --package defaults to src/ layout; this repo's LOCKED tree wants cli/apollo_cli/ (flat, no src/), fixed via [tool.uv.build-backend] module-root = \"\" in pyproject.toml rather than fighting the scaffolder."
    - "Repo-root discovery by upward directory walk from Path(__file__), stopping at the first ancestor containing a known sentinel file (.env.instantdb) — cwd-independent, verified by running `apollo doctor` from /tmp via `uv run --project`."
    - "Credential-presence-only config objects: InstantConfig carries admin_token_present: bool, never the token value itself; dotenv_values() (not load_dotenv()) keeps the value out of os.environ entirely."
    - "Trust ruff's curated defaults (413 rules/34 categories in 0.16.x) plus a narrow extend-select (I, ANN) instead of hand-writing a select list — satisfies C-08's 'curated, not ALL' with zero source-code changes needed."

key-files:
  created:
    - cli/pyproject.toml
    - cli/uv.lock
    - cli/.python-version
    - cli/README.md
    - cli/apollo_cli/__init__.py
    - cli/apollo_cli/config.py
    - cli/apollo_cli/cli.py
  modified: []

key-decisions:
  - "Moved uv's generated src/apollo_cli/ to cli/apollo_cli/ (flat layout) to match the LOCKED repo tree (PROJECT.md C-01: cli/apollo_cli/bizdays.py, not cli/src/apollo_cli/), and added [tool.uv.build-backend] module-root = \"\" so the uv_build backend still discovers the package correctly."
  - "doctor prints only the env file path, the app id's last 4 characters, and a boolean for admin-token presence — never a full credential value — satisfying threat T-01-08."
  - "instantdb (Python Admin SDK) is declared as a runtime dependency and resolved by uv sync on Python 3.12 but is not imported anywhere yet, de-risking RESEARCH Open Question 1 for Phase 3 without doing any Phase 3 work early."

patterns-established:
  - "Quality gate definition of done for every cli/ Python file: uv run ruff check . && uv run ruff format --check . && uv run ty check, all zero-finding, documented in cli/README.md."

requirements-completed: [SETUP-01, SETUP-02, SETUP-04]

coverage:
  - id: D1
    description: "cli/ is a uv-managed Python 3.12 package; uv sync resolves click, instantdb, and python-dotenv"
    requirement: "SETUP-02"
    verification:
      - kind: other
        ref: "cd cli && uv sync (exit 0, cli/uv.lock generated, 17 packages installed including instantdb 1.0.63 on Python 3.12.12)"
        status: pass
    human_judgment: false
  - id: D2
    description: "apollo --help / --version / doctor all exit 0, doctor works cwd-independently"
    requirement: "SETUP-02"
    verification:
      - kind: other
        ref: "uv run apollo --help | grep doctor; uv run apollo --version; uv run apollo doctor; cd /tmp && uv run --project <cli> apollo doctor"
        status: pass
    human_judgment: false
  - id: D3
    description: "doctor never prints NEXT_PUBLIC_INSTANT_APP_ID or INSTANT_APP_ADMIN_TOKEN in full; INSTANT_APP_ADMIN_TOKEN never referenced in cli.py"
    requirement: "SETUP-02"
    verification:
      - kind: other
        ref: "grep -F full app-id/token values against `apollo doctor` output (both absent); grep -c INSTANT_APP_ADMIN_TOKEN cli/apollo_cli/cli.py == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "ruff check, ruff format --check, and ty check all exit 0 with zero findings and zero suppressions"
    requirement: "SETUP-04"
    verification:
      - kind: other
        ref: "cd cli && uv run ruff check . && uv run ruff format --check . && uv run ty check (all 'All checks passed!' / 'already formatted'); grep confirms no # noqa, # type: ignore, per-file-ignores, or select= list"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-09
status: complete
---

# Phase 1 Plan 02: CLI Scaffold & Quality Gates Summary

**uv-managed `apollo-cli` Python 3.12 package with the `apollo` click entrypoint, cwd-independent `.env.instantdb` discovery, and both `ruff`/`ty` quality gates green with zero suppressions on the first pass.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-09T06:12Z (approx, `uv init` invocation)
- **Completed:** 2026-08-09T06:37Z (Task 2 commit)
- **Tasks:** 2/2 completed
- **Files modified:** 7 files created (Task 1), 1 file modified (Task 2)

## Accomplishments

- `cli/` is a real, installable `uv`-managed Python 3.12 package: `uv sync` resolves 17 packages including `click`, `python-dotenv`, and `instantdb` (the real Phase 3 Admin SDK dependency) against Python 3.12.12, never falling back to the system's 3.10 `python3`.
- `apollo --help`, `--version`, and `doctor` all work, and `doctor` resolves the repo-root `.env.instantdb` correctly even when invoked from `/tmp` via `uv run --project`, proving the upward-directory-walk repo-root discovery is genuinely cwd-independent.
- `apollo doctor` never prints the full `NEXT_PUBLIC_INSTANT_APP_ID` or `INSTANT_APP_ADMIN_TOKEN` values — only the app id's last 4 characters and a presence boolean for the admin token. `INSTANT_APP_ADMIN_TOKEN` does not appear anywhere in `cli.py` at all (only in `config.py`'s presence check).
- Both quality gates (`ruff check`, `ruff format --check`, `ty check`) pass with zero findings against the Task 1 source on the first run — no `# noqa`, no `# type: ignore`, no `per-file-ignores`, and no hand-written `select` list (trusting ruff 0.16.x's curated ~413-rule default plus a narrow `extend-select = ["I", "ANN"]`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the uv-managed apollo-cli package with the `apollo` entrypoint and repo-root config discovery** - `5b456cf` (feat)
2. **Task 2: Configure the curated ruff rule set and ty, and drive both to zero findings** - `3f83d41` (feat)

_No TDD tasks in this plan (infrastructure/scaffolding, not application behavior)._

## Files Created/Modified

- `cli/pyproject.toml` - uv manifest: `[project.scripts] apollo`, runtime deps (`click`, `python-dotenv`, `instantdb`), dev deps (`ruff`, `ty`), `[tool.uv.build-backend] module-root = ""` (flat layout fix), `[tool.ruff]`/`[tool.ruff.lint]`/`[tool.ty.environment]`
- `cli/uv.lock` - locked resolution of the full dependency tree (17 packages)
- `cli/.python-version` - pins `3.12`
- `cli/README.md` - install/run/gate-command documentation, explicit note that the admin token is never read by CLI runtime
- `cli/apollo_cli/__init__.py` - package marker
- `cli/apollo_cli/config.py` - `ENV_FILENAME`, `find_repo_root()`, `InstantConfig`, `load_instant_config()`
- `cli/apollo_cli/cli.py` - `apollo` click group, `main()`, `doctor` subcommand

## Decisions Made

- **Flat package layout via `module-root = ""`:** `uv init --package --app` scaffolds a `src/`-layout package by default. The LOCKED repo tree in PROJECT.md (C-01) specifies `cli/apollo_cli/bizdays.py`, i.e. no `src/` indirection. Rather than hand-writing the build-backend config from scratch, moved the generated `src/apollo_cli/` to `cli/apollo_cli/` and added `[tool.uv.build-backend] module-root = ""` — a one-line, documented `uv_build` setting for exactly this flat-layout case (verified via Context7 docs before use, not guessed).
- **`instantdb` declared but unused:** Per the plan, added as a runtime dependency so `uv sync` proves the real Phase 3 dependency tree resolves against Python 3.12 now, while there is only one file to fix if it doesn't — it resolved cleanly (1.0.63) with no import used anywhere in Phase 1 code.
- **No `ignore` entries needed:** The plan anticipated possible `COM812`/`ISC001` conflicts with `ruff format`; none materialized — `ruff check .` was clean immediately after writing `config.py`/`cli.py`, so `[tool.ruff.lint] ignore` remains absent entirely (empty is the expected/best outcome per the plan's `<output>` instruction).
- **`ty` version confirmed:** `ty 0.0.69` (matches the plan's `<environment_facts>` pin exactly) — `uv run ty check` passed with zero errors/warnings on the first run; no pre-1.0 diagnostic quirks were encountered, so no workaround needed to record.

## Deviations from Plan

None — plan executed exactly as written. The only structural adjustment (flat layout via `module-root = ""`) was anticipated by the plan's own read-first guidance ("Use uv's scaffolder rather than hand-writing `pyproject.toml`... Delete any placeholder module uv generates that is not `apollo_cli/`") and resolved within Task 1 before its verification block ran — not a deviation from the specified outcome, just the mechanical step needed to reach it.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. `.env.instantdb` already existed at the repo root (provisioned during plan 01-01) with `NEXT_PUBLIC_INSTANT_APP_ID` and `INSTANT_APP_ADMIN_TOKEN`; this plan only reads it, never writes to it.

## Next Phase Readiness

- `cli/` is a working, fully-typed, gate-clean Python 3.12 package ready to host Phase 3's full CLI CRUD + auth surface (`fundo`, `projeto`, `etapa`, `tarefa`, `ticket`, `subtarefa`, `rotina`, `log-inferencia`, `auth` subcommand groups attach to the `apollo` click group established here).
- `find_repo_root()`/`load_instant_config()` in `config.py` are the exported contract Phase 2's `bizdays.py` will reuse for its own repo-root-relative `shared/anbima-calendar.json` lookup.
- RESEARCH Open Question 1 (whether the Python `instantdb` package supports a non-admin-token magic-code auth path) remains open and unaddressed by design — Phase 3 research must resolve it before CLI auth implementation begins; this plan only proves the dependency resolves on Python 3.12.
- `web/` (from plan 01-01) and `cli/` (this plan) are both now scaffolded; plan 01-03 (per ROADMAP) is responsible for the remaining full-layout gate and any cross-cutting phase-1 verification.

---
*Phase: 01-repo-scaffold-live-schema*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 8 claimed files verified present on disk (`cli/pyproject.toml`, `cli/uv.lock`, `cli/.python-version`, `cli/README.md`, `cli/apollo_cli/__init__.py`, `cli/apollo_cli/config.py`, `cli/apollo_cli/cli.py`, `.planning/phases/01-repo-scaffold-live-schema/01-02-SUMMARY.md`). All 3 commit hashes (`5b456cf`, `3f83d41`, `0b02588`) verified present in git history.
