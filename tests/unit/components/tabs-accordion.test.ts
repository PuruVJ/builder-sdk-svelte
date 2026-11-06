// Builder: Tabs and Builder:Accordion (official blocks/tabs, blocks/accordion): their options, as the
// server renders them (the first tab / every item closed; clicking is client state).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, lines, official_html, page, setup, teardown, text } from './harness.js';

beforeAll(setup);
afterAll(teardown);

const tab = (i: number) => ({ label: [text(`l${i}`, `Tab ${i}`)], content: [text(`c${i}`, `<p>content ${i}</p>`)] });
const tabs = (options: Record<string, unknown>, rest: Record<string, unknown> = {}) => page([comp('tabs', 'Builder: Tabs', options, rest)]);

describe('Builder: Tabs', () => {
	each_case(it, {
		'two tabs': { content: tabs({ tabs: [tab(0), tab(1)] }) },
		'no tabs option': { content: tabs({}) },
		'defaultActiveTab 2': { content: tabs({ tabs: [tab(0), tab(1), tab(2)], defaultActiveTab: 2 }) },
		'defaultActiveTab 1': { content: tabs({ tabs: [tab(0), tab(1)], defaultActiveTab: 1 }) },
		collapsible: { content: tabs({ tabs: [tab(0), tab(1)], collapsible: true }) },
		activeTabStyle: { content: tabs({ tabs: [tab(0), tab(1)], activeTabStyle: { color: 'red', borderBottom: '2px solid red' } }) },
		'tabHeaderLayout center': { content: tabs({ tabs: [tab(0), tab(1)], tabHeaderLayout: 'center' }) },
		'tabHeaderLayout space-between': { content: tabs({ tabs: [tab(0), tab(1)], tabHeaderLayout: 'space-between' }) },
		'a tab with no content': { content: tabs({ tabs: [{ label: [text('l0', 'Empty')] }, tab(1)] }) },
		'a tab with empty content': { content: tabs({ tabs: [{ label: [text('l0', 'Empty')], content: [] }, tab(1)] }) },
		'a tab with no label': { content: tabs({ tabs: [{ content: [text('c0', 'x')] }, tab(1)] }) },
		'styled tab blocks': {
			content: tabs({ tabs: [{ label: [text('l0', 'L', { responsiveStyles: { large: { color: 'blue' } } })], content: [text('c0', 'C', { responsiveStyles: { small: { margin: '1px' } } })] }] })
		},
		'a custom component in a tab': {
			content: tabs({ tabs: [{ label: [text('l0', 'L')], content: [comp('s', 'My Stub', { a: 1 })] }] }),
			customComponents: [{ name: 'My Stub' }]
		},
		'a link in a tab, with a linkComponent': {
			content: tabs({ tabs: [{ label: [text('l0', 'L', { href: '/l' })], content: [comp('b', 'Core:Button', { text: 'go', link: '/b' })] }] }),
			link: true
		},
		'nested tabs': { content: tabs({ tabs: [{ label: [text('l0', 'L')], content: [comp('inner', 'Builder: Tabs', { tabs: [tab(5)] })] }] }) }
	});

	// Official bug, not copied: with no tab at the active index the official Tabs reads
	// `tabs[active].content` of undefined and the whole render throws. Ours renders the headers
	// and no content.
	for (const [label, options] of [
		['empty tabs', { tabs: [] }],
		['defaultActiveTab past the end', { tabs: [tab(0)], defaultActiveTab: 5 }]
	] as const) {
		it(`${label} (the official render throws; ours renders no content)`, () => {
			expect(() => official_html({ content: tabs(options) })).toThrow(/reading 'content'/);
			const c = check({ content: tabs(options) }, { official: false });
			expect(lines(c.ours, /builder-tabs-wrap/)).toHaveLength(1);
			expect(c.ours.tree).not.toContain('content 0');
		});
	}

	it('ours: the active tab is marked and its content rendered; the others are not', () => {
		const c = check({ content: tabs({ tabs: [tab(0), tab(1), tab(2)], defaultActiveTab: 2, activeTabStyle: { color: 'red' } }) });
		const heads = lines(c.ours, /builder-tab-wrap/);
		expect(heads).toHaveLength(3);
		expect(heads[1]).toContain('builder-tab-active');
		expect(heads[1]).toContain('style="color:red"');
		expect(c.ours.tree).toContain('"content 1"');
		expect(c.ours.tree).not.toContain('"content 0"');
	});
});

const item = (i: number) => ({ title: [text(`t${i}`, `Title ${i}`)], detail: [text(`d${i}`, `<p>detail ${i}</p>`)] });
const accordion = (options: Record<string, unknown>, rest: Record<string, unknown> = {}) => page([comp('acc', 'Builder:Accordion', options, rest)]);

describe('Builder:Accordion', () => {
	each_case(it, {
		'two items': { content: accordion({ items: [item(0), item(1)] }) },
		'no items option': { content: accordion({}) },
		'empty items': { content: accordion({ items: [] }) },
		oneAtATime: { content: accordion({ items: [item(0), item(1)], oneAtATime: true }) },
		grid: { content: accordion({ items: [item(0), item(1), item(2)], grid: true }) },
		'grid with gridRowWidth': { content: accordion({ items: [item(0), item(1)], grid: true, gridRowWidth: '33%' }) },
		'gridRowWidth without grid': { content: accordion({ items: [item(0)], gridRowWidth: '50%' }) },
		useChildrenForItems: { content: accordion({ items: [], useChildrenForItems: true }, { children: [text('ch', 'child')] }) },
		'defaultOpen (not an option in 5.2: closed)': { content: accordion({ items: [item(0)], defaultOpen: 0 }) },
		'an item without detail': { content: accordion({ items: [{ title: [text('t0', 'T')] }, item(1)] }) },
		'an item without title': { content: accordion({ items: [{ detail: [text('d0', 'D')] }] }) },
		'styled titles': { content: accordion({ items: [{ title: [text('t0', 'T', { responsiveStyles: { large: { fontWeight: 'bold' } } })], detail: [] }] }) },
		'a custom component as a title': { content: accordion({ items: [{ title: [comp('s', 'My Stub', { a: 2 })], detail: [] }] }), customComponents: [{ name: 'My Stub' }] },
		'block styles': { content: accordion({ items: [item(0)] }, { responsiveStyles: { large: { padding: '5px' } } }) }
	});

	it('ours: every item starts closed (no detail rendered on the server)', () => {
		const c = check({ content: accordion({ items: [item(0), item(1)], grid: true, gridRowWidth: '40%' }) });
		const titles = lines(c.ours, /builder-accordion-title/);
		expect(titles).toHaveLength(2);
		expect(titles[0]).toContain('builder-accordion-title-closed');
		expect(titles[0]).toContain('width:40%');
		expect(titles[1]).toContain('order:2');
		expect(lines(c.ours, /builder-accordion-detail/)).toEqual([]);
	});
});
