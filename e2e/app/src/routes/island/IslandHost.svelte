<script lang="ts">
	import { getAllContexts } from 'svelte';
	import Container from './Container.svelte';
	import { island_html } from './island.js';

	let { builderBlock, content }: { builderBlock?: { id?: string }; content?: unknown[] } = $props();
	// svelte-ignore state_referenced_locally
	const island_props = { builderBlock: { id: builderBlock?.id }, content };
	const contexts = getAllContexts();
	const html = typeof window === 'undefined' ? island_html(Container, island_props, contexts) : '';
</script>

<!-- svelte-ignore hydration_html_changed -->
<div data-island data-props={JSON.stringify(island_props)}>{@html html}</div>
