// internal/content.ts: merged content, initial root state, plan keying, create_content.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { track_mock, official_track_mock, env_calls } = vi.hoisted(() => ({
	track_mock: vi.fn(async () => {}),
	official_track_mock: vi.fn(async () => {}),
	env_calls: { editing: 0 }
}));
vi.mock('../../src/lib/internal/track.js', async (orig) => ({
	...(await orig<typeof import('../../src/lib/internal/track.js')>()),
	track: track_mock,
	get_user_attributes: () => ({ from: 'ours' })
}));
vi.mock('../../src/lib/internal/env.js', async (orig) => {
	const real = await orig<typeof import('../../src/lib/internal/env.js')>();
	return {
		...real,
		is_editing: (...a: Parameters<typeof real.is_editing>) => {
			env_calls.editing++;
			return real.is_editing(...a);
		}
	};
});
vi.mock('../../node_modules/@builder.io/sdk-svelte/src/functions/track/index', () => ({ _track: official_track_mock }));

import {
	create_content,
	initial_root_state,
	live_plan_of,
	merged_content,
	plan_of,
	type ContentInput
} from '../../src/lib/internal/content.js';
import { registry_for } from '../../src/lib/internal/registry.js';
import {
	getContentInitialValue,
	getRootStateInitialValue
} from '../../node_modules/@builder.io/sdk-svelte/src/components/content/content.helpers';
import { getBuilderGlobals } from '../../node_modules/@builder.io/sdk-svelte/src/functions/evaluate/helpers';
import type { BuilderContent } from '../../src/lib/types.js';

// ── seeded PRNG ─────────────────────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const NASTY_KEYS = ['a', 'b', 'locale', 'blocks', 'state', '__proto__', 'constructor', 'toString', '', 'é', '日本', '0', '1e3'];
const NASTY_VALUES: unknown[] = [undefined, null, 0, -0, NaN, Infinity, '', 'x', '😀', true, false, [], {}, { n: 1 }, 'x'.repeat(1000)];

function pick<T>(r: () => number, xs: readonly T[]): T {
	return xs[Math.floor(r() * xs.length)];
}
function rand_obj(r: () => number, max = 4): Record<string, unknown> {
	// JSON.parse so `__proto__` is an own key, as content from the API has it
	const pairs: string[] = [];
	const n = Math.floor(r() * max);
	for (let i = 0; i < n; i++) {
		const v = pick(r, NASTY_VALUES);
		pairs.push(`${JSON.stringify(pick(r, NASTY_KEYS))}:${v === undefined || Number.isNaN(v) || v === Infinity ? 'null' : JSON.stringify(v)}`);
	}
	const obj = JSON.parse(`{${pairs.join(',')}}`);
	// non-JSON values too
	if (r() < 0.3) obj[pick(r, NASTY_KEYS)] = pick(r, NASTY_VALUES);
	return obj;
}
function rand_content(r: () => number): BuilderContent | null | undefined {
	const roll = r();
	if (roll < 0.05) return null;
	if (roll < 0.1) return undefined;
	const content: BuilderContent = { id: 'c' + Math.floor(r() * 3) };
	if (r() < 0.9) {
		const data: Record<string, unknown> = rand_obj(r);
		if (r() < 0.5) data.state = rand_obj(r);
		if (r() < 0.5) {
			const inputs: unknown[] = [];
			const n = Math.floor(r() * 4);
			for (let i = 0; i < n; i++) {
				const input: Record<string, unknown> = {};
				if (r() < 0.8) input.name = pick(r, NASTY_KEYS);
				if (r() < 0.7) input.defaultValue = pick(r, NASTY_VALUES);
				inputs.push(input);
			}
			data.inputs = r() < 0.1 ? null : inputs;
		}
		content.data = data;
	}
	if (r() < 0.3) content.meta = { breakpoints: { small: 500, medium: 900 } };
	return content;
}
function same_entries(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined) {
	expect(Object.keys(a ?? {})).toEqual(Object.keys(b ?? {}));
	for (const k of Object.keys(a ?? {})) expect(Object.is(a![k], b![k]), k).toBe(true);
}

beforeEach(() => {
	track_mock.mockClear();
	official_track_mock.mockClear();
});
afterEach(() => vi.restoreAllMocks());

// ── merged_content ───────────────────────────────────────────────────────────────────────────────
/** official getContentInitialValue, then EnableEditor's mergeNewContent(content) */
function official_merged(content: BuilderContent | null | undefined, data: Record<string, unknown> | undefined) {
	const initial = getContentInitialValue({ content, data } as never) as BuilderContent | undefined;
	if (!initial) return undefined;
	return { ...initial, ...content, data: { ...initial.data, ...content!.data } } as BuilderContent;
}

describe('merged_content', () => {
	it('undefined content stays undefined; no data returns the content itself', () => {
		expect(merged_content(undefined, { a: 1 })).toBeUndefined();
		expect(merged_content(null, { a: 1 })).toBeUndefined();
		const c = { id: 'x', data: {} };
		expect(merged_content(c, undefined)).toBe(c);
	});

	it('data fills only what content.data lacks', () => {
		const c = { id: 'x', data: { blocks: ['own'], title: 'content' }, meta: { m: 1 } } as unknown as BuilderContent;
		const out = merged_content(c, { blocks: ['data'], title: 'data', extra: 1 })!;
		expect(out.data).toEqual({ blocks: ['own'], title: 'content', extra: 1 });
		expect(out.meta).toBe(c.meta);
		expect(out.id).toBe('x');
		expect(c.data).toEqual({ blocks: ['own'], title: 'content' });
	});

	it('content without data takes data whole', () => {
		expect(merged_content({ id: 'x' }, { a: 1 })!.data).toEqual({ a: 1 });
	});

	it('matches the official composition (table + seeded sweep)', () => {
		const r = mulberry32(42);
		for (let i = 0; i < 400; i++) {
			const content = rand_content(r);
			const data = r() < 0.2 ? undefined : rand_obj(r);
			const ours = merged_content(content, data);
			const official = data === undefined ? content ?? undefined : official_merged(content, data);
			if (official === undefined) {
				expect(ours).toBeUndefined();
				continue;
			}
			same_entries(ours!.data, official.data);
			expect(ours!.id).toBe(official.id);
		}
	});
});

// ── initial_root_state ───────────────────────────────────────────────────────────────────────────
describe('initial_root_state vs official getRootStateInitialValue', () => {
	const table: Array<[BuilderContent | null | undefined, Record<string, unknown> | undefined, string | undefined]> = [
		[undefined, undefined, undefined],
		[null, { a: 1 }, 'en'],
		[{ data: { inputs: [{ name: 'a', defaultValue: 1 }, { name: 'b' }, { defaultValue: 3 }, { name: '', defaultValue: 4 }] } }, undefined, undefined],
		[{ data: { inputs: [{ name: 'a', defaultValue: null }], state: { a: 2 } } }, undefined, undefined],
		[{ data: { inputs: [{ name: 'a', defaultValue: 1 }], state: { a: 2 } } }, { a: 3 }, undefined],
		[{ data: { state: { locale: 'x' } } }, { locale: 'y' }, 'z'],
		[{ data: { state: { locale: 'x' } } }, { locale: 'y' }, ''],
		[{ data: { state: null as never } }, undefined, 'en'],
		[{ data: { inputs: null as never } }, undefined, undefined]
	];
	it.each(table)('table %#', (content, data, locale) => {
		same_entries(initial_root_state(content, data, locale), getRootStateInitialValue({ content, data, locale } as never));
	});

	it('seeded sweep', () => {
		const r = mulberry32(7);
		for (let i = 0; i < 500; i++) {
			const content = rand_content(r);
			const data = r() < 0.3 ? undefined : rand_obj(r);
			const locale = pick(r, [undefined, '', 'en-US', 'Default', '__proto__']);
			same_entries(initial_root_state(content, data, locale), getRootStateInitialValue({ content, data, locale } as never));
		}
	});

	it('a `__proto__` input name does not pollute', () => {
		const out = initial_root_state({ data: { inputs: [{ name: '__proto__', defaultValue: { polluted: 1 } }] } }, undefined, undefined);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		expect(Object.keys(out)).toEqual([]);
	});
});

// ── plan_of / live_plan_of ───────────────────────────────────────────────────────────────────────
const block = (id: string, color = 'red') => ({
	'@type': '@builder.io/sdk:Element' as const,
	id,
	responsiveStyles: { large: { color } }
});

describe('plan_of', () => {
	it('keys by the content object', () => {
		const content = { id: 'p1', data: { blocks: [block('builder-p1')] } };
		const a = plan_of({ content, model: 'page' });
		expect(plan_of({ content, model: 'page' })).toBe(a);
		expect(plan_of({ content: { ...content }, model: 'page' })).not.toBe(a);
		expect(a.sheet).toContain('.builder-p1');
	});

	it('keys by data.blocks when only data carries blocks', () => {
		const blocks = [block('builder-d1')];
		const a = plan_of({ content: { id: 'x', data: {} }, data: { blocks }, model: 'page' });
		const b = plan_of({ content: { id: 'y' }, data: { blocks }, model: 'page' });
		expect(b).toBe(a);
		expect(a.sheet).toContain('.builder-d1');
	});

	it('content.data with a `blocks` key wins over data.blocks (even undefined)', () => {
		const content = { id: 'x', data: { blocks: undefined } };
		const blocks = [block('builder-d2')];
		const a = plan_of({ content, data: { blocks }, model: 'page' });
		expect(a.sheet).toBe('');
		expect(plan_of({ content, model: 'page' })).toBe(a);
	});

	it('no content: one shared key', () => {
		expect(plan_of({ content: null, model: 'page' })).toBe(plan_of({ content: undefined, model: 'page' }));
	});

	it('registry, model, locale and breakpoints are part of the key', () => {
		const content = { id: 'k', data: { blocks: [] }, meta: { breakpoints: { small: 500, medium: 800 } } };
		const custom = [{ name: 'X', component: null }];
		const base = plan_of({ content, model: 'page' });
		expect(plan_of({ content, model: 'section' })).not.toBe(base);
		expect(plan_of({ content, model: 'page', locale: 'fr' })).not.toBe(base);
		expect(plan_of({ content, model: 'page', customComponents: custom })).not.toBe(base);
		expect(plan_of({ content, model: 'page', customComponents: custom }).registry).toBe(registry_for(custom));
		expect(base.sizes.small.max).toBe(500);
		expect(base.live).toBe(false);
	});
});

describe('live_plan_of', () => {
	it('one live plan per owner, no sheet', () => {
		const owner = {};
		const content = { id: 'l', data: { blocks: [block('builder-l1')] }, meta: { breakpoints: { xsmall: 300 } } };
		const a = live_plan_of(owner, { content, model: 'page' }, content);
		expect(a.live).toBe(true);
		expect(a.sheet).toBe('');
		expect(a.has_xsmall).toBe(true);
		expect(live_plan_of(owner, { content: { id: 'other' }, model: 'page' }, content)).toBe(a);
		expect(live_plan_of({}, { content, model: 'page' }, content)).not.toBe(a);
		expect(live_plan_of(owner, { content, model: 'page' }, undefined)).not.toBe(a);
	});
});

// ── create_content ───────────────────────────────────────────────────────────────────────────────
function make(input: Partial<ContentInput>, live_owner?: object) {
	let v = 0;
	const bump = vi.fn(() => {
		v++;
	});
	const out = create_content({ model: 'page', content: { id: 'c' }, ...input } as ContentInput, () => v, bump, live_owner);
	return { ...out, bump };
}

describe('create_content', () => {
	it('wires the ctx from the input', () => {
		const link = {};
		const wrapper = {};
		const { ctx, scope } = make({
			content: { id: 'w', data: { state: { s: 1 } } },
			data: { d: 2 },
			context: { c: 3 },
			apiKey: 'k',
			apiVersion: 'v3',
			apiHost: 'h',
			canTrack: false,
			locale: 'en',
			nonce: 'n',
			linkComponent: link,
			blocksWrapper: wrapper,
			blocksWrapperProps: { p: 1 }
		});
		expect(scope.ctx).toBe(ctx);
		expect(ctx.content!.data).toEqual({ state: { s: 1 }, d: 2 });
		expect(ctx.root).toEqual({ s: 1, d: 2, locale: 'en' });
		expect(ctx.context).toEqual({ c: 3 });
		expect([ctx.api_key, ctx.api_version, ctx.api_host, ctx.can_track, ctx.nonce]).toEqual(['k', 'v3', 'h', false, 'n']);
		expect(ctx.link_component).toBe(link);
		expect(ctx.blocks_wrapper).toBe(wrapper);
		expect(ctx.blocks_wrapper_props).toEqual({ p: 1 });
		expect(ctx.registry).toBe(ctx.plan.registry);
		expect(ctx.model).toBe('page');
	});

	it('defaults', () => {
		const { ctx } = make({ content: undefined });
		expect(ctx.content).toBeUndefined();
		expect(ctx.context).toEqual({});
		expect(ctx.nonce).toBe('');
		expect(ctx.blocks_wrapper).toBe('div');
		expect(ctx.blocks_wrapper_props).toEqual({});
		expect(ctx.listeners.size).toBe(0);
	});

	it('a live owner gets the live plan', () => {
		const owner = {};
		expect(make({}, owner).ctx.plan.live).toBe(true);
		expect(make({}).ctx.plan.live).toBe(false);
	});

	it('jsCode runs once; its writes are in root before the first render, without a bump', () => {
		(globalThis as Record<string, unknown>).__js_runs = 0;
		const { ctx, bump } = make({
			content: { id: 'j', data: { jsCode: 'globalThis.__js_runs++; state.x = 1; state.n = (state.n || 0) + 1;', state: { n: 5 } } }
		});
		expect((globalThis as Record<string, unknown>).__js_runs).toBe(1);
		expect(ctx.root).toMatchObject({ x: 1, n: 6 });
		expect(bump).not.toHaveBeenCalled();
		// after setup, a write bumps
		ctx.root_set_state({ y: 1 });
		expect(bump).toHaveBeenCalledTimes(1);
		expect(ctx.root).toEqual({ y: 1 });
		delete (globalThis as Record<string, unknown>).__js_runs;
	});

	it('jsCode sees context and the builder globals', () => {
		const { ctx } = make({
			context: { who: 'ctx' },
			content: { id: 'j2', data: { jsCode: 'state.who = context.who; state.server = builder.isServer; state.same = Builder === builder;' } }
		});
		expect(ctx.root).toMatchObject({ who: 'ctx', server: true, same: true });
	});

	it("data's jsCode wins (an empty one runs nothing)", () => {
		const content = { id: 'j3', data: { jsCode: 'state.from = "content"' } };
		expect(make({ content, data: { jsCode: 'state.from = "data"' } }).ctx.root.from).toBe('data');
		expect(make({ content, data: { jsCode: '' } }).ctx.root.from).toBeUndefined();
		expect(make({ content, data: { other: 1 } }).ctx.root.from).toBe('content');
	});

	it('data and locale are merged into root again after jsCode', () => {
		const { ctx } = make({
			content: { id: 'j4', data: { jsCode: 'state.d = "js"; state.locale = "js"; state.only = "js";' } },
			data: { d: 'data' },
			locale: 'fr'
		});
		expect(ctx.root).toMatchObject({ d: 'data', locale: 'fr', only: 'js' });
	});

	it('a throwing jsCode logs and leaves root as it was', () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { ctx } = make({ content: { id: 'j5', data: { jsCode: 'state.a = 1; throw new Error("boom")', state: { s: 1 } } } });
		expect(err).toHaveBeenCalled();
		expect(ctx.root).toMatchObject({ s: 1, a: 1 });
	});

	it('globals are built lazily, once', () => {
		env_calls.editing = 0;
		const { ctx } = make({ content: { id: 'g' } });
		expect(env_calls.editing).toBe(0);
		const g = ctx.globals;
		expect(env_calls.editing).toBe(1);
		expect(ctx.globals).toBe(g);
		expect(env_calls.editing).toBe(1);
		expect(g).toMatchObject({ isEditing: false, isBrowser: false, isServer: true });
		expect(g.getUserAttributes()).toEqual({ from: 'ours' });
	});

	it('content with jsCode builds globals during setup', () => {
		env_calls.editing = 0;
		make({ content: { id: 'g2', data: { jsCode: 'state.a = 1' } } });
		expect(env_calls.editing).toBe(1);
	});
});

describe('trackConversion vs official getBuilderGlobals', () => {
	type Case = {
		apiKey?: string;
		canTrack?: boolean;
		id?: string;
		variation?: string;
		amount?: number;
		props?: Record<string, unknown>;
	};
	const cases: Case[] = [];
	for (const apiKey of [undefined, '', 'key'])
		for (const canTrack of [undefined, true, false])
			for (const [id, variation] of [
				[undefined, undefined],
				['c1', undefined],
				['c1', 'c1'],
				['c1', 'v2'],
				[undefined, 'v2']
			] as const)
				for (const amount of [undefined, 0, 12.5, NaN])
					for (const props of [undefined, {}, { a: 1 }, { amount: 99, b: 'x' }]) cases.push({ apiKey, canTrack, id, variation, amount, props });

	it(`same call over ${cases.length} cases (ours also passes apiHost)`, () => {
		for (const c of cases) {
			track_mock.mockClear();
			official_track_mock.mockClear();
			const content: BuilderContent = {};
			if (c.id !== undefined) content.id = c.id;
			if (c.variation !== undefined) content.testVariationId = c.variation;
			const { ctx } = make({ content, apiKey: c.apiKey, canTrack: c.canTrack, apiHost: 'https://host.example' });
			ctx.globals.trackConversion(c.amount, c.props);
			getBuilderGlobals({
				apiKey: c.apiKey ?? null,
				canTrack: c.canTrack ?? true,
				contentId: content.id,
				variationId: content.testVariationId
			}).trackConversion(c.amount, c.props);
			expect(track_mock.mock.calls.length, JSON.stringify(c)).toBe(official_track_mock.mock.calls.length);
			if (!official_track_mock.mock.calls.length) continue;
			const [ours] = track_mock.mock.calls[0] as unknown as [Record<string, unknown>];
			const [official] = official_track_mock.mock.calls[0] as unknown as [Record<string, unknown>];
			const { apiHost, ...rest } = ours;
			expect(apiHost).toBe('https://host.example');
			expect(rest).toEqual(official);
			expect(Object.keys(rest)).toEqual(Object.keys(official));
		}
	});

	it('the variationId rule: only when it differs from the content id', () => {
		const { ctx } = make({ content: { id: 'a', testVariationId: 'a' }, apiKey: 'k' });
		ctx.globals.trackConversion(1);
		expect((track_mock.mock.calls[0] as unknown as [Record<string, unknown>])[0].variationId).toBeUndefined();
		track_mock.mockClear();
		const { ctx: ctx2 } = make({ content: { id: 'a', testVariationId: 'b' }, apiKey: 'k' });
		ctx2.globals.trackConversion();
		expect(track_mock.mock.calls[0]).toEqual([
			{ type: 'conversion', apiKey: 'k', canTrack: true, contentId: 'a', variationId: 'b', metadata: {}, apiHost: undefined }
		]);
	});
});
