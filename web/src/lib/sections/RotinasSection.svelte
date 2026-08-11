<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import EntityScreen from "../entities/EntityScreen.svelte";
  import { configByEtype } from "../entities/registry";
  import type { EntityConfig } from "../entities/types";

  // Never import a defs/*.ts module directly here — always resolve through
  // the registry so its own default-export validation (registry.ts:21-29)
  // runs first. Mirrors ProjetosSection.svelte's identical requireConfig
  // helper.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`RotinasSection: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const instanciasRotinaConfig = requireConfig("instanciasRotina");
  const templatesRotinaConfig = requireConfig("templatesRotina");

  let activeTab = $state<"instancias" | "templates">("instancias");
</script>

<!--
  No top-level <h2> here — EXPECTED_H2_BY_TESTID["nav-instanciasRotina"] in
  shell-nav.spec.ts expects the page's SOLE <h2> to read "Instâncias de
  rotina" (instanciasRotinaConfig.titulo), supplied by EntityScreen's own
  unconditional header. A second RotinasSection-level heading would break
  that strict single-<h2> assertion the moment both tabs' content mount
  (bits-ui's Tabs.Content mounts both tabs' children immediately, see below).
-->
<Tabs.Root
  value={activeTab}
  onValueChange={(v) => {
    if (v) activeTab = v as "instancias" | "templates";
  }}
>
  <Tabs.List>
    <Tabs.Trigger value="instancias" data-testid="rotinas-tab-instancias">
      Instâncias
    </Tabs.Trigger>
    <Tabs.Trigger value="templates" data-testid="rotinas-tab-templates">Templates</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="instancias">
    <!--
      bits-ui's Tabs.Content always mounts its children in the DOM (sets a
      `hidden` HTML attribute for the inactive tab, never unmounts — verified
      in node_modules/bits-ui/dist/bits/tabs/tabs.svelte.js's
      TabsContentState.props, and already documented at length in
      ProjetosSection.svelte:588-601 for its own "Todas as tarefas" tab).
      Without this guard, EntityScreen(instanciasRotinaConfig) and
      EntityScreen(templatesRotinaConfig) would both render their own <h2>
      simultaneously on first load, breaking shell-nav.spec.ts's strict
      single-<h2> assertion even though only one tab is visually active.
      Unlike ProjetosSection's own default "detalhe" tab (a bespoke
      master/detail UI, not an EntityScreen mount), BOTH tabs here mount an
      EntityScreen directly, so BOTH need this guard.
    -->
    {#if activeTab === "instancias"}
      <EntityScreen config={instanciasRotinaConfig} />
    {/if}
  </Tabs.Content>
  <Tabs.Content value="templates">
    {#if activeTab === "templates"}
      <div class="space-y-4">
        <p class="text-sm text-muted-foreground">Configuração que gera as instâncias.</p>
        <EntityScreen config={templatesRotinaConfig} />
      </div>
    {/if}
  </Tabs.Content>
</Tabs.Root>
