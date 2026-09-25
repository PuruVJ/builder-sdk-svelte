<script lang="ts">
	/** A lazily loaded registered component (`component: { load }`) — official Awaiter semantics. */
	import type { Snippet } from 'svelte';

	let {
		load,
		fallback,
		props,
		children
	}: {
		load: (() => Promise<{ default: unknown }>) | string;
		fallback?: unknown;
		props: Record<string, unknown>;
		children?: Snippet;
	} = $props();

	// svelte-ignore state_referenced_locally
	const pending = typeof load === 'string' ? import(/* @vite-ignore */ load) : load();
</script>

{#await pending}
	{#if fallback}
		{@const Fallback = fallback as any}
		<Fallback />
	{/if}
{:then mod}
	{@const Comp = mod.default as any}
	<Comp {...props}>{@render children?.()}</Comp>
{/await}
