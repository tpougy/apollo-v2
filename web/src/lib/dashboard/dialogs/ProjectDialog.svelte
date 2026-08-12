<script lang="ts">
  import { tick } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import EntityScreen from "../../entities/EntityScreen.svelte";
  import { configByEtype } from "../../entities/registry";
  import type { EntityConfig } from "../../entities/types";
  import { progressoEtapa, tarefaConcluida, vencido } from "../derive";
  import FocusDialog from "./FocusDialog.svelte";

  // Never import defs/projetos.ts or defs/tarefas.ts directly here -- always
  // resolve through the registry so its own default-export validation
  // (registry.ts:21-29) runs first, mirroring every other dialog's
  // requireConfig idiom.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`ProjectDialog: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const projetosConfig = requireConfig("projetos");
  const tarefasConfig = requireConfig("tarefas");

  // Same flat, pre-shaped-by-the-host contract as every other dialog's row
  // type (TaskDialogRow/EtapaDialogRow) -- Dashboard.svelte does its own
  // join/resolution and hands this dialog an already-resolved row.
  export type ProjectDialogRow = {
    id: string;
    nome: string;
    fundoNome?: string | null;
    etapas: {
      id: string;
      nome: string;
      ordem: number;
      tarefas: {
        id: string;
        titulo: string;
        tipoPrazo: string;
        dataPrevista?: string | null;
        status: string;
        subtarefas?: { concluida: boolean }[];
      }[];
    }[];
  };

  // No `breadcrumb` prop -- like Dia, Projeto is always depth-1, never
  // itself a second-level target (only Etapa/Tarefa can be opened FROM it,
  // via `onOpenEtapa`/`onOpenTarefa` below, which Dashboard.svelte wires to
  // the SAME `openDialog` mechanism every other dialog kind uses).
  let {
    open,
    projeto,
    onOpenEtapa,
    onOpenTarefa,
    onOpenChange,
  }: {
    open: boolean;
    projeto: ProjectDialogRow | undefined;
    onOpenEtapa: (id: string) => void;
    onOpenTarefa: (id: string) => void;
    onOpenChange: (open: boolean) => void;
  } = $props();

  // "+ tarefa" per coluna: a THIRD independent hidden-EntityScreen host
  // inside this one dialog component (alongside the "editar" host below),
  // mirroring ProjetosSection.svelte's own startCreateTarefa/tarefaHostEl
  // pattern (ProjetosSection.svelte:346-373) exactly. `presetLinks` reads
  // the LIVE `addTarefaEtapaId` `$state` every render (never a snapshotted
  // value), so by the time the bounded poll's `.click()` fires,
  // `EntityScreen`'s own `startCreate()` reads the already-current preset
  // link -- identical to ProjetosSection.svelte:366-373's own documented
  // reasoning. T-23-14: `presetLinks` only pre-fills the form's own link
  // select (still visible/editable); the server-side `db.transact` call
  // still goes through `EntityScreen.svelte`'s unmodified
  // validation/link-target-exists check.
  let addTarefaHostReady = $state(false);
  let addTarefaHostEl = $state<HTMLDivElement | undefined>(undefined);
  let addTarefaEtapaId = $state<string | null>(null);

  async function startAddTarefa(etapaId: string): Promise<void> {
    addTarefaEtapaId = etapaId;
    addTarefaHostReady = true;
    await tick();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const el = addTarefaHostEl?.querySelector<HTMLButtonElement>(
        '[data-testid="entity-create-start"]',
      );
      if (el) {
        el.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // "editar": a SEPARATE, second hidden host (`project-dialog-edit-host`,
  // never sharing `addTarefaHostEl`), driving `projetosConfig`'s `row-edit`
  // on the projeto's own id -- same shape as every other dialog's
  // startEditar.
  let editHostReady = $state(false);
  let editHostEl = $state<HTMLDivElement | undefined>(undefined);

  async function startEditar(): Promise<void> {
    if (!projeto) return;
    editHostReady = true;
    await tick();
    const deadline = Date.now() + 5000;
    const selector = `[data-testid="row"][data-eid="${projeto.id}"] [data-testid="row-edit"]`;
    while (Date.now() < deadline) {
      const el = editHostEl?.querySelector<HTMLButtonElement>(selector);
      if (el) {
        el.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // "ver na página completa": same nav-projetos idiom as every other
  // Projeto/Etapa/Tarefa-adjacent dialog in this phase.
  function verPagina(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="nav-projetos"]')?.click();
    onOpenChange(false);
  }
</script>

{#if projeto}
  <FocusDialog
    {open}
    {onOpenChange}
    size="L"
    title={projeto.nome}
    contexto={`${projeto.fundoNome ?? "Sem fundo vinculado"} · ${projeto.etapas.length} etapas · ${projeto.etapas.reduce((s, e) => s + e.tarefas.length, 0)} tarefas`}
    onEditar={startEditar}
    onVerPagina={verPagina}
  >
    {#snippet children()}
      <!--
        spec-ui.md §4 row 4: kanban completo das etapas na ordem, scroll
        horizontal, "+ tarefa" por coluna. Plain overflow-x-auto scroll, no
        measured scrollWidth-vs-clientWidth `›` overflow indicator here --
        that discipline is ProjectStrips.svelte's own §3.5 dashboard-strip
        rule, not restated for this dialog's own kanban by §4.
      -->
      <div data-testid="project-dialog-kanban" class="flex gap-2 overflow-x-auto pb-2">
        {#each [...projeto.etapas].sort((a, b) => a.ordem - b.ordem) as etapa (etapa.id)}
          {@const { feitas, total } = progressoEtapa(etapa)}
          <!--
            data-testid/data-eid on the wrapping column div (not called out
            explicitly by this plan's action text, which only names the
            header/card testids) mirrors ProjectStrips.svelte's own
            project-strip-column container -- added at Claude's discretion
            purely for e2e scoping symmetry, documented in this plan's
            SUMMARY per the "resolve ambiguity, document the call"
            instruction.
          -->
          <div
            data-testid="project-dialog-column"
            data-eid={etapa.id}
            class="w-48 shrink-0 box-border border-r px-2 space-y-2"
          >
            <button
              type="button"
              data-testid="project-dialog-column-header"
              data-eid={etapa.id}
              class="block w-full text-left space-y-1"
              onclick={() => onOpenEtapa(etapa.id)}
            >
              <span class="font-mono text-xs">{etapa.ordem}</span>
              <span class="block text-sm font-medium">{etapa.nome}</span>
              <span class="block text-xs text-muted-foreground">{feitas}/{total}</span>
            </button>
            <!-- No 3-cap -- this dialog's whole purpose is the uncapped view. -->
            {#each etapa.tarefas as tarefa (tarefa.id)}
              {@const concluida = tarefaConcluida(tarefa)}
              {@const atrasada = vencido(tarefa.dataPrevista, concluida, new Date())}
              <button
                type="button"
                data-testid="project-dialog-card"
                data-eid={tarefa.id}
                class={atrasada
                  ? "block w-full rounded border p-2 text-left space-y-1 border-l-[3px] border-destructive"
                  : "block w-full rounded border p-2 text-left space-y-1"}
                onclick={(e) => {
                  e.stopPropagation();
                  onOpenTarefa(tarefa.id);
                }}
              >
                <p class="line-clamp-2 text-sm">{tarefa.titulo}</p>
                <p
                  class={atrasada
                    ? "text-xs text-destructive"
                    : "text-xs text-muted-foreground"}
                >
                  {tarefa.tipoPrazo.toUpperCase()}
                  {tarefa.dataPrevista
                    ? `${tarefa.dataPrevista.slice(8, 10)}/${tarefa.dataPrevista.slice(5, 7)}`
                    : "-"}
                </p>
              </button>
            {/each}
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="project-dialog-add-tarefa"
              data-eid={etapa.id}
              onclick={() => startAddTarefa(etapa.id)}
            >
              + tarefa
            </Button>
          </div>
        {/each}
      </div>
    {/snippet}
  </FocusDialog>
{/if}

{#if addTarefaHostReady}
  <div
    class="hidden"
    aria-hidden="true"
    data-testid="project-dialog-add-tarefa-host"
    bind:this={addTarefaHostEl}
  >
    <EntityScreen
      config={tarefasConfig}
      presetLinks={addTarefaEtapaId ? { etapa: addTarefaEtapaId } : null}
    />
  </div>
{/if}

{#if editHostReady}
  <div
    class="hidden"
    aria-hidden="true"
    data-testid="project-dialog-edit-host"
    bind:this={editHostEl}
  >
    <EntityScreen config={projetosConfig} />
  </div>
{/if}
