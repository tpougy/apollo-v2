# Phase 2: Shared ANBIMA Calendar - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Business-day math is correct and identical on both client and CLI, powered by one vendored data file.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions. PROJECT.md C-03 is LOCKED: `shared/anbima-calendar.json` is a static vendored table (~948 dates, 2000-2078, federal-only), sourced from `github.com/ianliu/feriados-anbima`. Both `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py` read exclusively from this JSON — never from a library's built-in/algorithmic calendar. Update path is manual (`shared/scripts/update_calendar.py`, run yearly), never computed at runtime.

</decisions>

<code_context>
## Existing Code Insights

Phase 1 already built: `shared/instant.schema.ts`, `shared/instant.perms.ts` (shared/ dir exists), `web/` Svelte 5 + Vite SPA (bun), `cli/` uv-managed Python package with `apollo` entrypoint and ruff+ty green. This phase adds new files under `shared/`, `web/src/lib/`, and `cli/apollo_cli/` following those established conventions.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP phase description and success criteria — see PROJECT.md constraint C-03.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
