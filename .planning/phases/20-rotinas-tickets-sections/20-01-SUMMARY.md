---
phase: 20-rotinas-tickets-sections
plan: 01
subsystem: ui
tags: [svelte5, playwright, instantdb, bits-ui, xorlink, e2e]

# Dependency graph
requires:
  - phase: 19-projetos-hierarchy
    provides: scopeWhere/presetLinks additive EntityScreen props, the hidden-EntityScreen-instance click-driving pattern (ProjetosSection.svelte), Tabs/Accordion conventions
provides:
  - "SubtarefasPanel.svelte -- shared, parent-type-agnostic inline panel over EntityScreen(subtarefas), reusable by Plan 03/04's tarefa-parented path"
  - "TicketsSection.svelte -- EntityScreen(tickets) + row-selection + inline SubtarefasPanel mount, wired into Shell.svelte's router"
  - "Proven DOM-driving workaround for xorLink create pre-resolution (pointer-event pairs, not .click()) -- reusable by any future xorLink-scoped panel"
affects: [20-02, 20-03, 20-04, 20-05]

# Actuals (#2632)
actuals:
  tokens: 6704
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Driving a bits-ui Select programmatically requires a pointerdown+pointerup PointerEvent pair (matching bits-ui's own onpointerdown/onpointerup handlers), never a plain HTMLElement.click() -- a synthetic click MouseEvent is a silent no-op against bits-ui's Select trigger/item."
    - "A same-session edit-then-page.reload() needs a settle wait (waitForSettle, ~1.5s) after the submit click resolves -- the click action resolving is not the same as handleSubmit's async db.transact() having reached the server; reloading too early aborts the in-flight request."

key-files:
  created:
    - web/src/lib/sections/SubtarefasPanel.svelte
    - web/src/lib/sections/TicketsSection.svelte
    - web/e2e/tickets-section.spec.ts
  modified:
    - web/src/lib/Shell.svelte

key-decisions:
  - "TicketsSection renders no separate <h2> of its own -- EntityScreen(ticketsConfig)'s own unconditional <h2>{config.titulo}</h2> already satisfies shell-nav.spec.ts's single-heading contract; adding a second, identically-worded heading (as a literal reading of the plan's Task 1 text suggested) breaks that existing, unmodified test with a Playwright strict-mode violation."
  - "SubtarefasPanel's driven-create code uses paired pointerdown/pointerup PointerEvents (not .click()) to interact with bits-ui's Select trigger/items -- verified live that .click() is a no-op there."
  - "tickets-section.spec.ts's edit test inserts a short settle wait between submitForm and page.reload() -- verified live that omitting it makes a real, successful edit look like a persistence failure purely from test timing."

patterns-established:
  - "firePointerClick(el) helper (SubtarefasPanel.svelte) -- dispatches a pointerdown+pointerup PointerEvent pair for driving any bits-ui Select from outside the component tree; reusable by Plan 03/04's tarefa-parented panel and any future driven-Select flow."

requirements-completed: [NEST-05]

coverage:
  - id: D1
    description: "Selecting a ticket row opens an inline (non-Sheet) SubtarefasPanel scoped to that ticket's subtarefas only"
    requirement: "NEST-05"
    verification:
      - kind: e2e
        ref: "web/e2e/tickets-section.spec.ts#NEST-05: selecting a ticket opens a scoped panel..."
        status: pass
      - kind: e2e
        ref: "web/e2e/tickets-section.spec.ts#NEST-05: scopeWhere isolates ticketA's subtarefas from ticketB's panel"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clicking '+ subtarefa' drives the generic engine's own xor-parent-type/link-ticket DOM so the create dialog opens pre-resolved to the selected ticket, with the user/test never touching those testids"
    requirement: "NEST-05"
    verification:
      - kind: e2e
        ref: "web/e2e/tickets-section.spec.ts#NEST-05: selecting a ticket opens a scoped panel; '+ subtarefa' drives the create dialog's xor parent..."
        status: pass
    human_judgment: false
  - id: D3
    description: "Editing and deleting existing subtarefas through the panel works with zero regression (startEdit needs no fix)"
    requirement: "NEST-05"
    verification:
      - kind: e2e
        ref: "web/e2e/tickets-section.spec.ts#NEST-05: editing an existing subtarefa through the panel persists"
        status: pass
      - kind: e2e
        ref: "web/e2e/tickets-section.spec.ts#NEST-05: deleting a subtarefa through the panel removes it from the scoped list; closing the panel leaves the tickets table intact"
        status: pass
    human_judgment: false
  - id: D4
    description: "EntityScreen.svelte and registry.ts remain byte-identical to their Phase 19 state"
    verification:
      - kind: other
        ref: "git diff --stat -- web/src/lib/entities/EntityScreen.svelte web/src/lib/entities/registry.ts (empty)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-11
status: complete
---

# Phase 20 Plan 01: SubtarefasPanel + TicketsSection Summary

**Shared `SubtarefasPanel.svelte` (parent-type-agnostic, DOM-driven xorLink create pre-resolution) and `TicketsSection.svelte`, wired into `Shell.svelte`, proving NEST-05's riskiest end-to-end path live against the hosted app.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-11T18:33:29-03:00 (plan commit)
- **Completed:** 2026-08-11T19:08:31-03:00 (final task commit)
- **Tasks:** 2/2
- **Files modified:** 4 (2 created components, 1 new e2e spec, 1 router edit)

## Accomplishments

- `SubtarefasPanel.svelte`: a shared, parent-type-agnostic component (`parentType: "tarefa" | "ticket"`) that mounts a capability-suppressed `EntityScreen(subtarefas)` clone (`create: false`) scoped via `scopeWhere`/`presetLinks`, plus a lazily-mounted hidden `EntityScreen(subtarefas)` host that drives the generic engine's own xor-parent-type/link-`<type>` DOM to pre-resolve the create dialog's parent — the user never clicks those testids themselves.
- `TicketsSection.svelte`: wraps an unmodified `EntityScreen(tickets)` in a click-delegation wrapper (`data-testid="tickets-table"`) that reads the clicked row's `data-eid`/titulo and mounts `SubtarefasPanel` inline (never a `Sheet`), remounting cleanly on every ticket switch via `{#key selectedTicketId}`.
- `Shell.svelte` gained one router branch (`rota.etype === "tickets"` → `TicketsSection`), mirroring the existing `"projetos"` branch, ahead of the generic fallback.
- `web/e2e/tickets-section.spec.ts`: 4 passing tests covering driven create (with server-side proof the new subtarefa links to the selected ticket and NOT to a sibling ticket or a tarefa), cross-ticket `scopeWhere` isolation, edit-through-panel persistence across reload, and delete/close-through-panel — none of them ever touch `xor-parent-type`/`link-ticket`/`link-tarefa` themselves.
- Verified live (via `git diff --stat`) that `EntityScreen.svelte` and `registry.ts` remain byte-identical to their Phase 19 state — the plan-checker's additional hardening check passes with empty output.

## Task Commits

1. **Task 1: SubtarefasPanel.svelte + TicketsSection.svelte — ticket-scoped panel with driven-create xor pre-resolution** — `0869285` (feat)
2. **Task 2: Extend tickets-section.spec.ts — scope isolation across tickets, edit/delete through the panel, and close behavior** — `31c20ab` (test)

**Plan metadata:** committed together with this SUMMARY (see Final Commit below).

## Files Created/Modified

- `web/src/lib/sections/SubtarefasPanel.svelte` — shared panel: visible capability-suppressed `EntityScreen(subtarefas)` list + hidden driven-create host + `firePointerClick` DOM-driving helper.
- `web/src/lib/sections/TicketsSection.svelte` — `EntityScreen(tickets)` + click-delegation row selector + inline `SubtarefasPanel` mount.
- `web/src/lib/Shell.svelte` — added `rota.etype === "tickets"` branch mounting `TicketsSection`, mirroring the `"projetos"` branch.
- `web/e2e/tickets-section.spec.ts` — 4 tests, CLI-fixture/`phase20-e2e-`-prefix/sweep-leftovers pattern mirroring `projetos-section.spec.ts`.

## Decisions Made

1. **No separate `<h2>` in `TicketsSection.svelte`.** The plan's Task 1 action text, read literally, called for `TicketsSection` to render its own `<h2>Tickets</h2>` "mirroring `ProjetosSection.svelte:281`'s identical pattern," in addition to mounting `<EntityScreen config={ticketsConfig} />` (zero props) directly and unconditionally. Live verification (a standalone Playwright probe against a two-`<h2>Tickets</h2>` page) confirmed this combination produces a Playwright strict-mode violation the instant `nav-tickets` is clicked, breaking the existing, unmodified `shell-nav.spec.ts` test `"each nav Button renders its corresponding EntityScreen"` (`expect(page.locator("h2")).toHaveText("Tickets")` fails when two elements match). The parenthetical's precedent doesn't transfer: `ProjetosSection`'s own `<h2>` is necessary *only* because `EntityScreen(projetosConfig)` is never visibly mounted there (a bespoke master/detail UI replaces it entirely); `TicketsSection` mounts `EntityScreen(ticketsConfig)` directly, so its own `<h2>{config.titulo}</h2>` ("Tickets") already satisfies the exact same `shell-nav.spec.ts` assertion the plan cites. Resolved per this task's deviation-rule authority (Rule 1 — auto-fix a bug directly caused by this task's own change) by dropping the duplicate heading; re-ran `shell-nav.spec.ts` in full (all 5 tests pass) to confirm.
2. **`firePointerClick` (pointerdown+pointerup `PointerEvent` pair) instead of `.click()` for all bits-ui `Select` interactions inside the driven-create flow.** `20-RESEARCH.md`'s Assumption A2 explicitly flagged this exact click-sequence as unverified in a live browser. Live testing confirmed a plain `HTMLElement.click()` is a **silent no-op** against bits-ui's `Select` trigger and items — its `SelectTriggerState#onpointerdown` and `SelectItemState#onpointerup` handlers (`node_modules/bits-ui/dist/bits/select/select.svelte.js`) require real `pointerdown`/`pointerup` events with `button: 0`, `ctrlKey: false`, `pointerType: "mouse"`, never a `click` `MouseEvent`. The `entity-create-start` plain shadcn `Button` (wired to a standard `onclick`) has no such requirement and keeps using `.click()`. Documented inline in `SubtarefasPanel.svelte`.
3. **Added a `waitForSettle` (1.5s) buffer between `submitForm` and `page.reload()` in the edit test.** Live testing showed that without it, a genuinely successful edit-through-panel intermittently/reproducibly *appeared* to revert on reload — not a persistence bug in `EntityScreen.svelte`, but a test-timing gap: `submitForm`'s click resolves as soon as the click event dispatches, not once `handleSubmit`'s async body (`await db.queryOnce(...)` parent check, then `await db.transact(...)`) has actually reached the InstantDB server; reloading immediately can abort that in-flight request before it commits. This mirrors `entities-ticket-subtarefa.spec.ts`'s own pre-existing `waitForSettle` helper and comment ("avoids the same-session reactive-resettle race") — same root cause, same fix, applied here for the first time in this spec file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dropped `TicketsSection`'s literal-reading duplicate `<h2>Tickets</h2>`**
- **Found during:** Task 1 (TicketsSection.svelte)
- **Issue:** A literal reading of the plan's Task 1 action text would add a second, identically-worded `<h2>` alongside `EntityScreen(ticketsConfig)`'s own unconditional heading, breaking `shell-nav.spec.ts`'s existing single-`<h2>` assertion for `nav-tickets` (Playwright strict-mode violation on 2 matched elements — verified live via a standalone probe).
- **Fix:** `TicketsSection.svelte` renders no separate `<h2>` at all; `EntityScreen(ticketsConfig)`'s own heading already satisfies the assertion. Documented inline with a comment explaining why this differs from `ProjetosSection.svelte`'s precedent.
- **Files modified:** `web/src/lib/sections/TicketsSection.svelte`
- **Verification:** `bunx playwright test shell-nav.spec.ts --project=authed --no-deps` — all 5 tests pass (including the one that would have broken).
- **Committed in:** `0869285` (Task 1 commit)

**2. [Rule 1 - Bug] Driving bits-ui `Select` requires pointer events, not `.click()`**
- **Found during:** Task 1 (SubtarefasPanel.svelte's driven-create flow)
- **Issue:** The plan's action text (and `20-RESEARCH.md` Pattern 1's code example) described driving `xor-parent-type`/`link-<type>` and their options via `.click()`, matching `ProjetosSection.svelte`'s existing hidden-instance pattern for plain `Button`s. Live testing showed `.click()` is a silent no-op against bits-ui's `Select` trigger/items specifically (they require `pointerdown`/`pointerup`), causing every poll step after the first to time out.
- **Fix:** Added a `firePointerClick(el)` helper dispatching a `pointerdown`+`pointerup` `PointerEvent` pair (`button: 0`, `ctrlKey: false`, `pointerType: "mouse"`) and used it for the xor-type trigger, its option, the link-`<type>` trigger, and its option — kept `.click()` for the plain `entity-create-start` `Button`.
- **Files modified:** `web/src/lib/sections/SubtarefasPanel.svelte`
- **Verification:** `bunx playwright test tickets-section.spec.ts --project=authed --no-deps` — driven-create test passes with the xor parent correctly resolved (`xor-parent-type` shows "ticket", `link-ticket` shows the selected ticket's titulo) with zero clicks on those testids from the test itself.
- **Committed in:** `0869285` (Task 1 commit)

**3. [Rule 1 - Bug] Added a settle wait before `page.reload()` in the edit-persistence test**
- **Found during:** Task 2 (tickets-section.spec.ts's edit test)
- **Issue:** A same-session edit submit followed immediately by `page.reload()` could abort the async `handleSubmit`'s in-flight `db.transact()` before it reached the server, making a real, working edit path look like a persistence bug in the test's own assertions.
- **Fix:** Added a `waitForSettle` (1.5s) helper, called between `submitForm(page)` and `page.reload()`, mirroring `entities-ticket-subtarefa.spec.ts`'s pre-existing helper of the same name/purpose.
- **Files modified:** `web/e2e/tickets-section.spec.ts`
- **Verification:** `bunx playwright test tickets-section.spec.ts --project=authed --no-deps` — edit test passes reproducibly across repeated runs.
- **Committed in:** `31c20ab` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs directly caused by/discovered during this task's own changes, not scope creep).
**Impact on plan:** All three were necessary to make the plan's literal instructions actually work against the live bits-ui/InstantDB stack; none change the plan's intent or architecture.

## Issues Encountered

- Investigated an apparent edit-persistence failure at length (multiple standalone Playwright probe scripts under `web/e2e/__debug_*.spec.ts`, all removed before final commit) before isolating it to the test-timing gap described in Deviation 3 above — not an app bug. No source files were changed as a result; only the test gained a settle wait.
- Confirmed via a standalone Playwright probe (`page.setContent` with two `<h2>Tickets</h2>` elements) that Biome/svelte-check reported zero errors for `TicketsSection.svelte`'s original two-heading draft, but the actual Playwright assertion in `shell-nav.spec.ts` failed with a strict-mode violation — a class of regression neither the type-checker nor the linter would have caught; only running the actual, pre-existing e2e suite surfaced it.

## Hardening Check (plan-checker requirement)

```
$ git diff --stat -- web/src/lib/entities/EntityScreen.svelte web/src/lib/entities/registry.ts
(empty output)
```

Confirmed empty both before Task 1's commit and again after Task 2's commit — neither file was touched at any point in this plan's execution.

## Regression Verification

Beyond the plan's own `<verify>`/`<verification>` commands, also ran (all pass, zero regressions from this plan's changes):
- `bun run check` (svelte-check + tsc) — 0 errors (1 pre-existing, unrelated warning in `EntityScreen.svelte:45`)
- `bun run lint` (biome check) — 0 errors (1 pre-existing, unrelated info in `calendar-caption.svelte:50`)
- `bunx playwright test shell-nav.spec.ts --project=authed --no-deps` — 5/5 pass
- `bunx playwright test entities-ticket-subtarefa.spec.ts --project=authed --no-deps` — 7/7 pass (unscoped `subtarefas` route via `gotoNested`, untouched by this plan)
- `bunx playwright test cross-phase-verification.spec.ts --project=authed --no-deps` — 9/9 pass

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `SubtarefasPanel.svelte` is ready for Plan 03/04 to reuse verbatim for the tarefa-parented path (`parentType="tarefa"`) — the component and its `firePointerClick` driving helper are already parent-type-agnostic, not ticket-specific.
- The `web/e2e/entities-ticket-subtarefa.spec.ts` call-site migration flagged by `20-RESEARCH.md` Pitfall 3 (retiring the interim `subtarefas` `gotoNested` branch in favor of dedicated `openSubtarefasPanelFrom{Ticket,Tarefa}` helpers) is explicitly out of scope for this plan and remains for a later plan in this phase.
- No blockers for Plan 02+.

## Self-Check: PASSED

All claimed files exist on disk and both task commit hashes resolve in `git log --oneline --all`:
- FOUND: `web/src/lib/sections/SubtarefasPanel.svelte`
- FOUND: `web/src/lib/sections/TicketsSection.svelte`
- FOUND: `web/e2e/tickets-section.spec.ts`
- FOUND: `web/src/lib/Shell.svelte`
- FOUND: `.planning/phases/20-rotinas-tickets-sections/20-01-SUMMARY.md`
- FOUND: `0869285` (Task 1 commit)
- FOUND: `31c20ab` (Task 2 commit)

---
*Phase: 20-rotinas-tickets-sections*
*Completed: 2026-08-11*
