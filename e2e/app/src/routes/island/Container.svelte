<script lang="ts">
	import { Blocks } from '@builder.io/sdk-svelte';

	let { builderBlock, content }: { builderBlock?: { id?: string }; content?: unknown[] } = $props();
	let clicks = $state(0);
</script>

<div data-container>
	<button data-bump onclick={() => clicks++}>{clicks}</button>
	<Blocks blocks={content as never} parent={builderBlock?.id} path="component.options.content" />
</div>
