// Block-level features (official components/block + functions/get-processed-block, get-style,
// get-block-properties): bindings on every path kind, repeat, actions, animations, show/hide,
// links, tag names (void and SVG included), properties and class merging, responsive styles at every
// breakpoint (custom breakpoints too), localized values.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, el, lines, page, setup, teardown, text, type CompSpec } from './harness.js';

beforeAll(setup);
afterAll(teardown);

const L = (Default: unknown, more: Record<string, unknown> = {}) => ({ '@type': '@builder.io/core:LocalizedValue', Default, ...more });
const box = (id: string, rest: Record<string, unknown> = {}) => el(id, { children: [text(`${id}-t`, `<p>${id}</p>`)], ...rest });
const STUB: CompSpec[] = [{ name: 'Comp' }];

describe('bindings', () => {
	const state = { s: 'str', n: 5, yes: true, no: false, cls: 'from-state', color: 'red', href: '/bound', obj: { deep: 'deep' }, list: [1, 2] };
	const bound = (bindings: Record<string, string>, rest: Record<string, unknown> = {}) => page([text('b', 'static', { bindings, ...rest })], { state });
	each_case(it, {
		'component.options.text': { content: bound({ 'component.options.text': 'state.s' }) },
		'component.options.text, an expression': { content: bound({ 'component.options.text': 'state.s + "-" + state.n' }) },
		'component.options.text, a return statement': { content: bound({ 'component.options.text': 'return state.obj.deep' }) },
		'component.options.text, a nested path': { content: page([comp('b', 'Comp', { a: { b: 1 } }, { bindings: { 'component.options.a.b': 'state.n' } })], { state }), customComponents: STUB },
		'component.options of a custom component': {
			content: page([comp('b', 'Comp', { title: 'x' }, { bindings: { 'component.options.title': 'state.s', 'component.options.count': 'state.n' } })], { state }),
			customComponents: STUB
		},
		'style.color': { content: bound({ 'style.color': 'state.color' }) },
		'style.marginTop (camel case)': { content: bound({ 'style.marginTop': '"4px"' }) },
		'style and responsive styles together': { content: bound({ 'style.color': 'state.color' }, { responsiveStyles: { large: { color: 'blue', padding: '1px' } } }) },
		'properties.class': { content: bound({ 'properties.class': 'state.cls' }, { properties: { class: 'static' } }) },
		'properties.href': { content: bound({ 'properties.href': 'state.href' }) },
		'properties.data-x': { content: bound({ 'properties.data-x': 'state.n' }) },
		'properties.aria-hidden': { content: bound({ 'properties.aria-hidden': 'state.yes' }) },
		'show true': { content: bound({ show: 'state.yes' }) },
		'show false': { content: bound({ show: 'state.no' }) },
		'hide true': { content: bound({ hide: 'state.yes' }) },
		'hide false': { content: bound({ hide: 'state.no' }) },
		'show and hide': { content: bound({ show: 'state.yes', hide: 'state.yes' }) },
		'show from a missing value': { content: bound({ show: 'state.nothing' }) },
		'href on the block': { content: bound({ href: 'state.href' }) },
		'a binding that throws': { content: bound({ 'component.options.text': 'state.nothing.deeper' }) },
		'a binding reading context': { content: bound({ 'component.options.text': 'context.c' }), context: { c: 'ctx' } },
		'a binding reading Builder.isServer': { content: bound({ 'component.options.text': 'Builder.isServer ? "server" : "browser"' }) },
		'a binding on a block with children': {
			content: page([el('b', { bindings: { 'properties.class': 'state.cls' }, children: [text('c1', 'child'), text('c2', '{{state.s}}')] })], { state })
		},
		'nested bound blocks': {
			content: page([el('b', { bindings: { 'style.color': 'state.color' }, children: [text('c1', 'x', { bindings: { 'component.options.text': 'state.s' } })] })], { state })
		},
		'a bound component.name': { content: page([comp('b', 'Text', { text: 'x' }, { bindings: { 'component.name': '"Comp"' } })], { state }), customComponents: STUB },
		'a bound id': { content: bound({ id: '"builder-other"' }, { responsiveStyles: { large: { color: 'red' } } }) }
	});

	// The official SDK ignores a bound tagName: the tag is read from the block before bindings apply
	// (`block.tagName`); ours does the same.
	each_case(it, {
		'a bound tagName (ignored)': { content: bound({ tagName: '"section"' }) },
		'a bound tagName with a static tagName': { content: bound({ tagName: '"section"' }, { tagName: 'span' }) }
	}, {}, (c) => expect(lines(c.ours, /builder-id="builder-b"/)[0]).not.toMatch(/^<section/));

	it('ours: bound values land where the path says', () => {
		const c = check({ content: page([text('b', 'x', { bindings: { 'component.options.text': 'state.s', 'style.color': 'state.color', 'properties.data-n': 'state.n' } })], { state }) });
		const b = lines(c.ours, /builder-id="builder-b"/)[0];
		expect(b).toContain('style="color: red"');
		expect(b).toContain('data-n="5"');
		expect(c.ours.tree).toContain('"str"');
	});
});

describe('repeat', () => {
	const item = (bindings: Record<string, string> = { 'component.options.text': 'state.listItem' }) => text('rep', 'x', { bindings });
	each_case(it, {
		'an array of strings': { content: page([el('r', { repeat: { collection: 'state.list' }, children: [item()] })], { state: { list: ['a', 'b', 'c'] } }) },
		'the block itself repeats (bindings on it)': {
			content: page([text('r', 'x', { repeat: { collection: 'state.list' }, bindings: { 'component.options.text': 'state.listItem' } })], { state: { list: ['a', 'b'] } })
		},
		itemName: {
			content: page([text('r', 'x', { repeat: { collection: 'state.people', itemName: 'person' }, bindings: { 'component.options.text': 'state.person.name' } })], {
				state: { people: [{ name: 'Ada' }, { name: 'Lin' }] }
			})
		},
		'$index': {
			content: page([text('r', 'x', { repeat: { collection: 'state.list' }, bindings: { 'component.options.text': 'state.$index + ":" + state.listItem' } })], { state: { list: ['a', 'b'] } })
		},
		'$index in a {{template}}': { content: page([text('r', '{{state.$index}}-{{state.listItem}}', { repeat: { collection: 'state.list' } })], { state: { list: ['x', 'y'] } }) },
		'nested repeats': {
			content: page(
				[
					el('outer', {
						repeat: { collection: 'state.rows', itemName: 'row' },
						children: [text('inner', 'x', { repeat: { collection: 'state.row.cells', itemName: 'cell' }, bindings: { 'component.options.text': 'state.row.name + "/" + state.cell' } })]
					})
				],
				{ state: { rows: [{ name: 'r1', cells: [1, 2] }, { name: 'r2', cells: [3] }] } }
			)
		},
		'an empty array': { content: page([el('r', { repeat: { collection: 'state.list' }, children: [item()] })], { state: { list: [] } }) },
		'a missing collection': { content: page([el('r', { repeat: { collection: 'state.nothing' }, children: [item()] })]) },
		'an object (not an array)': { content: page([el('r', { repeat: { collection: 'state.obj' }, children: [item()] })], { state: { obj: { a: 1 } } }) },
		'a string (not an array)': { content: page([el('r', { repeat: { collection: 'state.s' }, children: [item()] })], { state: { s: 'abc' } }) },
		'a number (not an array)': { content: page([el('r', { repeat: { collection: 'state.n' }, children: [item()] })], { state: { n: 3 } }) },
		'null': { content: page([el('r', { repeat: { collection: 'state.z' }, children: [item()] })], { state: { z: null } }) },
		'a collection expression': { content: page([el('r', { repeat: { collection: 'state.list.filter(x => x > 1)' }, children: [item()] })], { state: { list: [1, 2, 3] } }) },
		'a repeated custom component': {
			content: page([comp('r', 'Comp', { title: 'x' }, { repeat: { collection: 'state.list' }, bindings: { 'component.options.title': 'state.listItem' } })], { state: { list: ['a', 'b'] } }),
			customComponents: STUB
		},
		'a repeat with styles': {
			content: page([el('r', { repeat: { collection: 'state.list' }, responsiveStyles: { large: { color: 'red' }, small: { color: 'blue' } }, children: [item()] })], { state: { list: [1, 2] } })
		},
		'a hidden repeat': { content: page([el('r', { repeat: { collection: 'state.list' }, hide: true, children: [item()] })], { state: { list: [1, 2] } }) },
		'a repeat with show bound to the item': {
			content: page([text('r', 'x', { repeat: { collection: 'state.list' }, bindings: { show: 'state.listItem > 1', 'component.options.text': 'state.listItem' } })], { state: { list: [1, 2, 3] } })
		},
		'a repeat of a link': { content: page([text('r', 'x', { repeat: { collection: 'state.list' }, bindings: { href: '"/p/" + state.listItem' } })], { state: { list: ['a', 'b'] } }), link: true },
		'a repeat inside a Columns column': {
			content: page([comp('cols', 'Columns', { columns: [{ blocks: [text('r', 'x', { repeat: { collection: 'state.list' }, bindings: { 'component.options.text': 'state.listItem' } })] }] })], { state: { list: ['a', 'b'] } })
		}
	});

	it('ours: one copy per item', () => {
		const c = check({ content: page([text('r', '{{state.$index}}-{{state.listItem}}', { repeat: { collection: 'state.list' } })], { state: { list: ['x', 'y', 'z'] } }) });
		expect(c.ours.tree).toContain('"0-x"');
		expect(c.ours.tree).toContain('"2-z"');
		expect(lines(c.ours, /builder-id="builder-r"/)).toHaveLength(3);
	});
});

describe('actions', () => {
	each_case(it, {
		click: { content: page([text('a', 'x', { actions: { click: 'state.n = (state.n || 0) + 1' } })]) },
		'several events': { content: page([text('a', 'x', { actions: { click: 'state.a = 1', mouseenter: 'state.b = 1', 'on:submit': 'x' } })]) },
		'an action on a custom component': { content: page([comp('a', 'Comp', {}, { actions: { click: 'state.n = 1' } })]), customComponents: STUB },
		'an action on a link': { content: page([text('a', 'x', { href: '/x', actions: { click: 'state.n = 1' } })]) },
		'an action on a plain block with children': { content: page([el('a', { actions: { click: 'state.n = 1' }, children: [text('c', 'c')] })]) }
	});

	it('ours: no handler attribute reaches the markup', () => {
		const c = check({ content: page([text('a', 'x', { actions: { click: 'state.n = 1' } })]) });
		expect(c.html.ours).not.toMatch(/onclick|on:click/);
	});
});

describe('animations', () => {
	const hover = (rest: Record<string, unknown> = {}) => ({ trigger: 'hover', steps: [{ styles: { opacity: '1' } }, { styles: { opacity: '0.5', transform: 'scale(1.1)' } }], duration: 0.3, ...rest });
	each_case(it, {
		'hover with an easing and a delay': { content: page([text('a', 'x', { animations: [hover({ easing: 'easeInOut', delay: 0.2 })] })]) },
		'hover, no easing (regression: no "undefined" easing)': { content: page([text('a', 'x', { animations: [hover()] })]) },
		'hover, no duration': { content: page([text('a', 'x', { animations: [hover({ duration: undefined })] })]) },
		'hover, one step': { content: page([text('a', 'x', { animations: [{ trigger: 'hover', steps: [{ styles: { opacity: '1' } }] }] })]) },
		'hover with responsive styles': { content: page([text('a', 'x', { animations: [hover()], responsiveStyles: { large: { color: 'red' } } })]) },
		'scrollInView': { content: page([text('a', 'x', { animations: [{ trigger: 'scrollInView', steps: [{ styles: { opacity: '0' } }, { styles: { opacity: '1' } }], duration: 1 }] })]) },
		pageLoad: { content: page([text('a', 'x', { animations: [{ trigger: 'pageLoad', steps: [{ styles: { opacity: '0' } }, { styles: { opacity: '1' } }] }] })]) },
		'an animated block with children': { content: page([el('a', { animations: [hover()], children: [text('c', 'c')] })]) },
		'an animated custom component': { content: page([comp('a', 'Comp', { a: 1 }, { animations: [hover()] })]), customComponents: STUB },
		'an animated block without an id': { content: page([el(undefined, { animations: [hover()], children: [text('c', 'c')] })]) }
	});

	it('regression: a hover animation without an easing writes no "undefined"', () => {
		const c = check({ content: page([text('a', 'x', { animations: [hover()] })]) });
		const rule = c.ours.css.find((r) => r.startsWith('.builder-a:hover'));
		expect(rule).toContain('transition:all 0.3s;');
		expect(rule).not.toContain('undefined');
		const eased = check({ content: page([text('a', 'x', { animations: [hover({ easing: 'easeInOut' })] })]) });
		expect(eased.ours.css.find((r) => r.startsWith('.builder-a:hover'))).toContain('transition:all 0.3s ease-in-out;');
	});
});

describe('show / hide (static)', () => {
	each_case(it, {
		'show false': { content: page([box('a', { show: false }), box('b')]) },
		'show true': { content: page([box('a', { show: true })]) },
		'show 0': { content: page([box('a', { show: 0 })]) },
		'show null': { content: page([box('a', { show: null })]) },
		'hide true': { content: page([box('a', { hide: true }), box('b')]) },
		'hide false': { content: page([box('a', { hide: false })]) },
		'hide empty string': { content: page([box('a', { hide: '' })]) },
		'show true, hide true': { content: page([box('a', { show: true, hide: true })]) },
		'a hidden styled block': { content: page([box('a', { hide: true, responsiveStyles: { large: { color: 'red' } } })]) },
		'a hidden custom component': { content: page([comp('a', 'Comp', {}, { hide: true })]), customComponents: STUB }
	});
});

describe('links', () => {
	each_case(it, {
		'href on the block': { content: page([box('a', { href: '/x' })]) },
		'properties.href': { content: page([box('a', { properties: { href: '/x', target: '_blank' } })]) },
		'tagName a, no href': { content: page([box('a', { tagName: 'a' })]) },
		'tagName a with properties.href': { content: page([box('a', { tagName: 'a', properties: { href: 'https://x.test' } })]) },
		'href with a tagName span (becomes a link)': { content: page([box('a', { tagName: 'span', href: '/x' })]) },
		'href on a custom component block': { content: page([comp('a', 'Comp', { a: 1 }, { href: '/x' })]), customComponents: STUB },
		'empty href': { content: page([box('a', { href: '' })]) },
		'every link shape, with a linkComponent': {
			content: page([box('a', { href: '/x' }), box('b', { properties: { href: '/y' } }), box('c', { tagName: 'a' }), text('d', 'x', { href: '/z' })]),
			link: true
		},
		'a link inside a link': { content: page([box('a', { href: '/outer', children: [text('b', 'in', { href: '/inner' })] })]) }
	});
});

describe('tagName', () => {
	const table: Record<string, unknown> = {};
	for (const tag of ['span', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'h1', 'h2', 'p', 'ul', 'li', 'button', 'label', 'my-element', 'details', 'summary', 'figure'])
		table[tag] = { content: page([box('a', { tagName: tag })]) };
	for (const tag of ['img', 'br', 'hr', 'input', 'source', 'wbr'])
		table[`${tag} (void)`] = { content: page([el('a', { tagName: tag, properties: { 'data-v': '1' }, responsiveStyles: { large: { color: 'red' } } })]) };
	table['svg with a path'] = {
		content: page([el('a', { tagName: 'svg', properties: { viewBox: '0 0 10 10', width: '10' }, children: [el('p', { tagName: 'path', properties: { d: 'M0 0L10 10' } })] })])
	};
	table['svg circle and g'] = { content: page([el('a', { tagName: 'svg', children: [el('g', { tagName: 'g', children: [el('c', { tagName: 'circle', properties: { r: '4' } })] })] })]) };
	table['textarea (raw text)'] = { content: page([el('a', { tagName: 'textarea', children: [text('t', 'inside')] })]) };
	table['ul of li'] = { content: page([el('a', { tagName: 'ul', children: [box('i1', { tagName: 'li' }), box('i2', { tagName: 'li' })] })]) };
	table['a custom component in a span'] = { content: page([comp('a', 'Comp', { a: 1 }, { tagName: 'span' })]), customComponents: STUB };
	table['an empty block'] = { content: page([el('a')]) };
	each_case(it, table as never);
});

describe('properties and classes', () => {
	each_case(it, {
		'properties.class': { content: page([box('a', { properties: { class: 'one two' } })]) },
		'block.class': { content: page([box('a', { class: 'from-block' })]) },
		'block.class and properties.class': { content: page([box('a', { class: 'from-block', properties: { class: 'from-props' } })]) },
		'a data attribute, an aria attribute, an id': { content: page([box('a', { properties: { 'data-x': 'y', 'aria-label': 'L', id: 'dom-id' } })]) },
		'a style property (a string)': { content: page([box('a', { properties: { style: 'color: red' } })]) },
		'block.style': { content: page([box('a', { style: { color: 'red', marginTop: '2px' } })]) },
		'block.style and properties.style': { content: page([box('a', { style: { color: 'red' }, properties: { style: 'margin: 0' } })]) },
		'boolean-ish properties': { content: page([el('a', { tagName: 'input', properties: { disabled: 'true', required: '', checked: 'checked' } })]) },
		'an on* property (dropped)': { content: page([box('a', { properties: { onclick: 'alert(1)', 'data-ok': '1' } })]) },
		'a class on a custom component block': { content: page([comp('a', 'Comp', { a: 1 }, { class: 'blk', properties: { class: 'prp' } })]), customComponents: STUB },
		'a class on a built-in (Button)': { content: page([comp('a', 'Core:Button', { text: 'x' }, { class: 'blk', properties: { class: 'prp' } })]) },
		'layerName and other editor fields': { content: page([box('a', { layerName: 'Hero', groupLocked: true, meta: { x: 1 }, code: { bindings: {} } })]) }
	});

	it('ours: the id, builder-block, block.class and properties.class are merged', () => {
		const c = check({ content: page([box('a', { class: 'from-block', properties: { class: 'from-props' } })]) });
		expect(lines(c.ours, /builder-id="builder-a"/)[0]).toContain('class="builder-a builder-block from-block from-props"');
	});
});

describe('responsive styles', () => {
	const rs = { large: { color: 'red', paddingTop: '10px' }, medium: { color: 'green' }, small: { color: 'blue' }, xsmall: { color: 'pink' } };
	each_case(it, {
		'every breakpoint, default sizes': { content: page([box('a', { responsiveStyles: rs })]) },
		'large only': { content: page([box('a', { responsiveStyles: { large: { color: 'red' } } })]) },
		'small only': { content: page([box('a', { responsiveStyles: { small: { color: 'red' } } })]) },
		'xsmall without an xsmall breakpoint': { content: page([box('a', { responsiveStyles: { xsmall: { color: 'red' } } })]) },
		'custom breakpoints': { content: page([box('a', { responsiveStyles: rs })], {}, { meta: { breakpoints: { small: 500, medium: 1000 } } }) },
		'custom breakpoints with xsmall': { content: page([box('a', { responsiveStyles: rs })], {}, { meta: { breakpoints: { xsmall: 320, small: 500, medium: 1000 } } }) },
		'custom breakpoints, only small': { content: page([box('a', { responsiveStyles: rs })], {}, { meta: { breakpoints: { small: 700 } } }) },
		'custom breakpoints, invalid': { content: page([box('a', { responsiveStyles: rs })], {}, { meta: { breakpoints: { small: 2000, medium: 100 } } }) },
		'empty style objects': { content: page([box('a', { responsiveStyles: { large: {}, small: {} } })]) },
		'values needing care (urls, quotes, !important)': {
			content: page([box('a', { responsiveStyles: { large: { backgroundImage: 'url("https://x.test/a b.png")', fontFamily: '"My Font", serif', color: 'red !important' } } })])
		},
		'a css variable and a vendor prefix': { content: page([box('a', { responsiveStyles: { large: { '--brand': '#123', WebkitLineClamp: '2' } } })]) },
		'many blocks sharing the sheet': { content: page([box('a', { responsiveStyles: rs }), box('b', { responsiveStyles: rs }), box('c', { responsiveStyles: { medium: { margin: '0' } } })]) },
		'styles of a nested block': { content: page([box('a', { children: [box('b', { responsiveStyles: rs })] })]) }
	});

	it('ours: custom breakpoints move the media queries', () => {
		const c = check({ content: page([box('a', { responsiveStyles: rs })], {}, { meta: { breakpoints: { small: 500, medium: 1000 } } }) });
		expect(c.ours.css).toContain('@media (max-width:1000px){.builder-a{color:green;}}');
		expect(c.ours.css).toContain('@media (max-width:500px){.builder-a{color:blue;}}');
	});
});

describe('localized values', () => {
	each_case(it, {
		'text, locale given': { content: page([comp('a', 'Text', { text: L('Hi', { fr: 'Salut' }) })]), locale: 'fr' },
		'text, locale missing from the value': { content: page([comp('a', 'Text', { text: L('Hi', { fr: 'Salut' }) })]), locale: 'de' },
		'text, no locale': { content: page([comp('a', 'Text', { text: L('Hi', { fr: 'Salut' }) })]) },
		'no Default': { content: page([comp('a', 'Text', { text: { '@type': '@builder.io/core:LocalizedValue', fr: 'Salut' } })]), locale: 'de' },
		'a custom component option': { content: page([comp('a', 'Comp', { title: L('T', { fr: 'T-fr' }), nested: { deep: L('D', { fr: 'D-fr' }) } })]), locale: 'fr', customComponents: STUB },
		'in an array option': { content: page([comp('a', 'Comp', { items: [L('a', { fr: 'a-fr' }), L('b')] })]), locale: 'fr', customComponents: STUB },
		'a Button text and link': { content: page([comp('a', 'Core:Button', { text: L('Go', { fr: 'Aller' }), link: L('/en', { fr: '/fr' }) })]), locale: 'fr' },
		'an Image': { content: page([comp('a', 'Image', { image: L('https://cdn.builder.io/api/v1/image/en', { fr: 'https://cdn.builder.io/api/v1/image/fr' }) })]), locale: 'fr' },
		'in nested blocks in options': {
			content: page([comp('cols', 'Columns', { columns: [{ blocks: [comp('t', 'Text', { text: L('col', { fr: 'col-fr' }) })] }] })]),
			locale: 'fr'
		},
		'in a symbol': {
			content: page([comp('s', 'Symbol', { symbol: { model: 'symbol', content: { id: 'sc', data: { blocks: [comp('t', 'Text', { text: L('sym', { fr: 'sym-fr' }) })] } } } })]),
			locale: 'fr'
		},
		'a bound value next to a localized one': {
			content: page([comp('a', 'Text', { text: L('x', { fr: 'y' }) }, { bindings: { 'properties.data-l': 'state.locale' } })]),
			locale: 'fr'
		}
	});

	it('ours: the locale picks its value; a locale the value lacks gives nothing (no Default fallback, as official)', () => {
		const fr = check({ content: page([comp('a', 'Text', { text: L('Hi', { fr: 'Salut' }) })]), locale: 'fr' });
		expect(fr.ours.tree).toContain('"Salut"');
		const de = check({ content: page([comp('a', 'Text', { text: L('Hi', { fr: 'Salut' }) })]), locale: 'de' });
		expect(de.ours.tree).not.toContain('"Hi"');
		const none = check({ content: page([comp('a', 'Text', { text: L('Hi', { fr: 'Salut' }) })]) });
		expect(none.ours.tree).toContain('"Hi"');
	});

	// Regression (live): a symbol's blocks arrive resolved for the page's locale; the symbol's own
	// live plan (no locale) compiled them back from the unresolved originals, as Default.
	it("regression: live, a symbol's localized blocks keep the page's locale", () => {
		const content = page([comp('s', 'Symbol', { symbol: { model: 'symbol', content: { id: 'sc', data: { blocks: [comp('t', 'Text', { text: L('sym', { fr: 'sym-fr' }) }), comp('cols', 'Columns', { columns: [{ blocks: [comp('t2', 'Text', { text: L('col', { fr: 'col-fr' }) })] }] })] } } } })]);
		const c = check({ content, locale: 'fr' });
		for (const n of [c.ours, c.live]) {
			expect(n.tree).toContain('"sym-fr"');
			expect(n.tree).toContain('"col-fr"');
		}
	});
});
