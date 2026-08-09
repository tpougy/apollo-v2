# Deferred / Auto-Fixed Items — Phase 6

Discoveries made while building `verify-phase-06.sh` (plan 06-03) that reach outside this
plan's own `files_modified` list. Logged here per the executor's scope-boundary rule; the two
below were auto-fixed under Rule 1 (bug) / Rule 3 (blocking issue) because they directly
prevented Gate 4 (`verify-phase-04.sh`) and Gate 6 (VERIFY-01) of `verify-phase-06.sh` from
passing — nothing here was deferred without a fix.

## Fixed: `web/e2e/entities-rotina-log.spec.ts` WEB-06 off-by-one column indices

`templatesRotina.listColumns` gained `offsetDias` at some point after this Phase 4 test was
written (`web/src/lib/entities/defs/templatesRotina.ts:71` —
`["nome", "tipoGeracao", "offsetDias", "ativo", "fundo", "antecessor"]`), shifting every column
index after `tipoGeracao` by one. The test still asserted against the pre-`offsetDias` 5-column
layout (`cellsA.nth(3)`/`nth(4)` for the blank `fundo`/`antecessor` columns, `nth(2)` for
`ativo`), so it was comparing the wrong `<td>`. Fixed by shifting each index by one
(`nth(4)`/`nth(5)` for the link columns, `nth(3)` for `ativo`). Not a code defect — the
`offsetDias` column addition itself is correct and expected (proven by
`registry.test.ts`'s own assertion that `offsetDias` belongs in `listColumns`).

## Fixed: `web/e2e/entities-rotina-log.spec.ts` WEB-07 hasRows race condition

`const hasRows = (await page.getByTestId("row").count()) > 0` ran immediately after
`page.getByTestId("nav-instanciasRotina").click()`, before the InstantDB subscription's first
`isLoading` cycle resolved — at that instant zero "row" testids are rendered regardless of
whether the live app actually has rows, so `hasRows` was always `false` on the first paint. The
live app genuinely has non-zero `instanciasRotina` rows by this point in the milestone
(Phase 5's job has run for real against tp@'s account), so the test then waited on
`getByTestId('empty-state')`, which correctly never appears once real rows exist — a real
`(row count > 0)` state hiding behind a stale `hasRows = false` read. Fixed by inserting
`await waitForSettle(page)` (the same 1500 ms InstantDB-subscription-settle helper already used
elsewhere in this file) before the count check.

**Both fixes verified**: `bunx playwright test --project=authed --no-deps -g "WEB-06|WEB-07"`
passes 2/2 after the fix, and the full `verify-phase-04.sh` `authed` project run is green.

## Fixed: `verify-phase-04.sh` T-04-03 gate stale allowlist

The `donoId` confinement gate only allowlisted `EntityScreen.svelte`, written before Phase 5
added `web/src/lib/routineJob.ts` (which legitimately needs the signed-in user's `donoId` to
scope its own template query) and `web/src/lib/Shell.svelte` (which passes it in on sign-in).
Neither is a leak — both are documented, reviewed Phase 5 code — but the never-updated gate
made `verify-phase-04.sh`, and therefore `verify-phase-06.sh`'s Gate 4, permanently fail.
Widened the allowlist to include both files.
