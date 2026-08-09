<script lang="ts">
  import { SignedIn, SignedOut } from "@instantdb/svelte";
  import LoginScreen from "./lib/auth/LoginScreen.svelte";
  import { db } from "./lib/db";

  const auth = db.useAuth();
</script>

<h1>Apollo v2</h1>

<SignedOut {db}>
  <LoginScreen />
</SignedOut>

<SignedIn {db}>
  <div data-testid="app-shell">
    {#if !auth.isLoading && auth.user}
      <p>autenticado como {auth.user.email}</p>
    {/if}
    <button type="button" data-testid="logout" onclick={() => db.auth.signOut()}>Sair</button>
  </div>
</SignedIn>
