/**
 * Localized values (`{ '@type': '@builder.io/core:LocalizedValue', 'en-US': …, Default: … }`).
 *
 * The official SDK walks a block's whole `component.options` (nested child blocks included) on
 * EVERY `getProcessedBlock` call — ~107 times per block per render, the single largest SSR cost it
 * has. Here each block's options are resolved once, when the block is compiled, and the result is
 * cached with it. The input is never mutated.
 *
 * The official walk replaces values IN PLACE across the whole options tree, nested blocks included,
 * so a component whose options hold blocks (a container's `items`, Columns' `columns[].blocks`)
 * receives them already resolved. Here a nested block is resolved whole, once per locale, into a
 * copy shared by every ancestor that holds it; a copy that renders the same as its block (only its
 * component options or children changed — each of those resolves on its own) compiles as that block.
 */

const LOCALIZED_TYPE = '@builder.io/core:LocalizedValue';
const ELEMENT_TYPE = '@builder.io/sdk:Element';

let warned_missing_locale = false;

/** `options` with every localized value replaced by its `locale` entry (a copy only where one was). */
export function resolve_localized(
	options: Record<string, unknown> | undefined,
	locale: string | undefined
): Record<string, unknown> | undefined {
	if (!options) return options;
	const out = walk(options, locale ?? 'Default');
	if (out !== options && !locale && !warned_missing_locale) {
		warned_missing_locale = true;
		console.warn(
			'[Builder.io] In order to use localized fields in Builder, you must pass a locale prop to the BuilderComponent or to options object while fetching the content to resolve localized fields. Learn more: https://www.builder.io/c/docs/localization-inline#targeting-and-inline-localization'
		);
	}
	return out as Record<string, unknown>;
}

/** Nested blocks resolved whole, per locale (see the header): one copy per block. */
const resolved_blocks = new Map<string, WeakMap<object, unknown>>();
/** A resolved copy → its block, when the copy renders as the block does. */
const renders_as = new WeakMap<object, object>();
/** Every resolved copy → its block. */
const copied_from = new WeakMap<object, object>();

/** The block a resolved nested-block copy renders exactly as, or undefined. */
export function original_block<T extends object>(copy: T): T | undefined {
	return renders_as.get(copy) as T | undefined;
}

/** The block a resolved nested-block copy was made from (itself when it is not a copy). */
export function source_block<T extends object>(block: T): T {
	return (copied_from.get(block) as T | undefined) ?? block;
}

function walk(value: unknown, locale: string): unknown {
	if (value === null || typeof value !== 'object') return value;
	const obj = value as Record<string, unknown>;
	// (the official walk also descends into the localized object it replaced: so does this)
	if (obj['@type'] === LOCALIZED_TYPE) return walk(obj[locale], locale) ?? undefined;
	if (obj['@type'] === ELEMENT_TYPE) {
		let blocks = resolved_blocks.get(locale);
		if (!blocks) resolved_blocks.set(locale, (blocks = new WeakMap()));
		let out = blocks.get(obj);
		if (out === undefined) {
			out = walk_entries(obj, locale);
			blocks.set(obj, out);
			if (out !== obj) {
				copied_from.set(out as object, obj);
				if (same_render(obj, out as Record<string, unknown>)) renders_as.set(out as object, obj);
			}
		}
		return out;
	}
	if (Array.isArray(value)) {
		let out: unknown[] | null = null;
		for (let i = 0; i < value.length; i++) {
			const next = walk(value[i], locale);
			if (next !== value[i]) (out ??= value.slice())[i] = next;
		}
		return out ?? value;
	}
	return walk_entries(obj, locale);
}

function walk_entries(obj: Record<string, unknown>, locale: string): unknown {
	let out: Record<string, unknown> | null = null;
	for (const key in obj) {
		const cur = obj[key];
		const next = walk(cur, locale);
		if (next !== cur) (out ??= { ...obj })[key] = next;
	}
	return out ?? obj;
}

/** Only `component.options` changed, and children that themselves render as their blocks: the block
 *  resolves its own options when it renders, and each child its own. */
function same_render(block: Record<string, unknown>, copy: Record<string, unknown>): boolean {
	for (const key in block) {
		if (block[key] === copy[key]) continue;
		if (key === 'children') {
			const a = block.children as unknown[];
			const b = copy.children as unknown[];
			for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && renders_as.get(b[i] as object) !== a[i]) return false;
			continue;
		}
		if (key !== 'component') return false;
		const a = block.component as Record<string, unknown>;
		const b = copy.component as Record<string, unknown>;
		for (const k in a) if (k !== 'options' && a[k] !== b[k]) return false;
	}
	return true;
}

/**
 * Blocks whose options hold (at any depth, through nested blocks) a block that owns a localized
 * value own one too, as the official walk sees it: added to `localized`. One more walk over the
 * content, run only when it has localized values at all. Gives up after `budget` objects (a cycle).
 */
export function mark_option_owners(root: unknown[], localized: Set<object>, budget: number): void {
	type Chain = { block: object; up: Chain } | null;
	const values: unknown[] = [root];
	const chains: Chain[] = [null];
	while (values.length) {
		if (--budget === 0) return;
		const value = values.pop();
		const chain = chains.pop()!;
		if (value === null || typeof value !== 'object') continue;
		const obj = value as Record<string, unknown>;
		if (!Array.isArray(value) && obj['@type'] === ELEMENT_TYPE) {
			// Pre-order: an ancestor that owns one was met first and has marked its own ancestors.
			if (localized.has(obj)) for (let c: Chain = chain; c && !localized.has(c.block); c = c.up) localized.add(c.block);
			const component = obj.component as Record<string, unknown> | null | undefined;
			if (component?.options) {
				values.push(component.options);
				chains.push({ block: obj, up: chain });
			}
			for (const key in obj) {
				if (key === 'component') continue;
				values.push(obj[key]);
				chains.push(chain);
			}
			continue;
		}
		for (const key in obj) {
			values.push(obj[key]);
			chains.push(chain);
		}
	}
}
