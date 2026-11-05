<script lang="ts" module>
	// Every builder.variantLoaded / builder.variantDisplayed that bubbles to the document, from before
	// the app mounts.
	if (typeof window !== 'undefined') {
		const w = window as unknown as { __variant_events: unknown[] };
		w.__variant_events = [];
		for (const type of ['builder.variantLoaded', 'builder.variantDisplayed'])
			document.addEventListener(type, (e) => {
				const { variant, content } = (e as CustomEvent).detail ?? {};
				w.__variant_events.push([
					type,
					(e.target as Element).closest('[builder-id]')?.getAttribute('builder-id'),
					typeof variant === 'object' && variant ? variant.name : variant,
					content?.id ?? null
				]);
			});
	}
</script>

<script lang="ts">
	// test-only: tests/client-personalization.test.ts — two personalization containers (one far below
	// the fold) and buttons that set the visitor's attributes
	import { Content, setClientUserAttributes } from '@builder.io/sdk-svelte';

	const ELEMENT = '@builder.io/sdk:Element';
	const LARGE = { display: 'flex', flexDirection: 'column', position: 'relative', flexShrink: '0', boxSizing: 'border-box' };
	const text = (id: string, html: string, large: Record<string, unknown> = {}) => ({
		'@type': ELEMENT,
		'@version': 2,
		id: `builder-${id}`,
		component: { name: 'Text', options: { text: html } },
		responsiveStyles: { large: { ...LARGE, ...large } }
	});
	const query = (property: string, value: string[]) => [{ '@type': '@builder.io/core:Query', property, operator: 'is', value }];
	const container = (id: string, variants: { name: string; device: string[] }[]) => ({
		'@type': ELEMENT,
		'@version': 2,
		id: `builder-${id}`,
		component: {
			name: 'PersonalizationContainer',
			options: {
				variants: variants.map((v) => ({ name: v.name, query: query('device', v.device), blocks: [text(`${id}-${v.name}`, `<p>${id}: ${v.name} content</p>`)] }))
			}
		},
		children: [text(`${id}-default`, `<p>${id}: default content</p>`)],
		responsiveStyles: { large: LARGE }
	});

	const content = {
		id: 'client-personalization',
		data: {
			blocks: [
				container('top', [
					{ name: 'tablet', device: ['tablet'] },
					{ name: 'mobile', device: ['mobile'] }
				]),
				text('spacer', '<p>spacer</p>', { height: '3000px' }),
				container('below', [{ name: 'mobile', device: ['mobile'] }])
			]
		}
	};
</script>

<button data-attrs="tablet" onclick={() => setClientUserAttributes({ device: 'tablet' })}>tablet</button>
<button data-attrs="mobile" onclick={() => setClientUserAttributes({ device: 'mobile' })}>mobile</button>
<button data-attrs="desktop" onclick={() => setClientUserAttributes({ device: 'desktop' })}>desktop</button>
<main>
	<Content model="page" apiKey="abcd" {content} />
</main>
