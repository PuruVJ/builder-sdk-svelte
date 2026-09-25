<script lang="ts">
	// The bench's stand-in custom component (same as bench/stubs/*): renders nested block lists found in
	// its options through the SDK's own <Blocks> (the app's alias decides which SDK that is).
	import { Blocks } from '@builder.io/sdk-svelte';
	let props: Record<string, any> = $props();
	const OMIT = new Set(['builderBlock', 'builderContext', 'builderComponents', 'builderLinkComponent', 'attributes', 'children']);
	function nested(): Array<[string, any[]]> {
		const out: Array<[string, any[]]> = [];
		for (const key in props) {
			if (OMIT.has(key)) continue;
			const v = props[key];
			if (Array.isArray(v) && v.length && v[0]?.['@type'] === '@builder.io/sdk:Element') out.push([key, v]);
		}
		return out;
	}
</script>

<div class="stub" data-name={props.builderBlock?.component?.name}>
	{@render props.children?.()}
	{#each nested() as [key, blocks]}
		<Blocks {blocks} parent={props.builderBlock?.id} path={key} context={props.builderContext} registeredComponents={props.builderComponents} />
	{/each}
</div>
