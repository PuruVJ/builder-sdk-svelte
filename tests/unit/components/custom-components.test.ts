// <Content customComponents>: noWrap, the models filter, the shouldReceiveBuilderProps flags,
// canHaveChildren, a component registered without one (a removed built-in), and lazy components
// (`component: { load, fallback }`, official Awaiter — the server renders the fallback).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, el, lines, page, setup, teardown, text, type CompSpec } from './harness.js';

beforeAll(setup);
afterAll(teardown);

const kids = [text('k1', '<p>one</p>'), text('k2', '<p>two</p>')];
const one = (name: string, options: Record<string, unknown> = { title: 'T', n: 1 }, rest: Record<string, unknown> = {}) =>
	page([comp('x', name, options, rest)]);
const wrapped = (rest: Record<string, unknown> = {}) => ({ properties: { class: 'mine', 'data-p': '1' }, responsiveStyles: { large: { color: 'red' } }, ...rest });

describe('a wrapped component', () => {
	each_case(it, {
		options: { content: one('Comp'), customComponents: [{ name: 'Comp' }] },
		'no options': { content: page([el('x', { component: { name: 'Comp' } })]), customComponents: [{ name: 'Comp' }] },
		'with children': { content: one('Comp', {}, { children: kids }), customComponents: [{ name: 'Comp' }] },
		'block attributes and styles on the wrapper': { content: one('Comp', { a: 1 }, wrapped()), customComponents: [{ name: 'Comp' }] },
		'in a custom tag': { content: one('Comp', { a: 1 }, { tagName: 'section' }), customComponents: [{ name: 'Comp' }] },
		'a link block': { content: one('Comp', { a: 1 }, { href: '/x' }), customComponents: [{ name: 'Comp' }] },
		'a link block with a linkComponent': { content: one('Comp', { a: 1 }, { href: '/x' }), customComponents: [{ name: 'Comp' }], link: true },
		'nested block options': {
			content: one('Comp', { items: [text('n1', 'nested 1'), text('n2', 'nested 2')], other: [1, 2] }),
			customComponents: [{ name: 'Comp' }]
		},
		'option values of every type': {
			content: one('Comp', { s: 'x', n: 0, b: false, nil: null, arr: [1, 'a', { o: 1 }], obj: { deep: { er: [true] } }, empty: '' }),
			customComponents: [{ name: 'Comp' }]
		},
		'unregistered: wrapper and children': { content: one('Nope', { a: 1 }, { children: kids }) },
		'registered without a component (a removed built-in)': {
			content: one('Image', { image: 'https://cdn.builder.io/api/v1/image/x' }, { children: kids }),
			customComponents: [{ name: 'Image', kind: 'none' }]
		},
		'overriding a built-in': { content: one('Text', { text: 'replaced' }), customComponents: [{ name: 'Text' }] },
		'two components, each used twice': {
			content: page([comp('a1', 'A', { i: 1 }), comp('b1', 'B', { i: 2 }), comp('a2', 'A', { i: 3 }), comp('b2', 'B', { i: 4 })]),
			customComponents: [{ name: 'A' }, { name: 'B' }]
		}
	});
});

describe('noWrap', () => {
	const nowrap: CompSpec[] = [{ name: 'Bare', kind: 'nowrap' }];
	each_case(it, {
		'attributes on its own root': { content: one('Bare', { a: 1 }, wrapped()), customComponents: nowrap },
		'with children': { content: one('Bare', { a: 1 }, { children: kids }), customComponents: nowrap },
		'with a tagName (ignored)': { content: one('Bare', { a: 1 }, { tagName: 'section', ...wrapped() }), customComponents: nowrap },
		'an href (ignored)': { content: one('Bare', { a: 1 }, { href: '/x' }), customComponents: nowrap },
		'with actions': { content: one('Bare', { a: 1 }, { actions: { click: 'state.x = 1' } }), customComponents: nowrap },
		'with a bound class': {
			content: page([comp('x', 'Bare', { a: 1 }, { bindings: { 'properties.class': 'state.cls' } })], { state: { cls: 'from-state' } }),
			customComponents: nowrap
		},
		'with responsive styles only': { content: one('Bare', {}, { responsiveStyles: { large: { margin: '1px' }, small: { margin: '2px' } } }), customComponents: nowrap },
		'with a style property': { content: one('Bare', {}, { properties: { style: 'color: red' } }), customComponents: nowrap }
	});

	it('ours: the builder attributes land on the component root', () => {
		const c = check({ content: one('Bare', { a: 1 }, wrapped()), customComponents: nowrap });
		const root = lines(c.ours, /data-nowrap="Bare"/)[0];
		expect(root).toContain('builder-id="builder-x"');
		expect(root).toMatch(/class="[^"]*builder-block[^"]*mine/);
	});
});

describe('shouldReceiveBuilderProps', () => {
	const flags = {
		'none (default)': undefined,
		'all false': { builderBlock: false, builderContext: false, builderComponents: false, builderLinkComponent: false },
		builderBlock: { builderBlock: true },
		builderContext: { builderContext: true },
		builderComponents: { builderComponents: true },
		builderLinkComponent: { builderLinkComponent: true },
		all: { builderBlock: true, builderContext: true, builderComponents: true, builderLinkComponent: true }
	};
	const table: Record<string, unknown> = {};
	for (const [label, f] of Object.entries(flags)) {
		const spec: CompSpec = { name: 'Echo', kind: 'echo', ...(f ? { shouldReceiveBuilderProps: f } : {}) };
		table[label] = { content: one('Echo', { a: 1 }), customComponents: [spec], link: true };
		table[`${label}, noWrap`] = { content: one('Echo', { a: 1 }), customComponents: [{ ...spec, noWrap: true }], link: true };
	}
	each_case(it, table as never);

	it('ours: the props a component asked for, and only those', () => {
		const c = check({ content: one('Echo'), customComponents: [{ name: 'Echo', kind: 'echo', shouldReceiveBuilderProps: { builderBlock: true, builderContext: true } }], model: 'page' });
		const echo = lines(c.ours, /props-echo/)[0];
		expect(echo).toContain('data-keys="builderBlock,builderContext"');
		expect(echo).toContain('data-store="function"');
		expect(echo).toContain('data-model="page"');
		expect(echo).toContain('data-block="builder-x"');
	});

	it('ours: builderContext as a store carries the root state', () => {
		const c = check({
			content: page([comp('x', 'Echo', {})], { state: { a: 1, b: 2 } }),
			data: { c: 3 },
			locale: 'fr',
			customComponents: [{ name: 'Echo', kind: 'echo', shouldReceiveBuilderProps: { builderContext: true } }]
		});
		expect(lines(c.ours, /props-echo/)[0]).toContain('data-state="a,b,c,locale"');
	});
});

describe('canHaveChildren', () => {
	each_case(it, {
		'canHaveChildren with children': { content: one('Box', { a: 1 }, { children: kids }), customComponents: [{ name: 'Box', canHaveChildren: true }] },
		'canHaveChildren without children': { content: one('Box', { a: 1 }), customComponents: [{ name: 'Box', canHaveChildren: true }] },
		'canHaveChildren false with children': { content: one('Box', { a: 1 }, { children: kids }), customComponents: [{ name: 'Box', canHaveChildren: false }] },
		'with childRequirements and defaultChildren': {
			content: one('Box', { a: 1 }, { children: kids }),
			customComponents: [{ name: 'Box', canHaveChildren: true, childRequirements: { message: 'x', query: {} }, defaultChildren: [text('dc', 'dc')] }]
		}
	});
});

describe('lazy components (component.load)', () => {
	each_case(it, {
		'with a fallback (the server renders it)': { content: one('Lazy', { a: 1 }), customComponents: [{ name: 'Lazy', kind: 'lazy' }] },
		'without a fallback (nothing yet)': { content: one('Lazy', { a: 1 }), customComponents: [{ name: 'Lazy', kind: 'lazy-no-fallback' }] },
		'with children': { content: one('Lazy', { a: 1 }, { children: kids }), customComponents: [{ name: 'Lazy', kind: 'lazy' }] },
		noWrap: { content: one('Lazy', { a: 1 }, wrapped()), customComponents: [{ name: 'Lazy', kind: 'lazy', noWrap: true }] }
	});

	it('ours: the fallback shows during SSR', () => {
		const c = check({ content: one('Lazy', { a: 1 }), customComponents: [{ name: 'Lazy', kind: 'lazy' }] });
		expect(lines(c.ours, /lazy-fallback/)).toHaveLength(1);
		expect(lines(c.ours, /class="stub"/)).toEqual([]);
	});
});
