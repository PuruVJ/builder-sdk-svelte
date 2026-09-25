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

/** `{ a: '1', b: 2 }` → `a: 1;` declarations joined by `sep` — only string values, as the official
 *  `convertStyleMapToCSSArray(...).join(sep)`. One string built in place (no array, no join). */
function style_decls(style: Record<string, unknown> | undefined, sep: string): string {
	let out = '';
	if (!style) return out;
	for (const key in style) {
		const value = style[key];
		if (typeof value !== 'string') continue;
		if (out !== '') out += sep;
		out += kebab(key) + ': ' + value + ';';
	}
	return out;
}

/** The inline `style` attribute text of a block wrapper (official `getStyle`, svelte target). */
export function style_attr(style: Record<string, unknown> | undefined): string {
	return style_decls(style, ' ');
}

/** Official `createCssClass`, byte for byte. */
export function css_class(class_name: string, styles: Record<string, unknown>, media_query?: string): string {
	const css = '.' + class_name + ' {\n    ' + style_decls(styles, '\n') + '\n  }';
	return media_query ? media_query + ' {\n      ' + css + '\n    }' : css;
}

/** The svelte `stringifyStyles` helper every built-in block carries: `a:b;` pairs, any value type. */
export function stringify_styles(obj: Record<string, unknown> | undefined): string {
	let out = '';
	if (!obj) return out;
	for (const key in obj) out += kebab(key) + ':' + obj[key] + ';';
	return out;
}
