<script lang="ts">
  import { tick } from "svelte";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import EntityScreen from "../../entities/EntityScreen.svelte";
  import { configByEtype } from "../../entities/registry";
  import type { EntityConfig } from "../../entities/types";
  import { tarefaConcluida, vencido } from "../derive";
  import FocusDialog from "./FocusDialog.svelte";

  // Never import defs/tarefas.ts directly here -- always resolve through the
  // registry so its own default-export validation (registry.ts:21-29) runs
  // first, mirroring TicketDialog.svelte's/ProjetosSection.svelte's
  // requireConfig idiom.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`TaskDialog: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const tarefasConfig = requireConfig("tarefas");

  // Deliberately flat, pre-shaped-by-the-host contract (never a nested
  // etapa.projeto.fundo link chain) -- every host that resolves a tarefa has
  // a DIFFERENT raw query shape (ProjetosSection.svelte here; Dashboard.svelte
  // in Plans 23-04/23-06), so each host does its own join/resolution
  // (derive.ts's own "cross-referencing happens once, at the host"
  // discipline) and hands this dialog an already-resolved row --
  // TaskDialog.svelte itself never inspects a nested link.
  export type TaskDialogRow = {
    id: string;
    titulo: string;
    descricao?: string | null;
    tipoPrazo: string;
    dataPrevista?: string | null;
    dataPrevistaEstimada?: string | null;
    competencia?: string | null;
    status: string;
    subtarefas?: { id: string; titulo: string; concluida: boolean }[];
    etapaNome?: string | null;
    projetoNome?: string | null;
    fundoNome?: string | null;
  };

  // Self-contained: this component alone resolves everything it needs from
  // props plus its own internal hidden-EntityScreen host, so any future host
  // can mount it with nothing more than the row data and open/onOpenChange.
  // `breadcrumb` is unused by this plan -- present so Plans 23-04/23-06's
  // depth-2 reuse (Projeto/Dia -> Tarefa) needs zero further edits to this
  // file.
  let {
    open,
    tarefa,
    onOpenChange,
    breadcrumb,
  }: {
    open: boolean;
    tarefa: TaskDialogRow | undefined;
    onOpenChange: (open: boolean) => void;
    breadcrumb?: { label: string; onClick: () => void };
  } = $props();

  // "editar": own hidden host, mirroring TicketDialog.svelte's startEditar
  // exactly.
  let editHostReady = $state(false);
  let editHostEl = $state<HTMLDivElement | undefined>(undefined);

  async function startEditar(): Promise<void> {
    if (!tarefa) return;
    editHostReady = true;
    await tick();
    const deadline = Date.now() + 5000;
    const selector = `[data-testid="row"][data-eid="${tarefa.id}"] [data-testid="row-edit"]`;
    while (Date.now() < deadline) {
      const el = editHostEl?.querySelector<HTMLButtonElement>(selector);
      if (el) {
        el.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // "ver na página completa": the exact goToProjetos idiom already in
  // Dashboard.svelte, now owned locally by this dialog. Per 23-RESEARCH.md
  // Pitfall 4, never close the focus dialog before/at "editar" click -- only
  // "ver na página completa" closes it.
  function verPagina(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="nav-projetos"]')?.click();
    onOpenChange(false);
  }
</script>

{#if tarefa}
  <FocusDialog
    {open}
    {onOpenChange}
    size="S"
    title={tarefa.titulo}
    contexto={`${tarefa.fundoNome ?? "Sem fundo"} · ${tarefa.etapaNome ? `${tarefa.projetoNome} · ${tarefa.etapaNome}` : "Sem etapa"}`}
    {breadcrumb}
    onEditar={startEditar}
    onVerPagina={verPagina}
  >
    {#snippet children()}
      <div class="space-y-4">
        {#if tarefa.descricao}
          <p class="text-sm whitespace-pre-wrap">{tarefa.descricao}</p>
        {/if}
        <p
          class={vencido(
            tarefa.dataPrevista,
            tarefaConcluida({ subtarefas: tarefa.subtarefas }),
            new Date(),
          )
            ? "text-sm text-destructive"
            : "text-sm"}
        >
          {tarefa.tipoPrazo.toUpperCase()} ·
          {tarefa.dataPrevista ? tarefa.dataPrevista.slice(0, 10) : "—"}
        </p>
        {#if tarefa.dataPrevistaEstimada}
          <p class="text-sm text-muted-foreground">
            Estimativa: {tarefa.dataPrevistaEstimada.slice(0, 10)}
          </p>
        {/if}
        {#if tarefa.competencia}
          <p class="text-sm text-muted-foreground">Competência: {tarefa.competencia}</p>
        {/if}
        <p class="text-sm text-muted-foreground">Status: {tarefa.status}</p>
        <div data-testid="task-dialog-subtarefas" class="space-y-1">
          {#each tarefa.subtarefas ?? [] as subtarefa (subtarefa.id)}
            <div class="flex items-center gap-2">
              <Checkbox checked={subtarefa.concluida} disabled />
              <span class="flex-1 text-sm">{subtarefa.titulo}</span>
            </div>
          {/each}
        </div>
      </div>
    {/snippet}
  </FocusDialog>
{/if}

{#if editHostReady}
  <div class="hidden" aria-hidden="true" data-testid="task-dialog-edit-host" bind:this={editHostEl}>
    <EntityScreen config={tarefasConfig} />
  </div>
{/if}
