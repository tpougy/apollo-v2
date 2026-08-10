# Phase 17: Cross-Phase Verification & Quality Gates - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Earlier phases' surfaces are re-checked together (not just each phase's own screen in isolation) to confirm the spacing/rhythm established in Phase 12-13 still reads consistently once every later phase's changes have landed. Full Playwright suite + quality gates green.

Requirements: POLISH-01, POLISH-02, POLISH-03, POLISH-04, VERIFY-04, VERIFY-05, VERIFY-06, VERIFY-07, QUAL-02.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

### Design Intent (from REQUIREMENTS.md) — the central purpose of this phase
This is the phase that operationalizes "bonito, elegante e orgânico" as something provable, not just claimed. Per REQUIREMENTS.md's Design Intent section: "no phase treated as done merely because its own screen looks fine in isolation if it visibly breaks the flow established by an earlier phase" (VERIFY-07), and "a single consistent spacing scale" across every touched screen (POLISH-04). This phase must NOT just re-run the existing suite — it must add a cross-phase check that walks through Login → Shell → all 9 entity screens (table + form + delete) in one pass and confirms the spacing rhythm/visual language reads as one coherent product, not 5 independently-shipped patches.

### Scope boundary
This is a verification-and-hardening phase, not a new-feature phase. No new visual features. Fix genuine cross-phase inconsistencies found (e.g. if Phase 12's login spacing scale drifted from Phase 14's table spacing scale), but do not redesign anything that already individually passed its own phase's verification.

### Research guidance (from .planning/research/SUMMARY.md and PITFALLS.md)
- At least one dual-color-scheme (`page.emulateMedia`) check per touched surface (login, shell, table, form, delete confirmation) — confirm no dark-mode contrast regression across the whole set, not just per-phase.
- One keyboard-navigation/`:focus-visible` smoke test across one representative screen per capability class (full-CRUD/restricted/read-only).
- Final grep sweep for raw color literals (hex/rgb/oklch outside `app.css`) across ALL files touched this milestone (Phases 12-16), not just the current phase's files.
- Final grep sweep for `data-testid` duplicates across all touched files.
- Full 39+ test Playwright suite green (grew across phases 12-16 to 60+ tests) in one clean sequential run.
- `bun run check` and `bun run lint` clean, zero new suppressions vs the v1.1 baseline (QUAL-02).
- Document the milestone's non-blocking tech debt (Phase 16's WR-01/WR-03, if not already resolved) in the closing summary, following the same pattern as v1.1's milestone audit.

</decisions>

<code_context>
## Existing Code Insights

- All files touched this milestone: `web/src/lib/auth/LoginScreen.svelte`, `web/src/App.svelte`, `web/src/lib/Shell.svelte`, `web/src/lib/entities/EntityScreen.svelte`, `web/src/lib/entities/types.ts`, all 9 `web/src/lib/entities/defs/*.ts`, `web/src/lib/components/ui/{skeleton,empty,alert-dialog}/*` (newly vendored), `web/e2e/*.spec.ts` (multiple new/updated specs).
- The full command that reproduces the whole proof unattended, per v1.1's precedent, should be `bun run test:e2e` (or an equivalent single documented command) plus `bun run check`/`bun run lint`.
- v1.1's closing pattern (for reference, not to copy mechanically): a final phase that re-ran the full suite, did a screen×capability-class coverage audit, ran quality gates, and updated `web/README.md` with the reproduction command.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the goal/success-criteria and decisions above — discuss phase was skipped. Refer to ROADMAP phase description, success criteria, and the research guidance above.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
