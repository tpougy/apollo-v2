<script lang="ts">
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import { tick } from "svelte";
  import * as Accordion from "$lib/components/ui/accordion";
  import { Alert, AlertDescription } from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import * as Tabs from "$lib/components/ui/tabs";
  import { progressoEtapa, tarefaConcluida, vencido } from "../dashboard/derive";
  import { db } from "../db";
  import EntityScreen from "../entities/EntityScreen.svelte";
  import { configByEtype } from "../entities/registry";
  import type { EntityConfig } from "../entities/types";
  import SubtarefasPanel from "./SubtarefasPanel.svelte";

  // Never import a defs/*.ts module directly here — always resolve through
  // the registry so its own default-export validation (registry.ts:21-29)
  // runs first.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`ProjetosSection: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const projetosConfig = requireConfig("projetos");
  const etapasConfig = requireConfig("etapas");
  const tarefasConfig = requireConfig("tarefas");

  // Row shapes mirror the exact nesting of the bespoke query below — one
  // level deeper than the generic EntityScreen.buildQuery can express
  // (19-RESEARCH.md Pattern 1).
  type SubtarefaRow = { id: string; titulo: string; concluida: boolean };
  type TarefaRow = {
    id: string;
    titulo: string;
    status: string;
    tipoPrazo: string;
    dataPrevista?: string;
    subtarefas?: SubtarefaRow[];
  };
  type EtapaRow = {
    id: string;
    nome: string;
    ordem: number;
    status: string;
    tarefas?: TarefaRow[];
  };
  type ProjetoRow = {
    id: string;
    nome: string;
    status: string;
    dataInicioPrevista?: string;
    dataFimPrevista?: string;
    fundo?: { id: string; nome: string };
    etapas?: EtapaRow[];
  };

  // The ONE bespoke db.useQuery this component ever issues directly — Plan
  // 19-02/19-03 read from this same `query`/`rowsOf()`, never a second
  // top-level fetch. Cast at the InstaQL boundary is the same precedent
  // EntityScreen.svelte:82 uses for its own `db.useQuery(() => buildQuery(config)
  // as never)` — config.etype/this literal shape are runtime values, not a
  // literal from the generated schema union.
  const query = db.useQuery(
    () =>
      ({
        projetos: { fundo: {}, etapas: { tarefas: { subtarefas: {} } } },
      }) as never,
  );

  function rowsOf(): ProjetoRow[] {
    const data = query.data as Record<string, ProjetoRow[]> | undefined;
    return (data?.projetos ?? []) as ProjetoRow[];
  }

  function totalTarefas(projeto: ProjetoRow): number {
    return (projeto.etapas ?? []).reduce((sum, e) => sum + (e.tarefas ?? []).length, 0);
  }

  type GroupBy = "fundo" | "nenhum" | "status";

  let searchTerm = $state("");
  let groupBy = $state<GroupBy>("fundo");
  let selectedProjetoId = $state<string | null>(null);

  // Which etapa (by id) is open in the detail column's accordion. Empty
  // string means "none open" — the installed bits-ui Accordion.Root's
  // `type="single"` value is typed `string` (default `""`), not
  // `string | null`, and this version of bits-ui has no `collapsible` prop
  // (verified absent from AccordionRootSinglePropsWithoutHTML); `""` is
  // falsy exactly like `null` would be, so every downstream check
  // (`openEtapaId ? {...} : null` for presetLinks) behaves identically
  // either way. Single-open behavior itself only requires `type="single"`.
  let openEtapaId = $state("");

  // "etapas ▾" list/kanban toggle (NEST-03) — pure render-mode switch over
  // the exact same etapasOrdenadas computed below; never triggers a second
  // db.useQuery call.
  let etapasView = $state<"lista" | "kanban">("lista");

  // Detail-column Tabs.Root state (NEST-03): "detalhe" (default, the
  // project-detail/project-empty block from Plan 19-01/19-02) or "todas"
  // (the unscoped EntityScreen(tarefas) escape hatch for orphaned tarefas).
  let detailTab = $state<"detalhe" | "todas">("detalhe");

  // "Sem etapa" convenience filter for the "Todas as tarefas" tab. Primary
  // path: InstantDB's documented $isNull operator via the existing
  // scopeWhere prop (see 19-RESEARCH.md Pitfall 5 / Assumption A1) — smoke
  // tested live in projetos-section.spec.ts before being trusted here.
  let semEtapa = $state(false);

  // NEST-05 (Plan 20-03): which tarefa's SubtarefasPanel is open inline below
  // its own etapa-detail row. `null` means none open. Toggled by the chip's
  // own button (see the etapa-tarefa-row markup below) — reused verbatim
  // from Plan 20-01's SubtarefasPanel, zero new prop/branch added there.
  let activeSubtarefaTarefaId = $state<string | null>(null);

  // NEST-05 (Plan 20-03): same panel, opened from the "Todas as tarefas" tab's
  // row-click delegation instead of the etapa-detail chip — this is the ONLY
  // reachable path to an orphaned tarefa's subtarefas (tarefas.etapa is
  // required: false, per spec §2.2), so it must offer the identical
  // affordance the etapa-detail chip does, not a lesser one.
  let activeOrphanSubtarefaId = $state<string | null>(null);
  let activeOrphanSubtarefaTitulo = $state("");

  // Mirrors Shell.svelte's own nestedGroups grouping pattern (Map +
  // Array.from(entries), zero per-entity branching), extended to 3 modes.
  // "Sem fundo vinculado" is forced last only in "fundo" mode — "status"
  // mode sorts purely alphabetically, per spec §2.2's display-only control.
  function groupProjetos(
    rows: ProjetoRow[],
    mode: GroupBy,
  ): { label: string | null; rows: ProjetoRow[] }[] {
    const sorted = [...rows].sort((a, b) => a.nome.localeCompare(b.nome));
    if (mode === "nenhum") {
      return [{ label: null, rows: sorted }];
    }
    const groups = new Map<string, ProjetoRow[]>();
    for (const row of sorted) {
      const label = mode === "fundo" ? row.fundo?.nome ?? "Sem fundo vinculado" : row.status;
      const list = groups.get(label) ?? [];
      list.push(row);
      groups.set(label, list);
    }
    const entries = Array.from(groups.entries());
    entries.sort((a, b) => {
      if (mode === "fundo") {
        if (a[0] === "Sem fundo vinculado") return 1;
        if (b[0] === "Sem fundo vinculado") return -1;
      }
      return a[0].localeCompare(b[0]);
    });
    return entries.map(([label, groupRows]) => ({ label, rows: groupRows }));
  }

  // Client-side filter over already-loaded rows — spec §2.2's "filtro
  // client-side sobre as linhas já carregadas". Never re-query on input.
  const filtered = $derived(
    rowsOf().filter((r) => r.nome.toLowerCase().includes(searchTerm.trim().toLowerCase())),
  );
  const groups = $derived(groupProjetos(filtered, groupBy));

  const selectedProjeto = $derived(
    selectedProjetoId ? rowsOf().find((r) => r.id === selectedProjetoId) : undefined,
  );

  // Hidden host for "+ novo projeto" / "editar projeto" (Task 2) — the only
  // spec-compliant way to reuse EntityScreen's create/edit dialog from
  // outside its own mount (19-RESEARCH.md Pattern 2; bits-ui's Dialog Portal
  // renders to document.body regardless of a hidden ancestor).
  // `EntityScreen.svelte` gets neither a third prop nor a mode/etype branch —
  // every "+ X" affordance in this phase drives a real, unmodified
  // EntityScreen instance's own DOM button instead.
  //
  // Lazily mounted (`{#if projetoHostReady}` below): EntityScreen
  // unconditionally renders its own <h2>{config.titulo}</h2>, and this
  // component must render exactly one <h2> on the page (the one above) until
  // the user's first "+ novo projeto"/"editar projeto" click — keeps
  // shell-nav.spec.ts's single-<h2> assertion green for every flow that never
  // opens a create/edit dialog.
  //
  // Every query into this host is scoped to `projetoHostEl` (never a bare
  // global `document.querySelector`), so a second hidden host added in Plan
  // 19-02 can never be mis-targeted.
  let projetoHostReady = $state(false);
  let projetoHostEl = $state<HTMLDivElement | undefined>(undefined);

  // "+ novo projeto"'s own target (`entity-create-start`) always exists as
  // soon as the hidden EntityScreen mounts, regardless of query state — a
  // single `tick()` after `projetoHostReady` flips is enough. "editar
  // projeto"'s target (a specific row's `row-edit` button) only exists once
  // the hidden instance's OWN `db.useQuery` has resolved over the network
  // and rendered that row, which a single `tick()` cannot wait for (`tick()`
  // flushes pending Svelte updates, not in-flight async fetches). Poll for
  // the selector, bounded, so both callers share one code path.
  async function openProjetoDialog(selector: string): Promise<void> {
    projetoHostReady = true;
    await tick();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const el = projetoHostEl?.querySelector<HTMLButtonElement>(selector);
      if (el) {
        el.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  function startCreateProjeto(): void {
    void openProjetoDialog('[data-testid="entity-create-start"]');
  }

  // Reuses the exact same hidden host/selector-click plumbing as
  // startCreateProjeto above — do NOT mount a second hidden `projetosConfig`
  // instance. The hidden host's own unscoped query already returns every
  // projeto, including the selected one, with a matching data-eid. Guarded
  // as a no-op when nothing is selected for defense-in-depth, even though
  // the button itself is only ever rendered inside the `{#if selectedProjeto}`
  // block below.
  function startEditProjeto(): void {
    if (!selectedProjetoId) return;
    void openProjetoDialog(
      `[data-testid="row"][data-eid="${selectedProjetoId}"] [data-testid="row-edit"]`,
    );
  }

  // Hidden host for "+ etapa" — a second independent instance of the same
  // hidden-EntityScreen pattern as `projetoHostEl` above (19-RESEARCH.md
  // Pattern 2), never a shared one. Scoped querySelector via `etapaHostEl`
  // (never a bare global `document.querySelector`) so this host can never be
  // mis-targeted by (or mis-target) the projeto/tarefa hosts.
  let etapaHostReady = $state(false);
  let etapaHostEl = $state<HTMLDivElement | undefined>(undefined);

  // Same bounded-poll shape as `openProjetoDialog` above — the hidden host's
  // own `db.useQuery` may not have resolved yet when this fires, so a single
  // `tick()` is not sufficient in general (see 19-01-SUMMARY.md's documented
  // bugfix for the projeto host's "editar" target). Applied identically here
  // even though "+ etapa"'s own target (`entity-create-start`) does not
  // strictly need it, so every hidden host in this component shares one
  // dialog-opening code shape.
  async function openEtapaDialog(selector: string): Promise<void> {
    etapaHostReady = true;
    await tick();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const el = etapaHostEl?.querySelector<HTMLButtonElement>(selector);
      if (el) {
        el.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  function startCreateEtapa(): void {
    void openEtapaDialog('[data-testid="entity-create-start"]');
  }

  // Hidden host for "+ tarefa nesta etapa" — a THIRD independent instance of
  // the same hidden-EntityScreen pattern (do not reuse `etapaHostEl`).
  let tarefaHostReady = $state(false);
  let tarefaHostEl = $state<HTMLDivElement | undefined>(undefined);

  // Same bounded-poll shape as the other two hosts' open functions above.
  async function openTarefaDialog(selector: string): Promise<void> {
    tarefaHostReady = true;
    await tick();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const el = tarefaHostEl?.querySelector<HTMLButtonElement>(selector);
      if (el) {
        el.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // `presetLinks` for this host is `{ etapa: openEtapaId }`, computed inline
  // from the live `openEtapaId` `$state` at the moment the dialog opens
  // (right where the button's `onclick` reads it below) — always targets
  // whichever etapa is actually expanded at click time, never a stale
  // snapshot from an earlier selection.
  function startCreateTarefa(): void {
    void openTarefaDialog('[data-testid="entity-create-start"]');
  }

  // NEST-05 (Plan 20-03): click-delegation handler for the "Todas as
  // tarefas" tab's EntityScreen(tarefasConfig) mount -- mirrors
  // TicketsSection.svelte's handleTableClick (Plan 20-01) exactly, extended
  // with toggle semantics identical to the etapa-detail chip's button above.
  // Clicking a row's own `row-edit`/`row-delete` button also (harmlessly)
  // opens/toggles that row's panel, since both live inside the same
  // `[data-testid="row"]` ancestor this handler walks up to.
  function handleTodasTarefasClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('[data-testid="row"]');
    if (!row) return;
    const eid = row.getAttribute("data-eid");
    if (!eid) return;
    if (activeOrphanSubtarefaId === eid) {
      activeOrphanSubtarefaId = null;
      return;
    }
    // `tarefas.ts`'s `listColumns: ["titulo", ...]` puts titulo first -- the
    // row's first <td> is always the titulo cell.
    const firstCell = row.querySelector("td");
    activeOrphanSubtarefaId = eid;
    activeOrphanSubtarefaTitulo = firstCell?.textContent?.trim() ?? "";
  }
</script>

<section class="space-y-6">
  <h2 class="text-xl font-semibold tracking-tight">Projetos</h2>

  {#if query.isLoading}
    <div data-testid="projetos-loading" class="space-y-2">
      {#each Array(5) as _, rowIndex (rowIndex)}
        <Skeleton class="h-8 w-full" />
      {/each}
    </div>
  {:else if query.error}
    <Alert variant="destructive">
      <CircleAlert class="size-4" />
      <AlertDescription data-testid="projetos-query-error">{query.error.message}</AlertDescription>
    </Alert>
  {:else}
    <div class="flex gap-6">
      <div class="w-56 border-r shrink-0 space-y-4">
        <Input
          data-testid="project-search"
          placeholder="Buscar por nome..."
          value={searchTerm}
          oninput={(e) => {
            searchTerm = e.currentTarget.value;
          }}
        />

        <Select.Root
          type="single"
          value={groupBy}
          onValueChange={(v) => {
            if (v) groupBy = v as GroupBy;
          }}
        >
          <Select.Trigger data-testid="project-groupby" class="w-full">
            {`agrupar: ${groupBy}`}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="fundo" label="fundo">fundo</Select.Item>
            <Select.Item value="nenhum" label="nenhum">nenhum</Select.Item>
            <Select.Item value="status" label="status">status</Select.Item>
          </Select.Content>
        </Select.Root>

        <Button
          type="button"
          data-testid="project-create-start"
          class="w-full"
          onclick={startCreateProjeto}
        >
          + novo projeto
        </Button>

        <div data-testid="project-list" class="space-y-4">
          {#each groups as group (group.label ?? "__flat__")}
            <div data-testid="project-group" class="space-y-1">
              {#if group.label !== null}
                <p
                  data-testid="project-group-heading"
                  class="text-xs uppercase text-muted-foreground"
                >
                  {group.label}
                </p>
              {/if}
              {#each group.rows as row (row.id)}
                <Button
                  type="button"
                  variant={row.id === selectedProjetoId ? "secondary" : "ghost"}
                  class="w-full justify-start"
                  data-testid="project-item"
                  data-eid={row.id}
                  onclick={() => (selectedProjetoId = row.id)}
                >
                  {row.nome}
                </Button>
              {/each}
            </div>
          {/each}
        </div>
      </div>

      <div class="flex-1">
        <Tabs.Root
          value={detailTab}
          onValueChange={(v) => {
            if (v) detailTab = v as "detalhe" | "todas";
          }}
        >
          <Tabs.List>
            <Tabs.Trigger value="detalhe" data-testid="projetos-tab-detalhe">Projeto</Tabs.Trigger>
            <Tabs.Trigger value="todas" data-testid="projetos-tab-todas">
              Todas as tarefas
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="detalhe">
        {#if selectedProjeto}
          {@const etapasOrdenadas = [...(selectedProjeto.etapas ?? [])].sort(
            (a, b) => a.ordem - b.ordem,
          )}
          <div data-testid="project-detail" class="space-y-4">
            <p data-testid="project-breadcrumb" class="text-xs text-muted-foreground">
              PROJETOS › {selectedProjeto.nome}
            </p>
            <div data-testid="project-header" class="space-y-1">
              <div class="flex items-center justify-between gap-4">
                <h3 class="text-lg font-semibold">{selectedProjeto.nome}</h3>
                <div class="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="project-add-etapa-start"
                    onclick={startCreateEtapa}
                  >
                    + etapa
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="project-edit-start"
                    onclick={startEditProjeto}
                  >
                    editar projeto
                  </Button>
                </div>
              </div>
              <p class="text-sm text-muted-foreground">
                {selectedProjeto.fundo?.nome ?? "Sem fundo vinculado"} ·
                {(selectedProjeto.etapas ?? []).length} etapas ·
                {totalTarefas(selectedProjeto)} tarefas
              </p>
            </div>

            <div data-testid="project-etapas-list" class="space-y-2">
              <div class="flex items-center justify-between">
                <p class="text-xs uppercase text-muted-foreground">etapas ▾</p>
                <div class="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={etapasView === "lista" ? "secondary" : "ghost"}
                    data-testid="etapas-view-lista"
                    onclick={() => (etapasView = "lista")}
                  >
                    lista
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={etapasView === "kanban" ? "secondary" : "ghost"}
                    data-testid="etapas-view-kanban"
                    onclick={() => (etapasView = "kanban")}
                  >
                    kanban
                  </Button>
                </div>
              </div>
              {#if etapasOrdenadas.length === 0}
                <p class="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
              {:else if etapasView === "lista"}
                <Accordion.Root type="single" bind:value={openEtapaId}>
                  {#each etapasOrdenadas as etapa (etapa.id)}
                    {@const { feitas, total } = progressoEtapa(etapa)}
                    <Accordion.Item value={etapa.id}>
                      <Accordion.Trigger
                        data-testid="etapa-row"
                        data-eid={etapa.id}
                        class="items-center gap-4"
                      >
                        <span class="font-mono w-8">{etapa.ordem}</span>
                        <span class="flex-1 text-left">{etapa.nome}</span>
                        <div class="w-24">
                          <div class="h-1 w-full rounded-full bg-muted">
                            <div
                              class="h-1 rounded-full bg-foreground"
                              style={`width: ${total > 0 ? (feitas / total) * 100 : 0}%`}
                            ></div>
                          </div>
                        </div>
                        <span class="text-xs text-muted-foreground">{feitas}/{total}</span>
                      </Accordion.Trigger>
                      <Accordion.Content>
                        <!--
                          bits-ui's Accordion.Content stays mounted in the DOM
                          for every item regardless of open state (Radix-style
                          height-animated collapse, never `display: none`) --
                          without this guard, `etapa-tarefas-list` and
                          `etapa-add-tarefa-start` would exist once per etapa
                          simultaneously, breaking every testid-scoped e2e
                          query with a strict-mode violation the moment a
                          project has more than one etapa. Only the currently
                          open etapa's tarefas/add-button actually render.
                        -->
                        {#if openEtapaId === etapa.id}
                          <div data-testid="etapa-tarefas-list" class="space-y-2">
                            {#each [...(etapa.tarefas ?? [])] as tarefa (tarefa.id)}
                              {@const subs = tarefa.subtarefas ?? []}
                              <div
                                data-testid="etapa-tarefa-row"
                                data-eid={tarefa.id}
                                class="flex items-center gap-4"
                              >
                                <Checkbox
                                  data-testid="etapa-tarefa-concluida"
                                  checked={tarefaConcluida(tarefa)}
                                  disabled
                                />
                                <span class="flex-1">{tarefa.titulo}</span>
                                <span
                                  data-testid="etapa-tarefa-prazo"
                                  class={vencido(
                                    tarefa.dataPrevista,
                                    tarefaConcluida(tarefa),
                                    new Date(),
                                  )
                                    ? "text-destructive"
                                    : ""}
                                >
                                  {tarefa.dataPrevista ? tarefa.dataPrevista.slice(0, 10) : "—"}
                                </span>
                                <!-- NEST-05 (Plan 20-03): a real, keyboard-activatable
                                     button — data-testid stays on this outer <button>
                                     (not the inner Badge) so projetos-section.spec.ts's
                                     existing text-only assertions on this testid keep
                                     passing unedited. Toggles SubtarefasPanel scoped to
                                     this tarefa, rendered inline below the row. -->
                                <button
                                  type="button"
                                  data-testid="etapa-tarefa-subtarefas-chip"
                                  onclick={() =>
                                    (activeSubtarefaTarefaId =
                                      activeSubtarefaTarefaId === tarefa.id ? null : tarefa.id)}
                                >
                                  <Badge variant="outline">
                                    {subs.filter((s) => s.concluida).length}/{subs.length}
                                  </Badge>
                                </button>
                              </div>
                              {#if activeSubtarefaTarefaId === tarefa.id}
                                {#key tarefa.id}
                                  <SubtarefasPanel
                                    parentType="tarefa"
                                    parentId={tarefa.id}
                                    parentLabel={tarefa.titulo}
                                    onClose={() => (activeSubtarefaTarefaId = null)}
                                  />
                                {/key}
                              {/if}
                            {/each}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            data-testid="etapa-add-tarefa-start"
                            onclick={startCreateTarefa}
                          >
                            + tarefa nesta etapa
                          </Button>
                        {/if}
                      </Accordion.Content>
                    </Accordion.Item>
                  {/each}
                </Accordion.Root>
              {:else}
                <!--
                  Kanban view: same etapasOrdenadas data, zero extra fetch.
                  Fixed-width, non-compressing columns per spec §3.5's
                  overflow discipline (cross-referenced by §2.2) -- a plain
                  overflow-x-auto div is used here instead of the installed
                  ScrollArea component, since ScrollArea's bits-ui viewport
                  wraps content in its own custom-scrollbar machinery with
                  no prior usage/e2e precedent in this codebase, and this
                  phase only needs the overflow/non-compression discipline
                  (not the Dashboard-specific 3-card cap this component's
                  kanban never implements) -- documented in 19-03-SUMMARY.md.
                -->
                <div data-testid="etapas-kanban" class="flex gap-2 overflow-x-auto pb-2">
                  {#each etapasOrdenadas as etapa (etapa.id)}
                    {@const { feitas, total } = progressoEtapa(etapa)}
                    <div
                      data-testid="etapa-kanban-column"
                      data-eid={etapa.id}
                      class="w-48 shrink-0 border-r px-2 space-y-2"
                    >
                      <div class="space-y-1">
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-xs">{etapa.ordem}</span>
                          <span class="flex-1 text-sm font-medium">{etapa.nome}</span>
                        </div>
                        <span class="text-xs text-muted-foreground">{feitas}/{total}</span>
                      </div>
                      {#each [...(etapa.tarefas ?? [])] as tarefa (tarefa.id)}
                        <div
                          data-testid="etapa-kanban-card"
                          data-eid={tarefa.id}
                          class="rounded border p-2 space-y-1"
                        >
                          <p class="text-sm">{tarefa.titulo}</p>
                          <span
                            data-testid="etapa-kanban-card-prazo"
                            class={vencido(
                              tarefa.dataPrevista,
                              tarefaConcluida(tarefa),
                              new Date(),
                            )
                              ? "text-xs text-destructive"
                              : "text-xs text-muted-foreground"}
                          >
                            {tarefa.dataPrevista ? tarefa.dataPrevista.slice(0, 10) : "—"}
                          </span>
                        </div>
                      {/each}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <div data-testid="project-empty">
            <p class="text-sm text-muted-foreground">
              Selecione um projeto para ver seus detalhes.
            </p>
          </div>
        {/if}
          </Tabs.Content>
          <Tabs.Content value="todas">
            <!--
              bits-ui's Tabs.Content always mounts its children in the DOM
              (sets a `hidden` HTML attribute for the inactive tab, never
              unmounts -- verified in node_modules/bits-ui/dist/bits/tabs/
              tabs.svelte.js's TabsContentState.props). Without this guard,
              EntityScreen(tarefasConfig) would render its own
              <h2>Tarefas</h2> unconditionally the instant a user lands on
              Projetos, breaking shell-nav.spec.ts's single-<h2> assertion
              (page.locator("h2") strict-mode-violates on 2 elements) even
              though the tab itself is invisible. Only mount the panel while
              "todas" is the active tab.
            -->
            {#if detailTab === "todas"}
              <div data-testid="todas-tarefas-panel" class="space-y-4">
                <div class="flex items-center gap-2">
                  <Checkbox
                    id="tarefas-sem-etapa"
                    data-testid="tarefas-sem-etapa-toggle"
                    checked={semEtapa}
                    onCheckedChange={(v) => {
                      semEtapa = v === true;
                    }}
                  />
                  <Label for="tarefas-sem-etapa">Sem etapa</Label>
                </div>
                <!--
                  NEST-05 (Plan 20-03): click-delegation wrapper, the same
                  technique TicketsSection.svelte (Plan 20-01) already
                  established for the identical reason -- EntityScreen's own
                  <TableRow> has no click handler of its own, and
                  EntityScreen.svelte is never touched to add one. Applies
                  uniformly to every row in this tab (orphan or not, no
                  special-casing); this is the ONLY reachable path to an
                  orphaned tarefa's subtarefas once the interim `subtarefas`
                  nav route retires later in this phase (tarefas.etapa is
                  required: false, per spec §2.2). `role="none"` mirrors
                  TicketsSection's own wrapper -- the real keyboard-usable
                  semantics live on EntityScreen's unmodified row-edit/
                  row-delete buttons inside, not on this delegation shell.
                -->
                <div
                  data-testid="todas-tarefas-table"
                  role="none"
                  onclick={handleTodasTarefasClick}
                >
                  <EntityScreen
                    config={tarefasConfig}
                    scopeWhere={semEtapa ? { "etapa.id": { $isNull: true } } : null}
                  />
                </div>
                {#if activeOrphanSubtarefaId}
                  {#key activeOrphanSubtarefaId}
                    <SubtarefasPanel
                      parentType="tarefa"
                      parentId={activeOrphanSubtarefaId}
                      parentLabel={activeOrphanSubtarefaTitulo}
                      onClose={() => (activeOrphanSubtarefaId = null)}
                    />
                  {/key}
                {/if}
              </div>
            {/if}
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  {/if}

  {#if projetoHostReady}
    <div class="hidden" aria-hidden="true" data-testid="projeto-host" bind:this={projetoHostEl}>
      <EntityScreen config={projetosConfig} />
    </div>
  {/if}

  {#if etapaHostReady}
    <div class="hidden" aria-hidden="true" data-testid="etapa-host" bind:this={etapaHostEl}>
      <EntityScreen
        config={etapasConfig}
        presetLinks={selectedProjetoId ? { projeto: selectedProjetoId } : null}
      />
    </div>
  {/if}

  {#if tarefaHostReady}
    <div class="hidden" aria-hidden="true" data-testid="tarefa-host" bind:this={tarefaHostEl}>
      <EntityScreen
        config={tarefasConfig}
        presetLinks={openEtapaId ? { etapa: openEtapaId } : null}
      />
    </div>
  {/if}
</section>
