// localized.ts vs the official functions/extract-localized-values.ts as functions/get-processed-block.ts
// applies it: `resolveLocalizedValues(block, rootState.locale)` replaces every LocalizedValue in
// `block.component.options` IN PLACE (nested blocks included). Ours must give the same options as the
// official gives on a deep clone of the block, without touching the input.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLocalizedValues } from '../../node_modules/@builder.io/sdk-svelte/src/functions/extract-localized-values';
import { traverse } from '../../node_modules/@builder.io/sdk-svelte/src/functions/traverse';
import { mark_option_owners, original_block, resolve_localized, source_block } from '../../src/lib/internal/localized';

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const L = '@builder.io/core:LocalizedValue';
const E = '@builder.io/sdk:Element';
type Obj = Record<string, any>;

const loc = (values: Obj): Obj => ({ '@type': L, ...values });
const block = (id: string, options?: Obj, extra: Obj = {}): Obj => ({ '@type': E, id, component: { name: 'X', options }, ...extra });

function deep_freeze<T>(obj: T, seen = new WeakSet()): T {
	if (obj && typeof obj === 'object' && !seen.has(obj)) {
		seen.add(obj);
		Object.freeze(obj);
		for (const k of Object.keys(obj)) deep_freeze((obj as Obj)[k], seen);
	}
	return obj;
}

/** The official result: the options of a deep clone of the block, after resolveLocalizedValues. */
function official(options: Obj | undefined, locale: string | undefined): unknown {
	const b = structuredClone({ '@type': E, component: { name: 'X', options } }) as Obj;
	return resolveLocalizedValues(b as never, locale).component.options;
}

/** Whether the official walk finds a localized value in these options (its containsLocalizedValues). */
function official_contains(options: unknown): boolean {
	if (!options || typeof options !== 'object' || !Object.getOwnPropertyNames(options).length) return false;
	let found = false;
	traverse(options, (v) => {
		if (v && typeof v === 'object' && v['@type'] === L) found = true;
	});
	return found;
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	vi.restoreAllMocks();
});

const LOCALES = ['en-US', 'fr', 'Default', undefined];

describe('resolve_localized vs official resolveLocalizedValues', () => {
	const TABLE: [string, Obj | undefined][] = [
		['undefined options', undefined],
		['empty options', {}],
		['no localized values', { text: 'hi', n: 1, list: [1, { a: 2 }], nested: { deep: { x: null } } }],
		['a top-level value', { text: loc({ 'en-US': 'Hello', fr: 'Bonjour', Default: 'Hi' }) }],
		['missing locale', { text: loc({ fr: 'Bonjour' }) }],
		['null / falsy entries', { a: loc({ 'en-US': null, fr: 0, Default: '' }), b: loc({ 'en-US': false }) }],
		['in arrays', { list: [loc({ 'en-US': 'a', fr: 'b' }), 'plain', [loc({ Default: 'deep' })]] }],
		['deep in objects', { a: { b: { c: { d: loc({ 'en-US': { x: 1 }, fr: [1, 2] }) } } } }],
		['an object value holding a localized value', { a: loc({ 'en-US': { title: loc({ 'en-US': 'T', fr: 'TF' }) }, fr: { title: loc({ fr: 'TF' }) } }) }],
		['a nested block (Columns)', { columns: [{ blocks: [block('builder-in', { text: loc({ 'en-US': 'in', fr: 'dans' }) })] }] }],
		[
			'a nested block with children and styles',
			{
				items: [
					block('builder-a', { t: loc({ fr: 'x' }) }, {
						children: [block('builder-b', { t: loc({ 'en-US': 'child' }) })],
						responsiveStyles: { large: { color: loc({ 'en-US': 'red', fr: 'blue' }) } },
						properties: { title: loc({ 'en-US': 'title' }) }
					})
				]
			}
		],
		['blocks nested in blocks', { a: block('builder-1', { b: block('builder-2', { c: block('builder-3', { t: loc({ 'en-US': 3, fr: 4, Default: 5 }) }) }) }) }],
		['unicode and long strings', { 'ключ': loc({ 'en-US': '😀'.repeat(1000), fr: 'ü' }) }],
		['a localized value with other @type-like keys', { a: { '@type': 'other', v: loc({ fr: 1 }) } }]
	];

	it.each(TABLE)('%s', (_, options) => {
		for (const locale of LOCALES) expect(resolve_localized(options, locale), String(locale)).toEqual(official(options, locale));
	});

	it('prototype keys (JSON.parse own __proto__ / constructor)', () => {
		const options = JSON.parse(`{"__proto__": {"@type": "${L}", "fr": "p"}, "constructor": {"@type": "${L}", "fr": "c"}, "x": {"__proto__": {"@type": "${L}", "fr": 1}}}`);
		const ours = resolve_localized(options, 'fr')!;
		expect(Object.keys(ours)).toEqual(['__proto__', 'constructor', 'x']);
		expect(Object.getOwnPropertyDescriptor(ours, '__proto__')!.value).toBe('p');
		expect(ours.constructor).toBe('c');
		expect(Object.getPrototypeOf(ours)).toBe(Object.prototype);
		expect(({} as Obj).fr).toBeUndefined();
	});

	it('a seeded sweep of 300 random option trees', () => {
		const r = mulberry32(0x10ca1e);
		const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
		let n = 0;
		const prim = () => pick([1, 0, 'str', '', null, true, false, NaN, 'ü😀']);
		// (a localized value whose entry is itself a localized value is checked on its own, below)
		const value = (d: number, allow_loc = true): unknown => {
			const k = r();
			if (d > 4 || k < 0.3) return prim();
			if (allow_loc && k < 0.45) {
				const out: Obj = { '@type': L };
				for (const l of ['en-US', 'fr', 'Default']) if (r() < 0.6) out[l] = value(d + 1, false);
				return out;
			}
			if (k < 0.6) return Array.from({ length: Math.floor(r() * 4) }, () => value(d + 1));
			if (k < 0.7 && d < 3) {
				const extra: Obj = {};
				if (r() < 0.4) extra.children = Array.from({ length: Math.floor(r() * 3) }, () => value(d + 2));
				if (r() < 0.3) extra.responsiveStyles = { large: { color: value(d + 1) } };
				return block('builder-' + n++, obj(d + 1), extra);
			}
			return obj(d + 1);
		};
		const obj = (d: number): Obj => {
			const out: Obj = {};
			for (let i = Math.floor(r() * 4); i > 0; i--) out[pick(['a', 'b', 'text', 'items', 'columns', 'x y', 'é'])] = value(d);
			return out;
		};
		for (let i = 0; i < 300; i++) {
			const options = deep_freeze(obj(0));
			const locale = pick(LOCALES);
			expect(resolve_localized(options, locale), JSON.stringify({ options, locale })).toEqual(official(options, locale));
		}
	});
});

describe('resolve_localized behaviour', () => {
	it('never mutates the input (deep-frozen input works) and copies only where a value was', () => {
		const inner = { plain: { deep: 1 } };
		const options = deep_freeze({ text: loc({ fr: 'x' }), keep: inner, list: [1, 2], nested: { t: loc({ fr: 'y' }) } });
		const before = JSON.stringify(options);
		const out = resolve_localized(options, 'fr')!;
		expect(JSON.stringify(options)).toBe(before);
		expect(out).not.toBe(options);
		expect(out.keep).toBe(inner);
		expect(out.list).toBe(options.list);
		expect(out.nested).not.toBe(options.nested);
		expect(out).toEqual({ text: 'x', keep: inner, list: [1, 2], nested: { t: 'y' } });
	});

	it('no localized value: the same object back', () => {
		const options = { a: 1, b: { c: [1, { d: 2 }] }, nb: block('builder-x', { t: 'plain' }) };
		expect(resolve_localized(options, 'fr')).toBe(options);
		expect(resolve_localized(undefined, 'fr')).toBeUndefined();
		expect(warn).not.toHaveBeenCalled();
	});

	it('missing locale entry -> undefined, null entry -> undefined (official `?? undefined`)', () => {
		const out = resolve_localized({ a: loc({ fr: 'x' }), b: loc({ 'en-US': null }) }, 'en-US')!;
		expect('a' in out && out.a === undefined).toBe(true);
		expect(out.b).toBeUndefined();
	});

	// The official walk replaces the outer value with its entry, then walks the OUTER object, so an entry
	// that is itself a localized value is left unresolved (renders as an object). Ours resolves it.
	it('a localized value nested directly in a localized value resolves fully (the official leaves the inner one)', () => {
		const options = { a: loc({ fr: loc({ fr: 'inner' }) }), b: [loc({ fr: loc({ fr: loc({ fr: 'deeper' }) }) })] };
		expect(resolve_localized(options, 'fr')).toEqual({ a: 'inner', b: ['deeper'] });
		expect(official(options, 'fr')).toEqual({ a: { '@type': L, fr: 'inner' }, b: [{ '@type': L, fr: 'deeper' }] });
	});

	it('a shared object is resolved in every place it appears', () => {
		const shared = { t: loc({ fr: 'shared' }) };
		const options = { a: shared, b: [shared], c: { d: shared } };
		const out = resolve_localized(options, 'fr')!;
		expect(out).toEqual(official(options, 'fr'));
		expect(shared.t['@type']).toBe(L);
	});

	it('no locale: resolves with "Default" and warns once per process', async () => {
		vi.resetModules();
		const fresh = await import('../../src/lib/internal/localized');
		expect(fresh.resolve_localized({ a: loc({ Default: 'd', fr: 'f' }) }, undefined)).toEqual({ a: 'd' });
		expect(fresh.resolve_localized({ a: loc({ Default: 'd2' }) }, undefined)).toEqual({ a: 'd2' });
		// '' is a locale for the lookup (`??`, as the official), but warns like no locale (still once)
		expect(fresh.resolve_localized({ a: loc({ Default: 'd3', '': 'empty' }) }, '')).toEqual({ a: 'empty' });
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toMatch(/^\[Builder\.io\] In order to use localized fields in Builder, you must pass a locale prop/);
		expect(official({ a: loc({ Default: 'd3', '': 'empty' }) }, '')).toEqual({ a: 'empty' });
	});

	it('no warning with a locale, or when nothing is localized', async () => {
		vi.resetModules();
		const fresh = await import('../../src/lib/internal/localized');
		fresh.resolve_localized({ a: loc({ fr: 'f' }) }, 'fr');
		fresh.resolve_localized({ a: 1 }, undefined);
		fresh.resolve_localized(undefined, undefined);
		expect(warn).not.toHaveBeenCalled();
		// (the official warns on every call)
		resolveLocalizedValues({ component: { name: 'X', options: { a: loc({}) } } } as never, undefined);
		resolveLocalizedValues({ component: { name: 'X', options: { a: loc({}) } } } as never, undefined);
		expect(warn).toHaveBeenCalledTimes(2);
	});

	// Regression: `walk` recursed with no record of what it was inside, so options with a cycle
	// (hand-built content) overflowed the stack: a full render of such a block threw `Maximum call
	// stack size exceeded`, where the official traverse (a visited WeakSet) resolves it.
	it('options with a cycle resolve (the official traverse tracks what it visited)', () => {
		const n: Obj = { k: 1 };
		n.self = n;
		const options = { a: loc({ fr: 'v' }), n };
		const out = resolve_localized(options, 'fr')!;
		expect(out.a).toBe('v');
		expect(out.n.k).toBe(1);
	});
});

describe('nested block copies: original_block / source_block', () => {
	it('a nested block whose only change is its component options renders as the block', () => {
		const inner = block('builder-in', { text: loc({ fr: 'dans' }) });
		const out = resolve_localized({ blocks: [inner] }, 'fr')!;
		const copy = out.blocks[0];
		expect(copy).not.toBe(inner);
		expect(copy.component.options.text).toBe('dans');
		expect(original_block(copy)).toBe(inner);
		expect(source_block(copy)).toBe(inner);
		expect(inner.component.options.text['@type']).toBe(L);
	});

	it('a block that is not a copy: original_block undefined, source_block itself', () => {
		const b = block('builder-plain', { t: 1 });
		expect(original_block(b)).toBeUndefined();
		expect(source_block(b)).toBe(b);
		// a nested block with nothing localized is not copied
		const out = resolve_localized({ x: loc({ fr: 1 }), blocks: [b] }, 'fr')!;
		expect(out.blocks[0]).toBe(b);
	});

	it('a copy whose other fields changed (styles, properties) does not render as the block', () => {
		for (const extra of [{ responsiveStyles: { large: { color: loc({ fr: 'red' }) } } }, { properties: { title: loc({ fr: 't' }) } }, { meta: loc({ fr: 1 }) }]) {
			const inner = block('builder-x', { t: 'plain' }, extra);
			const copy = resolve_localized({ blocks: [inner] }, 'fr')!.blocks[0];
			expect(copy).not.toBe(inner);
			expect(original_block(copy)).toBeUndefined();
			expect(source_block(copy)).toBe(inner);
		}
	});

	it('a change to component fields other than options does not render as the block', () => {
		const inner = { '@type': E, id: 'builder-n', component: { name: loc({ fr: 'Text' }), options: {} } };
		const copy = resolve_localized({ b: inner }, 'fr')!.b;
		expect(copy.component.name).toBe('Text');
		expect(original_block(copy)).toBeUndefined();
	});

	it('a block whose children changed only by rendering-as-themselves renders as the block', () => {
		const child = block('builder-child', { t: loc({ fr: 'c' }) });
		const parent = block('builder-parent', { t: 'plain' }, { children: [child, block('builder-c2', {})] });
		const copy = resolve_localized({ b: parent }, 'fr')!.b;
		expect(copy).not.toBe(parent);
		expect(copy.children[0].component.options.t).toBe('c');
		expect(copy.children[1]).toBe(parent.children[1]);
		expect(original_block(copy.children[0])).toBe(child);
		expect(original_block(copy)).toBe(parent);
	});

	it('a child whose copy does not render as itself makes the parent not render as itself', () => {
		const child = block('builder-child2', {}, { responsiveStyles: { large: { color: loc({ fr: 'red' }) } } });
		const parent = block('builder-parent2', {}, { children: [child] });
		const copy = resolve_localized({ b: parent }, 'fr')!.b;
		expect(original_block(copy.children[0])).toBeUndefined();
		expect(original_block(copy)).toBeUndefined();
		expect(source_block(copy)).toBe(parent);
	});

	it('one copy per block per locale, shared by every holder', () => {
		const inner = block('builder-shared', { t: loc({ fr: 'f', 'en-US': 'e' }) });
		const a = resolve_localized({ x: [inner] }, 'fr')!;
		const b = resolve_localized({ y: { z: inner } }, 'fr')!;
		expect(a.x[0]).toBe(b.y.z);
		const en = resolve_localized({ x: [inner] }, 'en-US')!;
		expect(en.x[0]).not.toBe(a.x[0]);
		expect(en.x[0].component.options.t).toBe('e');
		expect(a.x[0].component.options.t).toBe('f');
	});
});

describe('mark_option_owners', () => {
	/** What the content walk (compile.ts find_blocks) puts in `localized`: blocks with a localized value in
	 *  their own component options (not through a nested block). Plus every block, for checking. */
	function direct_owners(root: unknown[]) {
		const owners = new Set<object>();
		const blocks: Obj[] = [];
		const seen = new WeakSet<object>();
		const visit = (v: unknown, owner: Obj | null) => {
			if (!v || typeof v !== 'object' || seen.has(v)) return;
			seen.add(v);
			const o = v as Obj;
			if (!Array.isArray(v) && o['@type'] === E) {
				blocks.push(o);
				visit(o.component?.options, o);
				visit(o.children, null);
				return;
			}
			if (o['@type'] === L && owner) owners.add(owner);
			for (const k in o) visit(o[k], owner);
		};
		visit(root, null);
		return { owners, blocks };
	}

	it('a block holding (in its options) a block that owns one owns one too', () => {
		const inner = block('builder-in', { t: loc({ fr: 'x' }) });
		const outer = block('builder-out', { columns: [{ blocks: [inner] }] });
		const localized = new Set<object>([inner]);
		mark_option_owners([outer], localized, 1000);
		expect(localized.has(outer)).toBe(true);
	});

	it('through several levels of nested blocks, every holder is marked', () => {
		const c = block('builder-c', { t: loc({ fr: 'x' }) });
		const b = block('builder-b', { item: c });
		const a = block('builder-a', { items: [b] });
		const localized = new Set<object>([c]);
		mark_option_owners([a], localized, 1000);
		expect([...localized]).toEqual(expect.arrayContaining([a, b, c]));
	});

	it('a child (not in options) does not mark its parent; a child of a block in options does', () => {
		const child = block('builder-child', { t: loc({ fr: 'x' }) });
		const parent = block('builder-parent', {}, { children: [child] });
		const localized = new Set<object>([child]);
		mark_option_owners([parent], localized, 1000);
		expect(localized.has(parent)).toBe(false);

		const holder = block('builder-holder', { items: [parent] });
		mark_option_owners([holder], localized, 1000);
		expect(localized.has(holder)).toBe(true);
		expect(localized.has(parent)).toBe(false);
	});

	it('nothing localized: nothing added', () => {
		const tree = [block('a', { items: [block('b', {})] }, { children: [block('c', {})] })];
		const localized = new Set<object>();
		mark_option_owners(tree, localized, 1000);
		expect(localized.size).toBe(0);
	});

	it('blocks without component or options, nulls and primitives in the tree', () => {
		const inner = block('builder-in', { t: loc({ fr: 'x' }) });
		const tree = [null, 1, 'x', { '@type': E, id: 'no-component' }, { '@type': E, component: null }, block('h', { a: null, b: [null, inner] })];
		const localized = new Set<object>([inner]);
		mark_option_owners(tree as unknown[], localized, 1000);
		expect(localized.has(tree[5] as object)).toBe(true);
	});

	it('a seeded sweep: after marking, a block is in the set exactly when the official walk of its options finds one', () => {
		const r = mulberry32(0x0a11);
		let n = 0;
		const gen_block = (d: number): Obj => {
			const options: Obj = {};
			if (r() < 0.25) options.text = loc({ fr: 'x' });
			if (r() < 0.2) options.deep = { list: [{ v: loc({ fr: 1 }) }] };
			if (d < 4 && r() < 0.5) options.items = Array.from({ length: Math.floor(r() * 3) }, () => gen_block(d + 1));
			if (d < 4 && r() < 0.3) options.columns = [{ blocks: [gen_block(d + 1)] }];
			const extra: Obj = {};
			if (d < 4 && r() < 0.5) extra.children = Array.from({ length: Math.floor(r() * 3) }, () => gen_block(d + 1));
			return block('builder-' + n++, options, extra);
		};
		for (let i = 0; i < 150; i++) {
			const root = Array.from({ length: 1 + Math.floor(r() * 3) }, () => gen_block(0));
			const { owners, blocks } = direct_owners(root);
			const localized = new Set<object>(owners);
			mark_option_owners(root, localized, 1 << 20);
			for (const b of blocks) expect(localized.has(b), b.id).toBe(official_contains(b.component?.options));
		}
	});

	// Regression: a block nested in another block's options with a localized value OUTSIDE its
	// component options (its responsiveStyles, properties, …) is resolved by the official walk of the
	// holder's options (it walks the nested block whole). mark_option_owners only spread ownership up
	// from blocks already in `localized`, and compile.ts's content walk only noted values in component
	// options, so the holder was never marked and shipped the nested block unresolved: a Columns column
	// block with a localized color / title rendered with no color / no title (official: resolved).
	it('a localized value in a nested block\'s styles marks its holder', () => {
		const inner = block('builder-in', { t: 'plain' }, { responsiveStyles: { large: { color: loc({ fr: 'red' }) } } });
		const outer = block('builder-out', { columns: [{ blocks: [inner] }] });
		const unrelated = block('builder-other', { t: loc({ fr: 'x' }) });
		const localized = new Set<object>([unrelated]);
		mark_option_owners([outer, unrelated], localized, 1000);
		expect(official_contains(outer.component.options)).toBe(true);
		expect(localized.has(outer)).toBe(true);
	});

	it('a cycle exhausts the budget and returns', () => {
		const a = block('builder-cyc', {});
		a.component.options.self = a;
		a.children = [a];
		const o: Obj = { k: 1 };
		o.self = o;
		a.component.options.o = o;
		const localized = new Set<object>([a]);
		const t = performance.now();
		mark_option_owners([a], localized, 10_000);
		expect(performance.now() - t).toBeLessThan(1000);
		expect(localized.has(a)).toBe(true);
	});

	it('a budget of 1 stops before anything is visited', () => {
		const inner = block('builder-in', { t: loc({ fr: 'x' }) });
		const outer = block('builder-out', { items: [inner] });
		const localized = new Set<object>([inner]);
		mark_option_owners([outer], localized, 1);
		expect(localized.has(outer)).toBe(false);
	});

	it('a deep tree (2000 nested holders) is walked without recursion', () => {
		let cur = block('builder-leaf', { t: loc({ fr: 'x' }) });
		const leaf = cur;
		const all = [cur];
		for (let i = 0; i < 2000; i++) all.push((cur = block('builder-h' + i, { item: cur })));
		const localized = new Set<object>([leaf]);
		mark_option_owners([cur], localized, 1 << 20);
		expect(all.every((b) => localized.has(b))).toBe(true);
	});
});
