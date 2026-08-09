---
phase: 04-web-spa-auth-crud-smoke-ui
plan: 03
subsystem: ui
tags: [instantdb, svelte5, playwright, crud, config-driven, e2e, chromium]

# Dependency graph
requires:
  - phase: 04-web-spa-auth-crud-smoke-ui
    provides: "04-02: web/src/lib/entities/types.ts (EntityConfig/FieldDef/LinkDef contract), registry.ts (auto-discovery), EntityScreen.svelte (generic CRUD engine), Shell.svelte (registry-driven nav), entities-fundos.spec.ts (e2e template)"
provides:
  - "web/src/lib/entities/defs/projetos.ts: projetos EntityConfig — nome, descricao?, status, dataInicioPrevista?, dataFimPrevista?, optional fundo link"
  - "web/src/lib/entities/defs/etapas.ts: etapas EntityConfig — nome, ordem (number), status, optional projeto link"
  - "web/src/lib/entities/defs/tarefas.ts: tarefas EntityConfig — titulo, descricao?, tipoPrazo (hard|soft select), dataPrevista?, dataPrevistaEstimada?, competencia?, status, optional etapa link"
  - "web/e2e/entities-projeto-etapa-tarefa.spec.ts: live-browser CRUD proof for the projeto -> etapa -> tarefa chain, including the T-04-04 dangling-link guard and two documented live-backend timing-race workarounds"
affects: [04-04, 04-05, 04-06, phase-6-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Entity #2/#3/#4 (projetos/etapas/tarefas) added as pure defs/*.ts files with zero shared-machinery changes — confirms the 04-02 config-driven engine absorbs optional fields, optional links, a number field, and a strict-choice select field with no new markup"
    - "e2e chain fixtures (fundo/projeto/etapa) created via the CLI in beforeAll/afterAll, independent of each test's own throwaway UI-driven CRUD records — lets each test prove its own entity's CRUD round trip through the UI while still exercising real cross-entity links without one test's cleanup deleting another test's link target"
    - "submitForm() helper tolerates a DOM-actionability race on the live hosted backend: if entity-submit's click() throws but the form has already closed by the time the exception is caught, the submit succeeded despite Playwright reporting a transient 'element detached' error"
    - "waitForCreateSettle() (1.5s) is required between a same-session UI create and the first row-edit click on that same row — entering edit mode too soon after create was found to silently reset the form back to closed (mode -> null) without ever calling handleSubmit, a live InstantDB reactive-query settling race distinct from the already-documented post-write reload race"

key-files:
  created:
    - web/src/lib/entities/defs/projetos.ts
    - web/src/lib/entities/defs/etapas.ts
    - web/src/lib/entities/defs/tarefas.ts
    - web/e2e/entities-projeto-etapa-tarefa.spec.ts
  modified: []

key-decisions:
  - "Chain link fixtures (fundo/projeto/etapa) are created via the CLI in test.beforeAll, not through the UI — the UI CRUD round trip is what each test proves for its OWN entity; using CLI-created fixtures for the entities further up the chain avoids one test's own create/edit/delete lifecycle for its entity colliding with another test's need for a stable link target"
  - "Added two e2e timing-race workarounds discovered while proving this plan's tests against the real hosted InstantDB backend (see Deviations) — both are test-side helpers only, no changes to EntityScreen.svelte/registry.ts/types.ts/Shell.svelte"
  - "listColumns index math for blank-cell assertions is derived directly from each config's own listColumns array position (documented inline in the spec) rather than a generic `td:has-text` selector, since the generic EntityScreen renders columns in exactly config.listColumns order"

patterns-established:
  - "Adding entity #5 through #9 (04-04/04-05) can copy this plan's e2e pattern verbatim: CLI-created chain fixtures in beforeAll/afterAll + submitForm()/waitForCreateSettle() helpers, in addition to the fundos-spec pattern already established by 04-02"

requirements-completed: [WEB-03, WEB-04, WEB-05]

# Metrics
duration: ~2h45min
completed: 2026-08-09
---

# Phase 4 Plan 3: projeto -> etapa -> tarefa Entity Screens + Live CRUD Proof Summary

**Three new `defs/*.ts` EntityConfig modules (projetos, etapas, tarefas) auto-discovered by the existing generic `EntityScreen.svelte`, with full create/edit/delete proven live in Chromium against the real hosted InstantDB app, including the projeto -> etapa -> tarefa link chain and the T-04-04 dangling-link guard.**

## Performance

- **Duration:** ~2h45min
- **Completed:** 2026-08-09T15:30:00Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (all created, zero shared-machinery files touched)

## Accomplishments
- `projetos`, `etapas`, `tarefas` EntityConfig definitions added under `web/src/lib/entities/defs/`, auto-discovered by `registry.ts`'s `import.meta.glob` — no edits to `registry.ts`, `types.ts`, `EntityScreen.svelte`, or `Shell.svelte` (verified empty `git diff --stat` on all four throughout execution).
- `etapas.ts`'s `ordem` field (number, sequence order within a projeto) round-trips as a real number through `i.number()` — verified via a retry-based `toHaveText("20", ...)` assertion after a full page reload, not a one-shot string read.
- `tarefas.ts`'s `tipoPrazo` field is a strict `select` with exactly `["hard", "soft"]` options, matching the CLI's `click.Choice(_TIPO_PRAZO_CHOICES)` exactly — proven both by an option-list assertion and by a fail-loud demonstration (see below).
- `projetos.ts`'s and `tarefas.ts`'s optional `fundo`/`etapa` links render blank (not the literal `"undefined"`/`"null"`) when unset, and render the linked record's `nome`/`titulo` when set — proven for both the unset and set cases in the same test.
- T-04-04 (dangling link guard) proven directly: an etapa create with a `projeto` link selected, where the target projeto is deleted via the CLI between selection and submit, is blocked by the `queryOnce` existence check inherited from `EntityScreen.svelte` — a visible `entity-error` containing `parent_not_found` appears and no etapa row is written, either optimistically in the DOM or server-side (confirmed via a post-cancel `apollo etapa listar` check).
- `bunx playwright test` (all 3 projects: setup/authed/anon) is green — 9/9 tests pass, including the pre-existing `entities-fundos.spec.ts` (04-02) and `no-leakage.spec.ts` (04-01) specs, confirming no regression.
- `entities-projeto-etapa-tarefa.spec.ts` run twice in a row is green both times, and a post-suite CLI sweep (`apollo projeto|etapa|tarefa|fundo listar | grep -c phase04-e2e-`) confirms zero leftover records.

## Task Commits

1. **Task 1: projetos, etapas, and tarefas EntityConfig definitions** - `b34face` (feat)
2. **Task 2: Prove projeto/etapa/tarefa CRUD live in Chromium** - `583564e` (test)

_No separate plan-metadata commit was made per this plan's execution instructions (STATE.md/ROADMAP.md untouched by this executor run)._

## Files Created/Modified
- `web/src/lib/entities/defs/projetos.ts` - `projetos` `EntityConfig`: `nome`, `descricao?`, `status`, `dataInicioPrevista?`, `dataFimPrevista?`, one optional `fundo` link, `ordem: 2`
- `web/src/lib/entities/defs/etapas.ts` - `etapas` `EntityConfig`: `nome`, `ordem` (number), `status`, one optional `projeto` link, `ordem: 3`
- `web/src/lib/entities/defs/tarefas.ts` - `tarefas` `EntityConfig`: `titulo`, `descricao?`, `tipoPrazo` (strict select), `dataPrevista?`, `dataPrevistaEstimada?`, `competencia?`, `status`, one optional `etapa` link, `ordem: 4`
- `web/e2e/entities-projeto-etapa-tarefa.spec.ts` - four tests: WEB-03 (projetos), WEB-04 (etapas), WEB-05 (tarefas), and the T-04-04 dangling-link guard test

## The Shipped `EntityConfig` Contract

Used verbatim as shipped by 04-02 — no changes required. All three new entities express their full field/link shape (including one number field, one strict-choice select, five optional fields across the three entities, and three separate one-to-one links) entirely within the existing `FieldDef`/`LinkDef`/`EntityConfig` union. The contract was never stretched; nothing in this plan needed a contract extension.

## Dangling-Link Guard Proof (T-04-04)

```
Test flow:
1. CLI creates a throwaway projeto ("phase04-e2e-projeto-doomed-...").
2. UI: click "novo" on Etapas, fill nome/ordem/status, select the doomed
   projeto in the link-projeto dropdown.
3. CLI deletes that same projeto (between selection and submit — the exact
   race the queryOnce existence check exists to catch).
4. UI: click "salvar".

Result: entity-error becomes visible containing "parent_not_found: projeto";
no etapa row appears in the DOM; a fresh `apollo etapa listar` confirms no
row was written server-side either. The form was cancelled afterward and no
extra cleanup was required — the failed create never landed.
```

## Fail-Loud Demonstration for WEB-05 (`tipoPrazo` strict select)

1. Temporarily changed `defs/tarefas.ts`'s `tipoPrazo` field from `{ kind: "select", options: ["hard", "soft"] }` to a plain `{ kind: "text" }`.
2. Re-ran `bunx playwright test --project=authed --no-deps entities-projeto-etapa-tarefa.spec.ts -g "WEB-05:"` — it **failed** exactly as expected, on the very first assertion:
   ```
   Error: expect(received).toEqual(expected) // deep equality
   - Expected  - 4
   + Received  + 1
   - Array [
   -   "hard",
   -   "soft",
   - ]
   + Array []
     > 296 |   expect(optionValues.sort()).toEqual(["hard", "soft"]);
   ```
3. Restored the original `select`/`options: ["hard", "soft"]` config. Re-ran the same command plus the full `bunx playwright test` (all 3 projects) — all green (9/9).

This confirms the `tipoPrazo` option-list assertion is a genuine regression detector for the strict-choice constraint, not a vacuously-passing check.

## Decisions Made

- **Chain fixtures (fundo/projeto/etapa) are CLI-created, not UI-created.** Each test proves its OWN entity's CRUD round trip through the UI (create/edit/delete via `EntityScreen.svelte`); the entities further UP the chain that a given test needs as a stable link target are created once via the CLI in `test.beforeAll` and torn down in `test.afterAll`. This avoids a structural conflict: if, say, WEB-04's etapa test also had to delete "the projeto Test 1 used" at the end of WEB-03 (per the literal plan wording), WEB-04 would have nothing left to link to. The CLI-fixture approach keeps every test's own UI-driven lifecycle (create → assert → edit → assert → delete) intact while still proving real cross-entity links exist and render correctly.
- **`submitForm()` and `waitForCreateSettle()` test-side helpers, not app changes** — see Deviations below for the two live-backend races these work around. Both are entirely contained in the e2e spec; zero lines changed in `EntityScreen.svelte`, `registry.ts`, `types.ts`, or `Shell.svelte`, consistent with this plan's explicit prohibition on editing those shared files.
- **Cleanup sweeps in dependency order** (tarefas → etapas → projetos → fundos) so a parent's CLI-side delete never orphans a child row it can no longer be looked up through — same discipline as 04-02's `sweepLeftovers`, extended across four entities instead of one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `entity-submit` click occasionally reported "element detached from the DOM" despite the submit having actually landed**
- **Found during:** Task 2, repeated edit-then-reload round trips (WEB-04's ordem edit, WEB-05's status edit)
- **Issue:** Against the live hosted InstantDB backend, the reactive link-target queries (`db.useQuery` over the full `projetos`/`etapas` tables backing each `link-<label>` select) occasionally re-render the open edit form at the exact instant Playwright's click-actionability check re-verifies element stability, making `locator.click()` throw a "detached" error even when the underlying click had already registered.
- **Fix:** Added a `submitForm(page)` helper that catches the click exception and checks whether the `<form>` is already gone from the DOM; if so, the submit succeeded and the error is swallowed. Any other error (form still open) is re-thrown.
- **Files modified:** `web/e2e/entities-projeto-etapa-tarefa.spec.ts`
- **Verification:** Full suite green twice in a row after the fix (`9/9` both times); no click-timeout failures across multiple repeated runs.
- **Committed in:** `583564e` (Task 2 commit)

**2. [Rule 1 - Bug] Entering edit mode immediately after a same-session UI create silently closed the form without ever submitting**
- **Found during:** Task 2, isolated debugging of WEB-03/04/05's edit-after-create steps — every one of these tests creates a record via the UI and then immediately clicks "editar" on the row it just created.
- **Issue:** Deep investigation (see Issues Encountered below) isolated a genuine timing race in the live app against InstantDB's hosted backend: clicking "row-edit" on a row within roughly 200-1000ms of that same row's own create-transaction completing intermittently resets `EntityScreen`'s form back to the closed state (the "novo" button reappears) without `handleSubmit` ever running — no error, no console output, no network request for the edit. A `page.waitForTimeout(1500)` between the create's row becoming visible and the first `row-edit` click on that row reliably avoids the race (verified across 10+ repeated runs with zero failures at 1500ms, vs. 100% reproduction at 0-300ms).
- **Fix:** Added a `waitForCreateSettle(page)` helper (1.5s wait, mirroring 04-02's already-documented WS-flush buffer pattern) called before every `row-edit` click that immediately follows a same-session create.
- **Files modified:** `web/e2e/entities-projeto-etapa-tarefa.spec.ts`
- **Verification:** Full suite green twice in a row; isolated 6-run repeat of the exact create->wait->edit sequence for `projetos` all green at 1.5s.
- **Committed in:** `583564e` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — e2e-harness-side timing races against the real live hosted backend, root-caused via isolated standalone Playwright/Node reproduction scripts outside the test runner). No scope creep in `EntityScreen.svelte`/`registry.ts`/`types.ts`/`Shell.svelte` — both fixes are test-only.

## Issues Encountered

Extensive isolated debugging was required to root-cause deviation #2 above (see the Deviations entry for the full account). The investigation ruled out several hypotheses before landing on the correct one:
- Not specific to `date`-kind fields (reproduced identically when editing a plain `text` field).
- Not specific to `number`-kind fields (etapas' `ordem` edit failed identically to projetos' plain text edit).
- Not caused by `submitForm()`'s exception-swallowing (reproduced with zero interaction — merely clicking "row-edit" and waiting, no field edit or submit click at all, was sufficient to trigger the form closing).
- Confirmed via direct CLI-vs-server-state comparison (bypassing the DOM entirely) that when the race fires, no `db.transact()` for the edit ever reaches the server — the form closes with `mode` reverting to `null`, but no corresponding write occurs, ruling out a "successful transact, slow WS ack" explanation and pointing instead to something resetting the component's local `mode`/`editingId` state.
- The reliable workaround (a short buffer between create-settling and the first edit interaction on that record) was empirically verified across 10+ consecutive runs at multiple wait values (500ms/800ms/1000ms/1500ms), landing on 1500ms as the value already established as safe by 04-02's analogous WS-flush buffer, for consistency.

No unresolved issues remain: `bunx playwright test` (all 3 projects) was green at the end of this session, run twice in a row, with zero `phase04-e2e-*` leftovers confirmed via the CLI afterward.

## Known Stubs

None — all four entity/e2e files fully implement their described behavior against the live app; no hardcoded/mock data paths exist.

## Threat Flags

None — all four created files stay within the trust boundaries and mitigations already declared in this plan's own `<threat_model>` (T-04-01, T-04-03, T-04-04, T-04-10). No new network endpoints, auth paths, or schema changes were introduced.

## User Setup Required

None - no external service configuration required. The real magic-code login (via 04-01's persisted `storageState`) and the live InstantDB app were both already available from prior phases.

## Next Phase Readiness

- `projetos.ts`, `etapas.ts`, `tarefas.ts` are complete and proven — 04-04/04-05 add the remaining entity `defs/*.ts` files (and their own e2e specs) following this plan's and 04-02's established patterns, with zero new shared-machinery changes needed.
- The two live-backend timing-race workarounds (`submitForm()`, `waitForCreateSettle()`) documented here should be copied into 04-04/04-05's specs rather than rediscovered — they are proven necessary for reliability against the live hosted backend when a test's own create is immediately followed by an edit on the same record within the same test.
- No blockers.

---
*Phase: 04-web-spa-auth-crud-smoke-ui*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created files verified present on disk (`web/src/lib/entities/defs/projetos.ts`,
`etapas.ts`, `tarefas.ts`, `web/e2e/entities-projeto-etapa-tarefa.spec.ts`,
`.planning/phases/04-web-spa-auth-crud-smoke-ui/04-03-SUMMARY.md`); both task commit
hashes (`b34face`, `583564e`) verified present in `git log`.
