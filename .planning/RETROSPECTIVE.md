# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Apollo v2 MVP

**Shipped:** 2026-08-09
**Phases:** 6 | **Plans:** 27 | **Sessions:** 1 (single unattended autonomous run)

### What Was Built
- Live InstantDB schema (9 entities) and `donoId` permission rules, pushed as the single source of truth for both runtimes
- Shared vendored ANBIMA business-day calendar, byte-identical between `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py`
- Full magic-code-authenticated CRUD for every domain entity on both the Python CLI and the Svelte 5 SPA
- Idempotent routine-instance-generation job (all 3 generation types: `du_fixo`, `corrido_fixo`, `encadeado`) running identically from both channels
- A composed `verify-phase-06.sh` end-to-end gate proving cross-channel parity, interrupted-job atomicity, and cross-user permission isolation against the live app

### What Worked
- Delegating magic-code email round trips to the orchestrator (not subagents) — subagents never inherit the orchestrator's MCP tool scoping, so this pattern had to be established once (Phase 3) and then reapplied identically through Phase 6 without rediscovery
- Insisting on live, non-mocked proofs for every phase (`verify-phase-0N.sh`) surfaced real bugs that fixture-based tests would have hidden — the missing `antecessor` link query and the lookup-vs-update InstantDB conflict were both found this way
- Composing all prior verify scripts into one Phase 6 gate, rather than writing new checks from scratch, surfaced 8 latent defects in Phases 2-5's own verification tooling that had been silently masking a false-positive exit code since Phase 3

### What Was Inefficient
- The original CONTEXT.md for Phase 6 assumed the M365 Outlook MCP tool would reach `tp@rbrasset.com.br`; it didn't, and the correction (Outlook Classic via WSL/PowerShell COM bridge) had to be discovered mid-execution and retrofitted into `PROJECT.md` constraint C-10
- `06-VALIDATION.md` was missing until a plan-checker BLOCKER caught it at Phase 6 — the same gap likely existed silently in Phases 1-5 (not retroactively fixed, judged low-value since those phases' actual verification was already rigorous)
- One executor subagent misread a context-usage system warning meant for the orchestrator's conversation as applying to itself and aborted a ~2.5-hour plan prematurely; had to be re-invoked with an explicit context-budget clarification

### Patterns Established
- Orchestrator performs all mailbox-dependent auth steps directly; subagents get session state handed to them, never mailbox access
- Every phase ships a `verify-phase-0N.sh` that independently re-proves that phase's requirements against the live system; later phases compose earlier ones rather than duplicating checks
- Schema gaps discovered mid-milestone (e.g., `templatesRotina.offsetDias`) are added as `.optional()` fields, since InstantDB cannot backfill required attributes onto existing live rows

### Key Lessons
1. When a milestone requires unattended, multi-hour execution with real external auth (email-based magic codes), verify which MCP/tool channel actually reaches the target mailbox *before* committing it to a locked constraint — test it live in Phase 1, not assumed from documentation.
2. Nyquist Dimension 8 (`06-VALIDATION.md`) should be checked at roadmap-creation time for every phase with a "Validation Architecture" RESEARCH section, not discovered reactively at the last phase.
3. Composing all per-phase verification scripts into a single end-to-end gate is a high-value final phase — it is often the first time all scripts are actually run together, and latent tooling bugs surface there.

### Cost Observations
- Model mix: not tracked this milestone
- Sessions: 1 continuous autonomous run (~hours, spanning Phases 1-6)
- Notable: zero human interaction required after the initial "execute autonomously" directive; all blockers were resolved by the orchestrator performing real external actions (email auth) itself rather than pausing for the user

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 6 | First milestone — established the orchestrator-performs-auth pattern and live-proof-only verification discipline |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | live pytest + bun test suites across cli/ and web/ | ruff+ty clean on cli/, Biome+svelte-check clean on web/ | InstantDB SDKs, click, bizdays, Playwright |

### Top Lessons (Verified Across Milestones)

1. Live, non-mocked verification catches real integration bugs that fixtures cannot — established this milestone, not yet cross-validated.
