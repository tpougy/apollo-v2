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
 * Only `tipoGeracao: "du_fixo"` is implemented in this plan (05-02).
 * `corrido_fixo` and `encadeado` are reserved for plan 05-04, which replaces
 * their `tipo_geracao_desconhecido` branch below.
 */

import { addBusinessDays, isBusinessDay } from "./bizdays";

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
  | "antecessor_ausente" // reserved for 05-04
  | "antecessor_sem_instancia" // reserved for 05-04
  | "antecessor_ciclico"; // reserved for 05-04

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

/**
 * Compute the `du_fixo` expected instances for a single template across the
 * two candidate months touching `[today, endOfNextMonth(today)]`. Throws on
 * any underlying business-day computation error (e.g. `CalendarRangeError`)
 * so the caller's per-template try/catch can convert it into a `skipped`
 * entry — this function itself never catches.
 */
function computeDuFixoInstances(
  template: TemplateRow,
  today: string,
  rangeStart: string,
  rangeEnd: string,
): { instances: ExpectedInstance[] } | { skipReason: SkipReason } {
  const offsetValidation = validateOffsetDias(template.offsetDias, 1);
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
    const dataPrevista = nthBusinessDayOfMonth(y, m, offsetDias);
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

export function computeExpectedInstances(
  templates: readonly TemplateRow[],
  today: string,
  // Accepted for interface stability across plans (05-04 uses this for
  // encadeado antecessor resolution); intentionally unused in this plan.
  existing: readonly ExistingInstance[],
): ComputeResult {
  void existing;

  const rangeStart = today;
  const rangeEnd = endOfNextMonth(today);

  const expected: ExpectedInstance[] = [];
  const skipped: SkippedTemplate[] = [];

  for (const template of templates) {
    if (template.ativo === false) {
      continue;
    }

    try {
      if (template.tipoGeracao !== "du_fixo") {
        // corrido_fixo and encadeado are reserved for plan 05-04, which
        // replaces this branch with real computation for both types.
        skipped.push({ templateId: template.id, reason: "tipo_geracao_desconhecido" });
        continue;
      }

      const result = computeDuFixoInstances(template, today, rangeStart, rangeEnd);
      if ("skipReason" in result) {
        skipped.push({ templateId: template.id, reason: result.skipReason });
        continue;
      }
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

  expected.sort((a, b) => (a.dedupeKey < b.dedupeKey ? -1 : a.dedupeKey > b.dedupeKey ? 1 : 0));
  skipped.sort((a, b) => {
    if (a.templateId !== b.templateId) {
      return a.templateId < b.templateId ? -1 : 1;
    }
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });

  return { expected, skipped };
}
