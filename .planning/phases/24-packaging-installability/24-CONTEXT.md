# Phase 24: Packaging & Installability - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss) — milestone scope was fully specified by the user in conversation before this milestone was created; no open questions remain.

<domain>
## Phase Boundary

Anyone can `uv tool install` `cli/` from a clean checkout and run `apollo` from any directory outside the `apollo-v2` monorepo — the ANBIMA calendar and the InstantDB `app_id` both resolve from inside the installed package, with no runtime dependency on `shared/` or a present `.env.instantdb`.

Covers requirements PKG-01 through PKG-05 (see `.planning/REQUIREMENTS.md`).

</domain>

<decisions>
## Implementation Decisions

These were already decided in conversation with the user before this milestone was created — not grey areas, not open questions:

1. **Vendor, don't move.** Copy `shared/anbima-calendar.json` to `cli/apollo_cli/data/anbima-calendar.json`. The original in `shared/` stays untouched (still the source `web/` reads). Declare the copy as package-data in `pyproject.toml`'s `[tool.uv.build-backend]` so `uv build` includes it in the wheel.
2. **Read via `importlib.resources`.** `cli/apollo_cli/bizdays.py` currently does `find_repo_root() / "shared" / "anbima-calendar.json"` — replace with `importlib.resources.files("apollo_cli.data").joinpath("anbima-calendar.json")`. `find_repo_root()` itself is NOT removed (still used by `config.py` for `.env.instantdb` discovery) — only `bizdays.py`'s usage of it goes away.
3. **Byte-parity test.** Add a pytest test that reads both `shared/anbima-calendar.json` and `cli/apollo_cli/data/anbima-calendar.json` and asserts identical bytes. This test may use `find_repo_root()` itself (tests always run inside the repo checkout) to locate the `shared/` original.
4. **Embed a default `app_id`.** `NEXT_PUBLIC_INSTANT_APP_ID` is public (already shipped in the `web/` bundle) — read the current value from the repo's `.env.instantdb` and hardcode it as a module-level constant (e.g. `_DEFAULT_APP_ID`) in `cli/apollo_cli/config.py`.
5. **New fallback order for `load_instant_config()`'s app_id resolution:** explicit `env_file` arg > `APOLLO_ENV_FILE` > `.env.instantdb` via `find_repo_root()` > **embedded default** (new — replaces raising `ValueError` when no file/key resolves an app_id). `.env.instantdb`/`APOLLO_ENV_FILE` remain valid overrides (e.g. to point at a staging app) — the embedded default is only used when nothing else resolves an app_id.
6. **`INSTANT_APP_ADMIN_TOKEN` gets NO default.** It is a real secret and must never be embedded in the package. `admin_token_present`/`apollo doctor` are explicitly kept as-is (see Key Decision in REQUIREMENTS.md/PROJECT.md) — used to support project development (e.g. an AI agent checking whether the local `.env.instantdb` has an admin token configured for admin/seed tasks). Only touch `apollo doctor`'s output enough to correctly reflect whether the resolved app_id came from a file or from the embedded default — do not otherwise alter the admin-token diagnostic.
7. **Scope is `cli/` only.** No changes to `web/`, schema, perms, or the original `shared/anbima-calendar.json` (read-only).
8. **No new runtime dependency** beyond what's already transitive (httpx via instantdb) — this phase doesn't need httpx directly (that's Phase 25), but don't introduce anything else either.

</decisions>

<code_context>
## Existing Code Insights

Key files (read during the discussion phase that led to this milestone, not re-derived here):
- `cli/apollo_cli/bizdays.py` — module-level `_CALENDAR_PATH`/`_PAYLOAD` computed at import time via `find_repo_root() / "shared" / "anbima-calendar.json"`.
- `cli/apollo_cli/config.py` — `find_repo_root(start: Path | None = None)` walks up from `Path(__file__)` by default; `load_instant_config()` resolves `app_id`/`env_file`/`admin_token_present` from `.env.instantdb`, raising `ValueError` if no app_id key is found in the resolved file.
- `cli/apollo_cli/cli.py` — `doctor` command prints `env file`, `app id: ok (...last 4 chars)`, and `admin token: present/absent`.
- `cli/pyproject.toml` — `uv_build` backend, `[tool.uv.build-backend] module-root = ""`.
- Root `.env.instantdb` — has the current `NEXT_PUBLIC_INSTANT_APP_ID` value to embed as the default.

Full research into current file structure and exact line numbers is expected during plan-phase's own research step.

</code_context>

<specifics>
## Specific Ideas

None beyond the Implementation Decisions above — those are the full spec for this phase.

</specifics>

<deferred>
## Deferred Ideas

None — scope for this phase is fully closed per REQUIREMENTS.md/ROADMAP.md.

</deferred>
