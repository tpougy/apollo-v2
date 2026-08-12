<script lang="ts">
  import { faixaHeatmap } from "./derive";

  let {
    carga,
    ano,
    mes,
    onOpenDia,
  }: {
    carga: Map<string, number>;
    ano: number;
    mes: number;
    onOpenDia: (iso: string) => void;
  } = $props();

  // spec-ui.md section 6's exact token table.
  //
  // Deviation from 22-RESEARCH.md's own Pattern 5 example (documented in the
  // SUMMARY): that example's band-4 class used `text-destructive-foreground`,
  // naming a CSS custom property (`--destructive-foreground`) that does not
  // exist anywhere in web/src/app.css -- verified: only `--destructive` is
  // defined, in both the `:root` and dark-mode blocks; no
  // `--color-destructive-foreground` entry exists in the `@theme inline`
  // block either, and no existing component in this codebase ever pairs
  // `bg-destructive` with a `-foreground` text token. `text-background` is
  // used for band 4 instead -- already defined, already used at this exact
  // band-3 spot, and `--background` already differs correctly between the
  // light and dark blocks, giving adequate contrast against `--destructive`
  // in both themes with zero `dark:` override needed on the text class
  // itself.
  const FAIXA_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: "bg-muted",
    1: "bg-chart-1/40 dark:bg-chart-5/40",
    2: "bg-chart-2/70 dark:bg-chart-4/70",
    3: "bg-chart-4 text-background dark:bg-chart-2 dark:text-foreground",
    4: "bg-destructive text-background",
  };

  // Already ascending ISO strings from cargaDoMes's own Map insertion order
  // -- never regenerated independently.
  const dias = $derived([...carga.keys()]);

  // No derive.ts export for this: semanaUtil's only weekend-related output is
  // scoped to one 7-day window, not a month (22-RESEARCH.md Pitfall 5). This
  // is a 1-line, phase-local helper, not a gap in derive.ts's contract.
  function isWeekend(iso: string): boolean {
    return [0, 6].includes(new Date(`${iso}T00:00:00.000Z`).getUTCDay());
  }

  // Same Monday-first `(dow + 6) % 7` idiom derive.ts's own semanaUtil
  // already uses, applied here purely for calendar-grid alignment.
  const leadingBlanks = $derived(
    dias.length > 0 ? (new Date(`${dias[0]}T00:00:00.000Z`).getUTCDay() + 6) % 7 : 0,
  );
</script>

<div data-testid="dash-heatmap" class="space-y-2" data-ano={ano} data-mes={mes}>
  <div data-testid="dash-heatmap-grid" class="grid grid-cols-7 gap-1">
    {#each Array.from({ length: leadingBlanks }) as _blank, i (i)}
      <div aria-hidden="true"></div>
    {/each}
    {#each dias as iso (iso)}
      {@const n = carga.get(iso) ?? 0}
      {@const faixa = faixaHeatmap(n)}
      {@const weekend = isWeekend(iso)}
      <button
        type="button"
        data-testid="dash-heatmap-cell"
        data-eid={iso}
        aria-label={weekend ? `${iso}: fim de semana` : `${iso}: ${n} afazeres`}
        class="aspect-square rounded-sm {weekend ? 'bg-muted/40' : FAIXA_CLASSES[faixa]}"
        onclick={() => onOpenDia(iso)}
      ></button>
    {/each}
  </div>
  <div
    data-testid="dash-heatmap-legend"
    class="flex items-center gap-2 text-xs text-muted-foreground"
  >
    <span>tranquilo</span>
    <span class="aspect-square size-3 rounded-sm {FAIXA_CLASSES[0]}"></span>
    <span class="aspect-square size-3 rounded-sm {FAIXA_CLASSES[1]}"></span>
    <span class="aspect-square size-3 rounded-sm {FAIXA_CLASSES[2]}"></span>
    <span class="aspect-square size-3 rounded-sm {FAIXA_CLASSES[3]}"></span>
    <span class="aspect-square size-3 rounded-sm {FAIXA_CLASSES[4]}"></span>
    <span>carregado</span>
  </div>
</div>
