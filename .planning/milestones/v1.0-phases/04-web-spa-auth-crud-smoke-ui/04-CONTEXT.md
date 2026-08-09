# Phase 4: Web SPA Auth & CRUD Smoke UI - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The same professional can perform the same operations from a browser, proving UI/CLI parity at the data layer. This is a functional smoke UI, NOT a polished dashboard — PROJECT.md explicitly excludes panel/dashboard UI design from this milestone (workflow.ui_phase is disabled; no UI-SPEC.md gate applies).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting, and UI-SPEC generation is disabled for this milestone (functional smoke UI only, per PROJECT.md "Out of Scope for this migration"). PROJECT.md C-05 is LOCKED: same magic-code auth, same instant.perms.ts rules as the CLI — SPA and CLI are equally-privileged, equally-authenticated clients of the same backend. Keep screens minimal: forms + tables, no visual design investment.

### Autonomous magic-code auth testing (LOCKED — see PROJECT.md C-10, corrected 2026-08-09)
This phase's login screen requires a real magic-code email round trip to prove SC-1 and SC-4. The working channel on this machine is Outlook Classic (desktop) accessed via COM from WSL through `/mnt/c/Users/thomaz.pougy/Documents/RBR/Sandbox/outlook-rules`'s `orules.ps1 peek` command (NOT the Microsoft 365 MCP tool, which does not have access to tp@rbrasset.com.br on this machine). Example: `powershell.exe -NoProfile -Command "Set-Location 'C:\Users\thomaz.pougy\Documents\RBR\Sandbox\outlook-rules'; .\orules.ps1 peek --folder Inbox --days 1 --grep 'nstant' --body 0 --max 5"` — the code is in the subject line. Codes expire in ~60-90 seconds; keep the send->peek->verify sequence tight. The EXECUTOR agent must do this itself.

</decisions>

<code_context>
## Existing Code Insights

Phase 1 built `web/` (pure Svelte 5 + Vite SPA, no SvelteKit), `web/src/lib/db.ts` (InstantDB client init with schema). Phase 2 added `web/src/lib/bizdays.ts` + tests. Phase 3 built the full CLI CRUD surface (`cli/apollo_cli/entities/*.py`) against the same `shared/instant.schema.ts` — these entity modules are a reference for exact field names/links/validation rules the SPA screens must mirror, even though the implementation language differs (TS + Svelte components + InstantDB's `useQuery`/`transact` instead of the Python SDK's `as_user`/`transact`).

A real InstantDB user session already exists for tp@rbrasset.com.br (created in Phase 3), and real domain records already exist in the live app from Phase 3's CRUD testing (fundos, projetos, etc.) — the SPA can and should read these to prove SC-3 (CLI-created records visible in the UI).

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP phase description and success criteria — see PROJECT.md C-05. This is intentionally a thin/functional UI: plain HTML forms and tables per entity, no component library, no visual polish — the goal is proving data-layer parity, not shipping a designed product.

</specifics>

<deferred>
## Deferred Ideas

Polished dashboard/panel UI (5 fixed panels, drag-and-drop, etc.) — explicit future milestone per PROJECT.md "Out of Scope".

</deferred>
