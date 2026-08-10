# Phase 8: Auth & Shell Restyle - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The two authenticated-shell-adjacent screens users see before touching any entity — the magic-code login and the top-level Shell/nav — are rebuilt on shadcn-svelte primitives, with the existing two-step auth flow and nav/logout behavior functionally unchanged.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Locked constraints from PROJECT.md (do not reopen)
- C-11: shadcn-svelte via its own CLI default (`--preset b0` = nova/neutral/lucide, already initialized in Phase 7). No custom colors/tokens.
- C-12: zero human UAT anywhere — every `<verify>` must be `<verify><automated>`, never `<human-check>`.
- C-08: `bun`/`bunx` only.

### Key operational note (carried forward from v1.0, verified still true this phase)
- The real magic-code auth round trip (`web/e2e/auth.setup.ts` + `web/e2e/helpers/magic-code.ts`) works by shelling out directly to `powershell.exe` on the Windows host from WSL (Outlook Classic COM bridge, `orules.ps1 peek`) — this is a plain OS subprocess call, NOT an MCP tool, so it is reachable from any Bash-capable process on this machine including a plan-executor subagent. There is no need to route magic-code auth through the orchestrator specifically for this milestone (unlike v1.0's MCP-based email search, which genuinely was orchestrator-only). The executor should feel free to run `bunx playwright test --project=setup` (and full `authed`-project specs) directly.
- Real inbox used: `tp@rbrasset.com.br`. Codes expire fast (~60-90s) — `auth.setup.ts` already handles the resend-on-expiry retry loop; do not add pauses between send and read.

</decisions>

<code_context>
## Existing Code Insights

- `web/src/lib/auth/LoginScreen.svelte` — current plain-CSS two-step magic-code flow (email step → code step), with `data-testid`s already wired: `login-screen`, `login-email`, `login-code`, `login-submit`, `login-error`, `login-resend` (per `auth.setup.ts` usage — preserve these testids exactly, downstream e2e specs depend on them).
- `web/src/lib/Shell.svelte` — top-level authenticated layout with `data-testid="app-shell"` (also load-bearing, `auth.setup.ts` asserts on it) — entity nav + logout, currently plain CSS.
- Phase 7 already wired Tailwind v4 + shadcn-svelte (`components.json`, `src/lib/utils.ts`, CSS tokens, dark mode via `prefers-color-scheme`) but added **zero actual shadcn components yet** — this phase's tasks must run `bunx shadcn-svelte@latest add button input label card alert` (or whichever subset is needed) before importing them.
- `@lucide/svelte` is installed (Phase 7) for icons.
- Existing e2e conventions: assert via `data-testid`, not CSS/tag selectors, for structural checks (per Phase 7's `07-PATTERNS.md` finding).

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond REQUIREMENTS.md AUTHUI-01/02, SHELLUI-01/02 and ROADMAP.md Phase 8's 5 success criteria. Refer to those.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
