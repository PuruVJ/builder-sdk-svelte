<script lang="ts">
	import { get, type Writable } from 'svelte/store';
	import type { RegisteredComponents } from '../types.js';
	import Blocks from '../components/Blocks.svelte';

	let {
		builderContext,
		name,
		builderComponents
	}: {
		builderContext: Writable<Record<string, any>>;
		name: string;
		builderComponents: RegisteredComponents;
		[k: string]: unknown;
	} = $props();
	// svelte-ignore state_referenced_locally
	const ctx = get(builderContext);
</script>

<div style="pointer-events:auto;" {...!ctx.context?.symbolId ? { 'builder-slot': name } : {}}>
	<Blocks
		parent={ctx.context?.symbolId}
		path={`symbol.data.${name}`}
		context={builderContext}
		registeredComponents={builderComponents}
		blocks={ctx.rootState?.[name]}
	/>
</div>
