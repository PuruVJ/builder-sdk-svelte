// blocks/image.ts vs the official node_modules/@builder.io/sdk-svelte/src/blocks/image/image.helpers.ts
// (getSrcSet) and the webp / host checks inlined in blocks/image/image.svelte.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { get_srcset, is_builder, is_builder_or_shopify, to_webp } from '../../src/lib/blocks/image';
import { getSrcSet } from '../../node_modules/@builder.io/sdk-svelte/src/blocks/image/image.helpers';

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// image.svelte: `url.match(/builder\.io/) || url.match(/cdn\.shopify\.com/)`
const official_is_builder_or_shopify = (url: string) => !!(url.match(/builder\.io/) || url.match(/cdn\.shopify\.com/));
// image.svelte webpSrcSet: `srcSetToUse().match(/builder\.io/) ... replace(/\?/g, '?format=webp&')`
const official_is_builder = (url: string) => !!url.match(/builder\.io/);
const official_webp = (srcset: string) => srcset.replace(/\?/g, '?format=webp&');

const TABLE = [
	'',
	'https://cdn.builder.io/api/v1/image/assets%2Fabc%2Fdef',
	'https://cdn.builder.io/api/v1/image/assets%2Fabc%2Fdef?width=800',
	'https://cdn.builder.io/api/v1/image/assets%2Fabc%2Fdef?width=777',
	'https://cdn.builder.io/api/v1/image/assets%2Fabc%2Fdef?width=abc',
	'https://cdn.builder.io/api/v1/image/assets%2Fabc%2Fdef?width=',
	'https://cdn.builder.io/api/v1/image/x?format=png&width=400&height=20',
	'https://cdn.builder.io/api/v1/image/x?height=20&width=400',
	'https://cdn.builder.io/api/v1/image/x?WIDTH=400',
	'https://cdn.builder.io/api/v1/image/x?quality=60',
	'https://cdn.builder.io/api/v1/image/x?width=100&width=200',
	'https://cdn.builder.io/x#frag?width=3',
	'//cdn.builder.io/x',
	'builder.io',
	'http://builder.io/y.png?width=2000',
	'https://cdn.shopify.com/s/files/1/products/shoe.jpg',
	'https://cdn.shopify.com/s/files/1/products/shoe.jpg?v=123456',
	'https://cdn.shopify.com/s/files/1/products/shoe_300x300.png?v=1',
	'https://cdn.shopify.com/s/files/1/products/shoe_300x.PNG',
	'http://cdn.shopify.com/s/files/1/products/shoe.webp',
	'https://cdn.shopify.com/s/files/1/products/noext',
	'https://cdn.shopify.com/a.jpg/b.jpg',
	'https://cdn.shopify.com/a.tiff?v=abc',
	'https://example.com/image.jpg?width=200',
	'https://example.com/builder.io.jpg',
	'data:image/png;base64,AAAA',
	'https://cdn.builder.io/ünïcödé?width=400',
	'https://cdn.builder.io/x?width=400 extra',
	'x'.repeat(5000) + 'builder.io'
];

describe('get_srcset vs official getSrcSet', () => {
	it('table', () => {
		for (const url of TABLE) expect(get_srcset(url), url).toBe(getSrcSet(url));
		// second call (from the memo) still matches
		for (const url of TABLE) expect(get_srcset(url), url).toBe(getSrcSet(url));
	});

	it('falsy input is returned as is', () => {
		expect(get_srcset('')).toBe('');
		expect(get_srcset(undefined as unknown as string)).toBe(getSrcSet(undefined as unknown as string));
		expect(get_srcset(null as unknown as string)).toBe(null);
	});

	it('seeded sweep', () => {
		const rand = mulberry32(42);
		const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
		const hosts = ['https://cdn.builder.io', 'http://builder.io', '//cdn.builder.io', 'https://cdn.shopify.com', 'http://cdn.shopify.com', 'https://example.com', '', 'https://builderxio.com'];
		const paths = ['/api/v1/image/assets%2Fa%2Fb', '/s/files/p/shoe', '/s/files/p/shoe_100x', '/s/files/p/shoe_20x30', '/a/b.c', '/ü', '/'];
		const exts = ['', '.jpg', '.JPEG', '.gif', '.png', '.bmp', '.bitmap', '.tiff', '.tif', '.webp', '.svg'];
		const queries = ['', '?v=1', '?v=x', '?width=100', '?width=800', '?width=123', '?width=', '?a=1&width=2', '?a=1&width=2&b=3', '?Width=9', '?width=1?width=2', '&width=5', '?q=?'];
		for (let i = 0; i < 600; i++) {
			const url = pick(hosts) + pick(paths) + pick(exts) + pick(queries) + (rand() < 0.1 ? pick(exts) : '');
			expect(get_srcset(url), url).toBe(getSrcSet(url));
			expect(is_builder_or_shopify(url), url).toBe(official_is_builder_or_shopify(url));
			expect(is_builder(url), url).toBe(official_is_builder(url));
			const s = getSrcSet(url);
			expect(to_webp(s)).toBe(official_webp(s));
		}
	});

	it('explicit expectations', () => {
		const u = 'https://cdn.builder.io/x?width=800';
		const out = get_srcset(u);
		expect(out).not.toContain('width=800 800w,'); // the src width is listed once, at the end
		expect(out.endsWith(`${u} 800w`)).toBe(true);
		expect(out.split(', ')).toHaveLength(7);
		expect(get_srcset('https://cdn.builder.io/x?quality=1')).toContain('?quality=1&width=100 100w');
		expect(get_srcset('https://cdn.shopify.com/a/shoe.jpg')).toContain('//cdn.shopify.com/a/shoe_100x100.jpg 100w');
		expect(get_srcset('https://cdn.shopify.com/a/noext')).toBe('https://cdn.shopify.com/a/noext');
		expect(get_srcset('https://other.com/a.jpg')).toBe('https://other.com/a.jpg');
	});
});

describe('host checks and webp', () => {
	it('is_builder_or_shopify / is_builder', () => {
		for (const url of TABLE) {
			expect(is_builder_or_shopify(url)).toBe(official_is_builder_or_shopify(url));
			expect(is_builder(url)).toBe(official_is_builder(url));
		}
		expect(is_builder('https://cdn.builder.io/x')).toBe(true);
		expect(is_builder('https://cdn.shopify.com/x')).toBe(false);
		expect(is_builder_or_shopify('https://cdn.shopify.com/x')).toBe(true);
		expect(is_builder_or_shopify('builderxio')).toBe(false);
	});

	it('to_webp replaces every ? (global regex keeps no state between calls)', () => {
		for (const url of TABLE) {
			const s = getSrcSet(url);
			if (typeof s === 'string') expect(to_webp(s)).toBe(official_webp(s));
		}
		expect(to_webp('a?b, c?d')).toBe('a?format=webp&b, c?format=webp&d');
		expect(to_webp('a?b')).toBe('a?format=webp&b');
		expect(to_webp('no-query')).toBe('no-query');
		expect(to_webp('')).toBe('');
	});
});

describe('memo cache', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it('memoises per URL and evicts the oldest entry at 2000', async () => {
		vi.resetModules();
		const mod = await import('../../src/lib/blocks/image');
		const split = vi.spyOn(String.prototype, 'split');
		const misses = () => split.mock.calls.filter((c) => c[0] === '?width=').length;
		const url = (i: number) => `https://cdn.builder.io/img-${i}?width=${i}`;

		expect(mod.get_srcset(url(0))).toBe(getSrcSet(url(0)));
		const after_first = misses();
		expect(after_first).toBeGreaterThan(0);
		mod.get_srcset(url(0));
		expect(misses()).toBe(after_first); // hit: no recompute

		for (let i = 1; i < 2000; i++) mod.get_srcset(url(i)); // cache now full (2000)
		let base = misses();
		mod.get_srcset(url(0)); // still cached
		expect(misses()).toBe(base);

		mod.get_srcset(url(2000)); // evicts url(0), the oldest
		base = misses();
		mod.get_srcset(url(1)); // url(1) still cached
		expect(misses()).toBe(base);
		mod.get_srcset(url(0)); // url(0) was evicted: recomputed
		expect(misses()).toBe(base + 1);
		expect(mod.get_srcset(url(0))).toBe(getSrcSet(url(0)));
	});

	it('non-builder / non-shopify results are cached too', async () => {
		vi.resetModules();
		const mod = await import('../../src/lib/blocks/image');
		const test = vi.spyOn(RegExp.prototype, 'test');
		mod.get_srcset('https://other.com/a.jpg');
		const n = test.mock.calls.length;
		mod.get_srcset('https://other.com/a.jpg');
		expect(test.mock.calls.length).toBe(n);
	});
});
