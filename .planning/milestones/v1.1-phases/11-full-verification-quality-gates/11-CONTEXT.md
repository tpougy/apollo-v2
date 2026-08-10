# Phase 11: Full Verification & Quality Gates - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The entire restyled SPA — login, shell/nav, and every entity's table and form across all capability classes — is re-proven correct end-to-end against the live InstantDB app by an updated and extended Playwright suite, with zero human UAT anywhere in the milestone and clean formatter/linter/type-check gates on `web/`.

This is a **closing/audit phase, not a new-feature phase**: Phases 7-10 already restyled and individually verified every screen (each phase's own `-VERIFICATION.md` passed). Phase 11's job is to:
1. Confirm the FULL existing `web/e2e/` suite passes together in one clean run (not just per-phase subsets).
2. Add any missing cross-cutting coverage that individual phases didn't need to prove in isolation (e.g. a full-suite smoke pass, one comprehensive "everything restyled, nothing broken" pass).
3. Produce the single documented command that re-runs the whole suite unattended (VERIFY-03's concrete proof).
4. Final Biome + svelte-check gate confirmation with zero new suppressions vs the v1.0 baseline (QUAL-01).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

### Locked constraints from PROJECT.md (do not reopen)
- C-11: shadcn-svelte default look throughout (already fully applied by Phases 7-10). No new components expected this phase unless a genuine gap is found.
- C-12: zero human UAT anywhere — every `<verify>` must be `<verify><automated>`. This is the LAST phase proving this holds for the whole milestone.
- C-08: `bun`/`bunx` only.

### Known operational risk (carried forward from Phases 8/10)
- InstantDB rate-limits the test email (`tp@rbrasset.com.br`) if magic-code sends happen in a tight burst (observed during Phase 10's parallel-plan execution: `429 Too many verification codes requested`). **Do NOT run multiple auth-dependent Playwright processes in parallel in this phase.** Run the full suite as ONE sequential `bun run test:e2e` invocation (which internally does exactly one `setup` send, reused by `authed`), not multiple separate spawns hitting `--project=setup`/`authed` concurrently.
- If a 429 is hit, wait several minutes before retrying — do not hammer the endpoint.

### Current state entering this phase (already true, verify don't re-invent)
- 39/39 e2e tests passing as of Phase 10's close (per `10-VERIFICATION.md`).
- `bun run check` / `bun run lint` clean (1 pre-existing unrelated svelte-check warning on `EntityScreen.svelte`'s `configProp`, traced to Phase 4 of v1.0 — not a new suppression, do not "fix" it as if it were new scope; 1 pre-existing acknowledged Biome info finding on CLI-generated `calendar-caption.svelte`'s missing radix — also not new scope).
- If this phase's own full-suite run finds something Phases 7-10 missed, fix it here (that's exactly what this phase exists to catch) — but don't manufacture busywork if everything is already green.

</decisions>

<code_context>
## Existing Code Insights

All restyle work is complete: `LoginScreen.svelte`, `Shell.svelte`, `EntityScreen.svelte` (table + form), `App.svelte` (Toaster mount) are all on shadcn-svelte primitives. `web/e2e/` contains: `auth.setup.ts`, `auth.spec.ts`, `no-leakage.spec.ts`, `design-system.spec.ts`, `login-flow.spec.ts`, `shell-nav.spec.ts`, `entities-fundos.spec.ts`, `entities-table-restyle.spec.ts`, `entities-form-restyle.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-rotina-log.spec.ts`, `entities-ticket-subtarefa.spec.ts`, `routine-job.spec.ts`, `routine-job-cross-channel.spec.ts` (the last two are v1.0 job-logic specs, unrelated to this milestone's UI restyle but must stay green too — full suite means full suite).

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond REQUIREMENTS.md VERIFY-01/02/03, QUAL-01 and ROADMAP.md Phase 11's 4 success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
