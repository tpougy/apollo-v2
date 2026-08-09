---
phase: 01-repo-scaffold-live-schema
plan: 03
subsystem: infra
tags: [biome, svelte-check, instantdb, gitignore, monorepo, verification]

# Dependency graph
requires:
  - phase: 01-repo-scaffold-live-schema (plan 01)
    provides: "web/ Svelte 5 SPA, shared/instant.schema.ts + instant.perms.ts live on InstantDB"
  - phase: 01-repo-scaffold-live-schema (plan 02)
    provides: "cli/ uv-managed Python package with apollo entrypoint and ruff+ty gates"
provides:
  - "biome.json at repo root, covering shared/**/*.ts and web/src (formatter + linter, zero findings)"
  - "web/package.json lint / lint:fix / format:check scripts"
  - "Hardened .gitignore (explicit .env.instantdb line, node_modules/dist globs, tool caches)"
  - "Root README.md documenting layout, setup, all six quality-gate commands, schema workflow, env contract"
  - ".planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh — single re-runnable gate for SETUP-01..08"
  - ".planning/phases/01-repo-scaffold-live-schema/guest-write-check.mjs — write-based guest-denial probe for SETUP-08"
affects: [02-anbima-calendar, 03-cli-crud, 04-spa-crud, 05-routine-job, 06-parity-verification]

# Tech tracking
tech-stack:
  added: ["@biomejs/biome@2.5.7 (web/ devDependency)", "@instantdb/admin@1.0.63 (web/ devDependency, verify-script-only)"]
  patterns:
    - "Biome must be invoked with cwd = repo root, not web/. --config-path=DIR does NOT relocate the path-matching root for files.includes — it only tells Biome where to load the config file from. When invoked with cwd=web/, files.includes patterns like 'shared/**/*.ts' are resolved against web/ (the actual cwd), not against the config file's directory, so ../shared and ./src are reported as outside the project and silently skipped ('No files were processed'). Fix: web/package.json's lint/lint:fix/format:check scripts do `cd .. && biome check shared web/src web/vite.config.ts` so cwd and files.includes are both anchored at the repo root."
    - "SETUP-08's live guest-permission-denial proof must be a WRITE, not a read. InstantDB's `view` rule denials are evaluated per row and silently filter disallowed rows out of a query result — against an app with zero rows (true for every SETUP-08 rerun, since Phases 2-6 haven't written data yet) a guest read is indistinguishable from an enforced one (both exit 0 with `[]`). Only a create/update/delete attempt produces a real pass/fail signal. guest-write-check.mjs implements this via @instantdb/admin's asUser({guest:true}).transact(...), asserting rejection and creating no records."
key-files:
  created:
    - biome.json
    - README.md
    - .planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh
    - .planning/phases/01-repo-scaffold-live-schema/guest-write-check.mjs
  modified:
    - web/package.json
    - web/bun.lock
    - web/src/main.ts
    - web/src/lib/db.ts
    - web/vite.config.ts
    - .gitignore

key-decisions:
  - "web/ lint/lint:fix/format:check scripts run `cd .. && biome check ...` instead of `biome check --config-path=..`, because --config-path alone does not make Biome match files.includes patterns relative to the config directory when invoked from a different cwd (verified empirically, not assumed from docs)."
  - "@instantdb/admin added as a permanent web/ devDependency (unlike 01-01's transient, reverted use) so verify-phase-01.sh can rerun the guest-write denial probe on every invocation, per Phase 6's requirement that the script be rerunnable unchanged. It is devDependency-only, never imported by application/production code, so it does not enter the production bundle."

patterns-established:
  - "Repo-root Biome config as the single formatter+linter authority for shared/*.ts and web/src, paired with svelte-check as the .svelte type/logic authority (RESEARCH assumption A4 confirmed: Biome's experimental Svelte parser produced zero false positives against the Phase 1 scaffold, so no escape hatch was needed)."
  - "Single verify-phase-01.sh script as the phase's re-runnable proof, to be reused verbatim by /gsd:verify-work and Phase 6 VERIFY-02/03/05."

requirements-completed: [SETUP-01, SETUP-05]

# Metrics
duration: 20min
completed: 2026-08-09
---

# Phase 1 Plan 03: Web Quality Gates & Phase Closeout Summary

**Repo-root Biome (formatter+linter) covering `shared/` and `web/src`, a hardened `.gitignore`, a root `README.md`, and a single `verify-phase-01.sh` that re-proves all eight SETUP requirements — including a write-based live guest-permission-denial probe — in one command.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-09T03:37 (approx, first file read)
- **Completed:** 2026-08-09T03:44 (Task 2 commit)
- **Tasks:** 2/2 completed
- **Files modified:** 4 files created (Task 1: `biome.json`; Task 2: `README.md`, `verify-phase-01.sh`, `guest-write-check.mjs`) + 6 files modified across both tasks

## Accomplishments

- `biome.json` lives at the repo root and its `files.includes` covers `shared/**/*.ts`, `web/src/**/*.ts`, `web/src/**/*.svelte`, and `web/vite.config.ts` — `cd web && bun run lint`, `bun run format:check`, and `bun run check` all exit 0 with zero findings and zero suppressions.
- RESEARCH assumption A4 (Biome's experimental Svelte parser might false-positive) did **not** materialize: the escape hatch was not needed. The one real finding (`lint/style/noNonNullAssertion` in `web/src/main.ts`) was a genuine, easily-fixed issue, not a parser false positive.
- No `.js` file exists under `web/src/` or `shared/` except the documented `web/svelte.config.js` exception; no non-bun lockfile exists in `web/`.
- `.env.instantdb` is confirmed gitignored, untracked, and its admin token value is confirmed absent from every git-tracked file — enforced by an explicit `.gitignore` line plus a script-level `grep` scan.
- `verify-phase-01.sh` re-runs and passes all eight SETUP gates end-to-end, ending with `PHASE 01 VERIFIED`.
- SETUP-08's guest-denial proof is now genuinely re-runnable: `guest-write-check.mjs` attempts a real guest write against the live InstantDB app and asserts InstantDB rejects it with `Permission denied: not perms-pass?`, creating zero records.

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure Biome at the repo root to cover both shared/ and web/, and drive it to zero findings** - `6469c30` (feat)
2. **Task 2: Harden the ignore rules, document the repo, and gate all eight SETUP requirements in one script** - `6587783` (feat)

_No TDD tasks in this plan (infrastructure/quality-gate configuration, not application behavior)._

## Files Created/Modified

- `biome.json` - Repo-root formatter+linter config; `files.includes` spans `shared/**/*.ts` and `web/src/**`; `vcs.useIgnoreFile: true`
- `web/package.json` - Added `@biomejs/biome` + `@instantdb/admin` devDependencies; added `lint`, `lint:fix`, `format:check` scripts
- `web/src/main.ts` - Fixed the one real Biome finding (`noNonNullAssertion`) with an explicit null check
- `web/src/lib/db.ts`, `web/vite.config.ts` - Biome's import-order formatting applied (no logic change)
- `.gitignore` - Added explicit `.env.instantdb` line, `**/node_modules/`, `**/dist/`, `web/.instant-verify/`, `.instant-verify/`, `.ruff_cache/`, `.ty_cache/`, `*.egg-info/`
- `README.md` - Repo-root orientation: three-package layout, setup commands, all six quality-gate commands, schema push/pull/verify workflow, `.env.instantdb` contract
- `.planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh` - Executable, re-runnable gate for SETUP-01 through SETUP-08
- `.planning/phases/01-repo-scaffold-live-schema/guest-write-check.mjs` - Write-based live guest-permission-denial probe used by SETUP-08

## Decisions Made

- **Biome invocation must anchor cwd at the repo root, not use `--config-path` alone:** see `tech-stack.patterns` above for the full empirical finding. This is a correction to the plan's literal `<action>` text (which specified `biome check --config-path=.. ../shared ./src ./vite.config.ts`) — that exact invocation reproducibly fails with "No files were processed in the specified paths" when run with cwd=`web/`, regardless of whether `--config-path` points at a directory or the config file itself. Fixed via Rule 1 (bug): scripts now `cd .. && biome check shared web/src web/vite.config.ts`, which resolves both the cwd and the `files.includes` patterns against the same root and works correctly.
- **`@instantdb/admin` kept as a permanent (not transient) `web/` devDependency:** 01-01 installed and then fully reverted this package for a one-off verification script. This plan needs the same write-based guest-denial methodology to be re-runnable indefinitely (Phase 6, `/gsd:verify-work`), so it is now a committed devDependency used exclusively by `guest-write-check.mjs` — never imported by `web/src/**` or bundled into the production build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the Biome invocation pattern in web/package.json's lint scripts**
- **Found during:** Task 1, first `bun run lint` attempt
- **Issue:** The plan's specified script (`biome check --config-path=.. ../shared ./src ./vite.config.ts`, run with cwd=`web/`) reproducibly failed with "No files were processed in the specified paths — check your biome.json ... These paths were provided but ignored". Verified via direct manual testing (including with a config containing zero VCS settings, and with absolute paths) that Biome resolves `files.includes` patterns against the actual process cwd, not the `--config-path` directory, so `shared/**/*.ts` never matched `../shared` when cwd was `web/`.
- **Fix:** Changed `lint`, `lint:fix`, `format:check` scripts to `cd .. && biome check/format [paths relative to repo root]`, anchoring cwd and `files.includes` at the same root. Verified working both from `bun run lint` (cwd starts at `web/`, `cd ..` moves it) and confirmed the Biome binary resolves correctly via `bun`'s PATH injection of `web/node_modules/.bin`.
- **Files modified:** `web/package.json`
- **Verification:** `cd web && bun run lint && bun run format:check` both exit 0, scanning `shared/`, `web/src/`, and `web/vite.config.ts` (7 files).
- **Committed in:** `6469c30` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed the one real Biome lint finding**
- **Found during:** Task 1, first successful `bun run lint` scan
- **Issue:** `web/src/main.ts:6` used a forbidden non-null assertion (`document.getElementById("app")!`).
- **Fix:** Replaced with an explicit `if (!target) throw new Error(...)` guard.
- **Files modified:** `web/src/main.ts`
- **Verification:** `bun run lint` reports zero findings after the fix.
- **Committed in:** `6469c30` (Task 1 commit)

**3. [Rule 1/3 - Bug/Blocking] Substituted a write-based guest-rejection probe for the plan's literal read-based `instant-cli query --as-guest` command**
- **Found during:** Task 2, building `verify-phase-01.sh` SETUP-08
- **Issue:** The plan's literal verify command (`bunx instant-cli query '{"fundos":{}}' --env ../.env.instantdb --as-guest`, expected to exit non-zero) was tested and, exactly as 01-01-SUMMARY.md had already documented for the equivalent plan-01 case, exits 0 with `{"fundos": []}` — identical to an authenticated/admin query, since InstantDB's `view` rule denials are per-row filters, not query errors, and the table has zero rows. No read-based command can ever produce a non-zero exit here.
- **Fix:** Added `guest-write-check.mjs`, reusing 01-01's established methodology (`@instantdb/admin`'s `asUser({guest:true}).transact(...)`), invoked by `verify-phase-01.sh` from `web/` so it resolves `@instantdb/admin`. Confirmed rejection message `Permission denied: not perms-pass?` and confirmed via a follow-up admin query that `fundos` remains `[]` (no record created). Unlike 01-01's transient use, `@instantdb/admin` is now a permanent `web/` devDependency (documented above) since this probe must be re-runnable by Phase 6.
- **Files modified:** `.planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh`, `.planning/phases/01-repo-scaffold-live-schema/guest-write-check.mjs`, `web/package.json` (added `@instantdb/admin` devDependency), `web/bun.lock`
- **Verification:** `bash verify-phase-01.sh` SETUP-08 section passes; guest write rejected; zero records created (confirmed via `db.query({fundos:{}})` returning `[]` before and after).
- **Committed in:** `6587783` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 1/3 bug+blocking)
**Impact on plan:** All three corrections were necessary to make the plan's stated verification commands actually produce the pass/fail signal they claim to — the plan's literal Biome invocation and read-based guest-denial command both silently failed to exercise what they intended. No scope narrowing occurred: `shared/**/*.ts` remains in Biome's `files.includes` and the guest-denial check still proves real server-side enforcement (now more rigorously, via a write).

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required. `.env.instantdb` already existed with the live InstantDB app provisioned in plan 01-01.

## Next Phase Readiness

- Phase 1 is fully closed: `verify-phase-01.sh` re-proves all eight SETUP requirements (SETUP-01 through SETUP-08) in one command, ending with `PHASE 01 VERIFIED`. The script is intended to be reused verbatim by `/gsd:verify-work` and Phase 6 VERIFY-02/03/05.
- All five ROADMAP Phase 1 success criteria are each backed by a named, automated check in `verify-phase-01.sh`:
  - Monorepo layout + secret hygiene → SETUP-01 section
  - `cli/` installs + entrypoint → SETUP-02 section
  - `web/` installs + builds + no SvelteKit → SETUP-03 section
  - `cli/` ruff+ty clean → SETUP-04 section
  - `web/` Biome+svelte-check clean → SETUP-05 section
- `guest-write-check.mjs`'s write-based methodology is now the established, reusable pattern for any future live-permission-enforcement proof (Phase 6 VERIFY-05 can call it directly rather than re-deriving the approach).
- `web/` now carries two devDependencies whose only consumer is tooling, not the shipped app: `@biomejs/biome` (build-time formatter/linter) and `@instantdb/admin` (verify-script-only) — neither is imported by `web/src/**` or present in the production `dist/` bundle (confirmed by SETUP-06's grep check).

---
*Phase: 01-repo-scaffold-live-schema*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 5 claimed files verified present on disk (`biome.json`, `README.md`, `.planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh`, `.planning/phases/01-repo-scaffold-live-schema/guest-write-check.mjs`, `web/src/main.ts`). Both task commit hashes (`6469c30`, `6587783`) verified present in git history.
