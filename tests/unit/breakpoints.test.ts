// breakpoints.ts vs the official constants/device-sizes.ts (getSizesForBreakpoints, getMaxWidthQueryForSize).
import { describe, expect, it, vi } from 'vitest';
import {
	getMaxWidthQueryForSize,
	getSizesForBreakpoints
} from '../../node_modules/@builder.io/sdk-svelte/src/constants/device-sizes';
import { max_width_query, sizes_for, type Breakpoints, type SizeName } from '../../src/lib/internal/breakpoints';

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

const SIZE_NAMES: SizeName[] = ['large', 'medium', 'small', 'xsmall'];
const NASTY = [undefined, 0, -0, -1, -640, 1, 2, 3, 319.5, 320, 321, 640, 641, 991, 1200, 99999, NaN, Infinity, -Infinity, 1e-9];

const TABLE: (Breakpoints | undefined)[] = [
	undefined,
	{},
	{ xsmall: 0 },
	{ small: 0, medium: 0 },
	{ xsmall: 320 },
	{ xsmall: 480 },
	{ small: 640 },
	{ medium: 991 },
	{ small: 640, medium: 991 },
	{ small: 700, medium: 1100 },
	{ xsmall: 400, small: 700, medium: 1100 },
	{ xsmall: 400, small: 700 },
	{ xsmall: 400, medium: 1100 },
	{ xsmall: -10, small: -20, medium: -30 },
	{ xsmall: NaN, small: NaN, medium: NaN },
	{ small: NaN, medium: 900 },
	{ xsmall: 1, small: 1, medium: 1 },
	{ xsmall: 321.7, small: 640.2, medium: 990.9 },
	{ xsmall: Infinity, small: Infinity, medium: Infinity },
	{ small: 900, medium: 500 } // medium below small: copied as the official does
];

describe('sizes_for vs official getSizesForBreakpoints', () => {
	it.each(TABLE.map((b) => [JSON.stringify(b) ?? 'undefined', b]))('%s', (_, b) => {
		expect(sizes_for(b)).toEqual(getSizesForBreakpoints(b as Breakpoints));
	});

	it('a seeded sweep of 500 breakpoint sets (missing, 0, negative, NaN, floats)', () => {
		const r = mulberry32(0xb4e4);
		const pick = () => (r() < 0.5 ? NASTY[Math.floor(r() * NASTY.length)] : Math.floor(r() * 3000) - 500);
		for (let i = 0; i < 500; i++) {
			const b: Breakpoints = {};
			if (r() < 0.7) b.xsmall = pick();
			if (r() < 0.7) b.small = pick();
			if (r() < 0.7) b.medium = pick();
			expect(sizes_for(b), JSON.stringify(b)).toEqual(getSizesForBreakpoints(b));
		}
	});

	it('the defaults when nothing is customised', () => {
		expect(sizes_for(undefined)).toEqual({
			xsmall: { min: 0, default: 160, max: 320 },
			small: { min: 321, default: 321, max: 640 },
			medium: { min: 641, default: 642, max: 991 },
			large: { min: 990, default: 991, max: 1200 }
		});
		expect(sizes_for({})).toEqual(sizes_for(undefined));
	});

	it('only xsmall: small/medium/large keep their defaults', () => {
		const s = sizes_for({ xsmall: 500 });
		expect(s.xsmall).toEqual({ max: 500, min: 250, default: 251 });
		expect(s.small).toEqual({ min: 321, default: 321, max: 640 });
		expect(s.large.max).toBe(1200);
	});

	it('small and medium both set: large goes to 2000', () => {
		expect(sizes_for({ small: 700, medium: 1100 }).large).toEqual({ max: 2000, min: 1101, default: 1102 });
	});
});

describe('sizes_for cache', () => {
	it('returns the same object for equal input', () => {
		const a = sizes_for({ xsmall: 333, small: 666, medium: 999 });
		const b = sizes_for({ xsmall: 333, small: 666, medium: 999 });
		expect(b).toBe(a);
		expect(sizes_for({ medium: 999, small: 666, xsmall: 333 })).toBe(a); // key order does not matter
		expect(sizes_for({ xsmall: 333, small: 666, medium: 998 })).not.toBe(a);
	});

	it('undefined and {} share no entry but are equal; repeated undefined is one object', () => {
		expect(sizes_for(undefined)).toBe(sizes_for(undefined));
		expect(sizes_for({})).toBe(sizes_for({}));
		expect(sizes_for({})).toEqual(sizes_for(undefined));
	});

	it('NaN keys hit the cache like any other value', () => {
		expect(sizes_for({ small: NaN, medium: NaN })).toBe(sizes_for({ small: NaN, medium: NaN }));
	});

	it('the cached table does not alias the module defaults (each entry is its own copy)', async () => {
		vi.resetModules();
		const fresh = await import('../../src/lib/internal/breakpoints');
		const a = fresh.sizes_for(undefined);
		const b = fresh.sizes_for({ xsmall: 400 });
		expect(a.small).not.toBe(b.small);
		expect(a.small).toEqual(b.small);
		expect(a.xsmall).not.toEqual(b.xsmall);
	});
});

describe('max_width_query vs official getMaxWidthQueryForSize', () => {
	it('matches for every size over the table and a sweep', () => {
		const r = mulberry32(7);
		const inputs: (Breakpoints | undefined)[] = [...TABLE];
		for (let i = 0; i < 100; i++) inputs.push({ xsmall: Math.floor(r() * 900), small: Math.floor(r() * 1500), medium: Math.floor(r() * 2500) });
		for (const b of inputs) {
			const ours = sizes_for(b);
			const official = getSizesForBreakpoints(b as Breakpoints);
			for (const size of SIZE_NAMES) expect(max_width_query(size, ours)).toBe(getMaxWidthQueryForSize(size, official));
		}
	});

	it('the default table', () => {
		for (const size of SIZE_NAMES) expect(max_width_query(size, sizes_for(undefined))).toBe(getMaxWidthQueryForSize(size));
		expect(max_width_query('medium', sizes_for(undefined))).toBe('@media (max-width: 991px)');
	});
});
