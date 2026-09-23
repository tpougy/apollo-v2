---
phase: 260923-ivg
plan: 1
subsystem: ui
tags: [svelte, bits-ui, tooltip, instantdb, entity-screen, playwright]

requires: []
provides:
  - "bits-ui-backed Tooltip component family (web/src/lib/components/ui/tooltip/) mirroring the existing Popover wrapper shape"
  - "FieldDef.help?: string wired end-to-end from any entity's field def through EntityScreen.svelte's generic form renderer"
  - "Accurate, engine-sourced help copy for all 6 non-trivial templatesRotina fields, including propagarAtrasoSoft's honest no-op disclosure (VAL-02)"
  - "kind:\"select\" blank-option fix + submit-payload explicit-null-clear fix for optional select fields, live-proven against production InstantDB"
affects: [templatesRotina, EntityScreen, future entity-screen field-help work]

actuals:
  tokens: 5238
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "components/ui/tooltip/* wraps bits-ui's native Tooltip primitive (Provider/Root/Trigger/Content), mirroring the Popover wrapper's file-per-primitive shape exactly — no custom hover/focus/escape logic needed since bits-ui's TooltipTrigger already implements onpointerenter/onfocus/onblur natively."
    - "FieldDef.help renders as a CircleHelp-triggered Tooltip.Root immediately after each field's <Label>, inside one shared Tooltip.Provider per form."
    - "EntityScreen.svelte tracks initialFormValues (snapshot at form-open time) alongside formValues so handleSubmit's payload loop can distinguish 'optional field never touched' (omit from payload) from 'optional field had a value and was cleared' (send explicit null)."

key-files:
  created:
    - web/src/lib/components/ui/tooltip/tooltip.svelte
    - web/src/lib/components/ui/tooltip/tooltip-provider.svelte
    - web/src/lib/components/ui/tooltip/tooltip-trigger.svelte
    - web/src/lib/components/ui/tooltip/tooltip-content.svelte
    - web/src/lib/components/ui/tooltip/index.ts
    - web/e2e/templatesRotina-help-and-clear.spec.ts
  modified:
    - web/src/lib/entities/types.ts
    - web/src/lib/entities/EntityScreen.svelte
    - web/src/lib/entities/defs/templatesRotina.ts

key-decisions:
  - "Wrapped bits-ui's native Tooltip primitive rather than hand-rolling hover/focus/escape on top of Popover — bits-ui's TooltipTrigger already implements both trigger modes natively (D1)."
  - "diaSemana's clear bug had two parts, not one: the Select's missing blank option (rendering gap) AND handleSubmit's payload loop silently omitting cleared optional fields (persistence gap). Both were fixed; fixing only the first would have passed a naive UI-only check while silently failing to persist the clear."
  - "The InstantDB null-clear assumption (payload[field] = null clears a scalar .optional() attribute via update()) was proven live via a throwaway admin probe BEFORE Task 3 built the payload-loop fix on top of it — PROBE PASS confirmed, script deleted after use, no residue left in production."

requirements-completed: []

coverage:
  - id: D1
    description: "All 6 D2-required templatesRotina fields (tipoGeracao, offsetDias, diaSemana, regraCompetencia, propagarAtrasoSoft, ativo) show a circle-help tooltip with copy factually derived from routine_job.py/routineJob.ts; propagarAtrasoSoft honestly states it currently has no effect on generation."
    requirement: null
    verification:
      - kind: e2e
        ref: "web/e2e/templatesRotina-help-and-clear.spec.ts#TOOLTIP-01"
        status: pass
      - kind: e2e
        ref: "web/e2e/templatesRotina-help-and-clear.spec.ts#TOOLTIP-02"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tooltips open on both mouse hover AND keyboard Tab focus (not mouse-only), live-proven independently for both trigger modes on ativo and propagarAtrasoSoft."
    verification:
      - kind: e2e
        ref: "web/e2e/templatesRotina-help-and-clear.spec.ts#TOOLTIP-01"
        status: pass
      - kind: e2e
        ref: "web/e2e/templatesRotina-help-and-clear.spec.ts#TOOLTIP-02"
        status: pass
    human_judgment: false
  - id: D3
    description: "tipoGeracao's select never gains a blank/'—' option (stays required, always-meaningful, unchanged); diaSemana's select can be cleared back to blank via the real UI and the persisted value is actually absent/null server-side, not just visually blank."
    verification:
      - kind: e2e
        ref: "web/e2e/templatesRotina-help-and-clear.spec.ts#CLEAR-01"
        status: pass
    human_judgment: false
  - id: D4
    description: "InstantDB's update() clears a scalar .optional() attribute when passed null — proven live via a standalone throwaway admin probe against production BEFORE the diaSemana submit-payload fix was implemented on top of that assumption."
    verification:
      - kind: other
        ref: "web/e2e/fixtures/_scratch-null-clear-probe.ts (throwaway, deleted after use) — PROBE PASS printed, verified manually during Task 1 execution"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-23
status: complete
---

# Quick Task 260923-ivg: Tooltips de ajuda no formulario de templatesRotina Summary

**bits-ui-backed Tooltip component wired into every non-trivial templatesRotina field with engine-sourced copy, plus a two-part fix (blank Select option + submit-payload explicit-null-clear) for the diaSemana clear bug, live-verified against production InstantDB.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- New `Tooltip` component family (`web/src/lib/components/ui/tooltip/`) wrapping bits-ui's native `Tooltip` primitive — hover and keyboard-focus trigger support built in natively, mirroring the existing `Popover` wrapper's shape exactly.
- `FieldDef.help?: string` wired end-to-end: `types.ts` → `templatesRotina.ts`'s per-field copy → `EntityScreen.svelte`'s Label-line `CircleHelp` trigger + `Tooltip.Content`, inside one shared `Tooltip.Provider` per form.
- All 6 D2-required fields (`tipoGeracao`, `offsetDias`, `diaSemana`, `regraCompetencia`, `propagarAtrasoSoft`, `ativo`) now have factually accurate help copy sourced from `routine_job.py`'s actual generation semantics — `propagarAtrasoSoft`'s tooltip honestly states its current no-op status (VAL-02) rather than implying it affects generation.
- Fixed both halves of the `diaSemana` "can't clear back to empty" bug: (A) the `kind:"select"` renderer now emits a blank `"—"` option for non-required fields (mirroring the existing link-select precedent), and (B) `handleSubmit`'s payload loop now sends an explicit `null` for any optional field that had a value at form-open time and was cleared — previously the cleared value was silently omitted from the InstantDB `update()` payload and the old value survived server-side.
- The InstantDB `update({field: null})`-clears-a-scalar assumption was falsified live (not merely trusted from ambiguous docs) via a throwaway admin probe against production, BEFORE the payload-loop fix was built on top of it. PROBE PASS confirmed; the scratch record and probe script were both deleted after use.
- New live Playwright spec (`web/e2e/templatesRotina-help-and-clear.spec.ts`) with 3 tests (`TOOLTIP-01`, `TOOLTIP-02`, `CLEAR-01`), all passing together against the real running app — `CLEAR-01` specifically proves the persisted clear via a live admin re-query, not a UI-only check.

## Task Commits

1. **Task 1: Prove the InstantDB null-clear assumption live, then build the Tooltip component + wire the pipeline end-to-end for one field (ativo)** - `0b9382e` (feat)
2. **Task 2: Attach accurate D2 copy to the remaining 5 fields, live-verify propagarAtrasoSoft's honest no-op tooltip** - `968bfec` (feat)
3. **Task 3: Fix both halves of the diaSemana clear bug (Select rendering + submit-payload loop), live-verify the persisted value actually clears** - `c8e5ea5` (fix)

## Files Created/Modified

- `web/src/lib/components/ui/tooltip/tooltip.svelte` - wraps bits-ui `Tooltip.Root`
- `web/src/lib/components/ui/tooltip/tooltip-provider.svelte` - wraps bits-ui `Tooltip.Provider`
- `web/src/lib/components/ui/tooltip/tooltip-trigger.svelte` - wraps bits-ui `Tooltip.Trigger`
- `web/src/lib/components/ui/tooltip/tooltip-content.svelte` - wraps bits-ui `Tooltip.Content`, shadcn-style content classes
- `web/src/lib/components/ui/tooltip/index.ts` - re-exports Root/Provider/Trigger/Content + Tooltip* aliases
- `web/src/lib/entities/types.ts` - `FieldDef.help?: string` added to every variant
- `web/src/lib/entities/EntityScreen.svelte` - Tooltip render wiring, `initialFormValues` tracking, `kind:"select"` blank-option fix, payload-loop explicit-null-clear
- `web/src/lib/entities/defs/templatesRotina.ts` - `help` copy for all 6 non-trivial fields
- `web/e2e/templatesRotina-help-and-clear.spec.ts` - new live Playwright spec (TOOLTIP-01, TOOLTIP-02, CLEAR-01)

## Decisions Made

- Wrapped bits-ui's native `Tooltip` primitive rather than hand-rolling hover/focus/escape logic on top of `Popover` — `TooltipTrigger` already implements `onpointerenter`/`onfocus`/`onblur` natively, satisfying D1's accessibility requirement with zero custom event code.
- Fixed both the rendering gap (blank Select option) and the payload gap (explicit null on clear) in the same task (Task 3), since D4's own live re-query assertion is what actually falsifies whether the fix is complete — a UI-only check would have passed even with the payload gap unfixed.
- Exported `uniqueName` (rather than leaving it module-local) in the new e2e spec so Task 1's own `bun run check` doesn't flag it as an unused local before Tasks 2/3 (which use it) exist yet — a pragmatic accommodation of TypeScript's `noUnusedLocals` given the plan's explicit "scaffold the harness now" instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `process.exit()` moved out of the try block in the throwaway null-clear probe script**
- **Found during:** Task 1 (Step A, writing `_scratch-null-clear-probe.ts`)
- **Issue:** The plan's prose described calling `process.exit(1)` on the FAIL branch "so a non-zero process exit is the automated signal," but placing `process.exit()` calls inside the `try` block (as a literal reading would suggest) would skip the `finally` block's scratch-record deletion — leaving throwaway data in production on the FAIL path, directly contradicting the plan's own "delete the scratch record regardless of PASS/FAIL" requirement.
- **Fix:** Restructured the script so the inner function returns a plain `boolean` (never calling `process.exit`), and `process.exit(passed ? 0 : 1)` is called only in `main().then(...)`, after the `finally`'s deletion has already run.
- **Files modified:** `web/e2e/fixtures/_scratch-null-clear-probe.ts` (throwaway, deleted after use — not part of the committed diff)
- **Verification:** Ran the probe live; printed `PROBE PASS: null clears the scalar attribute via update()`; confirmed the scratch record's deletion via the probe's own logic before exiting.

**2. [Rule 3 - Blocking] Removed a stray `entity-cancel` click in CLEAR-01 that caused a 90s test timeout**
- **Found during:** Task 3 (writing and first-running `CLEAR-01`)
- **Issue:** The test clicked `entity-cancel` after a successful edit-form submit, but `handleSubmit` already sets `mode = null` on successful submit (both create and edit paths), auto-closing the dialog — so the `entity-cancel` button was never present, and Playwright's `.click()` timed out waiting for it (90s test timeout exceeded).
- **Fix:** Removed the redundant `entity-cancel` click; the test now goes straight from the post-submit admin-query assertion to opening the create dialog for the `tipoGeracao`-no-blank-option check.
- **Files modified:** `web/e2e/templatesRotina-help-and-clear.spec.ts`
- **Verification:** Re-ran the full 3-test spec live; all 3 tests (`TOOLTIP-01`, `CLEAR-01`, `TOOLTIP-02`) passed together.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary for correctness (the first prevents production data leakage on a failure path; the second fixes a test-authoring mistake). No scope creep — routine-generation business logic (`routine_job.py`/`routineJob.ts`) was never touched, per the task's explicit boundary.

## Issues Encountered

- The `authed` Playwright project's magic-code email round trip flaked twice during this session (a documented pre-existing deferred item — "Occasional live-email-timing test flake" — and once with a transient "You are currently working offline... Microsoft Exchange" error from the email-reading helper). Both were infrastructure flakes unrelated to this task's changes; retrying the same command succeeded each time with no code changes.
- `bun run lint` (biome) has 1 pre-existing formatting error in `web/src/lib/entities/registry.test.ts` (a file this task never touched) that already fails the combined `biome check` command on a clean checkout. Confirmed via `git stash` that this is pre-existing tech debt, out of scope per the Scope Boundary rule — not fixed. All files this task created or modified pass `biome check` individually with zero errors or warnings.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- No blockers. The Tooltip component and `FieldDef.help` mechanism are generic and reusable by any other entity's field defs going forward.
- The `initialFormValues`/explicit-null-clear pattern in `EntityScreen.svelte` is generic (not templatesRotina-specific) — any other optional `kind:"select"`/`kind:"text"`/etc. field across any entity now correctly persists a clear-to-blank, not just `diaSemana`.

## Self-Check: PASSED

All 9 created/modified files found on disk; all 3 task commits (`0b9382e`, `968bfec`, `c8e5ea5`) found in git history.

---
*Task: 260923-ivg*
*Completed: 2026-09-23*
