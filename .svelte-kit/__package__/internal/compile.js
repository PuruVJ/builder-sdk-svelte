import { max_width_query, sizes_for } from './breakpoints.js';
import { css_class, kebab, style_attr } from './css.js';
import { compile_code } from './evaluate.js';
import { resolve_localized } from './localized.js';
import { parse_path } from './paths.js';
import { lookup } from './registry.js';
const ELEMENT_TYPE = '@builder.io/sdk:Element';
const EMPTY_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const TEXT_TPL_RE = /{{([^}]+)}}/g;
export class Plan {
    options;
    registry;
    model;
    locale;
    sizes;
    has_xsmall;
    compiled = new WeakMap();
    /** Blocks whose CSS is already in {@link sheet} (their render emits no `<style>` of its own). */
    in_sheet = new WeakSet();
    sheet = '';
    /** What the content uses that needs page-level helper scripts (found by the same one walk). */
    flags = { personalization: false, ab: false };
    constructor(opts) {
        this.options = opts;
        this.registry = opts.registry;
        this.model = opts.model;
        this.locale = opts.locale;
        this.sizes = sizes_for(opts.breakpoints ?? {});
        this.has_xsmall = Boolean(opts.breakpoints?.xsmall);
    }
    /** The block's compiled record (cached for the life of the plan). */
    compile(block) {
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
    prepare(blocks) {
        if (!blocks)
            return;
        const parts = [];
        const seen = new WeakSet();
        // An explicit stack, not recursion: content of any depth. Pushed in reverse so blocks are met in
        // document order (the sheet's rule order).
        const stack = [blocks];
        const push_all = (values) => {
            for (let i = values.length - 1; i >= 0; i--)
                stack.push(values[i]);
        };
        while (stack.length) {
            const value = stack.pop();
            if (value === null || typeof value !== 'object' || seen.has(value))
                continue;
            seen.add(value);
            if (Array.isArray(value)) {
                push_all(value);
                continue;
            }
            const obj = value;
            // A nested content (an inline symbol) with A/B variations needs the page's variant helpers.
            if (obj.variations && typeof obj.variations === 'object' && obj.data && Object.keys(obj.variations).length)
                this.flags.ab = true;
            if (obj['@type'] === ELEMENT_TYPE) {
                const block = obj;
                if (block.component?.name === 'PersonalizationContainer')
                    this.flags.personalization = true;
                const c = this.compile(block);
                if (!c.bindings && c.css) {
                    parts.push(c.css);
                    this.in_sheet.add(block);
                }
                // The repeated block renders `c.repeat.block` per item: same styles, already in.
                if (c.repeat && !c.bindings && c.css)
                    this.in_sheet.add(c.repeat.block);
                // visited after this block: children, then component options, then block options
                if (block.options)
                    stack.push(block.options);
                if (block.component?.options)
                    stack.push(block.component.options);
                if (block.children)
                    stack.push(block.children);
                continue;
            }
            const keys = Object.keys(obj);
            for (let i = keys.length - 1; i >= 0; i--)
                stack.push(obj[keys[i]]);
        }
        this.sheet = parts.join(' ');
    }
    /** Compile a block without caching (a bound block's per-render copy). */
    compile_fresh(block) {
        return compile_block(block, this);
    }
}
function compile_block(block, plan) {
    const raw_options = block.component?.options;
    const resolved = resolve_localized(raw_options, plan.locale);
    const builder_block = resolved !== raw_options ? { ...block, component: { ...block.component, options: resolved } } : block;
    const name = block.component?.name;
    const comp = name ? lookup(plan.registry, name, plan.model) : null;
    const options = block.options ? { ...resolved, ...block.options } : (resolved ?? {});
    let text_tpl = null;
    if (name === 'Text' && typeof resolved?.text === 'string' && resolved.text.includes('{{')) {
        text_tpl = [];
        let last = 0;
        for (const m of resolved.text.matchAll(TEXT_TPL_RE)) {
            text_tpl.push(resolved.text.slice(last, m.index));
            text_tpl.push({ fn: compile_code(m[1]), code: m[1] });
            last = m.index + m[0].length;
        }
        text_tpl.push(resolved.text.slice(last));
    }
    let cls = block.id ? block.id + ' builder-block' : 'builder-block';
    if (block.class)
        cls += ' ' + block.class;
    if (block.properties?.class)
        cls += ' ' + block.properties.class;
    const attrs = {};
    if (block.href !== undefined)
        attrs.href = block.href;
    if (block.properties)
        Object.assign(attrs, block.properties);
    attrs['builder-id'] = block.id;
    attrs.style = style_attr(block.style);
    attrs.class = cls;
    let actions = null;
    if (block.actions) {
        for (const key in block.actions) {
            if (!Object.prototype.hasOwnProperty.call(block.actions, key))
                continue;
            const code = block.actions[key];
            (actions ??= []).push([key.toLowerCase(), code, compile_code(code, false)]);
        }
    }
    let bindings = null;
    if (block.bindings) {
        for (const path in block.bindings) {
            const code = block.bindings[path];
            (bindings ??= []).push({ path: parse_path(path), code, fn: code.trim() === '' ? null : compile_code(code) });
        }
    }
    let repeat = null;
    if (block.repeat?.collection) {
        const { repeat: _r, ...without } = block;
        const collection = block.repeat.collection;
        const collection_name = collection.split('.').pop();
        repeat = {
            code: collection,
            fn: compile_code(collection),
            item_name: block.repeat.itemName || (collection_name ? collection_name + 'Item' : 'item'),
            block: without
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
function styles_visible(block) {
    if (block.hide !== undefined && block.hide !== null)
        return !block.hide;
    if (block.show !== undefined && block.show !== null)
        return !!block.show;
    return true;
}
/** official BlockStyles `css()` — the same text, once. */
export function block_css(block, plan) {
    const class_name = block.id;
    if (!class_name)
        return '';
    const styles = block.responsiveStyles;
    const large = styles?.large ? css_class(class_name, styles.large) : '';
    const medium = styles?.medium ? css_class(class_name, styles.medium, max_width_query('medium', plan.sizes)) : '';
    const small = styles?.small ? css_class(class_name, styles.small, max_width_query('small', plan.sizes)) : '';
    const xsmall = styles?.xsmall && plan.has_xsmall ? css_class(class_name, styles.xsmall, max_width_query('xsmall', plan.sizes)) : '';
    let hover = '';
    const hover_anim = block.animations?.find((a) => a.trigger === 'hover');
    if (hover_anim) {
        hover = css_class(`${class_name}:hover`, {
            ...(hover_anim.steps?.[1]?.styles || {}),
            transition: `all ${hover_anim.duration}s ${kebab(String(hover_anim.easing))}`,
            transitionDelay: hover_anim.delay ? `${hover_anim.delay}s` : '0s'
        });
    }
    if (!large && !medium && !small && !xsmall && !hover)
        return '';
    return large + ' ' + medium + ' ' + small + ' ' + xsmall + ' ' + hover;
}
// ── plan cache: one plan per (content object, registry, model, locale) ──────────────────────────
const plans = new WeakMap();
const registry_ids = new WeakMap();
let next_registry_id = 0;
export function plan_for(key_obj, opts, blocks) {
    let rid = registry_ids.get(opts.registry);
    if (rid === undefined)
        registry_ids.set(opts.registry, (rid = next_registry_id++));
    const bp = opts.breakpoints;
    const key = `${rid}|${opts.model}|${opts.locale ?? ''}|${bp ? `${bp.xsmall}|${bp.small}|${bp.medium}` : ''}`;
    let by_key = plans.get(key_obj);
    if (!by_key)
        plans.set(key_obj, (by_key = new Map()));
    let plan = by_key.get(key);
    if (!plan) {
        plan = new Plan(opts);
        plan.prepare(blocks);
        by_key.set(key, plan);
    }
    return plan;
}
