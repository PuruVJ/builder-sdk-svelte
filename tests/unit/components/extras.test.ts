// Corners the other files do not reach: a noWrap built-in's style attribute, custom-element
// wrappers, and (ours only) a component that throws.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, lines, ours_html, page, setup, teardown, text } from './harness.js';
import Throws from './stubs/Throws.svelte';

beforeAll(setup);
afterAll(teardown);

describe('noWrap built-ins with block styles', () => {
	each_case(it, {
		'Raw:Img with block.style': { content: page([comp('i', 'Raw:Img', { image: '/a.png' }, { style: { color: 'red', marginTop: '2px' } })]) },
		'Raw:Img with properties.style': { content: page([comp('i', 'Raw:Img', { image: '/a.png' }, { properties: { style: 'border: 0' } })]) },
		'Button with block.style': { content: page([comp('b', 'Core:Button', { text: 'x' }, { style: { color: 'red' } })]) },
		'Form:Input with block.style': { content: page([comp('f', 'Form:Input', { name: 'n' }, { style: { width: '10px' } })]) },
		'Section with block.style': { content: page([comp('s', 'Core:Section', {}, { style: { padding: '0' } })]) },
		'Symbol with block.style': {
			content: page([comp('s', 'Symbol', { symbol: { model: 'symbol', content: { id: 'sc', data: { blocks: [text('t', 'x')] } } } }, { style: { margin: '1px' } })])
		}
	});
});

describe('custom-element wrappers', () => {
	each_case(it, {
		'contentWrapper my-content': { content: page([text('t', 'x')]), contentWrapper: 'my-content' },
		'blocksWrapper my-list': { content: page([text('t', 'x')]), blocksWrapper: 'my-list' }
	});
});

describe('a component that throws (ours only)', () => {
	const throws = (explode: boolean) => ({
		content: page([text('before', 'before'), comp('boom', 'Throws', { explode }), text('after', 'after')]),
		customComponents: [{ name: 'Throws', kind: 'none' as const, component: Throws }]
	});

	it('a static render fails, as the official one does', () => {
		expect(() => ours_html(throws(true))).toThrow(/exploded/);
	});

	// (live, the component sits in a <svelte:boundary> that leaves only its block empty; the live
	// view renders in the browser only — a server render has no boundaries to catch with, so that
	// leg is for the browser tests)

	it('when it does not throw, live and static agree', () => {
		const c = check(throws(false), { official: false });
		expect(lines(c.live, /did-not-throw/)).toHaveLength(1);
	});
});
