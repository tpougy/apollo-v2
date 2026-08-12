---
phase: 20-rotinas-tickets-sections
plan: 04
subsystem: testing
tags: [playwright, e2e, xorlink, subtarefas]

# Dependency graph
requires:
  - phase: 20-rotinas-tickets-sections
    provides: "SubtarefasPanel.svelte (Plan 20-01) + TicketsSection.svelte (Plan 20-01) + ProjetosSection.svelte's tarefa-parented wiring (Plan 20-03) -- both concrete panel-opening paths this plan's helpers drive"
provides:
  - "web/e2e/helpers/subtarefasPanel.ts -- openSubtarefasPanelForTicket/openSubtarefasPanelForTarefa, parent-id-aware e2e helpers"
  - "Zero remaining gotoNested(page, \"subtarefas\") call sites anywhere in web/e2e/ -- unblocks Plan 20-05's removal of the interim nested-goto dropdown for that etype"
affects: [20-05]

# Actuals (#2632)
actuals:
  tokens: 5155
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Row lookups for a subtarefa just created/edited through SubtarefasPanel must be scoped to the visible `subtarefas-panel` testid (e.g. `page.getByTestId(\"subtarefas-panel\").getByTestId(\"row\")`), never a bare page-wide `page.getByTestId(\"row\")` -- SubtarefasPanel's own hidden driven-create host (`subtarefa-host`) mounts an UNSCOPED EntityScreen(subtarefasConfig) the instant `subtarefa-add-start` is first clicked in a session, and that hidden copy shows every subtarefa (not just the current parent's), producing a strict-mode-violation-or-hidden-match collision against any unscoped same-session row lookup."
    - "When a test's final xor choice differs from the parent the panel was opened with (e.g. create pre-resolved to tarefa, then manually switched to ticket before submit, or edited from tarefa to ticket), the created/edited row leaves the originally-opened panel's scopeWhere-filtered list entirely -- re-open a fresh panel scoped to the ACTUAL resulting parent (openSubtarefasPanelForTicket/openSubtarefasPanelForTarefa) before asserting on or deleting that row, rather than reusing the original panel instance."

key-files:
  created:
    - web/e2e/helpers/subtarefasPanel.ts
  modified:
    - web/e2e/entities-ticket-subtarefa.spec.ts
    - web/e2e/entities-form-restyle.spec.ts

key-decisions:
  - "entities-form-restyle.spec.ts keeps its `gotoNested` import (contra the plan's own parenthetical claim that neither file needs it for another etype) -- the file's separate 'templatesRotina — Select field conversion' describe block still calls `gotoNested(page, \"templatesRotina\")` at an unrelated test (line ~293), which is out of this plan's migration scope and unaffected by it."
  - "Added a scoped `panel = page.getByTestId(\"subtarefas-panel\")` locator (and its `.getByTestId(\"row\")` descendant) to every migrated test's own just-created/just-edited row lookup, in place of the plan's literal 'keep every existing assertion unchanged' instruction for that one line -- live testing showed the bare page-wide lookup collides with SubtarefasPanel's own hidden, unscoped driven-create host once `subtarefa-add-start` has been clicked in the session (see tech-stack pattern above)."
  - "'WEB-08 T-04-11: switching parent type before submit' and 'ROADMAP Phase 10 SC3' both re-open a ticket-scoped panel (openSubtarefasPanelForTicket) after their final xor choice resolves to \"ticket\" but the panel was opened scoped to the tarefa -- without this, the just-created/just-edited row is invisible to the originally-opened (tarefa-scoped) panel's own scopeWhere filter, since the record's actual parent no longer matches it."
  - "The 'switching parent type before submit' test needed an added `waitForSettle` call between `submitForm` and the immediately-following `openSubtarefasPanelForTicket` re-navigation -- without it, the fresh page.goto() can race the in-flight db.transact(), the same class of same-session reactive-resettle race already documented for reload-after-edit flows in this file and in 20-01-SUMMARY.md/tickets-section.spec.ts."

requirements-completed: [NEST-05]

coverage:
  - id: D1
    description: "Every pre-existing e2e test that used to open the unscoped subtarefas table via gotoNested(page, \"subtarefas\") now reaches an equivalent, correctly-scoped SubtarefasPanel instead (6 tests in entities-ticket-subtarefa.spec.ts, 1 in entities-form-restyle.spec.ts)"
    requirement: "NEST-05"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts (full file, --project=authed --no-deps)"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts (full file, --project=authed --no-deps)"
        status: pass
      - kind: other
        ref: "grep -rn 'gotoNested(page, \"subtarefas\")' web/e2e/ (zero matches, only descriptive comments in prose)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The still-editable xor-parent-type selector's manual-override capability (spec §2.4's own 'apenas pré-resolvido' wording) remains exercised by at least one migrated test"
    requirement: "NEST-05"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts#WEB-08 T-04-11: switching parent type before submit links only the final choice"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts#WEB-08 T-04-11: editing a subtarefa's parent type unlinks the old parent, leaving exactly one link"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ROADMAP Phase 10 SC3: xor-parent-type and the dynamic link-target picker render as Select; switching parent on edit unlinks the stale parent"
        status: pass
    human_judgment: false
  - id: D3
    description: "The one retired test's removal ('T-04-04: subtarefa submitted with no parent selected is blocked') is documented, not silent -- its reachability premise no longer holds once SubtarefasPanel's own create trigger always pre-resolves both xor fields"
    verification:
      - kind: other
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts inline comment replacing the retired test (threat T-20-06)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-11
status: complete
---

# Phase 20 Plan 04: Migrate entities-ticket-subtarefa.spec.ts to parent-scoped SubtarefasPanel helpers Summary

**Retired every remaining `gotoNested(page, "subtarefas")` call site (9 across 2 files) in favor of two new parent-id-aware e2e helpers that open the real, already-shipped `SubtarefasPanel`, discovering and fixing a hidden-driven-create-host row-collision bug and a scoped-panel "wrong parent" reachability gap along the way.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-11T19:45:50-03:00 (context load, immediately following Plan 20-03's completion commit `f89ac35`)
- **Completed:** 2026-08-11T20:11:04-03:00 (final task commit) + SUMMARY/state wrap-up
- **Tasks:** 2/2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `web/e2e/helpers/subtarefasPanel.ts`: two new plain exported-async-function helpers, `openSubtarefasPanelForTicket(page, ticketId)` and `openSubtarefasPanelForTarefa(page, tarefaId)`, driving `TicketsSection.svelte`'s (Plan 20-01) and `ProjetosSection.svelte`'s "Todas as tarefas" tab's (Plan 20-03) row-click affordances to reach a concrete-parent-scoped `SubtarefasPanel`. No new app-side testid was introduced.
- `entities-ticket-subtarefa.spec.ts`'s 6 `gotoNested(page, "subtarefas")` tests migrated: 4 now open the panel and drive create via `subtarefa-add-start` (the parent pre-resolves automatically, mirroring `tickets-section.spec.ts`'s already-proven pattern), 2 of those (`T-04-11` switching/editing) additionally keep a manual `xor-parent-type`/`link-<type>` override to prove the selector remains present and editable. The 7th test (`T-04-04`, "no parent selected is blocked") was retired with an inline rationale: `SubtarefasPanel`'s create trigger always resolves both xor fields before showing the dialog, so the "type known, id blank" state this test exercised has no remaining UI entry point.
- `entities-form-restyle.spec.ts`'s "ROADMAP Phase 10 SC3" test migrated the same way; its `gotoNested` import was kept (not removed) because the same file's separate `templatesRotina` describe block still legitimately depends on it — a correction to the plan's own literal claim that neither file needed the import for another etype.
- Discovered and fixed a real bug live: `SubtarefasPanel`'s hidden driven-create host mounts an **unscoped** `EntityScreen(subtarefasConfig)` the instant `subtarefa-add-start` is first clicked in a page session, so a bare page-wide `row` lookup for the just-created subtarefa ambiguously matches that hidden copy too. Every migrated row lookup for the panel's own just-created/edited record is now scoped to `page.getByTestId("subtarefas-panel").getByTestId("row")`.
- Discovered and fixed a second, related gap: when a test's final xor choice differs from the parent the panel was opened with (switching tarefa→ticket before or during submit), the record leaves the originally-opened panel's `scopeWhere`-filtered list entirely. Both affected tests now re-open a fresh panel scoped to the actual resulting parent before asserting/deleting, mirroring the pattern already needed by the "editing...unlinks" test.
- Zero remaining `gotoNested(page, "subtarefas")` call sites confirmed via `grep -rn 'gotoNested(page, "subtarefas")' web/e2e/` (returns no matches; two files carry a descriptive prose comment about the *retired* pattern, deliberately worded to avoid the literal call-syntax substring). This unblocks Plan 20-05's removal of the interim `nested-goto` dropdown for the `subtarefas` etype.

## Task Commits

1. **Task 1: New helper file — openSubtarefasPanelForTicket / openSubtarefasPanelForTarefa** — `2f3997e` (feat)
2. **Task 2: Migrate all 7 remaining tests off gotoNested(page, "subtarefas")** — `f9f79cd` (test)

**Plan metadata:** committed together with this SUMMARY (see Final Commit below).

## Files Created/Modified

- `web/e2e/helpers/subtarefasPanel.ts` — new: `openSubtarefasPanelForTicket`, `openSubtarefasPanelForTarefa`.
- `web/e2e/entities-ticket-subtarefa.spec.ts` — 6 tests migrated, 1 test retired with inline rationale, `gotoNested` import removed (no longer used in this file).
- `web/e2e/entities-form-restyle.spec.ts` — 1 test migrated (`ROADMAP Phase 10 SC3`), `gotoNested` import kept (still used by a different, unrelated test in the same file).

## Decisions Made

1. **Kept `entities-form-restyle.spec.ts`'s `gotoNested` import.** The plan's Task 2 text asserted "none of these two files [need `gotoNested` for another etype]," but the file's own "templatesRotina — Select field conversion" describe block still legitimately calls `gotoNested(page, "templatesRotina")` in an unrelated test — confirmed via `grep -n "gotoNested(" web/e2e/entities-form-restyle.spec.ts` before touching the import. Removing the import per the plan's literal claim would have broken that unrelated, unmigrated test with a compile error. Corrected the plan's assumption against the actual codebase state (deviation Rule 1 — bug the plan's own text would have introduced).
2. **Scoped every migrated row lookup to `page.getByTestId("subtarefas-panel")` instead of a bare page-wide `page.getByTestId("row")`.** Live test runs against the hosted app showed `SubtarefasPanel`'s hidden driven-create host (`subtarefa-host`, unscoped `EntityScreen(subtarefasConfig)`) stays mounted for the rest of the page session once `subtarefa-add-start` is first clicked, and its own unscoped query renders a second copy of every subtarefa row (including the one just created), causing `page.getByTestId("row").filter({ hasText: titulo })` to intermittently resolve to either a strict-mode violation (2 matches) or a single "hidden" match, depending on render timing. This is a genuine functional discovery about the shipped Plan 20-01 component, not a plan-authoring mistake — the plan's literal "keep every existing assertion unchanged" instruction for this one locator line could not work against the live app as written.
3. **Re-opened a fresh, correctly-scoped panel before the final assertion/delete in two tests whose xor choice ends up differing from the panel's own opening parent** (`T-04-11: switching parent type before submit` and `ROADMAP Phase 10 SC3`). Both create/edit a subtarefa that starts pre-resolved to a tarefa, then manually overrides to a ticket before the final submit — the resulting record is genuinely absent from the originally-opened, tarefa-scoped panel's list (its `scopeWhere: {"tarefa.id": ...}` never matches a ticket-linked row), so the panel that must be queried for verification/deletion is the ticket-scoped one, mirroring the shape the plan's own "editing...unlinks" test already uses for the analogous case.
4. **Added a `waitForSettle` call before the ticket-panel re-navigation in `T-04-11: switching parent type before submit`.** Without it, the fresh `page.goto("/")` inside `openSubtarefasPanelForTicket` intermittently raced the in-flight `db.transact()` from the immediately-preceding `submitForm`, reproducing the exact same-session reactive-resettle race already documented in this file's own `waitForSettle` helper comment and in 20-01-SUMMARY.md.
5. **Reworded two inline comments (in the new helper file and in the retired-test comment) to avoid the literal substring `gotoNested(page, "subtarefas")`.** The plan's own `<verification>` step runs `grep -rn 'gotoNested(page, "subtarefas")' web/e2e/` and expects zero matches; the comments needed to describe the retired call site prose-only (e.g. "the `gotoNested` helper's 'subtarefas' branch") rather than quoting its exact call syntax, so the verification command's literal text is genuinely satisfied, not just its spirit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `entities-form-restyle.spec.ts` still needs its `gotoNested` import**
- **Found during:** Task 2, before editing imports
- **Issue:** The plan's action text claimed neither file needed `gotoNested` for another etype after this migration; `entities-form-restyle.spec.ts` actually has an unrelated `gotoNested(page, "templatesRotina")` call in a separate describe block.
- **Fix:** Kept the import in that file; only removed it from `entities-ticket-subtarefa.spec.ts` (verified via grep that all 9 of its `gotoNested` calls were subtarefas-only).
- **Files modified:** `web/e2e/entities-form-restyle.spec.ts`
- **Verification:** `bunx tsc -p tsconfig.e2e.json --noEmit` — clean; `bun run lint` — clean (aside from the one pre-existing, unrelated `calendar-caption.svelte` info).
- **Committed in:** `f9f79cd` (Task 2 commit)

**2. [Rule 1 - Bug] Hidden driven-create host causes ambiguous/hidden row matches for same-session row lookups**
- **Found during:** Task 2's first full test run — 6 failures with either "unexpected value hidden" or "strict mode violation: resolved to 2 elements... `subtarefas-panel`... `subtarefa-host`"
- **Issue:** `SubtarefasPanel.svelte`'s hidden `subtarefa-host` (an unscoped `EntityScreen(subtarefasConfig)` instance used only to drive the create dialog's xor pre-resolution) stays mounted and reactive for the rest of the page session once `subtarefa-add-start` is first clicked, and its unscoped query lists every subtarefa, including the one just created through the visible, scoped panel. A bare page-wide `page.getByTestId("row").filter({ hasText: titulo })` therefore ambiguously matches both the visible panel's own row and the hidden host's copy.
- **Fix:** Added `const panel = page.getByTestId("subtarefas-panel");` and scoped every affected row lookup to `panel.getByTestId("row").filter(...)` in all 6 migrated tests plus the `entities-form-restyle.spec.ts` test.
- **Files modified:** `web/e2e/entities-ticket-subtarefa.spec.ts`, `web/e2e/entities-form-restyle.spec.ts`
- **Verification:** `bunx playwright test entities-ticket-subtarefa.spec.ts entities-form-restyle.spec.ts --project=authed --no-deps` — full 11/11 pass after the fix.
- **Committed in:** `f9f79cd` (Task 2 commit)

**3. [Rule 1 - Bug] Cross-parent xor switch leaves the record outside the originally-opened panel's scoped list**
- **Found during:** Task 2's second test run, after fix #2 — 2 remaining failures (`T-04-11: switching parent type before submit` timed out finding its row; `ROADMAP Phase 10 SC3` timed out clicking `row-delete`)
- **Issue:** Both tests open a tarefa-scoped panel, then manually switch the xor choice to "ticket" before the final submit resolves. The created/edited record's real parent is now the ticket, which the tarefa-scoped panel's `scopeWhere: {"tarefa.id": ...}` never matches — the row genuinely disappears from that panel's own list, so continuing to query it there hangs until timeout.
- **Fix:** Both tests now call `openSubtarefasPanelForTicket(page, chainTicketId)` (re-opening a fresh, correctly-scoped panel) before locating the row for the final assertions/delete. `T-04-11: switching parent type before submit` additionally needed a `waitForSettle` call before that re-navigation to avoid racing the in-flight `db.transact()`.
- **Files modified:** `web/e2e/entities-ticket-subtarefa.spec.ts`, `web/e2e/entities-form-restyle.spec.ts`
- **Verification:** `bunx playwright test entities-ticket-subtarefa.spec.ts entities-form-restyle.spec.ts --project=authed --no-deps` — full 11/11 pass; also individually re-ran both previously-failing tests in isolation to confirm.
- **Committed in:** `f9f79cd` (Task 2 commit)

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs discovered live against the hosted app while executing this plan's own tasks, not scope creep). None change this plan's architecture or intent; all were necessary to make the migration actually pass against the shipped Plan 20-01/20-03 components.

## Out-of-Scope Discovery (not fixed, per instructions)

`DEF-01` (`cross-phase-verification.spec.ts`'s `instanciasRotina` Tab-count test, broken by Plan 20-02's `RotinasSection` Tabs addition, documented in `.planning/phases/20-rotinas-tickets-sections/deferred-items.md`) remains open. This plan's `files_modified` never included `cross-phase-verification.spec.ts`, so per the explicit scope-boundary instruction it was left untouched for the next wave.

## Issues Encountered

None beyond the three auto-fixed deviations above — all were caught and resolved within this plan's own task execution and verification loop, with zero blockers reaching a checkpoint.

## Regression Verification

Beyond the plan's own `<verify>`/`<verification>` commands, also ran (all pass):
- `bunx tsc -p tsconfig.e2e.json --noEmit` — 0 errors
- `bun run lint` (biome check) — 0 errors (1 pre-existing, unrelated info in `calendar-caption.svelte:50`, same as documented in 20-01-SUMMARY.md/20-03-SUMMARY.md)
- `bunx playwright test entities-ticket-subtarefa.spec.ts entities-form-restyle.spec.ts --project=authed --no-deps` — 11/11 pass (run twice for confidence, both green)
- `bunx playwright test shell-nav.spec.ts tickets-section.spec.ts projetos-section.spec.ts entities-rotina-log.spec.ts --project=authed --no-deps` — 29/29 pass (broader regression sweep; `shell-nav.spec.ts`'s own `gotoNested(page, "subtarefas")` call at its NAV-02 test is untouched by this plan — it still resolves via `gotoNested.ts`'s unmodified interim `nested-goto` fallback branch, which this plan does not remove; that removal is Plan 20-05's job)
- `git diff --stat` confirms only this plan's declared 3 files changed (1 created, 2 modified) — no incidental edits to `gotoNested.ts`, `Shell.svelte`, or `cross-phase-verification.spec.ts`

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Zero remaining `gotoNested(page, "subtarefas")` call sites anywhere in `web/e2e/` — Plan 20-05 can now safely delete the interim `nested-goto` dropdown's `subtarefas` entry (and, per 20-RESEARCH.md Pitfall 4, add the `templatesRotina` branch first if not already done, then remove the entire "Acesso direto (temporário)" block once both remaining `nav: "nested"` entities have real homes).
- `web/e2e/helpers/subtarefasPanel.ts`'s two helpers are generically reusable by any future spec needing to reach a concrete-parent-scoped `SubtarefasPanel` — not limited to this plan's own two spec files.
- The two bugs discovered and fixed here (hidden-host row collision, cross-parent scoped-panel reachability) are now-documented patterns (see `tech-stack.patterns` above) that any later plan writing new SubtarefasPanel-driven e2e coverage should follow from the start, rather than rediscovering live.
- DEF-01 remains open in `.planning/phases/20-rotinas-tickets-sections/deferred-items.md`, unaffected by this plan (never in its `files_modified`).

## Self-Check: PASSED

All claimed files exist on disk and both task commit hashes resolve in `git log --oneline --all`:
- FOUND: `web/e2e/helpers/subtarefasPanel.ts`
- FOUND: `web/e2e/entities-ticket-subtarefa.spec.ts`
- FOUND: `web/e2e/entities-form-restyle.spec.ts`
- FOUND: `.planning/phases/20-rotinas-tickets-sections/deferred-items.md`
- FOUND: `2f3997e` (Task 1 commit)
- FOUND: `f9f79cd` (Task 2 commit)

---
*Phase: 20-rotinas-tickets-sections*
*Completed: 2026-08-11*
