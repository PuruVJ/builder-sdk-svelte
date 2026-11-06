<script lang="ts">
	// test-only: tests/client-ab-tests.test.ts
	import { Content } from '@builder.io/sdk-svelte';

	let { data } = $props();
</script>

<main>
	{#key data.content}
		<Content model="page" apiKey="abcd" canTrack={data.canTrack} content={data.content as never} />
	{/key}
</main>
