<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import type { Item, ItemTipo } from "../derive";
  import FocusDialog from "./FocusDialog.svelte";

  // The one dialog with no underlying entity to edit or navigate to (spec-ui.md
  // §4 row 2 / this phase's resolved decision) -- `onEditar`/`onVerPagina` are
  // simply never passed to FocusDialog below, so its footer never renders
  // those buttons. `footerExtra` carries "ir para esta semana" instead.
  let {
    open,
    iso,
    items,
    rotinaNomeById,
    onOpenItem,
    onIrParaSemana,
    onOpenChange,
    breadcrumb,
  }: {
    open: boolean;
    iso: string;
    items: Item[];
    rotinaNomeById: Map<string, string>;
    onOpenItem: (tipo: ItemTipo, id: string) => void;
    onIrParaSemana: (iso: string) => void;
    onOpenChange: (open: boolean) => void;
    breadcrumb?: { label: string; onClick: () => void };
  } = $props();

  const WEEKDAY_FULL = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
  ];

  function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Duplicated verbatim from WeekCalendar.svelte's own 3-line helper --
  // deliberate small duplication (23-04-PLAN.md Task 1), not worth extracting
  // into a shared module for 3 lines used by 2 components.
  function borderClassFor(tipo: ItemTipo): string {
    if (tipo === "tarefa") return "border-foreground";
    if (tipo === "rotina") return "border-muted-foreground";
    return "border-destructive";
  }

  function labelFor(item: Item): string {
    return item.tipo === "rotina" ? (rotinaNomeById.get(item.id) ?? "Rotina") : item.titulo;
  }

  const dow = $derived(new Date(`${iso}T00:00:00.000Z`).getUTCDay());
  const title = $derived(`${cap(WEEKDAY_FULL[dow])}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`);
  const contexto = $derived(
    `${items.length} afazeres · ${items.filter((i) => i.vencido).length} atrasados`,
  );
</script>

<FocusDialog {open} {onOpenChange} size="M" {title} {contexto} {breadcrumb}>
  {#snippet children()}
    <div data-testid="day-dialog-items" class="space-y-1">
      {#if items.length === 0}
        <p class="text-sm text-muted-foreground">Nenhum item neste dia.</p>
      {:else}
        {#each items as item (item.id)}
          <button
            type="button"
            data-testid="day-dialog-item"
            data-eid={item.id}
            data-tipo={item.tipo}
            class="block w-full text-left border-l-[3px] {borderClassFor(
              item.tipo,
            )} px-2 py-1 text-sm"
            onclick={() => onOpenItem(item.tipo, item.id)}
          >
            {labelFor(item)}
          </button>
        {/each}
      {/if}
    </div>
  {/snippet}
  {#snippet footerExtra()}
    <Button type="button" variant="outline" data-testid="day-dialog-ir-semana" onclick={() => onIrParaSemana(iso)}>
      ir para esta semana
    </Button>
  {/snippet}
</FocusDialog>
