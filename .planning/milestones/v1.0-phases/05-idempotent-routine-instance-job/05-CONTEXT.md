# Phase 5: Idempotent Routine-Instance Job - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Recurring routine instances are generated automatically and safely, without ever duplicating or deleting existing instances, regardless of which channel triggers it (client-side on SPA load, or CLI via `apollo rotina gerar-instancias`).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped. PROJECT.md C-06 is LOCKED: client-side job on authenticated SPA load, range today→end of next month, three generation types (`du_fixo`, `corrido_fixo`, `encadeado`), upsert via `dedupeKey = hash(templateId + competencia + dataPrevista)` using InstantDB's atomic lookup-transact, never duplicates, never deletes. Same logic triggerable from CLI (`apollo rotina gerar-instancias`) for parity.

### Schema gap identified (needs resolution during planning)
`shared/instant.schema.ts`'s `templatesRotina` entity (built in Phase 1) has only `nome, tipoGeracao, regraCompetencia, propagarAtrasoSoft, ativo, donoId` + self-link `antecessor`/`sucessores`. **There is no field encoding WHICH day/business-day-offset a `du_fixo`/`corrido_fixo` template targets** (e.g. "5th business day of the month" or "the 10th calendar day"). This must be added to the schema in this phase (e.g. an `offsetDias: i.number()` field or similar) — pushing a schema addition is safe and non-breaking (InstantDB additive schema changes don't invalidate existing records; existing test `templatesRotina` records from Phase 3/4 testing will just have this field undefined until edited). The planner/researcher should design the simplest field(s) needed to fully specify all three generation types unambiguously, and a plan task must push the updated schema live (mirroring the Phase 1 pattern).

### Reference from the original `apollo` project's intake decisions (non-binding but informative — apollo-v2 is free to simplify further)
- Encadeado (chained) instances get `dataPrevistaEstimada` set when the antecessor template's own instance for the same competência is still pending — this is the ONLY encadeado-specific behavior in scope. Automatic soft-deadline reallocation and chained delay propagation (`propagarAtrasoSoft`'s actual reallocation effect) are explicitly OUT OF SCOPE per PROJECT.md C-09 ("Advanced v2 rules... remain deferred") — `propagarAtrasoSoft` exists as a schema field but its behavior is NOT implemented in this phase, only stored.
- `competencia` (YYYY-MM) is filled per `regraCompetencia` (`M0`, `M-1`, `M-2`, `M+1`, or `manual` — for `manual`, apollo-v2 may treat it as "generation skipped, no auto competencia" or require an explicit per-instance value; planner's discretion, document the choice).
- `tipoPrazo` on the generated instance is discretionary — original project inferred hard/soft via keyword heuristics (out of scope here); simplest apollo-v2 approach: instance inherits a fixed value or copies from the template if a field is added, planner's call.

</decisions>

<code_context>
## Existing Code Insights

Phase 2 built `shared/anbima-calendar.json` + `web/src/lib/bizdays.ts` + `cli/apollo_cli/bizdays.py` (isBusinessDay/addBusinessDays/nextBusinessDay) — this phase's `du_fixo` generation type consumes that business-day math directly. Phase 3 built `cli/apollo_cli/entities/rotina.py` (template CRUD, instancia list/status-only — no create/delete, by design, since this phase owns instance creation). Phase 4 built `web/src/lib/entities/defs/templatesRotina.ts` and `instanciasRotina.ts` (SPA screens, same no-create/delete-for-instancia restriction). The job logic in this phase is the ONLY code path allowed to create `instanciasRotina` records.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP phase description, the 4 success criteria, and PROJECT.md C-06. See the schema-gap note above — this is the main open design question for research/planning to resolve.

</specifics>

<deferred>
## Deferred Ideas

Automatic soft-deadline reallocation, chained delay propagation (the actual behavioral effect of `propagarAtrasoSoft`), and any UI/report of what the job did — all explicit v2/future scope per PROJECT.md C-09.

</deferred>
