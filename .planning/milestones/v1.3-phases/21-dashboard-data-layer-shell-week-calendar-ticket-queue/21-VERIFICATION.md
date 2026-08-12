---
phase: 21-dashboard-data-layer-shell-week-calendar-ticket-queue
verified: 2026-08-11T23:10:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 21: Dashboard Data Layer, Shell, Week Calendar & Ticket Queue Verification Report

**Phase Goal:** Users land on a real Dashboard screen driven by one aggregate query and a set of
pure, unit-tested derivation functions, seeing this week's 5-day business calendar and their
pending ticket queue — the first visible slice of the new landing experience.
**Verified:** 2026-08-11T23:10:00Z (fresh live run, not SUMMARY.md claims)
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP.md Phase 21 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `derive.ts` is pure (no `db` import, `hoje` as parameter), exports `semanaUtil`, `agendaPorDia`, `rotinasPorFundo`, `cargaDoMes`, `faixaHeatmap`, `progressoEtapa`, `vencido`, all unit-tested (DASH-06) | ✓ VERIFIED | `web/src/lib/dashboard/derive.ts` has zero `import` statements anywhere in the file (verified via `grep -n import`); all 7 named exports present at lines 51/63/111/137/160/260/377 (plus `tarefaConcluida`, an 8th supporting export). `derive.test.ts` has 8 `describe` blocks covering all 7 required exports + `tarefaConcluida`, 31 top-level `test()` calls. Live run: `bun test src` → **170 pass, 0 fail, 490 expect() calls**. |
| 2 | `dashboardQuery.ts` issues exactly one `db.useQuery` covering `projetos`/`tarefas`/`instanciasRotina.template.fundo`/`tickets`/`fundos`, no links added to `defs/instanciasRotina.ts`, no global store/cache (DASH-07) | ✓ VERIFIED | `DASHBOARD_QUERY` object in `dashboardQuery.ts` matches spec-ui.md §5.1's exact shape (`projetos:{fundo,etapas:{tarefas}}`, `tarefas:{etapa:{projeto},subtarefas}`, `instanciasRotina:{template:{fundo}}`, `tickets:{fundo,subtarefas}`, `fundos:{}`). `useDashboardQuery(db)` is the only call site; `Dashboard.svelte` is its only caller (grep-confirmed, no other Dashboard file calls `db.useQuery`). `web/src/lib/entities/defs/instanciasRotina.ts` read in full — no `template`/`fundo` link declared. No store/cache module exists under `web/src/lib/dashboard/`. Live proof: `dashboard.spec.ts`'s admin-API two-hop test AND the live UI two-hop rotina-rendering test both pass. |
| 3 | `Dashboard.svelte` mounts at the dashboard route (not in `registry.ts`), 3-column grid at `lg:` (tickets \| week+kanbans \| rotinas+heatmap) collapsing to 1 column below `lg` (DASH-01) | ✓ VERIFIED | `grep -n "Dashboard\|dashboard" web/src/lib/entities/registry.ts` → zero matches (not registered). `Shell.svelte` imports and mounts `<Dashboard />` directly on `rota.section === "dashboard"` (default route). `Dashboard.svelte`'s grid: `grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)_16rem] lg:grid-rows-[auto_1fr]`, tickets in col 1 (rows 1-2), week in col 2 row 1, rotinas+heatmap placeholder in col 3 (rows 1-2), projetos/kanban placeholder in col 2 row 2 — matches spec §3.1's layout exactly. Live e2e: desktop viewport confirms exactly 3 grid tracks with widths in `(200,216)`/`(248,264)` px ranges (13rem/16rem); mobile viewport confirms 1-column stacking in order semana→tickets→rotinas→projetos. |
| 4 | Central band shows exactly 5 weekday cards (Mon-Fri, ≤3 items + `+N`, left border by type, today highlighted `bg-muted`); Sat/Sun only via count-gated chip opening a popover (DASH-03) | ✓ VERIFIED | `WeekCalendar.svelte`: `{#each dias as dia}` renders exactly `dias.length` (=5, guaranteed by `semanaUtil`) day cards; `visibleItems = items.slice(0,3)`, `+{overflow} itens` row when `overflow>0`; `borderClassFor` maps tarefa→`border-foreground`, rotina→`border-muted-foreground`, ticket→`border-destructive`; today's header gets `bg-muted` conditionally on `dia === hojeIso`; weekend chip rendered only `{#if weekendCount > 0}`, opens `Popover.Content` listing weekend items. Live e2e (6 dedicated DASH-03 tests): tarefa rendering, hard-vs-soft ticket week-band filtering (soft excluded from week band but still in ticket queue), live two-hop rotina rendering, weekend chip (absent→appears→opens popover with correct item), today highlight (exactly one header has `bg-muted`), week navigation (prev/next shift 7 days, Hoje restores). All pass. |
| 5 | Left column lists pending tickets ordered hard-deadline-first then by date, each card clickable, empty state, "ver todos" link to Tickets section (DASH-02) | ✓ VERIFIED | `TicketQueue.svelte`'s `sorted` derivation: `tipoPrazo==="hard"` first, then `dataPrevista ?? dataRecebimento` ascending, then `id` — matches REQUIREMENTS.md §5.3's no-completion-filter decision and spec §3.2's ordering exactly. Every ticket renders as a real `<button data-testid="dash-ticket-card">` (keyboard-focusable; onclick-to-dialog wiring is explicitly Phase 23's scope per this phase's own documented decision — consistent with DLG-01/02/03 being Phase 23 requirements, not Phase 21's). Empty state uses `Empty.Root`/`Empty.Title` with "Nenhum ticket pendente". "ver todos" button drives `Shell.svelte`'s real, unmodified `nav-tickets` control via `.click()`. Live e2e: hard-first ordering + meta line + working nav-to-Tickets test, plus a dedicated empty-state test (`dash-tickets-empty` visible, 0 `dash-ticket-card`s). Both pass. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/lib/dashboard/derive.ts` | Pure derivation module, 7 exports | ✓ VERIFIED | Zero imports, all exports present, 31 unit tests pass |
| `web/src/lib/dashboard/derive.test.ts` | Unit test coverage for every export | ✓ VERIFIED | 8 describe blocks, 31 tests, all pass |
| `web/src/lib/dashboard/dashboardQuery.ts` | One `db.useQuery`, 5-key shape | ✓ VERIFIED | Exact spec §5.1 shape, zero runtime imports, `db` taken as param |
| `web/src/lib/dashboard/Dashboard.svelte` | 3-col/1-col grid shell, mounts sub-components | ✓ VERIFIED | Real grid, header/week-nav, mounts `WeekCalendar`/`TicketQueue`, live-queries via `useDashboardQuery(db)` |
| `web/src/lib/dashboard/WeekCalendar.svelte` | 5-day band, type borders, weekend chip | ✓ VERIFIED | All props-driven, no `db.useQuery` of its own |
| `web/src/lib/dashboard/TicketQueue.svelte` | Ordered ticket list, empty state, nav | ✓ VERIFIED | Props-driven, real sort, real Empty state |
| `web/e2e/dashboard.spec.ts` | Live Playwright coverage | ✓ VERIFIED | 11 tests, all pass live against hosted InstantDB |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Shell.svelte` | `Dashboard.svelte` | direct import + conditional mount on default route | ✓ WIRED | `import Dashboard from "./dashboard/Dashboard.svelte"`; `{#if rota.section === "dashboard"}<Dashboard />` with `rota` defaulting to `{ section: "dashboard" }` |
| `Dashboard.svelte` | `dashboardQuery.ts` | `useDashboardQuery(db)` | ✓ WIRED | Sole call site; result feeds `ticketRows()`/`dadosNormalizados`/`agenda` |
| `Dashboard.svelte` | `derive.ts` | `agendaPorDia`, `semanaUtil` | ✓ WIRED | Both imported and called with live query data + real `hojeIso` |
| `Dashboard.svelte` | `WeekCalendar.svelte` | props (`dias`/`agenda`/`hojeIso`/`sabado`/`domingo`) | ✓ WIRED | Mounted in `dash-week-slot`, all 5 props passed |
| `Dashboard.svelte` | `TicketQueue.svelte` | props (`tickets`/`onVerTodos`) | ✓ WIRED | Mounted in `dash-tickets-slot`, real ticket rows + real nav callback |
| `TicketQueue.svelte` | Tickets section | `onVerTodos` → `document.querySelector('[data-testid="nav-tickets"]').click()` | ✓ WIRED | Live e2e confirms `nav-tickets` becomes `aria-current="true"` after click |
| `dashboardQuery.ts` | InstantDB | `instanciasRotina.template.fundo` two-hop path | ✓ WIRED, data flows | Proven twice live: admin-API-level (Plan 21-02) and through the real rendered UI (Plan 21-03, Friday rotina item) |
| `defs/instanciasRotina.ts` | (absence of link) | N/A | ✓ CONFIRMED UNCHANGED | File read in full — no `template`/`fundo` link declared; `capabilities.create/delete` still `false` |
| `registry.ts` / `EntityScreen.svelte` / `Shell.svelte` | (untouched by Phase 21) | git history | ✓ CONFIRMED UNCHANGED | `git log` on `web/src/lib/entities/registry.ts`, `web/src/lib/entities/EntityScreen.svelte`, `web/src/lib/Shell.svelte` shows their most recent touches are Phase 20-05 / 18-02 / 18-01 respectively — no Phase 21 commit (`77f23f3`, `0444651`, `0ae7061`, `194043c`, `65e8db9`, `e67562b`, `8cecf28`, `93d40f0`, `0f7f9e8`, `898e3ef`) appears in either file's log |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `TicketQueue.svelte` | `tickets` prop | `Dashboard.svelte`'s `ticketRows()` ← `query.data.tickets` ← live `useDashboardQuery(db)` | Yes | ✓ FLOWING |
| `WeekCalendar.svelte` | `agenda` prop | `Dashboard.svelte`'s `agendaPorDia(dadosNormalizados, semana, hoje)` ← live query data | Yes | ✓ FLOWING |
| `Dashboard.svelte` | `dash-header-summary` (afazeres/atrasados counts) | `agenda` Map reduced over `semanaKeys` | Yes | ✓ FLOWING |
| `Dashboard.svelte` | `dash-placeholder-rotinas`/`dash-placeholder-projetos` | static "Em breve" text | N/A (deliberately out of Phase 21 scope — Phase 22's deliverable) | ⚠️ STATIC (expected, not a gap) |

### Behavioral Spot-Checks / Live Test Suites

| Suite | Command | Result | Status |
|-------|---------|--------|--------|
| Unit tests | `cd web && bun test src` | 170 pass, 0 fail, 490 expect() calls | ✓ PASS |
| TypeScript | `cd web && bun run check` | 917 files, 0 errors, 1 pre-existing unrelated warning (`EntityScreen.svelte:45`, Svelte 5 rune reactivity note, present before Phase 21) | ✓ PASS |
| Full e2e suite | `cd web && bun run test:e2e` | **104 passed, 0 failed (8.8 min)** — includes all 11 `dashboard.spec.ts` tests plus every pre-existing spec (shell-nav, projetos-section, tickets-section, rotinas-section, entities-*, routine-job*) | ✓ PASS |
| Lint | `cd web && bun run lint` | 3 errors (formatting/import-order only, in `derive.ts`, `derive.test.ts`, `ProjetosSection.svelte` — all files this phase created/touched), 1 unrelated pre-existing info-level hit (`calendar-caption.svelte`) | ⚠️ WARNING (see Anti-Patterns) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DASH-06 | 21-01 | Pure `derive.ts` with 7 named exports, unit-tested | ✓ SATISFIED | Code read + 170/170 unit tests pass |
| DASH-07 | 21-02 | Single `db.useQuery` in `dashboardQuery.ts`, no links added to `defs/instanciasRotina.ts` | ✓ SATISFIED | Code read + live admin/UI two-hop proofs |
| DASH-01 | 21-02, 21-03 | `Dashboard.svelte` mounts at route, not in registry, 3-col/1-col grid | ✓ SATISFIED | Code read + live responsive e2e |
| DASH-02 | 21-02 | Ticket queue ordering, empty state, "ver todos" | ✓ SATISFIED | Code read + live e2e |
| DASH-03 | 21-03 | 5 weekday cards, type borders, today highlight, weekend chip | ✓ SATISFIED | Code read + 6 dedicated live e2e tests |

No orphaned requirements: REQUIREMENTS.md's traceability table maps exactly DASH-06/07/01/02/03 to Phase 21, all 5 accounted for above. DASH-04/DASH-05 are correctly deferred to Phase 22 (not this phase's scope) and are not claimed as complete anywhere in Phase 21's plans/summaries.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `web/src/lib/dashboard/derive.ts` | 297 | Biome formatter diff (extra parens spacing) | ⚠️ Warning | Cosmetic only; `bun run check`/unit tests unaffected. Introduced by this phase's own new file. |
| `web/src/lib/dashboard/derive.test.ts` | ~282, ~440-457 | Biome formatter diff (object literal line-wrapping) | ⚠️ Warning | Cosmetic only; tests pass regardless. Introduced by this phase's own new file. |
| `web/src/lib/sections/ProjetosSection.svelte` | 2-18 | `assist/source/organizeImports` — import block out of sorted order (the `../dashboard/derive` import line added by this phase's Task 1 repoint sits out of alphabetical position) | ⚠️ Warning | Cosmetic only; `bun run check` and both Projetos e2e suites (21/21) pass regardless. |
| `web/src/lib/dashboard/Dashboard.svelte` | 233, 239 | `dash-placeholder-rotinas`/`dash-placeholder-projetos` static "Em breve" text | ℹ️ Info | Explicitly out of Phase 21 scope (Phase 22's deliverable per ROADMAP.md); not a stub within any of Phase 21's 5 success criteria. |

None of these rise to blocker severity: no TBD/FIXME/XXX debt markers anywhere in `web/src/lib/dashboard/`; the 3 lint findings are pure Biome formatter/import-order diffs (no behavior change, `bun run check` is 0 errors, all 170 unit + 104 e2e tests pass). They do, however, represent a **regression from Phases 18/19/20's demonstrated 0-lint-error baseline** and should be cleaned up (a single `biome check --write` on the 3 named files would resolve them) — flagged here for visibility, not blocking this phase's goal achievement since none of the 5 roadmap Success Criteria concern lint cleanliness and the phase's own PLAN.md verification blocks never gated on `bun run lint`.

### Human Verification Required

None. All 5 roadmap Success Criteria for Phase 21 are independently verified against the live codebase via direct reads of `derive.ts`, `derive.test.ts`, `dashboardQuery.ts`, `Dashboard.svelte`, `WeekCalendar.svelte`, `TicketQueue.svelte`, `registry.ts`, `defs/instanciasRotina.ts`, `Shell.svelte`, plus fresh live execution of the full test suite in this verification session (`bun test src`, `bun run check`, `bun run lint`, `bun run test:e2e` — unit/typecheck/e2e all green; lint flagged as a non-blocking warning above).

### Gaps Summary

No gaps block the phase goal. All 5 ROADMAP.md Success Criteria (derive.ts purity + 7 exports + unit tests; single dashboardQuery.ts with no defs/instanciasRotina.ts links; Dashboard.svelte's 3-col/1-col grid shell outside the registry; the 5-weekday band with type borders/today-highlight/weekend chip; the ordered ticket queue with empty state and working "ver todos") are verified against the live, running codebase — not SUMMARY.md narrative. `EntityScreen.svelte`, `registry.ts`, and `Shell.svelte` are confirmed untouched by any Phase 21 commit. The one non-blocking item worth tracking forward is the 3-error lint regression (formatting/import-order only) in `derive.ts`/`derive.test.ts`/`ProjetosSection.svelte` — recommend a quick `biome check --write` pass before or alongside Phase 22's work to restore the project's established 0-lint-error baseline.

---

_Verified: 2026-08-11T23:10:00Z_
_Verifier: Claude (gsd-verifier)_
