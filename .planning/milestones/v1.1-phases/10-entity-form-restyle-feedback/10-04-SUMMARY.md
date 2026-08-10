---
phase: 10-entity-form-restyle-feedback
plan: 04
subsystem: testing
tags: [playwright, e2e, shadcn-svelte, bits-ui, select, instantdb]

requires:
  - phase: 10-entity-form-restyle-feedback
    provides: "10-01's pickDate() and 10-02's selectByText()/openAndReadSelectOptions() helpers in web/e2e/helpers/form-controls.ts, plus EntityScreen.svelte's full Dialog/Input/Textarea/Checkbox/Popover+Calendar/Select/Alert conversion"
provides:
  - "entities-rotina-log.spec.ts, entities-projeto-etapa-tarefa.spec.ts, entities-ticket-subtarefa.spec.ts fully converted to the shared role-based helpers, zero native .selectOption()/.locator('option')/date-.fill() call sites remaining anywhere in web/e2e/"
  - "bun run test:e2e fully green (39/39) in a single clean run — the phase-boundary proof that VERIFY-01's intent is satisfied now, not deferred to Phase 11 with a known-red suite in between"
  - "All three cross-plan WINDOWS.md deviation entries (ids 1-3, opened by 10-01) marked fixed"
affects: []

actuals:
  tokens: 3289
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Every native .selectOption()/.locator('option') call site across the phase's pre-existing specs now routes through selectByText()/openAndReadSelectOptions() (10-01/10-02's helpers) — zero duplicated per-call-site interaction logic anywhere in web/e2e/"
    - "Downstream assertions that depended on a hardcoded date literal (e.g. '2026-03-10') now assert against the value pickDate() actually returned, since the Calendar always picks day 15 of the currently-displayed month rather than a caller-specified date"
    - "toHaveValue() only applies to native input/textarea/select elements — once a field becomes a bits-ui Select.Trigger (a <button>), the equivalent live-value assertion is toHaveText() against the trigger's rendered label text"

key-files:
  created: []
  modified:
    - web/e2e/entities-rotina-log.spec.ts
    - web/e2e/entities-projeto-etapa-tarefa.spec.ts
    - web/e2e/entities-ticket-subtarefa.spec.ts

key-decisions:
  - "Kept every date/select/xorLink call site's surrounding test logic and assertions byte-identical beyond the interaction-strategy swap, per the plan's own must_haves — no assertion semantics changed, only how the value gets into/out of the DOM"
  - "Fixed one line outside the plan's explicit .selectOption() enumeration (Rule 1): entities-ticket-subtarefa.spec.ts's `expect(xor-parent-type).toHaveValue('tarefa')` targeted a native <select>'s .value property, which a bits-ui Select.Trigger button does not have — switched to toHaveText('tarefa'), matching the trigger's own {xorParentType} render"

requirements-completed: [ENTFRM-02, ENTFRM-03]

coverage:
  - id: D1
    description: "entities-rotina-log.spec.ts passes green against the restyled Select markup (field-tipoGeracao, link-antecessor), with zero .selectOption()/.locator('option') call sites remaining"
    requirement: ENTFRM-03
    verification:
      - kind: e2e
        ref: "web/e2e/entities-rotina-log.spec.ts — all 4 tests (WEB-06, WEB-07, WEB-09) via `bunx playwright test e2e/entities-rotina-log.spec.ts --project=authed`"
        status: pass
    human_judgment: false
  - id: D2
    description: "entities-projeto-etapa-tarefa.spec.ts passes green against the restyled Select and date-picker markup (field-dataInicioPrevista, field-dataPrevistaEstimada, link-fundo/link-projeto/link-etapa, field-tipoPrazo), with the persisted-date assertion checking the dynamically picked value"
    requirement: ENTFRM-02
    verification:
      - kind: e2e
        ref: "web/e2e/entities-projeto-etapa-tarefa.spec.ts — all 4 tests (WEB-03, WEB-04, WEB-05, T-04-04) via `bunx playwright test e2e/entities-projeto-etapa-tarefa.spec.ts --project=authed --no-deps`"
        status: pass
    human_judgment: false
  - id: D3
    description: "entities-ticket-subtarefa.spec.ts passes green against the restyled Select/xorLink/date-picker markup (field-dataRecebimento, field-tipoPrazo, xor-parent-type, link-tarefa/link-ticket across all 6 subtarefa test cases)"
    requirement: ENTFRM-02
    verification:
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts — all 7 tests via `bunx playwright test e2e/entities-ticket-subtarefa.spec.ts --project=authed --no-deps`"
        status: pass
    human_judgment: false
  - id: D4
    description: "bun run test:e2e is fully green (39/39) in a single clean run against the live InstantDB app — no pre-existing spec left red at this phase's boundary"
    verification:
      - kind: e2e
        ref: "`bun run test:e2e` — 39 passed (4.1m), zero failures, all three projects (setup/authed/anon)"
        status: pass
    human_judgment: false

duration: 76min (wall clock, ~10min active work — remainder was InstantDB magic-code send-rate cooldown, see Issues Encountered)
completed: 2026-08-10
status: complete
---

# Phase 10 Plan 04: Fix Remaining e2e Specs + Full-Suite Green Summary

**The three pre-existing e2e spec files broken by this phase's Dialog/Select/date-picker restyle — `entities-rotina-log.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts` — are now converted to the shared `pickDate`/`selectByText`/`openAndReadSelectOptions` helpers, and `bun run test:e2e` is fully green (39/39) in one clean run, closing out this phase's own boundary requirement before Phase 11.**

## Performance

- **Duration:** 76 min wall clock; ~10 min of actual editing/verification work. The remaining ~66 min was spent waiting out InstantDB's magic-code send-rate limit (429 "Too many verification codes requested for this email"), triggered by this plan and the concurrently-running 10-03 plan both authenticating against the same live inbox in the same short window. See Issues Encountered.
- **Started:** 2026-08-09T22:31:00-03:00 (approx, session start)
- **Completed:** 2026-08-10T02:47:15Z
- **Tasks:** 3/3 completed
- **Files modified:** 3 (across 3 commits, all `fix`)

## Accomplishments

- `entities-rotina-log.spec.ts`: `field-tipoGeracao`'s option enumeration and both `.selectOption()` calls, plus `link-antecessor`'s option enumeration and `.selectOption({label})` call, converted to `openAndReadSelectOptions`/`selectByText`. No date fields in this file.
- `entities-projeto-etapa-tarefa.spec.ts`: `field-dataInicioPrevista`/`field-dataPrevistaEstimada` `.fill()` calls converted to `pickDate`, with the `dataInicioPrevista` persistence assertion now checking the dynamically-picked value instead of the hardcoded `"2026-03-10"` literal; `link-fundo`/`link-projeto`/`link-etapa` `.selectOption({label})` calls and `field-tipoPrazo`'s option enumeration/`.selectOption("hard")` converted to `selectByText`/`openAndReadSelectOptions`.
- `entities-ticket-subtarefa.spec.ts`: `field-dataRecebimento` `.fill()` converted to `pickDate`; `field-tipoPrazo`'s option enumeration/`.selectOption("hard")` converted; every `xor-parent-type`/`link-tarefa`/`link-ticket` `.selectOption(...)` pair across all 6 subtarefa test cases (tarefa-parent, ticket-parent, no-parent-blocked, switch-before-submit, switch-on-edit, boolean-round-trip) converted to `selectByText`.
- **Live-discovered bug fixed (Rule 1):** `entities-ticket-subtarefa.spec.ts`'s `expect(page.getByTestId("xor-parent-type")).toHaveValue("tarefa")` targeted a property (`.value`) that only exists on native `<input>`/`<textarea>`/`<select>` elements — once `xor-parent-type` became a bits-ui `Select.Trigger` (a `<button>`), this assertion was structurally unprovable. Fixed to `toHaveText("tarefa")`, matching the trigger's own `{xorParentType}` rendered label.
- Zero native `.selectOption()`/`.locator("option")` call sites remain anywhere in `web/e2e/` — confirmed by grep across all three files (and, transitively, across the whole phase given 10-01 already fixed `entities-fundos.spec.ts`'s one date-fill site and 10-02 built the helpers used here).
- `bun run test:e2e` — all 39 tests across `setup`/`authed`/`anon` pass in a single clean run, including every spec touched by 10-01/10-02/10-03 (`entities-form-restyle.spec.ts`, `entities-fundos.spec.ts`, `entities-table-restyle.spec.ts`, `login-flow.spec.ts`, `shell-nav.spec.ts`, `routine-job*.spec.ts`, `no-leakage.spec.ts`, `design-system.spec.ts`, `auth.spec.ts`) plus this plan's three files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix entities-rotina-log.spec.ts's Select call sites** - `d7a530e` (fix)
2. **Task 2: Fix entities-projeto-etapa-tarefa.spec.ts's date-fill and Select call sites** - `e5842cc` (fix)
3. **Task 3: Fix entities-ticket-subtarefa.spec.ts's date-fill and Select/xorLink call sites; run the full suite** - `e00b62f` (fix)

## Files Created/Modified

- `web/e2e/entities-rotina-log.spec.ts` - `field-tipoGeracao`/`link-antecessor` Select call sites converted to shared helpers
- `web/e2e/entities-projeto-etapa-tarefa.spec.ts` - date-fill and Select call sites converted; persisted-date assertion updated to check the dynamic value
- `web/e2e/entities-ticket-subtarefa.spec.ts` - date-fill, Select, and xorLink call sites converted across all subtarefa test cases; one `toHaveValue`→`toHaveText` bug fix

## Decisions Made

- Kept every test's surrounding logic and assertion semantics byte-identical beyond the interaction-strategy swap — per the plan's `must_haves`, this plan changes *how* a value gets into the form, never *what* is asserted.
- Reused the existing `authed` project's `storageState` (`web/e2e/.auth/user.json`) via `--no-deps` for the two mid-plan targeted verification runs (Tasks 2 and 3's own file), rather than re-running the `setup` project's fresh login each time — avoided burning further magic-code sends against an already-strained rate limit while still exercising the real, live-authenticated app.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `xor-parent-type`'s `toHaveValue("tarefa")` assertion was structurally unprovable against a bits-ui `Select.Trigger`**
- **Found during:** Task 3's live Playwright verify run (initial read-through before running, confirmed by the passing test afterward)
- **Issue:** `toHaveValue()` only applies to elements with a native `.value` property (`input`/`textarea`/`select`). 10-02 converted `xor-parent-type` to a bits-ui `Select.Trigger`, which renders as a `<button>` — this line's original form would either throw or silently mis-assert once the Select conversion landed, even though it was outside the plan's own explicit `.selectOption()` call-site enumeration.
- **Fix:** Changed to `expect(page.getByTestId("xor-parent-type")).toHaveText("tarefa")`, matching the trigger's own rendered `{xorParentType ?? "selecione..."}` label text.
- **Files modified:** `web/e2e/entities-ticket-subtarefa.spec.ts`
- **Verification:** `bunx playwright test e2e/entities-ticket-subtarefa.spec.ts --project=authed --no-deps` passed live (7/7), including this exact test ("editing a subtarefa's parent type unlinks the old parent").
- **Committed in:** `e00b62f` (Task 3's commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix)
**Impact on plan:** Necessary for correctness — without it, this test would have failed (or asserted nothing meaningful) the moment it ran against the restyled markup, despite being outside the plan's literal `.selectOption()` enumeration. No scope creep — the fix is a one-line assertion-target correction, not new functionality.

## Issues Encountered

- **InstantDB magic-code send-rate limiting (external, not a code regression):** This plan (10-04) and the concurrently-running 10-03 plan (Sonner toast integration) both authenticate against the same live email inbox (`tp@rbrasset.com.br`) for their respective `authed`/`anon` Playwright projects. Within a ~3-minute window (~22:34–22:37 local), the combined send volume from both agents' test runs tripped InstantDB's `send_magic_code` rate limit (`429: Too many verification codes requested for this email. Please try again later.`), confirmed directly via a manual probe script showing the 429 response body. No new magic-code email arrived for roughly the next hour despite periodic retries. **Resolution:** (1) reused the existing valid `storageState` (captured before the rate limit tripped) via `--no-deps` for the two mid-plan targeted spec runs, avoiding further sends; (2) waited out the cooldown (~66 min total, in three escalating intervals) before the final `bun run test:e2e` full-suite run, which succeeded cleanly on the first attempt once the limit cleared (`auth.setup.ts` and `login-flow.spec.ts`'s own fresh-login tests both need a real send and can't use `--no-deps`). Not a regression from any code in this phase — purely an artifact of two parallel e2e-verifying agents sharing one real inbox. No code change was made or needed to resolve this.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `web/e2e/` has zero remaining native `.selectOption()`/`.locator("option")`/date-`.fill()` call sites anywhere — the full migration to `pickDate`/`selectByText`/`openAndReadSelectOptions` (started in 10-01, continued in 10-02, completed here) is done phase-wide.
- `bun run test:e2e` is fully green (39/39) at this phase's boundary — Phase 11 (or any later phase) starts from a known-green suite, not a suite with 3 known-red files carried over.
- All three cross-plan `.planning/WINDOWS.md` deviation entries opened by 10-01 (ids 1, 2, 3) are marked `fixed` — `open_count: 0` for this phase's ledger contribution.
- If future phases run multiple e2e-verifying plans in parallel against the same live InstantDB app/email inbox again, budget extra wall-clock time for a possible magic-code send-rate cooldown (observed here: roughly an hour from the last accepted send to full clearance) — not a code issue, just a shared-resource contention pattern worth knowing about upfront.
- No blockers.

---
*Phase: 10-entity-form-restyle-feedback*
*Completed: 2026-08-10*

## Self-Check: PASSED

All three modified spec files (`entities-rotina-log.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts`) confirmed present on disk with their converted call sites. All 3 task commits (`d7a530e`, `e5842cc`, `e00b62f`) confirmed present in `git log`. `bun run test:e2e` confirmed 39/39 passing in the final full-suite run.
