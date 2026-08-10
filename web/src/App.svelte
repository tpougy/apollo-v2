<script lang="ts">
  import { SignedIn, SignedOut } from "@instantdb/svelte";
  import LoginScreen from "./lib/auth/LoginScreen.svelte";
  import { db } from "./lib/db";
  import { Toaster } from "$lib/components/ui/sonner";
  import Shell from "./lib/Shell.svelte";
</script>

<h1>Apollo v2</h1>
<Toaster />

<SignedOut {db}>
  <LoginScreen />
</SignedOut>

<SignedIn {db}>
  <div data-testid="app-shell">
    <Shell />
  </div>
</SignedIn>
