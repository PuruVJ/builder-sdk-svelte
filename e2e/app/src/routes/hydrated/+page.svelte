<script lang="ts">
	// test-only: tests/hydrated.test.ts — the whole page hydrates (Kit), with a custom element upgraded before it does
	import { Content } from '@builder.io/sdk-svelte';
	import { page } from '$app/state';
	import Box from './Box.svelte';

	const ELEMENT = '@builder.io/sdk:Element';
	const content = {
		id: 'hydrated-test',
		data: {
			blocks: [
				{
					'@type': ELEMENT,
					id: 'builder-hydrated-box',
					component: {
						name: 'Box',
						options: {
							content: [
								{ '@type': ELEMENT, id: 'builder-hydrated-text', component: { name: 'Text', options: { text: '<p data-text>nested<x-probe></x-probe></p>' } } }
							]
						}
					}
				},
				{ '@type': ELEMENT, id: 'builder-hydrated-top', component: { name: 'Text', options: { text: '<p>top<x-probe></x-probe></p>' } } },
				{
					'@type': ELEMENT,
					id: 'builder-hydrated-columns',
					component: {
						name: 'Columns',
						options: {
							columns: [
								{ blocks: [{ '@type': ELEMENT, id: 'builder-hydrated-col', component: { name: 'Text', options: { text: '<p>col<x-probe></x-probe></p>' } } }] }
							]
						}
					}
				}
			]
		}
	};
	const components = [{ name: 'Box', component: Box, shouldReceiveBuilderProps: { builderBlock: true }, inputs: [{ name: 'content', type: 'uiBlocks' }] }];
	const probe =
		'<script>window.__probe={connect:0,disconnect:0};customElements.define("x-probe",class extends HTMLElement{connectedCallback(){__probe.connect++}disconnectedCallback(){__probe.disconnect++}})</' +
		'script>';
</script>

<svelte:head>{@html probe}</svelte:head>
<Content model="page" apiKey="test" canTrack={false} {content} customComponents={components as never} blocksWrapper={page.url.searchParams.get('wrapper') ?? undefined} />
