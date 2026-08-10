---
phase: 14-entity-screen-header-loading-empty-states
verified: 2026-08-10T15:30:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 14: Entity Screen — Header, Loading & Empty States Verification Report

**Phase Goal:** Every entity screen presents a proper page header, a content-shaped loading state, and a composed empty state, with the table visually bounded — for all 9 entities across all 3 capability classes.
**Verified:** 2026-08-10T15:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every entity screen's `entity-header` row shows `config.titulo` in a single `<h2>`, a non-empty `entity-description`, and a right-aligned `entity-create-start` when `capabilities.create` is true — above the content | ✓ VERIFIED | `EntityScreen.svelte:387-397`; `grep -c '<h2' → 1`; live test `ENTTBL-04: fundos … light + dark` asserts `justify-content: space-between`, single `<h2>` with text "Fundos", non-empty description, and `frameBox.y > headerBox.y` (header physically above content) — passed |
| 2 | While `query.isLoading`, the screen renders a Skeleton grid (`entity-loading`) shaped to `listColumns.length + 1` columns x 5 rows; the old plain-text placeholder never renders | ✓ VERIFIED | `EntityScreen.svelte:406-415`; live test `ENTTBL-05: fundos loading state …` uses a CDP-throttled fresh context (query cache cleared) to force a genuine network round-trip, observes `entity-loading` visible with ≥1 `.animate-pulse` child, and asserts `getByText(/carregando/i)` count is 0 throughout — passed |
| 3 | Zero-record entities render an `Empty` composition (`empty-state`: icon+title+description+capability-gated `empty-state-create` reusing `startCreate`) as a sibling of `<Table>`, never nested in `<TableBody>` | ✓ VERIFIED | `EntityScreen.svelte:424-444` — fork happens inside `CardContent`, above `<Table>`, as an `{:else}` sibling; live test `ENTTBL-06: fundos empty state is a sibling of <Table> …` asserts `empty-state` visible, `getByRole("table")` count 0 while shown, CTA click opens the same `field-nome` Dialog `entity-create-start` opens, cancel leaves zero side effects — passed |
| 4 | The Table (or Empty) always renders inside a single bounded `entity-table-frame` Card, for all 9 entities | ✓ VERIFIED | `EntityScreen.svelte:422-497` (`<Card data-testid="entity-table-frame"><CardContent>…</CardContent></Card>`); live test `ENTTBL-07: every one of the 9 entities' content renders inside entity-table-frame` clicks all 9 `[data-testid^="nav-"]` buttons and asserts `role="table"` + `empty-state` count ≥1 inside the frame each time — passed |
| 5 | Every pre-existing load-bearing testid (`entity-error`, `row`, `row-edit`, `row-delete`, `empty-state`, `entity-create-start`) still resolves to the expected count, with zero capability-gating regression across all 3 classes | ✓ VERIFIED | Static grep: `entity-error`=2 (formError + query.error branches, mutually exclusive, unchanged from pre-phase), `row`=1, `row-edit`=1, `row-delete`=1, `empty-state`=1, `entity-create-start`=1. Live suite: `entities-table-restyle.spec.ts` (fundos/instanciasRotina/logInferenciaClaude), `entities-rotina-log.spec.ts`, `entities-form-restyle.spec.ts` all pass unmodified |
| 6 | `handleDelete`'s `window.confirm(...)` and all capability/business logic remain byte-identical — markup/structure-only change | ✓ VERIFIED | `grep -c 'window.confirm' → 1`; `handleSubmit`/link/xorLink logic (lines 246-369) untouched; live CRUD specs (fundos, projetos, etapas, tarefas, tickets, subtarefas, templatesRotina, instanciasRotina, logInferenciaClaude) all pass |
| 7 (ROADMAP SC1) | Page-header row (title+description+right-aligned "novo") above table, replacing below-table action | ✓ VERIFIED | Same as #1; below-table Button location removed, `entity-create-start` has exactly 1 source occurrence |
| 8 (ROADMAP SC2) | Loading uses Skeleton shaped like real rows, not plain "carregando..." text | ✓ VERIFIED | Same as #2 |
| 9 (ROADMAP SC3/SC4) | Empty composition reuses create action; table bounded in Card across all 9 entities | ✓ VERIFIED | Same as #3/#4 |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/lib/entities/types.ts` | `descricao: string` required field on `EntityConfig` | ✓ VERIFIED | Present, documented, required (enforced by `bun run check`) |
| `web/src/lib/entities/defs/*.ts` (9 files) | Each populated with an entity-specific `descricao` | ✓ VERIFIED | `grep -rl 'descricao:' defs/*.ts \| wc -l` → 9 |
| `web/src/lib/entities/EntityScreen.svelte` | Header/loading/empty/Card restructuring | ✓ VERIFIED | All testids present exactly once (except `entity-error`=2 by design), substantive markup, wired to `startCreate`/`rowsOf`/`config` |
| `web/src/lib/components/ui/skeleton/` | Vendored shadcn Skeleton primitive | ✓ VERIFIED | Real component (`animate-pulse`, `cn`-composed classes), not a stub; used by `EntityScreen.svelte` |
| `web/src/lib/components/ui/empty/` | Vendored shadcn Empty composition (Root/Header/Media/Title/Description/Content) | ✓ VERIFIED | 6 substantive component files, all wired via `* as Empty` import and used in `EntityScreen.svelte` |
| `web/e2e/entities-header-states.spec.ts` | 6 dedicated live tests for ENTTBL-04/05/06/07 | ✓ VERIFIED | File exists, 6 tests present, all 6 pass live against the app (confirmed by this session's own run) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Empty.Content`'s `empty-state-create` Button | `startCreate()` | `onclick={startCreate}` | ✓ WIRED | Same function reference as header's `entity-create-start`; live test clicks `empty-state-create` and confirms `field-nome` Dialog opens |
| `{#if rowsOf().length === 0}` fork | `CardContent` (not `<TableBody>`) | Structural placement | ✓ WIRED | Confirmed by source read (lines 424-495) and live `getByRole("table")` count-0 assertion while Empty is shown |
| `Dialog.Root` | Always-render sibling, decoupled from `query.isLoading`/`query.error` | Structural placement (line 500, sibling to the loading/error/success conditional) | ✓ WIRED | Confirmed by source; live CRUD specs across all capability classes exercise the Dialog successfully |
| `EntityScreen.svelte` | 9 entity defs' `descricao` | `config.descricao` interpolation | ✓ FLOWING | `entity-description` renders each entity's own copy; live test confirms non-empty text for fundos/instanciasRotina/logInferenciaClaude |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `entity-description` | `config.descricao` | Per-entity def file (static, developer-authored, not a query) | Yes — real, non-empty per-entity string, intentionally static per plan design | ✓ FLOWING |
| `entity-table-frame` content | `rowsOf()` | `db.useQuery(buildQuery(config))` (live InstantDB) | Yes | ✓ FLOWING |
| `entity-loading` | `query.isLoading` | Same live `db.useQuery` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks / Live Test Run

This session independently re-ran the full Playwright suite (not trusting the SUMMARY's reported counts):

```
cd web && bun run test:e2e
```

Result: **50 passed, 0 failed, 0 skipped (4.4m)**, including:
- All 6 new `entities-header-states.spec.ts` tests (ENTTBL-04 x3 capability classes + light/dark, ENTTBL-05 loading, ENTTBL-06 empty/CTA, ENTTBL-07 all-9-entities Card-bounding)
- All 3 `entities-table-restyle.spec.ts` capability-class tests (fundos full-CRUD, instanciasRotina restricted, logInferenciaClaude read-only)
- All pre-existing CRUD specs for every remaining full-CRUD entity (projetos, etapas, tarefas, templatesRotina, tickets, subtarefas)
- `shell-nav.spec.ts` (all-9-entities `<h2>` contract), `shell-chrome.spec.ts`, `design-system.spec.ts`, `login-flow.spec.ts`, `no-leakage.spec.ts`, `routine-job*.spec.ts`, `auth.spec.ts`

Also independently re-ran:
- `bun run check` → 0 errors (1 pre-existing unrelated warning on `configProp` local-capture, not introduced by this phase)
- `bun run lint` (Biome) → exit 0, 0 errors (11 pre-existing warnings/1 info in unrelated files — `shell-chrome.spec.ts` non-null-assertion style suggestions — zero from any file this phase touched)
- Raw color literal grep (`oklch(`/hex/`rgba(`) across `EntityScreen.svelte`, all 9 `defs/*.ts`, `types.ts`, `entities-header-states.spec.ts` → 0 matches
- `find web/src/lib/entities -maxdepth 1 -name "*.svelte" | wc -l` → 1 (no stray sibling component file introduced)
- `git status --short` inside `web/` → clean (no uncommitted phase-14 code changes)

### Capability-Class Spot-Check (explicitly requested)

| Capability class | Entity | Evidence |
|---|---|---|
| Full-CRUD | fundos | `ENTTBL-04: fundos … light + dark` (header+create action present), `ENTTBL-05` (loading), `ENTTBL-06` (empty+CTA), `entities-fundos.spec.ts` WEB-02 full CRUD round trip — all pass |
| Restricted | instanciasRotina | `ENTTBL-04: instanciasRotina … create action capability-gated off` (`entity-create-start` count 0, header/description still render), `entities-rotina-log.spec.ts` WEB-07 (no create, no delete, status-only edit) — all pass |
| Read-only | logInferenciaClaude | `ENTTBL-04: logInferenciaClaude … create action capability-gated off`, `entities-rotina-log.spec.ts` WEB-09 (pure read-only table) — all pass |

Zero regression confirmed across all 3 classes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ENTTBL-04 | 14-01, 14-02 | Page-header row (title+description+right-aligned "novo") | ✓ SATISFIED | `entity-header`/`entity-description`/`entity-create-start` present, wired, tested live across 3 capability classes + 2 color schemes |
| ENTTBL-05 | 14-01, 14-02 | Skeleton-shaped loading state | ✓ SATISFIED | `entity-loading` Skeleton grid, genuinely observed via CDP-throttled live test, old plain-text indicator confirmed absent |
| ENTTBL-06 | 14-01, 14-02 | Empty icon/title/description/CTA composition reusing create action | ✓ SATISFIED | `empty-state`/`empty-state-create` sibling-of-Table, CTA reuses `startCreate`, live-tested |
| ENTTBL-07 | 14-01, 14-02 | Table visually bounded in Card | ✓ SATISFIED | `entity-table-frame` Card, live-tested across all 9 entities |

No orphaned requirements — REQUIREMENTS.md maps exactly ENTTBL-04/05/06/07 to Phase 14, and all 4 are claimed and covered by the two plans.

### Anti-Patterns Found

None. Grep sweep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and "coming soon/not yet implemented/not available" across `EntityScreen.svelte`, all 9 `defs/*.ts`, `types.ts`, and `entities-header-states.spec.ts` returned zero matches. Vendored `Skeleton`/`Empty` components are substantive shadcn-svelte primitives (17-41 lines each, real class composition via `cn()`), not stubs.

### Human Verification Required

None. Every truth was verified against live, independently-re-run Playwright evidence (not trusted from SUMMARY.md), plus static structural/grep checks. No visual-judgment-only claim was left unverified — the header/description/Skeleton/Empty/Card structural claims are all covered by concrete DOM/testid/bounding-box/`getComputedStyle` assertions in the re-run suite.

### Gaps Summary

None. All 9 must-haves (6 from 14-01's frontmatter, 3 additional 14-02/dedicated-coverage must-haves folded into the same truth set, plus the 4 ROADMAP success criteria) verified against actual code and a live, independently re-run Playwright suite (50/50 passed, 0 skipped), live `bun run check` (0 errors) and `bun run lint` (0 errors). No regression found across any of the 3 capability classes or any of the 9 entities.

---

_Verified: 2026-08-10T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
