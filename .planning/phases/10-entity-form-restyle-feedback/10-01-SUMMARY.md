---
phase: 10-entity-form-restyle-feedback
plan: 01
subsystem: ui
tags: [svelte5, shadcn-svelte, bits-ui, dialog, checkbox, calendar, popover, playwright, instantdb]

requires:
  - phase: 09-entity-table-restyle
    provides: shadcn Table/Badge markup for the same EntityScreen.svelte, table-view rendering untouched by this plan
provides:
  - "EntityScreen.svelte's create/edit form wrapped in a real shadcn Dialog (role=dialog), driven by the pre-existing `mode` state"
  - "text/textarea/number/boolean field kinds rendered via shadcn Input/Textarea/Input[number]/Checkbox"
  - "date field kind rendered via a shadcn Popover+Calendar date-picker, formValues[f.name] still a plain YYYY-MM-DD string"
  - "web/e2e/helpers/form-controls.ts's pickDate() helper, reusable by 10-02/10-03/10-04"
  - "entities-form-restyle.spec.ts proving ENTFRM-01/02 live against InstantDB for the fundos capability class"
  - "entities-fundos.spec.ts fixed for the date-fill call site broken by the Calendar conversion"
affects: [10-02-entity-form-restyle-feedback, 10-03-entity-form-restyle-feedback, 10-04-entity-form-restyle-feedback]

actuals:
  tokens: 15936
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Dialog.Root bound to the pre-existing `mode !== null` $state, onOpenChange calling the unchanged cancelForm() — no new state machine, no Dialog.Trigger needed since entity-create-start/row-edit already set mode directly"
    - "Checkbox uses explicit checked/onCheckedChange (v === true guard collapsing bits-ui's indeterminate union member to false), matching this codebase's existing explicit-callback style rather than bind:"
    - "Date-picker: Popover.Trigger wraps a Button via the {#snippet child({ props })} pattern so data-testid/id land on the actually-clickable Button, not an invisible outer wrapper; Popover.Root itself uses explicit open/onOpenChange (not bind:open) because bind: to a dynamic Record<string,boolean> key throws Svelte's props_invalid_value when the key is still undefined on first render"
    - "formValues[f.name] for date fields stays a plain YYYY-MM-DD string end to end — @internationalized/date's parseDate/CalendarDate.toString() round-trips through the exact same string shape isoToDateInputValue/dateInputValueToIso already consume, so neither helper changed"

key-files:
  created:
    - web/src/lib/components/ui/dialog/
    - web/src/lib/components/ui/checkbox/
    - web/src/lib/components/ui/textarea/
    - web/src/lib/components/ui/popover/
    - web/src/lib/components/ui/calendar/
    - web/e2e/entities-form-restyle.spec.ts
    - web/e2e/helpers/form-controls.ts
  modified:
    - web/src/lib/entities/EntityScreen.svelte
    - web/e2e/entities-fundos.spec.ts

key-decisions:
  - "Popover.Root uses explicit open={datePopoverOpen[f.name] ?? false} / onOpenChange, not bind:open, to avoid Svelte's props_invalid_value error when a per-field Record key is read before it's ever been written"
  - "Reverted shadcn-svelte CLI's unsolicited re-formatting of the pre-existing button.svelte/index.ts (whitespace/import-order only, triggered by dialog's registryDependency on button) and let the project's own biome formatter own that file's style instead of the CLI's tab-indented output"
  - "Deferred fixing entities-rotina-log.spec.ts / entities-projeto-etapa-tarefa.spec.ts / entities-ticket-subtarefa.spec.ts's date-fill and .selectOption() breakage to 10-02/10-04 (recorded in .planning/WINDOWS.md) — those files also break on .selectOption() against the still-native <select>, so a date-only fix wouldn't get them green until the Select conversion lands anyway"

patterns-established:
  - "shadcn-svelte add --no-deps-install -y -o followed immediately by `git diff package.json bun.lock` (must be empty) and a revert of any unrelated component the CLI re-touches as a registryDependency (e.g. button), then re-running the project's biome formatter — the reliable zero-noise install sequence for this repo"

requirements-completed: [ENTFRM-01, ENTFRM-02]

coverage:
  - id: D1
    description: "Create/edit forms open inside a real shadcn Dialog (role=dialog) instead of a bare <form>, proven live for fundos"
    requirement: ENTFRM-01
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ENTFRM-01: fundos (full-CRUD) — Dialog role, text/checkbox fields render and persist"
        status: pass
    human_judgment: false
  - id: D2
    description: "text/textarea/number/boolean field kinds render via Input/Textarea/Input[number]/Checkbox, every field-${name} testid preserved"
    requirement: ENTFRM-01
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ENTFRM-01: fundos (full-CRUD) — Dialog role, text/checkbox fields render and persist"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-fundos.spec.ts#WEB-02: full browser CRUD round trip"
        status: pass
    human_judgment: false
  - id: D3
    description: "date field kind renders via a shadcn Popover+Calendar date-picker; a picked date persists the correct value to live InstantDB on save"
    requirement: ENTFRM-02
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ENTFRM-01: fundos (full-CRUD) — Dialog role, text/checkbox fields render and persist"
        status: pass
    human_judgment: false
  - id: D4
    description: "entities-fundos.spec.ts is fully green post-restyle with zero changes to its checkbox assertions"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-fundos.spec.ts#SC-3: a fundo created by the CLI is visible in the SPA"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-fundos.spec.ts#WEB-02: full browser CRUD round trip"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-08-10
status: complete
---

# Phase 10 Plan 01: Dialog + Field Conversion (Tracer Slice) Summary

**EntityScreen.svelte's create/edit form now opens inside a real shadcn Dialog, with text/textarea/number/boolean/date fields converted to Input/Textarea/Checkbox/Popover+Calendar — proven live end-to-end against InstantDB for the fundos capability class, with zero regression to the pre-existing entities-fundos.spec.ts.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-09T21:46:33-03:00 (phase plan commit)
- **Completed:** 2026-08-10T01:00:15Z
- **Tasks:** 3/3 completed
- **Files modified:** 47 (across 3 commits: 17, 31, 1)

## Accomplishments

- `EntityScreen.svelte`'s `{#if mode !== null}<form>...{/if}` block is now a controlled `Dialog.Root open={mode !== null}` — Escape/overlay-click and the existing `entity-cancel` button both route through the unchanged `cancelForm()`.
- `text`/`textarea`/`number` fields render as shadcn `Input`/`Textarea`/`Input[number]`; `boolean` renders as shadcn `Checkbox` with explicit `checked`/`onCheckedChange`; `date` renders as a `Popover.Trigger(child=Button)` + `Calendar type="single"` composition — every `field-${name}` testid preserved exactly, zero business-logic change.
- `formValues[f.name]` for date fields is still a plain `"YYYY-MM-DD"` string; `isoToDateInputValue`/`dateInputValueToIso` (lines 21-27) are byte-identical to before this plan.
- New `web/e2e/helpers/form-controls.ts` exports `pickDate()` — clicks the date-picker trigger, picks day "15" of the currently displayed month (locale- and clock-agnostic), returns the resulting ISO date string for assertion. Reused immediately by both new and fixed specs, and available to 10-02/10-03/10-04.
- New `web/e2e/entities-form-restyle.spec.ts` proves the full fundos CRUD lifecycle (create with a real Dialog + Checkbox + Calendar pick, date persists across reload, edit, delete) live against InstantDB.
- `web/e2e/entities-fundos.spec.ts`'s one broken call site (`field-createdAt.fill(...)`) is fixed via `pickDate()`; its `.isChecked()`/`.check()`/`.uncheck()` checkbox assertions are untouched, confirmed still green.
- `bunx shadcn-svelte@latest add dialog checkbox textarea popover calendar` produced **zero diff to `package.json`/`bun.lock`** across both installs — confirmed via `git diff` after each, per the plan's zero-new-dependency claim.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dialog/checkbox; wrap the form in Dialog; convert text/textarea/number/boolean fields** - `aca3d26` (feat)
2. **Task 2: Install popover/calendar; convert the date field kind to a Popover+Calendar date-picker** - `5e69ce6` (feat)
3. **Task 3: Fix entities-fundos.spec.ts's date-fill call site; leave checkbox lines untouched** - `930e8ba` (fix)

## Files Created/Modified

- `web/src/lib/components/ui/dialog/*` - shadcn Dialog primitives (Root/Content/Header/Title/Close/Overlay/Portal/Trigger/Footer/Description)
- `web/src/lib/components/ui/checkbox/*` - shadcn Checkbox (bits-ui `<button role="checkbox">` wrapper)
- `web/src/lib/components/ui/textarea/*` - shadcn Textarea
- `web/src/lib/components/ui/popover/*` - shadcn Popover primitives
- `web/src/lib/components/ui/calendar/*` - shadcn Calendar (bits-ui Calendar wrapper + Months/Grid/Cell/Day/Nav/Caption sub-components)
- `web/src/lib/entities/EntityScreen.svelte` - Dialog-wrapped form; text/textarea/number/boolean/date field-kind branches converted; `select`/`links`/`xorLink` still native (10-02's job)
- `web/e2e/entities-form-restyle.spec.ts` - new spec proving ENTFRM-01/02 for fundos live against InstantDB
- `web/e2e/helpers/form-controls.ts` - new `pickDate()` helper shared across this phase's remaining plans
- `web/e2e/entities-fundos.spec.ts` - one line fixed (`field-createdAt` fill → `pickDate()`)

## Decisions Made

- Used explicit `open`/`onOpenChange` on `Popover.Root` instead of `bind:open={datePopoverOpen[f.name]}` — the latter threw Svelte's `props_invalid_value` (`Cannot do bind:open={undefined} when open has a fallback value`) the first time a field's key hadn't been written to `datePopoverOpen` yet. Explicit props also matches this codebase's existing style (Checkbox already uses explicit `checked`/`onCheckedChange` rather than `bind:`).
- Reverted the shadcn-svelte CLI's incidental re-formatting of `button.svelte`/`button/index.ts` (a registryDependency pull-through from `dialog`/`calendar`, tabs vs. spaces + import-order only, zero functional change) rather than committing an unrelated diff to a file this plan didn't intend to touch; the project's own biome formatter reproduces the CLI's canonical style for genuinely-new files without touching `button`.
- Left `select`/`links`/`xorLink` fields native `<select>` in this plan, per Task 1/2's explicit scope — the Select conversion is 10-02's job.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Popover.Root's `bind:open` on a dynamic Record key threw `props_invalid_value` at runtime**
- **Found during:** Task 2's live Playwright verify run
- **Issue:** `<Popover.Root bind:open={datePopoverOpen[f.name]}>` — on first render `datePopoverOpen[f.name]` is `undefined` (the key hasn't been written yet), and bits-ui's `Popover.Root` declares `open = $bindable(false)`; Svelte forbids two-way-binding an `undefined` value into a prop with a non-undefined fallback, throwing at runtime and preventing the Dialog/Popover from ever rendering.
- **Fix:** Switched to explicit `open={datePopoverOpen[f.name] ?? false}` + `onOpenChange={(open) => { datePopoverOpen[f.name] = open; }}`, matching the codebase's existing explicit-callback convention (same as `Checkbox`'s `checked`/`onCheckedChange`).
- **Files modified:** `web/src/lib/entities/EntityScreen.svelte`
- **Verification:** `bunx playwright test e2e/entities-form-restyle.spec.ts --project=authed` passed live (2/2) after the fix.
- **Committed in:** `5e69ce6` (part of Task 2's commit)

**2. [Rule 1 - Bug] shadcn-svelte CLI's `-o` overwrite flag re-touched `button.svelte`/`button/index.ts` with whitespace-only churn**
- **Found during:** Task 1's post-install `git status`
- **Issue:** `dialog`/`calendar` declare `button` as a registryDependency; installing with `-o` (needed to bypass an interactive prompt that a piped stdin couldn't reliably answer) overwrote the already-installed `button` component with the CLI's own tab-indented, alphabetically-reordered-import formatting — a functionally identical but unrelated diff outside this plan's declared file scope.
- **Fix:** `git checkout -- src/lib/components/ui/button/button.svelte src/lib/components/ui/button/index.ts` after each install, then ran the project's own `bun run lint:fix` (biome) to format the genuinely-new files — confirmed zero remaining diff to `button/*`.
- **Files modified:** none beyond the checkout (button files restored to their pre-install state)
- **Verification:** `git diff --stat` showed empty for `button/*` after the checkout+reformat sequence, both times (Task 1 and Task 2 installs)
- **Committed in:** N/A — reverted before either task's commit, so `button/*` never appears in this plan's diffs

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bug fixes)
**Impact on plan:** Both fixes were necessary for correctness (Popover.Root would never have rendered without the first fix) or scope hygiene (the second fix kept `button/*` out of this plan's diff entirely). No scope creep — no new functionality was added beyond what the plan specified.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Cross-Plan Transient State (recorded in .planning/WINDOWS.md)

This plan's Dialog/Checkbox/Calendar conversion applies to `EntityScreen.svelte`, which is shared across all 9 entities — not just `fundos`. Three pre-existing specs that exercise other entities' `date`/`select`/`links`/`xorLink` fields now fail against the restyled markup:

- `web/e2e/entities-rotina-log.spec.ts` — date-fill + `.selectOption()` on `field-tipoGeracao`/`link-antecessor`
- `web/e2e/entities-projeto-etapa-tarefa.spec.ts` — date-fill + `.selectOption()` on `link-fundo`/`link-projeto`/`link-etapa`
- `web/e2e/entities-ticket-subtarefa.spec.ts` — date-fill + `.selectOption()`/`xor-parent-type`

This is **expected, not a regression from this plan's scope**: per 10-RESEARCH.md's Pitfall 2 and this phase's own objective statement, the `select`/`links`/`xorLink` native `<select>` conversion is 10-02's job — fixing only the date-fill call sites in these three files now wouldn't get them green anyway (they'd still fail on `.selectOption()` until 10-02 lands). All three are logged as `deviation` entries in `.planning/WINDOWS.md` (open, phase 10) so they stay visible through the phase and block `/gsd-ship` until 10-02/10-04 resolve them.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `pickDate()` (`web/e2e/helpers/form-controls.ts`) is ready for 10-02/10-03/10-04 to reuse for any date-field interaction.
- `EntityScreen.svelte`'s Dialog/Input/Textarea/Checkbox/Calendar composition is the pattern 10-02 should extend for `Select` (static-option + relationship + xorLink fields) — same file, same testid conventions, same explicit-callback style.
- The three cross-entity spec files flagged above (`entities-rotina-log`, `entities-projeto-etapa-tarefa`, `entities-ticket-subtarefa`) are the concrete acceptance target for 10-02's Select conversion — they should go green once `link-*`/`field-<select>`/`xor-parent-type` are converted and their `.selectOption()` call sites updated.
- No blockers.

---
*Phase: 10-entity-form-restyle-feedback*
*Completed: 2026-08-10*

## Self-Check: PASSED

All created/modified files (dialog/checkbox/textarea/popover/calendar component dirs, EntityScreen.svelte, entities-form-restyle.spec.ts, form-controls.ts, entities-fundos.spec.ts, this SUMMARY, WINDOWS.md) confirmed present on disk. All 3 task commits (`aca3d26`, `5e69ce6`, `930e8ba`) confirmed present in `git log`.
