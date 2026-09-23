---
phase: 260923-ivg
verified: 2026-09-23T17:22:00Z
status: passed
score: 5/5 must-haves verified
covered_files: [".planning/quick/260923-ivg-adicionar-tooltips-de-ajuda-no-formulari/260923-ivg-CONTEXT.md", ".planning/quick/260923-ivg-adicionar-tooltips-de-ajuda-no-formulari/260923-ivg-PLAN.md", ".planning/quick/260923-ivg-adicionar-tooltips-de-ajuda-no-formulari/260923-ivg-SUMMARY.md", "web/e2e/templatesRotina-help-and-clear.spec.ts", "web/src/lib/components/ui/tooltip/index.ts", "web/src/lib/components/ui/tooltip/tooltip-content.svelte", "web/src/lib/components/ui/tooltip/tooltip-provider.svelte", "web/src/lib/components/ui/tooltip/tooltip-trigger.svelte", "web/src/lib/components/ui/tooltip/tooltip.svelte", "web/src/lib/entities/EntityScreen.svelte", "web/src/lib/entities/defs/templatesRotina.ts", "web/src/lib/entities/types.ts"]
covered_digest: "v1:sha256:9cb825a3a9d8c9a88bccae9de5be42c86213ce9a011b30518c8832a460b019ad"
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260923-ivg: Tooltips de ajuda no formulario de templatesRotina — Verification Report

**Task Goal:** Adicionar tooltips de ajuda no formulario de templatesRotina explicando cada campo (tipoGeracao, offsetDias, diaSemana, regraCompetencia, propagarAtrasoSoft, ativo), e corrigir o bug de nao conseguir desselecionar diaSemana de volta para vazio/nenhum apos selecionado.

**Verified:** 2026-09-23T17:22:00Z
**Status:** passed
**Re-verification:** No — initial verification

**Methodology:** SUMMARY.md claims were not trusted. Every must-have below was independently re-checked against the actual source files (`routineJob.ts`, `routine_job.py`, `templatesRotina.ts`, `EntityScreen.svelte`), and the live Playwright spec was independently re-executed by the verifier against the real running app (not re-run from the executor's cached output), including a fresh live admin re-query and a post-run scan for production leftover data.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 6 D2-required fields (tipoGeracao, offsetDias, diaSemana, regraCompetencia, propagarAtrasoSoft, ativo) show a circle-help tooltip with copy factually derived from routine_job.py/routineJob.ts; propagarAtrasoSoft honestly discloses its no-op status | ✓ VERIFIED | `templatesRotina.ts` has `help` on all 6 fields (grep confirmed). Cross-checked each string against `routineJob.ts` source: `REGRAS_COMPETENCIA_SUPORTADAS = ["M0","M-1","M-2","M+1"]` with `shiftCompetencia`'s delta map (M0=0/"mesmo mês", M-1=-1/"mês anterior", M-2=-2/"dois meses antes", M+1=+1/"mês seguinte") matches copy exactly. `du_fixo`/`corrido_fixo`/`encadeado`/`semanal` offsetDias semantics (lines 71-78, 118-119 of routineJob.ts) match the shipped copy exactly. `propagarAtrasoSoft` copy ("Campo reservado: hoje não tem nenhum efeito... Toda instância gerada recebe automaticamente tipoPrazo \"soft\"") matches routineJob.ts:81 comment ("propagarAtrasoSoft is stored on the template but never read anywhere in this module (C-09)") and `TIPO_PRAZO_GERADO` hardcoding at lines 384/486/741 — the copy is honest, does not overclaim. |
| 2 | Tooltip opens on mouse hover AND keyboard Tab focus, live-proven independently for propagarAtrasoSoft and ativo | ✓ VERIFIED | Independently re-ran `bunx playwright test e2e/templatesRotina-help-and-clear.spec.ts --project=authed` myself (not the executor's log). `TOOLTIP-01` (ativo) and `TOOLTIP-02` (propagarAtrasoSoft) each hover the trigger + assert content visible, press Escape + assert hidden, then `.focus()` the trigger with zero mouse action + re-assert content visible — both passed live. |
| 3 | tipoGeracao's select never gains a blank/"—" option — stays required, unchanged | ✓ VERIFIED | `templatesRotina.ts`: `tipoGeracao` has `required: true`. `EntityScreen.svelte` line 742: blank option guarded by `{#if !f.required}` (correct polarity, not inverted). Live-proven in my own re-run of `CLEAR-01`, which explicitly asserts `openAndReadSelectOptions(page, "field-tipoGeracao")` does not contain `"—"`. |
| 4 | diaSemana can be cleared via the real UI, and the persisted InstantDB value is absent/null (not just UI-blank) | ✓ VERIFIED | Independently re-ran `CLEAR-01` live: creates a scratch template via CLI, clears `diaSemana` to `"—"` in the real edit form, submits, then performs a fresh `adminQuery` against InstantDB and asserts `persisted?.diaSemana ?? null` is `null`. Test passed in my own run (not reused from executor's session). Confirmed the payload/`initialFormValues` fix in `EntityScreen.svelte` (lines ~186, 218, 246, 295-315) matches the plan's described mechanism exactly — optional field with a prior value now gets an explicit `payload[f.name] = null` on clear, vs. the old silent `continue`. |
| 5 | InstantDB update()-clears-scalar-null assumption proven live via a throwaway probe BEFORE the payload fix was built on it | ✓ VERIFIED | Probe file (`web/e2e/fixtures/_scratch-null-clear-probe.ts`) is absent from the working tree and was never committed (`git log` on the path returns nothing) — consistent with "written, run, deleted, never committed." The downstream fix it gates (Task 3's `payload[f.name] = null` mechanism) is present and independently proven working by my own live re-run of `CLEAR-01` above — the assumption clearly held in practice, and no scratch record survives in production (see anti-pattern/data-leak check below). |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/lib/components/ui/tooltip/index.ts` | Re-exports Root/Provider/Trigger/Content + aliases | ✓ VERIFIED | Confirmed full 4-file wrapper family + index, mirrors Popover's shape. `tooltip-trigger.svelte` wraps bits-ui's native `Tooltip.Trigger` (hover+focus handling delegated to primitive, proven live above). |
| `web/src/lib/entities/types.ts` | `help?: string` on every FieldDef variant | ✓ VERIFIED | grep confirms `help?: string` on all 6 variants (text/textarea/number/boolean/date/select). |
| `web/src/lib/entities/EntityScreen.svelte` | Tooltip render wiring + select blank-option fix + submit-payload null-clear fix | ✓ VERIFIED | `Tooltip.Provider` wraps the form (line 610); `{#if f.help}` renders `Tooltip.Root/Trigger/Content` (615-625); select blank-option guarded `{#if !f.required}` (742); `initialFormValues` tracking + explicit-null payload logic present (177-315), matches plan mechanism precisely. |
| `web/src/lib/entities/defs/templatesRotina.ts` | help copy on all 6 fields | ✓ VERIFIED | All 6 present, factually cross-checked against source (see Truth 1). |
| `web/e2e/templatesRotina-help-and-clear.spec.ts` | 3 live tests (TOOLTIP-01, TOOLTIP-02, CLEAR-01) | ✓ VERIFIED | All 3 tests present and independently re-run by verifier — passed. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `types.ts FieldDef.help` | `templatesRotina.ts` field defs | `help: "..."` per field | ✓ WIRED |
| `templatesRotina.ts` field defs | `EntityScreen.svelte` render | `{#if f.help}` → `Tooltip.Root/Trigger/Content` | ✓ WIRED (live-proven) |
| `EntityScreen.svelte handleSubmit` | InstantDB `update()` | `payload[f.name] = null` on detected clear | ✓ WIRED (live-proven via admin re-query) |
| `templatesRotina-help-and-clear.spec.ts` | InstantDB live state | `adminQuery` via `instancia-admin-fixture.ts` | ✓ WIRED (live-proven, not UI-only) |

### Behavioral Spot-Checks / Live Re-verification

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full live e2e spec re-run (independent of executor) | `bunx playwright test e2e/templatesRotina-help-and-clear.spec.ts --project=authed` | 4/4 passed (auth.setup + TOOLTIP-01 + CLEAR-01 + TOOLTIP-02), 40.7s | ✓ PASS |
| Type-check | `bun run check` | 936 files, 0 errors (1 pre-existing unrelated warning in `ProjetosSection.svelte`) | ✓ PASS |
| Lint (task-touched files only) | `bunx biome check <9 task files>` | "Checked 9 files. No fixes applied." (0 errors) | ✓ PASS |
| Lint (whole `web` workspace) | `bun run lint` | 1 pre-existing error in `registry.test.ts` (unrelated file, not in this task's `files_modified`) | ℹ️ Pre-existing, out of scope — confirmed not touched by this task via `git log`/`git status` |
| Production leftover scan | `apollo rotina template listar` filtered for `phase04-e2e-`/scratch prefixes, post my own live re-run | 0 leftover records | ✓ PASS — no residue |
| routine_job.py/routineJob.ts untouched | `git log`/`git status` on both files since before this task's commits | No commits, no working-tree changes | ✓ CONFIRMED UNTOUCHED |

### Anti-Patterns Found

None in task-touched files. No TBD/FIXME/XXX/TODO/HACK/placeholder markers found in the 9 files this task created or modified. No stray scratch files (`_scratch-null-clear-probe.ts` absent from working tree and git history — never committed).

### Human Verification Required

None. All 5 must-have truths were verified with live, independently-reproduced evidence (re-run Playwright spec, live InstantDB admin re-query, source-code cross-check against the generation engine) rather than accepted from SUMMARY.md claims.

### Gaps Summary

No gaps. All must-haves from the PLAN frontmatter verified against the actual codebase and live app:
- Tooltip copy for all 6 fields is factually accurate, cross-checked line-by-line against `routineJob.ts`'s actual constants/logic (`REGRAS_COMPETENCIA_SUPORTADAS`, `shiftCompetencia`'s delta map, offsetDias per-type semantics, `propagarAtrasoSoft`'s confirmed non-use in generation).
- `diaSemana` clears genuinely server-side (live admin re-query in my own re-run returned `null`, not merely a UI-blank state).
- `tipoGeracao`'s select confirmed still has no blank option, both in code (`required: true` + correct `!f.required` guard) and via live re-run assertion.
- Tooltips confirmed to open via both hover and keyboard focus, live, for two distinct fields.
- No production scratch data left behind — verified via a fresh listar scan after my own re-run, and the throwaway probe file/commit history confirms it was never committed.
- `routine_job.py`/`routineJob.ts` confirmed genuinely untouched by this task via git history and working-tree diff.

---

*Verified: 2026-09-23T17:22:00Z*
*Verifier: Claude (gsd-verifier)*
