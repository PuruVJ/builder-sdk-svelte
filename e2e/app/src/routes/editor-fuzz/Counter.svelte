<script lang="ts">
	// test-only: a custom component with state of its own. `data-instance` numbers each mount (set after
	// mount, so SSR and hydration agree), so the test sees whether an edit remounted it; the count is
	// internal state an editor user would lose on a remount. Both are ignored by the DOM comparison.
	import { onMount } from 'svelte';

	let { label = '' }: { label?: string } = $props();
	let instance = $state(0);
	let count = $state(0);
	onMount(() => {
		const w = window as unknown as { __fuzz_mounts?: number };
		instance = w.__fuzz_mounts = (w.__fuzz_mounts ?? 0) + 1;
	});
</script>

<div class="fuzz-counter" data-instance={instance || undefined}>
	<span>{label}</span>
	<button data-fuzz-ignore onclick={() => count++}>{count}</button>
</div>
