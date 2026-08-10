# Phase 12: Login Screen Polish - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

`LoginScreen.svelte` reads as a properly composed, centered auth card — not a bare form floating on the page — while the existing magic-code auth flow keeps working unchanged.

Requirements: LOGIN-01, LOGIN-02.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Design Intent (from REQUIREMENTS.md, applies to every phase this milestone)
The app should feel bonito, elegante e orgânico — not merely "componentized correctly." Concretely for this phase: consistent rhythm (single spacing scale across both auth steps, no ad hoc per-step values), and resolve any open composition judgment call toward whatever reads as most polished/finished within the shadcn-svelte-default constraint — not the minimum viable diff. Still shadcn-svelte defaults only — no custom color palette.

### Research guidance (from .planning/research/SUMMARY.md and STACK.md)
- Wrap `LoginScreen` in `CardHeader`/`CardTitle`/`CardDescription` (currently the `Card` has zero header sub-parts).
- Center the card in the full viewport (`min-h-screen flex items-center justify-center` pattern), not a bare form floating on the page.
- Use consistent `space-y-4`-scale spacing between field groups on both the email-entry and code-entry steps.
- Do NOT add typographic classes to `App.svelte`'s root `<h1>` — `design-system.spec.ts` asserts computed font-size/weight on it; if it's visually redundant with the new Card header, address its removal/relocation carefully and update that spec deliberately, not incidentally.
- No new npm dependency; `Card` sub-parts are already installed (`web/src/lib/components/ui/card`).

</decisions>

<code_context>
## Existing Code Insights

- `web/src/lib/auth/LoginScreen.svelte` — two-step magic-code auth (email entry → code entry), already uses `Card`/`Input`/`Label`/`Button`/`Alert`, but the `Card` has no `CardHeader`/`CardTitle`/`CardDescription`, and there is no explicit spacing scale applied between field groups.
- Load-bearing `data-testid`s that MUST be preserved verbatim: `login-screen`, `login-email`, `login-code`, `login-submit` (reused across both steps), `login-error`, `login-resend`.
- `web/e2e/login-flow.spec.ts` and `web/e2e/auth.setup.ts` exercise the real magic-code round trip (real inbox `tp@rbrasset.com.br`, codes expire ~60-90s) — any structural change must keep these selectors and the two-step flow intact.
- `web/src/App.svelte` has a root `<h1>Apollo v2</h1>` outside all layout, asserted by `design-system.spec.ts` (computed style) — do not touch its typography as part of this phase.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the goal/success-criteria above — discuss phase was skipped. Refer to ROADMAP phase description, success criteria, and the research guidance above.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
