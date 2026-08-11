# Phase 18: Navigation Foundation & EntityScreen Extension - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Users see a reorganized 6-section topbar that hides internal-detail entities from
first-level navigation and land on the Dashboard route by default, while `EntityScreen` and
`registry.ts` gain fully additive, zero-regression nested-scoping support that later phases will
build on.

</domain>

<decisions>
## Implementation Decisions

Full binding spec: `/home/thomaz/pessoal/apollo-v2/spec-ui.md` — read §0 (constraints), §1 (nav),
§2.1 (EntityScreen extension) in full before planning. Key decisions already locked by the spec,
not open for re-litigation:

- `EntityConfig` gains exactly two optional fields: `nav?: "primary" | "nested"` and
  `navTitulo?: string` (spec §1.2). `nav: "nested"` on `etapas`, `templatesRotina`, `subtarefas`,
  `tarefas`. `registry.ts` gains one derived selector: `navConfigs = entityConfigs.filter(c =>
  (c.nav ?? "primary") === "primary")`. No manual entity list anywhere.
- `ordem` doubles as topbar order. Reassign in primary defs: `instanciasRotina: 1`,
  `tickets: 2`, `projetos: 3`, `fundos: 4`, `logInferenciaClaude: 5`. Nested defs get `ordem` 10+.
- `navTitulo`: `"Rotinas"` on `instanciasRotina`, `"Log"` on `logInferenciaClaude`.
- Route state (spec §1.3): `type Route = { section: "dashboard" } | { section: "entity"; etype:
  string; tab?: string; selectedId?: string | null }`, `$state` local to Shell, no router/URL
  (spec §10 out-of-scope). Initial route is `{ section: "dashboard" }`.
- `data-testid`: `nav-dashboard` (new) + existing `nav-<etype>` for the 5 primaries unchanged.
  `nav-etapas`/`nav-templatesRotina`/`nav-subtarefas`/`nav-tarefas` are removed; e2e specs that
  used them must switch to a new `gotoNested(page, etype)` helper in `web/e2e/helpers/`.
  Dashboard-only testids (`dash-*`) are out of scope for this phase — later phases own them.
- `EntityScreen.svelte` gets exactly two additive optional props: `scopeWhere` (merged into
  `buildQuery`'s `where`) and `presetLinks` (pre-fills `selectedLinks` in `startCreate()`).
  With both `null`, behavior must be byte-identical to today — the entire pre-existing Playwright
  suite is the regression proof, not new tests. Forbidden: any `if (config.etype === ...)`,
  any "mode" prop, any hardcoded etype filter.
- This phase does NOT build ProjetosSection/RotinasSection/TicketsSection or the Dashboard's real
  content — it only needs a minimal Dashboard mount point so `NAV-03`'s route default is provable
  (a placeholder/empty Dashboard.svelte is acceptable here; Phase 21 replaces its content).
- Fundos and Log sections stay wired exactly as `EntityScreen` today (NEST-06) — zero change to
  their rendering path, only their position/order in the new topbar.

### Claude's Discretion

Everything not pinned above (exact Shell.svelte internal structure for the 6-item nav loop,
whether the placeholder Dashboard is its own file or inline in Shell, naming of internal helper
functions) is at the executor's discretion — guided by spec §0's constraints (shadcn-svelte only,
one spacing scale, no over-engineering) and existing codebase conventions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context (file layout, `EntityConfig` shape, `buildQuery`/`startCreate` internals,
current Shell.svelte nav rendering) will be gathered during plan-phase research — read
`web/src/lib/Shell.svelte`, `web/src/lib/entities/types.ts`, `web/src/lib/entities/registry.ts`,
`web/src/lib/entities/EntityScreen.svelte`, and all `web/src/lib/entities/defs/*.ts` directly.

</code_context>

<specifics>
## Specific Ideas

No additional specifics beyond spec-ui.md §0/§1/§2.1 and REQUIREMENTS.md NAV-01..05, NEST-01,
NEST-06.

</specifics>

<deferred>
## Deferred Ideas

- ProjetosSection, RotinasSection, TicketsSection, SubtarefasPanel — Phases 19-20
- Dashboard real content (week calendar, tickets, kanbans, heatmap) — Phase 21-22
- Dialog system — Phase 23

</deferred>
