# Deferred Items — Phase 26 Plan 01

Out-of-scope discoveries logged during execution (SCOPE BOUNDARY rule: only auto-fix issues
directly caused by the current task's changes).

## 1. `test_criar_without_offset_dias_omits_key_entirely` fails against the live DB (pre-existing, unrelated)

- **File:** `cli/tests/test_crud_rotina_template.py`
- **Failure:** `listar --limit 50` no longer reliably returns a just-created `templatesRotina`
  record — `next(r for r in listed if r["id"] == eid)` raises `StopIteration`.
- **Root cause:** the live InstantDB app now has 84+ pre-existing `templatesRotina` records
  from the real RBR onboarding (per STATE.md); `--limit 50` with no explicit ordering by
  creation time no longer guarantees a brand-new record is among the first 50 rows returned.
- **Verified unrelated to this plan:** `git diff`/`git log` confirm neither Task 1 nor Task 2
  touched this test or its assertions; it fails identically when run standalone, with no
  `--regra-competencia` involvement at all.
- **Status:** Not fixed — out of scope for VAL-01/VAL-02/VAL-03 (this phase touches only
  `--regra-competencia`/`--propagar-atraso-soft`/`dedupeKey` validation and documentation, per
  CONTEXT.md decision #5's scope boundary). Left for a future phase/fix (e.g. add
  `--limit`-independent lookup, or order `listar` by creation descending).
