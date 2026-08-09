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

A Python file in this package is not done until all three of these exit 0:

```bash
uv run ruff check .
uv run ruff format --check .
uv run ty check
```

## About the admin token

`.env.instantdb` (at the repo root) may contain `INSTANT_APP_ADMIN_TOKEN`.
That token is for `instant-cli` schema/permission pushes only (developer
tooling, run from `web/`) — it bypasses every InstantDB permission rule and
is **deliberately never read by this CLI's runtime**. `apollo doctor` reports
only whether the token is present in the file, never its value, and no other
code path in `apollo_cli` touches it.
