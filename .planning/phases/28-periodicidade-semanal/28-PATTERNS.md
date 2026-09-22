# Phase 28: Periodicidade semanal - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 7 (6 in CONTEXT.md's escopo + 1 flagged by RESEARCH.md as a real parity gap)
**Analogs found:** 7 / 7 (all resolved to a direct same-repo analog; no "no analog found" files this phase)

Note on storage decision: RESEARCH.md **supersedes** CONTEXT.md's tentative Option-A
lean. The authoritative decision is **Option B** — add a new `diaSemana:
i.string().optional()` field to `templatesRotina` in `shared/instant.schema.ts`,
not reuse `offsetDias`. All patterns below are written against Option B.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `shared/instant.schema.ts` | config/model (schema) | CRUD (schema definition) | Same file, `offsetDias` field addition (Phase 5, commit `81155ed`) | exact — same file, same additive-optional-field shape |
| `cli/apollo_cli/routine_job.py` | service (pure compute) | transform (batch enumeration) | Same file, Phase 27's `du_fixo` dispatch-branch pattern + `_compute_fixed_instances` sibling-function shape | exact — same dispatch idiom, new sibling function |
| `web/src/lib/routineJob.ts` | service (pure compute, TS twin) | transform (batch enumeration) | Same file, TS mirror of the Python dispatch branch; `dashboard/derive.ts::semanaUtil` for the weekday-index idiom | exact for dispatch; role-match for weekday helper (duplicated locally, not imported) |
| `cli/apollo_cli/entities/rotina.py` | route/controller (Click CLI command) | request-response (CLI option -> InstantDB write) | Same file, `--offset-dias` option definition (`criar`/`editar`) | exact — same file, same option-addition shape |
| `web/src/lib/entities/defs/templatesRotina.ts` | config (entity form schema) | CRUD (SPA form field definition) | Same file, `offsetDias` field entry (Phase 5's 05-01 Task 3) | exact — same file, same field-addition shape |
| `web/src/lib/dashboard/derive.ts` | utility (pure date helper) | transform | N/A — this file is the **source pattern**, not a target file. `semanaUtil`'s Monday-indexed weekday conversion is duplicated (not imported) into `routineJob.ts` | source-of-pattern only |
| `shared/routine-job.testcases.json` | test fixture (JSON data) | batch (fixture-driven test cases) | Same file, existing `dayMath.nthCalendarDayOfMonth` array + `scenarios` array shapes | exact — same file, same fixture-key-addition shape |

## Pattern Assignments

### `shared/instant.schema.ts` (config/model, CRUD schema)

**Analog:** Same file, `templatesRotina.offsetDias` addition (Phase 5, commit `81155ed`, documented inline lines 51-59).

**Current state** `[VERIFIED: shared/instant.schema.ts:60-68, this session]`:
```typescript
    templatesRotina: i.entity({
      nome: i.string(),
      tipoGeracao: i.string(),
      regraCompetencia: i.string(),
      propagarAtrasoSoft: i.boolean(),
      ativo: i.boolean(),
      offsetDias: i.number().optional(),
      donoId: i.string().indexed(),
    }),
```

**Pattern to copy:** add `diaSemana: i.string().optional()` as a new line inside
the same `i.entity({...})` block, immediately after `offsetDias`, with an
inline comment block mirroring lines 51-59's style (explain *why* it's
`.optional()` — existing rows lack it and InstantDB cannot backfill a required
attribute onto live rows — and which `tipoGeracao` value it applies to). Use
`i.string()`, never `i.number()` — matches the plain-string convention already
used by `tipoGeracao`/`regraCompetencia`/`status`, per RESEARCH.md Pitfall 3.

**Deployment pattern (mandatory task ordering):** mirror
`.planning/milestones/v1.0-phases/05-idempotent-routine-instance-job/05-01-PLAN.md`'s
Task 1 exactly — schema edit, then `bun run instant:push`, then `bun run
instant:verify` (grep-based post-push assertions that pre-existing attributes
and `dedupeKey.unique()` survived), landed and verified live **before** any
CLI/compute task writes or reads `diaSemana`. `shared/instant.perms.ts`'s
`attrs.allow.create: "false"` blocks client-side attribute minting, so writing
`diaSemana` before the push lands will fail server-side (RESEARCH.md Pitfall 4).

---

### `cli/apollo_cli/routine_job.py` (service, transform/batch)

**Analog:** Same file — Phase 27's `du_fixo`/`corrido_fixo` dispatch branches inside `compute_expected_instances`'s Pass-1 loop, plus `_compute_fixed_instances` as the sibling-function shape to follow (not extend).

**Dispatch insertion point** `[VERIFIED: cli/apollo_cli/routine_job.py:409-431, RESEARCH.md this session, post-Phase-27]` — reconfirm exact line numbers live before editing (RESEARCH.md flags they may have shifted slightly, though no phase has touched this file since):
```python
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

**Pattern to copy:** insert a new `elif tipo_geracao == "semanal":` branch
between the `corrido_fixo` branch and the final `else`, calling a **new sibling
function** `_compute_semanal_instances(template, range_start, range_end)` —
NOT a new `nth_day_fn` passed into `_compute_fixed_instances` (that helper is
structurally month-candidate-based and cannot express "every matching weekday
across the whole range").

**Core enumeration pattern** (new function, add near `_compute_fixed_instances`):
```python
_DIAS_SEMANA_SUPORTADOS: Final[tuple[str, ...]] = (
    "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo",
)
_DIA_SEMANA_INDEX: Final[dict[str, int]] = {
    nome: idx for idx, nome in enumerate(_DIAS_SEMANA_SUPORTADOS)
}


def _weekly_occurrences(range_start: str, range_end: str, dia_semana_idx: int) -> list[str]:
    start = date.fromisoformat(range_start)
    end = date.fromisoformat(range_end)
    lead = (dia_semana_idx - start.weekday()) % 7
    cursor = start + timedelta(days=lead)
    occurrences: list[str] = []
    while cursor <= end:
        occurrences.append(cursor.isoformat())
        cursor += timedelta(days=7)
    return occurrences


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

**Import addition:** extend the existing `from datetime import UTC, ...` import
line to add `date, timedelta`.

**Error handling / skip-reason pattern:** copy the two-branch guard style
already used elsewhere in this file (`return [], "<reason>"` on the first
short-circuiting invalid condition) — two new skip reasons:
`dia_semana_ausente` (field missing) and `dia_semana_invalido` (unrecognized
token), matching the naming convention of `offset_dias_ausente`/
`offset_dias_invalido`.

**Explicitly do NOT add:** any validation that `offsetDias` is absent for
`semanal` templates (CONTEXT.md decision #4 is document-only — mirrors how
`encadeado` never validates its own unused `regraCompetencia`, D-05-D).

---

### `web/src/lib/routineJob.ts` (service, transform/batch, TS twin)

**Analog:** Same file — TS mirror of the Python dispatch branch above; `web/src/lib/dashboard/derive.ts::semanaUtil` (lines 90-131) for the Sunday-to-Monday weekday-index conversion idiom only (duplicate the logic locally, do not import — mirrors Phase 27's `lastDayOfMonth` local-duplication precedent, avoiding a dashboard -> compute-core import direction violation).

**Dispatch insertion point** `[VERIFIED: web/src/lib/routineJob.ts:452-479, RESEARCH.md this session, post-Phase-27]`:
```typescript
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

**Pattern to copy:** insert `else if (template.tipoGeracao === "semanal") {
result = computeSemanalInstances(template, rangeStart, rangeEnd); }` before
the final `else`.

**Core enumeration pattern** (new local helpers, add near existing date helpers):
```typescript
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
 * Python's date.weekday() convention exactly. */
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
`computeSemanalInstances` mirrors `_compute_semanal_instances`'s structure
1:1 (same guard order, same skip-reason strings, `shiftCompetencia` +
`buildDedupeKey` calls).

**Type additions:** add `diaSemana?: string` to the `TemplateRow` type, and
extend the `SkipReason` union `[VERIFIED: web/src/lib/routineJob.ts:134-141,
this session]`:
```typescript
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

**Pitfall to avoid (parity-critical):** never use raw `getUTCDay()`/`getDay()`
as the weekday index — always convert via `(getUTCDay() + 6) % 7` before
comparing to `DIA_SEMANA_INDEX`. Always construct dates via `new
Date(\`${iso}T00:00:00.000Z\`)` and read back only via `getUTC*` accessors,
never local `get*` accessors (existing `parseUtcDate`/`todayUtcIsoDate`
idiom already documents this).

---

### `cli/apollo_cli/entities/rotina.py` (route/controller, request-response)

**Analog:** Same file — `_TIPO_GERACAO_CHOICES` tuple and the `--offset-dias`
`click.Option` definition on both `criar` and `editar` commands.

**Current state** `[VERIFIED: cli/apollo_cli/entities/rotina.py:62, this session]`:
```python
_TIPO_GERACAO_CHOICES = ("du_fixo", "corrido_fixo", "encadeado")
```
becomes:
```python
_TIPO_GERACAO_CHOICES = ("du_fixo", "corrido_fixo", "encadeado", "semanal")
_DIA_SEMANA_CHOICES = ("segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo")
```

**`--offset-dias` option shape to copy** `[VERIFIED: cli/apollo_cli/entities/rotina.py:170-185 (criar), mirrored at ~257-272 (editar), this session]`:
```python
@click.option(
    "--offset-dias",
    type=int,
    default=None,
    help=(
        "Meaning depends on --tipo-geracao (PROJECT.md/05-01-PLAN.md D-05-A): "
        "..."
    ),
)
def criar(
    nome: str,
    tipo_geracao: str,
    regra_competencia: str,
    propagar_atraso_soft: bool,
    ativo: bool,
    fundo_id: str | None,
    antecessor_id: str | None,
    offset_dias: int | None,
) -> None:
```

**Pattern to copy:** add a new `--dia-semana` option to **both** `criar`
(near line 170-185) and `editar` (near line 257-272), same shape as
`--offset-dias`:
```python
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
Add `dia_semana: str | None` to both function signatures, and thread it into
the `create_entity`/`update_entity` fields dict alongside `"offsetDias":
offset_dias` (see line 210 for `criar`, line 301 for `editar`) as `"diaSemana":
dia_semana`.

**Validation philosophy (do NOT deviate):** stay permissive at the CLI/write
level — no conditional-required validation tying `--dia-semana` to
`--tipo-geracao=semanal` at the click level. Validity-per-type is the
compute engine's concern (`dia_semana_ausente`/`dia_semana_invalido` skip
reasons), matching the already-accepted T-05-13 precedent for `--offset-dias`.

---

### `web/src/lib/entities/defs/templatesRotina.ts` (config, CRUD form def)

**Analog:** Same file — `tipoGeracao`'s `options` array and `offsetDias`'s
field entry (Phase 5's 05-01 Task 3 precedent).

**Current state** `[VERIFIED: web/src/lib/entities/defs/templatesRotina.ts:36-48,73, this session]`:
```typescript
    {
      name: "tipoGeracao",
      label: "Tipo de geração",
      required: true,
      kind: "select",
      options: ["du_fixo", "corrido_fixo", "encadeado"],
    },
    {
      name: "offsetDias",
      label: "Offset (dias)",
      required: false,
      kind: "number",
    },
    ...
  listColumns: ["nome", "tipoGeracao", "offsetDias", "ativo", "fundo", "antecessor"],
```

**Pattern to copy** (this file is flagged by RESEARCH.md as a real parity gap
NOT listed in CONTEXT.md's escopo bullet — RESEARCH.md recommends including it
for SPA/CLI parity, mirroring Phase 5's 05-01 Task 3 which did the analogous
thing for `offsetDias` in the same phase; not a crash risk if skipped, see
Open Questions, but is the "do it from either channel" core-value gap):
1. Extend `tipoGeracao`'s `options` array: `["du_fixo", "corrido_fixo",
   "encadeado", "semanal"]`.
2. Add a new field entry after `offsetDias`:
```typescript
    {
      name: "diaSemana",
      label: "Dia da semana",
      required: false,
      kind: "select",
      options: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"],
    },
```
3. Extend `listColumns` to include `"diaSemana"`.

**Not a crash if skipped:** `EntityScreen.svelte` (lines ~675-710) renders an
out-of-options stored string as plain text in `Select.Trigger`, so a
CLI-created `semanal` template opened in the SPA edit form displays correctly
even without this change — but the dropdown won't have a selectable matching
entry until this file is updated.

---

### `shared/routine-job.testcases.json` (test fixture, batch)

**Analog:** Same file — `dayMath.nthCalendarDayOfMonth` array shape (lines
47+) for the new `dayMath.weeklyOccurrences` key, and the existing `scenarios`
array shape (line 145+) for the new "semanal" scenario entry.

**Pattern to copy — new `dayMath` key** (add as sibling of
`nthCalendarDayOfMonth`, same object shape):
```jsonc
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

**Pattern to copy — new `scenarios` entry** (add as sibling entry in the
existing `scenarios` array, mirroring the existing `du_fixo`-scenario shape
exactly):
```jsonc
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
These 7 dates were verified by direct script execution (Python + Node,
byte-identical output) in RESEARCH.md's session — do not recompute by hand,
copy verbatim.

**No new test-function scaffolding needed:** `test_scenario`-style generic
iteration in both `cli/tests/test_routine_job.py` and
`web/src/lib/routineJob.test.ts` already picks up new `scenarios` entries
automatically. Only the `dayMath.weeklyOccurrences`-specific unit test (if
one is added, mirroring `test_nth_business_day_of_month`-style parametrized
tests) needs a new small test function; the scenario coverage does not.

## Shared Patterns

### Dispatch-branch addition inside a fixed try/loop
**Source:** `cli/apollo_cli/routine_job.py:409-431` / `web/src/lib/routineJob.ts:452-479`
**Apply to:** Both `routine_job.py` and `routineJob.ts` — insert the new
`elif`/`else if` branch immediately before the final `else` (unknown-type
fallthrough), never after it.

### Skip-reason naming convention
**Source:** Existing `offset_dias_ausente`/`offset_dias_invalido` (Python) and
the `SkipReason` union (TS, `web/src/lib/routineJob.ts:134-141`)
**Apply to:** `routine_job.py`'s `_compute_semanal_instances` and
`routineJob.ts`'s `computeSemanalInstances` — use `dia_semana_ausente` /
`dia_semana_invalido`, added to the TS `SkipReason` union type but left as
plain strings on the Python side (no static union exists there).

### Write-time permissiveness (validity deferred to compute layer)
**Source:** `--offset-dias`'s existing CLI option (no click-level conditional
requirement tied to `--tipo-geracao`), T-05-13 threat register precedent
**Apply to:** `cli/apollo_cli/entities/rotina.py`'s new `--dia-semana` option
— `default=None` on both `criar`/`editar`, never `required=True`, never a
custom validation callback checking `tipo_geracao`.

### Additive-optional schema field, then live push before use
**Source:** `shared/instant.schema.ts`'s existing `offsetDias` addition
(Phase 5, commit `81155ed`) and `.planning/milestones/v1.0-phases/05-idempotent-routine-instance-job/05-01-PLAN.md`'s Task 1
**Apply to:** `diaSemana` — schema edit + `bun run instant:push` + `bun run
instant:verify`, landed and verified live as its own task, strictly before
any task that writes/reads `diaSemana` via CLI or compute code
(`instant.perms.ts`'s `attrs.allow.create: "false"` will reject early writes).

### Local duplication over cross-module import for small date helpers
**Source:** Phase 27's `lastDayOfMonth` local duplication in `routineJob.ts`
(avoiding a `bizdays.ts` -> `routineJob.ts` import), and the analogous
`semanaUtil` weekday-index idiom in `web/src/lib/dashboard/derive.ts` (lines
90-131)
**Apply to:** `routineJob.ts`'s new `mondayIndexedWeekday`/`weeklyOccurrences`
helpers — duplicate the logic locally inside `routineJob.ts`, do not import
from `dashboard/derive.ts` (wrong dependency direction: the pure compute core
must not depend on dashboard-presentation code).

## No Analog Found

None — every file in scope has a direct, same-repo, same-shape analog
(mostly the same file's own prior additive change from Phase 5 or Phase 27).

## Metadata

**Analog search scope:** `shared/`, `cli/apollo_cli/`, `cli/apollo_cli/entities/`, `web/src/lib/`, `web/src/lib/entities/defs/`, `web/src/lib/dashboard/`, plus RESEARCH.md's own already-verified line-numbered excerpts (reused rather than re-derived, per "no re-reads" rule for ranges already confirmed this session).
**Files scanned:** 7 target files + 2 analog-source files (`shared/instant.schema.ts` history via inline comments, `web/src/lib/dashboard/derive.ts` for the weekday idiom) + RESEARCH.md's cited `05-01-PLAN.md` playbook.
**Pattern extraction date:** 2026-09-22
