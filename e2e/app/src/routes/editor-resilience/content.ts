// test-only: tests/editor-resilience.test.ts
const el = (id: string, rest: Record<string, unknown>) => ({ '@type': '@builder.io/sdk:Element', id, ...rest });

export function resilience_content(opts: { boom?: boolean; code?: string } = {}) {
	return {
		id: 'editor-resilience',
		data: {
			blocks: [
				el('builder-boom', { component: { name: 'Boom', options: { boom: opts.boom ?? false, label: 'boom ok' } } }),
				el('builder-neighbour', { component: { name: 'Text', options: { text: '<p data-neighbour>neighbour</p>' } } }),
				el('builder-code', {
					component: { name: 'Custom Code', options: { code: opts.code ?? '<p data-code>v1</p><script>window.__code_runs = (window.__code_runs || []).concat("v1")</script>' } }
				})
			]
		}
	};
}
