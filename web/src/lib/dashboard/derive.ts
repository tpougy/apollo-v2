/**
 * DASH-06's canonical, pure derivation module for the Dashboard feature (and,
 * per Phase 21's consolidation of Phase 19's provisional
 * `web/src/lib/sections/projetosDerive.ts`, for `ProjetosSection.svelte`'s
 * etapa-progress UI too — one rule set, no drift between the two).
 *
 * Pure like `web/src/lib/bizdays.ts`: no `db` import, no internal
 * `Date.now()`/argless `new Date()` call anywhere. Every date-dependent
 * export takes its "today" reference (`hoje`/`base`) as an explicit
 * parameter — the caller constructs the `Date`/ISO string, this module never
 * reads the clock itself.
 */

// ---------------------------------------------------------------------------
// Migrated verbatim from web/src/lib/sections/projetosDerive.ts (Phase 19).
// Same names, signatures, and doc comments — this phase's Task 1 is a pure
// file relocation + import-path repoint, zero behavior change.
// ---------------------------------------------------------------------------

export interface SubtarefaLike {
  concluida: boolean;
}

export interface TarefaLike {
  dataPrevista?: string | null;
  subtarefas?: SubtarefaLike[];
}

export interface EtapaLike {
  tarefas?: TarefaLike[];
}

/**
 * REQUIREMENTS.md §5.3: a tarefa counts as "feita" only when it has at least
 * one subtarefa AND every one of that tarefa's `subtarefas.concluida` is
 * `true`. A tarefa with zero subtarefas never counts as done — it lands in
 * `progressoEtapa`'s `total`, never its `feitas`. Never compare
 * `tarefa.status` (free text) to any literal.
 */
export function tarefaConcluida(tarefa: TarefaLike): boolean {
  const subtarefas = tarefa.subtarefas ?? [];
  return subtarefas.length > 0 && subtarefas.every((s) => s.concluida === true);
}

/**
 * REQUIREMENTS.md §5.3 / spec §5.2: progress of an etapa is the count of its
 * own tarefas for which `tarefaConcluida` is `true`, over the total tarefa
 * count — never a `tarefas.status` string comparison.
 */
export function progressoEtapa(etapa: EtapaLike): { feitas: number; total: number } {
  const tarefas = etapa.tarefas ?? [];
  const feitas = tarefas.filter((t) => tarefaConcluida(t)).length;
  return { feitas, total: tarefas.length };
}

/**
 * REQUIREMENTS.md §5.4 / spec §5.4: `vencido = dataPrevista != null &&
 * dataPrevista < hoje && !concluido`. One single function, reused by every
 * later phase (calendário, kanban, rotinas, heatmap) that needs "atrasado" —
 * no other definition of overdue may exist anywhere in this codebase.
 */
export function vencido(
  dataPrevista: string | null | undefined,
  concluido: boolean,
  hoje: Date,
): boolean {
  if (!dataPrevista) return false;
  return new Date(dataPrevista) < hoje && !concluido;
}

// ---------------------------------------------------------------------------
// New DASH-06 exports (Phase 21 Task 2): calendar-week math and heatmap
// banding. Plain UTC calendar-day arithmetic only — deliberately NOT built on
// bizdays.ts's business-day steppers (see semanaUtil's own doc comment).
// ---------------------------------------------------------------------------

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function formatIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * Parse an ISO `YYYY-MM-DD` date string as a UTC midnight instant, so callers
 * never fall prey to a local-timezone shift (same discipline as
 * `bizdays.ts`/`routineJob.ts`).
 */
function parseUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoOfUtcDate(d: Date): string {
  return formatIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * spec-ui.md §5.2: `semanaUtil(hoje | base) → { dias: [5 datas], sabado,
 * domingo }` — the plain Monday-Friday calendar dates of the week containing
 * `hoje`, plus that same week's Saturday/Sunday. Deliberately implemented
 * with plain UTC calendar-day arithmetic only (`getUTCDay()` for the weekday
 * index, `setUTCDate`/`getUTCDate` stepping one calendar day at a time) —
 * NEVER calls `isBusinessDay`/`addBusinessDays`/`nextBusinessDay` from
 * `bizdays.ts`. Those business-day steppers skip weekends/holidays by
 * design, which would shift Friday whenever an ANBIMA holiday falls inside
 * the target week (21-RESEARCH.md Q2 / Pitfall 1) — wrong semantics for "the
 * 5 calendar weekdays of this week regardless of holiday status."
 */
export function semanaUtil(hoje: string): { dias: string[]; sabado: string; domingo: string } {
  const base = parseUtcDate(hoje);
  const dow = base.getUTCDay(); // Sunday=0 .. Saturday=6
  const mondayOffset = (dow + 6) % 7; // days back from `hoje` to that week's Monday

  const monday = new Date(base);
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);

  const dias: string[] = [];
  const cursor = new Date(monday);
  for (let i = 0; i < 5; i++) {
    dias.push(isoOfUtcDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  // cursor is now Saturday (Monday + 5 days)
  const sabado = isoOfUtcDate(cursor);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  const domingo = isoOfUtcDate(cursor);

  return { dias, sabado, domingo };
}

/**
 * spec-ui.md §5.2/§6: `faixaHeatmap(n) → 0|1|2|3|4` — fixed cuts `0 / 1-2 /
 * 3-4 / 5-7 / 8+`.
 */
export function faixaHeatmap(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  if (n <= 7) return 3;
  return 4;
}

interface CargaDoMesItemLike {
  dataPrevista?: string | null;
}

/**
 * spec-ui.md §5.2/§3.4: `cargaDoMes(dados, ano, mes) → Map<isoDate, number>`
 * — one entry per calendar day of the target month (`mes` is 1-indexed,
 * January = 1, matching the CLI/schema's human-facing convention, not
 * JavaScript's 0-indexed `getUTCMonth()`), seeded to `0`, then incremented
 * for every tarefa/instanciaRotina/ticket whose `dataPrevista` falls on a day
 * inside that month. Every one of the three item categories counts here
 * regardless of `tipoPrazo` — unlike `agendaPorDia`'s week-band, the
 * heatmap's "afazeres do dia" count (spec §3.4) is unqualified. An item with
 * no `dataPrevista` contributes nothing.
 */
export function cargaDoMes(
  dados: {
    tarefas: CargaDoMesItemLike[];
    instanciasRotina: CargaDoMesItemLike[];
    tickets: CargaDoMesItemLike[];
  },
  ano: number,
  mes: number,
): Map<string, number> {
  const result = new Map<string, number>();

  const daysInMonth = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    result.set(formatIso(ano, mes, day), 0);
  }

  const allItems = [...dados.tarefas, ...dados.instanciasRotina, ...dados.tickets];
  for (const item of allItems) {
    if (!item.dataPrevista) continue;
    const key = item.dataPrevista.slice(0, 10);
    const current = result.get(key);
    if (current !== undefined) {
      result.set(key, current + 1);
    }
  }

  return result;
}
