<script lang="ts">
  import { db } from "../db";
  import { useDashboardQuery } from "./dashboardQuery";
  import { agendaPorDia, cargaDoMes, rotinasPorFundo, semanaUtil } from "./derive";
  import DayDialog from "./dialogs/DayDialog.svelte";
  import FundoDialog from "./dialogs/FundoDialog.svelte";
  import RotinaDialog from "./dialogs/RotinaDialog.svelte";
  import TaskDialog from "./dialogs/TaskDialog.svelte";
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
  // Widened (Plan 23-04, Task 2) to add `descricao`/`dataPrevistaEstimada`/
  // `competencia`/`status` and to widen `etapa` to carry `nome` -- every new
  // field is optional (or, for `status`, already fetched at runtime for
  // every tarefa regardless of nesting), so both the flat `data.tarefas`
  // usage AND the nested `EtapaRow.tarefas` usage of this same declaration
  // stay type-compatible. The query's `etapa: { projeto: {} }` traversal
  // already returns `nome` as an own scalar of `etapas` -- it was simply
  // undeclared until now.
  type TarefaRow = {
    id: string;
    titulo: string;
    descricao?: string | null;
    tipoPrazo: string;
    dataPrevista?: string;
    dataPrevistaEstimada?: string | null;
    competencia?: string | null;
    status: string;
    etapa?: { id: string; nome: string; projeto?: ProjetoRow };
    subtarefas?: SubtarefaRow[];
  };
  type TemplateRow = { id: string; nome: string; fundo?: FundoRow };
  // Widened (Plan 23-04, Task 2) to add `dedupeKey`/`dataPrevistaEstimada`/
  // `competencia` -- all already fetched at runtime via the unchanged
  // `instanciasRotina: { template: { fundo: {} } }` query branch
  // (defs/instanciasRotina.ts's own field list), needed by RotinaDialog's
  // read-only body.
  type InstanciaRotinaRow = {
    id: string;
    dedupeKey: string;
    dataPrevista: string;
    dataPrevistaEstimada?: string | null;
    competencia: string;
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

  // Refined (Plan 23-04): Dia is now an actual first-level launch point, so
  // this branch formats the ISO into the same short weekday-abbrev + DD/MM
  // shape used elsewhere, rather than returning the raw ISO placeholder Plan
  // 23-01 deliberately left here.
  function breadcrumbLabelFor(ref: DialogRef | undefined): string {
    if (!ref) return "";
    if (ref.kind === "projeto") return projetoRows().find((p) => p.id === ref.id)?.nome ?? "Projeto";
    if (ref.kind === "dia") {
      const dow = new Date(`${ref.id}T00:00:00.000Z`).getUTCDay();
      const names = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
      return `${names[dow]} ${ref.id.slice(8, 10)}/${ref.id.slice(5, 7)}`;
    }
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

  function openDiaDialog(iso: string): void {
    openDialog({ kind: "dia", id: iso });
  }

  function openRotinaDialog(id: string): void {
    openDialog({ kind: "rotina", id });
  }

  function openTarefaDialog(id: string): void {
    openDialog({ kind: "tarefa", id });
  }

  // Belt (this no-op guard) and suspenders (each call site's own onclick
  // guard, added in RoutinesByFundo.svelte/ProjectStrips.svelte) against
  // Pitfall 2: a null/empty fundo id ("Sem fundo vinculado") must never open
  // a blank Fundo dialog.
  function openFundoDialog(id: string): void {
    if (!id) return;
    openDialog({ kind: "fundo", id });
  }

  function fundoNomeFor(id: string): string {
    return (query.data as DashboardData | undefined)?.fundos?.find((f) => f.id === id)?.nome ?? "Fundo";
  }

  // Built straight from already-fetched data (projetoRows()/ticketRows(),
  // both sourced from the one DASHBOARD_QUERY call) -- zero new query.
  // FundoDialog.svelte only ever narrows further via its own `.filter()`.
  const fundoDialogProjetos = $derived(
    projetoRows().map((p) => ({ id: p.id, nome: p.nome, fundoId: p.fundo?.id ?? null })),
  );
  const fundoDialogTickets = $derived(
    ticketRows().map((t) => ({ id: t.id, titulo: t.titulo, fundoId: t.fundo?.id ?? null })),
  );

  // spec-ui.md §4 row 2's "ir para esta semana" -- reuses the existing
  // semanaUtil/semanaBase already driving week navigation.
  function irParaEstaSemana(iso: string): void {
    semanaBase = semanaUtil(iso).dias[0];
    closeAllDialogs();
  }

  // Dashboard-local lookup (not a new derive.ts export) -- the exact
  // componentry-level join 23-RESEARCH.md's Q1 recommends, distinct from the
  // one genuinely new pure function, `rotinasDoFundo`, already added in Plan
  // 23-02.
  const fundoByProjetoId = $derived.by(() => {
    const map = new Map<string, FundoRow | null>();
    for (const p of projetoRows()) map.set(p.id, p.fundo ?? null);
    return map;
  });

  const activeDiaItems = $derived.by(() =>
    activeDialogRef?.kind === "dia" ? (agenda.get(activeDialogRef.id) ?? []) : [],
  );

  const activeRotina = $derived.by(() => {
    if (activeDialogRef?.kind !== "rotina") return undefined;
    const raw = (query.data as DashboardData | undefined)?.instanciasRotina?.find(
      (i) => i.id === activeDialogRef.id,
    );
    if (!raw) return undefined;
    return {
      id: raw.id,
      dedupeKey: raw.dedupeKey,
      dataPrevista: raw.dataPrevista,
      dataPrevistaEstimada: raw.dataPrevistaEstimada,
      competencia: raw.competencia,
      tipoPrazo: raw.tipoPrazo,
      status: raw.status,
      templateNome: raw.template?.nome ?? null,
      fundoNome: raw.template?.fundo?.nome ?? null,
    };
  });

  // T-23-08 (threat register): this lookup MUST read from the flat,
  // top-level `data.tarefas` array (which carries `subtarefas`), NEVER from
  // `projetoRows()`'s nested `etapas[].tarefas[]` -- that nested branch never
  // fetched `subtarefas` (documented 22-01 query gap), so any lookup through
  // it would silently show every tarefa as having zero subtarefas regardless
  // of reality.
  const activeTarefaForDialog = $derived.by(() => {
    if (activeDialogRef?.kind !== "tarefa") return undefined;
    const data = query.data as DashboardData | undefined;
    const raw = (data?.tarefas ?? []).find((t) => t.id === activeDialogRef.id);
    if (!raw) return undefined;
    const projetoId = raw.etapa?.projeto?.id ?? null;
    const fundo = projetoId ? (fundoByProjetoId.get(projetoId) ?? null) : null;
    return {
      id: raw.id,
      titulo: raw.titulo,
      descricao: raw.descricao,
      tipoPrazo: raw.tipoPrazo,
      dataPrevista: raw.dataPrevista,
      dataPrevistaEstimada: raw.dataPrevistaEstimada,
      competencia: raw.competencia,
      status: raw.status,
      subtarefas: raw.subtarefas,
      etapaNome: raw.etapa?.nome ?? null,
      projetoNome: raw.etapa?.projeto?.nome ?? null,
      fundoNome: fundo?.nome ?? null,
    };
  });

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
        {rotinaNomeById}
        onOpenDia={openDiaDialog}
        onOpenItem={(tipo, id) => openDialog({ kind: tipo, id })}
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
        <RoutinesByFundo
          grupos={rotinaGrupos}
          nomeById={rotinaNomeById}
          {hojeIso}
          onOpenFundo={openFundoDialog}
          onOpenRotina={openRotinaDialog}
        />
        <MonthHeatmap carga={carga} ano={anoMes.ano} mes={anoMes.mes} onOpenDia={openDiaDialog} />
      </div>
    </div>
    <div
      data-testid="dash-placeholder-projetos"
      class="order-4 lg:order-none lg:col-start-2 lg:row-start-2"
    >
      <ProjectStrips
        projetos={projetoRows()}
        {hojeIso}
        onVerProjetos={goToProjetos}
        onOpenFundo={openFundoDialog}
      />
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
  {:else if activeDialogRef?.kind === "dia"}
    <DayDialog
      open={true}
      iso={activeDialogRef.id}
      items={activeDiaItems}
      {rotinaNomeById}
      onOpenItem={(tipo, id) => openDialog({ kind: tipo, id })}
      onIrParaSemana={irParaEstaSemana}
      onOpenChange={(open) => {
        if (!open) closeAllDialogs();
      }}
    />
  {:else if activeDialogRef?.kind === "rotina"}
    <RotinaDialog
      open={true}
      rotina={activeRotina}
      breadcrumb={breadcrumbRef
        ? { label: breadcrumbLabelFor(breadcrumbRef), onClick: popToFirst }
        : undefined}
      onOpenChange={(open) => {
        if (!open) closeAllDialogs();
      }}
    />
  {:else if activeDialogRef?.kind === "tarefa"}
    <TaskDialog
      open={true}
      tarefa={activeTarefaForDialog}
      breadcrumb={breadcrumbRef
        ? { label: breadcrumbLabelFor(breadcrumbRef), onClick: popToFirst }
        : undefined}
      onOpenChange={(open) => {
        if (!open) closeAllDialogs();
      }}
    />
  {:else if activeDialogRef?.kind === "fundo"}
    <FundoDialog
      open={true}
      fundoId={activeDialogRef.id}
      fundoNome={fundoNomeFor(activeDialogRef.id)}
      instanciasRotina={dadosNormalizados.instanciasRotina}
      projetos={fundoDialogProjetos}
      tickets={fundoDialogTickets}
      onOpenChange={(open) => {
        if (!open) closeAllDialogs();
      }}
    />
  {/if}
{/if}
