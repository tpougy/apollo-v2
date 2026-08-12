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
  }: {
    dias: string[];
    agenda: Map<string, Item[]>;
    hojeIso: string;
    sabado: string;
    domingo: string;
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

  const weekendCount = $derived(
    (agenda.get(sabado)?.length ?? 0) + (agenda.get(domingo)?.length ?? 0),
  );
  const weekendItems = $derived([...(agenda.get(sabado) ?? []), ...(agenda.get(domingo) ?? [])]);
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
          >
            {item.titulo}
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
        {#each weekendItems as item (item.id)}
          <div
            data-testid="dash-weekend-popover-item"
            data-eid={item.id}
            data-tipo={item.tipo}
            class="border-l-[3px] {borderClassFor(item.tipo)} px-1 text-xs"
          >
            {item.titulo}
          </div>
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
