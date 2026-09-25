<script>
	// The dominant field shape: Svelte 4 syntax, builderBlock opt-in, options as props, children
	// through <Blocks> (block.children and option arrays).
	import { current, block_arrays, texts } from './sdk.js';
	export let builderBlock = undefined;
	$: children = builderBlock?.children ?? [];
	$: arrays = block_arrays($$props);
	$: labels = texts($$props);
</script>

<section class="leaf" data-id={builderBlock?.id} data-name={builderBlock?.component?.name}>
	{#each labels as label}<span>{label}</span>{/each}
	{#if builderBlock && children.length}
		<svelte:component this={current.Blocks} parent={builderBlock.id} blocks={children} path="children" styleProp={{}} />
	{:else}
		<slot />
	{/if}
	{#each arrays as [key, blocks]}
		<svelte:component this={current.Blocks} {blocks} path={`component.options.${key}`} parent={builderBlock?.id} styleProp={{}} />
	{/each}
</section>
