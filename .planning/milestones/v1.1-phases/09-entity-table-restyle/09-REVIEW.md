---
phase: 09-entity-table-restyle
reviewed: 2026-08-09T23:58:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - web/src/lib/entities/EntityScreen.svelte
  - web/e2e/entities-table-restyle.spec.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: clean
---

# Phase 9: Code Review Report

**Reviewed:** 2026-08-09T23:58:00Z
**Depth:** standard
**Files Reviewed:** 2 (hand-edited; shadcn-generated `ui/table/**` and `ui/badge/**` boilerplate spot-checked, no anomalies)
**Status:** has_findings (no blockers)

## Summary

Reviewed `EntityScreen.svelte`'s list-view restyle and the new `entities-table-restyle.spec.ts` against
the plan's claims, then independently re-verified rather than trusting the SUMMARY:

- Diffed `6e45177^..6e45177` directly: the `<table>`→`Table`/`<tr>`→`TableRow`/`<th>`→`TableHead`/
  `<td>`→`TableCell` swap is a faithful 1:1 markup substitution. Every `data-testid`
  (`entity-error`, `row`, `row-edit`, `row-delete`, `empty-state`, `entity-create-start`) sits on the
  exact same element it did before the restyle (row-level `TableRow`, not `TableCell`), and every
  `{#if config.capabilities.*}` guard is byte-identical in position and condition — confirmed by diff,
  not by narrative claim.
- Confirmed `isBadgeColumn`/`badgeVariantFor` are genuinely value-blind and never entity-special-cased:
  both functions dispatch purely on `columnName`/`field.kind`, with no `config.etype` branch anywhere.
  Cross-checked against all 9 entity defs (`fundos`, `tarefas`, `templatesRotina`, `instanciasRotina`,
  `tickets`, `etapas`, `projetos`, `subtarefas`, `logInferenciaClaude`) — no link label collides with
  the `status`/`tipoGeracao`/`tipoPrazo` allowlist, so the "name-only" allowlist never misfires against
  current data.
- Ran `bun run check` and `bun run lint` myself: 0 errors, 1 pre-existing unrelated warning, matching
  the SUMMARY's claim exactly.
- Diffed `web/package.json`/`web/bun.lock` across the exact Task-1 commit boundary
  (`6e45177^..6e45177`): empty — genuinely zero new npm dependency, not just asserted.
- Ran `entities-table-restyle.spec.ts` live against the real InstantDB app myself: 4/4 passed (the
  `authed` setup step plus all 3 new tests), confirming it is a real, unstubbed e2e spec, not a canned
  pass. Also re-ran `entities-fundos.spec.ts` (3/3), `entities-rotina-log.spec.ts` (4/4, including the
  `templatesRotina` Badge-wrapped `ativo`-column cell-text assertion), `entities-projeto-etapa-tarefa.spec.ts`
  + `entities-ticket-subtarefa.spec.ts` (8/8, covering `tarefas.tipoPrazo`'s select-Badge and
  `subtarefas.concluida`'s boolean-Badge) — 19 pre-existing/adjacent tests total, all green, live.

No BLOCKER-severity defects found. The implementation is a clean, disciplined, verifiably-truthful
markup swap. One WARNING and two INFO items below are worth tracking but do not block this phase.

## Warnings

### WR-01: `isBadgeColumn`'s name-based allowlist has no guard against a future link label collision

**File:** `web/src/lib/entities/EntityScreen.svelte:125-129`
**Issue:** `isBadgeColumn(columnName)` checks `config.fields.find(...)?.kind === "boolean"` first, but
falls back to `BADGE_COLUMN_NAMES.has(columnName)` (`"status"`/`"tipoGeracao"`/`"tipoPrazo"`)
unconditionally — it never confirms `columnName` actually resolves to a `fields` entry at all. Today
this is harmless: across all 9 entity defs, no `links`/`xorLink` choice is labeled `status`,
`tipoGeracao`, or `tipoPrazo` (verified by grep across `web/src/lib/entities/defs/*.ts`). But if a
future entity definition ever adds a link with one of those three labels (plausible — `status` is a
common relationship name), `isBadgeColumn` would silently wrap that link's resolved display label
(a linked record's name, via `columnValue`'s link-fallback branch) in a `Badge`, and
`badgeVariantFor` would fall through its `field` lookup (undefined) to the `columnName === "status"`
branch, rendering it `variant="secondary"` with no field-kind justification. This is a latent
design gap in the allowlist, not a bug against current data.
**Fix:** Require the field lookup to succeed for the boolean and status/tipoGeracao/tipoPrazo checks
alike:
```ts
function isBadgeColumn(columnName: string): boolean {
  const field = config.fields.find((f) => f.name === columnName);
  if (!field) return false; // links/xorLink choices are never Badge-worthy
  if (field.kind === "boolean") return true;
  return BADGE_COLUMN_NAMES.has(columnName);
}
```

**Resolved:** Applied exactly this fix in `web/src/lib/entities/EntityScreen.svelte:125-130`
(commit `0c47544`). Verified `bun run check` (0 errors, 1 pre-existing unrelated warning,
unchanged from before the fix), `bun run lint` (clean), and a live run of
`entities-table-restyle.spec.ts` + `entities-fundos.spec.ts` against the real InstantDB app
(6/6 passed, `authed` project) — all 9 entities' current Badge rendering is unchanged, since
none of their fields/links today collide with the name allowlist. This closes the latent gap
without altering any observed behavior.

## Info

### IN-01: `entities-table-restyle.spec.ts`'s Test 1 `finally` block isn't defensive per-record

**File:** `web/e2e/entities-table-restyle.spec.ts:106-109`
**Issue:** The `finally` block deletes `createdAtivo.id` then `createdInativo.id` with no per-call
`try`/`catch`. If the first `apolloCli(["fundo", "deletar", ...])` call throws, the second delete is
skipped, leaking `createdInativo` until a later run's `beforeEach`/`afterEach`
`sweepFundosLeftovers()` catches it by name prefix. In practice this self-heals (the surrounding
`beforeEach`/`afterEach` sweep — lines 57-65 — is prefix-based, not id-based, so it still cleans up
the orphan on the very next test run), so this is not a real leak risk, just a minor inconsistency
against `entities-fundos.spec.ts`'s own `afterEach`, which wraps each id-based delete in its own
`try`/`catch` (lines 60-64 of that file).
**Fix:** Wrap each delete independently for parity with the established pattern:
```ts
} finally {
  try { apolloCli(["fundo", "deletar", "--id", createdAtivo.id]); } catch {}
  try { apolloCli(["fundo", "deletar", "--id", createdInativo.id]); } catch {}
}
```

### IN-02: Test 2's seeded `instanciasRotina` fixture has no prefix-based sweep safety net

**File:** `web/e2e/entities-table-restyle.spec.ts:112-154`
**Issue:** Unlike the `fundos`/`logInferenciaClaude` tests in this same file, Test 2's seeded
`instanciasRotina` record relies solely on its own `finally { await deleteInstance(eid); }` for
cleanup — there is no `beforeEach`/`afterEach` sweep-by-`competencia`-prefix analogous to
`sweepFundosLeftovers`/`sweepLogLeftovers`. If the test process is killed between `seedInstance` and
the `finally` (e.g., CI timeout, forced kill), the seeded `phase09-e2e-competencia-...` record is
permanently orphaned in the live app with no automated recovery path. This exactly mirrors the
pre-existing precedent in `entities-rotina-log.spec.ts`'s WEB-07 test (same gap, same file family),
so it is not a regression introduced by this phase — noted for completeness/future hardening rather
than as a phase-9-specific defect.
**Fix:** Optional follow-up (not scoped to this phase): add a `sweepInstanciasRotinaLeftovers()`
helper that lists `instanciasRotina` via the admin fixture and deletes any record whose
`competencia` starts with `phase09-e2e-`/`phase04-e2e-`, wired into both specs' `beforeEach`/
`afterEach`.

---

_Reviewed: 2026-08-09T23:58:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
