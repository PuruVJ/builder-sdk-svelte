// Symbol and Slot (official blocks/symbol, blocks/slot): inline content, data, an entry with no
// content (fetched in the browser only), global / ownerId, the dynamic and inline classes, nested
// symbols, a symbol's own breakpoints, slots filled from symbol data and from root state.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, el, lines, live_html, ours_html, page, setup, teardown, text } from './harness.js';
import { normalize } from '../../normalize.js';

let net: { fetches: string[] };
beforeAll(() => {
	net = setup();
});
afterAll(teardown);

const inner = (blocks: Record<string, unknown>[], rest: Record<string, unknown> = {}) => ({ id: 'sym-content', data: { blocks }, ...rest });
const symbol = (info: Record<string, unknown>, rest: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
	page([comp('sym', 'Symbol', { symbol: info, ...options }, rest)]);
const styled = (id: string) => text(id, `<p>${id}</p>`, { responsiveStyles: { large: { color: 'red' }, medium: { color: 'blue' }, small: { color: 'green' } } });

describe('Symbol', () => {
	each_case(it, {
		'inline content': { content: symbol({ model: 'symbol', entry: 'sym-content', content: inner([text('s1', 'in the symbol')]) }) },
		'content with styled blocks': { content: symbol({ model: 'symbol', content: inner([styled('s1'), styled('s2')]) }) },
		'symbol data reaches its state': {
			content: symbol({ model: 'symbol', data: { who: 'World' }, content: inner([text('s1', 'Hello {{state.who}}')]) })
		},
		"the content's own state wins over symbol data": {
			content: symbol({ model: 'symbol', data: { who: 'data' }, content: inner([text('s1', '{{state.who}}')], { data: { blocks: [text('s1', '{{state.who}}')], state: { who: 'own' } } }) })
		},
		'a binding to symbol data': {
			content: symbol({ model: 'symbol', data: { label: 'B' }, content: inner([text('s1', 'x', { bindings: { 'component.options.text': 'state.label' } })]) })
		},
		'global with ownerId': { content: symbol({ model: 'symbol', global: true, ownerId: 'owner-key', content: inner([text('s1', 'g')]) }) },
		'ownerId without global': { content: symbol({ model: 'symbol', ownerId: 'owner-key', content: inner([text('s1', 'g')]) }) },
		'inline symbol': { content: symbol({ model: 'symbol', inline: true, content: inner([text('s1', 'i')]) }) },
		'dynamic symbol (in the symbol)': { content: symbol({ model: 'symbol', dynamic: true, content: inner([text('s1', 'd')]) }) },
		'dynamic symbol (an option)': { content: symbol({ model: 'symbol', content: inner([text('s1', 'd')]) }, {}, { dynamic: true }) },
		'block attributes and class': {
			content: symbol({ model: 'symbol', content: inner([text('s1', 'x')]) }, { properties: { class: 'mine', 'data-s': '1' }, responsiveStyles: { large: { margin: '2px' } } })
		},
		'a custom component inside': {
			content: symbol({ model: 'symbol', content: inner([comp('c', 'My Stub', { v: 1 })]) }),
			customComponents: [{ name: 'My Stub' }]
		},
		'a link inside, with a linkComponent': { content: symbol({ model: 'symbol', content: inner([text('s1', 'l', { href: '/in' })]) }), link: true },
		'nested symbols': {
			content: symbol({
				model: 'symbol',
				content: inner([text('s1', 'outer'), comp('sym2', 'Symbol', { symbol: { model: 'symbol', content: { id: 'sym-2', data: { blocks: [styled('deep')] } } } })])
			})
		},
		'nested symbol passing data down': {
			content: symbol({
				model: 'symbol',
				data: { a: 'A' },
				content: inner([comp('sym2', 'Symbol', { symbol: { model: 'symbol', data: { b: 'B' }, content: { id: 'sym-2', data: { blocks: [text('deep', '{{state.a}}-{{state.b}}')] } } } })])
			})
		},
		'a symbol with its own breakpoints': {
			content: symbol({ model: 'symbol', content: inner([styled('s1')], { meta: { breakpoints: { small: 400, medium: 800 } } }) })
		},
		'page breakpoints, symbol without its own': {
			content: { ...symbol({ model: 'symbol', content: inner([styled('s1')]) }), meta: { breakpoints: { small: 500, medium: 1000 } } }
		},
		'symbol cssCode': { content: symbol({ model: 'symbol', content: inner([text('s1', 'x')], { data: { blocks: [text('s1', 'x')], cssCode: '.x { color: red; }' } }) }) },
		'two symbols of the same content': {
			content: page([
				comp('symA', 'Symbol', { symbol: { model: 'symbol', content: inner([styled('s1')]) } }),
				comp('symB', 'Symbol', { symbol: { model: 'symbol', content: inner([styled('s1')]) } })
			])
		},
		'a nonce reaches the symbol': { content: symbol({ model: 'symbol', content: inner([styled('s1')]) }), nonce: 'n0nce' }
	});

	// A symbol with nothing to render yet: the same static page. Live (inside the editor), the
	// nested content renders its hidden wrapper for the editor to fill (official
	// `needsElementRefDivForEditing`), so the live tree has that one extra hidden element.
	each_case(
		it,
		{
			'entry without content': { content: symbol({ model: 'symbol', entry: 'abc' }) },
			'no symbol option': { content: page([comp('sym', 'Symbol', {})]) },
			'no model, no content': { content: symbol({}) }
		},
		{ live: false },
		(c) => expect(lines(c.ours, /builder-model="symbol"/)).toEqual([])
	);

	it('live: a symbol with no content yet renders a hidden wrapper for the editor', () => {
		const live = normalize(live_html({ content: symbol({ model: 'symbol', entry: 'abc' }) }));
		expect(lines(live, /builder-model="symbol"/)[0]).toContain('style="display: none"');
	});

	// (the official SDK fires this fetch during SSR and drops the result; it reads `fetch` at module
	// load, so the stub cannot see it)
	it('ours: no request during SSR for an entry without content', async () => {
		net.fetches.length = 0;
		ours_html({ content: symbol({ model: 'symbol', entry: 'abc' }) });
		ours_html({ content: symbol({ model: 'symbol', entry: 'abc', global: true, ownerId: 'o' }) });
		await new Promise((r) => setTimeout(r, 20));
		expect(net.fetches).toEqual([]);
	});

	it('ours: the classes', () => {
		const c = check({ content: symbol({ model: 'symbol', inline: true, dynamic: true, content: inner([text('s1', 'x')]) }, { properties: { class: 'mine' } }) });
		const wrap = lines(c.ours, /builder-symbol/)[0];
		for (const cls of ['mine', 'builder-symbol', 'builder-inline-symbol', 'builder-dynamic-symbol']) expect(wrap).toContain(cls);
	});

	it("ours: a symbol's own breakpoints style its blocks", () => {
		const c = check({ content: symbol({ model: 'symbol', content: inner([styled('s1')], { meta: { breakpoints: { small: 400, medium: 800 } } }) }) });
		expect(c.ours.css.some((r) => r.startsWith('@media (max-width:800px){.builder-s1'))).toBe(true);
		expect(c.ours.css.some((r) => r.startsWith('@media (max-width:400px){.builder-s1'))).toBe(true);
	});
});

describe('Slot', () => {
	const slotted = (data: Record<string, unknown> | undefined) =>
		symbol({ model: 'symbol', ...(data ? { data } : {}), content: inner([text('s1', 'before'), comp('slot', 'Slot', { name: 'main' }), text('s2', 'after')]) });
	each_case(it, {
		'in a symbol, filled from symbol data': { content: slotted({ main: [text('fill', 'filled'), styled('fill2')] }) },
		'in a symbol, no data': { content: slotted(undefined) },
		'in a symbol, empty': { content: slotted({ main: [] }) },
		'in a symbol, a custom component in the slot': { content: slotted({ main: [comp('c', 'My Stub', { x: 1 })] }), customComponents: [{ name: 'My Stub' }] },
		'on a page, from root state': { content: page([comp('slot', 'Slot', { name: 'area' })], { state: { area: [text('st', 'from state')] } }) },
		'on a page, from the data prop': { content: page([comp('slot', 'Slot', { name: 'area' })]), data: { area: [text('dp', 'from data')] } },
		'on a page, nothing there': { content: page([comp('slot', 'Slot', { name: 'area' })]) },
		'no name': { content: page([comp('slot', 'Slot', {})]) }
	});

	it('ours: builder-slot only outside a symbol; the path names the slot', () => {
		const a = check({ content: page([comp('slot', 'Slot', { name: 'area' })]) });
		expect(lines(a.ours, /builder-slot="area"/)).toHaveLength(1);
		// (the official path quirk: `symbol.data.area` gets the `component.options.` prefix; kept)
		expect(lines(a.ours, /builder-path="component\.options\.symbol\.data\.area"/)).toHaveLength(1);
		const b = check({ content: slotted({ main: [text('fill', 'filled')] }) });
		expect(lines(b.ours, /builder-slot=/)).toEqual([]);
		expect(lines(b.ours, /builder-parent-id="builder-sym"/).length).toBeGreaterThan(0);
	});

	it('a block with no id', () => {
		check({ content: page([el(undefined, { component: { name: 'Text', options: { text: 'no id' } } })]) });
	});
});
