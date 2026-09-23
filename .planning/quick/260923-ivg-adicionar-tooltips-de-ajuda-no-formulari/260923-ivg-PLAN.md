---
phase: 260923-ivg
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/lib/components/ui/tooltip/tooltip.svelte
  - web/src/lib/components/ui/tooltip/tooltip-provider.svelte
  - web/src/lib/components/ui/tooltip/tooltip-trigger.svelte
  - web/src/lib/components/ui/tooltip/tooltip-content.svelte
  - web/src/lib/components/ui/tooltip/index.ts
  - web/src/lib/entities/types.ts
  - web/src/lib/entities/EntityScreen.svelte
  - web/src/lib/entities/defs/templatesRotina.ts
  - web/e2e/templatesRotina-help-and-clear.spec.ts
autonomous: true

must_haves:
  truths:
    - "Every one of the 6 D2-required templatesRotina fields (tipoGeracao, offsetDias, diaSemana, regraCompetencia, propagarAtrasoSoft, ativo) shows a circle-help tooltip next to its form label, with text factually derived from routine_job.py/routineJob.ts's actual generation semantics — propagarAtrasoSoft's tooltip explicitly states it currently has no effect on generation (VAL-02), never implying it does something it doesn't."
    - "The tooltip opens on mouse hover AND on keyboard Tab focus (not mouse-only) — live-Playwright-proven independently for both trigger modes, for at least propagarAtrasoSoft and one other field (ativo)."
    - "tipoGeracao's select never gains a blank/\"—\" option — it stays a required, always-meaningful field, unchanged from today, live-Playwright-proven."
    - "diaSemana's select can be cleared back to blank via the real create/edit UI, and after clicking salvar, the persisted templatesRotina row read back from InstantDB via a live admin re-query has diaSemana absent/null — not merely visually blank in the UI."
    - "Whether InstantDB's update() clears a top-level scalar .optional() attribute when passed null is proven live via a standalone throwaway probe against the real production app BEFORE the diaSemana submit-payload fix is implemented on top of that assumption."
  artifacts:
    - web/src/lib/components/ui/tooltip/index.ts
    - web/src/lib/entities/types.ts
    - web/src/lib/entities/EntityScreen.svelte
    - web/src/lib/entities/defs/templatesRotina.ts
    - web/e2e/templatesRotina-help-and-clear.spec.ts
  key_links:
    - "web/src/lib/entities/types.ts's FieldDef.help -> web/src/lib/entities/defs/templatesRotina.ts's per-field help copy -> web/src/lib/entities/EntityScreen.svelte's Label-line Tooltip.Root/Trigger/Content rendering -> web/src/lib/components/ui/tooltip/* bits-ui Tooltip primitive wrappers"
    - "web/src/lib/entities/EntityScreen.svelte's handleSubmit payload-building loop's new initialFormValues-based explicit-null-clear -> tx[config.etype][editingId].update(payload) -> InstantDB's live update()-on-scalar-null behavior, proven first by Task 1's standalone probe before Task 3 relies on it"
    - "web/e2e/templatesRotina-help-and-clear.spec.ts -> web/e2e/fixtures/instancia-admin-fixture.ts's adminQuery -> live InstantDB re-fetch proving the persisted diaSemana value, not just the UI's visual state"
---

<objective>
Add factually-accurate help tooltips (a new bits-ui-backed `Tooltip` component, triggered on hover AND keyboard focus via a `circle-help` icon next to each label, per D1) to every meaningful field of the `templatesRotina` create/edit form (`web/src/lib/entities/defs/templatesRotina.ts`, rendered via `EntityScreen.svelte`), and fix the `diaSemana` field so it can genuinely be cleared back to empty — both the Select's missing blank option (D3 Part A) and the submit-payload loop silently dropping cleared optional fields (D3 Part B, the second bug this session's research found beyond the one originally reported). Every tooltip's copy must be pulled from the actual generation-engine code (D2), and `propagarAtrasoSoft`'s tooltip must honestly say it currently has no effect (VAL-02). Before building the clear-fix on top of it, the assumption that InstantDB's `update()` clears a scalar attribute when passed `null` must be proven live against production, not merely trusted from ambiguous docs.

Purpose: the form's 6 non-trivial fields (tipoGeracao's 4 generation modes, offsetDias' per-type meaning, diaSemana's semanal-only scope, regraCompetencia's exact accepted vocabulary, propagarAtrasoSoft's no-op status, ativo's generation-eligibility effect) are currently unexplained in the UI, and diaSemana silently fails to clear once set — both are real usability/data-integrity gaps in a form real users already depend on.
Output: a new `Tooltip` component family under `web/src/lib/components/ui/tooltip/`, `FieldDef.help` wired end-to-end for all 6 fields with accurate copy, `EntityScreen.svelte`'s select renderer and submit-payload loop both fixed for real clearing, and a new live Playwright spec proving all of it against the running app.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260923-ivg-adicionar-tooltips-de-ajuda-no-formulari/260923-ivg-CONTEXT.md
@.planning/quick/260923-ivg-adicionar-tooltips-de-ajuda-no-formulari/260923-ivg-RESEARCH.md
@web/src/lib/entities/EntityScreen.svelte
@web/src/lib/entities/types.ts
@web/src/lib/entities/defs/templatesRotina.ts
@web/src/lib/components/ui/popover/popover.svelte
@web/src/lib/components/ui/popover/popover-trigger.svelte
@web/src/lib/components/ui/popover/popover-content.svelte
@web/e2e/entities-rotina-log.spec.ts
@web/e2e/fixtures/instancia-admin-fixture.ts
@web/e2e/helpers/form-controls.ts
@web/e2e/helpers/gotoNested.ts
@cli/apollo_cli/routine_job.py
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Prove the InstantDB null-clear assumption live, then build the Tooltip component + wire the pipeline end-to-end for one field (ativo)</name>
  <files>web/src/lib/components/ui/tooltip/tooltip.svelte, web/src/lib/components/ui/tooltip/tooltip-provider.svelte, web/src/lib/components/ui/tooltip/tooltip-trigger.svelte, web/src/lib/components/ui/tooltip/tooltip-content.svelte, web/src/lib/components/ui/tooltip/index.ts, web/src/lib/entities/types.ts, web/src/lib/entities/EntityScreen.svelte, web/src/lib/entities/defs/templatesRotina.ts, web/e2e/templatesRotina-help-and-clear.spec.ts</files>
  <precondition>Repo-root `.env.instantdb` exists with a valid `NEXT_PUBLIC_INSTANT_APP_ID`/`INSTANT_APP_ID` and `INSTANT_APP_ADMIN_TOKEN` (the same file `web/e2e/fixtures/instancia-admin-fixture.ts` already depends on); `tp@rbrasset.com.br` is a valid existing InstantDB user (already true — the `authed` Playwright project's own persisted storageState depends on this same account).</precondition>
  <action>
  Step A — cheap live falsification FIRST, before writing any production code this task depends on (Common Pitfall 2 in RESEARCH.md): create a standalone throwaway script at `web/e2e/fixtures/_scratch-null-clear-probe.ts`, mirroring `instancia-admin-fixture.ts`'s exact InstantDB admin-init pattern verbatim (`readFileSync` + dotenv `parse` of the repo-root `.env.instantdb`, extracting `NEXT_PUBLIC_INSTANT_APP_ID ?? INSTANT_APP_ID` and `INSTANT_APP_ADMIN_TOKEN`, `init({ appId, adminToken })` from `@instantdb/admin`). The script must, in order: (1) resolve `tp@rbrasset.com.br`'s user id via `adminDb.auth.getUser({ email: "tp@rbrasset.com.br" })`; (2) create one scratch `templatesRotina` record via `adminDb.transact(adminDb.tx.templatesRotina[newId].update({ nome: "<a unique phase04-e2e-prefixed throwaway name>", tipoGeracao: "semanal", regraCompetencia: "M0", propagarAtrasoSoft: false, ativo: true, diaSemana: "segunda", donoId: ownerId }))`; (3) `adminDb.query({ templatesRotina: { $: { where: { id: newId } } } })` and confirm the returned row's `diaSemana` is exactly `"segunda"` (sanity-checks the create); (4) `adminDb.transact(adminDb.tx.templatesRotina[newId].update({ diaSemana: null }))`; (5) re-query the same row and check whether `diaSemana` is now absent/`null`/`undefined` versus still `"segunda"`; (6) print exactly one of two unambiguous lines to stdout — `PROBE PASS: null clears the scalar attribute via update()` or `PROBE FAIL: diaSemana still reads "segunda" after update({diaSemana: null})` — calling `process.exit(1)` on the FAIL branch so a non-zero process exit is the automated signal; (7) in a `finally` block, delete the scratch record via `adminDb.transact(adminDb.tx.templatesRotina[newId].delete())` regardless of PASS/FAIL, so no throwaway data survives in production. This script is never committed — Task 1's own `<verify>` runs it, greps its output, then deletes the file.

  Step B — build the Tooltip component family (D1: bits-ui-backed, hover AND keyboard-focus trigger, `circle-help` icon), mirroring the existing `Popover` wrapper family's exact file-per-primitive / `bits-ui`-import / `cn()`-class-merge shape (already read in full this session) 1:1, but wrapping `bits-ui`'s native `Tooltip` namespace instead — its `Trigger` already natively implements both hover and keyboard-focus opening (confirmed reading `TooltipTriggerState`'s prop surface this session: `onpointerenter`/`onfocus`/`onblur` handlers built in), satisfying D1's accessibility requirement with zero custom event-handling code: `tooltip.svelte` wraps `TooltipPrimitive.Root` (`import { Tooltip as TooltipPrimitive } from "bits-ui"`, `let { open = $bindable(false), ...restProps }: TooltipPrimitive.RootProps = $props();`, renders `<TooltipPrimitive.Root bind:open {...restProps} />`). `tooltip-provider.svelte` wraps `TooltipPrimitive.Provider` with a plain pass-through (`let { ...restProps }: TooltipPrimitive.ProviderProps = $props();`, renders `<TooltipPrimitive.Provider {...restProps} />` — keep its `delayDuration`/`disableHoverableContent`/etc. defaults, no override needed). `tooltip-trigger.svelte` mirrors `popover-trigger.svelte` exactly (`ref = $bindable(null)`, `class: className`, `...restProps`, `data-slot="tooltip-trigger"`, `class={cn("", className)}`) — note `TooltipPrimitive.Trigger` already defaults its rendered `<button>`'s `type` to `"button"` internally (confirmed reading its source this session) and this default takes precedence in its own prop-merge order, so no explicit `type="button"` is needed to keep it from submitting the surrounding `<form>`. `tooltip-content.svelte` mirrors `popover-content.svelte`'s structure but WITHOUT a portal wrapper (bits-ui's Tooltip namespace exports no `Portal` component, unlike Popover's — its `Content` primitive portals internally via its own floating-layer machinery): `let { ref = $bindable(null), class: className, sideOffset = 6, align = "center", ...restProps }: TooltipPrimitive.ContentProps = $props();`, rendering `<TooltipPrimitive.Content bind:ref data-slot="tooltip-content" {sideOffset} {align} class={cn("z-50 max-w-xs rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 outline-hidden", className)} {...restProps} />` — same animation/ring/shadow convention as `popover-content.svelte`, narrower (`max-w-xs` vs `w-72`) and smaller (`text-xs px-3 py-1.5` vs `text-sm p-2.5`) since this is a tooltip, not a popover panel. `index.ts` re-exports `Root`/`Provider`/`Trigger`/`Content` plus their `Tooltip`/`TooltipProvider`/`TooltipTrigger`/`TooltipContent` aliases, mirroring `popover/index.ts`'s export shape exactly.

  Step C — add the `help` field-def property: in `web/src/lib/entities/types.ts`, add an optional `help?: string;` member to every one of the 6 `FieldDef` union variants (text/textarea/number/boolean/date/select) — additive, backward-compatible, every other entity's field defs simply omit it.

  Step D — wire the render path: in `EntityScreen.svelte`, import `* as Tooltip from "$lib/components/ui/tooltip"` and `CircleHelp from "@lucide/svelte/icons/circle-help"` alongside the existing icon imports (top of file). Wrap the existing `<form onsubmit={handleSubmit} novalidate class="space-y-4"> ... </form>` element (currently ~lines 588-818) in a single `<Tooltip.Provider>` (one shared provider for every field's tooltip in this dialog). Change the field-loop's Label line (currently line 591, `<Label for={\`field-${f.name}\`}>{f.label}{#if f.required}<span class="text-destructive" aria-hidden="true"> *</span>{/if}</Label>`) into a `<div class="flex items-center gap-1">` wrapping: the unchanged `<Label>` element, followed by, when `f.help` is set, a `<Tooltip.Root><Tooltip.Trigger data-testid={\`field-help-${f.name}\`} class="text-muted-foreground hover:text-foreground"><CircleHelp class="size-3.5" /><span class="sr-only">Ajuda: {f.label}</span></Tooltip.Trigger><Tooltip.Content>{f.help}</Tooltip.Content></Tooltip.Root>` — icon placed immediately after the label, `text-muted-foreground` sizing consistent with this project's existing icon usage (`CircleAlert` elsewhere in this file), per D1.

  Step E — attach real copy to exactly ONE field this task (the tracer's proof field): in `web/src/lib/entities/defs/templatesRotina.ts`, add `help: "Somente templates ativos são considerados pelo job de geração de instâncias; templates inativos não geram novas instâncias."` to the `ativo` field def (grounded in `routine_job.py` lines 543-544/803, read this session — the loop-skip check plus the query-level `ativo: true` filter). Do not add `help` to any other field yet — Task 2 covers the remaining 5.

  Step F — create `web/e2e/templatesRotina-help-and-clear.spec.ts`, mirroring `entities-rotina-log.spec.ts`'s established shape: local `apolloCli(args)` (shells to `uv run --project cli apollo ...`), `uniqueName(prefix)` (returns `phase04-e2e-<prefix>-<timestamp>-<rand>`), and a `sweepLeftovers()` helper (lists `apollo rotina template listar`, deletes every `phase04-e2e-`-prefixed row via `apollo rotina template deletar --id <id> --force`) wired into `test.beforeEach`/`test.afterEach` — this harness is scaffolded now even though this task's own test doesn't create any template, so Tasks 2/3 can add tests without re-plumbing it. Add one test, `TOOLTIP-01: ativo's help tooltip appears on hover and on keyboard focus`: `gotoNested(page, "templatesRotina")`, click `entity-create-start`, locate `page.getByTestId("field-help-ativo")`, hover it and assert `page.locator('[data-slot="tooltip-content"]')` becomes visible and its text contains a distinctive substring of this task's own `ativo.help` copy (e.g. `"job de geração"`), press `Escape`, then — without any mouse action — call `.focus()` on the same `field-help-ativo` locator and re-assert the same tooltip content becomes visible again with the same substring, proving both D1 trigger modes independently. No template needs to be created for this test (a tooltip is pure client-side render inside the still-open create dialog); close the dialog via `entity-cancel` at the end. `test.setTimeout(60_000)`.
  </action>
  <verify>
    <automated>
set -e
cd web

# Step 1: cheap live falsification of the null-clear assumption — must pass
# before Task 3 is allowed to build the payload-loop fix on top of it.
bun run e2e/fixtures/_scratch-null-clear-probe.ts | tee /tmp/apollo-null-clear-probe.txt
grep -q "PROBE PASS" /tmp/apollo-null-clear-probe.txt || { echo "FAIL: probe did not confirm null-based clear against production InstantDB — do not proceed to Task 3's payload-loop fix without revisiting this finding (see RESEARCH.md Common Pitfall 2 / Open Question 1)"; exit 1; }
rm -f e2e/fixtures/_scratch-null-clear-probe.ts

# Step 2: type-check + lint the new component family, types.ts, and
# EntityScreen.svelte/templatesRotina.ts changes.
bun run check
bun run lint

# Step 3: live proof the Tooltip pipeline works end-to-end for one real
# field, both hover and keyboard focus.
bunx playwright test e2e/templatesRotina-help-and-clear.spec.ts --project=authed
</automated>
  </verify>
  <done>The live probe printed `PROBE PASS` and its scratch record was deleted; the probe script itself was deleted afterward. `web/src/lib/components/ui/tooltip/` contains the full 5-file wrapper family mirroring `Popover`'s shape. `FieldDef.help?: string` exists on every variant in `types.ts`. `EntityScreen.svelte` renders a `Tooltip.Root`/`Trigger`/`Content` next to any field whose `f.help` is set, inside one shared `Tooltip.Provider`. `ativo` has accurate `help` copy. `bun run check` and `bun run lint` pass. `TOOLTIP-01` passes live, proving the tooltip opens on both hover and keyboard focus with the correct text.</done>
</task>

<task type="auto">
  <name>Task 2: Attach accurate D2 copy to the remaining 5 fields, live-verify propagarAtrasoSoft's honest no-op tooltip</name>
  <files>web/src/lib/entities/defs/templatesRotina.ts, web/e2e/templatesRotina-help-and-clear.spec.ts</files>
  <action>
  In `web/src/lib/entities/defs/templatesRotina.ts`, add a `help` property to the 5 fields not yet covered (every string grounded in `cli/apollo_cli/routine_job.py`'s module docstring/constants, cross-checked against `web/src/lib/routineJob.ts`'s equivalent, both read in full this session — do not invent or guess wording, D2):

  `tipoGeracao`: `"Define como a data prevista de cada instância é calculada: \"du_fixo\" = Nº dia útil do mês (offset ≥ 1 conta a partir do 1º dia; offset ≤ 0 conta a partir do último dia útil do mês, ex.: 0 = último dia útil). \"corrido_fixo\" = Nº dia corrido do mês (offset sempre ≥ 1). \"encadeado\" = X dias úteis após a data prevista do template antecessor selecionado. \"semanal\" = toda ocorrência do dia da semana definido em \"Dia da semana\", sem usar offset."`

  `offsetDias`: `"Opcional; seu significado depende do Tipo de geração: \"du_fixo\" → Nº dia útil do mês; \"corrido_fixo\" → Nº dia corrido do mês; \"encadeado\" → dias úteis após a data prevista do antecessor. Não é utilizado quando o Tipo de geração é \"semanal\"."`

  `diaSemana`: `"Aplicável somente quando Tipo de geração = \"semanal\": define o dia da semana em que a instância é gerada, toda semana. Não tem efeito para os demais tipos de geração."`

  `regraCompetencia`: `"Texto livre, mas só 4 valores são reconhecidos pelo job de geração: \"M0\" (mesmo mês da data prevista), \"M-1\" (mês anterior), \"M-2\" (dois meses antes), \"M+1\" (mês seguinte). Qualquer outro valor faz o template ser ignorado na geração. Para templates \"encadeado\", este campo não é considerado — a competência é sempre herdada do antecessor."`

  `propagarAtrasoSoft`: `"Campo reservado: hoje não tem nenhum efeito na geração de instâncias. Toda instância gerada recebe automaticamente tipoPrazo \"soft\", independente do valor marcado aqui — propagação de atraso ainda não foi implementada."` — this exact honesty requirement (VAL-02) is the single most consequential copy in this task; do not word it as if the field currently does something.

  In `web/e2e/templatesRotina-help-and-clear.spec.ts` (created in Task 1), add `TOOLTIP-02: propagarAtrasoSoft's help tooltip appears on hover and keyboard focus, and honestly states its no-op status`, following `TOOLTIP-01`'s exact structure (open create dialog, hover `field-help-propagarAtrasoSoft`, assert `[data-slot="tooltip-content"]` visible and containing both `"reservado"` and `"soft"` as substrings — a concrete check that the honesty requirement's actual wording shipped, not just that some text renders — press Escape, then `.focus()` the same trigger and re-assert, close via `entity-cancel`). `test.setTimeout(60_000)`.
  </action>
  <verify>
    <automated>
cd web
bun run check
bun run lint
bunx playwright test e2e/templatesRotina-help-and-clear.spec.ts --project=authed
</automated>
  </verify>
  <done>All 6 templatesRotina fields requiring D2 copy (`tipoGeracao`, `offsetDias`, `diaSemana`, `regraCompetencia`, `propagarAtrasoSoft`, `ativo`) have accurate `help` text sourced from the engine code. `TOOLTIP-01` and `TOOLTIP-02` both pass live, proving hover+focus for two distinct fields per D4, and `propagarAtrasoSoft`'s tooltip is proven to contain its honest no-op wording, not just to render some text.</done>
</task>

<task type="auto">
  <name>Task 3: Fix both halves of the diaSemana clear bug (Select rendering + submit-payload loop), live-verify the persisted value actually clears</name>
  <files>web/src/lib/entities/EntityScreen.svelte, web/e2e/templatesRotina-help-and-clear.spec.ts</files>
  <precondition>Task 1's live probe printed `PROBE PASS` — `payload[f.name] = null` is confirmed to clear a top-level scalar `.optional()` InstantDB attribute via `tx[etype][id].update()` against this production app. If it printed `PROBE FAIL` instead, halt before implementing this task's payload-loop change and escalate rather than guessing at an undocumented alternate clear mechanism (RESEARCH.md Open Question 1) — do not proceed with the plan below as written.</precondition>
  <action>
  Part A (D3, rendering gap): in the `kind === "select"` block (currently ~lines 688-711), inside `<Select.Content>`, add `{#if !f.required}<Select.Item value="" label="—">—</Select.Item>{/if}` immediately before the existing `{#each f.options as opt (opt)}` loop — the exact same pattern already used by the link-select renderer a few blocks below (`{#if !link.required}<Select.Item value="" label="—">—</Select.Item>{/if}`). `diaSemana`'s field def already has `required: false`, so it gains the blank option; `tipoGeracao`'s `required: true` means it must NOT — verify the guard is `!f.required`, not `f.required` (an inverted guard would fix nothing and silently break `tipoGeracao` instead).

  Part B (D3, submit-payload gap — the bug the original report didn't name): add a new `let initialFormValues = $state<FormValues>({});` declaration immediately after the existing `let formValues = $state<FormValues>({});` (currently line 177). In `startCreate()`, immediately after its existing `formValues = values;` assignment (currently line 214), add `initialFormValues = { ...values };` — at create time every field's initial value is already `""`/`false`, so the new clear-detection logic below never fires for creates (unchanged behavior). In `startEdit(row)`, immediately after its existing `formValues = values;` assignment (currently line 241), add `initialFormValues = { ...values };` — this captures the row's actual persisted values at edit-open time, before any user interaction. In `handleSubmit`, widen the payload declaration (currently line 295, `const payload: Record<string, string | number | boolean> = {};`) to `const payload: Record<string, string | number | boolean | null> = {};`. Inside the `for (const f of visible)` loop's `if (raw === undefined || raw === "")` branch (currently lines 298-305), after the existing `if (f.required) { ...; return; }` guard, replace the bare `continue;` with: check whether `initialFormValues[f.name] !== undefined && initialFormValues[f.name] !== ""` (the field genuinely HAD a value when the form opened); if true, set `payload[f.name] = null` (an explicit, previously-non-empty optional value the user cleared back to blank — must reach InstantDB as a real clear, never silently omitted) before falling through to `continue`; if false (the field was never populated, in either create or edit mode), keep the existing no-op `continue` with no payload write, byte-identical to today's behavior for every field that was never touched.

  In `web/e2e/templatesRotina-help-and-clear.spec.ts`, add `CLEAR-01: diaSemana can be set then cleared back to empty, and the persisted value is actually absent afterward`, importing `adminQuery` from `./fixtures/instancia-admin-fixture.ts`. The test: creates a scratch template via `apolloCli(["rotina", "template", "criar", "--nome", uniqueName("clear"), "--tipo-geracao", "semanal", "--regra-competencia", "M0", "--dia-semana", "segunda"])`, capturing its `id`; navigates via `gotoNested(page, "templatesRotina")`, opens its `row-edit`; asserts the `field-diaSemana` trigger currently reads `"segunda"`; opens it and selects the blank option via `selectByText(page, "field-diaSemana", "—")` (reuses the existing helper unmodified — this only works because Part A's fix now renders that option); submits the form (click `entity-submit`, tolerating the same DOM-actionability race `entities-rotina-log.spec.ts`'s own local `submitForm` already documents — duplicate that tolerant click pattern locally in this file, consistent with this file's own no-shared-helper convention); waits briefly for InstantDB's write to settle; then calls `adminQuery<{ templatesRotina: { id: string; diaSemana?: string | null }[] }>({ templatesRotina: { $: { where: { id: templateId } } } })` and asserts the returned row's `diaSemana` is strictly `undefined` or `null` — NOT the literal string `"segunda"` — the actual server-side proof D4 requires, not a UI-only visual check. In the same test, also reopen the create dialog and call `openAndReadSelectOptions(page, "field-tipoGeracao")`, asserting the returned list does NOT include `"—"` — proving Part A's fix did not weaken `tipoGeracao`'s required-field guarantee (RESEARCH.md Pitfall 3). Delete the scratch template via `apolloCli` in a `finally` block regardless of pass/fail. `test.setTimeout(90_000)`.
  </action>
  <verify>
    <automated>
cd web
bun run check
bun run lint
bunx playwright test e2e/templatesRotina-help-and-clear.spec.ts --project=authed
</automated>
  </verify>
  <done>The `kind === "select"` renderer emits a blank `"—"` option only for non-required fields. `handleSubmit` sends an explicit `null` for any optional field that had a value at form-open time and was cleared to empty, leaving never-touched optional fields byte-identical to today. All 3 live tests in `templatesRotina-help-and-clear.spec.ts` (`TOOLTIP-01`, `TOOLTIP-02`, `CLEAR-01`) pass together. `CLEAR-01` specifically proves, via a live admin re-query (not the UI), that a cleared `diaSemana` is actually absent/null in production after save, and that `tipoGeracao` still offers no blank option.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser form (`EntityScreen.svelte`) → InstantDB client SDK `transact` | User-entered form values, keyed by each entity's own `FieldDef.name` allowlist, become an InstantDB write — the only server-reachable input surface this plan touches. |
| Throwaway admin probe script → InstantDB admin API | Task 1's `_scratch-null-clear-probe.ts` uses `INSTANT_APP_ADMIN_TOKEN` (bypasses per-user permission rules entirely) directly against the production app, mirroring the existing test-only admin-fixture convention. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-ivg-01 | Tampering | `EntityScreen.svelte` `handleSubmit`'s new explicit-null payload path | medium | mitigate | The new `payload[f.name] = null` branch only ever targets a key already present in `editableFields()` (i.e. `config.fields`, keyed by that entity's own `FieldDef.name`); `donoId` is never a `FieldDef` and is injected separately (from `auth.user?.id`, never from `formValues`/`payload`) — the null-clear mechanism cannot be used to null out `donoId` or any link field. Unchanged by this plan. |
| T-quick-ivg-02 | Information Disclosure | `web/e2e/fixtures/_scratch-null-clear-probe.ts` (Task 1, throwaway) reading `INSTANT_APP_ADMIN_TOKEN` | low | mitigate | Script is written, run, and deleted entirely within Task 1's own verify step — never committed to git, never imported by `web/src`, mirrors the existing `instancia-admin-fixture.ts` convention of confining admin-token usage to test-only, non-shipped code. Its own scratch `templatesRotina` record is deleted in a `finally` block regardless of pass/fail, so no test residue survives in production either way. |
| T-quick-ivg-03 | Information Disclosure | Tooltip help copy (`propagarAtrasoSoft` especially) | low | accept | Static, factual, non-secret UI copy describing already-documented product behavior (PROJECT.md VAL-02) — no new information surface for any user who couldn't already read the same fact in the codebase. |

</threat_model>

<verification>
- `cd web && bun run check` — svelte-check + both `tsc` passes (app, node, and e2e tsconfigs) are clean after every task.
- `cd web && bun run lint` — biome passes on every touched file.
- `cd web && bunx playwright test e2e/templatesRotina-help-and-clear.spec.ts --project=authed` — all 3 live tests (`TOOLTIP-01`, `TOOLTIP-02`, `CLEAR-01`) pass together after Task 3, exercising hover, keyboard focus, the Select blank-option fix, and a live admin re-query proving the persisted clear.
- Task 1's standalone probe (`_scratch-null-clear-probe.ts`) prints `PROBE PASS` before Task 3 is implemented — the load-bearing falsification this entire plan's diaSemana fix depends on.
</verification>

<success_criteria>
- All 6 D2-required templatesRotina fields show factually accurate tooltips, sourced from `routine_job.py`/`routineJob.ts`, with `propagarAtrasoSoft` honestly stating its no-op status.
- Tooltips open on both hover and keyboard focus, live-proven for 2 distinct fields.
- `tipoGeracao` never gains a blank select option; `diaSemana` can be cleared to blank via the real UI and the clear is proven to persist server-side (not just visually).
- The InstantDB scalar-null-clear assumption is proven live before being relied upon, not merely assumed from ambiguous documentation.
</success_criteria>

<output>
Create `.planning/quick/260923-ivg-adicionar-tooltips-de-ajuda-no-formulari/260923-ivg-SUMMARY.md` when done
</output>
