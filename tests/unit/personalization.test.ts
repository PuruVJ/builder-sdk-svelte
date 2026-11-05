// blocks/personalization.ts vs the official node_modules/@builder.io/sdk-svelte/src/blocks/personalization-container/
// helpers.ts (getPersonalizationScript, getUpdateVisibilityStylesScript, getBlocksToRender,
// filterWithCustomTargeting) and the `hideVariantsStyleString` / InlinedScript markup in
// personalization-container.svelte / components/inlined-script.svelte.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// One switchboard drives both SDKs' environment checks.
const env = vi.hoisted(() => ({ editing: false, browser: false }));
vi.mock('../../src/lib/internal/env', async (orig) => ({
	...(await orig<typeof import('../../src/lib/internal/env')>()),
	is_editing: () => env.editing,
	is_browser: () => env.browser
}));
vi.mock('../../node_modules/@builder.io/sdk-svelte/src/functions/is-editing', () => ({ isEditing: () => env.editing }));
vi.mock('../../node_modules/@builder.io/sdk-svelte/src/functions/is-browser', () => ({ isBrowser: () => env.browser }));

import {
	blocks_to_render,
	DEFAULT_INDEX,
	filter_variants,
	script_tag,
	scripts_for,
	type Variant
} from '../../src/lib/blocks/personalization';
import {
	DEFAULT_INDEX as OFFICIAL_DEFAULT_INDEX,
	filterWithCustomTargeting,
	getBlocksToRender,
	getPersonalizationScript,
	getUpdateVisibilityStylesScript
} from '../../node_modules/@builder.io/sdk-svelte/src/blocks/personalization-container/helpers';

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** personalization-container.svelte `hideVariantsStyleString`. */
const official_hide = (variants: Variant[] | undefined, id: unknown) =>
	(variants || []).map((_, index) => `div[data-variant-id="${id}-${index}"] { display: none !important; } `).join('');

/** components/inlined-script.svelte. */
const official_inlined_script = (id: string, nonce: string | undefined, scriptStr: string) =>
	`<script  data-id=${id}  nonce=${nonce || ''}>${scriptStr}</script>`;

const blk = (id: string) => ({ '@type': '@builder.io/sdk:Element' as const, id, component: { name: 'Text', options: { text: `<p>${id}</p>` } } });

const VARIANTS: Variant[] = [
	{ blocks: [blk('v0')], query: [{ property: 'urlPath', operator: 'is', value: '/a' }] as any, name: 'A' },
	{ blocks: [blk('v1')], query: [{ property: 'device', operator: 'is', value: 'mobile' }] as any, startDate: '2020-01-01' },
	{ blocks: [blk('v2')], endDate: '2030-01-01', query: [] }
];

describe('scripts_for vs official script builders', () => {
	const CASES: Array<[Variant[], string, string | undefined, unknown]> = [
		[VARIANTS, 'builder-abc', undefined, 'builder-abc'],
		[VARIANTS, 'builder-abc', 'en-US', 'builder-abc'],
		[VARIANTS, 'builder-abc', '', 'builder-abc'],
		[VARIANTS, 'none', undefined, undefined], // block without id: script id 'none', hide rules 'undefined-<i>'
		[[], 'x', 'fr', 'x'],
		[[{ blocks: [] }], 'x"y', 'de"', 'x"y'],
		[[{ blocks: [blk('</script><script>alert(1)</script>')] }], 'id', undefined, 'id'],
		[[{ blocks: [], query: [{ property: 'ü', operator: 'is', value: '日本😀' }] as any }], 'u', 'ja', 'u']
	];

	it('identical strings', () => {
		for (const [variants, id, locale, raw] of CASES) {
			const s = scripts_for(variants, id, locale, raw);
			expect(s.personalization).toBe(getPersonalizationScript(variants as any, id, locale));
			expect(s.visibility).toBe(getUpdateVisibilityStylesScript(variants as any, id, locale));
			expect(s.hide_styles).toBe(official_hide(variants, raw));
		}
	});

	it('caches per variants array and key', () => {
		const v = [{ blocks: [blk('a')] }];
		const a = scripts_for(v, 'id', 'en', 'id');
		expect(scripts_for(v, 'id', 'en', 'id')).toBe(a);
		expect(scripts_for(v, 'id', 'fr', 'id')).not.toBe(a);
		expect(scripts_for(v, 'id2', 'en', 'id')).not.toBe(a);
		expect(scripts_for(v, 'id', 'en', 'other')).not.toBe(a);
		expect(scripts_for(v, 'id', undefined, 'id')).not.toBe(a);
		// a different array with the same content builds anew (identical text)
		const v2 = [{ blocks: [blk('a')] }];
		const b = scripts_for(v2, 'id', 'en', 'id');
		expect(b).not.toBe(a);
		expect(b).toEqual(a);
	});

	it('undefined vs empty locale share an entry (both mean no locale) and give the same text', () => {
		const v = [{ blocks: [] }];
		expect(scripts_for(v, 'id', undefined, 'id')).toBe(scripts_for(v, 'id', '', 'id'));
		expect(scripts_for(v, 'id', '', 'id').personalization).toBe(getPersonalizationScript(v as any, 'id', ''));
	});

	it('cache is keyed by identity: in-place mutation of a cached array is not seen (by design)', () => {
		const v: Variant[] = [{ blocks: [] }];
		const before = scripts_for(v, 'id', undefined, 'id').personalization;
		v.push({ blocks: [blk('late')] });
		expect(scripts_for(v, 'id', undefined, 'id').personalization).toBe(before);
	});

	it('seeded sweep of variant arrays', () => {
		const rand = mulberry32(5);
		const ids = ['a', 'builder-1', 'none', '', 'x y', '"q"'];
		const locales = [undefined, '', 'en', 'en-US', 'ü'];
		for (let i = 0; i < 200; i++) {
			const n = Math.floor(rand() * 5);
			const variants: Variant[] = [];
			for (let j = 0; j < n; j++)
				variants.push({
					blocks: rand() < 0.5 ? [] : [blk('b' + j)],
					...(rand() < 0.5 ? { query: [{ property: 'p', operator: 'is', value: j }] as any } : {}),
					...(rand() < 0.3 ? { startDate: '2021-01-01' } : {}),
					...(rand() < 0.2 ? { name: undefined } : {})
				});
			const id = ids[Math.floor(rand() * ids.length)];
			const locale = locales[Math.floor(rand() * locales.length)];
			const raw = rand() < 0.2 ? undefined : id;
			const s = scripts_for(variants, id, locale, raw);
			expect(s.personalization).toBe(getPersonalizationScript(variants as any, id, locale));
			expect(s.visibility).toBe(getUpdateVisibilityStylesScript(variants as any, id, locale));
			expect(s.hide_styles).toBe(official_hide(variants, raw));
		}
	});
});

describe('script_tag', () => {
	it('matches the official InlinedScript markup', () => {
		for (const [id, nonce, body] of [
			['builderio-personalization-x', 'abc', 'window.x()'],
			['id', '', ''],
			['id', undefined, 'a</b'],
			['ü', 'n"o', '😀']
		] as const) {
			expect(script_tag(id, nonce as string, body)).toBe(official_inlined_script(id, nonce, body));
		}
	});
});

describe('filter_variants vs official filterWithCustomTargeting', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	const official_filter = (variants: Variant[], attrs: Record<string, unknown>) =>
		variants.filter((v) => filterWithCustomTargeting(attrs as any, v.query as any, v.startDate, v.endDate));

	it('table', () => {
		const attrs_list: Record<string, unknown>[] = [
			{},
			{ urlPath: '/a' },
			{ urlPath: '/a', device: 'mobile' },
			{ device: ['mobile', 'tablet'] },
			{ date: '2019-01-01', device: 'mobile' },
			{ date: '2031-01-01' },
			{ locale: 'en', urlPath: '/a/' }
		];
		for (const attrs of attrs_list) expect(filter_variants(VARIANTS, attrs)).toEqual(official_filter(VARIANTS, attrs));
		expect(filter_variants([], {})).toEqual([]);
	});

	it('seeded sweep over operators, values and dates', () => {
		const rand = mulberry32(77);
		const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
		const ops = ['is', 'isNot', 'contains', 'startsWith', 'endsWith', 'greaterThan', 'lessThan', 'greaterThanOrEqualTo', 'lessThanOrEqualTo', 'bogus', ''];
		const props = ['urlPath', 'device', 'n', 'tags', 'locale', ''];
		const vals = ['/a', '/a/', '/', 'mobile', 'mo', 'le', 1, 5, 10, NaN, true, ['mobile', '/a'], [1, 5], [], ''];
		const dates = [undefined, '2020-01-01', '2030-01-01', 'garbage', ''];
		const attr_vals = ['/a', 'mobile', 'desktop', 5, 1, ['mobile', 'x'], [5], undefined, null, ''];
		for (let i = 0; i < 300; i++) {
			const variants: Variant[] = [];
			const n = Math.floor(rand() * 4);
			for (let j = 0; j < n; j++) {
				const q = [];
				const qn = Math.floor(rand() * 3);
				for (let k = 0; k < qn; k++) q.push({ property: pick(props), operator: pick(ops), value: pick(vals) });
				variants.push({ blocks: [], query: rand() < 0.1 ? undefined : (q as any), startDate: pick(dates), endDate: pick(dates) });
			}
			const attrs: Record<string, unknown> = {};
			for (const p of props) if (rand() < 0.5) attrs[p] = pick(attr_vals);
			if (rand() < 0.2) attrs.date = pick(dates);
			expect(filter_variants(variants, attrs)).toEqual(official_filter(variants, attrs));
		}
	});
});

describe('blocks_to_render vs official getBlocksToRender', () => {
	afterEach(() => {
		env.editing = false;
		env.browser = false;
	});

	const fallback = [blk('fallback')];
	const official = (variants: Variant[] | undefined, fb: unknown, hydrated: boolean, filtered: Variant[], idx: number | null | undefined) =>
		getBlocksToRender({
			variants: variants as any,
			fallbackBlocks: fb as any,
			isHydrated: hydrated,
			filteredVariants: filtered as any,
			previewingIndex: idx
		});

	it('DEFAULT_INDEX', () => expect(DEFAULT_INDEX).toBe(OFFICIAL_DEFAULT_INDEX));

	it('full matrix: editing x browser x hydrated x previewing index x winner', () => {
		const indexes = [undefined, null, -1, 0, 1, 2, 3, 99, 1.5, NaN];
		const filtered_options: Variant[][] = [[], [VARIANTS[1]], [VARIANTS[2], VARIANTS[0]], [{ blocks: [blk('stranger')] }]];
		const variant_options: Array<Variant[] | undefined> = [undefined, [], VARIANTS, [VARIANTS[0], undefined as unknown as Variant]];
		let count = 0;
		for (const editing of [false, true])
			for (const browser of [false, true])
				for (const hydrated of [false, true])
					for (const idx of indexes)
						for (const filtered of filtered_options)
							for (const variants of variant_options)
								for (const fb of [fallback, undefined]) {
									env.editing = editing;
									env.browser = browser;
									const label = JSON.stringify({ editing, browser, hydrated, idx, f: filtered.length, v: variants?.length, fb: !!fb });
									expect(blocks_to_render(variants, fb, hydrated, filtered, idx), label).toEqual(official(variants, fb, hydrated, filtered, idx));
									count++;
								}
		expect(count).toBe(2 * 2 * 2 * 10 * 4 * 4 * 2);
	});

	it('named cases', () => {
		env.editing = true;
		env.browser = true;
		expect(blocks_to_render(VARIANTS, fallback, true, [], 1)).toEqual({ blocks: VARIANTS[1].blocks, path: 'variants.1.blocks', index: 1 });
		expect(blocks_to_render(VARIANTS, fallback, true, [VARIANTS[2]], 3)).toEqual({ blocks: fallback, path: 'this.children', index: 'default' });
		// not hydrated yet: the browser winner
		expect(blocks_to_render(VARIANTS, fallback, false, [VARIANTS[2]], 1)).toEqual({ blocks: VARIANTS[2].blocks, path: 'variants.2.blocks', index: 2 });
		env.editing = false;
		env.browser = false;
		// server: always the fallback
		expect(blocks_to_render(VARIANTS, undefined, true, [VARIANTS[0]], 0)).toEqual({ blocks: [], path: 'this.children', index: 'default' });
	});
});
