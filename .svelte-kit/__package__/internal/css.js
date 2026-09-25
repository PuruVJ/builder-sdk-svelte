/**
 * CSS strings — the same text the official SDK produces (helpers/css.ts, block-styles.svelte), built
 * once per block instead of twice per block per render.
 */
const KEBAB_CACHE = new Map();
const UPPER_RE = /[A-Z]/g;
/** `backgroundColor` → `background-color`, memoised (a page repeats a few dozen property names). */
export function kebab(key) {
    let out = KEBAB_CACHE.get(key);
    if (out === undefined) {
        out = key.replace(UPPER_RE, (m) => '-' + m.toLowerCase());
        KEBAB_CACHE.set(key, out);
    }
    return out;
}
/** `{ a: '1', b: 2 }` → `a: 1;` lines — only string values, as the official `convertStyleMapToCSSArray`. */
export function style_decls(style) {
    const out = [];
    if (!style)
        return out;
    for (const key in style) {
        const value = style[key];
        if (typeof value === 'string')
            out.push(`${kebab(key)}: ${value};`);
    }
    return out;
}
/** The inline `style` attribute text of a block wrapper (official `getStyle`, svelte target). */
export function style_attr(style) {
    return style_decls(style).join(' ');
}
/** Official `createCssClass`, byte for byte. */
export function css_class(class_name, styles, media_query) {
    const css = `.${class_name} {
    ${style_decls(styles).join('\n')}
  }`;
    return media_query
        ? `${media_query} {
      ${css}
    }`
        : css;
}
/** The svelte `stringifyStyles` helper every built-in block carries: `a:b;` pairs, any value type. */
export function stringify_styles(obj) {
    let out = '';
    if (!obj)
        return out;
    for (const key in obj)
        out += kebab(key) + ':' + obj[key] + ';';
    return out;
}
