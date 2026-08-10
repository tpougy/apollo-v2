<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import {
		type ButtonSize,
		type ButtonVariant,
		buttonVariants,
	} from "$lib/components/ui/button/index.js";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		variant = "outline",
		size = "default",
		disabled = false,
		children,
		...restProps
	}: AlertDialogPrimitive.CancelProps & {
		variant?: ButtonVariant;
		size?: ButtonSize;
	} = $props();
</script>

<!--
  bits-ui's AlertDialogCancelState.props (dialog.svelte.js) never emits a
  `disabled` HTML attribute — it only reads the `disabled` box internally to
  gate its own onclick/onkeydown handlers (unlike DialogActionState.props,
  which has no such special-casing and lets a raw `disabled` prop flow
  straight through). Left alone, Cancel is functionally guarded while busy
  (clicks/Enter/Space no-op) but never visually/attributably disabled,
  breaking any consumer (e.g. EntityScreen.svelte's delete-confirm flow) that
  relies on `disabled` actually landing on the rendered element. The `child`
  snippet override (same pattern as calendar-month-select.svelte) re-adds it
  explicitly, after the bits-ui-merged props spread so it always wins.
-->
<AlertDialogPrimitive.Cancel
	bind:ref
	{disabled}
	data-slot="alert-dialog-cancel"
	class={cn(buttonVariants({ variant, size }), "cn-alert-dialog-cancel", className)}
	{...restProps}
>
	{#snippet child({ props })}
		<button {...props} disabled={disabled}>
			{@render children?.()}
		</button>
	{/snippet}
</AlertDialogPrimitive.Cancel>
