---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Lapidação de UI (SaaS-grade polish)
status: Awaiting next milestone
stopped_at: Completed 17-02-PLAN.md
last_updated: "2026-08-10T22:10:05.998Z"
last_activity: 2026-08-10
last_activity_desc: "Phase 17 (final phase of v1.2) complete: cross-phase spacing-parity walkthrough, remaining dual-color-scheme + keyboard/focus-visible coverage, final quality gates green, 24/24 v1.2 requirements complete."
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 9
  completed_plans: 9
  percent: 100
current_phase: 17
current_phase_name: Cross-Phase Verification & Quality Gates
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-10)

**Core value:** The user can execute every piece of controladoria data-entry work from either the Svelte SPA or the Python CLI, both authenticated as the same real user under the same InstantDB permission rules. Validated in v1.0. v1.1 made the SPA visually coherent on shadcn-svelte defaults; v1.2 refines composition/spacing/hierarchy on the same four screens so they read as a finished SaaS product — no new functional capability.
**Current focus:** v1.2 milestone (Phases 12-17) — all 6 phases complete; pending `/gsd-complete-milestone`

## Current Position

Phase: Milestone v1.2 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-08-10 — Milestone v1.2 completed and archived

## Performance Metrics

**Velocity:**

- Total plans completed: 5 (v1.2 not yet started; 35 lifetime across v1.0+v1.1)
- Average duration: N/A (no v1.2 plans yet)
- Total execution time: 0 hours (v1.2)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 15 | 1 | - | - |
| 16 | 2 | - | - |
| 17 | 2 | - | - |

**Recent Trend:**

- Last 5 plans: N/A (v1.1 closed; v1.2 not yet started)
- Trend: N/A

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 12 P01 | 20min | 3 tasks | 3 files |
| Phase 13 P01 | 10min | 3 tasks | 3 files |
| Phase 14 P01 | 20min | 2 tasks | 20 files |
| Phase 14 P02 | 30min | 2 tasks | 12 files |
| Phase 15 P01 | 55min | 3 tasks | 2 files |
| Phase 16 P01 | 90min | 2 tasks | 20 files |
| Phase 16 P02 | 90min | 2 tasks | 3 files |
| Phase 17 P01 | 19min | 2 tasks | 1 files |
| Phase 17 P02 | 35min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (all sourced from the locked SPEC, see PROJECT.md Constraints).

- v1.2 roadmap derivation: 24 v1.2 requirements grouped into 6 phases (12-17), outside-in by DOM containment (`LoginScreen` → `Shell` → `EntityScreen` sub-steps) and risk-ascending within `EntityScreen` (header/loading/empty → form/dialog → row-actions/delete), per dedicated architecture/pitfalls research for this milestone.
- v1.2 roadmap: `window.confirm()` → `AlertDialog` (DELCONF-01) is explicitly scoped IN as its own Phase 16 sub-scope with dedicated Playwright coverage — not silently folded into row-action spacing work, per research's Pitfall 5 (scope creep) guidance.
- v1.2 roadmap: cross-cutting requirements (POLISH-01..04, VERIFY-04..07, QUAL-02) all map to the final Phase 17, since VERIFY-07 explicitly requires re-checking every earlier phase's surface together — none of them can be truly proven until all five polish phases have landed.
- v1.1 kickoff: UI stack locked to Tailwind v4 + shadcn-svelte default style/tokens, `@lucide/svelte` icons, dark mode via `prefers-color-scheme` only (C-11).
- v1.1/v1.2 kickoff: No human UAT gate anywhere — every phase's success criteria must be Playwright-provable against the live InstantDB app (C-12).
- [Phase 15]: Fixed a busy-guard double-submit race in EntityScreen.svelte's handleSubmit (plan-checker-flagged deviation) — busy=true now set immediately after the re-entrancy guard, wrapping the entire validation+queryOnce+transact flow in try/finally, not just the transact try/catch.
- [Phase 15]: ENTFRM-05's Playwright proof uses getComputedStyle(marginBlockEnd) as deterministic primary evidence instead of pure boundingBox() pixel deltas across heterogeneous control kinds, avoiding a webfont-load subpixel race unrelated to the actual applied CSS spacing.
- [Phase 16 P01]: Vendored AlertDialog via direct shadcn-svelte registry JSON fetch instead of the interactive bunx CLI (which hit an un-drivable overwrite-confirmation prompt over button in this sandboxed pty) — byte-identical output, confirmed zero package.json/bun.lock diff.
- [Phase 16 P01]: Fixed ENTFRM-01's success-toast locator (Rule 1 bug) to filter by exact delete-toast text — the AlertDialog's faster confirm path (no native-dialog CDP round trip) exposed a pre-existing ambiguity with the still-visible prior edit-success toast.
- [Phase 16 P02]: Fixed bits-ui's AlertDialogCancelState never emitting a disabled HTML attribute (only gating its own onclick/onkeydown internally) via a child-snippet override in the vendored alert-dialog-cancel.svelte, discovered by the new busy-gating test.
- [Phase 16 P02]: Used a CDP network-latency throttle (800ms) to reliably observe delete-confirm's busy/disabled window, since db.transact()'s server-ack round trip resolves faster on the live app than sequential Playwright assertions could reliably catch.
- [Phase 17 P01]: Renamed EntityScreen.svelte's query.error Alert testid from entity-error to entity-query-error — the formError/query.error pair were two independent {#if} blocks (not chained), so they were not actually mutually exclusive as the plan assumed; no existing spec targeted the query-error path, so the rename was zero-risk.
- [Phase 17 P01]: Left single-occurrence p-0 (Popover.Content wrapping the date-picker Calendar) and several single-file spacing values unmodified — all are bounded default-scale Tailwind tokens (no arbitrary values), and each composition file's structurally distinct role (esp. Shell.svelte's SHELL-03 single-frame ownership) makes forced cross-file duplication counterproductive, not a genuine POLISH-04 violation.
- [Phase 17 P02]: Fixed 11 pre-existing `noNonNullAssertion` Biome warnings in Phase 13's `shell-chrome.spec.ts` (a file outside this plan's own `files_modified` list) — QUAL-02 requires `bun run check`/`bun run lint` to report zero findings beyond the two named v1.1-baseline items across the WHOLE v1.2 diff, not just the plan's own new file, and the plan's own Task 3 action text explicitly mandates fixing any such finding with a real code change, never a suppression. Fixed via explicit null-check-then-throw narrowing, mirroring `login-composition.spec.ts`'s existing convention.
- [Phase 17 P02]: `instanciasRotina`'s keyboard/focus-visible smoke test asserts on whichever `row-edit` Tab reaches rather than a specific seeded row — this live app's `instanciasRotina` table is never guaranteed empty (Shell.svelte's routine-instance generation job runs on every authenticated mount and creates real rows independent of any single test's own seeded record), discovered when the original row-filtered assertion failed against pre-existing live data.
- [Phase 17 P02]: `logInferenciaClaude`'s keyboard smoke test starts its Tab sequence from the nav bar's second-to-last button rather than logInferenciaClaude's own nav button — `ordem: 9` makes it the LAST of the 9 nav buttons in DOM order, so a forward Tab FROM it cannot "reach the next nav button" (there is none); the test instead proves Tab-reachability and a focus-visible affordance ON `nav-logInferenciaClaude` itself, arriving there from its predecessor, which is the closest faithful reading of the requirement given this structural fact.

### Pending Todos

None yet.

### Blockers/Concerns

None — the one open judgment call research flagged (`window.confirm()` → `AlertDialog` in/out of scope) is resolved: DELCONF-01 is in scope, owned by Phase 16.

**v1.2 milestone non-blocking tech debt** (logged in `.planning/phases/16-entity-screen-row-actions-delete-confirmation/16-REVIEW.md`, WR-01/WR-03 — WR-02 fixed; re-confirmed still accurate, unfixed, by Phase 17 Plan 02's read-only check, and carried forward into `17-02-SUMMARY.md` for the eventual `/gsd-complete-milestone v1.2` audit):

- WR-01 (Phase 16): no type-level invariant enforces that any entity with `capabilities.delete: true` also has `capabilities.create: true` — the post-delete focus fallback to `entity-create-start` would silently no-op if a future entity ever broke that pairing. All 9 current entities satisfy it; not a live bug.
- WR-03 (Phase 16): a hung `db.transact` during delete leaves the AlertDialog permanently undismissable (no timeout/abort path) — same class of edge case as any other in-flight-write UI in this app, not new to this phase.
- WR-01 (Phase 17, test-quality only, `.planning/phases/17-cross-phase-verification-quality-gates/17-REVIEW.md`): the fundos keyboard/focus-visible test in `cross-phase-verification.spec.ts` assumes the newly created row is the first Tab stop, with no assertion the table has exactly one row — a fragile unasserted invariant on a live shared table, not a production bug.
- WR-02 (Phase 17, test-quality only): four cleanup helpers in `cross-phase-verification.spec.ts` swallow all errors indiscriminately in their "already deleted, fine" catch blocks, which could mask a genuine delete-path regression rather than just the expected already-gone case.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| UI | 5-panel dashboard (Hoje/calendários/Projetos/Backlog, `.eml` drag-and-drop) | Deferred — separate future milestone | v1.0 close |
| Rules | Automatic soft-deadline reallocation, chained delay propagation | Deferred v2 rules | v1.0 close |
| UI | Occasional live-email-timing test flake (magic-code round trip) | Deferred — non-blocking, pre-existing | v1.1 close |

## Session Continuity

Last session: 2026-08-10T21:05:00.000Z
Stopped at: Completed 17-02-PLAN.md
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
