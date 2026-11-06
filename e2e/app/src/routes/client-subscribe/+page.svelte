<script lang="ts">
	// test-only: tests/client-editor-bridge.test.ts — subscribeToEditor: every content update of the
	// `page` model the editor sends, shown as received; a button stops the subscription
	import { onMount } from 'svelte';
	import { subscribeToEditor } from '@builder.io/sdk-svelte';

	let received = $state<string[]>([]);
	let stop: (() => void) | undefined;
	onMount(() => {
		stop = subscribeToEditor({
			model: 'page',
			apiKey: 'abcd',
			callback: (content) => (received = [...received, JSON.stringify({ id: content?.id, title: (content?.data as { title?: string })?.title })])
		});
		return () => stop?.();
	});
</script>

<button data-stop onclick={() => stop?.()}>stop</button>
<ul data-received>
	{#each received as r}<li>{r}</li>{/each}
</ul>
