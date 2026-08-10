<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { Button } from "$lib/components/ui/button";
  import { db } from "./db";
  import EntityScreen from "./entities/EntityScreen.svelte";
  import { configByEtype, entityConfigs } from "./entities/registry";
  import { runRoutineInstanceJob } from "./routineJob";

  const auth = db.useAuth();

  let ativo = $state(entityConfigs[0].etype);

  // Deliberately a plain, NON-reactive module-local `let` — not `$state`,
  // and this trigger deliberately does not use the reactive-effect rune.
  // `Shell.svelte` mounts exactly once per authenticated session (it renders
  // only inside `<SignedIn>` in App.svelte), so `onMount` alone gives the
  // "once per sign-in" semantics this job needs. A reactive effect would
  // re-fire on any reactive dependency change and turn a routine page
  // interaction into a repeated job run.
  let jobStarted = false;
  let jobState = $state<"idle" | "running" | "done" | "error">("idle");

  onMount(() => {
    if (jobStarted) return;
    jobStarted = true;
    jobState = "running";

    void (async () => {
      try {
        const user = await db.getAuth();
        if (!user) {
          jobState = "idle";
          return;
        }
        await runRoutineInstanceJob({ donoId: user.id });
        jobState = "done";
      } catch (error) {
        // The job must never break rendering: a user whose job run failed
        // must still see and use every entity screen. Log and swallow.
        console.error("[routineJob] failed to run on mount", error);
        jobState = "error";
      }
    })();
  });
</script>

<div data-testid="routine-job-state" data-job-state={jobState} hidden></div>

{#if !auth.isLoading && auth.user}
  <p>autenticado como {auth.user.email}</p>
{/if}
<Button
  type="button"
  variant="outline"
  data-testid="logout"
  onclick={() => {
    void db.auth.signOut();
    toast.success("Você saiu.");
  }}
>
  Sair
</Button>

<nav class="flex gap-2">
  {#each entityConfigs as cfg (cfg.etype)}
    <Button
      type="button"
      variant={ativo === cfg.etype ? "secondary" : "ghost"}
      data-testid={`nav-${cfg.etype}`}
      aria-current={ativo === cfg.etype}
      onclick={() => (ativo = cfg.etype)}
    >
      {cfg.titulo}
    </Button>
  {/each}
</nav>

{#key ativo}
  {@const active = configByEtype(ativo)}
  {#if active}
    <EntityScreen config={active} />
  {/if}
{/key}
