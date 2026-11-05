// test-only: tests/live-regressions.test.ts
const ELEMENT = '@builder.io/sdk:Element';
const el = (id: string, rest: Record<string, unknown>) => ({ '@type': ELEMENT, id, ...rest });
const text = (id: string, html: string) => el(id, { component: { name: 'Text', options: { text: html } } });

export function regressions_content(opts: { nested?: string; extra?: number } = {}) {
	return {
		id: 'live-regressions',
		data: {
			blocks: [
				el('builder-lr-box', { component: { name: 'Box', options: { content: [text('builder-lr-nested', `<p data-nested>${opts.nested ?? 'nested child'}<x-probe></x-probe></p>`)] } } }),
				el('builder-lr-counter', { component: { name: 'Counter', options: { label: 'count' } } }),
				text('builder-lr-top', '<p data-top>top<x-probe></x-probe></p>'),
				...Array.from({ length: opts.extra ?? 0 }, (_, i) => text(`builder-lr-extra-${i}`, `<p data-extra>extra ${i}</p>`))
			]
		}
	};
}
