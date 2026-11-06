<script lang="ts">
	// test-only: tests/client-editor-bridge.test.ts — a `page` with state, a binding and responsive
	// styles, a `header` beside it; `?c=empty` renders the page with no content (the editor fills it);
	// `?trusted=a,b` passes trustedHosts
	import { page as app_page } from '$app/state';
	import { Content } from '@builder.io/sdk-svelte';
	import { BRIDGE_HEADER, BRIDGE_PAGE } from './contents';

	const empty = app_page.url.searchParams.get('c') === 'empty';
	const trusted = app_page.url.searchParams.get('trusted');
	const trustedHosts = trusted === null ? undefined : trusted.split(',').filter(Boolean);
</script>

<Content model="header" apiKey="abcd" canTrack={false} content={BRIDGE_HEADER as never} {trustedHosts} />
<main>
	<Content model="page" apiKey="abcd" canTrack={false} content={(empty ? null : BRIDGE_PAGE) as never} {trustedHosts} />
</main>
