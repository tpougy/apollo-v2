<script lang="ts">
  import { db } from "../db";
  import { useDashboardQuery } from "./dashboardQuery";
  import { agendaPorDia, semanaUtil } from "./derive";
  import TicketQueue from "./TicketQueue.svelte";
  import WeekCalendar from "./WeekCalendar.svelte";

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
    tipoPrazo: string;
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

  // Local, non-persisted helpers — not part of derive.ts's DASH-06 public
  // contract (neither is one of its 7 named exports), since both are
  // Dashboard-shell-only concerns: `toISOString()` always normalizes to UTC,
  // so plain string slicing/UTC-day stepping needs no manual
  // getUTCFullYear/getUTCMonth/getUTCDate assembly.
  function todayUtcIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function shiftIso(iso: string, days: number): string {
    const d = new Date(`${iso}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const MESES_PT_BR = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];

  // `hojeIso` is the real current date, computed once and never reassigned —
  // `vencido`/today-highlight math always anchors to this, never to
  // `semanaBase`. `semanaBase` is the only thing week navigation changes
  // (spec-ui.md §3.1: "Navegação de semana altera só o estado local
  // semanaBase") — a local, non-persisted $state, never reaching the network
  // or localStorage (T-21-06).
  const hojeIso = todayUtcIso();
  let semanaBase = $state(hojeIso);

  const semana = $derived(semanaUtil(semanaBase));

  // agendaPorDia's local *Like shapes require a handful of fields as
  // non-optional-but-nullable (e.g. `etapa: {...} | null`, `fundo: {...} |
  // null`) where DashboardData's row types (Plan 21-02) declare the
  // equivalent link as merely optional (`etapa?: ...`) — this normalization
  // bridges that gap explicitly rather than casting past it.
  const dadosNormalizados = $derived.by(() => {
    const data = query.data as DashboardData | undefined;
    return {
      projetos: (data?.projetos ?? []).map((p) => ({
        id: p.id,
        fundo: p.fundo ? { id: p.fundo.id } : null,
      })),
      tarefas: (data?.tarefas ?? []).map((t) => ({
        id: t.id,
        titulo: t.titulo,
        tipoPrazo: t.tipoPrazo,
        dataPrevista: t.dataPrevista,
        subtarefas: t.subtarefas,
        etapa: t.etapa ? { projeto: t.etapa.projeto ? { id: t.etapa.projeto.id } : null } : null,
      })),
      instanciasRotina: (data?.instanciasRotina ?? []).map((i) => ({
        id: i.id,
        dataPrevista: i.dataPrevista,
        tipoPrazo: i.tipoPrazo,
        template: i.template
          ? {
              fundo: i.template.fundo
                ? { id: i.template.fundo.id, nome: i.template.fundo.nome }
                : null,
            }
          : null,
      })),
      tickets: (data?.tickets ?? []).map((t) => ({
        id: t.id,
        titulo: t.titulo,
        tipoPrazo: t.tipoPrazo,
        dataPrevista: t.dataPrevista,
        fundo: t.fundo ? { id: t.fundo.id } : null,
      })),
    };
  });

  const agenda = $derived(
    agendaPorDia(dadosNormalizados, semana, new Date(`${hojeIso}T00:00:00.000Z`)),
  );

  const semanaKeys = $derived([...semana.dias, semana.sabado, semana.domingo]);
  const totalAfazeres = $derived(
    semanaKeys.reduce((sum, key) => sum + (agenda.get(key)?.length ?? 0), 0),
  );
  const totalAtrasados = $derived(
    semanaKeys.reduce(
      (sum, key) => sum + (agenda.get(key) ?? []).filter((item) => item.vencido).length,
      0,
    ),
  );
  const mesNome = $derived(MESES_PT_BR[new Date(`${semana.dias[4]}T00:00:00.000Z`).getUTCMonth()]);
</script>

<h2 class="text-xl font-semibold tracking-tight">Dashboard</h2>

{#if query.isLoading}
  <p class="text-sm text-muted-foreground">carregando...</p>
{:else}
  <div data-testid="dash-header" class="flex items-center justify-between gap-4">
    <div>
      <p data-testid="dash-header-title" class="text-sm font-semibold">
        Semana de {Number(semana.dias[0].slice(8, 10))}–{Number(
          semana.dias[4].slice(8, 10),
        )} de {mesNome}
      </p>
      <p data-testid="dash-header-summary" class="text-xs text-muted-foreground">
        {totalAfazeres} afazeres · {totalAtrasados} atrasados
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        data-testid="dash-week-prev"
        class="text-sm text-muted-foreground hover:text-foreground"
        onclick={() => (semanaBase = shiftIso(semanaBase, -7))}
      >
        ‹ semana
      </button>
      <button
        type="button"
        data-testid="dash-week-next"
        class="text-sm text-muted-foreground hover:text-foreground"
        onclick={() => (semanaBase = shiftIso(semanaBase, 7))}
      >
        semana ›
      </button>
      <button
        type="button"
        data-testid="dash-week-today"
        class="text-sm text-muted-foreground hover:text-foreground"
        onclick={() => (semanaBase = hojeIso)}
      >
        Hoje
      </button>
    </div>
  </div>
  <div
    data-testid="dash-grid"
    class="grid grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)_16rem] lg:grid-rows-[auto_1fr]"
  >
    <div data-testid="dash-week-slot" class="order-1 lg:order-none lg:col-start-2 lg:row-start-1">
      <WeekCalendar
        dias={semana.dias}
        {agenda}
        {hojeIso}
        sabado={semana.sabado}
        domingo={semana.domingo}
      />
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
