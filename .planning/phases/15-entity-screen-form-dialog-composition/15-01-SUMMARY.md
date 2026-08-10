---
phase: 15-entity-screen-form-dialog-composition
plan: 01
subsystem: ui
tags: [svelte, tailwind, shadcn-svelte, playwright, dialog, forms]

requires:
  - phase: 14-entity-screen-header-loading-empty-states
    provides: "EntityScreen.svelte's page-header/loading/empty-state structure — this plan touches only the Dialog/form section (lines ~516-729), left untouched by Phase 14"
provides:
  - "space-y-4/space-y-2 two-tier spacing scale across EntityScreen.svelte's Dialog field/link/xorLink wrappers"
  - "Dialog.Description (reusing config.descricao) + Dialog.Footer composition replacing the ad hoc submit/cancel markup"
  - "busy boolean + LoaderCircle spinner on entity-submit, guarding the entire validation+queryOnce+transact flow (double-submit race closed)"
  - "required-field visual indicator (text-destructive span) driven by config.fields[].required, at the single shared field-Label render site"
  - "web/e2e/entities-form-dialog-composition.spec.ts — 4 dedicated live Playwright tests proving ENTFRM-05/06/07/08"
affects: [16-entity-screen-row-actions-delete-confirmation, 17-cross-phase-verification-quality-gates]

actuals:
  tokens: 5900
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "EntityScreen.svelte's Dialog/form composition mirrors LoginScreen.svelte's busy/spinner + space-y-4/space-y-2 pattern exactly"
    - "Required-field indicator is a single shared render site inside the field Label loop, never duplicated per field-kind branch"
    - "Spacing-scale Playwright proof via getComputedStyle(marginBlockEnd) as deterministic primary evidence, with one same-control-type boundingBox comparison for a visual two-tier sanity check — avoids cross-control-type (native <input> vs. flex <textarea>/Select.Trigger) subpixel rendering noise unrelated to the actual applied CSS"

key-files:
  created:
    - web/e2e/entities-form-dialog-composition.spec.ts
  modified:
    - web/src/lib/entities/EntityScreen.svelte

key-decisions:
  - "Plan-checker deviation (applied during Task 1, as instructed): `busy = true` is set immediately after the `if (busy) return;` re-entrancy guard — not right before the transact `try` block as the plan's literal action text specified — and the entire validation + queryOnce + transact flow (not just the transact try/catch) is wrapped in an outer try/finally that resets `busy = false` on every exit path, including early-return validation failures. The plan's literal placement left a race window: `busy` was only set true after the async parent-existence-check loop (`await db.queryOnce(...)`), so a rapid double-click on entity-submit could slip through and fire two db.transact calls for link-bearing entities (tarefas, tickets, subtarefas, templatesRotina). The fix is a small, surgical relocation of where the flag is set/reset — no new validation logic, no change to any existing error message or branch order."
  - "ENTFRM-05's dedicated Playwright proof (Test 1) uses getComputedStyle(marginBlockEnd) as primary, deterministic evidence rather than a pure boundingBox() pixel-delta comparison across heterogeneous control kinds. Debugging showed a native <input> (default display:inline-block, unlike <textarea>/Select.Trigger which are explicitly flex) can transiently render a few subpixels off from its final position during webfont load — a rendering-engine/font-load race, not a spacing defect (confirmed: the actual applied CSS margin is uniformly 8px/16px for every field kind via getComputedStyle, independent of any font-load timing)."

requirements-completed: [ENTFRM-05, ENTFRM-06, ENTFRM-07, ENTFRM-08]

coverage:
  - id: D1
    description: "Uniform two-tier space-y-4/space-y-2 spacing scale across every field/link/xorLink wrapper in the create/edit Dialog, proven both structurally (Task 1) and via dedicated live Playwright coverage"
    requirement: ENTFRM-05
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-dialog-composition.spec.ts#ENTFRM-05: tarefas create Dialog uses a uniform two-tier space-y-4/space-y-2 spacing scale across fields and links"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dialog.Description (reusing config.descricao) + Dialog.Footer (wrapping entity-submit/entity-cancel, preserved testid/type/onclick) composition replacing the previous ad hoc footer markup"
    requirement: ENTFRM-06
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-dialog-composition.spec.ts#ENTFRM-06: tarefas create Dialog composes Dialog.Description (reusing config.descricao) and Dialog.Footer (wrapping entity-submit/entity-cancel)"
        status: pass
    human_judgment: false
  - id: D3
    description: "busy/spinner submit state genuinely observable during the live db.transact write, resetting on both success and error paths, with the plan-checker-flagged double-submit race closed"
    requirement: ENTFRM-07
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-dialog-composition.spec.ts#ENTFRM-07: submitting fundos' create Dialog shows a genuinely observable busy/spinner state on entity-submit during the live write"
        status: pass
    human_judgment: false
  - id: D4
    description: "Required-field visual indicator appears only where config.fields[].required === true, across full-CRUD (tarefas) and restricted (instanciasRotina) capability classes, and is structurally inert (no Dialog trigger at all) for the read-only class (logInferenciaClaude)"
    requirement: ENTFRM-08
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-dialog-composition.spec.ts#ENTFRM-08: required-indicator appears only on required fields, across full-CRUD and restricted capability classes, and is structurally inert for the read-only class"
        status: pass
    human_judgment: false
  - id: D5
    description: "Zero regression across all 9 entities and all 3 capability classes for every field kind (text/textarea/number/boolean/date/select), plus links/xorLink — full pre-existing-plus-new Playwright suite (54 tests) passes with zero failures/skips; svelte-check/tsc and Biome remain clean"
    verification:
      - kind: e2e
        ref: "cd web && bunx playwright test e2e/entities-projeto-etapa-tarefa.spec.ts --project=authed — 5 passed (Task 1)"
        status: pass
      - kind: e2e
        ref: "cd web && bunx playwright test e2e/entities-form-restyle.spec.ts e2e/entities-fundos.spec.ts e2e/entities-ticket-subtarefa.spec.ts e2e/entities-rotina-log.spec.ts e2e/entities-table-restyle.spec.ts --project=authed — 20 passed (Task 2)"
        status: pass
      - kind: e2e
        ref: "cd web && bun run test:e2e — 54 passed, 0 failed, 0 skipped (Task 3)"
        status: pass
      - kind: unit
        ref: "cd web && bun run check — 0 errors; cd web && bun run lint — 0 errors, exit 0"
        status: pass
      - kind: unit
        ref: "grep -nE 'oklch\\(|#[0-9a-fA-F]{3,8}\\b|rgba?\\(' across EntityScreen.svelte and the new spec — zero matches"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-10
status: complete
---

# Phase 15 Plan 01: Entity Screen — Form & Dialog Composition Summary

**Restructured `EntityScreen.svelte`'s create/edit Dialog with a space-y-4/space-y-2 spacing scale, Dialog.Description/Footer composition, a busy/spinner submit state (with a plan-checker-flagged double-submit race closed), and a required-field indicator — proven live across all 9 entities and all 3 capability classes, including a dedicated new Playwright spec.**

## Performance

- **Duration:** ~55 min (including two real-world magic-code rate-limit cooldowns, ~20 min combined, while re-running the full-suite verification)
- **Started:** 2026-08-10T16:20:00Z (approx.)
- **Completed:** 2026-08-10T17:18:00Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 2 (1 new, 1 modified)

## Accomplishments
- Restructured `EntityScreen.svelte`'s Dialog/form block (lines ~516-729 as mapped by 15-PATTERNS.md): added `class="space-y-4"` to the `<form>`, `class="space-y-2"` to every field/link/xorLink wrapper `<div>`, a `Dialog.Description` reusing `config.descricao` (the same string already rendered as `entity-description` in the page header), and a `Dialog.Footer` wrapping the unchanged `entity-submit`/`entity-cancel` Buttons.
- Added a `busy` boolean + `LoaderCircle` spinner on `entity-submit`, mirroring `LoginScreen.svelte`'s `ocupado`/`LoaderCircle` pattern exactly — disabled + spinning for the duration of the live validation + parent-existence-check + `db.transact(...)` flow, reset via `finally` on every exit path.
- Added a `text-destructive` required-indicator span at the single shared field-Label render site (`{#each editableFields() as f}`), driven purely by `config.fields[].required` — automatically covers all 6 field kinds without per-kind special-casing, with zero change to `handleSubmit`'s existing validation logic or error messages.
- Applied the plan-checker's flagged deviation during Task 1 (see Decisions below): relocated `busy = true` to immediately after the re-entrancy guard, and wrapped the entire async validation/queryOnce/transact flow (not just the transact `try`/`catch`) in an outer `try`/`finally`.
- Created `web/e2e/entities-form-dialog-composition.spec.ts` with 4 dedicated live tests proving ENTFRM-05 (spacing-scale, via deterministic `getComputedStyle` assertions plus a same-control-type visual gap comparison), ENTFRM-06 (`Dialog.Description`/`Dialog.Footer` composition), ENTFRM-07 (a genuinely observable busy/spinner state during a real live write), and ENTFRM-08 (required-indicator present/absent correctly across capability classes).
- Ran the full pre-existing-plus-new Playwright suite (`bun run test:e2e`): 54 passed, 0 failed, 0 skipped. `bun run check` and `bun run lint` both clean.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Field/link/xorLink spacing + required indicator + Dialog.Description/Footer + busy/spinner submit** - `079dbc3` (feat)
2. **Task 2: Verify zero regression across remaining field kinds and all 3 capability classes** - no commit (zero fixes needed; all 20 pre-existing specs in scope passed unmodified against the restructured Dialog)
3. **Task 3: Dedicated Playwright coverage for ENTFRM-05/06/07/08 + full-suite regression** - `5f73531` (test)

**Plan metadata:** committed separately per the `<final_commit>` step below.

## Files Created/Modified
- `web/src/lib/entities/EntityScreen.svelte` (modified) - Dialog/form block restructured: spacing scale, Dialog.Description/Footer, busy/spinner submit (with the double-submit race closed), required-field indicator
- `web/e2e/entities-form-dialog-composition.spec.ts` (new) - 4 dedicated live Playwright tests proving ENTFRM-05/06/07/08

## Decisions Made
- **Plan-checker deviation, applied during Task 1 as instructed (not a separate task):** the plan's literal action text placed `busy = true` immediately before the pre-existing `try { ... }` block containing the two `await db.transact(...)` call sites — i.e., *after* the async parent-existence-check loop (`await db.queryOnce(...)` for entities with links/xorLink). This left a race window: a rapid double-click on `entity-submit` could slip past the `if (busy) return;` guard and fire two `db.transact` calls for link-bearing entities (tarefas, tickets, subtarefas, templatesRotina). Fixed by setting `busy = true` immediately after the re-entrancy guard (before `formError = null;`), and wrapping the entire validation + queryOnce + transact flow in an outer `try`/`finally` that resets `busy = false` on every exit path — including early-return validation failures, not just the transact success/error paths. This was a small, surgical relocation of where the flag is set/reset; no new validation rule was added, and CONTEXT.md's scope boundary (`handleSubmit` untouched beyond the busy boolean) still holds.
- Chose `getComputedStyle(marginBlockEnd)` as the primary, deterministic proof mechanism for ENTFRM-05's two-tier spacing scale in the new spec, rather than relying purely on `boundingBox()` pixel deltas across heterogeneous control kinds. Debugging (documented below) showed a native `<input>` (default `display:inline-block`) can render a few subpixels off from `<textarea>`/`Select.Trigger` (both explicitly `flex`) during webfont load — a font-load race, not a spacing defect. The computed-style assertion is immune to that rendering-engine nuance while still proving the actual CSS margin values are uniform; one same-control-type `boundingBox()` comparison is retained for a genuine "is the space-y-4 gap visually bigger than the space-y-2 gap" sanity check.

## Deviations from Plan

### Auto-fixed Issues

**1. [User-instructed deviation, applied per Task 1's explicit brief] Closed a busy-guard double-submit race for link-bearing entities**
- **Found during:** Task 1 (plan-checker review, provided as an explicit instruction before execution began)
- **Issue:** The plan's literal action text set `busy = true` only immediately before the `try` block wrapping both `db.transact` call sites — after the async parent-existence-check (`queryOnce`) loop that runs for entities with `links`/`xorLink`. A rapid double-click on `entity-submit` could therefore slip through the `if (busy) return;` guard during that async window and cause two `db.transact` calls.
- **Fix:** Moved `busy = true` to immediately after the `if (busy) return;` guard, and wrapped the entire validation + queryOnce + transact flow (previously only the transact `try`/`catch`) in a new outer `try`/`finally`, so `busy` resets on every exit path.
- **Files modified:** `web/src/lib/entities/EntityScreen.svelte`
- **Verification:** `cd web && bun run check` (0 errors); `cd web && bunx playwright test e2e/entities-projeto-etapa-tarefa.spec.ts --project=authed` (5 passed, incl. tarefas' links-bearing CRUD round trip); full-suite regression (54 passed) confirms no behavioral regression to any validation branch.
- **Committed in:** `079dbc3` (Task 1 commit)

**2. [Test-infrastructure discovery, not a shipped-code deviation] Webfont-load race in the new spec's spacing-gap measurement**
- **Found during:** Task 3, while writing/running `entities-form-dialog-composition.spec.ts`'s ENTFRM-05 test
- **Issue:** A first-pass `boundingBox()`-only gap comparison (mirroring `login-composition.spec.ts`'s technique) flaked intermittently (~1-2.5px off a 0.5px tolerance) comparing tarefas' `titulo` (text, native `<input>`) field's gap against `descricao` (textarea) and `tipoPrazo` (select). Root-caused via `getComputedStyle`/`document.fonts.ready` experiments to a webfont-load race specific to the native `<input>`'s default `display:inline-block` (vs. `<textarea>`/`Select.Trigger`'s explicit `flex`) — confirmed the actual CSS margin (`marginBlockEnd`) is uniformly `8px`/`16px` for every field kind regardless of the race.
- **Fix:** Rewrote the test to assert the actual CSS margin values via `getComputedStyle` as primary, deterministic evidence, with a single same-control-type `boundingBox()` "strictly greater than" comparison retained for the visual two-tier sanity check. No production code (`EntityScreen.svelte`) was changed for this — the underlying spacing was already correct; only the test's measurement technique needed to be more robust.
- **Files modified:** `web/e2e/entities-form-dialog-composition.spec.ts` (test-only; no `EntityScreen.svelte` change from this item)
- **Verification:** Re-ran the isolated spec twice in a row post-fix — deterministic pass both times, then confirmed again inside the full 54-test suite run.

---

**Total deviations:** 1 auto-fixed under explicit user instruction (busy-guard race, Rule-1-shaped bug fix) + 1 test-infrastructure discovery (no production code impact).
**Impact on plan:** Both necessary for correctness (the busy-guard fix) and test robustness (the spacing-gap measurement fix). No scope creep — no new validation rule, no new UI behavior beyond what the plan's 4 requirements specify.

## Issues Encountered

**Real-world magic-code send rate-limit during verification (infrastructure, not a code issue).** Across this session's many `--project=authed` Playwright invocations (each triggering a fresh `sendMagicCode` call via the `setup` project dependency), InstantDB's magic-code endpoint appears to have rate-limited further sends to `tp@rbrasset.com.br` for a period after roughly 15-20 sends within ~1.5 hours. This blocked the Task 3 final full-suite (`bun run test:e2e`) run for a while — all *targeted* verification (Task 1's tarefas CRUD spec, Task 2's 20-test cross-entity/capability-class regression, and the new spec in isolation, twice, deterministically) had already passed with real magic-code round trips *before* the lockout began. Resolved by backing off (two backgrounded cooldown waits, ~5 min then ~15 min) before the next attempt rather than continuing to hammer sends, which would risk extending any sliding-window lockout. Once the auth handshake succeeded again, the full suite ran clean (54 passed, 0 failed, 0 skipped) on the very next attempt. A separate, unrelated transient CLI→InstantDB SSL handshake timeout (`_ssl.c:993: The handshake operation timed out`) caused one spurious failure on the first full-suite attempt after the lockout cleared (in `entities-table-restyle.spec.ts`'s `beforeEach` CLI cleanup hook, unrelated to any file this plan touched); a second full-suite run confirmed 54/54 clean, consistent with the project's own documented "occasional live-email-timing test flake... deferred, non-blocking" precedent (STATE.md Deferred Items) extending naturally to this kind of live-network hiccup.

## User Setup Required

None - no external service configuration required. (The magic-code auth round trip used during verification reads the pre-existing, already-authorized `tp@rbrasset.com.br` inbox per PROJECT.md C-10 — no new setup.)

## Next Phase Readiness

- Phase 15 (ENTFRM-05/06/07/08) is fully complete and independently verified: `EntityScreen.svelte`'s Dialog/form structure is proven live across all 9 entities and all 3 capability classes, with zero regression to the full 54-test Playwright suite.
- Phase 16 (Entity Screen — Row Actions & Delete Confirmation) can build directly on top of this screen: `handleDelete`/`window.confirm()` were explicitly untouched by this plan (confirmed via `grep -c 'window.confirm'` staying at 1 throughout), and the `entity-submit`/`entity-cancel` Buttons' testid/type/onclick contracts are unchanged.
- No blockers or concerns carried forward. The magic-code rate-limit encountered mid-session is a transient, self-resolving external condition (confirmed cleared on retry), not a project-level blocker — future phases' verification runs should avoid triggering many rapid `--project=authed` re-runs in short succession where avoidable (e.g., prefer `--project=authed` only after confirming code changes are otherwise correct via `bun run check`, rather than as a first-pass debug loop).

---
*Phase: 15-entity-screen-form-dialog-composition*
*Completed: 2026-08-10*

## Self-Check: PASSED

Both created/modified files (`web/src/lib/entities/EntityScreen.svelte`, `web/e2e/entities-form-dialog-composition.spec.ts`) confirmed present on disk; both task commit hashes (`079dbc3`, `5f73531`) confirmed present in git history.
