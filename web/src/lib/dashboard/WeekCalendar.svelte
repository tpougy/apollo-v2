<script lang="ts">
  import * as Popover from "$lib/components/ui/popover";
  import type { Item, ItemTipo } from "./derive";

  // All data arrives as props, computed once by Dashboard.svelte from its
  // single dashboardQuery.ts result (DASH-07) — this component never calls
  // db.useQuery or any dashboardQuery.ts/derive.ts export itself.
  let {
    dias,
    agenda,
    hojeIso,
    sabado,
    domingo,
    rotinaNomeById,
    onOpenDia,
    onOpenItem,
  }: {
    dias: string[];
    agenda: Map<string, Item[]>;
    hojeIso: string;
    sabado: string;
    domingo: string;
    rotinaNomeById: Map<string, string>;
    onOpenDia: (iso: string) => void;
    onOpenItem: (tipo: ItemTipo, id: string) => void;
  } = $props();

  // dias[0] is always Monday per semanaUtil's own contract — no weekday
  // recomputation needed, just a fixed positional lookup.
  const WEEKDAY_ABBREV = ["SEG", "TER", "QUA", "QUI", "SEX"];

  // spec-ui.md §3.3 / §0.1: only these three tokens, no new color.
  function borderClassFor(tipo: ItemTipo): string {
    if (tipo === "tarefa") return "border-foreground";
    if (tipo === "rotina") return "border-muted-foreground";
    return "border-destructive";
  }

  // Pitfall 1 fix (23-04-PLAN.md Task 3): a rotina Item's `titulo` is only
  // ever `instancia.id` (derive.ts:252-258's own documented placeholder) --
  // resolve the real template name via the Dashboard-provided lookup instead.
  function labelFor(item: Item): string {
    return item.tipo === "rotina" ? (rotinaNomeById.get(item.id) ?? "Rotina") : item.titulo;
  }

  const weekendCount = $derived(
    (agenda.get(sabado)?.length ?? 0) + (agenda.get(domingo)?.length ?? 0),
  );
  const sabadoItems = $derived(agenda.get(sabado) ?? []);
  const domingoItems = $derived(agenda.get(domingo) ?? []);
</script>

<div data-testid="dash-week" class="grid grid-cols-5 gap-2">
  {#each dias as dia, i (dia)}
    {@const items = agenda.get(dia) ?? []}
    {@const visibleItems = items.slice(0, 3)}
    {@const overflow = items.length - visibleItems.length}
    <div data-testid="dash-week-day" data-eid={dia} class="rounded border">
      <button
        type="button"
        data-testid="dash-week-day-header"
        data-eid={dia}
        class="w-full px-2 py-1 text-left text-xs font-medium {dia === hojeIso
          ? 'bg-muted'
          : ''}"
        onclick={() => onOpenDia(dia)}
      >
        {WEEKDAY_ABBREV[i]} {Number(dia.slice(8, 10))} ({items.length})
      </button>
      <div class="space-y-1 p-1">
        {#each visibleItems as item (item.id)}
          <button
            type="button"
            data-testid="dash-week-item"
            data-eid={item.id}
            data-tipo={item.tipo}
            class="block w-full truncate border-l-[3px] {borderClassFor(
              item.tipo,
            )} px-1 text-left text-xs"
            onclick={() => onOpenItem(item.tipo, item.id)}
          >
            {labelFor(item)}
          </button>
        {/each}
        {#if overflow > 0}
          <div
            data-testid="dash-week-item-overflow"
            data-eid={dia}
            class="px-1 text-xs text-muted-foreground"
          >
            +{overflow} itens
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

{#if weekendCount > 0}
  <div class="mt-2">
    <Popover.Root>
      <Popover.Trigger
        data-testid="dash-weekend-chip"
        class="text-xs text-muted-foreground hover:text-foreground"
      >
        sáb/dom ({weekendCount})
      </Popover.Trigger>
      <Popover.Content data-testid="dash-weekend-popover" class="w-64">
        <button
          type="button"
          data-testid="dash-weekend-day-header"
          data-eid={sabado}
          class="w-full px-1 py-1 text-left text-xs font-medium"
          onclick={() => onOpenDia(sabado)}
        >
          sábado {Number(sabado.slice(8, 10))}
        </button>
        {#each sabadoItems as item (item.id)}
          <button
            type="button"
            data-testid="dash-weekend-popover-item"
            data-eid={item.id}
            data-tipo={item.tipo}
            class="block w-full text-left border-l-[3px] {borderClassFor(item.tipo)} px-1 text-xs"
            onclick={() => onOpenItem(item.tipo, item.id)}
          >
            {labelFor(item)}
          </button>
        {/each}
        <button
          type="button"
          data-testid="dash-weekend-day-header"
          data-eid={domingo}
          class="w-full px-1 py-1 text-left text-xs font-medium"
          onclick={() => onOpenDia(domingo)}
        >
          domingo {Number(domingo.slice(8, 10))}
        </button>
        {#each domingoItems as item (item.id)}
          <button
            type="button"
            data-testid="dash-weekend-popover-item"
            data-eid={item.id}
            data-tipo={item.tipo}
            class="block w-full text-left border-l-[3px] {borderClassFor(item.tipo)} px-1 text-xs"
            onclick={() => onOpenItem(item.tipo, item.id)}
          >
            {labelFor(item)}
          </button>
        {/each}
      </Popover.Content>
    </Popover.Root>
  </div>
{/if}

<div data-testid="dash-week-legend" class="mt-2 flex gap-4 text-xs text-muted-foreground">
  <span class="flex items-center gap-1">
    <span class="inline-block h-3 border-l-[3px] border-foreground"></span>
    tarefa
  </span>
  <span class="flex items-center gap-1">
    <span class="inline-block h-3 border-l-[3px] border-muted-foreground"></span>
    rotina
  </span>
  <span class="flex items-center gap-1">
    <span class="inline-block h-3 border-l-[3px] border-destructive"></span>
    ticket com prazo hard
  </span>
</div>
