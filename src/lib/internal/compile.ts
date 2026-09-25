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
	/** Blocks whose CSS is already in {@link sheet} (their render emits no `<style>` of its own). */
	readonly in_sheet = new WeakSet<BuilderBlock>();
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
			c = compile_block(block, this);
			this.compiled.set(block, c);
		}
		return c;
	}

	/**
	 * Compile every block reachable from `blocks` (children, and blocks nested anywhere in options —
	 * a Columns column, a custom container's slot) and gather the CSS of the static, visible ones
	 * into {@link sheet}. One walk per content.
	 */
	prepare(blocks: BuilderBlock[] | undefined): void {
		if (!blocks) return;
		const parts: string[] = [];
		const seen = new WeakSet<object>();
		// An explicit stack, not recursion: content of any depth. Pushed in reverse so blocks are met in
		// document order (the sheet's rule order).
		const stack: unknown[] = [blocks];
		const push_all = (values: unknown[]) => {
			for (let i = values.length - 1; i >= 0; i--) stack.push(values[i]);
		};
		while (stack.length) {
			const value = stack.pop();
			if (value === null || typeof value !== 'object' || seen.has(value)) continue;
			seen.add(value);
			if (Array.isArray(value)) {
				push_all(value);
				continue;
			}
			const obj = value as Record<string, unknown>;
			// A nested content (an inline symbol) with A/B variations needs the page's variant helpers.
			if (obj.variations && typeof obj.variations === 'object' && obj.data && Object.keys(obj.variations).length)
				this.flags.ab = true;
			if (obj['@type'] === ELEMENT_TYPE) {
				const block = obj as BuilderBlock;
				if (block.component?.name === 'PersonalizationContainer') this.flags.personalization = true;
				const c = this.compile(block);
				if (!c.bindings && c.css) {
					parts.push(c.css);
					this.in_sheet.add(block);
				}
				// The repeated block renders `c.repeat.block` per item: same styles, already in.
				if (c.repeat && !c.bindings && c.css) this.in_sheet.add(c.repeat.block);
				// visited after this block: children, then component options, then block options
				if (block.options) stack.push(block.options);
				if (block.component?.options) stack.push(block.component.options);
				if (block.children) stack.push(block.children);
				continue;
			}
			const keys = Object.keys(obj);
			for (let i = keys.length - 1; i >= 0; i--) stack.push(obj[keys[i]]);
		}
		this.sheet = parts.join(' ');
	}

	/** Compile a block without caching (a bound block's per-render copy). */
	compile_fresh(block: BuilderBlock): Compiled {
		return compile_block(block, this);
	}
}

function compile_block(block: BuilderBlock, plan: Plan): Compiled {
	const raw_options = block.component?.options;
	const resolved = resolve_localized(raw_options, plan.locale);
	const builder_block =
		resolved !== raw_options ? { ...block, component: { ...block.component!, options: resolved } } : block;

	const name = block.component?.name;
	const comp = name ? lookup(plan.registry, name, plan.model) : null;

	const options: Record<string, unknown> = block.options ? { ...resolved, ...block.options } : (resolved ?? {});

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
		empty_tag: EMPTY_TAGS.has(tag.toLowerCase()),
		options,
		text_tpl,
		attrs,
		actions,
		bindings,
		repeat,
		visible: shows_block && !hides_block,
		css: styles_visible(block) ? block_css(block, plan) : '',
		children: block.children ?? []
	};
}

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
