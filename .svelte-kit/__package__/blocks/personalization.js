import { is_browser, is_editing } from '../internal/env.js';
import { filterWithCustomTargeting } from '../internal/vendor/personalization-fns.js';
export const DEFAULT_INDEX = 'default';
const scripts_cache = new WeakMap();
export function scripts_for(variants, block_id, locale) {
    let by_key = scripts_cache.get(variants);
    if (!by_key)
        scripts_cache.set(variants, (by_key = new Map()));
    const key = block_id + '\0' + (locale ?? '');
    let s = by_key.get(key);
    if (!s) {
        const json = JSON.stringify(variants);
        const tail = `, "${block_id}", false${locale ? `, "${locale}"` : ''})`;
        let hide = '';
        for (let i = 0; i < variants.length; i++)
            hide += `div[data-variant-id="${block_id}-${i}"] { display: none !important; } `;
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
export const script_tag = (id, nonce, body) => `<script  data-id=${id}  nonce=${nonce || ''}>${body}</` + `script>`;
export function filter_variants(variants, attrs) {
    return variants.filter((v) => filterWithCustomTargeting(attrs, v.query, v.startDate, v.endDate));
}
export function blocks_to_render(variants, fallback, hydrated, filtered, previewing_index) {
    const fb = { blocks: fallback ?? [], path: 'this.children', index: DEFAULT_INDEX };
    if (hydrated && is_editing()) {
        if (typeof previewing_index === 'number' && previewing_index < (variants?.length ?? 0)) {
            const v = variants?.[previewing_index];
            if (v)
                return { blocks: v.blocks, path: `variants.${previewing_index}.blocks`, index: previewing_index };
        }
        return fb;
    }
    if (is_browser()) {
        const winner = filtered[0];
        if (winner && variants) {
            const i = variants.indexOf(winner);
            if (i !== -1)
                return { blocks: winner.blocks, path: `variants.${i}.blocks`, index: i };
        }
    }
    return fb;
}
