// <Content> props (official ContentVariants → Content → EnableEditor): content, model, data,
// context, apiKey, canTrack, locale, nonce, the content and blocks wrappers, linkComponent,
// isNestedRender, customComponents and their flags, A/B variations, and what content.data carries
// (cssCode, customFonts, jsCode, httpRequests, state, inputs).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, el, lines, live_html, official_html, ours_html, page, setup, teardown, text, type Props } from './harness.js';
import { normalize } from '../../normalize.js';

let net: { fetches: string[] };
beforeAll(() => {
	net = setup();
});
afterAll(teardown);

const styled = (id: string, html = id) => text(id, `<p>${html}</p>`, { responsiveStyles: { large: { color: 'red' }, small: { color: 'blue' } } });
const basic = () => page([styled('a'), styled('b')]);

describe('content', () => {
	each_case(it, {
		'a content': { content: basic() },
		'no blocks': { content: { id: 'c', data: {} } },
		'empty blocks': { content: page([]) },
		'no data': { content: { id: 'c' } },
		'no id': { content: { data: { blocks: [styled('a')] } } },
		'blocks from the data prop (content has none)': { content: { id: 'c', data: {} }, data: { blocks: [styled('fromdata')] } },
		"the content's own blocks win over data.blocks": { content: basic(), data: { blocks: [styled('fromdata')] } }
	});

	// No content: nothing at all on the server. Live (inside the editor) the wrapper is there,
	// hidden, for the editor to fill (official `needsElementRefDivForEditing`).
	for (const [label, content] of [
		['null', null],
		['undefined', undefined]
	] as const) {
		it(`content ${label}`, () => {
			const c = check({ content }, { live: false });
			expect(c.ours.tree).toBe('');
			const live = normalize(live_html({ content }));
			expect(lines(live, /builder-model="page"/)[0]).toContain('style="display: none"');
		});
	}
});

describe('model', () => {
	each_case(it, {
		page: { content: basic(), model: 'page' },
		symbol: { content: basic(), model: 'symbol' },
		'a custom model': { content: basic(), model: 'blog-article' },
		empty: { content: basic(), model: '' },
		'component limited to another model (not rendered)': {
			content: page([comp('x', 'Only Here', { a: 1 })]),
			model: 'page',
			customComponents: [{ name: 'Only Here', models: ['symbol'] }]
		},
		'component limited to this model': {
			content: page([comp('x', 'Only Here', { a: 1 })]),
			model: 'page',
			customComponents: [{ name: 'Only Here', models: ['page'] }]
		},
		'component with an empty models list': {
			content: page([comp('x', 'Only Here', { a: 1 })]),
			customComponents: [{ name: 'Only Here', models: [] }]
		}
	});
});

describe('data and state', () => {
	each_case(it, {
		'data reaches state': { content: page([text('t', '{{state.who}}')]), data: { who: 'data' } },
		'data wins over content state': { content: page([text('t', '{{state.who}}')], { state: { who: 'state' } }), data: { who: 'data' } },
		'content state': { content: page([text('t', '{{state.a}}/{{state.b.c}}')], { state: { a: 1, b: { c: 'deep' } } }) },
		'inputs defaults': {
			content: page([text('t', '{{state.title}}|{{state.count}}')], { inputs: [{ name: 'title', defaultValue: 'T0' }, { name: 'count', defaultValue: 3 }, { name: 'none' }] })
		},
		'state wins over inputs defaults': {
			content: page([text('t', '{{state.title}}')], { inputs: [{ name: 'title', defaultValue: 'T0' }], state: { title: 'S' } })
		},
		'data wins over inputs defaults': { content: page([text('t', '{{state.title}}')], { inputs: [{ name: 'title', defaultValue: 'T0' }] }), data: { title: 'D' } },
		'jsCode writes state': { content: page([text('t', '{{state.fromJs}}')], { jsCode: 'state.fromJs = "js!"' }) },
		'jsCode reads data': { content: page([text('t', '{{state.out}}')], { jsCode: 'state.out = state.input + "!"' }), data: { input: 'in' } },
		'jsCode sees isServer': { content: page([text('t', '{{state.where}}')], { jsCode: 'state.where = Builder.isServer ? "server" : "browser"' }) },
		'jsCode that throws': { content: page([text('t', 'still here')], { jsCode: 'throw new Error("boom")' }) },
		'jsCode in the data prop': { content: page([text('t', '{{state.j}}')]), data: { jsCode: 'state.j = "from data"' } },
		'a binding reading context': {
			content: page([text('t', 'x', { bindings: { 'component.options.text': 'context.who' } })]),
			context: { who: 'from context' }
		},
		'a binding reading state from data': { content: page([text('t', 'x', { bindings: { 'component.options.text': 'state.d' } })]), data: { d: 'bound' } }
	});

	it('ours: state, inputs, data and jsCode reach the page', () => {
		const a = check({ content: page([text('t', '{{state.title}}|{{state.count}}')], { inputs: [{ name: 'title', defaultValue: 'T0' }, { name: 'count', defaultValue: 3 }] }) });
		expect(a.ours.tree).toContain('"T0|3"');
		const b = check({ content: page([text('t', '{{state.fromJs}}')], { jsCode: 'state.fromJs = "js!"' }) });
		expect(b.ours.tree).toContain('"js!"');
	});

	it('ours: httpRequests make no request during SSR', async () => {
		net.fetches.length = 0;
		const p: Props = {
			content: page([text('t', 'x', { bindings: { 'component.options.text': 'state.api?.title ?? "none"' } })], {
				httpRequests: { api: 'https://example.com/api?q={{state.q}}', core: { '@type': '@builder.io/core:Request', request: { url: 'https://example.com/core', method: 'POST' } } },
				state: { q: 'z' }
			})
		};
		// (the official SDK runs these during SSR too and drops the results)
		check(p);
		await new Promise((r) => setTimeout(r, 20));
		net.fetches.length = 0;
		const html = ours_html(p);
		live_html(p);
		await new Promise((r) => setTimeout(r, 20));
		expect(net.fetches).toEqual([]);
		expect(normalize(html).tree).toContain('"none"');
	});
});

describe('apiKey, canTrack, locale', () => {
	each_case(it, {
		'no apiKey': { content: basic(), apiKey: undefined },
		'empty apiKey': { content: basic(), apiKey: '' },
		'canTrack true': { content: basic(), canTrack: true },
		'canTrack false': { content: basic(), canTrack: false },
		'canTrack unset': { content: basic(), canTrack: undefined },
		locale: { content: page([text('t', '{{state.locale}}')]), locale: 'fr-FR' },
		'locale over data.locale': { content: page([text('t', '{{state.locale}}')]), locale: 'fr', data: { locale: 'de' } },
		'localized text, locale given': {
			content: page([comp('t', 'Text', { text: { '@type': '@builder.io/core:LocalizedValue', Default: 'Hello', fr: 'Bonjour' } })]),
			locale: 'fr'
		},
		'localized text, another locale (Default)': {
			content: page([comp('t', 'Text', { text: { '@type': '@builder.io/core:LocalizedValue', Default: 'Hello', fr: 'Bonjour' } })]),
			locale: 'es'
		},
		'localized text, no locale': {
			content: page([comp('t', 'Text', { text: { '@type': '@builder.io/core:LocalizedValue', Default: 'Hello', fr: 'Bonjour' } })])
		}
	});
});

describe('nonce', () => {
	const everything = () =>
		page(
			[
				styled('a'),
				comp('cols', 'Columns', { columns: [{ blocks: [styled('c1')] }, { blocks: [styled('c2')] }] }),
				comp('pc', 'PersonalizationContainer', { variants: [{ blocks: [styled('v')], query: [] }] }, { children: [styled('d')] }),
				comp('sym', 'Symbol', { symbol: { model: 'symbol', content: { id: 's', data: { blocks: [styled('s1')], cssCode: '.s{color:red}' } } } }),
				text('anim', 'x', { animations: [{ trigger: 'hover', steps: [{ styles: { opacity: '1' } }, { styles: { opacity: '0.5' } }] }] })
			],
			{ cssCode: '.page { color: blue; }', customFonts: [{ family: 'Inter', fileUrl: 'https://fonts.example/inter.woff2' }] },
			{ variations: { v1: { id: 'v1', testRatio: 0.5, data: { blocks: [styled('a', 'variant a')] } } } }
		);
	each_case(it, {
		'a nonce, tracking on': { content: everything(), nonce: 'n-123', canTrack: true },
		'a nonce, tracking off': { content: everything(), nonce: 'n-123' },
		'no nonce': { content: everything(), canTrack: true }
	}, (label) => (label.includes('tracking on') || label === 'no nonce' ? { live: false } : {}));

	it('ours: every style and script tag carries the nonce', () => {
		const html = ours_html({ content: everything(), nonce: 'n-123', canTrack: true });
		const tags = [...html.matchAll(/<(style|script)\b[^>]*>/g)].map((m) => m[0]);
		expect(tags.length).toBeGreaterThan(8);
		for (const tag of tags) expect(tag, tag).toMatch(/nonce="?n-123"?/);
		const live = live_html({ content: everything(), nonce: 'n-123' });
		for (const m of live.matchAll(/<(style|script)\b[^>]*>/g)) expect(m[0], m[0]).toMatch(/nonce="?n-123"?/);
	});
});

describe('wrappers', () => {
	const kids = () => page([el('box', { children: [styled('a')] }), comp('cols', 'Columns', { columns: [{ blocks: [styled('c')] }] })]);
	each_case(it, {
		'contentWrapper div': { content: kids(), contentWrapper: 'div' },
		'contentWrapper section': { content: kids(), contentWrapper: 'section' },
		'contentWrapper main': { content: kids(), contentWrapper: 'main' },
		contentWrapperProps: { content: kids(), contentWrapperProps: { 'data-wrap': 'yes', class: 'outer', id: 'root' } },
		'contentWrapper and props': { content: kids(), contentWrapper: 'article', contentWrapperProps: { 'aria-label': 'content' } },
		'blocksWrapper section': { content: kids(), blocksWrapper: 'section' },
		'blocksWrapper ul': { content: kids(), blocksWrapper: 'ul' },
		blocksWrapperProps: { content: kids(), blocksWrapperProps: { 'data-blocks': '1', class: 'extra' } },
		'blocksWrapper and props': { content: kids(), blocksWrapper: 'span', blocksWrapperProps: { role: 'list' } }
	});

	it('ours: the wrappers are what was asked', () => {
		const c = check({ content: kids(), contentWrapper: 'main', contentWrapperProps: { id: 'root' }, blocksWrapper: 'section', blocksWrapperProps: { 'data-b': '1' } });
		expect(lines(c.ours, /builder-content-id/)[0]).toMatch(/^<main .*id="root"/);
		const lists = lines(c.ours, /builder-blocks/);
		expect(lists.length).toBeGreaterThan(1);
		for (const l of lists) expect(l).toMatch(/^<section .*data-b="1"/);
	});
});

describe('linkComponent', () => {
	each_case(it, {
		'links through it': {
			content: page([text('a', 'x', { href: '/a' }), el('b', { tagName: 'a', properties: { href: '/b' }, children: [text('bt', 'b')] }), comp('btn', 'Core:Button', { text: 'go', link: '/c' })]),
			link: true
		},
		'no links': { content: basic(), link: true },
		'links, no linkComponent': { content: page([text('a', 'x', { href: '/a' })]) }
	});
});

describe('isNestedRender', () => {
	each_case(it, {
		'nested: no default styles, no helper scripts': { content: basic(), isNestedRender: true },
		'nested with cssCode': { content: page([styled('a')], { cssCode: '.x{color:red}' }), isNestedRender: true },
		'top level': { content: basic(), isNestedRender: false }
	});
});

describe('content.data: cssCode and customFonts', () => {
	each_case(it, {
		cssCode: { content: page([styled('a')], { cssCode: '.mine { color: red; }' }) },
		'cssCode with &': { content: page([styled('a')], { cssCode: '& .mine { color: red; } &:hover{opacity:1}' }) },
		'cssCode, no content id': { content: { data: { blocks: [styled('a')], cssCode: '& .x { color: red; }' } } },
		'cssCode with a media query': { content: page([styled('a')], { cssCode: '@media (max-width: 600px) { .m { display: none; } }' }) },
		'customFonts: fileUrl': { content: page([styled('a')], { customFonts: [{ family: 'Inter', kind: 'sans-serif', fileUrl: 'https://f.test/inter.woff2' }] }) },
		'customFonts: files with weights': {
			content: page([styled('a')], { customFonts: [{ family: 'Roboto', files: { regular: 'https://f.test/r.woff2', '700': 'https://f.test/b.woff2', italic: 'https://f.test/i.woff2' } }] })
		},
		'customFonts: a kind with #': { content: page([styled('a')], { customFonts: [{ family: 'Odd', kind: '#x', fileUrl: 'https://f.test/o.woff2' }] }) },
		'customFonts: no url': { content: page([styled('a')], { customFonts: [{ family: 'Nothing' }] }) },
		'cssCode and fonts from the data prop (content has none)': {
			content: page([styled('a')]),
			data: { cssCode: '.fromdata{color:red}', customFonts: [{ family: 'D', fileUrl: 'https://f.test/d.woff2' }] }
		}
	});

	it('ours: & is scoped to the content', () => {
		const c = check({ content: page([styled('a')], { cssCode: '& .mine { color: red; }' }) });
		expect(c.ours.css.some((r) => r.includes('div[builder-content-id="content-1"] .mine'))).toBe(true);
	});
});

describe('A/B variations', () => {
	const ab = (extra: Record<string, unknown> = {}) =>
		page([styled('a', 'default a'), styled('b')], {}, {
			variations: {
				'var-1': { id: 'var-1', name: 'One', testRatio: 0.3, data: { blocks: [styled('a', 'variant 1 a'), styled('x1')] } },
				'var-2': { id: 'var-2', name: 'Two', testRatio: 0.3, data: { blocks: [styled('a', 'variant 2 a')] } }
			},
			...extra
		});
	// Live never renders variations (the editor shows the content it edits): static only.
	each_case(
		it,
		{
			'tracking on: every variation hidden during SSR, with the scripts': { content: ab(), canTrack: true },
			'tracking off: the default content only': { content: ab(), canTrack: false },
			'tracking on, a nonce': { content: ab(), canTrack: true, nonce: 'abc' },
			'tracking on, nested render': { content: ab(), canTrack: true, isNestedRender: true },
			'one variation': { content: page([styled('a')], {}, { variations: { v: { id: 'v', testRatio: 0.5, data: { blocks: [styled('v')] } } } }), canTrack: true },
			'empty variations': { content: page([styled('a')], {}, { variations: {} }), canTrack: true },
			'a variation with a custom component': {
				content: page([comp('s', 'My Stub', { v: 0 })], {}, { variations: { v: { id: 'v', testRatio: 0.5, data: { blocks: [comp('s', 'My Stub', { v: 1 })] } } } }),
				canTrack: true,
				customComponents: [{ name: 'My Stub' }]
			}
		},
		(label) => ({ live: label.startsWith('tracking off') })
	);

	it('ours: SSR renders the hidden variants, their styles and the cookie script', () => {
		const html = ours_html({ content: ab(), canTrack: true });
		const c = normalize(html);
		expect(lines(c, /builder-content-id/)).toHaveLength(3);
		expect(lines(c, /hidden=""/)).toHaveLength(2);
		expect(c.css.some((r) => r.includes('.variant-var-1{display:none;}'))).toBe(true);
		expect(html).toContain('data-id=builderio-variants-visibility');
		expect(html).toContain('data-id=builderio-init-variants-fns');
	});

	it('ours: tracking off renders only the default, no scripts', () => {
		const html = ours_html({ content: ab(), canTrack: false });
		expect(html).not.toContain('builderio-variants');
		expect(normalize(html).tree).not.toContain('variant 1 a');
		expect(normalize(official_html({ content: ab(), canTrack: false })).tree).toBe(normalize(html).tree);
	});
});
