// The live (editor) leg's pure parts: structural sharing of a re-sent content, the official merge,
// and the id keys a live list renders with. Seeded fuzz included (LIVE_SEEDS overrides the count).
import { describe, expect, it, vi } from 'vitest';
// (vitest here compiles no .svelte: the registry, which imports the built-in blocks, is stubbed)
vi.mock('../src/lib/internal/registry.js', () => ({ lookup: () => undefined }));
import { merge_content, reconcile } from '../src/lib/internal/live.js';
import { Plan } from '../src/lib/internal/compile.js';
import type { Registry } from '../src/lib/internal/registry.js';

const fresh = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const el = (id: string | undefined, rest: Record<string, unknown> = {}) => ({ '@type': '@builder.io/sdk:Element', ...(id ? { id } : {}), ...rest });

describe('reconcile', () => {
	it('gives back the old content itself when nothing changed', () => {
		const prev = { data: { blocks: [el('a', { children: [el('b')] })], state: { x: [1, { y: 2 }] } } };
		expect(reconcile(prev, fresh(prev))).toBe(prev);
	});

	it('shares every untouched block; only the edited path is new', () => {
		const prev = { data: { blocks: [el('a', { children: [el('a1'), el('a2', { component: { name: 'Text', options: { text: 'x' } } })] }), el('b')] } };
		const next = fresh(prev);
		(next.data.blocks[0].children as any)[1].component.options.text = 'y';
		const out = reconcile(prev, next) as typeof prev;
		expect(out).not.toBe(prev);
		expect(out.data.blocks[1]).toBe(prev.data.blocks[1]);
		const [a, pa] = [out.data.blocks[0] as any, prev.data.blocks[0] as any];
		expect(a).not.toBe(pa);
		expect(a.children[0]).toBe(pa.children[0]);
		expect(a.children[1]).not.toBe(pa.children[1]);
		expect(a.children[1].component.options.text).toBe('y');
		expect(out).toEqual(next);
	});

	it('matches blocks by id: an insert at the top keeps every sibling', () => {
		const prev = [el('a'), el('b'), el('c')];
		const next = [el('new'), ...fresh(prev)];
		const out = reconcile(prev, next);
		expect(out[1]).toBe(prev[0]);
		expect(out[2]).toBe(prev[1]);
		expect(out[3]).toBe(prev[2]);
		expect(out).toEqual(next);
	});

	it('never makes two new items the same object (duplicate ids)', () => {
		const prev = [el('dup', { x: 1 }), el('dup', { x: 1 })];
		const out = reconcile(prev, fresh(prev));
		expect(out).toBe(prev);
		const out2 = reconcile([el('dup', { x: 1 })], [el('dup', { x: 1 }), el('dup', { x: 1 })]);
		expect(out2[0]).not.toBe(out2[1]);
	});

	it('sees removed keys, added keys and key order', () => {
		const prev = { a: 1, b: 2 };
		expect(reconcile(prev, { a: 1 })).toEqual({ a: 1 });
		expect(reconcile(prev, { a: 1 })).not.toBe(prev);
		expect(reconcile(prev, { a: 1, b: 2, c: 3 })).not.toBe(prev);
		expect(Object.keys(reconcile(prev, { b: 2, a: 1 }))).toEqual(['b', 'a']);
		expect(reconcile({ a: undefined }, {})).toEqual({});
	});

	it('handles type changes, nulls, NaN and odd keys', () => {
		expect(reconcile({ a: [1] }, { a: { 0: 1 } })).toEqual({ a: { 0: 1 } });
		expect(reconcile([1], { 0: 1 })).toEqual({ 0: 1 });
		expect(reconcile(null, { a: 1 })).toEqual({ a: 1 });
		expect(reconcile({ a: 1 }, null)).toBe(null);
		const prev = { n: NaN };
		expect(reconcile(prev, { n: NaN })).toEqual({ n: NaN });
		const odd = JSON.parse('{"__proto__": {"polluted": 1}, "constructor": 2}');
		const out = reconcile({}, odd);
		expect(Object.keys(out)).toEqual(['__proto__', 'constructor']);
		expect(({} as any).polluted).toBeUndefined();
		expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
	});

	it('survives very deep content', () => {
		let prev: any = { v: 0 };
		for (let i = 0; i < 20000; i++) prev = { child: prev };
		const next = fresh(prev);
		expect(() => reconcile(prev, next)).not.toThrow();
	});

	it('fuzz: the result always deep-equals the new content and never mutates either side', () => {
		const seeds = Number(process.env.LIVE_SEEDS || 300);
		for (let seed = 1; seed <= seeds; seed++) {
			let s = seed;
			const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
			const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
			const value = (depth: number): unknown => {
				const r = rand();
				if (depth > 4 || r < 0.3) return pick([1, 'x', null, true, 0, '', 2.5]);
				if (r < 0.6) return Array.from({ length: Math.floor(rand() * 4) }, () => (rand() < 0.5 ? el(pick(['a', 'b', 'c', undefined]), { v: value(depth + 1) }) : value(depth + 1)));
				const o: Record<string, unknown> = {};
				for (let i = Math.floor(rand() * 4); i > 0; i--) o[pick(['a', 'b', 'c', 'id', 'children'])] = value(depth + 1);
				return o;
			};
			const mutate = (v: unknown, depth: number): unknown => {
				if (rand() < 0.15 || depth > 5) return value(depth);
				if (Array.isArray(v)) {
					const out = v.map((x) => (rand() < 0.3 ? mutate(x, depth + 1) : x));
					if (rand() < 0.2) out.splice(Math.floor(rand() * (out.length + 1)), 0, value(depth + 1));
					if (rand() < 0.2 && out.length) out.splice(Math.floor(rand() * out.length), 1);
					if (rand() < 0.1) out.reverse();
					return out;
				}
				if (v && typeof v === 'object') {
					const out: Record<string, unknown> = {};
					for (const k in v as object) if (rand() > 0.1) out[k] = rand() < 0.3 ? mutate((v as any)[k], depth + 1) : (v as any)[k];
					return out;
				}
				return v;
			};
			const prev = value(0);
			const next = fresh(mutate(prev, 0));
			const prev_json = JSON.stringify(prev);
			const next_json = JSON.stringify(next);
			const out = reconcile(prev, next);
			expect(JSON.stringify(out), `seed ${seed}`).toBe(next_json);
			expect(JSON.stringify(prev), `seed ${seed}`).toBe(prev_json);
			expect(JSON.stringify(next), `seed ${seed}`).toBe(next_json);
			if (prev_json === next_json) expect(out, `seed ${seed}`).toBe(prev);
		}
	});
});

describe('merge_content (official mergeNewContent)', () => {
	it('merges data and meta a level deep and keeps breakpoints unless sent', () => {
		const cur = { id: 'x', data: { blocks: [1], state: { a: 1 } }, meta: { breakpoints: { small: 500 }, k: 1 } };
		expect(merge_content(cur as never, { data: { state: { b: 2 } } } as never)).toEqual({
			id: 'x',
			data: { blocks: [1], state: { b: 2 } },
			meta: { breakpoints: { small: 500 }, k: 1 }
		});
		expect(merge_content(undefined, { id: 'y' } as never)).toEqual({ id: 'y', data: {}, meta: { breakpoints: undefined } });
	});
});

describe('Plan.key', () => {
	const plan = (live: boolean) =>
		new Plan({ registry: { by_name: new Map() } as unknown as Registry, model: 'page', locale: undefined, breakpoints: undefined, live });

	it('static: the block object itself', () => {
		const list = [el('a')];
		expect(plan(false).key(list, list[0] as never)).toBe(list[0]);
	});

	it('live: the id, unique within the list (duplicates, missing ids, empty ids)', () => {
		const list = [el('a'), el('a'), el(undefined), el('b'), el(''), el('a')];
		const p = plan(true);
		const keys = list.map((b) => p.key(list, b as never));
		expect(keys).toEqual(['a', 'a~1', '#2', 'b', '#4', 'a~2']);
		expect(new Set(keys).size).toBe(list.length);
		// a re-sent list (new objects, same ids) keys the same
		const again = fresh(list);
		expect(again.map((b) => p.key(again, b as never))).toEqual(keys);
	});

	it('live: an id that looks like a generated key does not collide', () => {
		const list = [el(undefined), el('#0')];
		const p = plan(true);
		const keys = list.map((b) => p.key(list, b as never));
		expect(new Set(keys).size).toBe(2);
	});
});
