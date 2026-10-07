<script lang="ts">
	// test-only: tests/content-swap.test.ts
	import { Content } from '@builder.io/sdk-svelte';

	const ELEMENT = '@builder.io/sdk:Element';
	const block = (i: number) => ({
		'@type': ELEMENT,
		id: `builder-swap-${i}`,
		component: { name: 'Text', options: { text: `<p>block ${i}</p>` } }
	});
	const full = { id: 'swap-content', data: { blocks: Array.from({ length: 10 }, (_, i) => block(i)) } };
	const first = { ...full, data: { ...full.data, blocks: full.data.blocks.slice(0, 1) } };

	let shown = $state.raw<typeof full>(first);
</script>

<button data-show-full onclick={() => (shown = full)}>full</button>
<button data-show-same onclick={() => (shown = full)}>same again</button>
<Content model="page" apiKey="test" canTrack={false} content={shown} />
