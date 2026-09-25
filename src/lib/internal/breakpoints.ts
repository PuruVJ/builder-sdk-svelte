/**
 * Responsive breakpoints — the official `getSizesForBreakpoints`, computed once per content (the
 * official SDK deep-clones the size table twice per block per render).
 */

export type SizeName = 'large' | 'medium' | 'small' | 'xsmall';
type Size = { min: number; default: number; max: number };
export type Sizes = Record<SizeName, Size>;
export interface Breakpoints {
	xsmall?: number;
	small?: number;
	medium?: number;
}

const SIZES: Sizes = {
	xsmall: { min: 0, default: 160, max: 320 },
	small: { min: 321, default: 321, max: 640 },
	medium: { min: 641, default: 642, max: 991 },
	large: { min: 990, default: 991, max: 1200 }
};

const cache = new Map<string, Sizes>();

export function sizes_for(breakpoints: Breakpoints | undefined): Sizes {
	const key = breakpoints ? `${breakpoints.xsmall}|${breakpoints.small}|${breakpoints.medium}` : '';
	let sizes = cache.get(key);
	if (sizes) return sizes;
	sizes = {
		xsmall: { ...SIZES.xsmall },
		small: { ...SIZES.small },
		medium: { ...SIZES.medium },
		large: { ...SIZES.large }
	};
	if (breakpoints) {
		const { xsmall, small, medium } = breakpoints;
		if (xsmall) {
			const xsmall_min = Math.floor(xsmall / 2);
			sizes.xsmall = { max: xsmall, min: xsmall_min, default: xsmall_min + 1 };
		}
		if (small && medium) {
			const small_min = xsmall ? sizes.xsmall.max + 1 : Math.floor(small / 2);
			sizes.small = { max: small, min: small_min, default: small_min + 1 };
			const medium_min = sizes.small.max + 1;
			sizes.medium = { max: medium, min: medium_min, default: medium_min + 1 };
			const large_min = sizes.medium.max + 1;
			sizes.large = { max: 2000, min: large_min, default: large_min + 1 };
		}
	}
	cache.set(key, sizes);
	return sizes;
}

export const max_width_query = (size: SizeName, sizes: Sizes) => `@media (max-width: ${sizes[size].max}px)`;
