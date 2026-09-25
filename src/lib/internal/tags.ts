/**
 * Every `<style>` tag the renderer writes into its HTML, built HERE and never inside a `.svelte`
 * file: the components ship as source, and the consumer's vite-plugin-svelte finds a component's
 * style block with a regex over the whole file — a `<style` inside a string or comment of a
 * shipped component is taken for the component's own stylesheet and breaks its compile.
 * (scripts/check-dist-svelte.mjs fails the build on any such text.) The strings are byte-identical
 * to the official SDK's.
 */

const S = 'style';

/** A block's own rules (a block whose CSS is not in the content's one sheet). */
export function block_style(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-block" nonce="${nonce}">${css}</${S}>`;
}

/** The content's default CSS (official ContentStyles). */
export function content_style(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-content" nonce="${nonce}">${css}</${S}>`;
}

/** The one sheet holding every static block's rules. */
export function blocks_sheet(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-blocks" nonce="${nonce}">${css}</${S}>`;
}

/** Columns' responsive rules. */
export function columns_style(nonce: string | undefined, css: string): string {
	return `<${S} data-id="builderio-columns" nonce="${nonce ?? ''}">${css}</${S}>`;
}

/** A personalization container's variant-hiding rules (official spacing kept). */
export function variants_style(id: string | undefined, nonce: string | undefined, css: string): string {
	return `<${S}  data-id=variants-styles-${id}  nonce=${nonce}  >${css}</${S}>`;
}
