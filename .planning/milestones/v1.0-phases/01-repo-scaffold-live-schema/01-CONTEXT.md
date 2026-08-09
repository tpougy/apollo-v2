# Phase 1: Repo Scaffold & Live Schema - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The apollo-v2 monorepo exists with working tooling for both runtimes, and the InstantDB schema/permissions are the live source of truth for all future work.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions. PROJECT.md constraints (C-01 through C-10) are LOCKED and must be followed exactly: monorepo layout (`shared/`, `web/`, `cli/`), 8+1 entity schema shape, `donoId` denormalization, quality gates (ruff+ty on cli/, bun+formatter+linter on web/).

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Reference implementation for InstantDB + Svelte patterns: `~/pessoal/ultima-missao`.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP phase description and success criteria — see PROJECT.md constraints C-01 (repo layout), C-04 (schema), C-05 (auth/perms), C-08 (quality gates).

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
