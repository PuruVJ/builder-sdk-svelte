// @vitest-environment happy-dom
// handle_ab_testing with cookies, against the official handleABTestingSync.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handle_ab_testing } from '../../src/lib/internal/ab-tests.js';
import { handleABTestingSync } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/ab-tests';
import { clear_cookies } from './_dom.js';

beforeEach(clear_cookies);
afterEach(() => vi.restoreAllMocks());

const content = () => ({
	id: 'c1',
	data: { title: 'default' },
	variations: {
		v1: { id: 'v1', name: 'One', testRatio: 0.25, data: { title: 'one' } },
		v2: { id: 'v2', testRatio: 0.25, data: { title: 'two' } },
		self: { id: 'c1', testRatio: 0.25, data: { title: 'self' } }
	}
});

describe('handle_ab_testing in the browser (official handleABTestingSync)', () => {
	for (const cookie of ['v1', 'v2', 'self', 'c1', 'missing', ''])
		it(`cookie "${cookie}"`, () => {
			if (cookie) document.cookie = `builder.tests.c1=${cookie}; path=/`;
			const ours = handle_ab_testing(content() as never, true);
			const official = handleABTestingSync({ item: content() as never, canTrack: true });
			expect(ours).toEqual(official);
		});

	it('no cookie: the same draw and the same stored cookie', () => {
		for (const r of [0, 0.2, 0.3, 0.6, 0.8, 0.99]) {
			vi.spyOn(Math, 'random').mockReturnValue(r);
			clear_cookies();
			const ours = handle_ab_testing(content() as never, true);
			const ours_cookie = document.cookie;
			clear_cookies();
			const official = handleABTestingSync({ item: content() as never, canTrack: true });
			expect(ours).toEqual(official);
			expect(ours_cookie).toBe(document.cookie);
			vi.restoreAllMocks();
		}
	});

	it('the cookie decides on the next call (no new draw)', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.1);
		const first = handle_ab_testing(content() as never, true)!;
		vi.spyOn(Math, 'random').mockReturnValue(0.9);
		expect(handle_ab_testing(content() as never, true)!.testVariationId).toBe(first.testVariationId);
	});

	it('canTrack false: untouched, no cookie', () => {
		const c = content();
		expect(handle_ab_testing(c as never, false)).toBe(c);
		expect(document.cookie).toBe('');
	});

	it('the input is not mutated', () => {
		const c = content();
		const before = structuredClone(c);
		handle_ab_testing(c as never, true);
		expect(c).toEqual(before);
	});
});
