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
import { css_class, kebab, style_attr } from './css.js';
import { compile_code } from './evaluate.js';
import { resolve_localized } from './localized.js';
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
	breakpoints: { xsmall?: number; small?: number; medium?: number } | undefined;
}

export class Plan {
	readonly options: PlanOptions;
	readonly registry: Registry;
	readonly model: string;
	readonly locale: string | undefined;
	readonly sizes: Sizes;
	readonly has_xsmall: boolean;
	readonly compiled = new WeakMap<BuilderBlock, Compiled>();
	/** Repeated blocks (the per-item copy without `repeat`) whose rules are in {@link sheet}; every
	 *  other block carries that on its compiled record (`in_sheet`), no lookup needed. */
	readonly repeat_in_sheet = new WeakSet<BuilderBlock>();
	sheet = '';
	/** What the content uses that needs page-level helper scripts (found by the same one walk). */
	readonly flags = { personalization: false, ab: false };

	constructor(opts: PlanOptions) {
		this.options = opts;
		this.registry = opts.registry;
		this.model = opts.model;
		this.locale = opts.locale;
		this.sizes = sizes_for(opts.breakpoints ?? {});
		this.has_xsmall = Boolean(opts.breakpoints?.xsmall);
	}

	/** The block's compiled record (cached for the life of the plan). */
	compile(block: BuilderBlock): Compiled {
		let c = this.compiled.get(block);
		if (!c) {
			c = compile_block(block, this, false);
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
		if (!blocks) return;
		const localized = new Set<BuilderBlock>();
		const found = find_blocks(blocks, localized, this.flags, MAX_VISITS) ?? find_blocks_guarded(blocks, localized, this.flags);
		const any_localized = localized.size > 0; // most content has none: no lookup per block
		let sheet = '';
		for (let i = 0; i < found.length; i++) {
			const block = found[i];
			if (this.compiled.has(block)) continue; // the same object reached twice
			const c = compile_block(block, this, !(any_localized && localized.has(block)));
			this.compiled.set(block, c);
			if (!c.bindings && c.css) {
				sheet = sheet === '' ? c.css : sheet + ' ' + c.css;
				c.in_sheet = true;
				// The repeated block renders `c.repeat.block` per item: same styles, already in.
				if (c.repeat) this.repeat_in_sheet.add(c.repeat.block);
			}
		}
		this.sheet = sheet;
	}

	/** Compile a block without caching (a bound block's per-render copy). */
	compile_fresh(block: BuilderBlock): Compiled {
		return compile_block(block, this, false);
	}
}

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
			owners.push(null);
			listed.push(false);
		}
		if (component) {
			if (component.name === 'PersonalizationContainer') flags.personalization = true;
			if (component.options) {
				values.push(component.options);
				owners.push(block);
				listed.push(false);
			}
		}
		if (block.children) {
			values.push(block.children);
			owners.push(null);
			listed.push(false);
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
				for (const [v, o] of [
					[block.options, null],
					[block.component?.options, block],
					[block.children, null]
				] as const)
					if (v && typeof v === 'object') {
						values.push(v);
						owners.push(o);
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

function compile_block(block: BuilderBlock, plan: Plan, no_localized: boolean): Compiled {
	const raw_options = block.component?.options;
	// A block the content walk found to own no localized value skips the walk of its options.
	const resolved = no_localized ? raw_options : resolve_localized(raw_options, plan.locale);
	const builder_block =
		resolved !== raw_options ? { ...block, component: { ...block.component!, options: resolved } } : block;

	const name = block.component?.name;
	const comp = name ? lookup(plan.registry, name, plan.model) : null;

	const options: Record<string, unknown> = block.options ? { ...resolved, ...block.options } : (resolved ?? NO_OPTIONS);

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
	const attrs: Record<string, unknown> = {};
	if (block.href !== undefined) attrs.href = block.href;
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

	const tag_name = block.tagName;
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
			transition: `all ${hover_anim.duration}s ${kebab(String(hover_anim.easing))}`,
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
	const key = `${rid}|${opts.model}|${opts.locale ?? ''}|${bp ? `${bp.xsmall}|${bp.small}|${bp.medium}` : ''}`;
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
