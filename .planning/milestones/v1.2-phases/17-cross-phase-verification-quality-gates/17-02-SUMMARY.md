---
phase: 17-cross-phase-verification-quality-gates
plan: 02
subsystem: testing
tags: [playwright, e2e, svelte, accessibility, tailwind, instantdb, biome, svelte-check]

requires:
  - phase: 17-cross-phase-verification-quality-gates
    provides: "Plan 17-01's full-suite regression baseline (60/60 passing), coverage matrix, and cross-milestone grep sweeps (POLISH-01/02/04-static, VERIFY-04/06/07)"
provides:
  - "web/e2e/cross-phase-verification.spec.ts (new, 8 live tests): the VERIFY-07/POLISH-04 cross-phase walkthrough with 4 measured pixel-parity assertions, 4 dual-color-scheme legibility checks (login, shell/nav, entity form/dialog, delete confirmation), and 3 keyboard/focus-visible smoke tests (one per capability class)"
  - "A live-confirmed 68/68-passing single sequential bun run test:e2e run (60 pre-existing + this plan's 8 new tests), the final full-suite proof for the whole v1.2 milestone"
  - "bun run check and bun run lint both exiting 0 on web/ with zero new suppressions versus the v1.1 baseline, across the whole v1.2 diff (not just this plan's own file) — one real pre-existing violation (11 noNonNullAssertion warnings in Phase 13's shell-chrome.spec.ts) found and fixed with a real code change"
  - "web/README.md's closing cross-phase proof paragraph, citing this plan's own live 68-passed run"
  - "24/24 v1.2 milestone requirements marked complete in REQUIREMENTS.md; all 6 v1.2 phases marked complete in ROADMAP.md"
affects: []

actuals:
  tokens: 5969
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Mixing a manually-built empty-storageState browser.newContext() (for a mocked-magic-code Login leg) with the same test's default authed-project page fixture (for live Shell/entity legs), closing the fresh context before continuing — proven safe, zero state leakage between the two"
    - "getComputedStyle(...).marginBlockEnd / .columnGap read at two independent points in the same test run (or across two separate contexts) as the deterministic, numeric proof that two Tailwind space-y-*/gap-* utilities compile to the literal same pixel value — used here across phases (Login vs. Dialog, Shell vs. EntityScreen) rather than within a single component as prior phases did"
    - "Keyboard/focus-visible smoke-test technique: walk the DOM ancestor chain from document.activeElement up to (but not including) a named boundary testid via element.parentElement in a page.evaluate, failing if any ancestor's computed overflow/overflow-x/overflow-y is hidden — a cheap, direct proxy for Pitfall 6's actual concern (a rounded-corner overflow-hidden wrapper clipping a focused descendant's ring) instead of a fragile pixel-boundary screenshot comparison"

key-files:
  created:
    - web/e2e/cross-phase-verification.spec.ts
  modified:
    - web/README.md
    - web/e2e/shell-chrome.spec.ts

key-decisions:
  - "Shell/nav's dual-color-scheme legibility check measures document.body's background-color (app.css's `body { @apply bg-background text-foreground; }`), not shell-header's own — shell-header carries no explicit bg-* class (it is deliberately transparent, revealing the page surface underneath), so its own computed background-color is `rgba(0, 0, 0, 0)` in both color schemes. The actual rendered, legible-or-not surface for this chrome is the body it sits on, discovered when the header-based assertion failed identically in both schemes."
  - "instanciasRotina's keyboard/focus-visible smoke test asserts on whichever row-edit Tab reaches, not a specific seeded-and-filtered row — this live app's instanciasRotina table is never guaranteed empty (Shell.svelte's routine-instance generation job runs on every authenticated mount and had already created 3 real rows independent of this test's own seeded record), discovered when the original row-filtered assertion failed against that pre-existing live data. The seeded record still guarantees at least one row on a hypothetically-fresh app instance; the assertion itself no longer depends on row identity, only on landing on *a* row-edit control."
  - "logInferenciaClaude's keyboard smoke test Tabs INTO nav-logInferenciaClaude from its predecessor nav button, rather than Tabbing FROM it to \"the next nav button\" as originally planned — ordem: 9 makes it the LAST of the 9 nav buttons in DOM order (entityConfigs sorts ascending by ordem), so no forward Tab from it can reach a next nav button; there is none. The closest faithful reading of the requirement (prove Tab-reachability + a focus-visible affordance on the read-only class's own nav control) lands the assertion on nav-logInferenciaClaude itself, arrived at via Tab, instead of failing outright on a structural impossibility."
  - "Fixed 11 pre-existing noNonNullAssertion Biome warnings in Phase 13's shell-chrome.spec.ts (a file outside this plan's own files_modified list) rather than treating them as out-of-scope — QUAL-02 explicitly requires bun run check/lint to report zero findings beyond the two named v1.1-baseline items across the WHOLE v1.2 diff, and this plan's own Task 3 action text explicitly mandates a real code fix (never a suppression) for anything found beyond those two. Fixed via explicit null-check-then-throw narrowing (`if (!x) throw new Error(...)`), mirroring login-composition.spec.ts's own pre-existing convention for the same pattern."

requirements-completed: [POLISH-03, POLISH-04, VERIFY-05, VERIFY-07, QUAL-02]

coverage:
  - id: D1
    description: "A single live Playwright test walks Login (mocked magic-code send) -> Shell (all 9 nav entities swept) -> fundos' table/create-Dialog/delete-confirmation in one continuous pass, with 4 named cross-phase pixel-parity assertions (Login's space-y-4 == Dialog's space-y-4, Login's space-y-2 == Dialog's space-y-2, Shell's gap-4 == every EntityScreen's gap-4, and the row-actions gap-2 recorded), proving VERIFY-07 and POLISH-04's \"one consistent scale\" claim numerically"
    requirement: "VERIFY-07"
    verification:
      - kind: e2e
        ref: "web/e2e/cross-phase-verification.spec.ts#VERIFY-07/POLISH-04: cross-phase walkthrough -- Login -> Shell -> fundos table/form/delete, spacing scale measured at each stop"
        status: pass
    human_judgment: false
  - id: D2
    description: "4 new dual-color-scheme (page.emulateMedia) legibility checks cover the 4 touched surfaces that did not already have one before this plan: login, shell/nav, entity form/dialog (tarefas), and delete confirmation (tarefas) -- joining entity table/loading/empty's existing Phase-14 coverage, satisfying VERIFY-05's per-touched-surface requirement for all five surfaces"
    requirement: "VERIFY-05"
    verification:
      - kind: e2e
        ref: "web/e2e/cross-phase-verification.spec.ts#VERIFY-05/POLISH-03: LoginScreen Card/CardHeader legible in both color schemes"
        status: pass
      - kind: e2e
        ref: "web/e2e/cross-phase-verification.spec.ts#VERIFY-05/POLISH-03: Shell header and all 9 nav buttons legible in both color schemes"
        status: pass
      - kind: e2e
        ref: "web/e2e/cross-phase-verification.spec.ts#VERIFY-05/POLISH-03: tarefas create Dialog legible in both color schemes, zero write"
        status: pass
      - kind: e2e
        ref: "web/e2e/cross-phase-verification.spec.ts#VERIFY-05/POLISH-03: tarefas delete-confirmation AlertDialog legible in both color schemes, zero write"
        status: pass
    human_judgment: false
  - id: D3
    description: "One keyboard-navigation/:focus-visible smoke test exists per capability class (full-CRUD/fundos, restricted/instanciasRotina, read-only/logInferenciaClaude), each proving Tab reaches an expected interactive element (or the nav control, for read-only) with a real, unclipped focus-visible affordance -- coverage that did not exist anywhere in the suite before this plan"
    requirement: "VERIFY-05"
    verification:
      - kind: e2e
        ref: "web/e2e/cross-phase-verification.spec.ts#VERIFY-05: keyboard/focus-visible smoke -- fundos (full-CRUD): Tab reaches row-edit then row-delete, both with a real, unclipped focus-visible affordance"
        status: pass
      - kind: e2e
        ref: "web/e2e/cross-phase-verification.spec.ts#VERIFY-05: keyboard/focus-visible smoke -- instanciasRotina (restricted, update-only): Tab reaches row-edit (the only row action available) with a real, unclipped focus-visible affordance"
        status: pass
      - kind: e2e
        ref: "web/e2e/cross-phase-verification.spec.ts#VERIFY-05: keyboard/focus-visible smoke -- logInferenciaClaude (read-only, zero row actions): Tab reaches the nav control itself with a real, unclipped focus-visible affordance"
        status: pass
    human_judgment: false
  - id: D4
    description: "bun run check and bun run lint both exit 0 on web/ with zero new suppressions versus the v1.1 baseline -- only the same two pre-existing findings (EntityScreen.svelte's configProp warning, calendar-caption.svelte's useParseIntRadix info) and nothing else, across the whole v1.2 diff"
    requirement: "QUAL-02"
    verification:
      - kind: other
        ref: "cd web && bun run check (0 errors, 1 warning -- configProp, exit 0); cd web && bun run lint (0 errors, 1 info -- useParseIntRadix, exit 0) -- re-run after fixing shell-chrome.spec.ts's 11 pre-existing noNonNullAssertion warnings"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full pre-existing-plus-new Playwright suite (60 baseline + this plan's 8 new tests = 68) passes in one final clean sequential run, and web/README.md documents this phase's cross-phase proof with the actual observed passed-count"
    verification:
      - kind: e2e
        ref: "cd web && bun run test:e2e (full transcript: 68 passed, 0 failed, 0 skipped)"
        status: pass
      - kind: other
        ref: "grep -c cross-phase-verification web/README.md == 1"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-10
status: complete
---

# Phase 17 Plan 02: Cross-Phase Spacing-Parity, Dual-Color-Scheme & Keyboard/Focus-Visible Coverage, Final Quality Gates Summary

**A single new live Playwright test measures the actual computed pixel values of Login's and EntityScreen Dialog's space-y-4/space-y-2 and Shell's and EntityScreen's gap-4 across phases and finds them numerically identical, 7 more live tests close every remaining dual-color-scheme and keyboard/focus-visible gap the milestone's success criteria required, `bun run check`/`bun run lint` are clean with zero new findings across the whole v1.2 diff after fixing one real pre-existing lint violation, and the full 68-test suite passes in one final clean run — closing out all 6 phases and 24/24 requirements of the v1.2 "Lapidação de UI" milestone.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-10T20:50:00Z (approx.)
- **Completed:** 2026-08-10T21:15:00Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Built `web/e2e/cross-phase-verification.spec.ts` (8 new live tests against the real hosted InstantDB app), the dedicated spec this milestone's REQUIREMENTS.md Design Intent section explicitly called for: a walkthrough that actually walks Login → Shell → an entity's table/form/delete surface in one continuous pass and *measures* the spacing scale, rather than reading class names.
- Task 1's tracer test recorded Login's `space-y-4`/`space-y-2` scale (16px/8px) from a fresh, mocked-magic-code context, then re-measured the identical values on EntityScreen's create-Dialog and on Shell's/every-EntityScreen's `gap-4` — all 4 named pixel-parity assertions held, the literal, numeric proof behind POLISH-04's "one consistent scale" claim and VERIFY-07's "re-checks earlier phases' surfaces together."
- Task 2 added the 4 remaining dual-color-scheme legibility checks (login, shell/nav, entity form/dialog, delete confirmation) and 3 keyboard/focus-visible smoke tests (one per capability class), closing VERIFY-05's coverage gap for good.
- Task 3's quality-gate run surfaced a real, if narrow, QUAL-02 violation outside this plan's own file — 11 pre-existing `noNonNullAssertion` Biome warnings in Phase 13's `shell-chrome.spec.ts` — and fixed it with a real code change (explicit null-check-then-throw narrowing), not a suppression. `bun run check`/`bun run lint` now both exit 0 with only the two named v1.1-baseline findings across the whole v1.2 diff.
- Final `bun run test:e2e` run: **68 passed, 0 failed, 0 skipped** (60 pre-existing + this plan's 8 new tests) — the closing full-suite proof for the entire v1.2 milestone.
- `web/README.md`'s "Running the e2e suite" section now documents this phase's cross-phase proof and cites the actual 68-passed count.
- All 24/24 v1.2 requirements and all 6 v1.2 phases marked complete in `REQUIREMENTS.md`/`ROADMAP.md`; `STATE.md` updated to 100% progress, pending `/gsd-complete-milestone v1.2`.

## Task Commits

1. **Task 1 (tracer) + Task 2: cross-phase walkthrough, dual-color-scheme, keyboard/focus-visible coverage** — `cef5ef4` (test) — both tasks landed in one commit since they built out the same new spec file in tandem; each task's own tests were run and confirmed green independently before combining.
2. **Task 3: final quality gates, full-suite regression, README documentation** — `5e28749` (fix) — includes the shell-chrome.spec.ts lint fix, a minor formatting fixup in cross-phase-verification.spec.ts caught by the same lint run, and the README closing paragraph.

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified

- `web/e2e/cross-phase-verification.spec.ts` (new) — 8 live tests: the VERIFY-07/POLISH-04 cross-phase walkthrough (Task 1), 4 dual-color-scheme tests, and 3 keyboard/focus-visible smoke tests (Task 2).
- `web/e2e/shell-chrome.spec.ts` — replaced 11 non-null assertions (`!`) with explicit `if (!x) throw new Error(...)` narrowing, eliminating the corresponding Biome `noNonNullAssertion` warnings discovered during Task 3's quality-gate run. Zero behavior change — same runtime checks, same assertions, same test outcomes (re-verified live).
- `web/README.md` — one new closing paragraph in the existing "Running the e2e suite" section, naming `cross-phase-verification.spec.ts` and citing the live 68-passed count as this phase's (and the milestone's) final cross-phase proof.

## Decisions Made

See `key-decisions` in frontmatter for full rationale on all four:

1. Shell/nav's dual-color-scheme check measures `document.body`'s background-color, not `shell-header`'s own (which is transparent in both schemes by design).
2. `instanciasRotina`'s keyboard smoke test asserts on whichever `row-edit` Tab reaches, not a specific seeded-and-filtered row, since this live app's `instanciasRotina` table is never guaranteed empty (the routine-instance generation job runs on every authenticated mount).
3. `logInferenciaClaude`'s keyboard smoke test Tabs INTO its nav button from the predecessor, not FROM it to "the next nav button" — it is structurally the last of 9 nav buttons (`ordem: 9`).
4. Fixed Phase 13's pre-existing `shell-chrome.spec.ts` lint warnings (outside this plan's own file list) per QUAL-02's explicit whole-diff requirement and this plan's own Task 3 action text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a false pixel-parity test design: shell-header background-color measured transparent in both color schemes**
- **Found during:** Task 2 (Shell/nav dual-color-scheme test)
- **Issue:** `shell-header` has no explicit `bg-*` class (deliberately transparent, revealing the page surface underneath), so `getComputedStyle(header).backgroundColor` returned `rgba(0, 0, 0, 0)` in both light and dark schemes — the assertion `expect(backgrounds[0]).not.toBe(backgrounds[1])` failed because there was genuinely nothing to differ.
- **Fix:** Measure `document.body`'s `background-color` instead (`app.css`'s `body { @apply bg-background text-foreground; }`), the actual rendered surface this chrome sits on.
- **Files modified:** `web/e2e/cross-phase-verification.spec.ts`
- **Verification:** Re-ran the test live — passes, backgrounds now differ as expected.
- **Committed in:** `cef5ef4` (Task 1+2 commit)

**2. [Rule 1 - Bug] Fixed a row-identity assumption that doesn't hold against live pre-existing data**
- **Found during:** Task 2 (instanciasRotina keyboard smoke test)
- **Issue:** The original test filtered `row` by this test's own seeded `competencia` text and asserted Tab landed on *that* row's `row-edit`. Live, the `instanciasRotina` table already had 3 pre-existing rows (created by `Shell.svelte`'s routine-instance generation job on every authenticated mount) before this test's own seeded row, so the fixed Tab-count landed on a different row's `row-edit`, and the row-filtered `toBeFocused()` assertion failed.
- **Fix:** Assert on whichever `row-edit` Tab actually reaches (`document.activeElement`'s testid), not a row filtered by this test's own data — still proves Tab-reachability and the focus-visible affordance for this capability class, without depending on an assumption about table emptiness that doesn't hold live.
- **Files modified:** `web/e2e/cross-phase-verification.spec.ts`
- **Verification:** Re-ran the test live — passes.
- **Committed in:** `cef5ef4` (Task 1+2 commit)

**3. [Rule 4-adjacent interpretive fix, not architectural] Adapted logInferenciaClaude's keyboard test to a structural fact the plan's wording didn't account for**
- **Found during:** Task 2 (logInferenciaClaude keyboard smoke test)
- **Issue:** The plan's `<behavior>` text says "Tab from `nav-logInferenciaClaude` reaches the next nav button." `logInferenciaClaude` has `ordem: 9`, the highest of all 9 entities, so `entityConfigs`'s ascending sort makes it render LAST in the nav bar — there is no "next nav button" after it for a forward Tab to reach.
- **Fix:** Start the Tab sequence from `logInferenciaClaude`'s predecessor nav button instead, landing ON `nav-logInferenciaClaude` via Tab, then assert the focus-visible affordance there — the closest faithful reading of the substantive requirement (prove Tab-reachability + an unclipped focus-visible affordance on the read-only capability class's own nav control, since it has zero in-table interactive elements by design) given the structural fact the plan's literal wording didn't anticipate. This did not require a user decision (no architectural change, no scope change, purely a test-authoring adaptation to an existing, unchangeable `ordem` fact), so it was resolved inline rather than raised as a Rule 4 checkpoint.
- **Files modified:** `web/e2e/cross-phase-verification.spec.ts`
- **Verification:** Re-ran the test live — passes.
- **Committed in:** `cef5ef4` (Task 1+2 commit)

**4. [Rule 1 - Bug, real QUAL-02 violation outside this plan's own file] Fixed 11 pre-existing noNonNullAssertion Biome warnings in shell-chrome.spec.ts**
- **Found during:** Task 3 (`bun run lint` quality-gate run)
- **Issue:** `bun run lint` surfaced 11 `lint/style/noNonNullAssertion` warnings in Phase 13's `shell-chrome.spec.ts` (a file this plan's `files_modified` frontmatter does not list). This plan's own Task 3 action text is explicit: "If either command reports anything beyond those two named findings anywhere in the tree — not just in this plan's own new file — that is a real QUAL-02 violation and must be fixed with a real code change, never a suppression comment." A baseline check (temporarily removing this plan's own new file and re-running `bun run lint`) confirmed these 11 warnings pre-date this plan and are not caused by it, but they are still a genuine, unaddressed QUAL-02 gap the milestone's own closing phase is required to close.
- **Fix:** Replaced each `!` non-null assertion with an explicit `if (!x) throw new Error(...)` narrowing check before use — mirrors `login-composition.spec.ts`'s own pre-existing convention for the identical `boundingBox()`-can-return-null pattern. Zero behavior change: same runtime null checks (previously via `expect(...).not.toBeNull()`), same assertions, same test outcomes.
- **Files modified:** `web/e2e/shell-chrome.spec.ts`
- **Verification:** `bun run check`/`bun run lint` both re-run clean (0 errors, only the 2 named baseline findings); `web/e2e/shell-chrome.spec.ts` re-run live (4/4 passed); full `bun run test:e2e` re-run clean (68/68 passed) after the fix.
- **Committed in:** `5e28749` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (3 Rule 1 test-authoring bugs discovered mid-authoring, 1 Rule 1 real pre-existing QUAL-02 violation outside this plan's own file scope)
**Impact on plan:** All four were necessary corrections surfaced by actually running the new tests live against the real app and by running the full quality-gate commands as instructed — exactly the kind of finding this final verification phase exists to catch. No scope creep: no functional/behavioral code was touched, only test authoring and one lint-only code-quality fix.

## Issues Encountered

None beyond the four deviations above — every live test run (Task 1's tracer, Task 2's 7 additional tests, the full `bun run test:e2e` re-runs) completed cleanly on retry, no live-network flake, no magic-code rate-limit hit, zero residual test data left behind (CLI sweeps confirmed clean for both `fundos` and `tarefas` after every run).

## Milestone Tech Debt Carried Forward

Per this plan's own Task 3 instructions, re-read and re-confirmed accurate against the current code (neither item touched by this plan — read-only confirmation, not a fix), following the same logged-not-silently-dropped pattern `.planning/milestones/v1.1-MILESTONE-AUDIT.md`'s "Known Issues" section used for v1.1's closing. This is the record the eventual `/gsd-complete-milestone v1.2` audit should read:

- **WR-01** (`.planning/phases/16-entity-screen-row-actions-delete-confirmation/16-REVIEW.md`): No type-level invariant enforces that any entity with `capabilities.delete: true` also has `capabilities.create: true`. `EntityScreen.svelte`'s post-delete focus-restoration fallback unconditionally targets `[data-testid="entity-create-start"]`, which only exists when `capabilities.create` is also `true`. All 9 current entities satisfy this pairing (confirmed unchanged in this plan's own read of `EntityScreen.svelte:432-434` and every `defs/*.ts` file), so this is not a live bug — but nothing in `EntityConfig`'s type (`types.ts:33`) prevents a future entity from breaking it, at which point a successful delete would silently drop keyboard focus to `<body>` with no visible/announced feedback.
- **WR-03** (same file): A hung `db.transact` during delete leaves the `AlertDialog` permanently undismissable — `escapeKeydownBehavior`/`interactOutsideBehavior` are both `"ignore"` while `deleteBusy` is `true` (confirmed unchanged in this plan's own read of `EntityScreen.svelte:818-819`), and there is no timeout/abort path if the awaited `db.transact(...)` promise never settles. Same class of edge case as any other in-flight-write UI in this app; not new to this phase; not fixed here per this plan's own explicit read-only-confirmation instruction (fixing it would be scope creep at the close of the milestone).

(WR-02 — no accessible `aria-busy`/`aria-live` signal during delete — was already fixed in Phase 16 Plan 02, per `EntityScreen.svelte:839` (`aria-busy={deleteBusy}`), confirmed present and unchanged.)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- This was the final plan of the final phase (17) of the v1.2 "Lapidação de UI" milestone. All 6 phases (12-17) are now complete; all 24/24 v1.2 requirements are marked complete in `REQUIREMENTS.md`; `ROADMAP.md`'s Phase 17 row and milestone header are updated accordingly.
- Full milestone-scale proof, confirmed live in this plan: 68/68 Playwright tests passing in one sequential `bun run test:e2e` run; `bun run check`/`bun run lint` both clean with zero new findings versus the v1.1 baseline across the whole v1.2 diff.
- **No blockers.** The only open items are the two logged, non-blocking WR-01/WR-03 tech-debt notes above (unchanged from Phase 16, explicitly not fixed here per this plan's own scope).
- Recommended next step: `/gsd-complete-milestone v1.2` (optionally preceded by `/gsd-audit-milestone` for an independent pre-archive audit), to close out v1.2 and prepare `PROJECT.md`/`ROADMAP.md` for the next milestone cycle.

---
*Phase: 17-cross-phase-verification-quality-gates*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: web/e2e/cross-phase-verification.spec.ts
- FOUND: web/README.md
- FOUND: web/e2e/shell-chrome.spec.ts
- FOUND: .planning/phases/17-cross-phase-verification-quality-gates/17-02-SUMMARY.md
- FOUND: commit cef5ef4
- FOUND: commit 5e28749
