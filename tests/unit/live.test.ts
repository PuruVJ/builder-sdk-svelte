// internal/live.ts: reconcile (structural sharing), merge_content (official mergeNewContent),
// coalesce without frames, load_bridge, is_authoring on the server.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coalesce, is_authoring, load_bridge, merge_content, reconcile } from '../../src/lib/internal/live.js';
import { rng } from './_rng.js';

afterEach(() => vi.useRealTimers());

/** official components/content/components/enable-editor.svelte `mergeNewContent` (the value it stores). */
function official_merge(current: any, newContent: any) {
	return {
		...current,
		...newContent,
		data: { ...current?.data, ...newContent?.data },
		meta: { ...current?.meta, ...newContent?.meta, breakpoints: newContent?.meta?.breakpoints || current?.meta?.breakpoints }
	};
}

function deep_freeze<T>(v: T): T {
	if (v && typeof v === 'object' && !Object.isFrozen(v)) {
		Object.freeze(v);
		for (const k of Reflect.ownKeys(v as object)) deep_freeze((v as Record<string | symbol, unknown>)[k]);
	}
	return v;
}

describe('merge_content (official mergeNewContent)', () => {
	const cases: Array<[unknown, unknown]> = [
		[undefined, undefined],
		[undefined, { id: 'a', data: { blocks: [] } }],
		[{ id: 'a', data: { title: 'x', blocks: [1] }, meta: { breakpoints: { small: 1 }, kind: 'page' } }, { data: { title: 'y' } }],
		[{ id: 'a', meta: { breakpoints: { small: 1 } } }, { meta: { breakpoints: { small: 2 } } }],
		[{ id: 'a', meta: { breakpoints: { small: 1 } } }, { meta: { breakpoints: null } }],
		[{ id: 'a', data: null }, { data: null, meta: null }],
		[{ id: 'a', testVariationId: 'v' }, { id: 'b' }],
		[null, { id: 'a' }]
	];
	it.each(cases.map((c, i) => [i, ...c]))('#%i', (_i, current, next) => {
		expect(merge_content(current as never, next as never)).toEqual(official_merge(current, next));
	});
});

describe('reconcile', () => {
	it('the same value, or deep-equal: prev itself', () => {
		const a = { x: [1, { y: 2 }], s: 'ü' };
		expect(reconcile(a, a)).toBe(a);
		expect(reconcile(a, structuredClone(a))).toBe(a);
		expect(reconcile([1, 2], [1, 2])).toEqual([1, 2]);
		for (const v of [null, undefined, 0, NaN, '', 'x', true]) expect(reconcile({ a: 1 }, v)).toBe(v);
		expect(reconcile(null, { a: 1 })).toEqual({ a: 1 });
	});

	it('one changed leaf: a new path to it, every untouched part shared', () => {
		const prev = deep_freeze({ data: { blocks: [{ id: 'a', t: 1 }, { id: 'b', t: 2, children: [{ id: 'c' }] }], title: 'T' }, meta: { m: 1 } });
		const next = structuredClone(prev) as any;
		next.data.blocks[1].children[0].text = 'new';
		const out = reconcile(prev, next) as any;
		expect(out).toEqual(next);
		expect(out).not.toBe(prev);
		expect(out.meta).toBe(prev.meta);
		expect(out.data.blocks[0]).toBe(prev.data.blocks[0]);
		expect(out.data.blocks[1]).not.toBe(prev.data.blocks[1]);
		expect(out.data.blocks[1].children[0]).not.toBe(prev.data.blocks[1].children[0]);
		expect(next.data.blocks[0]).not.toBe(prev.data.blocks[0]); // (next was not mutated into prev)
	});

	it('blocks matched by id: insert, move, delete keep the siblings', () => {
		const a = { id: 'a', v: 1 };
		const b = { id: 'b', v: 2 };
		const c = { id: 7, v: 3 };
		const prev = deep_freeze([a, b, c]);
		const inserted = reconcile(prev, [{ id: 'new' }, ...structuredClone(prev)]);
		expect(inserted[1]).toBe(a);
		expect(inserted[2]).toBe(b);
		expect(inserted[3]).toBe(c);
		const moved = reconcile(prev, structuredClone([c, a, b]));
		expect(moved).toEqual([c, a, b]);
		expect(moved[0]).toBe(c);
		expect(moved[1]).toBe(a);
		const deleted = reconcile(prev, structuredClone([a, c]));
		expect(deleted[0]).toBe(a);
		expect(deleted[1]).toBe(c);
	});

	it('duplicated ids: each old block is used at most once (never one object twice in a list)', () => {
		const a = { id: 'a', v: 1 };
		const prev = deep_freeze([a]);
		const out = reconcile(prev, [{ id: 'a', v: 1 }, { id: 'a', v: 1 }]);
		expect(out[0]).toBe(a);
		expect(out[1]).not.toBe(a);
		expect(out[1]).toEqual(a);
		// (a matching id at the same position wins: swapped duplicates are equal, just not shared)
		const prev2 = deep_freeze([{ id: 'x', v: 1 }, { id: 'x', v: 2 }]);
		const out2 = reconcile(prev2, structuredClone([prev2[1], prev2[0]]));
		expect(out2).toEqual([prev2[1], prev2[0]]);
		expect(out2[0]).not.toBe(out2[1]);
		// by position when the id matches, then by id among the unused
		const p = { id: 'p', v: 0 };
		const prev3 = deep_freeze([p, { id: 'q' }]);
		const out3 = reconcile(prev3, [{ id: 'p', v: 0 }, { id: 'p', v: 0 }]);
		expect(out3[0]).toBe(p);
		expect(out3[1]).not.toBe(p);
	});

	it('ids that are not strings or numbers match by position only', () => {
		const prev = deep_freeze([{ id: { o: 1 }, v: 1 }, { id: null, v: 2 }]);
		const out = reconcile(prev, structuredClone(prev));
		expect(out).toBe(prev);
		const swapped = reconcile(prev, structuredClone([prev[1], prev[0]]));
		expect(swapped[0]).not.toBe(prev[1]);
		expect(swapped).toEqual([prev[1], prev[0]]);
	});

	it('key order counts (attributes come out in order); values are still shared', () => {
		const inner = { z: 1 };
		const prev = deep_freeze({ a: inner, b: 2 });
		const out = reconcile(prev, { b: 2, a: { z: 1 } }) as any;
		expect(out).not.toBe(prev);
		expect(Object.keys(out)).toEqual(['b', 'a']);
		expect(out.a).toBe(inner);
	});

	it('added / removed keys, array vs object, length changes', () => {
		const prev = deep_freeze({ a: 1, arr: [1, 2], obj: { k: 1 } });
		expect(reconcile(prev, { a: 1, arr: [1, 2], obj: { k: 1 }, extra: 1 })).toEqual({ ...prev, extra: 1 });
		const removed = reconcile(prev, { a: 1, arr: [1, 2] }) as any;
		expect(removed).toEqual({ a: 1, arr: [1, 2] });
		expect(removed.arr).toBe(prev.arr);
		expect(reconcile(prev, { a: 1, arr: { 0: 1, 1: 2 }, obj: [1] })).toEqual({ a: 1, arr: { 0: 1, 1: 2 }, obj: [1] });
		expect(reconcile([1, 2, 3], [1, 2])).toEqual([1, 2]);
		expect(reconcile({ a: 1 }, [1])).toEqual([1]);
	});

	it('non-plain objects are taken as new', () => {
		const d = new Date(0);
		expect(reconcile({ d }, { d: new Date(0) }).d).not.toBe(d);
		class K {
			v = 1;
		}
		const k = new K();
		expect(reconcile(k, new K())).not.toBe(k);
		const nul = Object.assign(Object.create(null), { a: { b: 1 } });
		const nul2 = Object.assign(Object.create(null), { a: { b: 1 } });
		expect(reconcile(nul, nul2)).toBe(nul);
	});

	it('a `__proto__` key stays an own key (never a prototype), prototype-shaped keys are plain data', () => {
		const prev = deep_freeze(JSON.parse('{"__proto__": {"x": 1}, "constructor": {"prototype": 2}, "a": 1}'));
		const next = JSON.parse('{"__proto__": {"x": 2}, "constructor": {"prototype": 2}, "a": 1}');
		const out = reconcile(prev, next);
		expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
		expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(true);
		expect(out.__proto__).toEqual({ x: 2 });
		expect(out.constructor).toBe(prev.constructor);
		expect(({} as any).x).toBeUndefined();
		// a key `prev` only inherits is not shared
		expect(reconcile({}, { toString: 'x' })).toEqual({ toString: 'x' });
	});

	it('a change after untouched keys and items: those before it are shared, `__proto__` stays own', () => {
		const prev = deep_freeze(JSON.parse('{"__proto__": {"x": 1}, "a": {"k": 1}, "list": [{"v": 1}, {"v": 2}, {"v": 3}], "b": 1}'));
		const out = reconcile(prev, JSON.parse('{"__proto__": {"x": 1}, "a": {"k": 1}, "list": [{"v": 1}, {"v": 2}, {"v": 4}], "b": 1}')) as any;
		expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
		expect(Object.keys(out)).toEqual(['__proto__', 'a', 'list', 'b']);
		expect(out.__proto__).toBe(prev.__proto__);
		expect(out.a).toBe(prev.a);
		expect(out.list).not.toBe(prev.list);
		expect(out.list[0]).toBe(prev.list[0]);
		expect(out.list[1]).toBe(prev.list[1]);
		expect(out.list[2]).toEqual({ v: 4 });
		expect(reconcile([{ v: 1 }], [])).toEqual([]);
		expect(reconcile({ a: 1 }, {})).toEqual({});
		expect(reconcile([], [])).toEqual([]);
	});

	it('NaN, Infinity, -0, unicode, long strings', () => {
		const prev = deep_freeze({ n: NaN, i: Infinity, z: -0, u: '✓ü𝄞', l: 'x'.repeat(100000) });
		const next = { n: NaN, i: Infinity, z: -0, u: '✓ü𝄞', l: 'x'.repeat(100000) };
		// (NaN !== NaN: a NaN leaf makes its container new — correct, merely unshared)
		const out = reconcile(prev, next);
		expect(out).toEqual(next);
	});

	it('very deep content: shared down to the depth limit, never a stack overflow', () => {
		const make = (n: number, leaf: unknown) => {
			let v: any = { leaf };
			for (let i = 0; i < n; i++) v = { c: v, id: 'b' + i };
			return v;
		};
		const prev = make(20000, 1);
		const out = reconcile(prev, make(20000, 1));
		// (past the limit the content counts as new; compared by identity: a deep diff would overflow)
		expect(out === prev).toBe(false);
		expect(out.id).toBe('b19999');
		const shallow = make(1000, 1);
		expect(reconcile(shallow, make(1000, 1)) === shallow).toBe(true);
	});

	it('cycles terminate (hand-built content)', () => {
		const a: any = { id: 'a' };
		a.self = a;
		const b: any = { id: 'a' };
		b.self = b;
		const out = reconcile(a, b);
		expect(out.id).toBe('a');
	});

	it('called on an almost full stack: falls back to `next`', () => {
		const prev = { a: { b: { c: { d: 1 } } } };
		const next = { a: { b: { c: { d: 2 } } } };
		let result: unknown;
		const dive = (n: number): void => {
			try {
				dive(n + 1);
			} catch {
				if (result === undefined) result = reconcile(prev, next);
			}
		};
		dive(0);
		expect(result).toEqual(next);
	});

	it('an error other than a stack overflow is not swallowed', () => {
		const next = {
			get bad() {
				throw new TypeError('getter');
			}
		};
		expect(() => reconcile({ bad: 1 }, next)).toThrow('getter');
	});

	it('seeded sweep: equal to next, untouched subtrees shared, inputs never mutated', () => {
		const r = rng(2024);
		const gen = (depth: number): unknown => {
			const k = r.int(10);
			if (depth <= 0 || k < 3) return r.pick([0, 1, 'a', 'ü', true, null, -1.5]);
			if (k < 6) return Array.from({ length: r.int(5) }, (_, i) => (r.chance(0.6) ? { id: r.pick(['x', 'y', 'z', i, 'w' + i]), v: gen(depth - 1) } : gen(depth - 1)));
			const o: Record<string, unknown> = {};
			for (let i = r.int(5); i > 0; i--) o[r.pick(['a', 'b', 'c', 'id', 'children', 'data'])] = gen(depth - 1);
			return o;
		};
		const mutate = (v: unknown): unknown => {
			if (v === null || typeof v !== 'object') return r.chance(0.3) ? gen(1) : v;
			if (Array.isArray(v)) {
				const out = v.map((x) => (r.chance(0.3) ? mutate(x) : x));
				if (r.chance(0.15)) out.splice(r.int(out.length + 1), 0, { id: 'x', v: 1 });
				if (r.chance(0.15) && out.length) out.splice(r.int(out.length), 1);
				if (r.chance(0.15)) out.reverse();
				return out;
			}
			const out: Record<string, unknown> = {};
			for (const k in v as object) if (!r.chance(0.05)) out[k] = r.chance(0.3) ? mutate((v as Record<string, unknown>)[k]) : (v as Record<string, unknown>)[k];
			return out;
		};
		for (let i = 0; i < 400; i++) {
			const prev = deep_freeze(gen(5));
			const next = structuredClone(mutate(structuredClone(prev)));
			const snapshot = JSON.stringify(next);
			const out = reconcile(prev, next);
			expect(out).toStrictEqual(next);
			expect(JSON.stringify(next)).toBe(snapshot);
			if (JSON.stringify(prev) === snapshot) expect(out).toBe(prev);
		}
	});
});

describe('coalesce without frames (server / no requestAnimationFrame)', () => {
	it('a burst flushes once, after the timeout', () => {
		vi.useFakeTimers();
		const flush = vi.fn();
		const c = coalesce(flush);
		for (let i = 0; i < 10; i++) c.schedule();
		expect(flush).not.toHaveBeenCalled();
		vi.advanceTimersByTime(49);
		expect(flush).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(flush).toHaveBeenCalledOnce();
		c.schedule();
		vi.advanceTimersByTime(50);
		expect(flush).toHaveBeenCalledTimes(2);
	});
	it('cancel drops what is queued; schedule works again after', () => {
		vi.useFakeTimers();
		const flush = vi.fn();
		const c = coalesce(flush);
		c.schedule();
		c.cancel();
		vi.advanceTimersByTime(100);
		expect(flush).not.toHaveBeenCalled();
		c.cancel(); // (twice: fine)
		c.schedule();
		vi.advanceTimersByTime(50);
		expect(flush).toHaveBeenCalledOnce();
	});
	it('a flush that schedules again runs again on the next tick', () => {
		vi.useFakeTimers();
		let n = 0;
		const c = coalesce(() => {
			if (++n < 3) c.schedule();
		});
		c.schedule();
		vi.advanceTimersByTime(500);
		expect(n).toBe(3);
	});
});

describe('server', () => {
	it('is never authoring', () => expect(is_authoring()).toBe(false));
	it('load_bridge: one shared promise of the bridge module', async () => {
		const a = load_bridge();
		expect(load_bridge()).toBe(a);
		const bridge = await a;
		expect(typeof bridge.subscribe_to_editor).toBe('function');
		expect(typeof bridge.editor_listener).toBe('function');
	});
});
