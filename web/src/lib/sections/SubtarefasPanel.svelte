<script lang="ts">
  import { tick } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import EntityScreen from "../entities/EntityScreen.svelte";
  import { configByEtype } from "../entities/registry";
  import type { EntityConfig } from "../entities/types";

  // Never import defs/subtarefas.ts directly here — always resolve through
  // the registry so its own default-export validation (registry.ts:21-29)
  // runs first, mirroring ProjetosSection.svelte's requireConfig.
  function requireConfig(etype: string): EntityConfig {
    const cfg = configByEtype(etype);
    if (!cfg) throw new Error(`SubtarefasPanel: missing EntityConfig for etype "${etype}"`);
    return cfg;
  }
  const subtarefasConfig = requireConfig("subtarefas");

  let {
    parentType,
    parentId,
    parentLabel,
    onClose,
  }: {
    parentType: "tarefa" | "ticket";
    parentId: string;
    parentLabel: string;
    onClose?: () => void;
  } = $props();

  // Spread-clone only -- `configByEtype` returns the SAME object reference to
  // every caller (registry.ts:35-37), so mutating `subtarefasConfig` in place
  // would silently disable "novo" everywhere else it is used, not just here
  // (T-20-02). `create: false` on this clone is why the generic "novo"
  // button never renders on the visible instance below -- that native button
  // would otherwise default `xorParentType` to `config.xorLink.choices[0]`
  // with an empty id (EntityScreen.svelte:215-216), exactly the broken path
  // this panel avoids via the driven-create host instead.
  const visibleConfig: EntityConfig = {
    ...subtarefasConfig,
    capabilities: { ...subtarefasConfig.capabilities, create: false },
  };

  // NOTE (T-20-01): `scopeWhere`/`presetLinks` below are client-side UI
  // filters only, not an authorization mechanism -- the real boundary is
  // `instant.perms.ts`'s unchanged `donoId` scoping (20-RESEARCH.md Security
  // Domain). A future maintainer must not assume this panel itself secures
  // anything.
  //
  // `presetLinks` is a documented no-op for `subtarefas`' create path here
  // (EntityScreen.svelte:212-219 only merges it into `config.links`, and
  // `subtarefas.ts` has no `links`, only `xorLink`) -- kept only for literal
  // fidelity to spec-ui.md §2.4's own wording ("presetLinks: { ticket|tarefa:
  // <id> }"). The visible instance's `create: false` capability means this
  // no-op is harmless: no create affordance ever renders from this instance.
  const scopeWhere = $derived({ [`${parentType}.id`]: parentId });
  const presetLinks = $derived({ [parentType]: parentId });

  // Hidden host for the driven-create flow (Pattern 1, 20-RESEARCH.md) --
  // unmodified `subtarefasConfig`, never the capability-suppressed clone
  // above. Lazily mounted (`hostReady`) so EntityScreen's own unconditional
  // `<h2>{config.titulo}</h2>` never renders until the first "+ subtarefa"
  // click, mirroring ProjetosSection.svelte's projetoHostReady/projetoHostEl
  // precedent (19-RESEARCH.md Pattern 2).
  let hostReady = $state(false);
  let hostEl = $state<HTMLDivElement | undefined>(undefined);

  async function pollFor<T>(description: string, fn: () => T | null | undefined): Promise<T> {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = fn();
      if (result) return result;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`SubtarefasPanel: timed out waiting for ${description}`);
  }

  // bits-ui's Select trigger/item open and select on `pointerdown`/
  // `pointerup` respectively (node_modules/bits-ui/dist/bits/select/
  // select.svelte.js -- SelectTriggerState#onpointerdown,
  // SelectItemState#onpointerup), never plain `click` -- a synthetic
  // `HTMLElement.click()` dispatches only a `click` MouseEvent and is a
  // silent no-op against this component (verified live: it neither opens
  // the trigger nor selects an item). Every Select interaction below must
  // go through this pointer-event pair instead; the plain shadcn `Button`
  // driven earlier (`entity-create-start`) has no such requirement -- it
  // wires a standard `onclick`, so `.click()` still works there.
  function firePointerClick(el: HTMLElement): void {
    const base: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      ctrlKey: false,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", base));
    el.dispatchEvent(new PointerEvent("pointerup", base));
  }

  // Drives the hidden host's own already-rendered, unmodified xor UI
  // (EntityScreen.svelte:756,774) so the user never has to click
  // `xor-parent-type`/`link-tarefa`/`link-ticket` themselves -- the exact
  // bounded-poll shape ProjetosSection.svelte's openProjetoDialog already
  // uses (19-RESEARCH.md Pattern 1), extended with two more driven
  // pointer-event pairs (see firePointerClick above).
  //
  // bits-ui portals the create Dialog to `document.body` regardless of the
  // hidden ancestor (ProjetosSection.svelte's own documented behavior), so
  // every poll AFTER the initial `entity-create-start` click is scoped to
  // `document`, never `hostEl` -- the Dialog no longer lives inside the
  // hidden div once open.
  async function startCreateSubtarefa(): Promise<void> {
    hostReady = true;
    await tick();

    const createBtn = await pollFor("hidden host's entity-create-start button", () =>
      hostEl?.querySelector<HTMLButtonElement>('[data-testid="entity-create-start"]'),
    );
    createBtn.click();

    const xorTrigger = await pollFor("xor-parent-type trigger", () =>
      document.querySelector<HTMLButtonElement>('[data-testid="xor-parent-type"]'),
    );
    firePointerClick(xorTrigger);

    const typeOption = await pollFor(
      `xor-parent-type option matching "${parentType}"`,
      () => {
        const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
        return options.find(
          (opt) => opt.offsetParent !== null && opt.textContent?.trim() === parentType,
        );
      },
    );
    firePointerClick(typeOption);

    const linkTrigger = await pollFor(`link-${parentType} trigger`, () =>
      document.querySelector<HTMLButtonElement>(`[data-testid="link-${parentType}"]`),
    );
    firePointerClick(linkTrigger);

    const idOption = await pollFor(
      `link-${parentType} option matching "${parentLabel}"`,
      () => {
        const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
        return options.find(
          (opt) => opt.offsetParent !== null && opt.textContent?.trim() === parentLabel,
        );
      },
    );
    firePointerClick(idOption);
  }

  function handleAddStart(): void {
    void startCreateSubtarefa();
  }
</script>

<div data-testid="subtarefas-panel" class="w-56 border rounded-md p-4 space-y-4">
  <div class="flex items-center justify-between gap-2">
    <p class="text-sm font-medium truncate">{parentLabel}</p>
    {#if onClose}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="subtarefas-panel-close"
        onclick={onClose}
      >
        fechar
      </Button>
    {/if}
  </div>

  <Button
    type="button"
    variant="outline"
    size="sm"
    class="w-full"
    data-testid="subtarefa-add-start"
    onclick={handleAddStart}
  >
    + subtarefa
  </Button>

  <EntityScreen config={visibleConfig} {scopeWhere} {presetLinks} />
</div>

{#if hostReady}
  <div class="hidden" aria-hidden="true" data-testid="subtarefa-host" bind:this={hostEl}>
    <EntityScreen config={subtarefasConfig} />
  </div>
{/if}
