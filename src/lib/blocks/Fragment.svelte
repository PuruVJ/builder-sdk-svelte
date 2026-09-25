<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children?: Snippet; [k: string]: unknown } = $props();
</script>

<span>{@render children?.()}</span>
