# Deferred Items — Phase 30

Out-of-scope discoveries logged during execution (SCOPE BOUNDARY rule: only
auto-fix issues directly caused by the current plan's changes).

## 1. `test_criar_without_offset_dias_omits_key_entirely` fails against the live DB (pre-existing, unrelated, already documented in Phase 26)

- **File:** `cli/tests/test_crud_rotina_template.py:264` (function body around
  line 274's `next(r for r in listed if r["id"] == eid)`)
- **Failure:** `StopIteration` — `run_cli(["rotina", "template", "listar", "--limit",
  "50"])` does not include a just-created record because the live production
  `templatesRotina` table now holds 84 rows with no guaranteed insertion-order
  from InstantDB, and no `--limit` above 50 is passed.
- **Root cause:** identical to the already-documented Phase 26 deferred item
  (`.planning/phases/26-valida-o-na-escrita/deferred-items.md` #1) and Phase 29's
  same-root-cause item (`.planning/phases/29-controle-de-geracao/deferred-items.md`
  #1) — this test's `--limit 50` assumption predates the real RBR onboarding data
  and accumulated live-test leftovers pushing the table past 50 rows. This plan's
  Task 1 (`deletar --force`/`--no-force` guard) does not touch `criar` or `listar`
  at all — confirmed by `git diff --stat cli/apollo_cli/entities/rotina.py` showing
  only additions to `_count_linked_instances`/`deletar`/the module docstring, zero
  changes to `criar`/`listar`.
- **Verified unrelated to this plan:** fails identically and deterministically (3/3
  reruns, same `StopIteration`) in complete isolation, before and unrelated to any
  of this plan's own new tests, which all pass.
- **Status:** Not fixed — out of scope for LIFE-01/LIFE-02 (this plan touches only
  `deletar`'s guard and `instancia limpar-orfas`, not `criar`/`listar`'s querying/
  sorting behavior). Left for a future phase/fix, same as the two prior
  occurrences of this exact root cause.

## 2. Three `web/e2e` tests fail against the live app (pre-existing, unrelated, same root-cause class as #1)

- **Files:** `web/e2e/dashboard.spec.ts:1147` ("each of days A-E's dash-heatmap-cell
  carries its exact expected FAIXA_CLASSES string"), `web/e2e/dashboard.spec.ts:1205`
  ("every dash-heatmap-cell resolves to a real `<button>` tagName"),
  `web/e2e/routine-job-cross-channel.spec.ts:161` (`expect(cliReport.existing).toEqual([])`).
- **Failure:** the two heatmap tests assert exact density-band CSS classes for specific
  calendar days; the cross-channel test asserts the CLI's `gerar-instancias` report has
  zero pre-existing instances for a freshly seeded template trio — both compute against
  the FULL account (not scoped to this test's own seeded/created rows), so real
  production data volume (18 fundos, 84 templatesRotina, and the item counts they imply
  on any given day) now produces different density bands / non-empty `existing` lists
  than the tests' original authors anticipated.
- **Root cause:** same class as item #1 above and the Phase 26/29 deferred items — an
  unscoped assertion against a shared, growing production account.
- **Verified unrelated to plan 30-02:** `git diff 9af8909..1fa0c37 --
  web/e2e/dashboard.spec.ts web/e2e/routine-job-cross-channel.spec.ts` shows zero changes
  to either failing test's own logic — only the `tryDelete`/`sweepLeftovers` force-flag
  and instance-sweep infrastructure this plan targets. Confirmed live: Task 1's tracer
  (`focus-dialog-dia-rotina.spec.ts`, 7/7) and 41/44 of Task 2's 7-file run pass; only
  these 3, pre-existing and outside this plan's diff, fail.
- **Status:** Not fixed — out of scope for LIFE-03 (this plan's scope is `--force`
  propagation + `instanciasRotina` dedupeKey-prefix sweeping, not fixing unrelated
  pre-existing tests' data-volume assumptions). Fourth occurrence of this exact
  root-cause class this milestone; a real fix (scoping every such assertion to the
  test's own created/seeded rows) is a cross-cutting concern better addressed once,
  outside any single phase's scope.
