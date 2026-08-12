<script lang="ts">
  import Kanban from "@lucide/svelte/icons/kanban";
  import { Badge } from "$lib/components/ui/badge";
  import * as Empty from "$lib/components/ui/empty";
  import { progressoEtapa, tarefaConcluida, vencido } from "./derive";

  // Row types mirror Dashboard.svelte's existing inline ProjetoRow/EtapaRow/
  // TarefaRow shapes exactly -- same convention TicketQueue.svelte/
  // WeekCalendar.svelte already use (each dashboard leaf component declares
  // its own row types rather than importing Dashboard.svelte's, since
  // Dashboard.svelte exports none).
  type SubtarefaRow = { id: string; concluida: boolean };
  type FundoRow = { id: string; nome: string };
  type TarefaRow = {
    id: string;
    titulo: string;
    tipoPrazo: string;
    dataPrevista?: string | null;
    subtarefas?: SubtarefaRow[];
  };
  type EtapaRow = { id: string; nome: string; ordem: number; tarefas?: TarefaRow[] };
  type ProjetoRow = { id: string; nome: string; fundo?: FundoRow | null; etapas?: EtapaRow[] };

  let {
    projetos,
    hojeIso,
    onVerProjetos,
  }: { projetos: ProjetoRow[]; hojeIso: string; onVerProjetos: () => void } = $props();

  // This phase's locked, documented resolution of "projeto em andamento": a
  // project gets a strip solely because it has at least one etapa to render
  // as columns -- no `projeto.status` value is ever read or compared,
  // mirroring exactly the reasoning REQUIREMENTS.md section 5.3 already used
  // for the ticket queue (no non-textual completion signal exists on
  // `projetos` either).
  function filtroEmAndamento(projeto: ProjetoRow): boolean {
    return (projeto.etapas?.length ?? 0) > 0;
  }

  const emAndamento = $derived(
    [...projetos].filter(filtroEmAndamento).sort((a, b) => a.nome.localeCompare(b.nome)),
  );

  // Task 1: in-memory-only collapse toggle. Task 2 seeds this from
  // localStorage via the $effect below.
  let collapsedByProjeto = $state<Record<string, boolean>>({});
</script>

{#if emAndamento.length === 0}
  <Empty.Root data-testid="dash-projetos-empty">
    <Empty.Header>
      <Empty.Media variant="icon"><Kanban /></Empty.Media>
      <Empty.Title>Nenhum projeto em andamento</Empty.Title>
    </Empty.Header>
  </Empty.Root>
  <button
    type="button"
    data-testid="dash-projetos-ver-todos"
    class="text-sm text-muted-foreground hover:text-foreground"
    onclick={onVerProjetos}
  >
    ver projetos →
  </button>
{:else}
  <div data-testid="dash-projetos" class="space-y-4">
    {#each emAndamento as projeto (projeto.id)}
      {@const etapasOrdenadas = [...(projeto.etapas ?? [])].sort((a, b) => a.ordem - b.ordem)}
      {@const totalTarefas = etapasOrdenadas.reduce(
        (sum, e) => sum + (e.tarefas ?? []).length,
        0,
      )}
      <div data-testid="project-strip" data-eid={projeto.id}>
        <div data-testid="project-strip-header" class="flex items-center gap-2">
          <button
            type="button"
            data-testid="project-strip-collapse"
            onclick={() => (collapsedByProjeto[projeto.id] = !collapsedByProjeto[projeto.id])}
          >
            {collapsedByProjeto[projeto.id] ? "▸" : "▾"}
          </button>
          <button type="button" data-testid="project-strip-nome" class="text-sm font-medium">
            {projeto.nome}
          </button>
          <button
            type="button"
            data-testid="project-strip-fundo-badge"
            data-eid={projeto.fundo?.id ?? ""}
          >
            <Badge variant="outline">{projeto.fundo?.nome ?? "Sem fundo vinculado"}</Badge>
          </button>
          <span data-testid="project-strip-meta" class="text-xs text-muted-foreground">
            {etapasOrdenadas.length} etapas - {totalTarefas} tarefas
          </span>
        </div>

        {#if !collapsedByProjeto[projeto.id]}
          <div
            data-testid="project-strip-body"
            class="relative overflow-x-auto [scroll-snap-type:x_proximity]"
          >
            <div data-testid="project-strip-row" class="flex gap-2">
              {#each etapasOrdenadas as etapa (etapa.id)}
                {@const { feitas, total } = progressoEtapa(etapa)}
                {@const tarefas = etapa.tarefas ?? []}
                {@const overflowCount = tarefas.length - 3}
                <div
                  data-testid="project-strip-column"
                  data-eid={etapa.id}
                  class="w-36 shrink-0 box-border border-r px-2 space-y-2 [scroll-snap-align:start]"
                >
                  <button type="button" data-testid="project-strip-column-header" class="block w-full text-left space-y-1">
                    <span class="font-mono text-xs">{etapa.ordem}</span>
                    <span class="block text-sm font-medium">{etapa.nome}</span>
                    <span class="block text-xs text-muted-foreground">{feitas}/{total}</span>
                  </button>
                  {#each tarefas.slice(0, 3) as tarefa (tarefa.id)}
                    {@const concluida = tarefaConcluida(tarefa)}
                    {@const atrasada = vencido(
                      tarefa.dataPrevista,
                      concluida,
                      new Date(`${hojeIso}T00:00:00.000Z`),
                    )}
                    <button
                      type="button"
                      data-testid="project-strip-card"
                      data-eid={tarefa.id}
                      class={atrasada
                        ? "block w-full rounded border p-2 text-left space-y-1 border-l-[3px] border-destructive"
                        : "block w-full rounded border p-2 text-left space-y-1"}
                    >
                      <p class="line-clamp-2 text-sm">{tarefa.titulo}</p>
                      <p class={atrasada ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                        {tarefa.tipoPrazo.toUpperCase()}
                        {tarefa.dataPrevista
                          ? `${tarefa.dataPrevista.slice(8, 10)}/${tarefa.dataPrevista.slice(5, 7)}`
                          : "-"}
                      </p>
                    </button>
                  {/each}
                  {#if overflowCount > 0}
                    <div data-testid="project-strip-card-overflow" data-eid={etapa.id} class="text-xs text-muted-foreground">
                      +{overflowCount} tarefas
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
