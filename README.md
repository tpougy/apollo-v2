# Apollo v2

Apollo v2 is a from-scratch rewrite of Apollo, a local, single-user controladoria system.
InstantDB is the sole backend/database. There is no custom API server: both the browser SPA
and the Python CLI talk to InstantDB directly, authenticated as the same real user under the
same permission rules.

## Layout

Three packages, plus one env file, at the repo root:

- `shared/` — the single source of truth for domain schema and calendar data. No
  `package.json` of its own; `instant.schema.ts` and `instant.perms.ts` are imported directly
  by `web/` (relative path) and pushed to InstantDB via `instant-cli` invoked from `web/`.
  `shared/node_modules` is a symlink into `web/node_modules` so `instant-cli` can resolve the
  `@instantdb/svelte` import inside those files.
- `web/` — a pure Svelte 5 + Vite SPA (no SvelteKit), managed and executed exclusively with
  `bun`. Owns the InstantDB client (`web/src/lib/db.ts`) bound to `shared/instant.schema.ts`.
- `cli/` — a `uv`-managed Python 3.12 package, entrypoint `apollo` (via `click`). Replaces the
  original project's MCP server for Claude-operated workflows.
- `.env.instantdb` — the only place `NEXT_PUBLIC_INSTANT_APP_ID` and
  `INSTANT_APP_ADMIN_TOKEN` are stored. Gitignored, never committed. See "Env file contract"
  below.

## Setup

```bash
cd cli && uv sync
cd web && bun install
```

## Quality gates

A file is not "done" until its half of the monorepo passes its gate with zero findings and
zero suppressions.

**`cli/` (Python — always covers `shared/scripts/` alongside `cli/` itself):**

```bash
cd cli
uv run ruff check --config pyproject.toml . ../shared/scripts
uv run ruff format --check --config pyproject.toml . ../shared/scripts
uv run ty check . ../shared/scripts
```

`--config pyproject.toml` is required on the ruff commands because ruff's config
discovery does not reach outside `cli/` on its own — see `cli/README.md` "Quality
gates" for the full explanation. These are the exact commands Phase 6's
VERIFY-02/VERIFY-03 reuse verbatim; do not narrow this scope.

**`web/` (TypeScript/Svelte):**

```bash
cd web
bun run lint
bun run format:check
bun run check
```

**Both test suites:**

```bash
cd web && bun test
cd cli && uv run pytest
```

`bun run lint` / `bun run format:check` run Biome (formatter + linter) over `../shared`,
`./src`, and `./vite.config.ts` using the single `biome.json` at the repo root — this is what
keeps `shared/instant.schema.ts` and `shared/instant.perms.ts` inside the same formatter/linter
reach as `web/`. `bun run check` runs `svelte-check` + `tsc`, the authority for `.svelte` and
TypeScript correctness.

`bun` is the only JS/TS package manager and executor for this repo — no `npm`/`yarn`/`pnpm`
lockfile should ever exist under `web/`. All frontend logic is `.ts`, including `<script
lang="ts">` inside `.svelte` files. The single exception is `web/svelte.config.js`, which the
Svelte tooling loads through bare Node with no transpile step and therefore cannot be `.ts`.

## Shared ANBIMA calendar

`shared/anbima-calendar.json` is vendored, static data: a table of ANBIMA federal
business-day holidays from 2000-01-01 through 2078-12-25. Both
`web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py` read exclusively from
this JSON file — it is **never computed at runtime** by either runtime, and
neither one ever calls a library's built-in/algorithmic calendar
(`Calendar.load(...)`).

To regenerate it (roughly yearly, by hand, offline — never as part of any
runtime code path):

```bash
uv run --project cli python shared/scripts/update_calendar.py
uv run --project cli python shared/scripts/update_calendar.py --check   # idempotence check only, no write
```

`shared/bizdays.testcases.json` is the cross-runtime parity fixture: the single
source of truth for expected business-day-math results, consumed by both
`bun test` (`web/`) and `uv run pytest` (`cli/`). Any new date-math behavior or
edge case must be added to this shared fixture, never inlined into only one
runtime's test file — that is what keeps the two implementations provably
identical.

Both `shared/anbima-calendar.json` and `shared/bizdays.testcases.json` are
intentionally excluded from `biome.json`'s `files.includes`: they are data
files owned by their producers (the generator script and the test-fixture
author, respectively), not source code needing a JS/TS formatter or linter.

## Schema workflow

`shared/instant.schema.ts` and `shared/instant.perms.ts` are the live source of truth for the
InstantDB app's schema and permission rules. To change them:

1. Edit `shared/instant.schema.ts` and/or `shared/instant.perms.ts`.
2. From `web/`, run `bun run instant:push` to push the change live.
3. `bun run instant:verify` pulls the live schema/perms into a throwaway
   `web/.instant-verify/` directory (gitignored) so you can diff live state against
   `shared/` source without touching it.
4. `bun run instant:pull` overwrites `shared/instant.schema.ts` / `shared/instant.perms.ts`
   with the live state — deliberate-use only, since it can silently discard local edits.

## Env file contract

`.env.instantdb` is gitignored and must never be committed. It holds two values:

- `NEXT_PUBLIC_INSTANT_APP_ID` — the only value the SPA and CLI runtimes read at normal
  operation time.
- `INSTANT_APP_ADMIN_TOKEN` — exists solely so `instant-cli` can push/pull schema and
  permissions. Application code (the SPA, and every `apollo` CLI subcommand other than the
  schema-management tooling) never reads it.

## Re-verifying Phase 1

`.planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh` re-runs every SETUP-01
through SETUP-08 gate for this phase in one command and exits 0 only if all of them pass.
