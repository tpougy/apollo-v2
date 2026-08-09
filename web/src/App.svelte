<script lang="ts">
  import { db } from "./lib/db";

  const appId = import.meta.env.VITE_INSTANT_APP_ID;
  const auth = db.useAuth();
</script>

<h1>Apollo v2</h1>
<p>InstantDB app id: {appId}</p>

{#if auth.isLoading}
  <p>carregando...</p>
{:else if auth.error}
  <p>erro de autenticação: {auth.error.message}</p>
{:else if auth.user}
  <p>autenticado como {auth.user.email}</p>
{:else}
  <p>não autenticado</p>
{/if}
