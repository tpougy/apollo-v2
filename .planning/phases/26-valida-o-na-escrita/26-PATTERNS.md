# Phase 26: Validação na escrita - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 3 (1 modified source + 2 docs; `routine_job.py` is read-only source of truth, not modified)
**Analogs found:** 3 / 3 (in-file analog for the Choice pattern; no cross-file search needed — the exact model already lives in the same functions being edited)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `cli/apollo_cli/entities/rotina.py` (`template.criar` `--regra-competencia`, line ~126-133) | CLI option / controller | request-response | same file, `--tipo-geracao` option, lines 116-124 | exact (same function, same click pattern, just needs `type=click.Choice(...)`) |
| `cli/apollo_cli/entities/rotina.py` (`template.editar` `--regra-competencia`, line 211) | CLI option / controller | request-response | same file, `--tipo-geracao` option, lines 205-210 | exact |
| `cli/apollo_cli/entities/rotina.py` (`--propagar-atraso-soft` help text, lines 134-138 and 212-216) | CLI option help text | request-response | `routine_job.py` module docstring lines 46-47 (source of truth for the corrected wording) | exact (documentation-only) |
| `cli/apollo_cli/entities/rotina.py` (`instancia.status` docstring, lines 320-328) | docstring / comment | request-response | `routine_job.py` module docstring lines 17-23 (canonical wording on `dedupeKey`) | exact |
| `docs/ai-usage/CLAUDE.md` (line 121, `apollo rotina template criar` section) | doc | n/a | same doc's own surrounding block (lines 117-127) — self-consistent style to match | exact (documentation-only) |
| `cli/README.md` | doc | n/a | N/A — already correct, no false claim present | not applicable, see "No Analog Found" |

## Pattern Assignments

### `cli/apollo_cli/entities/rotina.py` — `--regra-competencia` in `template.criar` (controller, request-response)

**Analog:** same file, `--tipo-geracao` option in the same function (lines 116-124):

```python
@click.option(
    "--tipo-geracao",
    type=click.Choice(_TIPO_GERACAO_CHOICES),
    required=True,
    help=(
        "How instances are dated: 'du_fixo' = fixed business-day offset, "
        "'corrido_fixo' = fixed calendar-day offset, 'encadeado' = chained "
        "off the `--antecessor-id` template's instance."
    ),
)
```

**Current code to replace** (lines 126-133):
```python
@click.option(
    "--regra-competencia",
    required=True,
    help=(
        "Free-form rule describing which competencia (reference month) each "
        "generated instance belongs to. Not enforced/parsed by the CLI."
    ),
)
```

**Module-level constant to reuse (do NOT redeclare):** `routine_job.py` line 86:
```python
REGRAS_COMPETENCIA_SUPORTADAS: Final[tuple[str, ...]] = ("M0", "M-1", "M-2", "M+1")
```

**Import to add** (extend the existing import block at line 53 of `rotina.py`):
```python
from apollo_cli.routine_job import (
    REGRAS_COMPETENCIA_SUPORTADAS,
    run_routine_instance_job,
    today_utc_iso_date,
)
```

**Target pattern** — mirror `_TIPO_GERACAO_CHOICES` usage exactly (note: `_TIPO_GERACAO_CHOICES` is a module-local tuple in `rotina.py`, but for `regraCompetencia` the tuple must be *imported*, not redeclared, per CONTEXT.md decision #1/specifics):
```python
@click.option(
    "--regra-competencia",
    type=click.Choice(REGRAS_COMPETENCIA_SUPORTADAS),
    required=True,
    help=(
        "Which competencia (reference month) rule applies to generated "
        "instances of this template. Enforced by `apollo rotina "
        "gerar-instancias`; see `apollo_cli.routine_job.shift_competencia`."
    ),
)
```

---

### `cli/apollo_cli/entities/rotina.py` — `--regra-competencia` in `template.editar` (controller, request-response)

**Analog:** same file, `--tipo-geracao` option in `editar` (lines 205-210):
```python
@click.option(
    "--tipo-geracao",
    type=click.Choice(_TIPO_GERACAO_CHOICES),
    default=None,
    help="New generation type.",
)
```

**Current code to replace** (line 211):
```python
@click.option("--regra-competencia", default=None, help="New competencia rule.")
```

**Target pattern** (note `default=None` preserved — editar's "omit to leave unchanged" convention, stated in the `editar` docstring at lines 257-259):
```python
@click.option(
    "--regra-competencia",
    type=click.Choice(REGRAS_COMPETENCIA_SUPORTADAS),
    default=None,
    help="New competencia rule. Omit to leave unchanged.",
)
```

**Note:** `click.Choice` combined with `default=None` is safe — Click only validates a value when one is actually supplied; `None` passes through untouched (same as how `_TIPO_GERACAO_CHOICES` already behaves with `default=None` in `editar`, proven at lines 205-210 which is the direct precedent for this exact combination).

---

### `cli/apollo_cli/entities/rotina.py` — `--propagar-atraso-soft` help text (documentation-only, both `criar` and `editar`)

**Source of truth for wording:** `routine_job.py` lines 46-47:
```
`propagarAtrasoSoft` is stored on the template but never read anywhere in
this module (C-09) — delay propagation is explicitly out of scope.
```

**Current code, `criar`** (lines 134-138):
```python
@click.option(
    "--propagar-atraso-soft/--nao-propagar-atraso-soft",
    default=False,
    help="Whether a soft delay on this template propagates to its sucessores. Defaults to off.",
)
```

**Current code, `editar`** (lines 212-216):
```python
@click.option(
    "--propagar-atraso-soft/--nao-propagar-atraso-soft",
    default=None,
    help="New soft-delay-propagation flag. Omit to leave unchanged.",
)
```

**Target pattern** (help text only — flag name, default, and parameter binding are unchanged per CONTEXT.md decision #3 "reservar, não implementar"):
```python
help=(
    "Stored on the template but NOT currently read anywhere — "
    "gerar-instancias does not propagate soft delays (C-09, out of "
    "scope for this milestone). Defaults to off."
)
```
(adjust "Defaults to off" → "Omit to leave unchanged." for the `editar` variant, matching each function's existing default-handling convention)

---

### `cli/apollo_cli/entities/rotina.py` — `instancia.status` docstring (docstring correction)

**Source of truth for wording:** `routine_job.py` lines 17-23:
```
`dedupeKey` is deliberately plain string concatenation
(`f"{template_id}:{competencia}:{data_prevista}"`), NOT a derived hash of any
kind (RESEARCH Assumption A5). The uniqueness guarantee lives in the
`instanciasRotina.dedupeKey.unique()` schema constraint, not in the key's
entropy — plain concatenation stays human-debuggable in
`apollo rotina instancia listar` output and removes any risk of a TS/Python
hash-output mismatch.
```

**Current code to fix** (lines 320-328):
```python
def status(eid: str, status: str) -> None:
    """Update ONLY the `status` field of an existing routine instance.

    Deliberately narrow: this command must never grow a `--data-prevista` or
    `--competencia` flag. Either would desynchronize the record from its
    `dedupeKey` (hash of templateId + competencia + dataPrevista), and the
    next generation job run would then create a duplicate alongside it —
    breaking the one idempotency guarantee this system promises (PROJECT.md
    C-06).
    """
```

**Fix:** replace `` `dedupeKey` (hash of templateId + competencia + dataPrevista) `` with wording consistent with the canonical source, e.g. `` `dedupeKey` (the plain `templateId:competencia:dataPrevista` concatenation — deliberately not a hash, see `apollo_cli.routine_job`'s module docstring) ``. Do not touch the rest of the docstring (the C-06/idempotency reasoning is correct and unrelated to this fix).

---

### `docs/ai-usage/CLAUDE.md` (documentation-only)

**Current line 121:**
```
--regra-competencia TEXT (obrigatório, livre — não parseado pela CLI)
```

**Surrounding context** (lines 117-127, unchanged except line 121 and the type annotation) — this block already documents `--tipo-geracao` as `[du_fixo|corrido_fixo|encadeado]` at line 120, i.e. the doc already uses the `[choice1|choice2|...]` bracket notation for enum-typed options — reuse that exact notation for `--regra-competencia`:
```
--nome TEXT (obrigatório)
--tipo-geracao [du_fixo|corrido_fixo|encadeado] (obrigatório)
--regra-competencia TEXT (obrigatório, livre — não parseado pela CLI)
--propagar-atraso-soft / --nao-propagar-atraso-soft (default: off)
```

**Fix (line 121):**
```
--regra-competencia [M0|M-1|M-2|M+1] (obrigatório)
```

## Shared Patterns

### `click.Choice` for closed-enum CLI options
**Source:** `cli/apollo_cli/entities/rotina.py` lines 116-124 (`criar`) and 205-210 (`editar`) — the existing `--tipo-geracao` option.
**Apply to:** `--regra-competencia` in both `criar` and `editar`.
**Rule:** tuple of accepted values must be *imported* from its single source of truth (`apollo_cli.routine_job.REGRAS_COMPETENCIA_SUPORTADAS`), never redeclared locally — this differs from `_TIPO_GERACAO_CHOICES`, which IS declared locally in `rotina.py` (line 58) because `routine_job.py` has no equivalent exported constant for it. Do not follow the `_TIPO_GERACAO_CHOICES` local-declaration precedent for `regraCompetencia` — CONTEXT.md is explicit that the two lists must not be able to diverge.

### Doc-comment/docstring correction style
**Source:** `cli/apollo_cli/routine_job.py` module docstring (lines 1-62) is the canonical, most carefully worded description of `dedupeKey` and `propagarAtrasoSoft` semantics in the codebase.
**Apply to:** Any help text or docstring elsewhere (`rotina.py`, `docs/ai-usage/CLAUDE.md`) describing these two fields — always defer to this module docstring's wording/framing rather than inventing new phrasing, to prevent the two descriptions drifting apart again in the future.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `cli/README.md` | doc | n/a | Checked (grep for `regra-competencia`/`regraCompetencia`/"não parseado"): the only relevant line (239) already correctly lists `M0`/`M-1`/`M-2`/`M+1` as the accepted values and does not repeat the "free-form/not parsed" claim. **No change needed in this file for VAL-01** — CONTEXT.md's "se citar o campo" condition for fixing it is not triggered. Planner should confirm this file needs zero edits, only `docs/ai-usage/CLAUDE.md` line 121 does. |

## Metadata

**Analog search scope:** `cli/apollo_cli/entities/rotina.py`, `cli/apollo_cli/routine_job.py`, `docs/ai-usage/CLAUDE.md`, `cli/README.md` (targeted grep + read, no broader codebase search needed — CONTEXT.md already named exact files and line ranges, and the `--tipo-geracao` precedent for `click.Choice` lives in the very functions being edited).
**Files scanned:** 4
**Pattern extraction date:** 2026-08-14
