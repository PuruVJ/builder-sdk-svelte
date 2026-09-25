<script>
	// An option NAMED `children` (type 'blocks') next to the SDK's default slot content: which one does
	// `export let children` receive?
	import { current } from './sdk.js';
	export let children = [];
	export let builderBlock = undefined;
</script>

<div class="children-option" data-kind={Array.isArray(children) ? 'array:' + children.length : typeof children}>
	{#if Array.isArray(children) && children.length}
		<svelte:component this={current.Blocks} blocks={children} path="component.options.children" parent={builderBlock?.id} styleProp={{}} />
	{/if}
</div>
