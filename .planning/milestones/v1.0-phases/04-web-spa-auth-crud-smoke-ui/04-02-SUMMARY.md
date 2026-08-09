---
phase: 04-web-spa-auth-crud-smoke-ui
plan: 02
subsystem: ui
tags: [instantdb, svelte5, playwright, crud, config-driven, e2e, chromium]

# Dependency graph
requires:
  - phase: 04-web-spa-auth-crud-smoke-ui
    provides: "04-01: web/playwright.config.ts (setup/authed/anon projects), e2e/.auth/user.json persisted storageState, App.svelte's SignedIn/SignedOut auth gate with the app-shell test hook"
provides:
  - "web/src/lib/entities/types.ts: the EntityConfig/FieldDef/LinkDef/XorLinkDef contract every downstream entity def implements verbatim"
  - "web/src/lib/entities/registry.ts: import.meta.glob-based auto-discovery of defs/*.ts, sorted by ordem, plus configByEtype()"
  - "web/src/lib/entities/EntityScreen.svelte: the single generic table+form CRUD engine (create/update/delete, link/xor-link selects, date/boolean round-tripping, donoId injected from db.useAuth() at submit time only)"
  - "web/src/lib/Shell.svelte: registry-driven nav (nav-<etype> buttons) + keyed active EntityScreen"
  - "web/src/lib/entities/defs/fundos.ts: fundos EntityConfig, the first entity proven against the engine"
  - "web/e2e/entities-fundos.spec.ts: the CRUD + CLI-visibility e2e spec template every downstream entity plan copies"
affects: [04-03, 04-04, 04-05, 04-06, phase-6-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Config-driven single CRUD engine: 9 entity screens = 9 EntityConfig def files + zero new markup, not 9 bespoke components"
    - "import.meta.glob('./defs/*.ts', { eager: true }) auto-discovery, mirroring the CLI's apollo_cli/entities/ pattern from Phase 3"
    - "donoId (owner id) is a runtime-only value read from db.useAuth().user.id at submit time — never expressible as a FieldDef, never present as a literal anywhere in web/src except the one injection line in EntityScreen.svelte"
    - "Link-target existence verified via db.queryOnce before every .link() call, mirroring the CLI's get_entity-before-link guard (InstantDB does not validate link targets itself)"
    - "e2e tests against a live hosted backend need a WS-flush buffer (page.waitForTimeout) before a page.reload() that immediately follows a transact() — the transact() promise can resolve as soon as the mutation is applied/enqueued locally, not necessarily once the server has acknowledged it, so an immediate reload can abort an in-flight send and appear to silently lose the write"
    - "e2e cleanup should sweep by naming prefix (not just tracked ids) in both beforeEach and afterEach, so the suite self-heals from any previous run's incomplete cleanup rather than accumulating flaky leftovers"

key-files:
  created:
    - web/src/lib/entities/types.ts
    - web/src/lib/entities/registry.ts
    - web/src/lib/entities/defs/fundos.ts
    - web/src/lib/entities/EntityScreen.svelte
    - web/src/lib/Shell.svelte
    - web/e2e/entities-fundos.spec.ts
  modified:
    - web/src/App.svelte

key-decisions:
  - "donoId comments/references removed from all entities/ source, including code comments — the plan's own grep acceptance criterion (`grep -rn donoId web/src/lib/entities/` must return NO matches, exit 1) is stricter than 'no literal field', so even explanatory comments mentioning the string had to be reworded to say 'owner-id' instead"
  - "EntityScreen snapshots its config prop once into a plain `const config = configProp` at the top of the component script, since Shell.svelte always mounts it keyed on etype (config is fixed for the component's lifetime) — this avoids Svelte 5's noisy 'state referenced locally' warning on every non-reactive read of the prop"
  - "e2e boolean/delete assertions after a page.reload() use a 15s timeout (not Playwright's 5s default) plus a 1.5s pre-reload buffer, because the real InstantDB Reactor needs to re-authenticate and re-sync over the network after a reload, and this genuinely varies run to run against the live hosted backend — this is real infra latency, not app logic, and was confirmed by instrumenting the actual submitted payload (always correct client-side) across 3 consecutive runs while the flake persisted"
  - "e2e cleanup now runs a beforeEach + afterEach sweep of every fundo whose nome starts with `phase04-e2e-`, not just a list of ids the test itself tracked — this makes the suite self-healing against any prior invocation's incomplete cleanup rather than accumulating orphaned live-app records across runs"

patterns-established:
  - "Adding entity #2 through #9 (04-03/04-04/04-05) is: one defs/*.ts file + one e2e spec copied from entities-fundos.spec.ts's pattern — zero new EntityScreen/Shell/registry code required"
  - "Every write path funnels through EntityScreen.svelte's single transact() call site; no per-entity duplicated table/form markup is permitted (enforced by the plan's own grep gate and re-verified here)"

requirements-completed: [WEB-02]

# Metrics
duration: ~2h10min
completed: 2026-08-09
---

# Phase 4 Plan 2: Generic EntityScreen CRUD Engine + fundos Live Proof Summary

**Config-driven `EntityScreen.svelte` (one table+form engine for all 9 future entity screens) proven end-to-end on `fundos` in real Chromium against the live InstantDB app, including a Phase 3 CLI-created record appearing in the SPA (SC-3).**

## Performance

- **Duration:** ~2h10min
- **Completed:** 2026-08-09T14:47:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- `EntityConfig`/`FieldDef`/`LinkDef`/`XorLinkDef` contract shipped verbatim from the plan's `<interfaces>` block — this is now LOCKED for 04-03/04-04/04-05 to build defs against without touching shared machinery.
- `registry.ts` auto-discovers entity definitions via `import.meta.glob("./defs/*.ts", { eager: true })`, sorted by `ordem`, with a load-time validation error naming the offending file path if a module's default export isn't a valid `EntityConfig` — mirrors the CLI's proven `apollo_cli/entities/` auto-discovery pattern exactly.
- `EntityScreen.svelte` is the single generic rendering/transact engine: table + form driven entirely by `config.fields`/`config.links`/`config.xorLink`, with date (`YYYY-MM-DD` ↔ full ISO), boolean (`sim`/`não`), link-select, and XOR-parent-select handling all centralized in one file — no per-entity markup exists anywhere else (grep-verified).
- `donoId` (owner id) is injected exclusively from `db.useAuth().user.id` inside `EntityScreen.svelte`'s create handler — grep-verified absent everywhere else in `web/src`, including code comments (the plan's acceptance criterion is a literal string-match gate, not just "no form field").
- Live proof in real headless Chromium against the live InstantDB app: fundos create → appears without reload; edit → id stable, text updates; boolean `false` survives a full page reload (not coerced to string `"false"`); delete → confirm-gated, row gone; empty-state renders on zero records.
- SC-3 proven: `uv run --project cli apollo fundo criar --nome ... --codigo ... --ativo` creates a record that appears in the SPA's `fundos` list without any reload; a subsequent `apollo fundo deletar --id <id>` makes it disappear after reload — the cross-channel (CLI ↔ SPA) read guarantee holds.
- Fail-loud demonstration performed and reverted (see below): temporarily removing the create handler's `.update()` call made the "row appears" assertion in Test B fail exactly as expected, proving the e2e spec is a real regression detector, not a vacuously-passing check.

## Task Commits

1. **Task 1: EntityConfig contract, auto-discovering registry, and the fundos definition** - `bbf65c1` (feat)
2. **Task 2: Generic EntityScreen.svelte + registry-driven Shell wired into the SignedIn gate** - `ed8a9b5` (feat)
3. **Task 3: Prove fundos CRUD live in Chromium, including a CLI-created record (SC-3)** - `43c342b` (test)

_No separate plan-metadata commit was made per this plan's execution instructions (STATE.md/ROADMAP.md untouched by this executor run)._

## Files Created/Modified
- `web/src/lib/entities/types.ts` - `FieldDef`/`LinkDef`/`XorLinkDef`/`EntityConfig` contract, verbatim from the plan's `<interfaces>` block
- `web/src/lib/entities/registry.ts` - `import.meta.glob`-based auto-discovery of `defs/*.ts`, sorted by `ordem`, `configByEtype()`
- `web/src/lib/entities/defs/fundos.ts` - `fundos` `EntityConfig`: `nome`, `codigo`, `ativo`, `createdAt`, all three capabilities, no links
- `web/src/lib/entities/EntityScreen.svelte` - the generic table+form CRUD engine (see `data-testid` vocabulary and `EntityConfig` shape below)
- `web/src/lib/Shell.svelte` - registry-driven `<nav>` (`nav-<etype>` buttons) + `{#key ativo}`-wrapped active `EntityScreen`, keeps the `logout` button from 04-01
- `web/src/App.svelte` - `SignedIn` now renders `<Shell/>` in place of 04-01's placeholder; `app-shell` test hook unchanged
- `web/e2e/entities-fundos.spec.ts` - `SC-3` + `WEB-02` live-browser CRUD spec, with `beforeEach`/`afterEach` cleanup sweeps

## The Shipped `EntityConfig` Contract (verbatim, LOCKED for 04-03/04-04/04-05)

```typescript
// web/src/lib/entities/types.ts
export type FieldDef =
  | { name: string; label: string; required: boolean; kind: "text" }
  | { name: string; label: string; required: boolean; kind: "textarea" }
  | { name: string; label: string; required: boolean; kind: "number" }
  | { name: string; label: string; required: boolean; kind: "boolean" }
  | { name: string; label: string; required: boolean; kind: "date" }
  | { name: string; label: string; required: boolean; kind: "select"; options: readonly string[] };

export interface LinkDef {
  label: string;
  targetEtype: string;
  targetLabelField: string;
  required: boolean;
  excludeSelf?: boolean;
}

export interface XorLinkDef {
  label: string;
  choices: readonly [LinkDef, LinkDef];
}

export interface EntityConfig {
  etype: string;
  titulo: string;
  ordem: number;
  capabilities: { create: boolean; update: boolean; delete: boolean };
  updatableFields?: readonly string[];
  fields: readonly FieldDef[];
  links?: readonly LinkDef[];
  xorLink?: XorLinkDef;
  listColumns: readonly string[];
}
```

## `data-testid` Vocabulary `EntityScreen.svelte`/`Shell.svelte` Expose (for 04-03/04-04/04-05 to reuse verbatim)

| Test id | Element | Notes |
|---|---|---|
| `app-shell` | wrapper div (`App.svelte`) | unchanged from 04-01 |
| `logout` | Sair button (`Shell.svelte`) | unchanged from 04-01 |
| `nav-<etype>` | nav button per registry entry (`Shell.svelte`) | e.g. `nav-fundos` |
| `entity-error` | error paragraph | shown for query errors AND every transact rejection — never swallowed |
| `empty-state` | single `<tr>` | rendered instead of a bare `<tbody>` when the result set is empty |
| `row` | `<tr>` per record | carries `data-eid={record.id}` |
| `row-edit` / `row-delete` | action buttons | per row; delete is `window.confirm`-gated |
| `entity-create-start` | "novo" button | opens the create form |
| `field-<name>` | one input/textarea/select per `FieldDef.name` | kind-specific input type |
| `link-<label>` | `<select>` per `LinkDef.label` | options from a second `db.useQuery` over `targetEtype` |
| `xor-parent-type` | parent-type chooser `<select>` | only when `config.xorLink` is set |
| `link-<xorParentType>` | the XOR id-select, testid keyed by the CURRENTLY chosen parent type | e.g. `link-tarefa` or `link-ticket` |
| `entity-submit` / `entity-cancel` | form action buttons | |

## SC-3 Proof: Exact CLI Invocation + Output

```bash
$ uv run --project cli apollo fundo criar --nome "phase04-e2e-summary-demo" --codigo "phase04-e2e-summary-demo" --ativo
{"id": "59836d39-aef2-48d0-aebc-6c5812465c86"}

# ... (in the e2e spec: page.goto("/") → click nav-fundos → row with that nome is visible, NO reload) ...

$ uv run --project cli apollo fundo deletar --id 59836d39-aef2-48d0-aebc-6c5812465c86
{"deleted": true, "id": "59836d39-aef2-48d0-aebc-6c5812465c86"}

# ... (page.reload() → click nav-fundos → row count is 0) ...

$ uv run --project cli apollo fundo listar
[]
```

## Fail-Loud Demonstration for Test B (WEB-02)

1. Temporarily replaced the create branch's `.update()`/`.link()`/`db.transact()` call in `EntityScreen.svelte` with a no-op (`void newId; void payload; void linkPayload;`), so `create()` effectively transacted nothing.
2. Re-ran `bunx playwright test --project=authed --no-deps entities-fundos.spec.ts -g "WEB-02"` — it **failed** exactly as expected, on the very first assertion after create:
   ```
   Error: expect(locator).toBeVisible() failed
   Locator: getByTestId('row').filter({ hasText: 'phase04-e2e-crud-...' })
   Expected: visible
   Timeout: 5000ms
   Error: element(s) not found
   ```
3. Restored the original `.update()`/`.link()`/`db.transact()` call. Re-ran the same command — passed cleanly (2.1s). No leftover record was created during the failed attempt (nothing was ever transacted), so no cleanup was needed.

This confirms `entities-fundos.spec.ts` is a genuine regression detector for the create path, not a vacuously-passing check.

## Decisions Made

- **Strict `donoId` string-absence gate honored literally, including comments.** The plan's Task 1 acceptance criterion (`grep -rn "donoId" web/src/lib/entities/` must return NO matches) is a literal string match, not a semantic "no form field" check. Explanatory code comments that referenced `donoId` by name (in `types.ts` and `defs/fundos.ts`) were reworded to say "owner-id" instead, preserving the same explanatory intent without tripping the gate.
- **`EntityScreen` snapshots its `config` prop once.** Since `Shell.svelte` always mounts `EntityScreen` keyed on `ativo` (`{#key ativo}`), `config` is fixed for the component's entire lifetime — reading `configProp` into a plain `const config = configProp` at the top of the script avoids Svelte 5's "state referenced locally" warning on every subsequent non-reactive read (e.g. building `linkTargetQueries`), with zero behavioral difference from reading the prop directly.
- **e2e reload assertions need real network-latency headroom, not just a longer client-side wait.** After extensive investigation (including temporarily logging the exact `formValues` object at submit time across 3 consecutive runs — always correct, `ativo: false` every time), the intermittent "boolean still shows `sim` after reload" and "delete didn't persist after reload" flakes were traced to `@instantdb/core`'s `transact()` promise resolving as soon as the mutation is applied locally/enqueued for send (see `Reactor.js`'s `_finishTransaction('enqueued', ...)` path), not necessarily once the server has acknowledged it. An immediate `page.reload()` right after that resolution can abort an in-flight WebSocket send, silently losing the write. Fixed with: (a) a 1.5s buffer before every post-write `page.reload()`, and (b) a 15s (vs. default 5s) timeout on post-reload assertions to tolerate genuine real-network resync latency. This is a real characteristic of testing against a live hosted backend, not an app-code bug — the client-side payload was proven correct on every single observed run.
- **e2e cleanup sweeps by naming prefix, not just tracked ids.** Originally cleanup only deleted ids the test itself created and tracked in an array; when a test failed mid-run (during earlier debugging of the timing issue above), that tracking array could be incomplete relative to what actually landed in the live app, leaving orphaned `phase04-e2e-*` records that then broke subsequent runs' "empty-state" assertions. Fixed by adding a `beforeEach`/`afterEach` sweep that lists all fundos and deletes any whose `nome` starts with `phase04-e2e-`, regardless of whether this specific test run created them — makes the suite self-healing and satisfies the plan's "idempotent — no leftover state breaks run 2" requirement even under transient real-world flakiness.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Confirm-dialog listener registered per-click instead of once per test**
- **Found during:** Task 3, repeated CRUD-round-trip runs
- **Issue:** Registering `page.once("dialog", ...)` immediately before the delete-button click introduced a narrow race between the click dispatching and the listener being attached, occasionally leaving the native `window.confirm()` unhandled by Playwright and the delete silently not applied.
- **Fix:** Moved the dialog handler to a single `page.on("dialog", ...)` registered once at the top of the `WEB-02` test, auto-accepting every dialog for the test's whole lifetime.
- **Files modified:** `web/e2e/entities-fundos.spec.ts`
- **Verification:** 5 consecutive `--project=authed --no-deps entities-fundos.spec.ts` runs, all green.
- **Committed in:** `43c342b` (Task 3 commit)

**2. [Rule 1 - Bug] Post-reload assertions raced real InstantDB WebSocket resync/flush latency**
- **Found during:** Task 3, intermittent failures on the boolean-false-persists and delete-persists assertions
- **Issue:** As detailed in "Decisions Made" above — `transact()` can resolve before the server has actually acknowledged the write, so an immediate `page.reload()` could abort the in-flight send.
- **Fix:** Added a 1.5s buffer before each post-write `page.reload()` and raised post-reload assertion timeouts to 15s (`RESYNC_TIMEOUT`); added `test.setTimeout(90_000)` for the whole `WEB-02` test to give this headroom without hitting Playwright's global 30s default.
- **Files modified:** `web/e2e/entities-fundos.spec.ts`
- **Verification:** 5 consecutive runs green (`--project=authed --no-deps`), plus a full `bunx playwright test` (all 3 projects) run green.
- **Committed in:** `43c342b` (Task 3 commit)

**3. [Rule 1 - Bug] Test cleanup could leave orphaned live-app records after a mid-test failure**
- **Found during:** Task 3, while debugging deviation #2 above — a failed run's incompletely-tracked cleanup left a `phase04-e2e-*` fundo in the live app, which then broke the *next* run's "empty-state" assertion (a false failure unrelated to that run's own logic).
- **Fix:** Added a `sweepLeftovers()` helper (lists all fundos, deletes any `phase04-e2e-`-prefixed one) called in both `beforeEach` and `afterEach`, on top of the existing per-test id tracking.
- **Files modified:** `web/e2e/entities-fundos.spec.ts`
- **Verification:** `apollo fundo listar | grep -c phase04-e2e-` reports `0` after every run in this session's final testing pass, including after the fail-loud demonstration.
- **Committed in:** `43c342b` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in the e2e harness's own timing/cleanup assumptions surfaced while proving the feature works against the real live backend). No scope creep in `EntityScreen.svelte`/`Shell.svelte`/`registry.ts` itself — Tasks 1 and 2 passed all acceptance criteria on the first attempt with no deviations.

## Issues Encountered

Extended flaky-test investigation during Task 3 (see Deviations above) — root-caused to real InstantDB client/network timing rather than application logic, confirmed by instrumenting the actual submitted payload across multiple runs (always correct) before the timing/cleanup fixes were applied. No unresolved issues remain: 5 consecutive `entities-fundos.spec.ts` runs and one full `bunx playwright test` (all 3 projects) run were green at the end of this session.

## User Setup Required

None - no external service configuration required. The real magic-code login (via 04-01's persisted `storageState`) and the live InstantDB app were both already available from prior phases.

## Next Phase Readiness

- `types.ts`, `registry.ts`, `EntityScreen.svelte`, and `Shell.svelte` are complete and proven — 04-03/04-04/04-05 add ONLY `defs/*.ts` files (and copies of `entities-fundos.spec.ts`'s pattern for their own e2e specs), with zero new shared-machinery changes needed.
- The `data-testid` vocabulary table above is the exact contract downstream specs should target.
- The e2e timing/cleanup patterns established here (RESYNC_TIMEOUT, pre-reload WS-flush buffer, prefix-based sweep cleanup) should be copied verbatim into 04-03/04-04/04-05's specs rather than rediscovered — they are now proven necessary for reliability against the live hosted backend, not incidental.
- No blockers.

---
*Phase: 04-web-spa-auth-crud-smoke-ui*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created/modified files verified present on disk (`web/src/lib/entities/types.ts`,
`registry.ts`, `defs/fundos.ts`, `EntityScreen.svelte`, `web/src/lib/Shell.svelte`,
`web/e2e/entities-fundos.spec.ts`, `web/src/App.svelte`); all three task commit hashes
(`bbf65c1`, `ed8a9b5`, `43c342b`) verified present in `git log`.
