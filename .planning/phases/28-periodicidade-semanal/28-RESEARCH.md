# Phase 28: Periodicidade semanal - Research

**Researched:** 2026-08-14
**Domain:** Recurring-instance generation engine (`compute_expected_instances`/`computeExpectedInstances`), InstantDB schema evolution, Click CLI surface
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **`--dia-semana`, não offset numérico.** O novo tipo recebe um dia da semana
   nomeado (ex. `segunda|terca|quarta|quinta|sexta|sabado|domingo`, ou os
   equivalentes em inglês — decisão de nomenclatura fica com o planner/research,
   desde que documentada) em vez de reaproveitar `--offset-dias` com uma
   codificação nova — mais legível e evita sobrecarregar um campo que já tem
   três significados diferentes (`du_fixo`/`corrido_fixo`/`encadeado`).
2. **Sem consciência de feriado/dia útil.** "Semanal" gera em **todo**
   calendário-dia que cai no dia da semana escolhido, dentro do range de
   geração — não pula feriados nem fins de semana (a própria escolha do dia
   da semana já exclui os outros 6 dias). Isso espelha o precedente de
   `corrido_fixo` (calendário puro, sem `is_business_day`) — decisão minha,
   já que o evento real de origem ("toda sexta-feira") não menciona nenhuma
   exceção de feriado.
3. **Regra de competência: reaproveitar `REGRAS_COMPETENCIA_SUPORTADAS`
   (`M0`/`M-1`/`M-2`/`M+1`) aplicada sobre a `dataPrevista` gerada**, via
   `shift_competencia` já existente — não inventar uma regra de competência
   nova só para o tipo semanal. `--regra-competencia` continua obrigatório e
   validado por `click.Choice` (Fase 26) igual aos outros tipos.
4. **`offsetDias` não se aplica a `semanal`** — deve ficar `None`/omitido para
   esse tipo (igual a como `regraCompetencia` não é usada por `encadeado` para
   sua própria competência, D-05-D). Validar/documentar essa exclusividade no
   `--help`.
5. **`dedupeKey` continua `templateId:competencia:dataPrevista`** — nenhuma
   mudança na fórmula. Cada ocorrência semanal tem uma `dataPrevista` distinta,
   então a idempotência já funciona sem alteração.
6. **Range de geração inalterado nesta fase** — continua `[today, fim do
   próximo mês]` (a Fase 29 trata do recorte de range; não antecipar essa
   mudança aqui). Dentro desse range, o tipo semanal deve enumerar **todas**
   as ocorrências do dia da semana escolhido (tipicamente 8-9 no range de
   ~2 meses), não só uma por mês como os tipos fixos.
7. **Escopo estritamente aditivo** — `du_fixo`, `corrido_fixo`, `encadeado`
   continuam com o dispatch/validação exatamente como estão (a Fase 27 já
   modificou `du_fixo`; esta fase não toca nele de novo).
8. **Paridade TS/Python obrigatória** (C-06) — a nova lógica de enumeração
   semanal precisa de fixtures em `shared/routine-job.testcases.json`
   cobrindo o caso real (sexta-feira, range de agosto/setembro 2026) provadas
   idênticas nos dois runtimes.

**Research correction on decision 6's estimate:** empirically verified (this
session, real script execution) the "8-9 occurrences" estimate is slightly high
for the actual range shape. With `today = 2026-08-09` (the existing fixture
convention's anchor date) and `range_end = end_of_next_month("2026-08-09") =
"2026-09-30"`, a Friday (`sexta`) occurs exactly **7** times: `2026-08-14,
2026-08-21, 2026-08-28, 2026-09-04, 2026-09-11, 2026-09-18, 2026-09-25`
`[VERIFIED: script execution, this session]`. The count is range-start-phase-dependent
(7 or 8 depending on where in the month `today` falls, since the range is ~52
days, not a clean 2 calendar months) — the planner/fixture author should compute
the real expected list for whatever `today` the fixture uses, not assume "8-9".

### Claude's Discretion

None stated separately in CONTEXT.md beyond the specifics below (weekday-storage
architecture) — CONTEXT.md explicitly delegates that one decision to research.

### Deferred Ideas (OUT OF SCOPE)

Nenhuma — escopo desta fase é só SEM-01, fechado.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEM-01 | Novo `tipoGeracao = "semanal"` para `templatesRotina`, ancorado em um dia da semana (`--dia-semana`) em vez de um offset mensal, cobrindo eventos como "toda sexta-feira" sem forçar uma aproximação artificial num tipo mensal. Inclui a regra de competência aplicável a esse tipo, cálculo espelhado nos dois runtimes, e fixtures novas em `shared/routine-job.testcases.json`. | Central architecture decision (storage field), verified enumeration algorithm (Python + TS, cross-checked via live script execution), exact post-Phase-27 dispatch line numbers, CLI/`--help` design consistent with existing `offsetDias`/`encadeado` precedent, SPA parity gap flagged as an open question. |
</phase_requirements>

## Summary

The central open question — how to store the chosen weekday on `templatesRotina`
— resolves cleanly in favor of **Option B (a new `diaSemana` field)**, reversing
CONTEXT.md's own tentative lean toward Option A. The reversal rests on concrete,
this-session-verified evidence, not preference: (1) a schema push has **already
happened once** in this project's history for exactly this kind of additive
optional field (`offsetDias`, Phase 5/commit `81155ed`, via `bun run
instant:push` + `bun run instant:verify`) — CONTEXT.md's premise that this would
be "the first schema migration since v1.0" is factually wrong, and a fully
documented, low-risk playbook already exists to copy; and (2) every other
"choice"-shaped field in this schema (`tipoGeracao`, `regraCompetencia`, `status`)
is stored as a plain string, never an encoded integer — reusing the *numeric*
`offsetDias` field for a weekday enum would be the first violation of that
convention, not a continuation of one (JOB-02's `du_fixo` offset-sign overload is
still fundamentally numeric; a weekday name is not).

The weekly-occurrence enumeration algorithm is fully designed and **cross-runtime
verified by direct execution in this session** (not just reasoned about): a
closed-form "first occurrence on/after `range_start`, then step +7 calendar days
until `> range_end`" produces byte-identical results in Python (`datetime.date`)
and TypeScript (native `Date` + `getUTCDay()`), across four test cases including
inclusive single-day and inverted-range edges. The TS side must convert
`getUTCDay()`'s Sunday=0 convention to Monday=0 via `(getUTCDay() + 6) % 7` to
match Python's native `date.weekday()` — this exact idiom already exists,
unexported, in `web/src/lib/dashboard/derive.ts::semanaUtil`, and should be
locally duplicated into `routineJob.ts` (mirroring the precedent Phase 27 already
set by locally duplicating `lastDayOfMonth` there to avoid a `bizdays.ts` ->
`routineJob.ts` import).

One gap CONTEXT.md's escopo bullet does not mention: `web/src/lib/entities/defs/
templatesRotina.ts` already hard-codes `tipoGeracao`'s SPA select to exactly 3
options and does not expose `offsetDias`'s dual-purpose comment for a would-be
4th type. This file is not in CONTEXT.md's listed escopo, but is a real,
name-checked file `grep`-confirmed to touch both `tipoGeracao` and `offsetDias`.
Leaving it untouched will not crash the SPA (the select renders the raw string as
plain text even when it isn't in `options`), but it does create a permanent gap
in "do this from either channel" (PROJECT.md's own core value, and precisely
what Phase 5's 05-01 plan did in the same phase for `offsetDias`). Flagged in
Open Questions for explicit planner/user resolution, not silently added or
silently skipped.

**Primary recommendation:** Add `diaSemana: i.string().optional()` to
`templatesRotina` in `shared/instant.schema.ts`, storing the same lowercase
unaccented Portuguese token the CLI's `click.Choice` accepts (`segunda`..
`domingo`) — never a numeric index. Push it live via the existing `bun run
instant:push` + `bun run instant:verify` playbook (Task-1-shaped, mirroring
05-01-PLAN.md exactly) before writing any compute/CLI logic that reads it, per
`instant.perms.ts`'s `attrs.allow.create: "false"` (clients cannot mint runtime
attributes — the field must exist server-side first).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Weekly-occurrence date enumeration | Browser/Client (SPA, `routineJob.ts` runs client-side per PROJECT.md C-06) | Browser/Client analog (CLI, `routine_job.py` — same pure algorithm, different process) | No backend server exists in this app; InstantDB is a BaaS. The generation job is explicitly client-triggered (SPA on load, or CLI on demand) per the locked C-06 constraint — both are "client" tier from InstantDB's perspective. |
| `diaSemana` storage | Database/Storage (InstantDB `templatesRotina` schema) | — | Field/link shapes are LOCKED (PROJECT.md C-04) and version-controlled in `shared/instant.schema.ts`; this is the single source of truth both client tiers read from. |
| `--dia-semana` input validation | Browser/Client analog (CLI, `click.Choice`) | Browser/Client (SPA form, if extended — see Open Questions) | Format validation happens at the write surface; business validity (does this template's type actually need it) happens in the shared compute core, per the established `offsetDias`/T-05-13 precedent of never gating type-conditional validity at write time. |
| `templatesRotina` SPA CRUD form (`tipoGeracao`/`diaSemana` options) | Browser/Client (SPA, `EntityScreen.svelte` + `defs/templatesRotina.ts`) | — | Purely presentational; not wired to the compute engine at all. |

## Standard Stack

No new external library is required for this phase. `SEM-01`'s enumeration
algorithm is implementable entirely with each runtime's standard library
(`datetime.date`/`timedelta` in Python; native `Date` in TypeScript) — confirmed
by inspecting `web/package.json`, which has **no** `date-fns`, `dayjs`,
`luxon`, or `moment` dependency anywhere in `dependencies`/`devDependencies`
`[VERIFIED: web/package.json, read this session]`. Introducing one now would be a
net-new, unjustified dependency for a problem the project's own precedent
(`web/src/lib/dashboard/derive.ts::semanaUtil`) already solves with plain `Date`
arithmetic.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| Python stdlib `datetime` (`date`, `timedelta`) | bundled (Python 3.10+, project runs 3.12 per `.venv`) | Weekday index + calendar-day stepping | Already imported project-wide (`bizdays.py`, `routine_job.py` itself imports `datetime`/`UTC`); zero new dependency |
| Native `Date` (TS/JS runtime) | bundled | Same, TS side | Established local idiom in `derive.ts::semanaUtil`; no library needed |

### Supporting

None.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdlib `datetime`/native `Date` | `python-dateutil` (`rrule` weekly) / `date-fns` | Neither is a dependency of either package today; adding one purely for a 15-line closed-form loop violates the project's own "Don't Hand-Roll" balance in the opposite direction — this problem is genuinely trivial, not deceptively complex (see Don't Hand-Roll section). |

**Installation:** None — no new packages.

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero new external packages in either
`cli/pyproject.toml` or `web/package.json`. The legitimacy gate is skipped per
its own trigger condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
apollo rotina template criar/editar --tipo-geracao semanal --dia-semana sexta
        │
        ▼
click.Choice(_TIPO_GERACAO_CHOICES) validates "semanal" is a known type
click.Choice(_DIA_SEMANA_CHOICES) validates "sexta" is a known weekday token
        │
        ▼
create_entity/update_entity ──► InstantDB templatesRotina row
                                  { tipoGeracao: "semanal", diaSemana: "sexta",
                                    regraCompetencia: "M0", offsetDias: <omitted> }
        │
        ▼ (apollo rotina gerar-instancias, OR SPA on authenticated load — C-06)
_query_active_templates ──► compute_expected_instances(templates, today, existing)
        │
        ▼  Pass 1 dispatch (per-template, by tipoGeracao)
   ┌────────────┬───────────────┬────────────┬──────────────────────┐
   │  du_fixo   │ corrido_fixo  │ encadeado  │  semanal  (NEW)      │
   │ (month-    │ (month-       │ (Pass 2,   │  _compute_semanal_   │
   │  candidate)│  candidate)   │  chain)    │  instances:          │
   │            │               │            │  1. resolve diaSemana│
   │            │               │            │     -> weekday idx  │
   │            │               │            │  2. weekly_occurrences│
   │            │               │            │     (range_start,    │
   │            │               │            │      range_end, idx) │
   │            │               │            │  3. shift_competencia│
   │            │               │            │     per occurrence   │
   └────────────┴───────────────┴────────────┴──────────────────────┘
        │                                              │
        ▼                                              ▼
   expected instances (dedupeKey = templateId:competencia:dataPrevista)
        │
        ▼
diff against existing instanciasRotina ──► upsert only new dedupeKeys (unchanged)
```

### Recommended Project Structure

No new files. Modified files only:

```
shared/
├── instant.schema.ts              # + templatesRotina.diaSemana: i.string().optional()
└── routine-job.testcases.json     # + dayMath.weeklyOccurrences cases, + "semanal" scenarios

cli/apollo_cli/
├── routine_job.py                 # + _DIAS_SEMANA_SUPORTADOS, _weekly_occurrences, _compute_semanal_instances, dispatch branch, _normalize_template.diaSemana
└── entities/rotina.py             # + "semanal" in _TIPO_GERACAO_CHOICES, + --dia-semana option (criar/editar)

web/src/lib/
└── routineJob.ts                  # + weekday helpers, TemplateRow.diaSemana, computeSemanalInstances, dispatch branch, SkipReason additions

web/src/lib/entities/defs/
└── templatesRotina.ts             # OPEN QUESTION: extend tipoGeracao options + add diaSemana select (see Open Questions)
```

### Pattern 1: Sign/type dispatch inside the Pass-1 loop (existing idiom, extend it)

**What:** `compute_expected_instances`/`computeExpectedInstances` dispatch on
`tipoGeracao` inside a single `for` loop's `try` block, one `elif`/`else if`
branch per fixed (non-chained) type, falling through to
`tipo_geracao_desconhecido` for anything unrecognized.

**When to use:** Any new non-chained generation type (this is exactly `semanal`
— it needs no antecessor, no Pass-2 topological resolution).

**Verified current insertion points** `[VERIFIED: cli/apollo_cli/routine_job.py:409-431, this session, post-Phase-27]`:

```python
# routine_job.py, inside compute_expected_instances' Pass-1 try block —
# current code (verbatim, lines 409-431):
        try:
            if tipo_geracao == "du_fixo":
                instances, skip_reason = _compute_fixed_instances(
                    template, today, range_start, range_end,
                    _DU_FIXO_MIN_OFFSET_DIAS, _du_fixo_nth_day,
                )
            elif tipo_geracao == "corrido_fixo":
                instances, skip_reason = _compute_fixed_instances(
                    template, today, range_start, range_end, 1, nth_calendar_day_of_month
                )
            else:
                skipped.append({..., "reason": "tipo_geracao_desconhecido"})
                continue
```

The new branch is an `elif tipo_geracao == "semanal":` inserted between the
`corrido_fixo` branch and the final `else`, calling a **new sibling function**
`_compute_semanal_instances(template, range_start, range_end)` — NOT a new
`nth_day_fn` passed into `_compute_fixed_instances`, because that helper is
structurally month-candidate-based (`candidate_months = [(today_year,
today_month), (next_month_year, next_month)]`, one date computed per month) and
cannot express "iterate every matching weekday across the whole range" without
being rewritten — CONTEXT.md's own `<code_context>` section already reaches this
same conclusion.

**TS mirror, verified current insertion point** `[VERIFIED: web/src/lib/routineJob.ts:452-479, this session, post-Phase-27]`:

```typescript
// computeExpectedInstances, inside the try block — current code (verbatim):
      let result: { instances: ExpectedInstance[] } | { skipReason: SkipReason };
      if (template.tipoGeracao === "du_fixo") {
        result = computeFixedInstances(template, today, rangeStart, rangeEnd, DU_FIXO_MIN_OFFSET_DIAS, duFixoNthDay);
      } else if (template.tipoGeracao === "corrido_fixo") {
        result = computeFixedInstances(template, today, rangeStart, rangeEnd, 1, nthCalendarDayOfMonth);
      } else {
        skipped.push({ templateId: template.id, nome: template.nome, reason: "tipo_geracao_desconhecido" });
        continue;
      }
```

New branch: `else if (template.tipoGeracao === "semanal") { result =
computeSemanalInstances(template, rangeStart, rangeEnd); }` inserted before the
final `else`.

### Pattern 2: Weekday enumeration — closed-form, calendar-pure (verified cross-runtime identical)

**What:** Given `[range_start, range_end]` and a target weekday index
(Monday=0..Sunday=6, matching Python's native `date.weekday()`), find the first
matching date `>= range_start`, then step +7 calendar days until `> range_end`.

**When to use:** Exactly the `semanal` enumeration — decision #2 forbids any
`is_business_day`/`add_business_days` involvement (pure calendar-day, mirroring
`corrido_fixo`'s "never snaps onto a business day" precedent, `web/src/lib/
routineJob.ts` line 31 docstring).

**Verified identical output, this session, by direct script execution** (not
reasoning alone) — four cases, Python vs. Node, byte-for-byte identical:

| Case | Range | Target | Result (both runtimes) |
|------|-------|--------|--------------------------|
| Anchor on target weekday | `2026-08-14`..`2026-09-30` | sexta (Fri, idx 4) | `["2026-08-14","2026-08-21","2026-08-28","2026-09-04","2026-09-11","2026-09-18","2026-09-25"]` (7) |
| Anchor before target weekday | `2026-08-17`..`2026-09-30` | sexta | `["2026-08-21",...,"2026-09-25"]` (6, first Friday on/after Aug 17) |
| Single-day range, matches | `2026-08-14`..`2026-08-14` | sexta | `["2026-08-14"]` (inclusive both ends) |
| Inverted/empty range | `2026-08-15`..`2026-08-14` | sexta | `[]` |

```python
# apollo_cli/routine_job.py — new code, add to the imports:
#   from datetime import UTC, date, datetime, timedelta   (adds date, timedelta)

_DIAS_SEMANA_SUPORTADOS: Final[tuple[str, ...]] = (
    "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo",
)  # index == date.weekday()'s own Monday=0..Sunday=6 convention — zero-cost mapping
_DIA_SEMANA_INDEX: Final[dict[str, int]] = {
    nome: idx for idx, nome in enumerate(_DIAS_SEMANA_SUPORTADOS)
}


def _weekly_occurrences(range_start: str, range_end: str, dia_semana_idx: int) -> list[str]:
    """Every ISO date in [range_start, range_end] (inclusive both ends) whose
    date.weekday() == dia_semana_idx. Pure calendar-day arithmetic only — no
    is_business_day/add_business_days involvement (decision #2, mirrors
    corrido_fixo's calendar-pure precedent)."""
    start = date.fromisoformat(range_start)
    end = date.fromisoformat(range_end)
    lead = (dia_semana_idx - start.weekday()) % 7
    cursor = start + timedelta(days=lead)
    occurrences: list[str] = []
    while cursor <= end:
        occurrences.append(cursor.isoformat())
        cursor += timedelta(days=7)
    return occurrences
```

```typescript
// web/src/lib/routineJob.ts — new local helpers (duplicated, not imported from
// dashboard/derive.ts — mirrors the lastDayOfMonth local-duplication precedent
// Phase 27 already set to avoid a cross-module import: STATE.md Phase 27
// Plan 01 note, "requiring a small locally-duplicated lastDayOfMonth ... to
// avoid a bizdays.ts -> routineJob.ts circular import").

const DIAS_SEMANA_SUPORTADOS = [
  "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo",
] as const;
const DIA_SEMANA_INDEX: Record<string, number> = Object.fromEntries(
  DIAS_SEMANA_SUPORTADOS.map((nome, idx) => [nome, idx]),
);

function parseUtcDateJob(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Sunday=0..Saturday=6 (native getUTCDay()) -> Monday=0..Sunday=6, to match
 * Python's date.weekday() convention exactly — the one parity-critical
 * conversion in this whole feature. */
function mondayIndexedWeekday(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

function weeklyOccurrences(rangeStart: string, rangeEnd: string, diaSemanaIdx: number): string[] {
  const start = parseUtcDateJob(rangeStart);
  const end = parseUtcDateJob(rangeEnd);
  const lead = (diaSemanaIdx - mondayIndexedWeekday(start) + 7) % 7;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + lead);
  const occurrences: string[] = [];
  while (cursor <= end) {
    occurrences.push(formatIso(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return occurrences;
}
```

### Pattern 3: `_compute_semanal_instances` — full per-template compute (sibling of `_compute_fixed_instances`)

```python
def _compute_semanal_instances(
    template: dict[str, Any], range_start: str, range_end: str,
) -> tuple[list[dict[str, Any]], str | None]:
    dia_semana = template.get("diaSemana")
    if dia_semana is None:
        return [], "dia_semana_ausente"
    idx = _DIA_SEMANA_INDEX.get(dia_semana)
    if idx is None:
        return [], "dia_semana_invalido"

    instances: list[dict[str, Any]] = []
    for data_prevista in _weekly_occurrences(range_start, range_end, idx):
        competencia = shift_competencia(data_prevista, template["regraCompetencia"])
        if competencia is None:
            return [], "regra_competencia_nao_suportada"
        instances.append({
            "dedupeKey": build_dedupe_key(template["id"], competencia, data_prevista),
            "templateId": template["id"],
            "competencia": competencia,
            "dataPrevista": data_prevista,
            "tipoPrazo": TIPO_PRAZO_GERADO,
        })
    return instances, None
```

Note: `offsetDias` is never read here (decision #4) — no validation branch is
added for "offsetDias should be absent for semanal"; this mirrors the existing,
already-accepted precedent that `encadeado` similarly never consults its own
`regraCompetencia` (D-05-D) without any CLI/compute-level rejection of a
non-null value being present. Document-only, per CONTEXT.md decision #4.

### Anti-Patterns to Avoid

- **Reusing `Date.getDay()`/`getUTCDay()`'s Sunday=0 convention as the
  canonical weekday index without conversion:** the single most likely
  TS/Python parity bug in this feature. Always convert via `(getUTCDay() + 6) %
  7` before comparing against the Python-native `date.weekday()` index.
- **Iterating day-by-day and checking `weekday() == idx` on every day** instead
  of the closed-form +7-day step: works, but does ~50-60 needless comparisons
  per template for no benefit — the closed form is not meaningfully more
  complex and is the established idiom already in `derive.ts`.
- **Importing `dashboard/derive.ts`'s `semanaUtil`/`parseUtcDate` directly into
  `routineJob.ts`:** wrong dependency direction (dashboard-specific code
  depending into the domain compute core is fine; the reverse — the pure job
  core importing a dashboard-presentation helper — is not, and 27-SUMMARY.md's
  own local-duplication precedent for `lastDayOfMonth` already established that
  small date helpers get duplicated across these modules rather than shared).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Weekday enumeration | A generic RRULE/iCal-style recurrence engine | The 15-line closed-form loop above | This is a single, permanently-fixed recurrence shape ("every occurrence of one weekday in a bounded ~2-month range") — not a general recurrence-rule problem. `python-dateutil`'s `rrule` or an RRULE parser would be genuine over-engineering for a problem this bounded, and neither runtime already depends on such a library. |
| Calendar-day stepping across month/year boundaries | Manual day/month/year carry arithmetic | `datetime.date + timedelta` (Python) / `Date.setUTCDate` (TS, which auto-normalizes via day 0/day-N rollover, same idiom already used by `lastDayOfMonth`'s `Date.UTC(year, month, 0)` trick) | Both are the language's own correct calendar arithmetic — reinventing month-boundary carry logic by hand is exactly the kind of "trivial-looking but easy to get wrong at Dec 31/leap-Feb" problem this project's own `lastDayOfMonth` comment explicitly calls out. |

**Key insight:** this feature is the rare case where the *correct* choice is
NOT to add a library — it fits entirely inside stdlib/native `Date`, and the
project's own `derive.ts::semanaUtil` already proves the idiom works at this
exact scale (a bounded week/range calendar computation) without one.

## Common Pitfalls

### Pitfall 1: Weekday-index convention mismatch between Python and JS
**What goes wrong:** Python's `date.weekday()` is Monday=0..Sunday=6; JS's
native `Date.getUTCDay()`/`getDay()` is Sunday=0..Saturday=6. Using the raw JS
value as if it matched Python's would shift every weekday-name mapping by
implementation-dependent amounts (off by up to 6 days for some names).
**Why it happens:** Both look like "the day of week as a small integer" and
it's easy to assume they're the same convention.
**How to avoid:** Canonicalize on Python's native convention (it needs zero
conversion there) and convert explicitly in TS via `(getUTCDay() + 6) % 7` —
already the exact idiom `derive.ts::semanaUtil` uses (`const mondayOffset =
(dow + 6) % 7;`).
**Warning signs:** A fixture scenario passes in one runtime and fails in the
other with dates exactly N days apart, N being a small integer 1-6.

### Pitfall 2: Local-timezone `Date` parsing shifting the anchor date
**What goes wrong:** Constructing a `Date` from an ISO string without an
explicit UTC anchor (e.g., `new Date("2026-08-14")` in some environments, or
any `getFullYear()`/`getDate()` local accessor) can shift the effective weekday
by a day depending on the host timezone.
**Why it happens:** JS's `Date` constructor has timezone-dependent parsing
quirks for date-only strings in some engines/versions.
**How to avoid:** Always construct via `new Date(\`${iso}T00:00:00.000Z\`)` (the
`parseUtcDate`-idiom already used in `derive.ts`) and read back only via
`getUTC*` accessors — never `get*` (local) accessors. `routineJob.ts`'s own
`todayUtcIsoDate` already carries this exact warning in its docstring.
**Warning signs:** A test passes locally but fails in CI (or vice versa) if the
two environments run in different timezones.

### Pitfall 3: Reusing `offsetDias` (a numeric field) for a string-shaped enum
**What goes wrong:** CONTEXT.md's own tentative Option A recommendation
("mapear `--dia-semana <nome>` para um inteiro internamente e gravá-lo em
`offsetDias`") requires an extra name<->int translation layer purely to fit an
inherently-textual choice into a numeric field, then a second translation layer
back out for display/debugging (`apollo rotina template listar` would show a
bare `6` instead of `"sexta"`).
**Why it happens:** `offsetDias` already exists and "just add a case" feels
lower-friction than a schema change — but every other choice-shaped field in
this schema (`tipoGeracao`, `regraCompetencia`, `status`) is already a plain
string, so this would be the outlier, not the norm.
**How to avoid:** Add `diaSemana: i.string().optional()`, storing the CLI's own
token verbatim (`"sexta"`), matching `tipoGeracao`'s existing storage
convention exactly.
**Warning signs:** A code review comment asking "why is this weekday a raw
integer with no visible mapping table nearby."

### Pitfall 4: Writing `diaSemana` before the schema push lands
**What goes wrong:** `shared/instant.perms.ts` sets `attrs.allow.create:
"false"` `[VERIFIED: shared/instant.perms.ts:32-38, this session]` —
InstantDB clients cannot mint a new attribute at runtime. Any `create_entity`/
`update_entity`/`db.tx...update()` call that includes a `diaSemana` key before
the schema has actually been pushed live will fail server-side.
**Why it happens:** The schema file and the live app are two different sources
of truth until a push happens; it's easy to write code against the local
schema file and forget the push is a separate, required step.
**How to avoid:** Sequence the phase exactly like 05-01-PLAN.md did: Task 1 =
schema change + `bun run instant:push` + `bun run instant:verify` (with the
same grep-based post-push assertions — pre-existing attributes and
`dedupeKey.unique()` survived), landed and verified live BEFORE any CLI/compute
task that reads or writes `diaSemana`.
**Warning signs:** A live CLI test failing with an InstantDB "unknown
attribute" or permission-style error immediately after adding the field to
`create_entity`'s fields dict.

### Pitfall 5: SPA `tipoGeracao`/`diaSemana` select gap (cosmetic, not a crash)
**What goes wrong:** `web/src/lib/entities/defs/templatesRotina.ts` hard-codes
`options: ["du_fixo", "corrido_fixo", "encadeado"]` for `tipoGeracao`
`[VERIFIED: web/src/lib/entities/defs/templatesRotina.ts:41, this session]`. A
`"semanal"` template (created via CLI) opened in the SPA edit form will show
its raw string value in the `Select.Trigger` (`{(formValues[f.name] as string)
|| "selecione..."}` `[VERIFIED: web/src/lib/entities/EntityScreen.svelte:700,
this session]`) but the dropdown's own option list won't contain a matching,
selectable entry.
**Why it happens:** `tipoGeracao`'s SPA options array is a separate, manually
maintained literal, not derived from `_TIPO_GERACAO_CHOICES`.
**How to avoid:** Confirmed NOT a crash (verified by reading the actual
`Select.Root`/`Select.Trigger` rendering code) — worst case is a cosmetic
mismatch that self-heals the moment a user resubmits the form (the untouched
string round-trips unchanged). See Open Questions for whether to close this gap
in this phase.
**Warning signs:** None operationally dangerous; a UAT reviewer opening a
`semanal` template's edit dialog in the SPA would visually notice the dropdown
doesn't highlight a selected option.

## Code Examples

### CLI: `--dia-semana` option (mirrors `--offset-dias`'s existing shape and philosophy)

```python
# cli/apollo_cli/entities/rotina.py
# _TIPO_GERACAO_CHOICES currently (line 62, verified this session):
#   _TIPO_GERACAO_CHOICES = ("du_fixo", "corrido_fixo", "encadeado")
# becomes:
_TIPO_GERACAO_CHOICES = ("du_fixo", "corrido_fixo", "encadeado", "semanal")
_DIA_SEMANA_CHOICES = ("segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo")

# New option added to BOTH `criar` and `editar` (default=None on both,
# never required at the click level — mirrors --offset-dias's own precedent
# and the T-05-13 threat-register rationale: validity per tipoGeracao is the
# job's concern, not the write-time CLI's, to avoid SPA/CLI divergence):
@click.option(
    "--dia-semana",
    type=click.Choice(_DIA_SEMANA_CHOICES),
    default=None,
    help=(
        "Dia da semana ancorando a geracao quando --tipo-geracao=semanal "
        "(ignorado pelos outros tipos). Omitir gera "
        "'dia_semana_ausente' em `skipped` quando o template for do tipo "
        "semanal (JOB-02-style: rejeitado na geracao, nao na escrita)."
    ),
)
```

### Fixture shape: new `dayMath` key + `scenarios` entries (mirrors existing format exactly)

```jsonc
// shared/routine-job.testcases.json — new dayMath key, verified format matches
// nthBusinessDayOfMonth/nthCalendarDayOfMonth's existing sibling entries:
"weeklyOccurrences": [
  {
    "nome": "sexta-feira, range agosto-setembro 2026 (caso real Atualiz Calc RF)",
    "rangeStart": "2026-08-09",
    "rangeEnd": "2026-09-30",
    "diaSemana": "sexta",
    "expected": ["2026-08-14", "2026-08-21", "2026-08-28", "2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25"]
  }
]
```

```jsonc
// shared/routine-job.testcases.json — new scenario, mirrors the existing
// "du_fixo ativo gera duas instancias" scenario's exact shape:
{
  "nome": "semanal (sexta) gera uma instancia por ocorrencia no range, nao uma por mes",
  "today": "2026-08-09",
  "templates": [
    {
      "id": "tpl-sem-a",
      "nome": "Atualiz Calc RF",
      "tipoGeracao": "semanal",
      "regraCompetencia": "M0",
      "diaSemana": "sexta",
      "ativo": true,
      "antecessor": null
    }
  ],
  "existing": [],
  "expectedInstances": [
    { "dedupeKey": "tpl-sem-a:2026-08:2026-08-14", "templateId": "tpl-sem-a", "competencia": "2026-08", "dataPrevista": "2026-08-14", "tipoPrazo": "soft" },
    { "dedupeKey": "tpl-sem-a:2026-08:2026-08-21", "templateId": "tpl-sem-a", "competencia": "2026-08", "dataPrevista": "2026-08-21", "tipoPrazo": "soft" },
    { "dedupeKey": "tpl-sem-a:2026-08:2026-08-28", "templateId": "tpl-sem-a", "competencia": "2026-08", "dataPrevista": "2026-08-28", "tipoPrazo": "soft" },
    { "dedupeKey": "tpl-sem-a:2026-09:2026-09-04", "templateId": "tpl-sem-a", "competencia": "2026-09", "dataPrevista": "2026-09-04", "tipoPrazo": "soft" },
    { "dedupeKey": "tpl-sem-a:2026-09:2026-09-11", "templateId": "tpl-sem-a", "competencia": "2026-09", "dataPrevista": "2026-09-11", "tipoPrazo": "soft" },
    { "dedupeKey": "tpl-sem-a:2026-09:2026-09-18", "templateId": "tpl-sem-a", "competencia": "2026-09", "dataPrevista": "2026-09-18", "tipoPrazo": "soft" },
    { "dedupeKey": "tpl-sem-a:2026-09:2026-09-25", "templateId": "tpl-sem-a", "competencia": "2026-09", "dataPrevista": "2026-09-25", "tipoPrazo": "soft" }
  ],
  "expectedSkipped": []
}
```

Note: `regraCompetencia: "M0"` on a date already inside its own month leaves
`competencia` equal to that date's own `YYYY-MM` for every occurrence above —
verified directly from `shift_competencia`'s existing, unmodified logic (delta
0 for `M0`).

### `SkipReason` additions (both runtimes, mirrored)

```typescript
// web/src/lib/routineJob.ts — SkipReason union, currently lines 134-141
// (verified this session) — add two new literals matching the existing
// offset_dias_ausente/offset_dias_invalido naming pattern exactly:
export type SkipReason =
  | "tipo_geracao_desconhecido"
  | "offset_dias_ausente"
  | "offset_dias_invalido"
  | "regra_competencia_nao_suportada"
  | "antecessor_ausente"
  | "antecessor_sem_instancia"
  | "antecessor_ciclico"
  | "dia_semana_ausente"      // NEW
  | "dia_semana_invalido";    // NEW
```

Python has no equivalent static union (skip reasons are plain `str`), so no
type-level change is needed there — only the two new literal strings used
consistently inside `_compute_semanal_instances`.

## State of the Art

Not applicable — this is a small, internal, additive feature with no
"deprecated vs. current approach" axis. The one relevant precedent
(`offsetDias`'s Phase 5 schema addition) is still the current, unchanged best
practice for this project; nothing about it is outdated.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Portuguese weekday tokens (`segunda`..`domingo`, unaccented, lowercase) are the right CLI/storage vocabulary, matching the existing Portuguese-only vocabulary of `tipoGeracao`/`regraCompetencia` and the codebase's other Portuguese day-name usage (`sabado`/`domingo` already appear this way in `derive.ts`/`derive.test.ts`). | Code Examples, Pattern 3 | Low — this is a naming convention, easily renamed before ship if the user prefers English tokens; CONTEXT.md explicitly left this decision open ("ou os equivalentes em inglês — decisão de nomenclatura fica com o planner/research"). |
| A2 | `diaSemana: i.string().optional()` (not `.number()`) is the right InstantDB attribute type for Option B. | Summary, Pitfall 3 | Low-medium — reversing this later would be a second schema change; verified against the strong existing string-enum convention (`tipoGeracao`/`regraCompetencia`/`status`), but not something InstantDB itself enforces either way. |
| A3 | No conditional-required CLI validation should be added for `--dia-semana`/`--offset-dias` based on `--tipo-geracao` value (i.e., the CLI should stay permissive at write time, same as today). | Code Examples (CLI) | Low — directly mirrors an already-accepted, explicitly-documented precedent (T-05-13 threat register, `05-01-PLAN.md`); reversing it would need a new, separately-justified decision. |

**If this table is empty:** N/A — see rows above; all are low-risk naming/type
choices, not compliance/security/performance decisions.

## Open Questions

1. **Should `web/src/lib/entities/defs/templatesRotina.ts` be updated in this
   phase (extend `tipoGeracao`'s SPA select options to include `"semanal"`, and
   add a `diaSemana` select field), even though CONTEXT.md's escopo bullet does
   not list this file?**
   - What we know: it is NOT a crash risk if skipped (verified by reading the
     actual Svelte render code — the select shows the raw string as plain
     text). No automated coverage gate forces field-level parity (`registry.test.ts`'s
     coverage gate is entity-level, not field-level — grep-confirmed this
     session). Phase 5's 05-01 plan DID add the analogous `offsetDias` field to
     the SPA form in the same phase it added it to the CLI (Task 3), and
     PROJECT.md's core value statement is explicit that "the user can execute
     every piece of controladoria data-entry work from either the Svelte SPA or
     the Python CLI."
   - What's unclear: whether the auto-generated, discuss-skipped CONTEXT.md
     simply didn't consider this file, or deliberately scoped it out (the
     Deferred Ideas section says "Nenhuma — escopo desta fase é só SEM-01,
     fechado," which argues FOR including it as part of SEM-01 rather than
     deferring it, but the explicit escopo bullet's file list argues against).
   - Recommendation: extend `templatesRotina.ts` in this phase, mirroring
     05-01's Task 3 exactly (add `"semanal"` to `tipoGeracao`'s options array,
     add a `diaSemana` field with `kind: "select"` and the same 7 tokens,
     `required: false`, extend `listColumns`), for parity with the project's
     core value and the direct precedent. If the user wants CLI-only for this
     phase, that is an equally defensible, smaller-scope choice — but it should
     be a stated decision, not a silent gap.

2. **English vs. Portuguese weekday tokens for `--dia-semana`'s `click.Choice`
   values.**
   - What we know: CONTEXT.md explicitly defers this naming decision to
     research/planning. The rest of this domain's vocabulary
     (`tipoGeracao`, `regraCompetencia` values, `status` free text) is a mix —
     `tipoGeracao`'s own values (`du_fixo`, `corrido_fixo`, `encadeado`) are
     Portuguese; `regraCompetencia`'s (`M0`, `M-1`, `M-2`, `M+1`) are
     language-neutral shorthand.
   - What's unclear: no single existing precedent settles this decisively
     either way for a full weekday-name vocabulary specifically.
   - Recommendation: Portuguese (`segunda`..`domingo`), matching the domain's
     dominant vocabulary and the already-Portuguese `sabado`/`domingo` tokens
     used in `web/src/lib/dashboard/derive.ts`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Python 3.10+ | `routine_job.py`/`bizdays.py` (stdlib `datetime`) | Yes | 3.10.12 (system); `.venv` targets 3.12 per prior phases | — |
| Node/Bun runtime | `routineJob.ts` (native `Date`), `web/` test suite | Yes | Node v20.20.2, Bun 1.3.12 | — |
| `uv` | CLI test/build commands | Yes | 0.9.21 | — |
| InstantDB schema push (`instant-cli`, `bun run instant:push`/`instant:verify`) | Option B's live schema addition | Package present (`instant-cli` in `web/package.json` devDependencies); actual push requires `.env.instantdb` credentials not inspected here (sandboxed) | `^1.0.63` | If credentials are unavailable at execution time, this task blocks exactly as any live-schema task would (same as 05-01/Phase 27's own live tasks) — no code-only fallback exists for Option B specifically. |

**Missing dependencies with no fallback:** None identified as missing — the
`.env.instantdb` credentials file itself was not directly readable in this
research session (sandbox denies reading it), but its prior use (Phase 5, 24,
25, 27) as a working live-test/push credential source is well-established in
project history; there is no reason to expect it to be absent at plan
execution time.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (CLI) | pytest 9.1.1, markers `live`/`packaging` already registered (`cli/pyproject.toml:47-49`, verified this session) |
| Framework (web) | `bun test` (native Bun test runner), config via `package.json`'s `"test": "bun test src"` |
| Config file | `cli/pyproject.toml` (`[tool.pytest.ini_options]`); no separate web test config file (bun test uses defaults) |
| Quick run command (pure compute only) | `uv run --project cli pytest cli/tests/test_routine_job.py -x -m "not live and not packaging"` / `cd web && bun test src/lib/routineJob.test.ts` |
| Full suite command | `uv run --project cli pytest cli -m "not packaging"` (includes `live`) / `cd web && bun test src` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| SEM-01 | `weeklyOccurrences`/`_weekly_occurrences` produces the correct date set for a given range+weekday | unit (fixture-driven, `dayMath.weeklyOccurrences`) | `uv run --project cli pytest cli/tests/test_routine_job.py -k weekly` / `cd web && bun test src -t weekly` | New `dayMath` fixture cases needed — parametrized test functions (`test_nth_business_day_of_month`-style) already exist as the pattern to copy; ✅ infra exists, ❌ this specific fixture key |
| SEM-01 | `compute_expected_instances`/`computeExpectedInstances` generates one instance per weekly occurrence, correctly `competencia`-shifted | unit (fixture-driven, `scenarios`) | `uv run --project cli pytest cli/tests/test_routine_job.py -k test_scenario` / `cd web && bun test src -t scenario` | ✅ `test_scenario`/its TS twin already iterate `fixture["scenarios"]` generically — new scenario entries are automatically covered, no new test function needed |
| SEM-01 | `apollo rotina template criar/editar --tipo-geracao semanal --dia-semana sexta` persists correctly; omitting `--dia-semana` on a semanal template surfaces `dia_semana_ausente` in `gerar-instancias`' `skipped` | live (real InstantDB) | `uv run --project cli pytest cli/tests/test_crud_rotina_template.py -k semanal` (new test, mirrors 05-01's `--offset-dias` live tests) | ❌ Wave 0 — new live test cases needed, same file/fixtures pattern as existing `--offset-dias` tests |
| SEM-01 | Cross-runtime parity: Python and TS produce byte-identical `weekly_occurrences`/`weeklyOccurrences` output for the same fixture inputs | unit (parity, mirrors `test_routine_job_parity.py`'s existing structure) | `uv run --project cli pytest cli/tests/test_routine_job_parity.py` | ✅ infra exists (fixture-driven); confirm new fixture entries get picked up by whatever generic scenario-iteration this file already performs |

### Sampling Rate

- **Per task commit:** pure-compute quick run (`pytest ... -m "not live and not packaging"` / `bun test src/lib/routineJob.test.ts`).
- **Per wave merge:** full suite including `live` (mirrors every prior phase in this milestone).
- **Phase gate:** Full suite green (CLI + web) before `/gsd-verify-work`, plus a real `bun run instant:push`/`instant:verify` round trip if Option B is adopted (mirrors 05-01's own verification bar).

### Wave 0 Gaps

- [ ] `shared/routine-job.testcases.json` — add `dayMath.weeklyOccurrences` cases and `scenarios` entries for `tipoGeracao: "semanal"` (covers the real "Atualiz Calc RF" sexta-feira case).
- [ ] `cli/tests/test_crud_rotina_template.py` — new live test cases for `--dia-semana` create/edit round trip, mirroring the existing `--offset-dias` tests' structure (`cleanup_records`/`unique_suffix` fixtures already available).
- [ ] Framework install: none — all frameworks already present and configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | Unchanged — no auth surface touched by this phase |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No (unchanged) | `instant.perms.ts`'s `donoRules` already apply uniformly to `templatesRotina` regardless of field count `[VERIFIED: shared/instant.perms.ts:27, this session]` — a new field inherits the same owner-scoped rule automatically, no perms.ts change needed |
| V5 Input Validation | Yes | `click.Choice(_DIA_SEMANA_CHOICES)` at the CLI write boundary (format-level); `_DIA_SEMANA_INDEX.get(...)` returning `None` for an unrecognized/missing token at the compute boundary (business-level) — the same two-layer pattern already used for `tipoGeracao`/`regraCompetencia` |
| V6 Cryptography | No | Not applicable — no crypto surface in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Client attempting to write an attribute the schema doesn't yet have | Tampering (of the data model, not user data) | `instant.perms.ts`'s `attrs.allow.create: "false"` already blocks this server-side — the mitigation already exists and requires no new work, only correct task sequencing (schema push before compute/CLI logic reads/writes the field), per Pitfall 4 |
| A stored `diaSemana` value silently ignored because the reading code checks the wrong tier (e.g., CLI accepts it via `click.Choice` but the compute engine never reads `template.get("diaSemana")`) | Repudiation (a user believes the template is configured; it silently never generates) | Exactly what `dia_semana_ausente`/`dia_semana_invalido` `skipped` reasons exist to surface — never a silent no-op, always a machine-readable entry in `gerar-instancias`' report (same philosophy as every existing skip reason) |

## Sources

### Primary (HIGH confidence — all `[VERIFIED]` via direct file read or live script execution this session)

- `cli/apollo_cli/routine_job.py` (full read) — dispatch structure, line numbers, `_compute_fixed_instances`, `_normalize_template`, existing SkipReason strings
- `web/src/lib/routineJob.ts` (full read) — TS twin, `TemplateRow`/`SkipReason` types, dispatch structure
- `cli/apollo_cli/entities/rotina.py` (full read) — `_TIPO_GERACAO_CHOICES`, existing `--offset-dias` CLI option philosophy (no click-level range validation, T-05-13-style deferral)
- `shared/instant.schema.ts` (full read) — `templatesRotina` current shape, `offsetDias`'s own addition history documented inline
- `shared/instant.perms.ts` (relevant section read) — `attrs.allow.create: "false"`, `donoRules` applying uniformly
- `web/package.json` (full read) — confirmed no date library dependency; confirmed `instant:push`/`instant:verify` scripts exist and their exact invocation
- `web/src/lib/entities/defs/templatesRotina.ts` (full read) — confirmed `tipoGeracao`'s SPA options array and `offsetDias`'s SPA field
- `web/src/lib/entities/EntityScreen.svelte` lines 675-710 (read) — confirmed `Select.Root`/`Select.Trigger` rendering behavior for an out-of-options stored value (no crash)
- `web/src/lib/dashboard/derive.ts` lines 90-131 (read) — `semanaUtil`'s existing pure-calendar weekday idiom, directly informing Pattern 2
- `.planning/milestones/v1.0-phases/05-idempotent-routine-instance-job/05-01-PLAN.md` (full read) — the exact schema-push-then-CLI-then-SPA playbook this phase should mirror for Option B
- `git log`/`git show 81155ed` (executed this session) — proves a schema push already happened once in this project's history, directly refuting CONTEXT.md's premise that Option B would be "the first schema migration since v1.0"
- `cli/tests/test_routine_job.py`, `cli/tests/test_routine_job_parity.py`, `web/src/lib/routineJob.test.ts` (read/grepped) — existing fixture-driven test structure, confirming new scenarios/dayMath keys are auto-covered with no new test-function scaffolding needed
- `web/src/lib/entities/registry.test.ts` (grepped) — confirmed the only automated coverage gate is entity-level, not field-level (no forced SPA parity)
- Direct script execution (`python3`, `node -e`) this session — verified the weekly-occurrence closed-form algorithm produces byte-identical output across both runtimes for four cases including edges

### Secondary (MEDIUM confidence)

None — no web search or external documentation was consulted; this research
required none, as it concerns only this project's own existing code and
standard-library date arithmetic already precedented within it.

### Tertiary (LOW confidence)

None.

**Why no external search tools were used:** `.planning/config.json` has every
external search provider disabled (`brave_search`, `exa_search`,
`tavily_search`, `ref_search`, `perplexity`, `jina`, `firecrawl` all `false`),
and this phase introduces zero new external packages or unfamiliar APIs — every
open question was resolvable, at higher confidence than a web search would
provide, by reading this project's own code and executing verification scripts
directly.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new library needed, confirmed by reading `web/package.json` directly and finding an exact existing precedent (`derive.ts::semanaUtil`) for the same class of problem.
- Architecture (storage field decision): HIGH — reversed CONTEXT.md's own tentative lean using a concrete git-history fact (`git show 81155ed`) plus a schema-wide string-enum convention observed across all three sibling fields.
- Enumeration algorithm: HIGH — cross-runtime output verified identical by direct execution in this session (Python `python3` + Node `node -e`), not by reasoning alone.
- Pitfalls: HIGH — each pitfall is grounded in a specific, cited line of existing code or a specific test-execution result, not general domain knowledge.
- SPA parity gap (Open Question 1): MEDIUM — the technical facts (no crash, no coverage gate) are HIGH confidence; the "should the planner do this" judgment call is inherently a product/scope decision, correctly left open rather than resolved unilaterally.

**Research date:** 2026-08-14
**Valid until:** No natural expiry — this is internal-codebase research, not a fast-moving external dependency; re-verify line numbers only if further phases (29+) touch `routine_job.py`/`routineJob.ts` before this phase executes.
