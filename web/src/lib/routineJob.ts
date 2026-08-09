/**
 * Deterministic, side-effect-free core of the routine-instance generation job.
 *
 * This module is PURE: no database import, no `fetch`, no filesystem access.
 * It computes the set of routine instances that OUGHT to exist for a given
 * set of active templates as of `today`, without ever writing anything —
 * plan 05-03 is responsible for diffing this result against InstantDB and
 * performing the actual writes.
 *
 * The identical algorithm is implemented in Python at
 * `cli/apollo_cli/routine_job.py` (plan 05-05), and
 * `shared/routine-job.testcases.json` is the single cross-runtime fixture
 * proving the two implementations never silently diverge — the same pattern
 * `shared/bizdays.testcases.json` established for `bizdays.ts`/`bizdays.py`
 * in Phase 2.
 *
 * `dedupeKey` is deliberately plain string concatenation
 * (`${templateId}:${competencia}:${dataPrevista}`), NOT a derived hash of
 * any kind (RESEARCH Assumption A5). The uniqueness guarantee lives in the
 * `instanciasRotina.dedupeKey.unique()` schema constraint, not in the key's
 * entropy — plain concatenation stays human-debuggable in
 * `apollo rotina instancia listar` output and removes any risk of a TS/Python
 * hash-output mismatch.
 *
 * Plan 05-04 completes the type coverage with `corrido_fixo` and
 * `encadeado`. `corrido_fixo` reuses the same range/dedupeKey/competencia
 * tail as `du_fixo` (factored into `computeFixedInstances`) but dates each
 * instance off `nthCalendarDayOfMonth` instead of `nthBusinessDayOfMonth`,
 * and — deliberately — never snaps the resulting date onto a business day;
 * a calendar-day rule means exactly that, including landing on a weekend or
 * an ANBIMA holiday.
 *
 * `encadeado`'s semantics are the phase's one interpretive decision,
 * recorded here so a reader never has to reconstruct them from the plan:
 *
 * - **D-05-B**: `offsetDias` counts BUSINESS days after the antecessor
 *   instance's `dataPrevista`, via `addBusinessDays`.
 * - **D-05-D**: `competencia` is INHERITED verbatim from the antecessor
 *   instance being chained off; the encadeado template's own
 *   `regraCompetencia` is never consulted. An encadeado template with
 *   `regraCompetencia: "manual"` still generates instances — that field is
 *   simply not part of its date derivation.
 * - **D-05-E**: `dataPrevistaEstimada` (mirroring `dataPrevista`) is set
 *   when the antecessor's instance for that competencia is EITHER not yet
 *   persisted (computed in this same run) OR persisted with
 *   `status !== "concluida"`. It is omitted once the antecessor's instance
 *   reads `concluida`.
 * - **D-05-F**: the antecessor's own PLANNED `dataPrevista` is used even
 *   when the antecessor is late — delay propagation is out of scope
 *   (PROJECT.md C-09). This keeps the encadeado `dedupeKey` stable across
 *   runs; a key derived from a moving date would re-create the successor on
 *   every run and destroy idempotency.
 *
 * `propagarAtrasoSoft` is stored on the template but never read anywhere in
 * this module (C-09) — delay propagation is explicitly out of scope.
 *
 * Chained (`encadeado`) templates are resolved via a bounded multi-pass
 * topological sweep (at most `templates.length` passes): non-chained
 * templates resolve first, then chained templates resolve once their
 * antecessor's instance set is known. Anything still unresolved after the
 * bound has a cycle or a dangling antecessor and is reported in `skipped`
 * as `antecessor_ciclico` rather than looping forever.
 */

import { addBusinessDays, isBusinessDay } from "./bizdays";
import { db, lookup } from "./db";

export const TIPO_PRAZO_GERADO = "soft"; // D-05-C
export const STATUS_INICIAL = "pendente";
export const REGRAS_COMPETENCIA_SUPORTADAS = ["M0", "M-1", "M-2", "M+1"] as const;

export interface TemplateRow {
  id: string;
  tipoGeracao: string;
  regraCompetencia: string;
  offsetDias?: number | null;
  ativo?: boolean;
  antecessor?: { id: string } | null; // templateAntecessor self-link, used by 05-04
}

export interface ExistingInstance {
  dedupeKey: string;
  templateId: string;
  competencia: string;
  dataPrevista: string; // ISO YYYY-MM-DD
  status: string;
}

export interface ExpectedInstance {
  dedupeKey: string;
  templateId: string;
  competencia: string; // YYYY-MM
  dataPrevista: string; // ISO YYYY-MM-DD
  dataPrevistaEstimada?: string; // set by 05-04 (encadeado) only
  tipoPrazo: string; // always TIPO_PRAZO_GERADO
}

export type SkipReason =
  | "tipo_geracao_desconhecido"
  | "offset_dias_ausente"
  | "offset_dias_invalido"
  | "regra_competencia_nao_suportada"
  | "antecessor_ausente" // encadeado template has no antecessor link
  | "antecessor_sem_instancia" // antecessor produced no instance, persisted or computed
  | "antecessor_ciclico"; // unresolved after the bounded sweep: cycle or dangling antecessor

export interface SkippedTemplate {
  templateId: string;
  reason: SkipReason;
}

export interface ComputeResult {
  expected: ExpectedInstance[]; // sorted ascending by dedupeKey
  skipped: SkippedTemplate[]; // sorted ascending by templateId, then reason
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function formatIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * Last calendar day of `(year, month)`, 1-based month. Uses the
 * `Date.UTC(year, month, 0)` idiom: passing day `0` for the FOLLOWING month
 * rolls back to the last day of the target month, correctly handling leap
 * Februaries without a hand-rolled leap-year check.
 */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function endOfNextMonth(today: string): string {
  const [yearStr, monthStr] = today.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  // Next month, with year rollover for December.
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;

  const lastDay = lastDayOfMonth(nextMonthYear, nextMonth);
  return formatIso(nextMonthYear, nextMonth, lastDay);
}

export function nthBusinessDayOfMonth(year: number, month: number, n: number): string {
  const day1 = formatIso(year, month, 1);
  const first = isBusinessDay(day1) ? day1 : addBusinessDays(day1, 1);
  return n <= 1 ? first : addBusinessDays(first, n - 1);
}

export function nthCalendarDayOfMonth(year: number, month: number, n: number): string {
  const lastDay = lastDayOfMonth(year, month);
  const clampedDay = Math.min(n, lastDay);
  return formatIso(year, month, clampedDay);
}

export function shiftCompetencia(dataPrevista: string, regraCompetencia: string): string | null {
  // Deliberately NOT trimmed: a trailing/leading space is a distinct,
  // unrecognized value here, not a formatting nuisance to tolerate. Any
  // normalization of stored values is the write path's responsibility, not
  // this pure function's (RESEARCH Pitfall 3).
  if (!(REGRAS_COMPETENCIA_SUPORTADAS as readonly string[]).includes(regraCompetencia)) {
    return null;
  }

  const [yearStr, monthStr] = dataPrevista.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-based

  const deltaByRule: Record<(typeof REGRAS_COMPETENCIA_SUPORTADAS)[number], number> = {
    M0: 0,
    "M-1": -1,
    "M-2": -2,
    "M+1": 1,
  };
  const delta = deltaByRule[regraCompetencia as (typeof REGRAS_COMPETENCIA_SUPORTADAS)[number]];

  // month is 1-based; Date.UTC takes 0-based months, so `month - 1 + delta`
  // is the 0-based target month, which Date.UTC normalizes (including year
  // rollover in either direction) via its wraparound arithmetic.
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1, 2)}`;
}

export function buildDedupeKey(
  templateId: string,
  competencia: string,
  dataPrevista: string,
): string {
  return `${templateId}:${competencia}:${dataPrevista}`;
}

interface OffsetValidation {
  ok: boolean;
  reason?: SkipReason;
}

function validateOffsetDias(
  offsetDias: number | null | undefined,
  minValue: number,
): OffsetValidation {
  if (offsetDias === undefined || offsetDias === null) {
    return { ok: false, reason: "offset_dias_ausente" };
  }
  if (!Number.isInteger(offsetDias) || offsetDias < minValue) {
    return { ok: false, reason: "offset_dias_invalido" };
  }
  return { ok: true };
}

type NthDayFn = (year: number, month: number, n: number) => string;

/**
 * Compute the `du_fixo`/`corrido_fixo` expected instances for a single
 * template across the two candidate months touching
 * `[today, endOfNextMonth(today)]`. `nthDayFn` supplies the type-specific
 * date rule (`nthBusinessDayOfMonth` or `nthCalendarDayOfMonth`) — everything
 * else (range filter, competencia derivation, dedupeKey, tipoPrazo) is
 * shared between the two fixed-offset generation types. Throws on any
 * underlying business-day computation error (e.g. `CalendarRangeError`) so
 * the caller's per-template try/catch can convert it into a `skipped` entry
 * — this function itself never catches.
 */
function computeFixedInstances(
  template: TemplateRow,
  today: string,
  rangeStart: string,
  rangeEnd: string,
  minOffsetDias: number,
  nthDayFn: NthDayFn,
): { instances: ExpectedInstance[] } | { skipReason: SkipReason } {
  const offsetValidation = validateOffsetDias(template.offsetDias, minOffsetDias);
  if (!offsetValidation.ok) {
    return { skipReason: offsetValidation.reason as SkipReason };
  }
  const offsetDias = template.offsetDias as number;

  const [todayYearStr, todayMonthStr] = today.split("-");
  const todayYear = Number(todayYearStr);
  const todayMonth = Number(todayMonthStr);
  const nextMonth = todayMonth === 12 ? 1 : todayMonth + 1;
  const nextMonthYear = todayMonth === 12 ? todayYear + 1 : todayYear;

  const candidateMonths: Array<[number, number]> = [
    [todayYear, todayMonth],
    [nextMonthYear, nextMonth],
  ];

  const instances: ExpectedInstance[] = [];
  for (const [y, m] of candidateMonths) {
    const dataPrevista = nthDayFn(y, m, offsetDias);
    if (dataPrevista < rangeStart || dataPrevista > rangeEnd) {
      continue;
    }

    const competencia = shiftCompetencia(dataPrevista, template.regraCompetencia);
    if (competencia === null) {
      return { skipReason: "regra_competencia_nao_suportada" };
    }

    instances.push({
      dedupeKey: buildDedupeKey(template.id, competencia, dataPrevista),
      templateId: template.id,
      competencia,
      dataPrevista,
      tipoPrazo: TIPO_PRAZO_GERADO,
    });
  }

  return { instances };
}

interface AntecessorRecord {
  competencia: string;
  dataPrevista: string;
  status: string;
  persisted: boolean;
}

/**
 * Merges this run's freshly-computed instances for `antecessorId` with any
 * already-persisted `existing` rows for the same template, keyed by
 * competencia. Persisted entries take precedence over computed ones for the
 * same competencia (an existing row reflects real, possibly-mutated status;
 * a freshly-computed one does not exist in the database yet).
 */
function lookupAntecessorInstances(
  antecessorId: string,
  computedByTemplateId: ReadonlyMap<string, readonly ExpectedInstance[]>,
  existingByTemplateId: ReadonlyMap<string, readonly ExistingInstance[]>,
): Map<string, AntecessorRecord> {
  const byCompetencia = new Map<string, AntecessorRecord>();

  for (const inst of computedByTemplateId.get(antecessorId) ?? []) {
    byCompetencia.set(inst.competencia, {
      competencia: inst.competencia,
      dataPrevista: inst.dataPrevista,
      status: STATUS_INICIAL,
      persisted: false,
    });
  }

  for (const row of existingByTemplateId.get(antecessorId) ?? []) {
    byCompetencia.set(row.competencia, {
      competencia: row.competencia,
      dataPrevista: row.dataPrevista,
      status: row.status,
      persisted: true,
    });
  }

  return byCompetencia;
}

interface PendingEncadeado {
  template: TemplateRow;
  offsetDias: number;
}

export function computeExpectedInstances(
  templates: readonly TemplateRow[],
  today: string,
  existing: readonly ExistingInstance[],
): ComputeResult {
  const rangeStart = today;
  const rangeEnd = endOfNextMonth(today);

  const expected: ExpectedInstance[] = [];
  const skipped: SkippedTemplate[] = [];

  // Instances computed THIS run, keyed by templateId — grows across both the
  // fixed-offset loop below and the encadeado sweep, so a two-level chain
  // (A -> B -> C) can resolve C off B's freshly-computed (not-yet-persisted)
  // instances within the same call.
  const computedByTemplateId = new Map<string, ExpectedInstance[]>();

  // Already-persisted instances, grouped by templateId regardless of that
  // template's own `ativo` flag — an inactive antecessor's persisted
  // instances must still be visible to an active encadeado successor.
  const existingByTemplateId = new Map<string, ExistingInstance[]>();
  for (const row of existing) {
    const bucket = existingByTemplateId.get(row.templateId);
    if (bucket) {
      bucket.push(row);
    } else {
      existingByTemplateId.set(row.templateId, [row]);
    }
  }

  // Pass 1: fixed-offset types (du_fixo, corrido_fixo) and genuinely-unknown
  // tipoGeracao values. encadeado is deliberately excluded here — it is
  // resolved in the topological sweep below, once antecessor instance sets
  // are known.
  const pendingEncadeado: PendingEncadeado[] = [];

  for (const template of templates) {
    if (template.ativo === false) {
      continue;
    }

    if (template.tipoGeracao === "encadeado") {
      if (!template.antecessor?.id) {
        skipped.push({ templateId: template.id, reason: "antecessor_ausente" });
        continue;
      }
      // D-05-B: offsetDias counts business days after the antecessor's
      // dataPrevista and may be 0 (same day) — never negative.
      const offsetValidation = validateOffsetDias(template.offsetDias, 0);
      if (!offsetValidation.ok) {
        skipped.push({ templateId: template.id, reason: offsetValidation.reason as SkipReason });
        continue;
      }
      pendingEncadeado.push({ template, offsetDias: template.offsetDias as number });
      continue;
    }

    try {
      let result: { instances: ExpectedInstance[] } | { skipReason: SkipReason };
      if (template.tipoGeracao === "du_fixo") {
        result = computeFixedInstances(
          template,
          today,
          rangeStart,
          rangeEnd,
          1,
          nthBusinessDayOfMonth,
        );
      } else if (template.tipoGeracao === "corrido_fixo") {
        result = computeFixedInstances(
          template,
          today,
          rangeStart,
          rangeEnd,
          1,
          nthCalendarDayOfMonth,
        );
      } else {
        skipped.push({ templateId: template.id, reason: "tipo_geracao_desconhecido" });
        continue;
      }

      if ("skipReason" in result) {
        skipped.push({ templateId: template.id, reason: result.skipReason });
        continue;
      }
      computedByTemplateId.set(template.id, result.instances);
      expected.push(...result.instances);
    } catch {
      // Per-template isolation (RESEARCH Pitfall 4): any thrown error
      // (e.g. CalendarRangeError from bizdays.ts when offsetDias pushes the
      // computed date past the vendored calendar's range) is caught here so
      // one misconfigured/out-of-range template never aborts the others.
      // There is no dedicated SkipReason for this case in the locked enum;
      // it is treated as an invalid offset, since it is the offset that
      // drove the computation out of bounds.
      skipped.push({ templateId: template.id, reason: "offset_dias_invalido" });
    }
  }

  // Pass 2: bounded topological sweep over encadeado templates. `pendingIds`
  // tracks which encadeado templates are still unresolved; a template is
  // "ready" the moment its antecessor id is no longer in that set — which is
  // true immediately for non-chained/inactive antecessors, and becomes true
  // for a chained antecessor once ITS turn resolves (possibly within the
  // same pass, if array order cooperates; always within `templates.length`
  // passes otherwise). Anything still pending when the bound is exhausted
  // has a cycle or a dangling antecessor id and is reported, never hung on.
  const pendingIds = new Set(pendingEncadeado.map((p) => p.template.id));
  let remaining = pendingEncadeado;

  for (let pass = 0; pass < templates.length && remaining.length > 0; pass++) {
    const stillPending: PendingEncadeado[] = [];

    for (const { template, offsetDias } of remaining) {
      const antecessorId = template.antecessor?.id as string;

      if (pendingIds.has(antecessorId)) {
        stillPending.push({ template, offsetDias });
        continue;
      }

      const antecessorInstances = lookupAntecessorInstances(
        antecessorId,
        computedByTemplateId,
        existingByTemplateId,
      );

      if (antecessorInstances.size === 0) {
        skipped.push({ templateId: template.id, reason: "antecessor_sem_instancia" });
        pendingIds.delete(template.id);
        continue;
      }

      try {
        const instances: ExpectedInstance[] = [];
        for (const record of antecessorInstances.values()) {
          // D-05-B: business days after the antecessor's PLANNED
          // dataPrevista (D-05-F — never a re-derived/late date, which would
          // move the dedupeKey and break idempotency).
          const dataPrevista = addBusinessDays(record.dataPrevista, offsetDias);
          if (dataPrevista < rangeStart || dataPrevista > rangeEnd) {
            continue;
          }

          // D-05-D: competencia is inherited verbatim from the antecessor
          // instance — this template's own regraCompetencia is never
          // consulted.
          const competencia = record.competencia;

          // D-05-E: mark the date as provisional whenever the antecessor's
          // instance is not yet persisted, or is persisted but not yet
          // "concluida".
          const estimada = !record.persisted || record.status !== "concluida";

          instances.push({
            dedupeKey: buildDedupeKey(template.id, competencia, dataPrevista),
            templateId: template.id,
            competencia,
            dataPrevista,
            ...(estimada ? { dataPrevistaEstimada: dataPrevista } : {}),
            tipoPrazo: TIPO_PRAZO_GERADO,
          });
        }
        computedByTemplateId.set(template.id, instances);
        expected.push(...instances);
      } catch {
        // Same per-template isolation as the fixed-offset loop above.
        skipped.push({ templateId: template.id, reason: "offset_dias_invalido" });
      }

      pendingIds.delete(template.id);
    }

    remaining = stillPending;
  }

  // Bound exhausted: whatever is left forms a cycle (or chains through a
  // dangling antecessor id that never resolves) — report, never loop.
  for (const { template } of remaining) {
    skipped.push({ templateId: template.id, reason: "antecessor_ciclico" });
  }

  expected.sort((a, b) => (a.dedupeKey < b.dedupeKey ? -1 : a.dedupeKey > b.dedupeKey ? 1 : 0));
  skipped.sort((a, b) => {
    if (a.templateId !== b.templateId) {
      return a.templateId < b.templateId ? -1 : 1;
    }
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });

  return { expected, skipped };
}

// --- I/O boundary: everything below this line talks to InstantDB ---
//
// Everything above this comment is the pure, zero-I/O compute core from
// plan 05-02 and MUST stay that way (05-05's Python twin mirrors only that
// part). Everything below orchestrates the live query -> diff -> transact
// path against `web/src/lib/db.ts`'s `db` export, per this plan's
// "Orchestration specification".

/**
 * Normalizes any DB-sourced date value to a plain `YYYY-MM-DD` string.
 *
 * `dataPrevista` is stored as an `i.date()` attribute and round-trips from
 * InstantDB as an ISO *datetime* string (e.g. `"2026-09-10T00:00:00.000Z"`),
 * NOT `YYYY-MM-DD` — proven by `cli/tests/test_rotina_instancia.py`, which
 * asserts with `.startswith(...)`, not `==`. A missed normalization here
 * would make every existing instance look "new" on every run and duplicate
 * the entire table (RESEARCH pitfall referenced in this plan's context).
 *
 * Exported so 05-06's verification tooling can reuse the exact same
 * normalization when reading server state.
 */
export function toIsoDate(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).slice(0, 10);
}

export interface JobReport {
  created: string[]; // dedupeKeys newly written this run, sorted
  existing: string[]; // dedupeKeys already present, left untouched, sorted
  skipped: SkippedTemplate[]; // from computeExpectedInstances, unchanged
}

function sortedUnique(values: readonly string[]): string[] {
  return [...values].sort();
}

/**
 * Computes today's UTC date as `YYYY-MM-DD`, without ANY timezone-local
 * `Date` accessor (`getFullYear`/`getMonth()`/`getDate()`) — a local-timezone
 * read in a UTC-8 or UTC+9 environment would shift the whole `[today, ...]`
 * range by a day and change every dedupeKey computed from it.
 */
function todayUtcIsoDate(): string {
  const now = new Date();
  return formatIso(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

/**
 * Orchestrates the full query -> compute -> diff -> transact cycle against
 * the live InstantDB app for one `donoId`. See this plan's context block,
 * "Orchestration specification", for the numbered step-by-step contract this
 * implements.
 */
export async function runRoutineInstanceJob(options: {
  donoId: string;
  today?: string;
}): Promise<JobReport> {
  const { donoId } = options;
  const today = options.today ?? todayUtcIsoDate();

  // Step 1: read active templates for this owner. Zero rows -> short-circuit
  // before ever issuing an instanciasRotina query (RESEARCH Pitfall 5: `$in:
  // []` semantics are unverified and must never be relied on).
  const templatesResult = await db.queryOnce({
    templatesRotina: { $: { where: { ativo: true, donoId } } },
  } as never);
  const templates = (templatesResult.data as { templatesRotina: TemplateRow[] }).templatesRotina;

  if (templates.length === 0) {
    return { created: [], existing: [], skipped: [] };
  }

  const templateIds = templates.map((t) => t.id);

  // Step 2: read existing instances for those templates, normalizing every
  // DB-sourced date before it touches compute or comparison.
  const existingResult = await db.queryOnce({
    instanciasRotina: {
      template: {},
      $: { where: { "template.id": { $in: templateIds } } },
    },
  } as never);
  type RawInstanceRow = {
    dedupeKey: string;
    competencia: string;
    dataPrevista: unknown;
    status: string;
    template?: { id: string } | { id: string }[] | null;
  };
  const rawInstances = (existingResult.data as { instanciasRotina: RawInstanceRow[] })
    .instanciasRotina;
  const existing: ExistingInstance[] = rawInstances.map((row) => {
    const linked = Array.isArray(row.template) ? row.template[0] : row.template;
    return {
      dedupeKey: row.dedupeKey,
      templateId: linked?.id ?? "",
      competencia: row.competencia,
      dataPrevista: toIsoDate(row.dataPrevista),
      status: row.status,
    };
  });

  // Step 3: compute (pure).
  const { expected, skipped } = computeExpectedInstances(templates, today, existing);

  // Step 4: diff. An already-present dedupeKey is filtered out here and
  // therefore never appears in any transact payload, so there is no code
  // path through which `status` can be overwritten (RESEARCH Pitfall 1).
  const existingKeys = new Set(existing.map((e) => e.dedupeKey));
  const toCreate = expected.filter((e) => !existingKeys.has(e.dedupeKey));

  if (toCreate.length === 0) {
    return {
      created: [],
      existing: sortedUnique(expected.map((e) => e.dedupeKey)),
      skipped,
    };
  }

  // Step 5: write — one transact, one chunk per new dedupeKey, `.update()`
  // only (a lookup sentinel is illegal on `.create()` — RESEARCH Pitfall 2),
  // always carrying `donoId` (required by instant.perms.ts's create rule —
  // RESEARCH Pitfall 6).
  const chunks = toCreate.map((e) =>
    db.tx.instanciasRotina[lookup("dedupeKey", e.dedupeKey)]
      .update({
        dataPrevista: e.dataPrevista,
        competencia: e.competencia,
        tipoPrazo: e.tipoPrazo,
        status: STATUS_INICIAL,
        donoId,
        ...(e.dataPrevistaEstimada ? { dataPrevistaEstimada: e.dataPrevistaEstimada } : {}),
      })
      .link({ template: e.templateId }),
  );

  try {
    await db.transact(chunks);
  } catch (err) {
    // Step 6: concurrency tolerance. A concurrent run may have already
    // claimed one or more of these dedupeKeys between step 2's read and this
    // transact. Re-query the exact keys we attempted; if every one now
    // exists, report them as `existing` (a lost race, not a crash). If any
    // is still missing, this was a genuine failure — rethrow.
    const recheck = await db.queryOnce({
      instanciasRotina: {
        $: { where: { dedupeKey: { $in: toCreate.map((e) => e.dedupeKey) } } },
      },
    } as never);
    const recheckKeys = new Set(
      (recheck.data as { instanciasRotina: { dedupeKey: string }[] }).instanciasRotina.map(
        (r) => r.dedupeKey,
      ),
    );
    const stillMissing = toCreate.some((e) => !recheckKeys.has(e.dedupeKey));
    if (stillMissing) {
      throw err;
    }
    return {
      created: [],
      existing: sortedUnique(expected.map((e) => e.dedupeKey)),
      skipped,
    };
  }

  return {
    created: sortedUnique(toCreate.map((e) => e.dedupeKey)),
    existing: sortedUnique(expected.map((e) => e.dedupeKey).filter((k) => existingKeys.has(k))),
    skipped,
  };
}
