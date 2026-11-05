<script lang="ts">
	// test-only: tests/client-animations.test.ts — pageLoad, scrollInView (once and repeating), hover,
	// and a plain block the editor animates (builder.triggerAnimation)
	import { Content } from '@builder.io/sdk-svelte';

	const ELEMENT = '@builder.io/sdk:Element';
	const LARGE = { display: 'flex', flexDirection: 'column', position: 'relative', flexShrink: '0', boxSizing: 'border-box' };
	const block = (id: string, html: string, extra: Record<string, unknown> = {}, large: Record<string, unknown> = {}) => ({
		'@type': ELEMENT,
		'@version': 2,
		id: `builder-${id}`,
		component: { name: 'Text', options: { text: html } },
		responsiveStyles: { large: { ...LARGE, ...large } },
		...extra
	});
	const fade = (trigger: string, duration: number, more: Record<string, unknown> = {}) => ({
		trigger,
		animation: 'custom',
		steps: [
			{ id: 'a', isStartState: false, styles: { opacity: '0', transform: 'translate3d(40px, 0, 0)' }, delay: 0 },
			{ id: 'b', isStartState: false, styles: { opacity: '1', transform: 'none' }, delay: 0 }
		],
		delay: 0,
		duration,
		easing: 'cubic-bezier(.37,.01,0,.98)',
		repeat: false,
		thresholdPercent: 0,
		...more
	});

	const content = {
		id: 'client-animations',
		data: {
			blocks: [
				block('load', '<p>page load</p>', { animations: [fade('pageLoad', 0.6, { delay: 0.1 })] }),
				block('target', '<p>animated by the editor</p>'),
				block('hover', '<p>hover me</p>', {
					animations: [
						{
							trigger: 'hover',
							animation: 'custom',
							steps: [
								{ id: 'a', isStartState: false, styles: {}, delay: 0 },
								{ id: 'b', isStartState: false, styles: { backgroundColor: 'rgba(10, 200, 30, 1)', color: 'rgb(255, 255, 255)' }, delay: 0 }
							],
							delay: 0,
							duration: 0.2,
							easing: 'linear',
							repeat: false,
							thresholdPercent: 0
						}
					]
				}, { backgroundColor: 'rgb(0, 0, 0)', color: 'rgb(200, 200, 200)' }),
				block('spacer', '<p>spacer</p>', {}, { height: '3000px' }),
				block('scroll', '<p>scroll in view</p>', { animations: [fade('scrollInView', 0.3, { thresholdPercent: 10 })] }),
				block('scroll-repeat', '<p>scroll in view, repeating</p>', { animations: [fade('scrollInView', 0.3, { repeat: true })] }),
				block('spacer-2', '<p>spacer</p>', {}, { height: '3000px' })
			]
		}
	};
</script>

<main>
	<Content model="page" apiKey="abcd" canTrack={false} {content} />
</main>
