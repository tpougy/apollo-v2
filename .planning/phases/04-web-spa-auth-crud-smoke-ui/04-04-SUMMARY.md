---
phase: 04-web-spa-auth-crud-smoke-ui
plan: 04
subsystem: ui
tags: [sveltekit, instantdb, playwright, entity-screen, xor-link]

requires:
  - phase: 04-web-spa-auth-crud-smoke-ui
    provides: "EntityConfig contract, EntityScreen.svelte generic engine, xorLink support (04-02)"
provides:
  - "tickets EntityConfig — full CRUD screen for ad-hoc inbound demands, optional fundo link"
  - "subtarefas EntityConfig — full CRUD screen with xorLink to exactly one of tarefa/ticket"
  - "EntityScreen.svelte fix: edit-time xorLink parent-type switch now unlinks the stale parent"
  - "entities-ticket-subtarefa.spec.ts — live browser CRUD + XOR edge-case proof (CLI-readback pattern)"
affects: [04-05, 04-06]

actuals:
  tokens: ~9000
  tasks: 2 (plus one checkpoint-authorized shared-file fix)
  commits: 3

tech-stack:
  added: []
  patterns:
    - "xorLink parent snapshot on edit-start (originalXorParentType/Id), diffed against the submitted choice to emit an explicit .unlink() alongside .link() — the shared engine's edit path never silently drops a stale link again."
    - "Server-side XOR proof via CLI list filters (`apollo subtarefa listar --tarefa-id`/`--ticket-id`) rather than a second InstantDB client in the e2e spec, since the base listar query does not expand link sub-relations."

key-files:
  created:
    - web/src/lib/entities/defs/tickets.ts
    - web/src/lib/entities/defs/subtarefas.ts
    - web/e2e/entities-ticket-subtarefa.spec.ts
  modified:
    - web/src/lib/entities/EntityScreen.svelte

key-decisions:
  - "Authorized (Option A, orchestrator decision): fixed the shared EntityScreen.svelte directly in this plan rather than deferring, because execution is strictly sequential and 04-05 had not started — no concurrent-edit collision risk. Committed as its own atomic commit, separate from the tickets/subtarefas def-file work."
  - "Fail-loud demonstration was adapted to target Test 4(c) (edit-time parent switch) rather than the plan's literal Test 4(b) wording, because that is where the actual mechanism (the new unlink call) lives — Test 4(b)'s create-time switch is structurally incapable of writing two links given the single-value xorParentType/xorParentId state model, so relaxing anything there would not exercise a real guard."

requirements-completed: [WEB-08]

coverage:
  - id: D1
    description: "An authenticated user can create, view, edit, and delete a ticket in the browser, optionally linked to a fundo, including a long multi-line corpo that round-trips without truncation."
    requirement: "WEB-08"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts#WEB-08: tickets full browser CRUD round trip, including a long multi-line corpo"
        status: pass
    human_judgment: false
  - id: D2
    description: "A subtarefa is linked to exactly one parent — tarefa or ticket, never both, never neither — for create, create-time type switch, and edit-time type switch, proven via server-side CLI readback."
    requirement: "WEB-08"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts#WEB-08: subtarefa created with a tarefa parent shows the tarefa column and an empty ticket column"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts#WEB-08: subtarefa created with a ticket parent shows the ticket column and an empty tarefa column"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts#WEB-08 T-04-04: subtarefa submitted with no parent selected is blocked, nothing written"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts#WEB-08 T-04-11: switching parent type before submit links only the final choice"
        status: pass
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts#WEB-08 T-04-11: editing a subtarefa's parent type unlinks the old parent, leaving exactly one link"
        status: pass
    human_judgment: false
  - id: D3
    description: "subtarefa concluida boolean round-trips both true and false across a reload (no string-coercion bug)."
    requirement: "WEB-08"
    verification:
      - kind: e2e
        ref: "web/e2e/entities-ticket-subtarefa.spec.ts#WEB-08: subtarefa concluida boolean round-trips both true and false across reload"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 04: Tickets and Subtarefas (with a shared XOR-edit bug fix) Summary

**Ticket and subtarefa CRUD screens shipped via declarative EntityConfig, plus a fix to EntityScreen.svelte's shared edit path that was silently leaving stale XOR links after a parent-type switch.**

## Performance

- **Duration:** 55 min (resumed from a checkpoint-halted prior attempt)
- **Tasks:** 2 planned tasks + 1 orchestrator-authorized shared-file fix
- **Files modified:** 4 (1 fixed, 3 created)

## Accomplishments

- Fixed a real correctness bug in `EntityScreen.svelte`: editing a `subtarefas`-shaped record and switching its `xorLink` parent type (e.g. tarefa → ticket) only ever added the new link, never removing the old one — violating the "exactly one of" invariant on edit. Now the component snapshots the original parent choice at edit-start and issues an explicit `.unlink()` for it when the type changes.
- `tickets` EntityConfig: titulo, corpo (textarea), remetente, dataRecebimento, tipoPrazo (strict hard/soft select), optional dataPrevista, status, optional fundo link — all capabilities enabled.
- `subtarefas` EntityConfig: titulo, concluida, ordem, `xorLink` to exactly one of tarefa/ticket, mirroring the CLI's `_resolve_parent` rule.
- `entities-ticket-subtarefa.spec.ts`: 7 Playwright tests proving ticket CRUD (including a 372-char multi-line corpo round trip) and every subtarefa XOR branch — create-with-tarefa, create-with-ticket, no-parent-blocked, type-switch-before-submit, type-switch-on-edit — with every parent-link assertion verified server-side via the Phase 3 CLI (`apollo subtarefa listar --tarefa-id`/`--ticket-id`), never a second InstantDB client.
- Full suite (`bunx playwright test`, all projects) green: 16/16.

## Task Commits

Each task was committed atomically:

1. **Fix: unlink stale XOR parent on edit-time parent-type switch** - `0aa4bd5` (fix) — authorized by orchestrator decision (Option A), scoped strictly to the xorLink edit path in `EntityScreen.svelte`.
2. **Task 1: tickets and subtarefas EntityConfig definitions** - `e10e497` (feat)
3. **Task 2: e2e spec proving ticket CRUD and both subtarefa XOR branches** - `8c1562c` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `web/src/lib/entities/EntityScreen.svelte` - Added `originalXorParentType`/`originalXorParentId` state, snapshotted in `startEdit`, diffed at submit time to build an `unlinkPayload` and issue `.unlink()` alongside `.link()` on edit.
- `web/src/lib/entities/defs/tickets.ts` - `tickets` EntityConfig (etype, ordem 7, all capabilities, fields, optional fundo link, listColumns).
- `web/src/lib/entities/defs/subtarefas.ts` - `subtarefas` EntityConfig (etype, ordem 8, all capabilities, fields, `xorLink` to tarefa/ticket, listColumns).
- `web/e2e/entities-ticket-subtarefa.spec.ts` - 7 Playwright tests (`authed` project), `phase04-e2e-` prefixed, `beforeAll`/`afterAll` sweep-based cleanup, CLI-readback server-side assertions.

## Decisions Made

- **Fixed the shared `EntityScreen.svelte` in this plan (Option A, orchestrator-authorized)** rather than stopping at the checkpoint again: execution here is strictly sequential with no worktree isolation and no concurrently running agent, and the sibling wave-3 plan 04-05 had not started, so there was no risk of a concurrent-edit collision. The fix is committed separately (`0aa4bd5`) from the tickets/subtarefas definition work, with a clear message flagging it as a shared-file change for 04-05 (and any later plan reading `EntityScreen.svelte`) to inherit.
- **Fail-loud demonstration retargeted to Test 4(c).** The plan's acceptance criteria described relaxing the XOR check and re-running Test 4(b) (create-time type switch). That test's guard is structural — `xorParentType`/`xorParentId` are single-valued state, so a create-time switch can never produce two links regardless of any "check" being relaxed. The actual guard this plan introduces (the edit-time `.unlink()` call) is exercised by Test 4(c), so the demonstration was performed there instead: the unlink call was temporarily removed, Test 4(c) was re-run and failed exactly on the "exactly one link" assertion (`expect(...).toBe(false)` received `true`), the fix was restored, and the full suite was re-run green (16/16). No committed test or app code reflects the temporary revert — see `## Fail-Loud Demonstration` below for the transcript.

## Fail-Loud Demonstration

1. In `EntityScreen.svelte`, temporarily replaced:
   ```ts
   const finalChunk =
     Object.keys(unlinkPayload).length > 0 ? linked.unlink(unlinkPayload) : linked;
   ```
   with `const finalChunk = linked;` (no unlink), i.e. reverting to the pre-fix behavior.
2. Ran `bunx playwright test --project=authed entities-ticket-subtarefa.spec.ts -g "editing a subtarefa's parent type"`.
3. Result: **FAILED** —
   ```
   Error: expect(received).toBe(expected) // Object.is equality
   Expected: false
   Received: true
     397 |   expect(listSubtarefasByTarefa(chainTarefaId).some((r) => r.id === eid)).toBe(false);
   ```
   confirming the test genuinely detects the regression (the stale tarefa link was still present after switching to a ticket parent).
4. Restored the fix (`git diff` showed zero diff against the committed `0aa4bd5` state afterward).
5. Re-ran the full suite: `bunx playwright test` → **16/16 passed**.
6. Confirmed no leftover `phase04-e2e-` records via `apollo subtarefa listar` / `apollo ticket listar` / `apollo tarefa listar` (all 0) — the failed intermediate run's own `afterAll` swept its fixture.

## CLI JSON Readback Evidence (representative)

From the "editing a subtarefa's parent type" test, post-edit server-side checks (with the fix restored):
- `apollo subtarefa listar --tarefa-id <chainTarefaId>` → does **not** include the edited subtarefa's id.
- `apollo subtarefa listar --ticket-id <chainTicketId>` → **does** include the edited subtarefa's id.

This is the exactly-one-link invariant proven server-side, not merely in the DOM.

## Deviations from Plan

### Auto-fixed Issues

**1. [Checkpoint decision / Rule 4 resolved by orchestrator] Fixed EntityScreen.svelte's edit-time XOR unlink gap**
- **Found during:** Prior attempt at this plan (before this resumption), confirmed again while re-reading `EntityScreen.svelte`'s `handleSubmit`/`startEdit` on resumption.
- **Issue:** On edit, switching a subtarefa's xorLink parent type only called `.link()` for the newly selected choice; the previously-linked choice was never `.unlink()`-ed, so a record could end up linked to both a tarefa and a ticket simultaneously — violating the XOR invariant this plan exists to prove.
- **Fix:** Added `originalXorParentType`/`originalXorParentId` state, populated in `startEdit` from the currently-linked xorLink choice; at submit time, if the type differs from the original, an `unlinkPayload` is built and passed to `.unlink()` alongside the `.link()` call for the new choice.
- **Files modified:** `web/src/lib/entities/EntityScreen.svelte`
- **Verification:** `bun run check`/`lint`/`format:check`/`build` all exit 0; Test 4(c) in the new e2e spec passes with the fix and demonstrably fails without it (see Fail-Loud Demonstration above).
- **Committed in:** `0aa4bd5` (separate commit, per orchestrator's Option A decision, since this touches a file the plan's own prohibitions list normally forbids editing — explicitly authorized for this resumption given strictly sequential execution).

---

**Total deviations:** 1 auto-fixed (checkpoint-authorized shared-file correctness fix)
**Impact on plan:** Necessary for the plan's own core deliverable (a provably correct XOR invariant) to be true. No scope creep beyond the single, narrowly-scoped edit-path fix; `registry.ts`, `Shell.svelte`, and `types.ts` were not touched.

## Issues Encountered

None beyond the shared-file bug documented above (which was itself the reason this plan had previously halted at a checkpoint).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `EntityScreen.svelte`'s xorLink edit path is now correct for all consumers, including 04-05 (not yet started) which will inherit this fix automatically since it reads the same file.
- **Flag for orchestrator:** 04-05 (sibling wave-3 plan) should NOT re-attempt this same fix — it is already shipped in `0aa4bd5` on `main`. If 04-05's own read-first step re-discovers the (now-fixed) edit path, it should confirm the fix is present rather than re-deriving it.
- `tickets` and `subtarefas` are both fully wired into the generic entity engine and discoverable via `import.meta.glob`; no registry changes were needed.

---
*Phase: 04-web-spa-auth-crud-smoke-ui*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: web/src/lib/entities/defs/tickets.ts
- FOUND: web/src/lib/entities/defs/subtarefas.ts
- FOUND: web/e2e/entities-ticket-subtarefa.spec.ts
- FOUND: .planning/phases/04-web-spa-auth-crud-smoke-ui/04-04-SUMMARY.md
- FOUND commit: 0aa4bd5 (fix EntityScreen.svelte)
- FOUND commit: e10e497 (feat tickets/subtarefas defs)
- FOUND commit: 8c1562c (test e2e spec)
