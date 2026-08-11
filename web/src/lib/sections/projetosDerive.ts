// Phase 19's phase-local copy of the "conclusão"/"atraso" rules locked by
// REQUIREMENTS.md §5.3/§5.4 (spec-ui.md §5.2/§5.3/§5.4). Pure, no `db`
// import, `hoje` always passed as a parameter — never an implicit
// `Date.now()`/`new Date()` default inside a function — same spirit as
// `web/src/lib/bizdays.ts`'s own module-level doc-comment style.
//
// Phase 21's `web/src/lib/dashboard/derive.ts` is the eventual canonical
// owner of this same rule set (spec §5.2 names `progressoEtapa`/`vencido` as
// derive.ts exports); it does not exist yet, and this module does not depend
// on it. Phase 21 may import or re-derive this logic and consolidate/dedupe
// this file at that point (19-CONTEXT.md's explicit allowance).

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
