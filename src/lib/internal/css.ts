/**
 * CSS strings — the same text the official SDK produces (helpers/css.ts, block-styles.svelte), built
 * once per block instead of twice per block per render.
 */

const KEBAB_CACHE = new Map<string, string>();
const UPPER_RE = /[A-Z]/g;

/** `backgroundColor` → `background-color`, memoised (a page repeats a few dozen property names). */
export function kebab(key: string): string {
	let out = KEBAB_CACHE.get(key);
	if (out === undefined) {
		out = key.replace(UPPER_RE, (m) => '-' + m.toLowerCase());
		KEBAB_CACHE.set(key, out);
	}
	return out;
}

const CSS_NAME_CACHE = new Map<string, string>();

/** Official `camelToKebabCase`: {@link kebab}, then the WHOLE key lowercased (a non-ASCII capital
 *  too). What style keys and easings go through; `stringify_styles` keeps the svelte helper's rule. */
export function camel_to_kebab(key: string): string {
	let out = CSS_NAME_CACHE.get(key);
	if (out === undefined) {
		out = kebab(key).toLowerCase();
		CSS_NAME_CACHE.set(key, out);
	}
	return out;
}

/** `{ a: '1', b: 2 }` → `a: 1;` declarations joined by `sep` — only string values, as the official
 *  `convertStyleMapToCSSArray(...).join(sep)`. One string built in place (no array, no join). */
function style_decls(style: Record<string, unknown> | undefined, sep: string, in_tag: boolean): string {
	let out = '';
	if (!style) return out;
	for (const key in style) {
		const value = style[key];
		if (typeof value !== 'string') continue;
		if (out !== '') out += sep;
		// (a VALUE is checked, a flat string from the content: no scan of the built text)
		if (in_tag && value.includes('</')) out += camel_to_kebab(key) + ': ' + css_safe(value) + ';';
		else out += camel_to_kebab(key) + ': ' + value + ';';
	}
	return out;
}

/** The inline `style` attribute text of a block wrapper (official `getStyle`, svelte target). */
export function style_attr(style: Record<string, unknown> | undefined): string {
	return style_decls(style, ' ', false);
}

/** Official `createCssClass`, byte for byte (made safe for its style tag: {@link css_safe}). */
export function css_class(class_name: string, styles: Record<string, unknown>, media_query?: string): string {
	const name = class_name.includes('</') ? css_safe(class_name) : class_name;
	const css = '.' + name + ' {\n    ' + style_decls(styles, '\n', true) + '\n  }';
	// (the media query carries the content's breakpoints: made safe too)
	return media_query ? css_safe(media_query) + ' {\n      ' + css + '\n    }' : css;
}

const CLOSE_STYLE_RE = new RegExp('</(' + 'style)', 'gi');

/**
 * CSS text that cannot end the style tag it is written in: a `</style` in it (a style value or id
 * from content) is written `<\/style`, the same CSS (`\/` is `/`). The official SDK lets it end
 * the tag, and the rest of the value becomes markup on the page.
 */
export function css_safe(css: string): string {
	return css.includes('</') ? css.replace(CLOSE_STYLE_RE, '<\\/$1') : css;
}

/** The svelte `stringifyStyles` helper every built-in block carries: `a:b;` pairs, any value type. */
export function stringify_styles(obj: Record<string, unknown> | undefined): string {
	let out = '';
	if (!obj) return out;
	for (const key in obj) out += kebab(key) + ':' + obj[key] + ';';
	return out;
}
