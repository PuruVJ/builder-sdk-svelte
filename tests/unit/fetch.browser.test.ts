// @vitest-environment happy-dom
// internal/fetch.ts in the browser: the page's `builder.*` search params, the Studio preview's user
// attributes, and A/B assignment of fetched content, against the official functions/get-content.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content_url, fetch_entries, fetch_one_entry } from '../../src/lib/internal/fetch.js';
import { generateContentUrl } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-content/generate-content-url';
import { fetchEntries, fetchOneEntry } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-content/index';

import { clear_cookies, set_url } from './_dom.js';

beforeEach(() => {
	set_url('/');
	clear_cookies();
});
afterEach(() => vi.restoreAllMocks());

describe('content_url in the browser', () => {
	const pages = [
		'/',
		'/shop?x=1',
		'/p?builder.preview=page&builder.options.locale=de',
		'/p?builder.cachebust=true&builder.space=abc',
		'/studio/page?builder.preview=BUILDER_STUDIO&builder.userAttributes.device=tablet&builder.userAttributes.nested.a=1',
		'/studio?builder.preview=BUILDER_STUDIO',
		'/x?builder.preview=BUILDER_STUDIO&builder.userAttributes.urlPath=/override'
	];
	const opts = [
		{ apiKey: 'k', model: 'page' },
		{ apiKey: 'k', model: 'page', options: { locale: 'fr', extra: 'y' } },
		{ apiKey: 'k', model: 'page', userAttributes: { urlPath: '/given', device: 'desktop' } },
		{ apiKey: 'k', model: 'page', options: { preview: 'BUILDER_STUDIO' }, userAttributes: { a: 1 } },
		{ apiKey: 'k', model: 'page', options: new URLSearchParams('preview=BUILDER_STUDIO&userAttributes.x=2') }
	];
	for (const page of pages)
		for (const [i, o] of opts.entries())
			it(`${page} × options #${i}`, () => {
				set_url(page);
				const clone = () => ({ ...o, options: o.options instanceof URLSearchParams ? new URLSearchParams(o.options) : structuredClone(o.options) });
				expect(content_url(clone() as never).href).toBe(generateContentUrl(clone() as never).href);
			});
});

describe('fetched content in the browser: A/B assignment (official _processContentResult)', () => {
	const content = () => ({
		results: [
			{
				id: 'c1',
				data: { title: 'default' },
				variations: {
					v1: { id: 'v1', name: 'Variant 1', testRatio: 0.5, data: { title: 'one' } },
					v2: { id: 'v2', testRatio: 0.5, data: { title: 'two' } }
				}
			},
			{ id: 'plain', data: { title: 'no test' } }
		]
	});
	const fake = () => vi.fn(async () => ({ json: async () => content() }) as unknown as Response);

	for (const [cookie, label] of [
		['v1', 'a cookie naming a variation'],
		['v2', 'a variation without a name'],
		['c1', 'the default'],
		['gone', 'a variation that no longer exists']
	] as const)
		it(`${label}: the same content as the official`, async () => {
			document.cookie = `builder.tests.c1=${cookie}; path=/`;
			const ours = await fetch_entries({ apiKey: 'k', model: 'page', fetch: fake() as never });
			const official = await fetchEntries({ apiKey: 'k', model: 'page', fetch: fake() } as never);
			expect(ours).toEqual(official);
			expect(await fetch_one_entry({ apiKey: 'k', model: 'page', fetch: fake() as never })).toEqual(
				await fetchOneEntry({ apiKey: 'k', model: 'page', fetch: fake() } as never)
			);
		});

	it('no cookie: a random draw, stored in the cookie (same draw as the official for the same Math.random)', async () => {
		for (const r of [0.1, 0.6, 0.99]) {
			clear_cookies();
			vi.spyOn(Math, 'random').mockReturnValue(r);
			const ours = await fetch_entries({ apiKey: 'k', model: 'page', fetch: fake() as never });
			const ours_cookie = document.cookie;
			clear_cookies();
			const official = await fetchEntries({ apiKey: 'k', model: 'page', fetch: fake() } as never);
			expect(ours).toEqual(official);
			expect(ours_cookie).toBe(document.cookie);
			vi.restoreAllMocks();
		}
	});

	it('canTrack: false leaves the results as they are', async () => {
		document.cookie = 'builder.tests.c1=v1; path=/';
		const ours = await fetch_entries({ apiKey: 'k', model: 'page', canTrack: false, fetch: fake() as never });
		expect(ours).toEqual(content().results);
		expect(ours).toEqual(await fetchEntries({ apiKey: 'k', model: 'page', canTrack: false, fetch: fake() } as never));
	});

	it('an entry whose variations throw: logged, the results as they came (official: caught too)', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const bad = {
			id: 'c',
			variations: {
				get v1(): never {
					throw new Error('bad');
				}
			}
		};
		const f = vi.fn(async () => ({ json: async () => ({ results: [bad] }) }) as unknown as Response);
		const out = await fetch_entries({ apiKey: 'k', model: 'page', fetch: f as never });
		expect(out[0]).toBe(bad);
		expect(err).toHaveBeenCalledWith('[Builder.io]: Could not process A/B tests. ', expect.any(Error));
		expect(await fetchEntries({ apiKey: 'k', model: 'page', fetch: f } as never)).toEqual([bad]);
	});
});
