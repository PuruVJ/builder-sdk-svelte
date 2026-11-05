// internal/ab-tests.ts against the official helpers/ab-tests.ts, components/content-variants/helpers.ts,
// blocks/personalization-container/helpers.ts and the inlined-script / inlined-styles markup.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	get_variants,
	handle_ab_testing,
	INIT_PERSONALIZATION_FNS,
	INIT_VARIANTS_FNS,
	script_tag,
	style_tag,
	update_cookie_and_styles_script,
	update_variant_visibility_script
} from '../../src/lib/internal/ab-tests.js';
import {
	getInitVariantsFnsScriptString,
	getUpdateCookieAndStylesScript,
	getUpdateVariantVisibilityScript,
	getVariants
} from '../../node_modules/@builder.io/sdk-svelte/src/components/content-variants/helpers';
import { getInitPersonalizationVariantsFnsScriptString } from '../../node_modules/@builder.io/sdk-svelte/src/blocks/personalization-container/helpers';
import { handleABTestingSync } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/ab-tests';

// (the official cookie helpers warn when there is no document)
beforeEach(() => void vi.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

const CONTENTS: unknown[] = [
	null,
	undefined,
	{},
	{ id: 'c' },
	{ id: 'c', variations: {} },
	{ id: 'c', variations: { v1: { id: 'v1', testRatio: 0.3, data: { a: 1 } }, v2: { id: 'v2', testRatio: 0.7, name: 'Two' } } },
	{ id: 'c', variations: { v1: { id: 'v1' } }, data: { title: 'x' } },
	{ variations: { v1: { id: 'v1' } } },
	{ id: 'c', variations: { weird: { id: 'other-id', testRatio: 1 } } }
];

describe('get_variants (official getVariants)', () => {
	it.each(CONTENTS.map((c, i) => [i, c]))('#%i', (_i, content) => {
		expect(get_variants(content as never)).toEqual(getVariants(content as never));
	});
	it('is memoised per content object', () => {
		const c = CONTENTS[5] as object;
		expect(get_variants(c as never)).toBe(get_variants(c as never));
		expect(get_variants({ ...c } as never)).not.toBe(get_variants(c as never));
	});
});

describe('handle_ab_testing on the server (official handleABTestingSync, no document)', () => {
	it.each(CONTENTS.map((c, i) => [i, c]))('#%i, every draw', (_i, content) => {
		for (const r of [0, 0.29, 0.3, 0.5, 0.99999]) {
			vi.spyOn(Math, 'random').mockReturnValue(r);
			for (const can of [true, false])
				expect(handle_ab_testing(structuredClone(content) as never, can)).toEqual(handleABTestingSync({ item: structuredClone(content) as never, canTrack: can }));
			vi.mocked(Math.random).mockRestore();
		}
	});
	it('ratios that do not sum to 1 fall back to the default, NaN ratios never win', () => {
		const content = { id: 'c', variations: { v1: { id: 'v1', testRatio: 0.1 }, v2: { id: 'v2' } } };
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
		expect(handle_ab_testing(content as never, true)).toEqual(handleABTestingSync({ item: content as never, canTrack: true }));
		expect(handle_ab_testing(content as never, true)!.testVariationId).toBe('c');
	});
});

describe('inline scripts (byte for byte)', () => {
	it('the init functions', () => {
		expect(INIT_VARIANTS_FNS).toBe(getInitVariantsFnsScriptString());
		expect(INIT_PERSONALIZATION_FNS).toBe(getInitPersonalizationVariantsFnsScriptString());
	});
	const variant_sets = [[], [{ id: 'v1', testRatio: 0.5 }], [{ id: 'v1' }, { id: 'v"2', testRatio: 1e-9 }], [{ id: '✓', testRatio: NaN }]];
	for (const [i, variants] of variant_sets.entries())
		for (const id of ['c', '', 'id"with"quotes', 'ü'])
			it(`update scripts #${i} "${id}"`, () => {
				expect(update_cookie_and_styles_script(variants, id)).toBe(getUpdateCookieAndStylesScript(variants, id));
				expect(update_variant_visibility_script(id, 'c')).toBe(getUpdateVariantVisibilityScript({ variationId: id, contentId: 'c' }));
			});
	// official components/inlined-script.svelte and inlined-styles.svelte
	const official_script = (id: string, nonce: string, body: string) => `<script  data-id=${id}  nonce=${nonce || ''}>${body}</script>`;
	const official_style = (id: string, nonce: string, body: string) => `<style  data-id=${id}  nonce=${nonce}  >${body}</style>`;
	for (const nonce of ['', 'abc', undefined as unknown as string])
		it(`tags, nonce ${JSON.stringify(nonce)}`, () => {
			expect(script_tag('builderio-init-variants-fns', nonce, 'x()')).toBe(official_script('builderio-init-variants-fns', nonce, 'x()'));
			expect(style_tag('builderio-variants', nonce, '.a{}')).toBe(official_style('builderio-variants', nonce, '.a{}'));
		});
});
