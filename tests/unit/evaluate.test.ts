// evaluate.ts vs the official functions/evaluate/evaluate.ts + helpers.ts (parseCode, flattenState,
// getBuilderGlobals), run through the official browser runtime (the build aliases placeholder-runtime).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('placeholder-runtime', async () => ({
	evaluator: (await import('../../node_modules/@builder.io/sdk-svelte/src/functions/evaluate/browser-runtime/browser')).runInBrowser
}));

import {
	evaluate as officialEvaluate,
	getSimpleExpressionGetPath
} from '../../node_modules/@builder.io/sdk-svelte/src/functions/evaluate/evaluate';
import { flattenState, getBuilderGlobals, parseCode } from '../../node_modules/@builder.io/sdk-svelte/src/functions/evaluate/helpers';
import { compile_code, evaluate, flatten_state, parse_code, run, type EvalScope, type Globals } from '../../src/lib/internal/evaluate';

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

type State = Record<string, unknown>;

/** A scope as scope.ts builds it: local over root for reads, flatten_state for writes. */
function scope_of(root: State, local?: State, set_state?: (s: State) => void, context: State = {}): EvalScope {
	return {
		state: () => (local ? { ...root, ...local } : root),
		writable_state: () => flatten_state(root, local, set_state),
		globals: getBuilderGlobals() as Globals,
		context
	};
}

const ROOT = (): State => ({
	a: 1,
	s: 'str',
	n: null,
	u: undefined,
	z: 0,
	list: [1, 2, 3],
	obj: { x: 'x', deep: { y: 2 } },
	shadow: 'root'
});
const LOCAL = (): State => ({ shadow: 'local', item: { name: 'it' }, index: 2 });
const CONTEXT = { k: 'ctx', nested: { v: 1 } };

/** Results compared as values (functions by type: Builder's methods are fresh closures). */
function norm(v: unknown, seen = new WeakSet()): unknown {
	if (typeof v === 'function') return 'function';
	if (v && typeof v === 'object') {
		if (seen.has(v)) return '[cycle]';
		seen.add(v);
		if (Array.isArray(v)) return v.map((x) => norm(x, seen));
		return Object.fromEntries(Object.keys(v).map((k) => [k, norm((v as State)[k], seen)]));
	}
	return v;
}

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	errors = vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	vi.restoreAllMocks();
});

function both(code: string, opts: { local?: boolean; is_expression?: boolean } = {}) {
	const local = opts.local ? LOCAL() : undefined;
	const ours = evaluate(code, scope_of(ROOT(), local, undefined, CONTEXT), opts.is_expression ?? true);
	const official = officialEvaluate({
		code,
		context: CONTEXT,
		localState: opts.local ? LOCAL() : undefined,
		rootState: ROOT(),
		rootSetState: undefined,
		isExpression: opts.is_expression ?? true
	} as Parameters<typeof officialEvaluate>[0]);
	return { ours, official };
}

const EXPRESSIONS = [
	'1 + 1',
	'state.a',
	'state.a + 1',
	'state.obj.deep.y',
	'state.obj["x"]',
	'state.list.map(x => x * 2)',
	'state.list.length',
	'state.s.toUpperCase()',
	'state.missing',
	'state.z || "fallback"',
	'state.n ?? "nullish"',
	'state.missing?.x',
	'return state.a',
	'return state.a + 1',
	'var x = 1; return x + state.a',
	'const y = state.list; return y[1]',
	'state.a; state.s',
	'"a;b"',
	' return 5',
	'if (state.a) return "yes"; return "no"',
	'typeof Builder',
	'Builder.isServer',
	'Builder.isBrowser',
	'Builder.isEditing',
	'builder === Builder',
	'typeof Builder.trackConversion',
	'Object.keys(Builder).sort().join()',
	'typeof context',
	'context.k',
	'context.nested.v',
	'event',
	'typeof event',
	'state.shadow',
	'state.item && state.item.name',
	'state.index * 2',
	'`${state.s}-${state.a}`',
	'JSON.stringify(state.obj)',
	'[state.a, state.s]',
	'({ a: state.a })',
	'new Date(0).toISOString()',
	'null',
	'undefined',
	'NaN',
	'0/0',
	'"ünïcode 😀"',
	'(function(){ return this })() === undefined',
	'arguments.length'
];
const THROWING = ['state.missing.x + 1', 'null.x', 'throw new Error("boom")', 'undefinedVariable', 'state.s()', 'state.n.x + 1'];
const SYNTAX = ['(', 'return return', 'state.', '}{', 'await 1', 'a b c', 'return (', '"unterminated'];

describe('evaluate vs official evaluate', () => {
	it.each(EXPRESSIONS)('%s', (code) => {
		for (const local of [false, true]) {
			const { ours, official } = both(code, { local });
			expect(norm(ours), `${code} (local: ${local})`).toEqual(norm(official));
		}
	});

	it.each(THROWING)('throws -> undefined: %s', (code) => {
		const { ours, official } = both(code);
		expect(official).toBeUndefined();
		expect(ours).toBeUndefined();
		expect(errors).toHaveBeenCalledWith(expect.stringMatching(/^\[Builder\.io\]: Failed code evaluation: ./), { code });
	});

	it.each(SYNTAX)('syntax error -> undefined: %s', (code) => {
		const { ours, official } = both(code);
		expect(official).toBeUndefined();
		expect(ours).toBeUndefined();
	});

	it('empty / whitespace code is undefined, nothing compiled or logged', () => {
		for (const code of ['', '   ', '\n\t']) {
			expect(both(code)).toEqual({ ours: undefined, official: undefined });
		}
		expect(errors).not.toHaveBeenCalled();
	});

	it('statements (is_expression false) are not wrapped in a return', () => {
		for (const code of ['state.a', '1 + 1', 'return state.a', 'var q = 2; return q']) {
			const { ours, official } = both(code, { is_expression: false });
			// (`state.a` takes the official simple-getter path, which ignores isExpression)
			if (getSimpleExpressionGetPath(code)) continue;
			expect(ours, code).toEqual(official);
		}
		expect(evaluate('1 + 1', scope_of(ROOT()), false)).toBeUndefined();
	});

	it('async code returns a promise with the same value', async () => {
		for (const code of ['Promise.resolve(state.a)', 'return (async () => { await null; return state.s })()', '(async () => state.obj.x)()']) {
			const { ours, official } = both(code);
			expect(ours).toBeInstanceOf(Promise);
			expect(official).toBeInstanceOf(Promise);
			expect(await ours).toEqual(await official);
		}
	});

	it('local state wins over root state', () => {
		expect(evaluate('state.shadow', scope_of(ROOT(), LOCAL()))).toBe('local');
		expect(evaluate('state.shadow', scope_of(ROOT()))).toBe('root');
		expect(evaluate('state.a', scope_of(ROOT(), LOCAL()))).toBe(1);
	});

	it('a seeded sweep of 400 generated expressions', () => {
		const r = mulberry32(0xe7a1);
		const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
		const atoms = ['state.a', 'state.s', 'state.z', 'state.n', 'state.u', 'state.list', 'state.obj.x', 'state.missing', 'state.shadow', '1', '"q"', 'context.k', 'Builder.isServer', 'event', 'state.list[0]', 'state.obj.deep'];
		const ops = [' + ', ' - ', ' * ', ' === ', ' && ', ' || ', ' ?? ', ' < '];
		const gen = (d: number): string => {
			const k = r();
			if (d > 2 || k < 0.35) return pick(atoms);
			if (k < 0.5) return '(' + gen(d + 1) + ')';
			if (k < 0.6) return '!' + gen(d + 1);
			if (k < 0.65) return 'typeof ' + gen(d + 1);
			if (k < 0.7) return gen(d + 1) + '.missing.deep';
			return gen(d + 1) + pick(ops) + gen(d + 1);
		};
		let compared = 0;
		for (let i = 0; i < 400; i++) {
			let code = gen(0);
			const form = r();
			if (form < 0.15) code = 'return ' + code;
			else if (form < 0.25) code = 'var v = ' + code + '; return v';
			else if (form < 0.3) code = code + ';';
			// The official simple-getter path (`state.x.y`) is covered on its own below.
			if (getSimpleExpressionGetPath(code.trim())) continue;
			const local = r() < 0.5;
			const { ours, official } = both(code, { local });
			expect(norm(ours), `${code} (local: ${local})`).toEqual(norm(official));
			compared++;
		}
		expect(compared).toBeGreaterThan(300);
	});
});

describe('the official simple-getter path (`state.a.b`)', () => {
	it('same values where nothing on the path is null', () => {
		for (const code of ['state.a', 'state.obj.deep.y', 'state.missing', 'state.list.length', ' state.s ', 'return state.a']) {
			const { ours, official } = both(code);
			expect(ours, code).toEqual(official);
		}
	});

	it('state.a.b on an undefined `a`: undefined in both', () => {
		const { ours, official } = both('state.missing.x');
		expect(ours).toBeUndefined();
		expect(official).toBeUndefined();
	});

	// BUG: the official evaluate reads `state.x.y` (optionally `return `-prefixed, optionally ending in
	// `;`, and rollup's `var _virtual_index=state.x.y;return _virtual_index`) with `get`, not by running
	// code. evaluate.ts has no such path, so: (1) `state.x;` is a statement and yields undefined; (2) a
	// missing link logs `Failed code evaluation` where the official is silent (log noise on every SSR of
	// such a binding); (3) a null link gives undefined where the official gives null.
	it.fails('`state.a;` (trailing semicolon) yields the value', () => {
		const { ours, official } = both('state.a;');
		expect(official).toBe(1);
		expect(ours).toBe(1);
	});

	it.fails('`state.missing.x` and its rollup form log nothing', () => {
		both('var _virtual_index=state.missing.x;return _virtual_index');
		both('state.missing.x');
		expect(errors).not.toHaveBeenCalled();
	});

	it.fails('`state.n.x` with `n` null gives null', () => {
		const { ours, official } = both('state.n.x');
		expect(official).toBeNull();
		expect(ours).toBeNull();
	});
});

describe('parse_code vs official parseCode', () => {
	const CODES = ['a', 'a;', 'return a', ' return a', 'x return a', 'returned', 'returnx', '  return  a', 'a; return b', '"return "', 'a\nreturn b', 'return', ''];

	it.each(CODES)('%j', (code) => {
		for (const is_expression of [true, false]) expect(parse_code(code, is_expression)).toBe(parseCode(code, { isExpression: is_expression }));
	});

	it('a seeded sweep of 500 strings', () => {
		const r = mulberry32(3);
		const parts = ['a', ' ', ';', 'return', ' return ', '\n', '(', ')', 'state.x', '"', 'r'];
		for (let i = 0; i < 500; i++) {
			const code = Array.from({ length: Math.floor(r() * 6) }, () => parts[Math.floor(r() * parts.length)]).join('');
			const is_expression = r() < 0.7;
			expect(parse_code(code, is_expression), code).toBe(parseCode(code, { isExpression: is_expression }));
		}
	});
});

describe('compile_code and its cache', () => {
	it('the same code compiles once', () => {
		const a = compile_code('state.cache_test_1 + 1');
		expect(a).toBe(compile_code('state.cache_test_1 + 1'));
		expect(typeof a).toBe('function');
	});

	it('expression and statement forms are cached apart', () => {
		const e = compile_code('7');
		const s = compile_code('7', false);
		expect(e).not.toBe(s);
		expect(run(e, scope_of({}), '7')).toBe(7);
		expect(run(s, scope_of({}), '7')).toBeUndefined();
		expect(compile_code('7', true)).toBe(e);
		expect(compile_code('7', false)).toBe(s);
	});

	it('a syntax error is null, logged once, and cached as null', () => {
		expect(compile_code('((( cache_bad')).toBeNull();
		expect(compile_code('((( cache_bad')).toBeNull();
		expect(errors).toHaveBeenCalledTimes(1);
		expect(errors.mock.calls[0][0]).toMatch(/^\[Builder\.io\]: Failed code evaluation: /);
		expect(errors.mock.calls[0][1]).toEqual({ code: '((( cache_bad' });
	});

	it('the compiled function takes state, Builder, builder, context, event', () => {
		const fn = compile_code('[state, Builder, builder, context, event]')!;
		expect(fn(1, 2 as never, 3 as never, 4, 5)).toEqual([1, 2, 3, 4, 5]);
	});

	it(`holds at most 5000 code strings, dropping the oldest first`, async () => {
		vi.resetModules();
		const fresh = await import('../../src/lib/internal/evaluate');
		const first = fresh.compile_code('0');
		const second = fresh.compile_code('1');
		for (let i = 2; i < 5000; i++) fresh.compile_code(String(i));
		// 5000 entries: nothing evicted yet
		expect(fresh.compile_code('0')).toBe(first);
		expect(fresh.compile_code('1')).toBe(second);
		fresh.compile_code('5000'); // evicts '0' (insertion order; a hit does not refresh it)
		expect(fresh.compile_code('1')).toBe(second);
		const again = fresh.compile_code('0'); // recompiled, evicting '1'
		expect(again).not.toBe(first);
		expect(again!({}, {} as never, {} as never, {}, undefined)).toBe(0);
		expect(fresh.compile_code('1')).not.toBe(second);
		expect(fresh.compile_code('4999')).toBe(fresh.compile_code('4999'));
	});

	it('the expression/statement key: an `e`/`s` prefix cannot collide with code', async () => {
		vi.resetModules();
		const fresh = await import('../../src/lib/internal/evaluate');
		const a = fresh.compile_code('s1', true); // key 'es1'
		const b = fresh.compile_code('1', false); // key 's1'
		const c = fresh.compile_code('es1', false); // key 'ses1'
		expect(new Set([a, b, c]).size).toBe(3);
	});
});

describe('run', () => {
	it('null fn is undefined', () => {
		expect(run(null, scope_of({}), 'x')).toBeUndefined();
	});

	it('passes the event and the scope globals/context', () => {
		const scope = scope_of({ a: 1 }, undefined, undefined, { c: 3 });
		const fn = compile_code('[state.a, context.c, event.type, Builder === builder, Builder.isServer]');
		expect(run(fn, scope, 'x', { type: 'click' })).toEqual([1, 3, 'click', true, true]);
	});

	it('a throw logs and yields undefined', () => {
		expect(run(compile_code('null.run_throw'), scope_of({}), 'null.run_throw')).toBeUndefined();
		expect(errors).toHaveBeenCalledWith(expect.stringMatching(/^\[Builder\.io\]: Failed code evaluation: /), { code: 'null.run_throw' });
	});

	it('writable: writes go through flatten_state to root state and the setter', () => {
		const root: State = { count: 1, nested: { v: 1 } };
		const calls: State[] = [];
		const scope = scope_of(root, { item: 1 }, (s) => calls.push(s));
		run(compile_code('state.count = state.count + state.item; state.nested.v = 5', false), scope, 'x', undefined, true);
		expect(root).toEqual({ count: 2, nested: { v: 5 } });
		expect(calls).toHaveLength(2);
		expect(calls[0]).toBe(root);
		expect(calls[1]).toBe(root);
	});

	it('writable event code vs the official (which always runs through flattenState)', () => {
		const code = 'state.count = (state.count || 0) + 1; state.obj.x = event.v; state.fresh = state.shadow';
		const ours_root = ROOT();
		const off_root = ROOT();
		const ours_calls: unknown[] = [];
		const off_calls: unknown[] = [];
		const event = { v: 'from-event' };
		run(compile_code(code, false), scope_of(ours_root, LOCAL(), (s) => ours_calls.push(structuredClone(s))), code, event, true);
		officialEvaluate({
			code,
			context: {},
			localState: LOCAL(),
			rootState: off_root,
			rootSetState: (s: State) => off_calls.push(structuredClone(s)),
			event: event as unknown as Event,
			isExpression: false
		} as Parameters<typeof officialEvaluate>[0]);
		expect(ours_root).toEqual(off_root);
		expect(ours_calls).toEqual(off_calls);
	});
});

describe('flatten_state vs official flattenState', () => {
	type Op = { kind: 'get'; path: string[] } | { kind: 'set'; path: string[]; value: unknown };

	function play(make: typeof flatten_state, root: State, local: State | undefined, with_setter: boolean, ops: Op[]) {
		const calls: unknown[] = [];
		const setter = with_setter ? (s: State) => calls.push({ is_root: s === root, snapshot: structuredClone(s) }) : undefined;
		const proxy = make(root, local, setter);
		const results: unknown[] = [];
		for (const op of ops) {
			try {
				let node: State = proxy;
				const last = op.path[op.path.length - 1];
				for (const k of op.path.slice(0, -1)) node = node[k] as State;
				if (op.kind === 'get') results.push(norm(node[last]));
				else {
					node[last] = op.value;
					results.push('ok');
				}
			} catch (e) {
				results.push('threw: ' + (e as Error).message);
			}
		}
		return { results, calls, root: structuredClone(root) };
	}

	const official_make = (root: State, local: State | undefined, setter: ((s: State) => void) | undefined) =>
		flattenState({ rootState: root, localState: local, rootSetState: setter as never }) as State;

	it('a seeded sweep of 300 get/set sequences', () => {
		const r = mulberry32(0xf1a7);
		const keys = ['a', 'obj', 'x', 'deep', 'y', 'shadow', 'item', 'list', '0', 'missing', 'n'];
		for (let i = 0; i < 300; i++) {
			const ops: Op[] = [];
			for (let n = 1 + Math.floor(r() * 6); n > 0; n--) {
				const path = Array.from({ length: 1 + Math.floor(r() * 3) }, () => keys[Math.floor(r() * keys.length)]);
				ops.push(r() < 0.5 ? { kind: 'get', path } : { kind: 'set', path, value: r() < 0.5 ? i : { set: i } });
			}
			const with_local = r() < 0.5;
			const with_setter = r() < 0.7;
			const ours = play(flatten_state, ROOT(), with_local ? LOCAL() : undefined, with_setter, ops);
			const official = play(official_make, ROOT(), with_local ? LOCAL() : undefined, with_setter, ops);
			expect(ours, JSON.stringify({ ops, with_local, with_setter })).toEqual(official);
		}
	});

	it('a write reaches root state and calls the setter with root', () => {
		const root: State = { a: 1 };
		const set = vi.fn();
		flatten_state(root, undefined, set).a = 2;
		expect(root.a).toBe(2);
		expect(set).toHaveBeenCalledWith(root);
	});

	it('a nested write updates the nested object, then calls the setter with root', () => {
		const inner = { v: 1 };
		const root: State = { o: { inner } };
		const set = vi.fn();
		const proxy = flatten_state(root, undefined, set);
		(proxy.o as State).inner = { v: 2 };
		((proxy.o as State).inner as State).v = 3;
		expect(root).toEqual({ o: { inner: { v: 3 } } });
		expect(set).toHaveBeenCalledTimes(2);
		for (const call of set.mock.calls) expect(call[0]).toBe(root);
	});

	it('nested reads stay proxies of the real objects; primitives come back as is', () => {
		const root: State = { o: { v: 1 }, list: [1, 2], s: 's', n: null };
		const proxy = flatten_state(root, undefined, undefined);
		expect(proxy.o).toEqual({ v: 1 });
		expect(proxy.o).not.toBe(root.o);
		expect(Array.isArray(proxy.list)).toBe(true);
		expect(proxy.s).toBe('s');
		expect(proxy.n).toBeNull();
	});

	it('no setter: writes still land in root state', () => {
		const root: State = { o: { v: 1 } };
		const proxy = flatten_state(root, undefined, undefined);
		(proxy.o as State).v = 9;
		proxy.added = true;
		expect(root).toEqual({ o: { v: 9 }, added: true });
	});

	it('local state is read first and is read-only (same message as the official)', () => {
		const root: State = { a: 'root', b: 'root-b' };
		const local: State = { a: 'local' };
		const proxy = flatten_state(root, local, vi.fn());
		expect(proxy.a).toBe('local');
		expect(proxy.b).toBe('root-b');
		const ours = (() => {
			try {
				proxy.a = 1;
			} catch (e) {
				return (e as Error).message;
			}
		})();
		const official = (() => {
			try {
				(official_make({ a: 'root' }, { a: 'local' }, undefined) as State).a = 1;
			} catch (e) {
				return (e as Error).message;
			}
		})();
		expect(ours).toBe('Writing to local state is not allowed as it is read-only.');
		expect(ours).toBe(official);
		expect(root.a).toBe('root');
	});

	it('a local value read through the proxy is the local object itself (not wrapped)', () => {
		const item = { name: 'x' };
		const proxy = flatten_state({}, { item }, undefined);
		expect(proxy.item).toBe(item);
	});

	it('symbol keys and prototype keys', () => {
		const sym = Symbol('k');
		const root: State = { [sym]: 1 } as State;
		const proxy = flatten_state(root, undefined, undefined) as Record<symbol | string, unknown>;
		expect(proxy[sym]).toBe(1);
		expect(typeof proxy.toString).toBe('function');
		expect(typeof proxy.hasOwnProperty).toBe('function');
	});
});
