# Phase 3: CLI Auth & CRUD - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The controladoria professional (or Claude on their behalf) can manage every domain entity end-to-end from the terminal, authenticated as the same real InstantDB user the web app will use.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. PROJECT.md C-05 is LOCKED: magic-code email auth, CLI stores session at `~/.config/apollo-cli/session`, no admin token in normal operation, same `instant.perms.ts` rules as the browser (auth.id == data.donoId). C-07 is LOCKED: CLI surface uses `click`, subcommands organized entity+action.

### Autonomous magic-code auth testing (LOCKED, user-authorized — see PROJECT.md C-10)
This phase's `apollo auth login` flow requires a real magic-code email round trip. The user explicitly authorized reading that email from their real inbox (`tp@rbrasset.com.br`) using the `mcp__claude_ai_Microsoft_365__outlook_email_search` tool, whenever needed to complete or test this flow. Search for the most recent InstantDB magic-code email, extract the code, use it immediately. Scoped strictly to fetching that one code — never use this access for anything else. The EXECUTOR agent implementing/testing this flow must do this itself (it has tool access), not defer to a human.

</decisions>

<code_context>
## Existing Code Insights

Phase 1 built `cli/apollo_cli/config.py` (env/config discovery), `cli/apollo_cli/cli.py` (click group, `doctor` subcommand), `cli/apollo_cli/bizdays.py` (Phase 2). Phase 2 also added `pytest` as a dev dependency and established the test file layout (`cli/tests/`). This phase extends `cli/apollo_cli/` with auth + CRUD subcommands, following the same click/uv conventions.

The InstantDB Python Admin SDK (`instantdb` package, already a runtime dependency since Phase 1/2) needs research on whether it exposes a *non-admin*, user-session-based auth+transact path (magic code send/verify, then transact as that authenticated user) — this was flagged as an open question in Phase 1's research and not yet resolved.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP phase description and success criteria — see PROJECT.md C-05, C-07, C-10.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
