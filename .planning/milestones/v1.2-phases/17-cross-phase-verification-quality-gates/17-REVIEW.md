---
phase: 17-cross-phase-verification-quality-gates
reviewed: 2026-08-10T21:45:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - web/e2e/cross-phase-verification.spec.ts
  - web/e2e/shell-chrome.spec.ts
  - web/src/lib/entities/EntityScreen.svelte
  - web/README.md
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-08-10T21:45:00Z
**Depth:** standard
**Files Reviewed:** 4 (plus 17-01-PLAN.md / 17-02-PLAN.md read for context)
**Status:** issues_found (non-blocking)

## Summary

This phase is verification/documentation-only, and the review confirms most of its own claims
hold up under independent re-checking rather than being taken on faith:

- **Testid rename (`entity-error` -> `entity-query-error`) is complete and consistent.** A
  repo-wide grep found zero stale references to the old testid on the `query.error` path, and the
  three remaining `entity-error` usages in `entities-form-restyle.spec.ts`,
  `entities-projeto-etapa-tarefa.spec.ts`, and `entities-ticket-subtarefa.spec.ts` all correctly
  target the still-named `formError` branch (line 461), not the renamed one (line 478). Confirmed
  by reading `git show b74c885` — the diff is exactly the one line the SUMMARY claims.
- **No raw color literals** in any of the four files (`grep -nE "oklch\(|#[0-9a-fA-F]{3,8}|rgba?\("`
  returns nothing).
- **`bun run check` and `bun run lint` independently re-run** during this review: both exit clean
  with only the two pre-existing findings the plan names (`EntityScreen.svelte` `configProp`
  warning, `calendar-caption.svelte` `useParseIntRadix` info) — no new suppressions, matching the
  QUAL-02 claim.
- **The `space-y-*`/`gap-*` pixel-parity assertions in the new spec are not tautological.**
  Verified against the actual compiled Tailwind v4 CSS (`.space-y-4 > :not(:last-child)` sets
  `margin-block-end: calc(spacing*4)`, not `margin-block-start`, contrary to pre-v4 Tailwind
  behavior) that `getComputedStyle(...).marginBlockEnd` is in fact the property that carries the
  16px/8px value being asserted, and that every measured field (`login-email-field`, `field-nome`,
  `field-nome`'s label) is genuinely a non-last child of its `space-y-*` container, so the
  assertions exercise real computed layout rather than a value that would be present regardless.
  The dual-color-scheme "backgrounds differ" assertions are likewise real: `app.css` gates dark
  mode via `@media (prefers-color-scheme: dark)`, which `page.emulateMedia` genuinely drives.
- **The focus-visible affordance check is not vacuously true.** shadcn's `Button` sets
  `outline-style: none` unconditionally and only adds a `box-shadow` via
  `focus-visible:ring-3`, so `assertFocusVisibleAndUnclipped`'s
  `outlineStyle !== "none" || boxShadow !== "none"` check can only pass when the browser actually
  applies `:focus-visible`, confirmed against the compiled CSS.
- **No hardcoded `waitForTimeout`/sleep calls** anywhere in either spec file — all synchronization
  goes through Playwright's auto-retrying `expect(...)` / locator actions.
- The `shell-chrome.spec.ts` lint fix (`5e28749`) is a straightforward, behavior-preserving
  null-check refactor (non-null-assertion -> explicit throw-if-null guard); confirmed via `git show`.

Two non-blocking issues were found in the new spec file (both fragility/robustness concerns, not
functional bugs), detailed below.

## Warnings

### WR-01: fundos keyboard/focus-visible test depends on an unasserted "table is empty except my own row" invariant

**File:** `web/e2e/cross-phase-verification.spec.ts:357-383`
**Issue:** The test creates one `phase17-e2e-kb-fundo-*` record, then does:
```js
await page.getByTestId("entity-create-start").focus();
await page.keyboard.press("Tab");
await expect(row.getByTestId("row-edit")).toBeFocused();
```
This assumes the newly created row is the very first Tab stop after the create button — i.e.,
that the `fundos` table contains exactly this one row at the moment the test runs. Nothing in the
test asserts row count before pressing Tab. The `fundos` entity is a real, live, shared
production-style table (`tp@rbrasset.com.br`'s actual InstantDB app) used as the "full-CRUD
representative" by several other specs (`entities-fundos.spec.ts`,
`entities-form-restyle.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`,
`entities-table-restyle.spec.ts`). Every one of those specs relies on its own
`beforeEach`/`afterEach` CLI sweep (or a `try { deletar } catch { /* already gone */ }` pattern) to
self-clean, and those sweeps only ever match their own `phaseNN-e2e-` prefix — a crash mid-test in
any other spec, or a manual/live fund record ever added to this account, would silently break this
test's ordinal assumption. Contrast with the very next test in the same file
(`instanciasRotina`), whose own comment explicitly calls out that it *avoids* this exact
assumption ("unlike fundos, this test asserts on whichever row-edit Tab reaches") — confirming the
fundos test's assumption is not incidental, but a real, acknowledged-elsewhere gap.
**Fix:** Assert `await expect(page.getByTestId("row")).toHaveCount(1)` (or filter+assert
"exactly the created row exists") before doing the Tab-based navigation, so a stale/leftover row
fails loudly with a clear message instead of surfacing as a confusing `toBeFocused()` mismatch on
an unrelated element.

### WR-02: Cleanup helpers swallow all errors, not just "already deleted"

**File:** `web/e2e/cross-phase-verification.spec.ts:42-47, 54-59, 80-86, 95-101`
**Issue:** `sweepFundosLeftovers`, `sweepTarefasLeftovers`, `tryDeleteFundo`, and
`tryDeleteTarefa` each wrap their CLI delete call in a bare `try { ... } catch { /* Already gone
-- fine. */ }`. The comment's justification only covers the "record already deleted" case, but the
catch has no way to distinguish that from a genuine failure (auth/network/API/schema error) — any
of those is silently swallowed the same way, which means a real regression in the delete path
would not fail this test, it would just leave orphaned `phase17-e2e-*` records behind for a future
run (or a future run's WR-01-style ordinal assumption) to trip over. This mirrors a pre-existing
convention used elsewhere in the suite (e.g. `entities-fundos.spec.ts`), so it's not a new pattern
introduced by this phase, but this file adds four more instances of it.
**Fix:** At minimum, log the caught error (e.g. `console.warn`) instead of a plain empty comment,
so a genuine failure is visible in CI output even though it doesn't fail the test outright; or
narrow the catch to the specific "not found" error shape the CLI returns.

## Info

### IN-01: `entity-error` / `entity-query-error` split has no test coverage on the new testid

**File:** `web/src/lib/entities/EntityScreen.svelte:478`
**Issue:** The rename to `entity-query-error` (17-01's fix) is structurally sound and consistent
(confirmed above), but no spec anywhere in `web/e2e/` asserts against `entity-query-error` —
the `query.error` branch (list-load failure) has zero live test coverage under either its old or
new testid. This isn't a regression introduced by this phase (the branch was equally untested
before the rename), but since this phase's own stated purpose is closing verification gaps, it's
worth noting: the fix removed a testid collision without adding a regression test that would catch
it being reintroduced.
**Fix:** Not required for this phase, but consider a follow-up spec asserting
`entity-query-error` renders when `db.useQuery` errors (e.g. via a temporarily invalid query shape
or a permission-denied fixture).

---

_Reviewed: 2026-08-10T21:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
