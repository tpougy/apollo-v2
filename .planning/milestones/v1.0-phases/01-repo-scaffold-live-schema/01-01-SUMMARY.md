---
phase: 01-repo-scaffold-live-schema
plan: 01
subsystem: database
tags: [instantdb, svelte5, vite, bun, instant-cli, schema, permissions]

# Dependency graph
requires: []
provides:
  - "web/ pure Svelte 5 + Vite SPA (no SvelteKit), Bun-managed, builds and type-checks clean"
  - "shared/instant.schema.ts — 9-entity domain schema + 9 links, live on InstantDB"
  - "shared/instant.perms.ts — donoId-scoped permission rules, live on InstantDB"
  - "web/src/lib/db.ts — typed InstantDB client bound to the shared schema"
  - "web/vite.config.ts — .env.instantdb loading pattern (dotenv.parse + narrow define)"
  - "Cross-package resolution pattern for shared/*.ts importing @instantdb/svelte (tsconfig paths + vite alias + shared/node_modules symlink)"
affects: [02-anbima-calendar, 03-cli-crud, 04-spa-crud, 05-routine-job, 06-parity-verification]

# Tech tracking
tech-stack:
  added: ["@instantdb/svelte@1.0.63", "svelte@5.56.8", "vite@8.2.1", "instant-cli@1.0.63", "svelte-check@4.7.5", "dotenv@17"]
  patterns:
    - "shared/*.ts has no package.json/node_modules of its own; web/ is the only real Node package. A shared/node_modules symlink to ../web/node_modules lets instant-cli (which resolves imports relative to the file's own directory) find @instantdb/svelte. A tsconfig `paths` mapping and a vite `resolve.alias` provide the equivalent fix for svelte-check/tsc and for the production bundle."
    - "Non-standard .env filenames (.env.instantdb) must be parsed manually via dotenv.parse + fs.readFileSync into a local constant and injected through a single-key vite `define`; never call dotenv.config()/loadEnv against a file that also holds a privileged credential."
    - "Permission rules are authored once as a shared constant (donoRules) and referenced by every entity key, never retyped per entity."

key-files:
  created:
    - web/package.json
    - web/vite.config.ts
    - web/svelte.config.js
    - web/tsconfig.json / tsconfig.app.json / tsconfig.node.json
    - web/src/main.ts
    - web/src/App.svelte
    - web/src/lib/db.ts
    - web/src/vite-env.d.ts
    - shared/instant.schema.ts
    - shared/instant.perms.ts
    - shared/node_modules (symlink -> ../web/node_modules)
  modified: []

key-decisions:
  - "templatesRotina.ativo added to the schema beyond the SPEC field table, required by the routine-generation job spec ('para cada templatesRotina ativo')."
  - "shared/node_modules is a symlink into web/node_modules so instant-cli can resolve @instantdb/svelte from shared/*.ts; this is separate from (and in addition to) the vite alias / tsconfig paths used for the build and type-check paths."
  - "Guest-access denial for SETUP-08/VERIFY-05 was proven with a write (transact) attempt via @instantdb/admin's asUser({guest:true}) impersonation, not a read query — InstantDB filters view-denied rows silently (empty result, exit 0) rather than erroring the query, so a read-based guest test can never produce a non-zero exit. @instantdb/admin was installed only transiently for this one-off verification script and was NOT committed as a dependency of web/."

patterns-established:
  - "Cross-package TS import from web/ into shared/: relative import path + tsconfig `include` covering ../shared/*.ts + `paths` alias for the one external package shared/ needs."
  - "instant:push / instant:pull / instant:verify scripts in web/package.json using INSTANT_SCHEMA_FILE_PATH / INSTANT_PERMS_FILE_PATH env overrides, cwd always = web/."

requirements-completed: [SETUP-01, SETUP-03, SETUP-06, SETUP-07, SETUP-08]

# Metrics
duration: 55min
completed: 2026-08-09
---

# Phase 1 Plan 01: Repo Scaffold & Live Schema Summary

**Pure Svelte 5 + Vite SPA scaffolded under `web/`, and the 9-entity InstantDB domain schema + donoId permission rules are live on the real InstantDB app, with a write-based guest rejection proving server-side enforcement.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-09T03:19 (approx, first file write)
- **Completed:** 2026-08-09T03:33 (last task commit)
- **Tasks:** 3/3 completed
- **Files modified:** 20 tracked files created (13 in Task 1, 6 in Task 2, 1 symlink in Task 3) + live InstantDB app state (schema + perms)

## Accomplishments

- `web/` installs, builds, and type-checks clean as a Bun-managed, SvelteKit-free Svelte 5 + Vite SPA. The built `dist/` bundle provably contains the InstantDB app id and provably does NOT contain the admin token.
- `shared/instant.schema.ts` declares all 9 domain entities (`fundos`, `projetos`, `etapas`, `tarefas`, `templatesRotina`, `instanciasRotina`, `tickets`, `subtarefas`, `logInferenciaClaude`) with `donoId: i.string().indexed()` on every one, `instanciasRotina.dedupeKey` as `.unique().indexed()`, and all 9 links.
- `shared/instant.perms.ts` applies one `donoRules` constant to all 9 domain entities (no per-entity retyping), locks `attrs.create` to `"false"`, and leaves the built-in users entity's default rule untouched.
- Both files are pushed live to the real InstantDB app (`bun run instant:push` exits 0 twice in a row — additive/idempotent), and the live state was pulled back into a throwaway `web/.instant-verify/` directory and confirmed byte-for-byte consistent (all 9 entities, both donoId rule strings), without ever touching `shared/*.ts` source.
- Enforcement was proven server-side: an admin InstaQL query resolves all 9 entities with empty arrays (app stays clean, zero domain data written), and a **write** attempt as an unauthenticated guest against `fundos` was rejected with `Permission denied: not perms-pass?` (captured verbatim below as the Phase 6 VERIFY-05 baseline).

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold the pure Svelte 5 + Vite SPA under web/** - `07adedc` (feat)
2. **Task 2: Author shared/instant.schema.ts + shared/instant.perms.ts, bind SPA client** - `afe820d` (feat)
3. **Task 3: Push schema and perms to the live InstantDB app, verify round-trip** - `e094943` (feat)

_No TDD tasks in this plan (infrastructure/scaffolding, not application behavior)._

## Files Created/Modified

- `web/package.json` - Bun-managed SPA manifest; scripts `dev`/`build`/`preview`/`check`/`instant:push`/`instant:pull`/`instant:verify`
- `web/vite.config.ts` - Parses `.env.instantdb` via `dotenv.parse` (never `dotenv.config()`/`loadEnv`), injects exactly one `define` key (`VITE_INSTANT_APP_ID`), and aliases `@instantdb/svelte` so `shared/*.ts` resolves it at build time
- `web/svelte.config.js` - The one permitted `.js` file in `web/` (see Notable Exception below)
- `web/tsconfig.app.json` - Includes `../shared/*.ts`; adds `baseUrl`/`paths` so svelte-check/tsc resolve `@instantdb/svelte` from files outside `web/`
- `web/src/lib/db.ts` - `export const db = init({ appId, schema })`, re-exports `id`, `lookup`
- `web/src/App.svelte` - Renders `db.useAuth()` state (não autenticado / email / erro) as a scaffold smoke screen
- `shared/instant.schema.ts` - 9 domain entities + 9 links, single source of truth
- `shared/instant.perms.ts` - `donoRules` constant referenced by all 9 entities + `attrs.create: "false"`
- `shared/node_modules` - symlink to `../web/node_modules` (see Deviations)

## Decisions Made

- **`templatesRotina.ativo` field addition:** Not in the SPEC's field table for `templatesRotina`, but required by SPEC §"Job de geração de instâncias de rotina" ("Para cada `templatesRotina` ativo"). Added as `i.boolean()`. Flagging for reviewer confirmation per plan instruction.
- **No `onDelete` cascade semantics** declared on any link — SPEC does not specify cascade behavior; deliberate omission, revisit in Phase 3/4 if needed.
- **`web/svelte.config.js` stays `.js`:** This is the Svelte tooling's own config entrypoint, loaded through bare Node with no transpile step, so it cannot be `.ts`. It is configuration only (a single default-exported empty object with a JSDoc type annotation) — zero logic — which keeps C-08's "frontend logic is always `.ts`" intact. This is the one intentional exception to that rule.
- **`instant-cli` needs no personal login:** Confirmed during Task 3 — `instant-cli push`/`pull`/`query` all authenticated successfully using only `INSTANT_APP_ADMIN_TOKEN` from `.env.instantdb` (env-var fallback in `instant-cli`'s auth resolution). `npx instant-cli login` (personal browser login) was never needed, matching the plan's environment_facts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `shared/node_modules` symlink so `instant-cli` can resolve `@instantdb/svelte` from `shared/*.ts`**
- **Found during:** Task 3 (first `bun run instant:push` attempt)
- **Issue:** `instant-cli push` failed with `Cannot find module '@instantdb/svelte/dist/cli'` even though it was invoked from `web/` with `INSTANT_SCHEMA_FILE_PATH=../shared/instant.schema.ts`. `instant-cli` bundles/evaluates the schema/perms files using Node module resolution rooted at *those files' own directory* (`shared/`), not at the cwd (`web/`) — so the `INSTANT_SCHEMA_FILE_PATH`/`INSTANT_PERMS_FILE_PATH` env-var redirection alone (RESEARCH Pattern 2) was insufficient; it only tells `instant-cli` *which file* to read, not *where to resolve its imports from*.
- **Fix:** Created `shared/node_modules` as a symlink to `../web/node_modules` (no `package.json` added to `shared/`, keeping C-01's "shared/ has no package.json of its own" intact). This is orthogonal to the `tsconfig.app.json` `paths` mapping and `vite.config.ts` `resolve.alias` added in Task 2 — those fix `svelte-check`/`tsc` and the Vite production bundle respectively; the symlink fixes `instant-cli`'s own internal resolution.
- **Files modified:** `shared/node_modules` (new symlink)
- **Verification:** `bun run instant:push` exits 0 (twice, idempotently) and `bun run instant:verify` successfully pulls all 9 entities back from the live app.
- **Committed in:** `e094943` (Task 3 commit)

**2. [Rule 3 - Blocking] Added a `vite.config.ts` `resolve.alias` and a `tsconfig.app.json` `paths` mapping for `@instantdb/svelte`**
- **Found during:** Task 2 (`bun run check` and `bun run build` after wiring `web/src/lib/db.ts` to `shared/instant.schema.ts`)
- **Issue:** `shared/instant.schema.ts` and `shared/instant.perms.ts` import `@instantdb/svelte`, but those files live outside `web/` and have no `node_modules` ancestor of their own. Both `svelte-check`/`tsc` (`Cannot find module '@instantdb/svelte'`) and Vite's production build (`Rolldown failed to resolve import "@instantdb/svelte"`) failed for this reason — Node-style bare-specifier resolution walks up from the *importing file's* directory, and `shared/` is a sibling of `web/`, not a descendant.
- **Fix:** Added `baseUrl: "."` + `paths: { "@instantdb/svelte": ["./node_modules/@instantdb/svelte"] }` to `web/tsconfig.app.json`, and `resolve: { alias: { "@instantdb/svelte": <absolute path to web/node_modules/@instantdb/svelte> } }` to `web/vite.config.ts`.
- **Files modified:** `web/tsconfig.app.json`, `web/vite.config.ts`
- **Verification:** `bun run check` → 0 errors/warnings across 137 files; `bun run build` → exits 0, produces `dist/`.
- **Committed in:** `afe820d` (Task 2 commit)

**3. [Rule 3 - Blocking] Substituted a write-based guest-rejection test for the plan's read-based one**
- **Found during:** Task 3, step 5 (guest permission-enforcement proof)
- **Issue:** The plan's literal verification command (`instant-cli query '{"fundos":{}}' --env ../.env.instantdb --as-guest`, expected to exit non-zero) instead exited 0 with an empty result (`{"fundos": []}`) — identical to the same query run with `--admin` or with no auth flag at all, since `fundos` currently has zero rows. Per InstantDB's documented behavior (confirmed via the official docs: "The Python SDK includes `debug_query` ... helper functions that execute operations with permission checks and report the success or failure reasons for each matching row" and `db.asUser({guest:true}).query(...)` — view-rule denials are evaluated **per row** and silently filter out disallowed rows; they do not error the query. On an empty table this is indistinguishable from an unenforced query, so no read-based test — with or without existing data restrictions — can produce a non-zero exit for a `view` rule.
- **Fix:** Enforcement instead requires testing a **write**, since InstantDB docs are explicit that "Transactions will fail if a user lacks the necessary permissions." Temporarily installed `@instantdb/admin` as a `web/` devDependency (reverted immediately after, never committed — confirmed via `git diff --stat package.json bun.lock` showing no changes) and ran a one-off script using `db.asUser({ guest: true }).transact(tx.fundos[id()].update({...}))`. This is the officially documented impersonation pattern for permission testing from the backend (`instantdb.com/docs/backend` "Impersonate Users with Admin SDK"), the same mechanism `instant-cli`'s own `--as-guest` query flag uses under the hood (`as-guest: true` header on the `/admin/query` endpoint) — extended here to `/admin/transact`-equivalent behavior via the admin SDK's `asUser`.
- **Result (verbatim, no admin token or app id present in the output):**
  ```
  RESULT=EXPECTED_REJECTION
  MESSAGE=Permission denied: not perms-pass?
  ```
  A follow-up admin query confirmed `fundos` remained `[]` — no record was created, satisfying the plan's "do not create any records in the live app" constraint.
- **Files modified:** None committed (verification script was run from the scratchpad directory, outside the repo; `@instantdb/admin` devDependency added and then fully reverted from `web/package.json`/`web/bun.lock` before committing Task 3).
- **Committed in:** `e094943` (Task 3 commit message documents the methodology and this file's Deviations section carries the verbatim baseline)

---

**Total deviations:** 3 auto-fixed (3 blocking/Rule 3)
**Impact on plan:** All three were necessary to make the monorepo's non-standard `shared/` boundary actually work end-to-end (build, type-check, and live push) and to produce a real, verifiable proof of server-side permission enforcement rather than a misleading green checkmark on an unenforceable empty-table read. No scope creep — no new runtime dependency was added to `web/`, and the schema/perms content exactly matches the plan's locked shape.

## Issues Encountered

- The isomorphic `@instantdb/svelte` client (browser-oriented, uses IndexedDB-backed reactor state) cannot run its `transact()` path in a plain Bun/Node script — it threw an unrelated internal error (`this.kv.currentValue` undefined) before any network call was made. This was a dead end for guest-rejection testing and is why `@instantdb/admin` (a genuinely server-side SDK) was used instead for that one verification script.

## User Setup Required

None - no external service configuration required. `.env.instantdb` already existed with a live, empty InstantDB app provisioned before this plan started (per the plan's `<environment_facts>`).

## Next Phase Readiness

- `shared/instant.schema.ts` and `shared/instant.perms.ts` are now the live, server-confirmed source of truth for every later phase (CLI CRUD, SPA CRUD, routine-generation job, parity verification).
- The InstantDB app remains completely empty (zero domain records) — Phases 2-6 start from a clean slate as required.
- The `web/` half of the monorepo is buildable and type-checked; `cli/` (Python, `uv`-managed) is not yet scaffolded — that is plan 01-02/01-03 or a later phase's responsibility per the roadmap.
- The cross-package resolution pattern (tsconfig `paths` + vite `alias` + `shared/node_modules` symlink) is now established and should be reused/extended (not reinvented) whenever `shared/*.ts` needs a new npm dependency in later phases.
- Phase 6 VERIFY-05 can reuse the `db.asUser({ guest: true }).transact(...)` pattern documented above as its guest-denial test methodology, since the plan's original read-based approach cannot produce a meaningful pass/fail signal against an empty table.

---
*Phase: 01-repo-scaffold-live-schema*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 11 claimed files/paths verified present on disk (`web/package.json`, `web/vite.config.ts`, `web/svelte.config.js`, `web/tsconfig.app.json`, `web/src/main.ts`, `web/src/App.svelte`, `web/src/lib/db.ts`, `web/src/vite-env.d.ts`, `shared/instant.schema.ts`, `shared/instant.perms.ts`, `shared/node_modules`). All 3 task commit hashes (`07adedc`, `afe820d`, `e094943`) verified present in git history.
