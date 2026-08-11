---
phase: 19-projetos-section-master-detail
verified: 2026-08-11T21:15:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: null
---

# Phase 19: Projetos Section (Master-Detail) Verification Report

**Phase Goal:** Users can browse every project grouped by fundo, drill into a selected project's
etapas and tasks without leaving the Projetos section, and still reach tasks that have no etapa.
**Verified:** 2026-08-11T21:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

(Directly the 4 ROADMAP.md Success Criteria for Phase 19, cross-referenced against NEST-02/NEST-03.)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The Projetos section's left column lists all projects grouped by fundo, with a name search and a group-by display control, and "Sem fundo vinculado" is always sorted last | ✓ VERIFIED | `web/src/lib/sections/ProjetosSection.svelte:119-143` (`groupProjetos`) forces `"Sem fundo vinculado"` last only in `"fundo"` mode (lines 136-139); `project-search` input filters client-side (`$derived filtered`, lines 147-149). Live e2e (this session): `NEST-02: master column groups projetos by fundo, 'Sem fundo vinculado' last` and `NEST-02: name search filters client-side...` both ✓ passed. |
| 2 | Selecting a project shows its etapas as collapsible rows ordered by `etapas.ordem` ascending, one etapa open at a time (accordion single), each showing that etapa's own tasks inline | ✓ VERIFIED | `ProjetosSection.svelte:375-377` sorts `etapasOrdenadas` by row-level `a.ordem - b.ordem` (never the constant `etapasConfig.ordem`); `Accordion.Root type="single"` (line 438) with `{#if openEtapaId === etapa.id}` guarding inline tarefas (lines 471-520). `projetosDerive.ts` implements `progressoEtapa`/`tarefaConcluida`/`vencido` matching REQUIREMENTS.md §5.3/§5.4 verbatim (subtarefa-based completion, never `tarefas.status` string comparison). Live e2e: `etapas render ordered by row-level ordem asc...`, `accordion is single-open...`, `inline tarefas show a disabled completion checkbox...`, `prazo is styled text-destructive...`, `subtarefa chip shows the exact concluida/total count...` — all ✓ passed. Unit tests: `bun test src` 151/151 pass (covers `projetosDerive.test.ts`). |
| 3 | An "etapas ▾" toggle switches the same etapa data between a list layout and a kanban layout | ✓ VERIFIED | `ProjetosSection.svelte:99-102` (`etapasView` state), lines 437-577 (list vs. kanban render branches over the identical `etapasOrdenadas` value — zero second `db.useQuery`). Kanban columns `w-48 shrink-0` (fixed-width, non-compressing) in an `overflow-x-auto` strip. Live e2e: `'etapas ▾' toggles list/kanban over the identical query data, kanban columns fixed-width and never compress` ✓ passed, including a `boundingBox().width` equality assertion between a 4-card and a 1-card column. |
| 4 | A "Todas as tarefas" tab (no `scopeWhere`) lists every task across all projects, with a "Sem etapa" convenience filter that makes orphaned tasks reachable and editable | ✓ VERIFIED | `ProjetosSection.svelte:588-620`: `Tabs.Content value="todas"` mounts unscoped `EntityScreen(tarefasConfig)` with `scopeWhere={semEtapa ? {"etapa.id": {$isNull: true}} : null}` — the primary InstantDB `$isNull` path, live-verified (not the documented fallback). Live e2e: `'Todas as tarefas' tab is reachable with no projeto selected...` and `'Sem etapa' narrows 'Todas as tarefas' to orphaned tarefas, with orphans staying fully editable either way` — both ✓ passed. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/lib/sections/ProjetosSection.svelte` | Master-detail screen: grouping/search, etapas accordion/kanban, "Todas as tarefas"/"Sem etapa" | ✓ VERIFIED | 649 lines, read in full. No stub markers, no `if (config.etype ===`/`if (cfg.etype ===` pattern, one bespoke `db.useQuery` feeding every view. |
| `web/src/lib/sections/projetosDerive.ts` | Pure `tarefaConcluida`/`progressoEtapa`/`vencido` per REQUIREMENTS.md §5.3/§5.4 | ✓ VERIFIED | No `db` import, `hoje` always a parameter (`vencido(dataPrevista, concluido, hoje: Date)`). Matches spec's locked rule exactly (subtarefa-based completion). |
| `web/src/lib/sections/projetosDerive.test.ts` | Unit coverage for the above | ✓ VERIFIED | Part of `bun test src`'s 151 passing tests. |
| `web/e2e/projetos-section.spec.ts` | e2e coverage for NEST-02/NEST-03 | ✓ VERIFIED | 904 lines, 15 real tests (verified by reading the file, not just counting SUMMARY claims), all substantive (live CLI fixtures, real assertions on data-eid/ordering/styling/width). |
| `web/src/lib/Shell.svelte` mount point | Mounts `ProjetosSection` for `nav-projetos` | ✓ VERIFIED | Line 174: `{:else if rota.etype === "projetos"} ... <ProjetosSection />`. Documented as the one permitted router-level branch (not a generic-engine `config.etype` branch); matches the pre-existing, Phase-18-verified precedent (`rota.section === "dashboard"` → `<Dashboard />`). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ProjetosSection.svelte` | InstantDB | `db.useQuery({projetos:{fundo:{},etapas:{tarefas:{subtarefas:{}}}}})` | ✓ WIRED | One real query feeds master column, detail header counts, accordion, kanban, and progress bars — no static/mock data anywhere. |
| `ProjetosSection.svelte`'s "+ novo projeto"/"editar projeto"/"+ etapa"/"+ tarefa nesta etapa" | `EntityScreen`'s real create/edit dialog | Hidden-host + bounded-poll selector click (`projetoHostEl`/`etapaHostEl`/`tarefaHostEl`) | ✓ WIRED | Confirmed via passing e2e tests exercising each affordance end-to-end against the live hosted backend (create appears with no reload; edit updates in place). |
| `ProjetosSection.svelte`'s "Todas as tarefas" tab | `EntityScreen(tarefasConfig)` | `scopeWhere` prop, `$isNull` operator | ✓ WIRED | Live-verified against hosted InstantDB; toggling "Sem etapa" narrows to the orphan row and back, both editable. |
| `Shell.svelte` | `ProjetosSection.svelte` | `{:else if rota.etype === "projetos"}` | ✓ WIRED | Confirmed by reading `Shell.svelte:174-182`; e2e `ENTTBL-07: Projetos renders its own master-detail markup, not the generic entity-table-frame` passes. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| Master column rows | `filtered`/`groups` | `rowsOf()` ← `query.data.projetos` ← live `db.useQuery` | Yes | ✓ FLOWING |
| Etapas accordion/kanban | `etapasOrdenadas`, `progressoEtapa(etapa)` | Same query, `.etapas`/`.tarefas`/`.subtarefas` nested links | Yes | ✓ FLOWING |
| "Todas as tarefas" panel | `EntityScreen(tarefasConfig)`'s own query | `EntityScreen`'s own `db.useQuery` (generic engine, unmodified) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks / Full Suite Execution

All commands below were run live in this session (not assumed from SUMMARY.md):

| Command | Result | Status |
|---------|--------|--------|
| `cd web && bun test src` | 151 pass, 0 fail | ✓ PASS |
| `cd web && bun run check` | 0 errors, 1 pre-existing unrelated warning (`EntityScreen.svelte` `configProp`, predates Phase 19) | ✓ PASS |
| `cd web && bun run lint` | 0 errors, 1 pre-existing unrelated info (`calendar-caption.svelte` radix param, predates Phase 19) | ✓ PASS |
| `cd web && bun run test:e2e` (full 3-project suite, 87 tests) | 86 passed, 1 failed on first run | ⚠️ then confirmed below |
| `bunx playwright test projetos-section.spec.ts -g "selecting a project-item highlights it" --project=authed --no-deps` (isolated re-run of the one failure) | 1 passed (1.6s) | ✓ PASS — confirms flake, not regression |

**Full-suite detail:** The single failure (`projetos-section.spec.ts:210` — "selecting a project-item highlights it...") was immediately preceded in the run log by `{"detail": "_ssl.c:993: The handshake operation timed out", "error": "network"}` — a live network/SSL handshake timeout against the hosted InstantDB backend, the exact same flake signature already documented in 19-03-SUMMARY.md/19-04-SUMMARY.md across their own 4 full-suite runs (2 different unrelated failures per run, none repeating, all confirmed to pass in isolation). Re-running that one named test in isolation passed cleanly, confirming this is environmental flakiness against the live backend, not a code regression introduced by this phase. All 15 `projetos-section.spec.ts` tests, and every other file this phase touches (`shell-nav.spec.ts`, `entities-header-states.spec.ts`, `cross-phase-verification.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`), passed in this run.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| NEST-02 | 19-01, 19-02, 19-04 | Projetos master-detail: grouped-by-fundo master column, ordem-sorted single-open etapas accordion with inline tasks | ✓ SATISFIED | Code + live e2e, see truths 1-2 above. `.planning/REQUIREMENTS.md:47` marked `[x]`, traceability table marks it "Complete". |
| NEST-03 | 19-03 | "etapas ▾" list/kanban toggle + "Todas as tarefas"/"Sem etapa" | ✓ SATISFIED | Code + live e2e, see truths 3-4 above. `.planning/REQUIREMENTS.md:48` marked `[x]`. |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s traceability table maps only NEST-02/NEST-03 to Phase 19, and both are claimed and covered by the plans above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any file this phase modified (`ProjetosSection.svelte`, `projetosDerive.ts`, `Shell.svelte`, `projetos-section.spec.ts`) | — | None |
| — | — | `grep -c 'if (config.etype\|if (cfg.etype' web/src/lib/entities/EntityScreen.svelte web/src/lib/entities/registry.ts` → `0` for both files (re-confirmed live this session) | — | None |
| `web/src/lib/Shell.svelte` | 174 | `{:else if rota.etype === "projetos"}` — literally matches the string shape "if (etype === ...)" | ℹ️ Info | This is a **router-level** branch on the app's own route-state object (`rota.etype`), not the forbidden **generic-engine** branch on `config.etype`/`cfg.etype` inside `EntityScreen.svelte`/`registry.ts` (both confirmed untouched by Phase 19, last modified by Phase 18's commit `239aaea`). It extends the exact `rota.section === "dashboard"` → `<Dashboard/>` pattern Phase 18 already established and that was verified `passed` in `18-VERIFICATION.md`. spec-ui.md §0.6's prohibition text reads "Nenhum `if (config.etype === ...)` em lugar nenhum" (scoped to `config.etype`) and §10's Disciplina-visual criterion reads "Nenhum `if (etype === ...)` em **componente genérico**" (scoped to generic components) — `Shell.svelte` is the router, not a generic component. Documented inline in the source at lines 175-179. Not a blocker, but noted for transparency since the literal string pattern does appear. |
| `.planning/WINDOWS.md` | — | Entries 4-12 (9 items, all attributed to Phase 18, recorded 2026-08-11T16:49:58) remain `status: open` for files this session's live full e2e run confirms are passing today (`cross-phase-verification.spec.ts`, `entities-delete-confirmation.spec.ts`, `entities-form-dialog-composition.spec.ts`, `entities-form-restyle.spec.ts`, `entities-header-states.spec.ts`, `entities-projeto-etapa-tarefa.spec.ts`, `entities-rotina-log.spec.ts`, `entities-ticket-subtarefa.spec.ts`, `shell-chrome.spec.ts` — all ✓ in this session's run). | ℹ️ Info | Stale ledger bookkeeping, not a Phase 19 functional gap — these windows were opened during Phase 18 and the underlying tests now pass (fixed, apparently, by Plan 19-04's regression-proof wave and/or earlier 18-03 work), but nobody ran `gsd-tools windows fixed <id>` to close them. Does not affect Phase 19's own success criteria. Phase 19's own window (id 13, the hidden-host `entity-error`-vs-toast UX gap) is correctly logged `open` and is a genuine, documented, non-blocking deviation. Flagged here so a maintainer can close the stale entries before `/gsd-ship` if `workflow.windows_enforce` is active. |

### Human Verification Required

None. This milestone's explicit policy (`.planning/PROJECT.md`/`ROADMAP.md`: "zero human UAT anywhere in the milestone... this project runs fully autonomously") holds for Phase 19 — every success criterion above is Playwright- and unit-test-provable, and was actually re-executed in this verification session against the live hosted InstantDB backend, not merely inferred from SUMMARY.md text.

### Gaps Summary

None. All 4 ROADMAP.md success criteria for Phase 19, and both NEST-02/NEST-03 requirements, are backed by:
1. Direct reading of the live `ProjetosSection.svelte`/`projetosDerive.ts`/`Shell.svelte` source (not SUMMARY.md claims),
2. A live re-run of `bun test src`, `bun run check`, `bun run lint`, and the full `bun run test:e2e` suite in this session,
3. An isolated re-run of the one full-suite failure, confirming it as a live-backend network flake (matching an already-documented pattern from this phase's own SUMMARYs), not a regression,
4. Confirmation that all 14 Phase 19 commits exist in `git log --oneline --all`,
5. Confirmation via `git log` that `EntityScreen.svelte`/`registry.ts` were last touched by Phase 18 (commit `239aaea`), never by Phase 19 — satisfying the "generic engine stays untouched" constraint.

Two informational (non-blocking) notes are recorded above for transparency: the one router-level `rota.etype === "projetos"` branch in `Shell.svelte` (judged compliant with spec-ui.md §0.6/§10's actual scoped wording), and a stale-but-harmless `WINDOWS.md` bookkeeping gap unrelated to this phase's own deliverables.

---

_Verified: 2026-08-11T21:15:00Z_
_Verifier: Claude (gsd-verifier)_
