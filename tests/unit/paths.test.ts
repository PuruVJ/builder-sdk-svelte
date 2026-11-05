// paths.ts vs the official functions/set.ts (lodash-style set) and functions/get.ts.
import { afterEach, describe, expect, it } from 'vitest';
import { get } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get';
import { set } from '../../node_modules/@builder.io/sdk-svelte/src/functions/set';
import { get_path, parse_path, set_cow } from '../../src/lib/internal/paths';

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

function deep_freeze<T>(obj: T): T {
	if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
		Object.freeze(obj);
		for (const k of Object.keys(obj)) deep_freeze((obj as Record<string, unknown>)[k]);
	}
	return obj;
}

/** The result of `fn`, or the name of what it threw (an invalid `length` throws in both). */
function outcome(fn: () => unknown): unknown {
	try {
		return { value: fn() };
	} catch (e) {
		return { threw: (e as Error).name };
	}
}

/** The official binding step: `set(clone, path, value)` on a deep clone. */
function official_set(root: object, path: string, value: unknown) {
	const clone = structuredClone(root);
	set(clone, path, value);
	return clone;
}

const BASE = () => ({
	component: { name: 'Text', options: { text: 'hi', list: [{ a: 1 }, { a: 2 }], n: 5, s: 'str', z: null } },
	responsiveStyles: { large: { color: 'red' } },
	arr: [1, 2, 3],
	empty: {},
	t: true
});

const PATHS = [
	'component.options.text',
	'component.options.new',
	'component.options.list[0].a',
	'component.options.list.1.a',
	'component.options.list[5].a',
	'component.options.list[0]',
	'component.options.n.deep',
	'component.options.s.deep',
	'component.options.z.deep',
	'component.options.n[0]',
	'responsiveStyles.large.color',
	'responsiveStyles.medium.color',
	'responsiveStyles.xsmall[2].x',
	'missing.a.b.c',
	'missing[0].b',
	'missing.0.b',
	'missing.-1.b',
	'missing.1.5.b',
	'missing.01.b',
	'missing[1e2].b',
	'arr[1]',
	'arr[10]',
	'arr.length',
	'arr[0].x',
	't.x',
	'empty..a',
	'a[0].b',
	'a[0][1][2]',
	'x',
	'.x',
	'x.',
	'[0]',
	'[0].a',
	'unicode.ключ.名前'
];

describe('parse_path', () => {
	it('splits on dots and brackets like the official set', () => {
		expect(parse_path('a.b.c')).toEqual(['a', 'b', 'c']);
		expect(parse_path('a[0].b')).toEqual(['a', '0', 'b']);
		expect(parse_path('a[0][1]')).toEqual(['a', '0', '1']);
		expect(parse_path('..a..b..')).toEqual(['a', 'b']);
	});

	it('matches the official regex for every table path and a sweep', () => {
		const r = mulberry32(11);
		const chars = 'ab.[]0-1_ é';
		const inputs = [...PATHS];
		for (let i = 0; i < 300; i++) {
			let s = '';
			for (let n = Math.floor(r() * 12); n > 0; n--) s += chars[Math.floor(r() * chars.length)];
			inputs.push(s);
		}
		for (const p of inputs) expect(parse_path(p), p).toEqual(p.toString().match(/[^.[\]]+/g) ?? []);
	});

	it('an empty or separator-only path is no keys (the official set throws on it)', () => {
		expect(parse_path('')).toEqual([]);
		expect(parse_path('.[].')).toEqual([]);
	});

	it('is cached: the same array for the same string', () => {
		expect(parse_path('cache.me[1]')).toBe(parse_path('cache.me[1]'));
	});
});

describe('set_cow vs official set on a deep clone', () => {
	it.each(PATHS)('%s', (path) => {
		const root = deep_freeze(BASE());
		const value = { v: path };
		const ours = outcome(() => set_cow(root, parse_path(path), value, new WeakSet()));
		expect(ours).toEqual(outcome(() => official_set(root, path, value)));
	});

	it('several bindings applied in order with one `copied` set (as render.ts does)', () => {
		const root = deep_freeze(BASE());
		const copied = new WeakSet<object>();
		let ours: object = root;
		let official: object = structuredClone(root);
		for (const [i, p] of PATHS.entries()) {
			ours = set_cow(ours, parse_path(p), i, copied); // (numbers: a valid `length` too)
			set(official, p, i);
		}
		expect(ours).toEqual(official);
	});

	it('a seeded sweep of 400 random roots and paths', () => {
		const r = mulberry32(0x5e7);
		const keys = ['a', 'b', 'c', '0', '1', '2', '10', '-1', '1.5', 'length', 'x y', 'é'];
		const leaf = () => [1, 'str', null, true, 0, '', NaN][Math.floor(r() * 7)];
		const build = (d: number): unknown => {
			const k = r();
			if (d > 3 || k < 0.3) return leaf();
			if (k < 0.6) return Array.from({ length: Math.floor(r() * 4) }, () => build(d + 1));
			const o: Record<string, unknown> = {};
			for (let n = Math.floor(r() * 4); n > 0; n--) o[keys[Math.floor(r() * keys.length)]] = build(d + 1);
			return o;
		};
		for (let i = 0; i < 400; i++) {
			const root = build(0);
			const obj = (root && typeof root === 'object' ? root : { a: root }) as object;
			deep_freeze(obj);
			const copied = new WeakSet<object>();
			let ours: object = obj;
			const official = structuredClone(obj);
			let threw = false;
			for (let b = 1 + Math.floor(r() * 3); b > 0; b--) {
				const parts = Array.from({ length: 1 + Math.floor(r() * 4) }, () => keys[Math.floor(r() * keys.length)]);
				const path = parts.map((p, j) => (j > 0 && r() < 0.3 && /^\d+$/.test(p) ? `[${p}]` : (j ? '.' : '') + p)).join('');
				const value = r() < 0.5 ? { set: i } : i;
				const a = outcome(() => (ours = set_cow(ours, parse_path(path), value, copied)));
				const b = outcome(() => set(official, path, value));
				if ('threw' in (a as object) || 'threw' in (b as object)) {
					expect(a, path).toEqual(b);
					threw = true;
					break;
				}
			}
			if (!threw) expect(ours, String(i)).toEqual(official);
		}
	});
});

describe('set_cow copy-on-write', () => {
	it('never mutates the input (deep-frozen input does not throw) and returns a new root', () => {
		const root = deep_freeze(BASE());
		const before = JSON.stringify(root);
		const out = set_cow(root, parse_path('component.options.list[1].a'), 9, new WeakSet());
		expect(out).not.toBe(root);
		expect(JSON.stringify(root)).toBe(before);
		expect(out.component.options.list[1].a).toBe(9);
	});

	it('copies only along the path; everything else is shared', () => {
		const root = BASE();
		const out = set_cow(root, parse_path('component.options.list[1].a'), 9, new WeakSet());
		expect(out.component).not.toBe(root.component);
		expect(out.component.options).not.toBe(root.component.options);
		expect(out.component.options.list).not.toBe(root.component.options.list);
		expect(Array.isArray(out.component.options.list)).toBe(true);
		expect(out.component.options.list[1]).not.toBe(root.component.options.list[1]);
		expect(out.component.options.list[0]).toBe(root.component.options.list[0]);
		expect(out.responsiveStyles).toBe(root.responsiveStyles);
		expect(out.arr).toBe(root.arr);
		expect(out.empty).toBe(root.empty);
	});

	it('with a shared `copied` set, a second write reuses the copies of the first', () => {
		const root = BASE();
		const copied = new WeakSet<object>();
		const a = set_cow(root, ['component', 'options', 'text'], 'x', copied);
		const b = set_cow(a, ['component', 'options', 'n'], 7, copied);
		expect(b).toBe(a);
		expect(b.component.options).toEqual({ ...root.component.options, text: 'x', n: 7 });
		expect(root.component.options.text).toBe('hi');
	});

	it('a fresh `copied` set copies again', () => {
		const root = BASE();
		const a = set_cow(root, ['t'], false, new WeakSet());
		const b = set_cow(a, ['t'], 1, new WeakSet());
		expect(b).not.toBe(a);
		expect(a.t).toBe(false);
	});

	it('missing containers: array when the next key is an index, object otherwise', () => {
		const out = set_cow({} as Record<string, any>, parse_path('a[0].b.2.c'), 1, new WeakSet());
		expect(out).toEqual({ a: [{ b: [, , { c: 1 }] }] });
		expect(Array.isArray(out.a)).toBe(true);
		expect(Array.isArray(out.a[0].b)).toBe(true);
		expect(set_cow({} as any, ['a', '-1', 'b'], 1, new WeakSet()).a).toEqual({ '-1': { b: 1 } });
		// '01' counts as an index for the container type (as the official), but is a plain key on it
		const zero_one = set_cow({} as any, ['a', '01', 'b'], 1, new WeakSet()).a;
		expect(Array.isArray(zero_one)).toBe(true);
		expect(zero_one['01']).toEqual({ b: 1 });
	});

	it('existing primitives on the path are replaced by a container', () => {
		for (const prim of [0, 1, '', 'str', true, false, null, undefined, NaN]) {
			const root = { p: prim };
			const ours = set_cow(root, ['p', 'q'], 1, new WeakSet());
			expect(ours).toEqual(official_set(root, 'p.q', 1));
			expect(ours.p).toEqual({ q: 1 });
			expect(root.p).toBe(prim);
		}
	});

	it('an array root stays an array', () => {
		const root = deep_freeze([{ a: 1 }, { a: 2 }]);
		const out = set_cow(root, ['1', 'a'], 3, new WeakSet());
		expect(Array.isArray(out)).toBe(true);
		expect(out).toEqual([{ a: 1 }, { a: 3 }]);
		expect(out[0]).toBe(root[0]);
	});

	it('a deep path (200 levels)', () => {
		const path = Array.from({ length: 200 }, (_, i) => 'k' + i);
		const out = set_cow({}, path, 'deep', new WeakSet());
		expect(get_path(out, path)).toBe('deep');
	});
});

describe('set_cow and prototype keys', () => {
	afterEach(() => {
		delete (Object.prototype as Record<string, unknown>).polluted;
	});

	// The official set walks `__proto__` / `constructor.prototype` into Object.prototype (prototype
	// pollution from a binding path in content). Ours copies the object it meets instead: nothing
	// global is written.
	it('`__proto__.polluted` does not reach Object.prototype', () => {
		const out = set_cow({ a: 1 }, parse_path('__proto__.polluted'), 'yes', new WeakSet());
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
		expect((out as Record<string, unknown>).polluted).toBe('yes'); // only the copy's own prototype
	});

	it('`constructor.prototype.polluted` does not reach Object.prototype', () => {
		set_cow({ a: 1 }, parse_path('constructor.prototype.polluted'), 'yes', new WeakSet());
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it('the official set does pollute (documents the official-SDK bug)', () => {
		set({ a: 1 }, '__proto__.polluted', 'yes');
		expect(({} as Record<string, unknown>).polluted).toBe('yes');
	});
});

describe('get_path vs official get', () => {
	const OBJ = { a: { b: { c: 1, z: 0, f: false, e: '' } }, list: [{ x: 'first' }, { x: 'second' }], s: 'str', n: null, u: undefined };
	const GET_PATHS = ['a', 'a.b', 'a.b.c', 'a.b.z', 'a.b.f', 'a.b.e', 'a.x', 'a.x.y', 'list[0].x', 'list.1.x', 'list[9].x', 's.length', 's.0', 'u', 'u.x', 'missing.deep.path'];

	it.each(GET_PATHS)('%s', (p) => {
		expect(get_path(OBJ, parse_path(p))).toEqual(get(OBJ, p));
	});

	it('undefined / null roots', () => {
		expect(get_path(undefined, ['a'])).toBeUndefined();
		expect(get_path(null, ['a'])).toBeUndefined();
		expect(get(undefined, 'a')).toBeUndefined();
	});

	// The official get returns `null` when it meets null part way (and `defaultValue` for an empty
	// path); get_path returns undefined past any null and the object itself for no keys.
	it('null part way: undefined (the official returns null)', () => {
		expect(get_path(OBJ, ['n', 'x'])).toBeUndefined();
		expect(get(OBJ, 'n.x')).toBeNull();
		expect(get_path(OBJ, ['n'])).toBeNull();
	});

	it('no keys: the object itself', () => {
		expect(get_path(OBJ, [])).toBe(OBJ);
	});
});
