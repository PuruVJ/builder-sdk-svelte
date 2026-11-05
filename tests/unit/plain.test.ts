// internal/plain.ts: attrs_html = Svelte's own SSR spread, and behaviour-free subtrees as one string.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import Spread from './fixtures/Spread.svelte';
import { Content } from '../../src/lib/index.js';
import { PLAIN, PLAIN_RENDER, attrs_html, plain_html } from '../../src/lib/internal/plain.js';
import { Plan } from '../../src/lib/internal/compile.js';
import { registry_for } from '../../src/lib/internal/registry.js';
import type { BuilderBlock, RegisteredComponent } from '../../src/lib/types.js';

afterEach(() => {
	PLAIN.on = true;
	vi.restoreAllMocks();
});

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const COMMENT_RE = /<!--[^]*?-->/g;

/** The attribute string Svelte's server renders for `<div {...attrs}></div>`. */
function svelte_attrs(attrs: Record<string, unknown>): string {
	const body = render(Spread, { props: { attrs } }).body.replace(COMMENT_RE, '');
	expect(body.startsWith('<div') && body.endsWith('></div>')).toBe(true);
	return body.slice(4, -7);
}
/** An object with exactly these own keys (also `__proto__`), in order. */
function own(entries: Array<[string, unknown]>): Record<string, unknown> {
	const o: Record<string, unknown> = {};
	for (const [k, v] of entries) Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
	return o;
}

describe('attrs_html = svelte/server spread', () => {
	const fn = () => 1;
	const table: Array<Array<[string, unknown]>> = [
		[],
		[['title', 'plain']],
		[['title', 'a & b " c < d > e \' f']],
		[['title', '&amp; already']],
		[['title', '']],
		[['title', null], ['alt', undefined], ['x', 'kept']],
		[['title', 0], ['tabindex', -1], ['data-n', NaN], ['data-i', Infinity], ['data-f', 1.5], ['data-z', -0]],
		[['title', true], ['alt', false]],
		[['disabled', true], ['checked', false], ['readonly', ''], ['required', 0], ['open', 'yes'], ['muted', 'false']],
		[['DISABLED', true], ['Checked', 'x']],
		[['hidden', true]],
		[['hidden', false]],
		[['hidden', '']],
		[['hidden', 'until-found']],
		[['hidden', 'other']],
		[['Hidden', 'until-found']],
		[['translate', true]],
		[['translate', false]],
		[['translate', 'no']],
		[['Translate', true]],
		[['onclick', 'alert(1)'], ['onClick', 'x'], ['ONLOAD', 'x'], ['on', 'kept'], ['one', 'x']],
		[['handler', fn], ['title', 't']],
		[['$$slots', 'x'], ['$$props', 1], ['$x', 'kept'], ['$', 'kept']],
		[['', 'x'], ['a b', 'x'], ['a"b', 'x'], ["a'b", 'x'], ['a/b', 'x'], ['a=b', 'x'], ['a>b', 'x'], ['a\tb', 'x'], ['a\nb', 'x']],
		[['﷐x', 'x'], ['x\u{1FFFE}', 'x'], ['x￿', 'x'], ['a<b', 'kept']],
		[['Data-Upper', 'x'], ['ARIA-LABEL', 'y'], ['viewBox', 'z']],
		[['Title', 'a'], ['title', 'b']],
		[['é', 'x'], ['日本', 'y'], ['data-😀', '😀'], ['title', '\u0000￿\u{10FFFF}']],
		[['__proto__', 'p'], ['constructor', 'c'], ['toString', 't']],
		[['class', 'builder-block x'], ['style', 'color: red;'], ['builder-id', 'builder-1'], ['href', '/a?b=1&c="2"']],
		[['class', ''], ['style', '']],
		[['title', 'x'.repeat(10000) + '&']],
		[['title', [1, '&', null]], ['data-o', { toString: () => '<o>' }]],
		[['2', 'num'], ['1', 'first'], ['b', 'x']]
	];
	it.each(table.map((t, i) => [i, t] as const))('table %i', (_i, entries) => {
		expect(attrs_html(own(entries))).toBe(svelte_attrs(own(entries)));
	});

	it('symbol keys are ignored (both)', () => {
		const o = { title: 't', [Symbol('s')]: 'x' };
		expect(attrs_html(o)).toBe(svelte_attrs({ ...o }));
		expect(attrs_html(o)).toBe(' title="t"');
	});

	it('seeded sweep', () => {
		const r = mulberry32(99);
		const KEYS = [
			'title', 'href', 'alt', 'id', 'class', 'style', 'hidden', 'translate', 'disabled', 'checked', 'selected', 'autoplay',
			'Defer', 'INERT', 'onclick', 'onMouseEnter', 'on', 'once', 'data-x', 'Data-Y', 'aria-label', '$$x', '$y', '', ' ', 'a b',
			'a"', '=', '/', '>', 'é', 'Ä', 'ß', 'İ', '日本', '😀', '__proto__', 'constructor', 'hasOwnProperty', '0', '10', 'x'.repeat(300)
		];
		const CHARS = ['a', '&', '"', '<', '>', "'", ' ', '\n', '\t', 'é', '😀', '\u0000', '&amp;', '\\', '`', '=', '/'];
		const value = (key: string): unknown => {
			const roll = r();
			if (roll < 0.45) {
				let s = '';
				const n = Math.floor(r() * 12);
				for (let i = 0; i < n; i++) s += pick(r, CHARS);
				return s;
			}
			const v = pick(r, [null, undefined, true, false, 0, 1, -1, NaN, Infinity, 2.5, '', 'until-found', 'yes', () => 1]);
			if (key === 'class' && typeof v === 'object' && v !== null) return 'c'; // (ours only ever gets a string class)
			return v;
		};
		for (let i = 0; i < 400; i++) {
			const entries: Array<[string, unknown]> = [];
			const n = Math.floor(r() * 8);
			for (let k = 0; k < n; k++) {
				const key = pick(r, KEYS);
				entries.push([key, value(key)]);
			}
			const want = svelte_attrs(own(entries));
			expect(attrs_html(own(entries)), JSON.stringify(entries)).toBe(want);
		}
	});

	it('many distinct keys (past the name cache bound) stay correct', () => {
		const entries: Array<[string, unknown]> = [];
		for (let i = 0; i < 5000; i++) entries.push(['data-k' + i, i % 3 ? 'v' + i : '&']);
		expect(attrs_html(own(entries))).toBe(svelte_attrs(own(entries)));
		expect(attrs_html({ 'data-k4999': 'again' })).toBe(' data-k4999="again"');
	});
});

// ── plain_html ───────────────────────────────────────────────────────────────────────────────────
const EL = '@builder.io/sdk:Element' as const;
function plan_with(blocks: BuilderBlock[], custom?: RegisteredComponent[], live = false) {
	const plan = new Plan({ registry: registry_for(custom), model: 'page', locale: undefined, breakpoints: undefined, live });
	plan.prepare(blocks);
	return plan;
}
const html_of = (plan: Plan, b: BuilderBlock) => plain_html(plan, plan.compile(b));

describe('plain_html kinds', () => {
	it('WRAP: a block with children, each child after one space', () => {
		const b: BuilderBlock = {
			'@type': EL,
			id: 'builder-w',
			properties: { title: 'a&b' },
			children: [
				{ '@type': EL, id: 'builder-c1' },
				{ '@type': EL, id: 'builder-c2', tagName: 'span', responsiveStyles: { large: { color: 'red' } } }
			]
		};
		const plan = plan_with([b]);
		expect(html_of(plan, b)).toBe(
			'<div title="a&amp;b" builder-id="builder-w" style="" class="builder-w builder-block">' +
				' <div builder-id="builder-c1" style="" class="builder-c1 builder-block"></div>' +
				' <span builder-id="builder-c2" style="" class="builder-c2 builder-block"></span></div>'
		);
	});

	it('LEAF: a Text block (PLAIN_RENDER), children not rendered', () => {
		const b: BuilderBlock = {
			'@type': EL,
			id: 'builder-t',
			component: { name: 'Text', options: { text: '<p>hi</p>' } },
			children: [{ '@type': EL, id: 'builder-ignored', bindings: { x: 'y' } }]
		};
		const plan = plan_with([b]);
		expect(html_of(plan, b)).toBe(
			'<div builder-id="builder-t" style="" class="builder-t builder-block"><div style="outline:none;" class="builder-text"><p>hi</p></div></div>'
		);
	});

	it('LEAF: a Text with no text renders an empty text div', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-te', component: { name: 'Text' } };
		expect(html_of(plan_with([b]), b)).toContain('<div style="outline:none;" class="builder-text"></div>');
	});

	it('VOID: an empty tag, no closing tag (with or without a plain component)', () => {
		const img: BuilderBlock = { '@type': EL, id: 'builder-v', tagName: 'img', properties: { src: '/a.png' } };
		const hr: BuilderBlock = { '@type': EL, id: 'builder-hr', tagName: 'hr', component: { name: 'Text', options: { text: 'x' } } };
		const plan = plan_with([img, hr]);
		expect(html_of(plan, img)).toBe('<img src="/a.png" builder-id="builder-v" style="" class="builder-v builder-block">');
		expect(html_of(plan, hr)).toBe('<hr builder-id="builder-hr" style="" class="builder-hr builder-block">');
	});

	it('EMPTY: hidden blocks and noWrap entries without a component', () => {
		const hidden: BuilderBlock = { '@type': EL, id: 'builder-h', hide: true, children: [{ '@type': EL, id: 'x' }] };
		const not_shown: BuilderBlock = { '@type': EL, id: 'builder-ns', show: false };
		const nowrap: BuilderBlock = { '@type': EL, id: 'builder-nw', component: { name: 'NoWrapNoComp' } };
		const plan = plan_with([hidden, not_shown, nowrap], [{ name: 'NoWrapNoComp', component: undefined, noWrap: true }]);
		expect(html_of(plan, hidden)).toBe('');
		expect(html_of(plan, not_shown)).toBe('');
		expect(html_of(plan, nowrap)).toBe('');
	});

	it('WRAP: an entry registered without a component wraps its children', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-nc', component: { name: 'NoComp' }, children: [{ '@type': EL, id: 'builder-k' }] };
		const plan = plan_with([b], [{ name: 'NoComp', component: undefined }]);
		expect(html_of(plan, b)).toContain('<div builder-id="builder-k"');
	});

	it('an unregistered component name renders as a wrapper too', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const b: BuilderBlock = { '@type': EL, id: 'builder-unreg', component: { name: 'NotRegistered-plain' } };
		expect(html_of(plan_with([b]), b)).toBe('<div builder-id="builder-unreg" style="" class="builder-unreg builder-block"></div>');
	});

	it('NONE: behaviour of every kind', () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const custom: RegisteredComponent[] = [
			{ name: 'Live', component: () => null },
			{ name: 'LiveNoWrap', component: () => null, noWrap: true }
		];
		const none: BuilderBlock[] = [
			{ '@type': EL, id: 'n1', bindings: { 'properties.title': 'state.x' } },
			{ '@type': EL, id: 'n2', repeat: { collection: 'state.list' } },
			{ '@type': EL, id: 'n3', actions: { click: 'x' } },
			{ '@type': EL, id: 'n4', component: { name: 'Text', options: { text: '{{state.x}}' } } },
			{ '@type': EL, id: 'n5', animations: [{ trigger: 'scrollInView' }] },
			{ '@type': EL, id: 'n6', component: { name: 'Live' } },
			{ '@type': EL, id: 'n7', component: { name: 'LiveNoWrap' } },
			{ '@type': EL, id: 'n8', component: { name: 'Core:Button', options: { text: 'b' } } },
			{ '@type': EL, id: 'n8b', component: { name: 'Columns' } },
			{ '@type': EL, id: 'n9', tagName: 'svg' },
			{ '@type': EL, id: 'n10', tagName: 'textarea' },
			{ '@type': EL, id: 'n11', tagName: 'input' },
			{ '@type': EL, id: 'n12', tagName: 'my:tag' },
			{ '@type': EL, id: 'n13', tagName: 'Weird_Tag' },
			{ '@type': EL, id: 'n14', tagName: 'DIV2' },
			{ '@type': EL, id: 'n15', children: [{ '@type': EL, id: 'n15c', actions: { click: 'x' } }] }
		];
		const plan = plan_with(none, custom);
		for (const b of none) expect(html_of(plan, b), b.id).toBeNull();
		// css not in the sheet: a block compiled outside prepare
		const stray: BuilderBlock = { '@type': EL, id: 'stray', responsiveStyles: { large: { color: 'red' } } };
		expect(html_of(plan, stray)).toBeNull();
		err.mockRestore();
	});

	it('custom-element tags (dashes) are plain', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-ce', tagName: 'my-el-2' };
		expect(html_of(plan_with([b]), b)).toBe('<my-el-2 builder-id="builder-ce" style="" class="builder-ce builder-block"></my-el-2>');
	});

	it('an app Text replaces the plain built-in (no PLAIN_RENDER): NONE', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-at', component: { name: 'Text', options: { text: 'x' } } };
		expect(html_of(plan_with([b], [{ name: 'Text', component: () => null }]), b)).toBeNull();
	});

	it('a custom PLAIN_RENDER entry is used as is', () => {
		const entry = { name: 'Pure', component: () => null, [PLAIN_RENDER]: () => '<b>pure</b>' } as unknown as RegisteredComponent;
		const b: BuilderBlock = { '@type': EL, id: 'builder-pu', component: { name: 'Pure' } };
		expect(html_of(plan_with([b], [entry]), b)).toBe('<div builder-id="builder-pu" style="" class="builder-pu builder-block"><b>pure</b></div>');
	});
});

describe('plain_html: links', () => {
	it('links propagate up through plain parents only', () => {
		const leaf: BuilderBlock = { '@type': EL, id: 'builder-l', href: '/x' };
		const mid: BuilderBlock = { '@type': EL, id: 'builder-m', children: [leaf] };
		const top: BuilderBlock = { '@type': EL, id: 'builder-top', children: [mid, { '@type': EL, id: 'builder-sib' }] };
		const plain_sib: BuilderBlock = { '@type': EL, id: 'builder-ps' };
		const plan = plan_with([top, plain_sib]);
		expect(html_of(plan, top)).toContain('<a href="/x" builder-id="builder-l"');
		expect(plan.compile(top).links).toBe(true);
		expect(plan.compile(mid).links).toBe(true);
		expect(plan.compile(leaf).links).toBe(true);
		html_of(plan, plain_sib);
		expect(plan.compile(plain_sib).links).toBe(false);
	});

	it('a link via properties.href or tagName a', () => {
		const p: BuilderBlock = { '@type': EL, id: 'builder-ph', properties: { href: '/p' } };
		const a: BuilderBlock = { '@type': EL, id: 'builder-ta', tagName: 'a' };
		const plan = plan_with([p, a]);
		expect(html_of(plan, p)!.startsWith('<a href="/p"')).toBe(true);
		expect(html_of(plan, a)!.startsWith('<a builder-id')).toBe(true);
		expect(plan.compile(p).links && plan.compile(a).links).toBe(true);
	});
});

describe('plain_html: off, live, caching, depth', () => {
	it('PLAIN.on = false: null', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-off' };
		const plan = plan_with([b]);
		PLAIN.on = false;
		expect(html_of(plan, b)).toBeNull();
		expect(plan.compile(b).html).toBeUndefined();
		PLAIN.on = true;
		expect(html_of(plan, b)).not.toBeNull();
	});

	it('a live plan: null', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-live' };
		expect(html_of(plan_with([b], undefined, true), b)).toBeNull();
	});

	it('cached on the compiled record (subtrees too); a cached null is returned as is', () => {
		const child: BuilderBlock = { '@type': EL, id: 'builder-cc' };
		const b: BuilderBlock = { '@type': EL, id: 'builder-cp', children: [child] };
		const live: BuilderBlock = { '@type': EL, id: 'builder-cl', actions: { click: 'x' } };
		const plan = plan_with([b, live]);
		const first = html_of(plan, b);
		expect(plan.compile(b).html).toBe(first);
		expect(plan.compile(child).html).toBe('<div builder-id="builder-cc" style="" class="builder-cc builder-block"></div>');
		// the cache is what is served
		plan.compile(b).html = 'cached';
		expect(html_of(plan, b)).toBe('cached');
		expect(html_of(plan, live)).toBeNull();
		expect(plan.compile(live).html).toBeNull();
		expect(html_of(plan, live)).toBeNull();
	});

	it('a parent over an already-computed live child is null; a later sibling root reuses cached children', () => {
		const live: BuilderBlock = { '@type': EL, id: 'builder-lc', bindings: { a: 'b' } };
		const p1: BuilderBlock = { '@type': EL, id: 'builder-p1', children: [live] };
		const plan = plan_with([p1]);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(html_of(plan, live)).toBeNull();
		expect(html_of(plan, p1)).toBeNull();
	});

	it('10 000 levels deep: no stack overflow', () => {
		let b: BuilderBlock = { '@type': EL, id: 'builder-d0' };
		for (let i = 1; i < 10000; i++) b = { '@type': EL, id: 'builder-d' + i, children: [b] };
		const plan = plan_with([b]);
		const html = html_of(plan, b)!;
		expect(html.split('<div ').length - 1).toBe(10000);
		expect(html.endsWith('</div>'.repeat(10000))).toBe(true);
	});

	it('a 10 000-deep chain with a live leaf: null all the way up', () => {
		let b: BuilderBlock = { '@type': EL, id: 'builder-e0', actions: { click: 'x' } };
		for (let i = 1; i < 10000; i++) b = { '@type': EL, id: 'builder-e' + i, children: [b] };
		const plan = plan_with([b]);
		expect(html_of(plan, b)).toBeNull();
	});
});

describe('plain string = the same blocks through Svelte (Content, PLAIN on vs off)', () => {
	const contents: BuilderBlock[][] = [
		[
			{
				'@type': EL,
				id: 'builder-a',
				properties: { title: '"q" & <x>', 'data-n': '1', hidden: 'until-found', translate: 'no' },
				style: { color: 'red' },
				responsiveStyles: { large: { margin: '1px' }, small: { margin: '2px' } },
				children: [
					{ '@type': EL, id: 'builder-b', component: { name: 'Text', options: { text: '<p>t &amp; ü</p>' } } },
					{ '@type': EL, id: 'builder-c', tagName: 'img', properties: { src: '/x.png' } },
					{ '@type': EL, id: 'builder-d', hide: true },
					{ '@type': EL, id: 'builder-e', href: '/link', children: [{ '@type': EL, id: 'builder-f', tagName: 'span' }] },
					{ '@type': EL, id: 'builder-g', tagName: 'section', class: 'extra', properties: { class: 'more' } }
				]
			}
		]
	];
	it.each(contents.map((c, i) => [i, c] as const))('content %i', (_i, blocks) => {
		const props = { model: 'page', apiKey: 'k', canTrack: false };
		PLAIN.on = true;
		const on = render(Content, { props: { ...props, content: { id: 'pp', data: { blocks: structuredClone(blocks) } } } }).body.replace(COMMENT_RE, '');
		PLAIN.on = false;
		const off = render(Content, { props: { ...props, content: { id: 'pp', data: { blocks: structuredClone(blocks) } } } }).body.replace(COMMENT_RE, '');
		expect(on).toBe(off);
		expect(on).toContain('builder-text');
	});
});
