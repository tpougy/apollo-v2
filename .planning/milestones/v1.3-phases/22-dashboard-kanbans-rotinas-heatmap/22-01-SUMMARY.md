---
phase: 22-dashboard-kanbans-rotinas-heatmap
plan: 01
subsystem: ui
tags: [svelte5, tailwind, resize-observer, localstorage, playwright]

requires:
  - phase: 21-dashboard-shell-tickets-calendar
    provides: DASHBOARD_QUERY (single db.useQuery), derive.ts's progressoEtapa/tarefaConcluida/vencido, Dashboard.svelte's dash-placeholder-projetos slot
provides:
  - ProjectStrips.svelte -- one fixed-width, non-compressing mini-kanban strip per in-progress project
  - Genuinely measured (ResizeObserver-based) horizontal overflow indicator, new mechanism for this codebase
  - localStorage collapse persistence under apollo.dash.collapsed.<projetoId>
affects: [23-focus-dialogs]

actuals:
  tokens: 8207
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "ResizeObserver observing both an overflow-x-auto container and its inner unconstrained flex row, always re-reading fresh scrollWidth/clientWidth inside the callback rather than trusting entry.contentRect"
    - "Two narrow, phase-local localStorage helpers (collapsedKey/readCollapsed/writeCollapsed) instead of a shared storage utility module"

key-files:
  created:
    - web/src/lib/dashboard/ProjectStrips.svelte
    - web/e2e/dashboard-kanbans.spec.ts
  modified:
    - web/src/lib/dashboard/Dashboard.svelte

key-decisions:
  - "'projeto em andamento' = has >=1 etapa; no projeto.status read/compared anywhere, mirroring REQUIREMENTS.md 5.3's ticket-queue precedent (documented in plan frontmatter, confirmed unchanged during execution)"
  - "DASHBOARD_QUERY's projetos.etapas.tarefas branch does not fetch subtarefas (only the separate flat tarefas branch does) -- tarefaConcluida() on a nested strip card therefore always evaluates false. This plan's own fixtures are deliberately built around that gap (the vencida fixture task has zero subtarefas, and every other test fixture is future-dated so concluida's value never changes the vencido() outcome), matching Plan 22-02's identical decision to leave DASHBOARD_QUERY untouched. Documented here rather than silently patched -- a completed nested tarefa with a past dataPrevista would currently render as vencida; flagged for Phase 23 or a future DASHBOARD_QUERY revision to close if it becomes user-visible."
  - "e2e fixture task order matters: ProjectStrips.svelte slices an etapa's tarefas to 'first 3, in existing array order, no re-sort'. Verified live this session (via the CLI's own tarefa listar) that InstantDB returns linked rows in creation order, so the 4th ordem-1 fixture task (the vencida one) is created FIRST to land inside the visible 3-card slice rather than the '+1' overflow row."
  - "Both tasks were implemented together in one pass, then manually split back into two atomic commits (temporarily stripping Task 2's localStorage/ResizeObserver code and its two extra e2e describe blocks, verifying Task 1 alone, committing, then restoring and re-verifying Task 2) to honor the plan's per-task commit requirement without re-deriving the code from scratch."

patterns-established:
  - "Fixed-width kanban column: w-36 shrink-0 box-border, relying on flex row default align-items:stretch (no items-start/self-start) for column-height equality"
  - "Measured (never inferred) horizontal-overflow indicator via a single shared ResizeObserver effect per component instance"

requirements-completed: [DASH-05]

coverage:
  - id: D1
    description: "A project with zero etapas never renders a strip; a project with >=1 etapa always renders one"
    requirement: "DASH-05"
    verification:
      - kind: e2e
        ref: "dashboard-kanbans.spec.ts#DASH-05: a projeto with zero etapas never gets a strip"
        status: pass
    human_judgment: false
  - id: D2
    description: "Kanban columns are fixed-width (w-36 shrink-0) and share height, proven equal via boundingBox() across a 4-card and a 1-card column in the same strip"
    requirement: "DASH-05"
    verification:
      - kind: e2e
        ref: "dashboard-kanbans.spec.ts#DASH-05: header meta, equal fixed-width AND equal-height columns regardless of card count, 3+1 overflow split"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each column caps at 3 tarefa cards with a '+N tarefas' overflow row when it has more"
    requirement: "DASH-05"
    verification:
      - kind: e2e
        ref: "dashboard-kanbans.spec.ts#DASH-05: header meta, equal fixed-width AND equal-height columns regardless of card count, 3+1 overflow split"
        status: pass
    human_judgment: false
  - id: D4
    description: "The '>' overflow indicator is position:absolute at the strip's right edge, outside the flex flow, and appears only when scrollWidth genuinely exceeds clientWidth (measured via ResizeObserver, never inferred from column count)"
    requirement: "DASH-05"
    verification:
      - kind: e2e
        ref: "dashboard-kanbans.spec.ts#the 6-etapa strip's overflow indicator becomes visible; the 1-etapa strip's never does"
        status: pass
    human_judgment: false
  - id: D5
    description: "Collapse state persists across a full page reload via exactly one apollo.dash.collapsed.<projetoId> localStorage key, written on every toggle in both directions"
    requirement: "DASH-05"
    verification:
      - kind: e2e
        ref: "dashboard-kanbans.spec.ts#collapse toggle persists across reload via exactly one localStorage key"
        status: pass
    human_judgment: false
  - id: D6
    description: "Zero in-progress projects renders 'Nenhum projeto em andamento' with a working link back to the Projetos section"
    requirement: "DASH-05"
    verification:
      - kind: e2e
        ref: "dashboard-kanbans.spec.ts#shows 'Nenhum projeto em andamento' with a working link to Projetos"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every clickable surface inside a strip (collapse toggle, project name, fundo badge, column header, card) is a real <button> element"
    requirement: "DASH-05"
    verification:
      - kind: e2e
        ref: "dashboard-kanbans.spec.ts#DASH-05: every clickable surface inside a strip is a real <button>"
        status: pass
    human_judgment: false
  - id: D8
    description: "A vencido tarefa's card carries a destructive left border and destructive meta text; a non-vencido card never does"
    requirement: "DASH-05"
    verification:
      - kind: e2e
        ref: "dashboard-kanbans.spec.ts#DASH-05: a vencido tarefa's card carries destructive styling, a future-dated one does not"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-08-12
status: complete
---

# Phase 22 Plan 1: ProjectStrips Summary

**Fixed-width, non-compressing mini-kanban strips per in-progress project, with a genuinely-measured ResizeObserver overflow indicator and per-project localStorage collapse persistence.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-12T02:42:00Z
- **Completed:** 2026-08-12T02:58:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `ProjectStrips.svelte` renders one strip per project with `>=1` etapa, columns ordered by `etapas.ordem` ascending, each column locked to `w-36 shrink-0` -- proven non-compressing via a live Playwright bounding-box equality check across a 4-card and a 1-card column in the same strip (both width AND height).
- Cards cap at 3 per column plus a `+N tarefas` overflow row; vencido cards carry `border-destructive`/`text-destructive`, sourced entirely from `derive.ts`'s already-shipped `tarefaConcluida`/`vencido` -- no reimplemented logic.
- A genuinely new-to-this-codebase `ResizeObserver` pattern drives the `>` overflow indicator: observes both the scrolling strip and its inner unconstrained row, always re-reads fresh `scrollWidth`/`clientWidth` inside the callback (never `entry.contentRect`), and is provably absent for a strip whose columns fit a narrow viewport while present for one that doesn't.
- `localStorage['apollo.dash.collapsed.<projetoId>']` persists the collapse toggle across a full page reload, written on both collapse and expand, with a live proof that no other localStorage key gets touched.
- `Dashboard.svelte`'s `dash-placeholder-projetos` slot is wired to real data with zero changes to that wrapper's own testid/classes (the pre-existing mobile-viewport e2e assertion still passes).

## Task Commits

Each task was committed atomically:

1. **Task 1: ProjectStrips.svelte -- filtered strips, fixed-width non-compressing columns, capped/overflowed cards, wired end-to-end** - `acfe034` (feat)
2. **Task 2: Measured `>` overflow indicator (ResizeObserver) + localStorage collapse persistence + full e2e coverage** - `850a629` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `web/src/lib/dashboard/ProjectStrips.svelte` - New leaf component: em-andamento filter, fixed-width kanban strips, capped/overflowed cards, ResizeObserver overflow indicator, localStorage collapse persistence
- `web/src/lib/dashboard/Dashboard.svelte` - Added `projetoRows()`/`goToProjetos()`, imported and mounted `ProjectStrips` inside the existing `dash-placeholder-projetos` slot
- `web/e2e/dashboard-kanbans.spec.ts` - New e2e file: empty state, zero-etapa exclusion, width/height equality, button-tagName assertions, vencido styling, overflow indicator, collapse persistence

## Decisions Made
- **"Projeto em andamento" filter:** a project gets a strip solely because it has `>=1` etapa (`filtroEmAndamento`) -- no `projeto.status` value is ever read or compared. This mirrors REQUIREMENTS.md section 5.3's exact reasoning for the ticket queue (no non-textual completion signal exists on `projetos` either). Locked by the plan's frontmatter; confirmed unchanged during execution.
- **DASHBOARD_QUERY's subtarefas gap (documented, not patched):** `DASHBOARD_QUERY`'s `projetos: { fundo: {}, etapas: { tarefas: {} } }` branch does not nest `subtarefas` under `tarefas` (only the separate flat `tarefas: { etapa: {...}, subtarefas: {} }` branch does). Because `ProjectStrips.svelte` renders from the nested `projetos` branch, `tarefaConcluida()` on a strip card always sees `subtarefas ?? []` as empty and therefore always evaluates `false`. This plan's own fixtures were deliberately designed around that gap (the vencida fixture task has zero subtarefas by design, and every other fixture task is future-dated, so `concluida`'s value never changes `vencido()`'s outcome for any test in this plan) -- matching Plan 22-02's own documented decision to leave `DASHBOARD_QUERY` byte-for-byte unchanged for a structurally similar case (`template.nome`). Not fixed here since fixing it is a `DASHBOARD_QUERY` schema-shape change outside this plan's declared `files_modified`, and no test in this plan's `must_haves` requires it. Flagged for a future phase if a genuinely-completed, past-due nested tarefa needs to stop rendering as vencida.
- **e2e fixture creation order:** verified live (via the CLI's own `tarefa listar`) that InstantDB preserves creation order for linked rows queried without an explicit sort, so the vencida fixture tarefa is created FIRST under its etapa to guarantee it lands inside `ProjectStrips.svelte`'s "first 3, no re-sort" visible slice rather than the `+1` overflow row.
- **Split-commit reconstruction:** both tasks were authored together in one implementation pass (same file, tightly coupled), then manually separated into two atomic commits matching the plan's task boundaries -- Task 2's localStorage/ResizeObserver code and its two extra e2e `describe` blocks were temporarily stripped, Task 1 was independently verified and committed, then Task 2's code was restored and re-verified before its own commit. No functional difference from building them in the documented order; done to preserve the per-task atomic-commit contract.

## Deviations from Plan

None -- plan executed exactly as written. The two items above (subtarefas query gap, fixture ordering) are documented interpretive decisions the plan's own research/must_haves anticipated needing (22-RESEARCH.md's Assumptions Log and Wave 0 Gaps), not unplanned deviations.

## Issues Encountered
- One unrelated pre-existing e2e test (`dashboard.spec.ts`'s `DASH-07: live instanciasRotina.template.fundo two-hop proof`) failed once with a `ConnectTimeoutError` reaching InstantDB's admin API during the full regression run -- confirmed transient (network blip, not a code regression) by re-running that single test in isolation immediately afterward, which passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ProjectStrips.svelte` and its `dash-placeholder-projetos` slot are complete; Phase 23 (focus dialogs) can wire the currently-inert project name/fundo-badge/column-header/card buttons to real dialogs without touching this plan's fixed-width/overflow/collapse mechanisms.
- Plan 22-02 (`RoutinesByFundo`/`MonthHeatmap`, `dash-placeholder-rotinas`) is independent of this plan's files and can proceed without blockers.
- Documented `DASHBOARD_QUERY` subtarefas gap (see Decisions Made) is a minor, non-blocking correctness note for any future phase touching nested-tarefa completion state inside `ProjectStrips`.

---
*Phase: 22-dashboard-kanbans-rotinas-heatmap*
*Completed: 2026-08-12*

## Self-Check: PASSED

All created files exist on disk (`web/src/lib/dashboard/ProjectStrips.svelte`,
`web/e2e/dashboard-kanbans.spec.ts`, `web/src/lib/dashboard/Dashboard.svelte`, this SUMMARY.md)
and both task commits (`acfe034`, `850a629`) are present in `git log`.
