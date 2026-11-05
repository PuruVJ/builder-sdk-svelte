/**
 * Every `<style>` tag the renderer writes into its HTML, built HERE and never inside a `.svelte`
 * file: the components ship as source, and the consumer's vite-plugin-svelte finds a component's
 * style block with a regex over the whole file — a `<style` inside a string or comment of a
 * shipped component is taken for the component's own stylesheet and breaks its compile.
 * (scripts/check-dist-svelte.mjs fails the build on any such text.) The strings are byte-identical
 * to the official SDK's — except that CSS text never closes its tag (css.ts `css_safe`): block rules
 * are made safe as each rule is built (no scan of the whole sheet), the rest here.
 */
import { css_safe } from './css.js';

const S = 'style';

/** A block's own rules (a block whose CSS is not in the content's one sheet). */
export function block_style(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-block" nonce="${nonce}">${css}</${S}>`;
}

/** The content's default CSS (official ContentStyles). */
export function content_style(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-content" nonce="${nonce}">${css_safe(css)}</${S}>`;
}

/** The one sheet holding every static block's rules. */
export function blocks_sheet(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-blocks" nonce="${nonce}">${css}</${S}>`;
}

/** Columns' responsive rules. */
export function columns_style(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-columns" nonce="${nonce ?? ''}">${css_safe(css)}</${S}>`;
}

const UNQUOTED_UNSAFE_RE = /[\s"'<>=`]/;
const UNQUOTED_UNSAFE_ALL_RE = /[\s"'<>=`]/g;

/** A personalization container's variant-hiding rules (official spacing kept). The block id sits in
 *  an unquoted attribute: a character that would end it (an id from content) is dropped there. */
export function variants_style(id: string | undefined, nonce: string | undefined, css: string): string {
	const safe_id = typeof id === 'string' && UNQUOTED_UNSAFE_RE.test(id) ? id.replace(UNQUOTED_UNSAFE_ALL_RE, '') : id;
	return `<${S}  data-id=variants-styles-${safe_id}  nonce=${nonce}  >${css_safe(css)}</${S}>`;
}

const SCRIPT_BREAK_RE = new RegExp('<(/' + 'script|!--)', 'gi');

/**
 * Inline-script text that cannot end (or confuse) its script tag: a `</script` or `<!--` in it is
 * written `<\/script` / `<\!--`. Only for script text whose `<` all sit inside string literals (JSON
 * of content, quoted ids), where the escape is the same string. The official SDK inlines variants'
 * JSON as is: a Custom Code block holding a script, in a variant, ends the script early and the
 * rest of the JSON shows on the page as text.
 */
export function script_safe(js: string): string {
	return js.includes('<') ? js.replace(SCRIPT_BREAK_RE, '<\\$1') : js;
}
