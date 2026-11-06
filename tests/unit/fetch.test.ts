// internal/fetch.ts against the official functions/get-content (server leg: no window).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { builder_search_params, content_url, fetch_entries, fetch_one_entry, type GetContentOptions } from '../../src/lib/internal/fetch.js';
import { generateContentUrl } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-content/generate-content-url';
import { fetchEntries, fetchOneEntry } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-content/index';
import { getBuilderSearchParams } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-builder-search-params/index';
import { rng } from './_rng.js';

type Opts = Record<string, unknown>;

/** Both sides' URL (or both sides' error) for the same options; each gets its own copy. */
function both_urls(opts: Opts) {
	const run = (f: (o: never) => URL) => {
		try {
			return { href: f(clone(opts) as never).href };
		} catch (e) {
			return { error: (e as Error).message };
		}
	};
	return { ours: run(content_url as never), official: run(generateContentUrl as never) };
}

/** structuredClone, keeping URLSearchParams (not cloneable) */
function clone(opts: Opts): Opts {
	const out: Opts = {};
	for (const k in opts) {
		const v = opts[k];
		out[k] = v instanceof URLSearchParams ? new URLSearchParams(v) : v === undefined ? undefined : structuredClone(v);
	}
	return out;
}

const TABLE: Opts[] = [
	{ apiKey: 'k', model: 'page' },
	{ apiKey: '', model: 'page' },
	{ apiKey: 'k', model: 'page', apiVersion: 'v2' },
	{ apiKey: 'k', model: 'page', apiVersion: 'v3' },
	{ apiKey: 'k', model: 'page', limit: 1 },
	{ apiKey: 'k', model: 'page', limit: 0 },
	{ apiKey: 'k', model: 'page', limit: -5 },
	{ apiKey: 'k', model: 'page', offset: 0 },
	{ apiKey: 'k', model: 'page', offset: -1 },
	{ apiKey: 'k', model: 'page', offset: -0.5 },
	{ apiKey: 'k', model: 'page', offset: 3.9 },
	{ apiKey: 'k', model: 'page', offset: NaN },
	{ apiKey: 'k', model: 'page', offset: Infinity },
	{ apiKey: 'k', model: 'page', cacheSeconds: 0, staleCacheSeconds: 0 },
	{ apiKey: 'k', model: 'page', cacheSeconds: 10, staleCacheSeconds: 20 },
	{ apiKey: 'k', model: 'page', cacheSeconds: -1, staleCacheSeconds: NaN },
	{ apiKey: 'k', model: 'page', cacheSeconds: Infinity },
	{ apiKey: 'k', model: 'page', cacheSeconds: '5' },
	{ apiKey: 'k', model: 'page', includeUnpublished: true },
	{ apiKey: 'k', model: 'page', includeUnpublished: false },
	{ apiKey: 'k', model: 'page', includeUnpublished: 'true' },
	{ apiKey: 'k', model: 'page', enrich: true },
	{ apiKey: 'k', model: 'page', enrich: false },
	{ apiKey: 'k', model: 'page', omit: '' },
	{ apiKey: 'k', model: 'page', omit: 'data.blocks', fields: 'id,name' },
	{ apiKey: 'k', model: 'page', locale: 'de-DE' },
	{ apiKey: 'k', model: 'page', locale: '' },
	{ apiKey: 'k', model: 'page', apiHost: 'http://localhost:1234' },
	{ apiKey: 'k', model: 'page', apiHost: '' },
	{ apiKey: 'k', model: 'my model/ü', apiHost: 'https://x.io' },
	{ apiKey: 'k&x=1', model: 'page' },
	{ apiKey: 'k', model: 'page', sort: { createdDate: -1 } },
	{ apiKey: 'k', model: 'page', sort: { 'data.order': 1, nested: { deep: -1 } } },
	{ apiKey: 'k', model: 'page', sort: {} },
	{ apiKey: 'k', model: 'page', userAttributes: null },
	{ apiKey: 'k', model: 'page', userAttributes: {} },
	{ apiKey: 'k', model: 'page', userAttributes: { urlPath: '/a b', device: 'mobile', locale: 'fr' } },
	{ apiKey: 'k', model: 'page', userAttributes: { nested: { a: [1, 2] }, '€': '✓' } },
	{ apiKey: 'k', model: 'page', query: { id: 'x' } },
	{ apiKey: 'k', model: 'page', query: { data: { url: '/x', n: { $gt: 5 } } } },
	{ apiKey: 'k', model: 'page', query: { 'data.tags': { $in: ['a', 'b'] }, list: [1, 2], nul: null } },
	{ apiKey: 'k', model: 'page', query: { a: { b: { c: { d: 1 } } }, e: {} } },
	{ apiKey: 'k', model: 'page', options: { a: 1, b: { c: 'x', d: [] }, e: [1, { f: 2 }] } },
	{ apiKey: 'k', model: 'page', options: new URLSearchParams('a=1&b=2&a=3') },
	{ apiKey: 'k', model: 'page', options: { preview: 'BUILDER_STUDIO', 'userAttributes.urlPath': '/p' } },
	{ apiKey: 'k', model: 'page', options: { nul: null, und: undefined, nan: NaN } },
	{ apiKey: 'k', model: 'page', options: {} },
	// prototype-pollution-shaped keys stay plain keys
	{ apiKey: 'k', model: 'page', options: JSON.parse('{"__proto__": {"x": 1}, "constructor": "c"}') },
	{ apiKey: 'k', model: 'page', query: JSON.parse('{"__proto__": {"x": 1}}') },
	{ apiKey: 'k', model: 'page', sort: JSON.parse('{"constructor": {"prototype": 1}}') },
	{ apiKey: 'k', model: 'page', options: { long: 'x'.repeat(10000) } },
	// regression: an empty key adds no path segment (official flatten's `filter(Boolean)`)
	{ apiKey: 'k', model: 'page', options: { a: { '': 1 }, '': { b: 2 } }, sort: { '': -1, x: { '': 1 } } }
];

describe('content_url (official generateContentUrl)', () => {
	it.each(TABLE.map((o, i) => [i, o]))('table #%i', (_i, opts) => {
		const { ours, official } = both_urls(opts);
		expect(ours).toEqual(official);
	});

	it('throws the official errors', () => {
		expect(() => content_url({ apiKey: '', model: 'page' })).toThrow('Missing API key');
		expect(() => content_url({ apiKey: 'k', model: 'page', apiVersion: 'v1' })).toThrow("Invalid apiVersion: expected 'v3', received 'v1'");
	});

	it('random sweep (seeded)', () => {
		const r = rng(1234);
		const values = [undefined, null, 0, 1, -1, 2.5, NaN, Infinity, '', 'x', '✓ü', true, false, [], [1, 'a'], {}, { a: 1 }];
		const any_value = (depth: number): unknown => {
			if (depth > 0 && r.chance(0.3)) {
				const obj: Record<string, unknown> = {};
				const n = r.int(4);
				for (let i = 0; i < n; i++) obj[r.pick(['a', 'b', 'c.d', '$gt', '$in', '0', 'data', 'ü', ''])] = any_value(depth - 1);
				return obj;
			}
			if (depth > 0 && r.chance(0.1)) return [any_value(depth - 1), any_value(depth - 1)];
			return r.pick(values);
		};
		for (let i = 0; i < 500; i++) {
			const opts: Opts = { apiKey: r.chance(0.97) ? 'key' : '', model: r.pick(['page', 'symbol', 'a b']) };
			const maybe = (key: string, gen: () => unknown) => r.chance(0.4) && (opts[key] = gen());
			maybe('limit', () => r.pick([undefined, 0, 1, 2, 30, 100, -1, 1.5]));
			maybe('offset', () => r.pick([undefined, 0, 1, -1, 2.7, NaN, Infinity, -Infinity]));
			maybe('enrich', () => r.pick([true, false, undefined]));
			maybe('locale', () => r.pick(['en-US', '', undefined, 'zh-Hant']));
			maybe('apiVersion', () => r.pick(['v3', undefined]));
			maybe('fields', () => r.pick(['', 'id', 'data.title,id']));
			maybe('omit', () => r.pick(['', 'data', undefined]));
			maybe('cacheSeconds', () => r.pick([0, 1, 60, -1, NaN, undefined]));
			maybe('staleCacheSeconds', () => r.pick([0, 1, 60, -1, NaN, undefined]));
			maybe('includeUnpublished', () => r.pick([true, false, undefined, 'yes']));
			maybe('apiHost', () => r.pick(['', 'http://localhost:3000', 'https://cdn.example.com']));
			maybe('sort', () => any_value(2) ?? undefined);
			maybe('userAttributes', () => r.pick([null, undefined, {}, { urlPath: '/x' }, any_value(2)]));
			maybe('query', () => any_value(3));
			maybe('options', () => (r.chance(0.2) ? new URLSearchParams('builder.x=1&y=2') : any_value(3)));
			// (a non-object `sort` / `query` / `options` is a misuse both sides treat alike or both reject)
			const { ours, official } = both_urls(opts);
			expect(ours, JSON.stringify(opts, (_k, v) => (v instanceof URLSearchParams ? v.toString() : v))).toEqual(official);
		}
	});
});

describe('builder_search_params (official getBuilderSearchParams)', () => {
	const inputs: unknown[] = [
		undefined,
		{},
		{ 'builder.preview': 'page', 'builder.options.locale': 'de', other: '1', builder: 'x' },
		{ 'builder.builder.a': '1', 'builder.options.options.b': '2', 'xbuilder.c': '3' },
		new URLSearchParams('builder.space=1&builder.cachebust=true&builder.options.includeRefs=true&q=1'),
		new URLSearchParams(''),
		{ 'builder.list': ['a', 'b'] },
		{ 'builder.': 'empty' }
	];
	it.each(inputs.map((x, i) => [i, x]))('#%i', (_i, input) => {
		expect(builder_search_params(input as never)).toEqual(getBuilderSearchParams(input as never));
	});
});

function fake_fetch(body: unknown) {
	return vi.fn(async (_url: string, _init?: RequestInit) => ({ json: async () => structuredClone(body) }) as Response);
}

describe('fetch_entries / fetch_one_entry (official fetchEntries / fetchOneEntry)', () => {
	afterEach(() => vi.restoreAllMocks());

	const cases: Opts[] = [
		{ apiKey: 'k', model: 'page' },
		{ apiKey: 'k', model: 'page', fetchOptions: { headers: { Authorization: 'x', 'X-Builder-SDK': 'theirs' }, cache: 'no-store' } },
		{ apiKey: 'k', model: 'page', fetchOptions: { method: 'GET' } },
		{ apiKey: 'k', model: 'page', locale: 'de', userAttributes: { device: 'mobile' } },
		{ apiKey: 'k', model: 'page', userAttributes: { locale: 'fr', urlPath: '/' } },
		{ apiKey: 'k', model: 'page', locale: 'es', userAttributes: { locale: 'fr' } },
		{ apiKey: 'k', model: 'page', limit: 5, offset: 10, query: { 'data.url': '/' } }
	];

	it.each(cases.map((o, i) => [i, o]))('the same request, the same result, the same options mutation (#%i)', async (_i, opts) => {
		const body = { results: [{ id: 'a', data: { title: 'A' } }, { id: 'b' }] };
		for (const one of [false, true]) {
			const f_ours = fake_fetch(body);
			const f_official = fake_fetch(body);
			const o_ours = { ...clone(opts), fetch: f_ours };
			const o_official = { ...clone(opts), fetch: f_official };
			const r_ours = one ? await fetch_one_entry(o_ours as never) : await fetch_entries(o_ours as never);
			const r_official = one ? await fetchOneEntry(o_official as never) : await fetchEntries(o_official as never);
			expect(r_ours).toEqual(r_official);
			expect(f_ours.mock.calls).toEqual(f_official.mock.calls);
			const { fetch: _a, ...rest_ours } = o_ours;
			const { fetch: _b, ...rest_official } = o_official;
			expect(rest_ours).toEqual(rest_official);
		}
	});

	it('sends the SDK headers over the app headers', async () => {
		const f = fake_fetch({ results: [] });
		await fetch_entries({ apiKey: 'k', model: 'page', fetch: f as never, fetchOptions: { headers: { 'X-Builder-SDK': 'nope', a: 'b' } } });
		expect(f.mock.calls[0][1]!.headers).toEqual({ 'X-Builder-SDK': 'svelte', a: 'b', 'X-Builder-SDK-GEN': '2', 'X-Builder-SDK-Version': '5.2.0' });
	});

	it('empty results: [] and null', async () => {
		expect(await fetch_entries({ apiKey: 'k', model: 'page', fetch: fake_fetch({ results: [] }) as never })).toEqual([]);
		expect(await fetch_one_entry({ apiKey: 'k', model: 'page', fetch: fake_fetch({ results: [] }) as never })).toBe(null);
		expect(await fetchOneEntry({ apiKey: 'k', model: 'page', fetch: fake_fetch({ results: [] }) as never } as never)).toBe(null);
	});

	it('a response without results throws it (and logs), as the official', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const body = { status: 401, message: 'Unauthorized' };
		await expect(fetch_entries({ apiKey: 'k', model: 'page', fetch: fake_fetch(body) as never })).rejects.toEqual(body);
		await expect(fetchEntries({ apiKey: 'k', model: 'page', fetch: fake_fetch(body) } as never)).rejects.toEqual(body);
		await expect(fetch_one_entry({ apiKey: 'k', model: 'page', fetch: fake_fetch(body) as never })).rejects.toEqual(body);
		expect(err.mock.calls[0][0]).toBe('[Builder.io]: Error fetching data. ');
	});

	it('a null response body throws null', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await expect(fetch_entries({ apiKey: 'k', model: 'page', fetch: fake_fetch(null) as never })).rejects.toBe(null);
	});

	it('uses the global fetch when none is given', async () => {
		const f = fake_fetch({ results: [{ id: 'g' }] });
		vi.stubGlobal('fetch', f);
		try {
			expect(await fetch_one_entry({ apiKey: 'k', model: 'page' })).toEqual({ id: 'g' });
			expect(f).toHaveBeenCalledOnce();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('a fetch error propagates', async () => {
		const f = vi.fn(async () => {
			throw new TypeError('network');
		});
		await expect(fetch_entries({ apiKey: 'k', model: 'page', fetch: f as never })).rejects.toThrow('network');
	});
});

describe('content_url odd inputs', () => {
	it('is a URL with the official base and parameters, in order', () => {
		const url = content_url({ apiKey: 'k', model: 'page' } as GetContentOptions);
		expect([...url.searchParams.keys()]).toEqual(['apiKey', 'limit', 'noTraverse', 'includeRefs', 'omit']);
		expect(url.origin + url.pathname).toBe('https://cdn.builder.io/api/v3/content/page');
	});
	it('deep options flatten without a stack issue', () => {
		let deep: Record<string, unknown> = { leaf: 1 };
		for (let i = 0; i < 200; i++) deep = { n: deep };
		const { ours, official } = both_urls({ apiKey: 'k', model: 'page', options: deep });
		expect(ours).toEqual(official);
	});
});
