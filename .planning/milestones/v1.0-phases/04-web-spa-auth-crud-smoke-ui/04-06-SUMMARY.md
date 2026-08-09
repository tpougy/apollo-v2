---
phase: 04-web-spa-auth-crud-smoke-ui
plan: 06
subsystem: verification
tags: [instantdb, svelte5, playwright, bun-test, coverage-gate, verify-script]

# Dependency graph
requires:
  - phase: 04-web-spa-auth-crud-smoke-ui
    provides: "04-01..04-05: EntityConfig contract, registry.ts auto-discovery, EntityScreen.svelte generic engine, all 9 defs/*.ts screens, all 5 authed e2e specs, the persisted storageState"
provides:
  - "web/src/lib/entities/registry.test.ts: schema-driven coverage + capability-invariant gate under bun test"
  - ".planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh: one-command re-proof of WEB-01..WEB-10 + C-08 + T-04-02/T-04-03"
  - "web/README.md: operator documentation for the SPA"
affects: [phase-5-job, phase-6-verify]

tech-stack:
  added: []
  patterns:
    - "bun:test cannot execute Vite's import.meta.glob(...) macro (it is a build-time transform, undefined at bun runtime) -- registry.test.ts re-implements the same eager-glob discovery by hand (readdirSync + dynamic import() over the same real defs/*.ts source files) rather than importing registry.ts directly"
    - "verify-phase-04.sh's cleanliness gate scopes `git status --porcelain` to web/, shared/, and this phase's own directory -- not the whole repo -- so unrelated pre-existing untracked repo state never produces a false FAIL"

key-files:
  created:
    - web/src/lib/entities/registry.test.ts
    - .planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh
    - web/README.md
  modified:
    - web/package.json

key-decisions:
  - "registry.test.ts does not import web/src/lib/entities/registry.ts. registry.ts's import.meta.glob call throws a TypeError under bun test (the macro is Vite-only and does not exist at bun runtime, confirmed by direct reproduction). The test instead reimplements the identical eager-glob contract (readdirSync('./defs') + dynamic import() per file + the same isEntityConfig validation + the same sort-by-ordem) directly against the SAME real defs/*.ts source files, so a missing or malformed defs file fails this test exactly as it would fail the real running app."
  - "Fixed web/package.json's `test` script from `bun test` to `bun test src` (Rule 1 bug, pre-existing since 04-01): bun's default test-file discovery also picks up web/e2e/*.spec.ts (Playwright specs), which throw at import time under bun's test runner (`test.beforeAll() ... did not expect to be called here`). This was already broken before this plan touched anything; scoping to `src/` fixes `bun test`/`bun run test` for good without touching any e2e file."
  - "verify-phase-04.sh's cleanliness gate scopes git status --porcelain to `web shared .planning/phases/04-web-spa-auth-crud-smoke-ui` rather than the whole repository, because unrelated pre-existing untracked paths outside Phase 4's scope (`.gsd/`, `.planning/STATE-ARCHIVE.md`) are not this plan's concern and would otherwise make the gate permanently and incorrectly fail."

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, WEB-08, WEB-09, WEB-10]

duration: ~50min
completed: 2026-08-09
---

# Phase 04 Plan 06: Schema-Driven Coverage Gate + verify-phase-04.sh + web/README.md Summary

**Closed Phase 4 with a schema-driven `bun test` coverage gate proving every entity in `shared/instant.schema.ts` has a correctly-capabilitied screen, a single `verify-phase-04.sh` that re-proves WEB-01..WEB-10 plus every C-08/T-04-02/T-04-03 gate end-to-end (twice in a row, from any cwd, `PHASE 04 VERIFIED`), and `web/README.md` documenting the SPA for the next operator (human or Claude).**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-09
- **Tasks:** 2/2 completed
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `registry.test.ts`: parses `shared/instant.schema.ts` with the same formatting-locked regex the CLI's `test_cli_surface.py` uses (`>= 9` self-check), asserts every extracted entity name has a `defs/*.ts` screen via a locally re-implemented eager-glob loader, pins `instanciasRotina`'s `create:false/delete:false/updatableFields:["status"]` and `logInferenciaClaude`'s all-false capabilities, asserts the other 7 entities are full-CRUD, and structurally validates `listColumns`/link targets/`ordem` uniqueness/no `"dono"`-named field. 36 tests, all passing.
- Fixed a pre-existing bug (present since 04-01, invisible until this plan actually ran `bun test` end to end): the bare `bun test` script also globbed `web/e2e/*.spec.ts`, which are Playwright specs that throw at import under `bun:test`'s runner. Scoped `package.json`'s `test` script to `bun test src`.
- `verify-phase-04.sh`: one command, `set -euo pipefail`, `BASH_SOURCE`-resolved repo root (cwd-independent), runs C-08 (`check`/`lint`/`format:check`/`build`/`test`), the suppression gate (biome-ignore/`@ts-expect-error`/`@ts-ignore`/eslint-disable, self-match-safe), T-04-02 (admin-token confinement in tracked files + `web/dist`, `@instantdb/admin` absence from `web/src`), T-04-03 (`donoId` confined to `EntityScreen.svelte`), the full `authed` + `anon` Playwright projects (magic-code send opt-in via `--with-magic-code`/`VERIFY_MAGIC_CODE=1`), asserts all four entity spec files actually ran, and asserts a clean tree + zero `phase04-e2e-` records live. Prints `PHASE 04 VERIFIED` only on full success.
- `web/README.md`: dev server, the login flow as a user experiences it, the `defs/*.ts` + `import.meta.glob` registry pattern ("add a file, never edit the registry"), the full `EntityConfig` contract, the capability-restriction table with C-06/CLI-10 rationale, the `donoId` injection rule, the three-project e2e suite, and the verify-script invocation (including `--with-magic-code`).

## Task Commits

1. **Task 1: Schema-driven screen-coverage gate** - `37d401a` (test) — includes the `bun test` script fix in the same commit (a blocking prerequisite discovered while making Task 1's own acceptance criterion, `cd web && bun test` exits 0, actually pass).
2. **Task 2: verify-phase-04.sh and operator documentation** - `db4a7e9` (docs)

_No separate plan-metadata commit was made per this plan's execution instructions (STATE.md/ROADMAP.md untouched by this executor run)._

## Files Created/Modified

- `web/src/lib/entities/registry.test.ts` - Schema-driven coverage + capability-invariant gate, 36 tests, runs under `bun run test`.
- `.planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh` - One-command, idempotent, cwd-independent re-proof of WEB-01..WEB-10 + C-08 + T-04-02/T-04-03.
- `web/README.md` - Operator documentation for the SPA.
- `web/package.json` - `test` script scoped to `bun test src` (Rule 1 fix).

## Fail-Loud Demonstrations (verbatim)

### registry.test.ts demonstration 1: renamed `defs/etapas.ts`

```
$ mv src/lib/entities/defs/etapas.ts src/lib/entities/defs/etapas.ts.bak
$ bun test src
...
error: etapas: no config found
Received: undefined
      at <anonymous> (.../registry.test.ts:144:56)
(fail) registry coverage: capability invariants per entity > etapas: capabilities match {create:true, update:true, delete:true}
...
TypeError: undefined is not an object (evaluating 'config.capabilities')
(fail) registry coverage: capability invariants per entity > the other seven entities have all three capabilities true

 75 pass
 3 fail
```

Restored `etapas.ts` → `bun test src`: `78 pass, 0 fail`.

### registry.test.ts demonstration 2: `instanciasRotina.capabilities.create` flipped to `true`

```
$ # (temporarily edited defs/instanciasRotina.ts: create: false -> create: true)
$ bun test src
...
error: instanciasRotina: capabilities.create expected false
Expected: false
Received: true
(fail) registry coverage: capability invariants per entity > instanciasRotina: capabilities match {create:false, update:true, delete:false}
...
error: instanciasRotina.capabilities.create must be false
(fail) registry coverage: capability invariants per entity > instanciasRotina: create and delete are both false (C-06 invariant)

 76 pass
 2 fail
```

Restored `create: false` → `bun test src`: `78 pass, 0 fail`. `git diff --stat` confirmed clean before restoring (the demo edits were reverted in-place, never committed).

Entity-list-origin check: `grep -cE '"fundos"|"projetos"|"tarefas"' web/src/lib/entities/registry.test.ts` → 0 (the `EXPECTED_CAPABILITIES` map uses bare/unquoted object keys — `fundos: {...}`, not `"fundos": {...}` — and demonstration 1 above proves the entity list itself is schema-derived, not hand-maintained).

### verify-phase-04.sh demonstration 1: `// biome-ignore lint: demo` added to `registry.ts`

```
$ bash .planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh > /tmp/vp04-demo1.log 2>&1
$ echo "RC=$?"
RC=1
$ grep -c "PHASE 04 VERIFIED" /tmp/vp04-demo1.log
0
$ tail -2 /tmp/vp04-demo1.log
-- Suppression gate: zero lint/type suppressions in web/src, web/e2e
FAIL: suppression gate: lint/type suppression markers found: web/src/lib/entities/registry.ts:1:// biome-ignore lint: demo
```

Removed the comment; re-ran → `RC=0`, `PHASE 04 VERIFIED` present.

### verify-phase-04.sh demonstration 2: `web/e2e/.auth/user.json` moved aside

```
$ mv web/e2e/.auth/user.json /tmp/user.json.bak
$ bash .planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh > /tmp/vp04-demo2.log 2>&1
$ echo "RC=$?"
RC=1
$ tail -3 /tmp/vp04-demo2.log
-- WEB-01 / WEB-10: magic-code auth substrate
FAIL: WEB-01: web/e2e/.auth/user.json is missing -- run 'bun run test:e2e:auth' (the setup
  project) first to perform a real magic-code login and persist the session.
```

Restored `user.json`; re-ran → `RC=0`, `PHASE 04 VERIFIED` present, `git status --porcelain -- web shared .planning/phases/04-web-spa-auth-crud-smoke-ui` empty.

## The Exact One-Command Invocation an Operator Runs

```bash
bash .planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh
```

Run from the repo root, or from any other cwd — it resolves its own location via `BASH_SOURCE[0]` and `cd`s to the repo root first (confirmed by running it from `/tmp` below). To also re-prove the real magic-code send (WEB-01's live email round trip), add `--with-magic-code` or set `VERIFY_MAGIC_CODE=1`.

## WEB-01..WEB-10 Mapped to verify-phase-04.sh Sections

| Requirement | verify-phase-04.sh section |
|---|---|
| WEB-01 | "WEB-01 / WEB-10: magic-code auth substrate" — asserts `web/e2e/.auth/user.json` exists and the `authed` project passes with it; `--with-magic-code`/`VERIFY_MAGIC_CODE=1` additionally re-runs the real `setup` project (live email round trip) |
| WEB-02 | "WEB-02..WEB-09: all entity spec files executed" — asserts `entities-fundos.spec.ts` appears in the `authed` run output (fundos CRUD) |
| WEB-03, WEB-04, WEB-05 | same section — asserts `entities-projeto-etapa-tarefa.spec.ts` appears (projetos/etapas/tarefas CRUD + T-04-04 dangling-link guard) |
| WEB-06, WEB-07, WEB-09 | same section — asserts `entities-rotina-log.spec.ts` appears (templatesRotina CRUD, instanciasRotina status-only, logInferenciaClaude read-only) |
| WEB-08 | same section — asserts `entities-ticket-subtarefa.spec.ts` appears (tickets CRUD, subtarefas XOR-link invariant) |
| WEB-10 | "WEB-01 / WEB-10: magic-code auth substrate" section's `anon`-project run (`no-leakage.spec.ts`: unauthenticated load shows zero entity data) |

## Confirmation: Zero `phase04-e2e-` Records After the Run

The verify script's own "Cleanliness" section lists all nine live entities (`fundo`, `projeto`, `etapa`, `tarefa`, `ticket`, `subtarefa`, `rotina template`, `rotina instancia`, `log-inferencia`) via the CLI, greps the concatenated JSON for the literal `phase04-e2e-` substring, and asserts the count is exactly `0`. The final clean run (below) printed `Cleanliness: PASS` immediately before `PHASE 04 VERIFIED`, confirming the live InstantDB app holds zero `phase04-e2e-` records at the end of this plan's execution.

## Verification Evidence (final clean run, twice in a row + from /tmp)

```
$ bash .planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh   # run 1, from repo root
...
Cleanliness: PASS
PHASE 04 VERIFIED
RC=0

$ bash .planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh   # run 2, from repo root
...
Cleanliness: PASS
PHASE 04 VERIFIED
RC=0

$ cd /tmp && bash /home/thomaz/pessoal/apollo-v2/.planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh   # run 3, from /tmp
...
Cleanliness: PASS
PHASE 04 VERIFIED
RC=0
```

All three runs (twice in a row from the repo root, once from an unrelated cwd) exited 0, printed `PHASE 04 VERIFIED`, and left `git status --porcelain -- web shared .planning/phases/04-web-spa-auth-crud-smoke-ui` empty.

## Decisions Made

- **`registry.test.ts` cannot import `registry.ts`.** `registry.ts` uses Vite's `import.meta.glob(...)` macro for eager auto-discovery — a build-time transform that Vite rewrites into real `import()` calls at bundle time. Under `bun test`, no such transform runs, so `import.meta.glob` is `undefined` at runtime and throws a `TypeError` the instant `registry.ts` is imported, before any assertion executes (reproduced directly: `TypeError: import.meta.glob is not a function`). Rather than weakening the coverage test's guarantees, `registry.test.ts` re-implements the identical "eager glob" contract by hand — `readdirSync` the same `defs/` directory, dynamically `import()` each real module, and apply the same `isEntityConfig` validation and `ordem` sort registry.ts itself uses — so the test still validates the exact same source files and the exact same runtime shape, just without routing through a Vite-only macro that cannot execute in this test runner.
- **Fixed `web/package.json`'s `test` script (Rule 1, pre-existing bug).** `bun test` (no path argument) discovers files matching both `*.test.*` and `*.spec.*` by default, which meant it was already scanning `web/e2e/*.spec.ts` (Playwright specs) before this plan started — and those specs throw immediately under `bun:test`'s loader (`Playwright Test did not expect test.beforeAll() to be called here`). This was invisible in 04-01 through 04-05 because none of those plans' acceptance criteria required running the bare `bun test`/`bun run test` script end-to-end; Task 1's own acceptance criterion here (`cd web && bun test` exits 0) does, so the pre-existing break surfaced immediately. Fixed by scoping the script to `bun test src` — confirmed via `git stash` (the failure is 100% reproducible on `main` prior to this plan's own untracked new file, so this is not a regression this plan introduced).
- **Cleanliness gate scoped to Phase 4's own paths, not the whole repo.** A first full run of `verify-phase-04.sh` failed the cleanliness check purely because of two untracked paths unrelated to Phase 4 (`.gsd/`, `.planning/STATE-ARCHIVE.md`) that pre-date this plan and are out of its scope (Rule/SCOPE BOUNDARY: only auto-fix issues directly caused by this plan's own changes). Rather than touching those files (out of scope) or leaving a permanently-failing gate, `git status --porcelain` was scoped to `web shared .planning/phases/04-web-spa-auth-crud-smoke-ui` — the exact surface this plan and Phase 4 as a whole own — so the gate still catches any dirt a verify run itself produces without being poisoned by unrelated pre-existing repo state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `bun test`/`bun run test` was already broken (pre-existing since 04-01) due to Playwright specs being swept into bun's default test discovery**
- **Found during:** Task 1, first attempt at `cd web && bun test` (the plan's own acceptance criterion)
- **Issue:** `web/e2e/*.spec.ts` files (Playwright specs, created starting in 04-01) match bun's default `*.spec.*` test-file glob and throw a fatal `TypeError`/Playwright-internal error the instant `bun test` tries to load them, aborting the whole run with only `78 pass / 6 fail / 6 errors` from unrelated e2e files, never reaching a clean summary.
- **Fix:** Changed `package.json`'s `test` script from `bun test` to `bun test src`, scoping discovery to `web/src/**` (where `bizdays.test.ts` and the new `registry.test.ts` both live) and leaving `web/e2e/**` exclusively to Playwright's own runner (`bunx playwright test`), which is the only runner that ever executed those files correctly.
- **Files modified:** `web/package.json`
- **Verification:** `bun run test` now exits 0 with `78 pass, 0 fail`; `bunx playwright test` (Playwright's own runner) still executes all e2e specs unaffected.
- **Committed in:** `37d401a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a pre-existing bug in `bun test`'s scope, not introduced by this plan, but blocking this plan's own acceptance criterion). No scope creep: `EntityScreen.svelte`, `registry.ts`, `Shell.svelte`, `types.ts`, and every `defs/*.ts` file are unchanged from 04-05's state.

## Issues Encountered

None beyond the pre-existing `bun test` scope bug documented above, which was fully resolved with a one-line `package.json` change and does not affect Playwright's own test execution in any way.

## Known Stubs

None — `registry.test.ts` exercises the real `defs/*.ts` source files via dynamic `import()`; `verify-phase-04.sh` exercises the real live InstantDB app, the real CLI, and the real Playwright browser suite; `web/README.md` describes only shipped, proven behavior.

## Threat Flags

None — this plan adds a test file, a shell script, and a markdown doc; it introduces no new network endpoint, auth path, or schema/permission change. Both T-04-02 and T-04-03 (already declared in this plan's own threat model) are the exact mitigations `verify-phase-04.sh` implements, not new surface.

## User Setup Required

None - no external service configuration required. The real magic-code login (via 04-01's persisted `storageState`) and the live InstantDB app were both already available from prior phases.

## Next Phase Readiness

- `registry.test.ts` now runs on every `bun run test` and every `verify-phase-04.sh` invocation — Phase 5 cannot silently loosen `instanciasRotina`'s `create:false`/`delete:false`/`updatableFields:["status"]` invariant without this test failing loudly.
- `verify-phase-04.sh` is the Phase 5/Phase 6 regression backstop this phase exists to produce; Phase 6's VERIFY-01/VERIFY-03 can invoke it directly rather than re-deriving any of these gates.
- `web/README.md` is the reference for any future plan (human or Claude) adding a tenth entity screen: add a `defs/*.ts` file, never touch `registry.ts`.
- No blockers.

---
*Phase: 04-web-spa-auth-crud-smoke-ui*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: web/src/lib/entities/registry.test.ts
- FOUND: .planning/phases/04-web-spa-auth-crud-smoke-ui/verify-phase-04.sh
- FOUND: web/README.md
- FOUND commit: 37d401a (test: schema-driven registry coverage gate)
- FOUND commit: db4a7e9 (docs: verify-phase-04.sh + web/README.md)
