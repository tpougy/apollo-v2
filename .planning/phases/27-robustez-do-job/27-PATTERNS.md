# Phase 27: Robustez do job - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 8 (2 pure-core modules + 2 twins, 1 calendar module + 1 twin, 1 entities/CLI file, 2 fixture files)
**Analogs found:** 8 / 8 (all changes are same-file, in-place extensions — the "analog" for each new piece of code is an existing sibling function/site in the SAME file or its cross-runtime twin)

## Live verification result (JOB-03 prerequisite)

**Confirmed by reading code (no live query needed — the shape is unambiguous):**

- Python `_query_active_templates` (`cli/apollo_cli/routine_job.py:497-506`) issues `client.query({"templatesRotina": {"antecessor": {}, "$": {"where": {...}}}})` — **no explicit attribute selection**. InstaQL returns all top-level attributes of a matched entity by default when none are explicitly restricted, so `nome` is already present on every `row` reaching `_normalize_template`. The only missing piece is that `_normalize_template` (lines 515-523) doesn't copy it into the normalized dict it returns.
- TypeScript twin: `web/src/lib/routineJob.ts:584-587` does `db.queryOnce({ templatesRotina: { antecessor: {}, $: { where: {...} } } })` then casts `.data.templatesRotina` straight to `TemplateRow[]` — again no explicit field selection, and no separate "normalize" function exists in TS (the raw row IS the `TemplateRow`). The only gap is the `TemplateRow` interface (`routineJob.ts:72-79`) not declaring a `nome: string` field, so TypeScript's structural typing simply never exposes it to `computeExpectedInstances`, even though it is present on the object at runtime.

**Conclusion: no query change needed in either runtime for JOB-03.** Fix is type/shape-only:
1. Python: add `"nome": row.get("nome")` (or `row["nome"]`, decide required-vs-optional in plan) to `_normalize_template`'s returned dict.
2. TS: add `nome: string` to the `TemplateRow` interface.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `cli/apollo_cli/routine_job.py` (add `_is_concluida`, use at line 398, thread `min_offset_dias` for `du_fixo`, add `nome` to `skipped`/`_normalize_template`) | service (pure compute core) | transform (in-memory diff, no I/O) | itself — `_validate_offset_dias`/`shift_competencia` (same file, lines 151-182) as the style template for a small pure normalization helper | exact (in-file sibling) |
| `web/src/lib/routineJob.ts` (twin: `isConcluida`, `validateOffsetDias` call-site for `du_fixo`, `nome` on `SkippedTemplate`/`TemplateRow`) | service (pure compute core) | transform | itself — `shiftCompetencia`/`validateOffsetDias` (same file, lines 160-212) | exact (in-file sibling) |
| `cli/apollo_cli/bizdays.py` (new `nth_business_day_from_month_end`) | utility (pure date math) | transform | `nth_business_day_of_month` (`routine_job.py:139-142`, NOT `bizdays.py` — see note below) built on `add_business_days` (`bizdays.py:103-123`) | exact (function to be built on the analog's exact technique) |
| `web/src/lib/bizdays.ts` (twin: `nthBusinessDayFromMonthEnd`, if planner decides it belongs here) | utility (pure date math) | transform | `nthBusinessDayOfMonth` (`web/src/lib/routineJob.ts:148-152`, NOT `bizdays.ts`) built on `addBusinessDays` (`bizdays.ts:102-129`) | exact |
| `cli/apollo_cli/entities/rotina.py` (help text edits only, `--offset-dias` on `criar`/`editar`, `instancia status --help`) | route/CLI (click command definitions) | request-response | itself — existing `--offset-dias` help blocks (lines 170-182, 253-266) and `status` docstring (lines 337-353) | exact (in-file sibling, text-only change) |
| `shared/routine-job.testcases.json` | test fixture | batch (data-only) | itself — existing `scenarios` array entries | exact |
| `shared/bizdays.testcases.json` | test fixture | batch (data-only) | itself — existing `dayMath.nthBusinessDayOfMonth` / `nthCalendarDayOfMonth` arrays | exact |

**Important location correction:** `nth_business_day_of_month` and `nth_calendar_day_of_month` do NOT live in `bizdays.py`/`bizdays.ts` — they live in `routine_job.py` (lines 139-148) / `routineJob.ts` (lines 148-158), built on top of the `is_business_day`/`add_business_days` primitives that `bizdays.py`/`.ts` export. CONTEXT.md's line-number note (`bizdays.py:139-142`) is describing `routine_job.py`'s copy, not a real `bizdays.py` line — confirmed by reading `bizdays.py` in full (132 lines total, ends at `next_business_day`). The planner must decide during planning whether `nth_business_day_from_month_end` belongs in `bizdays.py` (a generic calendar utility, sibling to `add_business_days`) or in `routine_job.py` next to its two siblings `nth_business_day_of_month`/`nth_calendar_day_of_month` (consistent with where those already live). Given CONTEXT.md explicitly says "via uma nova função em `bizdays.py`/`bizdays.ts`", the phase intends the former — this actually PROMOTES the "Nth day" family's home, so the planner should note this is a structural move, not a pure addition, and decide whether `nth_business_day_of_month`/`nth_calendar_day_of_month` also move or only the new function goes into `bizdays.py` while its siblings stay in `routine_job.py`.

## Pattern Assignments

### `cli/apollo_cli/routine_job.py` — add `_is_concluida` (JOB-01)

**Analog:** same file, `_validate_offset_dias` (lines 177-182) for "small pure predicate/helper, placed just above its single call site's neighborhood, no I/O, returns primitive/NamedTuple."

**Exact current comparison to replace** (line 398):
```python
estimada = (not record.persisted) or record.status != "concluida"
```

**Suggested helper placement:** immediately above `compute_expected_instances` (before line 266), following the same "small free function, one-line docstring if any" style as `build_dedupe_key` (lines 173-174):
```python
def build_dedupe_key(template_id: str, competencia: str, data_prevista: str) -> str:
    return f"{template_id}:{competencia}:{data_prevista}"
```

**Imports needed:** `unicodedata` (not currently imported anywhere in `routine_job.py` — current import block is lines 64-82: `from __future__ import annotations`, `calendar as pycalendar`, `os`, `collections.abc.Callable`, `datetime.UTC/datetime`, `pathlib.Path`, `typing.Any/Final/NamedTuple`, `httpx`, `instantdb`, `apollo_cli.bizdays`, `apollo_cli.crud_helpers`). Add `import unicodedata` alongside `import calendar as pycalendar` (line 66) to keep stdlib imports grouped together.

**Call site change** (line 398), matching existing style exactly:
```python
estimada = (not record.persisted) or not _is_concluida(record.status)
```

---

### `web/src/lib/routineJob.ts` — add `isConcluida` (JOB-01 twin)

**Analog:** same file, `validateOffsetDias` (lines 201-212).

**Exact current comparison to replace** (line 476):
```typescript
const estimada = !record.persisted || record.status !== "concluida";
```

**Call site change** (line 476), matching existing style:
```typescript
const estimada = !record.persisted || !isConcluida(record.status);
```

**Normalization equivalent in TS** (no `unicodedata` stdlib — must decompose manually): `string.normalize("NFD")` (JS's Unicode Normalization Form D, analogous to Python's NFKD for accent-stripping purposes) + strip combining marks via regex `/[̀-ͯ]/g` + `.trim().toLowerCase()` (JS's case-insensitive equivalent of Python's `.casefold()` — `toLowerCase()` is the closest built-in; `casefold()` has no exact JS equivalent but `toLowerCase()` suffices for the ASCII/Latin script here per CONTEXT.md's own examples `"Concluída"`/`"CONCLUIDA"`/`"concluído "`).

**Placement:** near `shiftCompetencia`/`buildDedupeKey` (lines 160-194), same "small exported-or-local pure function" style.

---

### `cli/apollo_cli/routine_job.py` — extend `du_fixo`'s `min_offset_dias` (JOB-02)

**Analog:** the file's own two existing call sites for `_compute_fixed_instances`, which is EXACTLY the parameter-threading pattern to change — no new pattern needed, just a different argument at one of two already-symmetric call sites.

**Exact current code** (lines 316-324):
```python
        try:
            if tipo_geracao == "du_fixo":
                instances, skip_reason = _compute_fixed_instances(
                    template, today, range_start, range_end, 1, nth_business_day_of_month
                )
            elif tipo_geracao == "corrido_fixo":
                instances, skip_reason = _compute_fixed_instances(
                    template, today, range_start, range_end, 1, nth_calendar_day_of_month
                )
```

Change is ONLY the `1` in the `du_fixo` branch (line 319) — `corrido_fixo`'s `1` (line 323) stays untouched per CONTEXT.md decision 2. `_validate_offset_dias`'s existing signature (`offset_dias: object, min_value: int`, lines 177-182) already supports any integer `min_value`, including a large negative sentinel — no signature change needed, only the call-site argument. `_compute_fixed_instances`'s own signature (`min_offset_dias: int`, line 190) likewise needs no change.

**Date function to build:** `nth_business_day_from_month_end(year, month, n)` needs to be threaded into `_compute_fixed_instances`'s `nth_day_fn` parameter for `du_fixo`, but `_compute_fixed_instances` currently only accepts ONE `nth_day_fn` per call — CONTEXT.md's semantics ("0 = last DU of month; negative = N DU before last; positive presumably keeps today's forward-counting behavior") implies `nth_business_day_of_month` and the new backward-counting function must be dispatched based on the sign of `offsetDias`, likely via a small wrapper function passed as `nth_day_fn` rather than a second call to `_compute_fixed_instances`. Planner should design this dispatch explicitly — it is the one place with no existing analog in the codebase (see "No Analog Found" below).

---

### `cli/apollo_cli/bizdays.py` — new `nth_business_day_from_month_end` (JOB-02)

**Analog:** `add_business_days` itself (lines 103-123) — the function to build on top of, per CONTEXT.md's explicit instruction not to duplicate calendar-navigation logic.

**Exact current code to build on** (lines 103-123):
```python
def add_business_days(value: str, n: int) -> str:
    parsed = _parse_iso_date(value)
    iso = parsed.isoformat()
    _assert_in_range(iso)

    if n == 0:
        return iso

    step = 1 if n > 0 else -1
    remaining = abs(n)
    cursor = parsed

    while remaining > 0:
        cursor = cursor + timedelta(days=step)
        cursor_iso = cursor.isoformat()
        _assert_in_range(cursor_iso)

        if is_business_day(cursor_iso):
            remaining -= 1

    return cursor.isoformat()
```

**Sibling naming/style convention** (from `routine_job.py:139-148`, the two existing "Nth day" functions this new one is named to match):
```python
def nth_business_day_of_month(year: int, month: int, n: int) -> str:
    day1 = _format_iso(year, month, 1)
    first = day1 if is_business_day(day1) else add_business_days(day1, 1)
    return first if n <= 1 else add_business_days(first, n - 1)


def nth_calendar_day_of_month(year: int, month: int, n: int) -> str:
    last_day = _last_day_of_month(year, month)
    clamped_day = min(n, last_day)
    return _format_iso(year, month, clamped_day)
```

`bizdays.py` does NOT have `_format_iso`/`_last_day_of_month` helpers — those live in `routine_job.py` (lines 115-124, using stdlib `calendar` aliased `pycalendar`). If `nth_business_day_from_month_end` moves into `bizdays.py` as CONTEXT.md intends, it must either import `calendar` locally or `routine_job.py`'s helpers must be exposed/imported from `bizdays.py`'s side — but `routine_job.py` currently imports FROM `bizdays.py` (line 76-81), never the reverse, so introducing a `bizdays.py -> routine_job.py` import would be circular. **The planner must decide:** either (a) `nth_business_day_from_month_end` re-implements a minimal last-day-of-month computation locally in `bizdays.py` using stdlib `calendar.monthrange` (cheap, no cross-module dependency), or (b) it lives in `routine_job.py` instead, next to its siblings, despite CONTEXT.md's phrasing. Given `bizdays.py` has zero existing "month" concept (it only knows about single ISO dates and day-stepping), option (a) with a tiny local `calendar.monthrange` call, or (b) keeping it beside its true analog siblings in `routine_job.py`, are both defensible — this is the single open structural decision for planning.

**Suggested implementation sketch (illustrative only, not prescriptive):**
```python
def nth_business_day_from_month_end(year: int, month: int, n: int) -> str:
    """n=0 -> last business day of the month; n<0 -> |n| business days before
    that. Mirrors nth_business_day_of_month's forward-counting shape but
    anchored at the month's last calendar day instead of its first.
    """
    last_day = _last_day_of_month(year, month)  # or local monthrange call
    last_iso = _format_iso(year, month, last_day)
    anchor = last_iso if is_business_day(last_iso) else add_business_days(last_iso, -1)
    return anchor if n == 0 else add_business_days(anchor, n)
```

---

### `web/src/lib/bizdays.ts` — twin `nthBusinessDayFromMonthEnd`

**Analog:** `addBusinessDays` (lines 102-129), same structure/style as the Python twin above.

```typescript
export function addBusinessDays(date: string, n: number): string {
  const { iso, utcMillis } = parseIsoDate(date);
  assertInRange(iso);

  if (n === 0) {
    return iso;
  }

  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  const cursor = new Date(utcMillis);

  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
    const cursorIso = formatIso(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate());
    assertInRange(cursorIso);
    if (isBusinessDay(cursorIso)) {
      remaining -= 1;
    }
  }

  return formatIso(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate());
}
```

Sibling naming convention from `routineJob.ts:148-158`:
```typescript
export function nthBusinessDayOfMonth(year: number, month: number, n: number): string {
  const day1 = formatIso(year, month, 1);
  const first = isBusinessDay(day1) ? day1 : addBusinessDays(day1, 1);
  return n <= 1 ? first : addBusinessDays(first, n - 1);
}
```
Same circular-import caveat as Python applies: `bizdays.ts` has its own local `lastDayOfMonth`/`formatIso` (lines 94-100, 131-133 in `routineJob.ts` — NOT in `bizdays.ts`), so `bizdays.ts` needs its own minimal `Date.UTC(year, month, 0)` idiom locally if the function is placed there, mirroring `routineJob.ts:131-133`:
```typescript
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
```

---

### `cli/apollo_cli/routine_job.py` — `nome` in `skipped` entries and `_normalize_template` (JOB-03)

**Analog:** the file's own 6 existing `skipped.append({...})` call sites — all sharing the exact same two-key literal-dict shape, making this a pure mechanical addition of one key at each site.

**All 6 exact current sites:**
- Line 305: `skipped.append({"templateId": template["id"], "reason": "antecessor_ausente"})`
- Line 311: `skipped.append({"templateId": template["id"], "reason": validation.reason})`
- Lines 326-328: `skipped.append({"templateId": template["id"], "reason": "tipo_geracao_desconhecido"})`
- Line 332: `skipped.append({"templateId": template["id"], "reason": skip_reason})`
- Line 346: `skipped.append({"templateId": template["id"], "reason": "offset_dias_invalido"})`
- Line 376: `skipped.append({"templateId": template["id"], "reason": "antecessor_sem_instancia"})`
- Line 415: `skipped.append({"templateId": template["id"], "reason": "offset_dias_invalido"})`
- Line 424: `skipped.append({"templateId": template["id"], "reason": "antecessor_ciclico"})`

(Note: this is 8 literal sites, not 6 — CONTEXT.md's count of "6 pontos" groups `offset_dias_invalido`/`offset_dias_ausente` together and counts the two `offset_dias_invalido` catch-clause sites, lines 346 and 415, as one conceptual point each; actual `.append()` call count in the file is 8.)

**Pattern for each site:** add `"nome": template["nome"]` (template is already in scope at every site as either `template` or accessible via the loop variable) — e.g. line 305 becomes:
```python
skipped.append({"templateId": template["id"], "nome": template["nome"], "reason": "antecessor_ausente"})
```

**`_normalize_template` change** (exact current code, lines 515-523):
```python
def _normalize_template(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "tipoGeracao": row.get("tipoGeracao"),
        "regraCompetencia": row.get("regraCompetencia"),
        "offsetDias": row.get("offsetDias"),
        "ativo": row.get("ativo"),
        "antecessor": _normalize_antecessor(row.get("antecessor")),
    }
```
Add one line: `"nome": row.get("nome"),` — following the existing `.get()`-with-default-None convention used for every other optional-ish field here (only `id` uses direct `[...]` indexing, since it's guaranteed present).

---

### `web/src/lib/routineJob.ts` — `nome` on `SkippedTemplate`/`TemplateRow` (JOB-03 twin)

**Analog:** `TemplateRow` interface (lines 72-79) and `SkippedTemplate` interface (lines 107-110), plus the 8 `skipped.push({...})` call sites (grep-confirmed at lines 366, 373, 401, 406, 419, 452, 491, 503).

**Exact interfaces to extend:**
```typescript
export interface TemplateRow {
  id: string;
  tipoGeracao: string;
  regraCompetencia: string;
  offsetDias?: number | null;
  ativo?: boolean;
  antecessor?: { id: string } | null; // templateAntecessor self-link, used by 05-04
}
```
Add `nome: string;`.

```typescript
export interface SkippedTemplate {
  templateId: string;
  reason: SkipReason;
}
```
Add `nome: string;`.

**Each `skipped.push` site** needs `nome: template.nome` added — e.g. line 366:
```typescript
skipped.push({ templateId: template.id, reason: "antecessor_ausente" });
```
becomes:
```typescript
skipped.push({ templateId: template.id, nome: template.nome, reason: "antecessor_ausente" });
```

---

### `cli/apollo_cli/entities/rotina.py` — help text updates (JOB-02/JOB-01 docs)

**Analog:** the file's own existing help strings for the same flags — text-only edit, same tuple-of-strings-joined style already used throughout.

**`criar`'s `--offset-dias` help** (exact current, lines 170-182):
```python
@click.option(
    "--offset-dias",
    type=int,
    default=None,
    help=(
        "Meaning depends on --tipo-geracao (PROJECT.md/05-01-PLAN.md D-05-A): "
        "'du_fixo' = Nth BUSINESS day of the month (integer >= 1); "
        "'corrido_fixo' = Nth CALENDAR day of the month, clamped to the "
        "month's last day (integer >= 1); 'encadeado' = number of BUSINESS "
        "days after the antecessor instance's dataPrevista (integer >= 0, "
        "D-05-B). Omit to leave the field unset entirely (never writes 0)."
    ),
)
```
The `du_fixo` clause (`"'du_fixo' = Nth BUSINESS day of the month (integer >= 1); "`) needs updating to document `<= 0` semantics per CONTEXT.md decision 2 ("0 = último dia útil do mês; negativo = N dias úteis antes do último").

**`editar`'s twin** (exact current, lines 253-266) has the identical `du_fixo` clause needing the same edit.

**`instancia status --help`** (exact current docstring, lines 340-351):
```python
def status(eid: str, status: str) -> None:
    """Update ONLY the `status` field of an existing routine instance.

    Deliberately narrow: this command must never grow a `--data-prevista` or
    `--competencia` flag. Either would desynchronize the record from its
    `dedupeKey` (the plain `templateId:competencia:dataPrevista`
    concatenation — deliberately not a hash, see `apollo_cli.routine_job`'s
    module docstring), and the next generation job run would then create a
    duplicate alongside it —
    breaking the one idempotency guarantee this system promises (PROJECT.md
    C-06).
    """
```
Add a sentence documenting that spellings of "concluída" equivalent under case/accent-folding (per JOB-01's `_is_concluida`) are recognized by `encadeado` successor generation — this is a docstring addition, not a `--help=` kwarg change (the `status` command has no explicit `help=` on the command itself; its docstring IS the Click help text, confirmed by the pattern used consistently for all `def <command>(...): """...""" ` blocks in this file, e.g. `criar`/`editar` above).

---

### `shared/routine-job.testcases.json` — new fixture cases

**Analog:** existing `scenarios` array shape (top-level keys: `dayMath`, `scenarios`).

**Exact shape to follow** (one real existing scenario):
```json
{
  "nome": "du_fixo ativo gera duas instancias (mes atual + proximo mes)",
  "today": "2026-08-09",
  "templates": [
    {
      "id": "tpl-a",
      "tipoGeracao": "du_fixo",
      "regraCompetencia": "M0",
      "offsetDias": 6,
      "ativo": true,
      "antecessor": null
    }
  ],
  "existing": [],
  "expectedInstances": [
    { "dedupeKey": "tpl-a:2026-08:2026-08-10", "templateId": "tpl-a", "competencia": "2026-08", "dataPrevista": "2026-08-10", "tipoPrazo": "soft" },
    { "dedupeKey": "tpl-a:2026-09:2026-09-09", "templateId": "tpl-a", "competencia": "2026-09", "dataPrevista": "2026-09-09", "tipoPrazo": "soft" }
  ],
  "expectedSkipped": []
}
```
New cases for JOB-01 (normalized-status) need `existing` rows with varied-casing/accented `status` values (e.g. `"CONCLUIDA"`, `"Concluída"`, `"concluído "`) feeding an `encadeado` template, asserting `dataPrevistaEstimada` is correctly omitted/included in `expectedInstances`. New cases for JOB-02 (negative offset) need `du_fixo` templates with `offsetDias: 0` and `offsetDias: -2`, asserting the correct `dataPrevista` in `expectedInstances`. All new `expectedSkipped` entries in any updated/new scenario must add `"nome"` per JOB-03 (existing scenarios' `expectedSkipped` arrays will also need a `nome` key added wherever they currently assert `{"templateId": ..., "reason": ...}` exactly).

---

### `shared/bizdays.testcases.json` — new fixture cases (if `nth_business_day_from_month_end` gets its own entries)

**Analog:** `dayMath.nthBusinessDayOfMonth` array shape (in `shared/routine-job.testcases.json`, NOT `bizdays.testcases.json` — see structural note above; if the planner keeps the new function in `routine_job.py`, its fixture stays in `routine-job.testcases.json`'s `dayMath` section instead of a new `bizdays.testcases.json` section).

**Exact shape to follow:**
```json
{
  "nome": "1o do mes cai em sabado (2026-08-01=Sab); dia1 nao util -> avanca para 2026-08-03 (seg); n=1",
  "year": 2026,
  "month": 8,
  "n": 1,
  "expected": "2026-08-03"
}
```
New sibling array (`nthBusinessDayFromMonthEnd`, matching naming convention) needs cases for: `n=0` on a month ending on a business day, `n=0` on a month ending on a weekend/holiday (must roll backward), and `n<0` crossing a mid-month holiday.

## Shared Patterns

### Pure-core / I/O-boundary separation
**Source:** `cli/apollo_cli/routine_job.py:432-438` (the `--- I/O boundary ---` comment) / no direct TS equivalent comment but the same file-halves structure exists in `routineJob.ts`.
**Apply to:** All edits in `routine_job.py`/`routineJob.ts` MUST stay above the I/O boundary — `_is_concluida`/`isConcluida`, the `du_fixo` min-offset change, and the `skipped`/`nome` additions inside `compute_expected_instances`/`computeExpectedInstances` are all pure-core changes. Only `_normalize_template`/`TemplateRow` (interface, not a function, in TS) sit just below/adjacent to the boundary and touch the query-result shape — but per the live-verification section above, no actual query string changes.

### Cross-runtime parity via shared fixtures
**Source:** `shared/routine-job.testcases.json`, `shared/bizdays.testcases.json`.
**Apply to:** Every behavioral change in this phase (JOB-01, JOB-02) needs new fixture cases proving Python and TS agree; JOB-03's shape change requires updating every existing fixture scenario's `expectedSkipped` entries to include `nome`, or the existing cross-runtime test harness will fail on the first re-run after the interface change.

### Docstring conventions
**Source:** `routine_job.py`'s module docstring (lines 1-62) — decisions are recorded inline with a `D-05-X` label scheme (`D-05-A` through `D-05-F`). JOB-01/02/03 do not yet have `D-XX` labels of their own; the planner may choose to introduce `D-27-A`/`D-27-B`/`D-27-C` labels in the module docstring for the new `_is_concluida` normalization, the `du_fixo <= 0` semantics, and the `nome`-in-skipped addition, following this established documentation convention exactly (the file's docstring already forward-references future decisions this way).

## No Analog Found

| File/Change | Role | Data Flow | Reason |
|---|---|---|---|
| `_compute_fixed_instances`'s dispatch between `nth_business_day_of_month` (offset >= 1) and `nth_business_day_from_month_end` (offset <= 0) for the SAME `du_fixo` branch | control-flow / dispatch | transform | No existing sign-based dispatch pattern exists anywhere in `routine_job.py`/`routineJob.ts` — every existing `tipoGeracao` branch calls exactly one `nth_day_fn` unconditionally. The planner must design this small piece of new logic (likely a local closure/wrapper passed as `nth_day_fn`, or an inline `if offset_dias <= 0` branch before calling `_compute_fixed_instances`) since RESEARCH.md was skipped and no prior sign-based branching example exists to copy. |
| Placement of `nth_business_day_from_month_end` (`bizdays.py` vs. `routine_job.py`) | utility | transform | Structural decision with no existing precedent either way — see the "Important location correction" note above; this is a planning-time decision, not something to infer from an analog. |

## Metadata

**Analog search scope:** `cli/apollo_cli/routine_job.py`, `cli/apollo_cli/bizdays.py`, `cli/apollo_cli/entities/rotina.py`, `web/src/lib/routineJob.ts`, `web/src/lib/bizdays.ts`, `shared/routine-job.testcases.json`, `shared/bizdays.testcases.json`. No RESEARCH.md existed (research skipped for this phase); all analogs derived directly from the current codebase per CONTEXT.md's own line-number pointers (re-verified live, with one correction noted: `nth_business_day_of_month`/`nth_calendar_day_of_month` live in `routine_job.py`, not `bizdays.py`).
**Files scanned:** 7 source files read in full or via targeted grep+read; 2 fixture JSON files inspected via `python3 -m json.tool`/`json.load` for shape.
**Pattern extraction date:** 2026-08-14
