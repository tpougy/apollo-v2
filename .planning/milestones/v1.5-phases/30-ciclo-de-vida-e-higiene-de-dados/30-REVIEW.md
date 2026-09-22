---
phase: 30-ciclo-de-vida-e-higiene-de-dados
reviewed: 2026-09-22T00:00:00Z
depth: quick
files_reviewed: 6
files_reviewed_list:
  - cli/apollo_cli/entities/rotina.py
  - cli/tests/test_crud_rotina_template.py
  - web/e2e/focus-dialog-button-inventory.spec.ts
  - web/e2e/focus-dialog-dia-rotina.spec.ts
  - web/e2e/focus-dialog-fundo.spec.ts
  - web/playwright.config.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 30: Code Review Report (Iteration 2, final)

**Reviewed:** 2026-09-22T00:00:00Z
**Depth:** quick
**Files Reviewed:** 6 (the fix-touched files from commits `b45dbd2`, `2a873cf`; iteration 1's full 14-file scope was not re-read in full, per the targeted nature of this re-review)
**Status:** clean

## Summary

This is iteration 2 (final, project cap) of the review-fix loop for Phase 30. Scope: verify
the two Warning fixes applied in commits `b45dbd2` (WR-01) and `2a873cf` (WR-02), plus a fresh
quick pattern-match pass over the 6 files those commits touched. Both prior warnings are
confirmed genuinely fixed, not just superficially patched. No new Critical, Warning, or Info
findings from this pass.

## Verified Fixed Since Iteration 1

**WR-01 — `_EXIT_INSTANCES_LINKED` collision with Click's usage-error exit code 2: CONFIRMED FIXED.**
- `cli/apollo_cli/entities/rotina.py:87` now defines `_EXIT_INSTANCES_LINKED: Final[int] = 5`
  (was `2`), used at the single call site `rotina.py:494`.
- Grepped every `EXIT_*`/`_EXIT_*` constant definition across `cli/apollo_cli/` (`auth.py`,
  `crud_helpers.py`, `rotina.py`): `EXIT_NO_SESSION = 1`, `EXIT_API_ERROR = 3`,
  `EXIT_NETWORK_ERROR = 4`, `_EXIT_INSTANCES_LINKED = 5`. No other code in the CLI raises
  `SystemExit(5)` or `SystemExit(2)` for a business-rule condition — `2` remains exclusively
  Click's own reserved usage-error code, `5` is otherwise unused. No collision, old or new.
- The module-level comment directly above the constant (`rotina.py:79-86`) now explicitly
  documents why `2` was rejected (Click's own `UsageError`/`BadParameter` reservation) and why
  `5` was chosen — this is a durable guard against the same mistake recurring, not just a
  numeric value swap.
- The one test that asserted the old value, `test_deletar_with_linked_instances_blocks_by_default_with_exact_count`
  (`cli/tests/test_crud_rotina_template.py:511-548`), now asserts `exit_code == 5` at line 543
  and still separately verifies `error_body["error"] == "instances_linked"` and
  `error_body["instance_count"] == 2` — the fix did not just relax the assertion, the full
  behavioral contract (block, exact count, zero writes implied by unchanged surrounding
  assertions) is still exercised.

**WR-02 — shared `PREFIX`/`OWNER_EMAIL` across 3 spec files sharing `sweepInstancesByDedupeKeyPrefix`: CONFIRMED FIXED.**
- Each of the 3 files now defines a distinct `PREFIX`:
  - `web/e2e/focus-dialog-fundo.spec.ts:34` → `"phase23-e2e-fundo-"`
  - `web/e2e/focus-dialog-dia-rotina.spec.ts:33` → `"phase23-e2e-dia-rotina-"`
  - `web/e2e/focus-dialog-button-inventory.spec.ts:40` → `"phase23-e2e-btn-inv-"`
  All three are mutually non-overlapping prefixes (none is a prefix of another), so even without
  serial execution, `sweepInstancesByDedupeKeyPrefix(PREFIX, OWNER_EMAIL)` in one file cannot
  match `dedupeKey` values seeded by another.
- **Consistency check (the exact failure mode the review brief called out — a mismatch between
  seed-time prefix and sweep-time prefix would silently break the sweep):** in all 3 files, the
  `uniqueName()` helper prepends the file's own `PREFIX` constant to every generated
  `dedupeKey` (e.g. `focus-dialog-fundo.spec.ts:45`: `` `${PREFIX}${prefix}-${Date.now()}-...` ``,
  consumed at `:263`, `:278`, `:307` for `dedupeKey: uniqueName(...)`), and the same `PREFIX`
  constant (not a copy, not a re-literal) is passed to `sweepInstancesByDedupeKeyPrefix(PREFIX,
  OWNER_EMAIL)` in each file's `sweepLeftovers`/teardown hook (`:91`, `:82`, `:108`
  respectively). No mismatch in any of the 3 files — same source-of-truth constant used both
  ends.
- **Unaffected-files check:** grepped `web/e2e/focus-dialog-projeto.spec.ts`,
  `focus-dialog-projetos-kanban.spec.ts`, `focus-dialog-ticket.spec.ts` for
  `sweepInstancesByDedupeKeyPrefix` — zero matches in all three. They still share the bare
  `PREFIX = "phase23-e2e-"` but never call the sweep function, so WR-02's race condition does
  not apply to them; the fixer's report on this point is accurate.
- **Defense-in-depth:** `web/playwright.config.ts:8-17` now carries an explicit comment
  documenting `fullyParallel: false` / `workers: 1` as a correctness requirement for the
  dedupeKey-prefix sweeps (not just a performance choice), and instructs future editors to
  audit every spec-level `PREFIX` for uniqueness before relaxing either setting. This closes
  the "config drift" scenario the original WR-02 finding was worried about.

## New Findings (this iteration)

None. Quick pattern-match pass (hardcoded secrets, `eval`/`innerHTML`/dangerous-exec patterns,
`console.log`/`debugger`/`TODO`/`FIXME`/`XXX`/`HACK`, empty catch blocks) against all 6
fix-touched files turned up nothing beyond one comment in
`web/e2e/focus-dialog-button-inventory.spec.ts:752` that contains the literal substring
`innerHTML` inside prose explaining that the test does NOT use `innerHTML` — a false positive
from the regex, not a real finding.

Iteration 1's two Info-level findings (IN-01: no explicit pagination/limit on the two new
InstaQL queries in `rotina.py`; IN-02: broad `try/catch` teardown helpers masking a future
`--force`-flag-dropped regression) were explicitly left unfixed as out of scope for the
review-fix loop and were not re-flagged here, per the iteration-2 brief's focus on verifying
the two Warnings only. They remain open as accepted residual risk, not because this pass missed
them.

---

_Reviewed: 2026-09-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
