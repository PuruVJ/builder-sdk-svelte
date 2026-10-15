<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { BuilderContext } from '@builder.io/sdk-svelte';

	let { label }: { label?: string } = $props();
	const ctx = getContext<Readable<{ content?: { id?: string }; componentInfos?: Record<string, unknown> }> | undefined>(BuilderContext.key);
	const id = $derived(ctx ? $ctx?.content?.id : 'none');
	const info = $derived(ctx ? JSON.stringify($ctx?.componentInfos?.Ctx ?? null) : 'none');
</script>

<p data-ctx={id} data-info={info}>{label}</p>
