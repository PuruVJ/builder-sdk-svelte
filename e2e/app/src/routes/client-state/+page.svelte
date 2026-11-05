<script lang="ts">
	// test-only: tests/client-state.test.ts — one content per ?c=<name> (see contents.ts)
	import { Content } from '@builder.io/sdk-svelte';

	let { data } = $props();
</script>

<main>
	{#key data.content}
		<Content model="page" apiKey="abcd" content={data.content as never} />
	{/key}
</main>
