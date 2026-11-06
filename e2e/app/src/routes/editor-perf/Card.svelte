<script lang="ts">
	// test-only: counts every time Builder hands it new props (an effect over every prop) and every mount
	import { onMount } from 'svelte';

	let props: Record<string, unknown> = $props();
	const g = globalThis as unknown as { __renders: number; __mounts: number };
	$effect.pre(() => {
		for (const key in props) void props[key];
		g.__renders = (g.__renders || 0) + 1;
	});
	onMount(() => {
		g.__mounts = (g.__mounts || 0) + 1;
	});
</script>

<div class="perf-card" data-card={props.title as string}>{props.title}</div>
