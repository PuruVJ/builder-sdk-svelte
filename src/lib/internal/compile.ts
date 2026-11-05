/**
 * THE COMPILER — everything about a block that does not depend on state, computed once.
 *
 * The official SDK derives a block's render inputs from scratch every time its template reads one of
 * them: ~107 `getProcessedBlock` calls per block per render (each a full walk of the block's
 * options), ~65 registry lookups, 9 option merges, CSS built twice with a deep-cloned size table.
 *
 * Here a block compiles ONCE per plan into a `Compiled` record: resolved component, merged options,
 * wrapper attributes, CSS text, compiled bindings / repeat / text templates / actions. A render of a
 * static block is then a handful of property reads. A block with bindings compiles its STATIC part
 * once and, per render, applies the bindings through a copy-on-write path and re-derives only that
 * block (linear, no whole-subtree clone).
 *
 * The plan also builds ONE stylesheet for every static block it can reach from the content, so the
 * page gets one `<style>` instead of one per block.
 */
import type { BuilderBlock, BuilderContent, RegisteredComponent } from '../types.js';
import { max_width_query, sizes_for, type Sizes } from './breakpoints.js';
import { camel_to_kebab, css_class, style_attr } from './css.js';
import { compile_code } from './evaluate.js';
import { mark_option_owners, original_block, resolve_localized, source_block } from './localized.js';
import { parse_path } from './paths.js';
import { lookup, type Registry } from './registry.js';

const ELEMENT_TYPE = '@builder.io/sdk:Element';
const LOCALIZED_TYPE = '@builder.io/core:LocalizedValue';
const EMPTY_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const TEXT_TPL_RE = /{{([^}]+)}}/g;

type Fn = ReturnType<typeof compile_code>;

export interface Compiled {
	src: BuilderBlock;
	/** What `builderBlock` is: `src`, or a copy with localized options resolved. */
	builder_block: BuilderBlock;
	id: string | undefined;
	/** null: the block names no component; undefined: it names one that is not registered. */
	comp: RegisteredComponent | null | undefined;
	no_wrap: boolean;
	is_link: boolean;
	tag: string;
	empty_tag: boolean;
	/** `component.options` (localized) + `block.options` — the component's props. */
	options: Record<string, unknown>;
	/** A Text block's `{{expr}}` template, compiled. */
	text_tpl: Array<string | { fn: Fn; code: string }> | null;
	/** href, properties, builder-id, style, class — the wrapper element's attributes. */
	attrs: Record<string, unknown>;
	actions: Array<[event: string, code: string, fn: Fn]> | null;
	bindings: Array<{ path: string[]; code: string; fn: Fn }> | null;
	repeat: { code: string; fn: Fn; item_name: string; block: BuilderBlock } | null;
	/** official Block `canShowBlock` (non-repeat) */
	visible: boolean;
	/** official BlockStyles `canShowBlock` + css text */
	css: string;
	children: BuilderBlock[];
	/** Its rules are in the plan's one sheet (it emits no style tag of its own). */
	in_sheet?: boolean;
	/** The subtree as plain HTML (plain.ts): undefined = not computed yet, null = has behaviour. */
	html?: string | null;
	/** The plain subtree contains a link (a link component, when set, needs a live <Block>). */
	links?: boolean;
}

export interface PlanOptions {
	registry: Registry;
	model: string;
	locale: string | undefined;
	breakpoints: { xsmall?: number; small?: number; medium?: number } | null | undefined;
	/**
	 * The editor / preview leg (internal/live.ts): the content changes under a mounted tree. The plan
	 * outlives every edit (an untouched block stays a cache hit), so it keeps no page-wide shape: no
	 * one sheet (each block carries its own style tag, which follows its edits), no plain-string
	 * subtrees, and lists are keyed by block id so an edited block updates in place.
	 */
	live?: boolean;
}

export class Plan {
	readonly options: PlanOptions;
	readonly registry: Registry;
	readonly model: string;
	readonly locale: string | undefined;
	readonly sizes: Sizes;
	readonly has_xsmall: boolean;
	readonly live: boolean;
	readonly compiled = new WeakMap<BuilderBlock, Compiled>();
	/** Repeated blocks (the per-item copy without `repeat`) whose rules are in {@link sheet}; every
	 *  other block carries that on its compiled record (`in_sheet`), no lookup needed. */
	readonly repeat_in_sheet = new WeakSet<BuilderBlock>();
	sheet = '';
	/** What the content uses that needs page-level helper scripts (found by the same one walk). */
	readonly flags = { personalization: false, ab: false, symbols: false };

	constructor(opts: PlanOptions) {
		this.options = opts;
		this.registry = opts.registry;
		this.model = opts.model;
		this.locale = opts.locale;
		this.sizes = sizes_for(opts.breakpoints ?? {});
		this.has_xsmall = Boolean(opts.breakpoints?.xsmall);
		this.live = opts.live === true;
	}

	#keys: WeakMap<object, Map<BuilderBlock, unknown>> | undefined;

	/**
	 * A block's key in a list's keyed each. Static: the block object itself. Live: its id (a list
	 * re-sent by the editor is all new objects; the id is what stays), made unique within the list —
	 * a duplicated or missing id must never collide (`#index`, `id~n`).
	 */
	key(list: readonly unknown[], block: BuilderBlock): unknown {
		if (!this.live) return block;
		const keys_by_list = (this.#keys ??= new WeakMap());
		let keys = keys_by_list.get(list);
		if (!keys) {
			keys = new Map();
			// (every key given out is used: a block whose id IS `a~1` never collides with a second `a`)
			const used = new Set<string>();
			for (let i = 0; i < list.length; i++) {
				const b = list[i] as BuilderBlock;
				if (keys.has(b)) continue;
				const base = typeof b?.id === 'string' && b.id !== '' ? b.id : '#' + i;
				let key = base;
				for (let n = 1; used.has(key); n++) key = base + '~' + n;
				used.add(key);
				keys.set(b, key);
			}
			keys_by_list.set(list, keys);
		}
		return keys.get(block) ?? block;
	}

	/** The block's compiled record (cached for the life of the plan). */
	compile(block: BuilderBlock): Compiled {
		let c = this.compiled.get(block);
		if (!c) {
			// a nested block's resolved copy (localized.ts) renders as the block itself — when it was
			// resolved for this plan's locale (a symbol's blocks come resolved for the parent's)
			const original = original_block(block, this.locale ?? 'Default');
			c = original ? this.compile(original) : compile_block(block, this, false, block.tagName);
			this.compiled.set(block, c);
		}
		return c;
	}

	/** The block's rules are already in {@link sheet}: it emits no style tag of its own. */
	is_in_sheet(c: Compiled): boolean {
		return c.in_sheet === true || this.repeat_in_sheet.has(c.src);
	}

	/**
	 * ONE walk over the content: find every block reachable from `blocks` (children, and blocks
	 * nested anywhere in options — a Columns column, a custom container's slot), note which blocks
	 * own localized values, then compile each block once and gather the CSS of the static, visible
	 * ones into {@link sheet}.
	 *
	 * This walk is the only full pass over the content's data, so it is kept to the bone: an explicit
	 * stack (any depth), only objects pushed, no per-object bookkeeping. Content is a tree (JSON), so
	 * there is no `seen` set; a cycle — only possible in hand-built content — exhausts a visit budget
	 * and falls back to a walk that tracks what it has seen. A block found to own no localized value
	 * compiles without the localized-value walk of its options.
	 */
	prepare(blocks: BuilderBlock[] | undefined): void {
		if (!blocks || this.live) return;
		const localized = new Set<BuilderBlock>();
		const found = find_blocks(blocks, localized, this.flags, MAX_VISITS) ?? find_blocks_guarded(blocks, localized, this.flags);
		const any_localized = localized.size > 0; // most content has none: no lookup per block
		if (any_localized) mark_option_owners(blocks, localized, MAX_VISITS);
		let sheet = '';
		// A block's id is its class name, so a rule in the sheet styles every element with that id —
		// also one rendered by ANOTHER block with the same id, when the block it was written for never
		// renders. Duplicate ids are rare: they are found by a sort (no hashing per block), and only
		// then is the sheet rebuilt without the ids whose blocks disagree on styles (see unsheet).
		const ids: unknown[] = [];
		const elsewhere = this.flags.symbols ? styled_elsewhere(found, this.sizes) : null;
		for (let i = 0; i < found.length; i++) {
			const block = found[i];
			if (this.compiled.has(block)) continue; // the same object reached twice
			const c = compile_block(block, this, !(any_localized && localized.has(block)), block.tagName);
			this.compiled.set(block, c);
			if (c.id !== undefined) ids.push(c.id);
			if (!c.bindings && c.css && !(any_no_sheet && NO_SHEET.has(source_block(block))) && !elsewhere?.has(block)) {
				sheet = sheet === '' ? c.css : sheet + ' ' + c.css;
				c.in_sheet = true;
				// The repeated block renders `c.repeat.block` per item: same styles, already in.
				if (c.repeat) this.repeat_in_sheet.add(c.repeat.block);
			}
		}
		this.sheet = has_duplicates(ids) ? this.unsheet(found, sheet) : sheet;
	}

	/** `sheet` without the rules of blocks whose id another block shares with different styles: each
	 *  of those renders its own style tag, as in the official SDK. */
	private unsheet(found: BuilderBlock[], sheet: string): string {
		const styles_by_id = new Map<unknown, string>();
		const clashes = new Set<unknown>();
		const blocks = new Set<Compiled>();
		for (let i = 0; i < found.length; i++) {
			const c = this.compiled.get(found[i])!;
			if (c.id === undefined || blocks.has(c)) continue;
			blocks.add(c);
			const styles = c.bindings ? BOUND_STYLES : c.css;
			const seen = styles_by_id.get(c.id);
			if (seen === undefined) styles_by_id.set(c.id, styles);
			else if (seen !== styles || styles === BOUND_STYLES) clashes.add(c.id);
		}
		if (!clashes.size) return sheet;
		sheet = '';
		for (const c of blocks) {
			if (clashes.has(c.id)) {
				// (also out of a nested content's sheet: an inline symbol's own plan, which may render a
				// localized copy of the block)
				NO_SHEET.add(source_block(c.src));
				any_no_sheet = true;
				if (!c.in_sheet) continue;
				c.in_sheet = false;
				if (c.repeat) this.repeat_in_sheet.delete(c.repeat.block);
			} else if (c.in_sheet) sheet = sheet === '' ? c.css : sheet + ' ' + c.css;
		}
		return sheet;
	}

	/** Compile a block without caching (a bound block's per-render copy). Its tag is `tag_name`: the
	 *  official Block reads the tag from the block as written, never from a bound `tagName`. */
	compile_fresh(block: BuilderBlock, tag_name: string | undefined): Compiled {
		return compile_block(block, this, false, tag_name);
	}
}

/** Blocks whose id clashes with another block's (Plan.unsheet): never in any plan's sheet. */
const NO_SHEET = new WeakSet<BuilderBlock>();
let any_no_sheet = false;
/**
 * The blocks of inline symbols whose breakpoints differ from this content's. A symbol's blocks
 * render in the symbol's own <Content>, styled by ITS sheet with ITS breakpoints: rules for them
 * here would use the wrong media queries (and reach them, as they share the class names). That is
 * its content's blocks and the blocks in its `data` (a Slot in the symbol renders those).
 */
function styled_elsewhere(found: BuilderBlock[], sizes: Sizes): Set<BuilderBlock> | null {
	let out: Set<BuilderBlock> | null = null;
	for (let i = 0; i < found.length; i++) {
		const component = found[i].component;
		if (component?.name !== 'Symbol') continue;
		const symbol = component.options?.symbol as { content?: BuilderContent } | undefined;
		const content = symbol?.content;
		if (!content || sizes_for(content.meta?.breakpoints ?? {}) === sizes) continue; // (as Plan's)
		const flags = { personalization: false, ab: false, symbols: false };
		for (const block of find_blocks_guarded([symbol as BuilderBlock], new Set(), flags)) (out ??= new Set()).add(block);
	}
	return out;
}

/** Two equal values in `values` (sorted in place: comparing strings needs no hash per value). */
function has_duplicates(values: unknown[]): boolean {
	if (values.length < 2) return false;
	values.sort();
	for (let i = 1; i < values.length; i++) if (values[i] === values[i - 1]) return true;
	return false;
}

/** What a bound block's styles count as when ids are compared: never equal (they depend on state). */
const BOUND_STYLES = '\0bound';

/** Objects one content walk may visit before it assumes a cycle (a 4 MB page has ~200 000). */
const MAX_VISITS = 1 << 23;
type Flags = Plan['flags'];

/** A nested content (an inline symbol) with A/B variations needs the page's variant helpers. */
function has_variations(obj: Record<string, unknown>): boolean {
	const v = obj.variations;
	if (!v || typeof v !== 'object' || !obj.data) return false;
	for (const _ in v) return true;
	return false;
}

/**
 * Every Element reachable from `root`, in document order along block lists; owners of localized
 * values into `localized`; page flags into `flags`. Null when the visit budget runs out (a cycle).
 * Parallel stacks: the value; the block whose `component.options` it sits in (localized values
 * belong to that block; a nested block owns its own); and whether it is an item of a block list.
 *
 * Content data comes in hundreds of object shapes, so reading `obj['@type']` / `obj.variations` on
 * every object is a megamorphic load each. Instead each ARRAY is classified once by its first item:
 * the items of a block list read `@type` directly (all Elements, one shape family); every other
 * object is recognised from its own keys while they are iterated anyway (`@type`, `variations`),
 * and an Element met that way drops what its loop had pushed and is walked as a block.
 */
function find_blocks(root: BuilderBlock[], localized: Set<BuilderBlock>, flags: Flags, budget: number): BuilderBlock[] | null {
	const found: BuilderBlock[] = [];
	const values: object[] = [root];
	const owners: Array<BuilderBlock | null> = [null];
	const listed: boolean[] = [false];
	while (values.length) {
		if (--budget === 0) return null;
		const value = values.pop()!;
		const owner = owners.pop()!;
		const in_block_list = listed.pop()!;
		if (Array.isArray(value)) {
			const first = value[0];
			const block_list = typeof first === 'object' && first !== null && first['@type'] === ELEMENT_TYPE;
			for (let i = value.length - 1; i >= 0; i--) {
				const v = value[i];
				if (typeof v === 'object' && v !== null) {
					values.push(v);
					owners.push(owner);
					listed.push(block_list);
				}
			}
			continue;
		}
		const obj = value as Record<string, unknown>;
		let is_block = false;
		if (in_block_list) {
			const type = obj['@type'];
			if (type === ELEMENT_TYPE) is_block = true;
			else {
				if (type === LOCALIZED_TYPE && owner) localized.add(owner);
				if (!flags.ab && has_variations(obj)) flags.ab = true;
				for (const key in obj) {
					const v = obj[key];
					if (typeof v === 'object' && v !== null) {
						values.push(v);
						owners.push(owner);
						listed.push(false);
					}
				}
				continue;
			}
		} else {
			const mark = values.length;
			for (const key in obj) {
				const v = obj[key];
				if (typeof v === 'object') {
					if (v === null) continue;
					values.push(v);
					owners.push(owner);
					listed.push(false);
					if (key === 'variations' && !flags.ab && obj.data) for (const _ in v) { flags.ab = true; break; }
				} else if (key === '@type') {
					if (v === ELEMENT_TYPE) {
						is_block = true;
						break;
					}
					if (v === LOCALIZED_TYPE && owner) localized.add(owner);
				}
			}
			if (is_block) values.length = owners.length = listed.length = mark;
		}
		if (!is_block) continue;
		const block = obj as BuilderBlock;
		found.push(block);
		const component = block.component;
		// visited after this block: children, then component options, then block options
		if (block.options) {
			values.push(block.options);
			owners.push(owner);
			listed.push(false);
		}
		if (component) {
			if (component.name === 'PersonalizationContainer') flags.personalization = true;
			else if (component.name === 'Symbol') flags.symbols = true;
			if (component.options) {
				values.push(component.options);
				owners.push(block);
				listed.push(false);
			}
		}
		if (block.children) {
			values.push(block.children);
			owners.push(owner);
			listed.push(false);
		}
		// A block inside another block's component options: the official resolves the holder's
		// options WHOLE, so a localized value in any field of this block (properties, styles…) is
		// the holder's too.
		if (owner) for (const key in obj) {
			if (key === 'component' || key === 'children' || key === 'options') continue;
			const v = obj[key];
			if (typeof v === 'object' && v !== null) {
				values.push(v);
				owners.push(owner);
				listed.push(false);
			}
		}
	}
	return found;
}

/** {@link find_blocks} for content with cycles: the same walk, remembering what it has seen. */
function find_blocks_guarded(root: BuilderBlock[], localized: Set<BuilderBlock>, flags: Flags): BuilderBlock[] {
	const found: BuilderBlock[] = [];
	const seen = new WeakSet<object>();
	const values: object[] = [root];
	const owners: Array<BuilderBlock | null> = [null];
	while (values.length) {
		const value = values.pop()!;
		const owner = owners.pop()!;
		if (seen.has(value)) continue;
		seen.add(value);
		const obj = value as Record<string, unknown>;
		let owner_of_children = owner;
		if (!Array.isArray(value)) {
			if (obj['@type'] === ELEMENT_TYPE) {
				const block = obj as BuilderBlock;
				found.push(block);
				if (block.component?.name === 'PersonalizationContainer') flags.personalization = true;
				else if (block.component?.name === 'Symbol') flags.symbols = true;
				// (as find_blocks: inside a holder's options, every field of the block is the holder's)
				for (const [v, o] of [
					[block.options, owner],
					[block.component?.options, block],
					[block.children, owner]
				] as const)
					if (v && typeof v === 'object') {
						values.push(v);
						owners.push(o);
					}
				if (owner)
					for (const key in obj) {
						if (key === 'component' || key === 'children' || key === 'options') continue;
						const v = obj[key];
						if (typeof v === 'object' && v !== null) {
							values.push(v);
							owners.push(owner);
						}
					}
				continue;
			}
			if (obj['@type'] === LOCALIZED_TYPE && owner) localized.add(owner);
			if (!flags.ab && has_variations(obj)) flags.ab = true;
		}
		const keys = Object.keys(obj);
		for (let i = keys.length - 1; i >= 0; i--) {
			const v = obj[keys[i]];
			if (typeof v === 'object' && v !== null) {
				values.push(v);
				owners.push(owner_of_children);
			}
		}
	}
	return found;
}

function compile_block(block: BuilderBlock, plan: Plan, no_localized: boolean, tag_name: string | undefined): Compiled {
	const raw_options = block.component?.options;
	// A block the content walk found to own no localized value skips the walk of its options.
	const resolved = no_localized ? raw_options : resolve_localized(raw_options, plan.locale);
	const builder_block =
		resolved !== raw_options ? { ...block, component: { ...block.component!, options: resolved } } : block;

	const name = block.component?.name;
	const comp = name ? lookup(plan.registry, name, plan.model) : null;

	// (official getBlockComponentOptions: a Text block with a string text spreads its component
	// options again, last — they win over block.options)
	const options: Record<string, unknown> = block.options
		? name === 'Text' && typeof resolved?.text === 'string' && resolved.text !== ''
			? { ...resolved, ...block.options, ...resolved }
			: { ...resolved, ...block.options }
		: (resolved ?? NO_OPTIONS);

	let text_tpl: Compiled['text_tpl'] = null;
	if (name === 'Text' && typeof resolved?.text === 'string' && resolved.text.includes('{{')) {
		text_tpl = [];
		let last = 0;
		for (const m of resolved.text.matchAll(TEXT_TPL_RE)) {
			text_tpl.push(resolved.text.slice(last, m.index));
			text_tpl.push({ fn: compile_code(m[1]), code: m[1] });
			last = m.index! + m[0].length;
		}
		text_tpl.push(resolved.text.slice(last));
	}

	let cls = block.id ? block.id + ' builder-block' : 'builder-block';
	if (block.class) cls += ' ' + block.class;
	if (block.properties?.class) cls += ' ' + block.properties.class;
	// (official getBlockProperties: `{ href: block.href, ...block.properties, … }` — `href` comes first
	// even when only `properties` has one; an undefined value renders nothing)
	const attrs: Record<string, unknown> = { href: block.href };
	if (block.properties) Object.assign(attrs, block.properties);
	attrs['builder-id'] = block.id;
	attrs.style = style_attr(block.style);
	attrs.class = cls;

	let actions: Compiled['actions'] = null;
	if (block.actions) {
		for (const key in block.actions) {
			if (!Object.prototype.hasOwnProperty.call(block.actions, key)) continue;
			const code = block.actions[key];
			(actions ??= []).push([key.toLowerCase(), code, compile_code(code, false)]);
		}
	}

	let bindings: Compiled['bindings'] = null;
	if (block.bindings) {
		for (const path in block.bindings) {
			const code = block.bindings[path];
			(bindings ??= []).push({ path: parse_path(path), code, fn: code.trim() === '' ? null : compile_code(code) });
		}
	}

	let repeat: Compiled['repeat'] = null;
	if (block.repeat?.collection) {
		const { repeat: _r, ...without } = block;
		const collection = block.repeat.collection;
		const collection_name = collection.split('.').pop();
		repeat = {
			code: collection,
			fn: compile_code(collection),
			item_name: block.repeat.itemName || (collection_name ? collection_name + 'Item' : 'item'),
			block: without as BuilderBlock
		};
	}

	const is_link = tag_name === 'a' || !!block.properties?.href || !!block.href;
	const tag = is_link ? 'a' : tag_name || 'div';

	const shows_block = !('show' in block) || !!block.show;
	const hides_block = 'hide' in block ? !!block.hide : false;

	return {
		src: block,
		builder_block,
		id: block.id,
		comp,
		no_wrap: comp?.noWrap === true,
		is_link,
		tag,
		empty_tag: tag !== 'div' && EMPTY_TAGS.has(tag.toLowerCase()),
		options,
		text_tpl,
		attrs,
		actions,
		bindings,
		repeat,
		visible: shows_block && !hides_block,
		css: styles_visible(block) ? block_css(block, plan) : '',
		children: block.children ?? NO_CHILDREN
	};
}

// Shared empties for the common block without options / children (read-only: never mutated).
const NO_OPTIONS: Record<string, unknown> = Object.freeze({}) as Record<string, unknown>;
const NO_CHILDREN: BuilderBlock[] = Object.freeze([]) as unknown as BuilderBlock[];

/** official BlockStyles `canShowBlock` */
function styles_visible(block: BuilderBlock): boolean {
	if (block.hide !== undefined && block.hide !== null) return !block.hide;
	if (block.show !== undefined && block.show !== null) return !!block.show;
	return true;
}

/** official BlockStyles `css()` — the same text, once. */
export function block_css(block: BuilderBlock, plan: Plan): string {
	const class_name = block.id;
	if (!class_name) return '';
	const styles = block.responsiveStyles;
	const large = styles?.large ? css_class(class_name, styles.large) : '';
	const medium = styles?.medium ? css_class(class_name, styles.medium, max_width_query('medium', plan.sizes)) : '';
	const small = styles?.small ? css_class(class_name, styles.small, max_width_query('small', plan.sizes)) : '';
	const xsmall =
		styles?.xsmall && plan.has_xsmall ? css_class(class_name, styles.xsmall, max_width_query('xsmall', plan.sizes)) : '';
	let hover = '';
	const hover_anim = block.animations?.find((a) => a.trigger === 'hover');
	if (hover_anim) {
		hover = css_class(`${class_name}:hover`, {
			...(hover_anim.steps?.[1]?.styles || {}),
			transition: `all ${hover_anim.duration}s ${hover_anim.easing ? camel_to_kebab(String(hover_anim.easing)) : ''}`, // (official camelToKebabCase: '' when none)
			transitionDelay: hover_anim.delay ? `${hover_anim.delay}s` : '0s'
		});
	}
	if (!large && !medium && !small && !xsmall && !hover) return '';
	return large + ' ' + medium + ' ' + small + ' ' + xsmall + ' ' + hover;
}

// ── plan cache: one plan per (content object, registry, model, locale) ──────────────────────────
const plans = new WeakMap<object, Map<string, Plan>>();
const registry_ids = new WeakMap<Registry, number>();
let next_registry_id = 0;

export function plan_for(key_obj: object, opts: PlanOptions, blocks: BuilderBlock[] | undefined): Plan {
	let rid = registry_ids.get(opts.registry);
	if (rid === undefined) registry_ids.set(opts.registry, (rid = next_registry_id++));
	const bp = opts.breakpoints;
	const key = `${rid}|${opts.model}|${opts.locale ?? ''}|${bp ? `${bp.xsmall}|${bp.small}|${bp.medium}` : ''}${opts.live ? '|live' : ''}`;
	let by_key = plans.get(key_obj);
	if (!by_key) plans.set(key_obj, (by_key = new Map()));
	let plan = by_key.get(key);
	if (!plan) {
		plan = new Plan(opts);
		plan.prepare(blocks);
		by_key.set(key, plan);
	}
	return plan;
}
