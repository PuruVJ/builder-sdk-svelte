<script lang="ts">
	// test-only: tests/editor-fuzz.test.ts — one editable `page` content (posted to ./store), with a
	// stateful custom component. Opened inside an editor-shaped frame, it receives the edits.
	import { Content } from '@builder.io/sdk-svelte';
	import { components } from './components';

	let { data } = $props();
</script>

<div data-fuzz-root>
	<Content model="page" apiKey="test" canTrack={false} content={data.content as never} customComponents={components as never} />
</div>
