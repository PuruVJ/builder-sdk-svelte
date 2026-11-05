<script lang="ts">
	// test-only: tests/editor-perf.test.ts — what one editor edit costs on a page of hundreds of
	// custom components (?n=<sections>, default 100: 300 Cards)
	import { page } from '$app/state';
	import { Content } from '@builder.io/sdk-svelte';
	import Card from './Card.svelte';
	import { perf_content } from './content';

	const n = Number(page.url.searchParams.get('n') || 100);
	const content = perf_content(n);
	const components = [{ name: 'Card', component: Card, inputs: [{ name: 'title', type: 'string' }] }];
</script>

<Content model="page" apiKey="test" canTrack={false} {content} customComponents={components as never} />
