<script lang="ts">
  import { tick } from "svelte";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import EntityScreen from "../../entities/EntityScreen.svelte";
  import { configByEtype } from "../../entities/registry";
  import type { EntityConfig } from "../../entities/types";
  import FocusDialog from "./FocusDialog.svelte";

  // Never import defs/tickets.ts directly here -- always resolve through the
  // registry so its own default-export validation (registry.ts:21-29) runs
  // first, mirroring ProjetosSection.svelte's/SubtarefasPanel.svelte's
  // requireConfig idiom.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`TicketDialog: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const ticketsConfig = requireConfig("tickets");

  export type TicketDialogRow = {
    id: string;
    titulo: string;
    corpo: string;
    remetente: string;
    dataRecebimento: string;
    dataPrevista?: string | null;
    tipoPrazo: string;
    fundo?: { id: string; nome: string } | null;
    subtarefas?: { id: string; titulo: string; concluida: boolean }[];
  };

  // Self-contained: this component alone resolves everything it needs from
  // props plus its own internal hidden-EntityScreen host, so any future host
  // can mount it with nothing more than the row data and open/onOpenChange.
  // `breadcrumb` is unused by this plan -- present so Plan 23-04's Dia→Ticket
  // depth-2 reuse needs zero further edits to this file.
  let {
    open,
    ticket,
    onOpenChange,
    breadcrumb,
  }: {
    open: boolean;
    ticket: TicketDialogRow | undefined;
    onOpenChange: (open: boolean) => void;
    breadcrumb?: { label: string; onClick: () => void };
  } = $props();

  // "editar": own hidden host, mirroring ProjetosSection.svelte's
  // openProjetoDialog (ProjetosSection.svelte:200-212) exactly.
  let editHostReady = $state(false);
  let editHostEl = $state<HTMLDivElement | undefined>(undefined);

  async function startEditar(): Promise<void> {
    if (!ticket) return;
    editHostReady = true;
    await tick();
    const deadline = Date.now() + 5000;
    const selector = `[data-testid="row"][data-eid="${ticket.id}"] [data-testid="row-edit"]`;
    while (Date.now() < deadline) {
      const el = editHostEl?.querySelector<HTMLButtonElement>(selector);
      if (el) {
        el.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // "ver na página completa": the exact goToTickets idiom already in
  // Dashboard.svelte:74-76, now owned locally by this dialog. Per Pitfall 4
  // (23-RESEARCH.md), never close the focus dialog before/at "editar" click --
  // only "ver na página completa" closes it.
  function verPagina(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="nav-tickets"]')?.click();
    onOpenChange(false);
  }
</script>

{#if ticket}
  <FocusDialog
    {open}
    {onOpenChange}
    size="M"
    title={ticket.titulo}
    contexto={`${ticket.fundo?.nome ?? "Sem fundo"} · ${ticket.tipoPrazo.toUpperCase()} · ${(ticket.dataPrevista ?? ticket.dataRecebimento).slice(0, 10)}`}
    {breadcrumb}
    onEditar={startEditar}
    onVerPagina={verPagina}
  >
    {#snippet children()}
      <div class="space-y-4">
        <p class="text-sm whitespace-pre-wrap">{ticket.corpo}</p>
        <p class="text-sm text-muted-foreground">Remetente: {ticket.remetente}</p>
        <p class="text-sm text-muted-foreground">
          Recebido em: {ticket.dataRecebimento.slice(0, 10)}
        </p>
        <div data-testid="ticket-dialog-subtarefas" class="space-y-1">
          {#each ticket.subtarefas ?? [] as subtarefa (subtarefa.id)}
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
  <div class="hidden" aria-hidden="true" data-testid="ticket-dialog-edit-host" bind:this={editHostEl}>
    <EntityScreen config={ticketsConfig} />
  </div>
{/if}
