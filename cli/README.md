# apollo-cli

Apollo v2's Python CLI (`apollo`) — the AI-operated channel with full parity
with the web SPA. Every write operation available in the browser is also
available here, authenticated as the same real user under the same InstantDB
permission rules (see `../.planning/PROJECT.md` constraint C-05).

## Install

```bash
cd cli
uv sync
```

`uv` provisions and pins Python 3.12 itself (`cli/.python-version`) — never
invoke a bare `python3`/`pip` in this package.

## Run

```bash
uv run apollo --help
uv run apollo --version
uv run apollo doctor
```

`apollo doctor` resolves the repo-root `.env.instantdb` file (by walking
upward from the package's own location) regardless of the caller's current
working directory, and reports whether the InstantDB app id and admin token
are present — without ever printing either value in full.

## Quality gates

A Python file in this package is not done until all three of these exit 0 — run
from `cli/`, and always covering `shared/scripts/` alongside `cli/` itself:

```bash
uv run ruff check --config pyproject.toml . ../shared/scripts
uv run ruff format --check --config pyproject.toml . ../shared/scripts
uv run ty check . ../shared/scripts
```

`--config pyproject.toml` is required on the ruff commands whenever a path outside
`cli/` (such as `../shared/scripts`) is passed alongside `.`: ruff discovers
configuration by walking up from *each file being linted*, and neither `shared/`
nor the repo root has a `[tool.ruff]` section, so without an explicit `--config`
flag, files under `../shared/scripts` would silently fall back to ruff's defaults
and miss this project's `extend-select = ["I", "ANN"]` rules. `ty check` does not
have this problem — it resolves `cli/pyproject.toml`'s `[tool.ty]` settings by
walking up from the project root regardless of which paths are passed, so no extra
flag is needed there (confirmed via `uv run ty check --help`: a `--project <PATH>`
flag exists for pinning a different project root explicitly, but the default
walk-up behavior already covers `../shared/scripts` correctly).

These are the same three commands Phase 6's VERIFY-02/VERIFY-03 will run — do not
let this scope silently shrink back to `uv run ruff check .` with no `shared/scripts`
argument in future changes.

## Tests

```bash
uv run pytest
uv run pytest tests/test_bizdays.py -x
```

`uv run pytest` (no arguments) discovers and runs every test under `cli/tests/`,
including `test_calendar_json.py` (CAL-01 structural gate, which validates the
vendored `../shared/anbima-calendar.json` produced by
`../shared/scripts/update_calendar.py`) and `test_bizdays.py` (CAL-02/03/04
cross-runtime parity gate, driven by the shared fixture at
`../shared/bizdays.testcases.json`). See the repo-root `README.md` for
`update_calendar.py`'s regeneration command.

## About the admin token

`.env.instantdb` (at the repo root) may contain `INSTANT_APP_ADMIN_TOKEN`.
That token is for `instant-cli` schema/permission pushes only (developer
tooling, run from `web/`) — it bypasses every InstantDB permission rule and
is **deliberately never read by this CLI's runtime**. `apollo doctor` reports
only whether the token is present in the file, never its value, and no other
code path in `apollo_cli` touches it.
