<script lang="ts">
  import { db } from "../db";
  import { useDashboardQuery } from "./dashboardQuery";
  import { agendaPorDia, cargaDoMes, rotinasPorFundo, semanaUtil } from "./derive";
  import TicketDialog from "./dialogs/TicketDialog.svelte";
  import MonthHeatmap from "./MonthHeatmap.svelte";
  import ProjectStrips from "./ProjectStrips.svelte";
  import RoutinesByFundo from "./RoutinesByFundo.svelte";
  import TicketQueue from "./TicketQueue.svelte";
  import WeekCalendar from "./WeekCalendar.svelte";

  // Row types mirror DASHBOARD_QUERY's exact shape, one level of nesting per
  // key — same convention as ProjetosSection.svelte's ProjetoRow/TarefaRow.
  // Widened to add `titulo` (Deviation: Rule 1/2, TicketDialog's read-only
  // subtarefas list needs it; already fetched at runtime via the unchanged
  // `subtarefas: {}` query branch, same "widen too-narrow local TS type, add
  // zero new query" precedent this plan already applies to TicketRow below).
  type SubtarefaRow = { id: string; titulo: string; concluida: boolean };
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
    corpo: string;
    remetente: string;
    status: string;
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

  function projetoRows(): ProjetoRow[] {
    const data = query.data as DashboardData | undefined;
    return data?.projetos ?? [];
  }

  // The only way Dashboard.svelte can move Shell.svelte's `rota` $state to
  // the Tickets section, since Shell.svelte itself receives zero changes
  // this phase (it already mounts <Dashboard /> unconditionally since Phase
  // 18). Same idiom already proven at ProjetosSection.svelte:207,254,278 for
  // a plain shadcn Button wiring a standard onclick.
  function goToTickets(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="nav-tickets"]')?.click();
  }

  function goToProjetos(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="nav-projetos"]')?.click();
  }

  // Generic dialog-stack mechanism (spec-ui.md §4 "Profundidade máxima 2"),
  // designed from the start to support depth 2 even though this plan only
  // exercises depth 1 -- every later plan in this phase extends the
  // DialogKind union and the render chain below, never replaces this
  // mechanism. Capped at length 2: openDialog always keeps dialogStack[0]
  // (the first-level dialog) and swaps in a new second-level entry, never
  // growing past 2 -- "swap-in-place," never two simultaneous Dialog.Root
  // instances.
  type DialogKind = "ticket" | "dia" | "tarefa" | "projeto" | "fundo" | "etapa" | "rotina";
  type DialogRef = { kind: DialogKind; id: string };
  let dialogStack = $state<DialogRef[]>([]);

  function openDialog(ref: DialogRef): void {
    dialogStack = dialogStack.length === 0 ? [ref] : [dialogStack[0], ref];
  }

  function popToFirst(): void {
    dialogStack = dialogStack.slice(0, 1);
  }

  function closeAllDialogs(): void {
    dialogStack = [];
  }

  const activeDialogRef = $derived(dialogStack[dialogStack.length - 1]);
  const breadcrumbRef = $derived(dialogStack.length === 2 ? dialogStack[0] : undefined);

  // The "dia" branch returns the raw ISO for now -- Plan 23-04 refines it to
  // a formatted date when Dia becomes an actual first-level launch point;
  // this is a deliberate placeholder, not a bug, since no code path can
  // reach `breadcrumbRef.kind === "dia"` before Plan 23-04 lands.
  function breadcrumbLabelFor(ref: DialogRef | undefined): string {
    if (!ref) return "";
    if (ref.kind === "projeto") return projetoRows().find((p) => p.id === ref.id)?.nome ?? "Projeto";
    if (ref.kind === "dia") return ref.id;
    return "";
  }

  function openTicketDialog(id: string): void {
    openDialog({ kind: "ticket", id });
  }

  const activeTicket = $derived.by(() =>
    activeDialogRef?.kind === "ticket"
      ? ticketRows().find((t) => t.id === activeDialogRef.id)
      : undefined,
  );

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
        // `nome` is the ONLY change this plan makes to satisfy CONTEXT.md's
        // "surface template.nome" decision (22-RESEARCH.md Open Question 2):
        // derive.ts and dashboardQuery.ts's DASHBOARD_QUERY stay completely
        // unmodified -- TemplateRow already declares `nome: string` and the
        // query's `template: {}` traversal already fetches it as a scalar.
        template: i.template
          ? {
              nome: i.template.nome,
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

  const rotinaGrupos = $derived(rotinasPorFundo(dadosNormalizados.instanciasRotina, semana));

  // Sourced straight from `query.data` (not `dadosNormalizados`, which never
  // carries a bare id -> label lookup shape) -- the only place this map's
  // `template.nome` field is read from.
  const rotinaNomeById = $derived.by(() => {
    const data = query.data as DashboardData | undefined;
    const map = new Map<string, string>();
    for (const i of data?.instanciasRotina ?? []) {
      if (i.template?.nome) map.set(i.id, i.template.nome);
    }
    return map;
  });

  // The heatmap always shows the real current month, independent of
  // semanaBase's week navigation -- spec-ui.md gives the heatmap no
  // navigation of its own.
  const anoMes = $derived.by(() => {
    const d = new Date(`${hojeIso}T00:00:00.000Z`);
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
  });
  const carga = $derived(cargaDoMes(dadosNormalizados, anoMes.ano, anoMes.mes));
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
      <TicketQueue tickets={ticketRows()} onVerTodos={goToTickets} onOpenTicket={openTicketDialog} />
    </div>
    <div
      data-testid="dash-placeholder-rotinas"
      class="order-3 lg:order-none lg:col-start-3 lg:row-start-1 lg:row-span-2"
    >
      <div class="space-y-6">
        <RoutinesByFundo grupos={rotinaGrupos} nomeById={rotinaNomeById} {hojeIso} />
        <MonthHeatmap carga={carga} ano={anoMes.ano} mes={anoMes.mes} />
      </div>
    </div>
    <div
      data-testid="dash-placeholder-projetos"
      class="order-4 lg:order-none lg:col-start-2 lg:row-start-2"
    >
      <ProjectStrips projetos={projetoRows()} {hojeIso} onVerProjetos={goToProjetos} />
    </div>
  </div>
  <!--
    ONE mount point every later plan in this phase appends an
    `{:else if activeDialogRef?.kind === "Y"}` branch to -- never mount two
    dialog components simultaneously, and never restructure this into a
    lookup table/component map (spec §0.6's "one permitted router branch"
    precedent, applied here to dialog kind, not entity type).
  -->
  {#if activeDialogRef?.kind === "ticket"}
    <TicketDialog
      open={true}
      ticket={activeTicket}
      breadcrumb={breadcrumbRef
        ? { label: breadcrumbLabelFor(breadcrumbRef), onClick: popToFirst }
        : undefined}
      onOpenChange={(open) => {
        if (!open) closeAllDialogs();
      }}
    />
  {/if}
{/if}
