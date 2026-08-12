<script lang="ts">
  import Inbox from "@lucide/svelte/icons/inbox";
  import * as Empty from "$lib/components/ui/empty";

  // Row shape mirrors dashboardQuery.ts's `tickets: { fundo: {}, subtarefas: {} }`
  // nesting, one level deep, following ProjetosSection.svelte's own
  // ProjetoRow/TarefaRow convention.
  export type TicketRow = {
    id: string;
    titulo: string;
    tipoPrazo: string;
    dataPrevista?: string | null;
    dataRecebimento: string;
    fundo?: { id: string; nome: string } | null;
  };

  let { tickets, onVerTodos }: { tickets: TicketRow[]; onVerTodos: () => void } = $props();

  // Per REQUIREMENTS.md §5.3: `tickets` has no non-string completion field,
  // so the queue lists every ticket — no filter by any completion signal.
  // Sort: tipoPrazo === "hard" first, then by (dataPrevista ?? dataRecebimento)
  // ascending, then by id for stability (spec-ui.md §3.2).
  const sorted = $derived(
    [...tickets].sort((a, b) => {
      const aHard = a.tipoPrazo === "hard" ? 0 : 1;
      const bHard = b.tipoPrazo === "hard" ? 0 : 1;
      if (aHard !== bHard) return aHard - bHard;
      const aData = a.dataPrevista ?? a.dataRecebimento;
      const bData = b.dataPrevista ?? b.dataRecebimento;
      if (aData !== bData) return aData < bData ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    }),
  );
</script>

<div data-testid="dash-tickets" class="space-y-4">
  <h3 class="text-sm font-semibold uppercase text-muted-foreground">Tickets a fazer</h3>

  {#if sorted.length === 0}
    <Empty.Root data-testid="dash-tickets-empty">
      <Empty.Header>
        <Empty.Media variant="icon"><Inbox /></Empty.Media>
        <Empty.Title>Nenhum ticket pendente</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <div class="space-y-2">
      {#each sorted as ticket (ticket.id)}
        <button
          type="button"
          data-testid="dash-ticket-card"
          data-eid={ticket.id}
          class="w-full rounded border p-2 text-left space-y-1"
        >
          <p class="line-clamp-2 text-sm">{ticket.titulo}</p>
          <p class="text-xs text-muted-foreground">
            {ticket.fundo?.nome ?? "Sem fundo"} · {ticket.tipoPrazo.toUpperCase()} ·
            {(ticket.dataPrevista ?? ticket.dataRecebimento).slice(0, 10)}
          </p>
        </button>
      {/each}
    </div>
  {/if}

  <button
    type="button"
    data-testid="dash-tickets-ver-todos"
    class="text-sm text-muted-foreground hover:text-foreground"
    onclick={onVerTodos}
  >
    ver todos os tickets →
  </button>
</div>
