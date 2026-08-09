# Phase 5: Idempotent Routine-Instance Job - Research

**Researched:** 2026-08-09
**Domain:** Deterministic date-generation job + InstantDB lookup-based upsert (TS SDK + Python SDK), triggered from two channels (SPA load, CLI command)
**Confidence:** MEDIUM-HIGH (schema/API mechanics VERIFIED against installed packages and source; the encadeado/dataPrevistaEstimada business semantics are ASSUMED — CONTEXT.md leaves them underspecified and flags them for resolution here)

## Summary

This phase adds exactly one new capability path — routine-instance generation — that both the SPA (on authenticated load) and the CLI (`apollo rotina gerar-instancias`) must invoke identically. The core technical mechanism (InstantDB's `lookup()`-keyed `update()` as an atomic upsert) is already used correctly elsewhere in the codebase's test fixtures and is verified directly against the installed `instantdb==1.0.63` (Python) and `@instantdb/core@1.0.63` (TS, via `@instantdb/svelte`) packages — both expose the exact same `lookup(attribute, value)` sentinel mechanism with identical wire semantics.

The real work of this phase is not the upsert mechanism — it's (1) closing the schema gap (`templatesRotina` has no field encoding which day of the month `du_fixo`/`corrido_fixo` target), and (2) writing one deterministic, side-effect-free "compute expected instances" function per generation type, shared conceptually between the TS and Python implementations (there is no code-sharing mechanism across the two runtimes today — `shared/` only holds `.ts`/`.json`, and `cli/apollo_cli/bizdays.py` already independently reimplements the TS `bizdays.ts` algorithm; this phase's job logic must follow that same "twin implementation, single documented algorithm" pattern).

**Primary recommendation:** Add `offsetDias: i.number().optional()` to `templatesRotina` (single field, dual-interpreted by `tipoGeracao`). Implement the job as a pure `computeExpectedInstances(templates, today) -> ExpectedInstance[]` function (TS in `web/src/lib/routineJob.ts`, Python in `cli/apollo_cli/routine_job.py`), followed by a **query-existing-dedupeKeys-then-write-only-the-diff** transact step — never a blind `update()` for every computed instance — so that a re-run never clobbers a user-edited `status`. Hook the SPA trigger into `Shell.svelte`'s `onMount` (which fires exactly once per authenticated mount, i.e., once per sign-in session) guarded by a plain (non-reactive) boolean, not a `$effect`.

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
PROJECT.md C-06 is LOCKED: client-side job on authenticated SPA load, range today→end of next month, three generation types (`du_fixo`, `corrido_fixo`, `encadeado`), upsert via `dedupeKey = hash(templateId + competencia + dataPrevista)` using InstantDB's atomic lookup-transact, never duplicates, never deletes. Same logic triggerable from CLI (`apollo rotina gerar-instancias`) for parity.

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped. This includes:
- The exact schema field(s) needed to fully specify `du_fixo`/`corrido_fixo`/`encadeado` day targeting (schema gap — see below).
- Whether `regraCompetencia="manual"` means "generation skipped" or "requires explicit per-instance value."
- `tipoPrazo` on the generated instance — original project inferred hard/soft via keyword heuristics (out of scope); simplest approach: fixed value or copy-from-template if a field is added.

### Schema gap identified (needs resolution during planning)
`shared/instant.schema.ts`'s `templatesRotina` entity has only `nome, tipoGeracao, regraCompetencia, propagarAtrasoSoft, ativo, donoId` + self-link `antecessor`/`sucessores`. There is no field encoding WHICH day/business-day-offset a `du_fixo`/`corrido_fixo` template targets. This must be added to the schema in this phase — pushing a schema addition is safe and non-breaking (InstantDB additive schema changes don't invalidate existing records). The plan must include a task that pushes the updated schema live (mirroring the Phase 1 pattern, `bun run instant:push` from `web/`).

### Reference from the original `apollo` project's intake decisions (non-binding, informative only)
- Encadeado (chained) instances get `dataPrevistaEstimada` set when the antecessor template's own instance for the same competência is still pending — this is the ONLY encadeado-specific behavior in scope. Automatic soft-deadline reallocation and chained delay propagation are explicitly OUT OF SCOPE per PROJECT.md C-09 — `propagarAtrasoSoft` exists as a schema field but its behavior is NOT implemented in this phase, only stored.
- `competencia` (YYYY-MM) is filled per `regraCompetencia` (`M0`, `M-1`, `M-2`, `M+1`, or `manual`).
- `tipoPrazo` on the generated instance is discretionary.

### Deferred Ideas (OUT OF SCOPE)
Automatic soft-deadline reallocation, chained delay propagation (the actual behavioral effect of `propagarAtrasoSoft`), and any UI/report of what the job did — all explicit v2/future scope per PROJECT.md C-09.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JOB-01 | On authenticated SPA load, compute expected `instanciasRotina` for all active `templatesRotina` in range today→end of next month across all 3 generation types, upsert via `dedupeKey`-based atomic transact, never duplicate/delete | See "Architecture Patterns", "Code Examples" (TS), "Common Pitfalls" (double-write, status-clobber) |
| JOB-02 | `apollo rotina gerar-instancias` runs the identical logic from the CLI, interoperable with SPA-generated records | See "Code Examples" (Python), verified `instantdb` 1.0.63 `lookup()` API in `cli/.venv/lib/python3.12/site-packages/instantdb/_transact.py` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compute expected instance dates (du_fixo/corrido_fixo/encadeado math) | Browser / Client (`web/src/lib/routineJob.ts`) | CLI process (`cli/apollo_cli/routine_job.py`) | Pure function, no I/O; must be duplicated (twin implementation) because there is no shared JS/Python runtime — matches the existing `bizdays.ts`/`bizdays.py` twin pattern |
| Idempotent upsert transact | Browser / Client + CLI process (both call InstantDB directly) | — | Locked by C-06: "client-side, no backend process" — there is no server tier in this architecture at all; InstantDB IS the backend |
| Business-day math (`du_fixo`) | Browser / Client (`bizdays.ts`) / CLI (`bizdays.py`) | — | Already built in Phase 2; this phase is a pure consumer, must not reimplement |
| Existing-dedupeKey read (diff before write) | Browser / Client + CLI process | InstantDB (query engine) | Both channels must query before writing to avoid clobbering user-set `status` — see Common Pitfalls |
| Schema field for day-of-month targeting | Database / Storage (`shared/instant.schema.ts`) | — | Single source of truth consumed identically by both tiers |
| SPA trigger point (once per session) | Browser / Client (`Shell.svelte` `onMount`) | — | No SSR, no middleware tier exists in this pure-SPA architecture |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@instantdb/svelte` (re-exports `@instantdb/core`) | 1.0.63 [VERIFIED: `web/package.json`, `web/node_modules/@instantdb/core/package.json`] | TS transact/query client, `lookup()` sentinel | Already the sole DB client for the whole app (C-01) |
| `instantdb` (Python) | 1.0.63 [VERIFIED: `cli/.venv/lib/python3.12/site-packages/instantdb-1.0.63.dist-info`] | Python transact/query client, `lookup()` sentinel | Already the sole DB client for the CLI |
| `bizdays` (Python) | already pinned (Phase 2) | Underlying business-day engine for `cli/apollo_cli/bizdays.py` | LOCKED by C-03, only consumed via the vendored-calendar wrapper, never called directly by this phase's code |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `Date`/`Date.UTC` (TS) | n/a | Month-boundary arithmetic (last day of month, month+1 rollover) | `corrido_fixo` clamping, "end of next month" range boundary |
| Python stdlib `calendar.monthrange` | n/a | Last-day-of-month lookup | Python mirror of the above — do not hand-roll leap-year logic |
| Python stdlib `datetime.date` | n/a | Month-shift arithmetic for `competencia` (`M0`/`M-1`/`M-2`/`M+1`) | Already used in `bizdays.py`; keep consistent |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SHA-256 cryptographic hash for `dedupeKey` | Plain string concatenation `${templateId}:${competencia}:${dataPrevista}` | CONTEXT.md's constraint text says `hash(...)` but C-06 does not require cryptographic properties — InstantDB's `dedupeKey.unique().indexed()` schema constraint is what actually prevents duplicates, not the hash function. Concatenation is deterministic, human-debuggable in `apollo rotina instancia listar` output, and trivially identical between TS and Python (no crypto-library version-drift risk). **Recommended.** |
| Query-then-diff-then-write (recommended) | Blind `update()` via `lookup()` for every computed instance every run | Blind upsert is simpler code but silently overwrites `status` on every re-run (see Common Pitfalls) — rejected. |
| `offsetDias` as one dual-purpose field | Three separate fields (`offsetDuFixo`, `offsetCorridoFixo`, `offsetEncadeado`) | A template only ever has ONE `tipoGeracao` value at a time, so only one offset is ever meaningful per record — a single field avoids dead columns and matches the existing schema's minimalism (no other entity has type-conditional field families). **Recommended: single field.** |

**Installation:** No new packages required — both SDKs are already installed and pinned.

**Version verification:**
```bash
cat web/package.json | grep instantdb        # "@instantdb/svelte": "^1.0.63"
cat cli/pyproject.toml | grep instantdb       # "instantdb>=1.0.63,<2"
```
Both verified installed at exactly `1.0.63` in the current environment (`web/node_modules/@instantdb/core/package.json`, `cli/.venv/lib/python3.12/site-packages/instantdb-1.0.63.dist-info`).

## Architecture Patterns

### System Architecture Diagram

```
             ┌─────────────────────────┐        ┌──────────────────────────┐
             │   SPA (Shell.svelte)    │        │   CLI (apollo rotina     │
             │   onMount, once/session │        │   gerar-instancias)      │
             └────────────┬────────────┘        └────────────┬─────────────┘
                          │ calls                              │ calls
                          ▼                                    ▼
             ┌─────────────────────────┐        ┌──────────────────────────┐
             │ web/src/lib/routineJob  │        │ cli/apollo_cli/          │
             │ .ts                     │        │ routine_job.py           │
             │                         │        │                          │
             │ 1. query active         │        │ 1. query active          │
             │    templatesRotina      │        │    templatesRotina       │
             │ 2. computeExpected      │        │ 2. compute_expected      │
             │    Instances(templates, │        │    _instances(templates, │
             │    today)  [PURE]       │        │    today)  [PURE]        │
             │ 3. query existing       │        │ 3. query existing        │
             │    dedupeKeys ($in)     │        │    dedupeKeys ($in)      │
             │ 4. diff -> only NEW     │        │ 4. diff -> only NEW      │
             │    dedupeKeys           │        │    dedupeKeys            │
             │ 5. transact one         │        │ 5. transact one          │
             │    lookup-update per    │        │    lookup-update per     │
             │    NEW instance         │        │    NEW instance          │
             └────────────┬────────────┘        └────────────┬─────────────┘
                          │                                    │
                          └───────────────┬────────────────────┘
                                          ▼
                          ┌───────────────────────────────┐
                          │        InstantDB               │
                          │  instanciasRotina (dedupeKey    │
                          │  unique+indexed = the ONLY      │
                          │  server-side dedup guarantee)   │
                          └───────────────────────────────┘

  Encadeado sub-flow (within step 2, TOPOLOGICAL — antecessor before sucessor):
    for each template with tipoGeracao="encadeado":
      resolve antecessor's ALREADY-COMPUTED dataPrevista for same competência
        (from this run's in-memory result set, not a fresh instance query)
      if no antecessor instance is being generated this run
        -> query InstantDB for antecessor's existing instance, same competência
      dataPrevista = antecessorDataPrevista + offsetDias business days [ASSUMED]
      if antecessor instance status != "concluida" (or doesn't exist yet)
        -> ALSO set dataPrevistaEstimada = dataPrevista (flag: not yet final)
      else
        -> dataPrevistaEstimada left unset
```

### Recommended Project Structure
```
shared/
└── instant.schema.ts        # + offsetDias field on templatesRotina (this phase)
web/src/lib/
├── routineJob.ts             # NEW — pure compute + query/diff/transact orchestration
├── db.ts                     # unchanged, already exports db/id/lookup
└── Shell.svelte              # + onMount hook calling routineJob.runRoutineInstanceJob()
cli/apollo_cli/
├── routine_job.py            # NEW — Python mirror of routineJob.ts
└── entities/rotina.py        # + `gerar-instancias` command wired to routine_job.py
```

### Pattern 1: Lookup-based idempotent upsert (write-only-the-diff)
**What:** Query existing `dedupeKey`s first; only issue a transact op for dedupeKeys that don't yet exist. Never call `update()` via `lookup()` for a dedupeKey known to already exist.
**When to use:** Every run of this job, both channels.
**Example (TS):**
```typescript
// Source: verified against web/node_modules/@instantdb/core/src/instatx.ts (lookup())
// and web/node_modules/@instantdb/core/src/queryTypes.ts ($in operator)
import { db, id, lookup } from "./db";

interface ExpectedInstance {
  dedupeKey: string;
  templateId: string;
  dataPrevista: string; // ISO
  dataPrevistaEstimada?: string;
  competencia: string;
  tipoPrazo: string;
}

export async function runRoutineInstanceJob(donoId: string, today: string): Promise<void> {
  const { data } = await db.queryOnce({
    templatesRotina: { $: { where: { ativo: true, donoId } } },
  } as never);
  const templates = (data as { templatesRotina: unknown[] }).templatesRotina;

  const expected = computeExpectedInstances(templates as never, today); // pure, see below
  if (expected.length === 0) return;

  const existing = await db.queryOnce({
    instanciasRotina: {
      $: { where: { dedupeKey: { $in: expected.map((e) => e.dedupeKey) } } },
    },
  } as never);
  const existingKeys = new Set(
    (existing.data as { instanciasRotina: { dedupeKey: string }[] }).instanciasRotina.map(
      (r) => r.dedupeKey,
    ),
  );

  const toCreate = expected.filter((e) => !existingKeys.has(e.dedupeKey));
  if (toCreate.length === 0) return; // idempotent no-op on re-run

  const chunks = toCreate.map((e) =>
    db.tx.instanciasRotina[lookup("dedupeKey", e.dedupeKey)]
      .update({
        dataPrevista: e.dataPrevista,
        ...(e.dataPrevistaEstimada ? { dataPrevistaEstimada: e.dataPrevistaEstimada } : {}),
        competencia: e.competencia,
        tipoPrazo: e.tipoPrazo,
        status: "pendente", // ONLY set on the create path — never re-included on re-run
        donoId,
      })
      .link({ template: e.templateId }),
  );
  await db.transact(chunks);
}
```
**Example (Python, mirrors the above exactly):**
```python
# Source: verified against cli/.venv/lib/python3.12/site-packages/instantdb/_transact.py
from instantdb import Instant, lookup

def run_routine_instance_job(client: Instant, dono_id: str, today: str) -> None:
    templates = client.query(
        {"templatesRotina": {"$": {"where": {"ativo": True, "donoId": dono_id}}}}
    )["templatesRotina"]

    expected = compute_expected_instances(templates, today)  # pure, see below
    if not expected:
        return

    existing = client.query(
        {
            "instanciasRotina": {
                "$": {"where": {"dedupeKey": {"$in": [e["dedupeKey"] for e in expected]}}}
            }
        }
    )["instanciasRotina"]
    existing_keys = {r["dedupeKey"] for r in existing}

    to_create = [e for e in expected if e["dedupeKey"] not in existing_keys]
    if not to_create:
        return

    chunks = [
        client.tx.instanciasRotina[lookup("dedupeKey", e["dedupeKey"])]
        .update(
            {
                "dataPrevista": e["dataPrevista"],
                **(
                    {"dataPrevistaEstimada": e["dataPrevistaEstimada"]}
                    if e.get("dataPrevistaEstimada")
                    else {}
                ),
                "competencia": e["competencia"],
                "tipoPrazo": e["tipoPrazo"],
                "status": "pendente",
                "donoId": dono_id,
            }
        )
        .link({"template": e["templateId"]})
        for e in to_create
    ]
    client.transact(chunks)
```

### Pattern 2: `du_fixo` — Nth business day of month
**What:** `bizdays.ts`/`bizdays.py` expose only `isBusinessDay`, `addBusinessDays` (strictly-after semantics — see file docstring), `nextBusinessDay`. There is NO "Nth business day of month" helper — it must be composed.
**Verified algorithm** (derived directly from reading `addBusinessDays`'s loop in `web/src/lib/bizdays.ts:102-129` and `cli/apollo_cli/bizdays.py:99-119` — both count strictly-after business days from a starting date):
```typescript
// Source: composed from web/src/lib/bizdays.ts's documented "strictly-after" semantics
function nthBusinessDayOfMonth(year: number, month: number, n: number): string {
  const day1 = formatIso(year, month, 1);
  // day1 itself counts as business-day #1 if it IS a business day;
  // otherwise the first business day on/after day1 is #1 (addBusinessDays(day1,1)
  // is correct here specifically because day1 is NOT a business day, so
  // "next business day strictly after day1" == "first business day on/after day1").
  const firstBizDay = isBusinessDay(day1) ? day1 : addBusinessDays(day1, 1);
  return n <= 1 ? firstBizDay : addBusinessDays(firstBizDay, n - 1);
}
```
**Confidence:** HIGH — derived from reading the actual shipped `addBusinessDays` implementation, not from training-data assumptions about the `bizdays` library's own helpers (which are explicitly forbidden by C-03 anyway — `Calendar.load("ANBIMA")`/built-in nth-day helpers must never be used).

### Pattern 3: `corrido_fixo` — Nth calendar day, clamped
**What:** Clamp to the last day of the month when `n` exceeds it (e.g., day 31 of February) rather than erroring — a silent skip would violate "for all active templatesRotina."
```typescript
function nthCalendarDayOfMonth(year: number, month: number, n: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // day 0 of next month
  return formatIso(year, month, Math.min(n, lastDay));
}
```
```python
import calendar as pycalendar  # aliased — avoid confusion with the vendored
                                # anbima-calendar.json concept used in bizdays.py

def nth_calendar_day_of_month(year: int, month: int, n: int) -> str:
    last_day = pycalendar.monthrange(year, month)[1]
    return date(year, month, min(n, last_day)).isoformat()
```
**Confidence:** HIGH — standard, well-known date arithmetic; no external dependency risk.

### Pattern 4: Range computation ("today → end of next month")
```typescript
function endOfNextMonth(today: string): string {
  const [y, m] = today.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextMonthYear = m === 12 ? y + 1 : y;
  const lastDay = new Date(Date.UTC(nextMonthYear, nextMonth, 0)).getUTCDate();
  return formatIso(nextMonthYear, nextMonth, lastDay);
}
```
Only TWO calendar months ever need to be evaluated per template (`month(today)` and `month(today)+1`) since "today → end of next month" can never span more than two distinct months. For `month(today)`, filter out any computed date `< today` (already past) but keep dates `>= today` in the same month.

### Anti-Patterns to Avoid
- **Blind `update()` on every computed instance, every run:** Overwrites `status` back to a default value even when the user already marked it `concluida` in the SPA/CLI — silently destroys real user data on the next SPA load. Always diff against existing `dedupeKey`s first (Pattern 1).
- **Using `bizdays` library's built-in Nth-business-day or `Calendar.load("ANBIMA")` helpers:** FORBIDDEN by C-03 (see `cli/apollo_cli/bizdays.py` docstring) — would silently diverge from the vendored calendar. Compose Nth-business-day logic from the already-vendored `isBusinessDay`/`addBusinessDays` only.
- **Re-implementing business-day math inline in the job:** `du_fixo` must call `bizdays.ts`/`bizdays.py`, never hand-roll weekday/holiday checks — this is the exact violation category RNF-01-style constraints exist to prevent in the sibling project and is implicitly required here by C-03's "no manual calculation" spirit.
- **Cryptographic hash bikeshedding for `dedupeKey`:** Do not introduce `crypto.subtle.digest` (async, adds complexity) or Python `hashlib` — plain string concatenation is deterministic, sufficient, and avoids any TS/Python hash-output mismatch risk.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate-prevention under concurrent/repeated runs | A manual "check if exists, then create" two-request pattern with a race window | InstantDB's `dedupeKey.unique().indexed()` constraint (already in schema) + `lookup()`-keyed `update()` | The schema-level unique constraint is the actual atomicity guarantee — the app-level query-then-diff step (Pattern 1) is a *courtesy* to avoid clobbering `status`, not the source of the idempotency guarantee itself. Even if two runs raced past the diff check, the unique constraint on `dedupeKey` still prevents two rows with the same key from ever both persisting. |
| Business-day arithmetic | Any inline weekday/holiday check | `web/src/lib/bizdays.ts` / `cli/apollo_cli/bizdays.py` (Phase 2, already built and cross-validated) | LOCKED by C-03; this phase is purely a consumer |
| Month-boundary / last-day-of-month math | Manual leap-year tables | `Date.UTC(y, m, 0)` (TS) / `calendar.monthrange` (Python stdlib) | Both are timezone-safe, well-tested stdlib primitives |

**Key insight:** The only genuinely new logic in this phase is (a) the day-of-month targeting math (Patterns 2-3) and (b) the query-then-diff upsert orchestration (Pattern 1). Everything else is composition of already-verified Phase 2 primitives.

## Common Pitfalls

### Pitfall 1: Status-clobbering on re-run
**What goes wrong:** A blind `update()` upsert (no pre-query) resets `status` to `"pendente"` on every SPA load, even for instances the user already marked `"concluida"`.
**Why it happens:** InstantDB's `update()` merges only the attrs you pass — but if you pass `status: "pendente"` unconditionally (matching every computed instance, existing or not), it overwrites the field every time.
**How to avoid:** Query existing `dedupeKey`s first (`$in` filter), only include `status` in the payload for genuinely-new instances (Pattern 1).
**Warning signs:** VERIFY-04's "no duplicate and no missing records" check would still pass even with this bug (row count is unaffected) — a naive test would NOT catch it. The plan must add an explicit test: mark an instance `concluida`, re-run the job, assert `status` is still `concluida`.

### Pitfall 2: `create()` cannot take a `lookup()` ref
**What goes wrong:** Calling `client.tx.instanciasRotina[lookup(...)].create(...)` throws/misbehaves.
**Why it happens:** Verified directly in `_transact.py`'s `_TxChunk.create()`: "No opts: `create` is strict-insert. Only update/merge take opts" — `create` expects a real, pre-minted id, not a lookup sentinel. Lookup-based upsert semantics only exist on `.update()`/`.merge()`.
**How to avoid:** Always use `.update()` (not `.create()`) with a `lookup()` ref for the upsert path, exactly as in Pattern 1.
**Warning signs:** Runtime error or silent no-op on the transact call.

### Pitfall 3: `regraCompetencia` is unvalidated free text
**What goes wrong:** The schema field is `i.string()` with no enum; the CLI's `--regra-competencia` option is also plain (non-`Choice`) text (verified in `cli/apollo_cli/entities/rotina.py:120-127`). A template with `regraCompetencia="M-1 "` (trailing space) or a typo silently falls through any `switch`/`if` chain.
**How to avoid:** The job's competencia-mapping function must have an explicit `default`/`else` branch that treats any unrecognized value identically to `"manual"` (skip auto-competencia for that template) rather than crashing or silently defaulting to `"M0"`.
**Warning signs:** A template silently stops generating instances after a typo — log/report which templates were skipped and why (even though no UI surfaces this per C-09, `apollo rotina gerar-instancias`'s JSON output should list skipped template ids).

### Pitfall 4: `offsetDias` missing on legacy/test templates
**What goes wrong:** Phase 3/4 already created `templatesRotina` test records without any day-offset field (it didn't exist yet). After the schema push, those records have `offsetDias: undefined`.
**How to avoid:** The job must skip (not crash on) any active template missing `offsetDias` (for `du_fixo`/`corrido_fixo`/`encadeado` — all three need it per the recommended single-field design) and report it in the job's output, exactly like Pitfall 3's unrecognized-`regraCompetencia` case.
**Warning signs:** A `TypeError`/`undefined` propagating into `addBusinessDays`/date math and crashing the whole job for ALL templates, not just the misconfigured one — the job must isolate per-template failures so one bad template doesn't block instance generation for the rest.

### Pitfall 5: `$in` query on an empty array
**What goes wrong:** If `computeExpectedInstances` returns zero entries (e.g., no active templates), querying `dedupeKey: { $in: [] }` may behave unexpectedly (return-all vs return-none is an InstantDB implementation detail not verified in this session).
**How to avoid:** Short-circuit before the existing-keys query when `expected.length === 0` (already shown in Pattern 1's example) — never rely on `$in: []` semantics.

### Pitfall 6: Perms — the create-path of an upsert still needs `newData.donoId`
**What goes wrong:** `instant.perms.ts`'s `create` rule checks `auth.id == newData.donoId`. Since a `lookup()`-keyed `update()` on a non-existent record performs a create under the hood, omitting `donoId` from the payload (or setting it to a stale value) causes the transact to be rejected by perms on first-run, but might *appear* to work on re-run if the record already exists (since `update`'s rule only checks `data.donoId`, not `newData`).
**How to avoid:** Always include `donoId: session.user_id` / `auth.user.id` in every upsert payload, matching the existing `create_entity()`/`EntityScreen.svelte` convention exactly.

## Code Examples

### Encadeado ordering (topological pass)
```typescript
// Source: composed — no existing precedent in this codebase for multi-pass
// dependency resolution; templates form a tree via the single-level
// antecessor/sucessores self-link (shared/instant.schema.ts).
function computeExpectedInstances(
  templates: TemplateRow[],
  today: string,
): ExpectedInstance[] {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const results = new Map<string, ExpectedInstance[]>(); // templateId -> instances

  // Non-chained templates first (du_fixo/corrido_fixo have no dependency).
  for (const t of templates) {
    if (t.tipoGeracao !== "encadeado") {
      results.set(t.id, computeFixedInstances(t, today));
    }
  }
  // Chained templates: process only once antecessor is resolved. Guard
  // against cycles/missing antecessor with a bounded pass count equal to
  // the template count (a correctly-modeled chain never needs more passes
  // than there are templates).
  let remaining = templates.filter((t) => t.tipoGeracao === "encadeado");
  for (let pass = 0; pass < templates.length && remaining.length > 0; pass++) {
    remaining = remaining.filter((t) => {
      const antecessorId = t.antecessor?.id;
      if (!antecessorId || !results.has(antecessorId)) return true; // not ready yet
      results.set(t.id, computeChainedInstances(t, byId.get(antecessorId)!, results.get(antecessorId)!, today));
      return false;
    });
  }
  // Any templates still unresolved after N passes have a cycle or a
  // dangling antecessor id — skip and report, never crash the whole job.
  return [...results.values()].flat();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Original `apollo` (Litestar/SQLAlchemy) job likely ran server-side (cron/background worker) | This job runs entirely client-side, triggered by SPA load or CLI invocation — no server process exists at all | This migration (C-06, LOCKED) | No scheduling infra needed, but also no guarantee the job runs on a schedule — it only runs when a human opens the SPA or runs the CLI command. Acceptable per PROJECT.md (single-user, human-operated). |

**Deprecated/outdated:** N/A — no InstantDB API deprecations found for `lookup()`/`transact()`/`$in` in the installed 1.0.63 release (verified directly against source, not changelog-checked — flag as MEDIUM confidence for "this API is stable," HIGH confidence for "this API exists and works as described" since read directly from the installed package).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `offsetDias: i.number().optional()` is the correct single-field design for all three generation types (dual-interpreted by `tipoGeracao`) | Standard Stack / User Constraints schema gap | If the user actually wants three separate fields or a different name, the plan's schema-push task and every job function signature needs revision — but since InstantDB schema changes are additive/non-breaking, this is a cheap fix even if wrong. |
| A2 | Encadeado's `dataPrevista` = antecessor's `dataPrevista` (same competência) + `offsetDias` **business** days (not calendar days), computed unconditionally regardless of antecessor completion status; `dataPrevistaEstimada` is set (mirroring the same value) ONLY when antecessor's instance is missing or not `status="concluida"` | Architecture Patterns (System Diagram, encadeado sub-flow) | This is the single largest interpretive leap in this research — CONTEXT.md's reference note is deliberately non-binding and says only "gets dataPrevistaEstimada set when antecessor pending... this is the ONLY encadeado-specific behavior in scope." It does NOT specify whether `dataPrevista` should also always be populated (required by schema) or whether encadeado should use business or calendar days for its offset. If wrong, the encadeado generation type produces a different but still internally-consistent and idempotent result — dedupeKey correctness is not at risk (dataPrevista is always some deterministic value), only the exact date value is at risk of not matching the user's real intent. **Recommend confirming this interpretation explicitly during planning/discuss before writing the encadeado task.** |
| A3 | `status` field's minimal value set is `"pendente"` / `"concluida"` (no enum enforced in schema) | Common Pitfalls (Pitfall 1), Code Examples | Matches existing test-fixture convention (`cli/tests/test_rotina_instancia.py` seeds `"status": "pendente"`) — low risk, but if the user wants additional states (e.g., `"atrasada"`), the CLI's `rotina instancia status` command already accepts arbitrary free text so no code changes needed, only documentation. |
| A4 | `regraCompetencia="manual"` (or any unrecognized value) means "skip auto-competencia for this template" (no instance generated that cycle) rather than "require an explicit per-instance value" | Common Pitfalls (Pitfall 3) | CONTEXT.md explicitly defers this to planner's discretion. If wrong, some templates the user expected to generate instances silently won't — mitigated by recommending the job's CLI output list which templates were skipped and why. |
| A5 | `dedupeKey` = plain string concatenation `${templateId}:${competencia}:${dataPrevista}`, not a cryptographic hash | Standard Stack (Alternatives Considered) | If the user insists on the literal word "hash" from C-06's text meaning a real hash function, this is a one-line change (wrap the concatenation in SHA-256) with zero structural impact — low risk. |
| A6 | Nth-business-day-of-month composition logic (Pattern 2) is correct for the "strictly-after" `addBusinessDays` semantics as documented in `bizdays.ts`'s own comments | Architecture Patterns (Pattern 2) | Derived by close reading of the shipped implementation, not executed/tested in this research session — the plan MUST include a unit test asserting e.g. "5th business day of a month starting on a Saturday" against a hand-computed expected date before relying on this in production. |

**If this table is empty:** N/A — see rows above. A2 is the highest-priority item for the planner/discuss step to resolve or explicitly accept.

## Open Questions

1. **Should encadeado's offset be business days or calendar days?**
   - What we know: `du_fixo` is explicitly business-day-based, `corrido_fixo` is explicitly calendar-day-based. Encadeado's own nature ("N business/calendar days after antecessor") is ambiguous per the phase's `additional_context` prompt itself.
   - What's unclear: Whether `offsetDias` for an encadeado template should always mean business days (consistent with the "dias úteis"-centric domain), or should encadeado templates inherit their antecessor's day-counting convention.
   - Recommendation: Default to business days (A2) for consistency with `du_fixo` and the domain's general ANBIMA-business-day orientation; confirm with user before/during planning if this matters for real-world templates being modeled.

2. **Does `$in: []` (empty array) on an InstantDB where-clause return zero rows or all rows?**
   - What we know: The TS type system allows it (`$in?: V[]` with no non-empty constraint at that level, though `NonEmpty<...>` wraps the outer complex-value type — ambiguous whether an empty array specifically is rejected or passed through).
   - What's unclear: Behavior was not executed/tested against the live InstantDB backend in this research session.
   - Recommendation: Pattern 1's short-circuit (`if (expected.length === 0) return`) sidesteps this entirely — the plan should keep that guard rather than relying on empty-array semantics.

3. **Should the CLI `gerar-instancias` command print which templates were skipped (missing `offsetDias`, unrecognized `regraCompetencia`, or encadeado cycle) as structured JSON?**
   - What we know: `crud_helpers.emit()` is the existing single-JSON-document-per-command convention.
   - What's unclear: Exact shape — CONTEXT.md's deferred-scope list excludes "any UI/report of what the job did," but that appears to be about the SPA specifically, not the CLI's own diagnostic output (which every other command already emits).
   - Recommendation: Emit `{"created": [...ids], "skipped": [{"templateId": ..., "reason": ...}]}` — cheap, consistent with existing CLI conventions, doesn't require new UI.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@instantdb/svelte` / `@instantdb/core` | JOB-01 (TS transact/query/lookup) | ✓ | 1.0.63 | — |
| `instantdb` (Python) | JOB-02 (CLI transact/query/lookup) | ✓ | 1.0.63 | — |
| `bizdays` (Python, via `cli/apollo_cli/bizdays.py`) | `du_fixo` business-day math | ✓ | already pinned (Phase 2) | — |
| Live InstantDB app + `.env.instantdb` credentials | Both channels, schema push, e2e tests | ✓ (used throughout Phases 1-4 test suites) | — | — |
| Playwright (`@playwright/test`) | e2e idempotency test (double-run assertion) | ✓ | ^1.62.1 | — |

**Missing dependencies with no fallback:** None identified.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (web) | `bun test` (unit, e.g. `web/src/lib/bizdays.test.ts`) + Playwright (`web/e2e/*.spec.ts`, live/e2e) |
| Framework (cli) | `pytest`, `pytest.mark.live` convention (see `cli/tests/test_rotina_instancia.py`) |
| Config file | `web/playwright.config.ts`; CLI test config in `cli/pyproject.toml` |
| Quick run command (web unit) | `bun test src` |
| Quick run command (cli) | `uv run --project cli pytest cli/tests -k routine_job -x` (once new test file exists) |
| Full suite command | `bun test src && bun run --cwd web test:e2e` (web); `uv run --project cli pytest cli/tests` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JOB-01 | SPA-load job computes + upserts expected instances, all 3 generation types | e2e (Playwright, live InstantDB) | `bun run --cwd web test:e2e -g "routine job"` | ❌ Wave 0 — new spec needed |
| JOB-01 | Nth-business-day / Nth-calendar-day pure math is correct | unit | `bun test src -t "routineJob"` | ❌ Wave 0 — new test file `web/src/lib/routineJob.test.ts` |
| JOB-02 | CLI `gerar-instancias` produces identical dedupeKeys as SPA for the same templates | live/integration | `uv run --project cli pytest cli/tests/test_routine_job.py -x` | ❌ Wave 0 — new test file |
| VERIFY-04 (Phase 6, but this phase's job is what's under test) | Interrupted/re-run job leaves no duplicates | e2e/live | double-invoke the job (SPA twice via Playwright, CLI twice via `execFileSync`), assert record count unchanged + assert no duplicate `dedupeKey`s via a live query | ❌ Wave 0 |
| (new, Pitfall 1) | Re-run does not clobber a manually-set `status="concluida"` | live/integration | seed via admin fixture (pattern already in `web/e2e/fixtures/instancia-admin-fixture.ts`), set status, re-run job, assert unchanged | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** unit tests for the pure date-math functions (`bun test src`, `pytest cli/tests/test_routine_job.py -k "not live"`)
- **Per wave merge:** full live/e2e suite (both channels) — these tests require a real InstantDB app and the magic-code auth flow per PROJECT.md C-10
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `web/src/lib/routineJob.test.ts` — unit coverage for `nthBusinessDayOfMonth`, `nthCalendarDayOfMonth`, `endOfNextMonth`, competencia-shift math
- [ ] `web/e2e/routine-job.spec.ts` — e2e: SPA load generates expected instances, double-load produces zero new records, dedupeKey uniqueness assertion via a live query
- [ ] `cli/tests/test_routine_job.py` — unit (pure math) + live (`pytest.mark.live`) coverage mirroring the TS e2e assertions, plus a cross-channel interoperability test (CLI-generated dedupeKey recognized/not duplicated by a subsequent SPA-style run, and vice versa)
- [ ] Schema-push verification: after adding `offsetDias`, existing Phase 3/4 test templates (no `offsetDias` set) must not crash `listar`/`editar` — add a quick regression check if not already covered by existing `test_crud_rotina_template.py`

*(If no gaps: not applicable — see checklist above.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | Job only runs with an authenticated session on both channels — already enforced by C-05's existing perms; this phase adds no new auth surface |
| V3 Session Management | no | No new session mechanism introduced |
| V4 Access Control | yes | `instant.perms.ts`'s existing `donoId`-scoped rules (verified: `create`/`update`/`delete` all gate on `auth.id == data.donoId` / `newData.donoId`) — the job's writes must always include `donoId` (Pitfall 6) or the transact is rejected server-side, which is the correct defense-in-depth behavior, not a bug to work around |
| V5 Input Validation | yes | `regraCompetencia`/`tipoGeracao` are free-text/loosely-typed; job must validate (Pitfall 3) rather than trust |
| V6 Cryptography | no (per A5) | `dedupeKey` deliberately avoids cryptographic hashing — no crypto surface introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user data leakage via a missing/wrong `donoId` on upsert | Information Disclosure / Elevation of Privilege | `instant.perms.ts`'s existing `create`/`update` rules reject any transact where `newData.donoId`/`data.donoId` != `auth.id` — verified already in place; the job must never bypass this (no admin client on the SPA path, and the CLI must use `session_client()`, never `login_client()`, matching `crud_helpers.py`'s existing convention) |
| Silent data loss via status-clobbering upsert | Tampering (self-inflicted, not adversarial, but data-integrity-critical) | Pattern 1 (query-then-diff) |

## Sources

### Primary (HIGH confidence)
- `cli/.venv/lib/python3.12/site-packages/instantdb/_transact.py` — `lookup()`, `_TxChunk.create()`/`update()` semantics (create rejects lookup, update/merge accept opts) — read directly
- `cli/.venv/lib/python3.12/site-packages/instantdb/__init__.py` — public API surface confirmation
- `web/node_modules/@instantdb/core/src/instatx.ts` — TS `lookup()` implementation, byte-identical sentinel format (`lookup__attr__jsonvalue`) to the Python version
- `web/node_modules/@instantdb/core/src/queryTypes.ts` — `$in`, `$gte`, `$lte` where-clause operators confirmed present in the installed version's type definitions
- `web/src/lib/bizdays.ts`, `cli/apollo_cli/bizdays.py` — read in full; `addBusinessDays`'s "strictly-after" loop semantics verified directly from source, not from `bizdays` library docs
- `shared/instant.schema.ts`, `shared/instant.perms.ts` — current schema/perms state, read in full
- `cli/apollo_cli/entities/rotina.py`, `cli/apollo_cli/crud_helpers.py`, `cli/apollo_cli/instant_client.py` — existing CLI conventions (session client, donoId injection, error handling)
- `web/src/lib/entities/defs/templatesRotina.ts`, `instanciasRotina.ts`, `web/src/lib/entities/EntityScreen.svelte`, `web/src/App.svelte`, `web/src/lib/Shell.svelte` — existing SPA structure, confirmed `onMount`-in-`Shell.svelte` is the correct "once per authenticated session" hook point (Shell only renders inside `<SignedIn>`)
- `web/e2e/fixtures/instancia-admin-fixture.ts`, `web/e2e/entities-rotina-log.spec.ts`, `cli/tests/test_rotina_instancia.py` — existing test conventions and fixture patterns for `instanciasRotina` (admin-bypass seeding, since neither channel can create instances directly)
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/05-idempotent-routine-instance-job/05-CONTEXT.md` — locked constraints and phase scope

### Secondary (MEDIUM confidence)
- None used — all claims above were verifiable directly against installed source in this session.

### Tertiary (LOW confidence)
- InstantDB's exact runtime behavior for `$in: []` (empty array) — not executed/tested, flagged as Open Question 2 rather than asserted.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both SDK versions read directly from installed packages, no version guessing
- Architecture: HIGH for the upsert/query mechanics (read from source); MEDIUM for the day-of-month math composition (logically derived, not executed); LOW-MEDIUM for the encadeado business semantics (CONTEXT.md itself flags this as underspecified — see A2)
- Pitfalls: HIGH — Pitfalls 1, 2, 6 derived directly from source-code behavior; Pitfalls 3-5 derived from direct reading of existing schema/CLI code

**Research date:** 2026-08-09
**Valid until:** 30 days (stable local dependencies, no external API drift risk — InstantDB SDK is pinned and already installed, not fetched live)
