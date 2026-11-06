// blocks/helpers.ts vs the official filterAttrs (node_modules/@builder.io/sdk-svelte/src/blocks/helpers.ts).
//
// Official usage in every block: `{...filterAttrs(attributes, 'on:', false)}` + `use:setAttrs={filterAttrs(attributes, 'on:', true)}`.
// The official non-event call does NOT drop `on:` keys (it spreads them as plain attributes); ours
// does on purpose, because Svelte 5 attaches the handlers from the spread as `on<event>` props instead.
import { describe, expect, it } from 'vitest';
import { all_attrs, event_attrs, plain_attrs } from '../../src/lib/blocks/helpers';
import { filterAttrs } from '../../node_modules/@builder.io/sdk-svelte/src/blocks/helpers';

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** What ours should give, derived from the official function. */
function official_plain(attrs: Record<string, unknown> | undefined) {
	const out = filterAttrs(attrs, 'on:', false);
	for (const k in out) if (k.startsWith('on:')) delete out[k];
	return out;
}
function official_events(attrs: Record<string, unknown> | undefined) {
	const out: Record<string, unknown> = {};
	const ev = filterAttrs(attrs, 'on:', true);
	for (const k in ev) out['on' + k] = ev[k];
	return out;
}

/** all_attrs is one pass in key order: on a clash (`onclick` and `on:click` both set) the later key wins. */
function expected_all(attrs: Record<string, unknown> | undefined) {
	const out: Record<string, unknown> = {};
	const plain = official_plain(attrs);
	const ev = official_events(attrs);
	for (const k in attrs) {
		if (k.startsWith('on:')) {
			if (Object.hasOwn(ev, 'on' + k.slice(3))) out['on' + k.slice(3)] = ev['on' + k.slice(3)];
		} else if (Object.hasOwn(plain, k)) out[k] = plain[k];
	}
	return out;
}

const fn = () => {};
const fn2 = () => {};

const TABLE: Array<Record<string, unknown> | undefined> = [
	undefined,
	{},
	{ class: 'a', id: 'b' },
	{ class: '', id: 0, title: null, alt: undefined, hidden: false, nan: NaN, ok: 'x' },
	{ 'on:click': fn, 'on:mouseover': fn2, class: 'c' },
	{ 'on:click': undefined, 'on:': fn, 'on:on:x': fn2 },
	{ onclick: fn, 'data-on:x': 'y', 'ON:click': fn },
	{ 'aria-hidden': true, tabindex: -1, style: { a: 1 }, list: [] },
	{ 'on:click': 0, 'on:keyup': '', 'on:blur': 'handler' },
	{ é: 'ü', '日本': '語', '': 'empty-key' }
];

describe('plain_attrs / event_attrs / all_attrs vs official filterAttrs', () => {
	it('table', () => {
		for (const attrs of TABLE) {
			expect(plain_attrs(attrs)).toEqual(official_plain(attrs));
			expect(event_attrs(attrs)).toEqual(official_events(attrs));
			expect(all_attrs(attrs)).toEqual(expected_all(attrs));
		}
	});

	it('seeded sweep', () => {
		const rand = mulberry32(1234);
		const keys = ['class', 'id', 'on:click', 'on:input', 'on:', 'onclick', 'data-x', 'on:on:z', '__x', 'constructor', 'toString'];
		const values = [fn, fn2, '', 'v', 0, 1, NaN, Infinity, null, undefined, false, true, {}, []];
		for (let n = 0; n < 400; n++) {
			const attrs: Record<string, unknown> = {};
			const count = Math.floor(rand() * 6);
			for (let i = 0; i < count; i++) attrs[keys[Math.floor(rand() * keys.length)]] = values[Math.floor(rand() * values.length)];
			expect(plain_attrs(attrs)).toEqual(official_plain(attrs));
			expect(event_attrs(attrs)).toEqual(official_events(attrs));
			expect(all_attrs(attrs)).toEqual(expected_all(attrs));
		}
	});

	it('official non-event filter keeps on: keys; ours drops them (Svelte 5 spread handlers)', () => {
		const attrs = { 'on:click': fn, class: 'x' };
		expect(filterAttrs(attrs, 'on:', false)).toEqual({ 'on:click': fn, class: 'x' });
		expect(plain_attrs(attrs)).toEqual({ class: 'x' });
		expect(all_attrs(attrs)).toEqual({ class: 'x', onclick: fn });
	});

	it('clash between onclick and on:click: later key wins', () => {
		expect(all_attrs({ onclick: 'a', 'on:click': fn })).toEqual({ onclick: fn });
		expect(all_attrs({ 'on:click': fn, onclick: 'a' })).toEqual({ onclick: 'a' });
	});

	it('returns fresh objects and never mutates the input', () => {
		const attrs = Object.freeze({ class: 'a', 'on:click': fn });
		const a = plain_attrs(attrs);
		const b = plain_attrs(attrs);
		expect(a).not.toBe(b);
		expect(a).not.toBe(attrs);
		expect(event_attrs(undefined)).toEqual({});
		expect(all_attrs(undefined)).toEqual({});
		expect(plain_attrs(undefined)).toEqual({});
	});

	it('inherited enumerable keys are included, as in the official for..in', () => {
		const proto = { class: 'inherited', 'on:click': fn };
		const attrs = Object.create(proto);
		attrs.id = 'own';
		expect(plain_attrs(attrs)).toEqual(official_plain(attrs));
		expect(event_attrs(attrs)).toEqual(official_events(attrs));
		expect(all_attrs(attrs)).toEqual({ class: 'inherited', id: 'own', onclick: fn });
	});

	it('__proto__ own key is handled like the official (no global pollution)', () => {
		const attrs = JSON.parse('{"__proto__": {"polluted": "yes"}, "class": "a"}');
		const ours = plain_attrs(attrs);
		const theirs = official_plain(attrs);
		expect(Object.getPrototypeOf(ours)).toEqual(Object.getPrototypeOf(theirs));
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		expect(all_attrs(attrs).class).toBe('a');
	});
});
