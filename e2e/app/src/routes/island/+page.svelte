<script lang="ts">
	// test-only: tests/island.test.ts — a csr=false page: the content is server HTML the browser never
	// hydrates, and the container component inside it hydrates alone as an island, with no <Content> above it
	import { hydrate, onMount } from 'svelte';
	import { page } from '$app/state';
	import Container from './Container.svelte';
	import Page from './Page.svelte';
	import { island_html } from './island.js';

	// (one root element: Svelte adopts {@html} server nodes up to the first top-level empty comment, and
	// only for a non-empty client value)
	const html =
		typeof window === 'undefined'
			? '<div>' + island_html(Page, { wrapper: page.url.searchParams.get('wrapper') ?? undefined }, new Map()) + '</div>'
			: ' ';

	onMount(() => {
		const w = window as unknown as Record<string, unknown>;
		for (const el of document.querySelectorAll<HTMLElement>('[data-island]')) {
			w.__before = [...el.querySelectorAll('[builder-id]')];
			try {
				hydrate(Container, { target: el, props: JSON.parse(el.dataset.props!) });
				w.__hydrated = true;
			} catch (e) {
				w.__hydrate_error = String(e);
			}
		}
	});
</script>

<!-- svelte-ignore hydration_html_changed -->
<div data-page>{@html html}</div>
