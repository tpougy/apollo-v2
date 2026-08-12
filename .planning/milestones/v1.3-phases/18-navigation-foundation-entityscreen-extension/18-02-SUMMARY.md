---
phase: 18-navigation-foundation-entityscreen-extension
plan: 02
subsystem: ui
tags: [svelte5, entityscreen, instaql, playwright]

requires:
  - phase: 18-01
    provides: "EntityConfig.nav?/navTitulo?, registry.ts navConfigs, Shell.svelte Route/topbar restructuring (landed first in the shared working tree, no isolation between wave-1 plans)"
provides:
  - "EntityScreen.svelte's scopeWhere?/presetLinks? additive props, both defaulting to null"
  - "buildQuery's scopeWhere-aware $ merge (`scopeWhere ? { where: scopeWhere } : {}`)"
  - "startCreate's presetLinks-aware selectedLinks merge (`presetLinks ? { ...links, ...presetLinks } : links`)"
affects: ["19", "20"]

actuals:
  tokens: 376
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Additive optional-prop extension with a provable no-op path: every new prop defaults to null and every consuming expression degrades to today's exact literal when the value is null — the generic-engine extension pattern Phase 19/20's nested sections build on."

key-files:
  created: []
  modified:
    - web/src/lib/entities/EntityScreen.svelte

key-decisions:
  - "Verified byte-identical behavior via a controlled A/B full-suite run instead of a single 'edit nothing, suite stays green' run, because Plan 18-01 (wave-1, no worktree isolation, `workflow.use_worktrees: false`) had already landed its topbar/registry changes in the shared working tree before this plan's verification ran. The plan's own <done> text assumed running 'against the CURRENT (pre-Plan-18-01/18-03) topbar' — that assumption no longer held once 18-01 finished first in the same tree. See Deviations for the full A/B methodology and result."
  - "Did not add new unit/e2e tests for the non-null scopeWhere/presetLinks branches (per CONTEXT.md: 'the entire pre-existing Playwright suite is the regression proof, not new tests') — no caller in Phase 18 passes non-null values (Shell.svelte omits both props), so there is nothing yet to exercise those branches against; Phase 19/20 callers will be the first real exercise, proven by their own phase's verification."

patterns-established:
  - "Additive optional-prop merge with a provable null-degrades-to-today path — the template every future EntityScreen extension point should follow."

requirements-completed: [NEST-01]

coverage:
  - id: D1
    description: "EntityScreen.svelte declares scopeWhere?/presetLinks? (both default null), wired into buildQuery's $ key and startCreate's selectedLinks, with zero if (config.etype === ...) branch anywhere in the diff"
    requirement: "NEST-01"
    verification:
      - kind: e2e
        ref: "cd web && bun run test:e2e (full 3-project suite) — A/B run with vs without this diff, both against the same post-18-01 baseline commit; identical 28 non-passing / 43 passing test-ID sets in both runs (diff verified with `diff` over sorted spec:line ID lists — zero difference)"
        status: pass
      - kind: other
        ref: "grep -c 'if (config.etype\\|if (cfg.etype' web/src/lib/entities/EntityScreen.svelte"
        status: pass
      - kind: other
        ref: "cd web && bun run check && bunx biome check src/lib/entities/EntityScreen.svelte (both clean on this file)"
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-08-11
status: complete
---

# Phase 18 Plan 02: EntityScreen scopeWhere/presetLinks Extension Summary

**EntityScreen.svelte gains additive, optional `scopeWhere`/`presetLinks` props (both `null`-default) feeding `buildQuery`'s `where` clause and `startCreate`'s `selectedLinks`, verified byte-identical to today via a controlled A/B full-Playwright-suite comparison — zero etype branching anywhere in the diff.**

## Performance

- **Duration:** ~95 min (includes two full 71-test Playwright suite runs, ~30 min each)
- **Completed:** 2026-08-11
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `EntityScreen.svelte` now accepts `scopeWhere?: Record<string, unknown> | null` and `presetLinks?: Record<string, string> | null`, both defaulting to `null`, exactly matching spec-ui.md §2.1's literal type signature.
- `buildQuery`'s returned `$` sub-expression changed from the hardcoded `{}` to `scopeWhere ? { where: scopeWhere } : {}` — the only line touched inside that function.
- `startCreate`'s `selectedLinks = links;` changed to `selectedLinks = presetLinks ? { ...links, ...presetLinks } : links;` — the only line touched inside that function.
- Zero `if (config.etype === ...)` / `if (cfg.etype === ...)` anywhere in the diff (`grep -c` returns 0).
- Proved zero regression on the `null`/`null` default path via a controlled A/B comparison of the full pre-existing Playwright suite (see Deviations below for why a single "unedited suite stays green" run was not sufficient in this execution's actual environment, and what was done instead).

## Task Commits

1. **Task 1: Add additive scopeWhere/presetLinks props to EntityScreen, wired to buildQuery and startCreate** — `239aaea` (feat)

**Plan metadata:** this commit (see Final Commit below)

## Files Created/Modified

- `web/src/lib/entities/EntityScreen.svelte` — declares `scopeWhere?`/`presetLinks?` props; `buildQuery` and `startCreate` merge them additively at their two existing integration points; every other line unchanged (11 insertions, 3 deletions, verified via `git diff --stat`).

## Decisions Made

- **A/B verification methodology (see Deviations for full detail):** rather than a single suite run against an assumed-clean pre-18-01 baseline, ran the full 71-test Playwright suite twice — once with `EntityScreen.svelte` reverted to its pre-this-plan committed state (baseline), once with this plan's diff reapplied (patched) — both against the identical, already-landed 18-01 commit underneath. Compared the two runs' pass/fail test-ID sets with `diff`; they are identical (28 non-passing, 43 passing, same test IDs in both runs). This is a strictly stronger proof of "byte-identical when both props are null" than a single "the suite doesn't need edits" run, because it isolates this plan's own diff as the only variable between the two runs.
- No new unit/e2e tests written for the non-null `scopeWhere`/`presetLinks` branches — per CONTEXT.md's explicit instruction, the existing suite (proving the null/null path) is the acceptance criterion, not new tests; no Phase 18 caller ever passes non-null values.

## Deviations from Plan

### Auto-fixed Issues

None — the code diff itself is exactly as specified in the plan's `<action>`, verified line-for-line against `git diff`.

### Verification methodology deviation (documented per user instruction, not a Rule 1-4 auto-fix)

**Environmental mismatch: plan assumed pre-18-01 topbar state; actual execution ran post-18-01.**

- **What the plan assumed:** The plan's `<done>` criterion states "this run happens against the CURRENT (pre-Plan-18-01/18-03) topbar, which is exactly the point: this plan's own proof is independent of the nav restructuring landing first" — i.e., it assumed this plan (18-02) would execute and verify *before* Plan 18-01's topbar/registry changes landed in the shared working tree.
- **What actually happened:** This project has no worktree isolation (`workflow.use_worktrees: false`, `git.branching_strategy: none`) and both wave-1 plans (18-01, 18-02) ran directly against the same working directory. Plan 18-01 committed its two tasks (`5c97ba7`, `029a3c0`) and its own completion docs (`d5e4712`) *before* this plan's verification step ran. By the time `bun run test:e2e` was first run for this plan, the repo already contained 18-01's 6-item topbar restructuring, including removal of the `nav-etapas`/`nav-templatesRotina`/`nav-subtarefas`/`nav-tarefas` testids (NAV-02) — but NOT yet the corresponding e2e-spec migration to `gotoNested`, which RESEARCH.md's own Phase Requirements table scopes to a *separate*, not-yet-executed plan (`18-03-PLAN.md` exists in the phase directory, confirmed via `ls`).
- **Effect:** A first, literal "run the full suite, expect zero failures" attempt genuinely fails — 28 of 71 tests fail or don't run, all in `cross-phase-verification.spec.ts`, `entities-delete-confirmation.spec.ts`, `entities-form-dialog-composition.spec.ts`, `entities-form-restyle.spec.ts`, `entities-header-states.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-rotina-log.spec.ts`, `entities-ticket-subtarefa.spec.ts`, and `shell-chrome.spec.ts` — every one of them a file RESEARCH.md's own "Phase Requirements" / "Pitfall 1" analysis had already flagged as needing NAV-05's dead-testid-to-`gotoNested` migration (confirmed via `grep -rln 'nav-etapas\|nav-templatesRotina\|nav-subtarefas\|nav-tarefas' web/e2e` — 8 files, 28 hits, still present).
- **How resolved:** Rather than treat this as this plan's regression (Rule 1) or block on a checkpoint (there is no human available in this autonomous run and the plan's own text pre-authorizes resolving ambiguity via CONTEXT.md/RESEARCH.md/spec-ui.md), ran a controlled A/B comparison to isolate this plan's own diff as the sole variable:
  1. Saved this plan's diff as a patch (`git diff` → file), reverted `EntityScreen.svelte` to its committed (pre-this-plan) state via `git checkout HEAD --`.
  2. Ran the full 71-test suite once, cleanly (killed all stray/overlapping Playwright+Vite processes first — two earlier attempts had accidentally overlapped due to the 120s foreground-timeout auto-backgrounding, producing cross-run `tarefas`-row `not_found` contamination from concurrent CRUD writes; both contaminated attempts were discarded). Result: **28 failed, 43 passed** (`e2e-baseline-clean.log`).
  3. Reapplied this plan's patch (`git apply`), confirmed `git diff --stat` matched exactly.
  4. Ran the full 71-test suite once more, cleanly. Result: **27 failed + 1 did-not-run, 43 passed** (`e2e-patched.log`) — the 1-test shift (`entities-ticket-subtarefa.spec.ts:353`) was a transient TLS handshake timeout in a Python CLI fixture subprocess call (`_ssl.c:993: The handshake operation timed out`), not a testid/behavior difference; that same test was already failing in the baseline run for the pre-existing `nav-subtarefas` dead-testid reason, and its downstream sibling test (`:407`) correspondingly shows as "did not run" instead of "failed" — a different manifestation of the same already-non-passing test, not a new failure.
  5. Extracted both runs' full pass/fail test-ID lists (`file.spec.ts:line:col`) and diffed them with `diff`: **zero difference** — the identical 28 test IDs are non-passing and the identical 43 are passing in both runs.
- **Conclusion:** This plan's diff introduces zero new test failures and fixes zero pre-existing failures — exactly the "byte-identical when both props are null" acceptance criterion, proven via the strongest form of comparison available given the environment's actual (post-18-01, pre-18-03) state. The 28 pre-existing non-passing tests are Plan 18-03's responsibility (NAV-05's e2e migration), not a defect introduced by this plan, and are unrelated to `EntityScreen.svelte`.
- **Files touched by this investigation:** none beyond `EntityScreen.svelte` itself (the revert/reapply cycle used `git checkout HEAD --` and `git apply` against a saved patch, never touching any file outside this plan's declared scope; no `git stash`, no `git clean`, no modification to any file outside `EntityScreen.svelte`).

---

**Total deviations:** 0 code deviations (Rules 1-4); 1 documented verification-methodology adaptation (required by an environmental condition outside this plan's control — concurrent wave-1 execution with no worktree isolation).
**Impact on plan:** None on the shipped diff, which is byte-for-byte what the plan's `<action>` specified. The verification path taken is strictly more rigorous than the plan's literal instruction and produces the same pass/fail conclusion the plan intended to prove.

## Issues Encountered

- Two early, discarded suite-run attempts accidentally overlapped in the same working directory (each individual `bun run test:e2e` invocation exceeded the tool's 120s foreground timeout and was auto-backgrounded; a second invocation was started before confirming the first had exited), causing concurrent CRUD writes against the same InstantDB `tarefas` rows and `net::ERR_CONNECTION_REFUSED` mid-run crashes. Resolved by killing all stray `playwright`/`vite` processes and re-running strictly one suite invocation at a time for both the baseline and patched runs used in the final A/B comparison above.
- The real magic-code email round trip (`auth.setup.ts`) hit InstantDB's per-email send rate limit on the first couple of attempts (multiple rapid resends within ~3 minutes) — resolved by waiting ~100s before the next attempt; unrelated to this plan's diff (auth flow untouched).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `EntityScreen.svelte`'s `scopeWhere`/`presetLinks` extension points are ready for Phase 19/20's Projetos/Rotinas/Tickets nested sections to consume (first real non-null callers).
- **Carry-forward for Plan 18-03 (or whichever plan owns NAV-05):** 28 e2e tests across `cross-phase-verification.spec.ts`, `entities-delete-confirmation.spec.ts`, `entities-form-dialog-composition.spec.ts`, `entities-form-restyle.spec.ts`, `entities-header-states.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-rotina-log.spec.ts`, `entities-ticket-subtarefa.spec.ts`, and `shell-chrome.spec.ts` still reference dead `nav-etapas`/`nav-templatesRotina`/`nav-subtarefas`/`nav-tarefas` testids or hardcoded `9`-entity counts, post-18-01. This is pre-existing, unrelated to this plan, and was already flagged in 18-RESEARCH.md's own Phase Requirements table and Pitfall 1 as 18-03's scope — recorded here again for visibility since this plan's verification run is what empirically confirmed the migration has not yet happened.

---
*Phase: 18-navigation-foundation-entityscreen-extension*
*Completed: 2026-08-11*
