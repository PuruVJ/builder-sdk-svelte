// @vitest-environment happy-dom
// internal/editor.ts against the official functions/register.ts, set-editor-settings.ts and
// register-component.ts: the same messages, the same serialized functions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Mod = typeof import('../../src/lib/internal/editor.js');
type Official = typeof import('../../node_modules/@builder.io/sdk-svelte/src/functions/register') &
	typeof import('../../node_modules/@builder.io/sdk-svelte/src/functions/set-editor-settings') &
	typeof import('../../node_modules/@builder.io/sdk-svelte/src/functions/register-component');

let ours: Mod;
let official: Official;
let posted: Array<[unknown, string]>;

beforeEach(async () => {
	// fresh modules: both keep module-level registries / settings
	vi.resetModules();
	ours = await import('../../src/lib/internal/editor.js');
	official = {
		...(await import('../../node_modules/@builder.io/sdk-svelte/src/functions/register')),
		...(await import('../../node_modules/@builder.io/sdk-svelte/src/functions/set-editor-settings')),
		...(await import('../../node_modules/@builder.io/sdk-svelte/src/functions/register-component'))
	} as Official;
	posted = [];
	vi.spyOn(window, 'postMessage').mockImplementation(((m: unknown, o: string) => void posted.push([m, o])) as never);
});
afterEach(() => vi.restoreAllMocks());

/** What each side posts for the same calls. */
function both(run: (side: { register: Mod['register']; register_action: Mod['register_action']; set_editor_settings: Mod['set_editor_settings'] }) => void) {
	run(ours);
	const a = posted.splice(0);
	run({ register: official.register, register_action: official.registerAction as never, set_editor_settings: official.setEditorSettings as never });
	const b = posted.splice(0);
	return { ours: a, official: b };
}

describe('register (official register)', () => {
	it('insertMenu, plugin (functions serialized), any type', () => {
		const calls = [
			['insertMenu', { name: 'Mine', items: [{ name: 'Hero', item: { component: { name: 'Hero' } } }], priority: 2 }],
			['plugin', { id: 'p', onSave: (x: number) => x + 1, nested: { fn() { return 1; } } }],
			['editor.toolbarButton', { label: 'ü✓', handler: () => 0 }],
			['insertMenu', {}]
		] as const;
		const r = both((side) => {
			for (const [type, info] of calls) side.register(type, info);
		});
		expect(r.ours).toEqual(r.official);
		expect(r.ours[1][0]).toMatchObject({ type: 'builder.register', data: { type: 'plugin', info: { onSave: 'return ((x) => x + 1).apply(this, arguments)' } } });
	});

	it('framed: posts to the parent AND the window (official)', async () => {
		const parent_post = vi.fn();
		const desc = Object.getOwnPropertyDescriptor(window, 'parent');
		Object.defineProperty(window, 'parent', { configurable: true, get: () => ({ postMessage: parent_post }) });
		try {
			ours.register('insertMenu', { name: 'x' });
			expect(parent_post).toHaveBeenCalledWith({ type: 'builder.register', data: { type: 'insertMenu', info: { name: 'x' } } }, '*');
			expect(posted).toEqual([[{ type: 'builder.register', data: { type: 'insertMenu', info: { name: 'x' } } }, '*']]);
		} finally {
			if (desc) Object.defineProperty(window, 'parent', desc);
			else delete (window as { parent?: unknown }).parent;
		}
	});

	it('a postMessage that throws is logged at debug', () => {
		vi.mocked(window.postMessage).mockImplementation(() => {
			throw new Error('cloned');
		});
		const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
		expect(() => ours.register('x', { fn: Symbol('s') })).not.toThrow();
		expect(debug).toHaveBeenCalledWith('Could not postmessage', expect.any(Error));
	});
});

describe('registerAction (official registerAction)', () => {
	it('the action as source, the rest cloned', () => {
		const action = () => ({
			name: 'Add to cart',
			id: '@me:add',
			kind: 'function' as const,
			inputs: [{ name: 'sku', type: 'string' }],
			action: (o: Record<string, unknown>) => `addToCart(${o.sku})`
		});
		const r = both((side) => {
			side.register_action(action());
			side.register_action({ ...action(), action: undefined });
		});
		expect(r.ours).toEqual(r.official);
		expect((r.ours[0][0] as { data: { action: string } }).data.action).toBe('(o) => `addToCart(${o.sku})`');
	});
});

describe('setEditorSettings (official setEditorSettings)', () => {
	it('settings accumulate across calls', () => {
		const r = both((side) => {
			side.set_editor_settings({ customInsertMenu: true });
			side.set_editor_settings({ other: 1 } as never);
			side.set_editor_settings({ customInsertMenu: false });
		});
		expect(r.ours).toEqual(r.official);
		expect(r.ours.at(-1)![0]).toEqual({ type: 'builder.settingsChange', data: { customInsertMenu: false, other: 1 } });
	});
});

describe('serialize_including_functions (official serializeIncludingFunctions)', () => {
	// Every function syntax the official comment lists, and more.
	const obj = {
		method(a: number) {
			return a * 2;
		},
		async asyncMethod() {
			return 1;
		},
		*gen() {
			yield 1;
		},
		get getter() {
			return 'got';
		}
	};
	const fns: Record<string, unknown> = {
		arrow: (a: number) => a + 1,
		arrowNoParens: eval('a => a + 1'),
		arrowSpaced: eval('a_1   => a_1'),
		asyncArrow: async (a: number) => a,
		asyncArrowNoParens: eval('async a => a'),
		fn: function named(a: number) {
			return a;
		},
		anon: eval('(function (a) { return a; })'),
		asyncFn: async function () {
			return 1;
		},
		method: obj.method,
		asyncMethod: obj.asyncMethod,
		gen: obj.gen,
		native: Math.max,
		bound: function (this: unknown) {
			return this;
		}.bind(null),
		klass: class A {},
		unicodeArrow: eval('ü => ü'),
		dollar: eval('$ => $')
	};
	for (const [name, fn] of Object.entries(fns))
		it(name, () => {
			const info = { name: 'X', inputs: [{ name: 'i', onChange: fn }], fn, nested: [[fn]] };
			expect(ours.serialize_including_functions(info)).toEqual(official.serializeIncludingFunctions(info as never));
		});

	it('the serialized source runs as the function (the shapes it supports)', () => {
		const run = (s: string, ...args: unknown[]) => new Function(s).apply(null, args);
		const out = ours.serialize_including_functions(fns) as Record<string, string>;
		expect(run(out.arrow, 1)).toBe(2);
		expect(run(out.arrowNoParens, 1)).toBe(2);
		expect(run(out.fn, 5)).toBe(5);
		expect(run(out.method, 4)).toBe(8);
		expect(run(out.anon, 3)).toBe(3);
		// (an async METHOD serializes to invalid code — official serializeFn, kept byte for byte)
		expect(() => new Function(out.asyncMethod)).toThrow(SyntaxError);
	});

	it('non-functions: as JSON (getters read, undefined dropped, NaN null, dates strings)', () => {
		const info = { obj, u: undefined, n: NaN, i: Infinity, d: new Date(0), nested: { a: [undefined, () => 1] }, s: Symbol('x') };
		expect(ours.serialize_including_functions(info)).toEqual(official.serializeIncludingFunctions(info as never));
	});

	it('a cycle throws, as the official', () => {
		const a: Record<string, unknown> = {};
		a.self = a;
		expect(() => ours.serialize_including_functions(a)).toThrow(TypeError);
		expect(() => official.serializeIncludingFunctions(a as never)).toThrow(TypeError);
	});

	it('create_register_component_message (official createRegisterComponentMessage)', () => {
		const info = { name: 'Hero', inputs: [{ name: 'title', type: 'string', onChange: (o: unknown) => o }], models: ['page'], canHaveChildren: true };
		expect(ours.create_register_component_message(info)).toEqual(official.createRegisterComponentMessage(info as never));
	});
});
