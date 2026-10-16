<script lang="ts">
	import { Content } from '@builder.io/sdk-svelte';
	import IslandHost from './IslandHost.svelte';
	import Leaf from './Leaf.svelte';

	let { wrapper }: { wrapper?: string } = $props();

	const ELEMENT = '@builder.io/sdk:Element';
	const content = {
		id: 'island-test',
		data: {
			blocks: [
				{
					'@type': ELEMENT,
					id: 'builder-island',
					component: {
						name: 'Container',
						options: {
							content: [
								{ '@type': ELEMENT, id: 'builder-island-text', component: { name: 'Text', options: { text: '<p data-text>nested text</p>' } } },
								{ '@type': ELEMENT, id: 'builder-island-leaf', component: { name: 'Leaf', options: { label: 'nested leaf' } } },
								{
									'@type': ELEMENT,
									id: 'builder-island-box',
									children: [
										{ '@type': ELEMENT, id: 'builder-island-deep', component: { name: 'Text', options: { text: '<p data-deep>deep text</p>' } } }
									]
								}
							]
						}
					}
				}
			]
		}
	};
	const components = [
		{ name: 'Container', component: IslandHost, shouldReceiveBuilderProps: { builderBlock: true }, inputs: [{ name: 'content', type: 'uiBlocks' }] },
		{ name: 'Leaf', component: Leaf, inputs: [{ name: 'label', type: 'string' }] }
	];
</script>

<Content model="page" apiKey="test" canTrack={false} {content} customComponents={components as never} blocksWrapper={wrapper} />
