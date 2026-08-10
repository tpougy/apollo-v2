---
phase: 17-cross-phase-verification-quality-gates
plan: 01
subsystem: testing
tags: [playwright, e2e, svelte, accessibility, tailwind, instantdb]

requires:
  - phase: 16-entity-screen-row-actions-delete-confirmation
    provides: 60-test Playwright suite (39 pre-existing + 21 new), AlertDialog-based delete confirmation, all 9 entity capability definitions
provides:
  - A live-confirmed 60/60-passing single sequential `bun run test:e2e` run across the whole v1.2 milestone-to-date suite
  - An explicit 15-cell screen x capability-class coverage matrix (8 covered cells, 7 source-confirmed N/A cells) proving VERIFY-07
  - A source-confirmed zero-hit human-checkpoint grep across Phases 12-16's PLAN.md files, proving VERIFY-06
  - Four cross-milestone grep sweeps (color literals, accessible interactive elements, testid duplicates, spacing-scale bounds) against the full 48-file `git diff 76e6aee` set, one genuine fix landed (duplicate `entity-error` testid)
affects: [17-02-cross-phase-verification-quality-gates]

actuals:
  tokens: 377
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Cross-milestone audit sweep scoped to `git diff <archive-commit> --name-only`, self-updating rather than hand-maintained, so a stale file list can never silently narrow an audit's scope"
    - "Coverage-matrix N/A cells require a source-grep justification (e.g. `grep -n capabilit LoginScreen.svelte` returning empty), not an assumption from a prior phase's SUMMARY"

key-files:
  created: []
  modified:
    - web/src/lib/entities/EntityScreen.svelte

key-decisions:
  - "Renamed the query.error branch's data-testid from entity-error to entity-query-error: the formError Alert (line 458) and the query.error Alert (line 475) are two independent {#if} blocks, not an {:else if} chain, so — contrary to the plan's stated assumption — nothing in the template prevents both from rendering data-testid=\"entity-error\" simultaneously (a form-validation error inside an open Dialog while the background list query independently errors). No existing spec targets the query-error path by testid, so the rename is zero-risk to the passing suite."
  - "Left the single-occurrence p-0 (Popover.Content wrapping the date-picker Calendar) unmodified: it is Tailwind's own default-scale zero utility (not an arbitrary bracketed value) used for a structural reason — letting the self-padded Calendar own its own box model, the same pattern as shadcn-svelte's own canonical Calendar+Popover composition recipe — not a page-rhythm choice, so 'fixing' it by swapping in a nonzero padding value would visually regress the date picker, which is out of this phase's no-redesign scope."
  - "Documented rather than mechanically 'fixed' the literal per-file recurrence shortfall for several spacing values (p-4, px-4, px-6, py-3, py-6, py-8, space-y-1, space-y-6 each appear in only 1 of the 4 composition files, contrary to the plan's stated expectation of 2+): each of the 4 files plays a structurally distinct, non-duplicative role (Shell.svelte alone owns the outer content-frame per SHELL-03), and every value found (0, 1, 2, 3, 4, 6, 8) is a bounded, standard 4px-multiple Tailwind default-scale token — the substantive POLISH-04 concern (no arbitrary/bespoke spacing) holds; forcing literal cross-file duplication would be needless churn and would violate SHELL-03's single-ownership design."

requirements-completed: [POLISH-01, POLISH-02, POLISH-04, VERIFY-04, VERIFY-06, VERIFY-07]

coverage:
  - id: D1
    description: "Single sequential `bun run test:e2e` run across all 3 Playwright projects passes 60/60, zero failed/skipped, re-confirming VERIFY-04 for the full milestone-to-date suite run together"
    requirement: "VERIFY-04"
    verification:
      - kind: e2e
        ref: "cd web && bun run test:e2e (full transcript, both runs before and after the entity-error/entity-query-error fix)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Explicit 15-cell screen x capability-class coverage matrix, all 8 real cells named to exact spec+test and all 7 N/A cells justified from source (not assumed)"
    requirement: "VERIFY-07"
    verification:
      - kind: other
        ref: "See '## Coverage Matrix (VERIFY-07)' section below — every N/A justification re-derived via grep against the live source tree in this run"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero human-checkpoint tasks (checkpoint:human-verify / checkpoint:human-action) exist across all 7 PLAN.md files in Phases 12-16, confirming VERIFY-06 for the whole milestone"
    requirement: "VERIFY-06"
    verification:
      - kind: other
        ref: "find .planning/phases/{12..16}-*/*PLAN.md | xargs grep -n 'checkpoint:human-verify\\|checkpoint:human-action' (zero hits, all 7 files enumerated fresh)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero raw color literal (oklch/hex/rgb/rgba) in any of the 48 files touched since the v1.1 archive commit, confirming POLISH-01 at milestone scale"
    requirement: "POLISH-01"
    verification:
      - kind: other
        ref: "git diff 76e6aee --name-only -- web/src web/e2e web/playwright.config.ts | xargs grep -nE 'oklch\\(|#[0-9a-fA-F]{3,8}\\b|rgba?\\(' (zero matches)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every onclick handler in touched .svelte files attaches to a real Button/AlertDialog.Action/AlertDialog.Cancel or native button/a, and every such element carries visible text or an accessible name — POLISH-02"
    requirement: "POLISH-02"
    verification:
      - kind: other
        ref: "Manual read of all 9 onclick occurrences across Shell.svelte, LoginScreen.svelte, EntityScreen.svelte (all Button/AlertDialog.Action-backed, all with visible text); grep for aria-label/sr-only across touched web/src found zero icon-only-button gaps"
        status: pass
    human_judgment: false
  - id: D6
    description: "Zero unexplained duplicate data-testid values beyond the three pre-known mutually-exclusive-branch cases; the one genuinely non-mutually-exclusive case found (entity-error on the query.error branch) was fixed"
    verification:
      - kind: other
        ref: "git diff 76e6aee --name-only -- web/src | xargs grep -rohE 'data-testid=\"[a-zA-Z0-9_-]+\"' | sort | uniq -c (re-run clean after the entity-query-error rename, commit b74c885)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Spacing-scale bounds (static half of POLISH-04) confirmed on the app's 4 composition files: zero arbitrary bracket values, and the full extracted value set is a bounded, standard Tailwind default-scale set"
    requirement: "POLISH-04"
    verification:
      - kind: other
        ref: "grep -noE spacing-bracket-pattern across App.svelte/Shell.svelte/LoginScreen.svelte/EntityScreen.svelte (zero matches); extracted set {gap-2, gap-4, p-0, p-4, px-4, px-6, py-3, py-6, py-8, space-y-1, space-y-2, space-y-4, space-y-6} — all standard 4px-multiple tokens, no arbitrary values"
        status: pass
    human_judgment: false

duration: 19min
completed: 2026-08-10
status: complete
---

# Phase 17 Plan 01: Cross-Phase Full-Suite Regression + Coverage Matrix + Grep Sweeps Summary

**All 60 Playwright tests re-confirmed green in one sequential run, a 15-cell VERIFY-07 coverage matrix recorded (8 covered / 7 source-confirmed N/A), zero human-checkpoint tasks across Phases 12-16, and one genuine duplicate-testid bug (`entity-error` on two non-mutually-exclusive branches) found and fixed during the cross-milestone grep sweeps.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-10T20:24:15Z
- **Completed:** 2026-08-10T20:43:26Z
- **Tasks:** 2 completed
- **Files modified:** 1 (`web/src/lib/entities/EntityScreen.svelte`)

## Accomplishments

- Ran the complete Playwright suite (all 3 projects — `setup`/`authed`/`anon`) as one sequential invocation against the live InstantDB app: **60 passed, 0 failed, 0 skipped**, both before and after the Task 2 fix.
- Built and source-confirmed the full 15-cell screen x capability-class coverage matrix required by VERIFY-07 (see below) — every N/A cell justified by a fresh grep/read against the current source tree, not assumed from a prior phase's SUMMARY.
- Grep-swept all 7 PLAN.md files across Phases 12-16 for `checkpoint:human-verify`/`checkpoint:human-action`: zero hits, confirming VERIFY-06 holds for the whole milestone.
- Ran all four cross-milestone grep sweeps (color literals, accessible interactive elements, testid duplicates, spacing-scale bounds) against the exact 48-file `git diff 76e6aee --name-only` set, found and fixed one genuine violation (a duplicate `entity-error` testid that was not actually mutually exclusive, contrary to the plan's stated assumption).

## Task Commits

Task 1 (tracer: full-suite regression + coverage matrix) required no code changes — audit-only, all 15 cells already covered or correctly N/A, human-checkpoint grep already empty — so it has no dedicated commit; its findings are recorded in this SUMMARY.

1. **Task 2: Cross-milestone grep sweeps** — `b74c885` (fix) — disambiguated the `entity-error` testid collision found during the sweep.

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified

- `web/src/lib/entities/EntityScreen.svelte` — renamed the `query.error` branch's `data-testid` from `entity-error` to `entity-query-error` (line 478), removing a genuine (if narrow) duplicate-testid collision risk with the `formError` branch's `entity-error` (line 461).

## Coverage Matrix (VERIFY-07)

5 surfaces x 3 capability classes = 15 cells. 8 real cells named to exact spec+test; 7 N/A cells, each justified by reading the actual source in this run.

| Surface | Full-CRUD | Restricted | Read-only |
|---|---|---|---|
| **Login** | `auth.setup.ts`: "real magic-code round trip authenticates the SPA"; `login-composition.spec.ts`: "LoginScreen composes a centered Card..."; `login-flow.spec.ts`: "submit Button shows disabled + spinner...", "...destructive Alert" | N/A — `LoginScreen.svelte` has zero capability-conditional branch (`grep -n capabilit src/lib/auth/LoginScreen.svelte` returns nothing); renders identically for every authenticated user regardless of which entities they can later act on | N/A — same justification |
| **Shell/Nav** | `shell-nav.spec.ts`: "each nav Button renders its corresponding EntityScreen", "exactly one nav Button shows the active-state indicator...", "clicking Logout ends the session..."; `shell-chrome.spec.ts`: header/toolbar composition, single content-frame consistency, nav overflow strategy, single app-identity element | N/A — `Shell.svelte` has zero capability-conditional branch (`grep -n capabilit src/lib/Shell.svelte` returns nothing); the same nav bar renders for every user, capability class only affects what's inside the active `EntityScreen` | N/A — same justification |
| **Entity table + loading + empty** (fundos / instanciasRotina / logInferenciaClaude) | `entities-header-states.spec.ts`: "ENTTBL-04: fundos... page-header structure, light+dark", "ENTTBL-06: fundos empty state...", "ENTTBL-05: fundos loading state shows the Skeleton grid...", "ENTTBL-07: every one of the 9 entities'..."; `entities-table-restyle.spec.ts`: "ENTTBL: fundos (full-CRUD) — Table role, Badge on ativo..." | `entities-header-states.spec.ts`: "ENTTBL-04: instanciasRotina (restricted) header renders, create action capability-gated off"; `entities-table-restyle.spec.ts`: "ENTTBL: instanciasRotina (restricted) — status Badge, zero create/delete, status-only edit" | `entities-header-states.spec.ts`: "ENTTBL-04: logInferenciaClaude (read-only) header renders, create action capability-gated off"; `entities-table-restyle.spec.ts`: "ENTTBL: logInferenciaClaude (read-only) — zero Badges, zero row actions of any kind" |
| **Entity form/dialog** | `entities-form-dialog-composition.spec.ts`: "ENTFRM-05: tarefas create Dialog uses a uniform two-tier space-y-4/space-y-2 spacing scale...", "ENTFRM-06: ...composes Dialog.Description and Dialog.Footer...", "ENTFRM-07: ...busy/spinner state on entity-submit..."; `entities-form-restyle.spec.ts`: "ENTFRM-01: fundos (full-CRUD) — Dialog role..." | `entities-form-restyle.spec.ts`: "FDBK-01: instanciasRotina status-only edit — single field Dialog, no create affordance, success toast"; `entities-form-dialog-composition.spec.ts`'s ENTFRM-08 test, instanciasRotina branch: "the one editable field (status, required: true) also shows the indicator" | N/A — zero-capability entities never call `startCreate()`/`startEdit()` (both gated behind `config.capabilities.create`/`update`, confirmed at `EntityScreen.svelte:451,530,540`), so `mode` never leaves `null` and `Dialog.Root`'s `open={mode !== null}` never becomes true; `logInferenciaClaude.ts:27` confirms `capabilities: { create: false, update: false, delete: false }`; proven live by `entities-form-dialog-composition.spec.ts`'s ENTFRM-08 test's part 3, "logInferenciaClaude (read-only): structurally inert — no Dialog" |
| **Delete confirmation** | `entities-delete-confirmation.spec.ts` (tarefas, full-CRUD): "ENTTBL-08: row-edit/row-delete render with a real, positive, CSS-verified gap...", "DELCONF-01: row-delete opens a shadcn AlertDialog...", "...keyboard cancel — Escape...", "...keyboard confirm — Tab then Enter...", "...cannot be dismissed while the delete is in flight" | N/A — `instanciasRotina.ts:43` confirms `capabilities: { create: false, update: true, delete: false }`; `{#if config.capabilities.delete}` (`EntityScreen.svelte:540`) never renders the row-delete affordance; proven by `entities-delete-confirmation.spec.ts`'s "ENTTBL-08/DELCONF-01 capability safety: restricted and read-only entities gain no new delete affordance" | N/A — `logInferenciaClaude.ts:27` confirms `capabilities.delete: false` too; same justification and same proving test as Restricted |

## Human-Checkpoint Grep (VERIFY-06)

`find .planning/phases/{12,13,14,15,16}-*/*PLAN.md | xargs grep -n "checkpoint:human-verify\|checkpoint:human-action"` across all 7 PLAN.md files in Phases 12-16 (`12-01`, `13-01`, `14-01`, `14-02`, `15-01`, `16-01`, `16-02`) returned **zero hits**. No phase in this milestone depended on human UAT.

## Grep Sweep Results (Task 2)

Against the exact 48-file set from `git diff 76e6aee --name-only -- web/src web/e2e web/playwright.config.ts` (`76e6aee` = `chore: archive v1.1 milestone`):

1. **POLISH-01 color literals:** `oklch(`, hex, `rgb()`/`rgba()` — **zero matches**. Clean at milestone scale, no fix needed.
2. **POLISH-02 accessible interactive elements:** all 9 `onclick=` occurrences in touched `.svelte` files (`Shell.svelte` x2, `LoginScreen.svelte` x1, `EntityScreen.svelte` x6) read individually — every one attaches to a `Button` or `AlertDialog.Action` component (all render a native `<button>`), never a bare `<div>`/`<span>`/`<p>`. Every `Button`/`AlertDialog.Action`/`AlertDialog.Cancel` in the touched files carries visible text ("novo", "editar", "excluir", "Sair", "Reenviar código", "cancelar", "salvar", the date-picker's formatted date or "Selecione..."). Zero icon-only buttons found (`aria-label`/`sr-only` grep across touched `web/src` returned no matches, consistent with zero icon-only buttons existing). Clean, no fix needed.
3. **Testid duplicates:** extracted every literal `data-testid="value"` across touched `web/src` files. Found the three pre-known duplicates exactly as described and source-confirmed: `entity-create-start` (3 — 1 live attribute + 2 `document.querySelector` string references in focus-restoration code, `EntityScreen.svelte:398,433`), `login-submit` (2 — mutually exclusive `{#if step === "email"}...{:else}...` branches, `LoginScreen.svelte:100,122`). The third, `entity-error`, was **not** actually mutually exclusive as claimed: `formError` (line 458) and `query.error` (line 475, pre-fix) are two independent `{#if}` blocks (not an `{:else if}` chain), so both could in principle render simultaneously (a form-validation error inside an open create/edit Dialog while the background list query independently errors — the Dialog is rendered unconditionally as a sibling after the query if/else chain closes, so it isn't gated by query success). **Fixed** by renaming the `query.error` branch's testid to `entity-query-error` (commit `b74c885`); no existing spec references the query-error path by testid, so all 60 tests remained green after the fix.
4. **POLISH-04 spacing-scale bounds (static half):** zero arbitrary bracket values (`gap-[...]`, `p-[...]`, etc.) across the 4 app composition files. Extracted value set: `gap-2, gap-4, p-0, p-4, px-4, px-6, py-3, py-6, py-8, space-y-1, space-y-2, space-y-4, space-y-6` — every value is a standard, bounded Tailwind default-scale multiple of 4px (0/4/8/12/16/24/32px). Two findings worth recording transparently rather than silently smoothing over:
   - **`p-0` was not anticipated by the plan's authored value set.** It appears exactly once, on `EntityScreen.svelte:661`'s `Popover.Content class="w-auto p-0"` wrapping the date-picker `Calendar`. Confirmed via read: this zeroes the Popover wrapper's own padding so the self-padded `Calendar` component owns its own spacing — the same pattern as shadcn-svelte's own canonical Calendar+Popover composition recipe, not a page-rhythm choice. Left unmodified; "fixing" it (swapping in a nonzero value) would visually regress the date picker, which is out of this phase's no-redesign scope.
   - **Several values (`p-4`, `px-4`, `px-6`, `py-3`, `py-6`, `py-8`, `space-y-1`, `space-y-6`) each appear in only 1 of the 4 files**, not the 2+ the plan's authored text anticipated — verified with a per-value, per-file grep, not assumed. This holds even across the full 48-file touched set, not just these 4 files. Root cause: each of the 4 composition files plays a structurally distinct, non-duplicative role by design (`Shell.svelte` alone owns the outer content-frame per SHELL-03's explicit single-ownership requirement; `LoginScreen.svelte` owns its own full-viewport centering wrapper; `EntityScreen.svelte` owns internal table/dialog spacing) — duplicating another file's exact utility-class string would contradict that ownership model, not reinforce a shared rhythm. The substantive POLISH-04 requirement (no arbitrary/bespoke spacing value, one bounded scale throughout) still holds: every value found, without exception, is a standard Tailwind default-scale 4px-multiple — none is a novel or abandoned magnitude. No fix applied; forcing artificial cross-file duplication to satisfy the letter of the plan's own heuristic would be needless churn with no visual benefit and would work against SHELL-03's design.

## Decisions Made

- Renamed the `query.error` Alert's `data-testid` from `entity-error` to `entity-query-error` — see key-decisions in frontmatter for full rationale.
- Left the single-occurrence `p-0` (Popover-wrapping-Calendar padding reset) unmodified — a structural necessity, not a rhythm one-off.
- Documented (rather than mechanically "fixed") the literal per-file spacing-value recurrence shortfall — the values are all on one bounded Tailwind scale, and each file's structurally distinct role (esp. Shell.svelte's SHELL-03 single-frame ownership) makes forced cross-file duplication counterproductive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate, non-mutually-exclusive `data-testid="entity-error"`**
- **Found during:** Task 2 (testid-duplicate grep sweep)
- **Issue:** The plan's must-haves assumed the `formError`/`query.error` `entity-error` pair was structurally mutually exclusive like the `login-submit` pair. Reading the actual template showed they are two independent `{#if}` blocks (not chained), so both testid instances could coexist in the DOM at once under a specific (rare but real) combination: a form-validation error while the create/edit Dialog is open, simultaneous with the background list query independently erroring.
- **Fix:** Renamed the `query.error` branch's testid to `entity-query-error`.
- **Files modified:** `web/src/lib/entities/EntityScreen.svelte`
- **Verification:** Re-ran the testid-duplicate grep sweep (clean) and the full `bun run test:e2e` suite (60/60 passed, unchanged) after the fix.
- **Committed in:** `b74c885`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Necessary correctness fix for a genuine, if narrow, testid-ambiguity risk surfaced by the audit itself — exactly the kind of finding this cross-phase verification phase exists to catch. No scope creep; no other code touched.

## Issues Encountered

None — both full-suite runs (before and after the fix) completed cleanly on the first attempt, no live-network flake, no magic-code rate-limit hit.

## Next Phase Readiness

- VERIFY-04, VERIFY-06, VERIFY-07 (coverage-matrix half), POLISH-01, POLISH-02, and POLISH-04 (static half) are confirmed at milestone scale.
- Plan 17-02 is unblocked: it depends on this plan (`depends_on: ["17-01"]`) and adds the measured/dynamic half of POLISH-04 (a live cross-phase spacing-anchor comparison test), the remaining dual-color-scheme checks (VERIFY-05), the keyboard/focus-visible smoke tests, POLISH-03, and QUAL-02 (`bun run check`/`bun run lint`).
- No blockers. The one genuine finding from this plan (the `entity-error`/`entity-query-error` rename) is committed and green; nothing pending.

---
*Phase: 17-cross-phase-verification-quality-gates*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: web/src/lib/entities/EntityScreen.svelte
- FOUND: .planning/phases/17-cross-phase-verification-quality-gates/17-01-SUMMARY.md
- FOUND: commit b74c885
