<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import Dashboard from "./dashboard/Dashboard.svelte";
  import { db } from "./db";
  import EntityScreen from "./entities/EntityScreen.svelte";
  import { configByEtype, navConfigs } from "./entities/registry";
  import { runRoutineInstanceJob } from "./routineJob";
  import ProjetosSection from "./sections/ProjetosSection.svelte";
  import RotinasSection from "./sections/RotinasSection.svelte";
  import TicketsSection from "./sections/TicketsSection.svelte";

  const auth = db.useAuth();

  type Route =
    | { section: "dashboard" }
    | { section: "entity"; etype: string; tab?: string; selectedId?: string | null };
  let rota = $state<Route>({ section: "dashboard" });

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

<header
  data-testid="shell-header"
  class="flex items-center justify-between gap-4 px-4 py-3 sm:px-6"
>
  <h1 data-testid="shell-app-name" class="text-lg font-semibold">Apollo v2</h1>
  <div class="flex items-center gap-4">
    {#if !auth.isLoading && auth.user}
      <p class="text-sm text-muted-foreground">autenticado como {auth.user.email}</p>
    {/if}
    <Button
      type="button"
      variant="outline"
      data-testid="logout"
      onclick={async () => {
        try {
          await db.auth.signOut();
          toast.success("Você saiu.");
        } catch (err) {
          console.error("[logout] signOut failed", err);
          toast.error("Falha ao sair.");
        }
      }}
    >
      Sair
    </Button>
  </div>
</header>
<Separator />

<main
  data-testid="shell-content-frame"
  class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6"
>
  <!-- outer content frame — do not duplicate padding inside EntityScreen -->
  <nav class="flex flex-wrap gap-2">
    <Button
      type="button"
      variant={rota.section === "dashboard" ? "secondary" : "ghost"}
      data-testid="nav-dashboard"
      aria-current={rota.section === "dashboard"}
      onclick={() => (rota = { section: "dashboard" })}
    >
      Dashboard
    </Button>
    {#each navConfigs as cfg (cfg.etype)}
      <Button
        type="button"
        variant={rota.section === "entity" && rota.etype === cfg.etype ? "secondary" : "ghost"}
        data-testid={`nav-${cfg.etype}`}
        aria-current={rota.section === "entity" && rota.etype === cfg.etype}
        onclick={() => (rota = { section: "entity", etype: cfg.etype })}
      >
        {cfg.navTitulo ?? cfg.titulo}
      </Button>
    {/each}
  </nav>

  {#if rota.section === "dashboard"}
    <Dashboard />
  {:else if rota.etype === "projetos"}
    <!-- The one permitted per-route mount-point branch in Shell.svelte
         (spec-ui.md §0.6): a router deciding which top-level component to
         mount is not the etype-branch anti-pattern the spec bans inside a
         generic engine — EntityScreen.svelte/registry.ts are untouched by
         this line. -->
    {#key rota.etype}
      <ProjetosSection />
    {/key}
  {:else if rota.etype === "tickets"}
    <!-- Mirrors the "projetos" branch immediately above (spec-ui.md §0.6's
         one-permitted-router-branch precedent) -- inserted ahead of the
         generic {:else} fallback below, which continues to serve every
         other primary etype unchanged. -->
    {#key rota.etype}
      <TicketsSection />
    {/key}
  {:else if rota.etype === "instanciasRotina"}
    <!-- Mirrors the "projetos"/"tickets" branches immediately above
         (spec-ui.md §0.6's one-permitted-router-branch precedent) -- inserted
         ahead of the generic {:else} fallback below, which continues to
         serve every other primary etype unchanged. -->
    {#key rota.etype}
      <RotinasSection />
    {/key}
  {:else}
    {@const active = configByEtype(rota.etype)}
    {#key rota.etype}
      {#if active}
        <EntityScreen config={active} />
      {/if}
    {/key}
  {/if}
</main>
