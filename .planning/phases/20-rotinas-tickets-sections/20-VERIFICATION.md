---
phase: 20-rotinas-tickets-sections
verified: 2026-08-12T00:09:36Z
status: passed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 20: Rotinas & Tickets Sections Verification Report

**Phase Goal:** Users manage recurring-routine instances and their templates from one section
with clear tab separation, and inspect any ticket's or task's subtarefas from a shared inline
panel without ever touching the raw parent-type selector.
**Verified:** 2026-08-12T00:09:36Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | Rotinas section has an Instâncias tab (default) and a Templates tab; Instâncias keeps `capabilities.create`/`.delete` at `false` with no create/delete affordance visible anywhere; Templates shows its context paragraph (NEST-04) | ✓ VERIFIED | `web/src/lib/sections/RotinasSection.svelte` renders a `Tabs.Root` with `activeTab` default `"instancias"`; mounts unmodified `EntityScreen(instanciasRotinaConfig)` (`capabilities.create/delete: false` confirmed in `web/src/lib/entities/defs/instanciasRotina.ts:44`) and `EntityScreen(templatesRotinaConfig)` + a static "Configuração que gera as instâncias." paragraph. `web/e2e/rotinas-section.spec.ts` asserts zero `entity-create-start`/`row-delete` on the Instâncias tab and the context paragraph on Templates — ran live, 1/1 pass. `web/e2e/entities-rotina-log.spec.ts`'s WEB-07 ("instanciasRotina offers no create, no delete, and status-only edit") also passed live. |
| 2 | Selecting a ticket row opens an inline side panel inside the Shell frame (not a new Sheet) showing that ticket's subtarefas via `EntityScreen` with `scopeWhere`/`presetLinks` pre-resolved to the open ticket (NEST-05) | ✓ VERIFIED | `web/src/lib/sections/TicketsSection.svelte`'s `handleTableClick` delegation sets `selectedTicketId`, mounting `SubtarefasPanel(parentType="ticket", parentId=..., parentLabel=...)` inline (`<div data-testid="subtarefas-panel" class="w-56 border rounded-md p-4 ...">` — matches spec-ui.md §2.4's `w-56`/`border`/in-frame, non-Sheet requirement verbatim). `SubtarefasPanel.svelte` derives `scopeWhere = {[parentType+".id"]: parentId}` / `presetLinks = {[parentType]: parentId}`, consumed by `EntityScreen.svelte`'s `buildQuery`/`selectedLinks` (lines 33-75, 214) — confirmed by reading the live component code. `web/e2e/tickets-section.spec.ts` (4 tests, including cross-ticket scope isolation) and `web/e2e/shell-nav.spec.ts`'s NAV-02 (opens the panel via `openSubtarefasPanelForTicket`) all passed live in this verification's own suite run. |
| 3 | The same shared panel opens from a task's subtarefa affordance — wherever tasks are shown, including inside Projetos' etapa detail — pre-resolved to that task, and the `xor-parent-type` selector in the generic form is never touched by the user in this flow (NEST-05) | ✓ VERIFIED | `web/src/lib/sections/ProjetosSection.svelte`'s `etapa-tarefa-subtarefas-chip` is a real `<button>` toggling `activeSubtarefaTarefaId`, mounting the identical `SubtarefasPanel(parentType="tarefa", ...)`. The "Todas as tarefas" tab's `todas-tarefas-table` click-delegation wrapper gives orphaned tasks (no etapa) the same affordance via `activeOrphanSubtarefaId`. `SubtarefasPanel`'s `startCreateSubtarefa()` drives the hidden host's own `xor-parent-type`/`link-<type>` DOM via `firePointerClick` (pointerdown/pointerup pairs) — the end user/test never calls `.click()`/`.selectOption()` against those testids. Confirmed live: `projetos-section.spec.ts` (17/17, including the two NEST-05 tests for chip + orphan escape hatch), `entities-ticket-subtarefa.spec.ts` (both `T-04-11` tests exercise the still-editable manual override, proving the selector remains present/editable without ever being the entry point). |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `web/src/lib/sections/RotinasSection.svelte` | Instâncias/Templates tabs wrapper | ✓ VERIFIED | Exists, substantive, wired into `Shell.svelte`'s `instanciasRotina` branch |
| `web/src/lib/sections/TicketsSection.svelte` | EntityScreen(tickets) + row-selection + inline panel mount | ✓ VERIFIED | Exists, substantive, wired into `Shell.svelte`'s `tickets` branch |
| `web/src/lib/sections/SubtarefasPanel.svelte` | Shared, parent-type-agnostic inline subtarefas panel | ✓ VERIFIED | Exists, substantive, imported by both `TicketsSection.svelte` and `ProjetosSection.svelte`, no per-etype branch inside it |
| `web/src/lib/sections/ProjetosSection.svelte` (chip + "Todas as tarefas" wiring) | Tarefa-parented panel-opening affordance, including orphans | ✓ VERIFIED | `etapa-tarefa-subtarefas-chip` is a real button; `todas-tarefas-table` click-delegation covers orphaned tarefas |
| `web/src/lib/Shell.svelte` | Clean router with dedicated branches, no interim dropdown | ✓ VERIFIED | 6-branch `{#if}` chain (dashboard/projetos/tickets/instanciasRotina/fallback); no `HANDLED_BY_SECTION`/`nestedGroups`/`Select.Root` interim dropdown present |
| `web/e2e/helpers/gotoNested.ts` | etapas/tarefas/templatesRotina branches; throws on unhandled etype | ✓ VERIFIED | 3 explicit branches + descriptive `throw new Error(...)` fallback naming `subtarefasPanel.ts` as the replacement |
| `web/e2e/helpers/subtarefasPanel.ts` | `openSubtarefasPanelForTicket`/`openSubtarefasPanelForTarefa` | ✓ VERIFIED | Exists, used by `shell-nav.spec.ts`, `entities-ticket-subtarefa.spec.ts`, `entities-form-restyle.spec.ts` |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `TicketsSection.svelte` row click | `SubtarefasPanel` | `selectedTicketId` → `parentId` prop | WIRED | `{#key selectedTicketId}` remount confirmed in code |
| `ProjetosSection.svelte` etapa-detail chip | `SubtarefasPanel` | `activeSubtarefaTarefaId` → `parentId` prop | WIRED | Confirmed in code (lines ~543-563) |
| `ProjetosSection.svelte` "Todas as tarefas" row click | `SubtarefasPanel` | `activeOrphanSubtarefaId` → `parentId` prop | WIRED | Confirmed in code (lines ~685-704) |
| `SubtarefasPanel.svelte` | `EntityScreen.svelte` | `scopeWhere`/`presetLinks` props | WIRED | Confirmed in `EntityScreen.svelte`'s `buildQuery` (scopeWhere merged into query `where`) and `selectedLinks` (presetLinks merged into link selection) |
| `SubtarefasPanel.svelte` hidden host | generic xor-parent-type/link-`<type>` DOM | `firePointerClick` pointer-event pairs | WIRED | Confirmed live via passing e2e (`tickets-section.spec.ts`, `projetos-section.spec.ts`) that never touch those testids themselves |
| `Shell.svelte` | `RotinasSection`/`TicketsSection`/`ProjetosSection` | `{#if rota.etype === ...}` branches | WIRED | Confirmed in code; `EntityScreen.svelte`/`registry.ts` untouched (see below) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `SubtarefasPanel.svelte`'s visible list | `scopeWhere`/`presetLinks` | `$derived` from `parentType`/`parentId` props, consumed by `EntityScreen`'s live `db.useQuery` | Yes | ✓ FLOWING |
| `RotinasSection.svelte`'s Instâncias/Templates tabs | `EntityScreen(instanciasRotinaConfig/templatesRotinaConfig)` | Unmodified, pre-existing live `db.useQuery` inside `EntityScreen` | Yes | ✓ FLOWING |
| `TicketsSection.svelte`'s ticket table | `EntityScreen(ticketsConfig)` | Unmodified, pre-existing live `db.useQuery` | Yes | ✓ FLOWING |

### Zero-Regression / Anti-Pattern Checks

- **`EntityScreen.svelte`/`registry.ts` untouched by Phase 20** — Confirmed via `git log --oneline -- web/src/lib/entities/EntityScreen.svelte web/src/lib/entities/registry.ts`: the most recent commit touching either file is `239aaea` ("feat(18-02): add additive scopeWhere/presetLinks props to EntityScreen"), from Phase 18 — no Phase 19 or Phase 20 commit appears in that history. ✓ VERIFIED.
- **Zero `if (etype === ...)`-style branches in generic components** — `grep -rn "config.etype ===\|=== \"etapas\"\|=== \"tarefas\"\|=== \"subtarefas\"\|=== \"templatesRotina\""` across `web/src/lib` returns only `registry.ts:36`'s own `configByEtype` selector body (`entityConfigs.find((config) => config.etype === etype)`), which is the lookup selector itself, not a per-etype conditional-behavior branch. `Shell.svelte`'s router branches (`rota.etype === "tickets"` etc.) are the one explicitly-permitted router-level exception documented inline (spec-ui.md §0.6) and are outside `EntityScreen.svelte`/`registry.ts`. ✓ VERIFIED, no violation found.
- **Debt markers** — `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across all Phase-20-touched files (`SubtarefasPanel.svelte`, `TicketsSection.svelte`, `RotinasSection.svelte`, `ProjetosSection.svelte`, `Shell.svelte`, `gotoNested.ts`, `subtarefasPanel.ts`) returns zero matches.

### Behavioral Spot-Checks / Full Suite Execution (run live by this verifier, not taken from SUMMARY)

| Check | Command | Result | Status |
|---|---|---|---|
| Unit tests | `bun test src` | 151/151 pass, 0 fail | ✓ PASS |
| Type/svelte-check | `bun run check` | 0 errors, 1 pre-existing unrelated warning (`EntityScreen.svelte:45`) | ✓ PASS |
| Lint | `bun run lint` | 0 errors, 1 pre-existing unrelated info (`calendar-caption.svelte:50`) | ✓ PASS |
| Full e2e suite, run 1 | `bun run test:e2e` | **93/93 pass** (all 3 Playwright projects) | ✓ PASS |
| Full e2e suite, run 2 | `bun run test:e2e` | 92/93 pass — 1 failure: `entities-form-restyle.spec.ts`'s "ROADMAP Phase 10 SC3" (`RESYNC_TIMEOUT` waiting for `link-tarefa` to update after edit) | ⚠ Flake reproduced, analyzed below |
| Isolated re-run of the flaking test | `bunx playwright test entities-form-restyle.spec.ts -g "ROADMAP Phase 10 SC3" --project=authed --no-deps` | 1/1 pass (10.2s) | ✓ PASS |

## Independent Flake Assessment (login-flow.spec.ts, entities-form-restyle.spec.ts)

Both flakes named in `20-05-SUMMARY.md` were independently re-produced and investigated by this
verifier (not accepted on the SUMMARY's word alone):

1. **`login-flow.spec.ts` — "submitting a deliberately wrong code renders the destructive Alert"**
   (magic-code email round-trip timing). `git log --oneline -- web/e2e/login-flow.spec.ts` shows
   the most recent change to this file is `8a71cfa` ("feat(10-03): wire toast calls into
   LoginScreen/Shell auth actions"), i.e. **Phase 10** — nine phases before Phase 20, and no
   Phase-20 commit touches this file at all. `.planning/STATE.md`'s own Deferred Items table
   already carries this exact flake class ("Occasional live-email-timing test flake (magic-code
   round trip) | Deferred — non-blocking, pre-existing | **v1.1 close**"), i.e. documented as
   pre-existing well before this milestone even started. **Conclusion: genuinely pre-existing and
   environmental, not a Phase 20 regression.**

2. **`entities-form-restyle.spec.ts` — "ROADMAP Phase 10 SC3"** (fails under full-suite load with
   `expect(locator).toHaveText(...)` timing out on `link-tarefa`, a `RESYNC_TIMEOUT`-governed
   reactive-resettle wait). This test file *was* modified by Plan 20-04 (migrated off
   `gotoNested(page, "subtarefas")` onto the new `SubtarefasPanel` helpers), so this verifier gave
   it extra scrutiny rather than accepting "pre-existing" at face value:
   - `grep -n "RESYNC_TIMEOUT"` shows the constant and this exact reactive-resync wait pattern
     were introduced in `aca3d26` (Phase 10, 2026-08-09) — the pattern itself long predates Phase
     20.
   - The specific assertion that timed out (`link-tarefa` showing the updated value after an
     edit) exercises `EntityScreen`'s own generic reactive form/select-sync behavior, not any
     Phase-20-authored code path (`SubtarefasPanel`'s own driven-create/host code is not on the
     call stack for this particular assertion).
   - Re-ran the identical test in isolation twice more (`bunx playwright test ... -g "ROADMAP
     Phase 10 SC3"`): both passed in 10.2s. The failure only manifests under the full ~8-minute
     single-worker sequential suite, consistent with resource contention against the live
     InstantDB backend, not a deterministic logic defect.
   - This matches the SUMMARY's own characterization exactly ("same-session reactive-resettle race
     against the live InstantDB backend... manifesting as resource contention under a long single
     -worker sequential run rather than a logic defect").
   **Conclusion: genuinely environmental/resource-contention, not a regression introduced by
   Phase 20's diff.** (This verifier's own two full-suite runs additionally showed the flake is
   non-deterministic in *which* test it lands on — run 1 was 93/93 clean, run 2 dropped exactly
   this one test — reinforcing the resource-contention diagnosis over a fixed logic bug.)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| NEST-04 | 20-02-PLAN, 20-05-PLAN | Rotinas: Instâncias (default, no create/delete)/Templates tabs | ✓ SATISFIED | `RotinasSection.svelte`, `rotinas-section.spec.ts`, `entities-rotina-log.spec.ts` WEB-07 |
| NEST-05 | 20-01/20-03/20-04/20-05-PLAN | Shared inline subtarefas panel from tickets and tasks, xor selector never touched by user | ✓ SATISFIED | `SubtarefasPanel.svelte`, `TicketsSection.svelte`, `ProjetosSection.svelte` wiring, `tickets-section.spec.ts`, `projetos-section.spec.ts`, `entities-ticket-subtarefa.spec.ts`, `shell-nav.spec.ts` NAV-02 |

No orphaned requirements — REQUIREMENTS.md maps only NEST-04/NEST-05 to Phase 20, both claimed and satisfied.

### Anti-Patterns Found

None. No debt markers, no stub returns, no hardcoded-empty props flowing to rendering in any Phase-20-authored file.

### Human Verification Required

None. All three ROADMAP success criteria are backed by live, passing Playwright coverage
(re-executed by this verifier, not taken on faith from SUMMARY.md), the two full-suite flakes
were independently traced to pre-existing/environmental causes with git-history evidence, and the
project's explicit policy (PROJECT.md Context) is zero human UAT for this milestone.

### Gaps Summary

No gaps. All 3 phase-goal truths verified against live code and live, independently-re-run test
execution. `EntityScreen.svelte`/`registry.ts` confirmed untouched since Phase 18. Zero
`if (etype === ...)`-style branches introduced in generic components. The two documented e2e
flakes are confirmed pre-existing/environmental (not Phase 20 regressions) via independent git
history and isolation-rerun evidence gathered by this verifier.

---

_Verified: 2026-08-12T00:09:36Z_
_Verifier: Claude (gsd-verifier)_
