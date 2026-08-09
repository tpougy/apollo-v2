<script lang="ts">
  import { db } from "./db";
  import EntityScreen from "./entities/EntityScreen.svelte";
  import { configByEtype, entityConfigs } from "./entities/registry";

  const auth = db.useAuth();

  let ativo = $state(entityConfigs[0].etype);
</script>

{#if !auth.isLoading && auth.user}
  <p>autenticado como {auth.user.email}</p>
{/if}
<button type="button" data-testid="logout" onclick={() => db.auth.signOut()}>Sair</button>

<nav>
  {#each entityConfigs as cfg (cfg.etype)}
    <button
      type="button"
      data-testid={`nav-${cfg.etype}`}
      aria-current={ativo === cfg.etype}
      onclick={() => (ativo = cfg.etype)}
    >
      {cfg.titulo}
    </button>
  {/each}
</nav>

{#key ativo}
  {@const active = configByEtype(ativo)}
  {#if active}
    <EntityScreen config={active} />
  {/if}
{/key}
