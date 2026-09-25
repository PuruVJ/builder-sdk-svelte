import { run } from './evaluate.js';
import { set_cow } from './paths.js';
const BROWSER = typeof window !== 'undefined';
/**
 * A block with bindings: its bindings applied to a copy-on-write copy of the block (only the objects
 * along each bound path are copied), compiled fresh — the official `getProcessedBlock`, once per
 * render instead of ~107 times, and without the whole-subtree JSON clone.
 */
export function process(c, scope) {
    if (!c.bindings)
        return c;
    const copied = new WeakSet();
    let block = c.builder_block;
    for (const b of c.bindings) {
        const value = b.fn ? run(b.fn, scope, b.code) : undefined;
        block = set_cow(block, b.path, value, copied);
    }
    return scope.ctx.plan.compile_fresh(block);
}
/** A Text block's `{{expr}}` template, evaluated (official `evaluateTextComponentTextOption`). */
function text_of(c, scope) {
    let out = '';
    for (const part of c.text_tpl)
        out += typeof part === 'string' ? part : String(run(part.fn, scope, part.code));
    return out;
}
/** Event handlers for the block's actions (client only — the server renders no handlers). */
export function action_handlers(c, scope, prefix) {
    const out = {};
    if (!BROWSER || !c.actions)
        return out;
    for (const [event, code, fn] of c.actions)
        out[prefix + event] = (e) => run(fn, scope, code, e, true);
    return out;
}
/** The wrapper element's attributes: static ones + (client) event handlers. */
export function wrapper_attrs(c, scope, component_tag) {
    if (!c.actions || !BROWSER)
        return c.attrs;
    // An element gets `onclick`; a component tag (a link component) gets the official prop name.
    return { ...c.attrs, ...action_handlers(c, scope, component_tag ? '' : 'on') };
}
/** The props a registered component receives (official `getBlockComponentOptions` + provide*). */
export function component_props(c, scope) {
    const flags = c.comp?.shouldReceiveBuilderProps;
    const props = { ...c.options };
    if (c.text_tpl)
        props.text = text_of(c, scope);
    if (flags) {
        if (flags.builderBlock)
            props.builderBlock = c.builder_block;
        if (flags.builderContext)
            props.builderContext = scope.store();
        if (flags.builderLinkComponent)
            props.builderLinkComponent = scope.ctx.link_component;
        if (flags.builderComponents)
            props.builderComponents = scope.ctx.registry.as_object(scope.ctx.model);
    }
    props.attributes = c.no_wrap ? { ...c.attrs, ...action_handlers(c, scope, 'on:') } : {};
    return props;
}
/** A repeated block's items (official `getRepeatItemData`), or null when not an array. */
export function repeat_scopes(c, scope) {
    const r = c.repeat;
    const items = run(r.fn, scope, r.code);
    if (!Array.isArray(items))
        return null;
    return items.map((item, i) => scope.item(r.item_name, item, i));
}
