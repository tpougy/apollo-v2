---
phase: 01-repo-scaffold-live-schema
verified: 2026-08-09T00:00:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 1: Repo Scaffold & Live Schema Verification Report

**Phase Goal:** The apollo-v2 monorepo exists with working tooling for both runtimes, and the InstantDB schema/permissions are the live source of truth for all future work.
**Verified:** 2026-08-09 (independent re-run, not trusting SUMMARY.md claims)
**Status:** passed
**Re-verification:** No — initial verification

## Method

All verification commands were re-executed live in this session (not inferred from SUMMARY.md text): `uv sync` in `cli/`, `bun install` in `web/`, `ruff check`/`ruff format --check`/`ty check` in `cli/`, `bun run lint`/`format:check`/`check`/`build` in `web/`, and the repo's own `.planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh`, which itself performs a live InstantDB push/pull round-trip and a write-based guest-permission-denial probe against the real InstantDB app.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `uv sync` in `cli/` succeeds, resolves `click`/`instantdb`/`python-dotenv` on Python 3.12 | ✓ VERIFIED | Re-ran `cd cli && uv sync` — exit 0, "Resolved 18 packages" |
| 2 | `bun install` in `web/` succeeds | ✓ VERIFIED | Re-ran `cd web && bun install` — exit 0, "Checked 171 installs across 212 packages" |
| 3 | `cli/` ruff + ty gates exit 0 with zero findings | ✓ VERIFIED | Re-ran `uv run ruff check .` → "All checks passed!"; `uv run ruff format --check .` → "4 files already formatted"; `uv run ty check` → "All checks passed!" |
| 4 | `web/` Biome + svelte-check gates exit 0 with zero findings, covering `shared/*.ts` too | ✓ VERIFIED | Re-ran `bun run lint` → "Checked 7 files... No fixes applied"; `bun run format:check` → clean; `bun run check` → "137 FILES 0 ERRORS 0 WARNINGS" |
| 5 | `web/` builds as a pure Svelte 5 + Vite SPA (no SvelteKit) | ✓ VERIFIED | `bun run build` exits 0, produces `dist/`; `web/src/routes` absent; `@sveltejs/kit` absent from `web/package.json` |
| 6 | `shared/instant.schema.ts` declares exactly the 9 entities each with indexed `donoId`, and `instanciasRotina.dedupeKey` is `.unique().indexed()` | ✓ VERIFIED | Direct grep: all 9 `i.entity(` declarations present; `donoId: i.string().indexed()` count = 9; exact string `dedupeKey: i.string().unique().indexed()` present |
| 7 | `shared/instant.perms.ts` applies identical donoId rules to all 9 entities, no `"true"` literals, `$users` untouched, `attrs.create` locked | ✓ VERIFIED | Direct grep: `: donoRules` count = 9; no `(view\|create\|update\|delete): "true"` matches; `$users` count = 0; `attrs: { allow: { create: "false" } }` present |
| 8 | The live InstantDB app has the schema/perms pushed and provably round-tripped from the server | ✓ VERIFIED | Live re-run of `verify-phase-01.sh` SETUP-07: `bun run instant:verify` pulled `web/.instant-verify/instant.schema.ts` from the real server; all 9 entities present in the pulled file |
| 9 | An unauthenticated guest write against `fundos` is rejected by live permission rules | ✓ VERIFIED | Live re-run of `verify-phase-01.sh` SETUP-08: `guest-write-check.mjs` executed against the real InstantDB app, printed `RESULT=EXPECTED_REJECTION`, script asserts this and passes |
| 10 | Built `web/dist/` bundle contains the InstantDB app id and does not contain the admin token | ✓ VERIFIED | Live re-run of `verify-phase-01.sh` SETUP-06 passed; manually confirmed via `apollo doctor` that only last-4-chars of app id and a boolean for token presence are ever printed |
| 11 | A single script re-runs all SETUP-01..08 gates and exits 0 | ✓ VERIFIED | `bash verify-phase-01.sh` executed live end-to-end, final line `PHASE 01 VERIFIED`, exit code 0 |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/instant.schema.ts` | 9-entity schema + 9 links, live | ✓ VERIFIED | All entities/links present, confirmed live via pull |
| `shared/instant.perms.ts` | donoId-scoped rules, live | ✓ VERIFIED | `donoRules` referenced 9x, live pull confirms rule strings |
| `web/vite.config.ts` | `.env.instantdb` load + narrow define | ✓ VERIFIED | Build succeeds; only app id injected, token absent from dist |
| `web/src/lib/db.ts` | Typed InstantDB client | ✓ VERIFIED | `init({ appId, schema })`, re-exports `id`/`lookup`; imported and used by `App.svelte` |
| `web/package.json` | Bun SPA manifest + instant-cli scripts | ✓ VERIFIED | `instant:push`/`instant:pull`/`instant:verify`/`lint`/`format:check`/`check` all present and functional |
| `cli/pyproject.toml` | uv manifest, `apollo` entrypoint, ruff/ty config | ✓ VERIFIED | `apollo = "apollo_cli.cli:main"`; `extend-select = ["I", "ANN"]`; `[tool.ty.environment]` present |
| `cli/apollo_cli/config.py` | repo-root discovery, `.env.instantdb` loading | ✓ VERIFIED | `find_repo_root`, `InstantConfig`, `load_instant_config` present; doctor works cwd-independently (confirmed via script) |
| `cli/apollo_cli/cli.py` | click group + `doctor` | ✓ VERIFIED | `apollo --help` lists `doctor`; `apollo doctor` exits 0, never prints full secret values |
| `biome.json` | repo-root formatter/linter covering `shared/**/*.ts` | ✓ VERIFIED | Confirmed content includes `shared/**/*.ts`, `web/src/**/*.ts`, `web/src/**/*.svelte`, `web/vite.config.ts`; `vcs.useIgnoreFile: true` |
| `verify-phase-01.sh` | one-command SETUP-01..08 gate | ✓ VERIFIED | Executable, ran live to completion, exit 0 |
| `README.md` | repo layout + gate commands | ✓ VERIFIED | Contains all six gate commands and `instant:push`; no credential values present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `web/src/lib/db.ts` | `shared/instant.schema.ts` | relative import | ✓ WIRED | Import present, `svelte-check`/`bun run build` succeed, proving resolution |
| `web/src/App.svelte` | `web/src/lib/db.ts` | import + `db.useAuth()` render | ✓ WIRED | `App.svelte` imports `db`, renders auth state conditionally (not a stub) |
| `web/vite.config.ts` | `.env.instantdb` | `dotenv.parse` of resolved path | ✓ WIRED | Build succeeds, app id lands in bundle, token does not |
| `web/package.json instant:push` | `shared/instant.schema.ts`/`instant.perms.ts` | env path overrides | ✓ WIRED | Live push/pull round-trip via `verify-phase-01.sh` succeeded |
| `cli/apollo_cli/cli.py` | `cli/apollo_cli/config.py` | `load_instant_config` import | ✓ WIRED | `doctor` command functions correctly, reading real `.env.instantdb` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| SETUP-01 | 01-01, 01-03 | Monorepo layout exists | ✓ SATISFIED | Layout present; `.env.instantdb` gitignored & untracked; no tracked file contains admin token (re-verified live) |
| SETUP-02 | 01-02 | `cli/` uv-managed Python 3.12 package with `apollo` entrypoint | ✓ SATISFIED | `uv sync`, `apollo --help/--version/doctor` all re-run and pass |
| SETUP-03 | 01-01 | `web/` bun-managed pure Svelte 5 + Vite SPA | ✓ SATISFIED | Builds clean, no SvelteKit, no `src/routes/` |
| SETUP-04 | 01-02 | ruff + ty clean on `cli/` | ✓ SATISFIED | Both gates re-run, zero findings, no suppressions found in source |
| SETUP-05 | 01-03 | formatter/linter clean on `web/` | ✓ SATISFIED | Biome + svelte-check re-run, zero findings |
| SETUP-06 | 01-01 | Authenticate to InstantDB via app id only, no admin token required | ✓ SATISFIED | `apollo doctor` and built `dist/` gate re-run; token never printed/bundled |
| SETUP-07 | 01-01 | `shared/instant.schema.ts` (9 entities) pushed live | ✓ SATISFIED | Live pull re-confirms all 9 entities on server |
| SETUP-08 | 01-01 | `shared/instant.perms.ts` (donoId rules) pushed live | ✓ SATISFIED | Live pull confirms rule strings; live guest-write re-run rejected with `Permission denied: not perms-pass?` |

No orphaned requirements — all 8 REQUIREMENTS.md SETUP IDs are claimed by exactly one plan each (01-01: SETUP-01/03/06/07/08; 01-02: SETUP-01/02/04; 01-03: SETUP-01/05), and every one was independently re-verified above.

### Anti-Patterns Found

None. Searched `shared/`, `web/src/`, `web/vite.config.ts`, `cli/apollo_cli/`, `biome.json`, `README.md` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented" — zero matches. No `# noqa`, `# type: ignore`, `biome-ignore`, or `per-file-ignores` found in either package.

### Data-Flow / Behavioral Verification

This is an infrastructure/scaffold phase (no dynamic UI data yet), so Level 4 data-flow trace is not applicable in the usual sense. Instead, the phase's core "truth" is a live external system state (InstantDB), which was independently re-verified by actually executing the push/pull/query round-trip against the real InstantDB app in this session (not by reading SUMMARY.md's claimed output). The guest-write rejection (`RESULT=EXPECTED_REJECTION`, `Permission denied: not perms-pass?`) is a genuine server-side response, not a mocked or hardcoded local script result — confirmed by re-running it live and observing the same server round-trip behavior described in the SUMMARY.

### Human Verification Required

None. Every truth in this phase resolves to a command-line-checkable fact (build exit codes, grep matches on schema/perms files, and a live server round-trip), all of which were independently re-run in this verification session.

### Gaps Summary

No gaps found. All 8 SETUP requirements, all must-have truths from the three plans, and all ROADMAP Phase 1 success criteria were independently re-verified by re-executing the actual commands (not trusting SUMMARY.md text), including a live InstantDB push/pull round-trip and a live write-based guest-permission-denial probe. The code review (01-REVIEW.md) is also clean with no critical/warning findings, corroborating the codebase-level evidence gathered here.

---

_Verified: 2026-08-09_
_Verifier: Claude (gsd-verifier)_
