/**
 * DASH-06's canonical, pure derivation module for the Dashboard feature (and,
 * per Phase 21's consolidation of Phase 19's provisional phase-local
 * derivation module under `web/src/lib/sections/`, for `ProjetosSection.svelte`'s
 * etapa-progress UI too — one rule set, no drift between the two).
 *
 * Pure like `web/src/lib/bizdays.ts`: no `db` import, no internal
 * `Date.now()`/argless `new Date()` call anywhere. Every date-dependent
 * export takes its "today" reference (`hoje`/`base`) as an explicit
 * parameter — the caller constructs the `Date`/ISO string, this module never
 * reads the clock itself.
 */

// ---------------------------------------------------------------------------
// Migrated verbatim from Phase 19's provisional phase-local derivation module
// (previously under web/src/lib/sections/). Same names, signatures, and doc
// comments — this phase's Task 1 is a pure file relocation + import-path
// repoint, zero behavior change.
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

// ---------------------------------------------------------------------------
// New DASH-06 exports (Phase 21 Task 3): cross-referenced weekly agenda and
// fundo grouping. Local shapes only — this module stays decoupled from
// dashboardQuery.ts, never importing its types.
// ---------------------------------------------------------------------------

export type ItemTipo = "tarefa" | "rotina" | "ticket";

export interface Item {
  tipo: ItemTipo;
  id: string;
  titulo: string;
  prazo: string;
  vencido: boolean;
  fundoId: string | null;
}

interface ProjetoFundoLike {
  id: string;
  fundo: { id: string } | null;
}

interface TarefaAgendaLike {
  id: string;
  titulo: string;
  tipoPrazo: string;
  dataPrevista?: string | null;
  subtarefas?: SubtarefaLike[];
  etapa: { projeto: { id: string } | null } | null;
}

interface InstanciaAgendaLike {
  id: string;
  dataPrevista: string;
  tipoPrazo: string;
  template: { fundo: { id: string; nome: string } | null } | null;
}

interface TicketAgendaLike {
  id: string;
  titulo: string;
  tipoPrazo: string;
  dataPrevista?: string | null;
  fundo: { id: string } | null;
}

const ITEM_TIPO_ORDER: Record<ItemTipo, number> = { tarefa: 0, rotina: 1, ticket: 2 };

function semanaKeys(semana: { dias: string[]; sabado: string; domingo: string }): string[] {
  return [...semana.dias, semana.sabado, semana.domingo];
}

/**
 * spec-ui.md §5.2: `agendaPorDia(dados, semana) → Map<isoDate, Item[]>`,
 * `Item = { tipo, id, titulo, prazo, vencido, fundoId }`.
 *
 * Deliberate signature deviation from spec §5.2's shorthand
 * `agendaPorDia(dados, semana)`: this implementation adds an explicit `hoje:
 * Date` third parameter. An Item's `vencido` flag cannot be computed without
 * a "today" reference, and this module's purity rule requires that reference
 * to be a parameter, never an internal clock read — documented here and in
 * 21-01-SUMMARY.md.
 *
 * Note on rotina Item.titulo: `InstanciaAgendaLike` (per this phase's locked
 * field list) carries no title-bearing field of its own — only
 * `template.fundo.{id,nome}`. `instancia.id` is used as a stable, unique
 * placeholder `titulo` for rotina items; Phase 22 (which builds the actual
 * rotina rendering) will need to resolve a human-readable label separately
 * when it wires this Map to real UI. Documented as this phase's discretion
 * in 21-01-SUMMARY.md.
 */
export function agendaPorDia(
  dados: {
    projetos: ProjetoFundoLike[];
    tarefas: TarefaAgendaLike[];
    instanciasRotina: InstanciaAgendaLike[];
    tickets: TicketAgendaLike[];
  },
  semana: { dias: string[]; sabado: string; domingo: string },
  hoje: Date,
): Map<string, Item[]> {
  // The ONLY way to resolve a tarefa's fundoId: dashboardQuery.ts's locked
  // query shape nests `tarefas.etapa.projeto` WITHOUT a further `.fundo` hop
  // (that hop only exists on the separate top-level `projetos` branch of the
  // same query result) — build a projetoId -> fundoId lookup from
  // `dados.projetos` instead of ever expecting `.etapa.projeto.fundo`.
  const fundoIdByProjetoId = new Map<string, string | null>();
  for (const projeto of dados.projetos) {
    fundoIdByProjetoId.set(projeto.id, projeto.fundo?.id ?? null);
  }

  const keys = semanaKeys(semana);
  const keySet = new Set(keys);
  const buckets = new Map<string, (Item & { _hard: boolean })[]>();
  for (const key of keys) {
    buckets.set(key, []);
  }

  const pushItem = (dia: string, item: Item & { _hard: boolean }): void => {
    const bucket = buckets.get(dia);
    if (bucket) bucket.push(item);
  };

  for (const tarefa of dados.tarefas) {
    if (!tarefa.dataPrevista) continue;
    const dia = tarefa.dataPrevista.slice(0, 10);
    if (!keySet.has(dia)) continue;
    const projetoId = tarefa.etapa?.projeto?.id ?? null;
    const fundoId = projetoId ? (fundoIdByProjetoId.get(projetoId) ?? null) : null;
    const concluido = tarefaConcluida(tarefa);
    pushItem(dia, {
      tipo: "tarefa",
      id: tarefa.id,
      titulo: tarefa.titulo,
      prazo: tarefa.dataPrevista,
      vencido: vencido(tarefa.dataPrevista, concluido, hoje),
      fundoId,
      _hard: tarefa.tipoPrazo === "hard",
    });
  }

  for (const instancia of dados.instanciasRotina) {
    const dia = instancia.dataPrevista.slice(0, 10);
    if (!keySet.has(dia)) continue;
    const fundoId = instancia.template?.fundo?.id ?? null;
    // Every instanciaRotina inside the window becomes a "rotina" Item
    // regardless of its own tipoPrazo. Neither `instanciasRotina` nor
    // `tickets` carries any non-string completion signal, so `concluido` is
    // hard-coded `false` here — mirrors REQUIREMENTS.md §5.3's own
    // "Consequência simétrica" ticket-queue decision exactly (restated in
    // 21-01-SUMMARY.md).
    pushItem(dia, {
      tipo: "rotina",
      id: instancia.id,
      titulo: instancia.id,
      prazo: instancia.dataPrevista,
      vencido: vencido(instancia.dataPrevista, false, hoje),
      fundoId,
      _hard: instancia.tipoPrazo === "hard",
    });
  }

  for (const ticket of dados.tickets) {
    if (ticket.tipoPrazo !== "hard") continue;
    if (!ticket.dataPrevista) continue;
    const dia = ticket.dataPrevista.slice(0, 10);
    if (!keySet.has(dia)) continue;
    const fundoId = ticket.fundo?.id ?? null;
    // Same documented concluido=false decision as rotina items above.
    pushItem(dia, {
      tipo: "ticket",
      id: ticket.id,
      titulo: ticket.titulo,
      prazo: ticket.dataPrevista,
      vencido: vencido(ticket.dataPrevista, false, hoje),
      fundoId,
      _hard: true, // only hard tickets are ever included
    });
  }

  // Within-day sort: hard-deadline items first, then by tipo in the fixed
  // order tarefa/rotina/ticket, then by titulo ascending — deterministic and
  // stable regardless of input order. Spec leaves within-day order
  // unspecified; this is this phase's resolution (planner's discretion),
  // documented in 21-01-SUMMARY.md.
  const result = new Map<string, Item[]>();
  for (const [dia, items] of buckets) {
    const sorted = [...items].sort((a, b) => {
      if (a._hard !== b._hard) return a._hard ? -1 : 1;
      if (ITEM_TIPO_ORDER[a.tipo] !== ITEM_TIPO_ORDER[b.tipo]) {
        return ITEM_TIPO_ORDER[a.tipo] - ITEM_TIPO_ORDER[b.tipo];
      }
      return a.titulo.localeCompare(b.titulo);
    });
    result.set(
      dia,
      sorted.map(({ _hard, ...item }) => item),
    );
  }

  return result;
}

/**
 * spec-ui.md §5.2: `rotinasPorFundo(instancias, semana) → Grupo[]`, with the
 * `null` (sem fundo) group **always last**, regardless of alphabetical
 * position. Filters to the same 7-date window as `agendaPorDia`.
 */
export function rotinasPorFundo(
  instancias: InstanciaAgendaLike[],
  semana: { dias: string[]; sabado: string; domingo: string },
): { fundoId: string | null; fundoNome: string | null; instancias: InstanciaAgendaLike[] }[] {
  const keySet = new Set(semanaKeys(semana));
  const windowed = instancias.filter((i) => keySet.has(i.dataPrevista.slice(0, 10)));

  const groups = new Map<
    string | null,
    { fundoNome: string | null; instancias: InstanciaAgendaLike[] }
  >();
  for (const instancia of windowed) {
    const fundoId = instancia.template?.fundo?.id ?? null;
    const fundoNome = instancia.template?.fundo?.nome ?? null;
    let group = groups.get(fundoId);
    if (!group) {
      group = { fundoNome, instancias: [] };
      groups.set(fundoId, group);
    }
    group.instancias.push(instancia);
  }

  const result = Array.from(groups.entries()).map(([fundoId, group]) => ({
    fundoId,
    fundoNome: group.fundoNome,
    instancias: [...group.instancias].sort((a, b) => {
      if (a.dataPrevista !== b.dataPrevista) return a.dataPrevista < b.dataPrevista ? -1 : 1;
      return a.id.localeCompare(b.id);
    }),
  }));

  result.sort((a, b) => {
    if (a.fundoId === null) return b.fundoId === null ? 0 : 1;
    if (b.fundoId === null) return -1;
    return (a.fundoNome ?? "").localeCompare(b.fundoNome ?? "");
  });

  return result;
}
