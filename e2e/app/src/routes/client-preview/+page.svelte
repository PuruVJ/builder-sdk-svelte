<script lang="ts">
	// test-only: tests/client-preview.test.ts — a published page (with a symbol) the preview links of
	// the test replace with drafts; a header of another model that must not fetch
	import { Content } from '@builder.io/sdk-svelte';
	import { PREVIEW_PAGE, PREVIEW_HEADER } from './contents';
</script>

<Content model="header" apiKey="abcd" content={PREVIEW_HEADER as never} />
<main>
	<Content model="page" apiKey="abcd" content={PREVIEW_PAGE as never} />
</main>
