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
