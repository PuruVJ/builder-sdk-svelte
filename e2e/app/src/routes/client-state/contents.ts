// test-only: tests/client-state.test.ts — state, actions, bindings, repeats, jsCode, httpRequests;
// one content per `?c=<name>`.
const ELEMENT = '@builder.io/sdk:Element';
type Block = Record<string, unknown>;

/** (the default block styles the Builder editor gives every block) */
const LARGE = { display: 'flex', flexDirection: 'column', position: 'relative', flexShrink: '0', boxSizing: 'border-box' };
const el = (id: string, component: Block | undefined, extra: Block = {}): Block => ({
	'@type': ELEMENT,
	'@version': 2,
	id: `builder-${id}`,
	...(component ? { component } : {}),
	...extra,
	responsiveStyles: { large: { ...LARGE, ...(extra.responsiveStyles as { large?: object } | undefined)?.large } }
});
const text = (id: string, html: string, extra: Block = {}) => el(id, { name: 'Text', options: { text: html } }, extra);
const bound = (id: string, code: string, extra: Block = {}) => text(id, '', { ...extra, bindings: { 'component.options.text': code, ...(extra.bindings as object) } });
const button = (id: string, label: string, click: string) => el(id, { name: 'Core:Button', options: { text: label } }, { actions: { click } });

const STATE = {
	id: 'client-state',
	data: {
		state: { count: 0, name: 'nobody', nested: { deep: { value: 1 } }, items: [{ label: 'a' }, { label: 'b' }] },
		jsCode: 'state.fromJs = "jsCode ran: " + state.count; state.computed = state.items.length * 10',
		blocks: [
			bound('count', '"count: " + state.count', { properties: { 'data-count': '' } }),
			text('template', '<p data-tpl>name is {{state.name}} and count is {{state.count}}</p>'),
			button('inc', 'Increment', 'state.count = state.count + 1'),
			button('dec', 'Decrement', 'state.count -= 1'),
			el('name-input', undefined, {
				tagName: 'input',
				properties: { placeholder: 'your name', 'data-name-input': '' },
				actions: { input: 'state.name = event.target.value' }
			}),
			bound('name', '"hello " + state.name'),
			text('even', '<p>even count</p>', { bindings: { show: 'state.count % 2 === 0' } }),
			text('odd', '<p>odd count</p>', { bindings: { hide: 'state.count % 2 === 0' } }),
			text('styled', '<p>styled by state</p>', { bindings: { 'style.color': 'state.count > 1 ? "rgb(255, 0, 0)" : "rgb(0, 0, 255)"' } }),
			bound('deep', '"deep: " + state.nested.deep.value'),
			button('deep-inc', 'Deep +10', 'state.nested.deep.value += 10'),
			bound('fromjs', 'state.fromJs + " / " + state.computed'),
			el('row', { name: 'Text', options: { text: '' } }, {
				repeat: { collection: 'state.items', itemName: 'item' },
				bindings: { 'component.options.text': '"row " + state.$index + ": " + state.item.label' },
				actions: { click: 'state.picked = state.item.label' },
				properties: { 'data-row': '' }
			}),
			el('tpl-row', { name: 'Text', options: { text: '<span>tpl {{state.item.label}} of {{state.items.length}}</span>' } }, {
				repeat: { collection: 'state.items', itemName: 'item' }
			}),
			bound('picked', '"picked: " + (state.picked || "none")'),
			bound('length', '"items: " + state.items.length'),
			button('add', 'Add item', 'state.items = [...state.items, { label: "n" + state.items.length }]'),
			button('push', 'Push item', 'state.items.push({ label: "p" + state.items.length })'),
			button('pop', 'Pop item', 'state.items = state.items.slice(0, -1)'),
			button('reverse', 'Reverse items', 'state.items = state.items.slice().reverse()'),
			button('clear', 'Clear items', 'state.items = []')
		]
	}
};

const HTTP = {
	id: 'client-http',
	data: {
		state: { n: 3 },
		httpRequests: {
			getter: 'https://api.test/items?n={{state.n}}&q={{state.n * 2}}',
			poster: {
				'@type': '@builder.io/core:Request',
				request: { url: 'https://api.test/post?n={{state.n}}', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test': 'yes' }, body: '{"hello":"world"}' }
			},
			broken: 'https://api.test/broken'
		},
		blocks: [
			bound('getter', 'state.getter ? "got: " + state.getter.title : "loading getter"'),
			bound('poster', 'state.poster ? "posted: " + state.poster.echo : "loading poster"'),
			el('repeat', { name: 'Text', options: { text: '' } }, {
				repeat: { collection: 'state.getter.list', itemName: 'entry' },
				bindings: { 'component.options.text': '"entry " + state.entry' }
			})
		]
	}
};

export const CONTENTS: Record<string, unknown> = { state: STATE, http: HTTP };
