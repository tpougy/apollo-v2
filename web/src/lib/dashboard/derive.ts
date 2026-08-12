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
