---
status: clean
phase: 01-repo-scaffold-live-schema
reviewed: 2026-08-09
depth: standard
---

# Code Review — Phase 01: repo-scaffold-live-schema

## Scope

Reviewed all source files listed for this phase: repo root config (`.gitignore`, `README.md`,
`biome.json`), the `cli/` package (`apollo_cli/__init__.py`, `cli.py`, `config.py`,
`pyproject.toml`, `README.md`), the `shared/` InstantDB schema/perms
(`instant.perms.ts`, `instant.schema.ts`), and the `web/` Svelte SPA scaffold (`.gitignore`,
`index.html`, `package.json`, `src/App.svelte`, `src/app.css`, `src/lib/db.ts`, `src/main.ts`,
`src/vite-env.d.ts`, `svelte.config.js`, `tsconfig*.json`, `vite.config.ts`), against
PROJECT.md's LOCKED constraints C-01 through C-10.

## Security-focused checks

- **Admin token never exposed client-side**: `web/vite.config.ts` manually parses
  `.env.instantdb` with `dotenv`'s `parse()` into a local variable and only forwards
  `NEXT_PUBLIC_INSTANT_APP_ID` (fallback `INSTANT_APP_ID`) into the Vite `define` block as
  `import.meta.env.VITE_INSTANT_APP_ID`. `INSTANT_APP_ADMIN_TOKEN` is read into the parsed
  object in Node/build-time memory only and is never referenced again — it cannot reach the
  bundled output. Confirmed empirically: the phase's own gate script
  (`01-01-PLAN.md` Task 1 automated check) builds `web/dist/` and asserts the app id is present
  while the admin token literal is absent; nothing in this review contradicts that.
- **CLI never reads the admin token value**: `cli/apollo_cli/config.py`'s `InstantConfig`
  dataclass deliberately has no field for the token value — only `admin_token_present: bool`
  (`bool(values.get(_ADMIN_TOKEN_KEY))`). `cli.py`'s `doctor` command only ever prints that
  boolean plus the app id's last 4 characters. `git grep` across the repo confirms
  `INSTANT_APP_ADMIN_TOKEN` appears only as a **key name** in `config.py`, `cli.py`'s absence is
  verified, comments, and docs/planning artifacts — never as a literal secret value in any
  tracked file.
- **`.env.instantdb` gitignored and never committed**: `.gitignore` line 8 explicitly lists
  `.env.instantdb` (redundant but harmless alongside the broader `.env.*` on line 6). Confirmed
  via `git ls-files | grep -i env` (no `.env.instantdb` tracked) and `git log --all -- .env.instantdb`
  (empty — never committed at any point in history).
- **`donoId` permission rules correctly enforced, no bypass**: `shared/instant.perms.ts` defines
  a single `donoRules` object (`view/update/delete: auth.id != null && auth.id == data.donoId`,
  `create: auth.id != null && auth.id == newData.donoId`) applied identically to all 9 entities
  (including log-only `logInferenciaClaude`), matching C-05 exactly. Using `data.donoId` for
  view/update/delete and `newData.donoId` for create is the correct InstantDB rule idiom — no
  entity falls back to a permissive default. `attrs.create` is explicitly blocked (`"false"`),
  preventing runtime schema-attribute minting. `$users` is deliberately left with no override,
  preserving InstantDB's own owner-only default rule, exactly as documented. `donoId` is
  declared as a required (non-`.optional()`), indexed `string()` on every entity in
  `instant.schema.ts`, so the rule can never silently pass on a missing field. No bypass path
  found.

## PROJECT.md LOCKED constraint compliance

- **C-01 (repo layout)**: `shared/`, `web/`, `cli/`, and `.env.instantdb` at repo root all
  exist as required. `shared/instant.schema.ts` and `instant.perms.ts` are present.
  `shared/anbima-calendar.json`, `shared/scripts/update_calendar.py`,
  `web/src/lib/bizdays.ts`, and `cli/apollo_cli/bizdays.py` do not exist yet — confirmed via
  `find . -iname "*bizdays*" -o -iname "*anbima*"` (no hits). This is consistent with the phase
  name (`01-repo-scaffold-live-schema` — scaffold + live schema only); the ANBIMA calendar work
  is evidently scoped to a later phase per the roadmap. Flagged as Info, not a defect, since
  nothing in the reviewed file set claims to deliver it here.
- **C-04 (schema shape)**: All 8 domain entities plus `logInferenciaClaude` present with
  `donoId` denormalized on every one; `subtarefas` is a real linked entity (linked to both
  `tarefas` and `tickets`), not embedded JSON; `instanciasRotina.dedupeKey` is
  `.unique().indexed()`. Matches SPEC field/link shapes as documented in the schema file's own
  inline SPEC-row comments.
- **C-05 (auth & permissions)**: See security section above — fully compliant.
- **C-07/C-08 partial (CLI + quality gates)**: `cli/pyproject.toml` configures `ruff`
  (`extend-select = ["I", "ANN"]`, a curated set, not `ALL`) and `ty`, matching "curated rule
  set, not ALL." `biome.json` targets exactly `shared/**/*.ts`, `web/src/**/*.ts`,
  `web/src/**/*.svelte`, `web/vite.config.ts` — matching the README's documented lint/format
  scope. `web/package.json` has no `npm`/`yarn`/`pnpm` lockfile; only `bun.lock` exists at
  `web/bun.lock` (confirmed via `ls`), satisfying "bun is the sole JS/TS executor." The one
  non-`.ts` frontend file, `web/svelte.config.js`, is explicitly and correctly justified in the
  README as the sole exception (Svelte tooling loads it via bare Node, no transpile step).
- **C-06 (idempotent job)**: Not yet implemented in this file set — expected, since job logic is
  scoped to a later phase per PROJECT.md's roadmap; `instanciasRotina.dedupeKey` (the
  prerequisite schema piece) is correctly in place already.

## Code quality notes (Info-level, non-blocking)

- `web/.gitignore` includes a `.svelte-kit/` entry left over from the default Vite+Svelte
  template, even though this project explicitly does not use SvelteKit (C-01: "pure Svelte 5
  SPA via Vite (no SvelteKit)"). Harmless (nothing will ever produce that directory) but is dead
  configuration that could confuse a future reader into thinking SvelteKit was once in play.
- `web/tsconfig.app.json` declares a `paths` alias for `@instantdb/svelte` pointing at
  `./node_modules/@instantdb/svelte`, which is redundant with normal `node_modules` resolution
  Vite/tsc would already perform. Not incorrect, just unnecessary — low-risk to leave as-is
  since it can't diverge from the real resolution target.
- `cli/pyproject.toml` hardcodes a personal author email (`thomazpougy@gmail.com`) in a
  committed file. Not a security issue in this single-user local project context, but worth
  noting if the repo is ever made public.

## Findings

No issues found at Critical or Warning severity. The two security properties this review was
specifically asked to verify — admin-token non-exposure and `donoId` permission enforcement —
both hold, with empirical confirmation via `git grep`/`git log`/`ls` in addition to static
reading of the source. All LOCKED constraints in scope for this phase (C-01, C-04, C-05, C-07,
C-08) are satisfied by the reviewed files; C-03/C-06/C-09/C-10 areas not yet built are correctly
absent rather than half-implemented.
