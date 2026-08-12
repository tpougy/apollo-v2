# Phase 24: Packaging & Installability - Research

**Researched:** 2026-08-12
**Domain:** Python packaging (`uv_build` PEP 517 backend), `importlib.resources`, `uv tool install` distribution
**Confidence:** HIGH (packaging mechanics fully verified live this session via real `uv build`/install/run cycles); MEDIUM-LOW on one specific literal value (see Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Vendor, don't move.** Copy `shared/anbima-calendar.json` to `cli/apollo_cli/data/anbima-calendar.json`. The original in `shared/` stays untouched (still the source `web/` reads). Declare the copy as package-data in `pyproject.toml`'s `[tool.uv.build-backend]` so `uv build` includes it in the wheel.
2. **Read via `importlib.resources`.** `cli/apollo_cli/bizdays.py` currently does `find_repo_root() / "shared" / "anbima-calendar.json"` — replace with `importlib.resources.files("apollo_cli.data").joinpath("anbima-calendar.json")`. `find_repo_root()` itself is NOT removed (still used by `config.py` for `.env.instantdb` discovery) — only `bizdays.py`'s usage of it goes away.
3. **Byte-parity test.** Add a pytest test that reads both `shared/anbima-calendar.json` and `cli/apollo_cli/data/anbima-calendar.json` and asserts identical bytes. This test may use `find_repo_root()` itself (tests always run inside the repo checkout) to locate the `shared/` original.
4. **Embed a default `app_id`.** `NEXT_PUBLIC_INSTANT_APP_ID` is public (already shipped in the `web/` bundle) — read the current value from the repo's `.env.instantdb` and hardcode it as a module-level constant (e.g. `_DEFAULT_APP_ID`) in `cli/apollo_cli/config.py`.
5. **New fallback order for `load_instant_config()`'s app_id resolution:** explicit `env_file` arg > `APOLLO_ENV_FILE` > `.env.instantdb` via `find_repo_root()` > **embedded default** (new — replaces raising `ValueError` when no file/key resolves an app_id). `.env.instantdb`/`APOLLO_ENV_FILE` remain valid overrides (e.g. to point at a staging app) — the embedded default is only used when nothing else resolves an app_id.
6. **`INSTANT_APP_ADMIN_TOKEN` gets NO default.** It is a real secret and must never be embedded in the package. `admin_token_present`/`apollo doctor` are explicitly kept as-is — used to support project development (e.g. an AI agent checking whether the local `.env.instantdb` has an admin token configured for admin/seed tasks). Only touch `apollo doctor`'s output enough to correctly reflect whether the resolved app_id came from a file or from the embedded default — do not otherwise alter the admin-token diagnostic.
7. **Scope is `cli/` only.** No changes to `web/`, schema, perms, or the original `shared/anbima-calendar.json` (read-only).
8. **No new runtime dependency** beyond what's already transitive (httpx via instantdb) — this phase doesn't need httpx directly (that's Phase 25), but don't introduce anything else either.

### Claude's Discretion

None declared beyond the decisions above — CONTEXT.md states "None beyond the Implementation Decisions above — those are the full spec for this phase." The exact shape of `InstantConfig`'s new field(s) (e.g. whether `env_file` becomes `Path | None`, whether an `app_id_source` field is added) is left to the planner/executor to design, constrained by decision 6's requirement that `doctor` correctly reflects file-vs-embedded-default provenance. See `## Common Pitfalls` and `## Code Examples` below for a verified-workable shape.

### Deferred Ideas (OUT OF SCOPE)

None — "scope for this phase is fully closed per REQUIREMENTS.md/ROADMAP.md."
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | Vendor `shared/anbima-calendar.json` into `cli/apollo_cli/data/anbima-calendar.json`, included in the wheel via `uv_build` package-data config, read via `importlib.resources` instead of `find_repo_root()` in `bizdays.py`. | Verified live: **zero `pyproject.toml` changes are needed** — the existing `module-root = ""` setting already causes `uv_build` to include every file under `apollo_cli/` (including new subdirectories) in the wheel by default. Confirmed by building a toy package and the real `cli/` package and inspecting wheel contents. `importlib.resources.files("apollo_cli.data").joinpath(...)` pattern verified end-to-end (built wheel → installed in isolated venv → resource read from outside the repo). |
| PKG-02 | Byte-parity pytest test between `shared/anbima-calendar.json` and the vendored copy. | Existing test conventions read (`test_calendar_json.py`, `test_bizdays.py`) — both use `find_repo_root()` + `Final` constants + docstring-documented intent. Code Example provided below matching that style. |
| PKG-03 | Hardcoded default `app_id` constant in `config.py`, extracted from `.env.instantdb`. | The literal value could not be read directly from `.env.instantdb` (hard-denied by sandbox permissions — see Pitfall 7) but was recovered from the already-public, gitignored, locally-built `web/dist/assets/index-*.js` bundle, which `vite.config.ts` bakes the value into verbatim. Recovered value tagged `[ASSUMED]` — executor must confirm freshness (see Assumptions Log). |
| PKG-04 | `.env.instantdb`/`APOLLO_ENV_FILE` continue to override; embedded default becomes new last fallback, replacing the `ValueError` raise. | Read `config.py` in full — the *actual* current failure mode is subtler than "raises `ValueError`": `find_repo_root()` itself raises `FileNotFoundError` **before** `dotenv_values()` is ever called, in the branch with no explicit `env_file`/`APOLLO_ENV_FILE`. The fix must catch that too, not just guard the "no app_id key" `ValueError` path. See Pitfall 2 and the `config.py` Code Example. |
| PKG-05 | `uv build`/`uv tool install` succeed from a clean checkout; `apollo --version`/`apollo doctor`/a read-only subcommand work from outside `apollo-v2` with no `shared/`/`.env.instantdb`. | Full live reproduction performed this session: built the *current* (unfixed) wheel, ran `uv tool install`, executed `apollo --version` from `/tmp`, captured the exact real traceback (`FileNotFoundError` at `bizdays.py:35`), then `uv tool uninstall`'d cleanly. This is now a repeatable, scripted procedure — see `## Code Examples` and `## Common Pitfalls` (Pitfall 1). |

</phase_requirements>

## Summary

This phase's packaging question has a much simpler answer than the phase description implies: **`uv_build` needs no new configuration at all for PKG-01.** The repo's `cli/pyproject.toml` already sets `[tool.uv.build-backend] module-root = ""`, which tells `uv_build` the importable module (`apollo_cli`) lives directly under `cli/`. `uv_build`'s wheel-building rule is "include the whole module directory, minus `__pycache__`/`*.pyc`/`*.pyo` and anything in `wheel-exclude`" — there is no setuptools-style `package_data`/`MANIFEST.in` mechanism, and none is needed: dropping `anbima-calendar.json` into `apollo_cli/data/` is sufficient by itself. This was verified live this session by building both a minimal toy package and the real `cli/` package and inspecting the resulting wheel's file listing with `zipfile`.

The runtime-read side (`importlib.resources.files("apollo_cli.data").joinpath("anbima-calendar.json")`) was verified end-to-end: built a wheel, installed it into a throwaway `uv venv`, and successfully read the resource from a Python process running outside the source tree, in `/tmp`. `apollo_cli/data/` does **not** need an `__init__.py` for this to work — Python 3.12's implicit namespace package support resolves `apollo_cli.data` as an importable anchor even with zero `__init__.py`, confirmed by direct test. Adding one anyway is a reasonable, harmless convention choice but not a functional requirement.

The `config.py` side (PKG-03/04) has a genuine landmine the phase description doesn't fully spell out: `find_repo_root()` — which will still be `config.py`'s only caller after this phase — currently *raises `FileNotFoundError`* (not returns `None`) when no `.env.instantdb` exists anywhere up the directory tree from `Path(__file__)`. This happens **before** `dotenv_values()` is ever called, in the "no explicit `env_file`, no `APOLLO_ENV_FILE`" branch. A fix that only wraps the "no app_id key found in file" `ValueError` path (the error the requirements text describes) will still crash with an uncaught `FileNotFoundError` in the actual clean-install scenario PKG-05 is supposed to prove works. This was confirmed by literally installing the current wheel into an isolated venv and running `apollo --version` from outside the repo — it crashes with exactly this traceback, at CLI *import time* (not even at the `doctor`/`load_instant_config()` call site), because `cli.py`'s `register_entity_groups()` eagerly imports every entity module, one of which imports `bizdays.py`, which computes its calendar path at module scope.

The one piece of information this research could not verify directly is the literal `NEXT_PUBLIC_INSTANT_APP_ID` value needed for PKG-03: the harness's own permission settings hard-deny any `Read` or `Bash` call that references the literal path `.env.instantdb`, by design (a `.env` secrets guard). A safe, permitted workaround exists and was exercised this session: the value is already baked in plaintext into the locally built, gitignored `web/dist/assets/index-*.js` bundle (via `vite.config.ts`'s `define: { "import.meta.env.VITE_INSTANT_APP_ID": JSON.stringify(appId) }`). Exactly one plausible UUID-shaped candidate was found there; it is documented below tagged `[ASSUMED]` and the plan must include a step to reconfirm it (ideally by rebuilding `web/` fresh immediately before extracting, to rule out staleness) rather than trusting this research's extraction blindly.

**Primary recommendation:** Make zero `pyproject.toml` changes for PKG-01 (the existing `module-root = ""` already suffices); use `importlib.resources.files("apollo_cli.data")` in `bizdays.py`; in `config.py`, wrap the `find_repo_root()` call itself in `try/except FileNotFoundError` (not just the app-id-missing case) and make `InstantConfig.env_file` optional; prove PKG-05 with a real, scripted `uv build` → `uv venv`/`uv tool install` → run-from-outside-the-repo → `uv tool uninstall` round trip (both as an automated pytest-based live test and as a documented manual command sequence), exactly as executed and verified in this research session.

## Architectural Responsibility Map

This is a single-package CLI, not a multi-tier web app — the "tiers" below are adapted to a packaging/distribution context.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ANBIMA calendar data resolution | Bundled package resource (`apollo_cli/data/`) | — | Must be physically inside the installed wheel; no runtime dependency on the monorepo checkout is possible any other way |
| InstantDB `app_id` resolution | CLI config layer (`apollo_cli/config.py`) | Local filesystem override (`.env.instantdb`/`APOLLO_ENV_FILE`) | The config layer owns the full fallback chain; the file-based override remains a legitimate escape hatch (e.g. pointing at a staging app) that must keep working unchanged |
| Wheel content selection | Build backend (`uv_build`, driven by `pyproject.toml`) | — | The build backend — not application code — decides what ships; no code-level "packaging shim" should be hand-written |
| Dev/editable install parity | Local dev environment (`uv sync`, `.pth`-based editable install) | — | Verified this session: this repo's `.venv` uses a `.pth` file pointing straight at the source tree (`apollo_cli.pth` → `/home/thomaz/pessoal/apollo-v2/cli/`), so the vendored file needs to exist on disk in the source tree and nothing else — no separate "sync package data" step exists or is needed |
| Byte-parity assurance | Test suite (`cli/tests/`) | — | A testable invariant (do the two JSON files match), not an architectural boundary |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `uv_build` | `>=0.9.21,<0.10.0` (already pinned in `cli/pyproject.toml`; installed `uv` on this machine is exactly `0.9.21`) [VERIFIED: `uv --version` this session] | PEP 517 build backend | Already the project's chosen backend; native to `uv`, fastest for this project's `uv`-only workflow; **no version bump needed for this phase** |
| `importlib.resources` (stdlib) | Python 3.12 stdlib (`requires-python = ">=3.12"` in `cli/pyproject.toml`) | Read bundled package data at runtime | Stdlib, zero new dependency; the only correct way to read package-bundled files regardless of install mechanism (normal dir install, zipped wheel, editable install) |

### Supporting

None — this phase introduces **no new dependency**, per CONTEXT.md decision 8. `bizdays`, `click`, `python-dotenv`, `instantdb` are all already present and untouched.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `uv_build`'s automatic whole-module-directory inclusion | Switch to `hatchling` for more flexible `[tool.hatch.build]` includes | Not needed here — `uv_build` already includes non-`.py` files under the module root with zero config; switching backends would be unnecessary churn and lose `uv`'s tight integration. `uv_build`'s own docs explicitly say it "currently only supports pure Python code" and recommend `hatchling` **only** "when build scripts or a more flexible project layout are required" — neither applies here. |
| `importlib.resources.files()` | `pkg_resources` (setuptools) | Deprecated/legacy, heavier, not needed since the project already requires Python 3.12 and has zero setuptools dependency |
| `importlib.resources.files()` | `Path(__file__).parent / "data" / "..."` | Works for a plain-directory install (which `uv tool install` happens to produce) but is not the documented/correct API — breaks for zipapp/zipimport scenarios and obscures the actual resource-loading contract; `importlib.resources` is the only pattern that is correct in all installation modes |

**Installation:** No new packages to install. No `pyproject.toml` dependency changes.

**Version verification:** `uv --version` on this machine reports `0.9.21`, exactly matching the existing pin `uv_build>=0.9.21,<0.10.0` in `cli/pyproject.toml`. `importlib.resources.files()`/`.joinpath()`/`.read_text()`/`.read_bytes()` were exercised directly against the project's actual `.venv` (Python 3.12.12) this session — all present and working as expected. [VERIFIED: `uv --version` + direct interpreter session, this session]

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero new external packages (CONTEXT.md decision 8, confirmed unchanged in `cli/pyproject.toml`'s `[project.dependencies]`). `uv_build` is an existing, already-pinned build-system requirement, not a new install. No legitimacy check is required.

## Architecture Patterns

### System Architecture Diagram

```
Calendar data flow (PKG-01/02):

┌────────────────────────────────────┐
│ shared/anbima-calendar.json          │  ← source of truth, read-only,
│ (git-tracked, also read by web/)     │    also read by web/src/lib/bizdays.ts
└──────────────────┬───────────────────┘
                    │ vendored copy, committed to git (PKG-01)
                    ▼
┌────────────────────────────────────┐
│ cli/apollo_cli/data/anbima-calendar.json │
└──────────────────┬───────────────────┘
                    │ automatically included — module-root="" already covers this,
                    │ zero pyproject.toml change needed (verified live)
                    ▼
┌────────────────────────────────────┐        ┌──────────────────────────────┐
│ uv build → apollo_cli-*.whl          │ ─────▶ │ uv tool install / pip install  │
│ (whole apollo_cli/ dir copied in,    │        │ isolated venv, no shared/ dir  │
│  minus __pycache__/*.pyc/*.pyo)      │        └───────────────┬────────────────┘
└────────────────────────────────────┘                          │ import apollo_cli.bizdays
                                                                  ▼
                                                  ┌──────────────────────────────┐
                                                  │ importlib.resources.files(    │
                                                  │   "apollo_cli.data")           │
                                                  │  .joinpath("anbima-...json")   │
                                                  └───────────────┬────────────────┘
                                                                  ▼
                                                  Calendar(holidays=..., weekdays=[...])


InstantDB app_id resolution flow (PKG-03/04), new fallback chain:

  explicit env_file arg?
        │ no
        ▼
  APOLLO_ENV_FILE env var set?
        │ no
        ▼
  find_repo_root() finds .env.instantdb walking up from config.py's own
  install location?
        │                                   │
        │ yes, file found                   │ no → FileNotFoundError today
        ▼                                   │ (MUST be caught — see Pitfall 2)
  NEXT_PUBLIC_INSTANT_APP_ID / INSTANT_APP_ID present in file?
        │                                   │
        │ yes → app_id_source = "file"      │ no / file not found
        ▼                                   ▼
  return resolved app_id            _DEFAULT_APP_ID (embedded constant)
                                     app_id_source = "embedded_default"
                                     (NEW — replaces today's `raise ValueError`)
```

### Recommended Project Structure

```
cli/
├── apollo_cli/
│   ├── __init__.py
│   ├── bizdays.py          # PKG-01: importlib.resources instead of find_repo_root()
│   ├── config.py           # PKG-03/04: _DEFAULT_APP_ID constant + new fallback chain;
│   │                       #   find_repo_root() stays (its only remaining caller)
│   ├── cli.py               # doctor's output gains file-vs-embedded-default provenance
│   ├── data/                 # NEW (PKG-01) — ships in the wheel automatically
│   │   └── anbima-calendar.json   # byte-identical vendored copy
│   ├── entities/
│   └── ...
├── tests/
│   ├── test_calendar_json.py              # existing — untouched, still reads shared/ only
│   ├── test_calendar_vendored_parity.py   # NEW (PKG-02)
│   ├── test_config_app_id_fallback.py     # NEW (PKG-03/04) — unit, no network
│   └── test_packaging_live.py             # NEW (PKG-05) — real uv build/install round trip
└── pyproject.toml            # NO changes needed for PKG-01 packaging
```

### Pattern 1: Reading bundled package data via `importlib.resources`

**What:** Read a JSON file that is physically inside the installed package, working identically whether the package is an editable dev install or a real installed wheel.
**When to use:** Any file that ships inside `apollo_cli/` and must be readable at runtime without any assumption about where the package happens to be installed.
**Example:**
```python
# Source: verified live this session — built wheel, installed into an
# isolated venv, read from outside the source tree. Python 3.12 stdlib API.
from __future__ import annotations

import json
from importlib import resources
from typing import Final

_CALENDAR_RESOURCE: Final = resources.files("apollo_cli.data").joinpath(
    "anbima-calendar.json"
)
_PAYLOAD: Final[dict[str, object]] = json.loads(
    _CALENDAR_RESOURCE.read_text(encoding="utf-8")
)
```
`apollo_cli/data/` does **not** require an `__init__.py` for `resources.files("apollo_cli.data")` to succeed — confirmed empirically this session (implicit namespace package resolution, Python 3.12). Adding an empty `__init__.py` anyway is a reasonable, zero-risk convention choice (matches the existing `entities/__init__.py` pattern in this codebase) but is not functionally required.

### Pattern 2: `config.py`'s new app_id fallback chain

**What:** Extend `load_instant_config()`'s resolution order with an embedded last-resort default, while correctly handling the case where `find_repo_root()` itself cannot find any `.env.instantdb` at all (the actual post-install scenario).
**When to use:** PKG-03/PKG-04.
**Example:**
```python
# Source: derived from reading cli/apollo_cli/config.py:58-91 this session
# (see verbatim quote in <phase_requirements>/Pitfall 2 below) plus CONTEXT.md
# decision 5's required fallback order.
from __future__ import annotations

_DEFAULT_APP_ID: Final[str] = "7936ca82-5cb4-43c2-811d-788a6ec0d2a8"  # [ASSUMED — see Assumptions Log A1]


@dataclass(frozen=True)
class InstantConfig:
    app_id: str
    app_id_source: str  # "file" | "embedded_default" — NEW, needed for doctor (decision 6)
    env_file: Path | None  # NEW — was `Path`; no file may exist at all post-install
    admin_token_present: bool


def load_instant_config(env_file: Path | None = None) -> InstantConfig:
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
```
This shape is a recommendation, not a locked contract — the planner/executor may name the new field differently, but must: (a) catch `FileNotFoundError` from `find_repo_root()` itself, not just guard against a missing app-id key; (b) make `env_file` optional; (c) expose enough information for `doctor` to report file-vs-embedded-default provenance (CONTEXT.md decision 6).

### Anti-Patterns to Avoid

- **Adding a `[tool.uv.build-backend.data]` entry for the calendar JSON:** That setting maps to the wheel's special `.data/` directory (used for things like scripts/headers installed *outside* `site-packages`), not for files that should live inside the importable package and be read via `importlib.resources`. Using it here would put the file somewhere `importlib.resources.files("apollo_cli.data")` cannot find it.
- **Reading the resource via `Path(__file__).parent / "data" / "anbima-calendar.json"`:** Works by accident for a normal directory install (which is what `uv tool install` happens to produce today) but is not the documented, portable pattern and should not be introduced now that the project has decided to standardize on `importlib.resources`.
- **Guarding only the "no app_id key in file" case:** Fixing just the `ValueError` branch and leaving `find_repo_root()`'s `FileNotFoundError` uncaught will still crash in exactly the scenario PKG-05 needs to prove works — verified live this session (see Pitfall 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bundling a non-Python data file into a wheel | A custom post-build copy script, or a `MANIFEST.in`-style include list | `uv_build`'s default whole-module-directory inclusion (already active via the existing `module-root = ""`) | Verified live: zero extra config already achieves the goal. A custom script would be pure added complexity and a future drift risk. |
| Reading packaged data files at runtime | Manual `Path(__file__).parent / ...` construction | `importlib.resources.files(...)` | Correct in every install mode (plain dir, zipped wheel, editable); `__file__`-relative paths are a known anti-pattern that breaks under zipimport and obscures intent. |
| Verifying wheel contents during development/CI | A bespoke recursive `os.walk` + diff tool | `python -m zipfile -l dist/*.whl`, or a pytest test using stdlib `zipfile.ZipFile` to assert specific paths present/absent | A wheel is just a zip file; stdlib `zipfile` is sufficient — no packaging library needed for a presence check. |

**Key insight:** Every part of this phase that looks like it needs new packaging machinery (data-file inclusion, resource reading, wheel-content verification) is already fully solved by tools already in the stack (`uv_build`'s defaults, stdlib `importlib.resources`, stdlib `zipfile`). The actual engineering risk in this phase is not packaging config — it's the `config.py` control-flow gap around `find_repo_root()`'s `FileNotFoundError` (Pitfall 2) and the eager-import chain that makes even `--version` sensitive to it (Pitfall 1).

## Common Pitfalls

### Pitfall 1: Eager import chain means *every* subcommand — including `--version` — currently crashes outside the repo
**What goes wrong:** `apollo_cli/cli.py` calls `register_entity_groups(apollo)` at module import time, which eagerly imports every module under `apollo_cli/entities/`. One of them (`rotina.py`) imports `apollo_cli/routine_job.py`, which imports `apollo_cli/bizdays.py`, which computes `_CALENDAR_PATH`/`_PAYLOAD` as **module-level constants** using `find_repo_root()`. So literally invoking `apollo --version` (not just a calendar-touching command) triggers the calendar file lookup and crashes.
**Why it happens:** Click's `@click.group()` decorator machinery plus this codebase's auto-discovery pattern (`apollo_cli.entities.register_entity_groups`, documented in `cli.py`'s own docstring) runs at import time, before `main()`'s body ever executes.
**How to avoid:** This is not something to "fix" separately — it's *why* PKG-01 must be solved correctly at the `bizdays.py` module level (not lazily deferred), and it's exactly why the live proof (PKG-05) must actually invoke the installed console script, not just unit-test `bizdays.py` in isolation.
**Warning signs / live reproduction (this session, current unfixed code):**
```
Traceback (most recent call last):
  File ".../bin/apollo", line 4, in <module>
    from apollo_cli.cli import main
  File ".../apollo_cli/cli.py", line 37, in <module>
    register_entity_groups(apollo)
  ...
  File ".../apollo_cli/entities/rotina.py", line 53, in <module>
    from apollo_cli.routine_job import run_routine_instance_job, today_utc_iso_date
  File ".../apollo_cli/routine_job.py", line 76, in <module>
    from apollo_cli.bizdays import (...)
  File ".../apollo_cli/bizdays.py", line 35, in <module>
    _CALENDAR_PATH: Final = find_repo_root() / "shared" / "anbima-calendar.json"
  File ".../apollo_cli/config.py", line 41, in find_repo_root
    raise FileNotFoundError(msg)
FileNotFoundError: Could not find .env.instantdb in any parent directory of .../apollo_cli/config.py
```
Reproduced twice: once via a manual `uv venv` + `uv pip install <wheel>`, once via a real `uv tool install` (with full cleanup via `uv tool uninstall apollo-cli` afterward — see `## Code Examples`). **Which task addresses it:** PKG-01 (the `bizdays.py` fix must be import-time-safe, i.e. never depend on `find_repo_root()`).

### Pitfall 2: `find_repo_root()` raises `FileNotFoundError`, not `ValueError` — before `dotenv_values()` is ever called
**What goes wrong:** A fix that only wraps `load_instant_config()`'s existing `raise ValueError(...)` (the "no app id found in {file}" branch) will still crash uncaught, because `find_repo_root()` itself throws **earlier**, in the "no explicit `env_file`, no `APOLLO_ENV_FILE`" branch, before any dotenv parsing happens.
**Why it happens:** [VERIFIED: `cli/apollo_cli/config.py:70-73`, read directly this session] — verbatim:
```python
    else:
        resolved_env_file = find_repo_root() / ENV_FILENAME
```
and `find_repo_root()` itself [VERIFIED: `cli/apollo_cli/config.py:25-42`] — verbatim:
```python
def find_repo_root(start: Path | None = None) -> Path:
    """Walk upward from `start` (default: this file's location) until a directory
    containing `ENV_FILENAME` is found, and return that directory.

    Raises `FileNotFoundError` if the filesystem root is reached without finding it.
    """
```
**How to avoid:** Wrap the `find_repo_root()` call site itself in `try/except FileNotFoundError`, falling through to "no file resolved" (`resolved_env_file = None`), not just the downstream "app id missing" check. See the `config.py` Code Example above.
**Warning signs:** The exact traceback captured in Pitfall 1 ends in this exact `raise FileNotFoundError` line — this is empirically the actual failure mode PKG-05 must eliminate, not a hypothetical. **Which task addresses it:** PKG-03/PKG-04.

### Pitfall 3: `InstantConfig.env_file` is currently non-optional, and `doctor` prints it unconditionally
**What goes wrong:** [VERIFIED: `cli/apollo_cli/cli.py:55`] `click.echo(f"env file: {config.env_file}")` assumes `config.env_file` is always a real `Path`. Once no `.env.instantdb` is reachable at all (the clean post-install case), there is no real path to report — the field's type must change (`Path | None`) and `doctor`'s formatting must handle the `None` case, or `doctor` will itself crash trying to render output that was supposed to prove success.
**Why it happens:** The original design assumed a `.env.instantdb` file always exists somewhere up the tree (true only inside the monorepo checkout).
**How to avoid:** Make `env_file: Path | None`; have `doctor` print something like `"env file: (none — using embedded default)"` when `None`. This is also the natural place to satisfy CONTEXT.md decision 6 (`doctor` must reflect file-vs-embedded-default provenance) — add an `app_id_source` field and print it alongside.
**Warning signs:** Any plan that keeps `InstantConfig.env_file: Path` (non-optional) unchanged will need some other way to represent "no file was found," which is more awkward (e.g. a sentinel path) than just making it `Optional`. **Which task addresses it:** PKG-03/PKG-04.

### Pitfall 4: `.env.instantdb` is hard-denied to Read/Bash tools in this environment — plan around it, don't fight it
**What goes wrong:** Both the `Read` tool and `Bash` (even a harmless `ls -la .env.instantdb`) were denied outright this session when the literal path `.env.instantdb` appeared in the call — a deliberate secrets guard, not a bug.
**Why it happens:** Standing harness-level permission policy for dotenv-shaped files, independent of this project's own `.claude/settings.json` (which is empty/absent in this repo).
**How to avoid:** Do not attempt to route around this for the *admin token* (correctly protected). For the **non-secret** `NEXT_PUBLIC_INSTANT_APP_ID` needed by PKG-03, use the legitimate alternate source that already exists precisely because this value is public: the locally built `web/dist/assets/index-*.js` bundle (see Assumptions Log A1 and the extraction recipe in `## Code Examples`). If `web/dist` doesn't exist or looks stale in a future execution environment, rebuild it first (`cd web && bun install && bun run build`) — this is a fully permitted, read-only, non-secret operation.
**Warning signs:** A plan/task that tries to `cat`/`grep`/`Read` `.env.instantdb` directly will be blocked at execution time exactly as it was blocked in this research session. **Which task addresses it:** PKG-03 (value-extraction step).

### Pitfall 5: `uv_build` has no default-inclusion allowlist — only exclude patterns
**What goes wrong:** Because `uv_build` includes the *entire* module directory by default (minus `__pycache__`/`*.pyc`/`*.pyo` and any `wheel-exclude` patterns), any stray file later dropped inside `apollo_cli/` (a `.DS_Store`, a scratch `.bak`, a debug fixture) would silently ship in future wheels — there's no "allowlist" to catch it.
**Why it happens:** [CITED: docs.astral.sh/uv/reference/settings/] `default-excludes` default is `true` and covers only `__pycache__`, `*.pyc`, `*.pyo`; everything else under the module directory is included unless explicitly listed in `wheel-exclude`.
**How to avoid:** Not a blocker for this phase — `cli/tests/` already lives outside `apollo_cli/`, confirmed by inspecting the current wheel's contents (no `tests/` entries present). Just don't move test/dev fixtures into `apollo_cli/` in future phases without checking wheel contents first.
**Warning signs:** A future `zipfile -l dist/*.whl` showing unexpected files. **Which task addresses it:** Not this phase — documented here as a durable convention note for future packaging changes.

### Pitfall 6: Editable dev install (`uv sync`) is `.pth`-based, not a copy — "package data" concerns don't apply to it the way they do to the wheel
**What goes wrong:** A plan step that checks "does `cli/.venv/lib/python3.12/site-packages/apollo_cli/data/anbima-calendar.json` exist" as its dev-mode proof would be checking the wrong thing.
**Why it happens:** [VERIFIED, this session] `cli/.venv/lib/python3.12/site-packages/apollo_cli.pth` contains a single line: `/home/thomaz/pessoal/apollo-v2/cli` — this repo's editable install is a `.pth`-file redirect straight to the source tree, not a copied/built artifact. `import apollo_cli; apollo_cli.__file__` resolves to `cli/apollo_cli/__init__.py` in the real source tree.
**How to avoid:** In dev mode, once the vendored file physically exists at `cli/apollo_cli/data/anbima-calendar.json` in the source tree (which PKG-01 already requires), `importlib.resources.files("apollo_cli.data")` resolves to that exact file with zero extra `uv sync` step. The correct dev-mode proof is simply running the PKG-02 pytest test, not inspecting `site-packages` layout.
**Warning signs:** None currently — flagged proactively since Q5 of the phase's research brief specifically asked about this. **Which task addresses it:** PKG-01/PKG-02 (informs how their "done" check should be worded).

## Runtime State Inventory

Not applicable — this phase is not a rename/refactor/migration (no strings are being renamed across systems). It is a vendoring + config-fallback + packaging phase. The one piece of durable, OS-level state this phase's *verification* touches — a `uv tool install`-registered global shim — is transient and self-cleaning: see the live-proof procedure in `## Code Examples`, which ends every round trip with `uv tool uninstall apollo-cli`, verified this session to fully restore `uv tool list` to "No tools installed."

## Code Examples

### PKG-02: byte-parity test (style-matched to existing `test_calendar_json.py`/`test_bizdays.py`)

```python
"""Byte-parity gate (PKG-02): shared/anbima-calendar.json vs the vendored
cli/apollo_cli/data/ copy consumed by the installed package. Fails loudly if
someone edits one file and forgets the other — the whole point of vendoring
is that both copies never silently diverge.
"""

from __future__ import annotations

from importlib import resources
from pathlib import Path

from apollo_cli.config import find_repo_root


def test_vendored_calendar_is_byte_identical_to_shared_source() -> None:
    source_path: Path = find_repo_root() / "shared" / "anbima-calendar.json"
    vendored_bytes: bytes = (
        resources.files("apollo_cli.data")
        .joinpath("anbima-calendar.json")
        .read_bytes()
    )
    assert source_path.read_bytes() == vendored_bytes, (
        f"{source_path} and cli/apollo_cli/data/anbima-calendar.json have "
        "diverged — update the vendored copy (see PKG-01/PKG-02)."
    )
```

### PKG-05: automated live packaging proof (recommended, in addition to a manual runbook)

This project's standing convention is real, live verification over static inspection. The full build → install → run-outside-repo → uninstall cycle is scriptable as a real pytest test (mark it distinctly, e.g. a new `packaging` marker registered in `pyproject.toml`'s `[tool.pytest.ini_options] markers`, alongside the existing `live` marker):

```python
"""Live packaging proof (PKG-05): build the real wheel, install it into a
throwaway venv, and run `apollo` from a directory outside the apollo-v2
checkout with no shared/ or .env.instantdb reachable from that install
location — proving the installed package never touches the monorepo at
runtime. Marked `packaging` since it shells out to real `uv build`/`uv venv`/
`uv pip install`; not part of the fast unit-test loop.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from apollo_cli.config import find_repo_root

pytestmark = pytest.mark.packaging


def _cli_dir() -> Path:
    return find_repo_root() / "cli"


def test_installed_wheel_runs_outside_repo_with_no_shared_or_env_file(
    tmp_path: Path,
) -> None:
    dist_dir = tmp_path / "dist"
    venv_dir = tmp_path / "venv"
    outside_cwd = tmp_path / "outside"  # guaranteed not inside apollo-v2
    outside_cwd.mkdir()

    subprocess.run(
        ["uv", "build", "--out-dir", str(dist_dir)],
        cwd=str(_cli_dir()),
        check=True,
    )
    wheel = next(dist_dir.glob("*.whl"))

    subprocess.run(["uv", "venv", str(venv_dir), "--python", "3.12"], check=True)
    subprocess.run(
        [
            "uv",
            "pip",
            "install",
            "--python",
            str(venv_dir / "bin" / "python"),
            str(wheel),
        ],
        check=True,
    )

    apollo_bin = venv_dir / "bin" / "apollo"

    version = subprocess.run(
        [str(apollo_bin), "--version"],
        cwd=str(outside_cwd),
        capture_output=True,
        text=True,
        check=True,
    )
    assert "apollo" in version.stdout.lower() or version.stdout.strip()

    doctor = subprocess.run(
        [str(apollo_bin), "doctor"],
        cwd=str(outside_cwd),
        capture_output=True,
        text=True,
        check=True,
    )
    assert "embedded" in doctor.stdout.lower()  # provenance must say embedded default

    # A read-only subcommand must reach its NORMAL documented behavior (a
    # clean "no_session" JSON error, since no login happened) — NOT crash
    # with FileNotFoundError/ImportError at module import time.
    listar = subprocess.run(
        [str(apollo_bin), "fundo", "listar"],
        cwd=str(outside_cwd),
        capture_output=True,
        text=True,
        check=False,
    )
    assert listar.returncode == 1
    error_body = json.loads(listar.stderr)
    assert error_body["error"] == "no_session"
```

### PKG-05: manual acceptance round trip (real `uv tool install`, executed and cleaned up live this session)

This exact sequence was run this session against the *current, unfixed* code to capture the baseline failure (Pitfall 1) and to prove the cleanup step is complete:

```bash
cd cli
uv build --out-dir /tmp/apollo_wheel_test
uv tool install --force /tmp/apollo_wheel_test/apollo_cli-0.1.0-py3-none-any.whl
# → "Installed 1 executable: apollo" at ~/.local/bin/apollo

cd /tmp   # any directory outside apollo-v2
apollo --version
apollo doctor
apollo fundo listar   # expect clean {"error": "no_session"} on stderr, exit 1 —
                       # proves no import-time crash, not that data comes back

# Cleanup — verified this session to fully restore clean state:
uv tool uninstall apollo-cli   # NOTE: package name "apollo-cli", NOT "apollo"
uv tool list                    # → "No tools installed"
```
`uv tool uninstall` takes the **project name** (`apollo-cli`, from `[project].name`), not the console-script name (`apollo`) — verified live; `uv tool list` output format is `apollo-cli v0.1.0\n- apollo`.

### `NEXT_PUBLIC_INSTANT_APP_ID` extraction recipe (for PKG-03, since `.env.instantdb` itself cannot be read by this tooling — see Pitfall 4)

```bash
cd web
bun install   # if node_modules absent
bun run build # regenerates dist/ fresh from the CURRENT .env.instantdb
grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
  dist/assets/index-*.js | sort -u
# Exclude the two known placeholder UUIDs used by cross-user-isolation
# fixtures/tests: 00000000-0000-0000-0000-000000000000 and
# ffffffff-ffff-ffff-ffff-ffffffffffff. The one remaining value is the
# real NEXT_PUBLIC_INSTANT_APP_ID (baked in via vite.config.ts:28,46's
# `define: { "import.meta.env.VITE_INSTANT_APP_ID": JSON.stringify(appId) }`).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| setuptools `package_data`/`MANIFEST.in` for non-Python files | `uv_build`'s "include the whole module directory by default" model | `uv_build` is a recent (2025-2026) addition to the `uv` project; this repo already adopted it | No `package_data`-equivalent key exists or is needed in `uv_build` — a plan written by analogy to setuptools/hatchling would introduce a nonexistent config key |
| `pkg_resources` for resource loading | `importlib.resources` (stdlib since 3.9, stable API by 3.11/3.12) | Long-standing Python ecosystem shift, unrelated to this project's timeline | Already the only correct choice given `requires-python = ">=3.12"` |

**Deprecated/outdated:** None specific to this phase beyond the general setuptools-era patterns noted above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The embedded default `app_id` value is `7936ca82-5cb4-43c2-811d-788a6ec0d2a8`, extracted as the sole non-placeholder UUID-shaped string in the locally built `web/dist/assets/index-*.js` bundle. This research could not read `.env.instantdb` directly (hard-denied by sandbox permissions — see Pitfall 4) and could not independently cross-check this value against the authoritative source. | PKG-03, `config.py` Code Example | If wrong, the embedded default would point the CLI at a nonexistent or wrong InstantDB app for any user relying on the fallback — silent-ish failure (auth/queries would fail against the wrong `app_id`, or the app just wouldn't exist). **Before shipping, the executor must reconfirm this value** — ideally by rebuilding `web/` fresh (`cd web && bun run build`) immediately before re-extracting, per the recipe in `## Code Examples`, to rule out any staleness in the currently-committed `web/dist` build artifact. |

## Open Questions (RESOLVED)

1. **Exact shape of `InstantConfig`'s new field(s) for provenance tracking** — RESOLVED (24-01-PLAN.md Task 1)
   - What we know: CONTEXT.md decision 6 requires `doctor` to "correctly reflect whether the resolved app_id came from a file or from the embedded default." `env_file` must become optional (Pitfall 3).
   - What's unclear: Whether to add a single `app_id_source: str` field (as sketched in the Code Example), a `Literal["file", "embedded_default"]`, or compute the distinction ad hoc inside `doctor` itself from `env_file is None`. All are workable; this is a naming/typing choice, not a behavioral one.
   - Recommendation: Use the `app_id_source` field approach shown in the Code Example — it's the most testable (a unit test can assert on it directly without parsing `doctor`'s printed text) and matches this codebase's existing preference for structured `InstantConfig` fields over ad hoc `doctor`-only logic.
   - **Resolution:** Planner adopted the recommendation verbatim — `InstantConfig` gains a plain `app_id_source: str` field (values `"file"`/`"embedded_default"`), and `env_file` becomes `Path | None`. See 24-01-PLAN.md Task 1.

2. **Whether to reuse the `live` pytest marker or introduce a new `packaging` marker for the PKG-05 automated test** — RESOLVED (24-02-PLAN.md Task 1)
   - What we know: The existing `live` marker's documented meaning is "exercises the real InstantDB app over the network using the persisted session" (`cli/pyproject.toml`) — the PKG-05 test exercises real `uv build`/`uv venv`/filesystem operations, not the InstantDB network API.
   - What's unclear: Whether the project wants a second marker category or is fine stretching `live`'s definition.
   - Recommendation: Add a new `packaging` marker (one new line in `cli/pyproject.toml`'s `[tool.pytest.ini_options] markers`) — keeps `live`'s meaning precise and lets `uv run pytest -m "not live and not packaging"` remain a fast, fully-offline inner loop.
   - **Resolution:** Planner adopted the recommendation verbatim — a new `packaging` marker is registered in `cli/pyproject.toml` and applied to `test_packaging_live.py`. See 24-02-PLAN.md Task 1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `uv` CLI | `uv build`, `uv venv`, `uv tool install`, `uv pip install` | ✓ | 0.9.21 (exact match to the pin in `cli/pyproject.toml`) | — |
| Python 3.12 (uv-managed toolchain) | Building/running the package | ✓ | 3.12.12 via `uv`'s own managed CPython at `~/.local/share/uv/python/cpython-3.12.12-linux-x86_64-gnu` | — |
| System `python3` on `PATH` | Not required — project always uses `uv run`/`uv venv --python 3.12` | ✗ system default is 3.10.12 | 3.10.12 | Irrelevant as long as every command in the plan explicitly uses `uv run`/`uv venv --python 3.12`/the project's `.venv`, never bare `python3` |
| `web/` build tooling (`bun`) | Only needed for the PKG-03 value-extraction recipe (rebuilding `web/dist` fresh) | Not probed this session (out of this phase's runtime scope — see PROJECT.md, `bun` is `web/`'s sole executor) | — | If `bun` is unavailable when the plan executes, the currently-committed (gitignored, but present on disk) `web/dist/assets/index-*.js` can be used as-is, accepting slightly higher staleness risk (see Assumptions Log A1) |

**Missing dependencies with no fallback:** None — everything this phase needs (`uv`, Python 3.12) is already present and version-matched.

**Missing dependencies with fallback:** `bun`/fresh `web/` rebuild for the app_id extraction recipe — falls back to using the already-present `web/dist` build artifact as-is.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest >= 9.1.1 (`cli/pyproject.toml` `[dependency-groups].dev`) |
| Config file | `cli/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd cli && uv run pytest -m "not live and not packaging"` (recommend adding the `packaging` marker — see Open Question 2) |
| Full suite command | `cd cli && uv run pytest` (runs everything, including `live`-marked and the new `packaging`-marked test) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PKG-01 | `bizdays.py` reads the calendar via `importlib.resources`, no `find_repo_root()` dependency | unit | `uv run pytest tests/test_bizdays.py -x` (existing file, must still pass unmodified — it imports `apollo_cli.bizdays`'s public constants, not its internals) | ✅ existing |
| PKG-02 | Byte-parity between `shared/anbima-calendar.json` and the vendored copy | unit | `uv run pytest tests/test_calendar_vendored_parity.py -x` | ❌ Wave 0 (new file) |
| PKG-03 | `_DEFAULT_APP_ID` resolves when no file/env resolves an app_id | unit | `uv run pytest tests/test_config_app_id_fallback.py -x` | ❌ Wave 0 (new file) |
| PKG-04 | File/env override still takes precedence over the embedded default | unit | same file as PKG-03, additional test case(s) | ❌ Wave 0 |
| PKG-05 | Real `uv build`/`uv tool install` round trip works from outside the repo with no `shared/`/`.env.instantdb` | packaging (live, real subprocess/filesystem) | `uv run pytest tests/test_packaging_live.py -x -m packaging` | ❌ Wave 0 (new file + new marker registration) |

### Sampling Rate

- **Per task commit:** `uv run pytest -m "not live and not packaging"` (fast, offline)
- **Per wave merge:** `uv run pytest` (full suite, including the real `uv build`/install round trip)
- **Phase gate:** Full suite green, plus the manual acceptance round trip (Code Examples section) run at least once by hand before considering PKG-05 done — since it is the requirement's own literal acceptance bar ("comprovado via instalação real em ambiente isolado, não apenas inspeção estática").

### Wave 0 Gaps

- [ ] `cli/tests/test_calendar_vendored_parity.py` — covers PKG-02
- [ ] `cli/tests/test_config_app_id_fallback.py` — covers PKG-03/PKG-04 (unit, `tmp_path` + `monkeypatch`, no network — same style as `test_auth_rejection.py`'s non-live tests)
- [ ] `cli/tests/test_packaging_live.py` — covers PKG-05
- [ ] `cli/pyproject.toml`: register a new `packaging` pytest marker (one-line addition to `[tool.pytest.ini_options] markers`)
- [ ] `cli/apollo_cli/data/` directory itself (does not exist yet)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Out of scope for this phase (Phase 25 owns the auth-transport change) |
| V3 Session Management | No | Untouched by this phase |
| V4 Access Control | No | Untouched by this phase |
| V5 Input Validation | Marginal | `bizdays.py` already validates the JSON payload shape (`isinstance` checks on `holidays`) — no new validation surface introduced, keep as-is |
| V6 Cryptography | No | Not applicable |
| V14 Configuration / secure defaults | Yes | The core concern of this phase: what gets embedded in a publicly distributable artifact |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Accidental embedding of a real secret (`INSTANT_APP_ADMIN_TOKEN`) into the distributed package | Information Disclosure | Never add a default for the admin token (already a locked decision, #6). This codebase already has a working structural test pattern for exactly this class of bug — `cli/tests/test_auth_rejection.py`'s `test_admin_token_confinement` and `test_admin_token_key_confined_to_exempt_modules` (AST-walk scans for the literal string `"INSTANT_APP_ADMIN_TOKEN"` across `apollo_cli/*.py`) — the planner should confirm the new `_DEFAULT_APP_ID` constant and its surrounding code do not trip these existing gates, and should NOT add `config.py`/`bizdays.py` to any exemption list for the admin-token key. |
| Wheel silently including unintended files (`uv_build`'s "no allowlist, only excludes" model — Pitfall 5) | Tampering / Information Disclosure | Inspect wheel contents (`python -m zipfile -l dist/*.whl`) as part of the PKG-05 verification step; keep test/dev fixtures out of `apollo_cli/` |
| Distributing a package whose only network-reachable identifier (`app_id`) is public but immutable without a rebuild | Information Disclosure (low severity — this value is already public, by design, per CONTEXT.md decision 4) | No mitigation needed beyond what's already decided — `app_id` is explicitly non-secret; `.env.instantdb`/`APOLLO_ENV_FILE` remain the override path for anyone who needs a different app (e.g. staging) |

## Sources

### Primary (HIGH confidence)
- `docs.astral.sh/uv/concepts/build-backend/` — fetched and parsed verbatim (via direct `curl`, not an intermediary summarizer) this session; page dated "August 7, 2026" in its own footer. [CITED]
- `docs.astral.sh/uv/reference/settings/` — build-backend settings table (`module-root`, `data`, `wheel-exclude`, `default-excludes`, etc.) [CITED]
- Live `uv build` + `zipfile` wheel-content inspection, run twice this session: once on a minimal toy package, once on the actual `cli/` package's current wheel. [VERIFIED: this session]
- Live `uv venv` + `uv pip install <wheel>` + `importlib.resources` read from outside the source tree. [VERIFIED: this session]
- Live `uv tool install` + `apollo --version` (captured the real current-code crash traceback) + `uv tool uninstall apollo-cli` + `uv tool list` (confirmed clean). [VERIFIED: this session]
- `cli/apollo_cli/config.py:25-42, 58-91` — read directly, quoted verbatim above. [VERIFIED: cli/apollo_cli/config.py:25-42,58-91]
- `cli/apollo_cli/bizdays.py:1-52` — read directly. [VERIFIED: cli/apollo_cli/bizdays.py:31-38]
- `cli/apollo_cli/cli.py:40-61` — `doctor` command implementation, read directly. [VERIFIED: cli/apollo_cli/cli.py:55]
- `web/vite.config.ts:1-46` — read directly, confirms the `define` mapping that bakes `NEXT_PUBLIC_INSTANT_APP_ID` into the built bundle. [VERIFIED: web/vite.config.ts:28,46]
- `web/dist/assets/index-*.js` — grepped directly this session for UUID-shaped strings; the extraction mechanism is verified, the specific value is `[ASSUMED]` (see Assumptions Log A1).
- Direct Python 3.12 interpreter session confirming `importlib.resources.files("pkg.data")` works without `pkg/data/__init__.py` (implicit namespace package). [VERIFIED: this session]
- `cli/tests/test_calendar_json.py`, `test_bizdays.py`, `test_cli_surface.py`, `test_instant_client.py`, `test_auth_rejection.py`, `cli/tests/conftest.py` — read directly to establish test-style conventions (Final constants, `find_repo_root()`-based fixture paths, AST-walk structural gates, `run_cli`/`live_client` fixtures). [VERIFIED: these files, this session]
- `cli/README.md:58-84` — confirms `uv run pytest` invocation conventions and the existing admin-token documentation. [VERIFIED: cli/README.md:58-84]

### Secondary (MEDIUM confidence)
- WebSearch results summarizing `docs.astral.sh` (superseded by the direct `curl` verbatim fetch above, kept only as corroboration).
- `github.com/astral-sh/uv` issue #11502 (from Feb 2025, an old `uv` version — used only as historical corroboration that this was a real open question in the ecosystem, not as a source of current behavior).

### Tertiary (LOW confidence)
- The specific `_DEFAULT_APP_ID` literal value (`7936ca82-5cb4-43c2-811d-788a6ec0d2a8`) — extraction *mechanism* is HIGH confidence, the extracted *value* is LOW/`[ASSUMED]` pending the executor's own reconfirmation (Assumptions Log A1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, `uv_build`/`importlib.resources` behavior directly verified via real build/install/run cycles this session, not inferred from docs alone.
- Architecture: HIGH — both data flows (calendar resource, app_id fallback) traced through actual source code read this session, with the fallback chain's real failure mode (Pitfall 2) reproduced live, not just reasoned about.
- Pitfalls: HIGH for all packaging/import-chain pitfalls (all reproduced live with real tracebacks/output this session); LOW specifically for the one extracted literal value (A1), clearly isolated so it doesn't contaminate the rest of the research's confidence.

**Research date:** 2026-08-12
**Valid until:** 30 days (stable domain — `uv_build`'s file-inclusion model is a documented, versioned contract; the one time-sensitive item, A1's literal value, is flagged separately and should be reconfirmed at execution time regardless of this date)
