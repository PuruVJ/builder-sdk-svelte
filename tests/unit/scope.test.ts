// internal/scope.ts: state layering, writes to root, repeat items, the builderContext store.
import { afterEach, describe, expect, it, vi } from 'vitest';
// (the official block list pulls in its evaluator: the browser runtime stands in for the placeholder)
vi.mock('placeholder-runtime', async () => ({
	evaluator: (await import('../../node_modules/@builder.io/sdk-svelte/src/functions/evaluate/browser-runtime/browser')).runInBrowser
}));
import { get, readable, writable } from 'svelte/store';
import { create_content, type ContentInput } from '../../src/lib/internal/content.js';
import { SCOPE_BRAND, Scope, scope_of_store } from '../../src/lib/internal/scope.js';
import type { RegisteredComponent } from '../../src/lib/types.js';

afterEach(() => vi.restoreAllMocks());

function setup(input: Partial<ContentInput> = {}) {
	let v = 0;
	const bump = vi.fn(() => {
		v++;
	});
	const { ctx, scope } = create_content(
		{ model: 'page', content: { id: 'c1', data: { blocks: [], state: { a: 1, nested: { deep: 1 } } } }, ...input } as ContentInput,
		() => v,
		bump
	);
	return { ctx, scope, bump, bump_version: () => v++ };
}

describe('Scope.state', () => {
	it('the root scope reads root state itself', () => {
		const { ctx, scope } = setup();
		expect(scope.state()).toBe(ctx.root);
		expect(scope.local).toBeUndefined();
	});

	it('local over root, cached per version, rebuilt on a bump', () => {
		const { ctx, bump_version } = setup();
		const s = new Scope(ctx, { a: 'local', b: 2 });
		const first = s.state();
		expect(first).toEqual({ a: 'local', b: 2, nested: { deep: 1 } });
		expect(s.state()).toBe(first);
		// root replaced without a bump: the cached view is still served
		ctx.root = { a: 9, c: 3 };
		expect(s.state()).toBe(first);
		bump_version();
		const second = s.state();
		expect(second).not.toBe(first);
		expect(second).toEqual({ a: 'local', b: 2, c: 3 });
	});

	it('globals and context come from the content', () => {
		const context = { x: 1 };
		const { ctx, scope } = setup({ context });
		expect(scope.context).toBe(context);
		expect(scope.globals).toBe(ctx.globals);
		expect(new Scope(ctx).context).toBe(context);
	});
});

describe('Scope.writable_state', () => {
	it('a write reaches root state through root_set_state and bumps', () => {
		const { ctx, scope, bump } = setup();
		const ws = scope.writable_state();
		ws.x = 5;
		expect(ctx.root.x).toBe(5);
		expect(bump).toHaveBeenCalledTimes(1);
	});

	it('nested writes reach root', () => {
		const { ctx, scope, bump } = setup();
		(scope.writable_state().nested as Record<string, unknown>).deep = 2;
		expect((ctx.root.nested as Record<string, unknown>).deep).toBe(2);
		expect(bump).toHaveBeenCalled();
	});

	it('reads prefer local; writing a local key throws', () => {
		const { ctx } = setup();
		const s = new Scope(ctx, { a: 'local' });
		const ws = s.writable_state();
		expect(ws.a).toBe('local');
		expect(() => {
			ws.a = 1;
		}).toThrow('read-only');
		ws.other = 1;
		expect(ctx.root.other).toBe(1);
	});

	it('a root replaced by root_set_state is what the next writable_state writes to', () => {
		const { ctx, scope } = setup();
		ctx.root_set_state({ fresh: true });
		scope.writable_state().y = 1;
		expect(ctx.root).toEqual({ fresh: true, y: 1 });
	});
});

describe('Scope.item', () => {
	it('builds the official repeat-item local state', () => {
		const { ctx, scope } = setup();
		const it0 = scope.item('fooItem', { v: 1 }, 3);
		expect(it0).toBeInstanceOf(Scope);
		expect(it0.ctx).toBe(ctx);
		expect(it0.local).toEqual({ $index: 3, $item: { v: 1 }, fooItem: { v: 1 }, $fooItemIndex: 3 });
		expect(it0.state()).toMatchObject({ a: 1, fooItem: { v: 1 }, $index: 3 });
	});

	it('nested items inherit the outer item and shadow $index/$item', () => {
		const { scope } = setup();
		const inner = scope.item('outer', 'O', 0).item('inner', 'I', 1);
		expect(inner.local).toEqual({ $index: 1, $item: 'I', outer: 'O', $outerIndex: 0, inner: 'I', $innerIndex: 1 });
	});

	it('a prototype-ish item name is an own key', () => {
		const { scope } = setup();
		const s = scope.item('__proto__', 1, 0);
		expect(Object.prototype.hasOwnProperty.call(s.local, '__proto__')).toBe(true);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});
});

describe('Scope.store', () => {
	it('is built once per scope, with the official context fields', () => {
		const { ctx, scope } = setup({ apiKey: 'k', apiVersion: 'v3', canTrack: false, nonce: 'n', blocksWrapperProps: { p: 1 } });
		const store = scope.store();
		expect(scope.store()).toBe(store);
		const value = get(store) as Record<string | symbol, unknown>;
		expect(Object.keys(value)).toEqual([
			'content',
			'localState',
			'rootSetState',
			'context',
			'canTrack',
			'apiKey',
			'apiVersion',
			'inheritedStyles',
			'BlocksWrapper',
			'BlocksWrapperProps',
			'nonce',
			'model',
			'rootState',
			'componentInfos'
		]);
		expect(value.content).toBe(ctx.content);
		expect(value.localState).toBeUndefined();
		expect(value.context).toBe(ctx.context);
		expect(value.canTrack).toBe(false);
		expect(value.apiKey).toBe('k');
		expect(value.apiVersion).toBe('v3');
		expect(value.inheritedStyles).toEqual({});
		expect(value.BlocksWrapper).toBe('div');
		expect(value.BlocksWrapperProps).toEqual({ p: 1 });
		expect(value.nonce).toBe('n');
		expect(value.model).toBe('page');
		expect(value[SCOPE_BRAND]).toBe(scope);
	});

	it('an item scope store carries its local state', () => {
		const { scope } = setup();
		const item = scope.item('x', 1, 0);
		expect((get(item.store()) as Record<string, unknown>).localState).toBe(item.local);
	});

	it('content and rootState are read live', () => {
		const { ctx, scope } = setup();
		const value = get(scope.store()) as Record<string, unknown>;
		const before = value.rootState;
		expect(before).toBe(ctx.root);
		(value.rootSetState as (s: Record<string, unknown>) => void)({ replaced: 1 });
		expect(value.rootState).toEqual({ replaced: 1 });
		expect(value.rootState).not.toBe(before);
		const next = { id: 'other' };
		ctx.content = next;
		expect(value.content).toBe(next);
	});

	it('subscribers are told on ctx.listeners calls; the last unsubscribe removes the listener', () => {
		const { ctx, scope } = setup();
		const store = scope.store();
		expect(ctx.listeners.size).toBe(0);
		const seen1: unknown[] = [];
		const seen2: unknown[] = [];
		const un1 = store.subscribe((v) => seen1.push(v));
		const un2 = store.subscribe((v) => seen2.push(v));
		expect(ctx.listeners.size).toBe(1);
		expect(seen1).toHaveLength(1);
		for (const l of ctx.listeners) l();
		// same object re-set: svelte stores always notify for objects
		expect(seen1).toHaveLength(2);
		expect(seen2).toHaveLength(2);
		expect(seen1[1]).toBe(seen1[0]);
		un1();
		expect(ctx.listeners.size).toBe(1);
		un2();
		expect(ctx.listeners.size).toBe(0);
		// resubscribing registers again
		const un3 = store.subscribe(() => {});
		expect(ctx.listeners.size).toBe(1);
		un3();
		expect(ctx.listeners.size).toBe(0);
	});

	// Regression: componentInfos was filtered by model; the official Content lists every registered
	// component (defaults + custom, any model), serialized.
	it('componentInfos: serialized, component stripped, every model (official Content)', () => {
		const custom: RegisteredComponent[] = [
			{ name: 'Mine', component: () => 1, inputs: [{ name: 'x', onChange: (o: unknown) => o }] },
			{ name: 'OtherModel', component: () => 1, models: ['section'] }
		];
		const { scope } = setup({ customComponents: custom });
		const value = get(scope.store()) as Record<string, unknown>;
		const infos = value.componentInfos as Record<string, Record<string, unknown>>;
		expect(infos.Mine).toBeDefined();
		expect('component' in infos.Mine).toBe(false);
		expect(infos.Mine.name).toBe('Mine');
		const input = (infos.Mine.inputs as Array<Record<string, unknown>>)[0];
		expect(typeof input.onChange).toBe('string');
		expect(input.onChange).toBe('return ((o) => o).apply(this, arguments)');
		expect(infos.OtherModel).toEqual({ name: 'OtherModel', models: ['section'] });
		expect(infos.Text).toBeDefined();
		// ours-only built-ins are not in the official list
		expect(infos['Builder:RawText']).toBeUndefined();
		expect(Object.keys(infos).slice(-2)).toEqual(['Mine', 'OtherModel']);
		// built on each read (a getter), never shared with the registry
		expect(value.componentInfos).not.toBe(infos);
		expect(value.componentInfos).toEqual(infos);
	});
});

describe('componentInfos vs the official Content', () => {
	it('the same infos, in the same order, as the official default list + custom components', async () => {
		const { getDefaultRegisteredComponents } = await import('../../node_modules/@builder.io/sdk-svelte/src/constants/builder-registered-components');
		const { serializeIncludingFunctions } = await import('../../node_modules/@builder.io/sdk-svelte/src/functions/register-component');
		const custom: RegisteredComponent[] = [
			{ name: 'Mine', component: () => 1, inputs: [{ name: 'x', onChange: (o: unknown) => o }] },
			{ name: 'Text', component: () => 2, inputs: [] },
			{ name: 'Sec', component: () => 1, models: ['section'] }
		];
		// official components/content/content.svelte `componentInfos`
		const official = [...getDefaultRegisteredComponents(), ...custom].reduce(
			(acc: Record<string, unknown>, { component: _, ...info }: any) => ({ ...acc, [info.name]: serializeIncludingFunctions(info) }),
			{}
		);
		const { scope } = setup({ customComponents: custom });
		const ours = (get(scope.store()) as Record<string, unknown>).componentInfos as Record<string, unknown>;
		expect(Object.keys(ours)).toEqual(Object.keys(official));
		// (serialized functions: the same source, indented differently by the two TS transforms)
		const squash = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ') : x)));
		expect(squash(ours)).toEqual(squash(official));
	});
});

describe('scope_of_store', () => {
	it('ours: the scope it stands for', () => {
		const { ctx, scope } = setup();
		expect(scope_of_store(scope.store())).toBe(scope);
		const item = new Scope(ctx, { q: 1 });
		expect(scope_of_store(item.store())).toBe(item);
	});

	it('a plain store: undefined', () => {
		expect(scope_of_store(writable({ a: 1 }))).toBeUndefined();
		expect(scope_of_store(readable(5))).toBeUndefined();
		expect(scope_of_store(writable(null))).toBeUndefined();
		expect(scope_of_store(writable(undefined))).toBeUndefined();
	});

	it('a plain store holding a look-alike brand is honoured (the brand is a registered symbol)', () => {
		const fake = {};
		expect(scope_of_store(writable({ [Symbol.for('puruvj.builder.scope')]: fake }))).toBe(fake);
	});

	it('non-stores: undefined', () => {
		for (const v of [undefined, null, 0, 1, '', 'x', true, {}, [], { subscribe: 1 }, () => {}, Symbol('s')]) {
			expect(scope_of_store(v)).toBeUndefined();
		}
	});

	it('unsubscribes the probe subscription', () => {
		const { ctx, scope } = setup();
		scope_of_store(scope.store());
		expect(ctx.listeners.size).toBe(0);
	});
});
