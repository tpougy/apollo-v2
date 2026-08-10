---
phase: 10-entity-form-restyle-feedback
plan: 02
subsystem: ui
tags: [svelte5, shadcn-svelte, bits-ui, select, playwright, instantdb]

requires:
  - phase: 10-entity-form-restyle-feedback
    provides: "10-01's Dialog-wrapped form and text/textarea/number/boolean/date field conversions in the same EntityScreen.svelte"
provides:
  - "EntityScreen.svelte's static-option select field kind (tipoPrazo/tipoGeracao) and plain relationship links (config.links) rendered via shadcn Select, same component for both option sources"
  - "subtarefas' xorLink two-step chooser (xor-parent-type + dynamic link-${type} target picker) converted to two Select.Roots, XOR 'exactly one' invariant (including unlink-on-parent-switch) proven server-side post-conversion"
  - "formError and the list-load query.error branch both rendered via Alert[variant=destructive] + CircleAlert + AlertDescription (testid entity-error unchanged)"
  - "Fix: <form novalidate> — JS-level required-field validation (unchanged handleSubmit logic) is now the sole validation path, no longer silently short-circuited by native HTML5 constraint validation"
  - "e2e/helpers/form-controls.ts's selectByText()/openAndReadSelectOptions(), reusable by 10-03/10-04 for every remaining native .selectOption()/.locator('option') call site"
affects: [10-03-entity-form-restyle-feedback, 10-04-entity-form-restyle-feedback]

actuals:
  tokens: 10236
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Select.Root type=\"single\" with explicit value/onValueChange (not bind:), matching the codebase's existing explicit-callback style used by Checkbox/Popover — same pattern for static-option fields, relationship links, and both xorLink Selects"
    - "Select.Item value=\"\" label=\"—\" for optional links — bits-ui's own hasValue check is value !== \"\", so an empty-string item is a genuinely safe 'no selection' sentinel, identical semantics to the native <option value=\"\">"
    - "<form novalidate> — once any field's native HTML `required` attribute is present (kept for a11y/semantics) but constraint validation is disabled at the form level, the JS-level required-check in handleSubmit becomes the only validation path, which is what ENTFRM-04 needs (an app-rendered Alert, not a native validation bubble)"

key-files:
  created: []
  modified:
    - web/src/lib/components/ui/select/
    - web/src/lib/components/ui/separator/
    - web/src/lib/entities/EntityScreen.svelte
    - web/e2e/entities-form-restyle.spec.ts
    - web/e2e/helpers/form-controls.ts

key-decisions:
  - "Fundo fixture for the templatesRotina Select test is created in a local `beforeEach` (not `beforeAll`) inside its own test.describe — the file's outer beforeEach/afterEach sweep every phase10-e2e-* fundo before/after EVERY test in the file, including nested describes; a beforeAll-created fixture would already exist by the time the outer beforeEach fires for that test and gets swept away before the test body ever runs. A local beforeEach fires AFTER the outer one, avoiding the race, and the outer afterEach's sweep becomes the fixture's own cleanup for free."
  - "Added `novalidate` to the create/edit <form> (Rule 1 auto-fix, not in the plan) — discovered live: field-nome's native HTML `required` attribute made the browser's own constraint validation block form submission before handleSubmit's JS-level required-check ever ran, so formError/Alert never rendered and ENTFRM-04's own literal test scenario (submit with field-nome blank) was unprovable without this fix."

requirements-completed: [ENTFRM-01, ENTFRM-03, ENTFRM-04]

coverage:
  - id: D1
    description: "Static-option select fields (tipoPrazo/tipoGeracao) and plain relationship link fields render as shadcn Select (role=combobox trigger, role=listbox/option content), same component for both option sources"
    requirement: ENTFRM-01
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ENTFRM-01/03: templatesRotina — static-option Select (tipoGeracao) and relationship-link Select (fundo) render and persist"
        status: pass
    human_judgment: false
  - id: D2
    description: "Relationship link fields (config.links) render via the identical Select component, no separate Combobox — no Combobox registry entry exists in this shadcn-svelte style"
    requirement: ENTFRM-03
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ENTFRM-01/03: templatesRotina — static-option Select (tipoGeracao) and relationship-link Select (fundo) render and persist"
        status: pass
    human_judgment: false
  - id: D3
    description: "subtarefas' xorLink two-step chooser (parent-type + dynamic target picker) still enforces exactly-one-of-tarefa/ticket after the Select swap, including unlink-on-parent-switch"
    requirement: ENTFRM-01
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ROADMAP Phase 10 SC3: xor-parent-type and the dynamic link-target picker render as Select; switching parent on edit unlinks the stale parent"
        status: pass
    human_judgment: false
  - id: D4
    description: "Submitting a form with a missing required field shows the error via a shadcn Alert (not window.alert), blocks submission, and fires zero native browser dialogs"
    requirement: ENTFRM-04
    verification:
      - kind: e2e
        ref: "web/e2e/entities-form-restyle.spec.ts#ENTFRM-04: missing required field blocks submission, shows Alert, fires zero native dialogs"
        status: pass
    human_judgment: false

duration: 19min
completed: 2026-08-10
status: complete
---

# Phase 10 Plan 02: Select Conversion + Validation Alert Summary

**EntityScreen.svelte's remaining native `<select>` usages — static-option enum fields, plain relationship links, and subtarefas' xorLink two-step chooser — are now shadcn `Select`, and `formError` renders via `Alert[variant=destructive]` instead of a bare `<p>`, with a live-proven fix that JS-level validation (not the browser's native constraint validation) is what actually blocks a bad submit.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-10T01:06:00Z (approx, session start)
- **Completed:** 2026-08-10T01:25:37Z
- **Tasks:** 3/3 completed
- **Files modified:** 21 (across 3 commits: 17, 2, 2)

## Accomplishments

- Installed shadcn `select` (zero new npm dependency — `bits-ui` already satisfies its registry deps; transitively vendors `separator`, confirmed zero diff to `package.json`/`bun.lock`).
- Converted the `f.kind === "select"` branch (`tarefas.tipoPrazo`, `tickets.tipoPrazo`, `templatesRotina.tipoGeracao`) and `config.links ?? []` rendering (plain relationship fields across `projetos`, `etapas`, `tarefas`, `templatesRotina`, `tickets`) to the identical `Select.Root type="single"` component — `field-${f.name}`/`link-${link.label}` testids preserved exactly on the trigger.
- Converted `subtarefas`' `xorLink` two-step chooser (`xor-parent-type` + dynamic `link-${xorParentType}`) to two `Select.Root`s, same structure preserved; proved server-side (via `apollo subtarefa listar --tarefa-id`/`--ticket-id`) that the "exactly one of tarefa/ticket" invariant, including unlink-on-parent-switch, survived the conversion.
- Converted `formError`'s render (and the sibling `query.error` list-load branch) from a bare `<p data-testid="entity-error">` to `Alert[variant=destructive]` + `CircleAlert` + `AlertDescription`, mirroring `LoginScreen.svelte`'s existing pattern exactly — testid unchanged.
- **Live-discovered bug fixed (Rule 1):** the create/edit `<form>` had no `novalidate`. With `field-nome`'s native HTML `required` attribute, the browser's own constraint validation silently blocked submission before `handleSubmit`'s JS-level required-field check (and its `formError`/Alert) ever ran — meaning ENTFRM-04's Alert never actually rendered for the plan's own literal test scenario ("submit with field-nome left blank"). Added `novalidate`; JS-level validation (unchanged logic) is now the sole validation path.
- Added `selectByText()`/`openAndReadSelectOptions()` to `e2e/helpers/form-controls.ts`, replacing every native `.selectOption()`/`.locator("option")` interaction pattern this phase's specs need; both are entity-agnostic (work identically for static-option and relationship-link Selects).
- Extended `entities-form-restyle.spec.ts` with 3 new tests: a `templatesRotina` Select smoke test (static-option + relationship-link paths), a `subtarefas` xorLink test (server-side XOR proof), and a validation-error/zero-native-dialog test for ENTFRM-04. All 5 tests in the file (including 10-01's fundos test) pass live against InstantDB.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install select; convert the static-option select branch and plain relationship links to shadcn Select** - `78ab236` (feat)
2. **Task 2: Convert subtarefas' xorLink two-step chooser to two Selects; prove the XOR invariant still holds** - `082faf0` (feat)
3. **Task 3: Convert formError to an Alert (ENTFRM-04); add the validation-error / zero-native-dialog test** - `4102551` (feat, includes the `novalidate` fix)

## Files Created/Modified

- `web/src/lib/components/ui/select/*` - shadcn Select primitives (Root/Trigger/Content/Item/Group/Label/Portal/Separator/ScrollUp/ScrollDown/GroupHeading)
- `web/src/lib/components/ui/separator/*` - shadcn Separator (transitive dependency of select)
- `web/src/lib/entities/EntityScreen.svelte` - `select`/`links`/`xorLink` branches converted to Select; `formError`/`query.error` converted to Alert; `novalidate` added to the form
- `web/e2e/entities-form-restyle.spec.ts` - templatesRotina Select smoke test, subtarefas xorLink test, validation-error test added
- `web/e2e/helpers/form-controls.ts` - `selectByText()`, `openAndReadSelectOptions()` added

## Decisions Made

- Fundo fixture for the templatesRotina test lives in a local `beforeEach` (not `beforeAll`) — see key-decisions above for the exact race this avoids with the file's outer fundo-sweeping `beforeEach`/`afterEach`.
- `novalidate` added to the form (see Deviations below) — required for ENTFRM-04 to be provable at all, not an optional stylistic choice.
- Kept every field's `required` HTML attribute in place (no removal) — it stays useful for accessibility semantics even though it no longer blocks submission at the browser level.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `<form>` lacked `novalidate`, so native HTML5 constraint validation silently blocked submission before `handleSubmit`'s JS-level required-check ever ran**
- **Found during:** Task 3's live Playwright verify run
- **Issue:** `field-nome` (and every other required `Input`/`Textarea`) carries the native `required` HTML attribute. Clicking `entity-submit` with `field-nome` blank triggered the browser's own constraint-validation UI, which prevents the `submit` event (and therefore `handleSubmit`) from firing at all — `formError` was never set, the `Alert` never rendered, and ENTFRM-04's own literal test scenario ("submit with the required field-nome left blank, and assert the Alert becomes visible") was structurally impossible to pass. This predates this plan (the `required` attribute was already present on `Input` since 10-01), but only became a blocking, provable gap once Task 3 tried to assert the Alert's visibility.
- **Fix:** Added `novalidate` to the `<form onsubmit={handleSubmit}>` element. The unchanged JS-level required-check inside `handleSubmit` (already present, never modified) is now the only validation path — exactly what ENTFRM-04 requires (an app-rendered `Alert`, not a native validation bubble).
- **Files modified:** `web/src/lib/entities/EntityScreen.svelte`
- **Verification:** `bunx playwright test e2e/entities-form-restyle.spec.ts --project=authed` passed live (5/5) after the fix; `entities-fundos.spec.ts` (2/2) re-run to confirm zero regression to the unrelated full-CRUD flow.
- **Committed in:** `4102551` (part of Task 3's commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix)
**Impact on plan:** Necessary for correctness — without it, ENTFRM-04 (a phase requirement) would be silently unmet despite every other Task 3 change looking correct in isolation. No scope creep beyond the single `novalidate` attribute; no other markup or logic touched.

## Issues Encountered

- Two transient magic-code email delivery timeouts during verification runs (`Timed out after 45000ms waiting for a new magic code`) — both resolved on retry with no code changes; consistent with the ~60-90s code-expiry/delivery variance already documented in PROJECT.md C-10. Not a regression, not related to this plan's changes.
- A test-authoring race (not a product bug): the templatesRotina test's fundo fixture was originally created in `test.beforeAll`, but the spec file's outer `beforeEach` (scoped to the same `phase10-e2e-` prefix, established in 10-01) swept it away before the test body ran. Fixed by moving fixture creation to a local `beforeEach` — see Decisions Made above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `selectByText()`/`openAndReadSelectOptions()` (`web/e2e/helpers/form-controls.ts`) are ready for 10-03/10-04 to reuse for every remaining native `.selectOption()`/`.locator("option")` call site.
- `EntityScreen.svelte` now has full field-kind coverage via shadcn primitives (Dialog/Input/Textarea/Checkbox/Popover+Calendar/Select/Alert) — no native `<select>`/bare `<p data-testid="entity-error">` remains anywhere in the form.
- The three cross-entity spec files flagged in 10-01's SUMMARY (`entities-rotina-log.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-ticket-subtarefa.spec.ts`) still have their own native `.selectOption()`/`.locator("option")`/date-fill call sites broken by the Select conversion — fixing those call sites (using the two new helpers above) remains 10-04's explicit job per this plan's own scope note. This plan intentionally did not touch those three files.
- No blockers.

---
*Phase: 10-entity-form-restyle-feedback*
*Completed: 2026-08-10*

## Self-Check: PASSED

All created/modified files (select/separator component dirs, EntityScreen.svelte, entities-form-restyle.spec.ts, form-controls.ts, this SUMMARY) confirmed present on disk. All 3 task commits (`78ab236`, `082faf0`, `4102551`) confirmed present in `git log`.
