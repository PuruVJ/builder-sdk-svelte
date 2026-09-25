/**
 * APP-SHAPED bench components: the patterns the field app's registered components use (Svelte 4
 * syntax, `export let builderBlock`, `<Blocks>` for children and option arrays, `builderContext` as a
 * store, `attributes` spread on noWrap roots, an option named `children`, built-ins registered with
 * no component). Each component renders the `<Blocks>` of whichever SDK is rendering — set here
 * right before each synchronous server render.
 */
export const current: { Blocks: unknown; sdk: 'official' | 'ours' } = { Blocks: null, sdk: 'ours' };

const ELEMENT = '@builder.io/sdk:Element';
const SKIP = new Set(['builderBlock', 'builderContext', 'builderComponents', 'builderLinkComponent', 'attributes', '$$slots', '$$scope', '$$events', '$$legacy']);

/** Option arrays of blocks a container renders through `<Blocks>` (tabs, presentationBlocks, …). */
export function block_arrays(props: Record<string, unknown>): Array<[string, unknown[]]> {
	const out: Array<[string, unknown[]]> = [];
	for (const key in props) {
		if (SKIP.has(key)) continue;
		const v = props[key];
		if (Array.isArray(v) && v.length && (v[0] as Record<string, unknown>)?.['@type'] === ELEMENT) out.push([key, v]);
	}
	return out;
}

/** A few of the leaf's plain text options, the way a real leaf prints its title/labels. */
export function texts(props: Record<string, unknown>, max = 6): string[] {
	const out: string[] = [];
	for (const key in props) {
		if (SKIP.has(key)) continue;
		const v = props[key];
		if (typeof v === 'string' && v.length < 200) out.push(v);
		if (out.length === max) break;
	}
	return out;
}
