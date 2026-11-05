<script lang="ts">
	// test-only: a container rendering its children through the app's Blocks (the 0.0.6 shape)
	import { Blocks } from '@builder.io/sdk-svelte';

	let { builderBlock, content }: { builderBlock?: { id?: string }; content?: unknown[] } = $props();
</script>

<div data-box={builderBlock?.id}>
	<Blocks blocks={content as never} parent={builderBlock?.id} path="component.options.content" />
</div>
