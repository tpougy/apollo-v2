---
quick_id: 260922-vbt
phase: quick
plan: 260922-vbt
subsystem: database
tags: [instantdb, schema-migration, cli, svelte, playwright, rename]

requires: []
provides:
  - Generic `entidades` entity (free-text `tipoEntidade` discriminator) replacing the fixed `fundos` entity across schema, CLI, web, and e2e
  - Live production migration of all 58 pre-existing `fundos` rows into `entidades` (id-reused, `tipoEntidade: "Fundo"`, byte-identical fields)
  - `apollo entidade` CLI command group (`apollo fundo` fully retired)
  - `entidadeProjetos`/`entidadeTemplatesRotina`/`entidadeTickets` schema links (replacing `fundoProjetos`/`fundoTemplatesRotina`/`fundoTickets`, now removed)
affects: [any future milestone touching projetos/tickets/templatesRotina links, batch import, or the Dashboard entidade grouping]

actuals:
  tokens: 210000
  tasks: 4
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Additive-then-destructive schema migration (2-step instant-cli push): add new entity+links alongside the old ones, migrate data, verify live, only then remove the old entity+links in a second destructive push"
    - "Transitional schema-coverage-gate exception (_PENDING_SCHEMA_REMOVAL / PENDING_SCHEMA_REMOVAL) to bridge a schema-driven completeness test across an additive-then-destructive migration window, removed once the destructive push lands"

key-files:
  created:
    - cli/apollo_cli/entities/entidade.py
    - web/src/lib/entities/defs/entidades.ts
    - web/src/lib/dashboard/RoutinesByEntidade.svelte
    - web/src/lib/dashboard/dialogs/EntidadeDialog.svelte
    - web/e2e/entities-entidades.spec.ts
    - web/e2e/focus-dialog-entidade.spec.ts
  modified:
    - shared/instant.schema.ts
    - shared/instant.perms.ts
    - cli/apollo_cli/batch_import.py
    - cli/apollo_cli/entities/projeto.py
    - cli/apollo_cli/entities/ticket.py
    - cli/apollo_cli/entities/rotina.py
    - cli/apollo_cli/cli.py
    - web/src/lib/dashboard/Dashboard.svelte
    - web/src/lib/dashboard/derive.ts
    - web/src/lib/dashboard/dashboardQuery.ts
    - web/src/lib/sections/ProjetosSection.svelte
    - "~40 other CLI test / web test / e2e spec files (mechanical rename sweep)"

key-decisions:
  - "Followed CONTEXT.md D1-D7 verbatim: full clean rename (no back-compat alias), tipoEntidade as a free-text field with no separate types catalog, id-reuse migration mechanic, D6's tipoEntidade-optional-defaulting-to-Fundo exception for apollo import JSON files."
  - "web/src/lib/entities/registry.test.ts needed the identical transitional _PENDING_SCHEMA_REMOVAL exception cli/tests/test_cli_surface.py uses -- RESEARCH.md's file enumeration didn't flag this (it does the same schema-driven defs/*.ts coverage check the CLI test does), discovered and fixed during Task 3 execution."
  - "Fixed entities-entidades.spec.ts's WEB-02 empty-state assertion (Rule 1 bug) rather than leaving it broken: production entidades is never empty post-migration (58 real rows), so the assertion this test inherited from the old fundos spec no longer holds and was removed, not merely documented."
  - "Left 2 other assumes-near-empty-table pre-existing test-fragility failures undisturbed and documented (entities-header-states.spec.ts's ENTTBL-06, cross-phase-verification.spec.ts's VERIFY-05 keyboard-focus test) -- same root-cause class as STATE.md's already-tracked flaky items, out of this task's scope to fix."

patterns-established:
  - "Transitional schema-coverage-gate exception pattern, mirrored identically between cli/tests/test_cli_surface.py and web/src/lib/entities/registry.test.ts, for any future entity rename that needs an additive-then-destructive schema push."

requirements-completed: []

metrics:
  duration: ~3h
  completed: 2026-09-23

status: complete
---

# Quick Task 260922-vbt: Generalizar fundos para entidades com multiplos tipos Summary

**Replaced the fixed `fundos` InstantDB entity with a generic `entidades` entity (free-text `tipoEntidade` discriminator, e.g. "Fundo"/"Cliente"/"Area") across schema, CLI, web SPA, and e2e tests, migrating all 58 production rows live with byte-identical field verification, then destructively removing the old `fundos` entity/links/perms rule from production once every consumer had moved off it.**

## Performance

- **Duration:** ~3h
- **Started:** 2026-09-22 (research/context/plan already existed at session start)
- **Completed:** 2026-09-23T03:32:51Z
- **Tasks:** 4/4 completed
- **Files modified:** ~65 (schema/perms, CLI entities/tests, web dashboard/entities/sections, e2e specs)

## Accomplishments

- Added `entidades` entity (`tipoEntidade: i.string()` required field) + 3 new links (`entidadeProjetos`/`entidadeTemplatesRotina`/`entidadeTickets`) additively alongside the untouched `fundos` entity, then live-migrated all 58 `fundos` rows into `entidades` (same id reused, `tipoEntidade: "Fundo"`, every other field byte-identical, verified per-row not sampled) via a transient admin script, deleted after use.
- Renamed the entire CLI surface: `apollo fundo` → `apollo entidade` (`--tipo-entidade` required on `criar`, optional on `editar`), `--fundo-id` → `--entidade-id` on `projeto`/`ticket`/`rotina template`, `batch_import.py`'s `entidades`/`entidadeId` with `tipoEntidade` optional (defaults to `"Fundo"` per D6), full offline+live CLI test suite green.
- Renamed the entire web surface: `defs/fundos.ts` → `defs/entidades.ts` (new `tipoEntidade` field), `derive.ts`'s `rotinasPorFundo`/`rotinasDoFundo` → `rotinasPorEntidade`/`rotinasDoEntidade`, `dashboardQuery.ts`'s query shape, `Dashboard.svelte`, `RoutinesByFundo.svelte` → `RoutinesByEntidade.svelte`, `FundoDialog.svelte` → `EntidadeDialog.svelte`, `ProjectStrips.svelte`, `TicketQueue.svelte`, 5 other dialog components, `ProjetosSection.svelte` — `bun test src` (206 passed) and `bun run check` (0 errors) green.
- Renamed all 22 e2e spec files touching `fundo`/`fundos` (CLI-fixture argv, testids, UI-copy assertions like "Sem fundo vinculado" → "Sem entidade vinculada"), live-verified every touched spec against production before the destructive push (214/217 individual-file passes; full-suite final re-run 159/161).
- Ran the destructive schema push (`DELETE NAMESPACE fundos`, `DELETE LINK projetos.fundo`/`templatesRotina.fundo`/`tickets.fundo`), independently re-verified `fundos` returns empty and `entidades` retains all 58 migrated rows with `tipoEntidade` populated, deleted the transient migration script.

## Task Commits

Each task was committed atomically:

1. **Task 1: Additive schema push + live migration script + verification** - `953708b` (feat, tracer)
2. **Task 2: CLI rename (`apollo fundo` → `apollo entidade`, batch_import, all CLI tests)** - `795461d` (feat)
3. **Task 3: Web rename (schema consumers, entity defs, dashboard, dialogs)** - `6ad85ca` (feat)
4. **Task 4a: e2e rename across all 22 spec files** - `2136ef0` (feat)
4. **Task 4b: Destructive schema push + cleanup** - `cc5218f` (feat)

**Docs/state files** (STATE.md, this SUMMARY.md, `.planning/WINDOWS.md`) are left for the orchestrator/user to commit per this task's constraints — not committed by this executor.

## Migration Details (Task 1)

- **Before:** `fundos` = 58 rows, `entidades` = 0 rows (live production, verified immediately before the migration script ran).
- **After migration (`--confirmar`):** `entidades` = 58 rows, `fundos` = 58 rows (unchanged — the migration script never writes to `fundos`).
- **After the Task 4 destructive push:** `fundos` = 0 rows (namespace deleted; admin query for `{"fundos": {}}` returns `{"fundos": []}` — InstantDB's InstaQL is permissive, doesn't error on a namespace no longer in the schema), `entidades` = 58 rows, every row's `tipoEntidade == "Fundo"`, confirmed by an independent ad-hoc `python -c` admin query run outside both the migration script and this task's own test suites.
- Per-row byte-identity (`nome`/`codigo`/`ativo`/`donoId`/`createdAt`) was asserted for **all 58 rows**, not a sample, both by the migration script's own internal assertions and (implicitly, via the count+tipoEntidade check) the independent post-hoc query.
- `cli/scripts/migrate_fundos_to_entidades.py` (the transient migration script) was deleted in Task 4 Step E; `git status --porcelain cli/scripts/` is clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `tipoEntidade` missing from every `entidades` create call across CLI test fixtures**
- **Found during:** Task 2 live test run (`test_cross_user_isolation.py`'s `test_01`/`test_04` failed with `validation-failed: Missing required attribute entidades/tipoEntidade` instead of the expected `permission-denied`)
- **Issue:** `tipoEntidade` is a required schema field (D2), but the mechanical fundo→entidade rename sweep didn't add it to raw `client.tx.entidades[...].create(...)` calls in `test_cross_user_isolation.py`/`test_auth_rejection.py`/`test_batch_import.py`'s `_seed_entidade` helper — these bypass the CLI's own `--tipo-entidade` flag validation.
- **Fix:** Added `"tipoEntidade": "Fundo"` to every raw admin-client `entidades` create call across the 3 affected test files.
- **Files modified:** `cli/tests/test_cross_user_isolation.py`, `cli/tests/test_auth_rejection.py`, `cli/tests/test_batch_import.py`
- **Commit:** `795461d`

**2. [Rule 2 - Missing critical functionality] Browser-driven `entidades` create forms missing the new required `tipoEntidade` field fill**
- **Found during:** Task 4 live e2e proof (would have failed the same way as #1 above, form submission blocked)
- **Issue:** Every e2e test driving the SPA's create-entidade Dialog form needed a `field-tipoEntidade` fill added — mechanical rename alone doesn't add a new required field to an existing form-fill sequence.
- **Fix:** Added `await page.getByTestId("field-tipoEntidade").fill("Fundo")` to every entidades-create test in `entities-entidades.spec.ts`, `entities-form-restyle.spec.ts`, `entities-form-dialog-composition.spec.ts`, `cross-phase-verification.spec.ts`.
- **Files modified:** the 4 files above.
- **Commit:** `2136ef0`

**3. [Rule 3 - Auto-fix blocking issue] `web/src/lib/entities/registry.test.ts` needed the same transitional schema-coverage exception as the CLI's `test_cli_surface.py`**
- **Found during:** Task 3 execution, before running `bun test src`.
- **Issue:** RESEARCH.md's file enumeration flagged `registry.test.ts` for only 2 hits (a capability-fixture key rename and one string literal), but the file also runs a schema-driven `defs/*.ts` coverage check structurally identical to `test_cli_surface.py`'s — once `defs/fundos.ts` was deleted, this test would fail on the still-additively-declared `fundos` schema entity ("no defs/*.ts module found for schema entity 'fundos'") through Tasks 3 and the start of Task 4, exactly the gap `_PENDING_SCHEMA_REMOVAL` solves on the CLI side.
- **Fix:** Added an identical transitional `PENDING_SCHEMA_REMOVAL` exception (filtering `"fundos"` out of `SCHEMA_ENTITY_NAMES`, plus a mirroring "never carries a pending-removal key" guard test), removed again in Task 4 Step B alongside the CLI's own exception.
- **Files modified:** `web/src/lib/entities/registry.test.ts`
- **Commits:** `6ad85ca` (added), `cc5218f` (removed)

**4. [Rule 1 - Bug] `entities-entidades.spec.ts`'s WEB-02 empty-state assertion no longer holds**
- **Found during:** Task 4's individual-file live e2e run.
- **Issue:** The test's final step asserted the entidades screen shows the empty state after deleting its own seeded row, relying on a "no other production data exists yet" assumption inherited from the original `fundos` spec. That assumption was already false before this task (RESEARCH.md documented 58 live `fundos` rows at research time) and is even more clearly false now that all 58 are `entidades` rows.
- **Fix:** Removed the invalid empty-state assertion from WEB-02 (test now ends after confirming the delete persisted), replacing it with a comment explaining why. Verified the test passes green in the final full-suite run.
- **Files modified:** `web/e2e/entities-entidades.spec.ts`
- **Commit:** `2136ef0`

**5. [Rule 1 - Bug, documented] Task 2's own literal `<verify>` grep command conflicts with its own instructed transitional exception**
- **Found during:** Task 2, running the plan's own automated `<verify>` command.
- **Issue:** Task 2's action text explicitly instructs adding `_PENDING_SCHEMA_REMOVAL: frozenset[str] = frozenset({"fundos"})` to `test_cli_surface.py`, but Task 2's own `<verify>` grep pattern (`'"fundos"|fundoId|...'`) would match that exact added line, making the task fail its own literal verify command as written.
- **Resolution:** Ran the grep with the known, documented exception explicitly acknowledged (2 lines in `test_cli_surface.py`, later mirrored in `registry.test.ts`) rather than treating a self-contradictory verify command as a hard blocker — the plan's own action text and `<done>` criterion clearly intend for this transitional constant to exist through Task 2/3.
- **No code change** — this is a documentation note about how the grep-verify was interpreted, not a fix.

### Genuinely Pre-existing (Not Fixed, Out of Scope)

Two e2e test failures surfaced by this task's own live migration (production `entidades` is no longer empty/small, unlike before) but were **not** fixed, since they are the same class of pre-existing test-fragility already tracked in STATE.md's Deferred Items (tests that assume a near-empty/positionally-predictable live account, breaking as the real account accumulates data):

- `web/e2e/entities-header-states.spec.ts`'s `ENTTBL-06` empty-state test — assumes `entidades` is empty; false since the migration.
- `web/e2e/cross-phase-verification.spec.ts`'s `VERIFY-05` keyboard-focus smoke test for `entidades` — assumes the freshly-CLI-created row is one Tab away from `entity-create-start`; false since 58 real rows now exist, changing tab order.

Both are recorded in `.planning/WINDOWS.md` (ids 16, 17) for future cleanup, per this project's own "future dedicated pass" recommendation (STATE.md Deferred Items).

## Full-Suite Final Verification (Task 4 Step D)

- **CLI:** `uv run pytest -m "not live and not packaging"` → 406 passed, 2 skipped. `uv run pytest -m "live and not packaging"` → 113 passed, 1 xfailed (designed opt-in gate). `uv run pytest -m packaging` (test_packaging_live.py) → 1 passed.
- **Web unit:** `bun test src` → 206 passed. `bun run check` (svelte-check + tsc, app/node/e2e configs) → 0 errors, 2 pre-existing unrelated warnings (`EntityScreen.svelte`'s `state_referenced_locally`, `ProjetosSection.svelte`'s nested-button SSR warning — both pre-dating this task, documented in STATE.md's v1.2 tech debt).
- **Web e2e (full Playwright suite, all 3 projects):** 159 passed, 2 failed (both the pre-existing-fragility class documented above, neither caused by this rename).

## Self-Check: PASSED

Verified the following exist/resolve correctly:
- `shared/instant.schema.ts` — no longer declares `fundos` or its 3 links (confirmed via grep + live schema push output showing `DELETE NAMESPACE fundos`).
- `cli/apollo_cli/entities/entidade.py` — exists, `apollo entidade --help` resolves live.
- `web/src/lib/entities/defs/entidades.ts` — exists, exports a valid `EntityConfig` with `tipoEntidade` field.
- `cli/scripts/migrate_fundos_to_entidades.py` — confirmed deleted (`test ! -f` passed).
- Commit hashes `953708b`, `795461d`, `6ad85ca`, `2136ef0`, `cc5218f` all present in `git log --oneline`.
- Production InstantDB: `entidades` = 58 rows (all `tipoEntidade == "Fundo"`), `fundos` = 0 rows — independently re-queried immediately before writing this summary.
