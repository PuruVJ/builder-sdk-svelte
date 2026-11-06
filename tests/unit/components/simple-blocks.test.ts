// The small built-ins: Core:Section, Fragment, Text, Raw:Img, Custom Code, Embed, Builder:RawText.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, el, lines, page, setup, teardown, text } from './harness.js';

beforeAll(setup);
afterAll(teardown);

const one = (name: string, options: Record<string, unknown>, rest: Record<string, unknown> = {}, data: Record<string, unknown> = {}) =>
	page([comp('b', name, options, rest)], data);
const kids = [text('k1', '<p>one</p>'), text('k2', '<p>two</p>')];

describe('Core:Section', () => {
	each_case(it, {
		default: { content: one('Core:Section', {}) },
		'maxWidth 800': { content: one('Core:Section', { maxWidth: 800 }) },
		'maxWidth 0 (falls back to 1200)': { content: one('Core:Section', { maxWidth: 0 }) },
		lazyLoad: { content: one('Core:Section', { lazyLoad: true }) },
		'with children': { content: one('Core:Section', { maxWidth: 1000 }, { children: kids }) },
		'block attributes and styles': {
			content: one('Core:Section', {}, { properties: { class: 'hero', 'data-a': 'b' }, responsiveStyles: { large: { background: 'red' } } })
		}
	});

	it('ours: the max width lands in the inline style', () => {
		const c = check({ content: one('Core:Section', { maxWidth: 800 }) });
		expect(lines(c.ours, /<section/)[0]).toContain('max-width:800');
	});
});

describe('Fragment', () => {
	each_case(it, {
		empty: { content: one('Fragment', {}) },
		'with children': { content: one('Fragment', {}, { children: kids }) },
		'styled': { content: one('Fragment', {}, { children: kids, responsiveStyles: { large: { color: 'red' } } }) }
	});
});

describe('Text', () => {
	each_case(it, {
		html: { content: one('Text', { text: '<h1>Hi <em>there</em></h1>' }) },
		'plain string': { content: one('Text', { text: 'just text & more' }) },
		empty: { content: one('Text', { text: '' }) },
		missing: { content: one('Text', {}) },
		number: { content: one('Text', { text: 42 }) },
		'state template': { content: one('Text', { text: 'Hello {{state.name}}!' }, {}, { state: { name: 'Ada' } }) },
		'two templates and a missing value': {
			content: one('Text', { text: '{{state.a}} and {{state.b}} / {{state.nope}}' }, {}, { state: { a: 1, b: 'two' } })
		},
		'template on a nested path': { content: one('Text', { text: '<b>{{state.user.name}}</b>' }, {}, { state: { user: { name: 'Lin' } } }) },
		'template reading data prop': { content: one('Text', { text: 'v={{state.fromData}}' }), data: { fromData: 'D' } },
		'template, no state': { content: one('Text', { text: 'x {{state.missing}} y' }) },
		'bound text': { content: one('Text', {}, { bindings: { 'component.options.text': 'state.t' } }, { state: { t: '<i>bound</i>' } }) },
		'styled text': { content: one('Text', { text: 'a' }, { responsiveStyles: { large: { fontSize: '20px' }, small: { fontSize: '12px' } } }) },
		'children are ignored': { content: one('Text', { text: 'parent' }, { children: kids }) },
		'text in a custom tag': { content: one('Text', { text: 'x' }, { tagName: 'span' }) }
	});

	it('ours: {{state}} templates fill in', () => {
		const c = check({ content: one('Text', { text: 'Hello {{state.name}}!' }, {}, { state: { name: 'Ada' } }) });
		expect(c.ours.tree).toContain('"Hello Ada!"');
	});
});

describe('Raw:Img', () => {
	each_case(it, {
		image: { content: one('Raw:Img', { image: 'https://cdn.builder.io/api/v1/image/assets%2Fa%2Fb' }) },
		imgSrc: { content: one('Raw:Img', { imgSrc: '/local.png', image: '/ignored.png' }) },
		'alt and title': { content: one('Raw:Img', { image: '/a.png', altText: 'An A', title: 'T' }) },
		'fit and position': { content: one('Raw:Img', { image: '/a.png', backgroundSize: 'contain', backgroundPosition: 'top left' }) },
		aspectRatio: { content: one('Raw:Img', { image: '/a.png', aspectRatio: 0.5 }) },
		'no image': { content: one('Raw:Img', {}) },
		'block attributes': { content: one('Raw:Img', { image: '/a.png' }, { properties: { class: 'pic', 'data-q': '1' } }) }
	});
});

describe('Custom Code', () => {
	each_case(it, {
		html: { content: one('Custom Code', { code: '<div class="mine">hello</div>' }) },
		'with a script': { content: one('Custom Code', { code: '<p>x</p><script>window.__cc = 1</script>' }) },
		replaceNodes: { content: one('Custom Code', { code: '<b>r</b>', replaceNodes: true }) },
		empty: { content: one('Custom Code', { code: '' }) },
		'no code': { content: one('Custom Code', {}) }
	});

	it('ours: the script stays inert markup on the server', () => {
		const c = check({ content: one('Custom Code', { code: '<p>x</p><script>window.__cc = 1</script>' }) });
		expect(c.html.ours).toContain('<script>window.__cc = 1</script>');
		expect(lines(c.ours, /builder-custom-code/)).toHaveLength(1);
	});
});

describe('Embed', () => {
	each_case(it, {
		html: { content: one('Embed', { content: '<iframe src="https://example.com/e"></iframe>' }) },
		'with a script': { content: one('Embed', { content: '<div id="e"></div><script>1</script>' }) },
		empty: { content: one('Embed', { content: '' }) },
		'no content': { content: one('Embed', {}) },
		'url only (not rendered)': { content: one('Embed', { url: 'https://example.com' }) }
	});
});

describe('Builder:RawText (ours registers it; the official Svelte SDK does not)', () => {
	// The official Svelte SDK ships the block but does not register it (README "Known differences"),
	// so there is no official output to compare with: ours only, static vs live.
	each_case(
		it,
		{
			text: { content: one('Builder:RawText', { text: '<b>raw</b>' }) },
			'with a class': { content: one('Builder:RawText', { text: 'x' }, { properties: { class: 'c' } }) },
			empty: { content: one('Builder:RawText', {}) }
		},
		{ official: false }
	);

	it('ours: renders the html in a div', () => {
		const c = check({ content: one('Builder:RawText', { text: '<b>raw</b>' }) }, { official: false });
		expect(c.html.ours).toContain('<b>raw</b>');
	});

	it('an unregistered RawText renders the same in both (its wrapper and children)', () => {
		check({ content: page([el('r', { component: { name: 'Not RawText', options: { text: 'x' } }, children: kids })]) });
	});
});
