<script lang="ts">
	// test-only: tests/nested-official.test.ts — the editor's official tree rendering a component that
	// renders its children through the app's (aliased) `Blocks`
	import { onMount, type Component } from 'svelte';
	import Container from './Container.svelte';

	const content = {
		id: 'nested-official',
		data: {
			blocks: [
				{
					'@type': '@builder.io/sdk:Element',
					id: 'builder-container',
					component: {
						name: 'Container',
						options: {
							content: [
								{
									'@type': '@builder.io/sdk:Element',
									id: 'builder-child',
									component: { name: 'Text', options: { text: '<p data-child>nested child</p>' } }
								}
							]
						}
					}
				}
			]
		}
	};
	const components = [
		{ name: 'Container', component: Container, shouldReceiveBuilderProps: { builderBlock: true }, inputs: [{ name: 'content', type: 'uiBlocks' }] }
	];

	let Official: Component<any> | null = $state(null);
	onMount(() => {
		// @ts-ignore the official SDK, loaded in the browser the way an editor session loads it
		import('@builder.io/sdk-svelte/bundle/browser').then((m) => (Official = m.Content as never));
	});
</script>

{#if Official}
	<Official model="page" apiKey="test" canTrack={false} {content} customComponents={components} />
{/if}
