# Deferred Items — Phase 29

Out-of-scope discoveries logged during code review (SCOPE BOUNDARY rule: only
auto-fix issues directly caused by the current phase's changes).

## 1. `test_gerar_instancias_double_run_idempotent_and_preserves_status` fails against the live DB (pre-existing, unrelated)

- **File:** `cli/tests/test_routine_job.py:397`
- **Failure:** `assert report1["existing"] == []` — `report1["existing"]` contains 90
  unexpected dedupeKeys after "run 1" of a freshly created `du_fixo`/`corrido_fixo`/
  `encadeado` trio.
- **Root cause:** the test asserts on `gerar-instancias`'s ACCOUNT-WIDE report
  (`created`/`existing`/`skipped` cover every active template for the authenticated
  owner, not just the 3 templates this test just created) rather than scoping its
  assertion to its own `template_ids`. This was always latently fragile in a real
  account, and has now tipped over: the live InstantDB app carries 84+
  `templatesRotina` from the real RBR onboarding plus accumulated leftover test
  templates from an entire milestone's worth of live test runs (Phases 26-29) — any
  of those with a `dataPrevista` already inside the current default generation
  window (`[today, end_of_next_month(today)]`) makes `report1["existing"]`
  non-empty, regardless of what this test's own 3 fresh templates do.
- **Same root-cause class as Phase 26's already-documented deferred item**
  (`.planning/phases/26-valida-o-na-escrita/deferred-items.md` #1 —
  `test_criar_without_offset_dias_omits_key_entirely`'s `--limit 50` fragility
  against the same accumulated real data).
- **Verified unrelated to this phase:** `git show c7d36a5 c7a44e1 --
  cli/tests/test_routine_job.py` confirms neither Phase 29 commit touched this
  test function (line 397) or its assertions — the diffs land at lines 234-235+85
  and 663+174, both well outside it. Fails identically on `main` before and after
  Phase 29's changes.
- **Status:** Not fixed — out of scope for RANGE-01 (this phase touches only the
  generation-range override, not `gerar-instancias`'s report shape or this test's
  scoping). Left for a future phase/fix (e.g. scope the assertion to
  `template_ids`, or run live tests against a dedicated/isolated test account
  rather than the shared real production app).
