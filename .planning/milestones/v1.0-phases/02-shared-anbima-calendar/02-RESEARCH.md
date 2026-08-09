# Phase 2: Shared ANBIMA Calendar - Research

**Researched:** 2026-08-09
**Domain:** Static-data vendoring + dual-runtime (TypeScript/Bun + Python) business-day math parity
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No `## Decisions` section exists in 02-CONTEXT.md — this phase's CONTEXT.md uses a single `## Implementation Decisions` block (below), not separate Decisions/Discretion/Deferred subsections. Reproduced verbatim:

> ### Claude's Discretion
> All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions. PROJECT.md C-03 is LOCKED: `shared/anbima-calendar.json` is a static vendored table (~948 dates, 2000-2078, federal-only), sourced from `github.com/ianliu/feriados-anbima`. Both `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py` read exclusively from this JSON — never from a library's built-in/algorithmic calendar. Update path is manual (`shared/scripts/update_calendar.py`, run yearly), never computed at runtime.

### Claude's Discretion
Everything not explicitly covered by PROJECT.md C-03 above is Claude's discretion: exact JSON schema, exact function signatures/algorithms, test framework choice for `web/` and `cli/`, structure of the shared test-case fixture, and the design of `update_calendar.py`. This research resolves each of these discretion points with a concrete recommendation (see Standard Stack, Architecture Patterns).

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped, per 02-CONTEXT.md `<deferred>` block: "None — discuss phase skipped."
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| CAL-01 | `shared/anbima-calendar.json` contains the vendored ANBIMA holiday table (2000-2078, federal-only), sourced from `github.com/ianliu/feriados-anbima` | Summary + Standard Stack resolve the sourcing question (extract from `bizdays`'s bundled `ANBIMA.cal`, not `feriados-anbima`'s live-fetch script); Architecture Patterns defines the JSON schema; Pitfall 2 flags the stale ~948 count |
| CAL-02 | `web/src/lib/bizdays.ts` implements `isBusinessDay`, `addBusinessDays`, `nextBusinessDay` reading exclusively from the vendored JSON | Architecture Patterns → Pattern 2 gives a full verified-approach code example; Pitfall 3/4 cover range-validation and tsconfig gaps |
| CAL-03 | `cli/apollo_cli/bizdays.py` implements equivalent business-day math using Python `bizdays` configured with a custom calendar pointing at the same vendored JSON (not the library's built-in `ANBIMA` calendar) | Standard Stack + Pattern 1 give the exact `Calendar(holidays=[...], weekdays=[...])` construction, verified against the locally-installed library; Anti-Patterns section flags the exact call to avoid (`Calendar.load("ANBIMA")`) |
| CAL-04 | For a shared set of test dates/operations, `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py` produce identical results | Pattern 3 + Validation Architecture define the shared-fixture approach and both consumer test files; Pitfall 3 covers boundary-date parity |
| CAL-05 | `shared/scripts/update_calendar.py` exists as the sole (manual, non-runtime) path to regenerate the vendored calendar | Architecture diagram + Don't Hand-Roll table describe the extraction approach (from `bizdays`'s bundled file, no network fetch needed for v1); Pitfall 5 covers quality-gate scope for this file |
</phase_requirements>

## Summary

The phase's core technical bet — "vendor a static ANBIMA holiday table and read it identically from both runtimes" — is sound and fully verifiable. The critical finding from live investigation: **`github.com/ianliu/feriados-anbima` (cited in the locked constraint C-03) is NOT itself a static vendored table.** It is a 25-line, GPLv3-licensed Python script that downloads `feriados_nacionais.xls` live from ANBIMA's own website at runtime and parses it with `xlrd`. Vendoring *that* would mean either (a) running it once and freezing its output, or (b) depending on a live network fetch — the latter is explicitly forbidden by C-03 ("never at runtime").

A better, MIT-licensed, already-static source exists and was verified by installing it locally: the `bizdays` PyPI package (`wilsonfreitas/python-bizdays`, MIT license, v1.0.19 as of 2026-01-04) ships a plain-text calendar file, `ANBIMA.cal`, bundled directly in its package data. This file **is** the static table — one ISO date per line, 1276 total dates spanning 2000-01-01 to 2099-12-25 (verified: `pip install bizdays` then locate `.../site-packages/bizdays/ANBIMA.cal`). Restricting to the locked 2000–2078 range (per C-03's literal text) yields **1003 dates**, not the ~948 cited in PROJECT.md — that number matches an *older* published snapshot of the same file (bizdays' own docs page, unchanged since an older release, still advertises "948 holidays, 2078-12-25" for `Calendar.load('ANBIMA')`, but the file actually installed today already contains the superset through 2099). This discrepancy is flagged in Assumptions Log A1 — it does not block the phase, but the planner must decide whether to hard-cut the vendored JSON at 2078-12-25 (matching C-03's literal number, recommended) or vendor the full 2099 range (also valid, since it's the same official data one release further along).

**Primary recommendation:** Extract holidays directly from the locally-installed `bizdays` package's `ANBIMA.cal` file (MIT-licensed, redistribution-safe) via `shared/scripts/update_calendar.py`, filter to `2000-01-01..2078-12-25` to honor C-03's literal range, and write `shared/anbima-calendar.json` as `{"start": "2000-01-01", "end": "2078-12-25", "holidays": ["YYYY-MM-DD", ...]}`. Both `web/src/lib/bizdays.ts` and `cli/apollo_cli/bizdays.py` implement independent, hand-rolled Mon–Fri + holiday-set business-day math against that JSON (Python side may use the `bizdays` *library's* generic `Calendar(holidays=[...], weekdays=[...])` constructor fed by the vendored JSON — never `Calendar.load('ANBIMA')`, which would silently reintroduce the library's own bundled/algorithmic calendar and violate CAL-03). Test parity via one shared fixture file (`shared/bizdays.testcases.json`) consumed by `bun test` (web) and a newly-added `pytest` (cli).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Holiday data storage | Shared/static asset (`shared/anbima-calendar.json`) | — | Single source of truth read by both runtimes; C-01/C-03 lock this |
| Business-day math (isBusinessDay/addBusinessDays/nextBusinessDay) | Frontend (`web/src/lib/bizdays.ts`) | CLI (`cli/apollo_cli/bizdays.py`) | Pure client-side/CLI-side computation — no backend involved; InstantDB has no business-day concept |
| Calendar regeneration | Build/dev tooling (`shared/scripts/update_calendar.py`) | — | Manual, offline, never invoked by the running app or CLI at request time |
| Cross-runtime test parity | Test tooling (`bun test` + `pytest`) | Shared fixture (`shared/bizdays.testcases.json`) | Both test runners are consumers of one shared data file, never each other |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `bizdays` (Python) | 1.0.19 [VERIFIED: PyPI JSON API, installed locally] | Generic business-day `Calendar` engine, and (one-time only) source of the vendored `ANBIMA.cal` static data file | Already the LOCKED choice per PROJECT.md/original apollo; MIT-licensed [VERIFIED: `api.github.com/repos/wilsonfreitas/python-bizdays/license` → `mit`]; its generic `Calendar(holidays=[...], weekdays=[...])` constructor (not `Calendar.load('ANBIMA')`) is exactly the "custom calendar pointing at vendored JSON" shape CAL-03 requires |
| `bun:test` (built-in) | Bun 1.3.12 [VERIFIED: `bun --version` in this repo's toolchain] | Web-side test runner for `bizdays.ts` unit tests and the shared fixture | Zero additional dependency — `bun` is already the SOLE mandated JS executor (C-08); `bun test` is Jest-compatible (`describe`/`test`/`expect`), natively imports `.json` files with no config, and needs no new devDependency |
| `pytest` | Not yet installed [VERIFIED: `cli/pyproject.toml` has no `[dependency-groups] dev` entry for it] — add via `uv add --dev pytest` | CLI-side test runner for `bizdays.py` unit tests and the shared fixture | Universal Python testing standard; `uv add --dev` keeps it out of the runtime dependency set, consistent with `ruff`/`ty` already being `dev` group only |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `xlrd` | transitive, only needed if re-scraping the ANBIMA `.xls` directly | Legacy `.xls` parsing (used by `feriados-anbima`'s own script) | Only if `update_calendar.py` is later extended to fetch fresh data straight from ANBIMA's site instead of re-extracting from a newer `bizdays` release — not needed for the initial vendoring documented here |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extracting `ANBIMA.cal` from the installed `bizdays` package | Running `ianliu/feriados-anbima`'s `anbima.holidays()` to fetch ANBIMA's live `.xls` | Requires `xlrd` + a live network call to `anbima.com.br` at *update* time (fine, since updates are manual/yearly per C-03) but the repo is GPLv3 — redistributing its *code* verbatim would require GPLv3 compliance; using it only as a one-time, non-redistributed update mechanism (not vendoring its source into the repo) sidesteps that. The `bizdays` package's bundled file is simpler, MIT-licensed, and already-current, so it's the safer default; keep this as the fallback update path if `bizdays`'s own bundled table ever goes stale relative to ANBIMA's real feed. |
| `bun test` | `vitest` | Vitest adds a real devDependency + config file for zero functional gain here — Phase 1 deliberately did not add any JS test framework, and `bun test`'s Jest-compatible API is a strict superset of what's needed for pure-function business-day assertions. Only reconsider `vitest` if a later phase needs `jsdom`/component testing (`bun test` supports DOM testing too via `happy-dom`, but that's out of scope for this phase). |

**Installation:**
```bash
# cli/ — add bizdays as a runtime dependency (business-day math engine)
cd cli && uv add bizdays

# cli/ — add pytest as a dev dependency (test runner)
cd cli && uv add --dev pytest

# web/ — no installation needed; bun test is built into the already-present bun 1.3.12
```

**Version verification:**
```bash
$ curl -s https://pypi.org/pypi/bizdays/json | python3 -c "import json,sys; d=json.load(sys.stdin)['info']; print(d['version'])"
1.0.19
```
Verified 2026-08-09 against the live PyPI JSON API. Latest release date per PyPI metadata: 2026-01-04. `bun --version` in this repo's environment: `1.3.12`.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  bizdays (PyPI, MIT) v1.0.19 │        │  shared/scripts/              │
│  bundles ANBIMA.cal          │──run──▶│  update_calendar.py           │
│  (1276 dates, 2000-2099)     │ once,  │  - reads bizdays's ANBIMA.cal │
│  [one-time extraction only]  │ manual │  - filters to 2000-01-01..    │
└─────────────────────────────┘  /yearly│    2078-12-25 (C-03 range)   │
                                         │  - writes JSON, never runs   │
                                         │    at app/CLI runtime        │
                                         └───────────────┬───────────────┘
                                                          │ writes
                                                          ▼
                                    ┌──────────────────────────────────┐
                                    │ shared/anbima-calendar.json       │
                                    │ { start, end, holidays: [...] }   │
                                    │ (single source of truth)          │
                                    └──────────┬────────────┬───────────┘
                                               reads         reads
                                    ┌──────────▼──┐   ┌──────▼─────────────┐
                                    │ web/src/lib/│   │ cli/apollo_cli/     │
                                    │ bizdays.ts  │   │ bizdays.py          │
                                    │ isBusinessDay│  │ isBusinessDay        │
                                    │ addBusiness- │  │ addBusinessDays      │
                                    │  Days        │  │ nextBusinessDay      │
                                    │ nextBusiness-│  │ (bizdays.Calendar(   │
                                    │  Day         │  │  holidays=[...],     │
                                    │ (hand-rolled)│  │  weekdays=[Sat,Sun]))│
                                    └──────┬───────┘  └─────────┬───────────┘
                                           │                     │
                                    ┌──────▼─────────────────────▼───────┐
                                    │ shared/bizdays.testcases.json      │
                                    │ [{op, date, args, expected}, ...]  │
                                    │ consumed by BOTH test runners      │
                                    └──────┬─────────────────────┬──────┘
                                     bun test                 pytest
                                     (web/src/lib/              (cli/tests/
                                      bizdays.test.ts)           test_bizdays.py)
```

### Recommended Project Structure
```
shared/
├── anbima-calendar.json        # {start, end, holidays: [...]} — vendored data
├── bizdays.testcases.json      # shared cross-runtime parity fixture
└── scripts/
    └── update_calendar.py      # manual/yearly regeneration, never runtime

web/src/lib/
├── bizdays.ts                  # isBusinessDay / addBusinessDays / nextBusinessDay
└── bizdays.test.ts             # bun:test — unit tests + fixture-driven parity tests

cli/apollo_cli/
└── bizdays.py                  # same three functions via bizdays.Calendar

cli/tests/
├── __init__.py
└── test_bizdays.py             # pytest — unit tests + fixture-driven parity tests
```

### Pattern 1: Vendored static-data-only calendar (no algorithmic fallback)
**What:** Both runtimes load holidays exclusively from `shared/anbima-calendar.json`; neither uses a library's bundled/algorithmic holiday knowledge at runtime.
**When to use:** Always, for every date passed to any of the three functions in this phase — this is a LOCKED constraint (C-03), not a stylistic preference.
**Example (Python — the ONLY correct way to construct the Calendar):**
```python
# Source: bizdays 1.0.19 API, verified locally (Calendar.__init__ signature via help())
import json
from pathlib import Path
from bizdays import Calendar

def _load_calendar(json_path: Path) -> Calendar:
    data = json.loads(json_path.read_text())
    # NEVER: Calendar.load("ANBIMA")  <- forbidden by CAL-03, uses the library's
    # own bundled table instead of the vendored JSON.
    return Calendar(holidays=data["holidays"], weekdays=["Saturday", "Sunday"])
```
**Anti-pattern to avoid:** `from bizdays import Calendar; cal = Calendar.load("ANBIMA")` — this is the library's *own* bundled calendar, sourced independently of `shared/anbima-calendar.json`. It happens to currently contain a superset of the same data, but using it would violate CAL-03's explicit "not the library's built-in ANBIMA calendar" requirement and would silently drift from the vendored JSON on any future `bizdays` upgrade.

### Pattern 2: Hand-rolled TS business-day math (no npm holiday package)
**What:** `web/src/lib/bizdays.ts` implements the three functions directly against a `Set<string>` of ISO dates — no `date-holidays`, no `febraban-bank-holidays`, no date-math library needed for this narrow scope.
**When to use:** Always for this phase — C-03 explicitly forbids any algorithmic/third-party calendar package on the client side.
**Example:**
```typescript
// Source: hand-rolled, no external doc — algorithm is Mon-Fri + holiday-set exclusion
import calendarData from "../../../shared/anbima-calendar.json";

const HOLIDAYS: ReadonlySet<string> = new Set(calendarData.holidays);
const RANGE_START = calendarData.start; // "2000-01-01"
const RANGE_END = calendarData.end; // "2078-12-25"

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function assertInRange(iso: string): void {
  if (iso < RANGE_START || iso > RANGE_END) {
    throw new RangeError(`Date ${iso} is outside vendored calendar range [${RANGE_START}, ${RANGE_END}]`);
  }
}

export function isBusinessDay(date: Date): boolean {
  const iso = toISODate(date);
  assertInRange(iso);
  const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  return day !== 0 && day !== 6 && !HOLIDAYS.has(iso);
}

export function addBusinessDays(date: Date, n: number): Date {
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  const result = new Date(date.getTime());
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + step);
    if (isBusinessDay(result)) remaining -= 1;
  }
  return result;
}

export function nextBusinessDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + 1);
  while (!isBusinessDay(result)) {
    result.setUTCDate(result.getUTCDate() + 1);
  }
  return result;
}
```
**Note on `nextBusinessDay` semantics:** designed here as *strictly after* the input date (matches `addBusinessDays(date, 1)`), not "same day if already a business day." This differs from `bizdays`' own `Calendar.following()` (same-day passthrough). Flagged in Assumptions Log A2 — confirm against original `apollo`'s `RNF-01` usage pattern if any call site expects same-day passthrough; no such call site exists yet in this migration (Phase 2 has no consumer, Phase 5's job is the first real caller).

### Pattern 3: Fixture-driven cross-runtime parity test
**What:** One JSON file (`shared/bizdays.testcases.json`) is the single source of test data; both `bun test` and `pytest` import/read it directly and iterate.
**When to use:** For CAL-04 ("same input → identical results")  — never hand-duplicate test cases into TS and Python separately.
**Example (fixture shape):**
```json
[
  { "op": "isBusinessDay", "date": "2000-01-01", "expected": false },
  { "op": "isBusinessDay", "date": "2000-01-03", "expected": true },
  { "op": "addBusinessDays", "date": "2000-01-03", "n": 5, "expected": "2000-01-10" },
  { "op": "addBusinessDays", "date": "2000-01-10", "n": -5, "expected": "2000-01-03" },
  { "op": "nextBusinessDay", "date": "2000-01-01", "expected": "2000-01-03" }
]
```
**Example (bun test consumer):**
```typescript
// web/src/lib/bizdays.test.ts — Source: bun:test API, verified locally (bun 1.3.12)
import { test, expect, describe } from "bun:test";
import cases from "../../../shared/bizdays.testcases.json";
import { isBusinessDay, addBusinessDays, nextBusinessDay } from "./bizdays";

describe("shared fixture parity", () => {
  for (const c of cases) {
    test(`${c.op} ${c.date} ${JSON.stringify(c)}`, () => {
      const date = new Date(`${c.date}T00:00:00Z`);
      if (c.op === "isBusinessDay") {
        expect(isBusinessDay(date)).toBe(c.expected);
      } else if (c.op === "addBusinessDays") {
        expect(addBusinessDays(date, c.n).toISOString().slice(0, 10)).toBe(c.expected);
      } else if (c.op === "nextBusinessDay") {
        expect(nextBusinessDay(date).toISOString().slice(0, 10)).toBe(c.expected);
      }
    });
  }
});
```
**Example (pytest consumer):**
```python
# cli/tests/test_bizdays.py — Source: pytest conventions, standard library json
import json
from pathlib import Path

import pytest

from apollo_cli.bizdays import add_business_days, is_business_day, next_business_day
from apollo_cli.config import find_repo_root

FIXTURE = json.loads(
    (find_repo_root() / "shared" / "bizdays.testcases.json").read_text()
)


@pytest.mark.parametrize("case", FIXTURE, ids=lambda c: f"{c['op']}-{c['date']}")
def test_fixture_parity(case: dict) -> None:
    if case["op"] == "isBusinessDay":
        assert is_business_day(case["date"]) == case["expected"]
    elif case["op"] == "addBusinessDays":
        assert add_business_days(case["date"], case["n"]) == case["expected"]
    elif case["op"] == "nextBusinessDay":
        assert next_business_day(case["date"]) == case["expected"]
```

### Anti-Patterns to Avoid
- **Calling `Calendar.load("ANBIMA")` on the Python side:** silently reintroduces the library's own bundled calendar instead of the vendored JSON — violates CAL-03 even though today's data happens to overlap.
- **Duplicating test cases by hand into both a `.test.ts` and a `.py` file:** guarantees silent drift the first time someone edits one and forgets the other; always read from `shared/bizdays.testcases.json`.
- **Adding `date-holidays`, `febraban-bank-holidays`, or any other holiday-computing npm/PyPI package as a runtime dependency:** these compute holidays algorithmically and are exactly what C-03/CAL-02/CAL-03 forbid as the source of truth (the spec's own rationale: "Nenhum pacote JS que calcula feriados algoritmicamente ... tem garantia de bater 100% com essa tabela oficial").
- **Running `update_calendar.py` (or any network fetch) from application code, a Vite plugin, or a CLI command's normal execution path:** C-03 requires this to be a manual, human-invoked, non-runtime script only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sourcing the ANBIMA holiday list itself | A custom scraper of ANBIMA's website/xls | Extract from the already-installed, MIT-licensed `bizdays` package's bundled `ANBIMA.cal` file | It's already correct, already static, already MIT-licensed, and requires zero new runtime dependency beyond `bizdays` (which is being added anyway for the CLI's business-day engine) |
| Python-side business-day walking (offset by N business days, weekday/holiday exclusion) | Manual date-loop math independent of `bizdays` | `bizdays.Calendar(holidays=[...], weekdays=[...])`'s `.isbizday()`, `.offset()`, `.following()`/`.seq()` methods | The library already handles the loop, out-of-range errors, and edge cases (`financial=True` semantics) correctly; only the *data source* (not the *engine*) needs to be swapped out per CAL-03 |
| Cross-runtime test-case duplication | Copy-pasted arrays of test dates in both `.ts` and `.py` test files | One shared JSON fixture (`shared/bizdays.testcases.json`) read by both `bun test` and `pytest` | Directly satisfies CAL-04's "identical results" requirement — a single data source makes drift structurally impossible instead of relying on developer discipline |

**Key insight:** The only piece of genuinely new logic in this phase is the TypeScript side's business-day math (Pattern 2 above) — everything else (data sourcing, Python engine, test parity) has an off-the-shelf, verified answer. Keep the hand-rolled surface area to exactly that one file.

## Common Pitfalls

### Pitfall 1: Assuming `github.com/ianliu/feriados-anbima` ships a static file
**What goes wrong:** A planner reads C-03's literal text ("sourced from `github.com/ianliu/feriados-anbima`") and expects to find a committed `.json`/`.csv`/`.cal` file in that repo to copy.
**Why it happens:** The repo's README is short and its purpose (thin wrapper around a live `.xls` download) isn't obvious without opening `anbima.py`.
**How to avoid:** Use the verified fact from this research: that repo is a *fetcher*, not a *table*. The static table to vendor comes from `bizdays`'s own bundled `ANBIMA.cal` (MIT-licensed, already-installed as a Phase 2 dependency).
**Warning signs:** Cloning the `feriados-anbima` repo and finding only `anbima.py`, `setup.py`, `README.md`, `LICENSE` — no data file.

### Pitfall 2: Silent holiday-count/date-range mismatch vs. PROJECT.md's "~948 dates, 2000-2078"
**What goes wrong:** Vendoring the full, currently-installed `bizdays` ANBIMA.cal unfiltered (1276 dates through 2099) instead of the locked 2000–2078 range, causing CAL-01's literal wording ("2000-2078, federal-only") to not match the shipped file, and later confusing anyone auditing count against the spec.
**Why it happens:** `bizdays`'s upstream data has been extended since PROJECT.md's constraint was written (a live, verified fact from this session, not assumed) — the current package genuinely contains more dates than the locked spec describes.
**How to avoid:** In `update_calendar.py`, explicitly filter `date <= "2078-12-31"` before writing the JSON, and assert the output date count for a sanity check comment (any number is fine as ground truth *now* — do not hardcode an expected count of 948, since this research found 1003 dates in the current data cut to 2078; hardcode the actual verified count as an assertion in the script and note it in the file's `metadata` comment).
**Warning signs:** `shared/anbima-calendar.json`'s `holidays.length` not matching whatever count the script asserts on regeneration.

### Pitfall 3: Out-of-range date handling divergence between TS and Python
**What goes wrong:** Python's `bizdays.Calendar` raises `DateOutOfRange` for dates before/after the vendored range (verified locally); if `bizdays.ts` silently returns a wrong boolean instead of throwing for the same out-of-range input, CAL-04's "identical results" is violated the moment any test case probes a boundary date.
**Why it happens:** The TS implementation is hand-rolled and won't automatically inherit this behavior unless explicitly coded.
**How to avoid:** Add an explicit `assertInRange` guard (see Pattern 2's example) in `bizdays.ts` that throws for any date outside `[start, end]`, and include at least one out-of-range test case in the shared fixture (e.g., `1999-12-31`) asserting both sides throw/raise.
**Warning signs:** A parity test passing on in-range dates but nobody testing the boundary; a future caller (Phase 5's job) silently miscalculating for a date near 2078.

### Pitfall 4: `bun test` files not covered by existing type-check/lint config
**What goes wrong:** `web/src/lib/bizdays.test.ts` imports `describe`/`test`/`expect` from `"bun:test"`; `web/tsconfig.app.json`'s `compilerOptions.types` currently only lists `["svelte", "vite/client"]` (verified: read directly from the file) — `bun run check` (svelte-check + tsc) will report `Cannot find module 'bun:test'` unless `bun-types` (or the ambient globals from `@types/bun`, already a devDependency) is added to that `types` array.
**Why it happens:** Phase 1 never wrote a test file, so this gap was invisible until now.
**How to avoid:** Add `"bun-types"` to `web/tsconfig.app.json`'s `compilerOptions.types` array (alongside `svelte`, `vite/client`) before writing the first `.test.ts` file, and confirm `bun run check` still exits 0.
**Warning signs:** `bun run check` failing with `Cannot find module 'bun:test' or its corresponding type declarations` after adding the first test file.

### Pitfall 5: Biome/ruff scope not covering new file locations
**What goes wrong:** `shared/bizdays.testcases.json` and `shared/scripts/update_calendar.py` land in locations not yet covered by `biome.json`'s `files.includes` (JSON isn't linted by Biome's current config anyway, low risk) or `cli/pyproject.toml`'s ruff config (ruff's default `src`/`include` should already cover any `*.py` under the repo unless explicitly excluded — verify, don't assume).
**Why it happens:** `biome.json`'s `files.includes` is an explicit allowlist (`["shared/**/*.ts", "web/src/**/*.ts", "web/src/**/*.svelte", "web/vite.config.ts"]`) — note it currently only matches `.ts` under `shared/`, not `.py`, which is correct (ruff owns `.py`), but `shared/scripts/*.py` must be reachable by `cli/`'s ruff/ty invocation for VERIFY-02 to actually cover it, and Phase 1's `01-02-SUMMARY.md` confirms VERIFY-02's exact wording is "every `.py` file in `cli/` and `shared/scripts/`" — so the quality-gate command must explicitly point `ruff`/`ty` at `shared/scripts/` too, since `cli/pyproject.toml`'s `[tool.ruff] src = ["."]` is scoped to `cli/`'s own directory by default when run with `cd cli`.
**How to avoid:** Run `ruff check`/`ty check` for `shared/scripts/update_calendar.py` either from the repo root with an explicit path argument, or duplicate/extend the ruff invocation to include `../shared/scripts` when run from `cli/`. Decide and document the exact command in this phase's plan (this is a planning decision, not yet made).
**Warning signs:** `verify-phase-01.sh`-style closeout script for Phase 2 passing ruff/ty on `cli/` alone while `update_calendar.py` has never actually been linted.

## Code Examples

### Loading the vendored calendar in Python (verified locally against bizdays 1.0.19)
```python
# Source: bizdays.Calendar.__init__ signature, verified via `help()` on locally installed bizdays==1.0.19
from bizdays import Calendar

cal = Calendar(
    holidays=["2000-01-01", "2000-03-06"],  # from shared/anbima-calendar.json
    weekdays=["Saturday", "Sunday"],
)
cal.isbizday("2000-01-01")  # -> False
cal.following("2000-01-01")  # -> date(2000, 1, 2)  [same-day-if-bizday semantics — NOT used directly for nextBusinessDay, see Pattern 2 note]
cal.offset("2000-01-03", 5)  # -> business day 5 steps forward
```

### Extracting the bundled ANBIMA.cal file's raw format (verified locally)
```
Saturday
Sunday
2000-01-01
2000-03-06
2000-03-07
...
2078-12-25
```
One weekday-exclusion name per line at the top (`Saturday`, `Sunday`), then one ISO date per line — this is `bizdays`' own calendar-file text format (documented at `wilsonfreitas.github.io/python-bizdays/calendars.html`), directly `str.splitlines()`-parseable.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Original `apollo` used Python `bizdays` + `Calendar.load("ANBIMA")` directly (per CLAUDE.md's constraint referencing `bizdays` with ANBIMA calendar) | This phase forbids `Calendar.load("ANBIMA")` and requires the *generic* `Calendar(holidays=[...])` constructor fed by a vendored, dual-runtime-shared JSON | This migration (C-03) | Guarantees TS/Python parity, which `Calendar.load("ANBIMA")` alone could never provide since no equivalent exists on the TS side |

**Deprecated/outdated:**
- PROJECT.md's "~948 dates, 2000-2078" figure: stale relative to the currently-installed `bizdays` 1.0.19's bundled table (which now has 1003 dates in that same range, 1276 total through 2099) — see Assumptions Log A1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `~948 dates, 2000-2078` figure in PROJECT.md C-03 is stale; the correct, currently-verified count for that exact range from `bizdays` 1.0.19's bundled `ANBIMA.cal` is 1003 dates (1276 total through 2099). This research recommends filtering to 2000-2078 (1003 dates) to honor C-03's literal date-range wording, while flagging the count itself as no longer authoritative. | Summary, Pitfall 2 | Low — either count is derived from the same official ANBIMA source; the risk is purely a documentation-consistency one (someone asserting `holidays.length === 948` in a test would fail against the real vendored data). No functional/business risk. |
| A2 | `nextBusinessDay(date)` is designed as "strictly after `date`" (equivalent to `addBusinessDays(date, 1)`), not `bizdays`' `Calendar.following()` same-day-passthrough semantics. | Architecture Patterns, Pattern 2 | Medium — if a future consumer (Phase 5's routine-generation job) actually needs same-day passthrough (e.g., "if today is already a business day, use today"), this choice would need to change in both `bizdays.ts` and `bizdays.py` simultaneously. No current call site exists to validate against; flag for confirmation when Phase 5 is planned. |
| A3 | `addBusinessDays` supports negative `n` (walking backward) even though CAL-02/CAL-03's wording doesn't explicitly require it. | Architecture Patterns, Pattern 2/3 | Low — original `apollo`'s domain (competência-based date calculations, `M-1`/`M-2` regras) strongly implies backward walking will be needed by Phase 5; including it now costs nothing and avoids an API change later. If wrong (never needed), it's simply unused surface area, not a defect. |

## Open Questions

1. **Exact vendored date range: 2000–2078 (matching C-03's literal number) or 2000–2099 (full currently-available data)?**
   - What we know: Both are legitimately "the official ANBIMA table" per the same upstream source (`bizdays`'s bundled `ANBIMA.cal`); C-03's text explicitly says "2000-2078".
   - What's unclear: Whether the ~948 count was load-bearing for any downstream test/assumption, or just descriptive.
   - Recommendation: Default to 2000–2078 (matches C-03's literal wording exactly, avoids re-litigating a LOCKED constraint's specific number); document the full-2099 alternative in `update_calendar.py`'s docstring as a one-line filter change if ever needed.

2. **Where does `shared/bizdays.testcases.json` live relative to C-01's exact locked file tree?**
   - What we know: C-01's locked tree lists `shared/{instant.schema.ts, instant.perms.ts, anbima-calendar.json, scripts/update_calendar.py}` and doesn't mention a test-fixture file.
   - What's unclear: Whether adding an un-listed file to `shared/` needs explicit sign-off, or is implicitly fine since it doesn't change domain schema/calendar semantics.
   - Recommendation: Treat as in-scope (it directly serves CAL-04, an explicit success criterion, and adds no new architectural boundary) — call it out explicitly in the plan's file list so the planner/reviewer sees it named up front.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | Web-side test runner, existing sole JS executor | ✓ | 1.3.12 | — |
| `uv` | CLI dependency management (`uv add bizdays`, `uv add --dev pytest`) | ✓ (used throughout Phase 1) | — [not re-probed this session; confirmed functional in 01-02-SUMMARY.md] | — |
| Python 3.12 | CLI runtime | ✓ | 3.12.12 [VERIFIED: Phase 1 `01-02-SUMMARY.md`] | — |
| `bizdays` (PyPI) | CAL-03 | Not yet installed in `cli/`'s venv | 1.0.19 latest [VERIFIED: PyPI JSON API] | None needed — trivial `uv add` |
| `pytest` (PyPI) | CAL-04 (Python-side test runner) | Not yet installed in `cli/`'s venv | latest via `uv add --dev pytest` | None needed |
| Network access to `pypi.org`/`registry` | One-time `uv add`/`uv sync` for the above | ✓ (used throughout this research session) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — all missing items (`bizdays`, `pytest`) are trivially installable via already-working `uv add`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (web) | `bun:test` (built into Bun 1.3.12, zero extra dependency) |
| Framework (cli) | `pytest` — not yet installed, add via `uv add --dev pytest` |
| Config file (web) | none required — `bun test` auto-discovers `*.test.ts` |
| Config file (cli) | none required initially — `pytest` auto-discovers `test_*.py` under `cli/tests/`; add a `[tool.pytest.ini_options]` section to `cli/pyproject.toml` only if custom `testpaths`/`rootdir` behavior is needed |
| Quick run command (web) | `cd web && bun test src/lib/bizdays.test.ts` |
| Quick run command (cli) | `cd cli && uv run pytest tests/test_bizdays.py -x` |
| Full suite command (web) | `cd web && bun test` |
| Full suite command (cli) | `cd cli && uv run pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-01 | `shared/anbima-calendar.json` contains the vendored 2000-2078 federal-only table | unit (structural assertion: date range, count, format) | `cd cli && uv run pytest tests/test_calendar_json.py -x` | ❌ Wave 0 |
| CAL-02 | `web/src/lib/bizdays.ts` implements the three functions reading only from the JSON | unit | `cd web && bun test src/lib/bizdays.test.ts` | ❌ Wave 0 |
| CAL-03 | `cli/apollo_cli/bizdays.py` implements equivalent math via `bizdays.Calendar` with a custom (non-built-in) calendar | unit | `cd cli && uv run pytest tests/test_bizdays.py -x` | ❌ Wave 0 |
| CAL-04 | TS and Python produce identical results for the same input set | integration/parity (shared fixture consumed by both runners) | `cd web && bun test src/lib/bizdays.test.ts && cd ../cli && uv run pytest tests/test_bizdays.py` | ❌ Wave 0 (fixture + both consumer test files) |
| CAL-05 | `shared/scripts/update_calendar.py` exists and can regenerate the JSON on demand | smoke (script runs, produces valid JSON, ruff/ty clean) | `cd cli && uv run python ../shared/scripts/update_calendar.py --dry-run` (exact flag TBD in plan) + `uv run ruff check ../shared/scripts/update_calendar.py && uv run ty check ../shared/scripts/update_calendar.py` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** run the relevant side's quick command (`bun test src/lib/bizdays.test.ts` or `uv run pytest tests/test_bizdays.py -x`)
- **Per wave merge:** run both full suites (`bun test` in `web/`, `uv run pytest` in `cli/`)
- **Phase gate:** both full suites green, plus `ruff check`/`ty check` on `cli/` + `shared/scripts/`, plus Biome/`svelte-check` on `web/`, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `cli/pyproject.toml` — add `pytest` to `[dependency-groups] dev` via `uv add --dev pytest`
- [ ] `cli/tests/__init__.py` — new test package
- [ ] `cli/tests/test_bizdays.py` — unit + fixture-parity tests for CAL-03/CAL-04
- [ ] `cli/tests/test_calendar_json.py` — structural tests for CAL-01 (date range, no duplicate dates, all-ISO-format, federal-only sanity spot-checks against a few well-known ANBIMA dates)
- [ ] `web/tsconfig.app.json` — add `"bun-types"` to `compilerOptions.types` (Pitfall 4) before the first `.test.ts` file is written
- [ ] `web/src/lib/bizdays.test.ts` — unit + fixture-parity tests for CAL-02/CAL-04
- [ ] `web/package.json` — add a `"test": "bun test"` script for discoverability/consistency with the other `bun run` scripts (optional but recommended)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | This phase has no auth surface — pure offline data/math |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes (narrow) | `isBusinessDay`/`addBusinessDays`/`nextBusinessDay` must validate date inputs are within the vendored calendar's `[start, end]` range and reject/throw on malformed date strings, rather than silently producing wrong results (see Pitfall 3) |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malformed/out-of-range date string causing silent incorrect business-day computation (not a security vulnerability per se, but a data-integrity risk with downstream financial-controladoria impact) | Tampering (data integrity) | Explicit range/format validation at the entry point of all three functions on both sides (Pattern 2); throw/raise rather than clamp or default |
| `shared/scripts/update_calendar.py` executed with a `--fetch` mode that reaches out to a third-party URL (if ever added later) | Tampering (supply-chain) | Not in this phase's scope (v1 only extracts from the locally-installed `bizdays` package's bundled file, no network fetch); if a future revision adds live fetching from ANBIMA's site, pin the URL, verify content-type, and never auto-write over the committed JSON without a manual review step |

## Sources

### Primary (HIGH confidence)
- Local installation and inspection of `bizdays` 1.0.19 (`uv venv` + `uv pip install bizdays`, then read `site-packages/bizdays/ANBIMA.cal` directly) — this session, 2026-08-09
- `https://pypi.org/pypi/bizdays/json` — version 1.0.19, latest release 2026-01-04
- `https://api.github.com/repos/wilsonfreitas/python-bizdays/license` — confirmed `mit`
- `https://raw.githubusercontent.com/wilsonfreitas/python-bizdays/master/LICENSE.txt` — MIT license text, Copyright Wilson Freitas
- `https://api.github.com/repos/ianliu/feriados-anbima/contents/` — repo file listing (`LICENSE`, `README.md`, `anbima.py`, `setup.py`)
- `https://raw.githubusercontent.com/ianliu/feriados-anbima/master/anbima.py` — confirmed live `.xls` download + `xlrd` parse, no bundled static data
- `https://raw.githubusercontent.com/ianliu/feriados-anbima/master/LICENSE` — GPLv3
- `bun --version` in this repo's own environment — 1.3.12
- Local `bun test` smoke test with native `.json` import — confirmed working, this session
- Local `bizdays.Calendar` API exploration (`help(Calendar.__init__)`, `.isbizday()`, `.offset()`, `.following()`, out-of-range `DateOutOfRange` exception) — this session
- `/home/thomaz/pessoal/apollo-v2/cli/pyproject.toml`, `/home/thomaz/pessoal/apollo-v2/cli/apollo_cli/config.py`, `/home/thomaz/pessoal/apollo-v2/web/package.json`, `/home/thomaz/pessoal/apollo-v2/web/tsconfig.app.json`, `/home/thomaz/pessoal/apollo-v2/biome.json` — read directly, this session

### Secondary (MEDIUM confidence)
- `https://wilsonfreitas.github.io/python-bizdays/index.md` (project doc page) — states "948 holidays, End: 2078-12-25" for `Calendar.load('ANBIMA')`; contradicted by the locally-verified current package data (1276 dates through 2099) — treated as stale, see Assumptions Log A1
- WebSearch summaries on `bun:test` API shape (describe/test/expect, Jest-compatible) — cross-verified against a local `bun test` run in this session

### Tertiary (LOW confidence)
- None used as load-bearing claims in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `bizdays` license, version, and bundled file all verified via live tool calls (pip install, PyPI API, GitHub API), not training-data recall
- Architecture: HIGH — patterns derived directly from verified `bizdays.Calendar` API behavior and a working local `bun test` + JSON-import smoke test
- Pitfalls: HIGH — every pitfall in this document traces to a concrete, reproduced finding this session (stale doc count, GPLv3 vs MIT distinction, out-of-range exception behavior, missing `bun-types` in tsconfig)

**Research date:** 2026-08-09
**Valid until:** 30 days (stable domain — static data + small pure-function libraries; re-verify `bizdays` version if this phase is replanned after a long gap)
