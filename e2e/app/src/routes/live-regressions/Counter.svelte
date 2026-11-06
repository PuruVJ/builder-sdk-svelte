<script lang="ts">
	// test-only: state that a remount would lose; counts its mounts
	import { onMount } from 'svelte';

	let { label = '' }: { label?: string } = $props();
	let clicks = $state(0);
	onMount(() => {
		const g = globalThis as unknown as { __counter_mounts: number };
		g.__counter_mounts = (g.__counter_mounts || 0) + 1;
	});
</script>

<button data-counter onclick={() => clicks++}>{label} {clicks}</button>
