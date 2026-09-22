# Phase 29: Controle de geração - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 5 (2 modified core, 1 modified CLI entity, 1 modified shared fixture, 2 modified test files)
**Analogs found:** 5 / 5 (all in-repo, no external pattern needed)

This phase's "new" file is really a **new pure function inserted into an existing
module** (`months_in_range`/`monthsInRange`) plus **modified functions** in three
already-tracked files. There are no brand-new files to create — every target is an
edit. Analogs below are all drawn from the same modules, using the most recent
precedent (Phase 28's `weekly_occurrences`/`weeklyOccurrences`) as the template for
"how a new pure date-math helper gets added to this codebase."

## File Classification

| Target File (modified) | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `cli/apollo_cli/routine_job.py` (new `months_in_range`, `compute_expected_instances` range param, `_compute_fixed_instances` candidate_months swap) | utility (pure date-math + orchestration) | transform | `cli/apollo_cli/routine_job.py:315-331` (`weekly_occurrences`, Phase 28) | exact — same file, same module, same author-era pattern |
| `web/src/lib/routineJob.ts` (new `monthsInRange`, `computeExpectedInstances` range param, `computeFixedInstances` candidate-month swap) | utility (pure date-math + orchestration) | transform | `web/src/lib/routineJob.ts:379-397` area (`weeklyOccurrences`, Phase 28 TS twin) | exact — same file, byte-parity twin of the Python analog |
| `cli/apollo_cli/entities/rotina.py` (`gerar-instancias`: add `--competencia`, `--de`, `--ate`) | route/CLI command | request-response | `cli/apollo_cli/entities/rotina.py:399-441` (`gerar_instancias` itself, plus `--data-base`'s `validate_iso_date` callback) for the date-flag mechanics; `cli/apollo_cli/entities/subtarefa.py:46-65` (`_resolve_parent`) for the mutual-exclusion validation shape | role-match (mutex validation) / exact (date-flag callback) |
| `shared/routine-job.testcases.json` (new `dayMath.monthsInRange` array) | test fixture | batch | `shared/routine-job.testcases.json:144-180` (`dayMath.weeklyOccurrences`, Phase 28) | exact — same fixture file, same top-level `dayMath` key, same array-of-cases shape |
| `cli/tests/test_routine_job.py` / `web/src/lib/routineJob.test.ts` (new fixture-consuming test for `monthsInRange`) | test | batch | `cli/tests/test_routine_job.py:72-79` / `web/src/lib/routineJob.test.ts:113-119` (`weeklyOccurrences` fixture-parity test) | exact |

## Pattern Assignments

### 1. New pure date-math helper: `months_in_range` / `monthsInRange`

**Analog:** `cli/apollo_cli/routine_job.py:315-331` (`weekly_occurrences`) and its TS
twin `web/src/lib/routineJob.ts` (`weeklyOccurrences`, same file, ~lines 379-397).

Both are the most recent precedent (Phase 28) for "add a new **public** (no leading
underscore), pure, fixture-tested date-math function directly above/near the private
`_compute_*_instances` function(s) that will call it."

**Python placement + docstring convention** (`routine_job.py:315-322`):
```python
def weekly_occurrences(range_start: str, range_end: str, dia_semana_idx: int) -> list[str]:
    """Every ISO date in `[range_start, range_end]` (inclusive both ends)
    whose `date.weekday() == dia_semana_idx`. Pure calendar-day arithmetic
    only — never calls `is_business_day`/`add_business_days` (SEM-01,
    mirrors `corrido_fixo`'s calendar-pure precedent). Public (no leading
    underscore): this is the pure date-math primitive, directly
    fixture-tested like `nth_business_day_of_month`/`nth_calendar_day_of_month`.
    """
```
Follow this exact convention for `months_in_range`: public, one-line-first docstring
explaining semantics, note on why it's public (directly fixture-tested), placed near
`end_of_next_month` (`routine_job.py:185-194`) since it's the sibling generalization
of that function's "which months matter" concern — or directly above
`_compute_fixed_instances` (`routine_job.py:243`) since that's its sole caller.

**Body to replace** — the inline block being generalized
(`routine_job.py:262-268`, currently inside `_compute_fixed_instances`):
```python
    today_year_str, today_month_str = today.split("-")[:2]
    today_year = int(today_year_str)
    today_month = int(today_month_str)
    next_month = 1 if today_month == 12 else today_month + 1
    next_month_year = today_year + 1 if today_month == 12 else today_year

    candidate_months = [(today_year, today_month), (next_month_year, next_month)]
```
becomes a call `candidate_months = months_in_range(range_start, range_end)`. The
`year, month` extraction idiom (`.split("-")[:2]`, `int(...)`) and the
December-rollover ternary (`next_month = 1 if month == 12 else month + 1`) already
appear twice in this file (`end_of_next_month:186-191`, and the block above) — reuse
that exact idiom inside `months_in_range`'s loop that walks from `range_start`'s
month to `range_end`'s month.

**TS twin — body being replaced** (`web/src/lib/routineJob.ts:303-312`):
```typescript
  const [todayYearStr, todayMonthStr] = today.split("-");
  const todayYear = Number(todayYearStr);
  const todayMonth = Number(todayMonthStr);
  const nextMonth = todayMonth === 12 ? 1 : todayMonth + 1;
  const nextMonthYear = todayMonth === 12 ? todayYear + 1 : todayYear;

  const candidateMonths: Array<[number, number]> = [
    [todayYear, todayMonth],
    [nextMonthYear, nextMonth],
  ];
```
`monthsInRange` should return `Array<[number, number]>` (matching the existing local
type annotation already used here) and be `export`ed the same way `weeklyOccurrences`
is (`web/src/lib/routineJob.ts:379`, `export function weeklyOccurrences(...)`),
placed near `endOfNextMonth` (`routineJob.ts:197-208`) for the same "sibling of the
default-range logic" reason as the Python side.

**Removing `today` from `_compute_fixed_instances`/`computeFixedInstances`:** per
CONTEXT decision 2, confirm both call sites still compile without it —
`routine_job.py:499` (`du_fixo`) and `:508-509` (`corrido_fixo`); TS twin call sites
at `routineJob.ts:581` and `:590`. Both currently pass `template, today, range_start,
range_end, ...` — the `today` positional arg is dropped from all four call sites in
lockstep with the signature change.

### 2. `compute_expected_instances`/`computeExpectedInstances` range override param

**Analog:** the function's own existing two lines being replaced.

Python (`routine_job.py:435-441`):
```python
def compute_expected_instances(
    templates: list[dict[str, Any]],
    today: str,
    existing: list[dict[str, Any]],
) -> ComputeResult:
    range_start = today
    range_end = end_of_next_month(today)
```
becomes (per CONTEXT decision 1 + the suggested param name in `<specifics>`):
```python
def compute_expected_instances(
    templates: list[dict[str, Any]],
    today: str,
    existing: list[dict[str, Any]],
    range_override: tuple[str, str] | None = None,
) -> ComputeResult:
    if range_override is not None:
        range_start, range_end = range_override
    else:
        range_start = today
        range_end = end_of_next_month(today)
```

TS (`routineJob.ts:513-519`):
```typescript
export function computeExpectedInstances(
  templates: readonly TemplateRow[],
  today: string,
  existing: readonly ExistingInstance[],
): ComputeResult {
  const rangeStart = today;
  const rangeEnd = endOfNextMonth(today);
```
becomes the `rangeOverride?: [string, string]` twin, same if/else shape. Everything
downstream in both functions (the `du_fixo`/`corrido_fixo`/`semanal`/`encadeado`
branches at `routine_job.py:497-514` / `routineJob.ts:581-590` and beyond) already
consumes `range_start`/`range_end` as local variables — **no other line in the
~150-line function body changes**, confirming CONTEXT's claim that this is a
narrowly-scoped edit.

### 3. CLI flag pair with mutual-exclusion validation: `--competencia` / `--de`+`--ate`

**Analog A (date-format callback reuse):** `cli/apollo_cli/entities/rotina.py:399-408`
```python
@group.command(name="gerar-instancias")
@click.option(
    "--data-base",
    default=None,
    callback=validate_iso_date,
    help=(
        "Data base (YYYY-MM-DD) usada como 'hoje' para o range de geracao "
        "[data-base, fim do proximo mes]. Omitir usa a data UTC atual."
    ),
)
```
`--de`/`--ate` reuse this exact `callback=validate_iso_date` (imported already —
confirm the import line near the top of `rotina.py`; `validate_iso_date` is defined
at `cli/apollo_cli/crud_helpers.py:62-74` and raises `click.BadParameter` on bad
format, which Click turns into exit code 2 automatically — no new exit-code plumbing
needed).

**Analog B (new callback for `--competencia`'s `YYYY-MM` format):** `crud_helpers.py`
gives the exact shape to mirror for a sibling callback (`crud_helpers.py:62-74`):
```python
_ISO_DATE_RE: Final[re.Pattern[str]] = re.compile(r"^\d{4}-\d{2}-\d{2}$")

def validate_iso_date(ctx: click.Context, param: click.Parameter, value: str | None) -> str | None:
    """Click callback: enforce `YYYY-MM-DD` and reject invalid calendar dates."""
    if value is None:
        return None
    if not _ISO_DATE_RE.match(value):
        msg = f"{value!r} is not an ISO date (expected YYYY-MM-DD)"
        raise click.BadParameter(msg, ctx=ctx, param=param)
    try:
        date.fromisoformat(value)
    except ValueError as error:
        msg = f"{value!r} is not a valid calendar date"
        raise click.BadParameter(msg, ctx=ctx, param=param) from error
    return value
```
Per CONTEXT decision 5, the new `validate_competencia_format`-style callback for
`--competencia` uses a regex (`^\d{4}-\d{2}$`) plus a manual `1 <= month <= 12` check
instead of `date.fromisoformat` (which requires a day component this flag doesn't
have). Place it next to `validate_iso_date` in `crud_helpers.py` (same module,
same "shared plumbing" home per that file's own docstring at lines 1-8) so `rotina.py`
imports it the same way it already imports `validate_iso_date`.

**Analog C (mutual-exclusion validation, exit 2, no network call before validation):**
`cli/apollo_cli/entities/subtarefa.py:46-65` (`_resolve_parent`):
```python
def _resolve_parent(
    tarefa_id: str | None, ticket_id: str | None, *, required: bool
) -> dict[str, str]:
    """Validate and resolve the XOR parent link payload.
    ...
    Raises `click.UsageError` before any network call when the count is
    wrong. ...
    """
    given = [value for value in (tarefa_id, ticket_id) if value is not None]
    if required and len(given) != 1:
        msg = "informe exatamente um de --tarefa-id ou --ticket-id"
        raise click.UsageError(msg)
    if not required and len(given) > 1:
        msg = "informe no máximo um de --tarefa-id ou --ticket-id"
        raise click.UsageError(msg)
```
This is the strongest precedent in the codebase for "reject an invalid flag
combination with `click.UsageError` before any client/network call" — `click.UsageError`
exits 2 by default, matching CONTEXT decision 4's "exit 2, nenhuma consulta/escrita
executada" requirement exactly. Write an analogous small helper (or inline
validation at the top of `gerar_instancias`, before `client_for_session()` is called)
that:
1. Rejects `--competencia` combined with either `--de` or `--ate` (`click.UsageError`).
2. Rejects `--de` XOR `--ate` (exactly one given) (`click.UsageError`).
3. Rejects `--de > --ate` (`click.UsageError`, per CONTEXT decision 5).
4. Resolves `--competencia AAAA-MM` into `(first_of_month, last_of_month)` — this can
   reuse `_last_day_of_month`/`_format_iso` already private in `routine_job.py:181-182`
   if that resolution logic lives there, or a small inline computation in `rotina.py`
   if kept CLI-local; planner should decide during planning which module owns it,
   but it must NOT duplicate `_last_day_of_month`.

**Command signature + docstring to extend** (`rotina.py:399-441`, full command):
```python
@group.command(name="gerar-instancias")
@click.option(
    "--data-base",
    default=None,
    callback=validate_iso_date,
    help=(...),
)
@click.option(
    "--dry-run/--no-dry-run",
    default=False,
    help=(...),
)
def gerar_instancias(data_base: str | None, dry_run: bool) -> None:
    """... Emite exatamente um documento JSON ..."""
    client, session = client_for_session()
    today = data_base or today_utc_iso_date()
    report = run_routine_instance_job(client, session.user_id, today, dry_run=dry_run)
    emit(report)
```
New `--competencia`/`--de`/`--ate` options are added as siblings of `--data-base`
(same `@click.option` decorator style, same `default=None`), the mutex/pairing
validation runs first (before `client_for_session()`, matching Analog C's "before any
network call" property), then the resolved `(range_start, range_end)` tuple (or
`None`) is threaded through to `run_routine_instance_job` -> `compute_expected_instances`
as the new `range_override` param. Per CONTEXT decision 4, `--help` text for
`--competencia` must explicitly document the "operates on dataPrevista range, not the
resulting competencia field" nuance — model this on the existing verbose `--data-base`
help string's own precedent of explaining the exact semantics, not just the format.

### 4. Shared fixture extension: `dayMath.monthsInRange`

**Analog:** `shared/routine-job.testcases.json:144-180` (`dayMath.weeklyOccurrences`,
Phase 28's newest `dayMath` entry — same top-level shape to copy).

```json
    "weeklyOccurrences": [
      {
        "nome": "sexta-feira, range agosto-setembro 2026 (caso real Atualiz Calc RF)",
        "rangeStart": "2026-08-09",
        "rangeEnd": "2026-09-30",
        "diaSemana": "sexta",
        "expected": ["2026-08-14", "2026-08-21", "2026-08-28", "2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25"]
      },
      ...
      {
        "nome": "range invertido (rangeStart > rangeEnd) nunca gera ocorrencias",
        "rangeStart": "2026-09-30",
        "rangeEnd": "2026-08-09",
        "diaSemana": "sexta",
        "expected": []
      },
```
New `monthsInRange` entry goes as a sibling key inside `dayMath` (after
`weeklyOccurrences`, before the top-level `scenarios` array starts at line 182), same
`{"nome": ..., <inputs>, "expected": [...]}` per-case shape. Given CONTEXT decision 2's
compatibility proof requirement, include at minimum:
- A same-month case (`rangeStart`/`rangeEnd` both within one calendar month) ->
  single-tuple `expected`.
- A cross-year-boundary case (mirroring `endOfNextMonth`'s December-rollover fixture
  at lines 78-82) -> `expected` spans two years.
- The exact default-equivalence case from decision 2:
  `range_start=today`, `range_end=end_of_next_month(today)` -> `expected` is exactly
  `[[today_year, today_month], [next_month_year, next_month]]`, proving the
  generalization is behavior-preserving.
- An inverted-range case (`rangeStart > rangeEnd`) mirroring `weeklyOccurrences`'s own
  inverted-range fixture (line 167-172) -> `expected: []`.

### 5. Fixture-consuming test for `monthsInRange`

**Analog (Python):** `cli/tests/test_routine_job.py:72-79`
```python
@pytest.mark.parametrize("case", FIXTURE["dayMath"]["weeklyOccurrences"], ids=lambda c: c["nome"])
def test_weekly_occurrences(case: dict[str, Any]) -> None:
    assert (
        weekly_occurrences(
            case["rangeStart"], case["rangeEnd"], _DIA_SEMANA_INDEX[case["diaSemana"]]
        )
        == case["expected"]
    )
```
New `test_months_in_range` follows the same `@pytest.mark.parametrize(... ids=lambda
c: c["nome"])` shape, importing `months_in_range` alongside the existing imports at
`cli/tests/test_routine_job.py:25-37` (which already import `weekly_occurrences`,
`end_of_next_month`, etc. from `apollo_cli.routine_job` — add `months_in_range` to
that same import block, alphabetically ordered per the existing list).

**Analog (TS):** `web/src/lib/routineJob.test.ts:113-119`
```typescript
  describe("weeklyOccurrences", () => {
    for (const c of dayMath.weeklyOccurrences) {
      it(c.nome, () => {
        expect(weeklyOccurrences(c.rangeStart, c.rangeEnd, DIA_SEMANA_INDEX[c.diaSemana])).toEqual(
          c.expected,
        );
      });
    }
  });
```
`monthsInRange` needs the same `describe`/`for...of`/`it(c.nome, ...)` block, plus its
type added to the `dayMath` cast at `web/src/lib/routineJob.test.ts:71-76` and
`monthsInRange` added to the import block at line 15 (both already list
`weeklyOccurrences` as the most recent addition — insert alongside it).

## Shared Patterns

### Pure date-math helper placement/visibility
**Source:** `cli/apollo_cli/routine_job.py:315-322` / `web/src/lib/routineJob.ts:379-397`
(`weekly_occurrences`/`weeklyOccurrences`)
**Apply to:** `months_in_range`/`monthsInRange`
- Public (no leading underscore in Python; `export` in TS) — the fixture tests need
  direct access, matching `nth_business_day_of_month`/`nth_calendar_day_of_month`/
  `end_of_next_month`'s existing public status.
- One-paragraph docstring/JSDoc explaining exact inclusive/exclusive boundary
  semantics and any non-obvious invariant (compatibility with the old inline logic,
  per CONTEXT decision 2).

### CLI mutual-exclusion validation
**Source:** `cli/apollo_cli/entities/subtarefa.py:46-65` (`_resolve_parent`)
**Apply to:** `gerar_instancias`'s new `--competencia`/`--de`/`--ate` validation
- `click.UsageError(msg)` for any invalid combination — exits 2, no network/db call
  happens first (validation runs before `client_for_session()`).
- Portuguese error messages in the same terse imperative style
  (`"informe exatamente um de --tarefa-id ou --ticket-id"`).

### Date-format Click callback
**Source:** `cli/apollo_cli/crud_helpers.py:32,62-74` (`_ISO_DATE_RE`, `validate_iso_date`)
**Apply to:** `--de`/`--ate` (reuse verbatim, `callback=validate_iso_date`) and
`--competencia` (new sibling callback, same file, same `click.BadParameter` +
`ctx`/`param` signature, module-level compiled regex `Final[re.Pattern[str]]`).

### Shared fixture / cross-runtime parity test
**Source:** `shared/routine-job.testcases.json` `dayMath` key +
`cli/tests/test_routine_job.py:48-79` + `web/src/lib/routineJob.test.ts:80-120`
**Apply to:** `monthsInRange` fixture cases and their two test-file consumers.
Both test files already load the fixture once at module scope
(`FIXTURE = json.loads(...)` in Python at line 42; a `fixture` import/parse near the
top of the TS test file) — no new fixture-loading plumbing needed, only a new
`dayMath.monthsInRange` key and two new `@pytest.mark.parametrize`/`describe` blocks.

## No Analog Found

None — every target file/function in this phase's scope has a strong, recent,
same-module analog (all inherited from Phase 28's `weekly_occurrences` work, which
established the exact template for "add a new pure date-math primitive to this
codebase").

## Metadata

**Analog search scope:** `cli/apollo_cli/routine_job.py`, `cli/apollo_cli/entities/rotina.py`,
`cli/apollo_cli/entities/subtarefa.py`, `cli/apollo_cli/crud_helpers.py`,
`web/src/lib/routineJob.ts`, `shared/routine-job.testcases.json`,
`cli/tests/test_routine_job.py`, `web/src/lib/routineJob.test.ts`
**Files scanned:** 8 (all git-tracked, verified via `git ls-files`)
**Pattern extraction date:** 2026-09-22
