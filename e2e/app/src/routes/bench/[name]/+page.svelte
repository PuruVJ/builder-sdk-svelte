<script lang="ts">
	// BENCH-ONLY: renders a fixture through whichever SDK this build uses; marks hydration.
	import { onMount } from 'svelte';
	import { Content } from '@builder.io/sdk-svelte';
	import Stub from '../../../components/bench/Stub.svelte';

	let { data } = $props();
	const BUILT_IN = new Set(['Core:Button', 'Columns', 'Fragment', 'Image', 'Core:Section', 'Slot', 'Symbol', 'Text', 'Custom Code', 'Embed', 'Raw:Img', 'Builder:RawText', 'Builder:Accordion', 'Builder: Tabs', 'Video', 'Form:Form', 'Form:Input', 'Form:SubmitButton', 'Form:Select', 'Form:TextArea', 'PersonalizationContainer']);
	const ALL = { builderBlock: true, builderContext: true, builderComponents: true, builderLinkComponent: true };
	// svelte-ignore state_referenced_locally
	const customComponents = data.names.filter((n: string) => !BUILT_IN.has(n)).map((name: string) => ({ name, component: Stub, shouldReceiveBuilderProps: ALL }));

	onMount(() => {
		(window as any).__hydrated = performance.now();
		performance.mark('hydrated');
	});
</script>

<Content content={data.content} model="page" apiKey="bench" {customComponents} canTrack={false} data={data.data} locale={data.locale} />
