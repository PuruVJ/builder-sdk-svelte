<script lang="ts">
	// test-only (SVELTE_ASYNC=1 builds): /editor-fuzz, with the content behind an `await` in the
	// component — the async-mode shape of an app that awaits its data before rendering <Content>.
	import { Content } from '@builder.io/sdk-svelte';
	import { components } from '../../editor-fuzz/components';

	let { data } = $props();
	const content = $derived(await Promise.resolve(data.content));
</script>

<div data-fuzz-root>
	<Content model="page" apiKey="test" canTrack={false} content={content as never} customComponents={components as never} />
</div>
