<script lang="ts">
  import * as Select from "$lib/components/ui/select";
  import { vencido } from "./derive";

  // Deliberately minimal -- fundo grouping arrives already resolved via
  // `grupos` (rotinasPorFundo's own, unmodified return value) and the label
  // arrives via the separate `nomeById` map, so this row type needs neither
  // `template` nor `fundo` of its own.
  type InstanciaRow = { id: string; dataPrevista: string; tipoPrazo: string };
  type Grupo = { fundoId: string | null; fundoNome: string | null; instancias: InstanciaRow[] };

  let {
    grupos,
    nomeById,
    hojeIso,
    onOpenFundo,
    onOpenRotina,
  }: {
    grupos: Grupo[];
    nomeById: Map<string, string>;
    hojeIso: string;
    onOpenFundo: (id: string) => void;
    onOpenRotina: (id: string) => void;
  } = $props();

  type SortBy = "data-asc" | "data-desc";
  type StatusFilter = "todas" | "atrasadas";

  // "agrupar: fundo" is a fixed, single-value selection: fundo grouping is
  // already the data's own shape from rotinasPorFundo (Dashboard.svelte
  // computes `grupos`, this component only renders it, "Sem fundo vinculado"
  // already forced last) -- there is no OTHER grouping key to switch to this
  // phase, mirroring CONTEXT.md/22-RESEARCH.md's own framing that "fundo" is
  // "the only one wired to non-trivial logic this phase". The control is
  // still rendered as a real Select.Root (spec-ui.md section 3.4: omitting
  // it outright is not acceptable), deliberately a no-op selection over a
  // one-item set.
  let agrupar = $state<"fundo">("fundo");
  let ordenar = $state<SortBy>("data-asc");
  let statusFiltro = $state<StatusFilter>("todas");

  const hoje = $derived(new Date(`${hojeIso}T00:00:00.000Z`));

  // Never re-sort/re-filter the top-level `grupos` array itself -- only ever
  // transform each group's OWN `instancias` list via `.map()` (order-
  // preserving), or the "Sem fundo vinculado is always last" guarantee
  // rotinasPorFundo already establishes would break.
  const gruposExibidos = $derived.by(() =>
    grupos.map((grupo) => ({
      ...grupo,
      displayed: [...grupo.instancias]
        .filter((i) => statusFiltro === "todas" || vencido(i.dataPrevista, false, hoje))
        .sort((a, b) => {
          const cmp =
            a.dataPrevista === b.dataPrevista ? 0 : a.dataPrevista < b.dataPrevista ? -1 : 1;
          return ordenar === "data-asc" ? cmp : -cmp;
        }),
    })),
  );
</script>

<div data-testid="dash-rotinas" class="flex h-full min-h-0 flex-col gap-4">
  <div class="shrink-0 flex items-center gap-2">
    <Select.Root
      type="single"
      value={agrupar}
      onValueChange={(v) => {
        if (v) agrupar = v as "fundo";
      }}
    >
      <Select.Trigger data-testid="rotinas-agrupar" class="w-full">
        {`agrupar: ${agrupar}`}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="fundo" label="fundo">fundo</Select.Item>
      </Select.Content>
    </Select.Root>

    <Select.Root
      type="single"
      value={ordenar}
      onValueChange={(v) => {
        if (v) ordenar = v as SortBy;
      }}
    >
      <Select.Trigger data-testid="rotinas-ordenar" class="w-full">
        {`ordenar: ${ordenar}`}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="data-asc" label="data (mais proxima)">
          data (mais proxima)
        </Select.Item>
        <Select.Item value="data-desc" label="data (mais distante)">
          data (mais distante)
        </Select.Item>
      </Select.Content>
    </Select.Root>

    <Select.Root
      type="single"
      value={statusFiltro}
      onValueChange={(v) => {
        if (v) statusFiltro = v as StatusFilter;
      }}
    >
      <Select.Trigger data-testid="rotinas-status" class="w-full">
        {`status: ${statusFiltro}`}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="todas" label="todas">todas</Select.Item>
        <Select.Item value="atrasadas" label="atrasadas">atrasadas</Select.Item>
      </Select.Content>
    </Select.Root>
  </div>

  {#if grupos.length === 0}
    <p class="text-sm text-muted-foreground">Nenhuma rotina esta semana.</p>
  {:else}
    <div data-testid="rotinas-colunas" class="flex flex-1 min-h-0 gap-3 overflow-x-auto">
      {#each gruposExibidos as grupo (grupo.fundoId ?? "sem-fundo")}
        {@const overdueCount = grupo.instancias.filter((i) =>
          vencido(i.dataPrevista, false, hoje),
        ).length}
        <div
          data-testid="rotinas-fundo-card"
          data-eid={grupo.fundoId ?? ""}
          class="flex h-full w-48 shrink-0 flex-col gap-2 rounded border bg-card/60 p-3"
        >
          <button
            type="button"
            data-testid="rotinas-fundo-titulo"
            class="shrink-0 block text-left text-sm font-medium"
            onclick={grupo.fundoId ? () => onOpenFundo(grupo.fundoId!) : undefined}
          >
            {grupo.fundoNome ?? "Sem fundo vinculado"}
          </button>
          <p data-testid="rotinas-fundo-meta" class="shrink-0 text-xs text-muted-foreground">
            {grupo.instancias.length} rotinas - {overdueCount} atrasadas
          </p>
          <div
            data-testid="rotinas-coluna-lista"
            data-eid={grupo.fundoId ?? ""}
            class="flex-1 min-h-0 space-y-2 overflow-y-auto"
          >
            {#if grupo.displayed.length === 0}
              <p class="text-sm text-muted-foreground">Nenhuma rotina corresponde ao filtro</p>
            {:else}
              {#each grupo.displayed as instancia (instancia.id)}
                {@const atrasada = vencido(instancia.dataPrevista, false, hoje)}
                <button
                  type="button"
                  data-testid="rotinas-row"
                  data-eid={instancia.id}
                  class="block w-full rounded border p-2 text-left space-y-1"
                  onclick={(e) => {
                    e.stopPropagation();
                    onOpenRotina(instancia.id);
                  }}
                >
                  <span class="flex items-center gap-2">
                    <span
                      data-testid="rotinas-row-bolinha"
                      class="inline-block size-2 rounded-full {atrasada
                        ? 'bg-destructive'
                        : 'bg-muted-foreground'}"
                    ></span>
                    <span class="text-xs text-muted-foreground">
                      {instancia.dataPrevista.slice(8, 10)}/{instancia.dataPrevista.slice(5, 7)}
                    </span>
                  </span>
                  <p data-testid="rotinas-row-titulo" class="line-clamp-2 text-sm">
                    {nomeById.get(instancia.id) ?? "Rotina"}
                  </p>
                  {#if grupo.fundoNome}
                    <p data-testid="rotinas-row-fundo" class="text-xs text-muted-foreground">
                      {grupo.fundoNome}
                    </p>
                  {/if}
                </button>
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
