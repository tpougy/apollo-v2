<script lang="ts">
  import type { Snippet } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";

  // Shared chrome for every one of the 7 focus dialogs this phase builds
  // (spec-ui.md §4 "Regras comuns"). Owns width/title/context-line/footer
  // and the busy-aware escape/outside-close behavior, copied verbatim from
  // EntityScreen.svelte's own create/edit Dialog.Content
  // (EntityScreen.svelte:575-579) -- the exact same three widths spec-ui.md
  // §4 mandates, never a fourth.
  const WIDTH_CLASS = { S: "sm:max-w-md", M: "sm:max-w-3xl", L: "sm:max-w-[90vw]" } as const;

  let {
    open,
    onOpenChange,
    size,
    title,
    contexto,
    busy = false,
    breadcrumb,
    onEditar,
    onVerPagina,
    footerExtra,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    size: "S" | "M" | "L";
    title: string;
    contexto?: string;
    busy?: boolean;
    breadcrumb?: { label: string; onClick: () => void };
    onEditar?: () => void;
    onVerPagina?: () => void;
    footerExtra?: Snippet;
    children: Snippet;
  } = $props();
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Content
    showCloseButton={!busy}
    escapeKeydownBehavior={busy ? "ignore" : "close"}
    interactOutsideBehavior={busy ? "ignore" : "close"}
    class={`${WIDTH_CLASS[size]} max-h-[85vh] overflow-y-auto`}
  >
    {#if breadcrumb}
      <button
        type="button"
        data-testid="focus-dialog-breadcrumb"
        class="text-left text-xs text-muted-foreground hover:text-foreground"
        onclick={breadcrumb.onClick}
      >
        ‹ {breadcrumb.label}
      </button>
    {/if}
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      {#if contexto}
        <Dialog.Description>{contexto}</Dialog.Description>
      {/if}
    </Dialog.Header>

    {@render children()}

    <Dialog.Footer>
      {#if onEditar}
        <Button
          type="button"
          variant="outline"
          data-testid="focus-dialog-editar"
          disabled={busy}
          onclick={onEditar}
        >
          editar
        </Button>
      {/if}
      {#if onVerPagina}
        <Button
          type="button"
          variant="ghost"
          data-testid="focus-dialog-ver-pagina"
          disabled={busy}
          onclick={onVerPagina}
        >
          ver na página completa →
        </Button>
      {/if}
      {#if footerExtra}
        {@render footerExtra()}
      {/if}
      <Button
        type="button"
        variant="ghost"
        data-testid="focus-dialog-fechar"
        disabled={busy}
        onclick={() => onOpenChange(false)}
      >
        fechar
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
