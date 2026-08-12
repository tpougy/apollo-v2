<script lang="ts">
  import { tick } from "svelte";
  import EntityScreen from "../../entities/EntityScreen.svelte";
  import { configByEtype } from "../../entities/registry";
  import type { EntityConfig } from "../../entities/types";
  import { tarefaConcluida, vencido } from "../derive";
  import FocusDialog from "./FocusDialog.svelte";

  // Never import defs/etapas.ts directly here -- always resolve through the
  // registry so its own default-export validation (registry.ts:21-29) runs
  // first, mirroring TaskDialog.svelte's/TicketDialog.svelte's requireConfig
  // idiom.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`EtapaDialog: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const etapasConfig = requireConfig("etapas");

  // Same flat, pre-shaped-by-the-host contract as TaskDialogRow -- the host
  // (ProjetosSection.svelte here) does its own join/resolution and hands this
  // dialog an already-resolved row.
  export type EtapaDialogRow = {
    id: string;
    nome: string;
    ordem: number;
    projetoNome?: string | null;
    fundoNome?: string | null;
    tarefas?: {
      id: string;
      titulo: string;
      dataPrevista?: string | null;
      status: string;
      subtarefas?: { concluida: boolean }[];
    }[];
  };

  // Self-contained, same shape as TaskDialog.svelte -- `breadcrumb` unused by
  // this plan, present so Plans 23-04/23-06's depth-2 reuse needs zero
  // further edits to this file.
  let {
    open,
    etapa,
    onOpenChange,
    breadcrumb,
  }: {
    open: boolean;
    etapa: EtapaDialogRow | undefined;
    onOpenChange: (open: boolean) => void;
    breadcrumb?: { label: string; onClick: () => void };
  } = $props();

  // "editar": own hidden host, mirroring TaskDialog.svelte's startEditar
  // exactly.
  let editHostReady = $state(false);
  let editHostEl = $state<HTMLDivElement | undefined>(undefined);

  async function startEditar(): Promise<void> {
    if (!etapa) return;
    editHostReady = true;
    await tick();
    const deadline = Date.now() + 5000;
    const selector = `[data-testid="row"][data-eid="${etapa.id}"] [data-testid="row-edit"]`;
    while (Date.now() < deadline) {
      const el = editHostEl?.querySelector<HTMLButtonElement>(selector);
      if (el) {
        el.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // "ver na página completa": same nav-projetos idiom as TaskDialog.svelte.
  function verPagina(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="nav-projetos"]')?.click();
    onOpenChange(false);
  }
</script>

{#if etapa}
  <FocusDialog
    {open}
    {onOpenChange}
    size="M"
    title={etapa.nome}
    contexto={`${etapa.fundoNome ?? "Sem fundo"} · ${etapa.projetoNome ?? "Sem projeto"}`}
    {breadcrumb}
    onEditar={startEditar}
    onVerPagina={verPagina}
  >
    {#snippet children()}
      <div class="space-y-4">
        <p class="text-sm text-muted-foreground">Ordem: {etapa.ordem}</p>
        <!--
          Every tarefa in etapa.tarefas, no 3-item cap (unlike the Dashboard's
          own mini-kanban strips) -- plain read-only rows, NOT buttons. Etapa
          is always a leaf: its own task list never opens a Tarefa dialog
          from inside the Etapa dialog (that click target only exists one
          level up, in the Projeto dialog's own kanban body, per resolved
          decision on depth-cap-2).
        -->
        <div data-testid="etapa-dialog-tarefas" class="space-y-1">
          {#each etapa.tarefas ?? [] as tarefa (tarefa.id)}
            <div class="flex items-center gap-4">
              <span class="flex-1 text-sm">{tarefa.titulo}</span>
              <span
                class={vencido(tarefa.dataPrevista, tarefaConcluida(tarefa), new Date())
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"}
              >
                {tarefa.dataPrevista ? tarefa.dataPrevista.slice(0, 10) : "—"}
              </span>
              <span class="text-xs text-muted-foreground">{tarefa.status}</span>
            </div>
          {/each}
        </div>
      </div>
    {/snippet}
  </FocusDialog>
{/if}

{#if editHostReady}
  <div class="hidden" aria-hidden="true" data-testid="etapa-dialog-edit-host" bind:this={editHostEl}>
    <EntityScreen config={etapasConfig} />
  </div>
{/if}
