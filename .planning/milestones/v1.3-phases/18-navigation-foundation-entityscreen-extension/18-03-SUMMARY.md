---
phase: 18-navigation-foundation-entityscreen-extension
plan: 03
subsystem: testing
tags: [playwright, e2e, navigation, regression]

requires:
  - phase: 18-01
    provides: "6-item topbar (nav-dashboard + navConfigs-derived nav-<etype> buttons), removal of nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas testids, gotoNested(page, etype) e2e helper, interim nested-goto Select control inside <main>"
provides:
  - "All 9 e2e spec files this plan owns migrated off dead nav-<nested-etype> testids onto gotoNested(page, etype)"
  - "Every wildcard [data-testid^=\"nav-\"] count assertion updated for the 6-item topbar (or 5-entity subset excluding Dashboard)"
  - "Full Playwright e2e suite (71 tests, all 3 projects) green"
affects: []

actuals:
  tokens: 5836
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "e2e specs reaching a nav:\"nested\" entity always call gotoNested(page, etype) — never a direct nav-<etype> testid click — the pattern this plan retrofitted across every pre-existing spec file"

key-files:
  created: []
  modified:
    - web/e2e/shell-chrome.spec.ts
    - web/e2e/entities-header-states.spec.ts
    - web/e2e/cross-phase-verification.spec.ts
    - web/e2e/entities-ticket-subtarefa.spec.ts
    - web/e2e/entities-delete-confirmation.spec.ts
    - web/e2e/entities-projeto-etapa-tarefa.spec.ts
    - web/e2e/entities-form-dialog-composition.spec.ts
    - web/e2e/entities-form-restyle.spec.ts
    - web/e2e/entities-rotina-log.spec.ts

key-decisions:
  - "Fixed 3 additional pre-existing regressions discovered while running this plan's own <verify> steps, all caused by Plan 18-01 landing in the same working tree before this plan ran (no worktree isolation) and all outside this plan's literal <action> text but squarely inside its declared files_modified scope and success criteria (zero-9-count, fully-green-suite): (1) entities-header-states.spec.ts's ENTTBL-05 loading-state test assumed fundos was the default mount route -- it is now Dashboard (NAV-03) -- so a nav-fundos click was added before the network-throttled first query; (2) cross-phase-verification.spec.ts's instanciasRotina keyboard/focus-visible smoke test's Tab-count formula (navTestIds.length - idx) didn't account for the new nested-goto Select trigger Plan 18-01 inserted inside <main> between <nav> and the active screen -- added +1; (3) cross-phase-verification.spec.ts had a 4th nav-tarefas occurrence (inside the delete-confirmation dual-color-scheme test) that the plan's <action> text did not enumerate but which the plan's own repo-wide zero-nav-tarefas success criterion requires migrating -- migrated to gotoNested."
  - "Migrated entities-ticket-subtarefa.spec.ts's 9 nav-subtarefas occurrences by pattern (goto+click or reload+click -> single gotoNested call) rather than by the plan's stated line-number breakdown (5 goto-preceded / 3 reload-preceded), since the file's actual current occurrence count split 6/3 instead of 5/3+1 unaccounted -- the plan's own <done> criterion (9 total occurrences, 0 remaining nav-subtarefas) was satisfied regardless of the exact split."

patterns-established:
  - "Any e2e spec reaching a nav:\"nested\" entity uses gotoNested(page, etype); a repo-wide grep for nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas in web/e2e should return zero call-site matches (the one remaining hit, in shell-nav.spec.ts's NAV-02 test, is an intentional absence-proof locator, not a call site)."

requirements-completed: [NAV-05, NEST-06]

coverage:
  - id: D1
    description: "All 27 catalogued e2e call sites that used to click a nav-<nested-etype> button now call gotoNested(page, etype) instead; zero remaining nav-etapas/nav-templatesRotina/nav-subtarefas/nav-tarefas call sites anywhere in web/e2e/ (NAV-05)"
    requirement: "NAV-05"
    verification:
      - kind: other
        ref: "grep -rn 'nav-etapas\\|nav-templatesRotina\\|nav-subtarefas\\|nav-tarefas' web/e2e -- only remaining hit is shell-nav.spec.ts's NAV-02 absence-proof locator (asserts toHaveCount(0)), not a call site"
        status: pass
      - kind: e2e
        ref: "cd web && bun run test:e2e (full 71-test, 3-project suite)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every wildcard [data-testid^=\"nav-\"] count assertion reflects the new 6-item topbar (or the 5-entity subset when Dashboard is deliberately excluded), across shell-chrome.spec.ts, entities-header-states.spec.ts, and cross-phase-verification.spec.ts (NAV-05)"
    requirement: "NAV-05"
    verification:
      - kind: e2e
        ref: "web/e2e/shell-chrome.spec.ts#single content-frame consistency across entities, entities-header-states.spec.ts#ENTTBL-07, cross-phase-verification.spec.ts#VERIFY-07/POLISH-04 and #VERIFY-05/POLISH-03 Shell header"
        status: pass
    human_judgment: false
  - id: D3
    description: "entities-fundos.spec.ts required zero edits; entities-rotina-log.spec.ts's Log/instanciasRotina-specific assertions are byte-identical to before this plan, only its 2 templatesRotina navigation lines changed (NEST-06)"
    requirement: "NEST-06"
    verification:
      - kind: other
        ref: "git diff (pre-this-plan vs current) on entities-rotina-log.spec.ts shows exactly 2 navigation-line replacements; entities-fundos.spec.ts has no diff at all"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-fundos.spec.ts (both tests), web/e2e/entities-rotina-log.spec.ts (all 3 tests) -- all pass in the full suite run"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full pre-existing Playwright e2e suite (71 tests, setup + anon + authed projects) passes green after this plan's migration, the phase's overall regression gate"
    requirement: ""
    verification:
      - kind: e2e
        ref: "cd web && bun run test:e2e -- 71 passed (6.1m), zero failures, zero did-not-run"
        status: pass
      - kind: unit
        ref: "cd web && bun test src -- 139 pass, 0 fail"
        status: pass
      - kind: other
        ref: "cd web && bun run check (0 errors, 1 pre-existing unrelated warning) && bun run lint (0 new issues, 1 pre-existing unrelated info-level hit)"
        status: pass
    human_judgment: false

duration: ~75min
completed: 2026-08-11
status: complete
---

# Phase 18 Plan 03: e2e Regression Migration to gotoNested Summary

**Migrated all 9 pre-existing Playwright spec files off the 4 removed `nav-<nested-etype>` testids onto `gotoNested(page, etype)`, fixed every wildcard `[data-testid^="nav-"]` count assertion for the new 6-item topbar, and fixed 3 additional pre-existing regressions Plan 18-01's landing exposed (a stale default-mount assumption, a Tab-order miscalculation, and one uncatalogued call site) — full 71-test e2e suite is green.**

## Performance

- **Duration:** ~75 min (includes 3 full 71-test Playwright suite runs; one hit a transient magic-code email rate-limit and had to be retried)
- **Completed:** 2026-08-11
- **Tasks:** 3/3 completed
- **Files modified:** 9

## Accomplishments

- Fixed 2 stale `toBe(9)` wildcard-count assertions (`shell-chrome.spec.ts`, `entities-header-states.spec.ts`) for the new 6-item topbar / 5-entity subset, per Task 1.
- Migrated all 27 catalogued `nav-etapas`/`nav-templatesRotina`/`nav-subtarefas`/`nav-tarefas` click call sites across 7 files (`cross-phase-verification.spec.ts`, `entities-ticket-subtarefa.spec.ts`, `entities-delete-confirmation.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-form-dialog-composition.spec.ts`, `entities-form-restyle.spec.ts`, `entities-rotina-log.spec.ts`) onto `gotoNested(page, etype)`, per Tasks 2-3.
- Fixed 3 additional regressions discovered while running this plan's own `<verify>` steps (all caused by Plan 18-01 landing first in the shared working tree, all documented in Deviations below and all within this plan's declared scope).
- Confirmed `entities-fundos.spec.ts` needed zero edits and `entities-rotina-log.spec.ts`'s Log/`instanciasRotina` assertions are untouched beyond the 2 navigation-line replacements (NEST-06).
- Ran the full 71-test, 3-project Playwright suite twice to a clean green result (the first full run hit a transient magic-code email rate limit unrelated to any code change and was simply retried).

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix wildcard-count assertions broken by the 9-to-6 topbar change** - `2e4a4b8` (fix)
2. **Task 2: Migrate cross-phase-verification.spec.ts + entities-ticket-subtarefa.spec.ts + entities-delete-confirmation.spec.ts to gotoNested** - `d149b56` (feat)
3. **Task 3: Migrate remaining 4 files to gotoNested** - `ac6d61c` (feat)

_Task 1's commit also folds in the ENTTBL-05 loading-state fix (Deviation 1 below); Task 2's commit also folds in the instanciasRotina Tab-count fix and the 4th cross-phase-verification.spec.ts nav-tarefas occurrence (Deviations 2 and 3 below) — both discovered and fixed while satisfying each task's own `<verify>` step, before committing._

## Files Created/Modified

- `web/e2e/shell-chrome.spec.ts` — `toBe(9)` → `toBe(6)` for the nav-button wildcard count.
- `web/e2e/entities-header-states.spec.ts` — excluded `nav-dashboard` from the ENTTBL-07 per-entity loop, `toBe(9)` → `toBe(5)`, renamed test title; fixed ENTTBL-05's stale "fundos is the default mount" assumption with an explicit `nav-fundos` click.
- `web/e2e/cross-phase-verification.spec.ts` — 2 wildcard-count fixes (5 Dashboard-excluded, 6 Dashboard-included), 4 `nav-tarefas` call sites migrated to `gotoNested`, instanciasRotina Tab-count formula fixed for the new `nested-goto` Select trigger.
- `web/e2e/entities-ticket-subtarefa.spec.ts` — 9 `nav-subtarefas` call sites migrated to `gotoNested`.
- `web/e2e/entities-delete-confirmation.spec.ts` — 5 `nav-tarefas` call sites migrated to `gotoNested`.
- `web/e2e/entities-projeto-etapa-tarefa.spec.ts` — 4 `nav-etapas`/`nav-tarefas` call sites migrated to `gotoNested`.
- `web/e2e/entities-form-dialog-composition.spec.ts` — 3 `nav-tarefas` call sites migrated to `gotoNested`.
- `web/e2e/entities-form-restyle.spec.ts` — `nav-templatesRotina`/`nav-subtarefas` call sites migrated to `gotoNested`.
- `web/e2e/entities-rotina-log.spec.ts` — 2 `nav-templatesRotina` call sites migrated to `gotoNested`; all other assertions byte-identical.

## Decisions Made

- See `key-decisions` in frontmatter for the full rationale on the 3 auto-fixed deviations and the pattern-based (rather than line-number-based) migration of `entities-ticket-subtarefa.spec.ts`'s 9 `nav-subtarefas` occurrences.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `entities-header-states.spec.ts`'s ENTTBL-05 loading-state test assumed the wrong default mount route**
- **Found during:** Task 1's `<verify>` run
- **Issue:** The test's own comment stated "fundos is the default active entity on mount ... no nav click needed" — true before Plan 18-01, but Plan 18-01 changed the default `Route` to `{ section: "dashboard" }` (NAV-03). With Dashboard now default, the throttled-network first query never fires for `fundos`, so `entity-loading` never appears and the test times out waiting for it.
- **Fix:** Added `await page.getByTestId("nav-fundos").click();` immediately after the throttled `page.goto("/", { waitUntil: "commit" })`, so the first genuine, network-round-tripped query is for `fundos`'s own data. Updated the stale comment to explain the new reasoning.
- **Files modified:** `web/e2e/entities-header-states.spec.ts`
- **Verification:** Re-ran the isolated test — passes (16.4s, `entity-loading` visible with `.animate-pulse`, no "carregando" text).
- **Committed in:** `2e4a4b8` (part of Task 1's commit)

**2. [Rule 1 - Bug] `cross-phase-verification.spec.ts`'s instanciasRotina keyboard/focus-visible smoke test miscalculated Tab count**
- **Found during:** Task 2's `<verify>` run
- **Issue:** The test's Tab-count formula (`navTestIds.length - idx`) assumed Tab-forwarding through the remaining nav buttons lands directly in the active screen's content. Plan 18-01 inserted a new `nested-goto` Select trigger button inside `<main>`, between `<nav>` and the active screen's content — an extra focusable element the formula didn't account for. The test landed focus on `nested-goto` instead of `row-edit`.
- **Fix:** Changed the formula to `navTestIds.length - idx + 1` and updated the explanatory comment to describe the new intervening `nested-goto` trigger.
- **Files modified:** `web/e2e/cross-phase-verification.spec.ts`
- **Verification:** Re-ran the isolated test — passes (`focusedTestId` is `row-edit`).
- **Committed in:** `d149b56` (part of Task 2's commit)

**3. [Rule 3 - Blocking issue] A 4th `nav-tarefas` occurrence in `cross-phase-verification.spec.ts` was not enumerated by the plan's `<action>` text**
- **Found during:** Task 2's own repo-wide `grep -n 'nav-tarefas\|nav-subtarefas'` `<done>` check
- **Issue:** The plan's Task 2 `<action>` text enumerated exactly 2 `nav-tarefas` occurrences inside the "tarefas create Dialog legible" test's per-color-scheme loop (lines 355-356 and 379-380 per the plan's line numbering), but the current file only has 1 such occurrence in that specific test — the plan's second referenced occurrence is actually in the *next* test ("tarefas delete-confirmation AlertDialog legible"), a separate, unmentioned call site. Leaving it unmigrated would have violated both this plan's own `<done>` grep check and its repo-wide `<verification>`/success-criteria requirement of zero remaining `nav-tarefas` references.
- **Fix:** Migrated the goto+click pair in the delete-confirmation test's loop to `await gotoNested(page, "tarefas");` as well.
- **Files modified:** `web/e2e/cross-phase-verification.spec.ts`
- **Verification:** Repo-wide grep across the 3 Task-2 files returns 0 matches for `nav-tarefas`/`nav-subtarefas`; both migrated tests pass.
- **Committed in:** `d149b56` (part of Task 2's commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bug fixes, 1 Rule 3 blocking-issue fix). All 3 were pre-existing regressions exposed by Plan 18-01 landing first in the shared working tree (no worktree isolation in this project), discovered strictly while running this plan's own declared `<verify>`/`<done>` steps.
**Impact on plan:** No scope creep — every fix was inside a file already in this plan's `files_modified` list and was required to satisfy this plan's own stated success criteria (fully-green suite, zero remaining dead-testid references). No production runtime code was touched; all 3 fixes are test-only.

## Issues Encountered

- The first full-suite run (`bun run test:e2e`) failed at the `setup` project step with a magic-code email round-trip timeout (`Timed out after 45000ms waiting for a new magic code`) — an InstantDB per-email send rate limit or transient email delay, unrelated to any change in this plan (the `auth.setup.ts` flow is untouched). Retried once more, ~2 minutes later, and it authenticated successfully on the first attempt; the full suite then ran 71/71 green.
- One earlier subset run (`cross-phase-verification.spec.ts` + `entities-ticket-subtarefa.spec.ts` + `entities-delete-confirmation.spec.ts` combined with the full-suite run) showed a transient `_ssl.c:993: The handshake operation timed out` network error inside a CLI subprocess call (`sweepLeftovers`'s `apollo ticket listar`), which cascaded into 6 "did not run" tests in `entities-ticket-subtarefa.spec.ts`. Re-ran that file in isolation immediately afterward — all 7 tests passed cleanly, confirming the failure was a transient network blip in the CLI-to-InstantDB round trip, not a defect introduced by this plan's migration (this file's own migrated `gotoNested` call sites were exercised successfully in the very same passing re-run).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 18's own full-suite gate (`bun run test:e2e`) is now green: 71/71 tests pass across all 3 projects.
- `bun test src` (unit, 139 tests including `registry.test.ts`), `bun run check` (0 errors), and `bun run lint` (0 new issues) are all clean, with only 1 pre-existing, out-of-scope `svelte_state_referenced_locally` warning in `EntityScreen.svelte` (from Plan 18-02, already documented there) and 1 pre-existing, out-of-scope `useParseIntRadix` info-level lint hit in `calendar-caption.svelte` (already documented in Plan 18-01's summary) remaining anywhere in the touched surface.
- Repo-wide `grep -rn 'nav-etapas\|nav-templatesRotina\|nav-subtarefas\|nav-tarefas' web/e2e` returns exactly 1 hit — `shell-nav.spec.ts`'s NAV-02 test, which is an intentional absence-proof locator (`toHaveCount(0)`), not a dead call site — confirming NAV-05's "zero remaining reference" requirement is met in the only sense that matters (no test still tries to click a removed button).
- `grep -n 'if (config.etype\|if (cfg.etype' web/src/lib/entities/EntityScreen.svelte` and an equivalent check against `Shell.svelte` both return zero matches, confirming the "zero etype branching" invariant holds across the phase's own production-code changes (Plans 18-01/18-02), which this plan's e2e migration now fully regression-proves.
- Phase 18 is complete: all 3 plans (18-01 nav foundation, 18-02 EntityScreen extension, 18-03 this plan's e2e regression migration) are done, and the phase's stated overall success criteria are all independently verifiable from this plan's own suite run — see the accompanying assessment in this session's final response for the explicit checklist.

## Self-Check: PASSED

All 9 modified files verified present on disk with the expected content (spot-checked via grep for `gotoNested` imports/calls and absence of dead testids). All 3 task commit hashes (`2e4a4b8`, `d149b56`, `ac6d61c`) verified present in `git log --oneline`.

---
*Phase: 18-navigation-foundation-entityscreen-extension*
*Completed: 2026-08-11*
