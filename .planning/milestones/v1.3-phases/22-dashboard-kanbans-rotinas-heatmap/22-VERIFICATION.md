---
phase: 22-dashboard-kanbans-rotinas-heatmap
verified: 2026-08-12T01:15:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 22: Dashboard Kanbans, Rotinas & Heatmap Verification Report

**Phase Goal:** Users see every in-progress project as a mini-kanban strip that never
compresses, this week's routines grouped by fundo with working display controls, and a full
month's workload heatmap using only the project's existing grayscale tokens — completing the
Dashboard's content.
**Verified:** 2026-08-12
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each in-progress project renders as its own strip with columns = etapas ordered by `ordem` asc and cards = that etapa's tasks, capped at 3 per column with a `+N` overflow indicator | ✓ VERIFIED | `ProjectStrips.svelte` lines 40-42 (`filtroEmAndamento`/sort), 143 (`etapasOrdenadas.sort((a,b)=>a.ordem-b.ordem)`), 192/216-219 (`tarefas.slice(0,3)` + `+{overflowCount} tarefas`). Live e2e: `dashboard-kanbans.spec.ts` "header meta, equal fixed-width AND equal-height columns... 3+1 overflow split" — a 4-tarefa etapa shows exactly 3 cards + "+1 tarefas", a 1-tarefa etapa shows 1 card + 0 overflow rows. PASSED. |
| 2 | Kanban columns keep a fixed width and never compress regardless of column count; a strip with more columns than fit scrolls horizontally; the `›` continuation indicator sits outside the layout flow, appears only when `scrollWidth` measurably exceeds `clientWidth`, never for a project that fits | ✓ VERIFIED | Code: column class is literally `w-36 shrink-0 box-border` (line 185); strip body is `relative overflow-x-auto [scroll-snap-type:x_proximity]` (175); indicator is `absolute right-0 top-0 bottom-0 ... pointer-events-none` (225-231), rendered only when `overflowingByProjeto[projeto.id]` is true, itself driven by a real `ResizeObserver` callback that reads `stripEl.scrollWidth > stripEl.clientWidth` fresh on every fire (never `entry.contentRect`) (92-122). Live e2e proof, not inferred from source alone: a bounding-box equality check shows a 4-card column and a 1-card column in the same strip have **identical width AND identical height** despite different content (`col1.boundingBox().width === col2.boundingBox().width`, same for height). A separate test forces a 480×800 viewport with a 6-etapa project — its overflow indicator becomes visible — while a 1-etapa project's indicator never appears. Both PASSED live against the running app. |
| 3 | A project strip's collapse state persists across reload via the `localStorage` key `apollo.dash.collapsed.<projetoId>` only, touching no other key | ✓ VERIFIED | Code: `collapsedKey()` (53-55), `readCollapsed`/`writeCollapsed` (57-65) touch exactly that one key shape; `grep -rn localStorage web/src/lib/dashboard/` shows the pattern used nowhere else in the dashboard module tree. Live e2e: after collapsing, `localStorage.getItem('apollo.dash.collapsed.<id>')` reads `"true"`, and a scan of every localStorage key matching `apollo.dash.collapsed.` returns count `1`; after `page.reload()` the collapsed state survives; toggling back to expanded writes `"false"` to the same key. PASSED. |
| 4 | Routine instances are grouped into light/transparent cards by fundo (up to 4 + `+N`), "Sem fundo vinculado" always last, functional (client-side) agrupar/ordenar/status controls visible and operative | ✓ VERIFIED | Code: card class is `rounded border bg-card/60 p-3` (never solid `Card`) (117-121); `rotinasPorFundo` (unmodified from Phase 21) already sorts the null-fundo group last, and `RoutinesByFundo.svelte` never re-sorts the top-level `grupos` array (only each group's own `instancias`, lines 40-51), preserving that guarantee; `visiveis = grupo.displayed.slice(0,4)` + `+{overflow}` (115-116, 155-163). Three real `Select.Root` controls (agrupar/ordenar/status) re-filter/re-sort client-side with zero new query. Live e2e: 7 passing tests in `dashboard.spec.ts` ("DASH-04: rotinas by fundo") prove grouping order, 4-row cap+overflow, `vencido()`-driven bolinha (never a status string), `template.nome` label, `status: atrasadas` filtering, `ordenar` reversal, and that all 3 controls are real wired `Select.Root` triggers. PASSED. |
| 5 | The monthly heatmap renders a 7-column grid with exactly 5 fixed intensity bands (0/1-2/3-4/5-7/8+) using only spec §6 tokens (no new color), weekend cells at `bg-muted/40`, with a visible legend | ✓ VERIFIED | Code: `grid grid-cols-7 gap-1` (52), `faixaHeatmap` bands verified in `derive.ts` (`n<=0→0, <=2→1, <=4→2, <=7→3, else→4`) match spec exactly; `FAIXA_CLASSES` uses only `bg-muted`, `bg-chart-1/40`, `bg-chart-2/70`, `bg-chart-4`, `bg-destructive` (plus dark: swaps `chart-5`/`chart-4`/`chart-2`) — every one of these tokens is defined in `web/src/app.css`; weekend cells always render `bg-muted/40` overriding the computed band (line 65); a "tranquilo → carregado" legend renders unconditionally (69-80). Live e2e: 4 passing tests confirm exact `FAIXA_CLASSES` strings per band, weekend override with zero visible digits, always-visible legend, and every cell resolving to a real `<button>` tagName. PASSED. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Special-Rigor Checks (kanban-column-compression, the phase's namesake risk)

| Check | Method | Result |
|-------|--------|--------|
| Columns are genuinely fixed-width, never compress | Read actual CSS classes in `ProjectStrips.svelte` (not the SUMMARY's prose) | `w-36 shrink-0 box-border` on every column — `shrink-0` explicitly disables flex-shrink, so no column can compress regardless of sibling count. Confirmed by a live `boundingBox()` equality assertion across a 4-card and a 1-card column in the same strip (both width AND height identical). |
| Overflow `›` indicator uses real `ResizeObserver`-based measurement, not inferred logic | Read the `$effect` in `ProjectStrips.svelte` (89-122) | A `ResizeObserver` is constructed and attached to both the scrolling container and its inner unconstrained row; the callback re-reads `stripEl.scrollWidth`/`stripEl.clientWidth` live on every fire — it never reads `entry.contentRect` or infers from a static column count. Live e2e forces a narrow (480px) viewport: a 6-etapa project's indicator becomes visible, a 1-etapa project's never does. |
| localStorage touches only the one documented key | grep across `web/src/lib/dashboard/` + live e2e key-count assertion | Only `apollo.dash.collapsed.<projetoId>` is ever read or written; e2e counts localStorage keys matching that prefix and asserts exactly `1` after a toggle. |
| Heatmap uses exactly the 5 §6 tokens, no new color/hex | grep for hex literals in the 3 new components; cross-checked every class name against `web/src/app.css`'s actual `@theme` block | Zero hex literals found. One documented, verified-correct deviation from spec §6's literal table: band 4's text color uses `text-background` instead of the spec table's `text-destructive-foreground` — confirmed independently that `--destructive-foreground`/`--color-destructive-foreground` does not exist anywhere in `app.css` (only `--destructive` is defined), so following the literal table would violate spec principle §0.1 ("toda cor sai de token semântico já definido"). `text-background` is an existing, already-used token; this is the correct resolution of an internal spec inconsistency, not a fabricated color. |
| Routines group by fundo with "Sem fundo vinculado" last and functional controls | Read `RoutinesByFundo.svelte` + `derive.ts`'s unmodified `rotinasPorFundo`; live e2e | Component never re-sorts the top-level `grupos` array (only each group's own `instancias`), so the last-place guarantee from `rotinasPorFundo` is structurally preserved. 3 controls are real `Select.Root` instances proven to change visible output live. |
| `derive.ts`/`dashboardQuery.ts` untouched beyond documented `template.nome` | `git log --oneline` scoped to both files across all commits; confirms last touch was Phase 21 (`ba5ac9c`), zero Phase 22 commits (`acfe034`…`2f2ff79`) appear | Confirmed — no Phase 22 commit modifies either file. `template.nome` is surfaced entirely inside `Dashboard.svelte`'s local `dadosNormalizados`/`rotinaNomeById`, exactly as documented. |
| `EntityScreen.svelte`/`registry.ts`/`Shell.svelte` untouched by this phase | `git log --oneline` for each file across Phase 22's commit range | Confirmed — none of the 6 Phase 22 commits (`c0625cf`…`2f2ff79`) touch any of these 3 files; their last modifications are from earlier phases (18-20). |
| Every click target is a real `<button>` with no wired dialog | grep for `onclick`/`Dialog` imports in all 3 new components; live e2e tagName assertions | `ProjectStrips.svelte` has exactly 2 `onclick` handlers: `onVerProjetos` (nav link) and `toggleCollapse` (local UI state) — no dialog wiring anywhere. `RoutinesByFundo.svelte`/`MonthHeatmap.svelte` have zero `onclick` at all on their dialog-target buttons (`rotinas-fundo-titulo`, `rotinas-row`, `dash-heatmap-cell`). No `Dialog` import in any of the 3 files. This correctly matches Phase 23's declared scope ("wire every clickable surface... to the correct dialog"). Live e2e confirms every one of these elements' `tagName` is `"button"`. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/lib/dashboard/ProjectStrips.svelte` | Fixed-width non-compressing mini-kanban strips | ✓ VERIFIED | Exists, substantive (239 lines, no stub patterns), wired into `Dashboard.svelte`'s `dash-placeholder-projetos` slot with real `query.data.projetos` |
| `web/src/lib/dashboard/RoutinesByFundo.svelte` | Fundo-grouped routine cards with controls | ✓ VERIFIED | Exists, substantive (169 lines), wired into `dash-placeholder-rotinas` slot with real `rotinaGrupos`/`rotinaNomeById` |
| `web/src/lib/dashboard/MonthHeatmap.svelte` | 5-band monthly heatmap | ✓ VERIFIED | Exists, substantive (82 lines), wired into `dash-placeholder-rotinas` slot with real `carga`/`anoMes` |
| `web/e2e/dashboard-kanbans.spec.ts` | DASH-05 e2e coverage | ✓ VERIFIED | Exists, 7 tests, all passing live against the running app with real CLI-seeded InstantDB fixtures |
| `web/e2e/dashboard.spec.ts` (extended) | DASH-04 e2e coverage | ✓ VERIFIED | 11 new tests ("DASH-04: rotinas by fundo" ×7, "DASH-04: month heatmap" ×4), all passing live |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Dashboard.svelte` | `ProjectStrips.svelte` | `dash-placeholder-projetos` slot, `projetoRows()` | ✓ WIRED | Real query data passed as prop, testid/classes unchanged from Phase 21 |
| `Dashboard.svelte` | `RoutinesByFundo.svelte` + `MonthHeatmap.svelte` | `dash-placeholder-rotinas` slot | ✓ WIRED | `rotinaGrupos`/`rotinaNomeById`/`carga`/`anoMes` computed in `Dashboard.svelte`, passed as props |
| `ProjectStrips.svelte` | `derive.ts` | `progressoEtapa`/`tarefaConcluida`/`vencido` imports | ✓ WIRED | No reimplemented grouping/overdue logic; imports confirmed at top of file |
| `RoutinesByFundo.svelte`/`MonthHeatmap.svelte` | `derive.ts` | `vencido`/`faixaHeatmap` imports | ✓ WIRED | Neither component calls `db.useQuery` or any grouping function itself |
| `dashboardQuery.ts` (single query) | all 3 new components | props only | ✓ WIRED | Confirmed: no `db`/`useQuery` import in any of the 3 new files |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ProjectStrips.svelte` | `projetos` prop | `Dashboard.svelte`'s `projetoRows()` ← `query.data.projetos` (single live `db.useQuery`) | Yes | ✓ FLOWING |
| `RoutinesByFundo.svelte` | `grupos`/`nomeById` props | `Dashboard.svelte`'s `rotinaGrupos`/`rotinaNomeById` ← `dadosNormalizados.instanciasRotina`/`query.data` | Yes | ✓ FLOWING |
| `MonthHeatmap.svelte` | `carga` prop | `Dashboard.svelte`'s `cargaDoMes(dadosNormalizados, ano, mes)` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks / Probe Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests (`derive.ts` and others) | `bun test src` | 170 pass, 0 fail, 490 expect() calls | ✓ PASS |
| Type-check + Svelte-check | `bun run check` | 0 errors, 1 pre-existing unrelated warning (`EntityScreen.svelte`) | ✓ PASS |
| Lint | `bun run lint` | 0 errors, 1 pre-existing unrelated info (`calendar-caption.svelte`, not touched by this phase) | ✓ PASS |
| Full Playwright e2e suite (3 projects) | `bun run test:e2e` | 121 passed, 1 failed (`dashboard.spec.ts:645`, DASH-03 weekend chip — a **Phase 21** test, not Phase 22 scope) | ✓ PASS (see note) |
| Isolated re-run of the one failure | `npx playwright test -g "chip is absent with zero weekend items" --project authed` | 2 passed (0 failed) | ✓ PASS — confirms transient |

**Note on the one full-suite failure:** `dashboard.spec.ts:645` failed with `{"detail": "_ssl.c:993: The handshake operation timed out", "error": "network"}` while calling the CLI fixture-seeding step (a TLS handshake to InstantDB's admin API, not an application assertion). Re-run in isolation immediately after, it passed twice with zero code changes. This matches the exact class of transient network flake both 22-01-SUMMARY.md and 22-02-SUMMARY.md independently documented during their own executor runs. The failing test also belongs to Phase 21's DASH-03 scope (weekend chip), not Phase 22's DASH-04/DASH-05 surface — it is unrelated to any file this phase modified. Every one of the 26 tests that ARE this phase's scope (`dashboard-kanbans.spec.ts` ×7, `dashboard.spec.ts`'s "DASH-04: rotinas by fundo" ×7 and "DASH-04: month heatmap" ×4, plus the pre-existing suite regression-checked at ×108 more) passed cleanly on the same full run.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| DASH-05 | 22-01-PLAN.md | Mini-kanban strips per in-progress project, fixed-width non-compressing columns, measured overflow indicator, localStorage collapse | ✓ SATISFIED | `ProjectStrips.svelte` + `dashboard-kanbans.spec.ts` (7/7 passing) |
| DASH-04 | 22-02-PLAN.md | Fundo-grouped routines with functional controls; 5-band monthly heatmap using only spec §6 tokens | ✓ SATISFIED | `RoutinesByFundo.svelte` + `MonthHeatmap.svelte` + `dashboard.spec.ts` DASH-04 blocks (11/11 passing) |

No orphaned requirements — REQUIREMENTS.md maps only DASH-04 and DASH-05 to Phase 22, and both are claimed by the two plans.

### Anti-Patterns Found

None. Scanned `ProjectStrips.svelte`, `RoutinesByFundo.svelte`, `MonthHeatmap.svelte`, and the `Dashboard.svelte` diff for `TODO|FIXME|XXX|TBD|HACK|PLACEHOLDER`, hardcoded hex colors, empty handlers (`onclick={() => {}}`), and stub returns (`return null`/`return []`/`return {}`). Zero matches. The only `onclick` handlers present are legitimate (`toggleCollapse`, `onVerProjetos`, week-nav) — no click target that spec/roadmap assigns to Phase 23's dialogs has a premature or fake `onclick`.

### Human Verification Required

None. All 5 ROADMAP success criteria and both requirements (DASH-04, DASH-05) were verified against the live codebase and confirmed with real, running Playwright assertions (bounding-box measurement, narrow-viewport forced overflow, localStorage key introspection, live class-string assertions) — not inferred from SUMMARY prose.

### Gaps Summary

No gaps. All 5 phase success criteria are genuinely implemented, wired to real (single-query) data, and covered by passing live e2e tests. The phase's namesake risk — "kanban columns compressing, the most repeated error in the wireframe" — is concretely disproven by a live `boundingBox()` width-AND-height equality assertion across columns holding very different card counts (4 cards vs 1 card) inside the same strip, plus `shrink-0`/`w-36`/`box-border` in the actual rendered class string. The one deviation found (heatmap band-4 text color) is a correct, independently-verified resolution of an internal spec inconsistency (the literal spec §6 token `text-destructive-foreground` does not exist in `app.css`), not a fabricated or off-palette color, and does not affect any of the 5 verified truths.

---

_Verified: 2026-08-12T01:15:00Z_
_Verifier: Claude (gsd-verifier)_
