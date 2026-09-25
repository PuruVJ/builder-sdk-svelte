/**
 * PersonalizationContainer helpers (official blocks/personalization-container/helpers.ts).
 *
 * The official SDK serialises the variants (every variant's blocks) into inline scripts 2+N times per
 * render — 27 KB each, six times over, on a real home page. Here each script string is built once per
 * variants array (+ locale) and cached for as long as that content object lives.
 */
import type { BuilderBlock } from '../types.js';
import { is_browser, is_editing } from '../internal/env.js';
import { filterWithCustomTargeting } from '../internal/vendor/personalization-fns.js';

export const DEFAULT_INDEX = 'default';
export type Variant = { blocks: BuilderBlock[]; query?: unknown; startDate?: string; endDate?: string; name?: string };

type Scripts = { personalization: string; visibility: string; hide_styles: string };
const scripts_cache = new WeakMap<object, Map<string, Scripts>>();

export function scripts_for(variants: Variant[], block_id: string, locale: string | undefined): Scripts {
	let by_key = scripts_cache.get(variants);
	if (!by_key) scripts_cache.set(variants, (by_key = new Map()));
	const key = block_id + '\0' + (locale ?? '');
	let s = by_key.get(key);
	if (!s) {
		const json = JSON.stringify(variants);
		const tail = `, "${block_id}", false${locale ? `, "${locale}"` : ''})`;
		let hide = '';
		for (let i = 0; i < variants.length; i++) hide += `div[data-variant-id="${block_id}-${i}"] { display: none !important; } `;
		s = {
			personalization: `window.builderIoPersonalization(${json}${tail}`,
			visibility: `window.updateVisibilityStylesScript(${json}${tail}`,
			hide_styles: hide
		};
		by_key.set(key, s);
	}
	return s;
}

/** official InlinedScript markup (kept out of .svelte files: a literal script close tag ends the block). */
export const script_tag = (id: string, nonce: string, body: string) =>
	`<script  data-id=${id}  nonce=${nonce || ''}>${body}</` + `script>`;

export function filter_variants(variants: Variant[], attrs: Record<string, unknown>): Variant[] {
	return variants.filter((v) =>
		(filterWithCustomTargeting as (...a: unknown[]) => boolean)(attrs, v.query, v.startDate, v.endDate)
	);
}

export function blocks_to_render(
	variants: Variant[] | undefined,
	fallback: BuilderBlock[] | undefined,
	hydrated: boolean,
	filtered: Variant[],
	previewing_index: number | null | undefined
): { blocks: BuilderBlock[]; path: string; index: number | typeof DEFAULT_INDEX } {
	const fb = { blocks: fallback ?? [], path: 'this.children', index: DEFAULT_INDEX as typeof DEFAULT_INDEX };
	if (hydrated && is_editing()) {
		if (typeof previewing_index === 'number' && previewing_index < (variants?.length ?? 0)) {
			const v = variants?.[previewing_index];
			if (v) return { blocks: v.blocks, path: `variants.${previewing_index}.blocks`, index: previewing_index };
		}
		return fb;
	}
	if (is_browser()) {
		const winner = filtered[0];
		if (winner && variants) {
			const i = variants.indexOf(winner);
			if (i !== -1) return { blocks: winner.blocks, path: `variants.${i}.blocks`, index: i };
		}
	}
	return fb;
}
