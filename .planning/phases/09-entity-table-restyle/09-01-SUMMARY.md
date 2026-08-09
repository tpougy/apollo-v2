---
phase: 09-entity-table-restyle
plan: 01
subsystem: ui
tags: [shadcn-svelte, svelte5, table, badge, playwright, instantdb, tailwind]

# Dependency graph
requires:
  - phase: 08-auth-shell-restyle
    provides: shadcn-svelte Button primitive (`web/src/lib/components/ui/button`), Phase 8's plain-named-import convention followed here for Table/Badge/Button usage
provides:
  - shadcn Table component group (`web/src/lib/components/ui/table/`) — 8 sub-components + index.ts, zero new npm dependency
  - shadcn Badge component (`web/src/lib/components/ui/badge/`) — zero new npm dependency (tailwind-variants already satisfied)
  - EntityScreen.svelte list-view restyled onto Table/Badge/Button markup, capability guards and every testid preserved verbatim, across all 9 domain entities
  - Column-name-allowlist Badge mapping (isBadgeColumn/badgeVariantFor) — value-blind, never per-entity special-cased
  - entities-table-restyle.spec.ts — new live Playwright spec proving ENTTBL-01/02/03 across one entity per capability class (fundos, instanciasRotina, logInferenciaClaude)
affects: [10-entity-form-restyle, 11-final-verification]

# Actuals (#2632)
actuals:
  tokens: 5306
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Column-name allowlist for Badge rendering (status/tipoGeracao/tipoPrazo + boolean kind), value-blind, applied identically across all 9 entities"
    - "1:1 tag-to-component swap (table→Table, tr→TableRow, th→TableHead, td→TableCell) preserving every data-testid/data-eid attribute and {#if capabilities.*} guard byte-identical"

key-files:
  created:
    - web/src/lib/components/ui/table/table.svelte
    - web/src/lib/components/ui/table/table-header.svelte
    - web/src/lib/components/ui/table/table-body.svelte
    - web/src/lib/components/ui/table/table-row.svelte
    - web/src/lib/components/ui/table/table-head.svelte
    - web/src/lib/components/ui/table/table-cell.svelte
    - web/src/lib/components/ui/table/table-caption.svelte
    - web/src/lib/components/ui/table/table-footer.svelte
    - web/src/lib/components/ui/table/index.ts
    - web/src/lib/components/ui/badge/badge.svelte
    - web/src/lib/components/ui/badge/index.ts
    - web/e2e/entities-table-restyle.spec.ts
  modified:
    - web/src/lib/entities/EntityScreen.svelte

key-decisions:
  - "tipoPrazo is Badge-worthy by column name across ALL entities (including instanciasRotina, where it's kind:\"text\" not \"select\") — matches ROADMAP SC#2's literal example list, per 09-RESEARCH.md Pitfall 2"
  - "status columns always render variant=\"secondary\" regardless of free-text value — no keyword-matching color logic invented, per C-11's \"não precisa inventar moda\" intent"
  - "Row-edit uses variant=\"outline\", row-delete uses variant=\"destructive\", both size=\"sm\" — a discretionary but functionally-inert choice (ENTTBL-01 only requires shadcn Button, no variant specified)"

patterns-established:
  - "Pattern 2 (09-PATTERNS.md): isBadgeColumn()/badgeVariantFor() column-name allowlist — the canonical way any future entity/column gets Badge treatment without per-entity special-casing"

requirements-completed: [ENTTBL-01, ENTTBL-02, ENTTBL-03]

coverage:
  - id: D1
    description: "All 9 entity screens render list-view rows inside shadcn Table markup (native <table>, role=table) from a live InstantDB query, row count matching query result"
    requirement: "ENTTBL-01"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-table-restyle.spec.ts#ENTTBL: fundos (full-CRUD)"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-fundos.spec.ts#WEB-02: full browser CRUD round trip"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-table-restyle.spec.ts#ENTTBL: instanciasRotina (restricted)"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-table-restyle.spec.ts#ENTTBL: logInferenciaClaude (read-only)"
        status: pass
    human_judgment: false
  - id: D2
    description: "status/tipoGeracao/tipoPrazo/boolean columns render as shadcn Badge, fundos shows 2+ distinct Badge values simultaneously"
    requirement: "ENTTBL-02"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-table-restyle.spec.ts#ENTTBL: fundos (full-CRUD) — Badge sim/não assertion"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-rotina-log.spec.ts#WEB-06: templatesRotina full CRUD"
        status: pass
    human_judgment: false
  - id: D3
    description: "Row-level edit/delete render as shadcn Button; fundos full-CRUD round trip (create/edit/boolean-toggle/delete) still works identically post-restyle"
    requirement: "ENTTBL-01"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-fundos.spec.ts#WEB-02: full browser CRUD round trip"
        status: pass
    human_judgment: false
  - id: D4
    description: "instanciasRotina shows zero create action and only a status-narrowed edit action (zero delete); logInferenciaClaude shows zero row actions of any kind, post-restyle"
    requirement: "ENTTBL-03"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-table-restyle.spec.ts#ENTTBL: instanciasRotina (restricted)"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-table-restyle.spec.ts#ENTTBL: logInferenciaClaude (read-only)"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-rotina-log.spec.ts#WEB-07/WEB-09"
        status: pass
    human_judgment: false
  - id: D5
    description: "No new npm dependency introduced by shadcn-svelte add table badge; full pre-existing e2e suite + check + lint remain clean"
    verification:
      - kind: other
        ref: "git diff web/package.json web/bun.lock (empty)"
        status: pass
      - kind: e2e
        ref: "bun run test:e2e (34/34 passed)"
        status: pass
      - kind: other
        ref: "bun run check (0 errors, 1 pre-existing warning)"
        status: pass
      - kind: other
        ref: "bun run lint (0 errors)"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-08-09
status: complete
---

# Phase 9 Plan 1: Entity Table Restyle Summary

**EntityScreen.svelte's list-view restyled onto shadcn Table/Badge/Button across all 9 domain entities via a value-blind column-name-allowlist, zero new npm dependency, zero testid/capability regression — proven live against InstantDB.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-08-09T23:32:09Z
- **Completed:** 2026-08-09T23:48:00Z
- **Tasks:** 3 (tracer + 2 auto)
- **Files modified:** 13 (11 created shadcn component files, 1 modified EntityScreen.svelte, 1 new e2e spec)

## Accomplishments

- Installed shadcn `Table` (8 sub-components) and `Badge` via `bunx shadcn-svelte@latest add table badge -y` — confirmed zero `package.json`/`bun.lock` change (both are dependency-free local file generations; `tailwind-variants` was already satisfied since Phase 8)
- Restyled `EntityScreen.svelte`'s list-view (`<table>`→`Table`, `<tr>`→`TableRow`, `<th>`→`TableHead`, `<td>`→`TableCell`) 1:1, preserving every `data-testid`/`data-eid` attribute and every `{#if config.capabilities.*}` capability guard byte-identical, across all 9 entities driven by the same generic, config-based renderer
- Added `isBadgeColumn()`/`badgeVariantFor()` — a value-blind, column-name-allowlist (`status`/`tipoGeracao`/`tipoPrazo` + any `kind:"boolean"` field) that wraps Badge-worthy cell values in shadcn `Badge`, never per-entity special-cased
- Converted the three plain `<button>` row/create actions (`row-edit`, `row-delete`, `entity-create-start`) to shadcn `Button`, preserving `onclick` and capability gating verbatim
- Wrote `entities-table-restyle.spec.ts`: 3 new live Playwright tests proving ENTTBL-01/02/03 across one entity per capability class (fundos full-CRUD, instanciasRotina restricted, logInferenciaClaude read-only)
- Ran the entire pre-existing `web/e2e/` suite (34 tests) plus the new spec in one green run against the live InstantDB app, plus `bun run check` and `bun run lint`, both clean with zero new suppressions

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Install shadcn Table/Badge and restyle EntityScreen.svelte's list-view end-to-end** - `6e45177` (feat)
2. **Task 2: New Wave-0 spec proving ENTTBL-01/02/03 across all three capability classes** - `fdaf478` (test)
3. **Task 3: Full-suite regression and quality-gate proof** - verification-only, no files modified, no commit (per plan's `<files>none</files>`)

## Files Created/Modified

- `web/src/lib/components/ui/table/table.svelte` + 7 sibling sub-components + `index.ts` - shadcn Table primitive, generated by `bunx shadcn-svelte add table`, zero new npm dependency
- `web/src/lib/components/ui/badge/badge.svelte` + `index.ts` - shadcn Badge primitive, generated by `bunx shadcn-svelte add badge`, zero new npm dependency
- `web/src/lib/entities/EntityScreen.svelte` - list-view markup (lines ~343-389) restyled onto Table/Badge/Button; script block and create/edit `<form>` (Phase 10 scope) left byte-identical
- `web/e2e/entities-table-restyle.spec.ts` - new spec: 3 tests proving ENTTBL-01/02/03 live across fundos/instanciasRotina/logInferenciaClaude

## Decisions Made

- `tipoPrazo` is Badge-worthy by column **name** across all entities, including `instanciasRotina` where it's declared `kind:"text"` (not `"select"` like `tarefas`/`tickets`) — matches ROADMAP SC#2's literal example list and avoids the "silently no Badge" pitfall 09-RESEARCH.md flagged
- `status` columns always render `variant="secondary"` regardless of free-text value — no keyword-matching color logic was invented (e.g. no "concluído"→green, "atrasado"→red), consistent with C-11's "não precisa inventar moda" intent
- Row-edit uses `variant="outline"`, row-delete uses `variant="destructive"`, both `size="sm"` — a discretionary but functionally-inert styling choice (ENTTBL-01 only requires "shadcn Button", no variant specified)

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed as specified, all `<verify>` commands ran for real and passed, no Rule 1-4 auto-fixes were needed.

One transient environmental flake was investigated during Task 3 (see Issues Encountered below) but required no code change — the flaky test is in `login-flow.spec.ts` (Phase 8's auth flow), a file this plan never touches.

## Issues Encountered

- The first full-suite run (`bun run test:e2e`) hit one failure: `login-flow.spec.ts:42:1 › submitting a deliberately wrong code renders the destructive Alert`, which timed out waiting for a new magic-code email (45s timeout). This test is entirely unrelated to this plan's scope (Phase 8 auth flow, never touches `EntityScreen.svelte`/Table/Badge/Button) and is documented in PROJECT.md C-10 as depending on real, sometimes-delayed email delivery with a tight ~60-90s expiry window. Re-ran the isolated spec twice: it passed both times. Re-ran the complete `bun run test:e2e && bun run check && bun run lint` chain once more in full — all 34 tests passed cleanly in a single run, confirming the original failure was a transient live-email/mailbox-polling flake, not a regression introduced by this phase's changes.

## Verification Results (final clean run)

- `cd web && bunx playwright test e2e/entities-fundos.spec.ts --project=authed` → **3/3 passed** (Task 1 tracer gate — full CRUD + boolean Badge round trip on fundos, live)
- `cd web && bunx playwright test e2e/entities-table-restyle.spec.ts --project=authed` → **4/4 passed** (setup + 3 new tests — Task 2)
- `cd web && bun run test:e2e && bun run check && bun run lint` → **34/34 e2e tests passed** (3.6m), `bun run check`: 0 errors / 1 pre-existing warning (unrelated to this plan, present before and after), `bun run lint`: 0 errors (Task 3)
- `git diff web/package.json web/bun.lock` → empty (zero new npm dependency)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 10 (Entity Form Restyle) can proceed: the create/edit `<form>` block (lines 391-529) and the script block were left completely untouched this phase, exactly as scoped — `editableFields()`, `startCreate`/`startEdit`/`handleSubmit`/`handleDelete`, and all capability-narrowing logic (`updatableFields`) are unaffected and ready for Phase 10's Dialog/Sheet conversion.
- All 9 entities' list-view now render through the shared shadcn Table/Badge/Button primitives; no per-entity markup exists anywhere, so Phase 10's form work has zero list-view coupling to worry about.
- No blockers or concerns carried forward.

---
*Phase: 09-entity-table-restyle*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created files verified present on disk; both task commits (`6e45177`, `fdaf478`) verified present in git history.
