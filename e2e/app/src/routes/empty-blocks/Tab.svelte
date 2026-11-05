<script lang="ts">
	// test-only: a container whose slot is empty (an empty tab)
	import { Blocks } from '@builder.io/sdk-svelte';

	let { builderBlock, content }: { builderBlock?: { id?: string }; content?: unknown[] } = $props();
</script>

<div data-tab={builderBlock?.id}>
	<Blocks blocks={(content ?? []) as never} parent={builderBlock?.id} path="component.options.content" />
</div>
