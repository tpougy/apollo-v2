<script lang="ts">
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import { tick } from "svelte";
  import { Alert, AlertDescription } from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { db } from "../db";
  import EntityScreen from "../entities/EntityScreen.svelte";
  import { configByEtype } from "../entities/registry";
  import type { EntityConfig } from "../entities/types";

  // Never import a defs/*.ts module directly here — always resolve through
  // the registry so its own default-export validation (registry.ts:21-29)
  // runs first. `etapasConfig`/`tarefasConfig` are resolved the same way in
  // Plan 19-02/19-03 when first needed, not here.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`ProjetosSection: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const projetosConfig = requireConfig("projetos");

  // Row shapes mirror the exact nesting of the bespoke query below — one
  // level deeper than the generic EntityScreen.buildQuery can express
  // (19-RESEARCH.md Pattern 1).
  type SubtarefaRow = { id: string; titulo: string; concluida: boolean };
  type TarefaRow = {
    id: string;
    titulo: string;
    status: string;
    tipoPrazo: string;
    dataPrevista?: string;
    subtarefas?: SubtarefaRow[];
  };
  type EtapaRow = {
    id: string;
    nome: string;
    ordem: number;
    status: string;
    tarefas?: TarefaRow[];
  };
  type ProjetoRow = {
    id: string;
    nome: string;
    status: string;
    dataInicioPrevista?: string;
    dataFimPrevista?: string;
    fundo?: { id: string; nome: string };
    etapas?: EtapaRow[];
  };

  // The ONE bespoke db.useQuery this component ever issues directly — Plan
  // 19-02/19-03 read from this same `query`/`rowsOf()`, never a second
  // top-level fetch. Cast at the InstaQL boundary is the same precedent
  // EntityScreen.svelte:82 uses for its own `db.useQuery(() => buildQuery(config)
  // as never)` — config.etype/this literal shape are runtime values, not a
  // literal from the generated schema union.
  const query = db.useQuery(
    () =>
      ({
        projetos: { fundo: {}, etapas: { tarefas: { subtarefas: {} } } },
      }) as never,
  );

  function rowsOf(): ProjetoRow[] {
    const data = query.data as Record<string, ProjetoRow[]> | undefined;
    return (data?.projetos ?? []) as ProjetoRow[];
  }

  function totalTarefas(projeto: ProjetoRow): number {
    return (projeto.etapas ?? []).reduce((sum, e) => sum + (e.tarefas ?? []).length, 0);
  }

  type GroupBy = "fundo" | "nenhum" | "status";

  let searchTerm = $state("");
  let groupBy = $state<GroupBy>("fundo");
  let selectedProjetoId = $state<string | null>(null);

  // Mirrors Shell.svelte's own nestedGroups grouping pattern (Map +
  // Array.from(entries), zero per-entity branching), extended to 3 modes.
  // "Sem fundo vinculado" is forced last only in "fundo" mode — "status"
  // mode sorts purely alphabetically, per spec §2.2's display-only control.
  function groupProjetos(
    rows: ProjetoRow[],
    mode: GroupBy,
  ): { label: string | null; rows: ProjetoRow[] }[] {
    const sorted = [...rows].sort((a, b) => a.nome.localeCompare(b.nome));
    if (mode === "nenhum") {
      return [{ label: null, rows: sorted }];
    }
    const groups = new Map<string, ProjetoRow[]>();
    for (const row of sorted) {
      const label = mode === "fundo" ? row.fundo?.nome ?? "Sem fundo vinculado" : row.status;
      const list = groups.get(label) ?? [];
      list.push(row);
      groups.set(label, list);
    }
    const entries = Array.from(groups.entries());
    entries.sort((a, b) => {
      if (mode === "fundo") {
        if (a[0] === "Sem fundo vinculado") return 1;
        if (b[0] === "Sem fundo vinculado") return -1;
      }
      return a[0].localeCompare(b[0]);
    });
    return entries.map(([label, groupRows]) => ({ label, rows: groupRows }));
  }

  // Client-side filter over already-loaded rows — spec §2.2's "filtro
  // client-side sobre as linhas já carregadas". Never re-query on input.
  const filtered = $derived(
    rowsOf().filter((r) => r.nome.toLowerCase().includes(searchTerm.trim().toLowerCase())),
  );
  const groups = $derived(groupProjetos(filtered, groupBy));

  const selectedProjeto = $derived(
    selectedProjetoId ? rowsOf().find((r) => r.id === selectedProjetoId) : undefined,
  );

  // Hidden host for "+ novo projeto" / "editar projeto" (Task 2) — the only
  // spec-compliant way to reuse EntityScreen's create/edit dialog from
  // outside its own mount (19-RESEARCH.md Pattern 2; bits-ui's Dialog Portal
  // renders to document.body regardless of a hidden ancestor).
  // `EntityScreen.svelte` gets neither a third prop nor a mode/etype branch —
  // every "+ X" affordance in this phase drives a real, unmodified
  // EntityScreen instance's own DOM button instead.
  //
  // Lazily mounted (`{#if projetoHostReady}` below): EntityScreen
  // unconditionally renders its own <h2>{config.titulo}</h2>, and this
  // component must render exactly one <h2> on the page (the one above) until
  // the user's first "+ novo projeto"/"editar projeto" click — keeps
  // shell-nav.spec.ts's single-<h2> assertion green for every flow that never
  // opens a create/edit dialog.
  //
  // Every query into this host is scoped to `projetoHostEl` (never a bare
  // global `document.querySelector`), so a second hidden host added in Plan
  // 19-02 can never be mis-targeted.
  let projetoHostReady = $state(false);
  let projetoHostEl = $state<HTMLDivElement | undefined>(undefined);

  async function openProjetoDialog(selector: string): Promise<void> {
    projetoHostReady = true;
    await tick();
    projetoHostEl?.querySelector<HTMLButtonElement>(selector)?.click();
  }

  function startCreateProjeto(): void {
    void openProjetoDialog('[data-testid="entity-create-start"]');
  }
</script>

<section class="space-y-6">
  <h2 class="text-xl font-semibold tracking-tight">Projetos</h2>

  {#if query.isLoading}
    <div data-testid="projetos-loading" class="space-y-2">
      {#each Array(5) as _, rowIndex (rowIndex)}
        <Skeleton class="h-8 w-full" />
      {/each}
    </div>
  {:else if query.error}
    <Alert variant="destructive">
      <CircleAlert class="size-4" />
      <AlertDescription data-testid="projetos-query-error">{query.error.message}</AlertDescription>
    </Alert>
  {:else}
    <div class="flex gap-6">
      <div class="w-56 border-r shrink-0 space-y-4">
        <Input
          data-testid="project-search"
          placeholder="Buscar por nome..."
          value={searchTerm}
          oninput={(e) => {
            searchTerm = e.currentTarget.value;
          }}
        />

        <Select.Root
          type="single"
          value={groupBy}
          onValueChange={(v) => {
            if (v) groupBy = v as GroupBy;
          }}
        >
          <Select.Trigger data-testid="project-groupby" class="w-full">
            {`agrupar: ${groupBy}`}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="fundo" label="fundo">fundo</Select.Item>
            <Select.Item value="nenhum" label="nenhum">nenhum</Select.Item>
            <Select.Item value="status" label="status">status</Select.Item>
          </Select.Content>
        </Select.Root>

        <Button
          type="button"
          data-testid="project-create-start"
          class="w-full"
          onclick={startCreateProjeto}
        >
          + novo projeto
        </Button>

        <div data-testid="project-list" class="space-y-4">
          {#each groups as group (group.label ?? "__flat__")}
            <div data-testid="project-group" class="space-y-1">
              {#if group.label !== null}
                <p
                  data-testid="project-group-heading"
                  class="text-xs uppercase text-muted-foreground"
                >
                  {group.label}
                </p>
              {/if}
              {#each group.rows as row (row.id)}
                <Button
                  type="button"
                  variant={row.id === selectedProjetoId ? "secondary" : "ghost"}
                  class="w-full justify-start"
                  data-testid="project-item"
                  data-eid={row.id}
                  onclick={() => (selectedProjetoId = row.id)}
                >
                  {row.nome}
                </Button>
              {/each}
            </div>
          {/each}
        </div>
      </div>

      <div class="flex-1">
        {#if selectedProjeto}
          <div data-testid="project-detail" class="space-y-4">
            <p data-testid="project-breadcrumb" class="text-xs text-muted-foreground">
              PROJETOS › {selectedProjeto.nome}
            </p>
            <div data-testid="project-header" class="space-y-1">
              <h3 class="text-lg font-semibold">{selectedProjeto.nome}</h3>
              <p class="text-sm text-muted-foreground">
                {selectedProjeto.fundo?.nome ?? "Sem fundo vinculado"} ·
                {(selectedProjeto.etapas ?? []).length} etapas ·
                {totalTarefas(selectedProjeto)} tarefas
              </p>
            </div>
            <!--
              "editar projeto" (Task 2 of this plan) and "+ etapa" (Plan
              19-02) header actions are added afterward — this task adds
              neither button.
            -->
          </div>
        {:else}
          <div data-testid="project-empty">
            <p class="text-sm text-muted-foreground">
              Selecione um projeto para ver seus detalhes.
            </p>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if projetoHostReady}
    <div class="hidden" aria-hidden="true" data-testid="projeto-host" bind:this={projetoHostEl}>
      <EntityScreen config={projetosConfig} />
    </div>
  {/if}
</section>
