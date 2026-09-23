# Quick Task 260923-ivg: Tooltips de ajuda no formulario de templatesRotina - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Task Boundary

Adicionar tooltips de ajuda no formulario de criacao/edicao de `templatesRotina`
(`web/src/lib/entities/defs/templatesRotina.ts`, renderizado via `EntityScreen.svelte`)
explicando cada campo, e corrigir o bug de nao conseguir desselecionar o campo `diaSemana`
de volta para vazio/nenhum apos selecionado.

User was told this task was routed to GSD Quick (not GSD Fast) given its real scope: a new
UI component (Tooltip, doesn't exist yet), a genuine bug fix (Select can't clear), and
several fields needing accurate help copy. No further clarifying questions are being asked
here — gray areas below were resolved autonomously per this session's established
convention (see e.g. `260922-vbt-CONTEXT.md`), documented for transparency.

</domain>

<decisions>
## Implementation Decisions

### D1 — Tooltip trigger and icon
New `Tooltip` component at `web/src/lib/components/ui/tooltip/`, built on the same `bits-ui`
primitive family already used by the existing `Popover` component (consistency with this
project's established shadcn-svelte-style wrapper pattern under
`web/src/lib/components/ui/`). Trigger: hover AND keyboard focus (accessibility — a
mouse-only tooltip is unusable via Tab navigation). Icon: `circle-help` from `@lucide/svelte`
(confirmed present in `node_modules/@lucide/svelte/dist/icons/circle-help.js` this session),
placed immediately after each field's label, `text-muted-foreground` sizing consistent with
this project's existing icon usage (e.g. `CircleAlert` in `EntityScreen.svelte`).

### D2 — Help copy source of truth
Every tooltip's text must be derived from the actual generation-engine code
(`cli/apollo_cli/routine_job.py` / `web/src/lib/routineJob.ts`), read in full before writing
copy — never invented or guessed. Required content per field:
- `tipoGeracao`: explain all 4 values (`du_fixo`, `corrido_fixo`, `semanal`, `encadeado`) and
  when to use each, per the engine's actual semantics.
- `offsetDias`: explain its meaning is conditional on `tipoGeracao` (Nth business day for
  `du_fixo`, Nth calendar day for `corrido_fixo`, business days after antecessor for
  `encadeado`, not applicable to `semanal`).
- `diaSemana`: explain it only applies when `tipoGeracao == "semanal"`.
- `regraCompetencia`: explain the exact accepted vocabulary (read the engine code to confirm
  the literal strings it accepts — do not guess).
- `propagarAtrasoSoft`: MUST honestly state this field is currently reserved/has no effect on
  generation (every generated instance is hardcoded `tipoPrazo="soft"` regardless of this
  field's value — confirmed this session at `routineJob.ts:146` /
  `routine_job.py:73`, decision VAL-02 already documented in `PROJECT.md`/v1.5). Do not word
  this tooltip as if the field currently does something it doesn't.
- `ativo`: explain only active templates are considered by the instance-generation job.

### D3 — Select "clear to empty" fix mechanism
`EntityScreen.svelte`'s generic `kind: "select"` field renderer (around lines 690-709)
currently never emits a blank/"—" `<Select.Item>`, unlike its own link-select rendering
(around lines 735/788) which already does. Fix: emit a blank option for `kind: "select"`
fields that are NOT `required: true` in their `EntityConfig` field definition (check
`types.ts` for how `required` is currently expressed on a plain select field — reuse that
existing flag rather than inventing a new one). `diaSemana` (`required` should be false/
absent, since it is only meaningful for one of 4 `tipoGeracao` values) must gain the blank
option; `tipoGeracao` (`required: true`, always meaningful) must NOT gain one — this is
existing product behavior, do not weaken the required-field guarantee.

### D4 — Verification
Live Playwright tests (this project's established convention — no mocking): confirm a
tooltip's exact expected text appears on hover/focus for at least the `propagarAtrasoSoft`
field (the one with the most consequential, easy-to-get-wrong copy) and one other field;
confirm `diaSemana` can be set then cleared back to empty via the real UI, with the
persisted value actually becoming absent/null (not just visually blank) after save.

### Claude's Discretion
- Exact wording/length of each tooltip's copy (must satisfy D2's factual-accuracy
  requirement, phrasing itself is planner/executor judgment).
- Whether the Tooltip component supports rich content (multi-line, lists) or plain text only
  — plain text is sufficient for this task's copy, keep the component itself simple unless a
  field's copy genuinely needs structure.
- Task/file breakdown — likely 2 tasks: (1) new Tooltip component + Select clear-fix
  (infrastructure), (2) wiring tooltips into `templatesRotina.ts`'s field defs with the
  actual copy + live verification. Planner's call if a different split is cleaner.

</decisions>

<specifics>
## Specific Ideas

No exact mockup was given. The user's own words captured the requirement list verbatim:
tooltip help for tipoGeracao (with explanation of what diaSemana does and when to use it),
regraCompetencia's allowed text values, propagarAtrasoSoft (soft vs hard — see D2's honesty
requirement), and ativo. Plus the diaSemana deselect bug, raised in the same message.

</specifics>

<canonical_refs>
## Canonical References

- `cli/apollo_cli/routine_job.py` / `web/src/lib/routineJob.ts` — source of truth for every
  tooltip's factual content (D2).
- `.planning/PROJECT.md` Key Decisions table, VAL-02 — the existing documented decision that
  `propagarAtrasoSoft` is reserved/no-op, which D2's `propagarAtrasoSoft` copy must reflect
  honestly rather than silently contradict.
- `web/src/lib/entities/defs/templatesRotina.ts` — the field defs to attach tooltips to
  (already read in full this session, referenced in the surrounding conversation).
- `web/src/lib/entities/EntityScreen.svelte` (~lines 690-709, ~735/788) — the generic select
  renderer to fix (D3) and the existing link-select blank-option pattern to mirror.
- `web/src/lib/components/ui/popover/` — the existing primitive family the new Tooltip
  component should build on for consistency (D1).

</canonical_refs>
