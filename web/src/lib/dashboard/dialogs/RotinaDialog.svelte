<script lang="ts">
  import { tick } from "svelte";
  import EntityScreen from "../../entities/EntityScreen.svelte";
  import { configByEtype } from "../../entities/registry";
  import type { EntityConfig } from "../../entities/types";
  import FocusDialog from "./FocusDialog.svelte";

  // Never import defs/instanciasRotina.ts directly here -- always resolve
  // through the registry so its own default-export validation
  // (registry.ts:21-29) runs first, mirroring TicketDialog.svelte's/
  // TaskDialog.svelte's requireConfig idiom.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`RotinaDialog: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const instanciasRotinaConfig = requireConfig("instanciasRotina");

  export type RotinaDialogRow = {
    id: string;
    dedupeKey: string;
    dataPrevista: string;
    dataPrevistaEstimada?: string | null;
    competencia: string;
    tipoPrazo: string;
    status: string;
    templateNome?: string | null;
    fundoNome?: string | null;
  };

  // Self-contained: this component alone resolves everything it needs from
  // props plus its own internal hidden-EntityScreen host, so any future host
  // can mount it with nothing more than the row data and open/onOpenChange.
  // `breadcrumb` is used when Dia opens a rotina item as depth-2.
  let {
    open,
    rotina,
    onOpenChange,
    breadcrumb,
  }: {
    open: boolean;
    rotina: RotinaDialogRow | undefined;
    onOpenChange: (open: boolean) => void;
    breadcrumb?: { label: string; onClick: () => void };
  } = $props();

  // "editar": own hidden host, mirroring TicketDialog.svelte's/
  // TaskDialog.svelte's startEditar exactly. Zero new restriction logic
  // written here -- EntityScreen.svelte's own editableFields()
  // (EntityScreen.svelte:123-128) already narrows the resulting form to
  // `status` only, since instanciasRotinaConfig's updatableFields is already
  // ["status"].
  let editHostReady = $state(false);
  let editHostEl = $state<HTMLDivElement | undefined>(undefined);

  async function startEditar(): Promise<void> {
    if (!rotina) return;
    editHostReady = true;
    await tick();
    const deadline = Date.now() + 5000;
    const selector = `[data-testid="row"][data-eid="${rotina.id}"] [data-testid="row-edit"]`;
    while (Date.now() < deadline) {
      const el = editHostEl?.querySelector<HTMLButtonElement>(selector);
      if (el) {
        el.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // "ver na página completa": the same nav-click-simulation idiom every
  // other self-contained dialog in this phase already uses.
  function verPagina(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="nav-instanciasRotina"]')?.click();
    onOpenChange(false);
  }
</script>

{#if rotina}
  <FocusDialog
    {open}
    {onOpenChange}
    size="S"
    title={rotina.templateNome ?? "Rotina"}
    contexto={`${rotina.fundoNome ?? "Sem fundo"} · ${rotina.competencia}`}
    {breadcrumb}
    onEditar={startEditar}
    onVerPagina={verPagina}
  >
    {#snippet children()}
      <div class="space-y-2">
        <p class="text-sm">
          Data prevista: {rotina.dataPrevista.slice(8, 10)}/{rotina.dataPrevista.slice(
            5,
            7,
          )}/{rotina.dataPrevista.slice(0, 4)}
        </p>
        {#if rotina.dataPrevistaEstimada}
          <p class="text-sm text-muted-foreground">
            Data prevista estimada: {rotina.dataPrevistaEstimada.slice(
              8,
              10,
            )}/{rotina.dataPrevistaEstimada.slice(5, 7)}/{rotina.dataPrevistaEstimada.slice(
              0,
              4,
            )}
          </p>
        {/if}
        <p class="text-sm text-muted-foreground">Chave de deduplicação: {rotina.dedupeKey}</p>
        <p class="text-sm text-muted-foreground">Tipo de prazo: {rotina.tipoPrazo}</p>
        <p class="text-sm text-muted-foreground">Status: {rotina.status}</p>
        <p class="text-sm text-muted-foreground">
          Gerada pelo template: {rotina.templateNome ?? "—"}
        </p>
      </div>
    {/snippet}
  </FocusDialog>
{/if}

{#if editHostReady}
  <div
    class="hidden"
    aria-hidden="true"
    data-testid="rotina-dialog-edit-host"
    bind:this={editHostEl}
  >
    <EntityScreen config={instanciasRotinaConfig} />
  </div>
{/if}
