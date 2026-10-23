<script lang="ts">
	import { Blocks } from '@builder.io/sdk-svelte';

	let { builderBlock, content }: { builderBlock?: { id?: string }; content?: unknown[] } = $props();
</script>

<Blocks blocks={content as never} parent={builderBlock?.id} path="component.options.content" />
