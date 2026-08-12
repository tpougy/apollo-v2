<script lang="ts">
  import { db } from "../db";
  import { useDashboardQuery } from "./dashboardQuery";
  import TicketQueue from "./TicketQueue.svelte";

  // Row types mirror DASHBOARD_QUERY's exact shape, one level of nesting per
  // key — same convention as ProjetosSection.svelte's ProjetoRow/TarefaRow.
  type SubtarefaRow = { id: string; concluida: boolean };
  type FundoRow = { id: string; nome: string };
  type EtapaRow = { id: string; nome: string; ordem: number; tarefas?: TarefaRow[] };
  type ProjetoRow = {
    id: string;
    nome: string;
    status: string;
    fundo?: FundoRow;
    etapas?: EtapaRow[];
  };
  type TarefaRow = {
    id: string;
    titulo: string;
    tipoPrazo: string;
    dataPrevista?: string;
    etapa?: { id: string; projeto?: ProjetoRow };
    subtarefas?: SubtarefaRow[];
  };
  type TemplateRow = { id: string; nome: string; fundo?: FundoRow };
  type InstanciaRotinaRow = {
    id: string;
    dataPrevista: string;
    status: string;
    template?: TemplateRow;
  };
  type TicketRow = {
    id: string;
    titulo: string;
    tipoPrazo: string;
    dataPrevista?: string;
    dataRecebimento: string;
    fundo?: FundoRow;
    subtarefas?: SubtarefaRow[];
  };

  type DashboardData = {
    projetos?: ProjetoRow[];
    tarefas?: TarefaRow[];
    instanciasRotina?: InstanciaRotinaRow[];
    tickets?: TicketRow[];
    fundos?: FundoRow[];
  };

  const query = useDashboardQuery(db);

  function ticketRows(): TicketRow[] {
    const data = query.data as DashboardData | undefined;
    return data?.tickets ?? [];
  }

  // The only way Dashboard.svelte can move Shell.svelte's `rota` $state to
  // the Tickets section, since Shell.svelte itself receives zero changes
  // this phase (it already mounts <Dashboard /> unconditionally since Phase
  // 18). Same idiom already proven at ProjetosSection.svelte:207,254,278 for
  // a plain shadcn Button wiring a standard onclick.
  function goToTickets(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="nav-tickets"]')?.click();
  }
</script>

<h2 class="text-xl font-semibold tracking-tight">Dashboard</h2>

{#if query.isLoading}
  <p class="text-sm text-muted-foreground">carregando...</p>
{:else}
  <div
    data-testid="dash-grid"
    class="grid grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)_16rem] lg:grid-rows-[auto_1fr]"
  >
    <div data-testid="dash-week-slot" class="order-1 lg:order-none lg:col-start-2 lg:row-start-1">
      carregando semana...
    </div>
    <div
      data-testid="dash-tickets-slot"
      class="order-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-2"
    >
      <TicketQueue tickets={ticketRows()} onVerTodos={goToTickets} />
    </div>
    <div
      data-testid="dash-placeholder-rotinas"
      class="order-3 lg:order-none lg:col-start-3 lg:row-start-1 lg:row-span-2"
    >
      Em breve: rotinas da semana e carga do mês
    </div>
    <div
      data-testid="dash-placeholder-projetos"
      class="order-4 lg:order-none lg:col-start-2 lg:row-start-2"
    >
      Em breve: projetos em andamento
    </div>
  </div>
{/if}
