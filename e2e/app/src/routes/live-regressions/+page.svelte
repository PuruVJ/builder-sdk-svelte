<script lang="ts">
	// test-only: tests/live-regressions.test.ts — the shapes earlier releases fixed (nested Blocks in a
	// container, a new content object with the same id, custom elements in the content), in the editor
	import { Content } from '@builder.io/sdk-svelte';
	import Box from './Box.svelte';
	import Counter from './Counter.svelte';
	import { regressions_content } from './content';

	const components = [
		{ name: 'Box', component: Box, shouldReceiveBuilderProps: { builderBlock: true }, inputs: [{ name: 'content', type: 'uiBlocks' }] },
		{ name: 'Counter', component: Counter, inputs: [{ name: 'label', type: 'string' }] }
	];
	let shown = $state.raw(regressions_content());
	const probe =
		'<script>window.__probe={connect:0,disconnect:0};customElements.define("x-probe",class extends HTMLElement{connectedCallback(){__probe.connect++}disconnectedCallback(){__probe.disconnect++}})</' +
		'script>';
</script>

<svelte:head>{@html probe}</svelte:head>
<!-- a new content object with the same id (a refetch), with two more blocks -->
<button data-swap onclick={() => (shown = regressions_content({ extra: 2 }))}>swap</button>
<Content model="page" apiKey="test" canTrack={false} content={shown} customComponents={components as never} />
