// <Blocks> props (official components/blocks): blocks, parent, path, styleProp, className,
// BlocksWrapperProps, an explicit context store, registeredComponents, linkComponent, children —
// rendered by a custom component (bench/stubs/unit/Probe*.svelte) through each SDK's own <Blocks>.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { blocks_html, check, comp, each_case, lines, official_html, page, setup, teardown, text, type CompSpec } from './harness.js';
import { normalize } from '../../normalize.js';
import StubOurs from '../../../bench/stubs/StubOurs.svelte';

beforeAll(setup);
afterAll(teardown);

const kids = [text('k1', '<p>one</p>', { responsiveStyles: { large: { color: 'red' } } }), text('k2', '<p>two</p>', { href: '/two' })];
const PROBE: CompSpec[] = [{ name: 'Probe', kind: 'probe' }];
const probe = (p: Record<string, unknown>, options: Record<string, unknown> = {}, rest: Record<string, unknown> = { children: kids }) =>
	page([comp('probe', 'Probe', { probe: p, ...options }, rest)]);

describe('<Blocks> props', () => {
	each_case(
		it,
		{
			'children blocks, defaults': { content: probe({}), customComponents: PROBE },
			'blocks undefined': { content: probe({}, {}, {}), customComponents: PROBE },
			'blocks empty': { content: probe({ from: 'items' }, { items: [] }), customComponents: PROBE },
			'blocks from an option': { content: probe({ from: 'items' }, { items: kids }, {}), customComponents: PROBE },
			'no parent': { content: probe({ parent: false }), customComponents: PROBE },
			'another parent': { content: probe({ parent: 'some-parent' }), customComponents: PROBE },
			'path this.children': { content: probe({ path: 'this.children' }), customComponents: PROBE },
			'path component.options.items': { content: probe({ path: 'component.options.items' }), customComponents: PROBE },
			'path bare': { content: probe({ path: 'items' }), customComponents: PROBE },
			'path empty': { content: probe({ path: '' }), customComponents: PROBE },
			styleProp: { content: probe({ styleProp: { flexGrow: '1', marginTop: '2px', backgroundColor: 'red' } }), customComponents: PROBE },
			'styleProp empty': { content: probe({ styleProp: {} }), customComponents: PROBE },
			className: { content: probe({ className: 'my-list other' }), customComponents: PROBE },
			'className on an empty list': { content: probe({ className: 'my-list' }, {}, {}), customComponents: PROBE },
			BlocksWrapperProps: { content: probe({ BlocksWrapperProps: { 'data-list': 'yes', role: 'list' } }), customComponents: PROBE },
			"BlocksWrapperProps over the content's blocksWrapperProps": {
				content: probe({ BlocksWrapperProps: { 'data-list': 'local' } }),
				customComponents: PROBE,
				blocksWrapperProps: { 'data-list': 'global', 'data-g': '1' }
			},
			"the content's blocksWrapper and props": { content: probe({}), customComponents: PROBE, blocksWrapper: 'section', blocksWrapperProps: { 'data-g': '1' } },
			'an explicit context store': { content: probe({ context: true }), customComponents: PROBE },
			'an explicit context, in a repeat': {
				content: page([comp('probe', 'Probe', { probe: { context: true } }, { repeat: { collection: 'state.list' }, children: [text('rk', '{{state.listItem}}')] })], { state: { list: ['a', 'b'] } }),
				customComponents: PROBE
			},
			'registeredComponents (builderComponents)': {
				content: probe({ registry: 'pass' }, {}, { children: [comp('inner', 'Comp', { x: 1 })] }),
				customComponents: [...PROBE, { name: 'Comp' }]
			},
			linkComponent: { content: probe({ link: true }), customComponents: PROBE, link: true },
			'a children snippet': { content: probe({ slot: true }), customComponents: PROBE },
			'a children snippet, no blocks': { content: probe({ slot: true }, {}, {}), customComponents: PROBE },
			'a probe in a probe': {
				content: probe({}, {}, { children: [comp('inner', 'Probe', { probe: { path: 'children', className: 'inner' } }, { children: kids })] }),
				customComponents: PROBE
			},
			'a custom component inside': { content: probe({}, {}, { children: [comp('inner', 'Comp', { x: 1 })] }), customComponents: [...PROBE, { name: 'Comp' }] }
		}
	);

	it('ours: the path and parent attributes', () => {
		const cases: Array<[string | undefined, string | undefined]> = [
			['this.children', 'children'],
			['component.options.items', 'component.options.items'],
			['items', 'component.options.items'],
			[undefined, undefined]
		];
		for (const [path, expected] of cases) {
			const c = check({ content: probe({ path }), customComponents: PROBE });
			const list = lines(c.ours, /builder-parent-id="builder-probe"/)[0];
			if (expected) expect(list).toContain(`builder-path="${expected}"`);
			else expect(list).not.toContain('builder-path');
		}
	});

	it('ours: style, class and wrapper props on the list', () => {
		const c = check({ content: probe({ styleProp: { flexGrow: '1' }, className: 'mine', BlocksWrapperProps: { 'data-l': '1' } }), customComponents: PROBE });
		const list = lines(c.ours, /builder-parent-id="builder-probe"/)[0];
		expect(list).toContain('style="flex-grow:1"');
		expect(list).toMatch(/class="builder-blocks mine svelteelement"/);
		expect(list).toContain('data-l="1"');
	});

	// Known difference, kept: a <Blocks> that is not handed a `linkComponent` renders links through
	// the content's linkComponent here. The official <Blocks> takes it from its prop only, so a list
	// that does not forward it (a custom component's, Slot's, PersonalizationContainer's — while
	// Columns, Tabs and Accordion do forward it) falls back to a plain <a>.
	it('known difference: a list not handed the linkComponent still renders links through it', () => {
		const lists = {
			'a custom component': probe({}),
			Slot: page([comp('slot', 'Slot', { name: 'area' })], { state: { area: [text('lk', 'x', { href: '/l' })] } }),
			PersonalizationContainer: page([comp('pc', 'PersonalizationContainer', {}, { children: [text('lk', 'x', { href: '/l' })] })])
		};
		for (const [label, content] of Object.entries(lists)) {
			const c = check({ content, customComponents: PROBE, link: true }, { official: false });
			expect(lines(c.ours, /<a .*href=/).every((l) => l.includes('data-link-component')), label).toBe(true);
			const official = normalize(official_html({ content, customComponents: PROBE, link: true }));
			expect(lines(official, /<a .*href=/).some((l) => !l.includes('data-link-component')), label).toBe(true);
		}
	});

	it('ours: registeredComponents as an array (official takes only the by-name object)', () => {
		const c = check(
			{
				content: probe({ registry: 'list', list: [{ name: 'Comp', component: StubOurs }] }, {}, { children: [comp('inner', 'Comp', { x: 1 })] }),
				customComponents: PROBE
			},
			{ official: false }
		);
		expect(lines(c.ours, /class="stub"/)).toHaveLength(1);
	});
});

describe('<Blocks> outside any <Content>', () => {
	// No scope to render from: the official SDK renders nothing (its wrapper element is
	// `$builderContext?.BlocksWrapper`, undefined); ours writes an empty placeholder element that a
	// hydrating island adopts as is (the server's markup stays, tests/island.test.ts).
	for (const [label, props] of [
		['with blocks', { blocks: kids }],
		['no blocks', {}],
		['with path and parent', { blocks: kids, path: 'children', parent: 'p' }]
	] as const) {
		it(label, () => {
			const official = normalize(blocks_html('official', props));
			const ours = normalize(blocks_html('ours', props));
			expect(official.tree).toBe('');
			expect(ours.tree).toBe('<div>');
		});
	}
});
