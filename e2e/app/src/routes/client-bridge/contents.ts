// test-only: tests/client-editor-bridge.test.ts
const ELEMENT = '@builder.io/sdk:Element';
const LARGE = { display: 'flex', flexDirection: 'column', position: 'relative', flexShrink: '0', boxSizing: 'border-box' };
const block = (id: string, component: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
	'@type': ELEMENT,
	'@version': 2,
	id: `builder-${id}`,
	component,
	responsiveStyles: { large: LARGE },
	...extra
});

/** A `page` with state, a binding, an action and responsive styles (large red, medium green, small blue). */
export const BRIDGE_PAGE = {
	id: 'bridge-page',
	data: {
		state: { count: 0, label: 'initial' },
		blocks: [
			block('count', { name: 'Text', options: { text: '' } }, { bindings: { 'component.options.text': '"count: " + state.count + " / " + state.label' } }),
			block('inc', { name: 'Core:Button', options: { text: 'Increment' } }, { actions: { click: 'state.count = state.count + 1' } }),
			block('bp', { name: 'Text', options: { text: '<p>breakpoints</p>' } }, {
				responsiveStyles: { large: { ...LARGE, color: 'rgb(255, 0, 0)' }, medium: { color: 'rgb(0, 128, 0)' }, small: { color: 'rgb(0, 0, 255)' } }
			})
		]
	}
};

export const BRIDGE_HEADER = { id: 'bridge-header', data: { blocks: [block('header-text', { name: 'Text', options: { text: '<p data-header>header</p>' } })] } };

/** What an edit of the page's text looks like (a new block list, the same ids). */
export const edited_page = (label: string) => ({
	...BRIDGE_PAGE,
	data: {
		...BRIDGE_PAGE.data,
		blocks: [...BRIDGE_PAGE.data.blocks, block('edited', { name: 'Text', options: { text: `<p data-edited>${label}</p>` } })]
	}
});
