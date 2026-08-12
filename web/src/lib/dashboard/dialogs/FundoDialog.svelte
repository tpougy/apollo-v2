<script lang="ts">
  import { tick } from "svelte";
  import EntityScreen from "../../entities/EntityScreen.svelte";
  import { configByEtype } from "../../entities/registry";
  import type { EntityConfig } from "../../entities/types";
  import { rotinasDoFundo } from "../derive";
  import FocusDialog from "./FocusDialog.svelte";

  // Never import defs/fundos.ts directly here -- always resolve through the
  // registry so its own default-export validation (registry.ts:21-29) runs
  // first, mirroring TicketDialog.svelte's/EtapaDialog.svelte's requireConfig
  // idiom.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`FundoDialog: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const fundosConfig = requireConfig("fundos");

  // No `breadcrumb` prop -- Fundo is never reachable as a second-level
  // dialog (only Projeto and Dia can ever open a second level, and neither's
  // own body ever targets a fundo), so this dialog is always depth-1 only.
  //
  // Deliberately the one dialog that imports and calls a `derive.ts` export
  // directly (`rotinasDoFundo`, Plan 23-02) rather than receiving an
  // already-filtered list, since the week-unbounded filter is a pure,
  // host-agnostic rule any host could apply identically. `instanciasRotina`
  // is the full, unfiltered array Dashboard.svelte already holds
  // (`dadosNormalizados.instanciasRotina`) -- structurally compatible via TS
  // structural typing, zero cast needed.
  let {
    open,
    fundoId,
    fundoNome,
    instanciasRotina,
    projetos,
    tickets,
    onOpenChange,
  }: {
    open: boolean;
    fundoId: string;
    fundoNome: string;
    instanciasRotina: {
      id: string;
      dataPrevista: string;
      tipoPrazo: string;
      template: { nome: string; fundo: { id: string; nome: string } | null } | null;
    }[];
    projetos: { id: string; nome: string; fundoId: string | null }[];
    tickets: { id: string; titulo: string; fundoId: string | null }[];
    onOpenChange: (open: boolean) => void;
  } = $props();

  const rotinas = $derived(rotinasDoFundo(instanciasRotina, fundoId));
  const projetosVinculados = $derived(projetos.filter((p) => p.fundoId === fundoId));
  const ticketsVinculados = $derived(tickets.filter((t) => t.fundoId === fundoId));

  // "editar": own hidden host, mirroring TicketDialog.svelte's/
  // EtapaDialog.svelte's startEditar exactly.
  let editHostReady = $state(false);
  let editHostEl = $state<HTMLDivElement | undefined>(undefined);

  async function startEditar(): Promise<void> {
    if (!fundoId) return;
    editHostReady = true;
    await tick();
    const deadline = Date.now() + 5000;
    const selector = `[data-testid="row"][data-eid="${fundoId}"] [data-testid="row-edit"]`;
    while (Date.now() < deadline) {
      const el = editHostEl?.querySelector<HTMLButtonElement>(selector);
      if (el) {
        el.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // "ver na página completa": same nav-click idiom as every other dialog in
  // this phase, targeting `nav-fundos` (Shell.svelte's generic
  // `nav-${cfg.etype}` button -- fundos has no dedicated route branch, so it
  // is served by Shell.svelte's generic EntityScreen fallback).
  function verPagina(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="nav-fundos"]')?.click();
    onOpenChange(false);
  }
</script>

<FocusDialog
  {open}
  {onOpenChange}
  size="M"
  title={fundoNome}
  contexto={`${rotinas.length} rotinas · ${projetosVinculados.length} projetos · ${ticketsVinculados.length} tickets`}
  onEditar={startEditar}
  onVerPagina={verPagina}
>
  {#snippet children()}
    <div class="space-y-4">
      <div class="space-y-1">
        <p class="text-xs font-medium text-muted-foreground">Rotinas</p>
        <div data-testid="fundo-dialog-rotinas" class="space-y-1">
          {#if rotinas.length === 0}
            <p class="text-sm text-muted-foreground">Nenhuma rotina vinculada.</p>
          {:else}
            {#each rotinas as instancia (instancia.id)}
              <div class="flex items-center gap-4">
                <span class="flex-1 text-sm">{instancia.template?.nome ?? "Rotina"}</span>
                <span class="text-xs text-muted-foreground">
                  {instancia.dataPrevista.slice(0, 10)}
                </span>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="space-y-1">
        <p class="text-xs font-medium text-muted-foreground">Projetos</p>
        <div data-testid="fundo-dialog-projetos" class="space-y-1">
          {#if projetosVinculados.length === 0}
            <p class="text-sm text-muted-foreground">Nenhum projeto vinculado.</p>
          {:else}
            {#each projetosVinculados as projeto (projeto.id)}
              <p class="text-sm">{projeto.nome}</p>
            {/each}
          {/if}
        </div>
      </div>

      <div class="space-y-1">
        <p class="text-xs font-medium text-muted-foreground">Tickets</p>
        <div data-testid="fundo-dialog-tickets" class="space-y-1">
          {#if ticketsVinculados.length === 0}
            <p class="text-sm text-muted-foreground">Nenhum ticket vinculado.</p>
          {:else}
            {#each ticketsVinculados as ticket (ticket.id)}
              <p class="text-sm">{ticket.titulo}</p>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/snippet}
</FocusDialog>

{#if editHostReady}
  <div class="hidden" aria-hidden="true" data-testid="fundo-dialog-edit-host" bind:this={editHostEl}>
    <EntityScreen config={fundosConfig} />
  </div>
{/if}
