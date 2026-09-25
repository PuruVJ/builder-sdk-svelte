/**
 * PersonalizationContainer helpers (official blocks/personalization-container/helpers.ts).
 *
 * The official SDK serialises the variants (every variant's blocks) into inline scripts 2+N times per
 * render — 27 KB each, six times over, on a real home page. Here each script string is built once per
 * variants array (+ locale) and cached for as long as that content object lives.
 */
import type { BuilderBlock } from '../types.js';
export declare const DEFAULT_INDEX = "default";
export type Variant = {
    blocks: BuilderBlock[];
    query?: unknown;
    startDate?: string;
    endDate?: string;
    name?: string;
};
type Scripts = {
    personalization: string;
    visibility: string;
    hide_styles: string;
};
export declare function scripts_for(variants: Variant[], block_id: string, locale: string | undefined): Scripts;
/** official InlinedScript markup (kept out of .svelte files: a literal script close tag ends the block). */
export declare const script_tag: (id: string, nonce: string, body: string) => string;
export declare function filter_variants(variants: Variant[], attrs: Record<string, unknown>): Variant[];
export declare function blocks_to_render(variants: Variant[] | undefined, fallback: BuilderBlock[] | undefined, hydrated: boolean, filtered: Variant[], previewing_index: number | null | undefined): {
    blocks: BuilderBlock[];
    path: string;
    index: number | typeof DEFAULT_INDEX;
};
export {};
