---
phase: 07-design-system-setup
fixed_at: 2026-08-09T22:17:04Z
review_path: .planning/phases/07-design-system-setup/07-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-08-09T22:17:04Z
**Source review:** .planning/phases/07-design-system-setup/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (0 Critical, 2 Warning — Info findings excluded per default `critical_warning` scope)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Blanket `DOM` lib addition to `tsconfig.e2e.json` removes a real compile-time safety net for every e2e spec, not just the one that needed it

**Files modified:** `web/tsconfig.e2e.json`
**Commit:** `ecf63ce`
**Applied fix:** Investigated the review's suggested narrower fix first — a per-file
`/// <reference lib="dom" />` in `design-system.spec.ts` instead of the shared tsconfig `lib`
array. Built a throwaway two-file `tsc` repro (`a.ts` with the reference, `b.ts` without) under a
minimal tsconfig with `"lib": ["ES2023"]` and confirmed `tsc --noEmit` exits 0 with no errors on
`b.ts` too — proving a lib reference in any one file is program-wide, not file-scoped, whenever
multiple files compile under the same `tsc -p` invocation (which is exactly how
`tsconfig.e2e.json`'s `"include": ["e2e/**/*.ts", ...]` works). The suggested "narrower" fix
therefore gives zero real narrowing over the existing blanket `lib` entry. Splitting `e2e/` into
multiple TypeScript projects to achieve genuine per-file DOM scoping would require reworking
`bun run check`'s single `tsc -p tsconfig.e2e.json` invocation — judged disproportionate effort
for this finding. Accepted the blanket `"lib": ["ES2023", "DOM"]` as the pragmatic tradeoff this
finding's own fallback text explicitly sanctions, and added an explanatory comment in
`web/tsconfig.e2e.json` (JSONC comments are supported by `tsc`'s config parser and the file is not
in Biome's lint `includes`, so this is safe) documenting why `DOM` is there and that the narrowing
attempt was tried and disproved.

### WR-02: The "fix" for the 3 pre-existing `evaluateAll()` casts trades a caught type error for an unsafe double-cast instead of typing the actual DOM element

**Files modified:** `web/e2e/entities-projeto-etapa-tarefa.spec.ts`, `web/e2e/entities-rotina-log.spec.ts`, `web/e2e/entities-ticket-subtarefa.spec.ts`
**Commit:** `6c8baa8`
**Applied fix:** Replaced `(opts as unknown as { value: string }[])` with
`(opts as HTMLOptionElement[])` at all three `evaluateAll()` call sites, exactly per the review's
suggested fix. Identical runtime behavior (`.map((o) => o.value).filter((v) => v !== "")` is
untouched); the cast now narrows from the real `(SVGElement | HTMLElement)[]` return type to the
concrete `HTMLOptionElement[]` that `<option>` elements always are in a real DOM, instead of
routing through `unknown` and discarding type safety at the call site.

## Verification

Ran after each commit and again after both combined:
- `bun run check` (`svelte-check` + `tsc -p tsconfig.node.json` + `tsc -p tsconfig.e2e.json`) →
  0 errors, 1 pre-existing `EntityScreen.svelte` warning (predates this phase, unrelated).
- `bun run lint` (Biome) → 40 files checked, clean, no fixes applied.
- `bunx playwright test design-system.spec.ts --project=anon` → 4/4 passed live in Chromium.
- `bunx playwright test entities-projeto-etapa-tarefa.spec.ts entities-rotina-log.spec.ts entities-ticket-subtarefa.spec.ts --project=authed --list` →
  all 15 tests across the 3 edited files parse/collect correctly under Playwright's own test
  runner (separate from `tsc`, catches runtime import/transform errors). Full execution of the
  `authed` project requires a real InstantDB magic-code email round trip via Windows Outlook
  Classic COM (`e2e/helpers/magic-code.ts`, PROJECT.md C-10) — unreachable from this Linux/WSL
  sandbox, matching the original review's own environment, which also only ran the `anon` project
  live.

Both gates and all reachable live tests confirm no regression from either fix. `workflow.use_worktrees`
is `false` in `.planning/config.json`, so all edits, verification, and commits ran directly in the
main checkout on `main` (no isolated worktree was created).

## Skipped Issues

None — both in-scope findings were fixed.

---

_Fixed: 2026-08-09T22:17:04Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
