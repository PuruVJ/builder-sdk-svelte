import { get_cookie, set_cookie } from './track.js';
import { UPDATE_COOKIES_AND_STYLES_SCRIPT, UPDATE_VARIANT_VISIBILITY_SCRIPT } from './vendor/variants-fns.js';
import { FILTER_WITH_CUSTOM_TARGETING_SCRIPT, PERSONALIZATION_SCRIPT, UPDATE_VISIBILITY_STYLES_SCRIPT } from './vendor/personalization-fns.js';
const test_key = (id) => `builder.tests.${id}`;
/** official `getVariants` — memoised per content object (it is read several times per render). */
const variants_cache = new WeakMap();
export function get_variants(content) {
    if (!content)
        return [];
    let v = variants_cache.get(content);
    if (!v) {
        v = Object.values(content.variations || {}).map((variant) => ({ ...variant, testVariationId: variant.id, id: content.id }));
        variants_cache.set(content, v);
    }
    return v;
}
function has_variations(item) {
    return item.id != null && item.variations != null && Object.keys(item.variations).length > 0;
}
function random_variation_id(id, variations) {
    let n = 0;
    const random = Math.random();
    for (const vid in variations) {
        n += variations[vid]?.testRatio;
        if (random < n)
            return vid;
    }
    return id;
}
function test_fields(item, group) {
    const value = item.variations[group];
    if (group === item.id || !value)
        return { testVariationId: item.id, testVariationName: 'Default' };
    return {
        data: value.data,
        testVariationId: value.id,
        testVariationName: value.name || (value.id === item.id ? 'Default' : '')
    };
}
/** official `handleABTestingSync` / `handleABTesting` (browser: the cookie decides, else a draw). */
export function handle_ab_testing(item, can_track) {
    if (!can_track || !item || !has_variations(item))
        return item;
    let group = get_cookie(test_key(item.id), true);
    if (!group) {
        group = random_variation_id(item.id, item.variations);
        set_cookie(test_key(item.id), group, true);
    }
    return { ...item, ...test_fields(item, group) };
}
const UPDATE_COOKIES_AND_STYLES_NAME = 'builderIoAbTest';
const UPDATE_VARIANT_VISIBILITY_NAME = 'builderIoRenderContent';
export const INIT_VARIANTS_FNS = `
  window.${UPDATE_COOKIES_AND_STYLES_NAME} = ${UPDATE_COOKIES_AND_STYLES_SCRIPT}
  window.${UPDATE_VARIANT_VISIBILITY_NAME} = ${UPDATE_VARIANT_VISIBILITY_SCRIPT}
  `;
export const INIT_PERSONALIZATION_FNS = `
  window.filterWithCustomTargeting = ${FILTER_WITH_CUSTOM_TARGETING_SCRIPT}
  window.builderIoPersonalization = ${PERSONALIZATION_SCRIPT}
  window.updateVisibilityStylesScript = ${UPDATE_VISIBILITY_STYLES_SCRIPT}
  `;
export const update_cookie_and_styles_script = (variants, content_id) => `
  window.${UPDATE_COOKIES_AND_STYLES_NAME}(
    "${content_id}",${JSON.stringify(variants)}, false, false
  )`;
export const update_variant_visibility_script = (variation_id, content_id) => `window.${UPDATE_VARIANT_VISIBILITY_NAME}(
    "${variation_id}", "${content_id}", false
  )`;
export const script_tag = (id, nonce, body) => `<script  data-id=${id}  nonce=${nonce || ''}>${body}</` + `script>`;
export const style_tag = (id, nonce, body) => `<style  data-id=${id}  nonce=${nonce}  >${body}</style>`;
