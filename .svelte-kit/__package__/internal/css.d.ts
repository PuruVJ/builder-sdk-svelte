/**
 * CSS strings — the same text the official SDK produces (helpers/css.ts, block-styles.svelte), built
 * once per block instead of twice per block per render.
 */
/** `backgroundColor` → `background-color`, memoised (a page repeats a few dozen property names). */
export declare function kebab(key: string): string;
/** `{ a: '1', b: 2 }` → `a: 1;` lines — only string values, as the official `convertStyleMapToCSSArray`. */
export declare function style_decls(style: Record<string, unknown> | undefined): string[];
/** The inline `style` attribute text of a block wrapper (official `getStyle`, svelte target). */
export declare function style_attr(style: Record<string, unknown> | undefined): string;
/** Official `createCssClass`, byte for byte. */
export declare function css_class(class_name: string, styles: Record<string, unknown>, media_query?: string): string;
/** The svelte `stringifyStyles` helper every built-in block carries: `a:b;` pairs, any value type. */
export declare function stringify_styles(obj: Record<string, unknown> | undefined): string;
