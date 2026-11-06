<script lang="ts">
	// test-only: tests/editor-resilience.test.ts — a component that throws while edited, and Custom Code edited
	import { Content } from '@builder.io/sdk-svelte';
	import Boom from './Boom.svelte';
	import { resilience_content } from './content';

	const components = [{ name: 'Boom', component: Boom, inputs: [{ name: 'boom', type: 'boolean' }] }];
</script>

<Content model="page" apiKey="test" canTrack={false} content={resilience_content()} customComponents={components as never} />
