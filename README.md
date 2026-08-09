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

## Routine-instance generation job

Apollo has no backend process and no scheduler. The routine-instance generation job runs
client-side, triggered by a human simply using either channel:

- **SPA**: once per authenticated browser session, fired from `Shell.svelte`'s `onMount` the
  moment a user is signed in.
- **CLI**: on demand, via `apollo rotina gerar-instancias`.

Both trigger the exact same algorithm — `runRoutineInstanceJob` in `web/src/lib/routineJob.ts`
and its byte-identical Python twin, `run_routine_instance_job` in
`cli/apollo_cli/routine_job.py` — against the range `[today, end of next month]`.

### The three generation types (D-05-A)

| `tipoGeracao` | Date rule | `offsetDias` meaning |
|---|---|---|
| `du_fixo` | Nth **business** day of the month | integer >= 1 |
| `corrido_fixo` | Nth **calendar** day of the month, clamped to the month's last day | integer >= 1 |
| `encadeado` | chained off another `templatesRotina`'s instance (`--antecessor-id`) | business days after the antecessor's `dataPrevista`, integer >= 0 |

### `encadeado` semantics (D-05-B/D-05-D/D-05-E)

An `encadeado` template never dates itself independently — it inherits from its antecessor:

- **D-05-B**: `offsetDias` counts **business days after the antecessor instance's own
  `dataPrevista`** (its planned date, never a delayed/actual one — see D-05-F below).
- **D-05-D**: `competencia` is **inherited verbatim** from the antecessor instance; the
  encadeado template's own `regraCompetencia` is never consulted, even if set.
- **D-05-E**: `dataPrevistaEstimada` is set whenever the antecessor's instance is not yet
  persisted or not yet `concluida` — cleared once the antecessor is marked done.
- **D-05-F**: a status change on the antecessor (e.g. marking it `concluida`) never re-keys
  its encadeado successor's `dedupeKey`/`dataPrevista`/`competencia` — proven live by
  `web/e2e/routine-job.spec.ts`'s re-run assertion. A key derived from a moving/late date would
  re-create the successor on every run and destroy idempotency (PROJECT.md C-09: delay
  propagation is out of scope).

### Why `dedupeKey` never duplicates

`dedupeKey = f"{templateId}:{competencia}:{dataPrevista}"` is **plain string concatenation**,
not a hash. The uniqueness guarantee lives entirely in the InstantDB schema constraint
`instanciasRotina.dedupeKey.unique()` (`shared/instant.schema.ts`) — not in the key's entropy,
and not in the job's own query-before-write diff, which by itself cannot prevent two genuinely
overlapping writers from racing on the same key. Both the write path (a lookup-keyed
`.update()`, never a strict insert) and the concurrency-tolerant catch/re-query around it are
designed around that constraint being the actual source of truth.

**Never duplicates, never deletes, never resets a status you set** — each clause is proven by
a specific test, not merely asserted here:

| Guarantee | Proving test |
|---|---|
| A second run of either channel creates zero new records for unchanged templates | `cli/tests/test_routine_job.py::test_gerar_instancias_double_run_idempotent_and_preserves_status`, `web/e2e/routine-job.spec.ts` |
| Records generated by one channel are recognized (not duplicated) by the other, in both directions | `web/e2e/routine-job-cross-channel.spec.ts` (Test 1 + Test 2), `cli/tests/test_routine_job_parity.py::test_direction_a_cli_generates_then_cli_recognizes_own_records` |
| Two genuinely overlapping processes never produce two rows for one `dedupeKey` | `cli/tests/test_routine_job_parity.py::test_concurrent_double_run_leaves_no_duplicate_dedupe_keys` |
| A manually-set `concluida` status survives every later job run unchanged | `cli/tests/test_routine_job.py`, `web/e2e/routine-job.spec.ts` |
| Neither channel ever issues an `instanciasRotina` delete | grep gates in `verify-phase-05.sh` Gate 6, against both `routineJob.ts` and `routine_job.py` |

A template is skipped, never crashed on, when its configuration cannot be resolved (see
`cli/README.md`'s skip-reason table under `apollo rotina gerar-instancias` for the full list
and what an operator should do about each one).

## Re-verifying Phase 1

`.planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh` re-runs every SETUP-01
through SETUP-08 gate for this phase in one command and exits 0 only if all of them pass.

## Re-verifying Phase 5

```bash
bash .planning/phases/05-idempotent-routine-instance-job/verify-phase-05.sh
```

Re-proves every JOB-01/JOB-02 gate — quality gates, the live schema's `dedupeKey.unique()`
constraint, offline TS/Python fixture parity, live double-run idempotency, cross-channel
recognition in both directions, and the genuine-concurrency non-duplication proof — in one
command, exiting `0` and printing `PHASE 05 VERIFIED` as its final line only when every gate
passes. On a normal run it reuses the already-persisted CLI session and Playwright
`storageState` and never sends a magic-code email; pass `--with-magic-code` /
`VERIFY_MAGIC_CODE=1` to also re-prove the real magic-code round trip.
