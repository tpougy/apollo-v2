# Phase 6: End-to-End Verification - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The whole system is proven trustworthy — every claim from phases 1-5 holds when exercised together, and code quality gates are green across the entire repo. This is the final phase of the v1 milestone; no new features, only cross-cutting proof.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices at Claude's discretion — discuss was skipped. This phase should primarily COMPOSE existing per-phase verify scripts (`verify-phase-01.sh` through `verify-phase-05.sh`, all already proven working) rather than reinvent checks, adding only what's genuinely new: cross-channel parity across the full entity set (SC-1), an interrupted-job simulation (SC-4), and a real second-user permission-isolation test (SC-5).

### Second real test user for SC-5 (cross-user permission isolation)
The primary account for all prior testing is `tp@rbrasset.com.br`. SC-5 requires a SECOND real, distinct InstantDB user to prove `donoId` isolation is enforced by the server (not just by client-side UI hiding). Two real, distinct mailboxes exist that are reachable by tools available in this environment:
- `admin@rbrasset.com.br` and/or `rm@rbrasset.com.br` — reachable via the `mcp__claude_ai_Microsoft_365__outlook_email_search` MCP tool (confirmed working in earlier phases' troubleshooting — this tool DOES have access to these mailboxes, unlike `tp@rbrasset.com.br`).
Use one of these as the second real InstantDB user's email for the SC-5 magic-code login + cross-user isolation proof. This is a genuine second real user account on the live app, not a mock — consistent with this project's "no mocked auth" discipline established in Phases 3-4.

</decisions>

<code_context>
## Existing Code Insights

Every phase already ships a `verify-phase-0N.sh` script (01 through 05) that independently re-proves its own phase's requirements against the live InstantDB app: `.planning/phases/01-repo-scaffold-live-schema/verify-phase-01.sh`, `02-.../verify-phase-02.sh`, `03-.../verify-phase-03.sh`, `04-.../verify-phase-04.sh`, `05-.../verify-phase-05.sh`. This phase's `verify-phase-06.sh` (or equivalent) should run all five plus the new checks, as the single "is Apollo v2 v1 done" gate.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP phase description and the 5 success criteria. VERIFY-02/VERIFY-03 (repo-wide quality gates) are likely already true given every phase enforced them incrementally — this phase should assert that end-to-end, not silently assume it.

</specifics>

<deferred>
## Deferred Ideas

None — this is the final phase of the milestone.

</deferred>
