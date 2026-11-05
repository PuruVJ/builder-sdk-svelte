/**
 * Every `<style>` tag the renderer writes into its HTML, built HERE and never inside a `.svelte`
 * file: the components ship as source, and the consumer's vite-plugin-svelte finds a component's
 * style block with a regex over the whole file — a `<style` inside a string or comment of a
 * shipped component is taken for the component's own stylesheet and breaks its compile.
 * (scripts/check-dist-svelte.mjs fails the build on any such text.) The strings are byte-identical
 * to the official SDK's — except that CSS text never closes its tag: a `</style` in it (a style value
 * from content) is written `<\/style`, the same CSS (`\/` is `/`). The official SDK lets it end
 * the tag, and the rest of the value becomes markup on the page.
 */

const S = 'style';
const CLOSE_RE = new RegExp('</(' + S + ')', 'gi');

/** CSS text that cannot end the style tag it is written in. */
function css_text(css: string): string {
	return css.includes('</') ? css.replace(CLOSE_RE, '<\\/$1') : css;
}

/** A block's own rules (a block whose CSS is not in the content's one sheet). */
export function block_style(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-block" nonce="${nonce}">${css_text(css)}</${S}>`;
}

/** The content's default CSS (official ContentStyles). */
export function content_style(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-content" nonce="${nonce}">${css_text(css)}</${S}>`;
}

/** The one sheet holding every static block's rules. */
export function blocks_sheet(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-blocks" nonce="${nonce}">${css_text(css)}</${S}>`;
}

/** Columns' responsive rules. */
export function columns_style(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-columns" nonce="${nonce ?? ''}">${css_text(css)}</${S}>`;
}

/** A personalization container's variant-hiding rules (official spacing kept). */
export function variants_style(id: string | undefined, nonce: string | undefined, css: string): string {
	return `<${S}  data-id=variants-styles-${id}  nonce=${nonce}  >${css_text(css)}</${S}>`;
}
