<script lang="ts">
  import { SignedIn, SignedOut } from "@instantdb/svelte";
  import { Toaster } from "$lib/components/ui/sonner";
  import LoginScreen from "./lib/auth/LoginScreen.svelte";
  import { db } from "./lib/db";
  import Shell from "./lib/Shell.svelte";
</script>

<Toaster />

<SignedOut {db}>
  <h1>Apollo v2</h1>
  <LoginScreen />
</SignedOut>

<SignedIn {db}>
  <div data-testid="app-shell">
    <Shell />
  </div>
</SignedIn>
