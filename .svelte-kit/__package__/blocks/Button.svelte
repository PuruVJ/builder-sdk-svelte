<script lang="ts">
	import { plain_attrs, event_attrs } from './helpers.js';
	let {
		attributes = {},
		link = undefined,
		openLinkInNewTab = undefined,
		builderLinkComponent = undefined,
		text = undefined
	}: {
		attributes?: Record<string, unknown>;
		link?: string;
		openLinkInNewTab?: boolean;
		builderLinkComponent?: unknown;
		text?: string;
		[k: string]: unknown;
	} = $props();

	function attrs() {
		const out = { ...plain_attrs(attributes), ...event_attrs(attributes) } as Record<string, unknown>;
		out.class = `${link ? '' : 'builder-button'} ${attributes.class || ''}`;
		if (link) {
			out.href = link;
			out.target = openLinkInNewTab ? '_blank' : undefined;
			out.role = 'link';
		} else out.role = 'button';
		return out;
	}
</script>

{#if link && builderLinkComponent}
	{@const Link = builderLinkComponent as any}
	<Link {...attrs()}>{text}</Link>
{:else}
	<svelte:element this={link ? 'a' : 'button'} {...attrs()}>{text}</svelte:element>
{/if}
